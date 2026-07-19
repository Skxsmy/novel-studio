import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  LegacyResearchSourceSchema,
  ResearchSourceDetailSchema,
  ResearchSourceDocumentSchema,
  ResearchSourceSchema,
  UpdateResearchSourceInputSchema,
  type LegacyResearchSource,
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
const MIGRATIONS_DIR = "migrations";

export interface LegacyResearchSourceDocument {
  source: LegacyResearchSource;
  revision: string;
}

export interface LegacyResearchSourceDetail extends LegacyResearchSourceDocument {
  originalText: string;
}

export interface LegacyResearchMigrationResult {
  importedSourceIds: string[];
  skippedDuplicateSourceIds: string[];
}

function legacyResearchRoot(seriesRoot: string): string {
  return assertInside(seriesRoot, path.join(seriesRoot, RESEARCH_DIR));
}

function legacySourcesRoot(seriesRoot: string): string {
  return assertInside(seriesRoot, path.join(legacyResearchRoot(seriesRoot), SOURCES_DIR));
}

function legacyOriginalsRoot(seriesRoot: string): string {
  return assertInside(seriesRoot, path.join(legacyResearchRoot(seriesRoot), ORIGINALS_DIR));
}

export function legacyResearchSourcePath(seriesRoot: string, sourceId: string): string {
  return assertInside(seriesRoot, path.join(legacySourcesRoot(seriesRoot), `${sourceId}.json`));
}

export function legacyResearchOriginalPath(
  seriesRoot: string,
  source: Pick<LegacyResearchSource, "id" | "kind">,
): string {
  return assertInside(
    seriesRoot,
    path.join(legacyOriginalsRoot(seriesRoot), `${source.id}.${source.kind === "markdown" ? "md" : "txt"}`),
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

async function readLegacySourceAuthority(
  seriesRoot: string,
  filePath: string,
): Promise<LegacyResearchSourceDocument> {
  const document = await readJsonAuthorityFile(
    seriesRoot,
    filePath,
    (value) => LegacyResearchSourceSchema.parse(value),
    "Legacy Research source authority",
  );
  return { source: document.data, revision: document.revision };
}

export async function listLegacyResearchSourceFiles(
  seriesRoot: string,
  seriesId: string,
): Promise<LegacyResearchSourceDocument[]> {
  const sources = await Promise.all(
    (await listJsonFiles(legacySourcesRoot(seriesRoot)))
      .map((filePath) => readLegacySourceAuthority(seriesRoot, filePath)),
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

export async function readLegacyResearchSourceFile(
  seriesRoot: string,
  seriesId: string,
  sourceId: string,
): Promise<LegacyResearchSourceDetail> {
  let document: LegacyResearchSourceDocument;
  try {
    document = await readLegacySourceAuthority(seriesRoot, legacyResearchSourcePath(seriesRoot, sourceId));
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
  const canonicalOriginalPath = legacyResearchOriginalPath(seriesRoot, document.source);
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
  return { ...document, originalText };
}

export async function createLegacyResearchSourceFile(
  seriesRoot: string,
  source: LegacyResearchSource,
  originalText: string,
  transactionOptions: FileTransactionOptions = {},
): Promise<LegacyResearchSourceDetail> {
  const parsed = LegacyResearchSourceSchema.parse(source);
  const actualHash = createHash("sha256").update(originalText, "utf8").digest("hex");
  const actualSize = Buffer.byteLength(originalText, "utf8");
  if (actualHash !== parsed.contentHash || actualSize !== parsed.sizeBytes) {
    throw new StorageError("Research source bytes do not match the import facts", "INVALID_DATA", {
      sourceId: parsed.id,
    });
  }
  return runSeriesFileTransaction(seriesRoot, async (commit) => {
    const sourcePath = legacyResearchSourcePath(seriesRoot, parsed.id);
    const originalPath = legacyResearchOriginalPath(seriesRoot, parsed);
    if (await pathExists(sourcePath) || await pathExists(originalPath)) {
      throw new StorageError("Research source already exists", "CONFLICT", { sourceId: parsed.id });
    }
    const duplicate = (await listLegacyResearchSourceFiles(seriesRoot, parsed.seriesId))
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
    return readLegacyResearchSourceFile(seriesRoot, parsed.seriesId, parsed.id);
  }, transactionOptions);
}

export async function updateLegacyResearchSourceFile(
  seriesRoot: string,
  seriesId: string,
  sourceId: string,
  rawInput: UpdateResearchSourceInput,
): Promise<LegacyResearchSourceDetail> {
  const input = UpdateResearchSourceInputSchema.parse(rawInput);
  return runSeriesFileTransaction(seriesRoot, async (commit) => {
    const current = await readLegacyResearchSourceFile(seriesRoot, seriesId, sourceId);
    if (current.revision !== input.baseRevision) {
      throw new StorageError("Research source has changed since it was opened", "CONFLICT", {
        sourceId,
        expectedRevision: input.baseRevision,
        actualRevision: current.revision,
      });
    }
    const { baseRevision: _baseRevision, ...properties } = input;
    const updated = LegacyResearchSourceSchema.parse({
      ...current.source,
      ...properties,
      updatedAt: new Date().toISOString(),
    });
    const raw = serializeJsonAuthority(updated);
    await commit([{ targetPath: legacyResearchSourcePath(seriesRoot, sourceId), content: raw }]);
    const verified = parseJsonAuthorityText(raw, (value) => LegacyResearchSourceSchema.parse(value));
    return {
      source: verified,
      revision: jsonAuthorityRevision(raw),
      originalText: current.originalText,
    };
  });
}

function databaseSourcesRoot(databaseRoot: string): string {
  return assertInside(databaseRoot, path.join(databaseRoot, SOURCES_DIR));
}

function databaseOriginalsRoot(databaseRoot: string): string {
  return assertInside(databaseRoot, path.join(databaseRoot, ORIGINALS_DIR));
}

function databaseMigrationsRoot(databaseRoot: string): string {
  return assertInside(databaseRoot, path.join(databaseRoot, MIGRATIONS_DIR));
}

export function researchDatabaseSourcePath(databaseRoot: string, sourceId: string): string {
  return assertInside(databaseRoot, path.join(databaseSourcesRoot(databaseRoot), `${sourceId}.json`));
}

export function researchDatabaseOriginalPath(
  databaseRoot: string,
  source: Pick<ResearchSource, "id" | "kind">,
): string {
  return assertInside(
    databaseRoot,
    path.join(databaseOriginalsRoot(databaseRoot), `${source.id}.${source.kind === "markdown" ? "md" : "txt"}`),
  );
}

function legacyMigrationReceiptPath(databaseRoot: string, seriesId: string): string {
  return assertInside(
    databaseRoot,
    path.join(databaseMigrationsRoot(databaseRoot), `legacy-series-${seriesId}.json`),
  );
}

export async function hasLegacyResearchMigrationReceipt(
  databaseRoot: string,
  seriesId: string,
): Promise<boolean> {
  return pathExists(legacyMigrationReceiptPath(databaseRoot, seriesId));
}

async function readDatabaseSourceAuthority(
  databaseRoot: string,
  filePath: string,
): Promise<ResearchSourceDocument> {
  const document = await readJsonAuthorityFile(
    databaseRoot,
    filePath,
    (value) => ResearchSourceSchema.parse(value),
    "Research source authority",
  );
  return ResearchSourceDocumentSchema.parse({ source: document.data, revision: document.revision });
}

export async function listResearchDatabaseSourceFiles(
  databaseRoot: string,
  researchDatabaseId: string,
): Promise<ResearchSourceDocument[]> {
  const sources = await Promise.all(
    (await listJsonFiles(databaseSourcesRoot(databaseRoot)))
      .map((filePath) => readDatabaseSourceAuthority(databaseRoot, filePath)),
  );
  const foreign = sources.find((document) => document.source.researchDatabaseId !== researchDatabaseId);
  if (foreign) {
    throw new StorageError("Research source belongs to another Research Database", "INVALID_DATA", {
      actualResearchDatabaseId: foreign.source.researchDatabaseId,
      researchDatabaseId,
      sourceId: foreign.source.id,
    });
  }
  return sources.sort((left, right) =>
    right.source.importedAt.localeCompare(left.source.importedAt)
    || left.source.id.localeCompare(right.source.id),
  );
}

export async function readResearchDatabaseSourceFile(
  databaseRoot: string,
  researchDatabaseId: string,
  sourceId: string,
): Promise<ResearchSourceDetail> {
  let document: ResearchSourceDocument;
  try {
    document = await readDatabaseSourceAuthority(databaseRoot, researchDatabaseSourcePath(databaseRoot, sourceId));
  } catch (error) {
    if (error instanceof StorageError && error.code === "NOT_FOUND") {
      throw new StorageError("Research source does not exist", "NOT_FOUND", { sourceId });
    }
    throw error;
  }
  if (document.source.researchDatabaseId !== researchDatabaseId) {
    throw new StorageError("Research source belongs to another Research Database", "INVALID_DATA", {
      actualResearchDatabaseId: document.source.researchDatabaseId,
      researchDatabaseId,
      sourceId,
    });
  }
  const originalPath = assertInside(databaseRoot, path.join(databaseRoot, document.source.originalRelativePath));
  const canonicalOriginalPath = researchDatabaseOriginalPath(databaseRoot, document.source);
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
  if (
    actualHash !== document.source.contentHash
    || Buffer.byteLength(originalText, "utf8") !== document.source.sizeBytes
  ) {
    throw new StorageError("Research source original file does not match its authority record", "INVALID_DATA", {
      sourceId,
    });
  }
  return ResearchSourceDetailSchema.parse({ ...document, originalText });
}

export async function createResearchDatabaseSourceFile(
  databaseRoot: string,
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
  return runSeriesFileTransaction(databaseRoot, async (commit) => {
    const sourcePath = researchDatabaseSourcePath(databaseRoot, parsed.id);
    const originalPath = researchDatabaseOriginalPath(databaseRoot, parsed);
    if (await pathExists(sourcePath) || await pathExists(originalPath)) {
      throw new StorageError("Research source already exists", "CONFLICT", { sourceId: parsed.id });
    }
    const duplicate = (await listResearchDatabaseSourceFiles(databaseRoot, parsed.researchDatabaseId))
      .find((document) => document.source.contentHash === parsed.contentHash);
    if (duplicate) {
      throw new StorageError("This Research source content has already been imported into this database", "CONFLICT", {
        contentHash: parsed.contentHash,
        sourceId: duplicate.source.id,
      });
    }
    const relativeOriginalPath = path.relative(databaseRoot, originalPath).split(path.sep).join("/");
    if (parsed.originalRelativePath !== relativeOriginalPath) {
      throw new StorageError("Research source original path is not canonical", "INVALID_DATA", { sourceId: parsed.id });
    }
    await commit([
      { targetPath: originalPath, content: originalText },
      { targetPath: sourcePath, content: serializeJsonAuthority(parsed) },
    ]);
    return readResearchDatabaseSourceFile(databaseRoot, parsed.researchDatabaseId, parsed.id);
  }, transactionOptions);
}

export async function updateResearchDatabaseSourceFile(
  databaseRoot: string,
  researchDatabaseId: string,
  sourceId: string,
  rawInput: UpdateResearchSourceInput,
): Promise<ResearchSourceDetail> {
  const input = UpdateResearchSourceInputSchema.parse(rawInput);
  return runSeriesFileTransaction(databaseRoot, async (commit) => {
    const current = await readResearchDatabaseSourceFile(databaseRoot, researchDatabaseId, sourceId);
    if (current.revision !== input.baseRevision) {
      throw new StorageError("Research source has changed since it was opened", "CONFLICT", {
        actualRevision: current.revision,
        expectedRevision: input.baseRevision,
        sourceId,
      });
    }
    const { baseRevision: _baseRevision, ...properties } = input;
    const updated = ResearchSourceSchema.parse({
      ...current.source,
      ...properties,
      updatedAt: new Date().toISOString(),
    });
    const raw = serializeJsonAuthority(updated);
    await commit([{ targetPath: researchDatabaseSourcePath(databaseRoot, sourceId), content: raw }]);
    const verified = parseJsonAuthorityText(raw, (value) => ResearchSourceSchema.parse(value));
    return ResearchSourceDetailSchema.parse({
      source: verified,
      revision: jsonAuthorityRevision(raw),
      originalText: current.originalText,
    });
  });
}

const LegacyMigrationReceiptSchema = z.object({
  schemaVersion: z.literal(1),
  researchDatabaseId: z.string().uuid(),
  seriesId: z.string().uuid(),
  migratedAt: z.string().datetime(),
  imported: z.array(z.object({
    legacySourceId: z.string().uuid(),
    sourceId: z.string().uuid(),
    sourceRevision: z.string().regex(/^[a-f0-9]{64}$/u),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/u),
  })),
  skippedDuplicates: z.array(z.object({
    legacySourceId: z.string().uuid(),
    existingSourceId: z.string().uuid(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/u),
  })),
});

export async function migrateLegacyResearchSourceFiles(
  databaseRoot: string,
  researchDatabaseId: string,
  seriesId: string,
  legacySources: LegacyResearchSourceDetail[],
  transactionOptions: FileTransactionOptions = {},
): Promise<LegacyResearchMigrationResult> {
  if (legacySources.length === 0) {
    throw new StorageError("This Series has no legacy Research sources to migrate", "NOT_FOUND", { seriesId });
  }
  return runSeriesFileTransaction(databaseRoot, async (commit) => {
    const receiptPath = legacyMigrationReceiptPath(databaseRoot, seriesId);
    if (await pathExists(receiptPath)) {
      throw new StorageError("Legacy Research sources from this Series were already migrated to this database", "CONFLICT", {
        researchDatabaseId,
        seriesId,
      });
    }
    const existing = await listResearchDatabaseSourceFiles(databaseRoot, researchDatabaseId);
    const byHash = new Map(existing.map((document) => [document.source.contentHash, document.source.id]));
    const imported: Array<z.infer<typeof LegacyMigrationReceiptSchema>["imported"][number]> = [];
    const skippedDuplicates: Array<z.infer<typeof LegacyMigrationReceiptSchema>["skippedDuplicates"][number]> = [];
    const createdSources: Array<{ source: ResearchSource; originalText: string }> = [];
    const now = new Date().toISOString();

    for (const legacy of legacySources) {
      if (legacy.source.seriesId !== seriesId) {
        throw new StorageError("Legacy Research source belongs to another Series", "INVALID_DATA", {
          actualSeriesId: legacy.source.seriesId,
          seriesId,
          sourceId: legacy.source.id,
        });
      }
      const duplicateId = byHash.get(legacy.source.contentHash);
      if (duplicateId) {
        skippedDuplicates.push({
          legacySourceId: legacy.source.id,
          existingSourceId: duplicateId,
          contentHash: legacy.source.contentHash,
        });
        continue;
      }
      const sourceId = randomUUID();
      const originalPath = researchDatabaseOriginalPath(databaseRoot, { id: sourceId, kind: legacy.source.kind });
      const source = ResearchSourceSchema.parse({
        schemaVersion: 2,
        id: sourceId,
        researchDatabaseId,
        kind: legacy.source.kind,
        mediaType: legacy.source.mediaType,
        originalFileName: legacy.source.originalFileName,
        sizeBytes: legacy.source.sizeBytes,
        contentHash: legacy.source.contentHash,
        originalRelativePath: path.relative(databaseRoot, originalPath).split(path.sep).join("/"),
        parseStatus: legacy.source.parseStatus,
        parserName: legacy.source.parserName,
        parserVersion: legacy.source.parserVersion,
        importedAt: legacy.source.importedAt,
        updatedAt: now,
        displayName: legacy.source.displayName,
        author: legacy.source.author,
        declaredLanguage: legacy.source.declaredLanguage,
        tags: legacy.source.tags,
        aiPermission: legacy.source.aiPermission,
        useNotes: legacy.source.useNotes,
        legacyOrigin: {
          seriesId,
          sourceId: legacy.source.id,
          sourceRevision: legacy.revision,
        },
      });
      createdSources.push({ source, originalText: legacy.originalText });
      imported.push({
        legacySourceId: legacy.source.id,
        sourceId,
        sourceRevision: legacy.revision,
        contentHash: legacy.source.contentHash,
      });
      byHash.set(source.contentHash, sourceId);
    }

    const receipt = LegacyMigrationReceiptSchema.parse({
      schemaVersion: 1,
      researchDatabaseId,
      seriesId,
      migratedAt: now,
      imported,
      skippedDuplicates,
    });
    await commit([
      ...createdSources.flatMap(({ source, originalText }) => [
        { targetPath: researchDatabaseOriginalPath(databaseRoot, source), content: originalText },
        { targetPath: researchDatabaseSourcePath(databaseRoot, source.id), content: serializeJsonAuthority(source) },
      ]),
      { targetPath: receiptPath, content: serializeJsonAuthority(receipt) },
    ]);

    for (const { source, originalText } of createdSources) {
      const verified = await readResearchDatabaseSourceFile(databaseRoot, researchDatabaseId, source.id);
      if (verified.originalText !== originalText || verified.source.contentHash !== source.contentHash) {
        throw new StorageError("Migrated Research source failed read-back verification", "INVALID_DATA", {
          sourceId: source.id,
        });
      }
    }
    return {
      importedSourceIds: imported.map((item) => item.sourceId),
      skippedDuplicateSourceIds: skippedDuplicates.map((item) => item.legacySourceId),
    };
  }, transactionOptions);
}
