import { expect, test } from "@playwright/test";

interface CreatedSeries {
  manifest: { id: string; title: string };
  books: Array<{ title: string }>;
  scenes: Array<{ metadata: { id: string; title: string } }>;
}

test("opens on Overview and continues into the real selected Scene", async ({ page, request }) => {
  const createdResponse = await request.post("/api/v1/series", {
    data: {
      firstBookTitle: "Overview Volume",
      title: "NS-514 Overview Authority",
    },
  });
  expect(createdResponse.ok()).toBe(true);
  const created = await createdResponse.json() as CreatedSeries;
  const initialScene = created.scenes[0];
  expect(initialScene).toBeTruthy();

  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console.error: ${message.text()}`);
  });
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.stack ?? error.message}`));

  await page.goto("/");
  const overview = page.locator("#overview-workspace");
  const workspaceNavigation = page.getByRole("navigation", { name: "Workspaces" });
  await expect(overview).toBeVisible();
  await expect(workspaceNavigation.getByRole("button", { exact: true, name: "Overview" })).toHaveAttribute("aria-current", "page");
  await expect(overview.getByRole("heading", { name: created.manifest.title })).toBeVisible();
  await expect(overview).toContainText(`Volume · ${created.books[0]!.title}`);
  await expect(overview).toContainText(initialScene!.metadata.title);
  await expect(page.locator("#project-library-button")).not.toContainText("The Glass Harbor");
  await expect(overview).not.toContainText("A Weather Door");
  await expect(overview.getByRole("button", { name: "Continuity warnings are not available yet" })).toBeDisabled();

  await overview.getByRole("button", { name: "Continue writing" }).click();
  await expect(page.locator("#write-workspace")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Scene title" })).toHaveValue(initialScene!.metadata.title);

  await workspaceNavigation.getByRole("button", { exact: true, name: "Overview" }).click();
  await expect(overview).toBeVisible();
  await overview.locator(`[data-ov7-write="${initialScene!.metadata.id}"]`).last().click();
  await expect(page.locator("#write-workspace")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Scene title" })).toHaveValue(initialScene!.metadata.title);
  expect(browserErrors).toEqual([]);
});
