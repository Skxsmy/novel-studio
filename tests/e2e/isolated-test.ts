import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test as base } from "@playwright/test";

const acceptanceRoot = path.join(
  process.env.NOVEL_STUDIO_BROWSER_REPORT_DIR || process.env.TEMP || process.env.TMP || tmpdir(),
  "novel-studio-browser-acceptance",
);
const libraryRoot = process.env.NOVEL_STUDIO_E2E_LIBRARY
  ? path.resolve(process.env.NOVEL_STUDIO_E2E_LIBRARY)
  : path.join(acceptanceRoot, "library");

export const test = base.extend<{ isolatedLibrary: void }>({
  isolatedLibrary: [async ({}, use) => {
    await rm(libraryRoot, { recursive: true, force: true });
    await mkdir(libraryRoot, { recursive: true });
    await use();
  }, { auto: true }],
});

export { expect };
