import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import path from "node:path";

const baseURL = "http://127.0.0.1:4317";
const acceptanceRoot = path.join(
  process.env.NOVEL_STUDIO_BROWSER_REPORT_DIR || process.env.TEMP || process.env.TMP || tmpdir(),
  "novel-studio-browser-acceptance",
);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 8_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: path.join(acceptanceRoot, "report"), open: "never" }],
  ],
  globalSetup: "./tests/e2e/global-setup.ts",
  outputDir: path.join(acceptanceRoot, "test-results"),
  use: {
    baseURL,
    locale: "zh-CN",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chrome",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
      },
    },
  ],
});
