import { randomUUID } from "node:crypto";
import { mkdir, open, rename, rm, stat, type FileHandle } from "node:fs/promises";
import path from "node:path";
import { StorageError } from "./errors.js";

export function assertInside(root: string, candidate: string): string {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new StorageError("路径超出作品库范围", "PATH_ESCAPE", {
      root: resolvedRoot,
      candidate: resolvedCandidate,
    });
  }
  return resolvedCandidate;
}

export async function atomicWrite(filePath: string, value: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  await writeFileDurably(tempPath, value, "wx");
  try {
    await rename(tempPath, filePath);
    await flushDirectory(path.dirname(filePath));
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}

export async function writeFileDurably(
  filePath: string,
  value: string,
  flag: "w" | "wx" = "w",
): Promise<void> {
  const handle = await open(filePath, flag);
  try {
    await handle.writeFile(value, { encoding: "utf8" });
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function flushDirectory(directoryPath: string): Promise<void> {
  let handle: FileHandle | undefined;
  try {
    handle = await open(directoryPath, "r");
    await handle.sync();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EISDIR" || code === "EINVAL" || code === "ENOTSUP" || code === "EPERM") {
      return;
    }
    throw error;
  } finally {
    await handle?.close();
  }
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}
