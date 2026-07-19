import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  RESEARCH_TOOL_DEFAULT_LIMITS,
  type ModelCallLog,
  type ResearchToolAuditCitation,
  type ResearchToolAuditEvent,
} from "@novel-studio/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectRepository, StorageError } from "../src/index.js";
import { workshopSessionPath } from "../src/workshopFiles.js";

const temporaryDirectories: string[] = [];
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

async function repository(): Promise<ProjectRepository> {
  const root = await mkdtemp(path.join(tmpdir(), "novel-studio-workshop-research-"));
  temporaryDirectories.push(root);
  return new ProjectRepository(root);
}

function seriesRoot(store: ProjectRepository, title: string, seriesId: string): string {
  return path.join(store.libraryRoot, `${title}-${seriesId.slice(0, 8)}`);
}

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function modelCall(seriesId: string, sceneId: string, id = randomUUID()): ModelCallLog {
  return {
    schemaVersion: 2,
    id,
    seriesId,
    sceneId,
    roleId: "workshop-research-test",
    taskKind: "research",
    provider: "mock",
    model: "scripted-research",
    contextBundleId: randomUUID(),
    promptTemplateId: randomUUID(),
    promptTemplateVersion: 1,
    requestHash: hash("Workshop Research request"),
    resolvedParameters: {},
    responseHash: null,
    status: "streaming",
    estimatedUsage: { inputTokens: 20, outputTokens: 20, totalTokens: 40 },
    actualUsage: null,
    errorCode: null,
    errorMessage: null,
    error: null,
    startedAt: "2026-07-19T00:00:00.000Z",
    completedAt: null,
  };
}

function citation(databaseId: string): ResearchToolAuditCitation {
  return {
    researchDatabaseId: databaseId,
    researchDatabaseName: "Reference library",
    sourceId: "11111111-1111-4111-8111-111111111111",
    sourceRevision: HASH_A,
    sourceDisplayName: "Japanese notes",
    sourceKind: "txt",
    chunkId: "22222222-2222-4222-8222-222222222222",
    blockId: "33333333-3333-4333-8333-333333333333",
    chunkHash: HASH_B,
    languageTag: "ja",
    location: { kind: "text", startLine: 4, endLine: 5, startOffset: 10, endOffset: 120 },
    relationship: "target",
    matchChannels: ["semantic"],
    fusedScore: 0.82,
  };
}

function auditEvent(
  seriesId: string,
  modelCallId: string,
  databaseId: string,
): ResearchToolAuditEvent {
  return {
    schemaVersion: 1,
    id: randomUUID(),
    seriesId,
    modelCallId,
    sequence: 1,
    tool: "research.search",
    status: "succeeded",
    argumentHash: HASH_A,
    argumentCharacterCount: 20,
    argumentSummary: {
      requestedDatabaseIds: [databaseId],
      sourceId: null,
      chunkId: null,
      queryHash: HASH_B,
      queryCharacterCount: 8,
      cursorProvided: false,
    },
    resultKeys: [`${databaseId}:result`],
    citations: [citation(databaseId)],
    outputCharacterCount: 300,
    outputTokenEstimate: 150,
    madeProgress: true,
    budgetAfter: {
      limits: RESEARCH_TOOL_DEFAULT_LIMITS,
      usedToolCalls: 1,
      usedCharacters: 300,
      usedTokenEstimate: 150,
      consecutiveNoProgress: 0,
      remainingToolCalls: RESEARCH_TOOL_DEFAULT_LIMITS.maxToolCalls - 1,
      remainingCharacters: RESEARCH_TOOL_DEFAULT_LIMITS.cumulativeCharacterBudget - 300,
      remainingTokenEstimate: RESEARCH_TOOL_DEFAULT_LIMITS.cumulativeTokenEstimateBudget - 150,
      exhaustedReason: null,
    },
    errorCode: null,
    startedAt: "2026-07-19T00:00:01.000Z",
    completedAt: "2026-07-19T00:00:01.100Z",
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true })));
});

describe("NS-607 Workshop Research activation storage", () => {
  it("migrates all prior sessions to empty version 3 authority and restores exact bytes", async () => {
    const store = await repository();
    const title = "WorkshopResearchMigration";
    const series = await store.createSeries({ title });
    const session = await store.createWorkshopSession(series.manifest.id, { title: "Legacy" });
    const root = seriesRoot(store, title, series.manifest.id);
    const sessionPath = workshopSessionPath(root, session.id);
    const legacyRaw = `${JSON.stringify({
      schemaVersion: 2,
      id: session.id,
      seriesId: series.manifest.id,
      kind: "chat",
      generalChatSystemPrompt: "Visible prompt",
      title: "Legacy",
      status: "active",
      branchOfMessageId: null,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      archivedAt: null,
      lastMessageAt: null,
    }, null, 2)}\n`;
    await writeFile(sessionPath, legacyRaw, "utf8");

    const migration = await store.migrateWorkshopSessionsToV3(series.manifest.id);
    expect(migration.migratedSessionIds).toEqual([session.id]);
    expect(JSON.parse(await readFile(sessionPath, "utf8"))).toMatchObject({
      schemaVersion: 3,
      activeResearchDatabaseIds: [],
      generalChatSystemPrompt: "Visible prompt",
    });

    expect((await store.rollbackWorkshopSessionsV3Migration(
      series.manifest.id,
      migration.migrationId,
    )).restoredSessionIds).toEqual([session.id]);
    expect(await readFile(sessionPath, "utf8")).toBe(legacyRaw);

    const staleMigration = await store.migrateWorkshopSessionsToV3(series.manifest.id);
    await store.updateWorkshopSession(series.manifest.id, session.id, { title: "Changed" });
    await expect(store.rollbackWorkshopSessionsV3Migration(
      series.manifest.id,
      staleMigration.migrationId,
    )).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });
  });

  it("reports damaged sessions without hiding valid records and refuses partial migration", async () => {
    const store = await repository();
    const title = "WorkshopResearchDamage";
    const series = await store.createSeries({ title });
    const valid = await store.createWorkshopSession(series.manifest.id, { title: "Valid" });
    const root = seriesRoot(store, title, series.manifest.id);
    const validPath = workshopSessionPath(root, valid.id);
    const validRaw = await readFile(validPath, "utf8");
    const damagedPath = workshopSessionPath(root, randomUUID());
    await mkdir(path.dirname(damagedPath), { recursive: true });
    await writeFile(damagedPath, "{damaged-json\n", "utf8");

    const listed = await store.listWorkshopSessionsWithDiagnostics(series.manifest.id);
    expect(listed.sessions.map((session) => session.id)).toEqual([valid.id]);
    expect(listed.diagnostics).toHaveLength(1);
    await expect(store.migrateWorkshopSessionsToV3(series.manifest.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    expect(await readFile(validPath, "utf8")).toBe(validRaw);
  });

  it("validates global databases, keeps activation per session, and copies it on branch", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopResearchActivation" });
    const linked = await store.createResearchDatabase({ name: "Linked" });
    const unlinked = await store.createResearchDatabase({ name: "Unlinked" });
    await store.updateResearchDatabase(linked.database.id, {
      baseRevision: linked.revision,
      linkedSeriesIds: [series.manifest.id],
    });
    const first = await store.createWorkshopSession(series.manifest.id, { title: "First" });
    const second = await store.createWorkshopSession(series.manifest.id, { title: "Second" });

    const activated = await store.updateWorkshopSession(series.manifest.id, first.id, {
      activeResearchDatabaseIds: [unlinked.database.id, linked.database.id],
    });
    expect(activated.activeResearchDatabaseIds).toEqual([unlinked.database.id, linked.database.id]);
    expect((await store.getWorkshopSession(series.manifest.id, second.id)).activeResearchDatabaseIds).toEqual([]);
    await expect(store.updateWorkshopSession(series.manifest.id, second.id, {
      activeResearchDatabaseIds: [randomUUID()],
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "NOT_FOUND" });

    const author = await store.createWorkshopMessage(series.manifest.id, first.id, {
      role: "author",
      mode: "general-chat",
      content: "Compare these references.",
      attachmentIds: [],
      draftToken: null,
    });
    const branched = await store.branchWorkshopSession(series.manifest.id, first.id, {
      sourceMessageId: author.id,
      title: "Research branch",
    });
    expect(branched.session.activeResearchDatabaseIds).toEqual(activated.activeResearchDatabaseIds);
    await store.archiveWorkshopSession(series.manifest.id, branched.session.id);
    await expect(store.updateWorkshopSession(series.manifest.id, branched.session.id, {
      activeResearchDatabaseIds: [],
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
  });

  it("persists only audited evidence, clones it without an audit link, and deletes it with history", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopResearchEvidence" });
    const database = await store.createResearchDatabase({ name: "Evidence database" });
    const session = await store.createWorkshopSession(series.manifest.id, { title: "Evidence" });
    await store.updateWorkshopSession(series.manifest.id, session.id, {
      activeResearchDatabaseIds: [database.database.id],
    });
    await store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "general-chat",
      content: "Find the exact reference.",
      attachmentIds: [],
      draftToken: null,
    });
    const call = modelCall(series.manifest.id, series.scenes[0]!.metadata.id);
    await store.saveModelCallLog(series.manifest.id, call);
    const assistant = await store.saveWorkshopMessage(series.manifest.id, {
      schemaVersion: 2,
      id: randomUUID(),
      seriesId: series.manifest.id,
      sessionId: session.id,
      role: "assistant",
      mode: "general-chat",
      status: "succeeded",
      content: "The source supports this answer.",
      reasoningContent: "",
      reasoningOutputKind: "none",
      contextBundleId: null,
      modelCallId: call.id,
      proposalIds: [],
      attachmentIds: [],
      errorCode: null,
      errorMessage: null,
      createdAt: "2026-07-19T00:00:02.000Z",
    });
    await store.appendResearchToolAuditEvent(
      series.manifest.id,
      auditEvent(series.manifest.id, call.id, database.database.id),
    );
    const evidence = await store.createWorkshopResearchEvidence(series.manifest.id, session.id, {
      schemaVersion: 1,
      id: randomUUID(),
      seriesId: series.manifest.id,
      sessionId: session.id,
      assistantMessageId: assistant.id,
      modelCallId: call.id,
      copiedFromEvidenceId: null,
      citations: [citation(database.database.id)],
      createdAt: "2026-07-19T00:00:03.000Z",
    });
    expect(JSON.stringify(evidence)).not.toContain("originalText");

    const branched = await store.branchWorkshopSession(series.manifest.id, session.id, {
      sourceMessageId: assistant.id,
      title: "Evidence branch",
    });
    const branchEvidence = await store.listWorkshopResearchEvidence(
      series.manifest.id,
      branched.session.id,
    );
    expect(branchEvidence).toHaveLength(1);
    expect(branchEvidence[0]).toMatchObject({ modelCallId: null, copiedFromEvidenceId: evidence.id });

    await store.deleteWorkshopSession(series.manifest.id, session.id);
    expect(await store.listWorkshopResearchEvidence(series.manifest.id, branched.session.id)).toHaveLength(1);
    await store.restoreWorkshopSession(series.manifest.id, branched.session.id).catch(() => undefined);
    await store.deleteWorkshopSession(series.manifest.id, branched.session.id);
    await expect(store.getWorkshopResearchEvidence(
      series.manifest.id,
      branched.session.id,
      branchEvidence[0]!.assistantMessageId,
    )).rejects.toMatchObject<Partial<StorageError>>({ code: "NOT_FOUND" });
  });
});
