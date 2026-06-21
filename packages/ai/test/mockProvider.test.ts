import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ContextBundleSchema,
  ModelProfileSchema,
  type ContextBundle,
  type ModelCapability,
  type ModelProfile,
} from "@novel-studio/contracts";
import {
  MockProvider,
  OpenAiCompatibleProvider,
  ProviderAdapterError,
  assertSafeCredentialRef,
  classifyProviderError,
  createDefaultProviderRegistry,
  isLikelySecret,
  type CredentialStore,
} from "../src/index.js";

const NOW = "2026-06-21T00:00:00.000Z";
const HASH = "a".repeat(64);
const CAPABILITIES: ModelCapability = {
  streamText: true,
  structuredOutput: true,
  embeddings: true,
  tokenEstimate: true,
  modelList: true,
};

function modelProfile(overrides: Partial<ModelProfile> = {}): ModelProfile {
  return ModelProfileSchema.parse({
    schemaVersion: 1,
    id: randomUUID(),
    title: "Mock 连续性模型",
    provider: "mock",
    model: "mock-continuity-v1",
    cloudPolicy: "local-only",
    credentialRef: null,
    defaultParameters: { temperature: 0.2 },
    capabilities: CAPABILITIES,
    contextWindowTokens: 32000,
    createdAt: NOW,
    updatedAt: NOW,
    archivedAt: null,
    ...overrides,
  });
}

function contextBundle(content = "当前场景：雨夜，主角发现信件。"): ContextBundle {
  const seriesId = randomUUID();
  const sceneId = randomUUID();
  const promptTemplateId = randomUUID();
  return ContextBundleSchema.parse({
    schemaVersion: 1,
    id: randomUUID(),
    seriesId,
    sceneId,
    roleId: "continuity-editor",
    taskKind: "continuity-check",
    userRequest: "检查当前场景是否存在连续性问题。",
    promptTemplateId,
    promptTemplateVersion: 1,
    items: [
      {
        id: "current-scene",
        kind: "scene",
        source: {
          type: "scene",
          id: sceneId,
          revision: HASH,
          label: "雨夜来信",
        },
        title: "当前场景",
        content,
        inclusion: "required",
        inclusionReason: "当前写作场景",
        access: "local-only",
        contextPolicy: "always",
        tokenEstimate: 40,
        manuallySelected: false,
        textHash: HASH,
      },
    ],
    excluded: [
      {
        source: {
          type: "codex-entry",
          id: randomUUID(),
          revision: null,
          label: "后文真相",
        },
        reason: "future-information",
        title: "后文真相",
        note: "当前场景之后才揭示。",
      },
    ],
    estimatedUsage: { inputTokens: 40, outputTokens: 0, totalTokens: 40 },
    createdAt: NOW,
  });
}

function prompt() {
  return {
    system: "你是中文长篇小说的连续性编辑。",
    instructions: "只做分析，不能直接修改正文或已确认设定。",
    user: "指出当前场景需要注意的连续性问题。",
  };
}

async function collect(iterable: AsyncIterable<string>): Promise<string> {
  const chunks: string[] = [];
  for await (const chunk of iterable) {
    chunks.push(chunk);
  }
  return chunks.join("");
}

function fakeCredentialStore(secret = "test-deepseek-key"): CredentialStore {
  return {
    kind: "windows-credential-manager",
    async isAvailable() {
      return true;
    },
    async writeSecret() {
      return undefined;
    },
    async readSecret() {
      return secret;
    },
    async deleteSecret() {
      return undefined;
    },
  };
}

function sseResponse(...events: string[]): Response {
  const body = events.map((event) => `data: ${event}\n\n`).join("");
  return new Response(new TextEncoder().encode(body), {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

describe("ProviderAdapter core and MockProvider", () => {
  it("registers MockProvider, generic OpenAI-compatible and DeepSeek providers", () => {
    const registry = createDefaultProviderRegistry({ credentialStore: fakeCredentialStore() });

    expect(registry.list().map((adapter) => adapter.provider)).toEqual(["mock", "openai-compatible", "deepseek"]);
    expect(registry.get("mock")).toBeInstanceOf(MockProvider);
    expect(() => registry.get("openai")).toThrow("Provider is not registered");
  });

  it("describes capabilities, tests connection and lists models", async () => {
    const provider = new MockProvider();
    const profile = modelProfile();

    const descriptor = provider.describeCapabilities();
    expect(descriptor).toMatchObject({
      provider: "mock",
      title: "MockProvider",
      capabilities: { streamText: true, structuredOutput: true },
    });
    expect(descriptor.models.map((item) => item.id)).toContain("mock-continuity-v1");

    await expect(provider.listModels(profile)).resolves.toEqual(descriptor.models);
    await expect(provider.testConnection(profile)).resolves.toMatchObject({
      ok: true,
      provider: "mock",
      modelProfileId: profile.id,
      error: null,
    });
  });

  it("streams non-writing text and keeps generated output outside story files", async () => {
    const provider = new MockProvider();
    const text = await collect(provider.streamText({
      modelProfile: modelProfile(),
      prompt: prompt(),
      contextBundle: contextBundle(),
    }));

    expect(text).toContain("非写入型分析结果");
    expect(text).toContain("不会修改正文、已确认设定或任何故事资料文件");
  });

  it("generates validated structured output marked unsafe to write directly", async () => {
    const provider = new MockProvider();
    const schema = z.object({
      provider: z.literal("mock"),
      model: z.literal("mock-continuity-v1"),
      outputSchemaName: z.literal("continuity_report"),
      summary: z.string().min(1),
      safeToWrite: z.literal(false),
    });

    await expect(provider.generateObject({
      modelProfile: modelProfile(),
      prompt: prompt(),
      contextBundle: contextBundle(),
      outputSchemaName: "continuity_report",
    }, schema)).resolves.toEqual({
      provider: "mock",
      model: "mock-continuity-v1",
      outputSchemaName: "continuity_report",
      summary: "MockProvider 结构化输出。",
      safeToWrite: false,
    });
  });

  it("estimates tokens and creates deterministic embeddings", async () => {
    const provider = new MockProvider();
    const profile = modelProfile();
    const bundle = contextBundle("霓虹灯下，林岚藏起一把旧钥匙。");

    expect(provider.estimateTokens("四个汉字").totalTokens).toBeGreaterThan(0);
    expect(provider.estimateTokens(bundle).inputTokens).toBeGreaterThan(0);
    expect(provider.estimateTokens(prompt()).inputTokens).toBeGreaterThan(0);

    const first = await provider.embed({ modelProfile: profile, input: "同一段文本" });
    const second = await provider.embed({ modelProfile: profile, input: "同一段文本" });
    expect(first).toHaveLength(8);
    expect(second).toEqual(first);
  });

  it("simulates auth failure, rate limit and unavailable models through testConnection", async () => {
    const provider = new MockProvider();

    await expect(provider.testConnection(modelProfile({ model: "mock-auth-failure" }))).resolves.toMatchObject({
      ok: false,
      error: { code: "provider-auth-failed", retryable: false, providerStatus: 401 },
    });
    await expect(provider.testConnection(modelProfile({ model: "mock-rate-limit" }))).resolves.toMatchObject({
      ok: false,
      error: { code: "provider-rate-limited", retryable: true, providerStatus: 429 },
    });
    await expect(provider.testConnection(modelProfile({ model: "mock-model-unavailable" }))).resolves.toMatchObject({
      ok: false,
      error: { code: "model-unavailable", retryable: true, providerStatus: 503 },
    });
  });

  it("refuses over-budget context before streaming or structured output", async () => {
    const provider = new MockProvider();
    const tinyProfile = modelProfile({
      model: "mock-small-context",
      contextWindowTokens: 8,
    });
    const oversized = contextBundle("过长上下文".repeat(200));

    await expect(collect(provider.streamText({
      modelProfile: tinyProfile,
      prompt: prompt(),
      contextBundle: oversized,
    }))).rejects.toMatchObject({
      code: "context-too-large",
    });

    await expect(provider.generateObject({
      modelProfile: tinyProfile,
      prompt: prompt(),
      contextBundle: oversized,
      outputSchemaName: "continuity_report",
    }, z.object({ safeToWrite: z.boolean() }))).rejects.toMatchObject({
      code: "context-too-large",
    });
  });

  it("classifies provider errors without leaking raw error text", () => {
    expect(classifyProviderError(new ProviderAdapterError(
      "structured-output-failed",
      "结构化输出不符合约定。",
      { retryable: false, providerStatus: 502 },
    ))).toMatchObject({
      code: "structured-output-failed",
      message: "结构化输出不符合约定。",
      retryable: false,
      providerStatus: 502,
    });

    expect(classifyProviderError(new Error("Too many requests from provider"))).toMatchObject({
      code: "provider-rate-limited",
      retryable: true,
      providerStatus: 429,
    });

    const unknown = classifyProviderError({ detail: "opaque provider payload" });
    expect(unknown).toMatchObject({
      code: "unknown",
      message: "未知 Provider 错误",
      retryable: false,
      providerStatus: null,
    });
    expect(unknown.rawErrorHash).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("rejects profiles routed to the wrong adapter", async () => {
    const provider = new MockProvider();

    await expect(provider.testConnection(modelProfile({ provider: "openai" }))).resolves.toMatchObject({
      ok: false,
      error: { code: "provider-error" },
    });
  });

  it("connects to a DeepSeek profile and streams text through the DeepSeek-compatible SSE contract", async () => {
    const requests: Array<{ url: string; authorization: string | null; body?: unknown }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      requests.push({
        url,
        authorization: headers.get("authorization"),
        body: init?.body ? JSON.parse(String(init.body)) as unknown : undefined,
      });
      if (url.endsWith("/models")) {
        return new Response(JSON.stringify({
          object: "list",
          data: [
            { id: "deepseek-v4-flash", object: "model", owned_by: "deepseek" },
            { id: "deepseek-v4-pro", object: "model", owned_by: "deepseek" },
          ],
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.endsWith("/chat/completions")) {
        return sseResponse(
          JSON.stringify({ choices: [{ delta: { content: "雨声" } }] }),
          JSON.stringify({ choices: [{ delta: { content: "压低了脚步。" } }] }),
          "[DONE]",
        );
      }
      return new Response("not found", { status: 404 });
    };
    const provider = new OpenAiCompatibleProvider({
      credentialStore: fakeCredentialStore("deepseek-test-key"),
      fetchImpl,
      provider: "deepseek",
      title: "DeepSeek",
      defaultBaseUrl: "https://api.deepseek.com",
      models: [
        {
          id: "deepseek-v4-flash",
          title: "DeepSeek V4 Flash",
          contextWindowTokens: 1_000_000,
          capabilities: {
            streamText: true,
            structuredOutput: true,
            embeddings: false,
            tokenEstimate: true,
            modelList: true,
          },
        },
        {
          id: "deepseek-v4-pro",
          title: "DeepSeek V4 Pro",
          contextWindowTokens: 1_000_000,
          capabilities: {
            streamText: true,
            structuredOutput: true,
            embeddings: false,
            tokenEstimate: true,
            modelList: true,
          },
        },
      ],
    });
    const profile = modelProfile({
      title: "DeepSeek 写作模型",
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      cloudPolicy: "cloud-allowed",
      credentialRef: "novel-studio/model-profile/test",
      capabilities: {
        streamText: true,
        structuredOutput: true,
        embeddings: false,
        tokenEstimate: true,
        modelList: true,
      },
      contextWindowTokens: 1_000_000,
    });

    await expect(provider.testConnection(profile)).resolves.toMatchObject({
      ok: true,
      provider: "deepseek",
      models: [
        { id: "deepseek-v4-flash" },
        { id: "deepseek-v4-pro" },
      ],
    });

    await expect(collect(provider.streamText({
      modelProfile: profile,
      prompt: prompt(),
      contextBundle: contextBundle(),
      parameters: { temperature: 0.3, maxOutputTokens: 128 },
    }))).resolves.toBe("雨声压低了脚步。");

    expect(requests.some((request) => request.url === "https://api.deepseek.com/models")).toBe(true);
    const chatRequest = requests.find((request) => request.url === "https://api.deepseek.com/chat/completions");
    expect(chatRequest?.authorization).toBe("Bearer deepseek-test-key");
    expect(chatRequest?.body).toMatchObject({
      model: "deepseek-v4-flash",
      stream: true,
      temperature: 0.3,
      max_tokens: 128,
    });
  });

  it("keeps generic OpenAI-compatible profiles separate from DeepSeek defaults", async () => {
    const provider = new OpenAiCompatibleProvider({
      credentialStore: fakeCredentialStore("generic-key"),
      fetchImpl: async (input) => {
        expect(String(input)).toBe("https://example.test/v1/models");
        return new Response(JSON.stringify({
          object: "list",
          data: [{ id: "provider-model-a", object: "model", owned_by: "example" }],
        }), { status: 200, headers: { "content-type": "application/json" } });
      },
    });
    const descriptor = provider.describeCapabilities();
    expect(descriptor.provider).toBe("openai-compatible");
    expect(descriptor.models).toEqual([]);

    const profile = modelProfile({
      provider: "openai-compatible",
      baseUrl: "https://example.test/v1",
      model: "provider-model-a",
      credentialRef: "novel-studio/model-profile/generic",
    });
    await expect(provider.listModels(profile)).resolves.toEqual([
      expect.objectContaining({ id: "provider-model-a" }),
    ]);
  });

  it("requires a service address for generic OpenAI-compatible profiles", async () => {
    const provider = new OpenAiCompatibleProvider({
      credentialStore: fakeCredentialStore("generic-key"),
      fetchImpl: async () => {
        throw new Error("fetch should not be called without a base URL");
      },
    });
    const profile = modelProfile({
      provider: "openai-compatible",
      baseUrl: null,
      model: "provider-model-a",
      credentialRef: "novel-studio/model-profile/generic",
    });

    await expect(provider.testConnection(profile)).resolves.toMatchObject({
      ok: false,
      error: { code: "provider-error", message: "请先填写模型服务地址。" },
    });
  });

  it("classifies DeepSeek auth failures without leaking secrets", async () => {
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({
      error: { message: "unauthorized sk-secret-would-leak" },
    }), { status: 401, headers: { "content-type": "application/json" } });
    const provider = new OpenAiCompatibleProvider({
      credentialStore: fakeCredentialStore("deepseek-test-key"),
      fetchImpl,
      provider: "deepseek",
      title: "DeepSeek",
      defaultBaseUrl: "https://api.deepseek.com",
    });
    const profile = modelProfile({
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      cloudPolicy: "cloud-allowed",
      credentialRef: "novel-studio/model-profile/test",
    });

    const result = await provider.testConnection(profile);
    expect(result).toMatchObject({
      ok: false,
      error: { code: "provider-auth-failed", providerStatus: 401 },
    });
    expect(result.error?.message).not.toContain("sk-secret");
  });

  it("classifies DeepSeek insufficient balance as a billing error", async () => {
    const provider = new OpenAiCompatibleProvider({
      credentialStore: fakeCredentialStore("deepseek-test-key"),
      fetchImpl: async () => new Response(JSON.stringify({
        error: { message: "Insufficient Balance" },
      }), { status: 402, headers: { "content-type": "application/json" } }),
      provider: "deepseek",
      title: "DeepSeek",
      defaultBaseUrl: "https://api.deepseek.com",
    });
    const profile = modelProfile({
      provider: "deepseek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      credentialRef: "novel-studio/model-profile/test",
    });

    await expect(provider.testConnection(profile)).resolves.toMatchObject({
      ok: false,
      error: { code: "provider-billing-required", providerStatus: 402 },
    });
  });

  it("distinguishes credential references from likely plaintext secrets", () => {
    expect(isLikelySecret("novel-studio:openai:default")).toBe(false);
    expect(isLikelySecret("sk-this-looks-like-a-secret")).toBe(true);
    expect(() => assertSafeCredentialRef("novel-studio:ollama:local")).not.toThrow();
    expect(() => assertSafeCredentialRef("Bearer very-secret-token")).toThrow(
      "凭据引用不能包含明文密钥",
    );
  });
});
