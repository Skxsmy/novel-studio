import { createHash, randomUUID } from "node:crypto";
import { mkdir, readdir, rename, rm, rmdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  ResearchVectorIndexStateSchema,
  type ResearchSourceKind,
  type ResearchSourceLocation,
  type ResearchVectorIndexState,
} from "@novel-studio/contracts";
import Database from "better-sqlite3";
import { getLoadablePath, load as loadSqliteVec } from "sqlite-vec";
import { StorageError } from "./errors.js";
import { assertInside, pathExists } from "./fileSystem.js";

export const RESEARCH_VECTOR_INDEX_APPLICATION_ID = 0x4e535256;
export const RESEARCH_VECTOR_INDEX_SCHEMA_VERSION = 1;
export const RESEARCH_VECTOR_EXTENSION_VERSION = "v0.1.9";

const VECTOR_SCHEMA_TEMPLATE = `
  CREATE TABLE index_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
  CREATE TABLE source_ledger (
    source_id TEXT PRIMARY KEY,
    source_revision TEXT NOT NULL CHECK (length(source_revision) = 64)
  ) STRICT;
  CREATE TABLE chunk_metadata (
    vector_rowid INTEGER PRIMARY KEY,
    chunk_id TEXT NOT NULL UNIQUE,
    source_id TEXT NOT NULL REFERENCES source_ledger(source_id) ON DELETE CASCADE,
    source_revision TEXT NOT NULL CHECK (length(source_revision) = 64),
    source_display_name TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    source_author TEXT NOT NULL,
    source_tags_json TEXT NOT NULL,
    ai_permission TEXT NOT NULL CHECK (ai_permission IN ('never', 'allowed')),
    block_id TEXT NOT NULL,
    block_order INTEGER NOT NULL CHECK (block_order >= 0),
    chunk_hash TEXT NOT NULL CHECK (length(chunk_hash) = 64),
    original_text TEXT NOT NULL,
    language_tag TEXT NOT NULL,
    location_json TEXT NOT NULL
  ) STRICT;
  CREATE INDEX chunk_metadata_source_idx ON chunk_metadata(source_id, vector_rowid);
  CREATE VIRTUAL TABLE chunk_vectors USING vec0(embedding float[$DIMENSIONS]);
`;

export const RESEARCH_VECTOR_INDEX_SCHEMA_CHECKSUM = createHash("sha256")
  .update(VECTOR_SCHEMA_TEMPLATE.trim().replace(/\r\n/gu, "\n"), "utf8")
  .digest("hex");

const INDEX_SUFFIXES = ["", "-wal", "-shm", "-journal"] as const;
const vectorIndexLanes = new Map<string, Promise<void>>();

export interface ResearchVectorChunkInput {
  chunkId: string;
  sourceId: string;
  sourceRevision: string;
  sourceDisplayName: string;
  sourceKind: ResearchSourceKind;
  sourceAuthor: string;
  sourceTags: string[];
  aiPermission: "never" | "allowed";
  blockId: string;
  blockOrder: number;
  chunkHash: string;
  originalText: string;
  languageTag: string;
  location: ResearchSourceLocation;
  embedding: number[];
}

export interface ResearchVectorIndexIdentity {
  profileId: string;
  profileRevision: string;
  dimensions: number;
  model: string;
  normalize: boolean;
  documentPrefix: string;
  queryPrefix: string;
  capabilityRevision: string;
  validationFixtureVersion: 1;
}

export interface ResearchVectorIndexBuildInput extends ResearchVectorIndexIdentity {
  researchDatabaseId: string;
  chunks: ResearchVectorChunkInput[];
}

export interface ResearchVectorSearchResult extends Omit<ResearchVectorChunkInput, "embedding"> {
  distance: number;
}

export interface ResearchVectorSearchFilters {
  purpose?: "local" | "model-context";
  sourceKinds?: ResearchSourceKind[];
  languageTags?: string[];
  tags?: string[];
  author?: string;
}

export interface ResearchVectorIndexBuildHooks {
  afterDatabaseCreated?: (databasePath: string) => void | Promise<void>;
  beforeSwap?: (databasePath: string) => void | Promise<void>;
  afterLiveMoved?: (databasePath: string) => void | Promise<void>;
  afterNewMoved?: (databasePath: string) => void | Promise<void>;
}

export interface ResearchVectorIndexBuildOptions {
  signal?: AbortSignal;
  hooks?: ResearchVectorIndexBuildHooks;
}

export interface ResearchVectorIndexStreamingOptions extends ResearchVectorIndexBuildOptions {
  batchSize: number;
  embedBatch: (
    chunks: ResearchVectorChunkInput[],
    signal?: AbortSignal,
  ) => Promise<number[][]>;
}

class VectorExtensionUnavailableError extends Error {}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const error = new Error("Research vector index rebuild was cancelled");
    error.name = "AbortError";
    throw error;
  }
}

async function withVectorIndexLane<T>(databaseRoot: string, operation: () => Promise<T>): Promise<T> {
  const key = path.resolve(databaseRoot);
  const previous = vectorIndexLanes.get(key) ?? Promise.resolve();
  const waitForPrevious = previous.catch(() => undefined);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const tail = waitForPrevious.then(() => gate);
  vectorIndexLanes.set(key, tail);
  await waitForPrevious;
  try {
    return await operation();
  } finally {
    release();
    if (vectorIndexLanes.get(key) === tail) vectorIndexLanes.delete(key);
  }
}

export function researchVectorIndexDatabasePath(databaseRoot: string): string {
  return assertInside(databaseRoot, path.join(databaseRoot, ".studio", "vector-index.sqlite"));
}

function pragmaScalar(database: Database.Database, source: string): string | number {
  const rows = database.pragma(source) as Array<Record<string, string | number>>;
  const value = rows[0] ? Object.values(rows[0]!)[0] : undefined;
  if (typeof value !== "string" && typeof value !== "number") {
    throw new StorageError("Research vector SQLite PRAGMA did not return a scalar value", "INVALID_DATA", { source });
  }
  return value;
}

function applyConnectionPolicy(database: Database.Database): void {
  database.pragma("busy_timeout = 5000");
  database.pragma("trusted_schema = OFF");
  database.pragma("foreign_keys = ON");
  database.pragma("synchronous = FULL");
  database.pragma("secure_delete = ON");
  database.pragma("wal_autocheckpoint = 1000");
  database.pragma("journal_size_limit = 67108864");
  const journalMode = String(pragmaScalar(database, "journal_mode = WAL")).toLocaleLowerCase("und");
  if (journalMode !== "wal") {
    throw new StorageError("Research vector index did not enter WAL mode", "INVALID_DATA", { journalMode });
  }
}

function loadReviewedVectorExtension(database: Database.Database): void {
  let extensionPath: string;
  try {
    extensionPath = path.resolve(getLoadablePath());
  } catch (error) {
    throw new VectorExtensionUnavailableError(error instanceof Error ? error.message : String(error));
  }
  if (!/^vec0\.(?:dll|so|dylib)$/iu.test(path.basename(extensionPath))) {
    throw new VectorExtensionUnavailableError("sqlite-vec returned an unexpected extension file");
  }
  try {
    loadSqliteVec(database as unknown as Parameters<typeof loadSqliteVec>[0]);
    const row = database.prepare("SELECT vec_version() AS version").get() as { version?: unknown } | undefined;
    if (row?.version !== RESEARCH_VECTOR_EXTENSION_VERSION) {
      throw new VectorExtensionUnavailableError("sqlite-vec version does not match the reviewed dependency");
    }
  } catch (error) {
    if (error instanceof VectorExtensionUnavailableError) throw error;
    throw new VectorExtensionUnavailableError(error instanceof Error ? error.message : String(error));
  }
}

function validateDimensions(dimensions: number): void {
  if (!Number.isInteger(dimensions) || dimensions < 1 || dimensions > 65_536) {
    throw new StorageError("Research vector dimensions are invalid", "INVALID_DATA", { dimensions });
  }
}

function schemaSql(dimensions: number): string {
  validateDimensions(dimensions);
  return VECTOR_SCHEMA_TEMPLATE.replace("$DIMENSIONS", String(dimensions));
}

function initializeVectorIndex(database: Database.Database, input: ResearchVectorIndexBuildInput, buildId: string): void {
  database.pragma("auto_vacuum = INCREMENTAL");
  database.pragma(`application_id = ${RESEARCH_VECTOR_INDEX_APPLICATION_ID}`);
  database.exec(schemaSql(input.dimensions));
  const setMeta = database.prepare("INSERT INTO index_meta (key, value) VALUES (?, ?)");
  const sourceSnapshotHash = researchVectorSourceSnapshotHash(input.chunks);
  for (const [key, value] of [
    ["database_kind", "novel-studio-research-vector-index"],
    ["research_database_id", input.researchDatabaseId],
    ["schema_checksum", RESEARCH_VECTOR_INDEX_SCHEMA_CHECKSUM],
    ["extension_version", RESEARCH_VECTOR_EXTENSION_VERSION],
    ["profile_id", input.profileId],
    ["profile_revision", input.profileRevision],
    ["dimensions", String(input.dimensions)],
    ["model", input.model],
    ["normalize", String(input.normalize)],
    ["document_prefix", input.documentPrefix],
    ["query_prefix", input.queryPrefix],
    ["capability_revision", input.capabilityRevision],
    ["validation_fixture_version", String(input.validationFixtureVersion)],
    ["source_snapshot_hash", sourceSnapshotHash],
    ["build_id", buildId],
    ["built_at", new Date().toISOString()],
  ] as const) {
    setMeta.run(key, value);
  }
  database.pragma(`user_version = ${RESEARCH_VECTOR_INDEX_SCHEMA_VERSION}`);
}

function readMeta(database: Database.Database): Map<string, string> {
  const rows = database.prepare("SELECT key, value FROM index_meta").all() as Array<{ key: string; value: string }>;
  return new Map(rows.map((row) => [row.key, row.value]));
}

function validateReadyVectorIndex(database: Database.Database, researchDatabaseId: string): Map<string, string> {
  if (Number(pragmaScalar(database, "application_id")) !== RESEARCH_VECTOR_INDEX_APPLICATION_ID) {
    throw new StorageError("Research vector index belongs to another application", "INVALID_DATA");
  }
  if (Number(pragmaScalar(database, "user_version")) !== RESEARCH_VECTOR_INDEX_SCHEMA_VERSION) {
    throw new StorageError("Research vector index schema version is unsupported", "INVALID_DATA");
  }
  const meta = readMeta(database);
  if (
    meta.get("database_kind") !== "novel-studio-research-vector-index"
    || meta.get("research_database_id") !== researchDatabaseId
    || meta.get("schema_checksum") !== RESEARCH_VECTOR_INDEX_SCHEMA_CHECKSUM
    || meta.get("extension_version") !== RESEARCH_VECTOR_EXTENSION_VERSION
  ) {
    throw new StorageError("Research vector index identity or schema checksum does not match", "INVALID_DATA");
  }
  const dimensions = Number(meta.get("dimensions"));
  validateDimensions(dimensions);
  const vectorSql = (database.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'chunk_vectors'",
  ).get() as { sql?: string } | undefined)?.sql ?? "";
  if (!vectorSql.includes(`float[${dimensions}]`)) {
    throw new StorageError("Research vector index dimensions do not match its vector table", "INVALID_DATA");
  }
  const quickCheck = String(pragmaScalar(database, "quick_check"));
  if (quickCheck !== "ok") {
    throw new StorageError("Research vector index integrity check failed", "INVALID_DATA", { quickCheck });
  }
  const metadataCount = (database.prepare("SELECT count(*) AS count FROM chunk_metadata").get() as { count: number }).count;
  const vectorCount = (database.prepare("SELECT count(*) AS count FROM chunk_vectors").get() as { count: number }).count;
  const orphanCount = (database.prepare(
    "SELECT count(*) AS count FROM chunk_metadata AS m LEFT JOIN chunk_vectors AS v ON v.rowid = m.vector_rowid WHERE v.rowid IS NULL",
  ).get() as { count: number }).count;
  if (metadataCount !== vectorCount || orphanCount !== 0) {
    throw new StorageError("Research vector index metadata and vectors are inconsistent", "INVALID_DATA");
  }
  return meta;
}

function openVectorIndex(
  databasePath: string,
  researchDatabaseId: string,
  create = false,
  input?: ResearchVectorIndexBuildInput,
  buildId = "",
): Database.Database {
  const database = new Database(databasePath, { fileMustExist: !create });
  try {
    applyConnectionPolicy(database);
    loadReviewedVectorExtension(database);
    if (create) {
      if (!input) throw new StorageError("Research vector build input is required", "INVALID_DATA");
      initializeVectorIndex(database, input, buildId || randomUUID());
    } else {
      validateReadyVectorIndex(database, researchDatabaseId);
    }
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

function validateChunk(chunk: ResearchVectorChunkInput, dimensions: number): void {
  if (chunk.embedding.length !== dimensions || chunk.embedding.some((value) => !Number.isFinite(value))) {
    throw new StorageError("Research chunk embedding is invalid", "INVALID_DATA", {
      actualDimensions: chunk.embedding.length,
      chunkId: chunk.chunkId,
      expectedDimensions: dimensions,
    });
  }
}

function validateVectorBuildMetadata(chunks: ResearchVectorChunkInput[]): void {
  const sourceRevisions = new Map<string, string>();
  const chunkIds = new Set<string>();
  for (const chunk of chunks) {
    const knownRevision = sourceRevisions.get(chunk.sourceId);
    if (knownRevision && knownRevision !== chunk.sourceRevision) {
      throw new StorageError("Research vector build contains conflicting Source revisions", "INVALID_DATA", {
        sourceId: chunk.sourceId,
      });
    }
    if (chunkIds.has(chunk.chunkId)) {
      throw new StorageError("Research vector build contains duplicate Chunk IDs", "INVALID_DATA", {
        chunkId: chunk.chunkId,
      });
    }
    sourceRevisions.set(chunk.sourceId, chunk.sourceRevision);
    chunkIds.add(chunk.chunkId);
  }
}

function populateVectorIndexBatch(
  database: Database.Database,
  input: ResearchVectorIndexBuildInput,
  chunks: ResearchVectorChunkInput[],
  rowidOffset: number,
): void {
  const insertSource = database.prepare(
    "INSERT OR IGNORE INTO source_ledger (source_id, source_revision) VALUES (?, ?)",
  );
  const insertMetadata = database.prepare(`
    INSERT INTO chunk_metadata (
      vector_rowid, chunk_id, source_id, source_revision, source_display_name, source_kind,
      source_author, source_tags_json, ai_permission, block_id, block_order, chunk_hash,
      original_text, language_tag, location_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertVector = database.prepare("INSERT INTO chunk_vectors (rowid, embedding) VALUES (?, ?)");

  database.transaction(() => {
    chunks.forEach((chunk, index) => {
      validateChunk(chunk, input.dimensions);
      insertSource.run(chunk.sourceId, chunk.sourceRevision);
      const rowid = rowidOffset + index + 1;
      insertMetadata.run(
        rowid,
        chunk.chunkId,
        chunk.sourceId,
        chunk.sourceRevision,
        chunk.sourceDisplayName,
        chunk.sourceKind,
        chunk.sourceAuthor,
        JSON.stringify(chunk.sourceTags),
        chunk.aiPermission,
        chunk.blockId,
        chunk.blockOrder,
        chunk.chunkHash,
        chunk.originalText,
        chunk.languageTag,
        JSON.stringify(chunk.location),
      );
      insertVector.run(BigInt(rowid), JSON.stringify(chunk.embedding));
    });
  })();
}

function populateVectorIndex(database: Database.Database, input: ResearchVectorIndexBuildInput): void {
  validateVectorBuildMetadata(input.chunks);
  populateVectorIndexBatch(database, input, input.chunks, 0);
}

function hasReusableVectorIdentity(meta: Map<string, string>, input: ResearchVectorIndexBuildInput): boolean {
  return meta.get("research_database_id") === input.researchDatabaseId
    && meta.get("profile_id") === input.profileId
    && meta.get("profile_revision") === input.profileRevision
    && Number(meta.get("dimensions")) === input.dimensions
    && meta.get("model") === input.model
    && meta.get("normalize") === String(input.normalize)
    && meta.get("document_prefix") === input.documentPrefix
    && meta.get("query_prefix") === input.queryPrefix
    && meta.get("capability_revision") === input.capabilityRevision
    && meta.get("validation_fixture_version") === String(input.validationFixtureVersion);
}

function openReusableVectorIndex(
  databaseRoot: string,
  input: ResearchVectorIndexBuildInput,
): Database.Database | undefined {
  try {
    const database = openVectorIndex(
      researchVectorIndexDatabasePath(databaseRoot),
      input.researchDatabaseId,
    );
    if (!hasReusableVectorIdentity(readMeta(database), input)) {
      database.close();
      return undefined;
    }
    return database;
  } catch {
    return undefined;
  }
}

export function researchVectorSourceSnapshotHash(chunks: ResearchVectorChunkInput[]): string {
  const entries = chunks.map((chunk) => `${chunk.sourceId}:${chunk.sourceRevision}:${chunk.chunkId}:${chunk.chunkHash}`).sort();
  return createHash("sha256").update(entries.join("\n"), "utf8").digest("hex");
}

async function removeArtifacts(basePath: string): Promise<void> {
  await Promise.all(INDEX_SUFFIXES.map((suffix) => rm(`${basePath}${suffix}`, { force: true })));
}

async function moveArtifacts(fromPath: string, toPath: string): Promise<string[]> {
  const moved: string[] = [];
  for (const suffix of INDEX_SUFFIXES) {
    const from = `${fromPath}${suffix}`;
    if (!(await pathExists(from))) continue;
    await rename(from, `${toPath}${suffix}`);
    moved.push(suffix);
  }
  return moved;
}

async function swapVectorIndex(
  databaseRoot: string,
  input: ResearchVectorIndexBuildInput,
  builtPath: string,
  buildId: string,
  hooks: ResearchVectorIndexBuildHooks,
): Promise<void> {
  const livePath = researchVectorIndexDatabasePath(databaseRoot);
  const rollbackPath = assertInside(databaseRoot, path.join(path.dirname(builtPath), `${buildId}.rollback.sqlite`));
  await removeArtifacts(rollbackPath);
  const liveMoved = await moveArtifacts(livePath, rollbackPath);
  try {
    await hooks.afterLiveMoved?.(livePath);
    await moveArtifacts(builtPath, livePath);
    await hooks.afterNewMoved?.(livePath);
    const verified = openVectorIndex(livePath, input.researchDatabaseId);
    verified.close();
    await removeArtifacts(rollbackPath);
  } catch (error) {
    await removeArtifacts(livePath);
    if (liveMoved.length > 0) await moveArtifacts(rollbackPath, livePath);
    throw error;
  }
}

async function rebuildResearchVectorIndexInternal(
  databaseRoot: string,
  rawInput: ResearchVectorIndexBuildInput,
  options: ResearchVectorIndexBuildOptions,
  populate: (database: Database.Database, input: ResearchVectorIndexBuildInput) => Promise<void> | void,
): Promise<ResearchVectorIndexState> {
  const input = { ...rawInput, chunks: [...rawInput.chunks] };
  validateDimensions(input.dimensions);
  return withVectorIndexLane(databaseRoot, async () => {
    throwIfCancelled(options.signal);
    const buildId = randomUUID();
    const buildRoot = assertInside(databaseRoot, path.join(databaseRoot, ".studio", "vector-index-build"));
    await mkdir(buildRoot, { recursive: true });
    const builtPath = assertInside(databaseRoot, path.join(buildRoot, `${buildId}.sqlite`));
    try {
      const database = openVectorIndex(builtPath, input.researchDatabaseId, true, input, buildId);
      try {
        await options.hooks?.afterDatabaseCreated?.(builtPath);
        throwIfCancelled(options.signal);
        await populate(database, input);
        validateReadyVectorIndex(database, input.researchDatabaseId);
        database.pragma("wal_checkpoint(TRUNCATE)");
      } finally {
        database.close();
      }
      await options.hooks?.beforeSwap?.(builtPath);
      throwIfCancelled(options.signal);
      await swapVectorIndex(databaseRoot, input, builtPath, buildId, options.hooks ?? {});
      return inspectResearchVectorIndex(databaseRoot, input.researchDatabaseId, input);
    } finally {
      await removeArtifacts(builtPath);
      const remaining = await readdir(buildRoot).catch(() => []);
      if (remaining.length === 0) await rmdir(buildRoot).catch(() => undefined);
    }
  });
}

export async function rebuildResearchVectorIndex(
  databaseRoot: string,
  rawInput: ResearchVectorIndexBuildInput,
  options: ResearchVectorIndexBuildOptions = {},
): Promise<ResearchVectorIndexState> {
  return rebuildResearchVectorIndexInternal(databaseRoot, rawInput, options, populateVectorIndex);
}

export async function rebuildResearchVectorIndexStreaming(
  databaseRoot: string,
  rawInput: ResearchVectorIndexBuildInput,
  options: ResearchVectorIndexStreamingOptions,
): Promise<ResearchVectorIndexState> {
  if (!Number.isInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 2048) {
    throw new StorageError("Research vector build batch size is invalid", "INVALID_DATA", {
      batchSize: options.batchSize,
    });
  }
  validateVectorBuildMetadata(rawInput.chunks);
  return rebuildResearchVectorIndexInternal(databaseRoot, rawInput, options, async (database, input) => {
    const reusable = openReusableVectorIndex(databaseRoot, input);
    const findReusable = reusable?.prepare(`
      SELECT vec_to_json(v.embedding) AS embedding_json
      FROM chunk_metadata AS m
      JOIN chunk_vectors AS v ON v.rowid = m.vector_rowid
      WHERE m.chunk_id = ? AND m.chunk_hash = ? AND m.original_text = ?
    `);
    try {
      for (let offset = 0; offset < input.chunks.length; offset += options.batchSize) {
        throwIfCancelled(options.signal);
        const metadata = input.chunks.slice(offset, offset + options.batchSize);
        const vectors = new Array<number[]>(metadata.length);
        const missing: ResearchVectorChunkInput[] = [];
        const missingIndexes: number[] = [];
        metadata.forEach((chunk, index) => {
          const row = findReusable?.get(chunk.chunkId, chunk.chunkHash, chunk.originalText) as
            | { embedding_json: string }
            | undefined;
          if (row) vectors[index] = JSON.parse(row.embedding_json) as number[];
          else {
            missing.push(chunk);
            missingIndexes.push(index);
          }
        });
        if (missing.length > 0) {
          const embedded = await options.embedBatch(missing, options.signal);
          throwIfCancelled(options.signal);
          if (embedded.length !== missing.length) {
            throw new StorageError("Embedding Provider returned an incomplete Research vector batch", "INVALID_DATA", {
              actualCount: embedded.length,
              expectedCount: missing.length,
              offset,
            });
          }
          embedded.forEach((vector, index) => { vectors[missingIndexes[index]!] = vector; });
        }
        populateVectorIndexBatch(
          database,
          input,
          metadata.map((chunk, index) => ({ ...chunk, embedding: vectors[index]! })),
          offset,
        );
      }
    } finally {
      reusable?.close();
    }
  });
}

export async function inspectResearchVectorIndex(
  databaseRoot: string,
  researchDatabaseId: string,
  expected?: ResearchVectorIndexBuildInput,
): Promise<ResearchVectorIndexState> {
  const databasePath = researchVectorIndexDatabasePath(databaseRoot);
  try {
    await stat(databasePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return ResearchVectorIndexStateSchema.parse({
        researchDatabaseId,
        status: "missing",
        indexedSourceCount: 0,
        indexedChunkCount: 0,
        dimensions: null,
        profileId: null,
        profileRevision: null,
        reason: "Research vector index has not been built",
      });
    }
    throw error;
  }
  let database: Database.Database | undefined;
  try {
    database = openVectorIndex(databasePath, researchDatabaseId);
    const meta = readMeta(database);
    const indexedSourceCount = (database.prepare("SELECT count(*) AS count FROM source_ledger").get() as { count: number }).count;
    const indexedChunkCount = (database.prepare("SELECT count(*) AS count FROM chunk_metadata").get() as { count: number }).count;
    const dimensions = Number(meta.get("dimensions"));
    const profileId = meta.get("profile_id") ?? null;
    const profileRevision = meta.get("profile_revision") ?? null;
    const staleReason = expected && (
      expected.profileId !== profileId
      || expected.profileRevision !== profileRevision
      || expected.dimensions !== dimensions
      || expected.model !== meta.get("model")
      || String(expected.normalize) !== meta.get("normalize")
      || expected.documentPrefix !== meta.get("document_prefix")
      || expected.queryPrefix !== meta.get("query_prefix")
      || expected.capabilityRevision !== meta.get("capability_revision")
      || String(expected.validationFixtureVersion) !== meta.get("validation_fixture_version")
      || researchVectorSourceSnapshotHash(expected.chunks) !== meta.get("source_snapshot_hash")
    ) ? "Research vector index does not match current Source or embedding profile revisions" : null;
    return ResearchVectorIndexStateSchema.parse({
      researchDatabaseId,
      status: staleReason ? "stale" : "ready",
      indexedSourceCount,
      indexedChunkCount,
      dimensions,
      profileId,
      profileRevision,
      reason: staleReason,
    });
  } catch (error) {
    const unavailable = error instanceof VectorExtensionUnavailableError;
    return ResearchVectorIndexStateSchema.parse({
      researchDatabaseId,
      status: unavailable ? "unavailable" : "damaged",
      indexedSourceCount: 0,
      indexedChunkCount: 0,
      dimensions: null,
      profileId: null,
      profileRevision: null,
      reason: error instanceof Error ? error.message : "Research vector index could not be opened",
    });
  } finally {
    database?.close();
  }
}

export async function searchResearchVectorIndex(
  databaseRoot: string,
  researchDatabaseId: string,
  queryEmbedding: number[],
  limit: number,
  filters: ResearchVectorSearchFilters = {},
): Promise<ResearchVectorSearchResult[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new StorageError("Research vector search limit is invalid", "INVALID_DATA", { limit });
  }
  return withVectorIndexLane(databaseRoot, async () => {
    const database = openVectorIndex(researchVectorIndexDatabasePath(databaseRoot), researchDatabaseId);
    try {
      const meta = readMeta(database);
      const dimensions = Number(meta.get("dimensions"));
      validateChunk({ embedding: queryEmbedding } as ResearchVectorChunkInput, dimensions);
      const total = (database.prepare("SELECT count(*) AS count FROM chunk_metadata").get() as { count: number }).count;
      if (total === 0) return [];
      const query = database.prepare(`
        SELECT m.*, v.distance
        FROM chunk_vectors AS v
        JOIN chunk_metadata AS m ON m.vector_rowid = v.rowid
        WHERE v.embedding MATCH ? AND k = ?
        ORDER BY v.distance, m.chunk_id
      `);
      const mapRow = (row: Record<string, unknown>): ResearchVectorSearchResult => ({
        chunkId: String(row.chunk_id),
        sourceId: String(row.source_id),
        sourceRevision: String(row.source_revision),
        sourceDisplayName: String(row.source_display_name),
        sourceKind: String(row.source_kind) as ResearchSourceKind,
        sourceAuthor: String(row.source_author),
        sourceTags: JSON.parse(String(row.source_tags_json)) as string[],
        aiPermission: String(row.ai_permission) as "never" | "allowed",
        blockId: String(row.block_id),
        blockOrder: Number(row.block_order),
        chunkHash: String(row.chunk_hash),
        originalText: String(row.original_text),
        languageTag: String(row.language_tag),
        location: JSON.parse(String(row.location_json)) as ResearchSourceLocation,
        distance: Number(row.distance),
      });
      const matchesFilters = (result: ResearchVectorSearchResult): boolean => {
        if (filters.purpose === "model-context" && result.aiPermission === "never") return false;
        if (filters.sourceKinds && !filters.sourceKinds.includes(result.sourceKind)) return false;
        if (filters.languageTags && !filters.languageTags.some((tag) =>
          result.languageTag.toLocaleLowerCase("und").startsWith(tag.toLocaleLowerCase("und")))) return false;
        if (filters.tags && !filters.tags.every((tag) => result.sourceTags.some((actual) =>
          actual.toLocaleLowerCase("und") === tag.toLocaleLowerCase("und")))) return false;
        if (filters.author && !result.sourceAuthor.toLocaleLowerCase("und").includes(filters.author.toLocaleLowerCase("und"))) return false;
        return true;
      };
      const hasFilters = filters.purpose === "model-context"
        || Boolean(filters.sourceKinds?.length)
        || Boolean(filters.languageTags?.length)
        || Boolean(filters.tags?.length)
        || Boolean(filters.author);
      let candidateCount = Math.min(total, hasFilters ? Math.max(100, limit) : limit);
      while (true) {
        const rows = query.all(JSON.stringify(queryEmbedding), candidateCount) as Array<Record<string, unknown>>;
        const matches = rows.map(mapRow).filter(matchesFilters);
        if (matches.length >= limit || candidateCount === total) return matches.slice(0, limit);
        candidateCount = Math.min(total, candidateCount * 2);
      }
    } finally {
      database.close();
    }
  });
}

export async function deleteResearchVectorChunk(
  databaseRoot: string,
  researchDatabaseId: string,
  chunkId: string,
): Promise<boolean> {
  return withVectorIndexLane(databaseRoot, async () => {
    const database = openVectorIndex(researchVectorIndexDatabasePath(databaseRoot), researchDatabaseId);
    try {
      const row = database.prepare("SELECT vector_rowid FROM chunk_metadata WHERE chunk_id = ?").get(chunkId) as
        | { vector_rowid: number | bigint }
        | undefined;
      if (!row) return false;
      database.transaction(() => {
        database.prepare("DELETE FROM chunk_vectors WHERE rowid = ?").run(BigInt(row.vector_rowid));
        database.prepare("DELETE FROM chunk_metadata WHERE vector_rowid = ?").run(row.vector_rowid);
      })();
      validateReadyVectorIndex(database, researchDatabaseId);
      return true;
    } finally {
      database.close();
    }
  });
}
