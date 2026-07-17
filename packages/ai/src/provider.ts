import type { z } from "zod";
import type {
  AiProvider,
  ContextBundle,
  ModelCapability,
  ModelParameters,
  ModelProfile,
  ProviderModelDescriptor,
  ReasoningOutputKind,
  TokenUsage,
} from "@novel-studio/contracts";
import type { ModelCallError } from "@novel-studio/contracts";
export type { ProviderModelDescriptor } from "@novel-studio/contracts";

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

export interface ProviderChatCapabilities {
  nativeToolCalls: boolean;
  reasoningReplay: boolean;
  parallelToolCalls: boolean;
  strictToolSchema: boolean;
}

export interface ProviderToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict?: boolean;
}

export interface ProviderToolCall {
  id: string;
  name: string;
  arguments: string;
}

export type ProviderChatMessage =
  | {
    role: "user";
    content: string;
  }
  | {
    role: "assistant";
    content: string;
    reasoningContent?: string;
    toolCalls?: ProviderToolCall[];
  }
  | {
    role: "tool";
    content: string;
    toolCallId: string;
  };

export interface ProviderChatRequest extends ProviderTextRequest {
  history?: ProviderChatMessage[];
  tools?: ProviderToolDefinition[];
  toolChoice?: "none" | "auto" | "required";
}

export interface ProviderChatResult {
  text: string;
  reasoningContent: string;
  reasoningOutputKind: ReasoningOutputKind;
  toolCalls: ProviderToolCall[];
  finishReason: string | null;
  usage: TokenUsage | null;
  rawResponseText: string;
}

export type ProviderTextStreamEvent =
  | {
    type: "reasoning-delta";
    text: string;
    outputKind: Exclude<ReasoningOutputKind, "none">;
  }
  | {
    type: "answer-delta";
    text: string;
  };

export type ProviderChatStreamEvent =
  | ProviderTextStreamEvent
  | {
    type: "done";
    result: ProviderChatResult;
  };

export interface ProviderTextRequest {
  modelProfile: ModelProfile;
  prompt: ProviderPrompt;
  contextBundle: ContextBundle | null;
  parameters?: ModelParameters;
  resolvedParameters?: ModelParameters;
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
  readonly chatCapabilities: ProviderChatCapabilities;

  describeCapabilities(): ProviderDescriptor;

  testConnection(modelProfile: ModelProfile): Promise<ProviderConnectionResult>;

  listModels(modelProfile: ModelProfile): Promise<ProviderModelDescriptor[]>;

  resolveParameters(
    modelProfile: ModelProfile,
    requestParameters?: ModelParameters,
  ): Promise<ModelParameters>;

  streamText(request: ProviderTextRequest): AsyncIterable<ProviderTextStreamEvent>;

  streamChat(request: ProviderChatRequest): AsyncIterable<ProviderChatStreamEvent>;

  completeChat(request: ProviderChatRequest): Promise<ProviderChatResult>;

  generateObject<T>(
    request: ProviderObjectRequest,
    schema: z.ZodType<T>,
  ): Promise<T>;

  embed(request: ProviderEmbeddingRequest): Promise<number[]>;

  estimateTokens(input: string | ContextBundle | ProviderPrompt): TokenUsage;

  classifyError(error: unknown): ModelCallError;
}
