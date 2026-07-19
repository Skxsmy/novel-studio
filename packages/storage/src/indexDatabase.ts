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
  | "series-mismatch"
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
  allowJournalModeTransition?: boolean;
  allowLegacy?: boolean;
  buildId?: string;
  createIfMissing?: boolean;
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
const SQLITE_WAL_FIXED_BACKPORTS = new Set(["3.44.6", "3.50.7"]);
const DATABASE_ARTIFACT_SUFFIXES = ["", "-wal", "-shm", "-journal"] as const;
type DatabaseArtifactSuffix = typeof DATABASE_ARTIFACT_SUFFIXES[number];
const FTS_TABLES = ["scene_fts", "codex_fts"] as const;
const PROJECTION_PAIRS = [["scenes", "scene_fts"], ["codex_entries", "codex_fts"]] as const;

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

function applyConnectionPreflight(database: Database.Database): string {
  const sqliteVersion = (database.prepare("SELECT sqlite_version() AS version").get() as { version: string }).version;
  if (!sqliteVersionAtLeast(sqliteVersion, [3, 51, 3]) && !SQLITE_WAL_FIXED_BACKPORTS.has(sqliteVersion)) {
    throw new StorageError("SQLite version is too old for the index WAL policy", "INVALID_DATA", {
      sqliteVersion,
      acceptedVersions: "3.51.3 or later, 3.50.7, or 3.44.6",
    });
  }
  database.pragma("busy_timeout = 5000");
  database.pragma("trusted_schema = OFF");
  return sqliteVersion;
}

function applyFtsPolicy(database: Database.Database): void {
  for (const table of FTS_TABLES) {
    const configured = database.prepare(`SELECT v FROM ${table}_config WHERE k = 'secure-delete'`).get() as
      | { v: number }
      | undefined;
    if (configured?.v !== 1) {
      database.prepare(`INSERT INTO ${table}(${table}, rank) VALUES ('secure-delete', 1)`).run();
    }
  }
}

function applyConnectionPolicy(database: Database.Database): void {
  database.pragma("foreign_keys = ON");
  database.pragma("synchronous = NORMAL");
  database.pragma("secure_delete = ON");
  database.pragma("wal_autocheckpoint = 1000");
  database.pragma("journal_size_limit = 67108864");
  const currentJournalMode = String(pragmaScalar(database, "journal_mode")).toLowerCase();
  const journalMode = currentJournalMode === "wal"
    ? currentJournalMode
    : String(pragmaScalar(database, "journal_mode = WAL")).toLowerCase();
  if (journalMode !== "wal") {
    throw new StorageError("SQLite index did not enter WAL mode", "INVALID_DATA", { journalMode });
  }
  const expected = [
    ["foreign_keys", 1],
    ["busy_timeout", 5000],
    ["trusted_schema", 0],
    ["synchronous", 1],
    ["secure_delete", 1],
    ["wal_autocheckpoint", 1000],
    ["journal_size_limit", 67108864],
  ] as const;
  for (const [pragma, value] of expected) {
    const actual = Number(pragmaScalar(database, pragma));
    if (actual !== value) {
      throw new StorageError("SQLite connection policy could not be verified", "INVALID_DATA", {
        actual,
        expected: value,
        pragma,
      });
    }
  }
}

function projectionConsistencyErrors(database: Database.Database): Array<{
  coreTable: string;
  ftsTable: string;
  issue: string;
}> {
  const errors: Array<{ coreTable: string; ftsTable: string; issue: string }> = [];
  for (const [coreTable, ftsTable] of PROJECTION_PAIRS) {
    const missing = database.prepare(
      `SELECT id FROM ${coreTable} EXCEPT SELECT id FROM ${ftsTable} LIMIT 1`,
    ).get();
    const extra = database.prepare(
      `SELECT id FROM ${ftsTable} EXCEPT SELECT id FROM ${coreTable} LIMIT 1`,
    ).get();
    const duplicate = database.prepare(
      `SELECT id FROM ${ftsTable} GROUP BY id HAVING count(*) <> 1 LIMIT 1`,
    ).get();
    if (missing) errors.push({ coreTable, ftsTable, issue: "missing FTS row" });
    if (extra) errors.push({ coreTable, ftsTable, issue: "orphan FTS row" });
    if (duplicate) errors.push({ coreTable, ftsTable, issue: "duplicate FTS row" });
  }
  return errors;
}

function ftsPolicyErrors(database: Database.Database): string[] {
  return FTS_TABLES.flatMap((table) => {
    const configured = database.prepare(`SELECT v FROM ${table}_config WHERE k = 'secure-delete'`).get() as
      | { v: number }
      | undefined;
    return configured?.v === 1 ? [] : [`${table}: secure-delete disabled`];
  });
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
  applyFtsPolicy(database);
  database.pragma("optimize = 0x10002");
}

function verifyReadyDatabase(
  database: Database.Database,
  expectedSeriesId?: string,
  requireWal = true,
): void {
  const applicationId = Number(pragmaScalar(database, "application_id"));
  const userVersion = Number(pragmaScalar(database, "user_version"));
  if (applicationId !== INDEX_APPLICATION_ID) {
    throw new StorageError("SQLite index belongs to another application", "INVALID_DATA", { applicationId });
  }
  if (userVersion !== INDEX_SCHEMA_VERSION) {
    throw new StorageError("SQLite index schema version is unsupported", "INVALID_DATA", { userVersion });
  }
  const journalMode = String(pragmaScalar(database, "journal_mode")).toLowerCase();
  if (requireWal && journalMode !== "wal") {
    throw new StorageError("SQLite index connection policy does not match", "INVALID_DATA", { journalMode });
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
  const projectionErrors = projectionConsistencyErrors(database);
  if (projectionErrors.length > 0) {
    throw new StorageError("SQLite index projections are inconsistent", "INVALID_DATA", { projectionErrors });
  }
  const policyErrors = ftsPolicyErrors(database);
  if (policyErrors.length > 0) {
    throw new StorageError("SQLite FTS policy does not match", "INVALID_DATA", { policyErrors });
  }
  if (expectedSeriesId) {
    const storedSeries = database.prepare("SELECT value FROM index_meta WHERE key = 'series_id'").get() as
      | { value: string }
      | undefined;
    if (storedSeries?.value !== expectedSeriesId) {
      throw new StorageError("SQLite index belongs to another Series", "INVALID_DATA", {
        expectedSeriesId,
        storedSeriesId: storedSeries?.value ?? null,
      });
    }
  }
}

export function openIndexDatabase(
  databasePath: string,
  options: IndexDatabaseOpenOptions = {},
): Database.Database {
  const database = new Database(databasePath, { fileMustExist: options.createIfMissing !== true });
  try {
    applyConnectionPreflight(database);
    const applicationId = Number(pragmaScalar(database, "application_id"));
    const userVersion = Number(pragmaScalar(database, "user_version"));
    const isNew = applicationId === 0 && userVersion === 0 && (
      database.prepare("SELECT count(*) AS count FROM sqlite_schema WHERE type = 'table'").get() as { count: number }
    ).count === 0;
    if (isNew) {
      if (options.createIfMissing !== true) {
        throw new StorageError("SQLite index is empty and requires a rebuild", "INVALID_DATA", { databasePath });
      }
      applyConnectionPolicy(database);
      initializeDatabase(database, options);
    } else if (applicationId === 0 && userVersion === 0 && options.allowLegacy) {
      applyConnectionPolicy(database);
    } else {
      verifyReadyDatabase(database, options.seriesId, options.allowJournalModeTransition !== true);
      applyConnectionPolicy(database);
    }
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

export async function inspectIndexDatabase(
  seriesRoot: string,
  expectedSeriesId?: string,
): Promise<IndexDatabaseHealth> {
  const databasePath = indexDatabasePath(seriesRoot);
  if (!(await exists(databasePath))) {
    return { status: "missing", applicationId: null, userVersion: null, schemaChecksum: null, quickCheck: null, reason: null };
  }
  let database: Database.Database | null = null;
  try {
    database = new Database(databasePath, { readonly: true, fileMustExist: true });
    const applicationId = Number(pragmaScalar(database, "application_id"));
    const userVersion = Number(pragmaScalar(database, "user_version"));
    if (applicationId !== 0 && applicationId !== INDEX_APPLICATION_ID) {
      return { status: "wrong-identity", applicationId, userVersion, schemaChecksum: null, quickCheck: null, reason: "application_id does not match" };
    }
    if (applicationId === INDEX_APPLICATION_ID && userVersion !== INDEX_SCHEMA_VERSION) {
      return { status: "unsupported-version", applicationId, userVersion, schemaChecksum: null, quickCheck: null, reason: "user_version is unsupported" };
    }
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
    const journalMode = String(pragmaScalar(database, "journal_mode")).toLowerCase();
    if (journalMode !== "wal") {
      return {
        status: "schema-drift",
        applicationId,
        userVersion,
        schemaChecksum: null,
        quickCheck,
        reason: `journal_mode is ${journalMode}, expected wal`,
      };
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
    const policyErrors = ftsPolicyErrors(database);
    if (policyErrors.length > 0) {
      return {
        status: "schema-drift",
        applicationId,
        userVersion,
        schemaChecksum,
        quickCheck,
        reason: policyErrors.join("; "),
      };
    }
    const projectionErrors = projectionConsistencyErrors(database);
    if (projectionErrors.length > 0) {
      return {
        status: "corrupt",
        applicationId,
        userVersion,
        schemaChecksum,
        quickCheck,
        reason: projectionErrors.map((error) => `${error.ftsTable}: ${error.issue}`).join("; "),
      };
    }
    if (expectedSeriesId) {
      const storedSeries = database.prepare("SELECT value FROM index_meta WHERE key = 'series_id'").get() as
        | { value: string }
        | undefined;
      if (storedSeries?.value !== expectedSeriesId) {
        return {
          status: "series-mismatch",
          applicationId,
          userVersion,
          schemaChecksum,
          quickCheck,
          reason: `Stored Series ${storedSeries?.value ?? "<missing>"} does not match ${expectedSeriesId}`,
        };
      }
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

function writeLaneKey(seriesRoot: string): string {
  const resolved = path.resolve(seriesRoot);
  return process.platform === "win32" ? resolved.toLocaleLowerCase("en-US") : resolved;
}

export async function waitForIndexWriteLane(seriesRoot: string): Promise<void> {
  await writeLanes.get(writeLaneKey(seriesRoot))?.catch(() => undefined);
}

export async function runIndexWriteLane<T>(seriesRoot: string, operation: () => Promise<T>): Promise<T> {
  const key = writeLaneKey(seriesRoot);
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

function databaseArtifactPath(databasePath: string, suffix: DatabaseArtifactSuffix): string {
  return `${databasePath}${suffix}`;
}

async function removeDatabaseFiles(databasePath: string): Promise<void> {
  await Promise.all(DATABASE_ARTIFACT_SUFFIXES.map((suffix) =>
    rm(databaseArtifactPath(databasePath, suffix), { force: true })));
}

async function moveDatabaseFiles(sourcePath: string, targetPath: string): Promise<DatabaseArtifactSuffix[]> {
  const moved: DatabaseArtifactSuffix[] = [];
  try {
    for (const suffix of DATABASE_ARTIFACT_SUFFIXES) {
      const source = databaseArtifactPath(sourcePath, suffix);
      if (!(await exists(source))) continue;
      await rename(source, databaseArtifactPath(targetPath, suffix));
      moved.push(suffix);
    }
    return moved;
  } catch (error) {
    for (const suffix of [...moved].reverse()) {
      await rename(databaseArtifactPath(targetPath, suffix), databaseArtifactPath(sourcePath, suffix));
    }
    throw error;
  }
}

async function restoreDatabaseFiles(
  sourcePath: string,
  targetPath: string,
  suffixes: DatabaseArtifactSuffix[],
): Promise<void> {
  const restored: DatabaseArtifactSuffix[] = [];
  try {
    for (const suffix of suffixes) {
      const source = `${sourcePath}${suffix}`;
      if (!(await exists(source))) continue;
      await rename(source, `${targetPath}${suffix}`);
      restored.push(suffix);
    }
  } catch (error) {
    let reversalError: unknown;
    for (const suffix of [...restored].reverse()) {
      try {
        await rename(`${targetPath}${suffix}`, `${sourcePath}${suffix}`);
      } catch (candidate) {
        reversalError ??= candidate;
      }
    }
    if (reversalError) {
      throw new StorageError("SQLite rollback restoration failed and could not be returned to its recovery bundle", "INVALID_DATA", {
        originalError: error instanceof Error ? error.message : String(error),
        reversalError: reversalError instanceof Error ? reversalError.message : String(reversalError),
        sourcePath,
        targetPath,
      });
    }
    throw error;
  }
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

function validateBuiltDatabase(
  databasePath: string,
  buildId: string,
  seriesId: string,
  allowJournalModeTransition = false,
): void {
  const database = openIndexDatabase(databasePath, { allowJournalModeTransition, seriesId });
  try {
    const integrityCheck = String(pragmaScalar(database, "integrity_check"));
    const foreignKeyRows = database.pragma("foreign_key_check") as unknown[];
    const storedBuild = database.prepare("SELECT value FROM index_meta WHERE key = 'build_id'").get() as
      | { value: string }
      | undefined;
    const projectionErrors = projectionConsistencyErrors(database);
    for (const [coreTable, ftsTable] of PROJECTION_PAIRS) {
      database.prepare(`INSERT INTO ${ftsTable}(${ftsTable}) VALUES ('integrity-check')`).run();
      const secureDelete = database.prepare(
        `SELECT v FROM ${ftsTable}_config WHERE k = 'secure-delete'`,
      ).get() as { v: number } | undefined;
      if (secureDelete?.v !== 1) projectionErrors.push({ coreTable, ftsTable, issue: "secure-delete disabled" });
    }
    if (
      integrityCheck !== "ok"
      || foreignKeyRows.length > 0
      || storedBuild?.value !== buildId
      || projectionErrors.length > 0
    ) {
      throw new StorageError("Built SQLite index failed validation", "INVALID_DATA", {
        buildId,
        foreignKeyErrors: foreignKeyRows.length,
        projectionErrors,
        integrityCheck,
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
    let liveMovedSuffixes: DatabaseArtifactSuffix[] = [];
    let newMoved = false;
    let preserveRollback = false;
    await mkdir(buildRoot, { recursive: true });
    const throwForCancellation = () => throwIfCancelled(options.signal);

    try {
      throwForCancellation();
      const database = openIndexDatabase(temporaryPath, { buildId, createIfMissing: true, seriesId });
      database.close();
      await options.hooks?.afterDatabaseCreated?.(temporaryPath);
      const result = await build({ buildId, databasePath: temporaryPath, throwIfCancelled: throwForCancellation });
      throwForCancellation();
      validateBuiltDatabase(temporaryPath, buildId, seriesId);
      settleDatabase(temporaryPath);
      await options.hooks?.beforeSwap?.(temporaryPath);
      throwForCancellation();

      if (await exists(livePath)) {
        const health = await inspectIndexDatabase(seriesRoot, seriesId);
        if (health.status === "ready" || health.status === "legacy-v0") settleDatabase(livePath);
      }
      liveMovedSuffixes = await moveDatabaseFiles(livePath, rollbackPath);
      await options.hooks?.afterLiveMoved?.(temporaryPath);
      throwForCancellation();
      await rename(temporaryPath, livePath);
      newMoved = true;
      await options.hooks?.afterNewMoved?.(livePath);
      throwForCancellation();
      validateBuiltDatabase(livePath, buildId, seriesId, true);
      await removeDatabaseFiles(rollbackPath);
      return result;
    } catch (error) {
      if (newMoved) {
        try {
          await removeDatabaseFiles(livePath);
        } catch (cleanupError) {
          preserveRollback = liveMovedSuffixes.length > 0;
          throw new StorageError("SQLite index replacement failed and the new live artifact could not be removed", "INVALID_DATA", {
            cleanupError: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
            originalError: error instanceof Error ? error.message : String(error),
            rollbackPath: preserveRollback ? rollbackPath : null,
          });
        }
      }
      if (liveMovedSuffixes.length > 0) {
        try {
          await restoreDatabaseFiles(rollbackPath, livePath, liveMovedSuffixes);
        } catch (recoveryError) {
          preserveRollback = true;
          throw new StorageError("SQLite index replacement failed and rollback could not be restored", "INVALID_DATA", {
            originalError: error instanceof Error ? error.message : String(error),
            recoveryError: recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
            rollbackPath,
          });
        }
      }
      throw error;
    } finally {
      await removeDatabaseFiles(temporaryPath);
      if (!preserveRollback) await removeDatabaseFiles(rollbackPath);
      const remaining = await stat(buildRoot).catch(() => null);
      if (remaining?.isDirectory()) await rm(buildRoot, { recursive: false }).catch(() => undefined);
    }
  });
}
