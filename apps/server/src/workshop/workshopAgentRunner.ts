import { createHash, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type {
  EmbeddingRouter,
  ProviderChatMessage,
  ProviderChatResult,
  ProviderChatStreamEvent,
  ProviderPrompt,
  ProviderRegistry,
} from "@novel-studio/ai";
import {
  ModelCallLogSchema,
  NewModelCallLogV2Schema,
  WorkshopAgentRunSchema,
  WorkshopAgentStepRecordSchema,
  WorkshopMessageSchema,
  type ContextBundle,
  type ModelCallError,
  type ModelCallLog,
  type ModelParameters,
  type ModelProfile,
  type ReasoningOutputKind,
  type ResearchToolAuditCitation,
  type TokenUsage,
  type WorkshopAgentRunDocument,
  type WorkshopAgentStepRecord,
  type WorkshopMessage,
  type WorkshopResearchEvidence,
} from "@novel-studio/contracts";
import type { ProjectRepository } from "@novel-studio/storage";
import { ensureCredentialBoundary, modelError } from "../ai/policy.js";
import { requestHash, usage } from "../routes/modelCalls.js";
import {
  parseCodexCreateEntryToolRequest,
  parseCodexUpdateEntryToolRequest,
  serializeCodexCreateEntryToolRequest,
  serializeCodexUpdateEntryToolRequest,
  type WorkshopCodexUpdateDraft,
} from "./codexDraft.js";
import {
  parseWorkshopAgentToolCall,
  workshopAgentToolDefinitions,
  type WorkshopAgentStep,
} from "./workshopAgent.js";
import { runWorkshopResearchLoop } from "./workshopResearchLoop.js";

function hashText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function promptSnapshot(prompt: ProviderPrompt) {
  return {
    ...prompt,
    hash: hashText(JSON.stringify(prompt)),
  };
}

function estimatedUsage(
  providerRegistry: ProviderRegistry,
  modelProfile: ModelProfile,
  contextBundle: ContextBundle,
  prompt: ProviderPrompt,
): TokenUsage {
  const adapter = providerRegistry.get(modelProfile.provider);
  const promptUsage = adapter.estimateTokens(prompt);
  const inputTokens = contextBundle.estimatedUsage.inputTokens + promptUsage.inputTokens;
  return { inputTokens, outputTokens: 0, totalTokens: inputTokens };
}

function baseLog(input: {
  id: string;
  seriesId: string;
  contextBundle: ContextBundle;
  modelProfile: ModelProfile;
  prompt: ProviderPrompt;
  resolvedParameters: ModelParameters;
  estimatedUsage: TokenUsage;
  startedAt: string;
}): ModelCallLog {
  return NewModelCallLogV2Schema.parse({
    schemaVersion: 2,
    id: input.id,
    seriesId: input.seriesId,
    sceneId: input.contextBundle.sceneId,
    roleId: input.contextBundle.roleId,
    taskKind: input.contextBundle.taskKind,
    provider: input.modelProfile.provider,
    model: input.modelProfile.model,
    contextBundleId: input.contextBundle.id,
    promptTemplateId: input.contextBundle.promptTemplateId,
    promptTemplateVersion: input.contextBundle.promptTemplateVersion,
    requestHash: requestHash({
      modelProfile: input.modelProfile,
      contextBundle: input.contextBundle,
      prompt: input.prompt,
      parameters: input.resolvedParameters,
    }),
    resolvedParameters: input.resolvedParameters,
    status: "pending",
    estimatedUsage: input.estimatedUsage,
    startedAt: input.startedAt,
  });
}

function failedLog(
  log: ModelCallLog,
  error: ModelCallError,
  responseText: string,
  reasoningText = "",
): ModelCallLog {
  const producedOutput = `${reasoningText}${responseText}`;
  return ModelCallLogSchema.parse({
    ...log,
    status: "failed",
    responseHash: producedOutput ? hashText(`${reasoningText}\n${responseText}`) : null,
    actualUsage: usage(log.estimatedUsage.inputTokens, producedOutput),
    errorCode: error.code,
    errorMessage: error.message,
    error,
    completedAt: new Date().toISOString(),
  });
}

interface ModelAttemptResult {
  log: ModelCallLog | null;
  rawOutput: string;
  answerText: string;
  reasoningText: string;
  reasoningOutputKind: ReasoningOutputKind;
  step: WorkshopAgentStep | null;
  error: ModelCallError | null;
  providerResult: ProviderChatResult | null;
  cancelled: boolean;
  researchCitations: ResearchToolAuditCitation[];
}

async function executeModelAttempt(input: {
  repository: ProjectRepository;
  providerRegistry: ProviderRegistry;
  embeddingRouter: EmbeddingRouter;
  seriesId: string;
  contextBundle: ContextBundle;
  modelProfile: ModelProfile;
  activeResearchDatabaseIds: string[];
  prompt: ProviderPrompt;
  parameters: ModelParameters;
  modelCallId: string;
  history?: ProviderChatMessage[];
  abortSignal?: AbortSignal;
  attemptNumber: number;
  reset: boolean;
  onAttemptStart?: (input: { modelCallId: string; attempt: number; reset: boolean }) => void | Promise<void>;
  onStreamEvent?: (input: {
    modelCallId: string;
    attempt: number;
    event: Exclude<ProviderChatStreamEvent, { type: "done" }>;
  }) => void | Promise<void>;
  onResearchActivity?: (activity: {
    phase: "listing" | "searching" | "reading";
    status: "started" | "completed" | "failed";
    step: number;
  }) => void | Promise<void>;
}): Promise<ModelAttemptResult> {
  let adapter;
  let rawOutput = "";
  let answerText = "";
  let reasoningText = "";
  let reasoningOutputKind: ReasoningOutputKind = "none";
  if (input.abortSignal?.aborted) {
    return {
      log: null,
      rawOutput,
      answerText,
      reasoningText,
      reasoningOutputKind,
      step: null,
      error: null,
      providerResult: null,
      cancelled: true,
      researchCitations: [],
    };
  }
  try {
    adapter = input.providerRegistry.get(input.modelProfile.provider);
  } catch {
    const error = modelError("provider-unavailable", "The selected Provider is not available.", true);
    return {
      log: null,
      rawOutput: "",
      answerText,
      reasoningText,
      reasoningOutputKind,
      step: null,
      error,
      providerResult: null,
      cancelled: false,
      researchCitations: [],
    };
  }

  let resolvedParameters: ModelParameters;
  try {
    resolvedParameters = await adapter.resolveParameters(input.modelProfile, input.parameters);
  } catch (caught) {
    const cancelled = input.abortSignal?.aborted || (caught instanceof Error && caught.name === "AbortError");
    const error = cancelled ? null : adapter.classifyError(caught);
    return {
      log: null,
      rawOutput,
      answerText,
      reasoningText,
      reasoningOutputKind,
      step: null,
      error,
      providerResult: null,
      cancelled,
      researchCitations: [],
    };
  }

  const estimate = estimatedUsage(
    input.providerRegistry,
    input.modelProfile,
    input.contextBundle,
    input.prompt,
  );
  let log = baseLog({
    ...input,
    id: input.modelCallId,
    resolvedParameters,
    estimatedUsage: estimate,
    startedAt: new Date().toISOString(),
  });
  await input.repository.saveModelCallLog(input.seriesId, log);
  let providerResult: ProviderChatResult | null = null;
  let researchCitations: ResearchToolAuditCitation[] = [];
  try {
    if (input.abortSignal?.aborted) {
      const abortError = new Error("Workshop Agent call cancelled by the author");
      abortError.name = "AbortError";
      throw abortError;
    }
    ensureCredentialBoundary(input.modelProfile);
    if (estimate.inputTokens > input.modelProfile.contextWindowTokens) {
      throw modelError("context-too-large", "The selected context exceeds the model context window.");
    }
    log = ModelCallLogSchema.parse({ ...log, status: "streaming" });
    await input.repository.saveModelCallLog(input.seriesId, log);
    await input.onAttemptStart?.({
      modelCallId: input.modelCallId,
      attempt: input.attemptNumber,
      reset: input.reset,
    });
    if (input.abortSignal?.aborted) {
      const abortError = new Error("Workshop Agent call cancelled by the author");
      abortError.name = "AbortError";
      throw abortError;
    }
    const loop = await runWorkshopResearchLoop({
      adapter,
      repository: input.repository,
      embeddingRouter: input.embeddingRouter,
      seriesId: input.seriesId,
      modelCallId: input.modelCallId,
      activeDatabaseIds: input.activeResearchDatabaseIds,
      modelProfile: input.modelProfile,
      prompt: input.prompt,
      contextBundle: input.contextBundle,
      resolvedParameters,
      ...(input.history ? { history: input.history } : {}),
      baseTools: adapter.chatCapabilities.nativeToolCalls ? workshopAgentToolDefinitions() : [],
      returnUnhandledToolCalls: true,
      ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
      ...(input.onStreamEvent ? {
        onStreamEvent: (event) => input.onStreamEvent?.({
          modelCallId: input.modelCallId,
          attempt: input.attemptNumber,
          event,
        }),
      } : {}),
      ...(input.onResearchActivity ? { onResearchActivity: input.onResearchActivity } : {}),
    });
    providerResult = loop.providerResult;
    researchCitations = loop.citations;
    if (input.abortSignal?.aborted) {
      const abortError = new Error("Workshop Agent call cancelled by the author");
      abortError.name = "AbortError";
      throw abortError;
    }
    rawOutput = providerResult.rawResponseText;
    answerText = providerResult.text;
    reasoningText = providerResult.reasoningContent;
    reasoningOutputKind = providerResult.reasoningOutputKind;
    if (providerResult.toolCalls.length > 1) {
      throw modelError(
        "structured-output-failed",
        "Workshop currently accepts one tool request at a time; return the next single action only.",
        true,
      );
    }
    let step: WorkshopAgentStep;
    if (providerResult.toolCalls.length === 1) {
      try {
        step = parseWorkshopAgentToolCall(providerResult.toolCalls[0]!);
      } catch (error) {
        throw modelError(
          "structured-output-failed",
          `The tool request did not match its contract: ${error instanceof Error ? error.message.slice(0, 2000) : "invalid arguments"}`,
          true,
        );
      }
    } else if (providerResult.text.trim()) {
      step = {
        schemaVersion: 1,
        type: "respond",
        message: providerResult.text.trim(),
      };
    } else {
      throw modelError("provider-error", "The Provider returned no assistant text or tool call.", true);
    }
    log = ModelCallLogSchema.parse({
      ...log,
      status: "succeeded",
      responseHash: hashText(rawOutput),
      actualUsage: providerResult.usage ?? usage(estimate.inputTokens, rawOutput),
      completedAt: new Date().toISOString(),
    });
    await input.repository.saveModelCallLog(input.seriesId, log);
    return {
      log,
      rawOutput,
      answerText,
      reasoningText,
      reasoningOutputKind,
      step,
      error: null,
      providerResult,
      cancelled: false,
      researchCitations,
    };
  } catch (caught) {
    if (!rawOutput && caught && typeof caught === "object" && "rawOutput" in caught) {
      const candidate = (caught as { rawOutput?: unknown }).rawOutput;
      if (typeof candidate === "string") rawOutput = candidate;
    }
    if (input.abortSignal?.aborted || (caught instanceof Error && caught.name === "AbortError")) {
      const cancelled = ModelCallLogSchema.parse({
        ...log,
        status: "cancelled",
        responseHash: answerText || reasoningText ? hashText(`${reasoningText}\n${answerText}`) : null,
        actualUsage: usage(log.estimatedUsage.inputTokens, `${reasoningText}${answerText}`),
        errorCode: null,
        errorMessage: null,
        error: null,
        completedAt: new Date().toISOString(),
      });
      await input.repository.saveModelCallLog(input.seriesId, cancelled);
      return {
        log: cancelled,
        rawOutput,
        answerText,
        reasoningText,
        reasoningOutputKind,
        step: null,
        error: null,
        providerResult: null,
        cancelled: true,
        researchCitations: [],
      };
    }
    const error = typeof caught === "object" && caught !== null && "code" in caught && "retryable" in caught
      ? caught as ModelCallError
      : caught instanceof SyntaxError || (caught instanceof Error && caught.name === "ZodError")
        ? modelError("structured-output-failed", "The model output did not match the Workshop Agent step schema.", true)
        : adapter.classifyError(caught);
    const failed = failedLog(log, error, answerText, reasoningText);
    await input.repository.saveModelCallLog(input.seriesId, failed);
    return {
      log: failed,
      rawOutput,
      answerText,
      reasoningText,
      reasoningOutputKind,
      step: null,
      error,
      providerResult,
      cancelled: false,
      researchCitations: [],
    };
  }
}

function toolCorrectionHistory(
  attempt: ModelAttemptResult,
  validationMessage: string,
): ProviderChatMessage[] | null {
  if (!attempt.providerResult?.toolCalls.length) return null;
  return [
    {
      role: "assistant",
      content: attempt.providerResult.text,
      reasoningContent: attempt.providerResult.reasoningContent,
      toolCalls: attempt.providerResult.toolCalls,
    },
    ...attempt.providerResult.toolCalls.map((call) => ({
      role: "tool" as const,
      toolCallId: call.id,
      content: `Tool request rejected by validation: ${validationMessage}`,
    })),
  ];
}

async function waitForAutomaticRetry(abortSignal?: AbortSignal): Promise<boolean> {
  if (abortSignal?.aborted) return false;
  return new Promise((resolve) => {
    const finish = (ready: boolean) => {
      clearTimeout(timer);
      abortSignal?.removeEventListener("abort", onAbort);
      resolve(ready);
    };
    const onAbort = () => finish(false);
    const timer = setTimeout(() => finish(!abortSignal?.aborted), 100);
    abortSignal?.addEventListener("abort", onAbort, { once: true });
  });
}

function authorFacingAgentError(error: ModelCallError): string {
  if (
    error.code === "structured-output-failed" &&
    /tool request did not match|arguments are not valid json|agent output was invalid|model output did not match/iu.test(
      error.message,
    )
  ) {
    return "模型没有生成有效的待确认草稿。Codex 未被写入，可以直接重试本轮。";
  }
  return error.message;
}

async function automaticTransportRetry(input: WorkshopAgentRunnerInput & {
  run: WorkshopAgentRunDocument;
  stepRecord: WorkshopAgentStepRecord;
  attemptResult: ModelAttemptResult;
  history?: ProviderChatMessage[];
}): Promise<{
  run: WorkshopAgentRunDocument;
  stepRecord: WorkshopAgentStepRecord;
  attemptResult: ModelAttemptResult;
}> {
  const error = input.attemptResult.error;
  if (
    input.abortSignal?.aborted ||
    !error?.retryable ||
    error.code === "structured-output-failed" ||
    !await waitForAutomaticRetry(input.abortSignal)
  ) {
    return {
      run: input.run,
      stepRecord: input.stepRecord,
      attemptResult: input.attemptResult,
    };
  }
  const retryStartedAt = new Date().toISOString();
  const retryCallId = randomUUID();
  const retryStep = WorkshopAgentStepRecordSchema.parse({
    schemaVersion: 2,
    id: randomUUID(),
    index: input.run.run.steps.length,
    kind: "retry",
    status: "running",
    attempt: input.stepRecord.attempt + 1,
    modelCallId: retryCallId,
    promptSnapshot: promptSnapshot(input.prompt),
    historySnapshot: input.history ?? [],
    inputMessageIds: input.stepRecord.inputMessageIds,
    degradedStructuredOutput: false,
    startedAt: retryStartedAt,
  });
  const retryingRun = WorkshopAgentRunSchema.parse({
    ...input.run.run,
    status: "running",
    activeStepId: retryStep.id,
    steps: [
      ...input.run.run.steps.map((step) => step.id === input.stepRecord.id ? {
        ...step,
        status: "failed" as const,
        retryable: false,
        errorCode: error.code,
        errorMessage: error.message,
        completedAt: retryStartedAt,
      } : step),
      retryStep,
    ],
    retryable: false,
    updatedAt: retryStartedAt,
    completedAt: null,
  });
  let run = await input.repository.updateWorkshopAgentRun(
    input.seriesId,
    input.sessionId,
    input.run.run.id,
    input.run.revision,
    retryingRun,
  );
  const attemptResult = await executeModelAttempt({
    repository: input.repository,
    providerRegistry: input.providerRegistry,
    embeddingRouter: input.embeddingRouter,
    seriesId: input.seriesId,
    contextBundle: input.providerContextBundle,
    modelProfile: input.modelProfile,
    activeResearchDatabaseIds: input.activeResearchDatabaseIds,
    prompt: input.prompt,
    parameters: input.parameters,
    modelCallId: retryCallId,
    attemptNumber: retryStep.attempt,
    reset: true,
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
    ...(input.onAttemptStart ? { onAttemptStart: input.onAttemptStart } : {}),
    ...(input.onStreamEvent ? { onStreamEvent: input.onStreamEvent } : {}),
    ...(input.onResearchActivity ? { onResearchActivity: input.onResearchActivity } : {}),
    ...(input.history ? { history: input.history } : {}),
  });
  return { run, stepRecord: retryStep, attemptResult };
}

function providerHistoryForRun(
  run: WorkshopAgentRunDocument,
  messages: WorkshopMessage[],
): ProviderChatMessage[] {
  const messageById = new Map(messages.map((message) => [message.id, message]));
  const toolStepByMessageId = new Map(
    run.run.steps
      .filter((step) => step.kind === "tool-request" && step.messageId)
      .map((step) => [step.messageId!, step]),
  );
  const history: ProviderChatMessage[] = [];

  for (const step of run.run.steps) {
    if (["model", "retry", "repair", "continuation"].includes(step.kind) && step.messageId) {
      const message = messageById.get(step.messageId);
      if (!message || message.role !== "assistant" || message.status !== "succeeded") continue;
      const toolStep = run.run.steps.find((candidate) =>
        candidate.kind === "tool-request" && candidate.inputMessageIds.includes(message.id)
      );
      if (!toolStep?.messageId) {
        history.push({
          role: "assistant",
          content: message.content,
          reasoningContent: message.reasoningContent,
        });
        continue;
      }
      const toolMessageRecord = messageById.get(toolStep.messageId);
      if (!toolMessageRecord) continue;
      const toolEnvelope = JSON.parse(toolMessageRecord.content) as { tool?: unknown };
      const parsed = toolEnvelope.tool === "codex.update_entry"
        ? parseCodexUpdateEntryToolRequest(toolMessageRecord.content)
        : toolEnvelope.tool === "codex.create_entry"
          ? parseCodexCreateEntryToolRequest(toolMessageRecord.content)
          : null;
      if (!parsed) continue;
      history.push({
        role: "assistant",
        content: message.content,
        reasoningContent: message.reasoningContent,
        toolCalls: [{
          id: toolStep.id,
          name: parsed.tool,
          arguments: JSON.stringify({ message: message.content, draft: parsed.draft }),
        }],
      });
      continue;
    }
    if (step.kind === "tool-result" && step.messageId) {
      const resultMessage = messageById.get(step.messageId);
      const toolStep = step.inputMessageIds
        .map((messageId) => toolStepByMessageId.get(messageId))
        .find(Boolean);
      if (!resultMessage || !toolStep) continue;
      history.push({
        role: "tool",
        toolCallId: toolStep.id,
        content: resultMessage.content,
      });
    }
  }
  return history;
}

function isRepeatedSuccessfulToolRequest(
  step: WorkshopAgentStep | null,
  runMessages: WorkshopMessage[],
  resultMessage: WorkshopMessage,
): boolean {
  if (!step || step.type !== "request_tool") return false;
  const previousToolMessage = [...runMessages]
    .filter((message) =>
      message.role === "tool" &&
      message.createdAt.localeCompare(resultMessage.createdAt) < 0 &&
      message.toolExecution?.status === "succeeded"
    )
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .at(-1);
  if (!previousToolMessage) return false;
  try {
    if (step.tool === "codex.create_entry") {
      const previous = parseCodexCreateEntryToolRequest(previousToolMessage.content);
      return isDeepStrictEqual(previous.draft, step.draft);
    }
    const previous = parseCodexUpdateEntryToolRequest(previousToolMessage.content);
    const previousTarget = previous.draft.target;
    const nextTarget = step.draft.target;
    const sameTarget = Boolean(
      previousTarget.entryId && nextTarget.entryId && previousTarget.entryId === nextTarget.entryId,
    ) || Boolean(previousTarget.name && nextTarget.name && previousTarget.name === nextTarget.name);
    return sameTarget && isDeepStrictEqual(previous.draft.patch, step.draft.patch);
  } catch {
    return false;
  }
}

function completedReplayResponse(step: Extract<WorkshopAgentStep, { type: "request_tool" }>): WorkshopAgentStep {
  return {
    schemaVersion: 1,
    type: "respond",
    message: step.tool === "codex.create_entry"
      ? "条目已经创建完成，无需重复确认。"
      : "条目已经更新完成，无需重复确认。",
  };
}

function assistantMessage(input: {
  seriesId: string;
  sessionId: string;
  runId: string;
  stepId: string;
  contextBundleId: string;
  modelCallId: string | null;
  content: string;
  id?: string;
  reasoningContent?: string;
  reasoningOutputKind?: ReasoningOutputKind;
  status?: "succeeded" | "failed" | "cancelled";
  error?: ModelCallError | null;
  createdAt: string;
}): WorkshopMessage {
  return WorkshopMessageSchema.parse({
    schemaVersion: 2,
    id: input.id ?? randomUUID(),
    seriesId: input.seriesId,
    sessionId: input.sessionId,
    role: "assistant",
    mode: "agent",
    status: input.status ?? "succeeded",
    content: input.content,
    reasoningContent: input.reasoningContent ?? "",
    reasoningOutputKind: input.reasoningContent ? input.reasoningOutputKind ?? "unknown" : "none",
    contextBundleId: input.contextBundleId,
    modelCallId: input.modelCallId,
    agentRunId: input.runId,
    agentStepId: input.stepId,
    proposalIds: [],
    attachmentIds: [],
    errorCode: input.status === "cancelled" ? null : input.error?.code ?? null,
    errorMessage: input.status === "cancelled" ? null : input.error?.message ?? null,
    createdAt: input.createdAt,
  });
}

function toolMessage(input: {
  seriesId: string;
  sessionId: string;
  runId: string;
  stepId: string;
  contextBundleId: string;
  modelCallId: string;
  content: string;
  createdAt: string;
}): WorkshopMessage {
  return WorkshopMessageSchema.parse({
    schemaVersion: 2,
    id: randomUUID(),
    seriesId: input.seriesId,
    sessionId: input.sessionId,
    role: "tool",
    mode: "agent",
    status: "succeeded",
    content: input.content,
    reasoningContent: "",
    reasoningOutputKind: "none",
    contextBundleId: input.contextBundleId,
    modelCallId: input.modelCallId,
    agentRunId: input.runId,
    agentStepId: input.stepId,
    proposalIds: [],
    attachmentIds: [],
    errorCode: null,
    errorMessage: null,
    createdAt: input.createdAt,
  });
}

export interface WorkshopAgentRunnerResult {
  run: WorkshopAgentRunDocument;
  assistantMessage: WorkshopMessage;
  toolMessages: WorkshopMessage[];
  modelCall: ModelCallLog | null;
  responseText: string;
  researchEvidence: WorkshopResearchEvidence | null;
}

export interface WorkshopAgentRunnerInput {
  repository: ProjectRepository;
  providerRegistry: ProviderRegistry;
  embeddingRouter: EmbeddingRouter;
  seriesId: string;
  sessionId: string;
  authorMessage: WorkshopMessage;
  contextBundle: ContextBundle;
  providerContextBundle: ContextBundle;
  modelProfile: ModelProfile;
  activeResearchDatabaseIds: string[];
  parameters: ModelParameters;
  prompt: ProviderPrompt;
  assistantMessageId?: string;
  abortSignal?: AbortSignal;
  onAttemptStart?: (input: { modelCallId: string; attempt: number; reset: boolean }) => void | Promise<void>;
  onStreamEvent?: (input: {
    modelCallId: string;
    attempt: number;
    event: Exclude<ProviderChatStreamEvent, { type: "done" }>;
  }) => void | Promise<void>;
  onResearchActivity?: (activity: {
    phase: "listing" | "searching" | "reading";
    status: "started" | "completed" | "failed";
    step: number;
  }) => void | Promise<void>;
  prepareUpdateDraft: (draft: WorkshopCodexUpdateDraft) => Promise<WorkshopCodexUpdateDraft>;
}

async function persistResearchEvidence(input: {
  repository: ProjectRepository;
  seriesId: string;
  sessionId: string;
  attempt: ModelAttemptResult;
  assistantMessage: WorkshopMessage;
}): Promise<WorkshopResearchEvidence | null> {
  if (!input.attempt.log || input.attempt.researchCitations.length === 0) return null;
  return input.repository.createWorkshopResearchEvidence(input.seriesId, input.sessionId, {
    schemaVersion: 1,
    id: randomUUID(),
    seriesId: input.seriesId,
    sessionId: input.sessionId,
    assistantMessageId: input.assistantMessage.id,
    modelCallId: input.attempt.log.id,
    copiedFromEvidenceId: null,
    citations: input.attempt.researchCitations,
    createdAt: new Date().toISOString(),
  });
}

async function finalizeAttempt(input: WorkshopAgentRunnerInput & {
  run: WorkshopAgentRunDocument;
  stepRecord: WorkshopAgentStepRecord;
  attempt: ModelAttemptResult;
}): Promise<WorkshopAgentRunnerResult> {
  if (input.abortSignal?.aborted && !input.attempt.cancelled) {
    const cancelled = input.attempt.log
      ? ModelCallLogSchema.parse({
        ...input.attempt.log,
        status: "cancelled",
        responseHash: input.attempt.answerText || input.attempt.reasoningText
          ? hashText(`${input.attempt.reasoningText}\n${input.attempt.answerText}`)
          : null,
        actualUsage: usage(
          input.attempt.log.estimatedUsage.inputTokens,
          `${input.attempt.reasoningText}${input.attempt.answerText}`,
        ),
        errorCode: null,
        errorMessage: null,
        error: null,
        completedAt: new Date().toISOString(),
      })
      : null;
    if (cancelled) await input.repository.saveModelCallLog(input.seriesId, cancelled);
    return finalizeAttempt({
      ...input,
      attempt: {
        ...input.attempt,
        log: cancelled,
        step: null,
        error: null,
        providerResult: null,
        cancelled: true,
      },
    });
  }
  const now = new Date().toISOString();
  const currentSteps = input.run.run.steps;
  if (input.attempt.cancelled) {
    const message = assistantMessage({
      seriesId: input.seriesId,
      sessionId: input.sessionId,
      runId: input.run.run.id,
      stepId: input.stepRecord.id,
      contextBundleId: input.contextBundle.id,
      modelCallId: input.attempt.log?.id ?? null,
      ...(input.assistantMessageId ? { id: input.assistantMessageId } : {}),
      content: input.attempt.answerText,
      reasoningContent: input.attempt.reasoningText,
      reasoningOutputKind: input.attempt.reasoningOutputKind,
      status: "cancelled",
      createdAt: now,
    });
    const steps = currentSteps.map((step) => step.id === input.stepRecord.id ? {
      ...step,
      modelCallId: input.attempt.log?.id ?? null,
      status: "cancelled" as const,
      messageId: message.id,
      retryable: false,
      errorCode: null,
      errorMessage: null,
      completedAt: now,
    } : step);
    const run = WorkshopAgentRunSchema.parse({
      ...input.run.run,
      status: "cancelled",
      activeStepId: null,
      steps,
      retryable: false,
      updatedAt: now,
      completedAt: now,
    });
    const committed = await input.repository.commitWorkshopAgentRunEffects(
      input.seriesId,
      input.sessionId,
      run.id,
      input.run.revision,
      run,
      [message],
    );
    return {
      run: committed.run,
      assistantMessage: message,
      toolMessages: [],
      modelCall: input.attempt.log,
      responseText: message.content,
      researchEvidence: null,
    };
  }
  if (!input.attempt.step || input.attempt.error) {
    const error = input.attempt.error ?? modelError("structured-output-failed", "The Agent output was invalid.");
    const message = assistantMessage({
      seriesId: input.seriesId,
      sessionId: input.sessionId,
      runId: input.run.run.id,
      stepId: input.stepRecord.id,
      contextBundleId: input.contextBundle.id,
      modelCallId: input.attempt.log?.id ?? null,
      ...(input.assistantMessageId ? { id: input.assistantMessageId } : {}),
      content: authorFacingAgentError(error),
      status: "failed",
      error,
      createdAt: now,
    });
    const steps = currentSteps.map((step) => step.id === input.stepRecord.id ? {
      ...step,
      modelCallId: input.attempt.log?.id ?? null,
      status: "failed" as const,
      messageId: message.id,
      retryable: error.retryable,
      errorCode: error.code,
      errorMessage: error.message,
      completedAt: now,
    } : step);
    const run = WorkshopAgentRunSchema.parse({
      ...input.run.run,
      status: "failed",
      activeStepId: null,
      steps,
      retryable: error.retryable,
      updatedAt: now,
      completedAt: now,
    });
    const committed = await input.repository.commitWorkshopAgentRunEffects(
      input.seriesId,
      input.sessionId,
      run.id,
      input.run.revision,
      run,
      [message],
    );
    return {
      run: committed.run,
      assistantMessage: message,
      toolMessages: [],
      modelCall: input.attempt.log,
      responseText: message.content,
      researchEvidence: null,
    };
  }

  if (!input.attempt.log) {
    throw new Error("A successful Workshop Agent model step is missing its Model Call Log.");
  }
  const step = input.attempt.step;
  const assistant = assistantMessage({
    seriesId: input.seriesId,
    sessionId: input.sessionId,
    runId: input.run.run.id,
    stepId: input.stepRecord.id,
    contextBundleId: input.contextBundle.id,
    modelCallId: input.attempt.log.id,
    content: step.message,
    ...(input.assistantMessageId ? { id: input.assistantMessageId } : {}),
    reasoningContent: input.attempt.providerResult?.reasoningContent ?? "",
    reasoningOutputKind: input.attempt.providerResult?.reasoningOutputKind ?? "none",
    createdAt: now,
  });
  let requestContent: string | null = null;
  if (step.type === "request_tool" && step.tool === "codex.create_entry") {
    requestContent = serializeCodexCreateEntryToolRequest(step.draft);
  } else if (step.type === "request_tool" && step.tool === "codex.update_entry") {
    try {
      requestContent = serializeCodexUpdateEntryToolRequest(await input.prepareUpdateDraft(step.draft));
    } catch (caught) {
      const error = modelError(
        "structured-output-failed",
        caught instanceof Error ? caught.message : "The Codex update target could not be bound safely.",
      );
      return finalizeAttempt({
        ...input,
        attempt: { ...input.attempt, step: null, error },
      });
    }
  }
  if (input.abortSignal?.aborted) {
    return finalizeAttempt({ ...input, attempt: { ...input.attempt, cancelled: false } });
  }
  const completedModelSteps = currentSteps.map((record) => record.id === input.stepRecord.id ? {
    ...record,
    status: "succeeded" as const,
    messageId: assistant.id,
    retryable: false,
    completedAt: now,
  } : record);
  if (!requestContent) {
    const run = WorkshopAgentRunSchema.parse({
      ...input.run.run,
      status: "completed",
      activeStepId: null,
      steps: completedModelSteps,
      retryable: false,
      updatedAt: now,
      completedAt: now,
    });
    const committed = await input.repository.commitWorkshopAgentRunEffects(
      input.seriesId,
      input.sessionId,
      run.id,
      input.run.revision,
      run,
      [assistant],
    );
    const researchEvidence = await persistResearchEvidence({
      repository: input.repository,
      seriesId: input.seriesId,
      sessionId: input.sessionId,
      attempt: input.attempt,
      assistantMessage: assistant,
    });
    return {
      run: committed.run,
      assistantMessage: assistant,
      toolMessages: [],
      modelCall: input.attempt.log,
      responseText: assistant.content,
      researchEvidence,
    };
  }

  const toolStepId = randomUUID();
  const tool = toolMessage({
    seriesId: input.seriesId,
    sessionId: input.sessionId,
    runId: input.run.run.id,
    stepId: toolStepId,
    contextBundleId: input.contextBundle.id,
    modelCallId: input.attempt.log.id,
    content: requestContent,
    createdAt: new Date(Date.parse(now) + 1).toISOString(),
  });
  const toolStep = WorkshopAgentStepRecordSchema.parse({
    schemaVersion: 2,
    id: toolStepId,
    index: completedModelSteps.length,
    kind: "tool-request",
    status: "waiting-confirmation",
    messageId: tool.id,
    inputMessageIds: [assistant.id],
    startedAt: now,
  });
  const run = WorkshopAgentRunSchema.parse({
    ...input.run.run,
    status: "waiting-confirmation",
    activeStepId: toolStep.id,
    steps: [...completedModelSteps, toolStep],
    retryable: false,
    updatedAt: tool.createdAt,
    completedAt: null,
  });
  const committed = await input.repository.commitWorkshopAgentRunEffects(
    input.seriesId,
    input.sessionId,
    run.id,
    input.run.revision,
    run,
    [assistant, tool],
  );
  const researchEvidence = await persistResearchEvidence({
    repository: input.repository,
    seriesId: input.seriesId,
    sessionId: input.sessionId,
    attempt: input.attempt,
    assistantMessage: assistant,
  });
  return {
    run: committed.run,
    assistantMessage: assistant,
    toolMessages: [tool],
    modelCall: input.attempt.log,
    responseText: assistant.content,
    researchEvidence,
  };
}

export async function runWorkshopAgent(input: WorkshopAgentRunnerInput): Promise<WorkshopAgentRunnerResult> {
  const now = new Date().toISOString();
  const runId = randomUUID();
  const stepId = randomUUID();
  const modelCallId = randomUUID();
  const degraded = false;
  const snapshot = promptSnapshot(input.prompt);
  const step = WorkshopAgentStepRecordSchema.parse({
    schemaVersion: 2,
    id: stepId,
    index: 0,
    kind: "model",
    status: "running",
    attempt: 1,
    modelCallId,
    promptSnapshot: snapshot,
    historySnapshot: [],
    inputMessageIds: [input.authorMessage.id],
    degradedStructuredOutput: degraded,
    startedAt: now,
  });
  let run = await input.repository.createWorkshopAgentRun(input.seriesId, WorkshopAgentRunSchema.parse({
    schemaVersion: 2,
    id: runId,
    seriesId: input.seriesId,
    sessionId: input.sessionId,
    authorMessageId: input.authorMessage.id,
    status: "running",
    modelProfileId: input.modelProfile.id,
    modelOverride: input.modelProfile.model,
    parameters: input.parameters,
    contextBundleId: input.contextBundle.id,
    promptTemplateId: input.contextBundle.promptTemplateId,
    promptTemplateVersion: input.contextBundle.promptTemplateVersion,
    promptSnapshot: snapshot,
    activeStepId: step.id,
    steps: [step],
    degradedStructuredOutput: degraded,
    createdAt: now,
    updatedAt: now,
  }));
  let attempt = await executeModelAttempt({
    ...input,
    contextBundle: input.providerContextBundle,
    modelCallId,
    attemptNumber: step.attempt,
    reset: false,
  });
  let activeStep = step;
  const transportRetry = await automaticTransportRetry({
    ...input,
    run,
    stepRecord: activeStep,
    attemptResult: attempt,
  });
  run = transportRetry.run;
  activeStep = transportRetry.stepRecord;
  attempt = transportRetry.attemptResult;
  if (attempt.step || attempt.error?.code !== "structured-output-failed") {
    return finalizeAttempt({ ...input, run, stepRecord: activeStep, attempt });
  }

  const correctionHistory = toolCorrectionHistory(
    attempt,
    attempt.error?.message ?? "Invalid tool request",
  );
  if (!correctionHistory) {
    return finalizeAttempt({ ...input, run, stepRecord: activeStep, attempt });
  }
  if (input.abortSignal?.aborted) {
    return finalizeAttempt({ ...input, run, stepRecord: activeStep, attempt });
  }

  const failedAt = new Date().toISOString();
  const repairCallId = randomUUID();
  const repairStep = WorkshopAgentStepRecordSchema.parse({
    schemaVersion: 2,
    id: randomUUID(),
    index: run.run.steps.length,
    kind: "repair",
    status: "running",
    attempt: activeStep.attempt + 1,
    modelCallId: repairCallId,
    promptSnapshot: promptSnapshot(input.prompt),
    historySnapshot: correctionHistory,
    inputMessageIds: activeStep.inputMessageIds,
    degradedStructuredOutput: degraded,
    startedAt: failedAt,
  });
  const repairing = WorkshopAgentRunSchema.parse({
    ...run.run,
    status: "running",
    activeStepId: repairStep.id,
    steps: [
      ...run.run.steps.map((record) => record.id === activeStep.id ? {
        ...record,
        status: "failed" as const,
        retryable: false,
        errorCode: attempt.error?.code ?? "structured-output-failed",
        errorMessage: attempt.error?.message ?? "Invalid Agent output",
        completedAt: failedAt,
      } : record),
      repairStep,
    ],
    updatedAt: failedAt,
  });
  run = await input.repository.updateWorkshopAgentRun(
    input.seriesId,
    input.sessionId,
    run.run.id,
    run.revision,
    repairing,
  );
  attempt = await executeModelAttempt({
    ...input,
    contextBundle: input.providerContextBundle,
    modelCallId: repairCallId,
    history: correctionHistory,
    attemptNumber: repairStep.attempt,
    reset: true,
  });
  return finalizeAttempt({ ...input, run, stepRecord: repairStep, attempt });
}

export async function continueWorkshopAgentAfterToolResult(input: {
  repository: ProjectRepository;
  providerRegistry: ProviderRegistry;
  embeddingRouter: EmbeddingRouter;
  seriesId: string;
  sessionId: string;
  run: WorkshopAgentRunDocument;
  resultMessage: WorkshopMessage;
  contextBundle: ContextBundle;
  providerContextBundle: ContextBundle;
  modelProfile: ModelProfile;
  activeResearchDatabaseIds: string[];
  assistantMessageId?: string;
  abortSignal?: AbortSignal;
  onAttemptStart?: WorkshopAgentRunnerInput["onAttemptStart"];
  onStreamEvent?: WorkshopAgentRunnerInput["onStreamEvent"];
  onResearchActivity?: WorkshopAgentRunnerInput["onResearchActivity"];
  prepareUpdateDraft: (draft: WorkshopCodexUpdateDraft) => Promise<WorkshopCodexUpdateDraft>;
}): Promise<WorkshopAgentRunnerResult> {
  if (
    input.run.run.status !== "interrupted" ||
    !input.run.run.retryable ||
    input.resultMessage.agentRunId !== input.run.run.id ||
    input.resultMessage.role !== "result"
  ) {
    throw new Error("Workshop Agent run is not ready to continue from this tool result.");
  }
  const authorMessage = (await input.repository.listWorkshopMessages(input.seriesId, input.sessionId))
    .find((message) => message.id === input.run.run.authorMessageId);
  if (!authorMessage) throw new Error("Workshop Agent run author message is unavailable.");
  const runMessages = (await input.repository.listWorkshopMessages(input.seriesId, input.sessionId))
    .filter((message) => message.agentRunId === input.run.run.id)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const continuationPrompt: ProviderPrompt = {
    system: input.run.run.promptSnapshot.system,
    instructions: input.run.run.promptSnapshot.instructions,
    user: input.run.run.promptSnapshot.user,
  };
  const providerHistory = providerHistoryForRun(input.run, runMessages);
  const now = new Date().toISOString();
  const degraded = false;
  const modelCallId = randomUUID();
  const continuationStep = WorkshopAgentStepRecordSchema.parse({
    schemaVersion: 2,
    id: randomUUID(),
    index: input.run.run.steps.length,
    kind: "continuation",
    status: "running",
    attempt: Math.max(...input.run.run.steps.map((step) => step.attempt), 0) + 1,
    modelCallId,
    promptSnapshot: promptSnapshot(continuationPrompt),
    historySnapshot: providerHistory,
    inputMessageIds: [input.resultMessage.id],
    degradedStructuredOutput: degraded,
    startedAt: now,
  });
  const running = WorkshopAgentRunSchema.parse({
    ...input.run.run,
    status: "running",
    activeStepId: continuationStep.id,
    steps: [...input.run.run.steps, continuationStep],
    degradedStructuredOutput: input.run.run.degradedStructuredOutput || degraded,
    retryable: false,
    updatedAt: now,
    completedAt: null,
  });
  let run = await input.repository.updateWorkshopAgentRun(
    input.seriesId,
    input.sessionId,
    input.run.run.id,
    input.run.revision,
    running,
  );
  let attempt = await executeModelAttempt({
    repository: input.repository,
    providerRegistry: input.providerRegistry,
    embeddingRouter: input.embeddingRouter,
    seriesId: input.seriesId,
    contextBundle: input.providerContextBundle,
    modelProfile: input.modelProfile,
    activeResearchDatabaseIds: input.activeResearchDatabaseIds,
    prompt: continuationPrompt,
    parameters: input.run.run.parameters,
    modelCallId,
    history: providerHistory,
    attemptNumber: continuationStep.attempt,
    reset: false,
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
    ...(input.onAttemptStart ? { onAttemptStart: input.onAttemptStart } : {}),
    ...(input.onStreamEvent ? { onStreamEvent: input.onStreamEvent } : {}),
    ...(input.onResearchActivity ? { onResearchActivity: input.onResearchActivity } : {}),
  });
  const runnerInput: WorkshopAgentRunnerInput = {
    repository: input.repository,
    providerRegistry: input.providerRegistry,
    embeddingRouter: input.embeddingRouter,
    seriesId: input.seriesId,
    sessionId: input.sessionId,
    authorMessage,
    contextBundle: input.contextBundle,
    providerContextBundle: input.providerContextBundle,
    modelProfile: input.modelProfile,
    activeResearchDatabaseIds: input.activeResearchDatabaseIds,
    parameters: input.run.run.parameters,
    prompt: continuationPrompt,
    ...(input.assistantMessageId ? { assistantMessageId: input.assistantMessageId } : {}),
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
    ...(input.onAttemptStart ? { onAttemptStart: input.onAttemptStart } : {}),
    ...(input.onStreamEvent ? { onStreamEvent: input.onStreamEvent } : {}),
    ...(input.onResearchActivity ? { onResearchActivity: input.onResearchActivity } : {}),
    prepareUpdateDraft: input.prepareUpdateDraft,
  };
  let activeStep = continuationStep;
  const transportRetry = await automaticTransportRetry({
    ...runnerInput,
    run,
    stepRecord: activeStep,
    attemptResult: attempt,
    history: providerHistory,
  });
  run = transportRetry.run;
  activeStep = transportRetry.stepRecord;
  attempt = transportRetry.attemptResult;
  if (isRepeatedSuccessfulToolRequest(attempt.step, runMessages, input.resultMessage)) {
    attempt = {
      ...attempt,
      step: completedReplayResponse(attempt.step as Extract<WorkshopAgentStep, { type: "request_tool" }>),
    };
  }
  if (attempt.step || attempt.error?.code !== "structured-output-failed") {
    return finalizeAttempt({ ...runnerInput, run, stepRecord: activeStep, attempt });
  }
  const correctionTail = toolCorrectionHistory(
    attempt,
    attempt.error?.message ?? "Invalid tool request",
  );
  if (!correctionTail) {
    return finalizeAttempt({ ...runnerInput, run, stepRecord: activeStep, attempt });
  }
  if (input.abortSignal?.aborted) {
    return finalizeAttempt({ ...runnerInput, run, stepRecord: activeStep, attempt });
  }
  const failedAt = new Date().toISOString();
  const repairCallId = randomUUID();
  const repairStep = WorkshopAgentStepRecordSchema.parse({
    schemaVersion: 2,
    id: randomUUID(),
    index: run.run.steps.length,
    kind: "repair",
    status: "running",
    attempt: activeStep.attempt + 1,
    modelCallId: repairCallId,
    promptSnapshot: promptSnapshot(continuationPrompt),
    historySnapshot: [...providerHistory, ...correctionTail],
    inputMessageIds: activeStep.inputMessageIds,
    degradedStructuredOutput: degraded,
    startedAt: failedAt,
  });
  const repairing = WorkshopAgentRunSchema.parse({
    ...run.run,
    activeStepId: repairStep.id,
    steps: [
      ...run.run.steps.map((step) => step.id === activeStep.id ? {
        ...step,
        status: "failed" as const,
        retryable: false,
        errorCode: attempt.error?.code ?? "structured-output-failed",
        errorMessage: attempt.error?.message ?? "Invalid Agent output",
        completedAt: failedAt,
      } : step),
      repairStep,
    ],
    updatedAt: failedAt,
  });
  const repairingRun = await input.repository.updateWorkshopAgentRun(
    input.seriesId,
    input.sessionId,
    run.run.id,
    run.revision,
    repairing,
  );
  const repairedAttempt = await executeModelAttempt({
    repository: input.repository,
    providerRegistry: input.providerRegistry,
    embeddingRouter: input.embeddingRouter,
    seriesId: input.seriesId,
    contextBundle: input.providerContextBundle,
    modelProfile: input.modelProfile,
    activeResearchDatabaseIds: input.activeResearchDatabaseIds,
    prompt: continuationPrompt,
    parameters: input.run.run.parameters,
    modelCallId: repairCallId,
    history: [...providerHistory, ...correctionTail],
    attemptNumber: repairStep.attempt,
    reset: true,
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
    ...(input.onAttemptStart ? { onAttemptStart: input.onAttemptStart } : {}),
    ...(input.onStreamEvent ? { onStreamEvent: input.onStreamEvent } : {}),
    ...(input.onResearchActivity ? { onResearchActivity: input.onResearchActivity } : {}),
  });
  return finalizeAttempt({
    ...runnerInput,
    run: repairingRun,
    stepRecord: repairStep,
    attempt: repairedAttempt,
  });
}

export async function retryWorkshopAgent(input: {
  repository: ProjectRepository;
  providerRegistry: ProviderRegistry;
  embeddingRouter: EmbeddingRouter;
  seriesId: string;
  sessionId: string;
  run: WorkshopAgentRunDocument;
  contextBundle: ContextBundle;
  providerContextBundle: ContextBundle;
  modelProfile: ModelProfile;
  activeResearchDatabaseIds: string[];
  assistantMessageId?: string;
  abortSignal?: AbortSignal;
  onAttemptStart?: WorkshopAgentRunnerInput["onAttemptStart"];
  onStreamEvent?: WorkshopAgentRunnerInput["onStreamEvent"];
  onResearchActivity?: WorkshopAgentRunnerInput["onResearchActivity"];
  prepareUpdateDraft: (draft: WorkshopCodexUpdateDraft) => Promise<WorkshopCodexUpdateDraft>;
}): Promise<WorkshopAgentRunnerResult> {
  if (!["failed", "interrupted"].includes(input.run.run.status) || !input.run.run.retryable) {
    throw new Error("Workshop Agent run is not retryable.");
  }
  const messages = await input.repository.listWorkshopMessages(input.seriesId, input.sessionId);
  const lastStep = input.run.run.steps.at(-1);
  if (lastStep?.kind === "tool-result" && lastStep.messageId) {
    const resultMessage = messages.find((message) => message.id === lastStep.messageId);
    if (!resultMessage) throw new Error("Workshop Agent tool result is unavailable.");
    return continueWorkshopAgentAfterToolResult({ ...input, resultMessage });
  }
  const retrySource = [...input.run.run.steps].reverse().find((step) =>
    step.retryable && ["model", "retry", "repair", "continuation"].includes(step.kind) && step.promptSnapshot
  );
  if (!retrySource?.promptSnapshot) {
    throw new Error("Workshop Agent run has no retryable model step.");
  }
  const authorMessage = messages.find((message) => message.id === input.run.run.authorMessageId);
  if (!authorMessage) throw new Error("Workshop Agent run author message is unavailable.");
  const prompt: ProviderPrompt = {
    system: retrySource.promptSnapshot.system,
    instructions: retrySource.promptSnapshot.instructions,
    user: retrySource.promptSnapshot.user,
  };
  const retryHistory = providerHistoryForRun(input.run, messages);
  const now = new Date().toISOString();
  const degraded = false;
  const modelCallId = randomUUID();
  const retryStep = WorkshopAgentStepRecordSchema.parse({
    schemaVersion: 2,
    id: randomUUID(),
    index: input.run.run.steps.length,
    kind: "retry",
    status: "running",
    attempt: Math.max(...input.run.run.steps.map((step) => step.attempt), 0) + 1,
    modelCallId,
    promptSnapshot: promptSnapshot(prompt),
    historySnapshot: retryHistory,
    inputMessageIds: retrySource.inputMessageIds,
    degradedStructuredOutput: degraded,
    startedAt: now,
  });
  const running = WorkshopAgentRunSchema.parse({
    ...input.run.run,
    status: "running",
    activeStepId: retryStep.id,
    steps: [...input.run.run.steps, retryStep],
    degradedStructuredOutput: input.run.run.degradedStructuredOutput || degraded,
    retryable: false,
    updatedAt: now,
    completedAt: null,
  });
  let run = await input.repository.updateWorkshopAgentRun(
    input.seriesId,
    input.sessionId,
    input.run.run.id,
    input.run.revision,
    running,
  );
  let attempt = await executeModelAttempt({
    repository: input.repository,
    providerRegistry: input.providerRegistry,
    embeddingRouter: input.embeddingRouter,
    seriesId: input.seriesId,
    contextBundle: input.providerContextBundle,
    modelProfile: input.modelProfile,
    activeResearchDatabaseIds: input.activeResearchDatabaseIds,
    prompt,
    parameters: input.run.run.parameters,
    modelCallId,
    history: retryHistory,
    attemptNumber: retryStep.attempt,
    reset: false,
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
    ...(input.onAttemptStart ? { onAttemptStart: input.onAttemptStart } : {}),
    ...(input.onStreamEvent ? { onStreamEvent: input.onStreamEvent } : {}),
    ...(input.onResearchActivity ? { onResearchActivity: input.onResearchActivity } : {}),
  });
  const runnerInput: WorkshopAgentRunnerInput = {
    repository: input.repository,
    providerRegistry: input.providerRegistry,
    embeddingRouter: input.embeddingRouter,
    seriesId: input.seriesId,
    sessionId: input.sessionId,
    authorMessage,
    contextBundle: input.contextBundle,
    providerContextBundle: input.providerContextBundle,
    modelProfile: input.modelProfile,
    activeResearchDatabaseIds: input.activeResearchDatabaseIds,
    parameters: input.run.run.parameters,
    prompt,
    ...(input.assistantMessageId ? { assistantMessageId: input.assistantMessageId } : {}),
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
    ...(input.onAttemptStart ? { onAttemptStart: input.onAttemptStart } : {}),
    ...(input.onStreamEvent ? { onStreamEvent: input.onStreamEvent } : {}),
    ...(input.onResearchActivity ? { onResearchActivity: input.onResearchActivity } : {}),
    prepareUpdateDraft: input.prepareUpdateDraft,
  };
  let activeStep = retryStep;
  const transportRetry = await automaticTransportRetry({
    ...runnerInput,
    run,
    stepRecord: activeStep,
    attemptResult: attempt,
    history: retryHistory,
  });
  run = transportRetry.run;
  activeStep = transportRetry.stepRecord;
  attempt = transportRetry.attemptResult;
  if (attempt.step || attempt.error?.code !== "structured-output-failed") {
    return finalizeAttempt({ ...runnerInput, run, stepRecord: activeStep, attempt });
  }
  const correctionTail = toolCorrectionHistory(attempt, attempt.error.message);
  if (!correctionTail) {
    return finalizeAttempt({ ...runnerInput, run, stepRecord: activeStep, attempt });
  }
  if (input.abortSignal?.aborted) {
    return finalizeAttempt({ ...runnerInput, run, stepRecord: activeStep, attempt });
  }
  const failedAt = new Date().toISOString();
  const repairCallId = randomUUID();
  const repairStep = WorkshopAgentStepRecordSchema.parse({
    schemaVersion: 2,
    id: randomUUID(),
    index: run.run.steps.length,
    kind: "repair",
    status: "running",
    attempt: activeStep.attempt + 1,
    modelCallId: repairCallId,
    promptSnapshot: promptSnapshot(prompt),
    historySnapshot: [...retryHistory, ...correctionTail],
    inputMessageIds: activeStep.inputMessageIds,
    degradedStructuredOutput: degraded,
    startedAt: failedAt,
  });
  const repairing = WorkshopAgentRunSchema.parse({
    ...run.run,
    activeStepId: repairStep.id,
    steps: [
      ...run.run.steps.map((step) => step.id === activeStep.id ? {
        ...step,
        status: "failed" as const,
        retryable: false,
        errorCode: attempt.error?.code ?? "structured-output-failed",
        errorMessage: attempt.error?.message ?? "Invalid Agent output",
        completedAt: failedAt,
      } : step),
      repairStep,
    ],
    updatedAt: failedAt,
  });
  run = await input.repository.updateWorkshopAgentRun(
    input.seriesId,
    input.sessionId,
    run.run.id,
    run.revision,
    repairing,
  );
  attempt = await executeModelAttempt({
    repository: input.repository,
    providerRegistry: input.providerRegistry,
    embeddingRouter: input.embeddingRouter,
    seriesId: input.seriesId,
    contextBundle: input.providerContextBundle,
    modelProfile: input.modelProfile,
    activeResearchDatabaseIds: input.activeResearchDatabaseIds,
    prompt,
    parameters: input.run.run.parameters,
    modelCallId: repairCallId,
    history: [...retryHistory, ...correctionTail],
    attemptNumber: repairStep.attempt,
    reset: true,
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
    ...(input.onAttemptStart ? { onAttemptStart: input.onAttemptStart } : {}),
    ...(input.onStreamEvent ? { onStreamEvent: input.onStreamEvent } : {}),
    ...(input.onResearchActivity ? { onResearchActivity: input.onResearchActivity } : {}),
  });
  return finalizeAttempt({ ...runnerInput, run, stepRecord: repairStep, attempt });
}
