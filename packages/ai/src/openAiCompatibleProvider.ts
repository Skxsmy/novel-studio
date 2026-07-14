import type { z } from "zod";
import {
  type AiProvider,
  TokenUsageSchema,
  type ContextBundle,
  type ModelCallError,
  type ModelParameters,
  type ModelProfile,
  type TokenUsage,
} from "@novel-studio/contracts";
import type { CredentialStore } from "./credentials.js";
import { CredentialStoreError } from "./credentials.js";
import { classifyProviderError, ProviderAdapterError } from "./errors.js";
import type {
  ProviderAdapter,
  ProviderChatCapabilities,
  ProviderChatMessage,
  ProviderChatRequest,
  ProviderChatResult,
  ProviderConnectionResult,
  ProviderDescriptor,
  ProviderEmbeddingRequest,
  ProviderModelDescriptor,
  ProviderObjectRequest,
  ProviderPrompt,
  ProviderTextRequest,
} from "./provider.js";

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
type OpenAiCompatibleRoutedProvider = Extract<
  AiProvider,
  "openai-compatible" | "deepseek" | "openai" | "openrouter" | "ollama"
>;
type InstructionRole = "system" | "developer";
type MaxOutputTokenField = "max_tokens" | "max_completion_tokens";

interface OpenAiCompatibleProviderOptions {
  credentialStore: CredentialStore;
  fetchImpl?: FetchLike;
  provider?: OpenAiCompatibleRoutedProvider;
  title?: string;
  defaultBaseUrl?: string | null;
  models?: ProviderModelDescriptor[];
  instructionRole?: InstructionRole;
  maxOutputTokenField?: MaxOutputTokenField;
  chatCapabilities?: Partial<ProviderChatCapabilities>;
}

interface OpenAiErrorBody {
  error?: {
    message?: unknown;
    code?: unknown;
    type?: unknown;
  };
  message?: unknown;
}

interface OpenAiModelListBody {
  object?: unknown;
  data?: Array<{
    id?: unknown;
    object?: unknown;
    owned_by?: unknown;
    name?: unknown;
    context_length?: unknown;
  }>;
}
type OpenAiModelListItem = NonNullable<OpenAiModelListBody["data"]>[number];

interface OpenAiChatCompletionBody {
  choices?: Array<{
    finish_reason?: unknown;
    message?: {
      content?: unknown;
      reasoning?: unknown;
      reasoning_content?: unknown;
      reasoning_details?: unknown;
      thinking?: unknown;
      tool_calls?: unknown;
    };
  }>;
  usage?: {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
    total_tokens?: unknown;
  };
}

interface OpenAiCompatibleMessageDelta {
  content?: unknown;
  reasoning?: unknown;
  reasoning_content?: unknown;
  reasoning_details?: unknown;
  thinking?: unknown;
  tool_calls?: unknown;
}

interface OpenAiCompatibleChoice {
  delta?: OpenAiCompatibleMessageDelta;
  message?: OpenAiCompatibleMessageDelta;
  text?: unknown;
}

const OPENAI_COMPATIBLE_CAPABILITIES = {
  streamText: true,
  structuredOutput: true,
  embeddings: false,
  tokenEstimate: true,
  modelList: true,
} as const;

const DEFAULT_CHAT_CAPABILITIES: ProviderChatCapabilities = {
  nativeToolCalls: true,
  reasoningReplay: false,
  parallelToolCalls: false,
  strictToolSchema: false,
};

const DEEPSEEK_MODELS: ProviderModelDescriptor[] = [
  {
    id: "deepseek-v4-flash",
    title: "DeepSeek V4 Flash",
    contextWindowTokens: 1_000_000,
    capabilities: OPENAI_COMPATIBLE_CAPABILITIES,
  },
  {
    id: "deepseek-v4-pro",
    title: "DeepSeek V4 Pro",
    contextWindowTokens: 1_000_000,
    capabilities: OPENAI_COMPATIBLE_CAPABILITIES,
  },
];

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const OPENAI_DEFAULT_BASE_URL = "https://api.openai.com/v1";
const OPENROUTER_DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const OLLAMA_DEFAULT_BASE_URL = "http://localhost:11434/v1";
const GENERIC_CONTEXT_WINDOW_TOKENS = 8192;

function sanitizeProviderMessage(value: unknown): string {
  const text = typeof value === "string" && value.trim()
    ? value.trim()
    : "Provider 返回错误。";
  return text
    .replace(/sk-[A-Za-z0-9_-]{8,}/gu, "sk-***")
    .replace(/bearer\s+[A-Za-z0-9._-]+/giu, "Bearer ***");
}

function countTokensApprox(value: string): number {
  return Math.ceil(Array.from(value).length / 2);
}

function promptText(prompt: ProviderPrompt): string {
  return [prompt.system, prompt.instructions, prompt.user].join("\n\n");
}

function contextItemsText(contextBundle: ContextBundle | null): string {
  if (!contextBundle) return "";
  return contextBundle.items
    .map((item) => `## ${item.title}\n${item.content}`)
    .join("\n\n");
}

function contextText(request: ProviderTextRequest): string {
  return [
    promptText(request.prompt),
    contextItemsText(request.contextBundle),
  ].filter(Boolean).join("\n\n");
}

function textFromProviderField(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((item) => textFromProviderField(item)).filter(Boolean).join("");
  }
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return textFromProviderField(object.text ?? object.content ?? object.summary ?? object.reasoning);
  }
  return "";
}

function reasoningTextFromDetails(value: unknown): string {
  if (!Array.isArray(value)) return textFromProviderField(value);
  return value
    .map((detail) => {
      if (!detail || typeof detail !== "object") return textFromProviderField(detail);
      const object = detail as Record<string, unknown>;
      return textFromProviderField(object.text ?? object.content ?? object.summary ?? object.reasoning);
    })
    .filter(Boolean)
    .join("\n");
}

function reasoningTextFromDelta(delta: OpenAiCompatibleMessageDelta | undefined): string {
  if (!delta) return "";
  const rawReasoning = textFromProviderField(
    delta.reasoning_content ?? delta.reasoning ?? delta.thinking,
  );
  const detailReasoning = reasoningTextFromDetails(delta.reasoning_details);
  return [rawReasoning, detailReasoning].filter(Boolean).join("\n");
}

function taggedReasoning(value: string): string {
  return value ? `<think>${value}</think>` : "";
}

function endpoint(baseUrl: string | null | undefined, defaultBaseUrl: string | null, pathname: string): string {
  const resolvedBaseUrl = baseUrl?.trim() || defaultBaseUrl;
  if (!resolvedBaseUrl) {
    throw new ProviderAdapterError("provider-error", "请先填写模型服务地址。", {
      retryable: false,
    });
  }
  const base = new URL(resolvedBaseUrl);
  const normalized = base.href.endsWith("/") ? base.href : `${base.href}/`;
  return new URL(pathname.replace(/^\//u, ""), normalized).toString();
}

function mergedParameters(profile: ModelProfile, requestParameters?: ModelParameters): ModelParameters {
  return {
    ...profile.defaultParameters,
    ...requestParameters,
  };
}

function chatBody(
  modelProfile: ModelProfile,
  prompt: ProviderPrompt,
  contextBundle: ContextBundle | null,
  parameters: ModelParameters | undefined,
  stream: boolean,
  options: { instructionRole: InstructionRole; maxOutputTokenField: MaxOutputTokenField },
): Record<string, unknown> {
  const merged = mergedParameters(modelProfile, parameters);
  const body: Record<string, unknown> = {
    model: modelProfile.model,
    stream,
    messages: [
      {
        role: options.instructionRole,
        content: [prompt.system, prompt.instructions].filter(Boolean).join("\n\n"),
      },
      {
        role: "user",
        content: [
          contextItemsText(contextBundle),
          prompt.user,
        ].filter(Boolean).join("\n\n"),
      },
    ],
  };

  if (typeof merged.temperature === "number") body.temperature = merged.temperature;
  if (typeof merged.topP === "number") body.top_p = merged.topP;
  if (typeof merged.maxOutputTokens === "number") {
    body[options.maxOutputTokenField] = merged.maxOutputTokens;
  }

  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === null) continue;
    if (key === "temperature" || key === "topP" || key === "maxOutputTokens") continue;
    body[key] = value;
  }
  return body;
}

interface ProviderToolNameMap {
  canonicalToProvider: Map<string, string>;
  providerToCanonical: Map<string, string>;
}

function providerToolNames(tools: ProviderChatRequest["tools"]): ProviderToolNameMap {
  const canonicalToProvider = new Map<string, string>();
  const providerToCanonical = new Map<string, string>();
  for (const tool of tools ?? []) {
    if (canonicalToProvider.has(tool.name)) {
      throw new ProviderAdapterError("provider-error", `Duplicate tool ID: ${tool.name}`, {
        retryable: false,
      });
    }
    const normalized = tool.name.replace(/[^a-zA-Z0-9_-]/gu, "_") || "tool";
    let providerName = normalized.slice(0, 64);
    let discriminator = 2;
    while (providerToCanonical.has(providerName)) {
      const suffix = `_${discriminator}`;
      providerName = `${normalized.slice(0, 64 - suffix.length)}${suffix}`;
      discriminator += 1;
    }
    canonicalToProvider.set(tool.name, providerName);
    providerToCanonical.set(providerName, tool.name);
  }
  return { canonicalToProvider, providerToCanonical };
}

function providerToolName(name: string, names: ProviderToolNameMap): string {
  const providerName = names.canonicalToProvider.get(name);
  if (!providerName) {
    throw new ProviderAdapterError("provider-error", `Tool history references an unavailable tool: ${name}`, {
      retryable: false,
    });
  }
  return providerName;
}

function openAiHistoryMessage(
  message: ProviderChatMessage,
  capabilities: ProviderChatCapabilities,
  toolNames: ProviderToolNameMap,
): Record<string, unknown> {
  if (message.role === "user") {
    return { role: "user", content: message.content };
  }
  if (message.role === "tool") {
    return {
      role: "tool",
      content: message.content,
      tool_call_id: message.toolCallId,
    };
  }
  const result: Record<string, unknown> = {
    role: "assistant",
    content: message.content,
  };
  if (capabilities.reasoningReplay && message.reasoningContent) {
    result.reasoning_content = message.reasoningContent;
  }
  if (message.toolCalls?.length) {
    result.tool_calls = message.toolCalls.map((call) => ({
      id: call.id,
      type: "function",
      function: {
        name: providerToolName(call.name, toolNames),
        arguments: call.arguments,
      },
    }));
  }
  return result;
}

function parseToolCalls(
  value: unknown,
  toolNames: ProviderToolNameMap,
): ProviderChatResult["toolCalls"] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new ProviderAdapterError("provider-error", "Provider returned an invalid tool-call list.", {
      retryable: true,
    });
  }
  return value.map((rawCall) => {
    if (!rawCall || typeof rawCall !== "object") {
      throw new ProviderAdapterError("provider-error", "Provider returned an invalid tool call.", {
        retryable: true,
      });
    }
    const call = rawCall as Record<string, unknown>;
    const fn = call.function;
    if (!fn || typeof fn !== "object") {
      throw new ProviderAdapterError("provider-error", "Provider tool call is missing its function payload.", {
        retryable: true,
      });
    }
    const functionPayload = fn as Record<string, unknown>;
    const id = typeof call.id === "string" ? call.id.trim() : "";
    const name = typeof functionPayload.name === "string" ? functionPayload.name.trim() : "";
    const rawArguments = functionPayload.arguments;
    const argumentsText = typeof rawArguments === "string"
      ? rawArguments
      : rawArguments && typeof rawArguments === "object"
        ? JSON.stringify(rawArguments)
        : "";
    if (!id || !name || !argumentsText) {
      throw new ProviderAdapterError("provider-error", "Provider tool call is incomplete.", {
        retryable: true,
      });
    }
    return {
      id,
      name: toolNames.providerToCanonical.get(name) ?? name,
      arguments: argumentsText,
    };
  });
}

function tokenUsageFromOpenAi(value: OpenAiChatCompletionBody["usage"]): TokenUsage | null {
  if (!value) return null;
  const inputTokens = typeof value.prompt_tokens === "number" ? value.prompt_tokens : 0;
  const outputTokens = typeof value.completion_tokens === "number" ? value.completion_tokens : 0;
  const totalTokens = typeof value.total_tokens === "number"
    ? value.total_tokens
    : inputTokens + outputTokens;
  return TokenUsageSchema.parse({ inputTokens, outputTokens, totalTokens });
}

function errorCodeFromStatus(status: number): ModelCallError["code"] {
  if (status === 401 || status === 403) return "provider-auth-failed";
  if (status === 402) return "provider-billing-required";
  if (status === 404) return "model-unavailable";
  if (status === 408 || status === 500 || status === 502 || status === 503 || status === 504) {
    return "provider-unavailable";
  }
  if (status === 429) return "provider-rate-limited";
  return "provider-error";
}

function retryableFromStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504;
}

function staticModelDescriptor(
  modelProfile: ModelProfile,
  knownModels: ProviderModelDescriptor[],
  modelId: string,
  source?: OpenAiModelListItem,
): ProviderModelDescriptor {
  const contextWindowTokens = typeof source?.context_length === "number" && source.context_length > 0
    ? source.context_length
    : modelProfile.contextWindowTokens;
  return knownModels.find((model) => model.id === modelId) ?? {
    id: modelId,
    title: typeof source?.name === "string" && source.name.trim() ? source.name.trim() : modelId,
    contextWindowTokens,
    capabilities: modelProfile.capabilities,
  };
}

export class OpenAiCompatibleProvider implements ProviderAdapter {
  readonly provider: OpenAiCompatibleRoutedProvider;
  readonly chatCapabilities: ProviderChatCapabilities;
  private readonly fetchImpl: FetchLike;
  private readonly title: string;
  private readonly defaultBaseUrl: string | null;
  private readonly models: ProviderModelDescriptor[];
  private readonly instructionRole: InstructionRole;
  private readonly maxOutputTokenField: MaxOutputTokenField;

  constructor(private readonly options: OpenAiCompatibleProviderOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.provider = options.provider ?? "openai-compatible";
    this.title = options.title ?? "OpenAI 兼容服务";
    this.defaultBaseUrl = options.defaultBaseUrl ?? null;
    this.models = options.models ?? [];
    this.instructionRole = options.instructionRole ?? "system";
    this.maxOutputTokenField = options.maxOutputTokenField ?? "max_tokens";
    this.chatCapabilities = {
      ...DEFAULT_CHAT_CAPABILITIES,
      ...options.chatCapabilities,
    };
  }

  describeCapabilities(): ProviderDescriptor {
    return {
      provider: this.provider,
      title: this.title,
      capabilities: OPENAI_COMPATIBLE_CAPABILITIES,
      models: this.models,
    };
  }

  async testConnection(modelProfile: ModelProfile): Promise<ProviderConnectionResult> {
    try {
      this.assertProfileProvider(modelProfile);
      const models = await this.listModels(modelProfile);
      return {
        ok: true,
        provider: this.provider,
        modelProfileId: modelProfile.id,
        capabilities: modelProfile.capabilities,
        models,
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
    const secret = await this.readOptionalSecret(modelProfile);
    const response = await this.fetchImpl(endpoint(modelProfile.baseUrl, this.defaultBaseUrl, "/models"), {
      method: "GET",
      headers: this.headers(secret),
    });
    await this.assertOk(response);
    const body = await response.json() as OpenAiModelListBody;
    if (body.object !== undefined && body.object !== "list") {
      throw new ProviderAdapterError("provider-error", "Provider 模型列表格式不符合 OpenAI 兼容约定。", {
        retryable: false,
        providerStatus: response.status,
      });
    }
    if (!Array.isArray(body.data)) {
      throw new ProviderAdapterError("provider-error", "Provider 没有返回模型列表。", {
        retryable: false,
        providerStatus: response.status,
      });
    }
    const uniqueItems = new Map<string, OpenAiModelListItem>();
    for (const item of body.data.filter((value) => value && typeof value === "object")) {
      const id = typeof item.id === "string" ? item.id.trim() : "";
      if (!id) continue;
      if (!uniqueItems.has(id)) uniqueItems.set(id, item);
    }
    return [...uniqueItems.entries()].map(([id, item]) =>
      staticModelDescriptor(modelProfile, this.models, id, item)
    );
  }

  async *streamText(request: ProviderTextRequest): AsyncIterable<string> {
    this.assertProfileProvider(request.modelProfile);
    this.assertContextFits(request);
    const secret = await this.readOptionalSecret(request.modelProfile);
    const init: RequestInit = {
      method: "POST",
      headers: this.headers(secret),
      body: JSON.stringify(chatBody(request.modelProfile, request.prompt, request.contextBundle, request.parameters, true, {
        instructionRole: this.instructionRole,
        maxOutputTokenField: this.maxOutputTokenField,
      })),
    };
    if (request.abortSignal) init.signal = request.abortSignal;
    const response = await this.fetchImpl(endpoint(request.modelProfile.baseUrl, this.defaultBaseUrl, "/chat/completions"), {
      ...init,
    });
    await this.assertOk(response);
    if (!response.body) {
      throw new ProviderAdapterError("provider-error", "Provider 没有返回可读取的流。", {
        providerStatus: response.status,
      });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split(/\r?\n\r?\n/u);
      buffer = chunks.pop() ?? "";
      for (const chunk of chunks) {
        const text = this.deltaFromSse(chunk);
        if (text) yield text;
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      const text = this.deltaFromSse(buffer);
      if (text) yield text;
    }
  }

  async completeChat(request: ProviderChatRequest): Promise<ProviderChatResult> {
    this.assertProfileProvider(request.modelProfile);
    this.assertContextFits(request);
    if (request.tools?.length && !this.chatCapabilities.nativeToolCalls) {
      throw new ProviderAdapterError(
        "model-unavailable",
        "The selected Provider adapter does not declare native tool-call support.",
        { retryable: false },
      );
    }
    const secret = await this.readOptionalSecret(request.modelProfile);
    const body = chatBody(
      request.modelProfile,
      request.prompt,
      request.contextBundle,
      request.parameters,
      false,
      {
        instructionRole: this.instructionRole,
        maxOutputTokenField: this.maxOutputTokenField,
      },
    );
    const toolNames = providerToolNames(request.tools);
    const messages = body.messages as Array<Record<string, unknown>>;
    messages.push(...(request.history ?? []).map((message) =>
      openAiHistoryMessage(message, this.chatCapabilities, toolNames)
    ));
    if (request.tools?.length) {
      body.tools = request.tools.map((tool) => ({
        type: "function",
        function: {
          name: providerToolName(tool.name, toolNames),
          description: tool.description,
          parameters: tool.parameters,
          ...(tool.strict !== undefined && this.chatCapabilities.strictToolSchema
            ? { strict: tool.strict }
            : {}),
        },
      }));
      body.tool_choice = request.toolChoice ?? "auto";
      if (!this.chatCapabilities.parallelToolCalls) body.parallel_tool_calls = false;
    }
    const init: RequestInit = {
      method: "POST",
      headers: this.headers(secret),
      body: JSON.stringify(body),
    };
    if (request.abortSignal) init.signal = request.abortSignal;
    const response = await this.fetchImpl(
      endpoint(request.modelProfile.baseUrl, this.defaultBaseUrl, "/chat/completions"),
      init,
    );
    await this.assertOk(response);
    const responseBody = await response.json() as OpenAiChatCompletionBody;
    const choice = responseBody.choices?.[0];
    const message = choice?.message;
    const rawResponseText = message ? JSON.stringify(message) : "";
    if (!message) {
      throw new ProviderAdapterError("provider-error", "Provider did not return an assistant message.", {
        retryable: true,
        providerStatus: response.status,
        rawOutput: rawResponseText,
      });
    }
    const text = textFromProviderField(message.content);
    const reasoningContent = reasoningTextFromDelta(message);
    const toolCalls = parseToolCalls(message.tool_calls, toolNames);
    if (!text && !toolCalls.length) {
      throw new ProviderAdapterError("provider-error", "Provider returned an empty assistant response.", {
        retryable: true,
        providerStatus: response.status,
        rawOutput: rawResponseText,
      });
    }
    return {
      text,
      reasoningContent,
      toolCalls,
      finishReason: typeof choice.finish_reason === "string" ? choice.finish_reason : null,
      usage: tokenUsageFromOpenAi(responseBody.usage),
      rawResponseText,
    };
  }

  async generateObject<T>(
    request: ProviderObjectRequest,
    schema: z.ZodType<T>,
  ): Promise<T> {
    this.assertProfileProvider(request.modelProfile);
    this.assertContextFits(request);
    const secret = await this.readOptionalSecret(request.modelProfile);
    const init: RequestInit = {
      method: "POST",
      headers: this.headers(secret),
      body: JSON.stringify({
        ...chatBody(request.modelProfile, request.prompt, request.contextBundle, request.parameters, false, {
          instructionRole: this.instructionRole,
          maxOutputTokenField: this.maxOutputTokenField,
        }),
        response_format: { type: "json_object" },
      }),
    };
    if (request.abortSignal) init.signal = request.abortSignal;
    const response = await this.fetchImpl(endpoint(request.modelProfile.baseUrl, this.defaultBaseUrl, "/chat/completions"), {
      ...init,
    });
    await this.assertOk(response);
    const body = await response.json() as OpenAiChatCompletionBody;
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new ProviderAdapterError("structured-output-failed", "Provider 没有返回可解析的结构化内容。", {
        providerStatus: response.status,
      });
    }
    try {
      return schema.parse(JSON.parse(content));
    } catch (error) {
      throw new ProviderAdapterError("structured-output-failed", "Provider 返回的结构化内容不符合契约。", {
        providerStatus: response.status,
        cause: error,
        rawOutput: content,
      });
    }
  }

  async embed(_request: ProviderEmbeddingRequest): Promise<number[]> {
    throw new ProviderAdapterError("model-unavailable", "当前 OpenAI 兼容配置未声明 Embedding 能力。", {
      retryable: false,
    });
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

  private headers(secret: string | null): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (secret) {
      headers.authorization = `Bearer ${secret}`;
    }
    return headers;
  }

  private async readOptionalSecret(modelProfile: ModelProfile): Promise<string | null> {
    if (!modelProfile.credentialRef) {
      return null;
    }
    try {
      const secret = await this.options.credentialStore.readSecret(modelProfile.credentialRef);
      if (!secret.trim()) {
        throw new ProviderAdapterError("provider-auth-failed", "系统凭据为空。", {
          retryable: false,
        });
      }
      return secret;
    } catch (error) {
      if (error instanceof ProviderAdapterError) throw error;
      if (error instanceof CredentialStoreError) {
        throw new ProviderAdapterError(
          error.code === "credential-not-found" ? "provider-auth-failed" : "permission-denied",
          error.code === "credential-not-found"
            ? "系统凭据中没有找到该密钥。"
            : "当前环境无法读取系统凭据；不会回退到明文文件。",
          { retryable: false, cause: error },
        );
      }
      throw error;
    }
  }

  private async assertOk(response: Response): Promise<void> {
    if (response.ok) return;
    let message: string = response.statusText || "Provider 请求失败。";
    try {
      const body = await response.json() as OpenAiErrorBody;
      message = sanitizeProviderMessage(body.error?.message ?? body.message ?? message);
    } catch {
      // Keep the sanitized status text.
    }
    throw new ProviderAdapterError(errorCodeFromStatus(response.status), message, {
      retryable: retryableFromStatus(response.status),
      providerStatus: response.status,
    });
  }

  private deltaFromSse(raw: string): string {
    const lines = raw
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("data:"));
    let text = "";
    for (const line of lines) {
      const data = line.slice("data:".length).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const event = JSON.parse(data) as { choices?: OpenAiCompatibleChoice[] };
        const choice = event.choices?.[0];
        const delta = choice?.delta ?? choice?.message;
        const reasoning = reasoningTextFromDelta(delta);
        const content = textFromProviderField(delta?.content ?? choice?.text);
        text += `${taggedReasoning(reasoning)}${content}`;
      } catch (error) {
        throw new ProviderAdapterError("provider-error", "Provider 返回了无法解析的流式事件。", {
          retryable: false,
          cause: error,
        });
      }
    }
    return text;
  }

  private assertContextFits(request: ProviderTextRequest): void {
    const estimated = this.estimateTokens(contextText(request)).totalTokens;
    if (estimated > request.modelProfile.contextWindowTokens) {
      throw new ProviderAdapterError("context-too-large", "上下文超过模型窗口。", {
        retryable: false,
      });
    }
  }

  private assertProfileProvider(modelProfile: ModelProfile): void {
    if (modelProfile.provider !== this.provider) {
      throw new ProviderAdapterError("provider-error", "ModelProfile 与当前 Provider 不匹配。", {
        retryable: false,
      });
    }
  }
}

export function openAiCompatibleDefaults() {
  return {
    provider: "openai-compatible" as const,
    baseUrl: null,
    model: "填写模型代号",
    capabilities: OPENAI_COMPATIBLE_CAPABILITIES,
    contextWindowTokens: GENERIC_CONTEXT_WINDOW_TOKENS,
  };
}

export function deepSeekDefaults() {
  return {
    provider: "deepseek" as const,
    baseUrl: DEFAULT_BASE_URL,
    model: "deepseek-v4-flash",
    capabilities: OPENAI_COMPATIBLE_CAPABILITIES,
    contextWindowTokens: 1_000_000,
  };
}

export function openAiDefaults() {
  return {
    provider: "openai" as const,
    baseUrl: OPENAI_DEFAULT_BASE_URL,
    model: "填写模型代号",
    capabilities: OPENAI_COMPATIBLE_CAPABILITIES,
    contextWindowTokens: GENERIC_CONTEXT_WINDOW_TOKENS,
  };
}

export function openRouterDefaults() {
  return {
    provider: "openrouter" as const,
    baseUrl: OPENROUTER_DEFAULT_BASE_URL,
    model: "填写模型代号",
    capabilities: OPENAI_COMPATIBLE_CAPABILITIES,
    contextWindowTokens: GENERIC_CONTEXT_WINDOW_TOKENS,
  };
}

export function ollamaDefaults() {
  return {
    provider: "ollama" as const,
    baseUrl: OLLAMA_DEFAULT_BASE_URL,
    model: "gpt-oss:20b",
    capabilities: OPENAI_COMPATIBLE_CAPABILITIES,
    contextWindowTokens: GENERIC_CONTEXT_WINDOW_TOKENS,
  };
}
