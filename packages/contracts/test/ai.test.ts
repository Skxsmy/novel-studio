import { describe, expect, it } from "vitest";
import {
  CreateEmbeddingModelProfileInputSchema,
  CreateModelProfileInputSchema,
  EmbeddingModelProfileSchema,
  EmbeddingUseCaseBindingDocumentSchema,
  EmbeddingUseCaseBindingSchema,
  ModelCallLogSchema,
  ModelCallLogV2Schema,
  ModelProfileSchema,
  ModelProfileV2Schema,
  ModelParametersSchema,
  NewModelCallLogV2Schema,
  ProviderModelDescriptorSchema,
  ProviderReasoningControlSchema,
  ReasoningConfigurationSchema,
  UpdateEmbeddingModelProfileInputSchema,
  UpdateModelProfileInputSchema,
  modelCallLogV1RollbackSnapshot,
  modelProfileV1RollbackSnapshot,
  normalizeReasoningConfigurationForModel,
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
    expect(UpdateModelProfileInputSchema.parse({
      reasoningPreference: { mode: "effort", effort: "high" },
    })).toEqual({
      reasoningPreference: { mode: "effort", effort: "high" },
    });
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

describe("AI reasoning and authority version contracts", () => {
  const now = "2026-07-17T00:00:00.000Z";
  const profileV1 = {
    schemaVersion: 1 as const,
    id: "11111111-1111-4111-8111-111111111111",
    title: "OpenAI Writer",
    provider: "openai" as const,
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-5.6",
    credentialRef: null,
    defaultParameters: { temperature: 0.3 },
    capabilities: {
      streamText: true,
      structuredOutput: true,
      embeddings: false,
      tokenEstimate: true,
      modelList: true,
    },
    contextWindowTokens: 128000,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
  const callLogV1 = {
    schemaVersion: 1 as const,
    id: "22222222-2222-4222-8222-222222222222",
    seriesId: "33333333-3333-4333-8333-333333333333",
    sceneId: null,
    roleId: "workshop-general-chat",
    taskKind: "brainstorm" as const,
    provider: "openai" as const,
    model: "gpt-5.6",
    contextBundleId: "44444444-4444-4444-8444-444444444444",
    promptTemplateId: "55555555-5555-4555-8555-555555555555",
    promptTemplateVersion: 1,
    requestHash: "a".repeat(64),
    responseHash: null,
    status: "succeeded" as const,
    estimatedUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    actualUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    errorCode: null,
    errorMessage: null,
    error: null,
    startedAt: now,
    completedAt: now,
  };

  it("validates exact-model reasoning controls and normalized preferences", () => {
    const effortControl = ProviderReasoningControlSchema.parse({
      kind: "effort",
      efforts: ["low", "medium", "high"],
      defaultEffort: "medium",
      canDisable: true,
    });
    expect(normalizeReasoningConfigurationForModel(effortControl, null)).toEqual({
      mode: "effort",
      effort: "medium",
    });
    expect(normalizeReasoningConfigurationForModel(effortControl, {
      mode: "disabled",
    })).toEqual({ mode: "disabled" });
    expect(() => normalizeReasoningConfigurationForModel(effortControl, {
      mode: "effort",
      effort: "max",
    })).toThrow("not supported by the exact model");
    expect(() => normalizeReasoningConfigurationForModel(effortControl, {
      mode: "budget",
      budgetTokens: 2048,
    })).toThrow("outside the exact model range");
    expect(() => normalizeReasoningConfigurationForModel(effortControl, {
      mode: "enabled",
    })).toThrow("requires a specific reasoning option");

    const budgetControl = ProviderReasoningControlSchema.parse({
      kind: "budget",
      minimumTokens: 512,
      maximumTokens: 8192,
      defaultBudgetTokens: null,
      supportsDynamicBudget: true,
      canDisable: false,
    });
    expect(normalizeReasoningConfigurationForModel(budgetControl, null)).toEqual({ mode: "enabled" });
    expect(normalizeReasoningConfigurationForModel(budgetControl, {
      mode: "budget",
      budgetTokens: 1024,
    })).toEqual({ mode: "budget", budgetTokens: 1024 });
    expect(() => normalizeReasoningConfigurationForModel(budgetControl, {
      mode: "budget",
      budgetTokens: 256,
    })).toThrow("outside the exact model range");
    expect(() => normalizeReasoningConfigurationForModel(budgetControl, {
      mode: "effort",
      effort: "low",
    })).toThrow("not supported by the exact model");
    expect(() => normalizeReasoningConfigurationForModel(budgetControl, {
      mode: "disabled",
    })).toThrow("does not allow reasoning to be disabled");

    const toggleControl = ProviderReasoningControlSchema.parse({
      kind: "toggle",
      defaultEnabled: false,
      canDisable: true,
    });
    expect(normalizeReasoningConfigurationForModel(toggleControl, null)).toEqual({ mode: "enabled" });
    expect(() => normalizeReasoningConfigurationForModel(toggleControl, {
      mode: "effort",
      effort: "low",
    })).toThrow("not supported by the exact model");
    expect(ProviderReasoningControlSchema.safeParse({
      kind: "toggle",
      defaultEnabled: false,
      canDisable: false,
    }).success).toBe(false);
    expect(ProviderModelDescriptorSchema.safeParse({
      id: "unknown-model",
      title: "Unknown Model",
      contextWindowTokens: 8192,
      capabilities: profileV1.capabilities,
      reasoning: { kind: "unsupported" },
    }).success).toBe(true);
    expect(ReasoningConfigurationSchema.safeParse({ mode: "effort", effort: "none" }).success)
      .toBe(false);
  });

  it("reads version 1 model profiles as version 2 without inventing a reasoning preference", () => {
    const parsed = ModelProfileSchema.parse(profileV1);
    expect(parsed).toMatchObject({ schemaVersion: 2, reasoningPreference: null });
    expect(ModelProfileSchema.parse(parsed)).toEqual(parsed);
  });

  it("round-trips version 2 model profiles and produces exact version 1 rollback snapshots", () => {
    const version2 = ModelProfileV2Schema.parse({
      ...profileV1,
      schemaVersion: 2,
      reasoningPreference: { mode: "effort", effort: "high" },
    });
    expect(ModelProfileSchema.parse(JSON.parse(JSON.stringify(version2)))).toEqual(version2);
    const snapshot = modelProfileV1RollbackSnapshot(version2);
    expect(snapshot.profile).toEqual(profileV1);
    expect(snapshot.profile).not.toHaveProperty("reasoningPreference");
    expect(snapshot.reasoningPreferenceBackup).toEqual({ mode: "effort", effort: "high" });
  });

  it("reads version 1 model call logs as version 2 without inventing resolved parameters", () => {
    const parsed = ModelCallLogSchema.parse(callLogV1);
    expect(parsed).toMatchObject({ schemaVersion: 2, resolvedParameters: null });
    expect(ModelCallLogSchema.parse(parsed)).toEqual(parsed);
    expect(ModelCallLogV2Schema.safeParse(parsed).success).toBe(true);
    expect(NewModelCallLogV2Schema.safeParse(parsed).success).toBe(false);
  });

  it("round-trips version 2 model call logs and produces exact version 1 rollback snapshots", () => {
    const version2 = NewModelCallLogV2Schema.parse({
      ...callLogV1,
      schemaVersion: 2,
      resolvedParameters: {
        temperature: 0.3,
        reasoning: { mode: "effort", effort: "high" },
      },
    });
    expect(ModelCallLogSchema.parse(JSON.parse(JSON.stringify(version2)))).toEqual(version2);
    const snapshot = modelCallLogV1RollbackSnapshot(version2);
    expect(snapshot.log).toEqual(callLogV1);
    expect(snapshot.log).not.toHaveProperty("resolvedParameters");
    expect(snapshot.resolvedParametersBackup).toEqual(version2.resolvedParameters);
  });

  it("rejects cancelled model call errors across version 1 compatibility and version 2", () => {
    const cancelledLog = {
      ...callLogV1,
      schemaVersion: 2 as const,
      status: "cancelled" as const,
      resolvedParameters: {},
      actualUsage: null,
      errorCode: null,
      errorMessage: null,
      error: null,
    };
    expect(ModelCallLogV2Schema.safeParse(cancelledLog).success).toBe(true);
    expect(NewModelCallLogV2Schema.safeParse(cancelledLog).success).toBe(true);
    const { resolvedParameters: _resolvedParameters, ...cancelledVersion1Log } = cancelledLog;
    expect(ModelCallLogSchema.parse({
      ...cancelledVersion1Log,
      schemaVersion: 1,
    })).toMatchObject({
      schemaVersion: 2,
      status: "cancelled",
      resolvedParameters: null,
      errorCode: null,
      errorMessage: null,
      error: null,
    });

    const forbiddenErrorDetails = [
      { errorCode: "provider-unavailable" },
      { errorMessage: "The cancelled call must not retain this error message." },
      {
        error: {
          code: "provider-unavailable",
          message: "Retryable transport failure",
          retryable: true,
          providerStatus: 503,
          rawErrorHash: null,
        },
      },
    ];
    for (const errorDetails of forbiddenErrorDetails) {
      const invalidLog = { ...cancelledLog, ...errorDetails };
      expect(ModelCallLogV2Schema.safeParse(invalidLog).success).toBe(false);
      expect(NewModelCallLogV2Schema.safeParse(invalidLog).success).toBe(false);
      expect(ModelCallLogSchema.safeParse(invalidLog).success).toBe(false);
      const { resolvedParameters: _invalidResolvedParameters, ...invalidVersion1Log } = invalidLog;
      expect(ModelCallLogSchema.safeParse({
        ...invalidVersion1Log,
        schemaVersion: 1,
      }).success).toBe(false);
    }
  });

  it("rejects transport-owned native model parameters while retaining safe extensions", () => {
    const transportOwnedKeys = [
      "model",
      "stream",
      "stream_options",
      "messages",
      "contents",
      "system",
      "systemInstruction",
      "tools",
      "tool_choice",
      "toolChoice",
      "parallel_tool_calls",
      "toolConfig",
      "reasoning_effort",
      "reasoning_enabled",
      "reasoning_max_tokens",
      "thinking",
      "thinkingConfig",
      "thinking_budget",
      "thinkingLevel",
      "includeThoughts",
      "output_config",
      "max_tokens",
      "max_completion_tokens",
      "top_p",
      "response_format",
      "responseMimeType",
      "responseSchema",
      "responseJsonSchema",
      "generationConfig",
    ];
    for (const key of transportOwnedKeys) {
      expect(ModelParametersSchema.safeParse({ [key]: "override" }).success).toBe(false);
    }
    expect(ModelParametersSchema.safeParse({
      temperature: 0.4,
      topP: 0.8,
      maxOutputTokens: 4096,
      reasoning: { mode: "enabled" },
      seed: 42,
      frequency_penalty: 0.2,
      stop: "END",
    }).success).toBe(true);
  });

  it("rejects credential-like model parameters without echoing their values", () => {
    const sensitiveKeys = [
      "apiKey",
      "API_KEY",
      "api-key",
      "authorization",
      "Bearer",
      "token",
      "access_token",
      "credential",
      "cookie",
      "clientSecret",
    ];
    for (const key of sensitiveKeys) {
      const secret = "sk-sensitive-value-must-not-appear";
      const result = ModelParametersSchema.safeParse({ [key]: secret });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(JSON.stringify(result.error.issues)).not.toContain(secret);
      }
      expect(NewModelCallLogV2Schema.safeParse({
        ...callLogV1,
        schemaVersion: 2,
        resolvedParameters: { [key]: secret },
      }).success).toBe(false);
    }
    expect(ModelParametersSchema.safeParse({
      seed: 42,
      frequency_penalty: 0.2,
    }).success).toBe(true);
    const secretValueResult = ModelParametersSchema.safeParse({
      providerHint: "Bearer credential-value-must-not-appear",
    });
    expect(secretValueResult.success).toBe(false);
    if (!secretValueResult.success) {
      expect(JSON.stringify(secretValueResult.error.issues)).not.toContain(
        "credential-value-must-not-appear",
      );
    }
  });
});
