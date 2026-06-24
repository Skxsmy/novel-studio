import type { FastifyInstance } from "fastify";
import {
  ArchiveCodexDocumentInputSchema,
  CodexCategoryIdSchema,
  CreateCodexCategoryInputSchema,
  CreateCodexEntryInputSchema,
  DeleteCodexDocumentInputSchema,
  CreateCodexKnowledgeInputSchema,
  CreateCodexProgressionInputSchema,
  CreateCodexRelationInputSchema,
  UpdateCodexCategoryInputSchema,
  UpdateCodexEntryInputSchema,
  UpdateCodexKnowledgeInputSchema,
  UpdateCodexProgressionInputSchema,
  UpdateCodexRelationInputSchema,
} from "@novel-studio/contracts";
import { ProjectRepository, StorageError } from "@novel-studio/storage";

export function registerCodexRoutes(
  app: FastifyInstance,
  repository: ProjectRepository,
): void {
  app.get<{
    Params: { seriesId: string };
    Querystring: { includeArchived?: string };
  }>("/api/v1/series/:seriesId/codex/categories", async (request) =>
    repository.listCodexCategories(
      request.params.seriesId,
      request.query.includeArchived === "true",
    ),
  );

  app.post<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/codex/categories",
    async (request, reply) => {
      const input = CreateCodexCategoryInputSchema.parse(request.body);
      return reply
        .status(201)
        .send(await repository.createCodexCategory(request.params.seriesId, input));
    },
  );

  app.put<{ Params: { seriesId: string; categoryId: string } }>(
    "/api/v1/series/:seriesId/codex/categories/:categoryId",
    async (request) => {
      const input = UpdateCodexCategoryInputSchema.parse(request.body);
      return repository.updateCodexCategory(
        request.params.seriesId,
        request.params.categoryId,
        input,
      );
    },
  );

  app.post<{ Params: { seriesId: string; categoryId: string } }>(
    "/api/v1/series/:seriesId/codex/categories/:categoryId/archive",
    async (request) => {
      const input = ArchiveCodexDocumentInputSchema.parse(request.body);
      return repository.archiveCodexCategory(
        request.params.seriesId,
        request.params.categoryId,
        input,
      );
    },
  );

  app.post<{ Params: { seriesId: string; categoryId: string } }>(
    "/api/v1/series/:seriesId/codex/categories/:categoryId/restore",
    async (request) => {
      const input = ArchiveCodexDocumentInputSchema.parse(request.body);
      return repository.restoreCodexCategory(
        request.params.seriesId,
        request.params.categoryId,
        input,
      );
    },
  );

  app.delete<{ Params: { seriesId: string; categoryId: string } }>(
    "/api/v1/series/:seriesId/codex/categories/:categoryId",
    async (request) => {
      const input = DeleteCodexDocumentInputSchema.parse(request.body);
      return repository.deleteCodexCategory(
        request.params.seriesId,
        request.params.categoryId,
        input,
      );
    },
  );

  app.get<{
    Params: { seriesId: string };
    Querystring: { categoryId?: string; includeArchived?: string };
  }>("/api/v1/series/:seriesId/codex/entries", async (request) =>
    repository.listCodexEntries(request.params.seriesId, {
      ...(request.query.categoryId
        ? { categoryId: CodexCategoryIdSchema.parse(request.query.categoryId) }
        : {}),
      includeArchived: request.query.includeArchived === "true",
    }),
  );

  app.post<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/codex/entries",
    async (request, reply) => {
      const input = CreateCodexEntryInputSchema.parse(request.body);
      return reply
        .status(201)
        .send(await repository.createCodexEntry(request.params.seriesId, input));
    },
  );

  app.get<{ Params: { seriesId: string; entryId: string } }>(
    "/api/v1/series/:seriesId/codex/entries/:entryId",
    async (request) =>
      repository.getCodexEntry(request.params.seriesId, request.params.entryId),
  );

  app.put<{ Params: { seriesId: string; entryId: string } }>(
    "/api/v1/series/:seriesId/codex/entries/:entryId",
    async (request) => {
      const input = UpdateCodexEntryInputSchema.parse(request.body);
      return repository.updateCodexEntry(
        request.params.seriesId,
        request.params.entryId,
        input,
      );
    },
  );

  app.post<{ Params: { seriesId: string; entryId: string } }>(
    "/api/v1/series/:seriesId/codex/entries/:entryId/archive",
    async (request) => {
      const input = ArchiveCodexDocumentInputSchema.parse(request.body);
      return repository.archiveCodexEntry(
        request.params.seriesId,
        request.params.entryId,
        input,
      );
    },
  );

  app.post<{ Params: { seriesId: string; entryId: string } }>(
    "/api/v1/series/:seriesId/codex/entries/:entryId/restore",
    async (request) => {
      const input = ArchiveCodexDocumentInputSchema.parse(request.body);
      return repository.restoreCodexEntry(
        request.params.seriesId,
        request.params.entryId,
        input,
      );
    },
  );

  app.delete<{ Params: { seriesId: string; entryId: string } }>(
    "/api/v1/series/:seriesId/codex/entries/:entryId",
    async (request) => {
      const input = DeleteCodexDocumentInputSchema.parse(request.body);
      return repository.deleteCodexEntry(
        request.params.seriesId,
        request.params.entryId,
        input,
      );
    },
  );

  app.get<{ Params: { seriesId: string; entryId: string } }>(
    "/api/v1/series/:seriesId/codex/entries/:entryId/mentions",
    async (request) =>
      repository.listCodexMentionsForEntry(
        request.params.seriesId,
        request.params.entryId,
      ),
  );

  app.get<{ Params: { seriesId: string; sceneId: string } }>(
    "/api/v1/series/:seriesId/codex/scenes/:sceneId/mentions",
    async (request) =>
      repository.listCodexMentionsForScene(
        request.params.seriesId,
        request.params.sceneId,
      ),
  );

  app.get<{
    Params: { seriesId: string };
    Querystring: { entryId?: string; includeArchived?: string };
  }>("/api/v1/series/:seriesId/codex/relations", async (request) =>
    repository.listCodexRelations(request.params.seriesId, {
      ...(request.query.entryId ? { entryId: request.query.entryId } : {}),
      includeArchived: request.query.includeArchived === "true",
    }),
  );

  app.post<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/codex/relations",
    async (request, reply) => {
      const input = CreateCodexRelationInputSchema.parse(request.body);
      return reply
        .status(201)
        .send(await repository.createCodexRelation(request.params.seriesId, input));
    },
  );

  app.put<{ Params: { seriesId: string; relationId: string } }>(
    "/api/v1/series/:seriesId/codex/relations/:relationId",
    async (request) => {
      const input = UpdateCodexRelationInputSchema.parse(request.body);
      return repository.updateCodexRelation(
        request.params.seriesId,
        request.params.relationId,
        input,
      );
    },
  );

  app.post<{ Params: { seriesId: string; relationId: string } }>(
    "/api/v1/series/:seriesId/codex/relations/:relationId/archive",
    async (request) => {
      const input = ArchiveCodexDocumentInputSchema.parse(request.body);
      return repository.archiveCodexRelation(
        request.params.seriesId,
        request.params.relationId,
        input,
      );
    },
  );

  app.post<{ Params: { seriesId: string; relationId: string } }>(
    "/api/v1/series/:seriesId/codex/relations/:relationId/restore",
    async (request) => {
      const input = ArchiveCodexDocumentInputSchema.parse(request.body);
      return repository.restoreCodexRelation(
        request.params.seriesId,
        request.params.relationId,
        input,
      );
    },
  );

  app.get<{
    Params: { seriesId: string };
    Querystring: {
      entryId?: string;
      relationId?: string;
      includeArchived?: string;
    };
  }>("/api/v1/series/:seriesId/codex/progressions", async (request) =>
    repository.listCodexProgressions(request.params.seriesId, {
      ...(request.query.entryId ? { entryId: request.query.entryId } : {}),
      ...(request.query.relationId ? { relationId: request.query.relationId } : {}),
      includeArchived: request.query.includeArchived === "true",
    }),
  );

  app.post<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/codex/progressions",
    async (request, reply) => {
      const input = CreateCodexProgressionInputSchema.parse(request.body);
      return reply.status(201).send(
        await repository.createCodexProgression(request.params.seriesId, input),
      );
    },
  );

  app.get<{ Params: { seriesId: string; progressionId: string } }>(
    "/api/v1/series/:seriesId/codex/progressions/:progressionId",
    async (request) =>
      repository.getCodexProgression(
        request.params.seriesId,
        request.params.progressionId,
      ),
  );

  app.put<{ Params: { seriesId: string; progressionId: string } }>(
    "/api/v1/series/:seriesId/codex/progressions/:progressionId",
    async (request) => {
      const input = UpdateCodexProgressionInputSchema.parse(request.body);
      return repository.updateCodexProgression(
        request.params.seriesId,
        request.params.progressionId,
        input,
      );
    },
  );

  app.post<{ Params: { seriesId: string; progressionId: string } }>(
    "/api/v1/series/:seriesId/codex/progressions/:progressionId/archive",
    async (request) => {
      const input = ArchiveCodexDocumentInputSchema.parse(request.body);
      return repository.archiveCodexProgression(
        request.params.seriesId,
        request.params.progressionId,
        input,
      );
    },
  );

  app.post<{ Params: { seriesId: string; progressionId: string } }>(
    "/api/v1/series/:seriesId/codex/progressions/:progressionId/restore",
    async (request) => {
      const input = ArchiveCodexDocumentInputSchema.parse(request.body);
      return repository.restoreCodexProgression(
        request.params.seriesId,
        request.params.progressionId,
        input,
      );
    },
  );

  app.get<{
    Params: { seriesId: string };
    Querystring: {
      characterEntryId?: string;
      subjectEntryId?: string;
      relationId?: string;
      includeArchived?: string;
    };
  }>("/api/v1/series/:seriesId/codex/knowledge", async (request) =>
    repository.listCodexKnowledge(request.params.seriesId, {
      ...(request.query.characterEntryId
        ? { characterEntryId: request.query.characterEntryId }
        : {}),
      ...(request.query.subjectEntryId
        ? { subjectEntryId: request.query.subjectEntryId }
        : {}),
      ...(request.query.relationId ? { relationId: request.query.relationId } : {}),
      includeArchived: request.query.includeArchived === "true",
    }),
  );

  app.post<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/codex/knowledge",
    async (request, reply) => {
      const input = CreateCodexKnowledgeInputSchema.parse(request.body);
      return reply.status(201).send(
        await repository.createCodexKnowledge(request.params.seriesId, input),
      );
    },
  );

  app.get<{ Params: { seriesId: string; knowledgeId: string } }>(
    "/api/v1/series/:seriesId/codex/knowledge/:knowledgeId",
    async (request) =>
      repository.getCodexKnowledge(
        request.params.seriesId,
        request.params.knowledgeId,
      ),
  );

  app.put<{ Params: { seriesId: string; knowledgeId: string } }>(
    "/api/v1/series/:seriesId/codex/knowledge/:knowledgeId",
    async (request) => {
      const input = UpdateCodexKnowledgeInputSchema.parse(request.body);
      return repository.updateCodexKnowledge(
        request.params.seriesId,
        request.params.knowledgeId,
        input,
      );
    },
  );

  app.post<{ Params: { seriesId: string; knowledgeId: string } }>(
    "/api/v1/series/:seriesId/codex/knowledge/:knowledgeId/archive",
    async (request) => {
      const input = ArchiveCodexDocumentInputSchema.parse(request.body);
      return repository.archiveCodexKnowledge(
        request.params.seriesId,
        request.params.knowledgeId,
        input,
      );
    },
  );

  app.post<{ Params: { seriesId: string; knowledgeId: string } }>(
    "/api/v1/series/:seriesId/codex/knowledge/:knowledgeId/restore",
    async (request) => {
      const input = ArchiveCodexDocumentInputSchema.parse(request.body);
      return repository.restoreCodexKnowledge(
        request.params.seriesId,
        request.params.knowledgeId,
        input,
      );
    },
  );

  app.get<{
    Params: { seriesId: string };
    Querystring: { sceneId?: string; entryId?: string; viewerEntryId?: string };
  }>("/api/v1/series/:seriesId/codex/effective", async (request) => {
    if (!request.query.sceneId || !request.query.entryId) {
      throw new StorageError("有效状态查询需要 sceneId 与 entryId", "INVALID_DATA");
    }
    return repository.getCodexEffectiveState(
      request.params.seriesId,
      request.query.sceneId,
      request.query.entryId,
      request.query.viewerEntryId,
    );
  });

  app.get<{
    Params: { seriesId: string };
    Querystring: { sceneId?: string; pinnedIds?: string };
  }>("/api/v1/series/:seriesId/codex/context", async (request) => {
    if (!request.query.sceneId) {
      throw new StorageError("Codex 上下文预览需要 sceneId", "INVALID_DATA");
    }
    return repository.previewCodexContext(
      request.params.seriesId,
      request.query.sceneId,
      request.query.pinnedIds
        ? request.query.pinnedIds.split(",").map((value) => value.trim()).filter(Boolean)
        : [],
    );
  });

  app.get<{
    Params: { seriesId: string };
    Querystring: { q?: string };
  }>("/api/v1/series/:seriesId/codex/search", async (request) =>
    repository.searchCodex(request.params.seriesId, request.query.q ?? ""),
  );
}
