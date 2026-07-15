import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const bindingReferencePath = path.resolve(
  process.cwd(),
  "docs/design/ui-redesign/novel-studio-full-ui-redesign-reference.html",
);

const measuredSelectors = [
  ".prototype",
  ".appbar",
  ".brand",
  ".workspace-switcher",
  "#project-library-button",
  "#codex-workspace",
  "#codex-workspace > .rail",
  "#codex-workspace > .entry-index",
  "#codex-workspace > .detail-workspace",
];

async function captureLayout(page: Page) {
  return page.evaluate((selectors) => Object.fromEntries(selectors.map((selector) => {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return [selector, null];
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return [selector, {
      rect: {
        x: Math.round(rect.x * 100) / 100,
        y: Math.round(rect.y * 100) / 100,
        width: Math.round(rect.width * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
      },
      display: style.display,
      gridTemplateColumns: style.gridTemplateColumns,
      gridTemplateRows: style.gridTemplateRows,
      position: style.position,
      visibility: style.visibility,
    }];
  })), measuredSelectors);
}

test("matches declared desktop and compact structural states", async ({ page }, testInfo) => {
  const referenceHtml = await readFile(bindingReferencePath, "utf8");
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));

  for (const viewport of [
    { label: "desktop", width: 1600, height: 1000 },
    { label: "compact", width: 1180, height: 800 },
    { label: "narrow", width: 720, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator("#codex-workspace")).toBeVisible();
    const replicaLayout = await captureLayout(page);
    await page.screenshot({ path: testInfo.outputPath(`${viewport.label}-replica.png`) });

    await page.setContent(referenceHtml, { waitUntil: "load" });
    await expect(page.locator("#codex-workspace")).toBeVisible();
    const bindingLayout = await captureLayout(page);
    await page.screenshot({ path: testInfo.outputPath(`${viewport.label}-binding.png`) });

    expect(replicaLayout).toEqual(bindingLayout);
  }

  expect(browserErrors).toEqual([]);
});
