import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  ResearchDatabaseDocumentSchema,
  ResearchDatabaseListResultSchema,
  ResearchDatabaseSchema,
  ResearchDatabaseSummarySchema,
  UpdateResearchDatabaseInputSchema,
  type ResearchDatabase,
  type ResearchDatabaseDocument,
  type ResearchDatabaseListResult,
  type UpdateResearchDatabaseInput,
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

const DATABASES_DIR = "research-databases";
const DATABASE_FILE = "database.json";
const SOURCES_DIR = "sources";
const DatabaseIdSchema = z.string().uuid();

export type ResearchDatabaseTransactionOptions = FileTransactionOptions;

export function researchDatabasesRoot(libraryRoot: string): string {
  return assertInside(libraryRoot, path.join(libraryRoot, DATABASES_DIR));
}

export function researchDatabaseRoot(libraryRoot: string, databaseId: string): string {
  const id = DatabaseIdSchema.parse(databaseId);
  return assertInside(libraryRoot, path.join(researchDatabasesRoot(libraryRoot), id));
}

export function researchDatabaseAuthorityPath(libraryRoot: string, databaseId: string): string {
  const root = researchDatabaseRoot(libraryRoot, databaseId);
  return assertInside(root, path.join(root, DATABASE_FILE));
}

export function researchDatabaseIndexPath(libraryRoot: string, databaseId: string): string {
  const root = researchDatabaseRoot(libraryRoot, databaseId);
  return assertInside(root, path.join(root, ".studio", "index.sqlite"));
}

function normalizedName(name: string): string {
  return name.normalize("NFKC").toLocaleLowerCase("und");
}

async function listDirectories(directory: string): Promise<string[]> {
  try {
    return (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && entry.name !== ".studio")
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function countSourceAuthorityFiles(databaseRoot: string): Promise<number> {
  try {
    return (await readdir(assertInside(databaseRoot, path.join(databaseRoot, SOURCES_DIR)), { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .length;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
}

export async function readResearchDatabaseFile(
  libraryRoot: string,
  databaseId: string,
): Promise<ResearchDatabaseDocument> {
  const root = researchDatabaseRoot(libraryRoot, databaseId);
  let document;
  try {
    document = await readJsonAuthorityFile(
      root,
      researchDatabaseAuthorityPath(libraryRoot, databaseId),
      (value) => ResearchDatabaseSchema.parse(value),
      "Research Database authority",
    );
  } catch (error) {
    if (error instanceof StorageError && error.code === "NOT_FOUND") {
      throw new StorageError("Research Database does not exist", "NOT_FOUND", { databaseId });
    }
    throw error;
  }
  if (document.data.id !== databaseId) {
    throw new StorageError("Research Database authority is stored under another database ID", "INVALID_DATA", {
      actualDatabaseId: document.data.id,
      databaseId,
    });
  }
  return ResearchDatabaseDocumentSchema.parse({ database: document.data, revision: document.revision });
}

export async function listResearchDatabaseFiles(libraryRoot: string): Promise<ResearchDatabaseListResult> {
  const databases = [];
  const issues = [];
  for (const directoryName of await listDirectories(researchDatabasesRoot(libraryRoot))) {
    const parsedId = DatabaseIdSchema.safeParse(directoryName);
    if (!parsedId.success) {
      issues.push({
        code: "invalid-authority" as const,
        directoryName,
        message: "Research Database directory name is not a valid identifier.",
      });
      continue;
    }
    try {
      const document = await readResearchDatabaseFile(libraryRoot, parsedId.data);
      databases.push(ResearchDatabaseSummarySchema.parse({
        ...document,
        sourceCount: await countSourceAuthorityFiles(researchDatabaseRoot(libraryRoot, parsedId.data)),
      }));
    } catch (error) {
      issues.push({
        code: "invalid-authority" as const,
        directoryName,
        message: error instanceof Error ? error.message : "Research Database metadata could not be read.",
      });
    }
  }
  databases.sort((left, right) =>
    left.database.name.localeCompare(right.database.name, "en")
    || left.database.id.localeCompare(right.database.id),
  );
  return ResearchDatabaseListResultSchema.parse({ databases, issues });
}

async function assertUniqueDatabaseName(
  libraryRoot: string,
  name: string,
  excludeDatabaseId?: string,
): Promise<void> {
  const duplicate = (await listResearchDatabaseFiles(libraryRoot)).databases.find((document) =>
    document.database.id !== excludeDatabaseId
    && normalizedName(document.database.name) === normalizedName(name),
  );
  if (duplicate) {
    throw new StorageError("A Research Database with this name already exists", "CONFLICT", {
      databaseId: duplicate.database.id,
    });
  }
}

export async function createResearchDatabaseFile(
  libraryRoot: string,
  database: ResearchDatabase,
  transactionOptions: ResearchDatabaseTransactionOptions = {},
): Promise<ResearchDatabaseDocument> {
  const parsed = ResearchDatabaseSchema.parse(database);
  const databasesRoot = researchDatabasesRoot(libraryRoot);
  const databaseRoot = researchDatabaseRoot(libraryRoot, parsed.id);
  await mkdir(databasesRoot, { recursive: true });
  try {
    return await runSeriesFileTransaction(databasesRoot, async (commit) => {
      await assertUniqueDatabaseName(libraryRoot, parsed.name);
      const authorityPath = researchDatabaseAuthorityPath(libraryRoot, parsed.id);
      if (await pathExists(authorityPath)) {
        throw new StorageError("Research Database already exists", "CONFLICT", { databaseId: parsed.id });
      }
      await commit([{ targetPath: authorityPath, content: serializeJsonAuthority(parsed) }]);
      return readResearchDatabaseFile(libraryRoot, parsed.id);
    }, transactionOptions);
  } catch (error) {
    if (!(await pathExists(researchDatabaseAuthorityPath(libraryRoot, parsed.id)))) {
      await rm(databaseRoot, { force: true, recursive: true }).catch(() => undefined);
    }
    throw error;
  }
}

export async function updateResearchDatabaseFile(
  libraryRoot: string,
  databaseId: string,
  rawInput: UpdateResearchDatabaseInput,
): Promise<ResearchDatabaseDocument> {
  const input = UpdateResearchDatabaseInputSchema.parse(rawInput);
  const databasesRoot = researchDatabasesRoot(libraryRoot);
  await mkdir(databasesRoot, { recursive: true });
  return runSeriesFileTransaction(databasesRoot, async (commit) => {
    const current = await readResearchDatabaseFile(libraryRoot, databaseId);
    if (current.revision !== input.baseRevision) {
      throw new StorageError("Research Database has changed since it was opened", "CONFLICT", {
        actualRevision: current.revision,
        databaseId,
        expectedRevision: input.baseRevision,
      });
    }
    if (input.name !== undefined) {
      await assertUniqueDatabaseName(libraryRoot, input.name, databaseId);
    }
    const { baseRevision: _baseRevision, ...properties } = input;
    const updated = ResearchDatabaseSchema.parse({
      ...current.database,
      ...properties,
      updatedAt: new Date().toISOString(),
    });
    const raw = serializeJsonAuthority(updated);
    await commit([{ targetPath: researchDatabaseAuthorityPath(libraryRoot, databaseId), content: raw }]);
    return ResearchDatabaseDocumentSchema.parse({
      database: parseJsonAuthorityText(raw, (value) => ResearchDatabaseSchema.parse(value)),
      revision: jsonAuthorityRevision(raw),
    });
  });
}
