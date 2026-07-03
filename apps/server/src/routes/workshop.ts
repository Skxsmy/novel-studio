import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  CreateWorkshopBranchInputSchema,
  CreateWorkshopMessageProposalInputSchema,
  CreateWorkshopMessageInputSchema,
  CreateWorkshopSessionInputSchema,
  ContextBundleSchema,
  DeleteWorkshopAttachmentResultSchema,
  DeleteWorkshopSessionResultSchema,
  ListWorkshopAttachmentsQuerySchema,
  ModelCallLogSchema,
  RunWorkshopCallInputSchema,
  UpdateWorkshopContextBasketInputSchema,
  UpdateWorkshopSessionInputSchema,
  UploadWorkshopAttachmentInputSchema,
  WorkshopCallResultSchema,
  WorkshopCallStreamEventSchema,
  WorkshopContextPreviewInputSchema,
  WorkshopMessageAttachmentSchema,
  WorkshopMessageSchema,
  type ContextBundle,
  type ModelCallError,
  type ModelCallLog,
  type ModelParameters,
  type ModelProfile,
  type TokenUsage,
  type WorkshopContextBasket,
  type WorkshopCallStreamEvent,
} from "@novel-studio/contracts";
import type { ProviderPrompt, ProviderRegistry } from "@novel-studio/ai";
import type { ProjectRepository } from "@novel-studio/storage";
import {
  ensureCredentialBoundary,
  modelError,
} from "../ai/policy.js";
import { ensureBuiltInPrompts } from "../prompts/builtIns.js";
import { PromptRenderError } from "../prompts/render.js";
import { buildContextBundle } from "./context.js";
import { contextPrompt, requestHash, usage } from "./modelCalls.js";
import { parseWorkshopAttachmentUpload } from "./workshopAttachments.js";

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
  return {
    sceneId: basket.sceneId ?? null,
    blockId: basket.blockId,
    selection: basket.selection,
    manualContextIds: manualContextIds(basket),
    userRequest: input.userRequest,
    roleId: input.roleId,
    taskKind: input.taskKind,
    promptTemplateId: input.promptTemplateId,
    promptTemplateVersion: input.promptTemplateVersion,
    systemPromptOverride: input.mode === "general-chat" ? input.systemPrompt : null,
    modelProfileId: input.modelProfileId,
    tokenBudget: input.tokenBudget,
    attachmentIds: input.attachmentIds,
    draftToken: input.draftToken,
    workshopSessionId: basket.sessionId,
    excludeWorkshopMessageId: options.excludeWorkshopMessageId ?? null,
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

function workshopProviderPrompt(
  contextBundle: ContextBundle,
  input: ReturnType<typeof RunWorkshopCallInputSchema.parse>,
): ProviderPrompt {
  if (input.mode !== "general-chat") return contextPrompt(contextBundle);
  return {
    system: input.systemPrompt.trim(),
    instructions: "",
    user: contextBundle.userRequest,
  };
}

function workshopProviderContextBundle(
  contextBundle: ContextBundle,
  input: ReturnType<typeof RunWorkshopCallInputSchema.parse>,
): ContextBundle {
  if (input.mode !== "general-chat") return contextBundle;
  const items = contextBundle.items.filter((item) =>
    item.kind !== "role-instruction" &&
    item.kind !== "prompt-template" &&
    item.kind !== "user-request",
  );
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

  app.post<{ Params: { seriesId: string; sessionId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions/:sessionId/context-preview",
    async (request, reply) => {
      try {
        await ensureBuiltInPrompts(repository, request.params.seriesId);
        const input = WorkshopContextPreviewInputSchema.parse(request.body);
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
      await ensureBuiltInPrompts(repository, request.params.seriesId);
      const input = RunWorkshopCallInputSchema.parse(request.body);
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
      const prompt = workshopProviderPrompt(contextBundle, input);
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
      const parser = createReasoningParser();
      writeWorkshopEvent(reply, { type: "author-message", message: authorMessage });

      const { log, responseText } = await executeWorkshopCall({
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
              writeWorkshopEvent(reply, event);
            } else {
              visibleText += event.text;
              writeWorkshopEvent(reply, event);
            }
          }
        },
      });

      for (const event of parser.finish()) {
        if (event.type === "reasoning-delta") {
          reasoningText += event.text;
          writeWorkshopEvent(reply, event);
        } else {
          visibleText += event.text;
          writeWorkshopEvent(reply, event);
        }
      }
      if (!metadataSent) {
        writeWorkshopEvent(reply, {
          type: "metadata",
          contextBundleId: contextBundle.id,
          modelCallId: log.id,
        });
      }

      const parsedResponse = splitReasoningContent(responseText);
      const assistantContent = visibleText || parsedResponse.content || log.errorMessage || "Model call failed.";
      const assistantReasoning = reasoningText || parsedResponse.reasoningContent;
      const assistantMessage = await repository.saveWorkshopMessage(
        request.params.seriesId,
        WorkshopMessageSchema.parse({
          schemaVersion: 1,
          id: randomUUID(),
          seriesId: request.params.seriesId,
          sessionId: request.params.sessionId,
          role: "assistant",
          mode: input.mode,
          status: log.status === "succeeded" ? "succeeded" : "failed",
          content: assistantContent,
          reasoningContent: assistantReasoning,
          contextBundleId: contextBundle.id,
          modelCallId: log.id,
          proposalIds: [],
          errorCode: log.errorCode,
          errorMessage: log.errorMessage,
          createdAt: new Date().toISOString(),
        }),
      );
      const result = WorkshopCallResultSchema.parse({
        authorMessage,
        assistantMessage,
        contextBundleId: contextBundle.id,
        modelCallId: log.id,
        status: assistantMessage.status,
        responseText: parsedResponse.content || visibleText,
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
      await ensureBuiltInPrompts(repository, request.params.seriesId);
      const input = RunWorkshopCallInputSchema.parse(request.body);
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
      const prompt = workshopProviderPrompt(contextBundle, input);
      const providerContextBundle = workshopProviderContextBundle(contextBundle, input);
      const { log, responseText } = await executeWorkshopCall({
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
      const parsedResponse = splitReasoningContent(responseText);
      const assistantMessage = await repository.saveWorkshopMessage(
        request.params.seriesId,
        WorkshopMessageSchema.parse({
          schemaVersion: 1,
          id: randomUUID(),
          seriesId: request.params.seriesId,
          sessionId: request.params.sessionId,
          role: "assistant",
          mode: input.mode,
          status: log.status === "succeeded" ? "succeeded" : "failed",
          content: parsedResponse.content || log.errorMessage || "Model call failed.",
          reasoningContent: parsedResponse.reasoningContent,
          contextBundleId: contextBundle.id,
          modelCallId: log.id,
          proposalIds: [],
          errorCode: log.errorCode,
          errorMessage: log.errorMessage,
          createdAt: new Date().toISOString(),
        }),
      );
      return WorkshopCallResultSchema.parse({
        authorMessage,
        assistantMessage,
        contextBundleId: contextBundle.id,
        modelCallId: log.id,
        status: assistantMessage.status,
        responseText: parsedResponse.content,
        estimatedUsage: log.estimatedUsage,
        actualUsage: log.actualUsage,
      });
    },
  );
}
