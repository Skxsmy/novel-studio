import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  CreateWorkshopBranchInputSchema,
  CreateWorkshopMessageProposalInputSchema,
  CreateWorkshopMessageInputSchema,
  CreateWorkshopSessionInputSchema,
  ContextBundleSchema,
  ExecuteWorkshopCodexCreateEntryToolInputSchema,
  ExecuteWorkshopCodexUpdateEntryToolInputSchema,
  WorkshopCodexCreateEntryToolErrorSchema,
  WorkshopCodexCreateEntryToolResultSchema,
  WorkshopCodexUpdateEntryToolResultSchema,
  DeleteWorkshopAttachmentResultSchema,
  DeleteWorkshopSessionResultSchema,
  ExportWorkshopSessionQuerySchema,
  ListWorkshopAttachmentsQuerySchema,
  ModelCallLogSchema,
  ResendWorkshopMessageInputSchema,
  ResendWorkshopMessageResultSchema,
  RunWorkshopCallInputSchema,
  UpdateWorkshopContextBasketInputSchema,
  UpdateWorkshopSessionInputSchema,
  UploadWorkshopAttachmentInputSchema,
  WorkshopCallResultSchema,
  WorkshopCallStreamEventSchema,
  WorkshopContextPreviewInputSchema,
  WorkshopMessageAttachmentSchema,
  WorkshopMessageSchema,
  CreateCodexProgressionInputSchema,
  UpdateCodexProgressionInputSchema,
  DeleteCodexDocumentInputSchema,
  type CodexDetailTypeDocument,
  type CodexEntryDocument,
  type CodexProgressionDocument,
  type ContextBundle,
  type DeleteCodexProgressionResult,
  type ModelCallError,
  type ModelCallLog,
  type ModelParameters,
  type ModelProfile,
  type TokenUsage,
  type WorkshopContextBasket,
  type WorkshopCallStreamEvent,
  type WorkshopCodexDraftDetailMapping,
  type WorkshopCodexDraftMissingDetailType,
  type WorkshopMessage,
} from "@novel-studio/contracts";
import type { ProviderPrompt, ProviderRegistry } from "@novel-studio/ai";
import type { ProjectRepository } from "@novel-studio/storage";
import {
  ensureCredentialBoundary,
  modelError,
} from "../ai/policy.js";
import { PromptRenderError } from "../prompts/render.js";
import { buildContextBundle } from "./context.js";
import { contextPrompt, requestHash, usage } from "./modelCalls.js";
import { parseWorkshopAttachmentUpload } from "./workshopAttachments.js";
import {
  codexCreateEntryInputFromWorkshopDraft,
  codexUpdateEntryInputFromWorkshopDraft,
  parseCodexCreateEntryToolRequest,
  parseCodexUpdateEntryToolRequest,
  renderWorkshopCodexCreateDraft,
  renderWorkshopCodexUpdateDraft,
  serializeCodexCreateEntryToolRequest,
  serializeCodexUpdateEntryToolRequest,
  type CodexUpdateEntryToolRequest,
  type WorkshopCodexCreateDraft,
  type WorkshopCodexProgressionDraft,
  type WorkshopCodexUpdateDraft,
  WorkshopCodexDetailTypeCreationRequiredError,
} from "../workshop/codexDraft.js";
import { exportWorkshopSessionMarkdown } from "../workshop/sessionExport.js";
import { applyWorkshopAgentPrompt, parseWorkshopAgentStep, type WorkshopAgentStep } from "../workshop/workshopAgent.js";
import {
  workshopPromptDefinition,
  workshopProviderPrompt as workshopModeProviderPrompt,
} from "../workshop/workshopPrompts.js";

function hashText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

const OPEN_REASONING_TAGS = ["<think>", "<thinking>"];
const CLOSE_REASONING_TAGS = ["</think>", "</thinking>"];

interface ParsedReasoningContent {
  content: string;
  reasoningContent: string;
}

interface ReasoningDelta {
  type: "delta" | "reasoning-delta";
  text: string;
}

function findFirstTag(buffer: string, tags: string[]): { index: number; tag: string } | null {
  const lower = buffer.toLocaleLowerCase("und");
  let found: { index: number; tag: string } | null = null;
  for (const tag of tags) {
    const index = lower.indexOf(tag);
    if (index === -1) continue;
    if (!found || index < found.index) {
      found = { index, tag };
    }
  }
  return found;
}

function suffixPrefixLength(buffer: string, tags: string[]): number {
  const lower = buffer.toLocaleLowerCase("und");
  const maxLength = Math.min(
    lower.length,
    Math.max(...tags.map((tag) => tag.length)) - 1,
  );
  for (let length = maxLength; length > 0; length -= 1) {
    const suffix = lower.slice(-length);
    if (tags.some((tag) => tag.startsWith(suffix))) return length;
  }
  return 0;
}

function createReasoningParser() {
  let buffer = "";
  let inReasoning = false;

  function drain(): ReasoningDelta[] {
    const events: ReasoningDelta[] = [];
    while (buffer.length > 0) {
      if (!inReasoning) {
        const tag = findFirstTag(buffer, OPEN_REASONING_TAGS);
        if (tag) {
          if (tag.index > 0) {
            events.push({ type: "delta", text: buffer.slice(0, tag.index) });
          }
          buffer = buffer.slice(tag.index + tag.tag.length);
          inReasoning = true;
          continue;
        }
        const holdLength = suffixPrefixLength(buffer, OPEN_REASONING_TAGS);
        const visible = buffer.slice(0, buffer.length - holdLength);
        if (visible) events.push({ type: "delta", text: visible });
        buffer = buffer.slice(buffer.length - holdLength);
        break;
      }

      const tag = findFirstTag(buffer, CLOSE_REASONING_TAGS);
      if (tag) {
        if (tag.index > 0) {
          events.push({ type: "reasoning-delta", text: buffer.slice(0, tag.index) });
        }
        buffer = buffer.slice(tag.index + tag.tag.length);
        inReasoning = false;
        continue;
      }
      const holdLength = suffixPrefixLength(buffer, CLOSE_REASONING_TAGS);
      const reasoning = buffer.slice(0, buffer.length - holdLength);
      if (reasoning) events.push({ type: "reasoning-delta", text: reasoning });
      buffer = buffer.slice(buffer.length - holdLength);
      break;
    }
    return events;
  }

  return {
    push(chunk: string): ReasoningDelta[] {
      buffer += chunk;
      return drain();
    },
    finish(): ReasoningDelta[] {
      const leftover = buffer;
      buffer = "";
      return leftover ? [{ type: inReasoning ? "reasoning-delta" : "delta", text: leftover }] : [];
    },
  };
}

function splitReasoningContent(raw: string): ParsedReasoningContent {
  const parser = createReasoningParser();
  let content = "";
  let reasoningContent = "";
  for (const event of [...parser.push(raw), ...parser.finish()]) {
    if (event.type === "reasoning-delta") {
      reasoningContent += event.text;
    } else {
      content += event.text;
    }
  }
  return { content, reasoningContent };
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
    if (item.kind === "scene-section") return [`section:${item.sourceId}`];
    return [];
  });
}

async function workshopContextPayload(
  repository: ProjectRepository,
  seriesId: string,
  basket: WorkshopContextBasket,
  input: ReturnType<typeof WorkshopContextPreviewInputSchema.parse>,
  options: { excludeWorkshopMessageId?: string | null } = {},
): Promise<Record<string, unknown>> {
  const workshopPrompt = workshopPromptDefinition(input.mode);
  const promptInstruction = workshopPrompt
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
    systemPromptOverride: input.mode === "general-chat" ? input.systemPrompt : promptInstruction,
    modelProfileId: input.modelProfileId,
    tokenBudget: input.tokenBudget,
    attachmentIds: input.attachmentIds,
    draftToken: input.draftToken,
    workshopSessionId: basket.sessionId,
    excludeWorkshopMessageId: options.excludeWorkshopMessageId ?? null,
    includePendingWorkshopCodexDraft: input.mode === "agent",
  };
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
  input: ReturnType<typeof RunWorkshopCallInputSchema.parse>,
): Promise<ProviderPrompt> {
  if (input.mode === "agent") {
    return applyWorkshopAgentPrompt(workshopModeProviderPrompt({
      mode: "agent",
      userRequest: contextBundle.userRequest,
    }));
  }
  if (input.mode === "general-chat") {
    return workshopModeProviderPrompt({
      mode: "general-chat",
      userRequest: contextBundle.userRequest,
      generalChatSystemPrompt: input.systemPrompt,
    });
  }
  return contextPrompt(contextBundle);
}

function workshopProviderContextBundle(
  contextBundle: ContextBundle,
  input: ReturnType<typeof RunWorkshopCallInputSchema.parse>,
): ContextBundle {
  if (!shouldFilterPromptContext(input.mode)) return contextBundle;
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

function codexProgressionUpdateInputFromDraft(
  draft: Extract<WorkshopCodexProgressionDraft, { action: "update" }>,
) {
  return UpdateCodexProgressionInputSchema.parse(draft.input);
}

function codexProgressionDeleteInputFromDraft(
  draft: Extract<WorkshopCodexProgressionDraft, { action: "delete" }>,
) {
  return DeleteCodexDocumentInputSchema.parse(draft.input);
}

async function executeCodexProgressionDrafts(input: {
  drafts: WorkshopCodexProgressionDraft[];
  entry: CodexEntryDocument;
  repository: ProjectRepository;
  seriesId: string;
}): Promise<{
  createdProgressions: CodexProgressionDocument[];
  deletedProgressions: DeleteCodexProgressionResult[];
  updatedProgressions: CodexProgressionDocument[];
}> {
  const createdProgressions: CodexProgressionDocument[] = [];
  const updatedProgressions: CodexProgressionDocument[] = [];
  const deletedProgressions: DeleteCodexProgressionResult[] = [];
  for (const draft of input.drafts) {
    if (draft.action === "create") {
      createdProgressions.push(await input.repository.createCodexProgression(
        input.seriesId,
        codexProgressionCreateInputFromDraft(draft, input.entry),
      ));
    } else if (draft.action === "update") {
      updatedProgressions.push(await input.repository.updateCodexProgression(
        input.seriesId,
        draft.progressionId,
        codexProgressionUpdateInputFromDraft(draft),
      ));
    } else {
      deletedProgressions.push(await input.repository.deleteCodexProgression(
        input.seriesId,
        draft.progressionId,
        codexProgressionDeleteInputFromDraft(draft),
      ));
    }
  }
  return { createdProgressions, deletedProgressions, updatedProgressions };
}

export function registerWorkshopRoutes(
  app: FastifyInstance,
  repository: ProjectRepository,
  options: { providerRegistry: ProviderRegistry },
): void {
  const { providerRegistry } = options;

  app.get<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions",
    async (request) => repository.listWorkshopSessions(request.params.seriesId),
  );

  app.post<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions",
    async (request, reply) => {
      const input = CreateWorkshopSessionInputSchema.parse(request.body ?? {});
      return reply.status(201).send(await repository.createWorkshopSession(request.params.seriesId, input));
    },
  );

  app.get<{ Params: { seriesId: string; sessionId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions/:sessionId",
    async (request) => {
      const [session, basket, messages, attachments] = await Promise.all([
        repository.getWorkshopSession(request.params.seriesId, request.params.sessionId),
        repository.getWorkshopContextBasket(request.params.seriesId, request.params.sessionId),
        repository.listWorkshopMessages(request.params.seriesId, request.params.sessionId),
        repository.listWorkshopAttachments(request.params.seriesId, request.params.sessionId),
      ]);
      return { session, basket, messages, attachments };
    },
  );

  app.get<{ Params: { seriesId: string; sessionId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions/:sessionId/export",
    async (request, reply) => {
      const query = ExportWorkshopSessionQuerySchema.parse(request.query ?? {});
      const markdown = await exportWorkshopSessionMarkdown(
        repository,
        request.params.seriesId,
        request.params.sessionId,
        {
          includePromptAudit: query.includePromptAudit,
          includeReasoning: query.includeReasoning,
        },
      );
      return reply
        .header("content-type", "text/markdown; charset=utf-8")
        .header("content-disposition", `attachment; filename="workshop-${request.params.sessionId}.md"`)
        .send(`\uFEFF${markdown}`);
    },
  );

  app.put<{ Params: { seriesId: string; sessionId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions/:sessionId",
    async (request) => {
      const input = UpdateWorkshopSessionInputSchema.parse(request.body);
      return repository.updateWorkshopSession(request.params.seriesId, request.params.sessionId, input);
    },
  );

  app.delete<{ Params: { seriesId: string; sessionId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions/:sessionId",
    async (request) => DeleteWorkshopSessionResultSchema.parse(
      await repository.deleteWorkshopSession(request.params.seriesId, request.params.sessionId),
    ),
  );

  app.post<{ Params: { seriesId: string; sessionId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions/:sessionId/archive",
    async (request) =>
      repository.archiveWorkshopSession(request.params.seriesId, request.params.sessionId),
  );

  app.post<{ Params: { seriesId: string; sessionId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions/:sessionId/restore",
    async (request) =>
      repository.restoreWorkshopSession(request.params.seriesId, request.params.sessionId),
  );

  app.get<{ Params: { seriesId: string; sessionId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions/:sessionId/messages",
    async (request) =>
      repository.listWorkshopMessages(request.params.seriesId, request.params.sessionId),
  );

  app.get<{ Params: { seriesId: string; sessionId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions/:sessionId/attachments",
    async (request) => {
      const query = ListWorkshopAttachmentsQuerySchema.parse(request.query ?? {});
      return repository.listWorkshopAttachments(
        request.params.seriesId,
        request.params.sessionId,
        query.draftToken ? { draftToken: query.draftToken } : {},
      );
    },
  );

  app.post<{ Params: { seriesId: string; sessionId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions/:sessionId/attachments",
    async (request, reply) => {
      const input = UploadWorkshopAttachmentInputSchema.parse(request.body);
      const parseResult = await parseWorkshopAttachmentUpload(input);
      const now = new Date().toISOString();
      const attachment = WorkshopMessageAttachmentSchema.parse({
        schemaVersion: 1,
        id: randomUUID(),
        seriesId: request.params.seriesId,
        sessionId: request.params.sessionId,
        messageId: null,
        draftToken: input.draftToken,
        fileName: input.fileName,
        mediaType: input.mediaType,
        sizeBytes: input.sizeBytes,
        ...parseResult,
        createdAt: now,
        updatedAt: now,
      });
      return reply.status(201).send(
        await repository.createWorkshopAttachment(
          request.params.seriesId,
          request.params.sessionId,
          attachment,
        ),
      );
    },
  );

  app.delete<{ Params: { seriesId: string; sessionId: string; attachmentId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions/:sessionId/attachments/:attachmentId",
    async (request) => DeleteWorkshopAttachmentResultSchema.parse(
      await repository.deleteWorkshopAttachment(
        request.params.seriesId,
        request.params.sessionId,
        request.params.attachmentId,
      ),
    ),
  );

  app.get<{ Params: { seriesId: string; messageId: string } }>(
    "/api/v1/series/:seriesId/workshop/messages/:messageId/source",
    async (request) =>
      repository.getWorkshopMessageSource(request.params.seriesId, request.params.messageId),
  );

  app.post<{ Params: { seriesId: string; sessionId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions/:sessionId/messages",
    async (request, reply) => {
      const input = CreateWorkshopMessageInputSchema.parse(request.body);
      return reply.status(201).send(
        await repository.createWorkshopMessage(
          request.params.seriesId,
          request.params.sessionId,
          input,
        ),
      );
    },
  );

  app.delete<{ Params: { seriesId: string; sessionId: string; messageId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions/:sessionId/messages/:messageId",
    async (request) =>
      repository.deleteWorkshopMessage(
        request.params.seriesId,
        request.params.sessionId,
        request.params.messageId,
      ),
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
        systemPrompt: input.systemPrompt,
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
          await workshopContextPayload(repository, request.params.seriesId, basket, callInput, {
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
      const prompt = await workshopProviderPrompt(contextBundle, callInput);
      const providerContextBundle = workshopProviderContextBundle(contextBundle, callInput);
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
    "/api/v1/series/:seriesId/workshop/sessions/:sessionId/messages/:messageId/proposals",
    async (request, reply) => {
      const input = CreateWorkshopMessageProposalInputSchema.parse(request.body);
      return reply.status(201).send(
        await repository.createProposalFromWorkshopMessage(
          request.params.seriesId,
          request.params.sessionId,
          request.params.messageId,
          input,
        ),
      );
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
      let codexInput;
      let createdDetailTypes: CodexDetailTypeDocument[] = [];
      try {
        const toolRequest = parseCodexCreateEntryToolRequest(source.message.content);
        const draft = toolRequest.draft;
        const detailTypes = await repository.listCodexDetailTypes(request.params.seriesId, {
          categoryId: draft.categoryId,
        });
        try {
          codexInput = codexCreateEntryInputFromWorkshopDraft(
            draft,
            detailTypes,
            input.detailMappings,
          );
        } catch (error) {
          if (!(error instanceof WorkshopCodexDetailTypeCreationRequiredError)) throw error;
          if (!input.createMissingDetailTypes) {
            return reply.status(409).send(
              WorkshopCodexCreateEntryToolErrorSchema.parse({
                code: error.code,
                message: error.message,
                missingDetailTypes: error.missingDetailTypes,
                availableDetailTypes: error.availableDetailTypes,
              }),
            );
          }
          createdDetailTypes = [];
          for (const missingDetailType of error.missingDetailTypes) {
            createdDetailTypes.push(
              await repository.createCodexDetailType(request.params.seriesId, {
                categoryId: draft.categoryId,
                name: missingDetailType.label,
                nsfw: false,
              }),
            );
          }
          codexInput = codexCreateEntryInputFromWorkshopDraft(
            draft,
            [...detailTypes, ...createdDetailTypes],
            input.detailMappings,
          );
        }
      } catch (error) {
        return reply.status(400).send({
          code: "INVALID_DATA",
          message: error instanceof Error ? error.message : "Codex Draft could not be parsed.",
        });
      }
      const entry = await repository.createCodexEntry(request.params.seriesId, codexInput);
      const resultMessage = await repository.saveWorkshopMessage(
        request.params.seriesId,
        WorkshopMessageSchema.parse({
          schemaVersion: 1,
          id: randomUUID(),
          seriesId: request.params.seriesId,
          sessionId: source.session.id,
          role: "result",
          mode: "agent",
          status: "succeeded",
          content: `codex.create_entry created Codex entry: ${entry.metadata.name}`,
          reasoningContent: "",
          contextBundleId: source.message.contextBundleId,
          modelCallId: source.message.modelCallId,
          proposalIds: [],
          attachmentIds: [],
          errorCode: null,
          errorMessage: null,
          createdAt: new Date().toISOString(),
        }),
      );
      return reply.status(201).send(
        WorkshopCodexCreateEntryToolResultSchema.parse({
          createdDetailTypes,
          message: source.message,
          resultMessage,
          entry,
        }),
      );
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
      let codexInput;
      let entry: CodexEntryDocument | null = null;
      let createdDetailTypes: CodexDetailTypeDocument[] = [];
      let createdProgressions: CodexProgressionDocument[] = [];
      let updatedProgressions: CodexProgressionDocument[] = [];
      let deletedProgressions: DeleteCodexProgressionResult[] = [];
      let toolRequest: CodexUpdateEntryToolRequest | null = null;
      try {
        toolRequest = parseCodexUpdateEntryToolRequest(source.message.content);
        entry = await resolveCodexUpdateTarget({
          ...(toolRequest.draft.target.entryId ? { entryId: toolRequest.draft.target.entryId } : {}),
          ...(toolRequest.draft.target.name ? { name: toolRequest.draft.target.name } : {}),
          repository,
          seriesId: request.params.seriesId,
        });
        const detailTypes = await repository.listCodexDetailTypes(request.params.seriesId, {
          categoryId: entry.metadata.categoryId,
        });
        try {
          codexInput = codexUpdateEntryInputFromWorkshopDraft(
            entry,
            toolRequest.draft,
            detailTypes,
            input.detailMappings,
          );
        } catch (error) {
          if (!(error instanceof WorkshopCodexDetailTypeCreationRequiredError)) throw error;
          if (!input.createMissingDetailTypes) {
            return reply.status(409).send(
              WorkshopCodexCreateEntryToolErrorSchema.parse({
                code: error.code,
                message: error.message,
                missingDetailTypes: error.missingDetailTypes,
                availableDetailTypes: error.availableDetailTypes,
              }),
            );
          }
          createdDetailTypes = [];
          for (const missingDetailType of error.missingDetailTypes) {
            createdDetailTypes.push(
              await repository.createCodexDetailType(request.params.seriesId, {
                categoryId: entry.metadata.categoryId,
                name: missingDetailType.label,
                nsfw: false,
              }),
            );
          }
          codexInput = codexUpdateEntryInputFromWorkshopDraft(
            entry,
            toolRequest.draft,
            [...detailTypes, ...createdDetailTypes],
            input.detailMappings,
          );
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
      let updatedEntry = entry;
      try {
        if (codexInput) {
          updatedEntry = await repository.updateCodexEntry(request.params.seriesId, entry.metadata.id, codexInput);
        }
        const progressionResult = await executeCodexProgressionDrafts({
          drafts: toolRequest.draft.patch.progressions ?? [],
          entry,
          repository,
          seriesId: request.params.seriesId,
        });
        createdProgressions = progressionResult.createdProgressions;
        updatedProgressions = progressionResult.updatedProgressions;
        deletedProgressions = progressionResult.deletedProgressions;
      } catch (error) {
        return reply.status(400).send({
          code: "INVALID_DATA",
          message: error instanceof Error ? error.message : "Codex progression update draft could not be applied.",
        });
      }
      const progressionSummary = [
        createdProgressions.length ? `${createdProgressions.length} progression(s) created` : "",
        updatedProgressions.length ? `${updatedProgressions.length} progression(s) updated` : "",
        deletedProgressions.length ? `${deletedProgressions.length} progression(s) deleted` : "",
      ].filter(Boolean).join("; ");
      const resultMessage = await repository.saveWorkshopMessage(
        request.params.seriesId,
        WorkshopMessageSchema.parse({
          schemaVersion: 1,
          id: randomUUID(),
          seriesId: request.params.seriesId,
          sessionId: source.session.id,
          role: "result",
          mode: "agent",
          status: "succeeded",
          content: progressionSummary
            ? `codex.update_entry updated Codex entry: ${updatedEntry.metadata.name} (${progressionSummary})`
            : `codex.update_entry updated Codex entry: ${updatedEntry.metadata.name}`,
          reasoningContent: "",
          contextBundleId: source.message.contextBundleId,
          modelCallId: source.message.modelCallId,
          proposalIds: [],
          attachmentIds: [],
          errorCode: null,
          errorMessage: null,
          createdAt: new Date().toISOString(),
        }),
      );
      return reply.status(201).send(
        WorkshopCodexUpdateEntryToolResultSchema.parse({
          createdDetailTypes,
          createdProgressions,
          deletedProgressions,
          message: source.message,
          resultMessage,
          entry: updatedEntry,
          updatedProgressions,
        }),
      );
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

  function rejectLegacyCodexCreationMode(input: { mode: string }, reply: FastifyReply): boolean {
    if (input.mode !== "codex-creation") return false;
    void reply.status(400).send({
      code: "INVALID_DATA",
      message: "Codex Creation is no longer a Workshop mode. Use an Agent session and codex.create_entry tool requests.",
    });
    return true;
  }

  type PendingCodexDraft =
    | { tool: "codex.create_entry"; draft: WorkshopCodexCreateDraft }
    | { tool: "codex.update_entry"; draft: WorkshopCodexUpdateDraft };

  function cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  function pendingCodexDraftFromContext(contextBundle: ContextBundle): PendingCodexDraft | null {
    const item = contextBundle.items.find((candidate) => candidate.kind === "pending-codex-draft");
    if (!item) return null;
    const start = item.content.indexOf("{");
    const end = item.content.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const json = item.content.slice(start, end + 1);
    try {
      const request = parseCodexCreateEntryToolRequest(json);
      return { tool: request.tool, draft: request.draft };
    } catch {
      try {
        const request = parseCodexUpdateEntryToolRequest(json);
        return { tool: request.tool, draft: request.draft };
      } catch {
        return null;
      }
    }
  }

  function isPendingDraftReviewOnly(userRequest: string): boolean {
    const normalized = userRequest.toLocaleLowerCase("und");
    if (/\b(add|remove|cut|change|rename|alias|category|object|lore|refresh|update|revise|use only)\b/iu.test(normalized)) {
      return false;
    }
    return /\b(show|review|preview|plain english|wait|hold|do not write|don't write|not write|do not apply|don't apply)\b/iu
      .test(normalized);
  }

  function isPendingDraftRevisionRequest(userRequest: string): boolean {
    if (isPendingDraftReviewOnly(userRequest)) return false;
    return /\b(add|remove|cut|change|rename|alias|category|object|lore|refresh|update|revise|use only|one more bit)\b/iu
      .test(userRequest.toLocaleLowerCase("und"));
  }

  function requestedAliases(userRequest: string): string[] | null {
    const match = userRequest.match(/\balias(?:es)?\b\s*(?:is|are|as|to|:)?\s*["'`]?([A-Za-z0-9][A-Za-z0-9 _,-]{0,80})/iu) ??
      userRequest.match(/\bonly\s+one\s+alias\s*(?:is|as|:)?\s*["'`]?([A-Za-z0-9][A-Za-z0-9 _,-]{0,80})/iu);
    if (!match?.[1]) return null;
    return match[1]
      .replace(/[."'`;:]+$/u, "")
      .split(/\s*,\s*|\s+and\s+/iu)
      .map((alias) => alias.trim())
      .filter(Boolean);
  }

  function requestedAddedDetail(userRequest: string): WorkshopCodexCreateDraft["details"][number] | null {
    const match = userRequest.match(/\b(?:add|one more bit)\b[^:]*:\s*(.+)$/iu);
    const value = match?.[1]?.trim().replace(/[.。]+$/u, "");
    if (!value) return null;
    const label = /\bform|forms|formed|formation\b/iu.test(value) ? "Formation" : "Note";
    return { label, value };
  }

  function removeInventedCosmicMaterial(description: string): string {
    return description
      .split(/(?<=[.!?])\s+/u)
      .filter((sentence) => !/\b(cosmic|celestial|star origin|dying star|folklore|myth)\b/iu.test(sentence))
      .join(" ")
      .trim() || description;
  }

  function revisedPendingCodexDraft(
    pending: PendingCodexDraft,
    userRequest: string,
  ): PendingCodexDraft | null {
    if (!isPendingDraftRevisionRequest(userRequest)) return null;
    if (pending.tool === "codex.update_entry") {
      const draft = cloneJson(pending.draft);
      const aliases = requestedAliases(userRequest);
      if (aliases) draft.patch.aliases = aliases;
      return { tool: pending.tool, draft };
    }

    const draft = cloneJson(pending.draft);
    const aliases = requestedAliases(userRequest);
    if (aliases) draft.aliases = aliases;
    if (/\bobject\b/iu.test(userRequest) && !/\bnot\s+(?:an?\s+)?object\b/iu.test(userRequest)) {
      draft.categoryId = "object";
    } else if (/\blore\b/iu.test(userRequest) && !/\bnot\s+(?:a\s+)?lore\b/iu.test(userRequest)) {
      draft.categoryId = "lore";
    }
    const addedDetail = requestedAddedDetail(userRequest);
    if (addedDetail && !draft.details.some((detail) => detail.label === addedDetail.label && detail.value === addedDetail.value)) {
      draft.details = [...draft.details, addedDetail];
    }
    if (/\b(cut|remove)\b.*\b(cosmic|myth|invented|folklore)\b/iu.test(userRequest)) {
      draft.description = removeInventedCosmicMaterial(draft.description);
      draft.details = draft.details.filter((detail) =>
        !/\b(cosmic|celestial|star origin|dying star|folklore|myth)\b/iu.test(`${detail.label} ${detail.value}`)
      );
    }
    return { tool: pending.tool, draft };
  }

  function pendingDraftPreview(pending: PendingCodexDraft): string {
    return pending.tool === "codex.create_entry"
      ? renderWorkshopCodexCreateDraft(pending.draft)
      : renderWorkshopCodexUpdateDraft(pending.draft);
  }

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
    let toolRequestContent: string | null = null;

    if (input.mode === "agent" && input.log.status === "succeeded") {
      const pendingDraft = pendingCodexDraftFromContext(input.contextBundle);
      let step: WorkshopAgentStep = parseWorkshopAgentStep(rawAssistantContent);
      if (pendingDraft && isPendingDraftReviewOnly(input.userRequest) && step.type === "request_tool") {
        step = {
          schemaVersion: 1,
          type: "respond",
          message: pendingDraftPreview({
            tool: step.tool,
            draft: step.draft,
          } as PendingCodexDraft),
        };
      } else if (pendingDraft && step.type === "respond") {
        const revised = revisedPendingCodexDraft(pendingDraft, input.userRequest);
        if (revised) {
          step = revised.tool === "codex.create_entry"
            ? {
              schemaVersion: 1,
              type: "request_tool",
              tool: "codex.create_entry",
              message: "Prepared a revised Codex entry draft.",
              draft: revised.draft,
            }
            : {
              schemaVersion: 1,
              type: "request_tool",
              tool: "codex.update_entry",
              message: "Prepared a revised Codex entry update draft.",
              draft: revised.draft,
            };
        }
      }
      if (step.type === "request_tool" && step.tool === "codex.create_entry") {
        assistantContent = step.message.trim() || "Prepared a Codex entry creation tool request.";
        responseText = assistantContent;
        toolRequestContent = serializeCodexCreateEntryToolRequest(step.draft);
      } else if (step.type === "request_tool" && step.tool === "codex.update_entry") {
        assistantContent = step.message.trim() || "Prepared a Codex entry update tool request.";
        responseText = assistantContent;
        toolRequestContent = serializeCodexUpdateEntryToolRequest(step.draft);
      } else {
        assistantContent = step.message;
        responseText = step.message;
      }
    }

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
    const toolMessages = [];
    if (toolRequestContent) {
      const toolMessage = await repository.saveWorkshopMessage(
        input.seriesId,
        WorkshopMessageSchema.parse({
          schemaVersion: 1,
          id: randomUUID(),
          seriesId: input.seriesId,
          sessionId: input.sessionId,
          role: "tool",
          mode: "agent",
          status: "succeeded",
          content: toolRequestContent,
          reasoningContent: "",
          contextBundleId: input.contextBundle.id,
          modelCallId: input.log.id,
          proposalIds: [],
          attachmentIds: [],
          errorCode: null,
          errorMessage: null,
          createdAt: new Date(Date.now() + 1).toISOString(),
        }),
      );
      toolMessages.push(toolMessage);
    }
    return { assistantMessage, toolMessages, responseText };
  }


  app.post<{ Params: { seriesId: string; sessionId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions/:sessionId/context-preview",
    async (request, reply) => {
      try {
        const input = WorkshopContextPreviewInputSchema.parse(request.body);
        if (rejectLegacyCodexCreationMode(input, reply)) return reply;
        const basket = await repository.getWorkshopContextBasket(
          request.params.seriesId,
          request.params.sessionId,
        );
        return await buildContextBundle(
          repository,
          providerRegistry,
          request.params.seriesId,
          await workshopContextPayload(repository, request.params.seriesId, basket, input),
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
      if (rejectLegacyCodexCreationMode(input, reply)) return reply;
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
          await workshopContextPayload(repository, request.params.seriesId, basket, input, {
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
      const prompt = await workshopProviderPrompt(contextBundle, input);
      const providerContextBundle = workshopProviderContextBundle(contextBundle, input);

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
      if (rejectLegacyCodexCreationMode(input, reply)) return reply;
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
          await workshopContextPayload(repository, request.params.seriesId, basket, input, {
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
      const prompt = await workshopProviderPrompt(contextBundle, input);
      const providerContextBundle = workshopProviderContextBundle(contextBundle, input);
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
