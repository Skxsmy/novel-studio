import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildApp } from "./app.js";

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFile), "../../..");
const libraryRoot = process.env.NOVEL_STUDIO_LIBRARY
  ? path.resolve(process.env.NOVEL_STUDIO_LIBRARY)
  : path.join(projectRoot, "data", "library");
const webRoot = path.join(projectRoot, "apps", "web", "dist");

export async function startServer(): Promise<void> {
  const app = await buildApp({ libraryRoot, webRoot, logger: true });
  await app.listen({ host: "127.0.0.1", port: 4317 });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}

