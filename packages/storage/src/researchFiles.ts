import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  ResearchSourceDetailSchema,
  ResearchSourceDocumentSchema,
  ResearchSourceSchema,
  UpdateResearchSourceInputSchema,
  type ResearchSource,
  type ResearchSourceDetail,
  type ResearchSourceDocument,
  type UpdateResearchSourceInput,
} from "@novel-studio/contracts";
import { StorageError } from "./errors.js";
import { runSeriesFileTransaction, type FileTransactionOptions } from "./fileTransactions.js";
import { assertInside, pathExists } from "./fileSystem.js";
import {
  jsonAuthorityRevision,
  parseJsonAuthorityText,
  readJsonAuthorityFile,
  serializeJsonAuthority,
} from "./jsonAuthority.js";

export type ResearchFileTransactionOptions = FileTransactionOptions;

const RESEARCH_DIR = "research";
const SOURCES_DIR = "sources";
const ORIGINALS_DIR = "originals";

function researchRoot(seriesRoot: string): string {
  return assertInside(seriesRoot, path.join(seriesRoot, RESEARCH_DIR));
}

function sourcesRoot(seriesRoot: string): string {
  return assertInside(seriesRoot, path.join(researchRoot(seriesRoot), SOURCES_DIR));
}

function originalsRoot(seriesRoot: string): string {
  return assertInside(seriesRoot, path.join(researchRoot(seriesRoot), ORIGINALS_DIR));
}

export function researchSourcePath(seriesRoot: string, sourceId: string): string {
  return assertInside(seriesRoot, path.join(sourcesRoot(seriesRoot), `${sourceId}.json`));
}

export function researchOriginalPath(seriesRoot: string, source: Pick<ResearchSource, "id" | "kind">): string {
  return assertInside(
    seriesRoot,
    path.join(originalsRoot(seriesRoot), `${source.id}.${source.kind === "markdown" ? "md" : "txt"}`),
  );
}

async function listJsonFiles(directory: string): Promise<string[]> {
  try {
    return (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => path.join(directory, entry.name))
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function readSourceAuthority(seriesRoot: string, filePath: string): Promise<ResearchSourceDocument> {
  const document = await readJsonAuthorityFile(
    seriesRoot,
    filePath,
    (value) => ResearchSourceSchema.parse(value),
    "Research source authority",
  );
  return ResearchSourceDocumentSchema.parse({ source: document.data, revision: document.revision });
}

export async function listResearchSourceFiles(
  seriesRoot: string,
  seriesId: string,
): Promise<ResearchSourceDocument[]> {
  const sources = await Promise.all(
    (await listJsonFiles(sourcesRoot(seriesRoot))).map((filePath) => readSourceAuthority(seriesRoot, filePath)),
  );
  const foreign = sources.find((document) => document.source.seriesId !== seriesId);
  if (foreign) {
    throw new StorageError("Research source belongs to another Series", "INVALID_DATA", {
      actualSeriesId: foreign.source.seriesId,
      seriesId,
      sourceId: foreign.source.id,
    });
  }
  return sources.sort((left, right) =>
    right.source.importedAt.localeCompare(left.source.importedAt) || left.source.id.localeCompare(right.source.id),
  );
}

export async function readResearchSourceFile(
  seriesRoot: string,
  seriesId: string,
  sourceId: string,
): Promise<ResearchSourceDetail> {
  let document: ResearchSourceDocument;
  try {
    document = await readSourceAuthority(seriesRoot, researchSourcePath(seriesRoot, sourceId));
  } catch (error) {
    if (error instanceof StorageError && error.code === "NOT_FOUND") {
      throw new StorageError("Research source does not exist", "NOT_FOUND", { sourceId });
    }
    throw error;
  }
  if (document.source.seriesId !== seriesId) {
    throw new StorageError("Research source belongs to another Series", "INVALID_DATA", {
      actualSeriesId: document.source.seriesId,
      seriesId,
      sourceId,
    });
  }
  const originalPath = assertInside(seriesRoot, path.join(seriesRoot, document.source.originalRelativePath));
  const canonicalOriginalPath = researchOriginalPath(seriesRoot, document.source);
  if (originalPath !== canonicalOriginalPath) {
    throw new StorageError("Research source original path is not canonical", "INVALID_DATA", { sourceId });
  }
  let originalText: string;
  try {
    originalText = await readFile(originalPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new StorageError("Research source original file is missing", "INVALID_DATA", { sourceId });
    }
    throw error;
  }
  const actualHash = createHash("sha256").update(originalText, "utf8").digest("hex");
  if (actualHash !== document.source.contentHash || Buffer.byteLength(originalText, "utf8") !== document.source.sizeBytes) {
    throw new StorageError("Research source original file does not match its authority record", "INVALID_DATA", {
      sourceId,
    });
  }
  return ResearchSourceDetailSchema.parse({ ...document, originalText });
}

export async function createResearchSourceFile(
  seriesRoot: string,
  source: ResearchSource,
  originalText: string,
  transactionOptions: FileTransactionOptions = {},
): Promise<ResearchSourceDetail> {
  const parsed = ResearchSourceSchema.parse(source);
  const actualHash = createHash("sha256").update(originalText, "utf8").digest("hex");
  const actualSize = Buffer.byteLength(originalText, "utf8");
  if (actualHash !== parsed.contentHash || actualSize !== parsed.sizeBytes) {
    throw new StorageError("Research source bytes do not match the import facts", "INVALID_DATA", {
      sourceId: parsed.id,
    });
  }
  return runSeriesFileTransaction(seriesRoot, async (commit) => {
    const sourcePath = researchSourcePath(seriesRoot, parsed.id);
    const originalPath = researchOriginalPath(seriesRoot, parsed);
    if (await pathExists(sourcePath) || await pathExists(originalPath)) {
      throw new StorageError("Research source already exists", "CONFLICT", { sourceId: parsed.id });
    }
    const duplicate = (await listResearchSourceFiles(seriesRoot, parsed.seriesId))
      .find((document) => document.source.contentHash === parsed.contentHash);
    if (duplicate) {
      throw new StorageError("This Research source content has already been imported", "CONFLICT", {
        sourceId: duplicate.source.id,
        contentHash: parsed.contentHash,
      });
    }
    const relativeOriginalPath = path.relative(seriesRoot, originalPath).split(path.sep).join("/");
    if (parsed.originalRelativePath !== relativeOriginalPath) {
      throw new StorageError("Research source original path is not canonical", "INVALID_DATA", { sourceId: parsed.id });
    }

    await commit([
      { targetPath: originalPath, content: originalText },
      { targetPath: sourcePath, content: serializeJsonAuthority(parsed) },
    ]);
    return readResearchSourceFile(seriesRoot, parsed.seriesId, parsed.id);
  }, transactionOptions);
}

export async function updateResearchSourceFile(
  seriesRoot: string,
  seriesId: string,
  sourceId: string,
  rawInput: UpdateResearchSourceInput,
): Promise<ResearchSourceDetail> {
  const input = UpdateResearchSourceInputSchema.parse(rawInput);
  return runSeriesFileTransaction(seriesRoot, async (commit) => {
    const current = await readResearchSourceFile(seriesRoot, seriesId, sourceId);
    if (current.revision !== input.baseRevision) {
      throw new StorageError("Research source has changed since it was opened", "CONFLICT", {
        sourceId,
        expectedRevision: input.baseRevision,
        actualRevision: current.revision,
      });
    }
    const { baseRevision: _baseRevision, ...properties } = input;
    const updated = ResearchSourceSchema.parse({
      ...current.source,
      ...properties,
      updatedAt: new Date().toISOString(),
    });
    const raw = serializeJsonAuthority(updated);
    await commit([{ targetPath: researchSourcePath(seriesRoot, sourceId), content: raw }]);
    const verified = parseJsonAuthorityText(raw, (value) => ResearchSourceSchema.parse(value));
    return ResearchSourceDetailSchema.parse({
      source: verified,
      revision: jsonAuthorityRevision(raw),
      originalText: current.originalText,
    });
  });
}
