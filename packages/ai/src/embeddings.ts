import { createHash } from "node:crypto";
import {
  EmbeddingModelProfileSchema,
  type CreateEmbeddingModelProfileInput,
  type EmbeddingModelProfile,
  type EmbeddingUseCaseId,
} from "@novel-studio/contracts";
import type { CredentialStore } from "./credentials.js";
import { CredentialStoreError } from "./credentials.js";
import { ProviderAdapterError } from "./errors.js";

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type EmbeddingCredentialResolver = (credentialRef: string) => Promise<string | null>;

export interface EmbeddingTextInput {
  id?: string;
  text: string;
}

export interface EmbeddingRequest {
  inputs: Array<string | EmbeddingTextInput>;
  profileId?: string;
  useCase?: EmbeddingUseCaseId;
  abortSignal?: AbortSignal;
}

export interface EmbeddingVectorResult {
  inputId: string | null;
  textHash: string;
  vector: number[];
}

export interface EmbeddingResult {
  profileId: string;
  provider: EmbeddingModelProfile["provider"];
  model: string;
  dimensions: number;
  normalized: boolean;
  batchCount: number;
  vectors: EmbeddingVectorResult[];
}

export interface EmbeddingBatchAdapterRequest {
  inputs: EmbeddingTextInput[];
  abortSignal?: AbortSignal;
}

export interface EmbeddingBatchAdapterResult {
  vectors: number[][];
}

export interface EmbeddingAdapter {
  readonly profile: EmbeddingModelProfile;
  embedBatch(request: EmbeddingBatchAdapterRequest): Promise<EmbeddingBatchAdapterResult>;
}

export interface EmbeddingAdapterOptions {
  credentialResolver?: EmbeddingCredentialResolver;
  credentialStore?: CredentialStore;
  fetchImpl?: FetchLike;
}

interface RegisteredEmbeddingProfile {
  adapter: EmbeddingAdapter;
  limiter: AsyncLimiter;
  profile: EmbeddingModelProfile;
}

const DEFAULT_BGE_SMALL_ZH_V15_BASE_URL = "http://127.0.0.1:8080";

export function bgeSmallZhV15EmbeddingDefaults(): CreateEmbeddingModelProfileInput {
  return {
    title: "BGE Small zh v1.5 local",
    provider: "local-http",
    baseUrl: DEFAULT_BGE_SMALL_ZH_V15_BASE_URL,
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
}

export function embeddingCredentialResolverFromStore(store: CredentialStore): EmbeddingCredentialResolver {
  return async (credentialRef: string) => {
    try {
      const secret = await store.readSecret(credentialRef);
      return secret.trim() ? secret : null;
    } catch (error) {
      if (error instanceof CredentialStoreError) {
        throw new ProviderAdapterError(
          error.code === "credential-not-found" ? "provider-auth-failed" : "permission-denied",
          error.code === "credential-not-found"
            ? "系统凭据中没有找到该 Embedding 密钥。"
            : "当前环境无法读取系统凭据；不会回退到明文文件。",
          { retryable: false, cause: error },
        );
      }
      throw error;
    }
  };
}

export function createEmbeddingAdapter(
  rawProfile: EmbeddingModelProfile,
  options: EmbeddingAdapterOptions = {},
): EmbeddingAdapter {
  const profile = EmbeddingModelProfileSchema.parse(rawProfile);
  if (profile.provider === "mock") {
    return new MockEmbeddingAdapter(profile);
  }
  if (
    profile.provider === "local-http" ||
    profile.provider === "custom-http" ||
    profile.provider === "openai-compatible"
  ) {
    return new LocalHttpEmbeddingAdapter(profile, options);
  }
  throw new ProviderAdapterError("provider-error", `Unsupported Embedding provider: ${profile.provider}`, {
    retryable: false,
  });
}

export class EmbeddingRouter {
  private readonly profiles = new Map<string, RegisteredEmbeddingProfile>();
  private readonly useCaseBindings = new Map<EmbeddingUseCaseId, string>();
  private defaultProfileId: string | null = null;

  constructor(private readonly options: EmbeddingAdapterOptions = {}) {}

  registerProfile(rawProfile: EmbeddingModelProfile, adapter?: EmbeddingAdapter): void {
    const profile = EmbeddingModelProfileSchema.parse(rawProfile);
    const resolvedAdapter = adapter ?? createEmbeddingAdapter(profile, this.options);
    if (resolvedAdapter.profile.id !== profile.id) {
      throw new ProviderAdapterError("provider-error", "Embedding adapter profile does not match registration.", {
        retryable: false,
      });
    }
    this.profiles.set(profile.id, {
      adapter: resolvedAdapter,
      limiter: new AsyncLimiter(profile.maxConcurrentBatches),
      profile,
    });
    if (!this.defaultProfileId) {
      this.defaultProfileId = profile.id;
    }
  }

  bindUseCase(useCase: EmbeddingUseCaseId, profileId: string): void {
    if (!this.profiles.has(profileId)) {
      throw new ProviderAdapterError("provider-error", `Embedding profile is not registered: ${profileId}`, {
        retryable: false,
      });
    }
    this.useCaseBindings.set(useCase, profileId);
  }

  unbindUseCase(useCase: EmbeddingUseCaseId): void {
    this.useCaseBindings.delete(useCase);
  }

  resolveProfile(profileId?: string, useCase?: EmbeddingUseCaseId): EmbeddingModelProfile {
    return this.resolveRegistration(profileId, useCase).profile;
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    const registered = this.resolveRegistration(request.profileId, request.useCase);
    const inputs = normalizeInputs(request.inputs);
    validateInputs(inputs, registered.profile);
    assertNotAborted(request.abortSignal);

    const batches = chunk(inputs, registered.profile.maxBatchSize);
    const batchResults = await Promise.all(
      batches.map((batch) =>
        registered.limiter.run(async () => {
          assertNotAborted(request.abortSignal);
          const adapterRequest: EmbeddingBatchAdapterRequest = { inputs: batch };
          if (request.abortSignal) adapterRequest.abortSignal = request.abortSignal;
          const result = await registered.adapter.embedBatch(adapterRequest);
          if (result.vectors.length !== batch.length) {
            throw new ProviderAdapterError(
              "provider-error",
              "Embedding provider returned a different vector count than requested.",
              { retryable: false },
            );
          }
          return result.vectors.map((vector, index) =>
            finalizeVector(vector, batch[index]!, registered.profile)
          );
        })
      ),
    );

    return {
      profileId: registered.profile.id,
      provider: registered.profile.provider,
      model: registered.profile.model,
      dimensions: registered.profile.dimensions,
      normalized: registered.profile.normalize,
      batchCount: batches.length,
      vectors: batchResults.flat(),
    };
  }

  private resolveRegistration(profileId?: string, useCase?: EmbeddingUseCaseId): RegisteredEmbeddingProfile {
    const resolvedProfileId =
      profileId ??
      (useCase ? this.useCaseBindings.get(useCase) : undefined) ??
      this.defaultProfileId;
    if (!resolvedProfileId) {
      throw new ProviderAdapterError("provider-error", "No Embedding profile is registered.", {
        retryable: false,
      });
    }
    const registered = this.profiles.get(resolvedProfileId);
    if (!registered) {
      throw new ProviderAdapterError("provider-error", `Embedding profile is not registered: ${resolvedProfileId}`, {
        retryable: false,
      });
    }
    return registered;
  }
}

export class LocalHttpEmbeddingAdapter implements EmbeddingAdapter {
  readonly profile: EmbeddingModelProfile;
  private readonly credentialResolver: EmbeddingCredentialResolver | null;
  private readonly fetchImpl: FetchLike;

  constructor(rawProfile: EmbeddingModelProfile, options: EmbeddingAdapterOptions = {}) {
    this.profile = EmbeddingModelProfileSchema.parse(rawProfile);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.credentialResolver = options.credentialResolver
      ?? (options.credentialStore ? embeddingCredentialResolverFromStore(options.credentialStore) : null);
  }

  async embedBatch(request: EmbeddingBatchAdapterRequest): Promise<EmbeddingBatchAdapterResult> {
    assertNotAborted(request.abortSignal);
    const endpoint = embeddingEndpoint(this.profile);
    const secret = await this.readOptionalSecret();
    const init: RequestInit = {
      method: "POST",
      headers: embeddingHeaders(secret),
      body: JSON.stringify(embeddingRequestBody(this.profile, request.inputs.map((item) => item.text))),
    };
    if (request.abortSignal) init.signal = request.abortSignal;
    const response = await this.fetchImpl(endpoint, init);
    await assertOk(response);
    const body = await response.json() as unknown;
    const vectors = parseEmbeddingVectors(body);
    return { vectors };
  }

  private async readOptionalSecret(): Promise<string | null> {
    if (!this.profile.credentialRef) return null;
    if (!this.credentialResolver) {
      throw new ProviderAdapterError(
        "permission-denied",
        "Embedding profile has a credential reference, but no credential resolver is configured.",
        { retryable: false },
      );
    }
    const secret = await this.credentialResolver(this.profile.credentialRef);
    if (!secret?.trim()) {
      throw new ProviderAdapterError("provider-auth-failed", "系统凭据为空。", {
        retryable: false,
      });
    }
    return secret;
  }
}

export class MockEmbeddingAdapter implements EmbeddingAdapter {
  readonly profile: EmbeddingModelProfile;

  constructor(rawProfile: EmbeddingModelProfile) {
    this.profile = EmbeddingModelProfileSchema.parse(rawProfile);
  }

  async embedBatch(request: EmbeddingBatchAdapterRequest): Promise<EmbeddingBatchAdapterResult> {
    assertNotAborted(request.abortSignal);
    return {
      vectors: request.inputs.map((input) => deterministicVector(
        `${this.profile.model}\n${input.text}`,
        this.profile.dimensions,
      )),
    };
  }
}

class AsyncLimiter {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.waiters.push(() => {
        this.active += 1;
        resolve();
      });
    });
  }

  private release(): void {
    this.active -= 1;
    const next = this.waiters.shift();
    if (next) next();
  }
}

function normalizeInputs(inputs: Array<string | EmbeddingTextInput>): EmbeddingTextInput[] {
  return inputs.map((input) => {
    if (typeof input === "string") {
      return { text: input };
    }
    return input.id ? { id: input.id, text: input.text } : { text: input.text };
  });
}

function validateInputs(inputs: EmbeddingTextInput[], profile: EmbeddingModelProfile): void {
  if (inputs.length === 0) {
    throw new ProviderAdapterError("provider-error", "Embedding request must include at least one input.", {
      retryable: false,
    });
  }
  for (const input of inputs) {
    if (!input.text.trim()) {
      throw new ProviderAdapterError("provider-error", "Embedding input text cannot be empty.", {
        retryable: false,
      });
    }
    if (countTokensApprox(input.text) > profile.maxInputTokens) {
      throw new ProviderAdapterError("context-too-large", "Embedding input exceeds this profile's maxInputTokens.", {
        retryable: false,
      });
    }
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function finalizeVector(
  rawVector: number[],
  input: EmbeddingTextInput,
  profile: EmbeddingModelProfile,
): EmbeddingVectorResult {
  if (rawVector.length !== profile.dimensions) {
    throw new ProviderAdapterError(
      "provider-error",
      `Embedding vector dimension mismatch: expected ${profile.dimensions}, got ${rawVector.length}.`,
      { retryable: false },
    );
  }
  const vector = profile.normalize ? normalizeEmbeddingVector(rawVector) : rawVector;
  return {
    inputId: input.id ?? null,
    textHash: hashText(input.text),
    vector,
  };
}

export function normalizeEmbeddingVector(vector: number[]): number[] {
  const norm = Math.hypot(...vector);
  if (!Number.isFinite(norm) || norm === 0) {
    return vector.map(() => 0);
  }
  return vector.map((value) => value / norm);
}

function deterministicVector(text: string, dimensions: number): number[] {
  const seed = createHash("sha256").update(text, "utf8").digest();
  const vector: number[] = [];
  for (let index = 0; index < dimensions; index += 1) {
    const byte = seed[index % seed.length]!;
    vector.push((byte / 127.5) - 1);
  }
  return vector;
}

function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function countTokensApprox(value: string): number {
  return Math.ceil(Array.from(value).length / 2);
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new ProviderAdapterError("provider-error", "Embedding request was cancelled.", {
      retryable: false,
    });
  }
}

function embeddingEndpoint(profile: EmbeddingModelProfile): string {
  if (!profile.baseUrl) {
    throw new ProviderAdapterError("provider-error", "请先填写 Embedding 服务地址。", {
      retryable: false,
    });
  }
  const base = new URL(profile.baseUrl);
  const normalized = base.href.endsWith("/") ? base.href : `${base.href}/`;
  return new URL(profile.endpointPath.replace(/^\//u, ""), normalized).toString();
}

function embeddingHeaders(secret: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (secret) {
    headers.authorization = `Bearer ${secret}`;
  }
  return headers;
}

function embeddingRequestBody(profile: EmbeddingModelProfile, texts: string[]): Record<string, unknown> {
  const body: Record<string, unknown> = profile.provider === "openai-compatible"
    ? { model: profile.model, input: texts }
    : { model: profile.model, inputs: texts };
  if (profile.supportsCustomDimensions) {
    body.dimensions = profile.dimensions;
  }
  return body;
}

async function assertOk(response: Response): Promise<void> {
  if (response.ok) return;
  let message = response.statusText || "Embedding provider request failed.";
  try {
    const body = await response.json() as { error?: { message?: unknown }; message?: unknown };
    const raw = body.error?.message ?? body.message;
    if (typeof raw === "string" && raw.trim()) {
      message = raw.trim();
    }
  } catch {
    // Keep status text.
  }
  throw new ProviderAdapterError(errorCodeFromStatus(response.status), sanitizeProviderMessage(message), {
    retryable: retryableFromStatus(response.status),
    providerStatus: response.status,
  });
}

function errorCodeFromStatus(status: number) {
  if (status === 401 || status === 403) return "provider-auth-failed" as const;
  if (status === 402) return "provider-billing-required" as const;
  if (status === 404) return "model-unavailable" as const;
  if (status === 408 || status === 500 || status === 502 || status === 503 || status === 504) {
    return "provider-unavailable" as const;
  }
  if (status === 429) return "provider-rate-limited" as const;
  return "provider-error" as const;
}

function retryableFromStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504;
}

function sanitizeProviderMessage(value: string): string {
  return value
    .replace(/sk-[A-Za-z0-9_-]{8,}/gu, "sk-***")
    .replace(/bearer\s+[A-Za-z0-9._-]+/giu, "Bearer ***");
}

function parseEmbeddingVectors(body: unknown): number[][] {
  if (Array.isArray(body)) {
    return parseVectorArray(body);
  }
  if (!body || typeof body !== "object") {
    throw invalidEmbeddingResponse();
  }
  const object = body as Record<string, unknown>;
  const directEmbedding = parseVector(object.embedding);
  if (directEmbedding) return [directEmbedding];
  if (Array.isArray(object.embeddings)) {
    return parseVectorArray(object.embeddings);
  }
  if (Array.isArray(object.data)) {
    const vectors = object.data
      .map((item) => item && typeof item === "object" ? parseVector((item as Record<string, unknown>).embedding) : null)
      .filter((item): item is number[] => item !== null);
    if (vectors.length === object.data.length && vectors.length > 0) {
      return vectors;
    }
  }
  if (Array.isArray(object.results)) {
    const vectors = object.results
      .map((item) => item && typeof item === "object" ? parseVector((item as Record<string, unknown>).embedding) : null)
      .filter((item): item is number[] => item !== null);
    if (vectors.length === object.results.length && vectors.length > 0) {
      return vectors;
    }
  }
  throw invalidEmbeddingResponse();
}

function parseVectorArray(value: unknown[]): number[][] {
  const vectors = value.map((item) => parseVector(item));
  if (vectors.some((item) => item === null)) {
    throw invalidEmbeddingResponse();
  }
  return vectors as number[][];
}

function parseVector(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const vector = value.map((item) => typeof item === "number" && Number.isFinite(item) ? item : null);
  if (vector.some((item) => item === null)) return null;
  return vector as number[];
}

function invalidEmbeddingResponse(): ProviderAdapterError {
  return new ProviderAdapterError("provider-error", "Embedding provider returned an invalid vector response.", {
    retryable: false,
  });
}
