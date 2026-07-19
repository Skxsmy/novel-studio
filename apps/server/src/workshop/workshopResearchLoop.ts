import type {
  EmbeddingRouter,
  ProviderAdapter,
  ProviderChatMessage,
  ProviderChatResult,
  ProviderChatStreamEvent,
  ProviderPrompt,
} from "@novel-studio/ai";
import type {
  ContextBundle,
  ModelParameters,
  ModelProfile,
  ResearchToolAuditCitation,
  TokenUsage,
} from "@novel-studio/contracts";
import type { ProjectRepository } from "@novel-studio/storage";
import { modelError } from "../ai/policy.js";
import { createResearchToolGateway } from "../researchToolGateway.js";
import {
  guardWorkshopToolCalls,
  guardWorkshopToolResult,
  workshopToolDefinitionsForStep,
} from "./workshopToolPolicy.js";

export const WORKSHOP_RESEARCH_MAX_PROVIDER_STEPS = 10;

type ResearchActivityPhase = "listing" | "searching" | "reading";

export interface WorkshopResearchLoopResult {
  providerResult: ProviderChatResult;
  citations: ResearchToolAuditCitation[];
  providerSteps: number;
  researchToolCalls: number;
}

interface WorkshopResearchLoopInput {
  adapter: ProviderAdapter;
  repository: ProjectRepository;
  embeddingRouter: EmbeddingRouter;
  seriesId: string;
  modelCallId: string;
  activeDatabaseIds: string[];
  modelProfile: ModelProfile;
  prompt: ProviderPrompt;
  contextBundle: ContextBundle;
  resolvedParameters: ModelParameters;
  mode: "general-chat" | "agent";
  history?: ProviderChatMessage[];
  abortSignal?: AbortSignal;
  onStreamEvent?: (
    event: Exclude<ProviderChatStreamEvent, { type: "done" }>,
  ) => void | Promise<void>;
  onResearchActivity?: (activity: {
    phase: ResearchActivityPhase;
    status: "started" | "completed" | "failed";
    step: number;
  }) => void | Promise<void>;
}

function phaseForTool(name: string): ResearchActivityPhase {
  if (name === "research.list_sources") return "listing";
  if (name === "research.open_passage") return "reading";
  return "searching";
}

function addUsage(left: TokenUsage | null, right: TokenUsage | null): TokenUsage | null {
  if (!left) return right;
  if (!right) return left;
  return {
    inputTokens: left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    totalTokens: left.totalTokens + right.totalTokens,
  };
}

function mergeProviderResults(results: ProviderChatResult[], final: ProviderChatResult): ProviderChatResult {
  return {
    ...final,
    usage: results.reduce<TokenUsage | null>((total, result) => addUsage(total, result.usage), null),
    rawResponseText: JSON.stringify(results.map((result) => result.rawResponseText)),
  };
}

function citationKey(citation: ResearchToolAuditCitation): string {
  return [
    citation.researchDatabaseId,
    citation.sourceId,
    citation.sourceRevision,
    citation.chunkId,
    citation.chunkHash,
    citation.relationship,
  ].join(":");
}

function syntheticToolError(code: string, message: string): string {
  return JSON.stringify({
    schemaVersion: 1,
    ok: false,
    error: { code, message, retryable: true },
  });
}

async function collectCitations(
  repository: ProjectRepository,
  seriesId: string,
  modelCallId: string,
): Promise<ResearchToolAuditCitation[]> {
  const events = await repository.listResearchToolAuditEvents(seriesId, modelCallId);
  const citations = new Map<string, ResearchToolAuditCitation>();
  for (const event of events) {
    for (const citation of event.citations) citations.set(citationKey(citation), citation);
  }
  return [...citations.values()].slice(0, 24);
}

export async function runWorkshopResearchLoop(
  input: WorkshopResearchLoopInput,
): Promise<WorkshopResearchLoopResult> {
  const activeDatabaseIds = input.activeDatabaseIds ?? [];
  const history = [...(input.history ?? [])];
  const activeDatabases = await Promise.all(activeDatabaseIds.map(async (databaseId) => {
    const document = await input.repository.getResearchDatabase(databaseId);
    return { id: document.database.id, name: document.database.name };
  }));
  const researchAvailable = activeDatabaseIds.length > 0 && input.adapter.chatCapabilities.nativeToolCalls;
  const gateway = researchAvailable
    ? await createResearchToolGateway({
      repository: input.repository,
      embeddingRouter: input.embeddingRouter,
      seriesId: input.seriesId,
      modelCallId: input.modelCallId,
      activeDatabaseIds,
      ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
    })
    : null;
  let allowResearchTools = researchAvailable;
  let repairUsed = false;
  let researchToolCalls = 0;
  const providerResults: ProviderChatResult[] = [];

  for (let step = 1; step <= WORKSHOP_RESEARCH_MAX_PROVIDER_STEPS; step += 1) {
    if (input.abortSignal?.aborted) {
      const abortError = new Error("Workshop Research call cancelled by the author");
      abortError.name = "AbortError";
      throw abortError;
    }
    const bufferedEvents: Array<Exclude<ProviderChatStreamEvent, { type: "done" }>> = [];
    let result: ProviderChatResult | null = null;
    const tools = workshopToolDefinitionsForStep({
      mode: input.mode,
      nativeToolCalls: input.adapter.chatCapabilities.nativeToolCalls,
      activeDatabases,
      allowResearchTools,
    });
    for await (const event of input.adapter.streamChat({
      modelProfile: input.modelProfile,
      prompt: input.prompt,
      contextBundle: input.contextBundle,
      resolvedParameters: input.resolvedParameters,
      ...(history.length > 0 ? { history } : {}),
      ...(tools.length > 0 ? { tools, toolChoice: "auto" as const } : {}),
      ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
    })) {
      if (event.type === "done") {
        if (result) throw modelError("provider-error", "The Provider returned more than one terminal result.");
        result = event.result;
      } else {
        bufferedEvents.push(event);
      }
    }
    if (!result) throw modelError("provider-error", "The Provider stream ended without a terminal result.", true);
    providerResults.push(result);

    const guard = guardWorkshopToolCalls({
      mode: input.mode,
      calls: result.toolCalls,
      availableToolNames: new Set(tools.map((tool) => tool.name)),
      unavailableToolReasons: new Map([
        ...(!allowResearchTools && gateway ? [
          ["research.list_sources", {
            code: "BUDGET_EXHAUSTED",
            message: "The Research budget for this author turn is exhausted. Answer from evidence already returned or explain that no matching evidence was found.",
          }],
          ["research.search", {
            code: "BUDGET_EXHAUSTED",
            message: "The Research budget for this author turn is exhausted. Answer from evidence already returned or explain that no matching evidence was found.",
          }],
          ["research.open_passage", {
            code: "BUDGET_EXHAUSTED",
            message: "The Research budget for this author turn is exhausted. Answer from evidence already returned or explain that no matching evidence was found.",
          }],
        ] as const : []),
      ]),
    });
    if (guard.action === "reject") {
      if (repairUsed) {
        throw modelError(
          "structured-output-failed",
          `The Provider repeatedly violated the Workshop tool policy: ${guard.message}`,
          true,
        );
      }
      repairUsed = true;
      history.push({
        role: "assistant",
        content: result.text,
        reasoningContent: result.reasoningContent,
        toolCalls: guard.calls,
      });
      history.push(...guard.calls.map((call) => ({
        role: "tool" as const,
        toolCallId: call.id,
        content: syntheticToolError(guard.code, guard.message),
      })));
      continue;
    }

    if (guard.action === "none") {
      for (const event of bufferedEvents) await input.onStreamEvent?.(event);
      return {
        providerResult: mergeProviderResults(providerResults, result),
        citations: gateway
          ? await collectCitations(input.repository, input.seriesId, input.modelCallId)
          : [],
        providerSteps: step,
        researchToolCalls,
      };
    }

    if (guard.action === "request-confirmation") {
      for (const event of bufferedEvents) await input.onStreamEvent?.(event);
      return {
        providerResult: mergeProviderResults(providerResults, result),
        citations: gateway
          ? await collectCitations(input.repository, input.seriesId, input.modelCallId)
          : [],
        providerSteps: step,
        researchToolCalls,
      };
    }

    const toolCall = guard.call;
    if (!gateway) {
      if (repairUsed) {
        throw modelError("structured-output-failed", "The selected model cannot execute Research tools.", true);
      }
      repairUsed = true;
      history.push({
        role: "assistant",
        content: result.text,
        reasoningContent: result.reasoningContent,
        toolCalls: [toolCall],
      }, {
        role: "tool",
        toolCallId: toolCall.id,
        content: syntheticToolError("RESEARCH_UNAVAILABLE", "Research tools are unavailable for this call."),
      });
      continue;
    }

    const phase = phaseForTool(toolCall.name);
    await input.onResearchActivity?.({ phase, status: "started", step });
    const toolResult = await gateway.execute(toolCall);
    const resultGuard = guardWorkshopToolResult({ call: toolCall, result: toolResult });
    if (!resultGuard.ok) {
      throw modelError("provider-error", resultGuard.message, false);
    }
    researchToolCalls += 1;
    await input.onResearchActivity?.({
      phase,
      status: toolResult.ok ? "completed" : "failed",
      step,
    });
    history.push({
      role: "assistant",
      content: result.text,
      reasoningContent: result.reasoningContent,
      toolCalls: [toolCall],
    }, {
      role: "tool",
      toolCallId: toolCall.id,
      content: JSON.stringify(toolResult),
    });
    if (toolResult.budget.exhaustedReason !== null) allowResearchTools = false;
  }

  throw modelError(
    "provider-error",
    `Workshop Research stopped after ${WORKSHOP_RESEARCH_MAX_PROVIDER_STEPS} Provider steps without a final answer.`,
    true,
  );
}
