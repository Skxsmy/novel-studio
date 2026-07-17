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
  type ProviderChatStreamEvent,
  type ProviderTextStreamEvent,
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

async function collect(iterable: AsyncIterable<ProviderTextStreamEvent>): Promise<string> {
  const chunks: string[] = [];
  for await (const event of iterable) {
    if (event.type === "answer-delta") chunks.push(event.text);
  }
  return chunks.join("");
}

async function collectEvents(
  iterable: AsyncIterable<ProviderTextStreamEvent>,
): Promise<ProviderTextStreamEvent[]> {
  const events: ProviderTextStreamEvent[] = [];
  for await (const event of iterable) events.push(event);
  return events;
}

async function collectChatEvents(
  iterable: AsyncIterable<ProviderChatStreamEvent>,
): Promise<ProviderChatStreamEvent[]> {
  const events: ProviderChatStreamEvent[] = [];
  for await (const event of iterable) events.push(event);
  return events;
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

  it("stops a text stream before emitting output when cancellation is requested", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(collectEvents(new MockProvider().streamText({
      modelProfile: modelProfile(),
      prompt: prompt(),
      contextBundle: contextBundle(),
      abortSignal: controller.signal,
    }))).rejects.toMatchObject({ name: "AbortError" });
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
          reasoning: {
            kind: "effort",
            efforts: ["high", "max"],
            defaultEffort: "high",
            canDisable: true,
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
          reasoning: {
            kind: "effort",
            efforts: ["high", "max"],
            defaultEffort: "high",
            canDisable: true,
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
        {
          id: "deepseek-v4-flash",
          reasoning: {
            kind: "effort",
            efforts: ["high", "max"],
            defaultEffort: "high",
            canDisable: true,
          },
        },
        { id: "deepseek-v4-pro", reasoning: { kind: "effort" } },
      ],
    });

    const resolvedParameters = await provider.resolveParameters(profile, {
      temperature: 0.3,
      maxOutputTokens: 128,
      seed: 42,
    });
    expect(resolvedParameters).toEqual({
      maxOutputTokens: 128,
      reasoning: { mode: "effort", effort: "high" },
      seed: 42,
    });
    await expect(collect(provider.streamText({
      modelProfile: profile,
      prompt: prompt(),
      contextBundle: contextBundle(),
      resolvedParameters,
    }))).resolves.toBe("雨声压低了脚步。");

    expect(requests.some((request) => request.url === "https://api.deepseek.com/models")).toBe(true);
    const chatRequest = requests.find((request) => request.url === "https://api.deepseek.com/chat/completions");
    expect(chatRequest?.authorization).toBe("Bearer deepseek-test-key");
    expect(chatRequest?.body).toMatchObject({
      model: "deepseek-v4-flash",
      stream: true,
      max_tokens: 128,
      thinking: { type: "enabled" },
      reasoning_effort: "high",
      seed: 42,
    });
    expect(chatRequest?.body).not.toHaveProperty("temperature");
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

  it("rejects transport-owned parameter overrides before OpenAI-compatible, Anthropic, or Gemini transport", async () => {
    let transportCalls = 0;
    const registry = createDefaultProviderRegistry({
      credentialStore: fakeCredentialStore("provider-test-key"),
      fetchImpl: async () => {
        transportCalls += 1;
        return new Response("unexpected transport", { status: 500 });
      },
    });
    const cases = [
      {
        provider: registry.get("openai-compatible"),
        profile: modelProfile({
          provider: "openai-compatible",
          baseUrl: "https://example.test/v1",
          model: "author-selected-model",
          credentialRef: "novel-studio/model-profile/openai-compatible",
        }),
        parameters: { model: "attacker-selected-model" },
      },
      {
        provider: registry.get("anthropic"),
        profile: modelProfile({
          provider: "anthropic",
          baseUrl: null,
          model: "claude-test",
          credentialRef: "novel-studio/model-profile/anthropic",
        }),
        parameters: { messages: "attacker-owned-messages" },
      },
      {
        provider: registry.get("google"),
        profile: modelProfile({
          provider: "google",
          baseUrl: null,
          model: "gemini-test",
          credentialRef: "novel-studio/model-profile/google",
        }),
        parameters: { thinkingConfig: "attacker-owned-thinking" },
      },
    ];

    for (const testCase of cases) {
      await expect(collect(testCase.provider.streamText({
        modelProfile: testCase.profile,
        prompt: prompt(),
        contextBundle: contextBundle(),
        parameters: testCase.parameters,
      }))).rejects.toThrow("transport-owned request fields");
    }
    expect(transportCalls).toBe(0);
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
      parallel_tool_calls: false,
      thinking: { type: "enabled" },
      tools: [{ type: "function", function: { name: "codex_create_entry" } }],
    });
    expect(requests[0]).not.toHaveProperty("tool_choice");

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
        {
          role: "assistant",
          reasoning_content: "The author requested a Codex entry.",
          tool_calls: [{ id: "call_create_1", function: { name: "codex_create_entry" } }],
        },
        { role: "tool", tool_call_id: "call_create_1" },
        { role: "user" },
      ],
    });
  });

  it("keeps DeepSeek Agent stream tools while omitting unsupported thinking-mode fields", async () => {
    const requests: Array<Record<string, unknown>> = [];
    const provider = createDefaultProviderRegistry({
      credentialStore: fakeCredentialStore("deepseek-test-key"),
      fetchImpl: async (_input, init) => {
        requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        if (requests.length === 1) {
          return sseResponse(
            JSON.stringify({ choices: [{ delta: { content: "Done" }, finish_reason: "stop" }] }),
            "[DONE]",
          );
        }
        return new Response(JSON.stringify({
          choices: [{ finish_reason: "stop", message: { content: "Done" } }],
        }), { status: 200, headers: { "content-type": "application/json" } });
      },
    }).get("deepseek");
    const profile = modelProfile({
      provider: "deepseek",
      baseUrl: null,
      model: "deepseek-v4-flash",
      credentialRef: "novel-studio/model-profile/deepseek",
      contextWindowTokens: 1_000_000,
    });
    const tools = [{
      name: "codex.create_entry",
      description: "Create one Codex entry.",
      parameters: { type: "object", properties: { name: { type: "string" } } },
    }];

    await collectChatEvents(provider.streamChat({
      modelProfile: profile,
      prompt: prompt(),
      contextBundle: contextBundle(),
      tools,
      toolChoice: "required",
      parameters: {
        temperature: 0.7,
        topP: 0.8,
        presence_penalty: 0.4,
        frequency_penalty: 0.3,
      },
    }));
    await provider.completeChat({
      modelProfile: profile,
      prompt: prompt(),
      contextBundle: contextBundle(),
      tools,
      toolChoice: "required",
      parameters: {
        reasoning: { mode: "disabled" },
        temperature: 0.7,
        topP: 0.8,
        presence_penalty: 0.4,
        frequency_penalty: 0.3,
      },
    });
    await expect(collectChatEvents(provider.streamChat({
      modelProfile: profile,
      prompt: prompt(),
      contextBundle: contextBundle(),
      tools,
      resolvedParameters: {
        reasoning: { mode: "effort", effort: "high" },
        presence_penalty: 0.4,
      },
    }))).rejects.toMatchObject({ code: "model-unavailable" });

    expect(requests[0]).toMatchObject({
      thinking: { type: "enabled" },
      tools: [{ type: "function", function: { name: "codex_create_entry" } }],
    });
    expect(requests[0]).not.toHaveProperty("tool_choice");
    expect(requests[0]).not.toHaveProperty("temperature");
    expect(requests[0]).not.toHaveProperty("top_p");
    expect(requests[0]).not.toHaveProperty("presence_penalty");
    expect(requests[0]).not.toHaveProperty("frequency_penalty");
    expect(requests[1]).toMatchObject({
      thinking: { type: "disabled" },
      tool_choice: "required",
      temperature: 0.7,
      top_p: 0.8,
      presence_penalty: 0.4,
      frequency_penalty: 0.3,
      tools: [{ type: "function", function: { name: "codex_create_entry" } }],
    });
    expect(requests).toHaveLength(2);
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

  it("refreshes exact OpenRouter reasoning metadata before resolving a cold-start preference", async () => {
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
              reasoning: {
                supported_efforts: ["low", "medium", "high", "none"],
                default_effort: "medium",
                default_enabled: true,
                supports_max_tokens: true,
                mandatory: false,
              },
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
      schemaVersion: 2,
      provider: "openrouter",
      baseUrl: null,
      model: "openai/gpt-test",
      credentialRef: "novel-studio/model-profile/openrouter",
      reasoningPreference: { mode: "effort", effort: "high" },
    });

    const resolvedParameters = await provider.resolveParameters(profile, { maxOutputTokens: 64 });
    expect(resolvedParameters).toEqual({
      temperature: 0.2,
      maxOutputTokens: 64,
      reasoning: { mode: "effort", effort: "high" },
    });
    await expect(provider.listModels(profile)).resolves.toEqual([
      expect.objectContaining({
        id: "openai/gpt-test",
        title: "GPT Test",
        contextWindowTokens: 128000,
        reasoning: {
          kind: "effort",
          efforts: ["low", "medium", "high"],
          defaultEffort: "medium",
          canDisable: true,
        },
      }),
    ]);
    await expect(collect(provider.streamText({
      modelProfile: profile,
      prompt: prompt(),
      contextBundle: contextBundle(),
      resolvedParameters,
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
      reasoning: { effort: "high", exclude: false },
    });
    const chatBodyText = JSON.stringify(chatRequest?.body);
    expect(chatBodyText).toContain("## 当前场景");
    expect(chatBodyText).toContain("当前场景：雨夜，主角发现信件。");
  });

  it("loads exact OpenRouter metadata before direct cold-process resolved-parameter replay", async () => {
    const requests: Array<{ url: string; body?: Record<string, unknown> }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      requests.push({
        url,
        body: init?.body
          ? JSON.parse(String(init.body)) as Record<string, unknown>
          : undefined,
      });
      if (url === "https://openrouter.ai/api/v1/models") {
        return new Response(JSON.stringify({
          data: [{
            id: "openai/cold-reasoner",
            name: "Cold Reasoner",
            context_length: 128000,
            reasoning: {
              supported_efforts: ["low", "medium", "high", "none"],
              default_effort: "medium",
              default_enabled: true,
              mandatory: false,
            },
          }],
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url === "https://openrouter.ai/api/v1/chat/completions") {
        return sseResponse(
          JSON.stringify({ choices: [{ delta: { content: "Cold replay" } }] }),
          "[DONE]",
        );
      }
      return new Response("not found", { status: 404 });
    };
    const profile = modelProfile({
      schemaVersion: 2,
      provider: "openrouter",
      baseUrl: null,
      model: "openai/cold-reasoner",
      credentialRef: "novel-studio/model-profile/openrouter-cold",
      reasoningPreference: null,
    });
    const resolvedParameters = {
      temperature: 0.2,
      maxOutputTokens: 64,
      reasoning: { mode: "effort" as const, effort: "high" as const },
    };
    const freshProvider = () => createDefaultProviderRegistry({
      credentialStore: fakeCredentialStore("openrouter-test-key"),
      fetchImpl,
    }).get("openrouter");

    await expect(collect(freshProvider().streamText({
      modelProfile: profile,
      prompt: prompt(),
      contextBundle: contextBundle(),
      resolvedParameters,
    }))).resolves.toBe("Cold replay");
    const chatEvents = await collectChatEvents(freshProvider().streamChat({
      modelProfile: profile,
      prompt: prompt(),
      contextBundle: contextBundle(),
      resolvedParameters,
    }));
    expect(chatEvents.at(-1)).toEqual({
      type: "done",
      result: expect.objectContaining({ text: "Cold replay" }),
    });

    expect(requests.map((request) => request.url)).toEqual([
      "https://openrouter.ai/api/v1/models",
      "https://openrouter.ai/api/v1/chat/completions",
      "https://openrouter.ai/api/v1/models",
      "https://openrouter.ai/api/v1/chat/completions",
    ]);
    for (const request of requests.filter((item) => item.body)) {
      expect(request.body).toMatchObject({
        model: "openai/cold-reasoner",
        reasoning: { effort: "high", exclude: false },
      });
    }
  });

  it("uses Ollama OpenAI-compatible endpoints and native Agent tools without Authorization", async () => {
    const requests: Array<{ url: string; authorization: string | null; body?: unknown }> = [];
    const registry = createDefaultProviderRegistry({
      credentialStore: fakeCredentialStore("unused"),
      fetchImpl: async (input, init) => {
        const url = String(input);
        const body = init?.body
          ? JSON.parse(String(init.body)) as Record<string, unknown>
          : undefined;
        requests.push({
          url,
          authorization: new Headers(init?.headers).get("authorization"),
          body,
        });
        if (url === "http://localhost:11434/v1/models") {
          return new Response(JSON.stringify({
            object: "list",
            data: [{ id: "gpt-oss:20b", object: "model", owned_by: "library" }],
          }), { status: 200, headers: { "content-type": "application/json" } });
        }
        if (url === "http://localhost:11434/v1/chat/completions") {
          if (Array.isArray(body?.tools)) {
            return sseResponse(
              JSON.stringify({
                choices: [{
                  finish_reason: "tool_calls",
                  delta: {
                    tool_calls: [{
                      index: 0,
                      id: "call_ollama_1",
                      type: "function",
                      function: {
                        name: "codex_create_entry",
                        arguments: "{\"name\":\"Mara\"}",
                      },
                    }],
                  },
                }],
              }),
              "[DONE]",
            );
          }
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
      expect.objectContaining({
        id: "gpt-oss:20b",
        reasoning: {
          kind: "effort",
          efforts: ["low", "medium", "high"],
          defaultEffort: "medium",
          canDisable: false,
        },
      }),
    ]);
    await expect(collect(provider.streamText({
      modelProfile: profile,
      prompt: prompt(),
      contextBundle: contextBundle(),
      parameters: { maxOutputTokens: 64 },
    }))).resolves.toBe("Ollama");
    const agentEvents = await collectChatEvents(provider.streamChat({
      modelProfile: profile,
      prompt: prompt(),
      contextBundle: contextBundle(),
      tools: [{
        name: "codex.create_entry",
        description: "Create one Codex entry.",
        parameters: { type: "object", properties: { name: { type: "string" } } },
      }],
      toolChoice: "auto",
    }));
    expect(agentEvents.at(-1)).toEqual({
      type: "done",
      result: expect.objectContaining({
        finishReason: "tool_calls",
        toolCalls: [{
          id: "call_ollama_1",
          name: "codex.create_entry",
          arguments: "{\"name\":\"Mara\"}",
        }],
      }),
    });

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
      reasoning_effort: "medium",
    });
    const chatBodyText = JSON.stringify(chatRequest?.body);
    expect(chatBodyText).toContain("## 当前场景");
    expect(chatBodyText).toContain("当前场景：雨夜，主角发现信件。");
    const agentRequest = requests.filter((request) =>
      request.url === "http://localhost:11434/v1/chat/completions"
    ).at(-1);
    expect(agentRequest?.authorization).toBeNull();
    expect(agentRequest?.body).toMatchObject({
      model: "gpt-oss:20b",
      stream: true,
      reasoning_effort: "medium",
      tool_choice: "auto",
      parallel_tool_calls: false,
      tools: [{ type: "function", function: { name: "codex_create_entry" } }],
    });
  });

  it("does not downgrade an OpenRouter discovery failure to unsupported reasoning", async () => {
    const provider = createDefaultProviderRegistry({
      credentialStore: fakeCredentialStore("openrouter-test-key"),
      fetchImpl: async () => new Response(JSON.stringify({
        error: { message: "model discovery unavailable" },
      }), { status: 503, headers: { "content-type": "application/json" } }),
    }).get("openrouter");
    const profile = modelProfile({
      schemaVersion: 2,
      provider: "openrouter",
      baseUrl: null,
      model: "openai/exact-reasoner",
      credentialRef: "novel-studio/model-profile/openrouter",
      reasoningPreference: { mode: "effort", effort: "high" },
    });

    await expect(provider.resolveParameters(profile)).rejects.toMatchObject({
      code: "provider-unavailable",
      providerStatus: 503,
    });
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
      parameters: { maxOutputTokens: 64, seed: 42 },
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
      seed: 42,
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
      parameters: { maxOutputTokens: 64, temperature: 0.4, seed: 42 },
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
        seed: 42,
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

  it("maps exact Anthropic adaptive-thinking models and streams summarized thinking before text", async () => {
    const requests: Array<{ url: string; body?: Record<string, unknown> }> = [];
    const provider = new AnthropicProvider({
      credentialStore: fakeCredentialStore("anthropic-test-key"),
      fetchImpl: async (input, init) => {
        const url = String(input);
        requests.push({
          url,
          body: init?.body
            ? JSON.parse(String(init.body)) as Record<string, unknown>
            : undefined,
        });
        if (url.includes("/models?")) {
          return new Response(JSON.stringify({
            data: [
              { id: "claude-fable-5", display_name: "Claude Fable 5", max_input_tokens: 200000 },
              { id: "claude-opus-4-8", display_name: "Claude Opus 4.8", max_input_tokens: 200000 },
              { id: "claude-opus-4-7", display_name: "Claude Opus 4.7", max_input_tokens: 200000 },
              { id: "claude-opus-4-6", display_name: "Claude Opus 4.6", max_input_tokens: 200000 },
              { id: "claude-sonnet-5", display_name: "Claude Sonnet 5", max_input_tokens: 200000 },
              { id: "claude-sonnet-4-6", display_name: "Claude Sonnet 4.6", max_input_tokens: 200000 },
              { id: "claude-unverified", display_name: "Claude Unverified", max_input_tokens: 200000 },
            ],
            has_more: false,
          }), { status: 200, headers: { "content-type": "application/json" } });
        }
        return new Response(new TextEncoder().encode([
          'data: {"type":"message_start","message":{"usage":{"input_tokens":12,"output_tokens":0}}}',
          'data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"Summary first. "}}',
          'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Final answer."}}',
          'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":7}}',
          'data: {"type":"message_stop"}',
          "",
        ].join("\n\n")), { status: 200, headers: { "content-type": "text/event-stream" } });
      },
    });
    const profile = modelProfile({
      schemaVersion: 2,
      provider: "anthropic",
      baseUrl: null,
      model: "claude-fable-5",
      credentialRef: "novel-studio/model-profile/anthropic",
      reasoningPreference: null,
      contextWindowTokens: 200000,
    });

    await expect(provider.listModels(profile)).resolves.toEqual([
      expect.objectContaining({
        id: "claude-fable-5",
        reasoning: {
          kind: "effort",
          efforts: ["low", "medium", "high", "xhigh", "max"],
          defaultEffort: "high",
          canDisable: false,
        },
      }),
      expect.objectContaining({
        id: "claude-opus-4-8",
        reasoning: expect.objectContaining({ efforts: ["low", "medium", "high", "xhigh", "max"] }),
      }),
      expect.objectContaining({
        id: "claude-opus-4-7",
        reasoning: expect.objectContaining({ efforts: ["low", "medium", "high", "xhigh", "max"] }),
      }),
      expect.objectContaining({
        id: "claude-opus-4-6",
        reasoning: expect.objectContaining({ efforts: ["low", "medium", "high", "max"] }),
      }),
      expect.objectContaining({
        id: "claude-sonnet-5",
        reasoning: expect.objectContaining({ efforts: ["low", "medium", "high", "xhigh", "max"] }),
      }),
      expect.objectContaining({
        id: "claude-sonnet-4-6",
        reasoning: expect.objectContaining({ efforts: ["low", "medium", "high", "max"] }),
      }),
      expect.objectContaining({ id: "claude-unverified", reasoning: { kind: "unsupported" } }),
    ]);
    const resolvedParameters = await provider.resolveParameters(profile);
    expect(resolvedParameters).toEqual({
      maxOutputTokens: 4096,
      reasoning: { mode: "effort", effort: "high" },
    });
    const events = await collectChatEvents(provider.streamChat({
      modelProfile: profile,
      prompt: prompt(),
      contextBundle: contextBundle(),
      resolvedParameters,
    }));
    expect(events).toEqual([
      { type: "reasoning-delta", text: "Summary first. ", outputKind: "summary" },
      { type: "answer-delta", text: "Final answer." },
      {
        type: "done",
        result: expect.objectContaining({
          reasoningContent: "Summary first. ",
          reasoningOutputKind: "summary",
          text: "Final answer.",
          finishReason: "end_turn",
          usage: { inputTokens: 12, outputTokens: 7, totalTokens: 19 },
        }),
      },
    ]);
    const messageBody = requests.find((request) => request.url.endsWith("/v1/messages"))?.body;
    expect(messageBody).toMatchObject({
      max_tokens: 4096,
      thinking: { type: "adaptive", display: "summarized" },
      output_config: { effort: "high" },
    });
    expect(messageBody).not.toHaveProperty("temperature");

    const disabledProfile = modelProfile({
      schemaVersion: 2,
      provider: "anthropic",
      baseUrl: null,
      model: "claude-fable-5",
      credentialRef: "novel-studio/model-profile/anthropic",
      reasoningPreference: { mode: "disabled" },
      contextWindowTokens: 200000,
    });
    await expect(collect(provider.streamText({
      modelProfile: disabledProfile,
      prompt: prompt(),
      contextBundle: contextBundle(),
    }))).rejects.toMatchObject({ code: "model-unavailable" });
  });

  it("maps exact Gemini thinking controls and enables dynamic thinking for first-use Flash Lite", async () => {
    const requests: Array<{ url: string; body?: Record<string, unknown> }> = [];
    const provider = new GeminiProvider({
      credentialStore: fakeCredentialStore("gemini-test-key"),
      fetchImpl: async (input, init) => {
        const url = String(input);
        requests.push({
          url,
          body: init?.body
            ? JSON.parse(String(init.body)) as Record<string, unknown>
            : undefined,
        });
        if (url.includes("/models?pageSize=")) {
          return new Response(JSON.stringify({
            models: [
              {
                name: "models/gemini-3.5-flash",
                baseModelId: "gemini-3.5-flash",
                displayName: "Gemini 3.5 Flash",
                inputTokenLimit: 1048576,
                supportedGenerationMethods: ["generateContent"],
              },
              {
                name: "models/gemini-2.5-flash-lite",
                baseModelId: "gemini-2.5-flash-lite",
                displayName: "Gemini 2.5 Flash Lite",
                inputTokenLimit: 1048576,
                supportedGenerationMethods: ["generateContent"],
              },
              {
                name: "models/gemini-unverified",
                baseModelId: "gemini-unverified",
                displayName: "Gemini Unverified",
                inputTokenLimit: 1048576,
                supportedGenerationMethods: ["generateContent"],
              },
            ],
          }), { status: 200, headers: { "content-type": "application/json" } });
        }
        return sseResponse(JSON.stringify({
          candidates: [{
            content: {
              parts: [
                { text: "Thought summary. ", thought: true },
                { text: "Gemini answer." },
              ],
            },
            finishReason: "STOP",
          }],
          usageMetadata: {
            promptTokenCount: 8,
            candidatesTokenCount: 6,
            totalTokenCount: 14,
          },
        }));
      },
    });
    const profile = modelProfile({
      schemaVersion: 2,
      provider: "google",
      baseUrl: null,
      model: "gemini-3.5-flash",
      credentialRef: "novel-studio/model-profile/google",
      reasoningPreference: null,
      contextWindowTokens: 1048576,
    });

    await expect(provider.listModels(profile)).resolves.toEqual([
      expect.objectContaining({
        id: "gemini-3.5-flash",
        reasoning: {
          kind: "effort",
          efforts: ["minimal", "low", "medium", "high"],
          defaultEffort: "medium",
          canDisable: false,
        },
      }),
      expect.objectContaining({
        id: "gemini-2.5-flash-lite",
        reasoning: {
          kind: "budget",
          minimumTokens: 512,
          maximumTokens: 24576,
          defaultBudgetTokens: null,
          supportsDynamicBudget: true,
          canDisable: true,
        },
      }),
      expect.objectContaining({ id: "gemini-unverified", reasoning: { kind: "unsupported" } }),
    ]);
    const resolvedParameters = await provider.resolveParameters(profile);
    expect(resolvedParameters).toEqual({
      temperature: 0.2,
      reasoning: { mode: "effort", effort: "medium" },
    });
    const events = await collectChatEvents(provider.streamChat({
      modelProfile: profile,
      prompt: prompt(),
      contextBundle: contextBundle(),
      resolvedParameters,
    }));
    expect(events).toEqual([
      { type: "reasoning-delta", text: "Thought summary. ", outputKind: "summary" },
      { type: "answer-delta", text: "Gemini answer." },
      {
        type: "done",
        result: expect.objectContaining({
          text: "Gemini answer.",
          reasoningContent: "Thought summary. ",
          reasoningOutputKind: "summary",
          finishReason: "STOP",
          usage: { inputTokens: 8, outputTokens: 6, totalTokens: 14 },
        }),
      },
    ]);
    const flashBody = requests.find((request) =>
      request.url.includes("gemini-3.5-flash:streamGenerateContent")
    )?.body;
    expect(flashBody).toMatchObject({
      generationConfig: {
        thinkingConfig: { includeThoughts: true, thinkingLevel: "medium" },
      },
    });

    const flashLiteProfile = modelProfile({
      schemaVersion: 2,
      provider: "google",
      baseUrl: null,
      model: "gemini-2.5-flash-lite",
      credentialRef: "novel-studio/model-profile/google",
      reasoningPreference: null,
      contextWindowTokens: 1048576,
    });
    await collect(provider.streamText({
      modelProfile: flashLiteProfile,
      prompt: prompt(),
      contextBundle: contextBundle(),
    }));
    const flashLiteBody = requests.find((request) =>
      request.url.includes("gemini-2.5-flash-lite:streamGenerateContent")
    )?.body;
    expect(flashLiteBody).toMatchObject({
      generationConfig: {
        thinkingConfig: { includeThoughts: true, thinkingBudget: -1 },
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

  it("streams provider-native reasoning as typed events without wrapping answer text", async () => {
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

    await expect(collectEvents(provider.streamText({
      modelProfile: profile,
      prompt: prompt(),
      contextBundle: contextBundle(),
    }))).resolves.toEqual([
      { type: "reasoning-delta", text: "deepseek trace.", outputKind: "full" },
      { type: "reasoning-delta", text: "openrouter trace.", outputKind: "full" },
      { type: "reasoning-delta", text: "details trace.", outputKind: "full" },
      { type: "reasoning-delta", text: "ollama trace.", outputKind: "full" },
      { type: "answer-delta", text: "Final answer." },
    ]);
  });

  it("maps OpenAI none to normalized disabled only for a verified exact model", async () => {
    const requests: Array<{ url: string; body?: Record<string, unknown> }> = [];
    const provider = createDefaultProviderRegistry({
      credentialStore: fakeCredentialStore("openai-test-key"),
      fetchImpl: async (input, init) => {
        const url = String(input);
        requests.push({
          url,
          body: init?.body
            ? JSON.parse(String(init.body)) as Record<string, unknown>
            : undefined,
        });
        if (url.endsWith("/models")) {
          return new Response(JSON.stringify({
            object: "list",
            data: [
              { id: "gpt-5.6", object: "model", owned_by: "openai" },
              { id: "gpt-5.6-unverified-snapshot", object: "model", owned_by: "openai" },
            ],
          }), { status: 200, headers: { "content-type": "application/json" } });
        }
        return sseResponse(
          JSON.stringify({ choices: [{ delta: { content: "OpenAI answer" } }] }),
          "[DONE]",
        );
      },
    }).get("openai");
    const profile = modelProfile({
      schemaVersion: 2,
      provider: "openai",
      baseUrl: null,
      model: "gpt-5.6",
      credentialRef: "novel-studio/model-profile/openai",
      reasoningPreference: { mode: "disabled" },
    });

    await expect(provider.listModels(profile)).resolves.toEqual([
      expect.objectContaining({
        id: "gpt-5.6",
        reasoning: {
          kind: "effort",
          efforts: ["low", "medium", "high", "xhigh", "max"],
          defaultEffort: "medium",
          canDisable: true,
        },
      }),
      expect.objectContaining({
        id: "gpt-5.6-unverified-snapshot",
        reasoning: { kind: "unsupported" },
      }),
    ]);
    const resolvedParameters = await provider.resolveParameters(profile);
    expect(resolvedParameters).toEqual({
      temperature: 0.2,
      reasoning: { mode: "disabled" },
    });
    await expect(collect(provider.streamText({
      modelProfile: profile,
      prompt: prompt(),
      contextBundle: contextBundle(),
      resolvedParameters,
    }))).resolves.toBe("OpenAI answer");
    expect(requests.find((request) => request.url.endsWith("/chat/completions"))?.body)
      .toMatchObject({ reasoning_effort: "none" });

    const unknownProfile = modelProfile({
      schemaVersion: 2,
      provider: "openai",
      baseUrl: null,
      model: "gpt-5.6-unverified-snapshot",
      credentialRef: "novel-studio/model-profile/openai",
      reasoningPreference: { mode: "effort", effort: "high" },
    });
    await expect(collect(provider.streamText({
      modelProfile: unknownProfile,
      prompt: prompt(),
      contextBundle: contextBundle(),
    }))).rejects.toMatchObject({ code: "model-unavailable" });
  });

  it("streams Agent reasoning and assembles incremental tool calls before one authoritative result", async () => {
    let requestBody: Record<string, unknown> = {};
    const provider = createDefaultProviderRegistry({
      credentialStore: fakeCredentialStore("deepseek-test-key"),
      fetchImpl: async (_input, init) => {
        requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return sseResponse(
          JSON.stringify({ choices: [{ delta: { reasoning_content: "Check the Codex first. " } }] }),
          JSON.stringify({
            choices: [{
              delta: {
                tool_calls: [{
                  index: 0,
                  id: "call_create_1",
                  type: "function",
                  function: { name: "codex_", arguments: "{\"name\":" },
                }],
              },
            }],
          }),
          JSON.stringify({
            choices: [{
              finish_reason: "tool_calls",
              delta: {
                tool_calls: [{
                  index: 0,
                  function: { name: "create_entry", arguments: "\"Mara\"}" },
                }],
              },
            }],
          }),
          JSON.stringify({
            choices: [],
            usage: { prompt_tokens: 31, completion_tokens: 9, total_tokens: 40 },
          }),
          "[DONE]",
        );
      },
    }).get("deepseek");
    const profile = modelProfile({
      provider: "deepseek",
      baseUrl: null,
      model: "deepseek-v4-flash",
      credentialRef: "novel-studio/model-profile/deepseek",
      contextWindowTokens: 1_000_000,
    });
    const tools = [{
      name: "codex.create_entry",
      description: "Create one Codex entry.",
      parameters: { type: "object", properties: { name: { type: "string" } } },
    }];

    const events = await collectChatEvents(provider.streamChat({
      modelProfile: profile,
      prompt: prompt(),
      contextBundle: contextBundle(),
      tools,
      history: [
        {
          role: "assistant",
          content: "",
          reasoningContent: "Earlier reasoning",
          toolCalls: [{ id: "call_prior", name: "codex.create_entry", arguments: "{}" }],
        },
        { role: "tool", toolCallId: "call_prior", content: "Created earlier entry" },
      ],
    }));

    expect(events[0]).toEqual({
      type: "reasoning-delta",
      text: "Check the Codex first. ",
      outputKind: "full",
    });
    expect(events.at(-1)).toEqual({
      type: "done",
      result: expect.objectContaining({
        text: "",
        reasoningContent: "Check the Codex first. ",
        reasoningOutputKind: "full",
        finishReason: "tool_calls",
        usage: { inputTokens: 31, outputTokens: 9, totalTokens: 40 },
        toolCalls: [{
          id: "call_create_1",
          name: "codex.create_entry",
          arguments: "{\"name\":\"Mara\"}",
        }],
      }),
    });
    expect(requestBody).toMatchObject({
      stream: true,
      messages: [
        { role: "system" },
        { role: "assistant", reasoning_content: "Earlier reasoning" },
        { role: "tool", tool_call_id: "call_prior" },
        { role: "user" },
      ],
      tools: [{ type: "function", function: { name: "codex_create_entry" } }],
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
