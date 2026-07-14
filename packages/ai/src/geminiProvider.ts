import type { z } from "zod";
import {
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

interface GeminiProviderOptions {
  credentialStore: CredentialStore;
  fetchImpl?: FetchLike;
}

interface GeminiErrorBody {
  error?: {
    code?: unknown;
    details?: unknown;
    message?: unknown;
    status?: unknown;
  };
  message?: unknown;
}

interface GeminiModelListBody {
  models?: GeminiModelListItem[];
  nextPageToken?: unknown;
}

interface GeminiModelListItem {
  baseModelId?: unknown;
  description?: unknown;
  displayName?: unknown;
  inputTokenLimit?: unknown;
  name?: unknown;
  outputTokenLimit?: unknown;
  supportedGenerationMethods?: unknown;
  version?: unknown;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: unknown;
      }>;
    };
    finishReason?: unknown;
  }>;
  error?: GeminiErrorBody["error"];
  usageMetadata?: {
    candidatesTokenCount?: unknown;
    promptTokenCount?: unknown;
    totalTokenCount?: unknown;
  };
}

const GEMINI_DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_DEFAULT_CONTEXT_WINDOW_TOKENS = 1_000_000;
const MAX_MODEL_LIST_PAGES = 20;

const GEMINI_CAPABILITIES = {
  streamText: true,
  structuredOutput: true,
  embeddings: false,
  tokenEstimate: true,
  modelList: true,
} as const;

function sanitizeProviderMessage(value: unknown): string {
  const text = typeof value === "string" && value.trim()
    ? value.trim()
    : "Gemini request failed.";
  return text
    .replace(/AIza[0-9A-Za-z_-]{20,}/gu, "AIza***")
    .replace(/(?:key|api[_-]?key)=([^&\s]+)/giu, "key=***")
    .replace(/x-goog-api-key:\s*[A-Za-z0-9._-]+/giu, "x-goog-api-key: ***")
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

function geminiEndpoint(
  baseUrl: string | null | undefined,
  pathname: string,
  searchParams?: Record<string, string | number>,
): string {
  const resolvedBaseUrl = baseUrl?.trim() || GEMINI_DEFAULT_BASE_URL;
  const base = new URL(resolvedBaseUrl);
  const normalized = base.href.endsWith("/") ? base.href : `${base.href}/`;
  const path = base.pathname.replace(/\/$/u, "").endsWith("/v1beta") && pathname.startsWith("/v1beta/")
    ? pathname.replace(/^\/v1beta\//u, "")
    : pathname.replace(/^\//u, "");
  const url = new URL(path, normalized);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function modelResourceName(model: string): string {
  const trimmed = model.trim();
  if (trimmed.startsWith("models/") || trimmed.startsWith("tunedModels/")) return trimmed;
  return `models/${trimmed}`;
}

function modelResourcePath(model: string): string {
  return modelResourceName(model)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function mergedParameters(profile: ModelProfile, requestParameters?: ModelParameters): ModelParameters {
  return {
    ...profile.defaultParameters,
    ...requestParameters,
  };
}

function generationConfig(
  modelProfile: ModelProfile,
  parameters: ModelParameters | undefined,
  options: { jsonMode?: boolean } = {},
): Record<string, unknown> {
  const merged = mergedParameters(modelProfile, parameters);
  const config: Record<string, unknown> = {};
  if (typeof merged.temperature === "number") config.temperature = merged.temperature;
  if (typeof merged.topP === "number") config.topP = merged.topP;
  if (typeof merged.maxOutputTokens === "number") config.maxOutputTokens = merged.maxOutputTokens;
  if (options.jsonMode) config.responseMimeType = "application/json";

  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === null) continue;
    if (key === "temperature" || key === "topP" || key === "maxOutputTokens") continue;
    config[key] = value;
  }
  return config;
}

function geminiGenerateContentBody(
  modelProfile: ModelProfile,
  prompt: ProviderPrompt,
  contextBundle: ContextBundle | null,
  parameters: ModelParameters | undefined,
  options: { jsonMode?: boolean } = {},
): Record<string, unknown> {
  const systemText = [prompt.system, prompt.instructions].filter(Boolean).join("\n\n");
  const userText = [contextItemsText(contextBundle), prompt.user].filter(Boolean).join("\n\n");
  const config = generationConfig(modelProfile, parameters, options);
  const body: Record<string, unknown> = {
    contents: [
      {
        role: "user",
        parts: [{ text: userText }],
      },
    ],
  };
  if (systemText) {
    body.systemInstruction = {
      parts: [{ text: systemText }],
    };
  }
  if (Object.keys(config).length > 0) body.generationConfig = config;
  return body;
}

function errorCodeFromStatus(status: number, googleStatus?: string): ModelCallError["code"] {
  if (status === 401 || googleStatus === "UNAUTHENTICATED") return "provider-auth-failed";
  if (status === 402) return "provider-billing-required";
  if (status === 403 || googleStatus === "PERMISSION_DENIED") return "provider-auth-failed";
  if (status === 404 || googleStatus === "NOT_FOUND") return "model-unavailable";
  if (status === 413) return "context-too-large";
  if (status === 429 || googleStatus === "RESOURCE_EXHAUSTED") return "provider-rate-limited";
  if (status === 408 || status === 500 || status === 502 || status === 503 || status === 504) {
    return "provider-unavailable";
  }
  return "provider-error";
}

function retryableFromStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 500 ||
    status === 502 || status === 503 || status === 504;
}

function modelIdFromGeminiModel(source: GeminiModelListItem): string {
  const baseModelId = typeof source.baseModelId === "string" ? source.baseModelId.trim() : "";
  if (baseModelId) return baseModelId;
  const name = typeof source.name === "string" ? source.name.trim() : "";
  return name.replace(/^models\//u, "");
}

function supportsGenerateContent(source: GeminiModelListItem): boolean {
  if (!Array.isArray(source.supportedGenerationMethods)) return true;
  return source.supportedGenerationMethods.some((method) => method === "generateContent");
}

function descriptorFromGeminiModel(
  modelProfile: ModelProfile,
  source: GeminiModelListItem,
): ProviderModelDescriptor | null {
  if (!supportsGenerateContent(source)) return null;
  const id = modelIdFromGeminiModel(source);
  if (!id) return null;
  return {
    id,
    title: typeof source.displayName === "string" && source.displayName.trim()
      ? source.displayName.trim()
      : id,
    contextWindowTokens: typeof source.inputTokenLimit === "number" && source.inputTokenLimit > 0
      ? source.inputTokenLimit
      : modelProfile.contextWindowTokens,
    capabilities: modelProfile.capabilities,
  };
}

function textFromGeminiResponse(body: GeminiGenerateContentResponse): string {
  const text = body.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("");
  return text ?? "";
}

export class GeminiProvider implements ProviderAdapter {
  readonly provider = "google" as const;
  readonly chatCapabilities = {
    nativeToolCalls: false,
    reasoningReplay: false,
    parallelToolCalls: false,
    strictToolSchema: false,
  } as const;
  private readonly fetchImpl: FetchLike;

  constructor(private readonly options: GeminiProviderOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  describeCapabilities(): ProviderDescriptor {
    return {
      provider: this.provider,
      title: "Google Gemini",
      capabilities: GEMINI_CAPABILITIES,
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
    let pageToken: string | null = null;

    for (let page = 0; page < MAX_MODEL_LIST_PAGES; page += 1) {
      const query: Record<string, string | number> = { pageSize: 1000 };
      if (pageToken) query.pageToken = pageToken;
      const response = await this.fetchImpl(
        geminiEndpoint(modelProfile.baseUrl, "/models", query),
        {
          method: "GET",
          headers: this.headers(secret),
        },
      );
      await this.assertOk(response);
      const body = await response.json() as GeminiModelListBody;
      if (!Array.isArray(body.models)) {
        throw new ProviderAdapterError("provider-error", "Gemini did not return a model list.", {
          retryable: false,
          providerStatus: response.status,
        });
      }
      for (const item of body.models) {
        const descriptor = descriptorFromGeminiModel(modelProfile, item);
        if (descriptor && !models.has(descriptor.id)) models.set(descriptor.id, descriptor);
      }
      const nextPageToken = typeof body.nextPageToken === "string" ? body.nextPageToken.trim() : "";
      if (!nextPageToken || nextPageToken === pageToken) break;
      pageToken = nextPageToken;
    }

    if (models.size === 0) {
      throw new ProviderAdapterError("provider-error", "Gemini did not return any generateContent models.", {
        retryable: false,
      });
    }
    return [...models.values()];
  }

  async *streamText(request: ProviderTextRequest): AsyncIterable<string> {
    this.assertProfileProvider(request.modelProfile);
    this.assertContextFits(request);
    const secret = await this.readRequiredSecret(request.modelProfile);
    const init: RequestInit = {
      method: "POST",
      headers: this.headers(secret),
      body: JSON.stringify(geminiGenerateContentBody(
        request.modelProfile,
        request.prompt,
        request.contextBundle,
        request.parameters,
      )),
    };
    if (request.abortSignal) init.signal = request.abortSignal;
    const response = await this.fetchImpl(
      geminiEndpoint(
        request.modelProfile.baseUrl,
        `/${modelResourcePath(request.modelProfile.model)}:streamGenerateContent`,
        { alt: "sse" },
      ),
      init,
    );
    await this.assertOk(response);
    if (!response.body) {
      throw new ProviderAdapterError("provider-error", "Gemini did not return a readable stream.", {
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
    if (request.tools?.length) {
      throw new ProviderAdapterError(
        "model-unavailable",
        "Gemini native tool calls are not implemented by this adapter.",
        { retryable: false },
      );
    }
    let text = "";
    for await (const chunk of this.streamText(request)) text += chunk;
    return {
      text,
      reasoningContent: "",
      toolCalls: [],
      finishReason: "stop",
      usage: null,
      rawResponseText: JSON.stringify({ content: text }),
    };
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
    const init: RequestInit = {
      method: "POST",
      headers: this.headers(secret),
      body: JSON.stringify(geminiGenerateContentBody(
        request.modelProfile,
        { ...request.prompt, user: jsonInstruction },
        request.contextBundle,
        request.parameters,
        { jsonMode: true },
      )),
    };
    if (request.abortSignal) init.signal = request.abortSignal;
    const response = await this.fetchImpl(
      geminiEndpoint(request.modelProfile.baseUrl, `/${modelResourcePath(request.modelProfile.model)}:generateContent`),
      init,
    );
    await this.assertOk(response);
    const body = await response.json() as GeminiGenerateContentResponse;
    if (body.error) {
      throw new ProviderAdapterError(
        errorCodeFromStatus(502, typeof body.error.status === "string" ? body.error.status : undefined),
        sanitizeProviderMessage(body.error.message),
        { providerStatus: 502 },
      );
    }
    const content = textFromGeminiResponse(body).trim();
    if (!content) {
      throw new ProviderAdapterError("structured-output-failed", "Gemini did not return parsable structured content.", {
        providerStatus: response.status,
      });
    }
    try {
      return schema.parse(JSON.parse(content));
    } catch (error) {
      throw new ProviderAdapterError("structured-output-failed", "Gemini structured content did not match the contract.", {
        providerStatus: response.status,
        cause: error,
      });
    }
  }

  async embed(_request: ProviderEmbeddingRequest): Promise<number[]> {
    throw new ProviderAdapterError("model-unavailable", "Gemini embeddings are not enabled in this adapter.", {
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

  private headers(secret: string): Record<string, string> {
    return {
      "content-type": "application/json",
      "x-goog-api-key": secret,
    };
  }

  private async readRequiredSecret(modelProfile: ModelProfile): Promise<string> {
    if (!modelProfile.credentialRef) {
      throw new ProviderAdapterError("provider-auth-failed", "Gemini requires a saved service key.", {
        retryable: false,
      });
    }
    try {
      const secret = await this.options.credentialStore.readSecret(modelProfile.credentialRef);
      if (!secret.trim()) {
        throw new ProviderAdapterError("provider-auth-failed", "Credential store returned an empty key.", {
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
            ? "Credential store does not contain this key."
            : "Current environment cannot read the system credential store.",
          { retryable: false, cause: error },
        );
      }
      throw error;
    }
  }

  private async assertOk(response: Response): Promise<void> {
    if (response.ok) return;
    let message = response.statusText || "Gemini request failed.";
    let googleStatus: string | undefined;
    try {
      const body = await response.json() as GeminiErrorBody;
      message = sanitizeProviderMessage(body.error?.message ?? body.message ?? message);
      googleStatus = typeof body.error?.status === "string" ? body.error.status : undefined;
    } catch {
      // Keep the sanitized status text.
    }
    throw new ProviderAdapterError(errorCodeFromStatus(response.status, googleStatus), message, {
      retryable: retryableFromStatus(response.status),
      providerStatus: response.status,
    });
  }

  private deltaFromSse(raw: string): string {
    const data = raw
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trim())
      .join("\n")
      .trim();
    if (!data || data === "[DONE]") return "";

    let event: GeminiGenerateContentResponse;
    try {
      event = JSON.parse(data) as GeminiGenerateContentResponse;
    } catch (error) {
      throw new ProviderAdapterError("provider-error", "Gemini returned an unparsable stream event.", {
        retryable: false,
        cause: error,
      });
    }

    if (event.error) {
      throw new ProviderAdapterError(
        errorCodeFromStatus(502, typeof event.error.status === "string" ? event.error.status : undefined),
        sanitizeProviderMessage(event.error.message),
        { providerStatus: 502 },
      );
    }
    return textFromGeminiResponse(event);
  }

  private assertContextFits(request: ProviderTextRequest): void {
    const estimated = this.estimateTokens(contextText(request)).totalTokens;
    if (estimated > request.modelProfile.contextWindowTokens) {
      throw new ProviderAdapterError("context-too-large", "Context exceeds this model profile window.", {
        retryable: false,
      });
    }
  }

  private assertProfileProvider(modelProfile: ModelProfile): void {
    if (modelProfile.provider !== this.provider) {
      throw new ProviderAdapterError("provider-error", "ModelProfile does not match this provider.", {
        retryable: false,
      });
    }
  }
}

export function geminiDefaults() {
  return {
    provider: "google" as const,
    baseUrl: GEMINI_DEFAULT_BASE_URL,
    model: "enter-model-id",
    capabilities: GEMINI_CAPABILITIES,
    contextWindowTokens: GEMINI_DEFAULT_CONTEXT_WINDOW_TOKENS,
  };
}
