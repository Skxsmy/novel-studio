import { describe, expect, it } from "vitest";
import {
  ResearchEmbeddingCapabilitySchema,
  ResearchMultiSearchInputSchema,
  ResearchMultiSearchResponseSchema,
  ResearchQueryExpansionDocumentSchema,
  ResearchRetrievalResultSchema,
  ResearchVectorIndexStateSchema,
} from "../src/research.js";

const databaseId = "11111111-1111-4111-8111-111111111111";
const secondDatabaseId = "22222222-2222-4222-8222-222222222222";
const profileId = "33333333-3333-4333-8333-333333333333";
const sourceId = "44444444-4444-4444-8444-444444444444";
const chunkId = "55555555-5555-4555-8555-555555555555";
const blockId = "66666666-6666-4666-8666-666666666666";
const revision = "a".repeat(64);

describe("NS-605 Research retrieval contracts", () => {
  it("accepts an explicit bounded multi-database Hybrid request", () => {
    expect(ResearchMultiSearchInputSchema.parse({
      databaseIds: [databaseId, secondDatabaseId],
      query: "江户 旅馆",
    })).toMatchObject({ mode: "hybrid", purpose: "local", limit: 20 });

    expect(ResearchMultiSearchInputSchema.safeParse({
      databaseIds: [databaseId, databaseId],
      query: "duplicate scope",
    }).success).toBe(false);
    expect(ResearchMultiSearchInputSchema.safeParse({
      databaseIds: Array.from({ length: 13 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`),
      query: "too many databases",
    }).success).toBe(false);
    expect(ResearchMultiSearchInputSchema.safeParse({
      databaseIds: [databaseId],
      query: "duplicate filters",
      languageTags: ["ja", "JA"],
    }).success).toBe(false);
    expect(ResearchMultiSearchInputSchema.safeParse({
      databaseIds: [databaseId],
      query: "oversized cursor",
      cursor: "x".repeat(4097),
    }).success).toBe(false);
  });

  it("keeps per-database aliases and transliterations revision-bound", () => {
    const document = ResearchQueryExpansionDocumentSchema.parse({
      expansions: {
        schemaVersion: 1,
        researchDatabaseId: databaseId,
        entries: [{
          id: chunkId,
          queryTerm: "江户",
          expansionTerm: "Edo",
          channel: "alias",
          queryLanguageTag: "zh-CN",
          expansionLanguageTag: "en",
        }, {
          id: blockId,
          queryTerm: "旅馆",
          expansionTerm: "ryokan",
          channel: "transliteration",
          queryLanguageTag: "zh-CN",
          expansionLanguageTag: "ja-Latn",
        }],
        updatedAt: "2026-07-19T00:00:00.000Z",
      },
      revision,
    });
    expect(document.expansions.entries).toHaveLength(2);
    expect(ResearchQueryExpansionDocumentSchema.safeParse({
      ...document,
      expansions: {
        ...document.expansions,
        entries: [document.expansions.entries[0], document.expansions.entries[0]],
      },
    }).success).toBe(false);
    expect(ResearchQueryExpansionDocumentSchema.safeParse({
      ...document,
      expansions: {
        ...document.expansions,
        entries: [document.expansions.entries[0], {
          ...document.expansions.entries[0],
          id: "77777777-7777-4777-8777-777777777777",
          expansionTerm: "Ｅｄｏ",
        }],
      },
    }).success).toBe(false);
  });

  it("returns fused channel evidence without replacing original source text", () => {
    const result = ResearchRetrievalResultSchema.parse({
      researchDatabaseId: databaseId,
      researchDatabaseName: "Japanese history",
      sourceId,
      sourceRevision: revision,
      sourceDisplayName: "Edo inns.pdf",
      sourceKind: "pdf",
      chunkId,
      blockId,
      blockOrder: 4,
      chunkHash: "b".repeat(64),
      originalText: "宿場町には旅籠が並んでいた。",
      languageTag: "ja",
      location: { kind: "pdf", page: 12, paragraph: 1 },
      rank: 1,
      matchChannels: ["alias", "semantic"],
      channelContributions: [{
        channel: "alias",
        matchedQuery: "Edo",
        rank: 1,
        rawScore: 2.5,
        reciprocalRankContribution: 0.016393,
      }, {
        channel: "semantic",
        matchedQuery: "江户 旅馆",
        rank: 2,
        rawScore: 0.81,
        reciprocalRankContribution: 0.016129,
      }],
      fusedScore: 0.032522,
    });
    expect(result.originalText).toContain("旅籠");
    expect(result.matchChannels).toEqual(["alias", "semantic"]);

    expect(ResearchMultiSearchResponseSchema.parse({
      query: "江户 旅馆",
      selectedDatabaseIds: [databaseId, secondDatabaseId],
      requestedMode: "hybrid",
      effectiveMode: "hybrid",
      results: [result],
      issues: [],
      nextCursor: null,
    }).results[0]?.researchDatabaseName).toBe("Japanese history");
    expect(ResearchRetrievalResultSchema.safeParse({
      ...result,
      matchChannels: ["invented-channel"],
    }).success).toBe(false);
  });

  it("binds multilingual capability to one exact embedding profile revision", () => {
    expect(ResearchEmbeddingCapabilitySchema.parse({
      schemaVersion: 1,
      profileId,
      profileRevision: revision,
      useCase: "research.multilingual",
      dimensions: 768,
      supportedLanguageTags: ["zh-CN", "ja", "en"],
      sharedSpaceDeclared: true,
      documentPrefix: "passage: ",
      queryPrefix: "query: ",
      validationStatus: "passed",
      validationFixtureVersion: 1,
      metrics: { positivePairMean: 0.8, positivePairMinimum: 0.7, negativePairMean: 0.2, separation: 0.6 },
      validatedAt: "2026-07-19T00:00:00.000Z",
      failureReason: null,
    }).validationStatus).toBe("passed");
    expect(ResearchEmbeddingCapabilitySchema.safeParse({
      schemaVersion: 1,
      profileId,
      profileRevision: revision,
      useCase: "research.multilingual",
      dimensions: 768,
      supportedLanguageTags: ["en", "EN"],
      sharedSpaceDeclared: true,
      validationStatus: "passed",
      validationFixtureVersion: 1,
      metrics: { positivePairMean: 0.8, positivePairMinimum: 0.7, negativePairMean: 0.2, separation: 0.6 },
      validatedAt: null,
      failureReason: null,
    }).success).toBe(false);
  });

  it("reports vector index identity and profile drift explicitly", () => {
    expect(ResearchVectorIndexStateSchema.parse({
      researchDatabaseId: databaseId,
      status: "stale",
      indexedSourceCount: 2,
      indexedChunkCount: 12,
      dimensions: 768,
      profileId,
      profileRevision: revision,
      reason: "Embedding profile revision changed",
    }).status).toBe("stale");
  });
});
