import { describe, expect, it } from "vitest";
import {
  CreateEmbeddingModelProfileInputSchema,
  CreateModelProfileInputSchema,
  EmbeddingModelProfileSchema,
  EmbeddingUseCaseBindingDocumentSchema,
  EmbeddingUseCaseBindingSchema,
  UpdateEmbeddingModelProfileInputSchema,
  UpdateModelProfileInputSchema,
} from "../src/ai.js";

describe("AI model profile contracts", () => {
  it("keeps credential references out of ordinary profile create and update payloads", () => {
    const baseInput = {
      title: "DeepSeek",
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
    };

    expect(CreateModelProfileInputSchema.safeParse(baseInput).success).toBe(true);
    expect(UpdateModelProfileInputSchema.safeParse({ title: "DeepSeek Updated" }).success).toBe(true);
    expect(CreateModelProfileInputSchema.safeParse({
      ...baseInput,
      credentialRef: "novel-studio/model-profile/profile-id",
    }).success).toBe(false);
    expect(UpdateModelProfileInputSchema.safeParse({
      credentialRef: null,
      title: "DeepSeek Updated",
    }).success).toBe(false);
  });

  it("defines separate embedding profiles and use-case bindings without accepting plaintext credentials", () => {
    const baseInput = {
      title: "BGE Small zh",
      provider: "local-http",
      baseUrl: "http://127.0.0.1:8080",
      endpointPath: "/embed",
      model: "BAAI/bge-small-zh-v1.5",
      dimensions: 512,
      maxInputTokens: 512,
      maxBatchSize: 32,
      maxConcurrentBatches: 2,
      normalize: true,
      supportsCustomDimensions: false,
      license: "MIT",
    };

    expect(CreateEmbeddingModelProfileInputSchema.safeParse(baseInput).success).toBe(true);
    expect(UpdateEmbeddingModelProfileInputSchema.safeParse({ maxConcurrentBatches: 4 }).success).toBe(true);
    expect(CreateEmbeddingModelProfileInputSchema.safeParse({
      ...baseInput,
      credentialRef: "novel-studio/embedding-profile/profile-id",
    }).success).toBe(false);
    expect(UpdateEmbeddingModelProfileInputSchema.safeParse({
      credentialRef: null,
      title: "BGE Updated",
    }).success).toBe(false);
    expect(EmbeddingUseCaseBindingSchema.safeParse({
      useCase: "codex.detail-schema",
      profileId: "11111111-1111-4111-8111-111111111111",
    }).success).toBe(true);
    expect(EmbeddingUseCaseBindingSchema.safeParse({
      useCase: "Codex Detail Schema",
      profileId: "11111111-1111-4111-8111-111111111111",
    }).success).toBe(false);
    expect(EmbeddingUseCaseBindingDocumentSchema.safeParse({
      schemaVersion: 1,
      useCase: "codex.detail-schema",
      profileId: "11111111-1111-4111-8111-111111111111",
      updatedAt: "2026-07-13T00:00:00.000Z",
    }).success).toBe(true);
  });

  it("keeps embedding profile metadata explicit enough for rebuildable vector indexes", () => {
    const now = "2026-07-08T00:00:00.000Z";
    const parsed = EmbeddingModelProfileSchema.parse({
      schemaVersion: 1,
      id: "11111111-1111-4111-8111-111111111111",
      title: "BGE Small zh",
      provider: "local-http",
      baseUrl: "http://127.0.0.1:8080",
      endpointPath: "/embed",
      model: "BAAI/bge-small-zh-v1.5",
      credentialRef: null,
      dimensions: 512,
      maxInputTokens: 512,
      maxBatchSize: 32,
      maxConcurrentBatches: 2,
      normalize: true,
      supportsCustomDimensions: false,
      license: "MIT",
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    });

    expect(parsed).toMatchObject({
      model: "BAAI/bge-small-zh-v1.5",
      dimensions: 512,
      maxConcurrentBatches: 2,
      normalize: true,
    });
  });
});
