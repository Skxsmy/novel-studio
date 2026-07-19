import { describe, expect, it } from "vitest";
import {
  fuseResearchRetrievalCandidates,
  type ResearchRetrievalCandidate,
} from "../src/index.js";

const firstDatabaseId = "11111111-1111-4111-8111-111111111111";
const secondDatabaseId = "22222222-2222-4222-8222-222222222222";
const inactiveDatabaseId = "33333333-3333-4333-8333-333333333333";

function candidate(input: Partial<ResearchRetrievalCandidate> & Pick<ResearchRetrievalCandidate, "chunkId" | "channel" | "channelRank">): ResearchRetrievalCandidate {
  const researchDatabaseId = input.researchDatabaseId ?? firstDatabaseId;
  const sourceId = input.sourceId ?? "44444444-4444-4444-8444-444444444444";
  return {
    researchDatabaseId,
    researchDatabaseName: input.researchDatabaseName ?? (researchDatabaseId === firstDatabaseId ? "History" : "Travel"),
    sourceId,
    sourceRevision: "a".repeat(64),
    sourceDisplayName: input.sourceDisplayName ?? "source.txt",
    sourceKind: "txt",
    chunkId: input.chunkId,
    blockId: input.blockId ?? input.chunkId.replace(/^./u, "9"),
    blockOrder: input.blockOrder ?? 0,
    chunkHash: "b".repeat(64),
    originalText: input.originalText ?? `Original ${input.chunkId}`,
    languageTag: input.languageTag ?? "en",
    location: input.location ?? { kind: "text", startLine: 1, endLine: 1, startOffset: 0, endOffset: 10 },
    channel: input.channel,
    matchedQuery: input.matchedQuery ?? "Edo inn",
    channelRank: input.channelRank,
    rawScore: input.rawScore ?? 1,
  };
}

function options(input: Partial<Parameters<typeof fuseResearchRetrievalCandidates>[1]> = {}) {
  return {
    selectedDatabaseIds: [firstDatabaseId, secondDatabaseId],
    requestFingerprint: "hybrid:Edo inn",
    snapshotFingerprint: "lexical-a:vector-a:aliases-a",
    limit: 20,
    ...input,
  };
}

describe("NS-605 deterministic Research retrieval fusion", () => {
  it("fuses channels by weighted rank, deduplicates chunks, and ignores inactive databases", () => {
    const sharedChunk = "55555555-5555-4555-8555-555555555555";
    const results = fuseResearchRetrievalCandidates([
      candidate({ chunkId: sharedChunk, channel: "keyword-word", channelRank: 1, rawScore: 100 }),
      candidate({ chunkId: sharedChunk, channel: "semantic", channelRank: 2, rawScore: 0.8 }),
      candidate({
        researchDatabaseId: secondDatabaseId,
        chunkId: "66666666-6666-4666-8666-666666666666",
        channel: "keyword-literal",
        channelRank: 1,
        rawScore: 1,
      }),
      candidate({
        researchDatabaseId: inactiveDatabaseId,
        chunkId: "77777777-7777-4777-8777-777777777777",
        channel: "semantic",
        channelRank: 1,
      }),
    ], options()).results;

    expect(results).toHaveLength(2);
    expect(results[0]?.chunkId).toBe(sharedChunk);
    expect(results[0]?.matchChannels).toEqual(["keyword-word", "semantic"]);
    expect(results.some((result) => result.researchDatabaseId === inactiveDatabaseId)).toBe(false);
  });

  it("does not compare raw scores across channels", () => {
    const highRawLowRank = candidate({
      chunkId: "88888888-8888-4888-8888-888888888888",
      channel: "keyword-word",
      channelRank: 50,
      rawScore: 10_000,
    });
    const lowRawHighRank = candidate({
      chunkId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      channel: "keyword-word",
      channelRank: 1,
      rawScore: 0.00001,
    });
    const results = fuseResearchRetrievalCandidates([highRawLowRank, lowRawHighRank], options()).results;
    expect(results.map((result) => result.chunkId)).toEqual([lowRawHighRank.chunkId, highRawLowRank.chunkId]);
  });

  it("promotes source and database diversity before filling deferred results", () => {
    const repeatedSource = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const candidates = Array.from({ length: 4 }, (_, index) => candidate({
      chunkId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      sourceId: repeatedSource,
      channel: "keyword-literal",
      channelRank: index + 1,
    }));
    candidates.push(candidate({
      researchDatabaseId: secondDatabaseId,
      sourceId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      chunkId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      channel: "keyword-word",
      channelRank: 10,
    }));
    const results = fuseResearchRetrievalCandidates(candidates, options()).results;

    expect(results[2]?.researchDatabaseId).toBe(secondDatabaseId);
    expect(results[3]?.sourceId).toBe(repeatedSource);
  });

  it("applies a minimum relevance floor", () => {
    const results = fuseResearchRetrievalCandidates([
      candidate({
        chunkId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        channel: "semantic",
        channelRank: 1,
      }),
      candidate({
        chunkId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        channel: "semantic",
        channelRank: 500,
      }),
    ], options()).results;
    expect(results.map((result) => result.chunkId)).toEqual(["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"]);
  });

  it("paginates deterministically and rejects a cursor after query or snapshot drift", () => {
    const candidates = Array.from({ length: 5 }, (_, index) => candidate({
      chunkId: `12345678-1234-4234-8234-${String(index).padStart(12, "0")}`,
      sourceId: `87654321-4321-4321-8321-${String(index).padStart(12, "0")}`,
      channel: "keyword-literal",
      channelRank: index + 1,
    }));
    const first = fuseResearchRetrievalCandidates(candidates, options({ limit: 2 }));
    const second = fuseResearchRetrievalCandidates(candidates, options({ limit: 2, cursor: first.nextCursor ?? undefined }));
    expect(first.results.map((result) => result.chunkId)).not.toEqual(second.results.map((result) => result.chunkId));
    expect(second.nextCursor).not.toBeNull();
    expect(() => fuseResearchRetrievalCandidates(candidates, options({
      limit: 2,
      cursor: first.nextCursor ?? undefined,
      snapshotFingerprint: "changed",
    }))).toThrowError(/no longer matches/u);
    expect(() => fuseResearchRetrievalCandidates(candidates, options({
      limit: 2,
      cursor: first.nextCursor ?? undefined,
      requestFingerprint: "changed query",
    }))).toThrowError(/no longer matches/u);
  });

  it("rejects contradictory provenance for the same database Chunk", () => {
    const chunkId = "13572468-2468-4246-8246-135724681357";
    expect(() => fuseResearchRetrievalCandidates([
      candidate({ chunkId, channel: "keyword-word", channelRank: 1 }),
      candidate({ chunkId, channel: "semantic", channelRank: 1, originalText: "conflicting text" }),
    ], options())).toThrowError(/disagree about Chunk provenance/u);
  });
});
