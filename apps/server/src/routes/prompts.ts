import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  AgentRoleSchema,
  CloneAgentRoleInputSchema,
  CreatePromptPresetInputSchema,
  CreatePromptTemplateInputSchema,
  CreatePromptTemplateVersionInputSchema,
  PromptPresetSchema,
  PromptTemplatePreviewInputSchema,
  PromptTemplateSchema,
  UpdateAgentRoleInputSchema,
  type PromptTemplate,
} from "@novel-studio/contracts";
import { StorageError, type ProjectRepository } from "@novel-studio/storage";
import { ensureBuiltInPrompts } from "../prompts/builtIns.js";
import { PromptRenderError, renderPromptTemplate } from "../prompts/render.js";

function newestTemplate(templates: PromptTemplate[]): PromptTemplate {
  const available = templates.filter((template) => template.archivedAt === null);
  const active = available.filter((template) => template.status === "active");
  const candidates = active.length ? active : available;
  const latest = [...candidates].sort((left, right) => right.version - left.version)[0];
  if (!latest) {
    throw new StorageError("提示词模板不存在", "NOT_FOUND");
  }
  return latest;
}

async function getTemplateForPreview(
  repository: ProjectRepository,
  seriesId: string,
  promptTemplateId: string,
  version: number | undefined,
): Promise<PromptTemplate> {
  if (version) {
    return repository.getPromptTemplate(seriesId, promptTemplateId, version);
  }
  const templates = (await repository.listPromptTemplates(seriesId))
    .filter((template) => template.id === promptTemplateId);
  return newestTemplate(templates);
}

function promptRenderStatus(error: PromptRenderError): number {
  return error.code === "PROMPT_INPUT_MISSING" ? 400 : 422;
}

export function registerPromptRoutes(app: FastifyInstance, repository: ProjectRepository): void {
  app.get<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/ai/roles",
    async (request) => {
      await ensureBuiltInPrompts(repository, request.params.seriesId);
      return repository.listAgentRoles(request.params.seriesId);
    },
  );

  app.post<{ Params: { seriesId: string; roleId: string } }>(
    "/api/v1/series/:seriesId/ai/roles/:roleId/clone",
    async (request, reply) => {
      await ensureBuiltInPrompts(repository, request.params.seriesId);
      const input = CloneAgentRoleInputSchema.parse(request.body ?? {});
      const source = await repository.getAgentRole(request.params.seriesId, request.params.roleId);
      const now = new Date().toISOString();
      const cloned = AgentRoleSchema.parse({
        ...source,
        id: `role-${randomUUID()}`,
        title: input.title ?? `${source.title}副本`,
        description: input.description ?? source.description,
        builtIn: false,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      });
      return reply.status(201).send(await repository.saveAgentRole(request.params.seriesId, cloned));
    },
  );

  app.put<{ Params: { seriesId: string; roleId: string } }>(
    "/api/v1/series/:seriesId/ai/roles/:roleId",
    async (request, reply) => {
      await ensureBuiltInPrompts(repository, request.params.seriesId);
      const input = UpdateAgentRoleInputSchema.parse(request.body);
      const current = await repository.getAgentRole(request.params.seriesId, request.params.roleId);
      if (current.builtIn) {
        return reply.status(409).send({
          code: "BUILT_IN_ROLE_READ_ONLY",
          message: "内置编辑角色不能直接覆盖。请先复制角色，再修改副本。",
        });
      }
      const updated = AgentRoleSchema.parse({
        ...current,
        ...input,
        updatedAt: new Date().toISOString(),
      });
      return repository.saveAgentRole(request.params.seriesId, updated);
    },
  );

  app.get<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/ai/prompts",
    async (request) => {
      await ensureBuiltInPrompts(repository, request.params.seriesId);
      return repository.listPromptTemplates(request.params.seriesId);
    },
  );

  app.post<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/ai/prompts",
    async (request, reply) => {
      await ensureBuiltInPrompts(repository, request.params.seriesId);
      const input = CreatePromptTemplateInputSchema.parse(request.body);
      await repository.getAgentRole(request.params.seriesId, input.roleId);
      const now = new Date().toISOString();
      const template = PromptTemplateSchema.parse({
        schemaVersion: 1,
        id: randomUUID(),
        version: 1,
        status: input.status ?? "draft",
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
        ...input,
      });
      return reply.status(201).send(await repository.savePromptTemplate(request.params.seriesId, template));
    },
  );

  app.post<{ Params: { seriesId: string; promptTemplateId: string } }>(
    "/api/v1/series/:seriesId/ai/prompts/:promptTemplateId/versions",
    async (request, reply) => {
      await ensureBuiltInPrompts(repository, request.params.seriesId);
      const input = CreatePromptTemplateVersionInputSchema.parse(request.body);
      const base = await repository.getPromptTemplate(
        request.params.seriesId,
        request.params.promptTemplateId,
        input.baseVersion,
      );
      const versions = (await repository.listPromptTemplates(request.params.seriesId))
        .filter((template) => template.id === request.params.promptTemplateId)
        .map((template) => template.version);
      const nextVersion = Math.max(...versions, input.baseVersion) + 1;
      const now = new Date().toISOString();
      const { baseVersion: _baseVersion, ...changes } = input;
      const next = PromptTemplateSchema.parse({
        ...base,
        ...changes,
        version: nextVersion,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      });
      return reply.status(201).send(await repository.savePromptTemplate(request.params.seriesId, next));
    },
  );

  app.post<{ Params: { seriesId: string; promptTemplateId: string } }>(
    "/api/v1/series/:seriesId/ai/prompts/:promptTemplateId/preview",
    async (request, reply) => {
      await ensureBuiltInPrompts(repository, request.params.seriesId);
      const input = PromptTemplatePreviewInputSchema.parse(request.body ?? {});
      const template = await getTemplateForPreview(
        repository,
        request.params.seriesId,
        request.params.promptTemplateId,
        input.version,
      );
      try {
        return renderPromptTemplate(template, input.inputs);
      } catch (error) {
        if (error instanceof PromptRenderError) {
          return reply.status(promptRenderStatus(error)).send({
            code: error.code,
            message: error.message,
            details: error.details,
          });
        }
        throw error;
      }
    },
  );

  app.get<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/ai/presets",
    async (request) => {
      await ensureBuiltInPrompts(repository, request.params.seriesId);
      return repository.listPromptPresets(request.params.seriesId);
    },
  );

  app.post<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/ai/presets",
    async (request, reply) => {
      await ensureBuiltInPrompts(repository, request.params.seriesId);
      const input = CreatePromptPresetInputSchema.parse(request.body);
      await repository.getAgentRole(request.params.seriesId, input.roleId);
      await repository.getPromptTemplate(
        request.params.seriesId,
        input.promptTemplateId,
        input.promptTemplateVersion,
      );
      const now = new Date().toISOString();
      const preset = PromptPresetSchema.parse({
        schemaVersion: 1,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
        ...input,
      });
      return reply.status(201).send(await repository.savePromptPreset(request.params.seriesId, preset));
    },
  );
}
