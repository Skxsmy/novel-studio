import { z } from "zod";

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const SAFE_SOURCE_FILE_NAME_PATTERN = /^[^\\/\u0000-\u001f\u007f]+$/u;
const BCP47_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u;

export const MAX_RESEARCH_SOURCE_BYTES = 5 * 1024 * 1024;

export const ResearchSourceKindSchema = z.enum(["txt", "markdown"]);
export type ResearchSourceKind = z.infer<typeof ResearchSourceKindSchema>;

export const ResearchSourceMediaTypeSchema = z.enum(["text/plain", "text/markdown"]);
export type ResearchSourceMediaType = z.infer<typeof ResearchSourceMediaTypeSchema>;

export const ResearchSourceAiPermissionSchema = z.enum(["never", "allowed"]);
export type ResearchSourceAiPermission = z.infer<typeof ResearchSourceAiPermissionSchema>;

export const ResearchSourceParseStatusSchema = z.literal("parsed");
export type ResearchSourceParseStatus = z.infer<typeof ResearchSourceParseStatusSchema>;

export const ResearchSourcePropertiesSchema = z.object({
  displayName: z.string().trim().min(1).max(240),
  author: z.string().trim().max(240).default(""),
  declaredLanguage: z.string().trim().regex(BCP47_PATTERN).max(64).nullable().default(null),
  tags: z.array(z.string().trim().min(1).max(80)).max(40).default([]),
  aiPermission: ResearchSourceAiPermissionSchema.default("never"),
  useNotes: z.string().max(8000).default(""),
}).superRefine((properties, context) => {
  const normalized = properties.tags.map((tag) => tag.toLocaleLowerCase("und"));
  if (new Set(normalized).size !== normalized.length) {
    context.addIssue({ code: "custom", message: "Research source tags must be unique", path: ["tags"] });
  }
});
export type ResearchSourceProperties = z.infer<typeof ResearchSourcePropertiesSchema>;

export const ResearchSourceSchema = ResearchSourcePropertiesSchema.and(z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  seriesId: z.string().uuid(),
  kind: ResearchSourceKindSchema,
  mediaType: ResearchSourceMediaTypeSchema,
  originalFileName: z.string().trim().min(1).max(240).regex(SAFE_SOURCE_FILE_NAME_PATTERN),
  sizeBytes: z.number().int().positive().max(MAX_RESEARCH_SOURCE_BYTES),
  contentHash: z.string().regex(SHA256_PATTERN),
  originalRelativePath: z.string().min(1).max(512),
  parseStatus: ResearchSourceParseStatusSchema,
  parserName: z.literal("plain-text"),
  parserVersion: z.literal(1),
  importedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}));
export type ResearchSource = z.infer<typeof ResearchSourceSchema>;

export const ResearchSourceDocumentSchema = z.object({
  source: ResearchSourceSchema,
  revision: z.string().regex(SHA256_PATTERN),
});
export type ResearchSourceDocument = z.infer<typeof ResearchSourceDocumentSchema>;

export const ResearchSourceDetailSchema = ResearchSourceDocumentSchema.extend({
  originalText: z.string(),
});
export type ResearchSourceDetail = z.infer<typeof ResearchSourceDetailSchema>;

export const ImportResearchSourceInputSchema = z.object({
  fileName: z.string().trim().min(1).max(240).regex(SAFE_SOURCE_FILE_NAME_PATTERN),
  mediaType: ResearchSourceMediaTypeSchema,
  sizeBytes: z.number().int().positive().max(MAX_RESEARCH_SOURCE_BYTES),
  contentBase64: z.string().min(4).max(Math.ceil(MAX_RESEARCH_SOURCE_BYTES / 3) * 4).regex(BASE64_PATTERN),
  displayName: z.string().trim().min(1).max(240).optional(),
  author: z.string().trim().max(240).optional(),
  declaredLanguage: z.string().trim().regex(BCP47_PATTERN).max(64).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
  aiPermission: ResearchSourceAiPermissionSchema.optional(),
  useNotes: z.string().max(8000).optional(),
});
export type ImportResearchSourceInput = z.infer<typeof ImportResearchSourceInputSchema>;

export const UpdateResearchSourceInputSchema = z.object({
  baseRevision: z.string().regex(SHA256_PATTERN),
  displayName: z.string().trim().min(1).max(240).optional(),
  author: z.string().trim().max(240).optional(),
  declaredLanguage: z.string().trim().regex(BCP47_PATTERN).max(64).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
  aiPermission: ResearchSourceAiPermissionSchema.optional(),
  useNotes: z.string().max(8000).optional(),
}).superRefine((input, context) => {
  if (Object.keys(input).every((key) => key === "baseRevision")) {
    context.addIssue({ code: "custom", message: "At least one Research source property is required" });
  }
  if (input.tags) {
    const normalized = input.tags.map((tag) => tag.toLocaleLowerCase("und"));
    if (new Set(normalized).size !== normalized.length) {
      context.addIssue({ code: "custom", message: "Research source tags must be unique", path: ["tags"] });
    }
  }
});
export type UpdateResearchSourceInput = z.infer<typeof UpdateResearchSourceInputSchema>;
