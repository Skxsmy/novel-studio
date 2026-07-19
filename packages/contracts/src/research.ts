import { z } from "zod";

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const SAFE_SOURCE_FILE_NAME_PATTERN = /^[^\\/\u0000-\u001f\u007f]+$/u;
const BCP47_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u;

export const MAX_RESEARCH_SOURCE_BYTES = 5 * 1024 * 1024;

export const ResearchDatabaseSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(4000).default(""),
  linkedSeriesIds: z.array(z.string().uuid()).max(100).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).superRefine((database, context) => {
  if (new Set(database.linkedSeriesIds).size !== database.linkedSeriesIds.length) {
    context.addIssue({ code: "custom", message: "Linked Series IDs must be unique", path: ["linkedSeriesIds"] });
  }
});
export type ResearchDatabase = z.infer<typeof ResearchDatabaseSchema>;

export const ResearchDatabaseDocumentSchema = z.object({
  database: ResearchDatabaseSchema,
  revision: z.string().regex(SHA256_PATTERN),
});
export type ResearchDatabaseDocument = z.infer<typeof ResearchDatabaseDocumentSchema>;

export const ResearchDatabaseSummarySchema = ResearchDatabaseDocumentSchema.extend({
  sourceCount: z.number().int().nonnegative(),
});
export type ResearchDatabaseSummary = z.infer<typeof ResearchDatabaseSummarySchema>;

export const ResearchDatabaseIssueSchema = z.object({
  directoryName: z.string().min(1).max(240),
  code: z.literal("invalid-authority"),
  message: z.string().min(1).max(500),
});
export type ResearchDatabaseIssue = z.infer<typeof ResearchDatabaseIssueSchema>;

export const ResearchDatabaseListResultSchema = z.object({
  databases: z.array(ResearchDatabaseSummarySchema),
  issues: z.array(ResearchDatabaseIssueSchema),
});
export type ResearchDatabaseListResult = z.infer<typeof ResearchDatabaseListResultSchema>;

export const CreateResearchDatabaseInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(4000).optional(),
});
export type CreateResearchDatabaseInput = z.infer<typeof CreateResearchDatabaseInputSchema>;

export const UpdateResearchDatabaseInputSchema = z.object({
  baseRevision: z.string().regex(SHA256_PATTERN),
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(4000).optional(),
  linkedSeriesIds: z.array(z.string().uuid()).max(100).optional(),
}).superRefine((input, context) => {
  if (Object.keys(input).every((key) => key === "baseRevision")) {
    context.addIssue({ code: "custom", message: "At least one Research Database property is required" });
  }
  if (input.linkedSeriesIds && new Set(input.linkedSeriesIds).size !== input.linkedSeriesIds.length) {
    context.addIssue({ code: "custom", message: "Linked Series IDs must be unique", path: ["linkedSeriesIds"] });
  }
});
export type UpdateResearchDatabaseInput = z.infer<typeof UpdateResearchDatabaseInputSchema>;

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

const ResearchSourceFactsSchema = z.object({
  id: z.string().uuid(),
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
});

export const LegacyResearchSourceSchema = ResearchSourcePropertiesSchema.and(ResearchSourceFactsSchema.extend({
  schemaVersion: z.literal(1),
  seriesId: z.string().uuid(),
}));
export type LegacyResearchSource = z.infer<typeof LegacyResearchSourceSchema>;

export const ResearchSourceLegacyOriginSchema = z.object({
  seriesId: z.string().uuid(),
  sourceId: z.string().uuid(),
  sourceRevision: z.string().regex(SHA256_PATTERN),
});
export type ResearchSourceLegacyOrigin = z.infer<typeof ResearchSourceLegacyOriginSchema>;

export const ResearchSourceSchema = ResearchSourcePropertiesSchema.and(ResearchSourceFactsSchema.extend({
  schemaVersion: z.literal(2),
  researchDatabaseId: z.string().uuid(),
  legacyOrigin: ResearchSourceLegacyOriginSchema.optional(),
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

export const LegacyResearchSourceGroupSchema = z.object({
  seriesId: z.string().uuid(),
  seriesTitle: z.string().min(1).max(240),
  sourceCount: z.number().int().positive(),
  migratedResearchDatabaseIds: z.array(z.string().uuid()).default([]),
});
export type LegacyResearchSourceGroup = z.infer<typeof LegacyResearchSourceGroupSchema>;

export const ResearchLegacyMigrationResultSchema = z.object({
  researchDatabaseId: z.string().uuid(),
  seriesId: z.string().uuid(),
  importedSourceIds: z.array(z.string().uuid()),
  skippedDuplicateSourceIds: z.array(z.string().uuid()),
});
export type ResearchLegacyMigrationResult = z.infer<typeof ResearchLegacyMigrationResultSchema>;
