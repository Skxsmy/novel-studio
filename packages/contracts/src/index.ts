import { z } from "zod";

export const CloudPolicySchema = z.enum(["local-only", "cloud-allowed"]);
export type CloudPolicy = z.infer<typeof CloudPolicySchema>;

export const SceneStatusSchema = z.enum([
  "idea",
  "outlined",
  "draft",
  "revising",
  "final",
  "archived",
]);
export type SceneStatus = z.infer<typeof SceneStatusSchema>;

export const SeriesManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  title: z.string().min(1).max(160),
  description: z.string().default(""),
  language: z.literal("zh-CN").default("zh-CN"),
  cloudPolicy: CloudPolicySchema.default("local-only"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable().default(null),
  bookIds: z.array(z.string().uuid()).default([]),
});
export type SeriesManifest = z.infer<typeof SeriesManifestSchema>;

export const BookManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  seriesId: z.string().uuid(),
  title: z.string().min(1).max(160),
  order: z.number().int().positive(),
  targetCharacters: z.number().int().nonnegative().default(0),
  actIds: z.array(z.string().uuid()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type BookManifest = z.infer<typeof BookManifestSchema>;

export const ActManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  bookId: z.string().uuid(),
  title: z.string().min(1).max(160),
  order: z.number().int().positive(),
  chapterIds: z.array(z.string().uuid()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ActManifest = z.infer<typeof ActManifestSchema>;

export const ChapterManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  actId: z.string().uuid(),
  title: z.string().min(1).max(160),
  order: z.number().int().positive(),
  sceneIds: z.array(z.string().uuid()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ChapterManifest = z.infer<typeof ChapterManifestSchema>;

export const CreateActInputSchema = z.object({
  title: z.string().trim().min(1).max(160).default("新幕"),
});
export type CreateActInput = z.input<typeof CreateActInputSchema>;

export const CreateChapterInputSchema = z.object({
  title: z.string().trim().min(1).max(160).default("新章"),
});
export type CreateChapterInput = z.input<typeof CreateChapterInputSchema>;

export const UpdateActInputSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
});
export type UpdateActInput = z.infer<typeof UpdateActInputSchema>;

export const UpdateChapterInputSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
});
export type UpdateChapterInput = z.infer<typeof UpdateChapterInputSchema>;

export const MoveSceneInputSchema = z.object({
  targetChapterId: z.string().uuid(),
  order: z.number().int().positive().optional(),
});
export type MoveSceneInput = z.infer<typeof MoveSceneInputSchema>;

export const ReorderInputSchema = z
  .object({
    orderedIds: z.array(z.string().uuid()).min(1),
  })
  .superRefine(({ orderedIds }, context) => {
    if (new Set(orderedIds).size !== orderedIds.length) {
      context.addIssue({
        code: "custom",
        message: "重排列表不能包含重复 ID",
        path: ["orderedIds"],
      });
    }
  });
export type ReorderInput = z.infer<typeof ReorderInputSchema>;

export const HierarchyIssueSchema = z.object({
  code: z.string(),
  message: z.string(),
  entityId: z.string().optional(),
  relativePath: z.string().optional(),
});
export type HierarchyIssue = z.infer<typeof HierarchyIssueSchema>;

export const HierarchyValidationResultSchema = z.object({
  valid: z.boolean(),
  issues: z.array(HierarchyIssueSchema),
  bookCount: z.number().int().nonnegative(),
  actCount: z.number().int().nonnegative(),
  chapterCount: z.number().int().nonnegative(),
  sceneCount: z.number().int().nonnegative(),
});
export type HierarchyValidationResult = z.infer<typeof HierarchyValidationResultSchema>;

export const SceneFrontmatterSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  bookId: z.string().uuid(),
  actId: z.string().uuid(),
  chapterId: z.string().uuid(),
  title: z.string().min(1).max(160),
  order: z.number().int().positive(),
  status: SceneStatusSchema.default("draft"),
  pov: z.string().nullable().default(null),
  locationIds: z.array(z.string().uuid()).default([]),
  characterIds: z.array(z.string().uuid()).default([]),
  plotThreadIds: z.array(z.string().uuid()).default([]),
  tags: z.array(z.string()).default([]),
  goal: z.string().default(""),
  summary: z.string().default(""),
  beats: z.array(z.string()).default([]),
  storyTime: z.string().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SceneFrontmatter = z.infer<typeof SceneFrontmatterSchema>;

export const SceneDocumentSchema = z.object({
  metadata: SceneFrontmatterSchema,
  content: z.string(),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  relativePath: z.string(),
  characterCount: z.number().int().nonnegative(),
  paragraphCount: z.number().int().nonnegative(),
});
export type SceneDocument = z.infer<typeof SceneDocumentSchema>;

export const SeriesSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  updatedAt: z.string().datetime(),
  archived: z.boolean(),
  bookCount: z.number().int().nonnegative(),
  sceneCount: z.number().int().nonnegative(),
  directoryName: z.string(),
});
export type SeriesSummary = z.infer<typeof SeriesSummarySchema>;

export const SeriesDetailSchema = z.object({
  manifest: SeriesManifestSchema,
  books: z.array(BookManifestSchema),
  scenes: z.array(SceneDocumentSchema),
});
export type SeriesDetail = z.infer<typeof SeriesDetailSchema>;

export const CreateSeriesInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).default(""),
  firstBookTitle: z.string().trim().min(1).max(160).default("第一部"),
});
export type CreateSeriesInput = z.input<typeof CreateSeriesInputSchema>;

export const CreateSceneInputSchema = z.object({
  title: z.string().trim().min(1).max(160).default("新场景"),
  content: z.string().default(""),
});
export type CreateSceneInput = z.input<typeof CreateSceneInputSchema>;

export const UpdateSceneInputSchema = z.object({
  baseRevision: z.string().regex(/^[a-f0-9]{64}$/),
  title: z.string().trim().min(1).max(160),
  content: z.string(),
  status: SceneStatusSchema.optional(),
  goal: z.string().optional(),
  summary: z.string().optional(),
});
export type UpdateSceneInput = z.infer<typeof UpdateSceneInputSchema>;

export const SearchResultSchema = z.object({
  sceneId: z.string().uuid(),
  title: z.string(),
  excerpt: z.string(),
  relativePath: z.string(),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}
