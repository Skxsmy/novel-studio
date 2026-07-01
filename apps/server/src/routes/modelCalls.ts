import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  CreateModelCallInputSchema,
  ModelCallLogSchema,
  ModelCallStreamEventSchema,
  type ContextBundle,
  type ModelCallLog,
  type ModelCallStreamEvent,
  type ModelProfile,
  type TokenUsage,
} from "@novel-studio/contracts";
import type { ProviderPrompt, ProviderRegistry } from "@novel-studio/ai";
import type { ProjectRepository } from "@novel-studio/storage";
import {
  ensureCredentialBoundary,
  modelError,
  providerErrorStatus,
} from "../ai/policy.js";

const candidateTaskKinds = new Set(["draft", "rewrite", "expand", "compress"]);

function hashText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function contextPrompt(bundle: ContextBundle): ProviderPrompt {
  const role = bundle.items.find((item) => item.kind === "role-instruction");
  const prompt = bundle.items.find((item) => item.kind === "prompt-template");
  const candidateBoundary = candidateTaskKinds.has(bundle.taskKind)
    ? "本次调用可以生成正文候选，但只能作为待确认候选。不得声称已经写入正文、设定、摘要、故事进展或角色所知；如果作者要求改写选区，只输出可放入正文的候选文本。"
    : "本次调用是非写入型分析。不得直接写入正文、已确认设定、摘要、故事进展或角色所知。";
  return {
    system: role?.content ?? "你是 Novel Studio 的智能编辑。只做分析，不直接修改正文或设定。",
    instructions: [
      prompt?.content ?? "",
      candidateBoundary,
    ].filter(Boolean).join("\n\n"),
    user: bundle.userRequest,
  };
}

export function requestHash(input: {
  modelProfile: ModelProfile;
  contextBundle: ContextBundle;
  prompt: ProviderPrompt;
  parameters: unknown;
}): string {
  return hashText(JSON.stringify({
    modelProfileId: input.modelProfile.id,
    provider: input.modelProfile.provider,
    model: input.modelProfile.model,
    contextBundleId: input.contextBundle.id,
    contextItemHashes: input.contextBundle.items.map((item) => item.textHash),
    promptTemplateId: input.contextBundle.promptTemplateId,
    promptTemplateVersion: input.contextBundle.promptTemplateVersion,
    prompt: input.prompt,
    parameters: input.parameters,
  }));
}

export function usage(inputTokens: number, response: string): TokenUsage {
  const outputTokens = Math.ceil(Array.from(response).length / 2);
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}

function writeEvent(reply: FastifyReply, rawEvent: ModelCallStreamEvent): void {
  const event = ModelCallStreamEventSchema.parse(rawEvent);
  reply.raw.write(`event: ${event.type}\n`);
  reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
}

function sameCallBoundary(input: {
  bodyRoleId: string;
  bodyTaskKind: string;
  bodyPromptTemplateId: string;
  bodyPromptTemplateVersion: number;
  bundle: ContextBundle;
}): string | null {
  if (input.bundle.roleId !== input.bodyRoleId) return "调用角色必须与上下文包角色一致。";
  if (input.bundle.taskKind !== input.bodyTaskKind) return "调用任务类型必须与上下文包任务一致。";
  if (input.bundle.promptTemplateId !== input.bodyPromptTemplateId) return "调用提示词模板必须与上下文包一致。";
  if (input.bundle.promptTemplateVersion !== input.bodyPromptTemplateVersion) return "调用提示词版本必须与上下文包一致。";
  return null;
}

export function registerModelCallRoutes(
  app: FastifyInstance,
  repository: ProjectRepository,
  options: { providerRegistry: ProviderRegistry },
): void {
  const { providerRegistry } = options;
  app.post<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/ai/calls",
    async (request, reply) => {
      const input = CreateModelCallInputSchema.parse(request.body);
      const [modelProfile, contextBundle] = await Promise.all([
        repository.getModelProfile(input.modelProfileId),
        repository.getContextBundle(request.params.seriesId, input.contextBundleId),
      ]);
      const mismatch = sameCallBoundary({
        bodyRoleId: input.roleId,
        bodyTaskKind: input.taskKind,
        bodyPromptTemplateId: input.promptTemplateId,
        bodyPromptTemplateVersion: input.promptTemplateVersion,
        bundle: contextBundle,
      });
      if (mismatch) {
        return reply.status(400).send({ code: "CALL_CONTEXT_MISMATCH", message: mismatch });
      }
      const blocked = ensureCredentialBoundary(modelProfile);
      if (blocked) {
        return reply.status(providerErrorStatus(blocked)).send({
          code: blocked.code.toUpperCase().replace(/-/gu, "_"),
          message: blocked.message,
          error: blocked,
        });
      }

      let adapter;
      try {
        adapter = providerRegistry.get(modelProfile.provider);
      } catch {
        const error = modelError(
          "provider-unavailable",
          "当前版本还没有启用这个 Provider。不会自动回退到其他模型。",
          true,
        );
        return reply.status(503).send({ code: "PROVIDER_UNAVAILABLE", message: error.message, error });
      }

      const prompt = contextPrompt(contextBundle);
      const promptUsage = adapter.estimateTokens(prompt);
      const inputTokens = contextBundle.estimatedUsage.inputTokens + promptUsage.inputTokens;
      if (inputTokens > modelProfile.contextWindowTokens) {
        const error = modelError("context-too-large", "上下文超过模型窗口，调用已拒绝。", false);
        return reply.status(400).send({ code: "CONTEXT_TOO_LARGE", message: error.message, error });
      }

      const callId = randomUUID();
      const startedAt = new Date().toISOString();
      const baseLog = ModelCallLogSchema.parse({
        schemaVersion: 1,
        id: callId,
        seriesId: request.params.seriesId,
        sceneId: contextBundle.sceneId,
        roleId: input.roleId,
        taskKind: input.taskKind,
        provider: modelProfile.provider,
        model: modelProfile.model,
        contextBundleId: contextBundle.id,
        promptTemplateId: contextBundle.promptTemplateId,
        promptTemplateVersion: contextBundle.promptTemplateVersion,
        requestHash: requestHash({
          modelProfile,
          contextBundle,
          prompt,
          parameters: input.parameters,
        }),
        responseHash: null,
        status: "pending",
        estimatedUsage: {
          inputTokens,
          outputTokens: 0,
          totalTokens: inputTokens,
        },
        actualUsage: null,
        errorCode: null,
        errorMessage: null,
        error: null,
        startedAt,
        completedAt: null,
      });
      await repository.saveModelCallLog(request.params.seriesId, baseLog);

      reply.hijack();
      reply.raw.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      });

      const abortController = new AbortController();
      request.raw.on("close", () => abortController.abort());
      let responseText = "";
      let latestLog: ModelCallLog = {
        ...baseLog,
        status: "streaming",
      };
      await repository.saveModelCallLog(request.params.seriesId, latestLog);
      writeEvent(reply, {
        type: "metadata",
        callId,
        contextBundleId: contextBundle.id,
        modelProfileId: modelProfile.id,
        provider: modelProfile.provider,
        model: modelProfile.model,
        roleId: input.roleId,
        taskKind: input.taskKind,
        promptTemplateId: contextBundle.promptTemplateId,
        promptTemplateVersion: contextBundle.promptTemplateVersion,
      });
      writeEvent(reply, {
        type: "usage",
        estimatedUsage: latestLog.estimatedUsage,
        actualUsage: null,
      });

      try {
        for await (const chunk of adapter.streamText({
          modelProfile,
          prompt,
          contextBundle,
          parameters: input.parameters,
          abortSignal: abortController.signal,
        })) {
          responseText += chunk;
          writeEvent(reply, { type: "delta", text: chunk });
        }
        const actualUsage = usage(inputTokens, responseText);
        latestLog = {
          ...latestLog,
          status: "succeeded",
          responseHash: hashText(responseText),
          actualUsage,
          completedAt: new Date().toISOString(),
        };
        await repository.saveModelCallLog(request.params.seriesId, latestLog);
        writeEvent(reply, {
          type: "usage",
          estimatedUsage: latestLog.estimatedUsage,
          actualUsage,
        });
        writeEvent(reply, {
          type: "done",
          callId,
          status: "succeeded",
          responseHash: latestLog.responseHash,
          actualUsage,
        });
      } catch (caught) {
        const error = adapter.classifyError(caught);
        const actualUsage = usage(inputTokens, responseText);
        latestLog = {
          ...latestLog,
          status: "failed",
          responseHash: responseText ? hashText(responseText) : null,
          actualUsage,
          errorCode: error.code,
          errorMessage: error.message,
          error,
          completedAt: new Date().toISOString(),
        };
        await repository.saveModelCallLog(request.params.seriesId, latestLog);
        writeEvent(reply, { type: "error", error });
        writeEvent(reply, {
          type: "done",
          callId,
          status: "failed",
          responseHash: latestLog.responseHash,
          actualUsage,
        });
      } finally {
        reply.raw.end();
      }
    },
  );

  app.get<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/ai/calls",
    async (request) => repository.listModelCallLogs(request.params.seriesId),
  );

  app.get<{ Params: { seriesId: string; modelCallId: string } }>(
    "/api/v1/series/:seriesId/ai/calls/:modelCallId",
    async (request) =>
      repository.getModelCallLog(request.params.seriesId, request.params.modelCallId),
  );

  app.get<{ Params: { seriesId: string; modelCallId: string } }>(
    "/api/v1/series/:seriesId/ai/calls/:modelCallId/context",
    async (request) => {
      const call = await repository.getModelCallLog(
        request.params.seriesId,
        request.params.modelCallId,
      );
      return repository.getContextBundle(request.params.seriesId, call.contextBundleId);
    },
  );
}
