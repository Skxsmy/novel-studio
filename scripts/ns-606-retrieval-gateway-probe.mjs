import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { EmbeddingRouter } from "@novel-studio/ai";
import {
  ResearchSourcePropertiesSchema,
} from "@novel-studio/contracts";
import {
  ProjectRepository,
  researchDatabaseRoot,
  researchToolAuditLaneRoot,
} from "@novel-studio/storage";
import {
  createResearchToolGateway,
  researchRetrievalToolDefinitions,
} from "../apps/server/dist/researchToolGateway.js";
import { parseResearchFile } from "../apps/server/dist/researchParsers.js";

const HASH = "a".repeat(64);
const root = await mkdtemp(path.join(tmpdir(), "novel-studio-ns-606-probe-"));

async function findSeriesRoot(repository, seriesId) {
  const suffix = `-${seriesId.slice(0, 8)}`;
  const entries = await readdir(repository.libraryRoot, { withFileTypes: true });
  const entry = entries.find((candidate) => candidate.isDirectory() && candidate.name.endsWith(suffix));
  assert(entry, "Series authority root must exist");
  return path.join(repository.libraryRoot, entry.name);
}

async function importText(repository, databaseId, fileName, text, aiPermission) {
  const bytes = Buffer.from(text, "utf8");
  const imported = await parseResearchFile({
    contentBase64: bytes.toString("base64"),
    fileName,
    mediaType: "text/plain",
    sizeBytes: bytes.byteLength,
  });
  return repository.importResearchSource(databaseId, {
    kind: imported.parsed.kind,
    mediaType: "text/plain",
    originalFileName: fileName,
    originalBytes: imported.bytes,
    sizeBytes: imported.bytes.byteLength,
    contentHash: imported.contentHash,
    properties: ResearchSourcePropertiesSchema.parse({
      displayName: fileName,
      declaredLanguage: "en",
      aiPermission,
    }),
    origin: { type: "file" },
    content: {
      title: imported.parsed.title,
      parserName: imported.parsed.parserName,
      parserVersion: imported.parsed.parserVersion,
      warnings: imported.parsed.warnings,
      sections: imported.parsed.sections,
      blocks: imported.parsed.blocks,
    },
  });
}

function toolCall(name, value) {
  return { id: randomUUID(), name, arguments: JSON.stringify(value) };
}

function outputCharacters(value) {
  return Array.from(JSON.stringify(value)).length;
}

async function authorityTreeHash(databaseRoot) {
  const digest = createHash("sha256");
  async function visit(directory, relativeDirectory = "") {
    const entries = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.name !== ".studio")
      .sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const relativePath = path.posix.join(relativeDirectory, entry.name);
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath, relativePath);
      } else if (entry.isFile()) {
        digest.update(relativePath, "utf8");
        digest.update("\0", "utf8");
        digest.update(await readFile(absolutePath));
        digest.update("\0", "utf8");
      } else {
        assert.fail(`Unexpected authority entry: ${relativePath}`);
      }
    }
  }
  await visit(databaseRoot);
  return digest.digest("hex");
}

try {
  const repository = new ProjectRepository(root);
  await repository.initialize();
  const series = await repository.createSeries({ title: "NS-606 probe" });
  const modelCallId = randomUUID();
  await repository.saveModelCallLog(series.manifest.id, {
    schemaVersion: 2,
    id: modelCallId,
    seriesId: series.manifest.id,
    sceneId: series.scenes[0].metadata.id,
    roleId: "role-ns-606-probe",
    taskKind: "research",
    provider: "mock",
    model: "probe-model",
    contextBundleId: randomUUID(),
    promptTemplateId: randomUUID(),
    promptTemplateVersion: 1,
    requestHash: HASH,
    resolvedParameters: {},
    responseHash: null,
    status: "streaming",
    estimatedUsage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
    actualUsage: null,
    errorCode: null,
    errorMessage: null,
    error: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
  });
  const database = await repository.createResearchDatabase({ name: "Probe evidence" });
  const publicMarker = "NS606_PUBLIC_MIDDLE_EVIDENCE";
  const privateMarker = "NS606_PRIVATE_EVIDENCE_MUST_NOT_LEAK";
  await importText(
    repository,
    database.database.id,
    "public.txt",
    `Opening context.\n\n${publicMarker} for the author.\n\nClosing context.`,
    "allowed",
  );
  await importText(
    repository,
    database.database.id,
    "private.txt",
    `${privateMarker}.`,
    "never",
  );
  for (let index = 1; index <= 12; index += 1) {
    await importText(
      repository,
      database.database.id,
      `auxiliary-${index.toString().padStart(2, "0")}.txt`,
      `Auxiliary permitted source ${index}.`,
      "allowed",
    );
  }
  const databaseRoot = researchDatabaseRoot(repository.libraryRoot, database.database.id);
  const authorityBefore = await authorityTreeHash(databaseRoot);

  assert.equal(researchRetrievalToolDefinitions(false).length, 0);
  assert.deepEqual(
    researchRetrievalToolDefinitions(true).map((definition) => definition.name),
    ["research.list_sources", "research.search", "research.open_passage"],
  );
  const gatewayInput = {
    repository,
    embeddingRouter: new EmbeddingRouter(),
    seriesId: series.manifest.id,
    modelCallId,
    activeDatabaseIds: [database.database.id],
  };
  const gateway = await createResearchToolGateway(gatewayInput);
  const search = await gateway.execute(toolCall("research.search", {
    query: publicMarker,
    mode: "exact",
  }));
  assert.equal(search.ok, true);
  assert.equal(search.tool, "research.search");
  assert(search.results.length > 0);
  assert(search.results.length <= 6);
  assert(!JSON.stringify(search).includes(privateMarker));
  const citation = search.results[0];
  const opened = await gateway.execute(toolCall("research.open_passage", {
    databaseId: citation.researchDatabaseId,
    sourceId: citation.sourceId,
    chunkId: citation.chunkId,
    sourceRevision: citation.sourceRevision,
    chunkHash: citation.chunkHash,
  }));
  assert.equal(opened.ok, true);
  assert.equal(opened.tool, "research.open_passage");
  assert(opened.passages.length <= 3);
  assert(opened.passages.some((passage) => passage.originalText.includes(publicMarker)));
  const listed = await gateway.execute(toolCall("research.list_sources", {
    databaseId: database.database.id,
  }));
  assert.equal(listed.ok, true);
  assert.equal(listed.tool, "research.list_sources");
  assert.equal(listed.sources.length, 12);
  assert.equal(typeof listed.nextCursor, "string");
  assert(!listed.sources.some((source) => source.displayName === "private.txt"));
  const measuredOutputCharacters = {
    search: outputCharacters(search),
    openPassage: outputCharacters(opened),
    listSources: outputCharacters(listed),
  };
  assert(Object.values(measuredOutputCharacters).every((count) => count <= 16_000));

  const restarted = await createResearchToolGateway(gatewayInput);
  const restoredBudget = await restarted.getBudgetState();
  assert.equal(restoredBudget.usedToolCalls, 3);
  const audits = await repository.listResearchToolAuditEvents(series.manifest.id, modelCallId);
  assert.deepEqual(audits.map((event) => event.sequence), [1, 2, 3]);
  const seriesRoot = await findSeriesRoot(repository, series.manifest.id);
  const lane = researchToolAuditLaneRoot(seriesRoot, modelCallId);
  const auditFiles = await readdir(lane);
  const auditRaw = (await Promise.all(auditFiles.map((fileName) =>
    readFile(path.join(lane, fileName), "utf8")))).join("\n");
  assert(!auditRaw.includes(publicMarker));
  assert(!auditRaw.includes(privateMarker));
  assert(!auditRaw.includes("originalText"));
  assert(!auditRaw.includes("queryText"));
  const authorityAfter = await authorityTreeHash(databaseRoot);
  assert.equal(authorityAfter, authorityBefore);

  process.stdout.write(`${JSON.stringify({
    ok: true,
    toolDefinitions: 3,
    searchResults: search.results.length,
    openedPassages: opened.passages.length,
    permittedSourcesListed: listed.sources.length,
    listHasNextCursor: true,
    auditEvents: audits.length,
    restoredUsedToolCalls: restoredBudget.usedToolCalls,
    measuredOutputCharacters,
    researchAuthorityUnchanged: authorityBefore === authorityAfter,
    privateTextLeaked: false,
  }, null, 2)}\n`);
} finally {
  await rm(root, { recursive: true, force: true });
}
