import { z } from "zod";
import { RevisionHashSchema } from "./common.js";
import { AiTaskKindSchema, TokenUsageSchema } from "./ai.js";

const ContextItemKindV1Schema = z.enum([
  "role-instruction",
  "prompt-template",
  "user-request",
  "full-novel",
  "full-outline",
  "act",
  "chapter",
  "scene-selection",
  "scene",
  "adjacent-scene",
  "scene-summary",
  "codex-entry",
  "codex-effective-state",
  "character-knowledge",
  "plot-thread",
  "scene-section",
  "message-attachment",
  "workshop-chat-history",
  "pending-codex-draft",
  "research-note",
  "style-profile",
  "pinned-note",
]);

export const ContextItemKindSchema = z.enum([
  "role-instruction",
  "prompt-template",
  "user-request",
  "full-novel",
  "full-outline",
  "book",
  "act",
  "chapter",
  "scene-selection",
  "scene",
  "adjacent-scene",
  "scene-summary",
  "codex-entry",
  "codex-effective-state",
  "character-knowledge",
  "plot-thread",
  "scene-section",
  "message-attachment",
  "workshop-chat-history",
  "pending-codex-draft",
  "research-note",
  "style-profile",
  "pinned-note",
]);
export type ContextItemKind = z.infer<typeof ContextItemKindSchema>;

const ContextSourceTypeV1Schema = z.enum([
  "system",
  "user-input",
  "prompt-template",
  "series",
  "act",
  "chapter",
  "scene",
  "scene-section",
  "workshop-message-attachment",
  "workshop-session",
  "codex-entry",
  "codex-relation",
  "codex-progression",
  "codex-knowledge",
  "timeline-event",
  "research-note",
  "style-profile",
]);

export const ContextSourceTypeSchema = z.enum([
  "system",
  "user-input",
  "prompt-template",
  "series",
  "book",
  "act",
  "chapter",
  "scene",
  "scene-section",
  "workshop-message-attachment",
  "workshop-session",
  "codex-entry",
  "codex-relation",
  "codex-progression",
  "codex-knowledge",
  "timeline-event",
  "research-note",
  "style-profile",
]);
export type ContextSourceType = z.infer<typeof ContextSourceTypeSchema>;

const ContextSourceBaseShape = {
  id: z.string().min(1).max(200).nullable().default(null),
  revision: RevisionHashSchema.nullable().default(null),
  label: z.string().max(200).default(""),
} satisfies z.ZodRawShape;

export const ContextSourceV1Schema = z.object({
  type: ContextSourceTypeV1Schema,
  ...ContextSourceBaseShape,
});

export const ContextSourceSchema = z.object({
  type: ContextSourceTypeSchema,
  ...ContextSourceBaseShape,
});
export type ContextSource = z.infer<typeof ContextSourceSchema>;

const ContextItemBaseShape = {
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  content: z.string().max(400000),
  inclusion: z.enum(["required", "selected", "derived"]).default("selected"),
  inclusionReason: z.string().max(1000).default(""),
  contextPolicy: z
    .enum(["always", "on-mention", "manual", "never", "inherit"])
    .nullable()
    .default(null),
  tokenEstimate: z.number().int().nonnegative().default(0),
  manuallySelected: z.boolean().default(false),
  textHash: RevisionHashSchema.nullable().default(null),
} satisfies z.ZodRawShape;

export const ContextItemV1Schema = z.object({
  ...ContextItemBaseShape,
  kind: ContextItemKindV1Schema,
  source: ContextSourceV1Schema,
  sourceRefs: z.array(ContextSourceV1Schema).default([]),
});

export const ContextItemSchema = z.object({
  ...ContextItemBaseShape,
  kind: ContextItemKindSchema,
  source: ContextSourceSchema,
  sourceRefs: z.array(ContextSourceSchema).default([]),
});
export type ContextItem = z.infer<typeof ContextItemSchema>;

export const ContextExclusionReasonSchema = z.enum([
  "future",
  "future-information",
  "hidden-section",
  "policy-never",
  "context-policy-never",
  "not-mentioned",
  "archived",
  "not-selected",
  "over-budget",
  "permission-denied",
]);
export type ContextExclusionReason = z.infer<
  typeof ContextExclusionReasonSchema
>;

const ContextExclusionBaseShape = {
  reason: ContextExclusionReasonSchema,
  title: z.string().max(200).default(""),
  note: z.string().max(1000).default(""),
} satisfies z.ZodRawShape;

export const ContextExclusionV1Schema = z.object({
  source: ContextSourceV1Schema,
  ...ContextExclusionBaseShape,
});

export const ContextExclusionSchema = z.object({
  source: ContextSourceSchema,
  ...ContextExclusionBaseShape,
});
export type ContextExclusion = z.infer<typeof ContextExclusionSchema>;

const ContextBundleBaseShape = {
  id: z.string().uuid(),
  seriesId: z.string().uuid(),
  sceneId: z.string().uuid().nullable().default(null),
  roleId: z.string().min(1).max(120),
  taskKind: AiTaskKindSchema,
  userRequest: z.string().min(1).max(16000),
  promptTemplateId: z.string().uuid(),
  promptTemplateVersion: z.number().int().positive(),
  estimatedUsage: TokenUsageSchema,
  createdAt: z.string().datetime(),
} satisfies z.ZodRawShape;

export const ContextBundleV1Schema = z.object({
  schemaVersion: z.literal(1),
  ...ContextBundleBaseShape,
  items: z.array(ContextItemV1Schema),
  excluded: z.array(ContextExclusionV1Schema).default([]),
});
export type ContextBundleV1 = z.infer<typeof ContextBundleV1Schema>;

export const ContextBundleV2Schema = z.object({
  schemaVersion: z.literal(2),
  ...ContextBundleBaseShape,
  items: z.array(ContextItemSchema),
  excluded: z.array(ContextExclusionSchema).default([]),
});
export type ContextBundleV2 = z.infer<typeof ContextBundleV2Schema>;

export const ContextBundleAuthoritySchema = z.union([ContextBundleV2Schema, ContextBundleV1Schema]);

export const ContextBundleSchema = ContextBundleAuthoritySchema.transform(
  (bundle): ContextBundleV2 => bundle.schemaVersion === 2
    ? bundle
    : ContextBundleV2Schema.parse({ ...bundle, schemaVersion: 2 }),
);
export type ContextBundle = z.infer<typeof ContextBundleSchema>;

const ContextBundleV2MigrationDocumentSchema = z.object({
  contextBundleId: z.string().uuid(),
  relativePath: z.string().trim().min(1).max(500),
  raw: z.string().min(1).max(4_000_000),
  revision: RevisionHashSchema,
  migratedRevision: RevisionHashSchema,
}).strict();

export const ContextBundleV2MigrationBackupSchema = z.object({
  schemaVersion: z.literal(1),
  migrationId: z.string().uuid(),
  seriesId: z.string().uuid(),
  createdAt: z.string().datetime(),
  documents: z.array(ContextBundleV2MigrationDocumentSchema),
}).strict();
export type ContextBundleV2MigrationBackup = z.infer<typeof ContextBundleV2MigrationBackupSchema>;

export const ContextBundleV2MigrationResultSchema = z.object({
  migrationId: z.string().uuid(),
  migratedContextBundleIds: z.array(z.string().uuid()),
}).strict();
export type ContextBundleV2MigrationResult = z.infer<typeof ContextBundleV2MigrationResultSchema>;

export const RollbackContextBundleV2MigrationResultSchema = z.object({
  migrationId: z.string().uuid(),
  restoredContextBundleIds: z.array(z.string().uuid()),
}).strict();
export type RollbackContextBundleV2MigrationResult = z.infer<
  typeof RollbackContextBundleV2MigrationResultSchema
>;

export const ContextPreviewSelectionSchema = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
  text: z.string().max(16000).default(""),
}).refine((selection) => selection.end > selection.start, {
  message: "选区结束位置必须大于开始位置",
  path: ["end"],
});
export type ContextPreviewSelection = z.infer<typeof ContextPreviewSelectionSchema>;

export const ContextPreviewInputSchema = z.object({
  sceneId: z.string().uuid().nullable().default(null),
  blockId: z.string().uuid().nullable().default(null),
  roleId: z.string().min(1).max(120),
  taskKind: AiTaskKindSchema.default("analysis"),
  userRequest: z.string().trim().min(1).max(16000),
  promptTemplateId: z.string().uuid(),
  promptTemplateVersion: z.number().int().positive().default(1),
  selection: ContextPreviewSelectionSchema.nullable().default(null),
  manualContextIds: z.array(z.string().min(1).max(240)).default([]),
  attachmentIds: z.array(z.string().uuid()).max(12).default([]),
  draftToken: z.string().trim().min(1).max(120).nullable().default(null),
  workshopSessionId: z.string().uuid().nullable().default(null),
  excludeWorkshopMessageId: z.string().uuid().nullable().default(null),
  includePendingWorkshopCodexDraft: z.boolean().default(false),
  systemPromptOverride: z.string().trim().max(8000).nullable().default(null),
  modelProfileId: z.string().uuid().nullable().default(null),
  tokenBudget: z.number().int().positive().nullable().default(null),
});
export type ContextPreviewInput = z.input<typeof ContextPreviewInputSchema>;
