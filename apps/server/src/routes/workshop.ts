import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  CreateWorkshopBranchInputSchema,
  CreateWorkshopMessageProposalInputSchema,
  CreateWorkshopMessageInputSchema,
  CreateWorkshopSessionInputSchema,
  ModelCallLogSchema,
  RunWorkshopCallInputSchema,
  UpdateWorkshopContextBasketInputSchema,
  UpdateWorkshopSessionInputSchema,
  WorkshopCallResultSchema,
  WorkshopContextPreviewInputSchema,
  WorkshopMessageSchema,
  type ContextBundle,
  type ModelCallError,
  type ModelCallLog,
  type ModelParameters,
  type ModelProfile,
  type TokenUsage,
  type WorkshopContextBasket,
} from "@novel-studio/contracts";
import type { ProviderPrompt, ProviderRegistry } from "@novel-studio/ai";
import { StorageError, type ProjectRepository } from "@novel-studio/storage";
import {
  ensureCredentialBoundary,
  modelError,
} from "../ai/policy.js";
import { ensureBuiltInPrompts } from "../prompts/builtIns.js";
import { PromptRenderError } from "../prompts/render.js";
import { buildContextBundle } from "./context.js";
import { contextPrompt, requestHash, usage } from "./modelCalls.js";

function hashText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function manualContextIds(basket: WorkshopContextBasket): string[] {
  return basket.items.flatMap((item) => {
    if (!item.sourceId) return [];
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
): Promise<Record<string, unknown>> {
  const sceneId = basket.sceneId ?? (await repository.getSeries(seriesId)).scenes[0]?.metadata.id;
  if (!sceneId) {
    throw new StorageError("Workshop context requires a scene", "INVALID_DATA", {
      sessionId: basket.sessionId,
    });
  }
  return {
    sceneId,
    blockId: basket.blockId,
    selection: basket.selection,
    manualContextIds: manualContextIds(basket),
    userRequest: input.userRequest,
    roleId: input.roleId,
    taskKind: input.taskKind,
    promptTemplateId: input.promptTemplateId,
    promptTemplateVersion: input.promptTemplateVersion,
    modelProfileId: input.modelProfileId,
    tokenBudget: input.tokenBudget,
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

function baseModelCallLog(input: {
  seriesId: string;
  callId: string;
  modelProfile: ModelProfile;
  contextBundle: ContextBundle;
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
      contextBundle: input.contextBundle,
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
  modelProfile: ModelProfile;
  parameters: ModelParameters;
}): Promise<{ log: ModelCallLog; responseText: string }> {
  const { repository, providerRegistry, seriesId, contextBundle, modelProfile, parameters } = input;
  const prompt = contextPrompt(contextBundle);
  let adapter;
  try {
    adapter = providerRegistry.get(modelProfile.provider);
  } catch {
    const estimatedUsage = combinedInputUsage(contextBundle, modelProfile, prompt, null);
    const baseLog = baseModelCallLog({
      seriesId,
      callId: randomUUID(),
      modelProfile,
      contextBundle,
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

  const estimatedUsage = combinedInputUsage(contextBundle, modelProfile, prompt, providerRegistry);
  const baseLog = baseModelCallLog({
    seriesId,
    callId: randomUUID(),
    modelProfile,
    contextBundle,
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
  let responseText = "";
  try {
    for await (const chunk of adapter.streamText({
      modelProfile,
      prompt,
      contextBundle,
      parameters,
    })) {
      responseText += chunk;
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
      const [session, basket, messages] = await Promise.all([
        repository.getWorkshopSession(request.params.seriesId, request.params.sessionId),
        repository.getWorkshopContextBasket(request.params.seriesId, request.params.sessionId),
        repository.listWorkshopMessages(request.params.seriesId, request.params.sessionId),
      ]);
      return { session, basket, messages };
    },
  );

  app.put<{ Params: { seriesId: string; sessionId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions/:sessionId",
    async (request) => {
      const input = UpdateWorkshopSessionInputSchema.parse(request.body);
      return repository.updateWorkshopSession(request.params.seriesId, request.params.sessionId, input);
    },
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
    "/api/v1/series/:seriesId/workshop/sessions/:sessionId/calls",
    async (request, reply) => {
      await ensureBuiltInPrompts(repository, request.params.seriesId);
      const input = RunWorkshopCallInputSchema.parse(request.body);
      const authorMessage = await repository.createWorkshopMessage(
        request.params.seriesId,
        request.params.sessionId,
        { role: "author", content: input.userRequest },
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
          await workshopContextPayload(repository, request.params.seriesId, basket, input),
        );
      } catch (error) {
        if (sendContextError(reply, error)) return reply;
        throw error;
      }
      const modelProfile = effectiveModelProfile(
        await repository.getModelProfile(input.modelProfileId),
        input.modelOverride,
      );
      const { log, responseText } = await executeWorkshopCall({
        repository,
        providerRegistry,
        seriesId: request.params.seriesId,
        sessionId: request.params.sessionId,
        contextBundle,
        modelProfile,
        parameters: input.parameters,
      });
      const assistantMessage = await repository.saveWorkshopMessage(
        request.params.seriesId,
        WorkshopMessageSchema.parse({
          schemaVersion: 1,
          id: randomUUID(),
          seriesId: request.params.seriesId,
          sessionId: request.params.sessionId,
          role: "assistant",
          status: log.status === "succeeded" ? "succeeded" : "failed",
          content: responseText || log.errorMessage || "Model call failed.",
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
        responseText,
        estimatedUsage: log.estimatedUsage,
        actualUsage: log.actualUsage,
      });
    },
  );
}
