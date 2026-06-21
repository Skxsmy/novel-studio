import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildApp } from "./app.js";

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFile), "../../..");
const libraryRoot = process.env.NOVEL_STUDIO_LIBRARY
  ? path.resolve(process.env.NOVEL_STUDIO_LIBRARY)
  : path.join(projectRoot, "data", "library");
const webRoot = path.join(projectRoot, "apps", "web", "dist");

function readPackageVersion(): string {
  try {
    const packageJson = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8")) as {
      version?: unknown;
    };
    return typeof packageJson.version === "string" && packageJson.version.trim()
      ? packageJson.version.trim()
      : "0.1.0";
  } catch {
    return "0.1.0";
  }
}

function readCommit(): string | null {
  if (process.env.NOVEL_STUDIO_COMMIT?.trim()) {
    return process.env.NOVEL_STUDIO_COMMIT.trim();
  }
  try {
    return execFileSync("git", ["-C", projectRoot, "rev-parse", "--short=12", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

export async function startServer(): Promise<void> {
  const app = await buildApp({
    libraryRoot,
    webRoot,
    logger: true,
    version: process.env.NOVEL_STUDIO_VERSION ?? readPackageVersion(),
    commit: readCommit(),
    startedAt: process.env.NOVEL_STUDIO_STARTED_AT ?? new Date().toISOString(),
    workspaceRoot: process.env.NOVEL_STUDIO_WORKSPACE_ROOT ?? projectRoot,
  });
  await app.listen({ host: "127.0.0.1", port: 4317 });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
