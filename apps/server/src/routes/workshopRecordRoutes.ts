import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  CreateWorkshopMessageInputSchema,
  CreateWorkshopSessionInputSchema,
  DeleteWorkshopAttachmentResultSchema,
  DeleteWorkshopSessionResultSchema,
  ExportWorkshopSessionQuerySchema,
  ListWorkshopAttachmentsQuerySchema,
  UpdateWorkshopSessionInputSchema,
  UploadWorkshopAttachmentInputSchema,
  WorkshopMessageAttachmentSchema,
} from "@novel-studio/contracts";
import type { ProjectRepository } from "@novel-studio/storage";
import { exportWorkshopSessionMarkdown } from "../workshop/sessionExport.js";
import { parseWorkshopAttachmentUpload } from "./workshopAttachments.js";

interface WorkshopRecordRouteOptions {
  guardSessionLifecycle: <T>(
    seriesId: string,
    sessionId: string,
    mutation: () => Promise<T>,
  ) => Promise<T>;
}

export function registerWorkshopRecordRoutes(
  app: FastifyInstance,
  repository: ProjectRepository,
  options: WorkshopRecordRouteOptions,
): void {
  app.get<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions",
    async (request) => {
      let listed = await repository.listWorkshopSessionsWithDiagnostics(request.params.seriesId);
      if (listed.diagnostics.length === 0) {
        await repository.migrateWorkshopSessionsToV3(request.params.seriesId);
        listed = await repository.listWorkshopSessionsWithDiagnostics(request.params.seriesId);
      }
      return listed;
    },
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
      const session = await repository.getWorkshopSession(request.params.seriesId, request.params.sessionId);
      const agentRuns = session.kind === "agent"
        ? await repository.reconcileWorkshopAgentRuns(request.params.seriesId, request.params.sessionId)
        : { runs: [], diagnostics: [] };
      const [basket, messages, attachments, researchEvidence] = await Promise.all([
        repository.getWorkshopContextBasket(request.params.seriesId, request.params.sessionId),
        repository.listWorkshopMessages(request.params.seriesId, request.params.sessionId),
        repository.listWorkshopAttachments(request.params.seriesId, request.params.sessionId),
        repository.listWorkshopResearchEvidence(request.params.seriesId, request.params.sessionId),
      ]);
      return { session, basket, messages, attachments, agentRuns, researchEvidence };
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
      return options.guardSessionLifecycle(
        request.params.seriesId,
        request.params.sessionId,
        () => repository.updateWorkshopSession(
          request.params.seriesId,
          request.params.sessionId,
          input,
        ),
      );
    },
  );

  app.delete<{ Params: { seriesId: string; sessionId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions/:sessionId",
    async (request) => DeleteWorkshopSessionResultSchema.parse(
      await options.guardSessionLifecycle(
        request.params.seriesId,
        request.params.sessionId,
        () => repository.deleteWorkshopSession(request.params.seriesId, request.params.sessionId),
      ),
    ),
  );

  app.post<{ Params: { seriesId: string; sessionId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions/:sessionId/archive",
    async (request) =>
      options.guardSessionLifecycle(
        request.params.seriesId,
        request.params.sessionId,
        () => repository.archiveWorkshopSession(request.params.seriesId, request.params.sessionId),
      ),
  );

  app.post<{ Params: { seriesId: string; sessionId: string } }>(
    "/api/v1/series/:seriesId/workshop/sessions/:sessionId/restore",
    async (request) =>
      options.guardSessionLifecycle(
        request.params.seriesId,
        request.params.sessionId,
        () => repository.restoreWorkshopSession(request.params.seriesId, request.params.sessionId),
      ),
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
      options.guardSessionLifecycle(
        request.params.seriesId,
        request.params.sessionId,
        () => repository.deleteWorkshopMessage(
          request.params.seriesId,
          request.params.sessionId,
          request.params.messageId,
        ),
      ),
  );
}
