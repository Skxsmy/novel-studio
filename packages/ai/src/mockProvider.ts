import { createHash } from "node:crypto";
import type { z } from "zod";
import {
  ModelCallErrorSchema,
  TokenUsageSchema,
  type ContextBundle,
  type ModelCallError,
  type ModelProfile,
  type TokenUsage,
} from "@novel-studio/contracts";
import { classifyProviderError, ProviderAdapterError } from "./errors.js";
import type {
  ProviderAdapter,
  ProviderConnectionResult,
  ProviderDescriptor,
  ProviderEmbeddingRequest,
  ProviderModelDescriptor,
  ProviderObjectRequest,
  ProviderPrompt,
  ProviderTextRequest,
} from "./provider.js";

const MOCK_CAPABILITIES = {
  streamText: true,
  structuredOutput: true,
  embeddings: true,
  tokenEstimate: true,
  modelList: true,
} as const;

const MOCK_MODELS: ProviderModelDescriptor[] = [
  {
    id: "mock-writer-v1",
    title: "Mock 主笔模型",
    contextWindowTokens: 32000,
    capabilities: MOCK_CAPABILITIES,
  },
  {
    id: "mock-continuity-v1",
    title: "Mock 连续性模型",
    contextWindowTokens: 32000,
    capabilities: MOCK_CAPABILITIES,
  },
  {
    id: "mock-small-context",
    title: "Mock 小上下文模型",
    contextWindowTokens: 64,
    capabilities: MOCK_CAPABILITIES,
  },
];

function scenarioFromProfile(modelProfile: ModelProfile): string {
  return modelProfile.model.replace(/^mock-/u, "");
}

function textToChunks(value: string): string[] {
  return value.match(/.{1,12}/gu) ?? [];
}

function countTokensApprox(value: string): number {
  return Math.ceil(Array.from(value).length / 2);
}

function promptText(prompt: ProviderPrompt): string {
  return [prompt.system, prompt.instructions, prompt.user].join("\n\n");
}

function contextText(request: ProviderTextRequest): string {
  const context = request.contextBundle?.items.map((item) => item.content).join("\n\n") ?? "";
  return [promptText(request.prompt), context].filter(Boolean).join("\n\n");
}

export class MockProvider implements ProviderAdapter {
  readonly provider = "mock" as const;

  describeCapabilities(): ProviderDescriptor {
    return {
      provider: this.provider,
      title: "MockProvider",
      capabilities: MOCK_CAPABILITIES,
      models: MOCK_MODELS,
    };
  }

  async testConnection(modelProfile: ModelProfile): Promise<ProviderConnectionResult> {
    try {
      this.assertProfileProvider(modelProfile);
      this.throwForScenario(modelProfile);
      return {
        ok: true,
        provider: this.provider,
        modelProfileId: modelProfile.id,
        capabilities: modelProfile.capabilities,
        models: await this.listModels(modelProfile),
        error: null,
      };
    } catch (error) {
      return {
        ok: false,
        provider: this.provider,
        modelProfileId: modelProfile.id,
        capabilities: modelProfile.capabilities,
        models: [],
        error: this.classifyError(error),
      };
    }
  }

  async listModels(modelProfile: ModelProfile): Promise<ProviderModelDescriptor[]> {
    this.assertProfileProvider(modelProfile);
    return MOCK_MODELS;
  }

  async *streamText(request: ProviderTextRequest): AsyncIterable<string> {
    this.assertProfileProvider(request.modelProfile);
    this.throwForScenario(request.modelProfile);
    this.assertContextFits(request);
    const writingCandidateTasks = new Set(["draft", "rewrite", "expand", "compress"]);
    const response = writingCandidateTasks.has(request.contextBundle?.taskKind ?? "")
      ? [
        "【MockProvider 候选正文】",
        "旧钟声贴着雨幕往下坠，像有人在城墙深处轻轻合上了一扇门。",
        "林岚没有回头，只把那枚铜钥匙攥得更紧。",
      ].join("\n")
      : [
        "【MockProvider】",
        `模型：${request.modelProfile.model}`,
        "这是一段非写入型分析结果。",
        "它不会修改正文、已确认设定或任何故事资料文件。",
      ].join("\n");
    for (const chunk of textToChunks(response)) {
      if (request.abortSignal?.aborted) {
        throw new ProviderAdapterError("provider-error", "MockProvider 调用已取消", {
          retryable: false,
        });
      }
      yield chunk;
    }
  }

  async generateObject<T>(
    request: ProviderObjectRequest,
    schema: z.ZodType<T>,
  ): Promise<T> {
    this.assertProfileProvider(request.modelProfile);
    this.throwForScenario(request.modelProfile);
    this.assertContextFits(request);
    const object = {
      provider: this.provider,
      model: request.modelProfile.model,
      outputSchemaName: request.outputSchemaName,
      summary: "MockProvider 结构化输出。",
      safeToWrite: false,
    };
    return schema.parse(object);
  }

  async embed(request: ProviderEmbeddingRequest): Promise<number[]> {
    this.assertProfileProvider(request.modelProfile);
    this.throwForScenario(request.modelProfile);
    const hash = createHash("sha256").update(request.input, "utf8").digest();
    return Array.from(hash.subarray(0, 8)).map((value) => Number((value / 255).toFixed(6)));
  }

  estimateTokens(input: string | ContextBundle | ProviderPrompt): TokenUsage {
    const text = typeof input === "string"
      ? input
      : "items" in input
        ? input.items.map((item) => item.content).join("\n\n")
        : promptText(input);
    const inputTokens = countTokensApprox(text);
    return TokenUsageSchema.parse({
      inputTokens,
      outputTokens: 0,
      totalTokens: inputTokens,
    });
  }

  classifyError(error: unknown): ModelCallError {
    return classifyProviderError(error);
  }

  private assertContextFits(request: ProviderTextRequest): void {
    const estimated = this.estimateTokens(contextText(request)).totalTokens;
    if (estimated > request.modelProfile.contextWindowTokens) {
      throw new ProviderAdapterError("context-too-large", "MockProvider 上下文超过模型窗口。", {
        retryable: false,
      });
    }
  }

  private assertProfileProvider(modelProfile: ModelProfile): void {
    if (modelProfile.provider !== this.provider) {
      throw new ProviderAdapterError("provider-error", "ModelProfile 与 MockProvider 不匹配。", {
        retryable: false,
      });
    }
  }

  private throwForScenario(modelProfile: ModelProfile): void {
    const scenario = scenarioFromProfile(modelProfile);
    if (scenario.includes("auth-failure")) {
      throw new ProviderAdapterError("provider-auth-failed", "MockProvider 认证失败。", {
        providerStatus: 401,
      });
    }
    if (scenario.includes("rate-limit")) {
      throw new ProviderAdapterError("provider-rate-limited", "MockProvider 限流。", {
        retryable: true,
        providerStatus: 429,
      });
    }
    if (scenario.includes("model-unavailable")) {
      throw new ProviderAdapterError("model-unavailable", "MockProvider 模型不可用。", {
        retryable: true,
        providerStatus: 503,
      });
    }
    if (scenario.includes("structured-failure")) {
      throw new ProviderAdapterError("structured-output-failed", "MockProvider 结构化输出失败。", {
        retryable: false,
        providerStatus: 502,
      });
    }
    if (scenario.includes("provider-error")) {
      throw new ProviderAdapterError("provider-error", "MockProvider 协议错误。", {
        retryable: false,
        providerStatus: 502,
      });
    }
    if (scenario.includes("unknown-error")) {
      throw new Error("MockProvider unknown failure");
    }
  }
}

export function mockError(code: ModelCallError["code"], message = "MockProvider 错误"): ModelCallError {
  return ModelCallErrorSchema.parse({
    code,
    message,
    retryable: false,
    providerStatus: null,
    rawErrorHash: null,
  });
}
