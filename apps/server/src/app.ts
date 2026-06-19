import { access } from "node:fs/promises";
import path from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import {
  CreateSceneInputSchema,
  CreateSeriesInputSchema,
  UpdateSceneInputSchema,
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

  app.post<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/index/rebuild",
    async (request) => repository.rebuildIndex(request.params.seriesId),
  );

  app.get<{ Params: { seriesId: string }; Querystring: { q?: string } }>(
    "/api/v1/series/:seriesId/search",
    async (request) => repository.search(request.params.seriesId, request.query.q ?? ""),
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
