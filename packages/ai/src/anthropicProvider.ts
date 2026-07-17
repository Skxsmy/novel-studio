import type { z } from "zod";
import {
  normalizeReasoningConfigurationForModel,
  ModelParametersSchema,
  TokenUsageSchema,
  type ContextBundle,
  type ModelCallError,
  type ModelParameters,
  type ModelProfile,
  type ProviderReasoningControl,
  type ReasoningConfiguration,
  type ReasoningOutputKind,
  type TokenUsage,
} from "@novel-studio/contracts";
import type { CredentialStore } from "./credentials.js";
import { CredentialStoreError } from "./credentials.js";
import { classifyProviderError, ProviderAdapterError } from "./errors.js";
import type {
  ProviderAdapter,
  ProviderChatStreamEvent,
  ProviderChatRequest,
  ProviderChatResult,
  ProviderConnectionResult,
  ProviderDescriptor,
  ProviderEmbeddingRequest,
  ProviderModelDescriptor,
  ProviderObjectRequest,
  ProviderPrompt,
  ProviderTextRequest,
  ProviderTextStreamEvent,
} from "./provider.js";

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

interface AnthropicProviderOptions {
  credentialStore: CredentialStore;
  fetchImpl?: FetchLike;
}

interface AnthropicErrorBody {
  error?: {
    message?: unknown;
    type?: unknown;
  };
  message?: unknown;
  type?: unknown;
}

interface AnthropicModelListBody {
  data?: AnthropicModelListItem[];
  first_id?: unknown;
  has_more?: unknown;
  last_id?: unknown;
}

interface AnthropicModelListItem {
  id?: unknown;
  display_name?: unknown;
  max_input_tokens?: unknown;
  max_tokens?: unknown;
  type?: unknown;
}

interface AnthropicMessageBody {
  content?: Array<{
    text?: unknown;
    type?: unknown;
  }>;
  usage?: {
    input_tokens?: unknown;
    output_tokens?: unknown;
  };
}

interface AnthropicStreamEvent {
  delta?: {
    thinking?: unknown;
    text?: unknown;
    type?: unknown;
    stop_reason?: unknown;
  };
  error?: { message?: unknown; type?: unknown };
  message?: { usage?: { input_tokens?: unknown; output_tokens?: unknown } };
  type?: unknown;
  usage?: { input_tokens?: unknown; output_tokens?: unknown };
}

type AnthropicParsedStreamEvent =
  | ProviderTextStreamEvent
  | { type: "usage"; inputTokens?: number; outputTokens?: number }
  | { type: "finish"; finishReason: string | null };

const ANTHROPIC_API_VERSION = "2023-06-01";
const ANTHROPIC_DEFAULT_BASE_URL = "https://api.anthropic.com";
const ANTHROPIC_DEFAULT_CONTEXT_WINDOW_TOKENS = 200_000;
const ANTHROPIC_DEFAULT_MAX_OUTPUT_TOKENS = 4096;
const MAX_MODEL_LIST_PAGES = 20;

const ANTHROPIC_CAPABILITIES = {
  streamText: true,
  structuredOutput: true,
  embeddings: false,
  tokenEstimate: true,
  modelList: true,
} as const;

const ANTHROPIC_EXACT_REASONING_CONTROLS: Readonly<Record<string, ProviderReasoningControl>> = {
  "claude-fable-5": {
    kind: "effort",
    efforts: ["low", "medium", "high", "xhigh", "max"],
    defaultEffort: "high",
    canDisable: false,
  },
  "claude-opus-4-8": {
    kind: "effort",
    efforts: ["low", "medium", "high", "xhigh", "max"],
    defaultEffort: "high",
    canDisable: true,
  },
  "claude-opus-4-7": {
    kind: "effort",
    efforts: ["low", "medium", "high", "xhigh", "max"],
    defaultEffort: "high",
    canDisable: true,
  },
  "claude-opus-4-6": {
    kind: "effort",
    efforts: ["low", "medium", "high", "max"],
    defaultEffort: "high",
    canDisable: true,
  },
  "claude-sonnet-4-6": {
    kind: "effort",
    efforts: ["low", "medium", "high", "max"],
    defaultEffort: "high",
    canDisable: true,
  },
  "claude-sonnet-5": {
    kind: "effort",
    efforts: ["low", "medium", "high", "xhigh", "max"],
    defaultEffort: "high",
    canDisable: true,
  },
};

function anthropicReasoningControl(modelId: string): ProviderReasoningControl {
  return ANTHROPIC_EXACT_REASONING_CONTROLS[modelId] ?? { kind: "unsupported" };
}

function sanitizeProviderMessage(value: unknown): string {
  const text = typeof value === "string" && value.trim()
    ? value.trim()
    : "Anthropic request failed.";
  return text
    .replace(/sk-ant-[A-Za-z0-9_-]{8,}/gu, "sk-ant-***")
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

function anthropicEndpoint(
  baseUrl: string | null | undefined,
  pathname: string,
  searchParams?: Record<string, string | number>,
): string {
  const resolvedBaseUrl = baseUrl?.trim() || ANTHROPIC_DEFAULT_BASE_URL;
  const base = new URL(resolvedBaseUrl);
  const normalized = base.href.endsWith("/") ? base.href : `${base.href}/`;
  const path = base.pathname.replace(/\/$/u, "").endsWith("/v1") && pathname.startsWith("/v1/")
    ? pathname.replace(/^\/v1\//u, "")
    : pathname.replace(/^\//u, "");
  const url = new URL(path, normalized);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function anthropicMessageBody(
  modelProfile: ModelProfile,
  prompt: ProviderPrompt,
  contextBundle: ContextBundle | null,
  resolvedParameters: ModelParameters,
  stream: boolean,
  history: ProviderChatRequest["history"] = [],
): Record<string, unknown> {
  const merged = resolvedParameters;
  const reasoning: ReasoningConfiguration | null = merged.reasoning ?? null;
  const body: Record<string, unknown> = {
    model: modelProfile.model,
    max_tokens: typeof merged.maxOutputTokens === "number"
      ? merged.maxOutputTokens
      : ANTHROPIC_DEFAULT_MAX_OUTPUT_TOKENS,
    system: [prompt.system, prompt.instructions].filter(Boolean).join("\n\n"),
    messages: [
      ...(history ?? []).map((message) => {
        if (message.role === "tool" || (message.role === "assistant" && message.toolCalls?.length)) {
          throw new ProviderAdapterError(
            "model-unavailable",
            "Anthropic tool-call history is not implemented by this adapter.",
            { retryable: false },
          );
        }
        return { role: message.role, content: message.content };
      }),
      {
        role: "user",
        content: [
          contextItemsText(contextBundle),
          prompt.user,
        ].filter(Boolean).join("\n\n"),
      },
    ],
  };

  if (reasoning?.mode === "disabled") {
    body.thinking = { type: "disabled" };
  } else if (reasoning?.mode === "effort") {
    body.thinking = { type: "adaptive", display: "summarized" };
    body.output_config = { effort: reasoning.effort };
  }

  if (stream) body.stream = true;
  if (!reasoning || reasoning.mode === "disabled") {
    if (typeof merged.temperature === "number") body.temperature = merged.temperature;
    if (typeof merged.topP === "number") body.top_p = merged.topP;
  }

  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === null) continue;
    if (
      key === "temperature" ||
      key === "topP" ||
      key === "maxOutputTokens" ||
      key === "reasoning"
    ) continue;
    body[key] = value;
  }
  return body;
}

function errorCodeFromStatus(status: number, errorType?: string): ModelCallError["code"] {
  if (status === 401 || status === 403) return "provider-auth-failed";
  if (status === 402) return "provider-billing-required";
  if (status === 404) return "model-unavailable";
  if (status === 413 || errorType === "request_too_large") return "context-too-large";
  if (status === 429 || errorType === "rate_limit_error") return "provider-rate-limited";
  if (status === 408 || status === 500 || status === 502 || status === 503 || status === 504 || status === 529) {
    return "provider-unavailable";
  }
  return "provider-error";
}

function retryableFromStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 500 || status === 502 ||
    status === 503 || status === 504 || status === 529;
}

function descriptorFromAnthropicModel(
  modelProfile: ModelProfile,
  source: AnthropicModelListItem,
): ProviderModelDescriptor | null {
  const id = typeof source.id === "string" ? source.id.trim() : "";
  if (!id) return null;
  return {
    id,
    title: typeof source.display_name === "string" && source.display_name.trim()
      ? source.display_name.trim()
      : id,
    contextWindowTokens: typeof source.max_input_tokens === "number" && source.max_input_tokens > 0
      ? source.max_input_tokens
      : modelProfile.contextWindowTokens,
    capabilities: modelProfile.capabilities,
    reasoning: anthropicReasoningControl(id),
  };
}

function textFromMessageBody(body: AnthropicMessageBody): string {
  const text = body.content
    ?.filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("");
  return text?.trim() ?? "";
}

export class AnthropicProvider implements ProviderAdapter {
  readonly provider = "anthropic" as const;
  readonly chatCapabilities = {
    nativeToolCalls: false,
    reasoningReplay: false,
    parallelToolCalls: false,
    strictToolSchema: false,
  } as const;
  private readonly fetchImpl: FetchLike;

  constructor(private readonly options: AnthropicProviderOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  describeCapabilities(): ProviderDescriptor {
    return {
      provider: this.provider,
      title: "Anthropic",
      capabilities: ANTHROPIC_CAPABILITIES,
      models: [],
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
    const secret = await this.readRequiredSecret(modelProfile);
    const models = new Map<string, ProviderModelDescriptor>();
    let afterId: string | null = null;

    for (let page = 0; page < MAX_MODEL_LIST_PAGES; page += 1) {
      const query: Record<string, string | number> = { limit: 1000 };
      if (afterId) query.after_id = afterId;
      const response = await this.fetchImpl(
        anthropicEndpoint(modelProfile.baseUrl, "/v1/models", query),
        {
          method: "GET",
          headers: this.headers(secret),
        },
      );
      await this.assertOk(response);
      const body = await response.json() as AnthropicModelListBody;
      if (!Array.isArray(body.data)) {
        throw new ProviderAdapterError("provider-error", "Anthropic did not return a model list.", {
          retryable: false,
          providerStatus: response.status,
        });
      }
      for (const item of body.data) {
        const descriptor = descriptorFromAnthropicModel(modelProfile, item);
        if (descriptor && !models.has(descriptor.id)) models.set(descriptor.id, descriptor);
      }
      if (body.has_more !== true) break;
      const lastId = typeof body.last_id === "string" ? body.last_id.trim() : "";
      if (!lastId || lastId === afterId) break;
      afterId = lastId;
    }

    if (models.size === 0) {
      throw new ProviderAdapterError("provider-error", "Anthropic did not return any usable models.", {
        retryable: false,
      });
    }
    return [...models.values()];
  }

  async resolveParameters(
    modelProfile: ModelProfile,
    requestParameters?: ModelParameters,
  ): Promise<ModelParameters> {
    this.assertProfileProvider(modelProfile);
    const resolved: ModelParameters = {
      ...modelProfile.defaultParameters,
      ...requestParameters,
    };
    if (resolved.maxOutputTokens === undefined) {
      resolved.maxOutputTokens = ANTHROPIC_DEFAULT_MAX_OUTPUT_TOKENS;
    }
    let reasoning: ReasoningConfiguration | null;
    try {
      reasoning = normalizeReasoningConfigurationForModel(
        anthropicReasoningControl(modelProfile.model),
        resolved.reasoning ?? modelProfile.reasoningPreference,
      );
    } catch (error) {
      throw new ProviderAdapterError(
        "model-unavailable",
        error instanceof Error ? error.message : "The reasoning preference is invalid for this exact model.",
        { retryable: false, cause: error },
      );
    }
    if (reasoning) resolved.reasoning = reasoning;
    else delete resolved.reasoning;
    if (reasoning && reasoning.mode !== "disabled") {
      delete resolved.temperature;
      delete resolved.topP;
    }
    return ModelParametersSchema.parse(resolved);
  }

  async *streamText(request: ProviderTextRequest): AsyncIterable<ProviderTextStreamEvent> {
    for await (const event of this.streamResponse(request)) {
      if (event.type === "answer-delta" || event.type === "reasoning-delta") yield event;
    }
  }

  async *streamChat(request: ProviderChatRequest): AsyncIterable<ProviderChatStreamEvent> {
    if (request.tools?.length) {
      throw new ProviderAdapterError(
        "model-unavailable",
        "Anthropic native streamed tool calls are not implemented by this adapter.",
        { retryable: false },
      );
    }
    let text = "";
    let reasoningContent = "";
    let reasoningOutputKind: ReasoningOutputKind = "none";
    let inputTokens = 0;
    let outputTokens = 0;
    let finishReason: string | null = null;
    for await (const event of this.streamResponse(request, request.history)) {
      if (event.type === "answer-delta") {
        text += event.text;
        yield event;
      } else if (event.type === "reasoning-delta") {
        reasoningContent += event.text;
        reasoningOutputKind = "summary";
        yield event;
      } else if (event.type === "usage") {
        if (event.inputTokens !== undefined) inputTokens = event.inputTokens;
        if (event.outputTokens !== undefined) outputTokens = event.outputTokens;
      } else {
        finishReason = event.finishReason;
      }
    }
    yield {
      type: "done",
      result: {
        text,
        reasoningContent,
        reasoningOutputKind,
        toolCalls: [],
        finishReason,
        usage: inputTokens || outputTokens
          ? TokenUsageSchema.parse({
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
          })
          : null,
        rawResponseText: JSON.stringify({ content: text, thinking: reasoningContent }),
      },
    };
  }

  async completeChat(request: ProviderChatRequest): Promise<ProviderChatResult> {
    for await (const event of this.streamChat(request)) {
      if (event.type === "done") return event.result;
    }
    throw new ProviderAdapterError("provider-error", "Anthropic did not finish its response.", {
      retryable: true,
    });
  }

  async generateObject<T>(
    request: ProviderObjectRequest,
    schema: z.ZodType<T>,
  ): Promise<T> {
    this.assertProfileProvider(request.modelProfile);
    this.assertContextFits(request);
    const secret = await this.readRequiredSecret(request.modelProfile);
    const jsonInstruction = [
      request.prompt.user,
      `Return only valid JSON${request.outputSchemaName ? ` for ${request.outputSchemaName}` : ""}.`,
    ].join("\n\n");
    const resolvedParameters = await this.parametersForRequest(request);
    const init: RequestInit = {
      method: "POST",
      headers: this.headers(secret),
      body: JSON.stringify(anthropicMessageBody(
        request.modelProfile,
        { ...request.prompt, user: jsonInstruction },
        request.contextBundle,
        resolvedParameters,
        false,
      )),
    };
    if (request.abortSignal) init.signal = request.abortSignal;
    const response = await this.fetchImpl(
      anthropicEndpoint(request.modelProfile.baseUrl, "/v1/messages"),
      init,
    );
    await this.assertOk(response);
    const body = await response.json() as AnthropicMessageBody;
    const content = textFromMessageBody(body);
    if (!content) {
      throw new ProviderAdapterError("structured-output-failed", "Anthropic did not return parsable structured content.", {
        providerStatus: response.status,
      });
    }
    try {
      return schema.parse(JSON.parse(content));
    } catch (error) {
      throw new ProviderAdapterError("structured-output-failed", "Anthropic structured content did not match the contract.", {
        providerStatus: response.status,
        cause: error,
      });
    }
  }

  async embed(_request: ProviderEmbeddingRequest): Promise<number[]> {
    throw new ProviderAdapterError("model-unavailable", "Anthropic embeddings are not enabled in this adapter.", {
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

  private async *streamResponse(
    request: ProviderTextRequest,
    history: ProviderChatRequest["history"] = [],
  ): AsyncIterable<AnthropicParsedStreamEvent> {
    this.assertProfileProvider(request.modelProfile);
    this.assertContextFits(request);
    const secret = await this.readRequiredSecret(request.modelProfile);
    const resolvedParameters = await this.parametersForRequest(request);
    const init: RequestInit = {
      method: "POST",
      headers: this.headers(secret),
      body: JSON.stringify(anthropicMessageBody(
        request.modelProfile,
        request.prompt,
        request.contextBundle,
        resolvedParameters,
        true,
        history,
      )),
    };
    if (request.abortSignal) init.signal = request.abortSignal;
    const response = await this.fetchImpl(
      anthropicEndpoint(request.modelProfile.baseUrl, "/v1/messages"),
      init,
    );
    await this.assertOk(response);
    if (!response.body) {
      throw new ProviderAdapterError("provider-error", "Anthropic did not return a readable stream.", {
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
        for (const event of this.eventsFromSse(chunk)) yield event;
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      for (const event of this.eventsFromSse(buffer)) yield event;
    }
  }

  private headers(secret: string): Record<string, string> {
    return {
      "anthropic-version": ANTHROPIC_API_VERSION,
      "content-type": "application/json",
      "x-api-key": secret,
    };
  }

  private async readRequiredSecret(modelProfile: ModelProfile): Promise<string> {
    if (!modelProfile.credentialRef) {
      throw new ProviderAdapterError("provider-auth-failed", "Anthropic requires a saved service key.", {
        retryable: false,
      });
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
    let message = response.statusText || "Anthropic request failed.";
    let errorType: string | undefined;
    try {
      const body = await response.json() as AnthropicErrorBody;
      message = sanitizeProviderMessage(body.error?.message ?? body.message ?? message);
      errorType = typeof body.error?.type === "string"
        ? body.error.type
        : typeof body.type === "string"
          ? body.type
          : undefined;
    } catch {
      // Keep the sanitized status text.
    }
    throw new ProviderAdapterError(errorCodeFromStatus(response.status, errorType), message, {
      retryable: retryableFromStatus(response.status),
      providerStatus: response.status,
    });
  }

  private eventsFromSse(raw: string): AnthropicParsedStreamEvent[] {
    const dataItems = raw
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trim())
      .filter(Boolean);
    const parsedEvents: AnthropicParsedStreamEvent[] = [];
    for (const data of dataItems) {
      let event: AnthropicStreamEvent;
      try {
        event = JSON.parse(data) as AnthropicStreamEvent;
      } catch (error) {
        throw new ProviderAdapterError("provider-error", "Anthropic returned an unparsable stream event.", {
          retryable: false,
          cause: error,
        });
      }

      if (event.type === "error") {
        throw new ProviderAdapterError(
          errorCodeFromStatus(529, typeof event.error?.type === "string" ? event.error.type : undefined),
          sanitizeProviderMessage(event.error?.message),
          { retryable: true, providerStatus: 529 },
        );
      }
      if (event.type === "message_start") {
        const inputTokens = event.message?.usage?.input_tokens;
        if (typeof inputTokens === "number") {
          parsedEvents.push({ type: "usage", inputTokens });
        }
      } else if (event.type === "message_delta") {
        const outputTokens = event.usage?.output_tokens;
        if (typeof outputTokens === "number") {
          parsedEvents.push({ type: "usage", outputTokens });
        }
        parsedEvents.push({
          type: "finish",
          finishReason: typeof event.delta?.stop_reason === "string"
            ? event.delta.stop_reason
            : null,
        });
      } else if (event.type === "content_block_delta") {
        if (event.delta?.type === "text_delta" && typeof event.delta.text === "string") {
          parsedEvents.push({ type: "answer-delta", text: event.delta.text });
        } else if (
          event.delta?.type === "thinking_delta" &&
          typeof event.delta.thinking === "string"
        ) {
          parsedEvents.push({
            type: "reasoning-delta",
            text: event.delta.thinking,
            outputKind: "summary",
          });
        }
      }
    }
    return parsedEvents;
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

  private async parametersForRequest(request: ProviderTextRequest): Promise<ModelParameters> {
    if (!request.resolvedParameters) {
      return this.resolveParameters(request.modelProfile, request.parameters);
    }
    const resolved = ModelParametersSchema.parse(request.resolvedParameters);
    const normalizedReasoning = normalizeReasoningConfigurationForModel(
      anthropicReasoningControl(request.modelProfile.model),
      resolved.reasoning,
    );
    if (JSON.stringify(normalizedReasoning) !== JSON.stringify(resolved.reasoning ?? null)) {
      throw new ProviderAdapterError(
        "model-unavailable",
        "The supplied resolved reasoning parameters do not match the exact Anthropic model.",
        { retryable: false },
      );
    }
    if (
      normalizedReasoning &&
      normalizedReasoning.mode !== "disabled" &&
      (resolved.temperature !== undefined || resolved.topP !== undefined)
    ) {
      throw new ProviderAdapterError(
        "model-unavailable",
        "Resolved Anthropic thinking parameters must omit temperature and topP.",
        { retryable: false },
      );
    }
    return resolved;
  }
}

export function anthropicDefaults() {
  return {
    provider: "anthropic" as const,
    baseUrl: ANTHROPIC_DEFAULT_BASE_URL,
    model: "填写模型代号",
    capabilities: ANTHROPIC_CAPABILITIES,
    contextWindowTokens: ANTHROPIC_DEFAULT_CONTEXT_WINDOW_TOKENS,
  };
}
