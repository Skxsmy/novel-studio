import { access } from "node:fs/promises";
import path from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import {
  CreateActInputSchema,
  CreateChapterInputSchema,
  CreateSceneInputSchema,
  CreateSeriesInputSchema,
  CreateTimelineEventInputSchema,
  DeleteTimelineEventInputSchema,
  MoveSceneInputSchema,
  ReorderInputSchema,
  UpdateActInputSchema,
  UpdateChapterInputSchema,
  UpdateScenePlanningInputSchema,
  UpdateSceneInputSchema,
  UpdateTimelineEventInputSchema,
} from "@novel-studio/contracts";
import { ProjectRepository, StorageError } from "@novel-studio/storage";

export interface BuildAppOptions {
  libraryRoot: string;
  webRoot?: string;
  logger?: boolean;
}

function errorStatus(error: StorageError): number {
  switch (error.code) {
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "INVALID_DATA":
      return 422;
    case "PATH_ESCAPE":
      return 403;
  }
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });
  const repository = new ProjectRepository(options.libraryRoot);
  await repository.initialize();

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof StorageError) {
      void reply.status(errorStatus(error)).send({
        code: error.code,
        message: error.message,
        details: error.details,
      });
      return;
    }
    if (error instanceof Error && error.name === "ZodError") {
      void reply.status(400).send({
        code: "VALIDATION_ERROR",
        message: "请求数据无效",
        details: error,
      });
      return;
    }
    app.log.error(error);
    void reply.status(500).send({ code: "INTERNAL_ERROR", message: "服务器内部错误" });
  });

  app.get("/api/v1/health", async () => ({
    ok: true,
    version: "0.1.0",
    libraryRoot: repository.libraryRoot,
  }));

  app.get("/api/v1/system/config", async () => ({
    initialized: true,
    libraryRoot: repository.libraryRoot,
    backupRoot: null,
    bindAddress: "127.0.0.1",
  }));

  app.get("/api/v1/series", async () => repository.listSeries());

  app.post("/api/v1/series", async (request, reply) => {
    const input = CreateSeriesInputSchema.parse(request.body);
    const created = await repository.createSeries(input);
    return reply.status(201).send(created);
  });

  app.get<{ Params: { seriesId: string } }>("/api/v1/series/:seriesId", async (request) =>
    repository.getSeries(request.params.seriesId),
  );

  app.get<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/hierarchy/validate",
    async (request) => repository.validateHierarchy(request.params.seriesId),
  );

  app.get<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/planning",
    async (request) => repository.getPlanningBoard(request.params.seriesId),
  );

  app.post<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/scenes",
    async (request, reply) => {
      const input = CreateSceneInputSchema.parse(request.body);
      const scene = await repository.createScene(request.params.seriesId, input);
      return reply.status(201).send(scene);
    },
  );

  app.get<{ Params: { seriesId: string; sceneId: string } }>(
    "/api/v1/series/:seriesId/scenes/:sceneId",
    async (request) => repository.getScene(request.params.seriesId, request.params.sceneId),
  );

  app.put<{ Params: { seriesId: string; sceneId: string } }>(
    "/api/v1/series/:seriesId/scenes/:sceneId",
    async (request) => {
      const input = UpdateSceneInputSchema.parse(request.body);
      return repository.updateScene(request.params.seriesId, request.params.sceneId, input);
    },
  );

  app.patch<{ Params: { seriesId: string; sceneId: string } }>(
    "/api/v1/series/:seriesId/scenes/:sceneId/planning",
    async (request) => {
      const input = UpdateScenePlanningInputSchema.parse(request.body);
      return repository.updateScenePlanning(request.params.seriesId, request.params.sceneId, input);
    },
  );

  app.post<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/timeline/events",
    async (request, reply) => {
      const input = CreateTimelineEventInputSchema.parse(request.body);
      return reply.status(201).send(
        await repository.createTimelineEvent(request.params.seriesId, input),
      );
    },
  );

  app.put<{ Params: { seriesId: string; eventId: string } }>(
    "/api/v1/series/:seriesId/timeline/events/:eventId",
    async (request) => {
      const input = UpdateTimelineEventInputSchema.parse(request.body);
      return repository.updateTimelineEvent(
        request.params.seriesId,
        request.params.eventId,
        input,
      );
    },
  );

  app.delete<{ Params: { seriesId: string; eventId: string } }>(
    "/api/v1/series/:seriesId/timeline/events/:eventId",
    async (request) => {
      const input = DeleteTimelineEventInputSchema.parse(request.body);
      return repository.deleteTimelineEvent(
        request.params.seriesId,
        request.params.eventId,
        input,
      );
    },
  );

  app.post<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/timeline/events/reorder",
    async (request) => {
      const input = ReorderInputSchema.parse(request.body);
      return repository.reorderTimelineEvents(request.params.seriesId, input);
    },
  );

  app.post<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/index/rebuild",
    async (request) => repository.rebuildIndex(request.params.seriesId),
  );

  app.get<{ Params: { seriesId: string }; Querystring: { q?: string } }>(
    "/api/v1/series/:seriesId/search",
    async (request) => repository.search(request.params.seriesId, request.query.q ?? ""),
  );

  // --- Acts ---
  app.get<{ Params: { seriesId: string; bookId: string } }>(
    "/api/v1/series/:seriesId/books/:bookId/acts",
    async (request) => repository.listActs(request.params.seriesId, request.params.bookId),
  );

  app.post<{ Params: { seriesId: string; bookId: string } }>(
    "/api/v1/series/:seriesId/books/:bookId/acts",
    async (request, reply) => {
      const input = CreateActInputSchema.parse(request.body);
      return reply.status(201).send(
        await repository.createAct(request.params.seriesId, request.params.bookId, input),
      );
    },
  );

  app.get<{ Params: { seriesId: string; actId: string } }>(
    "/api/v1/series/:seriesId/acts/:actId",
    async (request) => repository.getAct(request.params.seriesId, request.params.actId),
  );

  app.put<{ Params: { seriesId: string; actId: string } }>(
    "/api/v1/series/:seriesId/acts/:actId",
    async (request) => {
      const input = UpdateActInputSchema.parse(request.body);
      return repository.updateAct(request.params.seriesId, request.params.actId, input);
    },
  );

  app.post<{ Params: { seriesId: string; bookId: string } }>(
    "/api/v1/series/:seriesId/books/:bookId/acts/reorder",
    async (request) => {
      const input = ReorderInputSchema.parse(request.body);
      return repository.reorderActs(request.params.seriesId, request.params.bookId, input);
    },
  );

  // --- Chapters ---
  app.get<{ Params: { seriesId: string; actId: string } }>(
    "/api/v1/series/:seriesId/acts/:actId/chapters",
    async (request) => repository.listChapters(request.params.seriesId, request.params.actId),
  );

  app.post<{ Params: { seriesId: string; actId: string } }>(
    "/api/v1/series/:seriesId/acts/:actId/chapters",
    async (request, reply) => {
      const input = CreateChapterInputSchema.parse(request.body);
      return reply.status(201).send(
        await repository.createChapter(request.params.seriesId, request.params.actId, input),
      );
    },
  );

  app.get<{ Params: { seriesId: string; chapterId: string } }>(
    "/api/v1/series/:seriesId/chapters/:chapterId",
    async (request) =>
      repository.getChapter(request.params.seriesId, request.params.chapterId),
  );

  app.put<{ Params: { seriesId: string; chapterId: string } }>(
    "/api/v1/series/:seriesId/chapters/:chapterId",
    async (request) => {
      const input = UpdateChapterInputSchema.parse(request.body);
      return repository.updateChapter(request.params.seriesId, request.params.chapterId, input);
    },
  );

  app.post<{ Params: { seriesId: string; actId: string } }>(
    "/api/v1/series/:seriesId/acts/:actId/chapters/reorder",
    async (request) => {
      const input = ReorderInputSchema.parse(request.body);
      return repository.reorderChapters(request.params.seriesId, request.params.actId, input);
    },
  );

  // --- Scene Movement ---
  app.post<{ Params: { seriesId: string; sceneId: string } }>(
    "/api/v1/series/:seriesId/scenes/:sceneId/move",
    async (request) => {
      const input = MoveSceneInputSchema.parse(request.body);
      return repository.moveScene(request.params.seriesId, request.params.sceneId, input);
    },
  );

  app.post<{ Params: { seriesId: string; chapterId: string } }>(
    "/api/v1/series/:seriesId/chapters/:chapterId/scenes/reorder",
    async (request) => {
      const input = ReorderInputSchema.parse(request.body);
      return repository.reorderScenes(request.params.seriesId, request.params.chapterId, input);
    },
  );

  // --- Migration ---
  app.post<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/migrate",
    async (request) => repository.migrateToManifests(request.params.seriesId),
  );

  if (options.webRoot) {
    try {
      await access(path.join(options.webRoot, "index.html"));
      await app.register(fastifyStatic, { root: options.webRoot });
      app.setNotFoundHandler((request, reply) => {
        if (request.url.startsWith("/api/")) {
          void reply.status(404).send({ code: "NOT_FOUND", message: "API 不存在" });
          return;
        }
        void reply.sendFile("index.html");
      });
    } catch {
      // Development uses the Vite server and has no built web assets yet.
    }
  }

  return app;
}
