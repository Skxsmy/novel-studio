import { expect, test } from "./isolated-test.js";

test("searches author-managed aliases across explicitly selected isolated databases", async ({ page }) => {
  test.setTimeout(45_000);
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console.error: ${message.text()}`);
  });
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.stack ?? error.message}`));
  page.on("response", (response) => {
    if (response.status() >= 400) browserErrors.push(`http ${response.status()}: ${response.url()}`);
  });

  await page.goto("/");
  await page.getByRole("navigation", { name: "Workspaces" })
    .getByRole("button", { exact: true, name: "Research" })
    .click();
  const workspace = page.locator("#research-workspace");

  async function createDatabase(name: string) {
    await workspace.getByTitle("Create Research Database").click();
    const dialog = workspace.getByRole("dialog", { name: "Create Research Database" });
    await dialog.getByLabel("Name").fill(name);
    await dialog.getByRole("button", { name: "Create database" }).click();
    await expect(workspace.getByText("This source shelf is empty")).toBeVisible();
    return workspace.getByLabel("Research Database", { exact: true }).inputValue();
  }

  async function importText(name: string, content: string) {
    await workspace.getByLabel("Choose a Research source file").setInputFiles({
      name,
      mimeType: name.endsWith(".md") ? "text/markdown" : "text/plain",
      buffer: Buffer.from(content, "utf8"),
    });
    await expect(workspace.getByRole("status")).toContainText(`Imported ${name}`);
  }

  async function saveAliases(entries: Array<{
    queryTerm: string;
    expansionTerm: string;
    channel?: "alias" | "transliteration";
  }>) {
    await workspace.getByRole("button", { name: "Retrieval settings" }).click();
    const dialog = workspace.getByRole("dialog", { name: "Retrieval settings" });
    for (const [index, entry] of entries.entries()) {
      const number = index + 1;
      await dialog.getByRole("button", { name: "Add query alias" }).click();
      await dialog.getByLabel(`Query term ${number}`).fill(entry.queryTerm);
      await dialog.getByLabel(`Expansion term ${number}`).fill(entry.expansionTerm);
      if (entry.channel === "transliteration") {
        await dialog.getByLabel(`Expansion channel ${number}`).selectOption("transliteration");
      }
    }
    await dialog.getByRole("button", { name: "Save aliases" }).click();
    await expect(dialog.getByRole("button", { name: "Save aliases" })).toBeDisabled();
    await dialog.getByRole("button", { name: "Close" }).click();
  }

  const japaneseDatabaseId = await createDatabase("Japanese route archive");
  const japaneseText = Array.from(
    { length: 12 },
    (_, index) => `## Japanese evidence ${index + 1}\n\n日文证据第 ${index + 1} 段。月影航路は雨港の古い航海日誌に記録されている。`,
  ).join("\n\n");
  await importText("moon-route-ja.md", japaneseText);
  await saveAliases([
    { queryTerm: "月影航线", expansionTerm: "月影航路" },
    { queryTerm: "Moonshadow Route", expansionTerm: "月影航路" },
    { queryTerm: "Ame-no-Minato", expansionTerm: "雨港", channel: "transliteration" },
  ]);

  const englishDatabaseId = await createDatabase("English route archive");
  expect(englishDatabaseId).not.toBe(japaneseDatabaseId);
  const englishText = Array.from(
    { length: 12 },
    (_, index) => `## English evidence ${index + 1}\n\nEnglish evidence passage ${index + 1}. The Moonshadow Route appears in the Ame-no-Minato harbor ledger.`,
  ).join("\n\n");
  await importText("moon-route-en.md", englishText);
  await importText(
    "moon-route-zh.md",
    "## 中文航路记录\n\n中文证据原文。月影航线连接雨港与西侧灯塔，供小说场景核对。",
  );
  await saveAliases([
    { queryTerm: "月影航线", expansionTerm: "Moonshadow Route" },
    { queryTerm: "雨港", expansionTerm: "Ame-no-Minato", channel: "transliteration" },
  ]);

  const search = workspace.getByLabel("Search selected Research Databases");
  await workspace.getByRole("button", { exact: true, name: "Exact" }).click();
  await search.fill("月影航线");
  await workspace.getByRole("button", { exact: true, name: "Search" }).click();
  const results = workspace.getByRole("region", { name: "Search results" });
  await expect(results.locator(".rs11-result-database").filter({ hasText: "Japanese route archive" }).first()).toBeVisible();
  await expect(results.locator(".rs11-result-database").filter({ hasText: "English route archive" })).toHaveCount(0);

  await workspace.getByRole("button", { name: "1 database" }).click();
  const scope = workspace.getByRole("menu", { name: "Search scope" });
  await scope.getByRole("checkbox", { name: /English route archive/u }).check();
  await workspace.getByRole("button", { exact: true, name: "Search" }).click();

  await expect(results.locator(".rs11-result-database").filter({ hasText: "Japanese route archive" }).first()).toBeVisible();
  await expect(results.locator(".rs11-result-database").filter({ hasText: "English route archive" }).first()).toBeVisible();
  await expect(results.getByText("Alias", { exact: true }).first()).toBeVisible();
  await expect(workspace.getByRole("button", { name: "Load more" })).toBeVisible();
  await workspace.getByRole("button", { name: "Load more" }).click();
  await expect(workspace.getByRole("heading", { name: "25 results for “月影航线”" })).toBeVisible();

  async function expectBothDatabases(query: string) {
    await search.fill(query);
    await workspace.getByRole("button", { exact: true, name: "Search" }).click();
    await expect(results.locator(".rs11-result-database").filter({ hasText: "Japanese route archive" }).first()).toBeVisible();
    await expect(results.locator(".rs11-result-database").filter({ hasText: "English route archive" }).first()).toBeVisible();
  }

  await expectBothDatabases("Moonshadow Route");
  expect(await results.locator(".rs10-location-ribbon em").allTextContents())
    .toEqual(expect.arrayContaining(["zh", "ja", "en"]));
  await expectBothDatabases("月影航线 Moonshadow Route");
  await expectBothDatabases("Ame-no-Minato");

  await search.fill("actual fabric");
  await workspace.getByRole("button", { exact: true, name: "Search" }).click();
  await expect(results.getByText("No matching passage")).toBeVisible();
  await search.fill("不存在的彗星观测站");
  await workspace.getByRole("button", { exact: true, name: "Search" }).click();
  await expect(results.getByText("No matching passage")).toBeVisible();

  await search.fill("月影航线");
  await workspace.getByRole("button", { exact: true, name: "Search" }).click();

  await workspace.getByRole("button", { name: /日文证据第 1 段/u }).click();
  await expect(workspace.getByLabel("Research Database", { exact: true })).toHaveValue(japaneseDatabaseId);
  await expect(workspace.locator(".rs10-text-block.is-highlighted")).toContainText("月影航路");
  await expect(workspace.locator(".rs10-search-match")).toContainText("月影航路");
  await expect(workspace.getByRole("status")).toContainText("Opened");
  expect(browserErrors).toEqual([]);
});
