import { createHash, randomUUID } from "node:crypto";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";

import { StorageError } from "./errors.js";
import { assertInside } from "./fileSystem.js";

export const INDEX_APPLICATION_ID = 0x4e534958;
export const INDEX_SCHEMA_VERSION = 1;

const INDEX_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS index_schema_migrations (
    version INTEGER PRIMARY KEY CHECK (version > 0),
    name TEXT NOT NULL UNIQUE,
    checksum TEXT NOT NULL CHECK (length(checksum) = 64),
    applied_at TEXT NOT NULL
  ) STRICT;
  CREATE TABLE IF NOT EXISTS index_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  ) STRICT;
  CREATE TABLE IF NOT EXISTS scenes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    revision TEXT NOT NULL
  ) STRICT;
  CREATE VIRTUAL TABLE IF NOT EXISTS scene_fts USING fts5(
    id UNINDEXED,
    title,
    content,
    tokenize='trigram'
  );
  CREATE TABLE IF NOT EXISTS codex_entries (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    name TEXT NOT NULL,
    aliases TEXT NOT NULL,
    description TEXT NOT NULL,
    research TEXT NOT NULL,
    details TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    revision TEXT NOT NULL
  ) STRICT;
  CREATE VIRTUAL TABLE IF NOT EXISTS codex_fts USING fts5(
    id UNINDEXED,
    name,
    aliases,
    description,
    research,
    details,
    tokenize='trigram'
  );
  CREATE TABLE IF NOT EXISTS codex_mentions (
    scene_id TEXT NOT NULL,
    entry_id TEXT NOT NULL,
    start INTEGER NOT NULL,
    end INTEGER NOT NULL,
    matched_text TEXT NOT NULL,
    term TEXT NOT NULL,
    is_alias INTEGER NOT NULL CHECK (is_alias IN (0, 1)),
    PRIMARY KEY (scene_id, entry_id, start, end)
  ) STRICT;
  CREATE INDEX IF NOT EXISTS codex_mentions_entry_idx
    ON codex_mentions(entry_id, scene_id, start);
  CREATE TABLE IF NOT EXISTS codex_ambiguities (
    scene_id TEXT NOT NULL,
    start INTEGER NOT NULL,
    end INTEGER NOT NULL,
    matched_text TEXT NOT NULL,
    candidate_entry_ids TEXT NOT NULL,
    PRIMARY KEY (scene_id, start, end)
  ) STRICT;
  CREATE TABLE IF NOT EXISTS ai_context_bundles (
    id TEXT PRIMARY KEY,
    series_id TEXT NOT NULL,
    scene_id TEXT,
    role_id TEXT NOT NULL,
    task_kind TEXT NOT NULL,
    prompt_template_id TEXT NOT NULL,
    prompt_template_version INTEGER NOT NULL,
    created_at TEXT NOT NULL
  ) STRICT;
  CREATE INDEX IF NOT EXISTS ai_context_bundles_scene_idx
    ON ai_context_bundles(scene_id, created_at);
  CREATE TABLE IF NOT EXISTS ai_model_calls (
    id TEXT PRIMARY KEY,
    series_id TEXT NOT NULL,
    scene_id TEXT,
    role_id TEXT NOT NULL,
    task_kind TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    status TEXT NOT NULL,
    context_bundle_id TEXT NOT NULL,
    prompt_template_id TEXT NOT NULL,
    prompt_template_version INTEGER NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT
  ) STRICT;
  CREATE INDEX IF NOT EXISTS ai_model_calls_scene_idx
    ON ai_model_calls(scene_id, started_at);
`;

export const INDEX_SCHEMA_CHECKSUM = createHash("sha256")
  .update(INDEX_SCHEMA_SQL.trim().replace(/\r\n/gu, "\n"), "utf8")
  .digest("hex");

export type IndexDatabaseHealthStatus =
  | "missing"
  | "ready"
  | "legacy-v0"
  | "wrong-identity"
  | "unsupported-version"
  | "schema-drift"
  | "corrupt";

export interface IndexDatabaseHealth {
  status: IndexDatabaseHealthStatus;
  applicationId: number | null;
  userVersion: number | null;
  schemaChecksum: string | null;
  quickCheck: string | null;
  reason: string | null;
}

export interface IndexDatabaseOpenOptions {
  allowLegacy?: boolean;
  buildId?: string;
  seriesId?: string;
}

export interface IndexRebuildHooks {
  afterDatabaseCreated?: (databasePath: string) => void | Promise<void>;
  beforeSwap?: (databasePath: string) => void | Promise<void>;
  afterLiveMoved?: (databasePath: string) => void | Promise<void>;
  afterNewMoved?: (databasePath: string) => void | Promise<void>;
}

export interface IndexRebuildOptions {
  signal?: AbortSignal;
  hooks?: IndexRebuildHooks;
}

export interface IndexRebuildContext {
  buildId: string;
  databasePath: string;
  throwIfCancelled: () => void;
}

const writeLanes = new Map<string, Promise<void>>();

function pragmaScalar(database: Database.Database, source: string): string | number {
  const rows = database.pragma(source) as Array<Record<string, string | number>>;
  const first = rows[0];
  const value = first ? Object.values(first)[0] : undefined;
  if (typeof value !== "string" && typeof value !== "number") {
    throw new StorageError("SQLite PRAGMA did not return a scalar value", "INVALID_DATA", { source });
  }
  return value;
}

function sqliteVersionAtLeast(actual: string, expected: [number, number, number]): boolean {
  const parts = actual.split(".").map((part) => Number.parseInt(part, 10));
  for (let index = 0; index < expected.length; index += 1) {
    const difference = (parts[index] ?? 0) - expected[index]!;
    if (difference !== 0) return difference > 0;
  }
  return true;
}

function applyConnectionPolicy(database: Database.Database): void {
  const sqliteVersion = (database.prepare("SELECT sqlite_version() AS version").get() as { version: string }).version;
  if (!sqliteVersionAtLeast(sqliteVersion, [3, 51, 3])) {
    throw new StorageError("SQLite version is too old for the index WAL policy", "INVALID_DATA", {
      sqliteVersion,
      minimumVersion: "3.51.3",
    });
  }
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  database.pragma("trusted_schema = OFF");
  database.pragma("synchronous = NORMAL");
  database.pragma("secure_delete = ON");
  database.pragma("wal_autocheckpoint = 1000");
  database.pragma("journal_size_limit = 67108864");
  const journalMode = String(pragmaScalar(database, "journal_mode = WAL")).toLowerCase();
  if (journalMode !== "wal") {
    throw new StorageError("SQLite index did not enter WAL mode", "INVALID_DATA", { journalMode });
  }
}

function initializeDatabase(
  database: Database.Database,
  { buildId = randomUUID(), seriesId = "" }: IndexDatabaseOpenOptions,
): void {
  database.pragma("auto_vacuum = INCREMENTAL");
  database.pragma(`application_id = ${INDEX_APPLICATION_ID}`);
  database.exec(INDEX_SCHEMA_SQL);
  const now = new Date().toISOString();
  const transaction = database.transaction(() => {
    database.prepare(
      `INSERT INTO index_schema_migrations (version, name, checksum, applied_at)
       VALUES (?, ?, ?, ?)`,
    ).run(INDEX_SCHEMA_VERSION, "initial-index-kernel", INDEX_SCHEMA_CHECKSUM, now);
    const setMeta = database.prepare("INSERT INTO index_meta (key, value) VALUES (?, ?)");
    setMeta.run("database_kind", "novel-studio-series-index");
    setMeta.run("build_id", buildId);
    setMeta.run("series_id", seriesId);
    setMeta.run("created_at", now);
    setMeta.run("schema_checksum", INDEX_SCHEMA_CHECKSUM);
    setMeta.run("projection_bundle_version", "1");
    database.pragma(`user_version = ${INDEX_SCHEMA_VERSION}`);
  });
  transaction();
  database.pragma("optimize = 0x10002");
}

function verifyReadyDatabase(database: Database.Database): void {
  const applicationId = Number(pragmaScalar(database, "application_id"));
  const userVersion = Number(pragmaScalar(database, "user_version"));
  if (applicationId !== INDEX_APPLICATION_ID) {
    throw new StorageError("SQLite index belongs to another application", "INVALID_DATA", { applicationId });
  }
  if (userVersion !== INDEX_SCHEMA_VERSION) {
    throw new StorageError("SQLite index schema version is unsupported", "INVALID_DATA", { userVersion });
  }
  const migration = database.prepare(
    "SELECT checksum FROM index_schema_migrations WHERE version = ?",
  ).get(INDEX_SCHEMA_VERSION) as { checksum: string } | undefined;
  const meta = database.prepare("SELECT value FROM index_meta WHERE key = 'schema_checksum'").get() as
    | { value: string }
    | undefined;
  if (migration?.checksum !== INDEX_SCHEMA_CHECKSUM || meta?.value !== INDEX_SCHEMA_CHECKSUM) {
    throw new StorageError("SQLite index schema checksum does not match", "INVALID_DATA", {
      expectedChecksum: INDEX_SCHEMA_CHECKSUM,
      migrationChecksum: migration?.checksum ?? null,
      metadataChecksum: meta?.value ?? null,
    });
  }
}

export function openIndexDatabase(
  databasePath: string,
  options: IndexDatabaseOpenOptions = {},
): Database.Database {
  const database = new Database(databasePath);
  try {
    const applicationId = Number(pragmaScalar(database, "application_id"));
    const userVersion = Number(pragmaScalar(database, "user_version"));
    const isNew = applicationId === 0 && userVersion === 0 && (
      database.prepare("SELECT count(*) AS count FROM sqlite_schema WHERE type = 'table'").get() as { count: number }
    ).count === 0;
    applyConnectionPolicy(database);
    if (isNew) initializeDatabase(database, options);
    else if (applicationId === 0 && userVersion === 0 && options.allowLegacy) return database;
    else verifyReadyDatabase(database);
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

export function indexDatabasePath(seriesRoot: string): string {
  return assertInside(seriesRoot, path.join(seriesRoot, ".studio", "index.sqlite"));
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function inspectIndexDatabase(seriesRoot: string): Promise<IndexDatabaseHealth> {
  const databasePath = indexDatabasePath(seriesRoot);
  if (!(await exists(databasePath))) {
    return { status: "missing", applicationId: null, userVersion: null, schemaChecksum: null, quickCheck: null, reason: null };
  }
  let database: Database.Database | null = null;
  try {
    database = new Database(databasePath, { readonly: true, fileMustExist: true });
    const applicationId = Number(pragmaScalar(database, "application_id"));
    const userVersion = Number(pragmaScalar(database, "user_version"));
    const quickCheck = String(pragmaScalar(database, "quick_check"));
    if (quickCheck !== "ok") {
      return { status: "corrupt", applicationId, userVersion, schemaChecksum: null, quickCheck, reason: "quick_check failed" };
    }
    if (applicationId === 0 && userVersion === 0) {
      return { status: "legacy-v0", applicationId, userVersion, schemaChecksum: null, quickCheck, reason: "Unversioned prototype index" };
    }
    if (applicationId !== INDEX_APPLICATION_ID) {
      return { status: "wrong-identity", applicationId, userVersion, schemaChecksum: null, quickCheck, reason: "application_id does not match" };
    }
    if (userVersion !== INDEX_SCHEMA_VERSION) {
      return { status: "unsupported-version", applicationId, userVersion, schemaChecksum: null, quickCheck, reason: "user_version is unsupported" };
    }
    const migration = database.prepare(
      "SELECT checksum FROM index_schema_migrations WHERE version = ?",
    ).get(INDEX_SCHEMA_VERSION) as { checksum: string } | undefined;
    const schemaChecksum = migration?.checksum ?? null;
    const meta = database.prepare("SELECT value FROM index_meta WHERE key = 'schema_checksum'").get() as
      | { value: string }
      | undefined;
    if (schemaChecksum !== INDEX_SCHEMA_CHECKSUM || meta?.value !== INDEX_SCHEMA_CHECKSUM) {
      return { status: "schema-drift", applicationId, userVersion, schemaChecksum, quickCheck, reason: "Migration checksum does not match" };
    }
    return { status: "ready", applicationId, userVersion, schemaChecksum, quickCheck, reason: null };
  } catch (error) {
    return {
      status: "corrupt",
      applicationId: null,
      userVersion: null,
      schemaChecksum: null,
      quickCheck: null,
      reason: error instanceof Error ? error.message : String(error),
    };
  } finally {
    database?.close();
  }
}

export async function runIndexWriteLane<T>(seriesRoot: string, operation: () => Promise<T>): Promise<T> {
  const key = path.resolve(seriesRoot).toLocaleLowerCase("en-US");
  const previous = writeLanes.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const lane = previous.catch(() => undefined).then(() => current);
  writeLanes.set(key, lane);
  await previous.catch(() => undefined);
  try {
    return await operation();
  } finally {
    release();
    if (writeLanes.get(key) === lane) writeLanes.delete(key);
  }
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Index rebuild was cancelled", "AbortError");
}

function sidecarPaths(databasePath: string): string[] {
  return [databasePath, `${databasePath}-wal`, `${databasePath}-shm`];
}

async function removeDatabaseFiles(databasePath: string): Promise<void> {
  await Promise.all(sidecarPaths(databasePath).map((filePath) => rm(filePath, { force: true })));
}

function settleDatabase(databasePath: string): void {
  const database = new Database(databasePath, { fileMustExist: true });
  try {
    database.pragma("wal_checkpoint(TRUNCATE)");
    database.pragma("journal_mode = DELETE");
  } finally {
    database.close();
  }
}

function validateBuiltDatabase(databasePath: string, buildId: string): void {
  const database = openIndexDatabase(databasePath);
  try {
    const quickCheck = String(pragmaScalar(database, "quick_check"));
    const foreignKeyRows = database.pragma("foreign_key_check") as unknown[];
    const storedBuild = database.prepare("SELECT value FROM index_meta WHERE key = 'build_id'").get() as
      | { value: string }
      | undefined;
    if (quickCheck !== "ok" || foreignKeyRows.length > 0 || storedBuild?.value !== buildId) {
      throw new StorageError("Built SQLite index failed validation", "INVALID_DATA", {
        buildId,
        foreignKeyErrors: foreignKeyRows.length,
        quickCheck,
        storedBuildId: storedBuild?.value ?? null,
      });
    }
  } finally {
    database.close();
  }
}

export async function rebuildIndexDatabase<T>(
  seriesRoot: string,
  seriesId: string,
  build: (context: IndexRebuildContext) => Promise<T>,
  options: IndexRebuildOptions = {},
): Promise<T> {
  return runIndexWriteLane(seriesRoot, async () => {
    const studioRoot = assertInside(seriesRoot, path.join(seriesRoot, ".studio"));
    const buildRoot = assertInside(seriesRoot, path.join(studioRoot, "index-build"));
    const livePath = indexDatabasePath(seriesRoot);
    const buildId = randomUUID();
    const temporaryPath = assertInside(seriesRoot, path.join(buildRoot, `${buildId}.sqlite`));
    const rollbackPath = assertInside(seriesRoot, path.join(buildRoot, `${buildId}.rollback.sqlite`));
    let liveMoved = false;
    let newMoved = false;
    await mkdir(buildRoot, { recursive: true });
    const throwForCancellation = () => throwIfCancelled(options.signal);

    try {
      throwForCancellation();
      const database = openIndexDatabase(temporaryPath, { buildId, seriesId });
      database.close();
      await options.hooks?.afterDatabaseCreated?.(temporaryPath);
      const result = await build({ buildId, databasePath: temporaryPath, throwIfCancelled: throwForCancellation });
      throwForCancellation();
      validateBuiltDatabase(temporaryPath, buildId);
      settleDatabase(temporaryPath);
      await options.hooks?.beforeSwap?.(temporaryPath);

      if (await exists(livePath)) {
        settleDatabase(livePath);
        await rename(livePath, rollbackPath);
        liveMoved = true;
      }
      await options.hooks?.afterLiveMoved?.(temporaryPath);
      await rename(temporaryPath, livePath);
      newMoved = true;
      await options.hooks?.afterNewMoved?.(livePath);
      validateBuiltDatabase(livePath, buildId);
      await removeDatabaseFiles(rollbackPath);
      return result;
    } catch (error) {
      if (newMoved) await removeDatabaseFiles(livePath);
      if (liveMoved && await exists(rollbackPath)) await rename(rollbackPath, livePath);
      throw error;
    } finally {
      await removeDatabaseFiles(temporaryPath);
      if (!liveMoved || newMoved) await removeDatabaseFiles(rollbackPath);
      const remaining = await stat(buildRoot).catch(() => null);
      if (remaining?.isDirectory()) await rm(buildRoot, { recursive: false }).catch(() => undefined);
    }
  });
}
