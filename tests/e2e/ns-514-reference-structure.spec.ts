import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Page } from "@playwright/test";
import { expect, test } from "./isolated-test.js";

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
  "#overview-workspace",
  "#overview-workspace > .ov7-head",
  "#overview-workspace > .ov7-scroll",
  "#overview-workspace .ov7-resume",
  "#overview-workspace .ov7-progress",
  "#overview-workspace .ov7-columns",
];

const measuredRectSelectors = new Set([".prototype", ".appbar", "#overview-workspace"]);

async function captureLayout(page: Page) {
  return page.evaluate(({ rectSelectors, selectors }) => {
    const rectSelectorSet = new Set(rectSelectors);
    return Object.fromEntries(selectors.map((selector) => {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return [selector, null];
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return [selector, {
      ...(rectSelectorSet.has(selector) ? { rect: {
        x: Math.round(rect.x * 100) / 100,
        y: Math.round(rect.y * 100) / 100,
        width: Math.round(rect.width * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
      } } : {}),
      display: style.display,
      gridTemplateColumns: style.gridTemplateColumns,
      ...(rectSelectorSet.has(selector) ? { gridTemplateRows: style.gridTemplateRows } : {}),
      position: style.position,
      visibility: style.visibility,
    }];
    }));
  }, { rectSelectors: [...measuredRectSelectors], selectors: measuredSelectors });
}

test("matches declared desktop and compact structural states", async ({ page, request }, testInfo) => {
  const referenceHtml = await readFile(bindingReferencePath, "utf8");
  const created = await request.post("/api/v1/series", {
    data: { firstBookTitle: "Saltwake", title: "The Glass Harbor" },
  });
  expect(created.ok()).toBe(true);
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));

  for (const viewport of [
    { label: "desktop", width: 1600, height: 1000 },
    { label: "compact", width: 1180, height: 800 },
    { label: "narrow", width: 720, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator("#overview-workspace")).toBeVisible();
    await expect(page.locator("#overview-workspace").getByRole("heading", { name: "The Glass Harbor" })).toBeVisible();
    await page.evaluate(() => {
      document.getElementById("current-series-name")!.textContent = "The Glass Harbor";
      document.getElementById("current-volume-name")!.textContent = "Volume · Saltwake";
    });
    const replicaLayout = await captureLayout(page);
    await page.screenshot({ path: testInfo.outputPath(`${viewport.label}-replica.png`) });

    await page.setContent(referenceHtml, { waitUntil: "load" });
    await page.getByRole("button", { name: "Overview" }).click();
    await expect(page.locator("#overview-workspace")).toBeVisible();
    const bindingLayout = await captureLayout(page);
    await page.screenshot({ path: testInfo.outputPath(`${viewport.label}-binding.png`) });

    expect(replicaLayout).toEqual(bindingLayout);
  }

  expect(browserErrors).toEqual([]);
});
