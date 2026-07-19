import { createHash } from "node:crypto";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { arch, cpus, platform, release, totalmem } from "node:os";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { buildApp } from "../apps/server/dist/app.js";
import {
  researchDatabaseRoot,
  researchIndexDatabasePath,
} from "../packages/storage/dist/index.js";

const targetBytes = 25 * 1024 * 1024;
const expectedBlocks = 1_639;
const expectedChunks = 22_938;
const markerCount = 20;
const importTargetMilliseconds = 20_000;
const responseTargetBytes = 16 * 1024;
const queryP95TargetMilliseconds = 250;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
}

function hardwareSummary() {
  const processors = cpus();
  return {
    platform: platform(),
    release: release(),
    architecture: arch(),
    cpuModel: processors[0]?.model.trim() ?? "unknown",
    logicalCpuCount: processors.length,
    totalMemoryBytes: totalmem(),
    nodeVersion: process.version,
  };
}

function createCorpus() {
  const markers = Array.from(
    { length: markerCount },
    (_, index) => `NS608_EXACT_MARKER_${String(index + 1).padStart(2, "0")}`,
  );
  const parts = [];
  let cursor = 0;
  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index];
    const position = index === markers.length - 1
      ? targetBytes - marker.length
      : Math.floor((targetBytes * (index + 1)) / (markers.length + 1));
    if (position < cursor) throw new Error("Exact-performance marker positions overlap");
    parts.push("A".repeat(position - cursor), marker);
    cursor = position + marker.length;
  }
  parts.push("A".repeat(targetBytes - cursor));
  const text = parts.join("");
  if (Buffer.byteLength(text, "utf8") !== targetBytes) {
    throw new Error("Exact-performance corpus is not exactly 25 MiB");
  }
  return { markers, text };
}

async function sizeOrZero(filePath) {
  return stat(filePath).then((value) => value.size, () => 0);
}

const tempRoot = await mkdtemp(path.join(tmpdir(), "novel-studio-ns608-exact-"));
let app = null;
try {
  app = await buildApp({
    libraryRoot: tempRoot,
    logger: false,
    version: "0.1.0-ns608-performance",
    commit: "ns608-exact-performance",
  });
  const created = await app.inject({
    method: "POST",
    url: "/api/v1/research/databases",
    payload: { name: "NS-608 exact performance database" },
  });
  if (created.statusCode !== 201) throw new Error(`Database creation returned ${created.statusCode}`);
  const databaseId = created.json().database.id;
  const root = `/api/v1/research/databases/${databaseId}`;
  const { markers, text } = createCorpus();
  const originalBytes = Buffer.from(text, "utf8");
  const originalHash = sha256(originalBytes);
  const importStarted = performance.now();
  const imported = await app.inject({
    method: "POST",
    url: `${root}/sources`,
    payload: {
      fileName: "ns608-25mib-exact.txt",
      mediaType: "text/plain",
      sizeBytes: originalBytes.byteLength,
      contentBase64: originalBytes.toString("base64"),
      displayName: "NS-608 25 MiB exact fixture",
      declaredLanguage: "en",
      aiPermission: "allowed",
    },
  });
  const importMilliseconds = performance.now() - importStarted;
  if (imported.statusCode !== 201) throw new Error(`25 MiB import returned ${imported.statusCode}`);
  const importResponseBytes = Buffer.byteLength(imported.payload, "utf8");
  const source = imported.json();
  const sourceId = source.source.id;
  const blockCount = source.contentSummary.blockCount;
  const chunkCount = source.contentSummary.chunkCount;

  const queryDurations = [];
  let allMarkersFound = true;
  let finalMarkerIdentity = false;
  for (const marker of markers) {
    const queryStarted = performance.now();
    const response = await app.inject({
      method: "POST",
      url: `${root}/search`,
      payload: { query: marker, purpose: "local", mode: "exact", limit: 3 },
    });
    queryDurations.push(performance.now() - queryStarted);
    if (response.statusCode !== 200) throw new Error(`Exact query returned ${response.statusCode}`);
    const result = response.json().results[0];
    const exact = Boolean(
      result &&
      result.sourceId === sourceId &&
      result.originalText.includes(marker) &&
      result.chunkHash === sha256(result.originalText),
    );
    allMarkersFound &&= exact;
    if (marker === markers.at(-1)) finalMarkerIdentity = exact;
  }

  const indexState = (await app.inject({ method: "GET", url: `${root}/index` })).json();
  const databaseRoot = researchDatabaseRoot(tempRoot, databaseId);
  const indexPath = researchIndexDatabasePath(databaseRoot);
  const queryP95 = percentile(queryDurations, 0.95);
  const checks = {
    exactInputSize: originalBytes.byteLength === targetBytes,
    originalHashPreserved: source.source.contentHash === originalHash,
    expectedBlockCount: blockCount === expectedBlocks,
    expectedChunkCount: chunkCount === expectedChunks,
    finalMarkerIdentity,
    allMarkersFound,
    indexReady: indexState.status === "ready" && indexState.indexedChunkCount === expectedChunks,
    importWithinTarget: importMilliseconds < importTargetMilliseconds,
    responseWithinTarget: importResponseBytes < responseTargetBytes,
    queryP95WithinTarget: queryP95 < queryP95TargetMilliseconds,
  };
  const summary = {
    schemaVersion: 1,
    passed: Object.values(checks).every(Boolean),
    hardware: hardwareSummary(),
    corpus: {
      bytes: originalBytes.byteLength,
      blocks: blockCount,
      chunks: chunkCount,
      markers: markers.length,
    },
    timingMilliseconds: {
      import: Number(importMilliseconds.toFixed(2)),
      queryMinimum: Number(Math.min(...queryDurations).toFixed(2)),
      queryMedian: Number(percentile(queryDurations, 0.5).toFixed(2)),
      queryP95: Number(queryP95.toFixed(2)),
      queryMaximum: Number(Math.max(...queryDurations).toFixed(2)),
    },
    response: { importBytes: importResponseBytes },
    disk: {
      exactIndexBytes: await sizeOrZero(indexPath),
      walBytes: await sizeOrZero(`${indexPath}-wal`),
      shmBytes: await sizeOrZero(`${indexPath}-shm`),
    },
    targets: {
      importMilliseconds: importTargetMilliseconds,
      importResponseBytes: responseTargetBytes,
      queryP95Milliseconds: queryP95TargetMilliseconds,
    },
    checks,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (!summary.passed) process.exitCode = 1;
} finally {
  if (app) await app.close();
  await rm(tempRoot, { recursive: true, force: true });
}
