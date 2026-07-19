import { expect, test } from "./isolated-test.js";

test("creates and returns to isolated Research Databases, then links one to a Series", async ({ page, request }) => {
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
  await expect(workspace.getByText("Create your first Research Database")).toBeVisible();

  async function createDatabase(name: string, description: string) {
    await workspace.getByTitle("Create Research Database").click();
    const dialog = workspace.getByRole("dialog", { name: "Create Research Database" });
    await dialog.getByLabel("Name").fill(name);
    await dialog.getByLabel("Description").fill(description);
    await dialog.getByRole("button", { name: "Create database" }).click();
    await expect(workspace.getByLabel("Research Database", { exact: true })).toHaveValue(/.+/u);
    await expect(workspace.getByText("This source shelf is empty")).toBeVisible();
  }

  await createDatabase("Harbor Archive", "Chinese harbor history and interviews.");
  const databaseSelect = workspace.getByLabel("Research Database", { exact: true });
  const harborDatabaseId = await databaseSelect.inputValue();
  await workspace.getByLabel("Choose a Research source file").setInputFiles({
    name: "harbor-source.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Alpha shelf only: 潮門の鐘は夜明け前に鳴る。", "utf8"),
  });
  await workspace.getByLabel("Display name").fill("Harbor source");
  await workspace.getByRole("button", { name: "Save properties" }).click();
  await expect(workspace.locator(".rs10-text-blocks")).toContainText("Alpha shelf only");

  await createDatabase("Language Archive", "Japanese and English terminology.");
  const languageDatabaseId = await databaseSelect.inputValue();
  expect(languageDatabaseId).not.toBe(harborDatabaseId);
  await workspace.getByLabel("Choose a Research source file").setInputFiles({
    name: "language-source.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Beta shelf only\n\n月守（つきもり） = moon keeper", "utf8"),
  });
  await expect(workspace.locator(".rs10-text-blocks")).toContainText("Beta shelf only");
  await expect(workspace.getByRole("button", { name: /Harbor source/u })).toHaveCount(0);

  await databaseSelect.selectOption(harborDatabaseId);
  await expect(workspace.locator(".rs10-text-blocks")).toContainText("Alpha shelf only");
  await expect(workspace.getByRole("button", { name: /language-source/u })).toHaveCount(0);
  await databaseSelect.selectOption(languageDatabaseId);
  await expect(workspace.locator(".rs10-text-blocks")).toContainText("Beta shelf only");

  const createdSeries = await request.post("/api/v1/series", {
    data: { firstBookTitle: "Reference Volume", title: "Research Link Series" },
  });
  expect(createdSeries.ok()).toBe(true);
  await page.reload();
  await navigation.getByRole("button", { exact: true, name: "Research" }).click();
  await expect(databaseSelect).toHaveValue(languageDatabaseId);
  await databaseSelect.selectOption(harborDatabaseId);
  await workspace.getByRole("button", { exact: true, name: "Database settings" }).click();
  let settings = workspace.getByRole("dialog", { name: "Database settings" });
  const seriesLink = settings.getByRole("checkbox", { name: /Available to current Series/u });
  await seriesLink.check();
  await settings.getByRole("button", { name: "Save database" }).click();
  await expect(workspace.getByRole("status")).toContainText("Research Database settings saved");

  await page.reload();
  await navigation.getByRole("button", { exact: true, name: "Research" }).click();
  await expect(databaseSelect).toHaveValue(harborDatabaseId);
  await expect(workspace.locator(".rs10-text-blocks")).toContainText("Alpha shelf only");
  await workspace.getByRole("button", { exact: true, name: "Database settings" }).click();
  settings = workspace.getByRole("dialog", { name: "Database settings" });
  await expect(settings.getByRole("checkbox", { name: /Available to current Series/u })).toBeChecked();
  await settings.locator("footer").getByRole("button", { exact: true, name: "Close" }).click();

  await page.setViewportSize({ width: 720, height: 760 });
  const compactSettingsButton = workspace.getByRole("button", { exact: true, name: "Database settings" });
  await expect(compactSettingsButton.locator(".rs9-settings-compact")).toBeVisible();
  await expect(compactSettingsButton.locator(".rs9-settings-wide")).toBeHidden();
  const compactLayout = await workspace.evaluate((element) => {
    const toolbar = element.querySelector<HTMLElement>(".rs9-toolbar")!;
    const controls = element.querySelector<HTMLElement>(".rs9-database-controls")!;
    const reader = element.querySelector<HTMLElement>(".rs8-reader")!;
    const settingsButton = element.querySelector<HTMLButtonElement>(".rs9-settings-button")!;
    return {
      controlsFit: controls.scrollWidth <= controls.clientWidth + 1,
      readerFits: reader.scrollWidth <= reader.clientWidth + 1,
      settingsFit: settingsButton.scrollWidth <= settingsButton.clientWidth + 1,
      toolbarFits: toolbar.scrollWidth <= toolbar.clientWidth + 1,
      workspaceFits: element.scrollWidth <= element.clientWidth + 1,
    };
  });
  expect(compactLayout).toEqual({
    controlsFit: true,
    readerFits: true,
    settingsFit: true,
    toolbarFits: true,
    workspaceFits: true,
  });
  expect(browserErrors).toEqual([]);
});
