import { describe, expect, it } from "vitest";
import {
  EmbeddingRouter,
  validateResearchEmbeddingCapability,
  type EmbeddingAdapter,
} from "../src/index.js";
import type { EmbeddingModelProfile } from "@novel-studio/contracts";

const profile: EmbeddingModelProfile = {
  schemaVersion: 1,
  id: "11111111-1111-4111-8111-111111111111",
  title: "Fixture",
  provider: "mock",
  baseUrl: null,
  endpointPath: "/embed",
  model: "fixture",
  credentialRef: null,
  dimensions: 3,
  maxInputTokens: 512,
  maxBatchSize: 32,
  maxConcurrentBatches: 1,
  normalize: true,
  supportsCustomDimensions: false,
  license: "test",
  createdAt: "2026-07-19T00:00:00.000Z",
  updatedAt: "2026-07-19T00:00:00.000Z",
  archivedAt: null,
};

function adapter(mode: "separated" | "collapsed"): EmbeddingAdapter {
  return {
    profile,
    async embedBatch(request) {
      return {
        vectors: request.inputs.map((input) => {
          if (mode === "collapsed") return [1, 0, 0];
          return input.id?.startsWith("n-") ? [0, 1, 0] : [1, 0, 0];
        }),
      };
    },
  };
}

function router(mode: "separated" | "collapsed"): EmbeddingRouter {
  const value = new EmbeddingRouter();
  value.registerProfile(profile, adapter(mode));
  return value;
}

const input = {
  supportedLanguageTags: ["zh-CN", "ja", "en"],
  sharedSpaceDeclared: true,
  documentPrefix: "passage: ",
  queryPrefix: "query: ",
};

describe("NS-605 multilingual Embedding capability validation", () => {
  it("passes separated Chinese, Japanese, and English positive and negative fixtures", async () => {
    const result = await validateResearchEmbeddingCapability(router("separated"), profile, "a".repeat(64), input, {
      now: () => new Date("2026-07-19T00:00:00.000Z"),
    });
    expect(result.validationStatus).toBe("passed");
    expect(result.metrics).toMatchObject({ positivePairMinimum: 1, negativePairMean: 0, separation: 1 });
  });

  it("fails a collapsed vector space instead of enabling semantic retrieval", async () => {
    const result = await validateResearchEmbeddingCapability(router("collapsed"), profile, "a".repeat(64), input);
    expect(result.validationStatus).toBe("failed");
    expect(result.metrics?.separation).toBe(0);
    expect(result.failureReason).toMatch(/did not meet/u);
  });

  it("fails before Provider use when declared language coverage is incomplete", async () => {
    let calls = 0;
    const value = new EmbeddingRouter();
    value.registerProfile(profile, {
      profile,
      async embedBatch(request) {
        calls += 1;
        return { vectors: request.inputs.map(() => [1, 0, 0]) };
      },
    });
    const result = await validateResearchEmbeddingCapability(value, profile, "a".repeat(64), {
      ...input,
      supportedLanguageTags: ["zh-CN", "ja", "fr"],
    });
    expect(result.validationStatus).toBe("failed");
    expect(calls).toBe(0);
  });
});
