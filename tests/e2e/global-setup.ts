import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "../../apps/server/dist/app.js";

async function readPackageVersion(projectRoot: string): Promise<string> {
  try {
    const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8")) as {
      version?: unknown;
    };
    return typeof packageJson.version === "string" && packageJson.version.trim()
      ? packageJson.version.trim()
      : "0.1.0";
  } catch {
    return "0.1.0";
  }
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const acceptanceRoot = path.join(
    process.env.NOVEL_STUDIO_BROWSER_REPORT_DIR || process.env.TEMP || process.env.TMP || tmpdir(),
    "novel-studio-browser-acceptance",
  );
  const libraryRoot = process.env.NOVEL_STUDIO_E2E_LIBRARY
    ? path.resolve(process.env.NOVEL_STUDIO_E2E_LIBRARY)
    : path.join(acceptanceRoot, "library");
  const webRoot = path.join(projectRoot, "apps", "web", "dist");
  await rm(libraryRoot, { recursive: true, force: true });
  await mkdir(libraryRoot, { recursive: true });

  const app = await buildApp({
    libraryRoot,
    webRoot,
    logger: false,
    version: process.env.NOVEL_STUDIO_VERSION ?? await readPackageVersion(projectRoot),
    commit: process.env.NOVEL_STUDIO_COMMIT ?? "browser-acceptance",
    startedAt: process.env.NOVEL_STUDIO_STARTED_AT ?? new Date().toISOString(),
    workspaceRoot: process.env.NOVEL_STUDIO_WORKSPACE_ROOT ?? projectRoot,
  });
  await app.listen({ host: "127.0.0.1", port: 4317 });

  return async () => {
    await app.close();
  };
}
