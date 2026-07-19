import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import {
  deleteResearchVectorChunk,
  inspectResearchVectorIndex,
  rebuildResearchVectorIndex,
  rebuildResearchVectorIndexStreaming,
  researchVectorIndexDatabasePath,
  searchResearchVectorIndex,
  type ResearchVectorChunkInput,
} from "../src/index.js";

const databaseId = "11111111-1111-4111-8111-111111111111";
const secondDatabaseId = "22222222-2222-4222-8222-222222222222";
const profileId = "33333333-3333-4333-8333-333333333333";
const revision = "a".repeat(64);
const roots: string[] = [];

const identity = {
  profileId,
  profileRevision: revision,
  dimensions: 3,
  model: "multilingual-test",
  normalize: true,
  documentPrefix: "passage: ",
  queryPrefix: "query: ",
  capabilityRevision: "d".repeat(64),
  validationFixtureVersion: 1 as const,
};

async function root(label: string): Promise<string> {
  const value = await mkdtemp(path.join(tmpdir(), `novel-studio-vector-${label}-`));
  roots.push(value);
  return value;
}

function chunk(input: {
  chunkId: string;
  sourceId: string;
  text: string;
  embedding: number[];
  permission?: "never" | "allowed";
}): ResearchVectorChunkInput {
  return {
    chunkId: input.chunkId,
    sourceId: input.sourceId,
    sourceRevision: revision,
    sourceDisplayName: `${input.sourceId}.txt`,
    sourceKind: "txt",
    sourceAuthor: "",
    sourceTags: [],
    aiPermission: input.permission ?? "allowed",
    blockId: input.chunkId.replace(/^./u, "9"),
    blockOrder: 0,
    chunkHash: "b".repeat(64),
    originalText: input.text,
    languageTag: "und",
    location: { kind: "text", startLine: 1, endLine: 1, startOffset: 0, endOffset: input.text.length },
    embedding: input.embedding,
  };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("NS-605 isolated sqlite-vec Research index", () => {
  it("loads the pinned extension and searches exact nearest vectors", async () => {
    const databaseRoot = await root("search");
    const chunks = [
      chunk({
        chunkId: "44444444-4444-4444-8444-444444444444",
        sourceId: "55555555-5555-4555-8555-555555555555",
        text: "江户时代的旅馆",
        embedding: [0.1, 0.2, 0.3],
      }),
      chunk({
        chunkId: "66666666-6666-4666-8666-666666666666",
        sourceId: "77777777-7777-4777-8777-777777777777",
        text: "distant maritime note",
        embedding: [0.9, 0.8, 0.7],
      }),
    ];
    const input = { researchDatabaseId: databaseId, ...identity, chunks };
    expect((await rebuildResearchVectorIndex(databaseRoot, input)).status).toBe("ready");
    const results = await searchResearchVectorIndex(databaseRoot, databaseId, [0.2, 0.2, 0.3], 2);

    expect(results.map((result) => result.chunkId)).toEqual([
      "44444444-4444-4444-8444-444444444444",
      "66666666-6666-4666-8666-666666666666",
    ]);
    expect(results[0]?.distance).toBeCloseTo(0.1, 5);
  });

  it("expands the nearest-neighbor window until metadata-filtered evidence is found", async () => {
    const databaseRoot = await root("filtered-search");
    const nearerTxtChunks = Array.from({ length: 120 }, (_, index) => chunk({
      chunkId: `41000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      sourceId: "42000000-0000-4000-8000-000000000000",
      text: `nearer private candidate ${index}`,
      embedding: [index / 10_000, 0],
    }));
    const allowedMarkdown = {
      ...chunk({
        chunkId: "43000000-0000-4000-8000-000000000000",
        sourceId: "44000000-0000-4000-8000-000000000000",
        text: "filtered semantic evidence",
        embedding: [0.5, 0],
      }),
      sourceKind: "markdown" as const,
      sourceAuthor: "Research Author",
      sourceTags: ["Public"],
      languageTag: "en",
    };
    await rebuildResearchVectorIndex(databaseRoot, {
      researchDatabaseId: databaseId,
      ...identity,
      dimensions: 2,
      chunks: [...nearerTxtChunks, allowedMarkdown],
    });

    const results = await searchResearchVectorIndex(databaseRoot, databaseId, [0, 0], 1, {
      purpose: "model-context",
      sourceKinds: ["markdown"],
      languageTags: ["en"],
      tags: ["public"],
      author: "research",
    });
    expect(results.map((result) => result.chunkId)).toEqual([allowedMarkdown.chunkId]);
  });

  it("keeps sidecars isolated and reports profile or source drift", async () => {
    const firstRoot = await root("first");
    const secondRoot = await root("second");
    const chunks = [chunk({
      chunkId: "88888888-8888-4888-8888-888888888888",
      sourceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      text: "isolated",
      embedding: [1, 0],
    })];
    const input = { researchDatabaseId: databaseId, ...identity, dimensions: 2, chunks };
    await rebuildResearchVectorIndex(firstRoot, input);

    expect(researchVectorIndexDatabasePath(firstRoot)).not.toBe(researchVectorIndexDatabasePath(secondRoot));
    expect((await inspectResearchVectorIndex(secondRoot, secondDatabaseId)).status).toBe("missing");
    expect((await inspectResearchVectorIndex(firstRoot, databaseId, {
      ...input,
      profileRevision: "c".repeat(64),
    })).status).toBe("stale");
  });

  it("deletes a vector with a BigInt rowid and keeps metadata consistent", async () => {
    const databaseRoot = await root("delete");
    const target = chunk({
      chunkId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      sourceId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      text: "delete me",
      embedding: [0, 1],
    });
    await rebuildResearchVectorIndex(databaseRoot, {
      researchDatabaseId: databaseId,
      ...identity,
      dimensions: 2,
      chunks: [target],
    });

    expect(await deleteResearchVectorChunk(databaseRoot, databaseId, target.chunkId)).toBe(true);
    expect(await deleteResearchVectorChunk(databaseRoot, databaseId, target.chunkId)).toBe(false);
    expect(await searchResearchVectorIndex(databaseRoot, databaseId, [0, 1], 10)).toEqual([]);
    expect((await inspectResearchVectorIndex(databaseRoot, databaseId)).indexedChunkCount).toBe(0);
  });

  it("rejects dimension mismatches before swapping the live sidecar", async () => {
    const databaseRoot = await root("dimension");
    await expect(rebuildResearchVectorIndex(databaseRoot, {
      researchDatabaseId: databaseId,
      ...identity,
      chunks: [chunk({
        chunkId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        sourceId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        text: "bad dimensions",
        embedding: [0, 1],
      })],
    })).rejects.toMatchObject({ code: "INVALID_DATA" });
    expect((await inspectResearchVectorIndex(databaseRoot, databaseId)).status).toBe("missing");
  });

  it("streams Provider batches without retaining the full vector corpus", async () => {
    const databaseRoot = await root("streaming");
    const chunks = Array.from({ length: 5 }, (_, index) => chunk({
      chunkId: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      sourceId: "20000000-0000-4000-8000-000000000000",
      text: `batch ${index}`,
      embedding: [],
    }));
    const batchSizes: number[] = [];
    const state = await rebuildResearchVectorIndexStreaming(databaseRoot, {
      researchDatabaseId: databaseId,
      ...identity,
      dimensions: 2,
      chunks,
    }, {
      batchSize: 2,
      async embedBatch(batch) {
        batchSizes.push(batch.length);
        return batch.map((_, index) => [index, 1]);
      },
    });
    expect(batchSizes).toEqual([2, 2, 1]);
    expect(state).toMatchObject({ status: "ready", indexedChunkCount: 5 });
  });

  it("reuses unchanged vectors and embeds only added or changed Chunks", async () => {
    const databaseRoot = await root("incremental");
    const initialChunks = Array.from({ length: 3 }, (_, index) => ({
      ...chunk({
        chunkId: `21000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        sourceId: "22000000-0000-4000-8000-000000000000",
        text: `initial ${index}`,
        embedding: [],
      }),
      chunkHash: String(index + 1).repeat(64),
    }));
    const firstCalls: string[][] = [];
    await rebuildResearchVectorIndexStreaming(databaseRoot, {
      researchDatabaseId: databaseId,
      ...identity,
      dimensions: 2,
      chunks: initialChunks,
    }, {
      batchSize: 2,
      async embedBatch(batch) {
        firstCalls.push(batch.map((item) => item.chunkId));
        return batch.map((_, index) => [index, 1]);
      },
    });
    expect(firstCalls.flat()).toHaveLength(3);

    const changed = {
      ...initialChunks[2]!,
      originalText: "changed text",
      chunkHash: "4".repeat(64),
    };
    const added = {
      ...chunk({
        chunkId: "21000000-0000-4000-8000-000000000003",
        sourceId: "22000000-0000-4000-8000-000000000000",
        text: "added text",
        embedding: [],
      }),
      chunkHash: "5".repeat(64),
    };
    const secondCalls: string[][] = [];
    const nextChunks = [initialChunks[0]!, initialChunks[1]!, changed, added];
    const state = await rebuildResearchVectorIndexStreaming(databaseRoot, {
      researchDatabaseId: databaseId,
      ...identity,
      dimensions: 2,
      chunks: nextChunks,
    }, {
      batchSize: 4,
      async embedBatch(batch) {
        secondCalls.push(batch.map((item) => item.chunkId));
        return batch.map(() => [1, 0]);
      },
    });

    expect(secondCalls).toEqual([[changed.chunkId, added.chunkId]]);
    expect(state).toMatchObject({ status: "ready", indexedChunkCount: 4 });
  });

  it("cancels a streaming rebuild without replacing the ready sidecar", async () => {
    const databaseRoot = await root("cancel");
    const original = chunk({
      chunkId: "30000000-0000-4000-8000-000000000000",
      sourceId: "40000000-0000-4000-8000-000000000000",
      text: "original",
      embedding: [1, 0],
    });
    await rebuildResearchVectorIndex(databaseRoot, {
      researchDatabaseId: databaseId,
      ...identity,
      dimensions: 2,
      chunks: [original],
    });
    const controller = new AbortController();
    await expect(rebuildResearchVectorIndexStreaming(databaseRoot, {
      researchDatabaseId: databaseId,
      ...identity,
      dimensions: 2,
      chunks: [chunk({
        chunkId: "50000000-0000-4000-8000-000000000000",
        sourceId: "60000000-0000-4000-8000-000000000000",
        text: "replacement",
        embedding: [],
      })],
    }, {
      batchSize: 1,
      signal: controller.signal,
      async embedBatch() {
        controller.abort();
        return [[0, 1]];
      },
    })).rejects.toMatchObject({ name: "AbortError" });
    expect((await searchResearchVectorIndex(databaseRoot, databaseId, [1, 0], 10))[0]?.chunkId).toBe(original.chunkId);
  });

  it("rolls back a failed atomic swap and reports foreign identity damage", async () => {
    const databaseRoot = await root("rollback");
    const original = chunk({
      chunkId: "70000000-0000-4000-8000-000000000000",
      sourceId: "80000000-0000-4000-8000-000000000000",
      text: "original",
      embedding: [1, 0],
    });
    await rebuildResearchVectorIndex(databaseRoot, {
      researchDatabaseId: databaseId,
      ...identity,
      dimensions: 2,
      chunks: [original],
    });
    await expect(rebuildResearchVectorIndex(databaseRoot, {
      researchDatabaseId: databaseId,
      ...identity,
      dimensions: 2,
      chunks: [chunk({
        chunkId: "90000000-0000-4000-8000-000000000000",
        sourceId: "a0000000-0000-4000-8000-000000000000",
        text: "replacement",
        embedding: [0, 1],
      })],
    }, {
      hooks: { afterNewMoved: () => { throw new Error("swap probe"); } },
    })).rejects.toThrowError("swap probe");
    expect((await searchResearchVectorIndex(databaseRoot, databaseId, [1, 0], 10))[0]?.chunkId).toBe(original.chunkId);

    const database = new Database(researchVectorIndexDatabasePath(databaseRoot));
    database.pragma("application_id = 1");
    database.close();
    expect((await inspectResearchVectorIndex(databaseRoot, databaseId)).status).toBe("damaged");
  });
});
