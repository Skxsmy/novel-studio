import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  CreateWorkshopBranchInputSchema,
  AbandonWorkshopAgentRunInputSchema,
  ContextBundleSchema,
  ExecuteWorkshopCodexCreateEntryToolInputSchema,
  ExecuteWorkshopCodexUpdateEntryToolInputSchema,
  WorkshopCodexCreateEntryToolErrorSchema,
  WorkshopCodexCreateEntryToolResultSchema,
  WorkshopCodexUpdateEntryToolResultSchema,
  ModelCallLogSchema,
  ResendWorkshopMessageInputSchema,
  ResendWorkshopMessageResultSchema,
  RetryWorkshopAgentRunInputSchema,
  RunWorkshopCallInputSchema,
  UpdateWorkshopContextBasketInputSchema,
  WorkshopCallResultSchema,
  WorkshopCallStreamEventSchema,
  WorkshopAgentRunActionResultSchema,
  WorkshopContextPreviewInputSchema,
  WorkshopMessageSchema,
  CreateCodexProgressionInputSchema,
  UpdateCodexProgressionInputSchema,
  type CodexDetailTypeDocument,
  type CodexEntryDocument,
  type CodexProgressionDocument,
  type ContextBundle,
  type ModelCallError,
  type ModelCallLog,
  type ModelParameters,
  type ModelProfile,
  type TokenUsage,
  type WorkshopContextBasket,
  type WorkshopAgentRunDocument,
  type WorkshopCallStreamEvent,
  type WorkshopCodexDraftDetailMapping,
  type WorkshopCodexDraftMissingDetailType,
  type WorkshopMessage,
  type WorkshopSession,
} from "@novel-studio/contracts";
import type { EmbeddingRouter, ProviderPrompt, ProviderRegistry } from "@novel-studio/ai";
import {
  StorageError,
  type ProjectRepository,
  type WorkshopCodexDetailTypeCreationCommand,
  type WorkshopCodexProgressionBinding,
  type WorkshopCodexProgressionCommand,
} from "@novel-studio/storage";
import {
  ensureCredentialBoundary,
  modelError,
} from "../ai/policy.js";
import { PromptRenderError } from "../prompts/render.js";
import { buildContextBundle } from "./context.js";
import { contextPrompt, requestHash, usage } from "./modelCalls.js";
import { registerWorkshopRecordRoutes } from "./workshopRecordRoutes.js";
import {
  codexCreateEntryInputFromWorkshopDraft,
  codexUpdateEntryInputFromWorkshopDraft,
  parseCodexCreateEntryToolRequest,
  parseCodexUpdateEntryToolRequest,
  type CodexUpdateEntryToolRequest,
  type WorkshopCodexCreateDraft,
  type WorkshopCodexProgressionDraft,
  type WorkshopCodexUpdateDraft,
  WorkshopCodexDetailTypeCreationRequiredError,
} from "../workshop/codexDraft.js";
import { planWorkshopDetailSchema } from "../workshop/detailSchemaPlanner.js";
import { WorkshopAgentCoordinator } from "../workshop/workshopAgentCoordinator.js";
import { createReasoningParser, splitReasoningContent } from "../workshop/workshopReasoning.js";
import {
  workshopPromptDefinition,
  workshopProviderPrompt as workshopModeProviderPrompt,
} from "../workshop/workshopPrompts.js";

function hashText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function workshopToolConfirmationIdentity(input: {
  confirm: true;
  createMissingDetailTypes?: boolean;
  detailCreations?: Array<{ label: string; name: string; nsfw?: boolean }>;
  detailMappings?: WorkshopCodexDraftDetailMapping[];
}) {
  return {
    confirm: true,
    createMissingDetailTypes: input.createMissingDetailTypes ?? false,
    detailCreations: [...(input.detailCreations ?? [])]
      .map((item) => ({ label: item.label.trim(), name: item.name.trim(), nsfw: item.nsfw ?? false }))
      .sort((left, right) =>
        left.label.localeCompare(right.label, "und") ||
        left.name.localeCompare(right.name, "und") ||
        Number(left.nsfw) - Number(right.nsfw)
      ),
    detailMappings: [...(input.detailMappings ?? [])]
      .map((item) => ({ label: item.label.trim(), detailTypeId: item.detailTypeId }))
      .sort((left, right) =>
        left.label.localeCompare(right.label, "und") ||
        left.detailTypeId.localeCompare(right.detailTypeId)
      ),
  };
}

function workshopToolRequestHash(
  message: WorkshopMessage,
  confirmation?: Parameters<typeof workshopToolConfirmationIdentity>[0],
): string {
  return hashText(JSON.stringify({
    toolRequest: message.content,
    confirmation: confirmation ? workshopToolConfirmationIdentity(confirmation) : null,
  }));
}

function workshopToolConflict(message: WorkshopMessage, requestHash: string): { code: string; message: string } | null {
  const execution = message.toolExecution;
  if (!execution) return null;
  if (execution.requestHash !== requestHash) {
    return {
      code: "WORKSHOP_TOOL_EXECUTION_CONFLICT",
      message: "This Workshop tool message already records a different execution request.",
    };
  }
  if (execution.status === "succeeded") {
    return {
      code: "WORKSHOP_TOOL_ALREADY_EXECUTED",
      message: "This Workshop tool message has already been executed.",
    };
  }
  if (execution.status === "running") {
    return {
      code: "WORKSHOP_TOOL_EXECUTION_RUNNING",
      message: "This Workshop tool message execution is already recorded as running.",
    };
  }
  if (execution.status === "interrupted" && execution.retryable) return null;
  if (execution.status === "abandoned") {
    return {
      code: "WORKSHOP_TOOL_EXECUTION_ABANDONED",
      message: "This Workshop tool execution was abandoned and cannot be replayed.",
    };
  }
  return {
    code: "WORKSHOP_TOOL_EXECUTION_FAILED",
    message: "This Workshop tool message already has a failed execution record.",
  };
}

function writeWorkshopEvent(reply: FastifyReply, rawEvent: WorkshopCallStreamEvent): void {
  const event = WorkshopCallStreamEventSchema.parse(rawEvent);
  reply.raw.write(`event: ${event.type}\n`);
  reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
}

function manualContextIds(basket: WorkshopContextBasket): string[] {
  return basket.items.flatMap((item) => {
    if (!item.sourceId) return [];
    if (item.kind === "full-novel") return [`full-novel:${item.sourceId}`];
    if (item.kind === "full-outline") return [`full-outline:${item.sourceId}`];
    if (item.kind === "act") return [`act:${item.sourceId}`];
    if (item.kind === "chapter") return [`chapter:${item.sourceId}`];
    if (item.kind === "scene") return [`scene:${item.sourceId}`];
    if (item.kind === "codex-entry") return [`codex:${item.sourceId}`];
    return [];
  });
}

async function workshopContextPayload(
  repository: ProjectRepository,
  seriesId: string,
  basket: WorkshopContextBasket,
  session: WorkshopSession,
  input: ReturnType<typeof WorkshopContextPreviewInputSchema.parse>,
  options: { excludeWorkshopMessageId?: string | null } = {},
): Promise<Record<string, unknown>> {
  assertWorkshopSessionMode(session, input.mode);
  const workshopPrompt = workshopPromptDefinition(input.mode);
  const promptInstruction = input.mode === "general-chat"
    ? session.generalChatSystemPrompt
    : workshopPrompt
      ? [workshopPrompt.system, workshopPrompt.instructions].filter(Boolean).join("\n\n")
      : null;
  return {
    sceneId: basket.sceneId ?? null,
    blockId: basket.blockId,
    selection: basket.selection,
    manualContextIds: manualContextIds(basket),
    userRequest: input.userRequest,
    roleId: workshopPrompt?.roleId ?? input.roleId,
    taskKind: workshopPrompt?.taskKind ?? input.taskKind,
    promptTemplateId: workshopPrompt?.promptTemplateId ?? input.promptTemplateId,
    promptTemplateVersion: workshopPrompt?.promptTemplateVersion ?? input.promptTemplateVersion,
    systemPromptOverride: promptInstruction,
    modelProfileId: input.modelProfileId,
    tokenBudget: input.tokenBudget,
    attachmentIds: input.attachmentIds,
    draftToken: input.draftToken,
    workshopSessionId: basket.sessionId,
    excludeWorkshopMessageId: options.excludeWorkshopMessageId ?? null,
    includePendingWorkshopCodexDraft: input.mode === "agent",
  };
}

function assertWorkshopSessionMode(
  session: WorkshopSession,
  mode: ReturnType<typeof WorkshopContextPreviewInputSchema.parse>["mode"],
): void {
  const expectedMode = session.kind === "agent" ? "agent" : "general-chat";
  if (mode !== expectedMode) {
    throw new StorageError("Workshop call mode must match the session kind", "INVALID_DATA", {
      sessionId: session.id,
      sessionKind: session.kind,
      mode,
    });
  }
}

function combinedInputUsage(
  contextBundle: ContextBundle,
  modelProfile: ModelProfile,
  prompt: ProviderPrompt,
  registry: ProviderRegistry | null,
): TokenUsage {
  const promptUsage = registry?.get(modelProfile.provider).estimateTokens(prompt) ?? {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };
  const inputTokens = contextBundle.estimatedUsage.inputTokens + promptUsage.inputTokens;
  return {
    inputTokens,
    outputTokens: 0,
    totalTokens: inputTokens,
  };
}

function effectiveModelProfile(modelProfile: ModelProfile, modelOverride?: string | null): ModelProfile {
  const nextModel = modelOverride?.trim();
  if (!nextModel || nextModel === modelProfile.model) return modelProfile;
  return {
    ...modelProfile,
    model: nextModel,
  };
}

const WORKSHOP_PROMPT_CONTEXT_KINDS = new Set([
  "role-instruction",
  "prompt-template",
  "user-request",
]);

function shouldFilterPromptContext(mode: ReturnType<typeof RunWorkshopCallInputSchema.parse>["mode"]): boolean {
  return mode === "general-chat" || mode === "agent";
}

async function workshopProviderPrompt(
  contextBundle: ContextBundle,
  mode: ReturnType<typeof RunWorkshopCallInputSchema.parse>["mode"],
  session: WorkshopSession,
): Promise<ProviderPrompt> {
  assertWorkshopSessionMode(session, mode);
  if (mode === "agent") {
    return workshopModeProviderPrompt({
      mode: "agent",
      userRequest: contextBundle.userRequest,
    });
  }
  if (mode === "general-chat") {
    return workshopModeProviderPrompt({
      mode: "general-chat",
      userRequest: contextBundle.userRequest,
      generalChatSystemPrompt: session.generalChatSystemPrompt ?? "",
    });
  }
  return contextPrompt(contextBundle);
}

function workshopProviderContextBundle(
  contextBundle: ContextBundle,
  mode: ReturnType<typeof RunWorkshopCallInputSchema.parse>["mode"],
): ContextBundle {
  if (!shouldFilterPromptContext(mode)) return contextBundle;
  const items = contextBundle.items.filter((item) => !WORKSHOP_PROMPT_CONTEXT_KINDS.has(item.kind));
  const inputTokens = items.reduce((sum, item) => sum + item.tokenEstimate, 0);
  return ContextBundleSchema.parse({
    ...contextBundle,
    items,
    estimatedUsage: {
      inputTokens,
      outputTokens: 0,
      totalTokens: inputTokens,
    },
  });
}

function baseModelCallLog(input: {
  seriesId: string;
  callId: string;
  modelProfile: ModelProfile;
  contextBundle: ContextBundle;
  requestContextBundle?: ContextBundle;
  prompt: ProviderPrompt;
  parameters: ModelParameters;
  estimatedUsage: TokenUsage;
  startedAt: string;
}): ModelCallLog {
  return ModelCallLogSchema.parse({
    schemaVersion: 1,
    id: input.callId,
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
      contextBundle: input.requestContextBundle ?? input.contextBundle,
      prompt: input.prompt,
      parameters: input.parameters,
    }),
    responseHash: null,
    status: "pending",
    estimatedUsage: input.estimatedUsage,
    actualUsage: null,
    errorCode: null,
    errorMessage: null,
    error: null,
    startedAt: input.startedAt,
    completedAt: null,
  });
}

function failedLog(baseLog: ModelCallLog, error: ModelCallError, responseText = ""): ModelCallLog {
  return ModelCallLogSchema.parse({
    ...baseLog,
    status: "failed",
    responseHash: responseText ? hashText(responseText) : null,
    actualUsage: usage(baseLog.estimatedUsage.inputTokens, responseText),
    errorCode: error.code,
    errorMessage: error.message,
    error,
    completedAt: new Date().toISOString(),
  });
}

async function executeWorkshopCall(input: {
  repository: ProjectRepository;
  providerRegistry: ProviderRegistry;
  seriesId: string;
  sessionId: string;
  contextBundle: ContextBundle;
  providerContextBundle?: ContextBundle;
  modelProfile: ModelProfile;
  prompt?: ProviderPrompt;
  parameters: ModelParameters;
  abortSignal?: AbortSignal;
  onChunk?: (chunk: string) => void | Promise<void>;
  onStreamingLog?: (log: ModelCallLog) => void | Promise<void>;
}): Promise<{ log: ModelCallLog; responseText: string }> {
  const { repository, providerRegistry, seriesId, contextBundle, modelProfile, parameters } = input;
  const prompt = input.prompt ?? contextPrompt(contextBundle);
  const providerContextBundle = input.providerContextBundle ?? contextBundle;
  let adapter;
  try {
    adapter = providerRegistry.get(modelProfile.provider);
  } catch {
    const estimatedUsage = combinedInputUsage(providerContextBundle, modelProfile, prompt, null);
    const baseLog = baseModelCallLog({
      seriesId,
      callId: randomUUID(),
      modelProfile,
      contextBundle,
      requestContextBundle: providerContextBundle,
      prompt,
      parameters,
      estimatedUsage,
      startedAt: new Date().toISOString(),
    });
    const error = modelError(
      "provider-unavailable",
      "当前版本还没有启用这个 Provider。不会自动回退到其他模型。",
      true,
    );
    const log = failedLog(baseLog, error);
    await repository.saveModelCallLog(seriesId, log);
    return { log, responseText: "" };
  }

  const estimatedUsage = combinedInputUsage(providerContextBundle, modelProfile, prompt, providerRegistry);
  const baseLog = baseModelCallLog({
    seriesId,
    callId: randomUUID(),
    modelProfile,
    contextBundle,
    requestContextBundle: providerContextBundle,
    prompt,
    parameters,
    estimatedUsage,
    startedAt: new Date().toISOString(),
  });

  await repository.saveModelCallLog(seriesId, baseLog);
  const blocked = ensureCredentialBoundary(modelProfile);
  if (blocked) {
    const log = failedLog(baseLog, blocked);
    await repository.saveModelCallLog(seriesId, log);
    return { log, responseText: "" };
  }
  if (estimatedUsage.inputTokens > modelProfile.contextWindowTokens) {
    const error = modelError("context-too-large", "上下文超过模型窗口，调用已拒绝。", false);
    const log = failedLog(baseLog, error);
    await repository.saveModelCallLog(seriesId, log);
    return { log, responseText: "" };
  }

  let latestLog = ModelCallLogSchema.parse({ ...baseLog, status: "streaming" });
  await repository.saveModelCallLog(seriesId, latestLog);
  await input.onStreamingLog?.(latestLog);
  let responseText = "";
  try {
    for await (const chunk of adapter.streamText({
      modelProfile,
      prompt,
      contextBundle: providerContextBundle,
      parameters,
      ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
    })) {
      responseText += chunk;
      await input.onChunk?.(chunk);
    }
    latestLog = ModelCallLogSchema.parse({
      ...latestLog,
      status: "succeeded",
      responseHash: hashText(responseText),
      actualUsage: usage(estimatedUsage.inputTokens, responseText),
      completedAt: new Date().toISOString(),
    });
    await repository.saveModelCallLog(seriesId, latestLog);
    return { log: latestLog, responseText };
  } catch (caught) {
    const log = failedLog(baseLog, adapter.classifyError(caught), responseText);
    await repository.saveModelCallLog(seriesId, log);
    return { log, responseText };
  }
}

function sendContextError(reply: FastifyReply, error: unknown): boolean {
  if (error instanceof Error && error.name.startsWith("MODEL_CONTEXT_BLOCKED:")) {
    const status = Number(error.name.split(":")[1] ?? 403);
    void reply.status(status).send({
      code: "PROVIDER_ERROR",
      message: error.message,
    });
    return true;
  }
  if (error instanceof PromptRenderError) {
    void reply.status(error.code === "PROMPT_INPUT_MISSING" ? 400 : 422).send({
      code: error.code,
      message: error.message,
      details: error.details,
    });
    return true;
  }
  return false;
}

class CodexUpdateTargetResolutionError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode: number, code = "INVALID_DATA") {
    super(message);
    this.name = "CodexUpdateTargetResolutionError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function normalizeCodexLookupName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("und");
}

async function resolveCodexUpdateTarget(input: {
  entryId?: string;
  name?: string;
  repository: ProjectRepository;
  seriesId: string;
}): Promise<CodexEntryDocument> {
  if (input.entryId) {
    return input.repository.getCodexEntry(input.seriesId, input.entryId);
  }
  const targetName = input.name?.trim();
  if (!targetName) {
    throw new CodexUpdateTargetResolutionError("codex.update_entry requires a target entry id or exact name.", 400);
  }
  const targetKey = normalizeCodexLookupName(targetName);
  const entries = await input.repository.listCodexEntries(input.seriesId, { includeArchived: false });
  const matches = entries.filter((entry) => {
    const names = [entry.metadata.name, ...entry.metadata.aliases].map(normalizeCodexLookupName);
    return names.includes(targetKey);
  });
  if (matches.length === 0) {
    throw new CodexUpdateTargetResolutionError(
      `No active Codex entry exactly matches "${targetName}".`,
      404,
      "NOT_FOUND",
    );
  }
  if (matches.length > 1) {
    throw new CodexUpdateTargetResolutionError(
      `Codex entry target "${targetName}" is ambiguous. Use an entry id.`,
      409,
      "CONFLICT",
    );
  }
  return matches[0]!;
}

function progressionBindingFromDocument(
  document: CodexProgressionDocument,
): WorkshopCodexProgressionBinding {
  return {
    kind: document.progression.kind,
    entryId: document.progression.entryId,
    relationId: document.progression.relationId,
    field: document.progression.field,
    fieldKey: document.progression.fieldKey,
    effectiveFromSceneId: document.progression.effectiveFromSceneId,
    effectiveToSceneId: document.progression.effectiveToSceneId,
  };
}

async function assertProgressionTargetsWorkshopEntry(input: {
  entryId: string;
  progression: CodexProgressionDocument["progression"];
  repository: ProjectRepository;
  seriesId: string;
}): Promise<void> {
  if (input.progression.kind === "field" || input.progression.kind === "world") {
    if (input.progression.entryId !== input.entryId) {
      throw new CodexUpdateTargetResolutionError(
        "Progression target does not belong to the Codex entry being updated.",
        409,
        "CONFLICT",
      );
    }
    return;
  }
  const relations = await input.repository.listCodexRelations(input.seriesId, {
    entryId: input.entryId,
    includeArchived: false,
  });
  if (!relations.some((document) => document.relation.id === input.progression.relationId)) {
    throw new CodexUpdateTargetResolutionError(
      "Progression relation does not involve the Codex entry being updated.",
      409,
      "CONFLICT",
    );
  }
}

async function captureCodexUpdateDraftBaselines(input: {
  draft: WorkshopCodexUpdateDraft;
  repository: ProjectRepository;
  seriesId: string;
}): Promise<WorkshopCodexUpdateDraft> {
  const entry = await resolveCodexUpdateTarget({
    ...(input.draft.target.entryId ? { entryId: input.draft.target.entryId } : {}),
    ...(input.draft.target.name ? { name: input.draft.target.name } : {}),
    repository: input.repository,
    seriesId: input.seriesId,
  });
  const progressions: WorkshopCodexProgressionDraft[] = [];
  for (const draft of input.draft.patch.progressions ?? []) {
    if (draft.action === "create") {
      const progressionInput = codexProgressionCreateInputFromDraft(draft, entry);
      await assertProgressionTargetsWorkshopEntry({
        entryId: entry.metadata.id,
        progression: {
          ...progressionInput,
          schemaVersion: 1,
          id: randomUUID(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          archivedAt: null,
        },
        repository: input.repository,
        seriesId: input.seriesId,
      });
      progressions.push({ action: "create", input: progressionInput });
      continue;
    }
    const current = await input.repository.getCodexProgression(
      input.seriesId,
      draft.progressionId,
    );
    await assertProgressionTargetsWorkshopEntry({
      entryId: entry.metadata.id,
      progression: current.progression,
      repository: input.repository,
      seriesId: input.seriesId,
    });
    const baseline = {
      revision: current.revision,
      binding: progressionBindingFromDocument(current),
    };
    if (draft.action === "delete") {
      progressions.push({
        action: "delete",
        progressionId: draft.progressionId,
        input: { baseRevision: current.revision },
        baseline,
      });
      continue;
    }
    const requested = { ...draft.input } as Record<string, unknown>;
    const protectedFields = [
      "kind",
      "entryId",
      "relationId",
      "field",
      "fieldKey",
      "effectiveFromSceneId",
      "effectiveToSceneId",
      "source",
    ];
    const attemptedRetarget = protectedFields.find((field) =>
      Object.prototype.hasOwnProperty.call(requested, field) &&
      JSON.stringify(requested[field]) !==
        JSON.stringify((current.progression as unknown as Record<string, unknown>)[field])
    );
    if (attemptedRetarget) {
      throw new CodexUpdateTargetResolutionError(
        "Progression target and effective Scene cannot be changed by codex.update_entry.",
        409,
        "CONFLICT",
      );
    }
    for (const field of protectedFields) delete requested[field];
    delete requested.baseRevision;
    progressions.push({
      action: "update",
      progressionId: draft.progressionId,
      input: {
        ...requested,
        baseRevision: current.revision,
      },
      baseline,
    });
  }
  return {
    target: { entryId: entry.metadata.id },
    patch: {
      ...input.draft.patch,
      ...(input.draft.patch.progressions ? { progressions } : {}),
    },
    baseline: {
      entryRevision: entry.revision,
      researchRevision: entry.research.revision,
    },
  };
}

function codexProgressionCreateInputFromDraft(
  draft: Extract<WorkshopCodexProgressionDraft, { action: "create" }>,
  targetEntry: CodexEntryDocument,
) {
  const input: Record<string, unknown> = { ...draft.input };
  if (
    (input.kind === "field" || input.kind === "world") &&
    input.entryId === undefined
  ) {
    input.entryId = targetEntry.metadata.id;
  }
  if (input.source === undefined) {
    input.source = {
      kind: "codex-page",
      sceneId: null,
      blockId: null,
      sourceId: null,
    };
  }
  return CreateCodexProgressionInputSchema.parse(input);
}

function progressionCommandsFromDraft(
  drafts: WorkshopCodexProgressionDraft[],
  entry: CodexEntryDocument,
): WorkshopCodexProgressionCommand[] {
  return drafts.map((draft) => {
    if (draft.action === "create") {
      return {
        action: "create",
        input: codexProgressionCreateInputFromDraft(draft, entry),
      };
    }
    if (!draft.baseline) {
      throw new Error("Codex update tool request is missing a Progression baseline.");
    }
    if (draft.action === "update") {
      const rawInput = { ...draft.input } as Record<string, unknown>;
      delete rawInput.kind;
      delete rawInput.entryId;
      delete rawInput.relationId;
      delete rawInput.field;
      delete rawInput.fieldKey;
      delete rawInput.effectiveFromSceneId;
      delete rawInput.effectiveToSceneId;
      delete rawInput.source;
      return {
        action: "update",
        progressionId: draft.progressionId,
        baseRevision: draft.baseline.revision,
        binding: draft.baseline.binding,
        input: UpdateCodexProgressionInputSchema.parse({
          ...rawInput,
          baseRevision: draft.baseline.revision,
        }),
      };
    }
    return {
      action: "delete",
      progressionId: draft.progressionId,
      baseRevision: draft.baseline.revision,
      binding: draft.baseline.binding,
    };
  });
}

function planWorkshopDetailTypeCreations(input: {
  categoryId: string;
  confirmation: {
    detailCreations: Array<{ label: string; name: string; nsfw?: boolean }>;
  };
  missing: WorkshopCodexDraftMissingDetailType[];
}): {
  commands: WorkshopCodexDetailTypeCreationCommand[];
  documents: CodexDetailTypeDocument[];
  mappings: WorkshopCodexDraftDetailMapping[];
} {
  const requested = new Map<string, { label: string; name: string; nsfw?: boolean }>();
  for (const creation of input.confirmation.detailCreations) {
    const key = normalizeCodexLookupName(creation.label);
    if (requested.has(key)) {
      throw new Error(`Detail type creation for "${creation.label}" is duplicated.`);
    }
    requested.set(key, creation);
  }
  const missingKeys = new Set(input.missing.map((item) => normalizeCodexLookupName(item.label)));
  for (const [key, creation] of requested) {
    if (!missingKeys.has(key)) {
      throw new Error(`Detail type creation for "${creation.label}" is not required by this draft.`);
    }
  }
  const now = new Date().toISOString();
  const commands = input.missing.map((item) => {
    const requestedCreation = requested.get(normalizeCodexLookupName(item.label));
    if (!requestedCreation) {
      throw new Error(`Choose an existing detail type or explicitly create one for "${item.label}".`);
    }
    return {
      id: randomUUID(),
      name: requestedCreation.name,
      nsfw: requestedCreation.nsfw ?? false,
    };
  });
  return {
    commands,
    mappings: input.missing.map((item, index) => ({
      label: item.label,
      detailTypeId: commands[index]!.id,
    })),
    documents: commands.map((command) => ({
      detailType: {
        schemaVersion: 2,
        id: command.id,
        categoryId: input.categoryId,
        name: command.name,
        description: "",
        nsfw: command.nsfw ?? false,
        createdAt: now,
        updatedAt: now,
      },
      revision: "0".repeat(64),
    } as CodexDetailTypeDocument)),
  };
}

function validateWorkshopDetailResolutionChoices(input: {
  draftDetails: Array<{ label: string }>;
  confirmation: {
    createMissingDetailTypes: boolean;
    detailCreations: Array<{ label: string }>;
    detailMappings: WorkshopCodexDraftDetailMapping[];
  };
}): void {
  const draftLabels = new Set(input.draftDetails.map((item) => normalizeCodexLookupName(item.label)));
  const mapped = new Set<string>();
  for (const mapping of input.confirmation.detailMappings) {
    const key = normalizeCodexLookupName(mapping.label);
    if (!draftLabels.has(key)) {
      throw new Error(`Detail mapping for "${mapping.label}" does not belong to this draft.`);
    }
    if (mapped.has(key)) {
      throw new Error(`Detail mapping for "${mapping.label}" is duplicated.`);
    }
    mapped.add(key);
  }
  const created = new Set<string>();
  for (const creation of input.confirmation.detailCreations) {
    const key = normalizeCodexLookupName(creation.label);
    if (!draftLabels.has(key)) {
      throw new Error(`Detail type creation for "${creation.label}" does not belong to this draft.`);
    }
    if (created.has(key)) {
      throw new Error(`Detail type creation for "${creation.label}" is duplicated.`);
    }
    if (mapped.has(key)) {
      throw new Error(`Detail "${creation.label}" cannot be mapped and created at the same time.`);
    }
    created.add(key);
  }
  if (created.size > 0 && !input.confirmation.createMissingDetailTypes) {
    throw new Error("Explicit detail type creations require createMissingDetailTypes=true.");
  }
}

async function plannedDetailTypeResolution(input: {
  categoryId: Parameters<typeof planWorkshopDetailSchema>[0]["categoryId"];
  error: WorkshopCodexDetailTypeCreationRequiredError;
  embeddingRouter: EmbeddingRouter;
  repository: ProjectRepository;
}) {
  const plan = await planWorkshopDetailSchema({
    categoryId: input.categoryId,
    missingDetailTypes: input.error.missingDetailTypes,
    availableDetailTypes: input.error.availableDetailTypes,
    embeddingRouter: input.embeddingRouter,
    repository: input.repository,
  });
  return WorkshopCodexCreateEntryToolErrorSchema.parse({
    code: input.error.code,
    message: input.error.message,
    missingDetailTypes: plan.missingDetailTypes,
    availableDetailTypes: input.error.availableDetailTypes,
    planner: plan.planner,
  });
}

export function registerWorkshopRoutes(
  app: FastifyInstance,
  repository: ProjectRepository,
  options: { providerRegistry: ProviderRegistry; embeddingRouter: EmbeddingRouter },
): void {
  const { embeddingRouter, providerRegistry } = options;
  const agentCoordinator = new WorkshopAgentCoordinator();
  registerWorkshopRecordRoutes(app, repository);

  async function continueToolResult(input: {
    seriesId: string;
    sessionId: string;
    result: { agentRun?: WorkshopAgentRunDocument | null; resultMessage: WorkshopMessage };
  }): Promise<{ continuationMessages: WorkshopMessage[]; agentRun: WorkshopAgentRunDocument | null }> {
    if (!input.result.agentRun) return { continuationMessages: [], agentRun: null };
    try {
      const contextBundle = await repository.getContextBundle(
        input.seriesId,
        input.result.agentRun.run.contextBundleId,
      );
      const baseProfile = await repository.getModelProfile(input.result.agentRun.run.modelProfileId);
      const modelProfile = effectiveModelProfile(baseProfile, input.result.agentRun.run.modelOverride);
      const continuation = await agentCoordinator.continueAfterToolResult({
        repository,
        providerRegistry,
        seriesId: input.seriesId,
        sessionId: input.sessionId,
        run: input.result.agentRun,
        resultMessage: input.result.resultMessage,
        contextBundle,
        providerContextBundle: workshopProviderContextBundle(contextBundle, "agent"),
        modelProfile,
        prepareUpdateDraft: (draft) => captureCodexUpdateDraftBaselines({
          draft,
          repository,
          seriesId: input.seriesId,
        }),
      });
      return {
        continuationMessages: [continuation.assistantMessage, ...continuation.toolMessages],
        agentRun: continuation.run,
      };
    } catch {
      const latestRun = await repository.getWorkshopAgentRun(
        input.seriesId,
        input.sessionId,
        input.result.agentRun.run.id,
      ).catch(() => input.result.agentRun!);
      return { continuationMessages: [], agentRun: latestRun };
    }
  }

  app.post<{ Params: { seriesId: string; sessionId: string; runId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions/:sessionId/agent-runs/:runId/retry",
    async (request, reply) => {
      const input = RetryWorkshopAgentRunInputSchema.parse(request.body);
      const run = await repository.getWorkshopAgentRun(
        request.params.seriesId,
        request.params.sessionId,
        request.params.runId,
      );
      if (run.revision !== input.baseRevision) {
        return reply.status(409).send({
          code: "CONFLICT",
          message: "The Agent run changed before retry.",
          currentRevision: run.revision,
        });
      }
      if (!run.run.retryable || !["failed", "interrupted"].includes(run.run.status)) {
        return reply.status(409).send({
          code: "AGENT_RUN_NOT_RETRYABLE",
          message: "This Agent run is not retryable.",
        });
      }
      const contextBundle = await repository.getContextBundle(request.params.seriesId, run.run.contextBundleId);
      const baseProfile = await repository.getModelProfile(run.run.modelProfileId);
      const modelProfile = effectiveModelProfile(baseProfile, run.run.modelOverride);
      const result = await agentCoordinator.retry({
        repository,
        providerRegistry,
        seriesId: request.params.seriesId,
        sessionId: request.params.sessionId,
        run,
        contextBundle,
        providerContextBundle: workshopProviderContextBundle(contextBundle, "agent"),
        modelProfile,
        prepareUpdateDraft: (draft) => captureCodexUpdateDraftBaselines({
          draft,
          repository,
          seriesId: request.params.seriesId,
        }),
      });
      return WorkshopAgentRunActionResultSchema.parse({
        agentRun: result.run,
        assistantMessage: result.assistantMessage,
        toolMessages: result.toolMessages,
        modelCallId: result.modelCall.id,
        responseText: result.responseText,
      });
    },
  );

  app.post<{ Params: { seriesId: string; sessionId: string; runId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions/:sessionId/agent-runs/:runId/abandon",
    async (request) => {
      const input = AbandonWorkshopAgentRunInputSchema.parse(request.body);
      return repository.abandonWorkshopAgentRun(
        request.params.seriesId,
        request.params.sessionId,
        request.params.runId,
        input.baseRevision,
        input.reason,
      );
    },
  );

  app.post<{ Params: { seriesId: string; sessionId: string; messageId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions/:sessionId/messages/:messageId/resend",
    async (request, reply) => {
      const input = ResendWorkshopMessageInputSchema.parse(request.body);
      const source = await repository.getWorkshopMessageSource(
        request.params.seriesId,
        request.params.messageId,
      );
      const replacement = await repository.replaceWorkshopGeneralChatAuthorMessage(
        request.params.seriesId,
        request.params.sessionId,
        request.params.messageId,
        input.content ?? source.message.content,
      );
      const callInput = RunWorkshopCallInputSchema.parse({
        mode: "general-chat",
        userRequest: replacement.message.content,
        roleId: input.roleId,
        taskKind: input.taskKind,
        promptTemplateId: input.promptTemplateId,
        promptTemplateVersion: input.promptTemplateVersion,
        modelProfileId: input.modelProfileId,
        modelOverride: input.modelOverride,
        tokenBudget: input.tokenBudget,
        attachmentIds: replacement.message.attachmentIds,
        draftToken: null,
        parameters: input.parameters,
      });
      const basket = await repository.getWorkshopContextBasket(
        request.params.seriesId,
        request.params.sessionId,
      );
      let contextBundle;
      try {
        contextBundle = await buildContextBundle(
          repository,
          providerRegistry,
          request.params.seriesId,
          await workshopContextPayload(repository, request.params.seriesId, basket, replacement.session, callInput, {
            excludeWorkshopMessageId: replacement.message.id,
          }),
        );
      } catch (error) {
        if (sendContextError(reply, error)) return reply;
        throw error;
      }
      const modelProfile = effectiveModelProfile(
        await repository.getModelProfile(callInput.modelProfileId),
        callInput.modelOverride,
      );
      const prompt = await workshopProviderPrompt(contextBundle, callInput.mode, replacement.session);
      const providerContextBundle = workshopProviderContextBundle(contextBundle, callInput.mode);
      const { log, responseText } = await executeWorkshopCall({
        repository,
        providerRegistry,
        seriesId: request.params.seriesId,
        sessionId: request.params.sessionId,
        contextBundle,
        providerContextBundle,
        modelProfile,
        prompt,
        parameters: callInput.parameters,
      });
      const { assistantMessage, toolMessages, responseText: finalResponseText } = await saveWorkshopAssistantTurn({
        seriesId: request.params.seriesId,
        sessionId: request.params.sessionId,
        mode: "general-chat",
        userRequest: replacement.message.content,
        log,
        contextBundle,
        responseText,
      });
      return ResendWorkshopMessageResultSchema.parse({
        authorMessage: replacement.message,
        assistantMessage,
        toolMessages,
        contextBundleId: contextBundle.id,
        modelCallId: log.id,
        status: assistantMessage.status,
        responseText: finalResponseText,
        estimatedUsage: log.estimatedUsage,
        actualUsage: log.actualUsage,
        deletedAttachmentIds: replacement.deletedAttachmentIds,
        deletedBranchIds: replacement.deletedBranchIds,
        deletedMessageIds: replacement.deletedMessageIds,
      });
    },
  );

  app.post<{ Params: { seriesId: string; sessionId: string; messageId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions/:sessionId/messages/:messageId/tools/codex.create_entry/execute",
    async (request, reply) => {
      const input = ExecuteWorkshopCodexCreateEntryToolInputSchema.parse(request.body);
      const source = await repository.getWorkshopMessageSource(
        request.params.seriesId,
        request.params.messageId,
      );
      if (source.session.id !== request.params.sessionId) {
        return reply.status(404).send({
          code: "NOT_FOUND",
          message: "Workshop message is not in this session",
        });
      }
      if (
        source.message.role !== "tool" ||
        source.message.mode !== "agent" ||
        source.session.kind !== "agent" ||
        source.message.status !== "succeeded" ||
        !source.message.content.trim()
      ) {
        return reply.status(400).send({
          code: "INVALID_DATA",
          message: "Only successful Agent tool request messages can execute codex.create_entry",
        });
      }
      if (source.session.status !== "active") {
        return reply.status(409).send({
          code: "WORKSHOP_SESSION_ARCHIVED",
          message: "Archived Workshop sessions cannot execute Agent tool requests.",
        });
      }
      const toolRequestHash = workshopToolRequestHash(source.message, input);
      const conflict = workshopToolConflict(source.message, toolRequestHash);
      if (conflict) {
        return reply.status(409).send(conflict);
      }
      let codexInput;
      let detailTypeCreations: WorkshopCodexDetailTypeCreationCommand[] = [];
      let missingDetailTypes: WorkshopCodexDraftMissingDetailType[] = [];
      let draft: WorkshopCodexCreateDraft | null = null;
      let detailTypes: CodexDetailTypeDocument[] = [];
      try {
        const toolRequest = parseCodexCreateEntryToolRequest(source.message.content);
        draft = toolRequest.draft;
        validateWorkshopDetailResolutionChoices({
          draftDetails: draft.details,
          confirmation: input,
        });
        detailTypes = await repository.listCodexDetailTypes(request.params.seriesId, {
          categoryId: draft.categoryId,
        });
        try {
          codexInput = codexCreateEntryInputFromWorkshopDraft(
            draft,
            detailTypes,
            input.detailMappings,
          );
          if (input.detailCreations.length > 0) {
            throw new Error("Detail type creation was requested for a label that already resolves.");
          }
        } catch (error) {
          if (!(error instanceof WorkshopCodexDetailTypeCreationRequiredError)) throw error;
          if (!input.createMissingDetailTypes) {
            return reply.status(409).send(await plannedDetailTypeResolution({
              categoryId: draft.categoryId,
              error,
              embeddingRouter,
              repository,
            }));
          }
          missingDetailTypes = error.missingDetailTypes;
        }
      } catch (error) {
        return reply.status(400).send({
          code: "INVALID_DATA",
          message: error instanceof Error ? error.message : "Codex Draft could not be parsed.",
        });
      }
      if (!draft) {
        return reply.status(400).send({
          code: "INVALID_DATA",
          message: "Codex Draft could not be parsed.",
        });
      }
      if (missingDetailTypes.length > 0) {
        try {
          const planned = planWorkshopDetailTypeCreations({
            categoryId: draft.categoryId,
            confirmation: input,
            missing: missingDetailTypes,
          });
          detailTypeCreations = planned.commands;
          codexInput = codexCreateEntryInputFromWorkshopDraft(
            draft,
            [...detailTypes, ...planned.documents],
            [...input.detailMappings, ...planned.mappings],
          );
        } catch (error) {
          return reply.status(400).send({
            code: "INVALID_DATA",
            message: error instanceof Error ? error.message : "Detail type creation could not be planned.",
          });
        }
      }
      const claim = await repository.claimWorkshopMessageToolExecution(
        request.params.seriesId,
        source.session.id,
        source.message.id,
        toolRequestHash,
      );
      if (claim.status === "archived") {
        return reply.status(409).send({
          code: "WORKSHOP_SESSION_ARCHIVED",
          message: "Archived Workshop sessions cannot execute Agent tool requests.",
        });
      }
      if (claim.status === "existing") {
        return reply.status(409).send(workshopToolConflict(claim.message, toolRequestHash) ?? {
          code: "WORKSHOP_TOOL_EXECUTION_CONFLICT",
          message: "This Workshop tool message already has an execution record.",
        });
      }
      try {
        if (!codexInput) {
          throw new Error("Codex Draft could not be applied.");
        }
        const result = await repository.executeWorkshopCodexCreateCommand(
          request.params.seriesId,
          {
            sessionId: source.session.id,
            messageId: source.message.id,
            requestHash: toolRequestHash,
            detailTypeCreations,
            entryInput: codexInput,
          },
        );
        const continuation = await continueToolResult({
          seriesId: request.params.seriesId,
          sessionId: source.session.id,
          result,
        });
        return reply.status(201).send(WorkshopCodexCreateEntryToolResultSchema.parse({
          ...result,
          ...continuation,
        }));
      } catch (error) {
        const messageText = error instanceof Error ? error.message : "Codex Draft could not be applied.";
        const isConflict = error instanceof Error && "code" in error && error.code === "CONFLICT";
        const failure = await repository.recordWorkshopCodexCommandFailure(request.params.seriesId, {
          sessionId: source.session.id,
          messageId: claim.message.id,
          requestHash: toolRequestHash,
          errorCode: isConflict ? "CONFLICT" : "INVALID_DATA",
          errorMessage: messageText,
        });
        const continuation = await continueToolResult({
          seriesId: request.params.seriesId,
          sessionId: source.session.id,
          result: failure,
        });
        return reply.status(isConflict ? 409 : 400).send({
          code: isConflict ? "CONFLICT" : "INVALID_DATA",
          message: messageText,
          resultMessage: failure.resultMessage,
          ...continuation,
        });
      }
    },
  );

  app.post<{ Params: { seriesId: string; sessionId: string; messageId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions/:sessionId/messages/:messageId/tools/codex.update_entry/execute",
    async (request, reply) => {
      const input = ExecuteWorkshopCodexUpdateEntryToolInputSchema.parse(request.body);
      const source = await repository.getWorkshopMessageSource(
        request.params.seriesId,
        request.params.messageId,
      );
      if (source.session.id !== request.params.sessionId) {
        return reply.status(404).send({
          code: "NOT_FOUND",
          message: "Workshop message is not in this session",
        });
      }
      if (
        source.message.role !== "tool" ||
        source.message.mode !== "agent" ||
        source.session.kind !== "agent" ||
        source.message.status !== "succeeded" ||
        !source.message.content.trim()
      ) {
        return reply.status(400).send({
          code: "INVALID_DATA",
          message: "Only successful Agent tool request messages can execute codex.update_entry",
        });
      }
      if (source.session.status !== "active") {
        return reply.status(409).send({
          code: "WORKSHOP_SESSION_ARCHIVED",
          message: "Archived Workshop sessions cannot execute Agent tool requests.",
        });
      }
      const toolRequestHash = workshopToolRequestHash(source.message, input);
      const conflict = workshopToolConflict(source.message, toolRequestHash);
      if (conflict) {
        return reply.status(409).send(conflict);
      }
      let codexInput;
      let entry: CodexEntryDocument | null = null;
      let detailTypeCreations: WorkshopCodexDetailTypeCreationCommand[] = [];
      let missingDetailTypes: WorkshopCodexDraftMissingDetailType[] = [];
      let detailTypes: CodexDetailTypeDocument[] = [];
      let progressionCommands: WorkshopCodexProgressionCommand[] = [];
      let toolRequest: CodexUpdateEntryToolRequest | null = null;
      try {
        toolRequest = parseCodexUpdateEntryToolRequest(source.message.content);
        if (!toolRequest.draft.baseline) {
          return reply.status(409).send({
            code: "WORKSHOP_TOOL_BASELINE_REQUIRED",
            message: "This Codex update request has no server-owned draft baseline and must be regenerated.",
          });
        }
        entry = await resolveCodexUpdateTarget({
          ...(toolRequest.draft.target.entryId ? { entryId: toolRequest.draft.target.entryId } : {}),
          ...(toolRequest.draft.target.name ? { name: toolRequest.draft.target.name } : {}),
          repository,
          seriesId: request.params.seriesId,
        });
        detailTypes = await repository.listCodexDetailTypes(request.params.seriesId, {
          categoryId: entry.metadata.categoryId,
        });
        validateWorkshopDetailResolutionChoices({
          draftDetails: [
            ...(toolRequest.draft.patch.details ?? []),
            ...new Set([
              ...Object.keys(entry.metadata.details),
              ...Object.keys(entry.metadata.detailAiContext),
            ]),
          ].map((detail) => typeof detail === "string" ? { label: detail } : detail),
          confirmation: input,
        });
        progressionCommands = progressionCommandsFromDraft(
          toolRequest.draft.patch.progressions ?? [],
          entry,
        );
        try {
          codexInput = codexUpdateEntryInputFromWorkshopDraft(
            entry,
            toolRequest.draft,
            detailTypes,
            input.detailMappings,
          );
          if (input.detailCreations.length > 0) {
            throw new Error("Detail type creation was requested for a label that already resolves.");
          }
        } catch (error) {
          if (!(error instanceof WorkshopCodexDetailTypeCreationRequiredError)) throw error;
          if (!input.createMissingDetailTypes) {
            return reply.status(409).send(await plannedDetailTypeResolution({
              categoryId: entry.metadata.categoryId,
              error,
              embeddingRouter,
              repository,
            }));
          }
          missingDetailTypes = error.missingDetailTypes;
        }
      } catch (error) {
        if (error instanceof CodexUpdateTargetResolutionError) {
          return reply.status(error.statusCode).send({
            code: error.code,
            message: error.message,
          });
        }
        return reply.status(400).send({
          code: "INVALID_DATA",
          message: error instanceof Error ? error.message : "Codex update draft could not be parsed.",
        });
      }
      if (!toolRequest || !entry) {
        return reply.status(400).send({
          code: "INVALID_DATA",
          message: "Codex update draft could not be parsed.",
        });
      }
      if (missingDetailTypes.length > 0) {
        try {
          const planned = planWorkshopDetailTypeCreations({
            categoryId: entry.metadata.categoryId,
            confirmation: input,
            missing: missingDetailTypes,
          });
          detailTypeCreations = planned.commands;
          codexInput = codexUpdateEntryInputFromWorkshopDraft(
            entry,
            toolRequest.draft,
            [...detailTypes, ...planned.documents],
            [...input.detailMappings, ...planned.mappings],
          );
        } catch (error) {
          return reply.status(400).send({
            code: "INVALID_DATA",
            message: error instanceof Error ? error.message : "Detail type creation could not be planned.",
          });
        }
      }
      const claim = await repository.claimWorkshopMessageToolExecution(
        request.params.seriesId,
        source.session.id,
        source.message.id,
        toolRequestHash,
      );
      if (claim.status === "archived") {
        return reply.status(409).send({
          code: "WORKSHOP_SESSION_ARCHIVED",
          message: "Archived Workshop sessions cannot execute Agent tool requests.",
        });
      }
      if (claim.status === "existing") {
        return reply.status(409).send(workshopToolConflict(claim.message, toolRequestHash) ?? {
          code: "WORKSHOP_TOOL_EXECUTION_CONFLICT",
          message: "This Workshop tool message already has an execution record.",
        });
      }
      try {
        if (!toolRequest.draft.baseline) {
          throw new Error("Codex update tool request is missing server-owned draft baselines.");
        }
        const result = await repository.executeWorkshopCodexUpdateCommand(
          request.params.seriesId,
          {
            sessionId: source.session.id,
            messageId: source.message.id,
            requestHash: toolRequestHash,
            entryId: entry.metadata.id,
            baseEntryRevision: toolRequest.draft.baseline.entryRevision,
            baseResearchRevision: toolRequest.draft.baseline.researchRevision,
            detailTypeCreations,
            entryInput: codexInput ?? null,
            progressions: progressionCommands,
          },
        );
        const continuation = await continueToolResult({
          seriesId: request.params.seriesId,
          sessionId: source.session.id,
          result,
        });
        return reply.status(201).send(WorkshopCodexUpdateEntryToolResultSchema.parse({
          ...result,
          ...continuation,
        }));
      } catch (error) {
        const messageText = error instanceof Error ? error.message : "Codex update command could not be applied.";
        const isConflict = error instanceof Error && "code" in error && error.code === "CONFLICT";
        const failure = await repository.recordWorkshopCodexCommandFailure(request.params.seriesId, {
          sessionId: source.session.id,
          messageId: claim.message.id,
          requestHash: toolRequestHash,
          errorCode: isConflict ? "CONFLICT" : "INVALID_DATA",
          errorMessage: messageText,
        });
        const continuation = await continueToolResult({
          seriesId: request.params.seriesId,
          sessionId: source.session.id,
          result: failure,
        });
        return reply.status(isConflict ? 409 : 400).send({
          code: isConflict ? "CONFLICT" : "INVALID_DATA",
          message: messageText,
          resultMessage: failure.resultMessage,
          ...continuation,
        });
      }
    },
  );

  app.post<{ Params: { seriesId: string; sessionId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions/:sessionId/branch",
    async (request, reply) => {
      const input = CreateWorkshopBranchInputSchema.parse(request.body);
      return reply.status(201).send(
        await repository.branchWorkshopSession(
          request.params.seriesId,
          request.params.sessionId,
          input,
        ),
      );
    },
  );

  app.get<{ Params: { seriesId: string; sessionId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions/:sessionId/context-basket",
    async (request) =>
      repository.getWorkshopContextBasket(request.params.seriesId, request.params.sessionId),
  );

  app.put<{ Params: { seriesId: string; sessionId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions/:sessionId/context-basket",
    async (request) => {
      const input = UpdateWorkshopContextBasketInputSchema.parse(request.body);
      return repository.updateWorkshopContextBasket(
        request.params.seriesId,
        request.params.sessionId,
        input,
      );
    },
  );

  async function saveWorkshopAssistantTurn(input: {
    seriesId: string;
    sessionId: string;
    mode: string;
    userRequest: string;
    log: ModelCallLog;
    contextBundle: ContextBundle;
    responseText: string;
    visibleText?: string;
    reasoningText?: string;
  }): Promise<{ assistantMessage: WorkshopMessage; toolMessages: WorkshopMessage[]; responseText: string }> {
    const parsedResponse = splitReasoningContent(input.responseText);
    const rawAssistantContent =
      input.visibleText ||
      parsedResponse.content ||
      input.log.errorMessage ||
      "Model call failed.";
    let assistantContent = rawAssistantContent;
    let responseText = parsedResponse.content || input.visibleText || "";

    const assistantMessage = await repository.saveWorkshopMessage(
      input.seriesId,
      WorkshopMessageSchema.parse({
        schemaVersion: 1,
        id: randomUUID(),
        seriesId: input.seriesId,
        sessionId: input.sessionId,
        role: "assistant",
        mode: input.mode,
        status: input.log.status === "succeeded" ? "succeeded" : "failed",
        content: assistantContent || input.log.errorMessage || "Model call failed.",
        reasoningContent: input.reasoningText || parsedResponse.reasoningContent,
        contextBundleId: input.contextBundle.id,
        modelCallId: input.log.id,
        proposalIds: [],
        attachmentIds: [],
        errorCode: input.log.errorCode,
        errorMessage: input.log.errorMessage,
        createdAt: new Date().toISOString(),
      }),
    );
    return { assistantMessage, toolMessages: [], responseText };
  }


  app.post<{ Params: { seriesId: string; sessionId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions/:sessionId/context-preview",
    async (request, reply) => {
      try {
        const input = WorkshopContextPreviewInputSchema.parse(request.body);
        const basket = await repository.getWorkshopContextBasket(
          request.params.seriesId,
          request.params.sessionId,
        );
        const session = await repository.getWorkshopSession(
          request.params.seriesId,
          request.params.sessionId,
        );
        return await buildContextBundle(
          repository,
          providerRegistry,
          request.params.seriesId,
          await workshopContextPayload(repository, request.params.seriesId, basket, session, input),
        );
      } catch (error) {
        if (sendContextError(reply, error)) return reply;
        throw error;
      }
    },
  );

  app.post<{ Params: { seriesId: string; sessionId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions/:sessionId/calls/stream",
    async (request, reply) => {
      const input = RunWorkshopCallInputSchema.parse(request.body);
      const session = await repository.getWorkshopSession(
        request.params.seriesId,
        request.params.sessionId,
      );
      assertWorkshopSessionMode(session, input.mode);
      const authorMessage = await repository.createWorkshopMessage(
        request.params.seriesId,
        request.params.sessionId,
        {
          role: "author",
          mode: input.mode,
          content: input.userRequest,
          attachmentIds: input.attachmentIds,
          draftToken: input.draftToken,
        },
      );
      let contextBundle;
      try {
        const basket = await repository.getWorkshopContextBasket(
          request.params.seriesId,
          request.params.sessionId,
        );
        contextBundle = await buildContextBundle(
          repository,
          providerRegistry,
          request.params.seriesId,
          await workshopContextPayload(repository, request.params.seriesId, basket, session, input, {
            excludeWorkshopMessageId: authorMessage.id,
          }),
        );
      } catch (error) {
        if (sendContextError(reply, error)) return reply;
        throw error;
      }
      const modelProfile = effectiveModelProfile(
        await repository.getModelProfile(input.modelProfileId),
        input.modelOverride,
      );
      const prompt = await workshopProviderPrompt(contextBundle, input.mode, session);
      const providerContextBundle = workshopProviderContextBundle(contextBundle, input.mode);

      reply.hijack();
      reply.raw.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      });

      const abortController = new AbortController();
      request.raw.on("close", () => abortController.abort());
      let metadataSent = false;
      let visibleText = "";
      let reasoningText = "";
      const suppressRawAgentStream = input.mode === "agent";
      const parser = createReasoningParser();
      writeWorkshopEvent(reply, { type: "author-message", message: authorMessage });

      if (input.mode === "agent") {
        const agent = await agentCoordinator.start({
          repository,
          providerRegistry,
          seriesId: request.params.seriesId,
          sessionId: request.params.sessionId,
          authorMessage,
          contextBundle,
          providerContextBundle,
          modelProfile,
          parameters: input.parameters,
          prompt,
          prepareUpdateDraft: (draft) => captureCodexUpdateDraftBaselines({
            draft,
            repository,
            seriesId: request.params.seriesId,
          }),
        });
        writeWorkshopEvent(reply, {
          type: "metadata",
          contextBundleId: contextBundle.id,
          modelCallId: agent.modelCall.id,
        });
        const result = WorkshopCallResultSchema.parse({
          authorMessage,
          assistantMessage: agent.assistantMessage,
          toolMessages: agent.toolMessages,
          contextBundleId: contextBundle.id,
          modelCallId: agent.modelCall.id,
          status: agent.assistantMessage.status,
          responseText: agent.responseText,
          estimatedUsage: agent.modelCall.estimatedUsage,
          actualUsage: agent.modelCall.actualUsage,
          agentRun: agent.run,
        });
        writeWorkshopEvent(reply, { type: "assistant-message", message: agent.assistantMessage });
        if (agent.assistantMessage.status === "failed") {
          writeWorkshopEvent(reply, {
            type: "error",
            code: agent.assistantMessage.errorCode,
            message: agent.assistantMessage.errorMessage ?? agent.assistantMessage.content,
            assistantMessage: agent.assistantMessage,
          });
        }
        writeWorkshopEvent(reply, { type: "done", result });
        reply.raw.end();
        return reply;
      }

      let { log, responseText } = await executeWorkshopCall({
        repository,
        providerRegistry,
        seriesId: request.params.seriesId,
        sessionId: request.params.sessionId,
        contextBundle,
        providerContextBundle,
        modelProfile,
        prompt,
        parameters: input.parameters,
        abortSignal: abortController.signal,
        onStreamingLog: (streamingLog) => {
          metadataSent = true;
          writeWorkshopEvent(reply, {
            type: "metadata",
            contextBundleId: contextBundle.id,
            modelCallId: streamingLog.id,
          });
        },
        onChunk: (chunk) => {
          for (const event of parser.push(chunk)) {
            if (event.type === "reasoning-delta") {
              reasoningText += event.text;
              if (!suppressRawAgentStream) writeWorkshopEvent(reply, event);
            } else {
              visibleText += event.text;
              if (!suppressRawAgentStream) writeWorkshopEvent(reply, event);
            }
          }
        },
      });

      for (const event of parser.finish()) {
        if (event.type === "reasoning-delta") {
          reasoningText += event.text;
          if (!suppressRawAgentStream) writeWorkshopEvent(reply, event);
        } else {
          visibleText += event.text;
          if (!suppressRawAgentStream) writeWorkshopEvent(reply, event);
        }
      }
      if (!metadataSent) {
        writeWorkshopEvent(reply, {
          type: "metadata",
          contextBundleId: contextBundle.id,
          modelCallId: log.id,
        });
      }

      const { assistantMessage, toolMessages, responseText: finalResponseText } = await saveWorkshopAssistantTurn({
        seriesId: request.params.seriesId,
        sessionId: request.params.sessionId,
        mode: input.mode,
        userRequest: input.userRequest,
        log,
        contextBundle,
        responseText,
        visibleText,
        reasoningText,
      });
      const result = WorkshopCallResultSchema.parse({
        authorMessage,
        assistantMessage,
        toolMessages,
        contextBundleId: contextBundle.id,
        modelCallId: log.id,
        status: assistantMessage.status,
        responseText: finalResponseText,
        estimatedUsage: log.estimatedUsage,
        actualUsage: log.actualUsage,
      });
      writeWorkshopEvent(reply, { type: "assistant-message", message: assistantMessage });
      if (assistantMessage.status === "failed") {
        writeWorkshopEvent(reply, {
          type: "error",
          code: assistantMessage.errorCode,
          message: assistantMessage.errorMessage ?? assistantMessage.content,
          assistantMessage,
        });
      }
      writeWorkshopEvent(reply, { type: "done", result });
      reply.raw.end();
      return reply;
    },
  );

  app.post<{ Params: { seriesId: string; sessionId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions/:sessionId/calls",
    async (request, reply) => {
      const input = RunWorkshopCallInputSchema.parse(request.body);
      const session = await repository.getWorkshopSession(
        request.params.seriesId,
        request.params.sessionId,
      );
      assertWorkshopSessionMode(session, input.mode);
      const authorMessage = await repository.createWorkshopMessage(
        request.params.seriesId,
        request.params.sessionId,
        {
          role: "author",
          mode: input.mode,
          content: input.userRequest,
          attachmentIds: input.attachmentIds,
          draftToken: input.draftToken,
        },
      );
      let contextBundle;
      try {
        const basket = await repository.getWorkshopContextBasket(
          request.params.seriesId,
          request.params.sessionId,
        );
        contextBundle = await buildContextBundle(
          repository,
          providerRegistry,
          request.params.seriesId,
          await workshopContextPayload(repository, request.params.seriesId, basket, session, input, {
            excludeWorkshopMessageId: authorMessage.id,
          }),
        );
      } catch (error) {
        if (sendContextError(reply, error)) return reply;
        throw error;
      }
      const modelProfile = effectiveModelProfile(
        await repository.getModelProfile(input.modelProfileId),
        input.modelOverride,
      );
      const prompt = await workshopProviderPrompt(contextBundle, input.mode, session);
      const providerContextBundle = workshopProviderContextBundle(contextBundle, input.mode);
      if (input.mode === "agent") {
        const agent = await agentCoordinator.start({
          repository,
          providerRegistry,
          seriesId: request.params.seriesId,
          sessionId: request.params.sessionId,
          authorMessage,
          contextBundle,
          providerContextBundle,
          modelProfile,
          parameters: input.parameters,
          prompt,
          prepareUpdateDraft: (draft) => captureCodexUpdateDraftBaselines({
            draft,
            repository,
            seriesId: request.params.seriesId,
          }),
        });
        return WorkshopCallResultSchema.parse({
          authorMessage,
          assistantMessage: agent.assistantMessage,
          toolMessages: agent.toolMessages,
          contextBundleId: contextBundle.id,
          modelCallId: agent.modelCall.id,
          status: agent.assistantMessage.status,
          responseText: agent.responseText,
          estimatedUsage: agent.modelCall.estimatedUsage,
          actualUsage: agent.modelCall.actualUsage,
          agentRun: agent.run,
        });
      }
      let { log, responseText } = await executeWorkshopCall({
        repository,
        providerRegistry,
        seriesId: request.params.seriesId,
        sessionId: request.params.sessionId,
        contextBundle,
        providerContextBundle,
        modelProfile,
        prompt,
        parameters: input.parameters,
      });
      const { assistantMessage, toolMessages, responseText: finalResponseText } = await saveWorkshopAssistantTurn({
        seriesId: request.params.seriesId,
        sessionId: request.params.sessionId,
        mode: input.mode,
        userRequest: input.userRequest,
        log,
        contextBundle,
        responseText,
      });
      return WorkshopCallResultSchema.parse({
        authorMessage,
        assistantMessage,
        toolMessages,
        contextBundleId: contextBundle.id,
        modelCallId: log.id,
        status: assistantMessage.status,
        responseText: finalResponseText,
        estimatedUsage: log.estimatedUsage,
        actualUsage: log.actualUsage,
      });
    },
  );
}
