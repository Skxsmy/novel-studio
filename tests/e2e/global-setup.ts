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
  const port = Number(process.env.NOVEL_STUDIO_E2E_PORT || 4318);
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
    researchWebAcquire: async (submittedUrl) => {
      const url = new URL(submittedUrl);
      if (url.hostname !== "research.example.test") {
        throw new Error("Browser acceptance only permits the controlled Research fixture host");
      }
      const fetchedAt = new Date().toISOString();
      return {
        bytes: Buffer.from("<html><head><title>Harbor web archive</title></head><body><h1>Web log</h1><p>灯台守の記録: the western light failed at dusk.</p><script>throw new Error('must not execute')</script></body></html>", "utf8"),
        origin: {
          type: "web",
          requestedUrl: url.toString(),
          finalUrl: url.toString(),
          redirectChain: [],
          fetchedAt,
          responseMediaType: "text/html",
        },
      };
    },
  });
  await app.listen({ host: "127.0.0.1", port });

  return async () => {
    await app.close();
  };
}
