import type { z } from "zod";
import type {
  AiProvider,
  ContextBundle,
  ModelCapability,
  ModelParameters,
  ModelProfile,
  TokenUsage,
} from "@novel-studio/contracts";
import type { ModelCallError } from "@novel-studio/contracts";

export interface ProviderModelDescriptor {
  id: string;
  title: string;
  contextWindowTokens: number;
  capabilities: ModelCapability;
}

export interface ProviderDescriptor {
  provider: AiProvider;
  title: string;
  capabilities: ModelCapability;
  models: ProviderModelDescriptor[];
}

export interface ProviderConnectionResult {
  ok: boolean;
  provider: AiProvider;
  modelProfileId: string;
  capabilities: ModelCapability;
  models: ProviderModelDescriptor[];
  error: ModelCallError | null;
}

export interface ProviderPrompt {
  system: string;
  instructions: string;
  user: string;
}

export interface ProviderTextRequest {
  modelProfile: ModelProfile;
  prompt: ProviderPrompt;
  contextBundle: ContextBundle | null;
  parameters?: ModelParameters;
  abortSignal?: AbortSignal;
}

export interface ProviderObjectRequest extends ProviderTextRequest {
  outputSchemaName: string | null;
}

export interface ProviderEmbeddingRequest {
  modelProfile: ModelProfile;
  input: string;
  abortSignal?: AbortSignal;
}

export interface ProviderAdapter {
  readonly provider: AiProvider;

  describeCapabilities(): ProviderDescriptor;

  testConnection(modelProfile: ModelProfile): Promise<ProviderConnectionResult>;

  listModels(modelProfile: ModelProfile): Promise<ProviderModelDescriptor[]>;

  streamText(request: ProviderTextRequest): AsyncIterable<string>;

  generateObject<T>(
    request: ProviderObjectRequest,
    schema: z.ZodType<T>,
  ): Promise<T>;

  embed(request: ProviderEmbeddingRequest): Promise<number[]>;

  estimateTokens(input: string | ContextBundle | ProviderPrompt): TokenUsage;

  classifyError(error: unknown): ModelCallError;
}
