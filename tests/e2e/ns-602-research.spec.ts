import { expect, test } from "./isolated-test.js";

test("imports two Research sources and restores the selected original preview", async ({ page, request }) => {
  const createdResponse = await request.post("/api/v1/series", {
    data: { firstBookTitle: "Source Volume", title: "NS-602 Author Research" },
  });
  expect(createdResponse.ok()).toBe(true);

  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console.error: ${message.text()}`);
  });
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.stack ?? error.message}`));

  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "Workspaces" });
  const researchButton = navigation.getByRole("button", { exact: true, name: "Research" });
  await expect(researchButton).toBeEnabled();
  await researchButton.click();

  const workspace = page.locator("#research-workspace");
  const fileInput = workspace.getByLabel("Choose a TXT or Markdown Research source");
  await expect(workspace).toBeVisible();
  await fileInput.setInputFiles({
    name: "harbor-language-notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("潮門は夜に閉じる。\nThe tide gate closes at night.\n港口旧称: Silver Haven.", "utf8"),
  });
  await expect(workspace.getByRole("status")).toContainText("Imported harbor-language-notes.txt");
  await expect(workspace.locator(".rs8-preview")).toContainText("潮門は夜に閉じる。");
  await expect(workspace.locator(".rs8-preview")).toContainText("Silver Haven");

  await workspace.getByLabel("Display name").fill("Harbor multilingual notes");
  await workspace.getByLabel("Author").fill("Field notebook");
  await workspace.getByLabel("Declared language").fill("ja-JP");
  await workspace.getByLabel("Tags").fill("harbor, language, history");
  await workspace.getByLabel("Allow when selected").check();
  await workspace.getByLabel("Copyright / use notes").fill("Private notes cleared for deliberate model context only.");
  await workspace.getByRole("button", { name: "Save properties" }).click();
  await expect(workspace.getByRole("status")).toContainText("Source properties saved");

  await fileInput.setInputFiles({
    name: "storm-ledger.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Storm ledger\n\n- 1894: western seawall failed\n- 引用: 海鳴りが三日続いた\n", "utf8"),
  });
  await expect(workspace.getByRole("status")).toContainText("Imported storm-ledger.md");
  await expect(workspace.locator(".rs8-preview")).toContainText("# Storm ledger");
  await expect(workspace.locator(".rs8-preview")).toContainText("海鳴りが三日続いた");
  await expect(workspace.getByLabel("Never send")).toBeChecked();

  await navigation.getByRole("button", { exact: true, name: "Plan" }).click();
  await expect(workspace).toBeHidden();
  await researchButton.click();
  await expect(workspace).toBeVisible();
  await expect(workspace.locator(".rs8-preview")).toContainText("# Storm ledger");
  await expect(workspace.getByRole("button", { name: /Harbor multilingual notes/ })).toBeVisible();

  await page.setViewportSize({ width: 960, height: 760 });
  await expect(workspace.locator(".rs8-inspector")).toBeVisible();
  expect(await workspace.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  expect(browserErrors).toEqual([]);
});
