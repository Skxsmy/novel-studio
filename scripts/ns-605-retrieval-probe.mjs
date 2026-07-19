import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import Database from "better-sqlite3";
import { getLoadablePath, load as loadSqliteVec } from "sqlite-vec";
import {
  RESEARCH_VECTOR_EXTENSION_VERSION,
  RESEARCH_VECTOR_INDEX_APPLICATION_ID,
  RESEARCH_VECTOR_INDEX_SCHEMA_VERSION,
  deleteResearchVectorChunk,
  inspectResearchVectorIndex,
  rebuildResearchVectorIndexStreaming,
  researchVectorIndexDatabasePath,
  searchResearchVectorIndex,
} from "../packages/storage/dist/index.js";

const chunkCount = 4_096;
const dimensions = 384;
const batchSize = 128;
const databaseId = "10000000-0000-4000-8000-000000000605";
const profileId = "20000000-0000-4000-8000-000000000605";
const profileRevision = "a".repeat(64);
const capabilityRevision = "b".repeat(64);
const sourceRevision = "c".repeat(64);
const tempRoot = await mkdtemp(path.join(tmpdir(), "novel-studio-ns605-probe-"));
const databaseRoot = path.join(tempRoot, databaseId);
await mkdir(databaseRoot, { recursive: true });

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function vectorFor(index) {
  const vector = Array.from({ length: dimensions }, () => 0);
  vector[index % dimensions] = 1;
  return vector;
}

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
}

async function sizeOrZero(filePath) {
  return stat(filePath).then((value) => value.size, () => 0);
}

const chunks = Array.from({ length: chunkCount }, (_, index) => {
  const originalText = `Probe passage ${index}. 月影航路 and Moonshadow Route remain original citation text. ${"Measured author research evidence. ".repeat(24)}`;
  return {
    chunkId: `chunk-${String(index).padStart(6, "0")}`,
    sourceId: `source-${String(Math.floor(index / 64)).padStart(4, "0")}`,
    sourceRevision,
    sourceDisplayName: `Probe source ${Math.floor(index / 64)}`,
    sourceKind: "txt",
    sourceAuthor: "NS-605 probe",
    sourceTags: ["probe", index % 2 === 0 ? "even" : "odd"],
    aiPermission: "allowed",
    blockId: `block-${String(index).padStart(6, "0")}`,
    blockOrder: index,
    chunkHash: sha256(originalText),
    originalText,
    languageTag: index % 3 === 0 ? "zh-CN" : index % 3 === 1 ? "ja" : "en",
    location: { kind: "text", startLine: index + 1, endLine: index + 1, startOffset: 0, endOffset: originalText.length },
    embedding: [],
  };
});
const input = {
  researchDatabaseId: databaseId,
  profileId,
  profileRevision,
  dimensions,
  model: "ns605-deterministic-probe",
  normalize: true,
  documentPrefix: "passage: ",
  queryPrefix: "query: ",
  capabilityRevision,
  validationFixtureVersion: 1,
  chunks,
};

let maxObservedBatch = 0;
let peakRss = process.memoryUsage().rss;
const rssBefore = peakRss;
const started = performance.now();

try {
  const built = await rebuildResearchVectorIndexStreaming(databaseRoot, input, {
    batchSize,
    embedBatch: async (batch) => {
      maxObservedBatch = Math.max(maxObservedBatch, batch.length);
      const vectors = batch.map((chunk) => vectorFor(Number(chunk.chunkId.slice(-6))));
      peakRss = Math.max(peakRss, process.memoryUsage().rss);
      return vectors;
    },
  });
  const buildMilliseconds = performance.now() - started;
  if (built.status !== "ready" || built.indexedChunkCount !== chunkCount) {
    throw new Error(`Unexpected built index state: ${JSON.stringify(built)}`);
  }
  if (maxObservedBatch > batchSize) throw new Error(`Embedding batch exceeded ${batchSize}`);

  const queryVector = vectorFor(0);
  const queryDurations = [];
  let firstResults = [];
  for (let iteration = 0; iteration < 20; iteration += 1) {
    const queryStarted = performance.now();
    const results = await searchResearchVectorIndex(databaseRoot, databaseId, queryVector, 20);
    queryDurations.push(performance.now() - queryStarted);
    if (iteration === 0) firstResults = results;
  }
  const first = firstResults[0];
  if (!first || first.chunkHash !== sha256(first.originalText)) {
    throw new Error("Vector result did not preserve the original citation hash");
  }

  let limitRejected = false;
  try {
    await searchResearchVectorIndex(databaseRoot, databaseId, queryVector, 101);
  } catch {
    limitRejected = true;
  }
  if (!limitRejected) throw new Error("Vector query accepted an unbounded result limit");

  if (!await deleteResearchVectorChunk(databaseRoot, databaseId, first.chunkId)) {
    throw new Error("Expected vector chunk deletion to succeed");
  }
  const afterDelete = await searchResearchVectorIndex(databaseRoot, databaseId, queryVector, 100);
  if (afterDelete.some((result) => result.chunkId === first.chunkId)) {
    throw new Error("Deleted vector chunk remained searchable");
  }

  const indexPath = researchVectorIndexDatabasePath(databaseRoot);
  const hashBeforeCancel = sha256(await readFile(indexPath));
  const controller = new AbortController();
  let cancellationObserved = false;
  try {
    await rebuildResearchVectorIndexStreaming(databaseRoot, { ...input, profileRevision: "d".repeat(64) }, {
      batchSize,
      signal: controller.signal,
      embedBatch: async (batch) => {
        controller.abort();
        return batch.map((chunk) => vectorFor(Number(chunk.chunkId.slice(-6))));
      },
    });
  } catch (error) {
    cancellationObserved = error instanceof Error && error.name === "AbortError";
  }
  if (!cancellationObserved || sha256(await readFile(indexPath)) !== hashBeforeCancel) {
    throw new Error("Cancelled rebuild did not preserve the live sidecar byte-for-byte");
  }

  let rebuildEmbeddedChunks = 0;
  await rebuildResearchVectorIndexStreaming(databaseRoot, input, {
    batchSize,
    embedBatch: async (batch) => {
      rebuildEmbeddedChunks += batch.length;
      return batch.map((chunk) => vectorFor(Number(chunk.chunkId.slice(-6))));
    },
  });
  const rebuilt = await inspectResearchVectorIndex(databaseRoot, databaseId, input);
  if (rebuilt.status !== "ready" || rebuilt.indexedChunkCount !== chunkCount) {
    throw new Error(`Unexpected rebuilt index state: ${JSON.stringify(rebuilt)}`);
  }
  if (rebuildEmbeddedChunks !== 1) {
    throw new Error(`Incremental rebuild embedded ${rebuildEmbeddedChunks} Chunks instead of the one deleted Chunk`);
  }

  const sqlite = new Database(indexPath, { readonly: true });
  loadSqliteVec(sqlite);
  const extensionVersion = sqlite.prepare("select vec_version() as version").get().version;
  const applicationId = sqlite.pragma("application_id", { simple: true });
  const schemaVersion = sqlite.pragma("user_version", { simple: true });
  sqlite.close();
  if (extensionVersion !== RESEARCH_VECTOR_EXTENSION_VERSION) throw new Error(`Unexpected sqlite-vec ${extensionVersion}`);
  if (applicationId !== RESEARCH_VECTOR_INDEX_APPLICATION_ID) throw new Error(`Unexpected application_id ${applicationId}`);
  if (schemaVersion !== RESEARCH_VECTOR_INDEX_SCHEMA_VERSION) throw new Error(`Unexpected user_version ${schemaVersion}`);

  const extensionPath = path.resolve(getLoadablePath());
  const metrics = {
    corpus: {
      chunks: chunkCount,
      dimensions,
      originalTextBytes: chunks.reduce((total, chunk) => total + Buffer.byteLength(chunk.originalText, "utf8"), 0),
    },
    batching: { configured: batchSize, maximumObserved: maxObservedBatch },
    buildMilliseconds: Number(buildMilliseconds.toFixed(2)),
    queryMilliseconds: {
      minimum: Number(Math.min(...queryDurations).toFixed(2)),
      median: Number(percentile(queryDurations, 0.5).toFixed(2)),
      p95: Number(percentile(queryDurations, 0.95).toFixed(2)),
      maximum: Number(Math.max(...queryDurations).toFixed(2)),
    },
    memory: {
      rssBeforeBytes: rssBefore,
      peakRssBytes: peakRss,
      measuredPeakIncreaseBytes: Math.max(0, peakRss - rssBefore),
    },
    disk: {
      sidecarBytes: await sizeOrZero(indexPath),
      walBytesAfterClose: await sizeOrZero(`${indexPath}-wal`),
      shmBytesAfterClose: await sizeOrZero(`${indexPath}-shm`),
    },
    identity: {
      applicationId,
      schemaVersion,
      extensionVersion,
      extensionPath,
      extensionFileName: path.basename(extensionPath),
      profileId: rebuilt.profileId,
      profileRevision: rebuilt.profileRevision,
    },
    lifecycle: {
      citationHashPreserved: true,
      boundedLimitRejected: limitRejected,
      deleteRemovedResult: true,
      cancellationPreservedLiveBytes: cancellationObserved,
      incrementalReembeddedChunks: rebuildEmbeddedChunks,
      rebuildRestoredChunkCount: rebuilt.indexedChunkCount,
    },
  };
  process.stdout.write(`${JSON.stringify(metrics, null, 2)}\n`);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
