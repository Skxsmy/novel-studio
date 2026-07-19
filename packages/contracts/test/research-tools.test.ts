import { describe, expect, it } from "vitest";
import {
  RESEARCH_TOOL_DEFAULT_LIMITS,
  ResearchOpenPassageArgumentsSchema,
  ResearchSearchArgumentsSchema,
  ResearchToolAuditEventSchema,
  ResearchToolBudgetStateSchema,
  ResearchToolResultSchema,
} from "../src/researchTools.js";

const databaseId = "11111111-1111-4111-8111-111111111111";
const sourceId = "22222222-2222-4222-8222-222222222222";
const chunkId = "33333333-3333-4333-8333-333333333333";
const blockId = "44444444-4444-4444-8444-444444444444";
const seriesId = "55555555-5555-4555-8555-555555555555";
const modelCallId = "66666666-6666-4666-8666-666666666666";
const revision = "a".repeat(64);

function budget() {
  return ResearchToolBudgetStateSchema.parse({
    limits: RESEARCH_TOOL_DEFAULT_LIMITS,
    usedToolCalls: 1,
    usedCharacters: 200,
    usedTokenEstimate: 100,
    consecutiveNoProgress: 0,
    remainingToolCalls: 7,
    remainingCharacters: 47_800,
    remainingTokenEstimate: 23_900,
    exhaustedReason: null,
  });
}

describe("NS-606 Research tool contracts", () => {
  it("accepts bounded search intent and rejects model-owned limits or duplicate scope", () => {
    expect(ResearchSearchArgumentsSchema.parse({ query: "江户旅馆" })).toMatchObject({ mode: "hybrid" });
    expect(ResearchSearchArgumentsSchema.safeParse({ query: "dump", limit: 1000 }).success).toBe(false);
    expect(ResearchSearchArgumentsSchema.safeParse({
      query: "duplicate",
      databaseIds: [databaseId, databaseId],
    }).success).toBe(false);
  });

  it("requires a complete immutable citation identity to open passage context", () => {
    expect(ResearchOpenPassageArgumentsSchema.parse({
      databaseId,
      sourceId,
      chunkId,
      sourceRevision: revision,
      chunkHash: revision,
    }).chunkId).toBe(chunkId);
    expect(ResearchOpenPassageArgumentsSchema.safeParse({ databaseId, sourceId, chunkId }).success).toBe(false);
  });

  it("returns bounded original evidence with complete citation anchors", () => {
    const result = ResearchToolResultSchema.parse({
      schemaVersion: 1,
      ok: true,
      tool: "research.open_passage",
      passages: [{
        researchDatabaseId: databaseId,
        researchDatabaseName: "Japanese sources",
        sourceId,
        sourceRevision: revision,
        sourceDisplayName: "Edo inns",
        sourceKind: "txt",
        chunkId,
        blockId,
        chunkHash: revision,
        originalText: "江戸の旅籠。",
        languageTag: "ja",
        location: { kind: "text", startLine: 1, endLine: 1, startOffset: 0, endOffset: 7 },
        relationship: "target",
        matchChannels: ["semantic"],
      }],
      budget: budget(),
    });
    expect(result.ok && result.tool).toBe("research.open_passage");
  });

  it("keeps audit structural and rejects passage or query text fields", () => {
    const event = {
      schemaVersion: 1,
      id: "77777777-7777-4777-8777-777777777777",
      seriesId,
      modelCallId,
      sequence: 1,
      tool: "research.search",
      status: "succeeded",
      argumentHash: revision,
      argumentCharacterCount: 32,
      argumentSummary: {
        requestedDatabaseIds: [databaseId],
        sourceId: null,
        chunkId: null,
        queryHash: revision,
        queryCharacterCount: 4,
        cursorProvided: false,
      },
      resultKeys: [`${databaseId}:${chunkId}`],
      citations: [{
        researchDatabaseId: databaseId,
        researchDatabaseName: "Sources",
        sourceId,
        sourceRevision: revision,
        sourceDisplayName: "Edo",
        sourceKind: "txt",
        chunkId,
        blockId,
        chunkHash: revision,
        languageTag: "ja",
        location: { kind: "text", startLine: 1, endLine: 1, startOffset: 0, endOffset: 4 },
        relationship: "target",
        matchChannels: ["semantic"],
        fusedScore: 0.1,
      }],
      outputCharacterCount: 200,
      outputTokenEstimate: 100,
      madeProgress: true,
      budgetAfter: budget(),
      errorCode: null,
      startedAt: "2026-07-19T00:00:00.000Z",
      completedAt: "2026-07-19T00:00:01.000Z",
    };
    expect(ResearchToolAuditEventSchema.parse(event).citations).toHaveLength(1);
    expect(ResearchToolAuditEventSchema.safeParse({ ...event, queryText: "private query" }).success).toBe(false);
    expect(ResearchToolAuditEventSchema.safeParse({
      ...event,
      citations: [{ ...event.citations[0], originalText: "private passage" }],
    }).success).toBe(false);
  });

  it("rejects inconsistent budget and audit lifecycle state", () => {
    expect(ResearchToolBudgetStateSchema.safeParse({
      ...budget(),
      limits: { ...RESEARCH_TOOL_DEFAULT_LIMITS, cumulativeCharacterBudget: 1_000 },
    }).success).toBe(false);
    expect(ResearchToolBudgetStateSchema.safeParse({
      ...budget(),
      remainingToolCalls: 6,
    }).success).toBe(false);
  });
});
