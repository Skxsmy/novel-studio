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
  ProviderConnectionResult,
  ProviderDescriptor,
  ProviderEmbeddingRequest,
  ProviderModelDescriptor,
  ProviderObjectRequest,
  ProviderPrompt,
  ProviderTextRequest,
} from "./provider.js";

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

interface OpenAiCompatibleProviderOptions {
  credentialStore: CredentialStore;
  fetchImpl?: FetchLike;
  provider?: Extract<AiProvider, "openai-compatible" | "deepseek">;
  title?: string;
  defaultBaseUrl?: string | null;
  models?: ProviderModelDescriptor[];
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
  }>;
}

interface OpenAiChatCompletionBody {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
  usage?: {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
    total_tokens?: unknown;
  };
}

const OPENAI_COMPATIBLE_CAPABILITIES = {
  streamText: true,
  structuredOutput: true,
  embeddings: false,
  tokenEstimate: true,
  modelList: true,
} as const;

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

function contextText(request: ProviderTextRequest): string {
  const context = request.contextBundle?.items.map((item) => item.content).join("\n\n") ?? "";
  return [promptText(request.prompt), context].filter(Boolean).join("\n\n");
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
  parameters: ModelParameters | undefined,
  stream: boolean,
): Record<string, unknown> {
  const merged = mergedParameters(modelProfile, parameters);
  const body: Record<string, unknown> = {
    model: modelProfile.model,
    stream,
    messages: [
      {
        role: "system",
        content: [prompt.system, prompt.instructions].filter(Boolean).join("\n\n"),
      },
      {
        role: "user",
        content: prompt.user,
      },
    ],
  };

  if (typeof merged.temperature === "number") body.temperature = merged.temperature;
  if (typeof merged.topP === "number") body.top_p = merged.topP;
  if (typeof merged.maxOutputTokens === "number") body.max_tokens = merged.maxOutputTokens;

  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === null) continue;
    if (key === "temperature" || key === "topP" || key === "maxOutputTokens") continue;
    body[key] = value;
  }
  return body;
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
): ProviderModelDescriptor {
  return knownModels.find((model) => model.id === modelId) ?? {
    id: modelId,
    title: modelId,
    contextWindowTokens: modelProfile.contextWindowTokens,
    capabilities: modelProfile.capabilities,
  };
}

export class OpenAiCompatibleProvider implements ProviderAdapter {
  readonly provider: Extract<AiProvider, "openai-compatible" | "deepseek">;
  private readonly fetchImpl: FetchLike;
  private readonly title: string;
  private readonly defaultBaseUrl: string | null;
  private readonly models: ProviderModelDescriptor[];

  constructor(private readonly options: OpenAiCompatibleProviderOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.provider = options.provider ?? "openai-compatible";
    this.title = options.title ?? "OpenAI 兼容服务";
    this.defaultBaseUrl = options.defaultBaseUrl ?? null;
    this.models = options.models ?? [];
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
    const modelIds = body.data
      .filter((item) => item && typeof item === "object")
      .map((item) => item.id)
      .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      .map((id) => id.trim());
    const uniqueIds = Array.from(new Set(modelIds));
    return uniqueIds.map((id) => staticModelDescriptor(modelProfile, this.models, id));
  }

  async *streamText(request: ProviderTextRequest): AsyncIterable<string> {
    this.assertProfileProvider(request.modelProfile);
    this.assertContextFits(request);
    const secret = await this.readOptionalSecret(request.modelProfile);
    const init: RequestInit = {
      method: "POST",
      headers: this.headers(secret),
      body: JSON.stringify(chatBody(request.modelProfile, request.prompt, request.parameters, true)),
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
        ...chatBody(request.modelProfile, request.prompt, request.parameters, false),
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
        const event = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: unknown }; text?: unknown }>;
        };
        const content = event.choices?.[0]?.delta?.content ?? event.choices?.[0]?.text;
        if (typeof content === "string") text += content;
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
