import JSZip from "jszip";
import { expect, test } from "./isolated-test.js";

async function createDocxFixture(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    </Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
    </Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>港湾用語</w:t></w:r></w:p>
        <w:p><w:r><w:t>月守（つきもり）は夜明け前に港へ着いた。</w:t></w:r></w:p>
        <w:p><w:r><w:t>The tide keeper checked the western lantern.</w:t></w:r></w:p>
        <w:sectPr/>
      </w:body>
    </w:document>`);
  zip.file("word/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>
    </w:styles>`);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", platform: "UNIX" });
}

test("imports structured sources, searches exact locations, and keeps databases isolated", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console.error: ${message.text()}`);
  });
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.stack ?? error.message}`));
  page.on("response", (response) => {
    if (response.status() >= 400) browserErrors.push(`http ${response.status()}: ${response.url()}`);
  });

  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "Workspaces" });
  await navigation.getByRole("button", { exact: true, name: "Research" }).click();
  const workspace = page.locator("#research-workspace");

  async function createDatabase(name: string, description: string) {
    await workspace.getByTitle("Create Research Database").click();
    const dialog = workspace.getByRole("dialog", { name: "Create Research Database" });
    await dialog.getByLabel("Name").fill(name);
    await dialog.getByLabel("Description").fill(description);
    await dialog.getByRole("button", { name: "Create database" }).click();
    await expect(workspace.getByText("This source shelf is empty")).toBeVisible();
    return workspace.getByLabel("Research Database", { exact: true }).inputValue();
  }

  const primaryDatabaseId = await createDatabase("Original Language Archive", "Japanese and English source evidence.");
  await workspace.getByLabel("Choose a Research source file").setInputFiles({
    name: "harbor-terms.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: await createDocxFixture(),
  });
  await expect(workspace.getByRole("status")).toContainText("Imported harbor-terms.docx");
  await expect(workspace.locator(".rs10-text-blocks")).toContainText("月守（つきもり）");
  await expect(workspace.getByRole("button", { name: /港湾用語.*Word/u })).toBeVisible();

  const search = workspace.getByLabel("Search selected Research Database");
  await search.fill("月守");
  await workspace.getByRole("button", { exact: true, name: "Search" }).click();
  const result = workspace.getByRole("button", { name: /月守（つきもり）/u });
  await expect(result).toBeVisible();
  await expect(result.locator(".rs10-location-ribbon")).toContainText("paragraph");
  await expect(result.locator(".rs10-location-ribbon")).toContainText("ja");
  await result.click();
  await expect(workspace.locator(".rs10-text-block.is-highlighted")).toContainText("月守（つきもり）");

  const addSource = workspace.getByRole("button", { exact: true, name: "Add source" });
  await addSource.click();
  await workspace.getByRole("menuitem", { name: /Web address/u }).click();
  const webDialog = workspace.getByRole("dialog", { name: "Add web page" });
  await webDialog.getByLabel("Web address").fill("https://research.example.test/harbor-log");
  await webDialog.getByRole("button", { name: "Save snapshot" }).click();
  await expect(workspace.getByRole("status")).toContainText("Saved a snapshot of Harbor web archive");
  await expect(workspace.locator(".rs10-text-blocks")).toContainText("灯台守の記録");
  await expect(workspace.locator(".rs10-text-blocks")).not.toContainText("must not execute");

  const secondaryDatabaseId = await createDatabase("English HTML Shelf", "A second isolated source shelf.");
  expect(secondaryDatabaseId).not.toBe(primaryDatabaseId);
  await workspace.getByLabel("Choose a Research source file").setInputFiles({
    name: "western-ledger.html",
    mimeType: "text/html",
    buffer: Buffer.from("<html><head><title>Western ledger</title></head><body><h1>Harbor B</h1><p>The silver bell rang at noon.</p></body></html>", "utf8"),
  });
  await expect(workspace.locator(".rs10-text-blocks")).toContainText("The silver bell rang at noon");
  await search.fill("月守");
  await workspace.getByRole("button", { exact: true, name: "Search" }).click();
  await expect(workspace.getByText("No matching passage")).toBeVisible();

  const databaseSelect = workspace.getByLabel("Research Database", { exact: true });
  await databaseSelect.selectOption(primaryDatabaseId);
  await search.fill("月守");
  await workspace.getByRole("button", { exact: true, name: "Search" }).click();
  await expect(workspace.getByRole("button", { name: /月守（つきもり）/u })).toBeVisible();

  await page.setViewportSize({ width: 720, height: 760 });
  const compactLayout = await workspace.evaluate((element) => {
    const toolbar = element.querySelector<HTMLElement>(".rs9-toolbar")!;
    const searchbar = element.querySelector<HTMLElement>(".rs10-searchbar")!;
    const reader = element.querySelector<HTMLElement>(".rs8-reader")!;
    return {
      readerFits: reader.scrollWidth <= reader.clientWidth + 1,
      searchFits: searchbar.scrollWidth <= searchbar.clientWidth + 1,
      toolbarFits: toolbar.scrollWidth <= toolbar.clientWidth + 1,
      workspaceFits: element.scrollWidth <= element.clientWidth + 1,
    };
  });
  expect(compactLayout).toEqual({
    readerFits: true,
    searchFits: true,
    toolbarFits: true,
    workspaceFits: true,
  });
  expect(browserErrors).toEqual([]);
});

test("imports and navigates a three-megabyte text source without loading every block", async ({ page }) => {
  test.setTimeout(45_000);
  const paragraph =
    "Aster Vale archive notes describe harbor bells, winter maps, multilingual names, and revision evidence for a fictional author. This paragraph is synthetic acceptance data for Novel Studio Research.";
  const marker =
    "NS604_E2E_FINAL_PASSAGE confirms the last indexed passage opens in the paged reader.";
  const largeText = `${`${paragraph}\n\n`.repeat(15_810)}${marker}`;
  expect(Buffer.byteLength(largeText, "utf8")).toBeGreaterThan(3 * 1024 * 1024);

  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "Workspaces" });
  await navigation.getByRole("button", { exact: true, name: "Research" }).click();
  const workspace = page.locator("#research-workspace");

  await workspace.getByTitle("Create Research Database").click();
  const dialog = workspace.getByRole("dialog", { name: "Create Research Database" });
  await dialog.getByLabel("Name").fill("Large Text Archive");
  await dialog.getByRole("button", { name: "Create database" }).click();

  await workspace.getByLabel("Choose a Research source file").setInputFiles({
    name: "large-archive.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(largeText, "utf8"),
  });
  await expect(workspace.getByRole("status")).toContainText("Imported large-archive.txt", {
    timeout: 20_000,
  });
  await expect(workspace.getByText(/Blocks 1-40 of \d+/u)).toBeVisible();

  await workspace.getByRole("navigation", { name: "Source pages" }).getByRole("button", { name: "Next" }).click();
  await expect(workspace.getByText(/Blocks 41-80 of \d+/u)).toBeVisible();

  const search = workspace.getByLabel("Search selected Research Database");
  await search.fill("NS604_E2E_FINAL_PASSAGE");
  await workspace.getByRole("button", { exact: true, name: "Search" }).click();
  const result = workspace.getByRole("button", { name: /NS604_E2E_FINAL_PASSAGE/u });
  await expect(result).toBeVisible();
  await result.click();

  await expect(workspace.locator(".rs10-text-block.is-highlighted")).toContainText(marker);
  await expect(workspace.getByText(/Blocks (?!1-40)\d+-\d+ of \d+/u)).toBeVisible();
});
