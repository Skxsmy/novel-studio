import { z } from "zod";

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_SOURCE_FILE_NAME_PATTERN = /^[^\\/\u0000-\u001f\u007f]+$/u;
const BCP47_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u;

function isCanonicalBase64Shape(value: string): boolean {
  if (value.length === 0 || value.length % 4 !== 0) return false;
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  const contentLength = value.length - padding;
  for (let index = 0; index < contentLength; index += 1) {
    const code = value.charCodeAt(index);
    const allowed = (code >= 48 && code <= 57)
      || (code >= 65 && code <= 90)
      || (code >= 97 && code <= 122)
      || code === 43
      || code === 47;
    if (!allowed) return false;
  }
  for (let index = contentLength; index < value.length; index += 1) {
    if (value.charCodeAt(index) !== 61) return false;
  }
  return padding === 0 || contentLength % 4 === 2 || (padding === 1 && contentLength % 4 === 3);
}

export const MAX_RESEARCH_SOURCE_BYTES = 25 * 1024 * 1024;

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

const LegacyResearchSourceKindSchema = z.enum(["txt", "markdown"]);

export const ResearchSourceKindSchema = z.enum([
  "txt",
  "markdown",
  "docx",
  "pdf",
  "epub",
  "html",
  "web-snapshot",
]);
export type ResearchSourceKind = z.infer<typeof ResearchSourceKindSchema>;

const LegacyResearchSourceMediaTypeSchema = z.enum(["text/plain", "text/markdown"]);

export const ResearchSourceMediaTypeSchema = z.enum([
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/pdf",
  "application/epub+zip",
  "text/html",
  "application/xhtml+xml",
]);
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

const ResearchSourceV2FactsSchema = z.object({
  id: z.string().uuid(),
  kind: LegacyResearchSourceKindSchema,
  mediaType: LegacyResearchSourceMediaTypeSchema,
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

export const LegacyResearchSourceSchema = ResearchSourcePropertiesSchema.and(ResearchSourceV2FactsSchema.extend({
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

export const ResearchSourceV2Schema = ResearchSourcePropertiesSchema.and(ResearchSourceV2FactsSchema.extend({
  schemaVersion: z.literal(2),
  researchDatabaseId: z.string().uuid(),
  legacyOrigin: ResearchSourceLegacyOriginSchema.optional(),
}));
export type ResearchSourceV2 = z.infer<typeof ResearchSourceV2Schema>;

export const ResearchLanguageAnalysisSchema = z.object({
  languageTag: z.string().regex(BCP47_PATTERN).max(64),
  source: z.enum(["declared", "detected"]),
  confidence: z.number().min(0).max(1),
  detectorVersion: z.string().min(1).max(80),
});
export type ResearchLanguageAnalysis = z.infer<typeof ResearchLanguageAnalysisSchema>;

export const ResearchLanguageSpanSchema = ResearchLanguageAnalysisSchema.extend({
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
}).refine((span) => span.end > span.start, {
  message: "Language span end must be greater than start",
});
export type ResearchLanguageSpan = z.infer<typeof ResearchLanguageSpanSchema>;

const ResearchSectionPathSchema = z.array(z.string().trim().min(1).max(240)).max(32).default([]);

export const ResearchSourceLocationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("text"),
    startLine: z.number().int().positive(),
    endLine: z.number().int().positive(),
    startOffset: z.number().int().nonnegative(),
    endOffset: z.number().int().positive(),
  }).refine((location) => location.endLine >= location.startLine && location.endOffset > location.startOffset, {
    message: "Text location range is invalid",
  }),
  z.object({
    kind: z.literal("docx"),
    sectionPath: ResearchSectionPathSchema,
    paragraph: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal("pdf"),
    page: z.number().int().positive(),
    paragraph: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal("epub"),
    spineIndex: z.number().int().nonnegative(),
    href: z.string().min(1).max(1024),
    sectionPath: ResearchSectionPathSchema,
    paragraph: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal("html"),
    domPath: z.string().min(1).max(2048),
    sectionPath: ResearchSectionPathSchema,
    paragraph: z.number().int().positive(),
    sourceUrl: z.string().url().max(4096).optional(),
  }),
]);
export type ResearchSourceLocation = z.infer<typeof ResearchSourceLocationSchema>;

const ResearchTextUnitBaseSchema = z.object({
  id: z.string().uuid(),
  order: z.number().int().nonnegative(),
  text: z.string().min(1).max(100_000),
  textHash: z.string().regex(SHA256_PATTERN),
  location: ResearchSourceLocationSchema,
  language: ResearchLanguageAnalysisSchema,
  languageSpans: z.array(ResearchLanguageSpanSchema).max(200),
});

export const ResearchSourceSectionSchema = z.object({
  id: z.string().uuid(),
  parentSectionId: z.string().uuid().nullable(),
  order: z.number().int().nonnegative(),
  title: z.string().trim().min(1).max(500),
  location: ResearchSourceLocationSchema,
});
export type ResearchSourceSection = z.infer<typeof ResearchSourceSectionSchema>;

export const ResearchSourceBlockSchema = ResearchTextUnitBaseSchema.extend({
  sectionId: z.string().uuid().nullable(),
  kind: z.enum(["heading", "paragraph", "list-item", "quote", "table-cell"]),
});
export type ResearchSourceBlock = z.infer<typeof ResearchSourceBlockSchema>;

export const ResearchSourceChunkSchema = ResearchTextUnitBaseSchema.extend({
  blockId: z.string().uuid(),
});
export type ResearchSourceChunk = z.infer<typeof ResearchSourceChunkSchema>;

export const ResearchSourceContentSchema = z.object({
  schemaVersion: z.literal(1),
  researchDatabaseId: z.string().uuid(),
  sourceId: z.string().uuid(),
  originalContentHash: z.string().regex(SHA256_PATTERN),
  parserName: z.string().min(1).max(120),
  parserVersion: z.number().int().positive(),
  title: z.string().trim().max(500),
  sections: z.array(ResearchSourceSectionSchema).max(20_000),
  blocks: z.array(ResearchSourceBlockSchema).min(1).max(100_000),
  chunks: z.array(ResearchSourceChunkSchema).min(1).max(100_000),
}).superRefine((content, context) => {
  const sectionIds = new Set(content.sections.map((section) => section.id));
  const blockIds = new Set(content.blocks.map((block) => block.id));
  const chunkIds = new Set(content.chunks.map((chunk) => chunk.id));
  if (sectionIds.size !== content.sections.length) {
    context.addIssue({ code: "custom", message: "Research section IDs must be unique", path: ["sections"] });
  }
  if (blockIds.size !== content.blocks.length) {
    context.addIssue({ code: "custom", message: "Research block IDs must be unique", path: ["blocks"] });
  }
  if (chunkIds.size !== content.chunks.length) {
    context.addIssue({ code: "custom", message: "Research chunk IDs must be unique", path: ["chunks"] });
  }
  for (const [index, section] of content.sections.entries()) {
    if (section.order !== index) {
      context.addIssue({ code: "custom", message: "Research sections must have contiguous order", path: ["sections", index, "order"] });
    }
    if (section.parentSectionId && !sectionIds.has(section.parentSectionId)) {
      context.addIssue({ code: "custom", message: "Research section parent does not exist", path: ["sections", index, "parentSectionId"] });
    }
  }
  for (const [index, block] of content.blocks.entries()) {
    if (block.order !== index) {
      context.addIssue({ code: "custom", message: "Research blocks must have contiguous order", path: ["blocks", index, "order"] });
    }
    if (block.sectionId && !sectionIds.has(block.sectionId)) {
      context.addIssue({ code: "custom", message: "Research block section does not exist", path: ["blocks", index, "sectionId"] });
    }
    validateTextUnit(block, context, ["blocks", index]);
  }
  const chunkOrderByBlock = new Map<string, number>();
  for (const [index, chunk] of content.chunks.entries()) {
    if (!blockIds.has(chunk.blockId)) {
      context.addIssue({ code: "custom", message: "Research chunk block does not exist", path: ["chunks", index, "blockId"] });
    }
    const expectedOrder = chunkOrderByBlock.get(chunk.blockId) ?? 0;
    if (chunk.order !== expectedOrder) {
      context.addIssue({ code: "custom", message: "Research chunks must have contiguous per-block order", path: ["chunks", index, "order"] });
    }
    chunkOrderByBlock.set(chunk.blockId, expectedOrder + 1);
    validateTextUnit(chunk, context, ["chunks", index]);
  }
});
export type ResearchSourceContent = z.infer<typeof ResearchSourceContentSchema>;

function validateTextUnit(
  unit: z.infer<typeof ResearchTextUnitBaseSchema>,
  context: z.RefinementCtx,
  path: Array<string | number>,
): void {
  let cursor = 0;
  for (const [spanIndex, span] of unit.languageSpans.entries()) {
    if (span.start !== cursor || span.end > unit.text.length) {
      context.addIssue({ code: "custom", message: "Research language spans must be contiguous and inside text", path: [...path, "languageSpans", spanIndex] });
      return;
    }
    cursor = span.end;
  }
  if (unit.languageSpans.length > 0 && cursor !== unit.text.length) {
    context.addIssue({ code: "custom", message: "Research language spans must cover the complete text", path: [...path, "languageSpans"] });
  }
}

const ResearchFileOriginSchema = z.object({ type: z.literal("file") });

const SafeWebUrlSchema = z.string().url().max(4096).superRefine((value, context) => {
  const url = new URL(value);
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) {
    context.addIssue({ code: "custom", message: "Research web URL must be credential-free HTTP or HTTPS" });
  }
});

export const ResearchWebOriginSchema = z.object({
  type: z.literal("web"),
  requestedUrl: SafeWebUrlSchema,
  finalUrl: SafeWebUrlSchema,
  redirectChain: z.array(SafeWebUrlSchema).max(5),
  fetchedAt: z.string().datetime(),
  responseMediaType: z.enum(["text/html", "application/xhtml+xml"]),
});
export type ResearchWebOrigin = z.infer<typeof ResearchWebOriginSchema>;

export const ResearchSourceV3Schema = ResearchSourcePropertiesSchema.and(z.object({
  schemaVersion: z.literal(3),
  id: z.string().uuid(),
  researchDatabaseId: z.string().uuid(),
  kind: ResearchSourceKindSchema,
  mediaType: ResearchSourceMediaTypeSchema,
  originalFileName: z.string().trim().min(1).max(240).regex(SAFE_SOURCE_FILE_NAME_PATTERN),
  sizeBytes: z.number().int().positive().max(MAX_RESEARCH_SOURCE_BYTES),
  contentHash: z.string().regex(SHA256_PATTERN),
  originalRelativePath: z.string().min(1).max(512),
  contentRelativePath: z.string().min(1).max(512),
  parsedContentHash: z.string().regex(SHA256_PATTERN),
  parseStatus: ResearchSourceParseStatusSchema,
  parserName: z.string().min(1).max(120),
  parserVersion: z.number().int().positive(),
  parseWarnings: z.array(z.string().min(1).max(1000)).max(100).default([]),
  origin: z.discriminatedUnion("type", [ResearchFileOriginSchema, ResearchWebOriginSchema]),
  importedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  migratedFromVersion2Revision: z.string().regex(SHA256_PATTERN).optional(),
}));
export type ResearchSourceV3 = z.infer<typeof ResearchSourceV3Schema>;

export const ResearchSourceSchema = z.union([ResearchSourceV2Schema, ResearchSourceV3Schema]);
export type ResearchSource = z.infer<typeof ResearchSourceSchema>;

export const ResearchSourceDocumentSchema = z.object({
  source: ResearchSourceSchema,
  revision: z.string().regex(SHA256_PATTERN),
});
export type ResearchSourceDocument = z.infer<typeof ResearchSourceDocumentSchema>;

export const ResearchSourceDetailSchema = z.union([
  z.object({
    source: ResearchSourceV2Schema,
    revision: z.string().regex(SHA256_PATTERN),
    originalText: z.string(),
  }),
  z.object({
    source: ResearchSourceV3Schema,
    revision: z.string().regex(SHA256_PATTERN),
    content: ResearchSourceContentSchema,
  }),
]);
export type ResearchSourceDetail = z.infer<typeof ResearchSourceDetailSchema>;

export const ResearchSourceContentSummarySchema = z.object({
  title: z.string().trim().max(500),
  sectionCount: z.number().int().nonnegative(),
  blockCount: z.number().int().positive(),
  chunkCount: z.number().int().positive(),
});
export type ResearchSourceContentSummary = z.infer<typeof ResearchSourceContentSummarySchema>;

export const ResearchSourceViewSchema = z.union([
  z.object({
    source: ResearchSourceV2Schema,
    revision: z.string().regex(SHA256_PATTERN),
    originalText: z.string(),
  }),
  z.object({
    source: ResearchSourceV3Schema,
    revision: z.string().regex(SHA256_PATTERN),
    contentSummary: ResearchSourceContentSummarySchema,
  }),
]);
export type ResearchSourceView = z.infer<typeof ResearchSourceViewSchema>;

export const ResearchSourceContentPageQuerySchema = z.object({
  offset: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});
export type ResearchSourceContentPageQuery = z.input<typeof ResearchSourceContentPageQuerySchema>;

export const ResearchSourceContentPageSchema = z.object({
  researchDatabaseId: z.string().uuid(),
  sourceId: z.string().uuid(),
  sourceRevision: z.string().regex(SHA256_PATTERN),
  title: z.string().trim().max(500),
  offset: z.number().int().nonnegative(),
  limit: z.number().int().min(1).max(100),
  totalBlocks: z.number().int().positive(),
  blocks: z.array(ResearchSourceBlockSchema).max(100),
  previousOffset: z.number().int().nonnegative().nullable(),
  nextOffset: z.number().int().nonnegative().nullable(),
});
export type ResearchSourceContentPage = z.infer<typeof ResearchSourceContentPageSchema>;

export const ImportResearchSourceInputSchema = z.object({
  fileName: z.string().trim().min(1).max(240).regex(SAFE_SOURCE_FILE_NAME_PATTERN),
  mediaType: ResearchSourceMediaTypeSchema,
  sizeBytes: z.number().int().positive().max(MAX_RESEARCH_SOURCE_BYTES),
  contentBase64: z.string()
    .min(4)
    .max(Math.ceil(MAX_RESEARCH_SOURCE_BYTES / 3) * 4)
    .refine(isCanonicalBase64Shape, { message: "Research source content must be canonical base64" }),
  displayName: z.string().trim().min(1).max(240).optional(),
  author: z.string().trim().max(240).optional(),
  declaredLanguage: z.string().trim().regex(BCP47_PATTERN).max(64).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
  aiPermission: ResearchSourceAiPermissionSchema.optional(),
  useNotes: z.string().max(8000).optional(),
});
export type ImportResearchSourceInput = z.infer<typeof ImportResearchSourceInputSchema>;

export const ImportResearchWebSourceInputSchema = z.object({
  url: SafeWebUrlSchema,
  displayName: z.string().trim().min(1).max(240).optional(),
  author: z.string().trim().max(240).optional(),
  declaredLanguage: z.string().trim().regex(BCP47_PATTERN).max(64).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
  aiPermission: ResearchSourceAiPermissionSchema.optional(),
  useNotes: z.string().max(8000).optional(),
});
export type ImportResearchWebSourceInput = z.infer<typeof ImportResearchWebSourceInputSchema>;

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

export const ResearchKeywordSearchInputSchema = z.object({
  query: z.string().trim().min(1).max(500),
  purpose: z.enum(["local", "model-context"]).default("local"),
  sourceKinds: z.array(ResearchSourceKindSchema).max(ResearchSourceKindSchema.options.length).optional(),
  languageTags: z.array(z.string().trim().regex(BCP47_PATTERN).max(64)).max(40).optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
  author: z.string().trim().max(240).optional(),
  limit: z.number().int().min(1).max(100).default(30),
});
export type ResearchKeywordSearchInput = z.infer<typeof ResearchKeywordSearchInputSchema>;

export const ResearchKeywordSearchResultSchema = z.object({
  researchDatabaseId: z.string().uuid(),
  sourceId: z.string().uuid(),
  sourceRevision: z.string().regex(SHA256_PATTERN),
  sourceDisplayName: z.string().min(1).max(240),
  sourceKind: ResearchSourceKindSchema,
  chunkId: z.string().uuid(),
  blockId: z.string().uuid(),
  blockOrder: z.number().int().nonnegative(),
  chunkHash: z.string().regex(SHA256_PATTERN),
  originalText: z.string().min(1).max(100_000),
  languageTag: z.string().regex(BCP47_PATTERN).max(64),
  location: ResearchSourceLocationSchema,
  matchChannels: z.array(z.enum(["keyword-cjk", "keyword-word", "keyword-literal"])).min(1).max(3),
  score: z.number().finite(),
});
export type ResearchKeywordSearchResult = z.infer<typeof ResearchKeywordSearchResultSchema>;

export const ResearchKeywordSearchResponseSchema = z.object({
  researchDatabaseId: z.string().uuid(),
  query: z.string().min(1).max(500),
  results: z.array(ResearchKeywordSearchResultSchema),
});
export type ResearchKeywordSearchResponse = z.infer<typeof ResearchKeywordSearchResponseSchema>;

export const ResearchIndexStateSchema = z.object({
  researchDatabaseId: z.string().uuid(),
  status: z.enum(["missing", "ready", "stale", "damaged"]),
  indexedSourceCount: z.number().int().nonnegative(),
  indexedChunkCount: z.number().int().nonnegative(),
  reason: z.string().max(1000).nullable(),
});
export type ResearchIndexState = z.infer<typeof ResearchIndexStateSchema>;

export const MigrateResearchSourcesV2InputSchema = z.object({
  sources: z.array(z.object({
    sourceId: z.string().uuid(),
    baseRevision: z.string().regex(SHA256_PATTERN),
  })).min(1).max(10_000),
}).superRefine((input, context) => {
  const sourceIds = input.sources.map((source) => source.sourceId);
  if (new Set(sourceIds).size !== sourceIds.length) {
    context.addIssue({ code: "custom", message: "Version 2 migration Source IDs must be unique", path: ["sources"] });
  }
});
export type MigrateResearchSourcesV2Input = z.infer<typeof MigrateResearchSourcesV2InputSchema>;

export const ResearchSourceV2MigrationResultSchema = z.object({
  researchDatabaseId: z.string().uuid(),
  migratedSourceIds: z.array(z.string().uuid()),
  skippedSourceIds: z.array(z.string().uuid()),
  indexState: ResearchIndexStateSchema,
});
export type ResearchSourceV2MigrationResult = z.infer<typeof ResearchSourceV2MigrationResultSchema>;

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
