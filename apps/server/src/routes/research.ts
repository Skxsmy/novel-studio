import { createHash } from "node:crypto";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import {
  ImportResearchSourceInputSchema,
  ResearchSourceDetailSchema,
  ResearchSourceDocumentSchema,
  ResearchSourcePropertiesSchema,
  UpdateResearchSourceInputSchema,
  type ResearchSourceKind,
  type ResearchSourceMediaType,
} from "@novel-studio/contracts";
import { ProjectRepository, StorageError } from "@novel-studio/storage";

const RESEARCH_UPLOAD_BODY_LIMIT = 8 * 1024 * 1024;

function classifySource(fileName: string, mediaType: ResearchSourceMediaType): ResearchSourceKind {
  const extension = path.extname(fileName).toLocaleLowerCase("en-US");
  if (extension === ".txt" && mediaType === "text/plain") return "txt";
  if (extension === ".md" && mediaType === "text/markdown") return "markdown";
  throw new StorageError("Research source extension and media type do not match a supported format", "INVALID_DATA", {
    extension,
    mediaType,
  });
}
function decodeVerifiedUtf8(contentBase64: string, declaredSize: number): { bytes: Buffer; text: string } {
  const bytes = Buffer.from(contentBase64, "base64");
  if (bytes.toString("base64") !== contentBase64 || bytes.byteLength !== declaredSize) {
    throw new StorageError("Research source base64 or declared byte count is invalid", "INVALID_DATA", {
      declaredSize,
      actualSize: bytes.byteLength,
    });
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new StorageError("Research source must contain valid UTF-8 text", "INVALID_DATA");
  }
  if (!text.trim()) {
    throw new StorageError("Research source is empty", "INVALID_DATA");
  }
  if (!Buffer.from(text, "utf8").equals(bytes)) {
    throw new StorageError("Research source UTF-8 bytes cannot be preserved exactly", "INVALID_DATA");
  }
  return { bytes, text };
}

function defaultDisplayName(fileName: string): string {
  return path.basename(fileName, path.extname(fileName)).trim() || fileName;
}

export function registerResearchRoutes(app: FastifyInstance, repository: ProjectRepository): void {
  app.get<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/research/sources",
    async (request) => ResearchSourceDocumentSchema.array().parse(
      await repository.listResearchSources(request.params.seriesId),
    ),
  );

  app.get<{ Params: { seriesId: string; sourceId: string } }>(
    "/api/v1/series/:seriesId/research/sources/:sourceId",
    async (request) => ResearchSourceDetailSchema.parse(
      await repository.getResearchSource(request.params.seriesId, request.params.sourceId),
    ),
  );

  app.post<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/research/sources",
    { bodyLimit: RESEARCH_UPLOAD_BODY_LIMIT },
    async (request, reply) => {
      const input = ImportResearchSourceInputSchema.parse(request.body);
      const kind = classifySource(input.fileName, input.mediaType);
      const { bytes, text } = decodeVerifiedUtf8(input.contentBase64, input.sizeBytes);
      const properties = ResearchSourcePropertiesSchema.parse({
        displayName: input.displayName ?? defaultDisplayName(input.fileName),
        author: input.author,
        declaredLanguage: input.declaredLanguage,
        tags: input.tags,
        aiPermission: input.aiPermission,
        useNotes: input.useNotes,
      });
      const source = await repository.importResearchSource(request.params.seriesId, {
        kind,
        mediaType: input.mediaType,
        originalFileName: input.fileName,
        originalText: text,
        sizeBytes: bytes.byteLength,
        contentHash: createHash("sha256").update(bytes).digest("hex"),
        properties,
      });
      return reply.status(201).send(ResearchSourceDetailSchema.parse(source));
    },
  );

  app.put<{ Params: { seriesId: string; sourceId: string } }>(
    "/api/v1/series/:seriesId/research/sources/:sourceId",
    async (request) => ResearchSourceDetailSchema.parse(
      await repository.updateResearchSource(
        request.params.seriesId,
        request.params.sourceId,
        UpdateResearchSourceInputSchema.parse(request.body),
      ),
    ),
  );
}
