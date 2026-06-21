import { z } from "zod";
import { RevisionHashSchema } from "./common.js";
import { AiProviderSchema } from "./ai.js";

export const ProposalTargetKindSchema = z.enum([
  "scene-content",
  "scene-metadata",
  "scene-section",
  "codex-entry",
  "codex-research",
  "codex-relation",
  "codex-progression",
  "codex-knowledge",
  "timeline-event",
]);
export type ProposalTargetKind = z.infer<typeof ProposalTargetKindSchema>;

export const ProposalPatchActionSchema = z.enum([
  "replace-content",
  "replace-field",
  "create-document",
  "archive-document",
]);
export type ProposalPatchAction = z.infer<typeof ProposalPatchActionSchema>;

export const ProposalEvidenceSourceTypeSchema = z.enum([
  "scene",
  "scene-section",
  "codex-entry",
  "codex-relation",
  "codex-progression",
  "codex-knowledge",
  "timeline-event",
  "research-note",
  "model-call",
]);
export type ProposalEvidenceSourceType = z.infer<
  typeof ProposalEvidenceSourceTypeSchema
>;

export const ProposalEvidenceSchema = z.object({
  sourceType: ProposalEvidenceSourceTypeSchema,
  sourceId: z.string().min(1).max(200),
  revision: RevisionHashSchema.nullable().default(null),
  quote: z.string().max(16000).default(""),
  note: z.string().trim().min(1).max(16000),
});
export type ProposalEvidence = z.infer<typeof ProposalEvidenceSchema>;

export const ProposalPatchSchema = z.object({
  id: z.string().uuid(),
  targetKind: ProposalTargetKindSchema,
  targetId: z.string().min(1).max(200),
  baseRevision: RevisionHashSchema.nullable().default(null),
  action: ProposalPatchActionSchema,
  fieldPath: z.array(z.string().min(1).max(120)).default([]),
  before: z.string().max(400000).nullable().default(null),
  after: z.string().max(400000).nullable().default(null),
  unifiedDiff: z.string().max(400000).default(""),
});
export type ProposalPatch = z.infer<typeof ProposalPatchSchema>;

export const ProposalStatusSchema = z.enum([
  "pending",
  "accepted",
  "rejected",
  "superseded",
  "conflicted",
  "archived",
]);
export type ProposalStatus = z.infer<typeof ProposalStatusSchema>;

export const ProposalGeneratorSchema = z.object({
  roleId: z.string().min(1).max(120),
  modelCallLogId: z.string().uuid(),
  provider: AiProviderSchema,
  model: z.string().min(1).max(200),
  promptTemplateId: z.string().uuid(),
  promptTemplateVersion: z.number().int().positive(),
});
export type ProposalGenerator = z.infer<typeof ProposalGeneratorSchema>;

export const ProposalSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  seriesId: z.string().uuid(),
  title: z.string().min(1).max(200),
  summary: z.string().max(16000).default(""),
  status: ProposalStatusSchema.default("pending"),
  generatedBy: ProposalGeneratorSchema,
  patches: z.array(ProposalPatchSchema).min(1),
  evidence: z.array(ProposalEvidenceSchema).default([]),
  createdAt: z.string().datetime(),
  decidedAt: z.string().datetime().nullable().default(null),
  decisionNote: z.string().max(4000).default(""),
});
export type Proposal = z.infer<typeof ProposalSchema>;
