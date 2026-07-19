import { randomUUID } from "node:crypto";
import {
  MockProvider,
  type ProviderAdapter,
  type ProviderChatRequest,
  type ProviderChatResult,
  type ProviderChatStreamEvent,
  type ProviderEmbeddingRequest,
  type ProviderObjectRequest,
  type ProviderTextRequest,
} from "@novel-studio/ai";
import type { ModelParameters, ModelProfile } from "@novel-studio/contracts";
import type { z } from "zod";

export interface ScriptedWorkshopProviderStep {
  name: string;
  expect?: (request: ProviderChatRequest, requestIndex: number) => void | Promise<void>;
  result?: ProviderChatResult | ((request: ProviderChatRequest, requestIndex: number) => ProviderChatResult);
  error?: Error | ((request: ProviderChatRequest, requestIndex: number) => Error);
  waitFor?: Promise<void>;
}

export function scriptedToolResult(input: {
  name: string;
  arguments: unknown | ((request: ProviderChatRequest) => unknown);
  text?: string;
}): (request: ProviderChatRequest) => ProviderChatResult {
  return (request) => ({
    text: input.text ?? "",
    reasoningContent: "",
    reasoningOutputKind: "none",
    toolCalls: [{
      id: randomUUID(),
      name: input.name,
      arguments: JSON.stringify(
        typeof input.arguments === "function" ? input.arguments(request) : input.arguments,
      ),
    }],
    finishReason: "tool_calls",
    usage: { inputTokens: 20, outputTokens: 8, totalTokens: 28 },
    rawResponseText: JSON.stringify({ tool: input.name }),
  });
}

export function scriptedAnswer(text: string): ProviderChatResult {
  return {
    text,
    reasoningContent: "",
    reasoningOutputKind: "none",
    toolCalls: [],
    finishReason: "stop",
    usage: { inputTokens: 24, outputTokens: 12, totalTokens: 36 },
    rawResponseText: JSON.stringify({ answer: text }),
  };
}

export function scriptedParallelToolResult(
  calls: Array<{ name: string; arguments: unknown }>,
): ProviderChatResult {
  return {
    text: "",
    reasoningContent: "",
    reasoningOutputKind: "none",
    toolCalls: calls.map((call) => ({
      id: randomUUID(),
      name: call.name,
      arguments: JSON.stringify(call.arguments),
    })),
    finishReason: "tool_calls",
    usage: { inputTokens: 20, outputTokens: 8, totalTokens: 28 },
    rawResponseText: JSON.stringify({ tools: calls.map((call) => call.name) }),
  };
}

export class ScriptedWorkshopProvider extends MockProvider {
  readonly requests: ProviderChatRequest[] = [];
  private stepIndex = 0;

  constructor(private readonly steps: ScriptedWorkshopProviderStep[]) {
    super();
  }

  remainingSteps(): number {
    return this.steps.length - this.stepIndex;
  }

  async waitForRequests(count: number, timeoutMs = 2_000): Promise<void> {
    const startedAt = Date.now();
    while (this.requests.length < count) {
      if (Date.now() - startedAt >= timeoutMs) {
        throw new Error(`Timed out waiting for ${count} Provider request(s); received ${this.requests.length}.`);
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  assertExhausted(): void {
    if (this.remainingSteps() !== 0) {
      throw new Error(`Scripted Provider has ${this.remainingSteps()} unconsumed step(s).`);
    }
  }

  override async *streamChat(request: ProviderChatRequest): AsyncIterable<ProviderChatStreamEvent> {
    const requestIndex = this.stepIndex;
    const step = this.steps[this.stepIndex];
    if (!step) throw new Error(`Unexpected Provider request ${requestIndex + 1}.`);
    this.stepIndex += 1;
    this.requests.push(request);
    await step.expect?.(request, requestIndex);
    if (step.waitFor) {
      await Promise.race([
        step.waitFor,
        new Promise<never>((_resolve, reject) => {
          if (request.abortSignal?.aborted) {
            const error = new Error("Scripted Provider request aborted");
            error.name = "AbortError";
            reject(error);
            return;
          }
          request.abortSignal?.addEventListener("abort", () => {
            const error = new Error("Scripted Provider request aborted");
            error.name = "AbortError";
            reject(error);
          }, { once: true });
        }),
      ]);
    }
    if (step.error) {
      throw typeof step.error === "function" ? step.error(request, requestIndex) : step.error;
    }
    if (!step.result) throw new Error(`Scripted Provider step "${step.name}" has no result.`);
    const result = typeof step.result === "function"
      ? step.result(request, requestIndex)
      : step.result;
    if (result.reasoningContent) {
      yield {
        type: "reasoning-delta",
        text: result.reasoningContent,
        outputKind: result.reasoningOutputKind === "full" ? "full" : "summary",
      };
    }
    if (result.text) yield { type: "answer-delta", text: result.text };
    yield { type: "done", result };
  }
}

export class CapabilityOverrideWorkshopProvider implements ProviderAdapter {
  readonly provider;
  readonly chatCapabilities;

  constructor(
    readonly inner: ScriptedWorkshopProvider,
    nativeToolCalls: boolean,
  ) {
    this.provider = inner.provider;
    this.chatCapabilities = { ...inner.chatCapabilities, nativeToolCalls };
  }

  describeCapabilities() { return this.inner.describeCapabilities(); }
  testConnection(modelProfile: ModelProfile) { return this.inner.testConnection(modelProfile); }
  listModels(modelProfile: ModelProfile) { return this.inner.listModels(modelProfile); }
  resolveParameters(modelProfile: ModelProfile, requestParameters?: ModelParameters) {
    return this.inner.resolveParameters(modelProfile, requestParameters);
  }
  streamText(request: ProviderTextRequest) { return this.inner.streamText(request); }
  streamChat(request: ProviderChatRequest) { return this.inner.streamChat(request); }
  completeChat(request: ProviderChatRequest) { return this.inner.completeChat(request); }
  generateObject<T>(request: ProviderObjectRequest, schema: z.ZodType<T>) {
    return this.inner.generateObject(request, schema);
  }
  embed(request: ProviderEmbeddingRequest) { return this.inner.embed(request); }
  estimateTokens(input: Parameters<ProviderAdapter["estimateTokens"]>[0]) {
    return this.inner.estimateTokens(input);
  }
  classifyError(error: unknown) { return this.inner.classifyError(error); }
}
