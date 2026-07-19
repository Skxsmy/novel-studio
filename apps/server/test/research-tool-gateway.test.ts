import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { EmbeddingRouter, type ProviderToolCall } from "@novel-studio/ai";
import {
  RESEARCH_TOOL_DEFAULT_LIMITS,
  ResearchSourcePropertiesSchema,
  ResearchToolLimitsSchema,
  type ModelCallLog,
  type ResearchToolLimits,
} from "@novel-studio/contracts";
import {
  ProjectRepository,
  StorageError,
  researchToolAuditLaneRoot,
} from "@novel-studio/storage";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createResearchToolGateway,
  researchRetrievalToolDefinitions,
} from "../src/researchToolGateway.js";
import { parseResearchFile } from "../src/researchParsers.js";

const roots: string[] = [];
const HASH = "a".repeat(64);

async function fixture() {
  const libraryRoot = await mkdtemp(path.join(tmpdir(), "novel-studio-research-gateway-"));
  roots.push(libraryRoot);
  const repository = new ProjectRepository(libraryRoot);
  await repository.initialize();
  const series = await repository.createSeries({ title: "Research gateway series" });
  const call: ModelCallLog = {
    schemaVersion: 2,
    id: randomUUID(),
    seriesId: series.manifest.id,
    sceneId: series.scenes[0]!.metadata.id,
    roleId: "role-research-gateway",
    taskKind: "research",
    provider: "mock",
    model: "mock-research-model",
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
  await repository.saveModelCallLog(series.manifest.id, call);
  const database = await repository.createResearchDatabase({ name: "Active evidence" });
  return {
    libraryRoot,
    repository,
    series,
    call,
    database,
    embeddingRouter: new EmbeddingRouter(),
  };
}

async function importText(
  repository: ProjectRepository,
  databaseId: string,
  fileName: string,
  text: string,
  aiPermission: "never" | "allowed" = "allowed",
) {
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

function call(name: string, argumentsValue: unknown): ProviderToolCall {
  return { id: randomUUID(), name, arguments: JSON.stringify(argumentsValue) };
}

function limits(overrides: Partial<ResearchToolLimits>): ResearchToolLimits {
  return ResearchToolLimitsSchema.parse({ ...RESEARCH_TOOL_DEFAULT_LIMITS, ...overrides });
}

async function findSeriesRoot(repository: ProjectRepository, seriesId: string): Promise<string> {
  const suffix = `-${seriesId.slice(0, 8)}`;
  const entries = await readdir(repository.libraryRoot, { withFileTypes: true });
  const entry = entries.find((candidate) => candidate.isDirectory() && candidate.name.endsWith(suffix));
  if (!entry) throw new Error(`Series root not found for ${seriesId}`);
  return path.join(repository.libraryRoot, entry.name);
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("NS-606 permissioned read-only Research tool gateway", () => {
  it("exposes exactly three strict native tools only for capable providers", () => {
    expect(researchRetrievalToolDefinitions(false)).toEqual([]);
    const definitions = researchRetrievalToolDefinitions(true);
    expect(definitions.map((definition) => definition.name)).toEqual([
      "research.list_sources",
      "research.search",
      "research.open_passage",
    ]);
    expect(definitions.every((definition) => definition.strict)).toBe(true);
    expect(JSON.stringify(definitions.find((definition) => definition.name === "research.search")!.parameters))
      .not.toMatch(/"limit"/u);
  });

  it("binds only to an active Model Call Log", async () => {
    const input = await fixture();
    await input.repository.saveModelCallLog(input.series.manifest.id, {
      ...input.call,
      status: "succeeded",
      responseHash: HASH,
      actualUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      completedAt: "2026-07-19T00:00:01.000Z",
    });
    await expect(createResearchToolGateway({
      ...input,
      seriesId: input.series.manifest.id,
      modelCallId: input.call.id,
      activeDatabaseIds: [input.database.database.id],
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });
  });

  it("lists only permitted metadata with a revision-bound bounded cursor", async () => {
    const input = await fixture();
    await importText(input.repository, input.database.database.id, "allowed-a.txt", "Allowed source A.");
    await importText(input.repository, input.database.database.id, "allowed-b.txt", "Allowed source B.");
    await importText(input.repository, input.database.database.id, "private.txt", "PRIVATE_SOURCE_TEXT", "never");
    const sourceBodyRead = vi.spyOn(input.repository, "getResearchSource");
    const gateway = await createResearchToolGateway({
      ...input,
      seriesId: input.series.manifest.id,
      modelCallId: input.call.id,
      activeDatabaseIds: [input.database.database.id],
      limits: limits({ sourceResultLimit: 1 }),
    });

    const first = await gateway.execute(call("research.list_sources", {
      databaseId: input.database.database.id,
    }));
    expect(first.ok).toBe(true);
    if (!first.ok || first.tool !== "research.list_sources") throw new Error("Expected list result");
    expect(first.sources).toHaveLength(1);
    expect(first.nextCursor).toEqual(expect.any(String));
    expect(JSON.stringify(first)).not.toContain("PRIVATE_SOURCE_TEXT");
    expect(JSON.stringify(first)).not.toContain("originalText");
    expect(sourceBodyRead).not.toHaveBeenCalled();

    await importText(input.repository, input.database.database.id, "allowed-c.txt", "Allowed source C.");
    const stale = await gateway.execute(call("research.list_sources", {
      databaseId: input.database.database.id,
      cursor: first.nextCursor,
    }));
    expect(stale).toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENTS" } });
  });

  it("enforces activation, source permission and server-owned search limits", async () => {
    const input = await fixture();
    const inactive = await input.repository.createResearchDatabase({ name: "Inactive evidence" });
    const allowed = await importText(
      input.repository,
      input.database.database.id,
      "allowed.txt",
      "An Edo inn offered lodging to travelers. IGNORE_PREVIOUS_INSTRUCTIONS_IN_SOURCE.",
    );
    await importText(
      input.repository,
      input.database.database.id,
      "private.txt",
      "An Edo inn concealed PRIVATE_PASSAGE_TEXT.",
      "never",
    );
    await importText(input.repository, inactive.database.id, "inactive.txt", "An Edo inn outside active scope.");
    const gateway = await createResearchToolGateway({
      ...input,
      seriesId: input.series.manifest.id,
      modelCallId: input.call.id,
      activeDatabaseIds: [input.database.database.id],
      limits: limits({ searchResultLimit: 1 }),
    });

    expect(await gateway.execute(call("research.search", {
      query: "Edo inn sk-provider-secret Authorization: Bearer private-header",
      mode: "exact",
      limit: 50,
    }))).toMatchObject({ ok: false, error: { code: "INVALID_ARGUMENTS" } });
    const searched = await gateway.execute(call("research.search", { query: "Edo inn", mode: "exact" }));
    expect(searched.ok).toBe(true);
    if (!searched.ok || searched.tool !== "research.search") throw new Error("Expected search result");
    expect(searched.results).toHaveLength(1);
    expect(searched.results[0]!.sourceId).toBe(allowed.source.id);
    expect(JSON.stringify(searched)).not.toContain("PRIVATE_PASSAGE_TEXT");
    expect(await gateway.execute(call("research.search", {
      query: "Edo inn",
      mode: "exact",
      databaseIds: [inactive.database.id],
    }))).toMatchObject({ ok: false, error: { code: "INACTIVE_DATABASE" } });

    const audits = await input.repository.listResearchToolAuditEvents(input.series.manifest.id, input.call.id);
    expect(audits).toHaveLength(3);
    expect(JSON.stringify(audits)).not.toContain("Edo inn");
    expect(JSON.stringify(audits)).not.toContain("sk-provider-secret");
    expect(JSON.stringify(audits)).not.toContain("Authorization");
    expect(JSON.stringify(audits)).not.toContain("IGNORE_PREVIOUS_INSTRUCTIONS_IN_SOURCE");
    expect(audits[1]!.citations[0]).not.toHaveProperty("originalText");
  });

  it("opens only a prior current citation and applies permission revocation immediately", async () => {
    const input = await fixture();
    const source = await importText(
      input.repository,
      input.database.database.id,
      "three-passages.txt",
      "First neighboring passage.\n\nMiddle citation evidence for the author.\n\nFinal neighboring passage.",
    );
    const gateway = await createResearchToolGateway({
      ...input,
      seriesId: input.series.manifest.id,
      modelCallId: input.call.id,
      activeDatabaseIds: [input.database.database.id],
      limits: limits({ maxConsecutiveNoProgress: 8 }),
    });
    const searched = await gateway.execute(call("research.search", {
      query: "Middle citation evidence",
      mode: "exact",
    }));
    if (!searched.ok || searched.tool !== "research.search" || !searched.results[0]) {
      throw new Error("Expected search citation");
    }
    const citation = searched.results[0];
    const openArguments = {
      databaseId: citation.researchDatabaseId,
      sourceId: citation.sourceId,
      chunkId: citation.chunkId,
      sourceRevision: citation.sourceRevision,
      chunkHash: citation.chunkHash,
    };
    expect(await gateway.execute(call("research.open_passage", {
      ...openArguments,
      chunkId: randomUUID(),
    }))).toMatchObject({ ok: false, error: { code: "CITATION_NOT_RETURNED" } });

    const opened = await gateway.execute(call("research.open_passage", openArguments));
    expect(opened.ok).toBe(true);
    if (!opened.ok || opened.tool !== "research.open_passage") throw new Error("Expected open result");
    expect(opened.passages.length).toBeLessThanOrEqual(3);
    const openedTarget = opened.passages.find((passage) => passage.relationship === "target");
    expect(openedTarget).toMatchObject({
      researchDatabaseId: citation.researchDatabaseId,
      sourceId: citation.sourceId,
      sourceRevision: citation.sourceRevision,
      chunkId: citation.chunkId,
      chunkHash: citation.chunkHash,
      originalText: citation.originalText,
      languageTag: citation.languageTag,
      location: citation.location,
      matchChannels: citation.matchChannels,
    });

    const current = await input.repository.getResearchSource(input.database.database.id, source.source.id);
    const denied = await input.repository.updateResearchSource(input.database.database.id, source.source.id, {
      baseRevision: current.revision,
      aiPermission: "never",
    });
    expect(await gateway.execute(call("research.open_passage", openArguments)))
      .toMatchObject({ ok: false, error: { code: "SOURCE_NOT_PERMITTED" } });
    await input.repository.updateResearchSource(input.database.database.id, source.source.id, {
      baseRevision: denied.revision,
      aiPermission: "allowed",
    });
    expect(await gateway.execute(call("research.open_passage", openArguments)))
      .toMatchObject({ ok: false, error: { code: "STALE_CITATION" } });
  });

  it("serializes concurrent calls, stops after two no-progress results, and preserves exhaustion after restart", async () => {
    const input = await fixture();
    const create = () => createResearchToolGateway({
      ...input,
      seriesId: input.series.manifest.id,
      modelCallId: input.call.id,
      activeDatabaseIds: [input.database.database.id],
    });
    const gateway = await create();
    const emptySearch = () => gateway.execute(call("research.search", {
      query: "evidence that does not exist",
      mode: "exact",
    }));
    const results = await Promise.all([emptySearch(), emptySearch()]);
    expect(results.every((result) => result.ok)).toBe(true);
    expect(results[1]!.budget.exhaustedReason).toBe("no-progress-limit");
    const audits = await input.repository.listResearchToolAuditEvents(input.series.manifest.id, input.call.id);
    expect(audits.map((event) => event.sequence)).toEqual([1, 2]);

    const restarted = await create();
    expect(await restarted.execute(call("research.search", {
      query: "still blocked",
      mode: "exact",
    }))).toMatchObject({ ok: false, error: { code: "BUDGET_EXHAUSTED" } });
    expect(await input.repository.listResearchToolAuditEvents(input.series.manifest.id, input.call.id))
      .toHaveLength(2);
  });

  it("enforces cumulative character and token budgets after individually valid calls", async () => {
    const input = await fixture();
    await importText(input.repository, input.database.database.id, "budget.txt", "Bounded metadata source.");
    const gatewayInput = {
      repository: input.repository,
      embeddingRouter: input.embeddingRouter,
      seriesId: input.series.manifest.id,
      activeDatabaseIds: [input.database.database.id],
    };
    const listCall = () => call("research.list_sources", { databaseId: input.database.database.id });
    const preview = await createResearchToolGateway({ ...gatewayInput, modelCallId: input.call.id });
    const previewResult = await preview.execute(listCall());
    expect(previewResult.ok).toBe(true);
    const previewCharacters = Array.from(JSON.stringify(previewResult)).length;
    const previewTokens = Math.ceil(previewCharacters / 2);

    const characterCall: ModelCallLog = { ...input.call, id: randomUUID() };
    await input.repository.saveModelCallLog(input.series.manifest.id, characterCall);
    const characterBudget = Math.max(1_000, previewCharacters + 500);
    const characterGateway = await createResearchToolGateway({
      ...gatewayInput,
      modelCallId: characterCall.id,
      limits: limits({
        maxConsecutiveNoProgress: 8,
        perCallCharacterBudget: characterBudget,
        cumulativeCharacterBudget: characterBudget,
        perCallTokenEstimateBudget: 50_000,
        cumulativeTokenEstimateBudget: 250_000,
      }),
    });
    expect((await characterGateway.execute(listCall())).ok).toBe(true);
    expect(await characterGateway.execute(listCall())).toMatchObject({
      ok: false,
      error: { code: "BUDGET_EXHAUSTED" },
      budget: { exhaustedReason: "character-budget" },
    });

    const tokenCall: ModelCallLog = { ...input.call, id: randomUUID() };
    await input.repository.saveModelCallLog(input.series.manifest.id, tokenCall);
    const tokenBudget = Math.max(500, previewTokens + 250);
    const tokenGateway = await createResearchToolGateway({
      ...gatewayInput,
      modelCallId: tokenCall.id,
      limits: limits({
        maxConsecutiveNoProgress: 8,
        perCallCharacterBudget: 100_000,
        cumulativeCharacterBudget: 500_000,
        perCallTokenEstimateBudget: tokenBudget,
        cumulativeTokenEstimateBudget: tokenBudget,
      }),
    });
    expect((await tokenGateway.execute(listCall())).ok).toBe(true);
    expect(await tokenGateway.execute(listCall())).toMatchObject({
      ok: false,
      error: { code: "BUDGET_EXHAUSTED" },
      budget: { exhaustedReason: "token-estimate-budget" },
    });
  });

  it("executes a scripted model-native sequence until the server call budget stops it", async () => {
    const input = await fixture();
    await importText(
      input.repository,
      input.database.database.id,
      "scripted.txt",
      "Scripted provider evidence for a bounded author research question.",
    );
    const gateway = await createResearchToolGateway({
      ...input,
      seriesId: input.series.manifest.id,
      modelCallId: input.call.id,
      activeDatabaseIds: [input.database.database.id],
      limits: limits({ maxToolCalls: 5, maxConsecutiveNoProgress: 8 }),
    });
    const outputs = [];
    outputs.push(await gateway.execute(call("research.list_sources", {
      databaseId: input.database.database.id,
    })));
    const broad = await gateway.execute(call("research.search", {
      query: "Scripted provider evidence",
      mode: "exact",
    }));
    outputs.push(broad);
    outputs.push(await gateway.execute(call("research.search", {
      query: "bounded author research question",
      mode: "exact",
    })));
    if (!broad.ok || broad.tool !== "research.search" || !broad.results[0]) {
      throw new Error("Scripted provider expected a citation");
    }
    const citation = broad.results[0];
    const openArguments = {
      databaseId: citation.researchDatabaseId,
      sourceId: citation.sourceId,
      chunkId: citation.chunkId,
      sourceRevision: citation.sourceRevision,
      chunkHash: citation.chunkHash,
    };
    outputs.push(await gateway.execute(call("research.open_passage", openArguments)));
    outputs.push(await gateway.execute(call("research.open_passage", openArguments)));

    expect(outputs).toHaveLength(5);
    expect(outputs.every((output) => output.ok)).toBe(true);
    expect(outputs[4]!.budget).toMatchObject({ usedToolCalls: 5, exhaustedReason: "tool-call-limit" });
    expect(await gateway.execute(call("research.list_sources", {
      databaseId: input.database.database.id,
    }))).toMatchObject({ ok: false, error: { code: "BUDGET_EXHAUSTED" } });
    expect(await input.repository.listResearchToolAuditEvents(input.series.manifest.id, input.call.id))
      .toHaveLength(5);
  });

  it("withholds oversized evidence and audits cancellation without source text", async () => {
    const oversized = await fixture();
    const marker = "OVERSIZED_PRIVATE_EVIDENCE";
    await importText(
      oversized.repository,
      oversized.database.database.id,
      "oversized.txt",
      `${marker} ${"x".repeat(5_000)}`,
    );
    const bounded = await createResearchToolGateway({
      ...oversized,
      seriesId: oversized.series.manifest.id,
      modelCallId: oversized.call.id,
      activeDatabaseIds: [oversized.database.database.id],
      limits: limits({
        perCallCharacterBudget: 1_000,
        perCallTokenEstimateBudget: 500,
        cumulativeCharacterBudget: 4_000,
        cumulativeTokenEstimateBudget: 2_000,
      }),
    });
    const blocked = await bounded.execute(call("research.search", { query: marker, mode: "exact" }));
    expect(blocked).toMatchObject({
      ok: false,
      error: { code: "BUDGET_EXHAUSTED" },
      budget: { exhaustedReason: "character-budget" },
    });
    expect(JSON.stringify(blocked)).not.toContain(marker);
    const blockedAudit = (await oversized.repository.listResearchToolAuditEvents(
      oversized.series.manifest.id,
      oversized.call.id,
    ))[0]!;
    expect(blockedAudit).toMatchObject({ citations: [], resultKeys: [], outputCharacterCount: 0 });

    const cancelled = await fixture();
    await importText(
      cancelled.repository,
      cancelled.database.database.id,
      "cancelled.txt",
      "Cancellation should stop this retrieval loop.",
    );
    const controller = new AbortController();
    const originalSearch = cancelled.repository.searchResearchSources.bind(cancelled.repository);
    vi.spyOn(cancelled.repository, "searchResearchSources").mockImplementation(async (databaseId, searchInput) => {
      controller.abort();
      return originalSearch(databaseId, searchInput);
    });
    const gateway = await createResearchToolGateway({
      ...cancelled,
      seriesId: cancelled.series.manifest.id,
      modelCallId: cancelled.call.id,
      activeDatabaseIds: [cancelled.database.database.id],
      abortSignal: controller.signal,
    });
    expect(await gateway.execute(call("research.search", {
      query: "Cancellation",
      mode: "exact",
    }))).toMatchObject({ ok: false, error: { code: "CANCELLED" } });
    expect(await cancelled.repository.listResearchToolAuditEvents(
      cancelled.series.manifest.id,
      cancelled.call.id,
    )).toMatchObject([{ status: "cancelled", outputCharacterCount: 0, citations: [] }]);
  });

  it("fails closed when a structurally valid audit has impossible budget progression", async () => {
    const input = await fixture();
    const gateway = await createResearchToolGateway({
      ...input,
      seriesId: input.series.manifest.id,
      modelCallId: input.call.id,
      activeDatabaseIds: [input.database.database.id],
    });
    await gateway.execute(call("research.search", { query: "empty", mode: "exact" }));
    const root = await findSeriesRoot(input.repository, input.series.manifest.id);
    const lane = researchToolAuditLaneRoot(root, input.call.id);
    const [fileName] = await readdir(lane);
    const filePath = path.join(lane, fileName!);
    const authority = JSON.parse(await readFile(filePath, "utf8"));
    authority.budgetAfter.usedCharacters += 1;
    authority.budgetAfter.remainingCharacters -= 1;
    await writeFile(filePath, `${JSON.stringify(authority, null, 2)}\n`, "utf8");

    await expect(createResearchToolGateway({
      ...input,
      seriesId: input.series.manifest.id,
      modelCallId: input.call.id,
      activeDatabaseIds: [input.database.database.id],
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
  });
});
