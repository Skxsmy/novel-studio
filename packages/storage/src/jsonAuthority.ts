import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { ZodError } from "zod";
import { StorageError } from "./errors.js";
import { assertInside, atomicWrite } from "./fileSystem.js";

export interface JsonAuthorityDocument<T> {
  data: T;
  revision: string;
  raw: string;
  filePath: string;
}

export type JsonAuthorityParser<T> = (input: unknown) => T;

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => stableJsonValue(item));
  if (!value || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(entries.map(([key, entryValue]) => [key, stableJsonValue(entryValue)]));
}

export function serializeJsonAuthority(value: unknown): string {
  return `${JSON.stringify(stableJsonValue(value), null, 2)}\n`;
}

export function jsonAuthorityRevision(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function parseJsonAuthorityText<T>(
  raw: string,
  parse: JsonAuthorityParser<T>,
  label = "JSON authority file",
): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new StorageError(`${label} is not valid JSON`, "INVALID_DATA", {
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    return parse(parsed);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new StorageError(`${label} failed schema validation`, "INVALID_DATA", {
        issues: error.issues,
      });
    }
    throw error;
  }
}

export async function readJsonAuthorityFile<T>(
  root: string,
  filePath: string,
  parse: JsonAuthorityParser<T>,
  label?: string,
): Promise<JsonAuthorityDocument<T>> {
  const resolvedPath = assertInside(root, filePath);
  let raw: string;
  try {
    raw = await readFile(resolvedPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new StorageError("JSON authority file not found", "NOT_FOUND", {
        filePath: resolvedPath,
      });
    }
    throw error;
  }

  const data = parseJsonAuthorityText(raw, parse, label);
  return {
    data,
    revision: jsonAuthorityRevision(raw),
    raw,
    filePath: resolvedPath,
  };
}

export async function writeJsonAuthorityFile<T>(
  root: string,
  filePath: string,
  value: unknown,
  parse: JsonAuthorityParser<T>,
  readBack: (filePath: string) => Promise<string> = (targetPath) => readFile(targetPath, "utf8"),
): Promise<JsonAuthorityDocument<T>> {
  const resolvedPath = assertInside(root, filePath);
  const data = parse(value);
  const raw = serializeJsonAuthority(data);
  const expectedRevision = jsonAuthorityRevision(raw);
  await atomicWrite(resolvedPath, raw);
  const onDiskRaw = await readBack(resolvedPath);
  const actualRevision = jsonAuthorityRevision(onDiskRaw);
  if (actualRevision !== expectedRevision || onDiskRaw !== raw) {
    throw new StorageError("JSON authority write verification failed", "INVALID_DATA", {
      filePath: resolvedPath,
      expectedRevision,
      actualRevision,
    });
  }
  const onDiskData = parseJsonAuthorityText(onDiskRaw, parse, "JSON authority write verification");
  return {
    data: onDiskData,
    revision: actualRevision,
    raw: onDiskRaw,
    filePath: resolvedPath,
  };
}
