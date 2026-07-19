import { createHash, randomUUID } from "node:crypto";
import { mkdir, readdir, rename, rm, rmdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  ResearchIndexStateSchema,
  ResearchKeywordSearchInputSchema,
  ResearchKeywordSearchResponseSchema,
  type ResearchIndexState,
  type ResearchKeywordSearchInput,
  type ResearchKeywordSearchResponse,
  type ResearchSourceDocument,
  type ResearchSourceDetail,
  type ResearchSourceKind,
} from "@novel-studio/contracts";
import Database from "better-sqlite3";
import { StorageError } from "./errors.js";
import { assertInside, pathExists } from "./fileSystem.js";

export const RESEARCH_INDEX_APPLICATION_ID = 0x4e535258;
export const RESEARCH_INDEX_SCHEMA_VERSION = 1;

const RESEARCH_INDEX_SCHEMA_SQL = `
  CREATE TABLE index_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  ) STRICT;
  CREATE TABLE source_ledger (
    source_id TEXT PRIMARY KEY,
    source_revision TEXT NOT NULL CHECK (length(source_revision) = 64),
    content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
    parsed_content_hash TEXT NOT NULL CHECK (length(parsed_content_hash) = 64)
  ) STRICT;
  CREATE TABLE reference_sections (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES source_ledger(source_id) ON DELETE CASCADE,
    parent_id TEXT,
    position INTEGER NOT NULL CHECK (position >= 0),
    title TEXT NOT NULL,
    location_json TEXT NOT NULL
  ) STRICT;
  CREATE TABLE reference_blocks (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES source_ledger(source_id) ON DELETE CASCADE,
    section_id TEXT,
    position INTEGER NOT NULL CHECK (position >= 0),
    kind TEXT NOT NULL,
    text_hash TEXT NOT NULL CHECK (length(text_hash) = 64),
    location_json TEXT NOT NULL,
    language_tag TEXT NOT NULL
  ) STRICT;
  CREATE TABLE reference_chunks (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES source_ledger(source_id) ON DELETE CASCADE,
    block_id TEXT NOT NULL REFERENCES reference_blocks(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position >= 0),
    text TEXT NOT NULL,
    text_hash TEXT NOT NULL CHECK (length(text_hash) = 64),
    location_json TEXT NOT NULL,
    language_tag TEXT NOT NULL,
    source_revision TEXT NOT NULL CHECK (length(source_revision) = 64),
    source_display_name TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    source_author TEXT NOT NULL,
    source_tags_json TEXT NOT NULL,
    ai_permission TEXT NOT NULL CHECK (ai_permission IN ('never', 'allowed'))
  ) STRICT;
  CREATE INDEX reference_chunks_source_idx ON reference_chunks(source_id, position);
  CREATE INDEX reference_chunks_language_idx ON reference_chunks(language_tag, source_id);
  CREATE TABLE reference_language_spans (
    chunk_id TEXT NOT NULL REFERENCES reference_chunks(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position >= 0),
    start_offset INTEGER NOT NULL CHECK (start_offset >= 0),
    end_offset INTEGER NOT NULL CHECK (end_offset > start_offset),
    language_tag TEXT NOT NULL,
    source TEXT NOT NULL,
    confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    detector_version TEXT NOT NULL,
    PRIMARY KEY (chunk_id, position)
  ) STRICT;
  CREATE VIRTUAL TABLE reference_fts_cjk USING fts5(
    chunk_id UNINDEXED,
    text,
    tokenize='trigram'
  );
  CREATE VIRTUAL TABLE reference_fts_word USING fts5(
    chunk_id UNINDEXED,
    text,
    tokenize='unicode61 remove_diacritics 0'
  );
`;

export const RESEARCH_INDEX_SCHEMA_CHECKSUM = createHash("sha256")
  .update(RESEARCH_INDEX_SCHEMA_SQL.trim().replace(/\r\n/gu, "\n"), "utf8")
  .digest("hex");

const INDEX_SUFFIXES = ["", "-wal", "-shm", "-journal"] as const;
const researchIndexLanes = new Map<string, Promise<void>>();
const validatedResearchIndexSignatures = new Map<string, string>();

export interface ResearchIndexBuildHooks {
  afterDatabaseCreated?: (databasePath: string) => void | Promise<void>;
  beforeSwap?: (databasePath: string) => void | Promise<void>;
  afterLiveMoved?: (databasePath: string) => void | Promise<void>;
  afterNewMoved?: (databasePath: string) => void | Promise<void>;
}

export interface ResearchIndexBuildOptions {
  signal?: AbortSignal;
  hooks?: ResearchIndexBuildHooks;
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const error = new Error("Research index rebuild was cancelled");
    error.name = "AbortError";
    throw error;
  }
}

async function withResearchIndexLane<T>(databaseRoot: string, operation: () => Promise<T>): Promise<T> {
  const key = path.resolve(databaseRoot);
  const previous = researchIndexLanes.get(key) ?? Promise.resolve();
  const waitForPrevious = previous.catch(() => undefined);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const tail = waitForPrevious.then(() => gate);
  researchIndexLanes.set(key, tail);
  await waitForPrevious;
  try {
    return await operation();
  } finally {
    release();
    if (researchIndexLanes.get(key) === tail) researchIndexLanes.delete(key);
  }
}

export function researchIndexDatabasePath(databaseRoot: string): string {
  return assertInside(databaseRoot, path.join(databaseRoot, ".studio", "index.sqlite"));
}

function pragmaScalar(database: Database.Database, source: string): string | number {
  const rows = database.pragma(source) as Array<Record<string, string | number>>;
  const value = rows[0] ? Object.values(rows[0]!)[0] : undefined;
  if (typeof value !== "string" && typeof value !== "number") {
    throw new StorageError("Research SQLite PRAGMA did not return a scalar value", "INVALID_DATA", { source });
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
    throw new StorageError("Research index did not enter WAL mode", "INVALID_DATA", { journalMode });
  }
}

function applyFtsPolicy(database: Database.Database): void {
  for (const table of ["reference_fts_cjk", "reference_fts_word"] as const) {
    database.prepare(`INSERT INTO ${table}(${table}, rank) VALUES ('secure-delete', 1)`).run();
  }
}

function initializeResearchIndex(
  database: Database.Database,
  researchDatabaseId: string,
  buildId: string,
): void {
  database.pragma("auto_vacuum = INCREMENTAL");
  database.pragma(`application_id = ${RESEARCH_INDEX_APPLICATION_ID}`);
  database.exec(RESEARCH_INDEX_SCHEMA_SQL);
  const setMeta = database.prepare("INSERT INTO index_meta (key, value) VALUES (?, ?)");
  setMeta.run("database_kind", "novel-studio-research-index");
  setMeta.run("research_database_id", researchDatabaseId);
  setMeta.run("schema_checksum", RESEARCH_INDEX_SCHEMA_CHECKSUM);
  setMeta.run("build_id", buildId);
  setMeta.run("built_at", new Date().toISOString());
  database.pragma(`user_version = ${RESEARCH_INDEX_SCHEMA_VERSION}`);
  applyFtsPolicy(database);
}

function validateResearchIndexIdentity(database: Database.Database, researchDatabaseId: string): void {
  if (Number(pragmaScalar(database, "application_id")) !== RESEARCH_INDEX_APPLICATION_ID) {
    throw new StorageError("Research index belongs to another application", "INVALID_DATA");
  }
  if (Number(pragmaScalar(database, "user_version")) !== RESEARCH_INDEX_SCHEMA_VERSION) {
    throw new StorageError("Research index schema version is unsupported", "INVALID_DATA");
  }
  const metaRows = database.prepare("SELECT key, value FROM index_meta").all() as Array<{ key: string; value: string }>;
  const meta = new Map(metaRows.map((row) => [row.key, row.value]));
  if (
    meta.get("database_kind") !== "novel-studio-research-index"
    || meta.get("research_database_id") !== researchDatabaseId
    || meta.get("schema_checksum") !== RESEARCH_INDEX_SCHEMA_CHECKSUM
  ) {
    throw new StorageError("Research index identity or schema checksum does not match", "INVALID_DATA");
  }
}

function validateReadyResearchIndex(database: Database.Database, researchDatabaseId: string): void {
  validateResearchIndexIdentity(database, researchDatabaseId);
  const quickCheck = String(pragmaScalar(database, "quick_check"));
  if (quickCheck !== "ok") throw new StorageError("Research index integrity check failed", "INVALID_DATA", { quickCheck });
  const chunkCount = (database.prepare("SELECT count(*) AS count FROM reference_chunks").get() as { count: number }).count;
  for (const table of ["reference_fts_cjk", "reference_fts_word"] as const) {
    const ftsCount = (database.prepare(`SELECT count(*) AS count FROM ${table}`).get() as { count: number }).count;
    const distinctCount = (database.prepare(`SELECT count(DISTINCT chunk_id) AS count FROM ${table}`).get() as { count: number }).count;
    const secureDelete = database.prepare(`SELECT v FROM ${table}_config WHERE k = 'secure-delete'`).get() as
      | { v: number }
      | undefined;
    if (ftsCount !== chunkCount || distinctCount !== chunkCount || secureDelete?.v !== 1) {
      throw new StorageError("Research index FTS projection is inconsistent", "INVALID_DATA", { table });
    }
  }
}

function openResearchIndex(
  databasePath: string,
  researchDatabaseId: string,
  create = false,
  buildId = "",
  deepValidation = true,
): Database.Database {
  const database = new Database(databasePath, { fileMustExist: !create });
  try {
    applyConnectionPolicy(database);
    if (create) initializeResearchIndex(database, researchDatabaseId, buildId || randomUUID());
    else if (deepValidation) validateReadyResearchIndex(database, researchDatabaseId);
    else validateResearchIndexIdentity(database, researchDatabaseId);
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

async function researchIndexArtifactSignature(databasePath: string): Promise<string> {
  const states = await Promise.all(INDEX_SUFFIXES.map(async (suffix) => {
    try {
      const state = await stat(`${databasePath}${suffix}`);
      return [state.size, state.mtimeMs, state.ctimeMs];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }));
  return JSON.stringify(states);
}

function v3Details(sources: ResearchSourceDetail[]): Array<Extract<ResearchSourceDetail, { content: unknown }>> {
  return sources.filter((source): source is Extract<ResearchSourceDetail, { content: unknown }> => "content" in source);
}

function populateResearchIndex(database: Database.Database, sources: ResearchSourceDetail[]): void {
  const insertLedger = database.prepare(
    "INSERT INTO source_ledger (source_id, source_revision, content_hash, parsed_content_hash) VALUES (?, ?, ?, ?)",
  );
  const insertSection = database.prepare(
    "INSERT INTO reference_sections (id, source_id, parent_id, position, title, location_json) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const insertBlock = database.prepare(
    `INSERT INTO reference_blocks
      (id, source_id, section_id, position, kind, text_hash, location_json, language_tag)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertChunk = database.prepare(
    `INSERT INTO reference_chunks
      (id, source_id, block_id, position, text, text_hash, location_json, language_tag, source_revision,
       source_display_name, source_kind, source_author, source_tags_json, ai_permission)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertSpan = database.prepare(
    `INSERT INTO reference_language_spans
      (chunk_id, position, start_offset, end_offset, language_tag, source, confidence, detector_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertCjk = database.prepare("INSERT INTO reference_fts_cjk (chunk_id, text) VALUES (?, ?)");
  const insertWord = database.prepare("INSERT INTO reference_fts_word (chunk_id, text) VALUES (?, ?)");

  database.transaction(() => {
    for (const detail of v3Details(sources)) {
      insertLedger.run(
        detail.source.id,
        detail.revision,
        detail.source.contentHash,
        detail.source.parsedContentHash,
      );
      for (const section of detail.content.sections) {
        insertSection.run(
          section.id,
          detail.source.id,
          section.parentSectionId,
          section.order,
          section.title,
          JSON.stringify(section.location),
        );
      }
      for (const block of detail.content.blocks) {
        insertBlock.run(
          block.id,
          detail.source.id,
          block.sectionId,
          block.order,
          block.kind,
          block.textHash,
          JSON.stringify(block.location),
          block.language.languageTag,
        );
      }
      for (const chunk of detail.content.chunks) {
        insertChunk.run(
          chunk.id,
          detail.source.id,
          chunk.blockId,
          chunk.order,
          chunk.text,
          chunk.textHash,
          JSON.stringify(chunk.location),
          chunk.language.languageTag,
          detail.revision,
          detail.source.displayName,
          detail.source.kind,
          detail.source.author,
          JSON.stringify(detail.source.tags),
          detail.source.aiPermission,
        );
        for (const [position, span] of chunk.languageSpans.entries()) {
          insertSpan.run(
            chunk.id,
            position,
            span.start,
            span.end,
            span.languageTag,
            span.source,
            span.confidence,
            span.detectorVersion,
          );
        }
        insertCjk.run(chunk.id, chunk.text);
        insertWord.run(chunk.id, chunk.text);
      }
    }
  })();
  database.pragma("optimize = 0x10002");
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

async function swapResearchIndex(
  databaseRoot: string,
  researchDatabaseId: string,
  builtPath: string,
  buildId: string,
  hooks: ResearchIndexBuildHooks = {},
): Promise<void> {
  const livePath = researchIndexDatabasePath(databaseRoot);
  const rollbackPath = assertInside(databaseRoot, path.join(path.dirname(builtPath), `${buildId}.rollback.sqlite`));
  await removeArtifacts(rollbackPath);
  const liveMoved = await moveArtifacts(livePath, rollbackPath);
  try {
    await hooks.afterLiveMoved?.(livePath);
    await moveArtifacts(builtPath, livePath);
    await hooks.afterNewMoved?.(livePath);
    const verified = openResearchIndex(livePath, researchDatabaseId);
    verified.close();
    await removeArtifacts(rollbackPath);
  } catch (error) {
    await removeArtifacts(livePath);
    if (liveMoved.length > 0) await moveArtifacts(rollbackPath, livePath);
    throw error;
  }
}

export async function rebuildResearchIndex(
  databaseRoot: string,
  researchDatabaseId: string,
  sources: ResearchSourceDetail[],
  options: ResearchIndexBuildOptions = {},
): Promise<ResearchIndexState> {
  return withResearchIndexLane(databaseRoot, async () => {
    throwIfCancelled(options.signal);
    const buildId = randomUUID();
    const buildRoot = assertInside(databaseRoot, path.join(databaseRoot, ".studio", "index-build"));
    await mkdir(buildRoot, { recursive: true });
    const builtPath = assertInside(databaseRoot, path.join(buildRoot, `${buildId}.sqlite`));
    try {
      const database = openResearchIndex(builtPath, researchDatabaseId, true, buildId);
      try {
        await options.hooks?.afterDatabaseCreated?.(builtPath);
        throwIfCancelled(options.signal);
        populateResearchIndex(database, sources);
        validateReadyResearchIndex(database, researchDatabaseId);
        database.pragma("wal_checkpoint(TRUNCATE)");
      } finally {
        database.close();
      }
      throwIfCancelled(options.signal);
      await options.hooks?.beforeSwap?.(builtPath);
      throwIfCancelled(options.signal);
      await swapResearchIndex(databaseRoot, researchDatabaseId, builtPath, buildId, options.hooks);
      return inspectResearchIndex(databaseRoot, researchDatabaseId, sources);
    } finally {
      await removeArtifacts(builtPath);
      const remaining = await readdir(buildRoot).catch(() => []);
      if (remaining.length === 0) await rmdir(buildRoot).catch(() => undefined);
    }
  });
}

export async function inspectResearchIndex(
  databaseRoot: string,
  researchDatabaseId: string,
  sources: ReadonlyArray<Pick<ResearchSourceDocument, "source" | "revision">> = [],
): Promise<ResearchIndexState> {
  const databasePath = researchIndexDatabasePath(databaseRoot);
  try {
    await stat(databasePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return ResearchIndexStateSchema.parse({
        researchDatabaseId,
        status: "missing",
        indexedSourceCount: 0,
        indexedChunkCount: 0,
        reason: "Research index has not been built",
      });
    }
    throw error;
  }
  let database: Database.Database | undefined;
  let deepValidationPassed = false;
  try {
    const signature = await researchIndexArtifactSignature(databasePath);
    database = openResearchIndex(databasePath, researchDatabaseId, false, "", false);
    if (validatedResearchIndexSignatures.get(databasePath) !== signature) {
      validateReadyResearchIndex(database, researchDatabaseId);
      deepValidationPassed = true;
    }
    const indexedSourceCount = (database.prepare("SELECT count(*) AS count FROM source_ledger").get() as { count: number }).count;
    const indexedChunkCount = (database.prepare("SELECT count(*) AS count FROM reference_chunks").get() as { count: number }).count;
    if (sources.length > 0) {
      const expected = new Map(
        sources
          .filter((detail) => detail.source.schemaVersion === 3)
          .map((detail) => [detail.source.id, detail.revision]),
      );
      const actualRows = database.prepare("SELECT source_id, source_revision FROM source_ledger").all() as
        Array<{ source_id: string; source_revision: string }>;
      const actual = new Map(actualRows.map((row) => [row.source_id, row.source_revision]));
      const stale = expected.size !== actual.size
        || [...expected].some(([sourceId, revision]) => actual.get(sourceId) !== revision);
      if (stale) {
        return ResearchIndexStateSchema.parse({
          researchDatabaseId,
          status: "stale",
          indexedSourceCount,
          indexedChunkCount,
          reason: "Research index does not match current Source revisions",
        });
      }
    }
    return ResearchIndexStateSchema.parse({
      researchDatabaseId,
      status: "ready",
      indexedSourceCount,
      indexedChunkCount,
      reason: null,
    });
  } catch (error) {
    return ResearchIndexStateSchema.parse({
      researchDatabaseId,
      status: "damaged",
      indexedSourceCount: 0,
      indexedChunkCount: 0,
      reason: error instanceof Error ? error.message : "Research index is damaged",
    });
  } finally {
    database?.close();
    if (deepValidationPassed) {
      validatedResearchIndexSignatures.set(databasePath, await researchIndexArtifactSignature(databasePath));
    }
  }
}

function ftsLiteral(value: string): string {
  return `"${value.replace(/"/gu, "\"\"")}"`;
}

function queryWords(query: string): string[] {
  return [...new Set(query.match(/[\p{L}\p{N}]+/gu) ?? [])];
}

function searchChannels(query: string): Array<{
  table: "reference_fts_cjk" | "reference_fts_word";
  channel: "keyword-cjk" | "keyword-word";
  expression: string;
  weight: number;
}> {
  const channels: Array<{
    table: "reference_fts_cjk" | "reference_fts_word";
    channel: "keyword-cjk" | "keyword-word";
    expression: string;
    weight: number;
  }> = [];
  if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(query) && query.length >= 3) {
    channels.push({ table: "reference_fts_cjk", channel: "keyword-cjk", expression: ftsLiteral(query), weight: 1.2 });
  }
  const words = queryWords(query);
  if (words.length > 0) {
    channels.push({
      table: "reference_fts_word",
      channel: "keyword-word",
      expression: words.map(ftsLiteral).join(" AND "),
      weight: 1,
    });
    if (words.length > 1) {
      channels.push({
        table: "reference_fts_word",
        channel: "keyword-word",
        expression: words.map(ftsLiteral).join(" OR "),
        weight: 0.35,
      });
    }
  }
  return channels;
}

function queryWordMatch(text: string, query: string): { matched: number; total: number; coverage: number } {
  const normalizedText = text.toLocaleLowerCase("und");
  const words = queryWords(query).map((word) => word.toLocaleLowerCase("und"));
  if (words.length === 0) return { matched: 0, total: 0, coverage: 0 };
  const matched = words.filter((word) => normalizedText.includes(word)).length;
  return { matched, total: words.length, coverage: matched / words.length };
}

interface IndexedLanguageSpan {
  start_offset: number;
  end_offset: number;
  language_tag: string;
}

function escapedRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function findMatchRange(text: string, query: string): { start: number; end: number } | null {
  const candidates = [query, ...(query.match(/[\p{L}\p{N}]+/gu) ?? [])]
    .filter((candidate, index, values) => candidate.length > 0 && values.indexOf(candidate) === index);
  for (const candidate of candidates) {
    const match = new RegExp(escapedRegularExpression(candidate), "iu").exec(text);
    if (match) return { start: match.index, end: match.index + match[0].length };
  }
  return null;
}

function languageTagMatches(actual: string, requested: string): boolean {
  return actual.toLocaleLowerCase("und").startsWith(requested.toLocaleLowerCase("und"));
}

function languageTagForMatch(
  spans: IndexedLanguageSpan[],
  match: { start: number; end: number } | null,
  fallback: string,
): string {
  if (!match) return fallback;
  return spans.find((span) => span.start_offset < match.end && span.end_offset > match.start)?.language_tag ?? fallback;
}

function indexedLanguageSpan(row: Record<string, unknown>): IndexedLanguageSpan {
  if (
    typeof row.start_offset !== "number"
    || typeof row.end_offset !== "number"
    || typeof row.language_tag !== "string"
  ) {
    throw new StorageError("Research index contains an invalid language span", "INVALID_DATA");
  }
  return {
    start_offset: row.start_offset,
    end_offset: row.end_offset,
    language_tag: row.language_tag,
  };
}

function candidateFilter(
  input: ResearchKeywordSearchInput,
  chunkAlias: string,
): { sql: string; parameters: Array<string> } {
  const clauses: string[] = [];
  const parameters: string[] = [];
  if (input.purpose === "model-context") {
    clauses.push(`${chunkAlias}.ai_permission = 'allowed'`);
  }
  if (input.sourceKinds?.length) {
    clauses.push(`${chunkAlias}.source_kind IN (${input.sourceKinds.map(() => "?").join(", ")})`);
    parameters.push(...input.sourceKinds);
  }
  if (input.languageTags?.length) {
    clauses.push(`EXISTS (
      SELECT 1 FROM reference_language_spans AS candidate_language
      WHERE candidate_language.chunk_id = ${chunkAlias}.id
        AND (${input.languageTags.map(() => "lower(candidate_language.language_tag) LIKE lower(? || '%')").join(" OR ")})
    )`);
    parameters.push(...input.languageTags);
  }
  for (const tag of input.tags ?? []) {
    clauses.push(`EXISTS (
      SELECT 1 FROM json_each(${chunkAlias}.source_tags_json) AS candidate_tag
      WHERE candidate_tag.value = ? COLLATE NOCASE
    )`);
    parameters.push(tag);
  }
  if (input.author) {
    clauses.push(`instr(lower(${chunkAlias}.source_author), lower(?)) > 0`);
    parameters.push(input.author);
  }
  return {
    sql: clauses.length > 0 ? ` AND ${clauses.join(" AND ")}` : "",
    parameters,
  };
}

export async function searchResearchIndex(
  databaseRoot: string,
  researchDatabaseId: string,
  rawInput: ResearchKeywordSearchInput,
): Promise<ResearchKeywordSearchResponse> {
  const input = ResearchKeywordSearchInputSchema.parse(rawInput);
  return withResearchIndexLane(databaseRoot, async () => {
    const state = await inspectResearchIndex(databaseRoot, researchDatabaseId);
    if (state.status !== "ready") {
      throw new StorageError(state.reason ?? "Research index is unavailable", "INVALID_DATA", {
        researchDatabaseId,
        status: state.status,
      });
    }
    const database = openResearchIndex(researchIndexDatabasePath(databaseRoot), researchDatabaseId, false, "", false);
    try {
      const scores = new Map<string, { score: number; channels: Set<"keyword-cjk" | "keyword-word" | "keyword-literal"> }>();
      const filters = candidateFilter(input, "candidate_chunk");
      for (const channel of searchChannels(input.query)) {
        const candidateSource = filters.sql
          ? `FROM ${channel.table}
             JOIN reference_chunks AS candidate_chunk ON candidate_chunk.id = ${channel.table}.chunk_id
             WHERE ${channel.table} MATCH ?${filters.sql}`
          : `FROM ${channel.table} WHERE ${channel.table} MATCH ?`;
        const rows = database.prepare(
          `SELECT ${channel.table}.chunk_id, bm25(${channel.table}) AS score
           ${candidateSource}
           ORDER BY score, ${channel.table}.chunk_id LIMIT 500`,
        ).all(channel.expression, ...filters.parameters) as Array<{ chunk_id: string; score: number }>;
        for (const row of rows) {
          const existing = scores.get(row.chunk_id) ?? { score: 0, channels: new Set() };
          existing.score += -row.score * channel.weight;
          existing.channels.add(channel.channel);
          scores.set(row.chunk_id, existing);
        }
      }
      const literalRows = database.prepare(
        `SELECT candidate_chunk.id FROM reference_chunks AS candidate_chunk
         WHERE instr(lower(candidate_chunk.text), lower(?)) > 0${filters.sql}
         ORDER BY candidate_chunk.id LIMIT 500`,
      ).all(input.query, ...filters.parameters) as Array<{ id: string }>;
      for (const row of literalRows) {
        const existing = scores.get(row.id) ?? { score: 0, channels: new Set() };
        existing.score += 1;
        existing.channels.add("keyword-literal");
        scores.set(row.id, existing);
      }
      const cjkTerms = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(input.query)
        ? queryWords(input.query).slice(0, 24)
        : [];
      if (cjkTerms.length > 1) {
        const cjkTermRows = database.prepare(
          `SELECT candidate_chunk.id FROM reference_chunks AS candidate_chunk
           WHERE (${cjkTerms
            .map(() => "instr(lower(candidate_chunk.text), lower(?)) > 0")
            .join(" OR ")})${filters.sql}
           ORDER BY candidate_chunk.id LIMIT 500`,
        ).all(...cjkTerms, ...filters.parameters) as Array<{ id: string }>;
        for (const row of cjkTermRows) {
          const existing = scores.get(row.id) ?? { score: 0, channels: new Set() };
          existing.score += 0.2;
          existing.channels.add("keyword-literal");
          scores.set(row.id, existing);
        }
      }

      const getChunk = database.prepare(
        `SELECT reference_chunks.*, reference_blocks.position AS block_position
         FROM reference_chunks
         JOIN reference_blocks ON reference_blocks.id = reference_chunks.block_id
         WHERE reference_chunks.id = ?`,
      );
      const getLanguageSpans = database.prepare(
        `SELECT start_offset, end_offset, language_tag FROM reference_language_spans
         WHERE chunk_id = ? ORDER BY position`,
      );
      const results = [...scores.entries()].flatMap(([chunkId, match]) => {
        const row = getChunk.get(chunkId) as {
          id: string;
          source_id: string;
          block_id: string;
          block_position: number;
          text: string;
          text_hash: string;
          location_json: string;
          language_tag: string;
          source_revision: string;
          source_display_name: string;
          source_kind: string;
          source_author: string;
          source_tags_json: string;
          ai_permission: "never" | "allowed";
        } | undefined;
        if (!row) return [];
        const tags = JSON.parse(row.source_tags_json) as string[];
        const languageSpans = getLanguageSpans.all(row.id).map(indexedLanguageSpan);
        const indexedLanguageTags = languageSpans.length > 0
          ? languageSpans.map((span) => span.language_tag)
          : [row.language_tag];
        if (input.purpose === "model-context" && row.ai_permission === "never") return [];
        if (input.sourceKinds && !input.sourceKinds.includes(row.source_kind as ResearchSourceKind)) return [];
        if (input.languageTags && !input.languageTags.some((requested) =>
          indexedLanguageTags.some((actual) => languageTagMatches(actual, requested)))) return [];
        if (input.tags && !input.tags.every((tag) => tags.some((actual) => actual.toLocaleLowerCase("und") === tag.toLocaleLowerCase("und")))) return [];
        if (input.author && !row.source_author.toLocaleLowerCase("und").includes(input.author.toLocaleLowerCase("und"))) return [];
        const wordMatch = queryWordMatch(row.text, input.query);
        if (wordMatch.total > 1 && (wordMatch.matched < 2 || wordMatch.coverage < 0.5)) return [];
        const matchRange = findMatchRange(row.text, input.query);
        return [{
          researchDatabaseId,
          sourceId: row.source_id,
          sourceRevision: row.source_revision,
          sourceDisplayName: row.source_display_name,
          sourceKind: row.source_kind,
          chunkId: row.id,
          blockId: row.block_id,
          blockOrder: row.block_position,
          chunkHash: row.text_hash,
          originalText: row.text,
          languageTag: languageTagForMatch(languageSpans, matchRange, row.language_tag),
          location: JSON.parse(row.location_json),
          matchChannels: [...match.channels].sort(),
          score: match.score + wordMatch.coverage,
        }];
      }).sort((left, right) => right.score - left.score || left.sourceDisplayName.localeCompare(right.sourceDisplayName))
        .slice(0, input.limit);
      return ResearchKeywordSearchResponseSchema.parse({
        researchDatabaseId,
        query: input.query,
        results,
      });
    } finally {
      database.close();
    }
  });
}
