import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  RESEARCH_TOOL_DEFAULT_LIMITS,
  type ModelCallLog,
  type ResearchToolAuditEvent,
} from "@novel-studio/contracts";
import { afterEach, describe, expect, it } from "vitest";
import {
  ProjectRepository,
  StorageError,
  researchToolAuditLaneRoot,
} from "../src/index.js";

const temporaryDirectories: string[] = [];
const HASH = "a".repeat(64);

async function repository(): Promise<ProjectRepository> {
  const root = await mkdtemp(path.join(tmpdir(), "novel-studio-research-audit-"));
  temporaryDirectories.push(root);
  return new ProjectRepository(root);
}

async function findSeriesRoot(store: ProjectRepository, seriesId: string): Promise<string> {
  const suffix = `-${seriesId.slice(0, 8)}`;
  const entries = await readdir(store.libraryRoot, { withFileTypes: true });
  const entry = entries.find((candidate) => candidate.isDirectory() && candidate.name.endsWith(suffix));
  if (!entry) throw new Error(`Series root not found for ${seriesId}`);
  return path.join(store.libraryRoot, entry.name);
}

function modelCall(seriesId: string, sceneId: string, id = randomUUID()): ModelCallLog {
  return {
    schemaVersion: 2,
    id,
    seriesId,
    sceneId,
    roleId: "role-research-test",
    taskKind: "research",
    provider: "mock",
    model: "mock-research",
    contextBundleId: randomUUID(),
    promptTemplateId: randomUUID(),
    promptTemplateVersion: 1,
    requestHash: HASH,
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

function auditEvent(
  seriesId: string,
  modelCallId: string,
  sequence: number,
  id = randomUUID(),
): ResearchToolAuditEvent {
  return {
    schemaVersion: 1,
    id,
    seriesId,
    modelCallId,
    sequence,
    tool: "research.search",
    status: "succeeded",
    argumentHash: HASH,
    argumentCharacterCount: 37,
    argumentSummary: {
      requestedDatabaseIds: ["11111111-1111-4111-8111-111111111111"],
      sourceId: null,
      chunkId: null,
      queryHash: HASH,
      queryCharacterCount: 9,
      cursorProvided: false,
    },
    resultKeys: ["11111111-1111-4111-8111-111111111111:source-result"],
    citations: [],
    outputCharacterCount: 120,
    outputTokenEstimate: 60,
    madeProgress: true,
    budgetAfter: {
      limits: RESEARCH_TOOL_DEFAULT_LIMITS,
      usedToolCalls: sequence,
      usedCharacters: sequence * 120,
      usedTokenEstimate: sequence * 60,
      consecutiveNoProgress: 0,
      remainingToolCalls: RESEARCH_TOOL_DEFAULT_LIMITS.maxToolCalls - sequence,
      remainingCharacters: RESEARCH_TOOL_DEFAULT_LIMITS.cumulativeCharacterBudget - sequence * 120,
      remainingTokenEstimate: RESEARCH_TOOL_DEFAULT_LIMITS.cumulativeTokenEstimateBudget - sequence * 60,
      exhaustedReason: null,
    },
    errorCode: null,
    startedAt: `2026-07-19T00:00:0${sequence}.000Z`,
    completedAt: `2026-07-19T00:00:0${sequence}.100Z`,
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("NS-606 Research tool audit persistence", () => {
  it("atomically accepts one concurrent sequence and rehydrates it after restart", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "Audit concurrency" });
    const call = modelCall(series.manifest.id, series.scenes[0]!.metadata.id);
    await store.saveModelCallLog(series.manifest.id, call);
    const candidates = [
      auditEvent(series.manifest.id, call.id, 1),
      auditEvent(series.manifest.id, call.id, 1),
    ];

    const results = await Promise.allSettled(candidates.map((event) =>
      store.appendResearchToolAuditEvent(series.manifest.id, event)));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);

    const restarted = new ProjectRepository(store.libraryRoot);
    await restarted.initialize();
    const restored = await restarted.listResearchToolAuditEvents(series.manifest.id, call.id);
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({ modelCallId: call.id, sequence: 1 });
  });

  it("persists only structural evidence and never raw query or passage text", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "Audit redaction" });
    const call = modelCall(series.manifest.id, series.scenes[0]!.metadata.id);
    const event = auditEvent(series.manifest.id, call.id, 1);
    await store.saveModelCallLog(series.manifest.id, call);
    await store.appendResearchToolAuditEvent(series.manifest.id, event);

    const root = await findSeriesRoot(store, series.manifest.id);
    const lane = researchToolAuditLaneRoot(root, call.id);
    const [fileName] = await readdir(lane);
    const raw = await readFile(path.join(lane, fileName!), "utf8");
    expect(raw).toContain(event.argumentHash);
    expect(raw).not.toContain("private multilingual query");
    expect(raw).not.toContain("private original passage");
    expect(raw).not.toContain("queryText");
    expect(raw).not.toContain("originalText");
  });

  it("requires an existing Model Call Log and exact Series linkage", async () => {
    const store = await repository();
    const first = await store.createSeries({ title: "First audit series" });
    const second = await store.createSeries({ title: "Second audit series" });
    const missingCallId = randomUUID();
    await expect(store.appendResearchToolAuditEvent(
      first.manifest.id,
      auditEvent(first.manifest.id, missingCallId, 1),
    )).rejects.toMatchObject<Partial<StorageError>>({ code: "NOT_FOUND" });

    const call = modelCall(first.manifest.id, first.scenes[0]!.metadata.id);
    await store.saveModelCallLog(first.manifest.id, call);
    await expect(store.appendResearchToolAuditEvent(
      second.manifest.id,
      auditEvent(first.manifest.id, call.id, 1),
    )).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    await expect(store.listResearchToolAuditEvents(first.manifest.id, "../../escape"))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
  });

  it("fails closed when an audit lane is non-contiguous", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "Audit gap" });
    const call = modelCall(series.manifest.id, series.scenes[0]!.metadata.id);
    const first = auditEvent(series.manifest.id, call.id, 1);
    const second = auditEvent(series.manifest.id, call.id, 2);
    await store.saveModelCallLog(series.manifest.id, call);
    await store.appendResearchToolAuditEvent(series.manifest.id, first);
    await store.appendResearchToolAuditEvent(series.manifest.id, second);

    const root = await findSeriesRoot(store, series.manifest.id);
    const lane = researchToolAuditLaneRoot(root, call.id);
    const secondName = `000002-${second.id}.json`;
    await rename(path.join(lane, secondName), path.join(lane, `000003-${second.id}.json`));

    const restarted = new ProjectRepository(store.libraryRoot);
    await restarted.initialize();
    await expect(restarted.listResearchToolAuditEvents(series.manifest.id, call.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
  });
});
