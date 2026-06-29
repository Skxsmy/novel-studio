import { z } from "zod";
import { CloudPolicySchema } from "./common.js";
import {
  DefaultProjectTitles,
  DefaultStructureTitles,
} from "./defaults.js";
import { DeleteCodexProgressionBlockerSchema } from "./codex.js";

export * from "./common.js";
export * from "./ai.js";
export * from "./codex.js";
export * from "./context.js";
export * from "./defaults.js";
export * from "./prompts.js";
export * from "./proposals.js";

export const SceneStatusSchema = z.enum([
  "idea",
  "outlined",
  "draft",
  "revising",
  "final",
  "archived",
]);
export type SceneStatus = z.infer<typeof SceneStatusSchema>;

export const PlanningStateSchema = z.enum([
  "aligned",
  "review-needed",
  "intentional-deviation",
  "revise-prose",
]);
export type PlanningState = z.infer<typeof PlanningStateSchema>;

export const TimelineTimeKindSchema = z.enum([
  "exact",
  "approximate",
  "relative",
  "unknown",
]);
export type TimelineTimeKind = z.infer<typeof TimelineTimeKindSchema>;

export const TimelinePrecisionSchema = z.enum([
  "minute",
  "hour",
  "day",
  "month",
  "year",
  "custom",
]);
export type TimelinePrecision = z.infer<typeof TimelinePrecisionSchema>;

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

export const CreateBookInputSchema = z.object({
  title: z.string().trim().min(1).max(160).default(DefaultStructureTitles.newVolume),
  targetCharacters: z.number().int().nonnegative().default(0),
});
export type CreateBookInput = z.input<typeof CreateBookInputSchema>;

export const UpdateBookInputSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  targetCharacters: z.number().int().nonnegative().optional(),
});
export type UpdateBookInput = z.infer<typeof UpdateBookInputSchema>;

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
  title: z.string().trim().min(1).max(160).default(DefaultStructureTitles.chapter),
});
export type CreateActInput = z.input<typeof CreateActInputSchema>;

export const CreateChapterInputSchema = z.object({
  title: z.string().trim().min(1).max(160).default(DefaultStructureTitles.act),
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
        message: "Reorder list cannot contain duplicate IDs",
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

export const SceneBlockIdSchema = z.string().uuid();
export type SceneBlockId = z.infer<typeof SceneBlockIdSchema>;

export const SceneParagraphBlockSchema = z.object({
  id: SceneBlockIdSchema,
  kind: z.literal("paragraph"),
  text: z.string().max(400000).default(""),
});
export type SceneParagraphBlock = z.infer<typeof SceneParagraphBlockSchema>;

export const SceneHeadingBlockSchema = z.object({
  id: SceneBlockIdSchema,
  kind: z.literal("heading"),
  level: z.number().int().min(1).max(6).default(1),
  text: z.string().max(4000).default(""),
});
export type SceneHeadingBlock = z.infer<typeof SceneHeadingBlockSchema>;

export const SceneQuoteBlockSchema = z.object({
  id: SceneBlockIdSchema,
  kind: z.literal("quote"),
  text: z.string().max(400000).default(""),
});
export type SceneQuoteBlock = z.infer<typeof SceneQuoteBlockSchema>;

export const SceneBreakBlockSchema = z.object({
  id: SceneBlockIdSchema,
  kind: z.literal("sceneBreak"),
});
export type SceneBreakBlock = z.infer<typeof SceneBreakBlockSchema>;

export const CodexProgressionSceneBlockSchema = z.object({
  id: SceneBlockIdSchema,
  kind: z.literal("codexProgression"),
  progressionId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CodexProgressionSceneBlock = z.infer<typeof CodexProgressionSceneBlockSchema>;

export const SceneBlockSchema = z.discriminatedUnion("kind", [
  SceneParagraphBlockSchema,
  SceneHeadingBlockSchema,
  SceneQuoteBlockSchema,
  SceneBreakBlockSchema,
  CodexProgressionSceneBlockSchema,
]);
export type SceneBlock = z.infer<typeof SceneBlockSchema>;

export const SceneBlockDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    blocks: z.array(SceneBlockSchema).default([]),
  })
  .superRefine((document, context) => {
    const seen = new Set<string>();
    for (let index = 0; index < document.blocks.length; index += 1) {
      const block = document.blocks[index]!;
      if (seen.has(block.id)) {
        context.addIssue({
          code: "custom",
          message: "Scene block document contains duplicate block IDs",
          path: ["blocks", index, "id"],
        });
      }
      seen.add(block.id);
    }
  });
export type SceneBlockDocument = z.infer<typeof SceneBlockDocumentSchema>;

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
  conflict: z.string().default(""),
  outcome: z.string().default(""),
  summary: z.string().default(""),
  beats: z.array(z.string()).default([]),
  plannedCharacters: z.number().int().nonnegative().default(0),
  durationMinutes: z.number().int().nonnegative().nullable().default(null),
  planningState: PlanningStateSchema.default("aligned"),
  divergenceNote: z.string().default(""),
  storyTime: z.string().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SceneFrontmatter = z.infer<typeof SceneFrontmatterSchema>;

export const UpdateScenePlanningInputSchema = z
  .object({
    baseRevision: z.string().regex(/^[a-f0-9]{64}$/),
    status: SceneStatusSchema.optional(),
    pov: z.string().trim().max(160).nullable().optional(),
    locationIds: z.array(z.string().uuid()).optional(),
    characterIds: z.array(z.string().uuid()).optional(),
    plotThreadIds: z.array(z.string().uuid()).optional(),
    tags: z.array(z.string().trim().min(1).max(80)).optional(),
    goal: z.string().max(8000).optional(),
    conflict: z.string().max(8000).optional(),
    outcome: z.string().max(8000).optional(),
    summary: z.string().max(16000).optional(),
    beats: z.array(z.string().max(2000)).optional(),
    plannedCharacters: z.number().int().nonnegative().optional(),
    durationMinutes: z.number().int().nonnegative().nullable().optional(),
    planningState: PlanningStateSchema.optional(),
    divergenceNote: z.string().max(8000).optional(),
  })
  .superRefine((input, context) => {
    if (Object.keys(input).every((key) => key === "baseRevision")) {
      context.addIssue({ code: "custom", message: "至少提供一个规划字段" });
    }
  });
export type UpdateScenePlanningInput = z.infer<typeof UpdateScenePlanningInputSchema>;

export const TimelineManifestSchema = z.object({
  schemaVersion: z.literal(1),
  eventIds: z.array(z.string().uuid()).default([]),
  updatedAt: z.string().datetime(),
});
export type TimelineManifest = z.infer<typeof TimelineManifestSchema>;

export const TimelineEventSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(240),
  timeKind: TimelineTimeKindSchema,
  timeLabel: z.string().max(240).default("时间未定"),
  startsAt: z.string().datetime().nullable().default(null),
  precision: TimelinePrecisionSchema.default("custom"),
  durationMinutes: z.number().int().nonnegative().nullable().default(null),
  sceneIds: z.array(z.string().uuid()).default([]),
  description: z.string().max(16000).default(""),
  tags: z.array(z.string().trim().min(1).max(80)).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

export const TimelineEventDocumentSchema = z.object({
  event: TimelineEventSchema,
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  storyIndex: z.number().int().positive(),
});
export type TimelineEventDocument = z.infer<typeof TimelineEventDocumentSchema>;

export const CreateTimelineEventInputSchema = TimelineEventSchema.pick({
  title: true,
  timeKind: true,
  timeLabel: true,
  startsAt: true,
  precision: true,
  durationMinutes: true,
  sceneIds: true,
  description: true,
  tags: true,
}).partial({
  timeKind: true,
  timeLabel: true,
  startsAt: true,
  precision: true,
  durationMinutes: true,
  sceneIds: true,
  description: true,
  tags: true,
});
export type CreateTimelineEventInput = z.input<typeof CreateTimelineEventInputSchema>;

export const UpdateTimelineEventInputSchema = CreateTimelineEventInputSchema.partial()
  .extend({ baseRevision: z.string().regex(/^[a-f0-9]{64}$/) })
  .superRefine((input, context) => {
    if (Object.keys(input).every((key) => key === "baseRevision")) {
      context.addIssue({ code: "custom", message: "至少提供一个事件字段" });
    }
  });
export type UpdateTimelineEventInput = z.infer<typeof UpdateTimelineEventInputSchema>;

export const DeleteTimelineEventInputSchema = z.object({
  baseRevision: z.string().regex(/^[a-f0-9]{64}$/),
});
export type DeleteTimelineEventInput = z.infer<typeof DeleteTimelineEventInputSchema>;

export const PlanningSceneSchema = SceneFrontmatterSchema.pick({
  id: true,
  bookId: true,
  actId: true,
  chapterId: true,
  title: true,
  status: true,
  pov: true,
  locationIds: true,
  characterIds: true,
  plotThreadIds: true,
  tags: true,
  goal: true,
  conflict: true,
  outcome: true,
  summary: true,
  beats: true,
  plannedCharacters: true,
  durationMinutes: true,
  planningState: true,
  divergenceNote: true,
}).extend({
  order: z.number().int().positive(),
  narrativeIndex: z.number().int().positive(),
  characterCount: z.number().int().nonnegative(),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
});
export type PlanningScene = z.infer<typeof PlanningSceneSchema>;

export const PlanningChapterSchema = ChapterManifestSchema.pick({
  id: true,
  actId: true,
  title: true,
  order: true,
}).extend({ scenes: z.array(PlanningSceneSchema) });
export type PlanningChapter = z.infer<typeof PlanningChapterSchema>;

export const PlanningActSchema = ActManifestSchema.pick({
  id: true,
  bookId: true,
  title: true,
  order: true,
}).extend({ chapters: z.array(PlanningChapterSchema) });
export type PlanningAct = z.infer<typeof PlanningActSchema>;

export const PlanningBookSchema = BookManifestSchema.pick({
  id: true,
  title: true,
  order: true,
}).extend({ acts: z.array(PlanningActSchema) });
export type PlanningBook = z.infer<typeof PlanningBookSchema>;

export const PlanningDimensionsSchema = z.object({
  povs: z.array(z.string()),
  characterIds: z.array(z.string().uuid()),
  locationIds: z.array(z.string().uuid()),
  plotThreadIds: z.array(z.string().uuid()),
  tags: z.array(z.string()),
  statuses: z.array(SceneStatusSchema),
});
export type PlanningDimensions = z.infer<typeof PlanningDimensionsSchema>;

export const PlanningBoardSchema = z.object({
  seriesId: z.string().uuid(),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  books: z.array(PlanningBookSchema),
  narrativeScenes: z.array(PlanningSceneSchema),
  storyEvents: z.array(TimelineEventDocumentSchema),
  unplacedSceneIds: z.array(z.string().uuid()),
  dimensions: PlanningDimensionsSchema,
  codexLabels: z.record(z.string(), z.string()),
  legacyStoryTimeSceneIds: z.array(z.string().uuid()),
});
export type PlanningBoard = z.infer<typeof PlanningBoardSchema>;

export const SceneDocumentSchema = z.object({
  metadata: SceneFrontmatterSchema,
  document: SceneBlockDocumentSchema,
  plainText: z.string(),
  content: z.string(),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  relativePath: z.string(),
  characterCount: z.number().int().nonnegative(),
  paragraphCount: z.number().int().nonnegative(),
});
export type SceneDocument = z.infer<typeof SceneDocumentSchema>;

export const SceneBlockDocumentResponseSchema = z.object({
  metadata: SceneFrontmatterSchema,
  document: SceneBlockDocumentSchema,
  plainText: z.string(),
  content: z.string(),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  relativePath: z.string(),
  characterCount: z.number().int().nonnegative(),
  paragraphCount: z.number().int().nonnegative(),
});
export type SceneBlockDocumentResponse = z.infer<typeof SceneBlockDocumentResponseSchema>;

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
  acts: z.array(ActManifestSchema),
  chapters: z.array(ChapterManifestSchema),
  scenes: z.array(SceneDocumentSchema),
});
export type SeriesDetail = z.infer<typeof SeriesDetailSchema>;

export const CreateSeriesInputSchema = z.object({
  title: z.string().trim().min(1).max(160).default(DefaultProjectTitles.series),
  description: z.string().trim().max(4000).default(""),
  firstBookTitle: z.string().trim().min(1).max(160).default(DefaultStructureTitles.volume),
});
export type CreateSeriesInput = z.input<typeof CreateSeriesInputSchema>;

export const CreateSceneInputSchema = z.object({
  title: z.string().trim().min(1).max(160).default(DefaultStructureTitles.scene),
  content: z.string().default(""),
  bookId: z.string().uuid().optional(),
  actId: z.string().uuid().optional(),
  chapterId: z.string().uuid().optional(),
}).superRefine((input, context) => {
  const provided = [input.bookId, input.actId, input.chapterId].filter(Boolean).length;
  if (provided > 0 && provided < 3) {
    context.addIssue({
      code: "custom",
      message: "bookId, actId, and chapterId are all required when specifying a scene location",
      path: ["chapterId"],
    });
  }
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

export const UpdateSceneBlockDocumentInputSchema = z.object({
  baseRevision: z.string().regex(/^[a-f0-9]{64}$/),
  title: z.string().trim().min(1).max(160).optional(),
  document: SceneBlockDocumentSchema,
  status: SceneStatusSchema.optional(),
  goal: z.string().optional(),
  summary: z.string().optional(),
});
export type UpdateSceneBlockDocumentInput = z.infer<typeof UpdateSceneBlockDocumentInputSchema>;

export const SceneMarkdownExportSchema = z.object({
  sceneId: z.string().uuid(),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  markdown: z.string(),
});
export type SceneMarkdownExport = z.infer<typeof SceneMarkdownExportSchema>;

export const DeleteSceneProgressionBlockInputSchema = z.object({
  baseRevision: z.string().regex(/^[a-f0-9]{64}$/),
  progressionBaseRevision: z.string().regex(/^[a-f0-9]{64}$/),
});
export type DeleteSceneProgressionBlockInput = z.infer<typeof DeleteSceneProgressionBlockInputSchema>;

export const DeleteSceneProgressionBlockResultSchema = z.object({
  blockId: SceneBlockIdSchema,
  deletedId: z.string().uuid().nullable(),
  blockers: z.array(DeleteCodexProgressionBlockerSchema).default([]),
  scene: SceneBlockDocumentResponseSchema.nullable(),
});
export type DeleteSceneProgressionBlockResult = z.infer<typeof DeleteSceneProgressionBlockResultSchema>;

export const SceneSectionKindSchema = z.enum([
  "author-note",
  "candidate",
  "research",
  "sensitive",
  "temporary",
]);
export type SceneSectionKind = z.infer<typeof SceneSectionKindSchema>;

export const SceneSectionAiPolicySchema = z.enum(["inherit", "local-only", "never"]);
export type SceneSectionAiPolicy = z.infer<typeof SceneSectionAiPolicySchema>;

export const SceneSectionMetadataSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  sceneId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  kind: SceneSectionKindSchema,
  aiPolicy: SceneSectionAiPolicySchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable().default(null),
});
export type SceneSectionMetadata = z.infer<typeof SceneSectionMetadataSchema>;

export const SceneSectionDocumentSchema = z.object({
  metadata: SceneSectionMetadataSchema,
  content: z.string(),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  relativePath: z.string(),
  characterCount: z.number().int().nonnegative(),
});
export type SceneSectionDocument = z.infer<typeof SceneSectionDocumentSchema>;

export const CreateSceneSectionInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  kind: SceneSectionKindSchema,
  aiPolicy: SceneSectionAiPolicySchema.optional(),
  content: z.string().default(""),
});
export type CreateSceneSectionInput = z.input<typeof CreateSceneSectionInputSchema>;

export const UpdateSceneSectionInputSchema = z
  .object({
    baseRevision: z.string().regex(/^[a-f0-9]{64}$/),
    title: z.string().trim().min(1).max(160).optional(),
    kind: SceneSectionKindSchema.optional(),
    aiPolicy: SceneSectionAiPolicySchema.optional(),
    content: z.string().optional(),
  })
  .superRefine((input, context) => {
    if (Object.keys(input).every((key) => key === "baseRevision")) {
      context.addIssue({ code: "custom", message: "至少提供一个 Section 字段" });
    }
  });
export type UpdateSceneSectionInput = z.infer<typeof UpdateSceneSectionInputSchema>;

export const ArchiveSceneSectionInputSchema = z.object({
  baseRevision: z.string().regex(/^[a-f0-9]{64}$/),
});
export type ArchiveSceneSectionInput = z.infer<typeof ArchiveSceneSectionInputSchema>;
export const RestoreSceneSectionInputSchema = ArchiveSceneSectionInputSchema;
export type RestoreSceneSectionInput = z.infer<typeof RestoreSceneSectionInputSchema>;

export const SectionContextTargetSchema = z.enum(["local", "cloud"]);
export type SectionContextTarget = z.infer<typeof SectionContextTargetSchema>;

export const ReviewAnchorSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  sceneId: z.string().uuid(),
  blockId: z.string().uuid(),
  sceneRevision: z.string().regex(/^[a-f0-9]{64}$/),
  exactQuote: z.string().min(1).max(16000),
  prefix: z.string().max(256),
  suffix: z.string().max(256),
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ReviewAnchor = z.infer<typeof ReviewAnchorSchema>;

export const ReviewAnchorStatusSchema = z.enum(["attached", "relocated", "orphaned"]);
export type ReviewAnchorStatus = z.infer<typeof ReviewAnchorStatusSchema>;

export const ReviewAnchorResolutionSchema = z.object({
  status: ReviewAnchorStatusSchema,
  start: z.number().int().nonnegative().nullable(),
  end: z.number().int().nonnegative().nullable(),
  reason: z.string(),
});
export type ReviewAnchorResolution = z.infer<typeof ReviewAnchorResolutionSchema>;

export const ResolvedReviewAnchorSchema = z.object({
  anchor: ReviewAnchorSchema,
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  resolution: ReviewAnchorResolutionSchema,
});
export type ResolvedReviewAnchor = z.infer<typeof ResolvedReviewAnchorSchema>;

export const CreateReviewAnchorInputSchema = z
  .object({
    baseRevision: z.string().regex(/^[a-f0-9]{64}$/),
    exactQuote: z.string().min(1).max(16000),
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
  })
  .refine((input) => input.end > input.start, {
    message: "锚点结束位置必须大于开始位置",
    path: ["end"],
  });
export type CreateReviewAnchorInput = z.infer<typeof CreateReviewAnchorInputSchema>;

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
