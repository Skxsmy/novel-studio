import { randomUUID } from "node:crypto";
import {
  MockProvider,
  type ProviderChatRequest,
  type ProviderChatResult,
  type ProviderChatStreamEvent,
} from "@novel-studio/ai";

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

export class ScriptedWorkshopProvider extends MockProvider {
  readonly requests: ProviderChatRequest[] = [];
  private stepIndex = 0;

  constructor(private readonly steps: ScriptedWorkshopProviderStep[]) {
    super();
  }

  remainingSteps(): number {
    return this.steps.length - this.stepIndex;
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
