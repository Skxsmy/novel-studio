import { z } from "zod";
import { CloudPolicySchema } from "./common.js";

export * from "./common.js";
export * from "./ai.js";
export * from "./context.js";
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
  title: z.string().trim().min(1).max(160).default("新部"),
  targetCharacters: z.number().int().nonnegative().default(0),
});
export type CreateBookInput = z.input<typeof CreateBookInputSchema>;

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
  bookId: z.string().uuid().optional(),
  actId: z.string().uuid().optional(),
  chapterId: z.string().uuid().optional(),
}).superRefine((input, context) => {
  const provided = [input.bookId, input.actId, input.chapterId].filter(Boolean).length;
  if (provided > 0 && provided < 3) {
    context.addIssue({
      code: "custom",
      message: "指定场景位置时必须同时提供 bookId、actId 和 chapterId",
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

export const CodexBuiltInCategoryIdSchema = z.enum([
  "character",
  "location",
  "object",
  "lore",
  "organization",
  "plot-thread",
]);
export type CodexBuiltInCategoryId = z.infer<typeof CodexBuiltInCategoryIdSchema>;

export const CodexCategoryIdSchema = z.union([
  CodexBuiltInCategoryIdSchema,
  z.string().uuid(),
]);
export type CodexCategoryId = z.infer<typeof CodexCategoryIdSchema>;

export const CodexCustomCategorySchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  icon: z.string().trim().min(1).max(12).default("◇"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable().default(null),
});
export type CodexCustomCategory = z.infer<typeof CodexCustomCategorySchema>;

export const CodexCategorySchema = z.object({
  id: CodexCategoryIdSchema,
  name: z.string(),
  icon: z.string(),
  builtIn: z.boolean(),
  archivedAt: z.string().datetime().nullable(),
});
export type CodexCategory = z.infer<typeof CodexCategorySchema>;

export const CodexCategoryDocumentSchema = z.object({
  category: CodexCategorySchema,
  revision: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
});
export type CodexCategoryDocument = z.infer<typeof CodexCategoryDocumentSchema>;

export const CreateCodexCategoryInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  icon: z.string().trim().min(1).max(12).default("◇"),
});
export type CreateCodexCategoryInput = z.input<typeof CreateCodexCategoryInputSchema>;

export const UpdateCodexCategoryInputSchema = z
  .object({
    baseRevision: z.string().regex(/^[a-f0-9]{64}$/),
    name: z.string().trim().min(1).max(80).optional(),
    icon: z.string().trim().min(1).max(12).optional(),
  })
  .superRefine((input, context) => {
    if (input.name === undefined && input.icon === undefined) {
      context.addIssue({ code: "custom", message: "至少提供一个类别字段" });
    }
  });
export type UpdateCodexCategoryInput = z.infer<typeof UpdateCodexCategoryInputSchema>;

export const CodexAiContextPolicySchema = z.enum([
  "always",
  "on-mention",
  "manual",
  "never",
]);
export type CodexAiContextPolicy = z.infer<typeof CodexAiContextPolicySchema>;

export const CodexMentionRulesSchema = z.object({
  caseSensitive: z.boolean().default(false),
  matchAliases: z.boolean().default(true),
  automaticPlural: z.boolean().default(false),
  excludedTerms: z.array(z.string().trim().min(1).max(160)).default([]),
});
export type CodexMentionRules = z.infer<typeof CodexMentionRulesSchema>;

export const CodexEntryMetadataSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  categoryId: CodexCategoryIdSchema,
  name: z.string().trim().min(1).max(160),
  aliases: z.array(z.string().trim().min(1).max(160)).default([]),
  tags: z.array(z.string().trim().min(1).max(80)).default([]),
  thumbnail: z.string().max(500).nullable().default(null),
  details: z.record(z.string(), z.string().max(16000)).default({}),
  aiContextPolicy: CodexAiContextPolicySchema.default("on-mention"),
  mention: CodexMentionRulesSchema.default({
    caseSensitive: false,
    matchAliases: true,
    automaticPlural: false,
    excludedTerms: [],
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable().default(null),
});
export type CodexEntryMetadata = z.infer<typeof CodexEntryMetadataSchema>;

export const CodexResearchMetadataSchema = z.object({
  schemaVersion: z.literal(1),
  entryId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CodexResearchMetadata = z.infer<typeof CodexResearchMetadataSchema>;

export const CodexResearchDocumentSchema = z.object({
  metadata: CodexResearchMetadataSchema,
  content: z.string(),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  relativePath: z.string(),
});
export type CodexResearchDocument = z.infer<typeof CodexResearchDocumentSchema>;

export const CodexEntryDocumentSchema = z.object({
  metadata: CodexEntryMetadataSchema,
  description: z.string(),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  relativePath: z.string(),
  research: CodexResearchDocumentSchema,
});
export type CodexEntryDocument = z.infer<typeof CodexEntryDocumentSchema>;

export const CreateCodexEntryInputSchema = z.object({
  categoryId: CodexCategoryIdSchema,
  name: z.string().trim().min(1).max(160),
  aliases: z.array(z.string().trim().min(1).max(160)).default([]),
  tags: z.array(z.string().trim().min(1).max(80)).default([]),
  thumbnail: z.string().max(500).nullable().default(null),
  details: z.record(z.string(), z.string().max(16000)).default({}),
  aiContextPolicy: CodexAiContextPolicySchema.default("on-mention"),
  mention: CodexMentionRulesSchema.default({
    caseSensitive: false,
    matchAliases: true,
    automaticPlural: false,
    excludedTerms: [],
  }),
  description: z.string().default(""),
  research: z.string().default(""),
});
export type CreateCodexEntryInput = z.input<typeof CreateCodexEntryInputSchema>;

export const UpdateCodexEntryInputSchema = z
  .object({
    baseRevision: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    baseResearchRevision: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    name: z.string().trim().min(1).max(160).optional(),
    aliases: z.array(z.string().trim().min(1).max(160)).optional(),
    tags: z.array(z.string().trim().min(1).max(80)).optional(),
    thumbnail: z.string().max(500).nullable().optional(),
    details: z.record(z.string(), z.string().max(16000)).optional(),
    aiContextPolicy: CodexAiContextPolicySchema.optional(),
    mention: CodexMentionRulesSchema.optional(),
    description: z.string().optional(),
    research: z.string().optional(),
  })
  .superRefine((input, context) => {
    const entryFields = [
      input.name,
      input.aliases,
      input.tags,
      input.thumbnail,
      input.details,
      input.aiContextPolicy,
      input.mention,
      input.description,
    ];
    const changesEntry = entryFields.some((value) => value !== undefined);
    const changesResearch = input.research !== undefined;
    if (!changesEntry && !changesResearch) {
      context.addIssue({ code: "custom", message: "至少提供一个 Codex 字段" });
    }
    if (changesEntry && !input.baseRevision) {
      context.addIssue({ code: "custom", message: "修改 Canon 或元数据需要 baseRevision" });
    }
    if (changesResearch && !input.baseResearchRevision) {
      context.addIssue({ code: "custom", message: "修改 Research 需要 baseResearchRevision" });
    }
  });
export type UpdateCodexEntryInput = z.infer<typeof UpdateCodexEntryInputSchema>;

export const ArchiveCodexDocumentInputSchema = z.object({
  baseRevision: z.string().regex(/^[a-f0-9]{64}$/),
});
export type ArchiveCodexDocumentInput = z.infer<typeof ArchiveCodexDocumentInputSchema>;

export const CodexRelationSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  sourceEntryId: z.string().uuid(),
  targetEntryId: z.string().uuid(),
  type: z.string().trim().min(1).max(120),
  directed: z.boolean().default(true),
  description: z.string().max(16000).default(""),
  evidence: z.string().max(16000).default(""),
  validFromSceneId: z.string().uuid().nullable().default(null),
  validToSceneId: z.string().uuid().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable().default(null),
});
export type CodexRelation = z.infer<typeof CodexRelationSchema>;

export const CodexRelationDocumentSchema = z.object({
  relation: CodexRelationSchema,
  revision: z.string().regex(/^[a-f0-9]{64}$/),
});
export type CodexRelationDocument = z.infer<typeof CodexRelationDocumentSchema>;

export const EvidenceSourceTypeSchema = z.enum([
  "scene",
  "codex-entry",
  "relation",
]);
export type EvidenceSourceType = z.infer<typeof EvidenceSourceTypeSchema>;

export const EvidenceSchema = z.object({
  sourceType: EvidenceSourceTypeSchema,
  sourceId: z.string().uuid(),
  quote: z.string().max(16000).default(""),
  note: z.string().trim().min(1).max(16000),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const CodexProgressionTargetKindSchema = z.enum(["entry", "relation"]);
export type CodexProgressionTargetKind = z.infer<
  typeof CodexProgressionTargetKindSchema
>;

export const CodexProgressionTargetSchema = z
  .object({
    kind: CodexProgressionTargetKindSchema,
    entryId: z.string().uuid().nullable().default(null),
    relationId: z.string().uuid().nullable().default(null),
  })
  .superRefine((target, context) => {
    if (target.kind === "entry" && !target.entryId) {
      context.addIssue({
        code: "custom",
        message: "条目进展必须提供 entryId",
        path: ["entryId"],
      });
    }
    if (target.kind === "relation" && !target.relationId) {
      context.addIssue({
        code: "custom",
        message: "关系进展必须提供 relationId",
        path: ["relationId"],
      });
    }
  });
export type CodexProgressionTarget = z.infer<
  typeof CodexProgressionTargetSchema
>;

export const CodexProgressionChangeKindSchema = z.enum([
  "addition",
  "replacement",
]);
export type CodexProgressionChangeKind = z.infer<
  typeof CodexProgressionChangeKindSchema
>;

export const CodexProgressionSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().uuid(),
    target: CodexProgressionTargetSchema,
    fieldKey: z.string().trim().min(1).max(120).default("description"),
    changeKind: CodexProgressionChangeKindSchema,
    summary: z.string().trim().min(1).max(16000),
    effectiveFromSceneId: z.string().uuid(),
    effectiveToSceneId: z.string().uuid().nullable().default(null),
    evidence: z.array(EvidenceSchema).min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    archivedAt: z.string().datetime().nullable().default(null),
  })
  .superRefine((progression, context) => {
    if (progression.effectiveToSceneId === progression.effectiveFromSceneId) {
      context.addIssue({
        code: "custom",
        message: "生效结束场景不能与起始场景相同",
        path: ["effectiveToSceneId"],
      });
    }
  });
export type CodexProgression = z.infer<typeof CodexProgressionSchema>;

export const CodexProgressionDocumentSchema = z.object({
  progression: CodexProgressionSchema,
  revision: z.string().regex(/^[a-f0-9]{64}$/),
});
export type CodexProgressionDocument = z.infer<
  typeof CodexProgressionDocumentSchema
>;

export const CreateCodexProgressionInputSchema = z.object({
  target: CodexProgressionTargetSchema,
  fieldKey: z.string().trim().min(1).max(120).default("description"),
  changeKind: CodexProgressionChangeKindSchema,
  summary: z.string().trim().min(1).max(16000),
  effectiveFromSceneId: z.string().uuid(),
  effectiveToSceneId: z.string().uuid().nullable().default(null),
  evidence: z.array(EvidenceSchema).min(1),
});
export type CreateCodexProgressionInput = z.input<
  typeof CreateCodexProgressionInputSchema
>;

export const UpdateCodexProgressionInputSchema =
  CreateCodexProgressionInputSchema.partial()
    .extend({ baseRevision: z.string().regex(/^[a-f0-9]{64}$/) })
    .superRefine((input, context) => {
      if (Object.keys(input).every((key) => key === "baseRevision")) {
        context.addIssue({ code: "custom", message: "至少提供一个进展字段" });
      }
    });
export type UpdateCodexProgressionInput = z.infer<
  typeof UpdateCodexProgressionInputSchema
>;

export const CodexKnowledgeStanceSchema = z.enum([
  "knows",
  "believes",
  "misunderstands",
]);
export type CodexKnowledgeStance = z.infer<typeof CodexKnowledgeStanceSchema>;

export const CodexKnowledgeSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().uuid(),
    characterEntryId: z.string().uuid(),
    subjectEntryId: z.string().uuid().nullable().default(null),
    relationId: z.string().uuid().nullable().default(null),
    stance: CodexKnowledgeStanceSchema,
    summary: z.string().trim().min(1).max(16000),
    truthProgressionId: z.string().uuid().nullable().default(null),
    effectiveFromSceneId: z.string().uuid(),
    effectiveToSceneId: z.string().uuid().nullable().default(null),
    evidence: z.array(EvidenceSchema).min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    archivedAt: z.string().datetime().nullable().default(null),
  })
  .superRefine((knowledge, context) => {
    if (!knowledge.subjectEntryId && !knowledge.relationId) {
      context.addIssue({
        code: "custom",
        message: "角色所知必须关联一个条目或关系",
        path: ["subjectEntryId"],
      });
    }
    if (knowledge.effectiveToSceneId === knowledge.effectiveFromSceneId) {
      context.addIssue({
        code: "custom",
        message: "生效结束场景不能与起始场景相同",
        path: ["effectiveToSceneId"],
      });
    }
  });
export type CodexKnowledge = z.infer<typeof CodexKnowledgeSchema>;

export const CodexKnowledgeDocumentSchema = z.object({
  knowledge: CodexKnowledgeSchema,
  revision: z.string().regex(/^[a-f0-9]{64}$/),
});
export type CodexKnowledgeDocument = z.infer<
  typeof CodexKnowledgeDocumentSchema
>;

export const CreateCodexKnowledgeInputSchema = z
  .object({
    characterEntryId: z.string().uuid(),
    subjectEntryId: z.string().uuid().nullable().default(null),
    relationId: z.string().uuid().nullable().default(null),
    stance: CodexKnowledgeStanceSchema,
    summary: z.string().trim().min(1).max(16000),
    truthProgressionId: z.string().uuid().nullable().default(null),
    effectiveFromSceneId: z.string().uuid(),
    effectiveToSceneId: z.string().uuid().nullable().default(null),
    evidence: z.array(EvidenceSchema).min(1),
  })
  .superRefine((knowledge, context) => {
    if (!knowledge.subjectEntryId && !knowledge.relationId) {
      context.addIssue({
        code: "custom",
        message: "角色所知必须关联一个条目或关系",
        path: ["subjectEntryId"],
      });
    }
  });
export type CreateCodexKnowledgeInput = z.input<
  typeof CreateCodexKnowledgeInputSchema
>;

export const UpdateCodexKnowledgeInputSchema = z
  .object({
    baseRevision: z.string().regex(/^[a-f0-9]{64}$/),
    characterEntryId: z.string().uuid().optional(),
    subjectEntryId: z.string().uuid().nullable().optional(),
    relationId: z.string().uuid().nullable().optional(),
    stance: CodexKnowledgeStanceSchema.optional(),
    summary: z.string().trim().min(1).max(16000).optional(),
    truthProgressionId: z.string().uuid().nullable().optional(),
    effectiveFromSceneId: z.string().uuid().optional(),
    effectiveToSceneId: z.string().uuid().nullable().optional(),
    evidence: z.array(EvidenceSchema).min(1).optional(),
  })
  .superRefine((input, context) => {
    if (Object.keys(input).every((key) => key === "baseRevision")) {
      context.addIssue({ code: "custom", message: "至少提供一个角色所知字段" });
    }
  });
export type UpdateCodexKnowledgeInput = z.infer<
  typeof UpdateCodexKnowledgeInputSchema
>;

export const CodexRelationEffectiveStateSchema = z.object({
  relation: CodexRelationDocumentSchema,
  progressions: z.array(CodexProgressionDocumentSchema),
});
export type CodexRelationEffectiveState = z.infer<
  typeof CodexRelationEffectiveStateSchema
>;

export const CodexEffectiveStateSchema = z.object({
  sceneId: z.string().uuid(),
  narrativeIndex: z.number().int().positive(),
  entry: CodexEntryDocumentSchema,
  worldFacts: z.array(CodexProgressionDocumentSchema),
  relationStates: z.array(CodexRelationEffectiveStateSchema),
  characterKnowledge: z.array(CodexKnowledgeDocumentSchema),
  hiddenFutureProgressionCount: z.number().int().nonnegative(),
  hiddenFutureKnowledgeCount: z.number().int().nonnegative(),
});
export type CodexEffectiveState = z.infer<typeof CodexEffectiveStateSchema>;

export const CreateCodexRelationInputSchema = CodexRelationSchema.pick({
  sourceEntryId: true,
  targetEntryId: true,
  type: true,
  directed: true,
  description: true,
  evidence: true,
  validFromSceneId: true,
  validToSceneId: true,
}).partial({
  directed: true,
  description: true,
  evidence: true,
  validFromSceneId: true,
  validToSceneId: true,
});
export type CreateCodexRelationInput = z.input<typeof CreateCodexRelationInputSchema>;

export const UpdateCodexRelationInputSchema = CreateCodexRelationInputSchema.partial()
  .omit({ sourceEntryId: true, targetEntryId: true })
  .extend({ baseRevision: z.string().regex(/^[a-f0-9]{64}$/) })
  .superRefine((input, context) => {
    if (Object.keys(input).every((key) => key === "baseRevision")) {
      context.addIssue({ code: "custom", message: "至少提供一个关系字段" });
    }
  });
export type UpdateCodexRelationInput = z.infer<typeof UpdateCodexRelationInputSchema>;

export const CodexMentionSchema = z.object({
  sceneId: z.string().uuid(),
  entryId: z.string().uuid(),
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
  matchedText: z.string(),
  term: z.string(),
  isAlias: z.boolean(),
});
export type CodexMention = z.infer<typeof CodexMentionSchema>;

export const CodexAmbiguousMentionSchema = z.object({
  sceneId: z.string().uuid(),
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
  matchedText: z.string(),
  candidateEntryIds: z.array(z.string().uuid()).min(2),
});
export type CodexAmbiguousMention = z.infer<typeof CodexAmbiguousMentionSchema>;

export const SceneCodexMentionsSchema = z.object({
  sceneId: z.string().uuid(),
  mentions: z.array(CodexMentionSchema),
  ambiguities: z.array(CodexAmbiguousMentionSchema),
});
export type SceneCodexMentions = z.infer<typeof SceneCodexMentionsSchema>;

export const CodexContextExclusionReasonSchema = z.enum([
  "not-mentioned",
  "manual-only",
  "never",
  "archived",
]);
export type CodexContextExclusionReason = z.infer<typeof CodexContextExclusionReasonSchema>;

export const CodexContextExclusionSchema = z.object({
  entryId: z.string().uuid(),
  name: z.string(),
  reason: CodexContextExclusionReasonSchema,
});
export type CodexContextExclusion = z.infer<typeof CodexContextExclusionSchema>;

export const CodexContextPreviewSchema = z.object({
  sceneId: z.string().uuid(),
  included: z.array(CodexEntryDocumentSchema),
  excluded: z.array(CodexContextExclusionSchema),
});
export type CodexContextPreview = z.infer<typeof CodexContextPreviewSchema>;

export const CodexSearchResultSchema = z.object({
  entryId: z.string().uuid(),
  name: z.string(),
  categoryId: CodexCategoryIdSchema,
  excerpt: z.string(),
});
export type CodexSearchResult = z.infer<typeof CodexSearchResultSchema>;

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
