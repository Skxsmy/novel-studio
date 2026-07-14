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
  AnthropicProvider,
  GeminiProvider,
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
    roleId: "role-context-checker",
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
    system: "你根据小说上下文检查连续性。",
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
  it("registers MockProvider and the enabled real provider adapters", () => {
    const registry = createDefaultProviderRegistry({ credentialStore: fakeCredentialStore() });

    expect(registry.list().map((adapter) => adapter.provider)).toEqual([
      "mock",
      "openai-compatible",
      "deepseek",
      "openai",
      "openrouter",
      "ollama",
      "anthropic",
      "google",
    ]);
    expect(registry.get("mock")).toBeInstanceOf(MockProvider);
    expect(registry.get("openai")).toBeInstanceOf(OpenAiCompatibleProvider);
    expect(registry.get("openrouter")).toBeInstanceOf(OpenAiCompatibleProvider);
    expect(registry.get("ollama")).toBeInstanceOf(OpenAiCompatibleProvider);
    expect(registry.get("anthropic")).toBeInstanceOf(AnthropicProvider);
    expect(registry.get("google")).toBeInstanceOf(GeminiProvider);
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

  it("keeps invalid explicit structured output available only on the adapter error", async () => {
    const invalidOutput = JSON.stringify({ safeToWrite: "not-a-boolean" });
    const provider = new OpenAiCompatibleProvider({
      credentialStore: fakeCredentialStore("generic-key"),
      fetchImpl: async () => new Response(JSON.stringify({
        choices: [{ message: { content: invalidOutput } }],
      }), { status: 200, headers: { "content-type": "application/json" } }),
      provider: "openai-compatible",
      defaultBaseUrl: "https://example.test/v1",
    });
    const profile = modelProfile({
      provider: "openai-compatible",
      baseUrl: "https://example.test/v1",
      model: "provider-model-a",
      credentialRef: "novel-studio/model-profile/generic",
    });

    let caught: unknown;
    try {
      await provider.generateObject({
        modelProfile: profile,
        prompt: prompt(),
        contextBundle: contextBundle(),
        outputSchemaName: "safe_write_check",
      }, z.object({ safeToWrite: z.boolean() }));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ProviderAdapterError);
    expect((caught as ProviderAdapterError).rawOutput).toBe(invalidOutput);
    expect(provider.classifyError(caught)).not.toHaveProperty("rawOutput");
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
    const chatBodyText = JSON.stringify(chatRequest?.body);
    expect(chatBodyText).toContain("## 当前场景");
    expect(chatBodyText).toContain("当前场景：雨夜，主角发现信件。");
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

  it("normalizes native DeepSeek tool calls and replays reasoning with the matching tool result", async () => {
    const requests: Array<Record<string, unknown>> = [];
    let completion = 0;
    const registry = createDefaultProviderRegistry({
      credentialStore: fakeCredentialStore("deepseek-test-key"),
      fetchImpl: async (_input, init) => {
        const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
        requests.push(body);
        completion += 1;
        if (completion === 1) {
          return new Response(JSON.stringify({
            choices: [{
              finish_reason: "tool_calls",
              message: {
                content: "",
                reasoning_content: "The author requested a Codex entry.",
                tool_calls: [{
                  id: "call_create_1",
                  type: "function",
                  function: {
                    name: "codex_create_entry",
                    arguments: JSON.stringify({ name: "Mara" }),
                  },
                }],
              },
            }],
            usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
          }), { status: 200, headers: { "content-type": "application/json" } });
        }
        return new Response(JSON.stringify({
          choices: [{
            finish_reason: "stop",
            message: { content: "Mara is now in the Codex." },
          }],
          usage: { prompt_tokens: 30, completion_tokens: 8, total_tokens: 38 },
        }), { status: 200, headers: { "content-type": "application/json" } });
      },
    });
    const provider = registry.get("deepseek");
    const profile = modelProfile({
      provider: "deepseek",
      baseUrl: null,
      model: "deepseek-v4-flash",
      credentialRef: "novel-studio/model-profile/deepseek",
      contextWindowTokens: 1_000_000,
    });
    const tools = [{
      name: "codex.create_entry",
      description: "Create one Codex entry after author confirmation.",
      parameters: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
        additionalProperties: false,
      },
    }];

    const first = await provider.completeChat({
      modelProfile: profile,
      prompt: prompt(),
      contextBundle: contextBundle(),
      tools,
      toolChoice: "auto",
    });
    expect(first).toMatchObject({
      text: "",
      reasoningContent: "The author requested a Codex entry.",
      finishReason: "tool_calls",
      usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
      toolCalls: [{
        id: "call_create_1",
        name: "codex.create_entry",
        arguments: JSON.stringify({ name: "Mara" }),
      }],
    });
    expect(requests[0]).toMatchObject({
      stream: false,
      tool_choice: "auto",
      parallel_tool_calls: false,
      tools: [{ type: "function", function: { name: "codex_create_entry" } }],
    });

    const second = await provider.completeChat({
      modelProfile: profile,
      prompt: prompt(),
      contextBundle: contextBundle(),
      tools,
      history: [
        {
          role: "assistant",
          content: "",
          reasoningContent: first.reasoningContent,
          toolCalls: first.toolCalls,
        },
        {
          role: "tool",
          toolCallId: first.toolCalls[0]!.id,
          content: "codex.create_entry created Codex entry: Mara",
        },
      ],
    });
    expect(second).toMatchObject({ text: "Mara is now in the Codex.", toolCalls: [] });
    expect(requests[1]).toMatchObject({
      messages: [
        { role: "system" },
        { role: "user" },
        {
          role: "assistant",
          reasoning_content: "The author requested a Codex entry.",
          tool_calls: [{ id: "call_create_1", function: { name: "codex_create_entry" } }],
        },
        { role: "tool", tool_call_id: "call_create_1" },
      ],
    });
  });

  it("keeps colliding canonical tool IDs distinct across Provider-safe names", async () => {
    let requestBody: Record<string, unknown> = {};
    const provider = new OpenAiCompatibleProvider({
      credentialStore: fakeCredentialStore("generic-key"),
      fetchImpl: async (_input, init) => {
        requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(JSON.stringify({
          choices: [{
            finish_reason: "tool_calls",
            message: {
              content: "",
              tool_calls: [{
                id: "call_collision_1",
                type: "function",
                function: { name: "codex_create_2", arguments: "{}" },
              }],
            },
          }],
        }), { status: 200, headers: { "content-type": "application/json" } });
      },
    });
    const profile = modelProfile({
      provider: "openai-compatible",
      baseUrl: "https://example.test/v1",
      model: "provider-tools",
      credentialRef: "novel-studio/model-profile/generic",
    });
    const result = await provider.completeChat({
      modelProfile: profile,
      prompt: prompt(),
      contextBundle: contextBundle(),
      tools: [
        { name: "codex.create", description: "First", parameters: { type: "object" } },
        { name: "codex_create", description: "Second", parameters: { type: "object" } },
      ],
    });
    expect(requestBody).toMatchObject({
      tools: [
        { function: { name: "codex_create" } },
        { function: { name: "codex_create_2" } },
      ],
    });
    expect(result.toolCalls).toEqual([{
      id: "call_collision_1",
      name: "codex_create",
      arguments: "{}",
    }]);
  });

  it("uses official OpenAI Chat Completions fields and model list shape", async () => {
    const requests: Array<{ url: string; authorization: string | null; body?: unknown }> = [];
    const registry = createDefaultProviderRegistry({
      credentialStore: fakeCredentialStore("openai-test-key"),
      fetchImpl: async (input, init) => {
        const url = String(input);
        requests.push({
          url,
          authorization: new Headers(init?.headers).get("authorization"),
          body: init?.body ? JSON.parse(String(init.body)) as unknown : undefined,
        });
        if (url === "https://api.openai.com/v1/models") {
          return new Response(JSON.stringify({
            object: "list",
            data: [{ id: "gpt-test", object: "model", owned_by: "openai" }],
          }), { status: 200, headers: { "content-type": "application/json" } });
        }
        if (url === "https://api.openai.com/v1/chat/completions") {
          return sseResponse(
            JSON.stringify({ choices: [{ delta: { content: "OpenAI" } }] }),
            "[DONE]",
          );
        }
        return new Response("not found", { status: 404 });
      },
    });
    const provider = registry.get("openai");
    const profile = modelProfile({
      provider: "openai",
      baseUrl: null,
      model: "gpt-test",
      credentialRef: "novel-studio/model-profile/openai",
    });

    await expect(provider.listModels(profile)).resolves.toEqual([
      expect.objectContaining({ id: "gpt-test", title: "gpt-test" }),
    ]);
    await expect(collect(provider.streamText({
      modelProfile: profile,
      prompt: prompt(),
      contextBundle: contextBundle(),
      parameters: { maxOutputTokens: 64 },
    }))).resolves.toBe("OpenAI");

    const chatRequest = requests.find((request) => request.url === "https://api.openai.com/v1/chat/completions");
    expect(chatRequest?.authorization).toBe("Bearer openai-test-key");
    expect(chatRequest?.body).toMatchObject({
      model: "gpt-test",
      stream: true,
      max_completion_tokens: 64,
      messages: [
        { role: "developer" },
        { role: "user" },
      ],
    });
    const chatBodyText = JSON.stringify(chatRequest?.body);
    expect(chatBodyText).toContain("## 当前场景");
    expect(chatBodyText).toContain("当前场景：雨夜，主角发现信件。");
    expect(JSON.stringify(chatRequest?.body)).not.toContain("max_tokens");
  });

  it("parses OpenRouter model metadata and uses OpenRouter completion fields", async () => {
    const requests: Array<{ url: string; authorization: string | null; body?: unknown }> = [];
    const registry = createDefaultProviderRegistry({
      credentialStore: fakeCredentialStore("openrouter-test-key"),
      fetchImpl: async (input, init) => {
        const url = String(input);
        requests.push({
          url,
          authorization: new Headers(init?.headers).get("authorization"),
          body: init?.body ? JSON.parse(String(init.body)) as unknown : undefined,
        });
        if (url === "https://openrouter.ai/api/v1/models") {
          return new Response(JSON.stringify({
            data: [{
              id: "openai/gpt-test",
              name: "GPT Test",
              context_length: 128000,
              supported_parameters: ["temperature", "top_p", "max_tokens"],
            }],
          }), { status: 200, headers: { "content-type": "application/json" } });
        }
        if (url === "https://openrouter.ai/api/v1/chat/completions") {
          return sseResponse(
            JSON.stringify({ choices: [{ delta: { content: "OpenRouter" } }] }),
            "[DONE]",
          );
        }
        return new Response("not found", { status: 404 });
      },
    });
    const provider = registry.get("openrouter");
    const profile = modelProfile({
      provider: "openrouter",
      baseUrl: null,
      model: "openai/gpt-test",
      credentialRef: "novel-studio/model-profile/openrouter",
    });

    await expect(provider.listModels(profile)).resolves.toEqual([
      expect.objectContaining({
        id: "openai/gpt-test",
        title: "GPT Test",
        contextWindowTokens: 128000,
      }),
    ]);
    await expect(collect(provider.streamText({
      modelProfile: profile,
      prompt: prompt(),
      contextBundle: contextBundle(),
      parameters: { maxOutputTokens: 64 },
    }))).resolves.toBe("OpenRouter");

    const chatRequest = requests.find((request) => request.url === "https://openrouter.ai/api/v1/chat/completions");
    expect(chatRequest?.authorization).toBe("Bearer openrouter-test-key");
    expect(chatRequest?.body).toMatchObject({
      model: "openai/gpt-test",
      stream: true,
      max_completion_tokens: 64,
      messages: [
        { role: "system" },
        { role: "user" },
      ],
    });
    const chatBodyText = JSON.stringify(chatRequest?.body);
    expect(chatBodyText).toContain("## 当前场景");
    expect(chatBodyText).toContain("当前场景：雨夜，主角发现信件。");
  });

  it("uses Ollama OpenAI-compatible endpoints without requiring an Authorization header", async () => {
    const requests: Array<{ url: string; authorization: string | null; body?: unknown }> = [];
    const registry = createDefaultProviderRegistry({
      credentialStore: fakeCredentialStore("unused"),
      fetchImpl: async (input, init) => {
        const url = String(input);
        requests.push({
          url,
          authorization: new Headers(init?.headers).get("authorization"),
          body: init?.body ? JSON.parse(String(init.body)) as unknown : undefined,
        });
        if (url === "http://localhost:11434/v1/models") {
          return new Response(JSON.stringify({
            object: "list",
            data: [{ id: "gpt-oss:20b", object: "model", owned_by: "library" }],
          }), { status: 200, headers: { "content-type": "application/json" } });
        }
        if (url === "http://localhost:11434/v1/chat/completions") {
          return sseResponse(
            JSON.stringify({ choices: [{ delta: { content: "Ollama" } }] }),
            "[DONE]",
          );
        }
        return new Response("not found", { status: 404 });
      },
    });
    const provider = registry.get("ollama");
    const profile = modelProfile({
      provider: "ollama",
      baseUrl: null,
      model: "gpt-oss:20b",
      credentialRef: null,
    });

    await expect(provider.listModels(profile)).resolves.toEqual([
      expect.objectContaining({ id: "gpt-oss:20b" }),
    ]);
    await expect(collect(provider.streamText({
      modelProfile: profile,
      prompt: prompt(),
      contextBundle: contextBundle(),
      parameters: { maxOutputTokens: 64 },
    }))).resolves.toBe("Ollama");

    expect(requests).toContainEqual(expect.objectContaining({
      url: "http://localhost:11434/v1/models",
      authorization: null,
    }));
    const chatRequest = requests.find((request) => request.url === "http://localhost:11434/v1/chat/completions");
    expect(chatRequest?.authorization).toBeNull();
    expect(chatRequest?.body).toMatchObject({
      model: "gpt-oss:20b",
      stream: true,
      max_tokens: 64,
      messages: [
        { role: "system" },
        { role: "user" },
      ],
    });
    const chatBodyText = JSON.stringify(chatRequest?.body);
    expect(chatBodyText).toContain("## 当前场景");
    expect(chatBodyText).toContain("当前场景：雨夜，主角发现信件。");
  });

  it("uses official Anthropic Messages fields, stream events, and model list shape", async () => {
    const requests: Array<{
      anthropicVersion: string | null;
      body?: unknown;
      url: string;
      xApiKey: string | null;
    }> = [];
    const registry = createDefaultProviderRegistry({
      credentialStore: fakeCredentialStore("anthropic-test-key"),
      fetchImpl: async (input, init) => {
        const url = String(input);
        const headers = new Headers(init?.headers);
        requests.push({
          anthropicVersion: headers.get("anthropic-version"),
          body: init?.body ? JSON.parse(String(init.body)) as unknown : undefined,
          url,
          xApiKey: headers.get("x-api-key"),
        });
        if (url === "https://api.anthropic.com/v1/models?limit=1000") {
          return new Response(JSON.stringify({
            data: [
              {
                id: "claude-test",
                display_name: "Claude Test",
                max_input_tokens: 200000,
                max_tokens: 64000,
                type: "model",
              },
            ],
            first_id: "claude-test",
            has_more: false,
            last_id: "claude-test",
          }), { status: 200, headers: { "content-type": "application/json" } });
        }
        if (url === "https://api.anthropic.com/v1/messages") {
          return new Response(new TextEncoder().encode([
            'data: {"type":"message_start","message":{"id":"msg_test","type":"message","role":"assistant","content":[],"model":"claude-test","usage":{"input_tokens":10,"output_tokens":0}}}',
            'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Claude"}}',
            'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" says hi."}}',
            'data: {"type":"message_stop"}',
            "",
          ].join("\n\n")), { status: 200, headers: { "content-type": "text/event-stream" } });
        }
        return new Response(JSON.stringify({ error: { type: "not_found_error", message: "not found" } }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      },
    });
    const provider = registry.get("anthropic");
    const profile = modelProfile({
      provider: "anthropic",
      baseUrl: null,
      model: "claude-test",
      credentialRef: "novel-studio/model-profile/anthropic",
      contextWindowTokens: 200000,
    });

    await expect(provider.listModels(profile)).resolves.toEqual([
      expect.objectContaining({
        id: "claude-test",
        title: "Claude Test",
        contextWindowTokens: 200000,
      }),
    ]);
    await expect(collect(provider.streamText({
      modelProfile: profile,
      prompt: prompt(),
      contextBundle: contextBundle(),
      parameters: { maxOutputTokens: 64 },
    }))).resolves.toBe("Claude says hi.");

    const listRequest = requests.find((request) => request.url === "https://api.anthropic.com/v1/models?limit=1000");
    expect(listRequest?.xApiKey).toBe("anthropic-test-key");
    expect(listRequest?.anthropicVersion).toBe("2023-06-01");
    const messageRequest = requests.find((request) => request.url === "https://api.anthropic.com/v1/messages");
    expect(messageRequest?.xApiKey).toBe("anthropic-test-key");
    expect(messageRequest?.anthropicVersion).toBe("2023-06-01");
    expect(messageRequest?.body).toMatchObject({
      model: "claude-test",
      stream: true,
      max_tokens: 64,
      messages: [{ role: "user" }],
    });
    expect(JSON.stringify(messageRequest?.body)).toContain("当前场景");
    expect(JSON.stringify(messageRequest?.body)).not.toContain("authorization");
  });

  it("uses official Gemini model list, GenerateContent fields, and SSE stream shape", async () => {
    const requests: Array<{
      authorization: string | null;
      body?: unknown;
      url: string;
      xGoogApiKey: string | null;
    }> = [];
    const registry = createDefaultProviderRegistry({
      credentialStore: fakeCredentialStore("gemini-test-key"),
      fetchImpl: async (input, init) => {
        const url = String(input);
        const headers = new Headers(init?.headers);
        requests.push({
          authorization: headers.get("authorization"),
          body: init?.body ? JSON.parse(String(init.body)) as unknown : undefined,
          url,
          xGoogApiKey: headers.get("x-goog-api-key"),
        });
        if (url === "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000") {
          return new Response(JSON.stringify({
            models: [
              {
                name: "models/gemini-test",
                baseModelId: "gemini-test",
                version: "001",
                displayName: "Gemini Test",
                inputTokenLimit: 1048576,
                outputTokenLimit: 8192,
                supportedGenerationMethods: ["generateContent", "countTokens"],
              },
              {
                name: "models/text-embedding-test",
                baseModelId: "text-embedding-test",
                displayName: "Embedding Test",
                inputTokenLimit: 8192,
                supportedGenerationMethods: ["embedContent"],
              },
            ],
          }), { status: 200, headers: { "content-type": "application/json" } });
        }
        if (url === "https://generativelanguage.googleapis.com/v1beta/models/gemini-test:streamGenerateContent?alt=sse") {
          return sseResponse(
            JSON.stringify({ candidates: [{ content: { parts: [{ text: "Gemini" }] } }] }),
            JSON.stringify({ candidates: [{ content: { parts: [{ text: " says hi." }] } }] }),
          );
        }
        if (url === "https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent") {
          return new Response(JSON.stringify({
            candidates: [{ content: { parts: [{ text: "{\"safeToWrite\":false}" }] } }],
          }), { status: 200, headers: { "content-type": "application/json" } });
        }
        return new Response(JSON.stringify({ error: { code: 404, message: "not found", status: "NOT_FOUND" } }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      },
    });
    const provider = registry.get("google");
    const profile = modelProfile({
      provider: "google",
      baseUrl: null,
      model: "gemini-test",
      credentialRef: "novel-studio/model-profile/google",
      contextWindowTokens: 1048576,
    });

    await expect(provider.listModels(profile)).resolves.toEqual([
      expect.objectContaining({
        id: "gemini-test",
        title: "Gemini Test",
        contextWindowTokens: 1048576,
      }),
    ]);
    await expect(collect(provider.streamText({
      modelProfile: profile,
      prompt: prompt(),
      contextBundle: contextBundle(),
      parameters: { maxOutputTokens: 64, temperature: 0.4 },
    }))).resolves.toBe("Gemini says hi.");
    await expect(provider.generateObject({
      modelProfile: profile,
      prompt: prompt(),
      contextBundle: contextBundle(),
      outputSchemaName: "safe_write_check",
      parameters: { maxOutputTokens: 64 },
    }, z.object({ safeToWrite: z.literal(false) }))).resolves.toEqual({ safeToWrite: false });

    const listRequest = requests.find((request) =>
      request.url === "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000"
    );
    expect(listRequest?.xGoogApiKey).toBe("gemini-test-key");
    expect(listRequest?.authorization).toBeNull();
    const streamRequest = requests.find((request) =>
      request.url === "https://generativelanguage.googleapis.com/v1beta/models/gemini-test:streamGenerateContent?alt=sse"
    );
    expect(streamRequest?.xGoogApiKey).toBe("gemini-test-key");
    expect(streamRequest?.authorization).toBeNull();
    expect(streamRequest?.body).toMatchObject({
      contents: [{ role: "user" }],
      generationConfig: {
        maxOutputTokens: 64,
        temperature: 0.4,
      },
      systemInstruction: { parts: [{ text: expect.any(String) }] },
    });
    expect(JSON.stringify(streamRequest?.body)).toContain("当前场景");
    expect(JSON.stringify(streamRequest?.body)).not.toContain("gemini-test-key");
    const objectRequest = requests.find((request) =>
      request.url === "https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent"
    );
    expect(objectRequest?.body).toMatchObject({
      generationConfig: {
        maxOutputTokens: 64,
        responseMimeType: "application/json",
      },
    });
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

  it("preserves official OpenAI-compatible reasoning fields in streamed text", async () => {
    const provider = new OpenAiCompatibleProvider({
      credentialStore: fakeCredentialStore("generic-key"),
      fetchImpl: async (input) => {
        if (String(input).endsWith("/chat/completions")) {
          return sseResponse(
            JSON.stringify({ choices: [{ delta: { reasoning_content: "deepseek trace." } }] }),
            JSON.stringify({ choices: [{ delta: { reasoning: "openrouter trace." } }] }),
            JSON.stringify({ choices: [{ delta: { reasoning_details: [{ type: "reasoning.text", text: "details trace." }] } }] }),
            JSON.stringify({ choices: [{ delta: { thinking: "ollama trace." } }] }),
            JSON.stringify({ choices: [{ delta: { content: "Final answer." } }] }),
            "[DONE]",
          );
        }
        return new Response(JSON.stringify({ object: "list", data: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });
    const profile = modelProfile({
      provider: "openai-compatible",
      baseUrl: "https://example.test/v1",
      model: "provider-reasoner",
      credentialRef: "novel-studio/model-profile/generic",
    });

    await expect(collect(provider.streamText({
      modelProfile: profile,
      prompt: prompt(),
      contextBundle: contextBundle(),
    }))).resolves.toBe(
      "<think>deepseek trace.</think>" +
      "<think>openrouter trace.</think>" +
      "<think>details trace.</think>" +
      "<think>ollama trace.</think>" +
      "Final answer.",
    );
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
