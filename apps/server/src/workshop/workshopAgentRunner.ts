import { createHash, randomUUID } from "node:crypto";
import type { ProviderPrompt, ProviderRegistry } from "@novel-studio/ai";
import {
  ModelCallLogSchema,
  WorkshopAgentRunSchema,
  WorkshopAgentStepRecordSchema,
  WorkshopMessageSchema,
  type ContextBundle,
  type ModelCallError,
  type ModelCallLog,
  type ModelParameters,
  type ModelProfile,
  type TokenUsage,
  type WorkshopAgentRunDocument,
  type WorkshopAgentStepRecord,
  type WorkshopMessage,
} from "@novel-studio/contracts";
import type { ProjectRepository } from "@novel-studio/storage";
import { ensureCredentialBoundary, modelError } from "../ai/policy.js";
import { requestHash, usage } from "../routes/modelCalls.js";
import {
  serializeCodexCreateEntryToolRequest,
  serializeCodexUpdateEntryToolRequest,
  type WorkshopCodexUpdateDraft,
} from "./codexDraft.js";
import {
  WorkshopAgentStepSchema,
  parseWorkshopAgentStep,
  workshopAgentRepairPrompt,
  type WorkshopAgentStep,
} from "./workshopAgent.js";

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
  parameters: ModelParameters;
  estimatedUsage: TokenUsage;
  startedAt: string;
}): ModelCallLog {
  return ModelCallLogSchema.parse({
    schemaVersion: 1,
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
      parameters: input.parameters,
    }),
    status: "pending",
    estimatedUsage: input.estimatedUsage,
    startedAt: input.startedAt,
  });
}

function failedLog(log: ModelCallLog, error: ModelCallError, responseText: string): ModelCallLog {
  return ModelCallLogSchema.parse({
    ...log,
    status: "failed",
    responseHash: responseText ? hashText(responseText) : null,
    actualUsage: usage(log.estimatedUsage.inputTokens, responseText),
    errorCode: error.code,
    errorMessage: error.message,
    error,
    completedAt: new Date().toISOString(),
  });
}

interface ModelAttemptResult {
  log: ModelCallLog;
  rawOutput: string;
  step: WorkshopAgentStep | null;
  error: ModelCallError | null;
}

async function executeModelAttempt(input: {
  repository: ProjectRepository;
  providerRegistry: ProviderRegistry;
  seriesId: string;
  contextBundle: ContextBundle;
  modelProfile: ModelProfile;
  prompt: ProviderPrompt;
  parameters: ModelParameters;
  modelCallId: string;
  degradedStructuredOutput: boolean;
}): Promise<ModelAttemptResult> {
  let adapter;
  let rawOutput = "";
  try {
    adapter = input.providerRegistry.get(input.modelProfile.provider);
  } catch {
    const error = modelError("provider-unavailable", "The selected Provider is not available.", true);
    const log = failedLog(baseLog({
      ...input,
      id: input.modelCallId,
      estimatedUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      startedAt: new Date().toISOString(),
    }), error, "");
    await input.repository.saveModelCallLog(input.seriesId, log);
    return { log, rawOutput: "", step: null, error };
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
    estimatedUsage: estimate,
    startedAt: new Date().toISOString(),
  });
  await input.repository.saveModelCallLog(input.seriesId, log);
  try {
    ensureCredentialBoundary(input.modelProfile);
    if (estimate.inputTokens > input.modelProfile.contextWindowTokens) {
      throw modelError("context-too-large", "The selected context exceeds the model context window.");
    }
    log = ModelCallLogSchema.parse({ ...log, status: "streaming" });
    await input.repository.saveModelCallLog(input.seriesId, log);
    let step: WorkshopAgentStep;
    if (!input.degradedStructuredOutput) {
      step = await adapter.generateObject({
        modelProfile: input.modelProfile,
        prompt: input.prompt,
        contextBundle: input.contextBundle,
        parameters: input.parameters,
        outputSchemaName: "workshop_agent_step_v1",
      }, WorkshopAgentStepSchema) as WorkshopAgentStep;
      rawOutput = JSON.stringify(step);
    } else {
      for await (const chunk of adapter.streamText({
        modelProfile: input.modelProfile,
        prompt: input.prompt,
        contextBundle: input.contextBundle,
        parameters: input.parameters,
      })) {
        rawOutput += chunk;
      }
      step = parseWorkshopAgentStep(rawOutput);
    }
    log = ModelCallLogSchema.parse({
      ...log,
      status: "succeeded",
      responseHash: hashText(rawOutput),
      actualUsage: usage(estimate.inputTokens, rawOutput),
      completedAt: new Date().toISOString(),
    });
    await input.repository.saveModelCallLog(input.seriesId, log);
    return { log, rawOutput, step, error: null };
  } catch (caught) {
    const error = typeof caught === "object" && caught !== null && "code" in caught && "retryable" in caught
      ? caught as ModelCallError
      : caught instanceof SyntaxError || (caught instanceof Error && caught.name === "ZodError")
        ? modelError("structured-output-failed", "The model output did not match the Workshop Agent step schema.", true)
        : adapter.classifyError(caught);
    const failed = failedLog(log, error, rawOutput);
    await input.repository.saveModelCallLog(input.seriesId, failed);
    return { log: failed, rawOutput, step: null, error };
  }
}

function assistantMessage(input: {
  seriesId: string;
  sessionId: string;
  runId: string;
  stepId: string;
  contextBundleId: string;
  modelCallId: string;
  content: string;
  status?: "succeeded" | "failed";
  error?: ModelCallError | null;
  createdAt: string;
}): WorkshopMessage {
  return WorkshopMessageSchema.parse({
    schemaVersion: 1,
    id: randomUUID(),
    seriesId: input.seriesId,
    sessionId: input.sessionId,
    role: "assistant",
    mode: "agent",
    status: input.status ?? "succeeded",
    content: input.content,
    reasoningContent: "",
    contextBundleId: input.contextBundleId,
    modelCallId: input.modelCallId,
    agentRunId: input.runId,
    agentStepId: input.stepId,
    proposalIds: [],
    attachmentIds: [],
    errorCode: input.error?.code ?? null,
    errorMessage: input.error?.message ?? null,
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
    schemaVersion: 1,
    id: randomUUID(),
    seriesId: input.seriesId,
    sessionId: input.sessionId,
    role: "tool",
    mode: "agent",
    status: "succeeded",
    content: input.content,
    reasoningContent: "",
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
  modelCall: ModelCallLog;
  responseText: string;
}

export interface WorkshopAgentRunnerInput {
  repository: ProjectRepository;
  providerRegistry: ProviderRegistry;
  seriesId: string;
  sessionId: string;
  authorMessage: WorkshopMessage;
  contextBundle: ContextBundle;
  providerContextBundle: ContextBundle;
  modelProfile: ModelProfile;
  parameters: ModelParameters;
  prompt: ProviderPrompt;
  prepareUpdateDraft: (draft: WorkshopCodexUpdateDraft) => Promise<WorkshopCodexUpdateDraft>;
}

async function finalizeAttempt(input: WorkshopAgentRunnerInput & {
  run: WorkshopAgentRunDocument;
  stepRecord: WorkshopAgentStepRecord;
  attempt: ModelAttemptResult;
}): Promise<WorkshopAgentRunnerResult> {
  const now = new Date().toISOString();
  const currentSteps = input.run.run.steps;
  if (!input.attempt.step || input.attempt.error) {
    const error = input.attempt.error ?? modelError("structured-output-failed", "The Agent output was invalid.");
    const message = assistantMessage({
      seriesId: input.seriesId,
      sessionId: input.sessionId,
      runId: input.run.run.id,
      stepId: input.stepRecord.id,
      contextBundleId: input.contextBundle.id,
      modelCallId: input.stepRecord.modelCallId!,
      content: error.message,
      status: "failed",
      error,
      createdAt: now,
    });
    const steps = currentSteps.map((step) => step.id === input.stepRecord.id ? {
      ...step,
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
    };
  }

  const step = input.attempt.step;
  const assistant = assistantMessage({
    seriesId: input.seriesId,
    sessionId: input.sessionId,
    runId: input.run.run.id,
    stepId: input.stepRecord.id,
    contextBundleId: input.contextBundle.id,
    modelCallId: input.stepRecord.modelCallId!,
    content: step.message,
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
    return {
      run: committed.run,
      assistantMessage: assistant,
      toolMessages: [],
      modelCall: input.attempt.log,
      responseText: assistant.content,
    };
  }

  const toolStepId = randomUUID();
  const tool = toolMessage({
    seriesId: input.seriesId,
    sessionId: input.sessionId,
    runId: input.run.run.id,
    stepId: toolStepId,
    contextBundleId: input.contextBundle.id,
    modelCallId: input.stepRecord.modelCallId!,
    content: requestContent,
    createdAt: new Date(Date.parse(now) + 1).toISOString(),
  });
  const toolStep = WorkshopAgentStepRecordSchema.parse({
    schemaVersion: 1,
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
  return {
    run: committed.run,
    assistantMessage: assistant,
    toolMessages: [tool],
    modelCall: input.attempt.log,
    responseText: assistant.content,
  };
}

export async function runWorkshopAgent(input: WorkshopAgentRunnerInput): Promise<WorkshopAgentRunnerResult> {
  const now = new Date().toISOString();
  const runId = randomUUID();
  const stepId = randomUUID();
  const modelCallId = randomUUID();
  const degraded = !input.modelProfile.capabilities.structuredOutput;
  const snapshot = promptSnapshot(input.prompt);
  const step = WorkshopAgentStepRecordSchema.parse({
    schemaVersion: 1,
    id: stepId,
    index: 0,
    kind: "model",
    status: "running",
    attempt: 1,
    modelCallId,
    promptSnapshot: snapshot,
    inputMessageIds: [input.authorMessage.id],
    degradedStructuredOutput: degraded,
    startedAt: now,
  });
  let run = await input.repository.createWorkshopAgentRun(input.seriesId, WorkshopAgentRunSchema.parse({
    schemaVersion: 1,
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
    degradedStructuredOutput: degraded,
  });
  if (attempt.step || attempt.error?.code !== "structured-output-failed") {
    return finalizeAttempt({ ...input, run, stepRecord: step, attempt });
  }

  const failedAt = new Date().toISOString();
  const repairPrompt = workshopAgentRepairPrompt(
    input.prompt,
    attempt.rawOutput,
    attempt.error?.message ?? "Invalid Agent output",
  );
  const repairCallId = randomUUID();
  const repairStep = WorkshopAgentStepRecordSchema.parse({
    schemaVersion: 1,
    id: randomUUID(),
    index: 1,
    kind: "repair",
    status: "running",
    attempt: 2,
    modelCallId: repairCallId,
    promptSnapshot: promptSnapshot(repairPrompt),
    inputMessageIds: [input.authorMessage.id],
    degradedStructuredOutput: degraded,
    startedAt: failedAt,
  });
  const firstFailed = {
    ...step,
    status: "failed" as const,
    retryable: false,
    errorCode: attempt.error?.code ?? "structured-output-failed",
    errorMessage: attempt.error?.message ?? "Invalid Agent output",
    completedAt: failedAt,
  };
  const repairing = WorkshopAgentRunSchema.parse({
    ...run.run,
    status: "running",
    activeStepId: repairStep.id,
    steps: [firstFailed, repairStep],
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
    prompt: repairPrompt,
    modelCallId: repairCallId,
    degradedStructuredOutput: degraded,
  });
  return finalizeAttempt({ ...input, run, stepRecord: repairStep, attempt });
}

export async function continueWorkshopAgentAfterToolResult(input: {
  repository: ProjectRepository;
  providerRegistry: ProviderRegistry;
  seriesId: string;
  sessionId: string;
  run: WorkshopAgentRunDocument;
  resultMessage: WorkshopMessage;
  contextBundle: ContextBundle;
  providerContextBundle: ContextBundle;
  modelProfile: ModelProfile;
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
    user: [
      `Original author request:\n${authorMessage.content}`,
      "Agent run transcript:",
      ...runMessages.map((message) => `${message.role}: ${message.content}`),
      "Continue the conversation after the tool result. Return one structured Workshop Agent step.",
    ].join("\n\n"),
  };
  const now = new Date().toISOString();
  const degraded = !input.modelProfile.capabilities.structuredOutput;
  const modelCallId = randomUUID();
  const continuationStep = WorkshopAgentStepRecordSchema.parse({
    schemaVersion: 1,
    id: randomUUID(),
    index: input.run.run.steps.length,
    kind: "continuation",
    status: "running",
    attempt: Math.max(...input.run.run.steps.map((step) => step.attempt), 0) + 1,
    modelCallId,
    promptSnapshot: promptSnapshot(continuationPrompt),
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
  const run = await input.repository.updateWorkshopAgentRun(
    input.seriesId,
    input.sessionId,
    input.run.run.id,
    input.run.revision,
    running,
  );
  const attempt = await executeModelAttempt({
    repository: input.repository,
    providerRegistry: input.providerRegistry,
    seriesId: input.seriesId,
    contextBundle: input.providerContextBundle,
    modelProfile: input.modelProfile,
    prompt: continuationPrompt,
    parameters: input.run.run.parameters,
    modelCallId,
    degradedStructuredOutput: degraded,
  });
  const runnerInput: WorkshopAgentRunnerInput = {
    repository: input.repository,
    providerRegistry: input.providerRegistry,
    seriesId: input.seriesId,
    sessionId: input.sessionId,
    authorMessage,
    contextBundle: input.contextBundle,
    providerContextBundle: input.providerContextBundle,
    modelProfile: input.modelProfile,
    parameters: input.run.run.parameters,
    prompt: continuationPrompt,
    prepareUpdateDraft: input.prepareUpdateDraft,
  };
  if (attempt.step || attempt.error?.code !== "structured-output-failed") {
    return finalizeAttempt({ ...runnerInput, run, stepRecord: continuationStep, attempt });
  }
  const failedAt = new Date().toISOString();
  const repairPrompt = workshopAgentRepairPrompt(
    continuationPrompt,
    attempt.rawOutput,
    attempt.error?.message ?? "Invalid Agent output",
  );
  const repairCallId = randomUUID();
  const repairStep = WorkshopAgentStepRecordSchema.parse({
    schemaVersion: 1,
    id: randomUUID(),
    index: run.run.steps.length,
    kind: "repair",
    status: "running",
    attempt: continuationStep.attempt + 1,
    modelCallId: repairCallId,
    promptSnapshot: promptSnapshot(repairPrompt),
    inputMessageIds: [input.resultMessage.id],
    degradedStructuredOutput: degraded,
    startedAt: failedAt,
  });
  const repairing = WorkshopAgentRunSchema.parse({
    ...run.run,
    activeStepId: repairStep.id,
    steps: [
      ...run.run.steps.map((step) => step.id === continuationStep.id ? {
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
    seriesId: input.seriesId,
    contextBundle: input.providerContextBundle,
    modelProfile: input.modelProfile,
    prompt: repairPrompt,
    parameters: input.run.run.parameters,
    modelCallId: repairCallId,
    degradedStructuredOutput: degraded,
  });
  return finalizeAttempt({
    ...runnerInput,
    prompt: repairPrompt,
    run: repairingRun,
    stepRecord: repairStep,
    attempt: repairedAttempt,
  });
}

export async function retryWorkshopAgent(input: {
  repository: ProjectRepository;
  providerRegistry: ProviderRegistry;
  seriesId: string;
  sessionId: string;
  run: WorkshopAgentRunDocument;
  contextBundle: ContextBundle;
  providerContextBundle: ContextBundle;
  modelProfile: ModelProfile;
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
    step.retryable && ["model", "repair", "continuation"].includes(step.kind) && step.promptSnapshot
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
  const now = new Date().toISOString();
  const degraded = !input.modelProfile.capabilities.structuredOutput;
  const modelCallId = randomUUID();
  const retryStep = WorkshopAgentStepRecordSchema.parse({
    schemaVersion: 1,
    id: randomUUID(),
    index: input.run.run.steps.length,
    kind: "continuation",
    status: "running",
    attempt: Math.max(...input.run.run.steps.map((step) => step.attempt), 0) + 1,
    modelCallId,
    promptSnapshot: promptSnapshot(prompt),
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
    seriesId: input.seriesId,
    contextBundle: input.providerContextBundle,
    modelProfile: input.modelProfile,
    prompt,
    parameters: input.run.run.parameters,
    modelCallId,
    degradedStructuredOutput: degraded,
  });
  const runnerInput: WorkshopAgentRunnerInput = {
    repository: input.repository,
    providerRegistry: input.providerRegistry,
    seriesId: input.seriesId,
    sessionId: input.sessionId,
    authorMessage,
    contextBundle: input.contextBundle,
    providerContextBundle: input.providerContextBundle,
    modelProfile: input.modelProfile,
    parameters: input.run.run.parameters,
    prompt,
    prepareUpdateDraft: input.prepareUpdateDraft,
  };
  if (attempt.step || attempt.error?.code !== "structured-output-failed") {
    return finalizeAttempt({ ...runnerInput, run, stepRecord: retryStep, attempt });
  }
  const failedAt = new Date().toISOString();
  const repairPrompt = workshopAgentRepairPrompt(prompt, attempt.rawOutput, attempt.error.message);
  const repairCallId = randomUUID();
  const repairStep = WorkshopAgentStepRecordSchema.parse({
    schemaVersion: 1,
    id: randomUUID(),
    index: run.run.steps.length,
    kind: "repair",
    status: "running",
    attempt: retryStep.attempt + 1,
    modelCallId: repairCallId,
    promptSnapshot: promptSnapshot(repairPrompt),
    inputMessageIds: retryStep.inputMessageIds,
    degradedStructuredOutput: degraded,
    startedAt: failedAt,
  });
  const repairing = WorkshopAgentRunSchema.parse({
    ...run.run,
    activeStepId: repairStep.id,
    steps: [
      ...run.run.steps.map((step) => step.id === retryStep.id ? {
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
    seriesId: input.seriesId,
    contextBundle: input.providerContextBundle,
    modelProfile: input.modelProfile,
    prompt: repairPrompt,
    parameters: input.run.run.parameters,
    modelCallId: repairCallId,
    degradedStructuredOutput: degraded,
  });
  return finalizeAttempt({ ...runnerInput, prompt: repairPrompt, run, stepRecord: repairStep, attempt });
}
