import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  EmbeddingModelProfileSchema,
  type EmbeddingModelProfile,
} from "@novel-studio/contracts";
import {
  bgeSmallZhV15EmbeddingDefaults,
  EmbeddingRouter,
  type EmbeddingAdapter,
  type EmbeddingBatchAdapterRequest,
} from "../src/index.js";

const NOW = "2026-07-08T00:00:00.000Z";

function embeddingProfile(overrides: Partial<EmbeddingModelProfile> = {}): EmbeddingModelProfile {
  return EmbeddingModelProfileSchema.parse({
    schemaVersion: 1,
    id: randomUUID(),
    title: "Mock Embedding",
    provider: "mock",
    baseUrl: null,
    endpointPath: "/embed",
    model: "mock-embedding-small",
    credentialRef: null,
    dimensions: 4,
    maxInputTokens: 512,
    maxBatchSize: 2,
    maxConcurrentBatches: 1,
    normalize: false,
    supportsCustomDimensions: false,
    license: "MIT",
    createdAt: NOW,
    updatedAt: NOW,
    archivedAt: null,
    ...overrides,
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe("EmbeddingRouter and adapters", () => {
  it("exposes the default local BGE Small zh v1.5 profile shape", () => {
    expect(bgeSmallZhV15EmbeddingDefaults()).toMatchObject({
      provider: "local-http",
      baseUrl: "http://127.0.0.1:8080",
      endpointPath: "/embed",
      model: "BAAI/bge-small-zh-v1.5",
      dimensions: 512,
      maxInputTokens: 512,
      normalize: true,
      license: "MIT",
    });
  });

  it("batches local HTTP embedding calls and parses embedding response shapes", async () => {
    const profile = embeddingProfile({
      provider: "local-http",
      baseUrl: "http://127.0.0.1:8090",
      model: "BAAI/bge-small-zh-v1.5",
      dimensions: 3,
      maxBatchSize: 2,
      maxConcurrentBatches: 1,
      normalize: false,
    });
    const requests: Array<{ url: string; body: unknown }> = [];
    const router = new EmbeddingRouter({
      fetchImpl: async (input, init) => {
        const body = JSON.parse(String(init?.body)) as { inputs: string[]; model: string };
        requests.push({ url: String(input), body });
        return new Response(JSON.stringify({
          embeddings: body.inputs.map((text) => [text.length, text.length + 1, text.length + 2]),
        }), { status: 200, headers: { "content-type": "application/json" } });
      },
    });
    router.registerProfile(profile);

    const result = await router.embed({
      profileId: profile.id,
      inputs: [
        { id: "first", text: "星坠晶" },
        { id: "second", text: "能量储存" },
        { id: "third", text: "同频共鸣" },
      ],
    });

    expect(result).toMatchObject({
      profileId: profile.id,
      provider: "local-http",
      model: "BAAI/bge-small-zh-v1.5",
      dimensions: 3,
      batchCount: 2,
    });
    expect(requests).toHaveLength(2);
    expect(requests[0]).toMatchObject({
      url: "http://127.0.0.1:8090/embed",
      body: { model: "BAAI/bge-small-zh-v1.5", inputs: ["星坠晶", "能量储存"] },
    });
    expect(result.vectors.map((item) => item.inputId)).toEqual(["first", "second", "third"]);
    expect(result.vectors[0]?.vector).toEqual([3, 4, 5]);
    expect(result.vectors[0]?.textHash).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("normalizes vectors when the profile requires normalized output", async () => {
    const profile = embeddingProfile({
      provider: "local-http",
      baseUrl: "http://127.0.0.1:8090",
      dimensions: 2,
      normalize: true,
    });
    const router = new EmbeddingRouter({
      fetchImpl: async () => new Response(JSON.stringify({ embeddings: [[3, 4]] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    });
    router.registerProfile(profile);

    const result = await router.embed({ profileId: profile.id, inputs: ["归一化"] });

    expect(result.normalized).toBe(true);
    expect(result.vectors[0]?.vector[0]).toBeCloseTo(0.6);
    expect(result.vectors[0]?.vector[1]).toBeCloseTo(0.8);
  });

  it("runs different embedding profiles concurrently instead of using a global single queue", async () => {
    let active = 0;
    let maxActive = 0;
    const adapterFor = (profile: EmbeddingModelProfile): EmbeddingAdapter => ({
      profile,
      async embedBatch(request: EmbeddingBatchAdapterRequest) {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await delay(20);
        active -= 1;
        return {
          vectors: request.inputs.map(() => Array.from({ length: profile.dimensions }, () => 1)),
        };
      },
    });
    const first = embeddingProfile({ model: "mock-codex-schema", dimensions: 4, maxConcurrentBatches: 1 });
    const second = embeddingProfile({ model: "mock-reference-search", dimensions: 6, maxConcurrentBatches: 1 });
    const router = new EmbeddingRouter();
    router.registerProfile(first, adapterFor(first));
    router.registerProfile(second, adapterFor(second));
    router.bindUseCase("codex.detail-schema", first.id);
    router.bindUseCase("reference.semantic-search", second.id);

    await Promise.all([
      router.embed({ useCase: "codex.detail-schema", inputs: ["外貌", "物质特性"] }),
      router.embed({ useCase: "reference.semantic-search", inputs: ["钟楼囚禁"] }),
    ]);

    expect(maxActive).toBe(2);
  });

  it("keeps same-profile batch concurrency bounded by maxConcurrentBatches", async () => {
    let active = 0;
    let maxActive = 0;
    const profile = embeddingProfile({ maxBatchSize: 1, maxConcurrentBatches: 1 });
    const adapter: EmbeddingAdapter = {
      profile,
      async embedBatch(request: EmbeddingBatchAdapterRequest) {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await delay(5);
        active -= 1;
        return {
          vectors: request.inputs.map(() => Array.from({ length: profile.dimensions }, () => 1)),
        };
      },
    };
    const router = new EmbeddingRouter();
    router.registerProfile(profile, adapter);

    await router.embed({ profileId: profile.id, inputs: ["一", "二", "三"] });

    expect(maxActive).toBe(1);
  });

  it("routes separate use cases to different embedding models and dimensions", async () => {
    const codexProfile = embeddingProfile({ model: "mock-codex-schema", dimensions: 4 });
    const referenceProfile = embeddingProfile({ model: "mock-reference-search", dimensions: 6 });
    const router = new EmbeddingRouter();
    router.registerProfile(codexProfile);
    router.registerProfile(referenceProfile);
    router.bindUseCase("codex.detail-schema", codexProfile.id);
    router.bindUseCase("reference.semantic-search", referenceProfile.id);

    const codex = await router.embed({ useCase: "codex.detail-schema", inputs: ["外貌"] });
    const reference = await router.embed({ useCase: "reference.semantic-search", inputs: ["外部资料"] });

    expect(codex.model).toBe("mock-codex-schema");
    expect(codex.dimensions).toBe(4);
    expect(codex.vectors[0]?.vector).toHaveLength(4);
    expect(reference.model).toBe("mock-reference-search");
    expect(reference.dimensions).toBe(6);
    expect(reference.vectors[0]?.vector).toHaveLength(6);
  });
});
