import { createHash } from "node:crypto";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import type { EmbeddingRouter } from "@novel-studio/ai";
import {
  CreateResearchDatabaseInputSchema,
  ImportResearchSourceInputSchema,
  ImportResearchWebSourceInputSchema,
  LegacyResearchSourceGroupSchema,
  MigrateResearchSourcesV2InputSchema,
  ResearchDatabaseDocumentSchema,
  ResearchDatabaseListResultSchema,
  ResearchIndexStateSchema,
  ResearchEmbeddingCapabilityDocumentSchema,
  ResearchEmbeddingCapabilityStateSchema,
  ResearchKeywordSearchInputSchema,
  ResearchKeywordSearchResponseSchema,
  ResearchMultiSearchInputSchema,
  ResearchMultiSearchResponseSchema,
  ResearchQueryExpansionDocumentSchema,
  ResearchLegacyMigrationResultSchema,
  ResearchSourceContentPageQuerySchema,
  ResearchSourceContentPageSchema,
  ResearchSourceDocumentSchema,
  ResearchSourcePropertiesSchema,
  ResearchSourceViewSchema,
  ResearchSourceV2MigrationResultSchema,
  ResearchVectorIndexStateSchema,
  UpdateResearchQueryExpansionsInputSchema,
  UpdateResearchDatabaseInputSchema,
  UpdateResearchSourceInputSchema,
  ValidateResearchEmbeddingCapabilityInputSchema,
} from "@novel-studio/contracts";
import { ProjectRepository } from "@novel-studio/storage";
import { parseResearchFile, parseResearchWebSnapshot } from "../researchParsers.js";
import { acquireResearchWebPage } from "../researchWebImport.js";
import type { AcquiredResearchWebPage } from "../researchWebImport.js";
import {
  getResearchEmbeddingCapabilityState,
  getResearchVectorIndexState,
  rebuildResearchDatabaseVectorIndex,
  searchResearchDatabases,
  validateBoundResearchEmbeddingCapability,
} from "../researchRetrieval.js";

const RESEARCH_UPLOAD_BODY_LIMIT = 36 * 1024 * 1024;

function defaultDisplayName(fileName: string): string {
  return path.basename(fileName, path.extname(fileName)).trim() || fileName;
}

export interface ResearchRouteOptions {
  acquireWebPage?: (url: string) => Promise<AcquiredResearchWebPage>;
  embeddingRouter: EmbeddingRouter;
}

export function registerResearchRoutes(
  app: FastifyInstance,
  repository: ProjectRepository,
  options: ResearchRouteOptions,
): void {
  const acquireWebPage = options.acquireWebPage ?? acquireResearchWebPage;
  app.get(
    "/api/v1/research/databases",
    async () => ResearchDatabaseListResultSchema.parse(await repository.listResearchDatabases()),
  );

  app.post(
    "/api/v1/research/databases",
    async (request, reply) => reply.status(201).send(ResearchDatabaseDocumentSchema.parse(
      await repository.createResearchDatabase(CreateResearchDatabaseInputSchema.parse(request.body)),
    )),
  );

  app.get<{ Params: { databaseId: string } }>(
    "/api/v1/research/databases/:databaseId",
    async (request) => ResearchDatabaseDocumentSchema.parse(
      await repository.getResearchDatabase(request.params.databaseId),
    ),
  );

  app.put<{ Params: { databaseId: string } }>(
    "/api/v1/research/databases/:databaseId",
    async (request) => ResearchDatabaseDocumentSchema.parse(
      await repository.updateResearchDatabase(
        request.params.databaseId,
        UpdateResearchDatabaseInputSchema.parse(request.body),
      ),
    ),
  );

  app.get<{ Params: { databaseId: string } }>(
    "/api/v1/research/databases/:databaseId/query-expansions",
    async (request) => ResearchQueryExpansionDocumentSchema.parse(
      await repository.getResearchQueryExpansions(request.params.databaseId),
    ),
  );

  app.put<{ Params: { databaseId: string } }>(
    "/api/v1/research/databases/:databaseId/query-expansions",
    async (request) => ResearchQueryExpansionDocumentSchema.parse(
      await repository.updateResearchQueryExpansions(
        request.params.databaseId,
        UpdateResearchQueryExpansionsInputSchema.parse(request.body),
      ),
    ),
  );

  app.get(
    "/api/v1/research/embedding-capability",
    async () => ResearchEmbeddingCapabilityStateSchema.parse(
      await getResearchEmbeddingCapabilityState(repository, options.embeddingRouter),
    ),
  );

  app.post(
    "/api/v1/research/embedding-capability/validate",
    async (request) => ResearchEmbeddingCapabilityDocumentSchema.parse(
      await validateBoundResearchEmbeddingCapability(
        repository,
        options.embeddingRouter,
        ValidateResearchEmbeddingCapabilityInputSchema.parse(request.body),
      ),
    ),
  );

  app.get(
    "/api/v1/research/legacy-sources",
    async () => LegacyResearchSourceGroupSchema.array().parse(await repository.listLegacyResearchSourceGroups()),
  );

  app.post<{ Params: { databaseId: string; seriesId: string } }>(
    "/api/v1/research/databases/:databaseId/migrations/series/:seriesId",
    async (request) => ResearchLegacyMigrationResultSchema.parse(
      await repository.migrateLegacyResearchSources(request.params.databaseId, request.params.seriesId),
    ),
  );

  app.get<{ Params: { databaseId: string } }>(
    "/api/v1/research/databases/:databaseId/sources",
    async (request) => ResearchSourceDocumentSchema.array().parse(
      await repository.listResearchSources(request.params.databaseId),
    ),
  );

  app.post<{ Params: { databaseId: string } }>(
    "/api/v1/research/databases/:databaseId/sources/web",
    async (request, reply) => {
      const input = ImportResearchWebSourceInputSchema.parse(request.body);
      const acquired = await acquireWebPage(input.url);
      const parsed = parseResearchWebSnapshot(acquired.bytes, acquired.origin.finalUrl);
      const snapshot = parsed.sanitizedSnapshot;
      if (!snapshot) throw new Error("Sanitized web snapshot was not produced");
      const properties = ResearchSourcePropertiesSchema.parse({
        displayName: (input.displayName ?? parsed.title) || new URL(acquired.origin.finalUrl).hostname,
        author: input.author,
        declaredLanguage: input.declaredLanguage,
        tags: input.tags,
        aiPermission: input.aiPermission,
        useNotes: input.useNotes,
      });
      const hostname = new URL(acquired.origin.finalUrl).hostname.replace(/[^A-Za-z0-9.-]/gu, "-").slice(0, 180);
      const source = await repository.importResearchSource(request.params.databaseId, {
        kind: "web-snapshot",
        mediaType: "text/html",
        originalFileName: `${hostname || "web-snapshot"}.html`,
        originalBytes: snapshot,
        sizeBytes: snapshot.byteLength,
        contentHash: createHash("sha256").update(snapshot).digest("hex"),
        properties,
        origin: acquired.origin,
        content: {
          title: parsed.title,
          parserName: parsed.parserName,
          parserVersion: parsed.parserVersion,
          warnings: parsed.warnings,
          sections: parsed.sections,
          blocks: parsed.blocks,
        },
      });
      return reply.status(201).send(ResearchSourceViewSchema.parse(
        await repository.getResearchSourceView(request.params.databaseId, source.source.id),
      ));
    },
  );

  app.get<{ Params: { databaseId: string } }>(
    "/api/v1/research/databases/:databaseId/vector-index",
    async (request) => ResearchVectorIndexStateSchema.parse(
      await getResearchVectorIndexState(repository, options.embeddingRouter, request.params.databaseId),
    ),
  );

  app.post<{ Params: { databaseId: string } }>(
    "/api/v1/research/databases/:databaseId/vector-index/rebuild",
    async (request) => ResearchVectorIndexStateSchema.parse(
      await rebuildResearchDatabaseVectorIndex(repository, options.embeddingRouter, request.params.databaseId),
    ),
  );

  app.get<{ Params: { databaseId: string; sourceId: string } }>(
    "/api/v1/research/databases/:databaseId/sources/:sourceId",
    async (request) => ResearchSourceViewSchema.parse(
      await repository.getResearchSourceView(request.params.databaseId, request.params.sourceId),
    ),
  );

  app.get<{
    Params: { databaseId: string; sourceId: string };
    Querystring: { offset?: string | number; limit?: string | number };
  }>(
    "/api/v1/research/databases/:databaseId/sources/:sourceId/content",
    async (request) => ResearchSourceContentPageSchema.parse(
      await repository.getResearchSourceContentPage(
        request.params.databaseId,
        request.params.sourceId,
        ResearchSourceContentPageQuerySchema.parse(request.query),
      ),
    ),
  );

  app.post<{ Params: { databaseId: string } }>(
    "/api/v1/research/databases/:databaseId/sources",
    { bodyLimit: RESEARCH_UPLOAD_BODY_LIMIT },
    async (request, reply) => {
      const input = ImportResearchSourceInputSchema.parse(request.body);
      const imported = await parseResearchFile({
        contentBase64: input.contentBase64,
        fileName: input.fileName,
        mediaType: input.mediaType,
        sizeBytes: input.sizeBytes,
      });
      const properties = ResearchSourcePropertiesSchema.parse({
        displayName: (input.displayName ?? imported.parsed.title) || defaultDisplayName(input.fileName),
        author: input.author,
        declaredLanguage: input.declaredLanguage,
        tags: input.tags,
        aiPermission: input.aiPermission,
        useNotes: input.useNotes,
      });
      const source = await repository.importResearchSource(request.params.databaseId, {
        kind: imported.parsed.kind,
        mediaType: input.mediaType,
        originalFileName: input.fileName,
        originalBytes: imported.bytes,
        sizeBytes: imported.bytes.byteLength,
        contentHash: imported.contentHash,
        properties,
        origin: { type: "file" },
        content: {
          title: imported.parsed.title,
          parserName: imported.parsed.parserName,
          parserVersion: imported.parsed.parserVersion,
          warnings: imported.parsed.warnings,
          sections: imported.parsed.sections,
          blocks: imported.parsed.blocks,
        },
      });
      return reply.status(201).send(ResearchSourceViewSchema.parse(
        await repository.getResearchSourceView(request.params.databaseId, source.source.id),
      ));
    },
  );

  app.post(
    "/api/v1/research/search",
    async (request) => ResearchMultiSearchResponseSchema.parse(
      await searchResearchDatabases(
        repository,
        options.embeddingRouter,
        ResearchMultiSearchInputSchema.parse(request.body),
      ),
    ),
  );

  app.put<{ Params: { databaseId: string; sourceId: string } }>(
    "/api/v1/research/databases/:databaseId/sources/:sourceId",
    async (request) => {
      const updated = await repository.updateResearchSource(
        request.params.databaseId,
        request.params.sourceId,
        UpdateResearchSourceInputSchema.parse(request.body),
      );
      return ResearchSourceViewSchema.parse(
        await repository.getResearchSourceView(request.params.databaseId, updated.source.id),
      );
    },
  );

  app.get<{ Params: { databaseId: string } }>(
    "/api/v1/research/databases/:databaseId/index",
    async (request) => ResearchIndexStateSchema.parse(
      await repository.getResearchIndexState(request.params.databaseId),
    ),
  );

  app.post<{ Params: { databaseId: string } }>(
    "/api/v1/research/databases/:databaseId/index/rebuild",
    async (request) => ResearchIndexStateSchema.parse(
      await repository.rebuildResearchDatabaseIndex(request.params.databaseId),
    ),
  );

  app.post<{ Params: { databaseId: string } }>(
    "/api/v1/research/databases/:databaseId/search",
    async (request) => ResearchKeywordSearchResponseSchema.parse(
      await repository.searchResearchSources(
        request.params.databaseId,
        ResearchKeywordSearchInputSchema.parse(request.body),
      ),
    ),
  );

  app.post<{ Params: { databaseId: string } }>(
    "/api/v1/research/databases/:databaseId/migrations/source-v3",
    async (request) => ResearchSourceV2MigrationResultSchema.parse(
      await repository.migrateResearchSourcesV2(
        request.params.databaseId,
        MigrateResearchSourcesV2InputSchema.parse(request.body),
      ),
    ),
  );
}
