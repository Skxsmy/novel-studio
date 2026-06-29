import { z } from "zod";
import { CloudPolicySchema, RevisionHashSchema } from "./common.js";
import { AiTaskKindSchema, TokenUsageSchema } from "./ai.js";

export const ContextItemKindSchema = z.enum([
  "role-instruction",
  "prompt-template",
  "user-request",
  "scene-selection",
  "scene",
  "adjacent-scene",
  "scene-summary",
  "codex-entry",
  "codex-effective-state",
  "character-knowledge",
  "plot-thread",
  "scene-section",
  "research-note",
  "style-profile",
  "pinned-note",
]);
export type ContextItemKind = z.infer<typeof ContextItemKindSchema>;

export const ContextSourceTypeSchema = z.enum([
  "system",
  "user-input",
  "prompt-template",
  "scene",
  "scene-section",
  "codex-entry",
  "codex-relation",
  "codex-progression",
  "codex-knowledge",
  "timeline-event",
  "research-note",
  "style-profile",
]);
export type ContextSourceType = z.infer<typeof ContextSourceTypeSchema>;

export const ContextSourceSchema = z.object({
  type: ContextSourceTypeSchema,
  id: z.string().min(1).max(200).nullable().default(null),
  revision: RevisionHashSchema.nullable().default(null),
  label: z.string().max(200).default(""),
});
export type ContextSource = z.infer<typeof ContextSourceSchema>;

export const ContextItemSchema = z.object({
  id: z.string().min(1).max(200),
  kind: ContextItemKindSchema,
  source: ContextSourceSchema,
  title: z.string().min(1).max(200),
  content: z.string().max(400000),
  inclusion: z.enum(["required", "selected", "derived"]).default("selected"),
  inclusionReason: z.string().max(1000).default(""),
  access: CloudPolicySchema.default("local-only"),
  contextPolicy: z
    .enum(["always", "on-mention", "manual", "never", "inherit", "local-only"])
    .nullable()
    .default(null),
  tokenEstimate: z.number().int().nonnegative().default(0),
  manuallySelected: z.boolean().default(false),
  textHash: RevisionHashSchema.nullable().default(null),
  sourceRefs: z.array(ContextSourceSchema).default([]),
});
export type ContextItem = z.infer<typeof ContextItemSchema>;

export const ContextExclusionReasonSchema = z.enum([
  "future",
  "future-information",
  "hidden-section",
  "policy-never",
  "context-policy-never",
  "policy-local-only",
  "cloud-disabled",
  "not-mentioned",
  "archived",
  "not-selected",
  "over-budget",
  "permission-denied",
]);
export type ContextExclusionReason = z.infer<
  typeof ContextExclusionReasonSchema
>;

export const ContextExclusionSchema = z.object({
  source: ContextSourceSchema,
  reason: ContextExclusionReasonSchema,
  title: z.string().max(200).default(""),
  note: z.string().max(1000).default(""),
});
export type ContextExclusion = z.infer<typeof ContextExclusionSchema>;

export const ContextBundleSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  seriesId: z.string().uuid(),
  sceneId: z.string().uuid().nullable().default(null),
  roleId: z.string().min(1).max(120),
  taskKind: AiTaskKindSchema,
  userRequest: z.string().min(1).max(16000),
  promptTemplateId: z.string().uuid(),
  promptTemplateVersion: z.number().int().positive(),
  items: z.array(ContextItemSchema),
  excluded: z.array(ContextExclusionSchema).default([]),
  estimatedUsage: TokenUsageSchema,
  createdAt: z.string().datetime(),
});
export type ContextBundle = z.infer<typeof ContextBundleSchema>;

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
  sceneId: z.string().uuid(),
  blockId: z.string().uuid().nullable().default(null),
  roleId: z.string().min(1).max(120).default("continuity-editor"),
  taskKind: AiTaskKindSchema.default("continuity-check"),
  userRequest: z.string().trim().min(1).max(16000),
  promptTemplateId: z.string().uuid(),
  promptTemplateVersion: z.number().int().positive().default(1),
  selection: ContextPreviewSelectionSchema.nullable().default(null),
  manualContextIds: z.array(z.string().min(1).max(240)).default([]),
  modelProfileId: z.string().uuid().nullable().default(null),
  tokenBudget: z.number().int().positive().nullable().default(null),
});
export type ContextPreviewInput = z.input<typeof ContextPreviewInputSchema>;
