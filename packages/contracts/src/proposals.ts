import { z } from "zod";
import { AiProviderSchema } from "./ai.js";
import { RevisionHashSchema } from "./common.js";

export const ProposalTypeSchema = z.enum([
  "text-insertion",
  "text-replacement",
  "scene-summary",
  "codex-create",
  "codex-update",
  "detail-type-update",
  "relation-update",
  "progression-create",
  "planning-update",
  "research-note",
  "continuity-issue",
]);
export type ProposalType = z.infer<typeof ProposalTypeSchema>;

export const ProposalTargetKindSchema = z.enum([
  "scene-content",
  "scene-metadata",
  "scene-section",
  "codex-entry",
  "codex-research",
  "codex-relation",
  "codex-progression",
  "codex-knowledge",
  "detail-type",
  "timeline-event",
  "planning",
  "research-note",
]);
export type ProposalTargetKind = z.infer<typeof ProposalTargetKindSchema>;

export const ProposalPatchActionSchema = z.enum([
  "replace-content",
  "replace-field",
  "create-document",
  "archive-document",
  "insert-text",
  "replace-text",
  "create-codex-entry",
  "update-codex-entry",
  "create-progression",
  "update-planning",
  "create-research-note",
]);
export type ProposalPatchAction = z.infer<typeof ProposalPatchActionSchema>;

export const ProposalSourceKindSchema = z.enum([
  "workshop-message",
  "write-selection",
  "codex-entry",
  "tool-plan",
  "import",
  "model-call",
  "manual",
]);
export type ProposalSourceKind = z.infer<typeof ProposalSourceKindSchema>;

export const ProposalGeneratorKindSchema = z.enum([
  "ai",
  "manual",
  "tool",
  "import",
]);
export type ProposalGeneratorKind = z.infer<typeof ProposalGeneratorKindSchema>;

export const ProposalRiskLevelSchema = z.enum(["low", "medium", "high"]);
export type ProposalRiskLevel = z.infer<typeof ProposalRiskLevelSchema>;

export const ProposalStatusSchema = z.enum([
  "pending",
  "accepted",
  "rejected",
  "edited",
  "stale",
  "superseded",
  "archived",
]);
export type ProposalStatus = z.infer<typeof ProposalStatusSchema>;

export const ProposalDecisionKindSchema = z.enum([
  "accepted",
  "rejected",
  "edited",
  "stale",
  "superseded",
  "archived",
]);
export type ProposalDecisionKind = z.infer<typeof ProposalDecisionKindSchema>;

export const ProposalTextRangeSchema = z
  .object({
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
    text: z.string().max(400000).default(""),
  })
  .superRefine((range, context) => {
    if (range.end < range.start) {
      context.addIssue({
        code: "custom",
        message: "Proposal range end must not be before start",
        path: ["end"],
      });
    }
  });
export type ProposalTextRange = z.infer<typeof ProposalTextRangeSchema>;

export const ProposalSourceSchema = z
  .object({
    kind: ProposalSourceKindSchema,
    sourceId: z.string().min(1).max(240).nullable().default(null),
    label: z.string().trim().min(1).max(240),
    detail: z.string().max(4000).default(""),
  })
  .superRefine((source, context) => {
    if (source.kind !== "manual" && !source.sourceId) {
      context.addIssue({
        code: "custom",
        message: "Non-manual Proposal sources require sourceId",
        path: ["sourceId"],
      });
    }
  });
export type ProposalSource = z.infer<typeof ProposalSourceSchema>;

export const ProposalTargetSchema = z.object({
  kind: ProposalTargetKindSchema,
  targetId: z.string().min(1).max(240),
  label: z.string().trim().min(1).max(240),
  baseRevision: RevisionHashSchema.nullable().default(null),
  fieldPath: z.array(z.string().trim().min(1).max(120)).default([]),
  blockId: z.string().uuid().nullable().default(null),
  range: ProposalTextRangeSchema.nullable().default(null),
});
export type ProposalTarget = z.infer<typeof ProposalTargetSchema>;

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
  "workshop-message",
  "write-selection",
  "tool-plan",
  "context-bundle",
]);
export type ProposalEvidenceSourceType = z.infer<
  typeof ProposalEvidenceSourceTypeSchema
>;

export const ProposalEvidenceSchema = z.object({
  sourceType: ProposalEvidenceSourceTypeSchema,
  sourceId: z.string().min(1).max(240),
  revision: RevisionHashSchema.nullable().default(null),
  quote: z.string().max(16000).default(""),
  note: z.string().trim().min(1).max(16000),
});
export type ProposalEvidence = z.infer<typeof ProposalEvidenceSchema>;

export const ProposalPatchSchema = z.object({
  id: z.string().uuid(),
  target: ProposalTargetSchema,
  action: ProposalPatchActionSchema,
  before: z.string().max(400000).nullable().default(null),
  after: z.string().max(400000).nullable().default(null),
  unifiedDiff: z.string().max(400000).default(""),
});
export type ProposalPatch = z.infer<typeof ProposalPatchSchema>;

export const AiProposalGeneratorSchema = z.object({
  kind: z.literal("ai"),
  roleId: z.string().min(1).max(120),
  modelCallLogId: z.string().uuid(),
  provider: AiProviderSchema,
  model: z.string().min(1).max(200),
  promptTemplateId: z.string().uuid(),
  promptTemplateVersion: z.number().int().positive(),
});
export type AiProposalGenerator = z.infer<typeof AiProposalGeneratorSchema>;

export const ManualProposalGeneratorSchema = z.object({
  kind: z.literal("manual"),
  actor: z.string().trim().min(1).max(160).default("user"),
});
export type ManualProposalGenerator = z.infer<
  typeof ManualProposalGeneratorSchema
>;

export const ToolProposalGeneratorSchema = z.object({
  kind: z.literal("tool"),
  toolDefinitionId: z.string().trim().min(1).max(160),
  toolPlanId: z.string().uuid().nullable().default(null),
  actor: z.string().trim().min(1).max(160).default("workshop"),
});
export type ToolProposalGenerator = z.infer<typeof ToolProposalGeneratorSchema>;

export const ImportProposalGeneratorSchema = z.object({
  kind: z.literal("import"),
  importId: z.string().uuid().nullable().default(null),
  format: z.string().trim().min(1).max(80),
  actor: z.string().trim().min(1).max(160).default("import"),
});
export type ImportProposalGenerator = z.infer<
  typeof ImportProposalGeneratorSchema
>;

export const ProposalGeneratorSchema = z.discriminatedUnion("kind", [
  AiProposalGeneratorSchema,
  ManualProposalGeneratorSchema,
  ToolProposalGeneratorSchema,
  ImportProposalGeneratorSchema,
]);
export type ProposalGenerator = z.infer<typeof ProposalGeneratorSchema>;

export const ProposalCandidateSnapshotSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().max(16000).default(""),
  reason: z.string().max(16000).default(""),
  patches: z.array(ProposalPatchSchema).min(1),
});
export type ProposalCandidateSnapshot = z.infer<
  typeof ProposalCandidateSnapshotSchema
>;

export const ProposalDecisionSchema = z.object({
  kind: ProposalDecisionKindSchema,
  actor: z.string().trim().min(1).max(160).default("user"),
  decidedAt: z.string().datetime(),
  note: z.string().max(4000).default(""),
  snapshotId: z.string().uuid().nullable().default(null),
  editedCandidate: ProposalCandidateSnapshotSchema.nullable().default(null),
});
export type ProposalDecision = z.infer<typeof ProposalDecisionSchema>;

export const ProposalSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  seriesId: z.string().uuid(),
  proposalId: z.string().uuid(),
  target: ProposalTargetSchema,
  createdAt: z.string().datetime(),
  targetRevision: RevisionHashSchema,
  data: z.record(z.string(), z.unknown()),
});
export type ProposalSnapshot = z.infer<typeof ProposalSnapshotSchema>;

export const ProposalSchema = z
  .object({
    schemaVersion: z.literal(2),
    id: z.string().uuid(),
    seriesId: z.string().uuid(),
    type: ProposalTypeSchema,
    title: z.string().trim().min(1).max(200),
    summary: z.string().max(16000).default(""),
    status: ProposalStatusSchema.default("pending"),
    source: ProposalSourceSchema,
    target: ProposalTargetSchema,
    contextBundleId: z.string().uuid().nullable().default(null),
    generator: ProposalGeneratorSchema,
    riskLevel: ProposalRiskLevelSchema.default("medium"),
    confidence: z.number().min(0).max(1).nullable().default(null),
    reason: z.string().max(16000).default(""),
    staleReason: z.string().max(4000).default(""),
    supersededBy: z.string().uuid().nullable().default(null),
    originalCandidate: ProposalCandidateSnapshotSchema.nullable().default(null),
    decision: ProposalDecisionSchema.nullable().default(null),
    patches: z.array(ProposalPatchSchema).min(1),
    evidence: z.array(ProposalEvidenceSchema).default([]),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .superRefine((proposal, context) => {
    if (proposal.generator.kind === "ai" && !proposal.contextBundleId) {
      context.addIssue({
        code: "custom",
        message: "AI-generated Proposals require contextBundleId",
        path: ["contextBundleId"],
      });
    }

    if (proposal.status === "pending" && proposal.decision) {
      context.addIssue({
        code: "custom",
        message: "Pending Proposals cannot contain a decision",
        path: ["decision"],
      });
    }

    if (proposal.status !== "pending" && !proposal.decision) {
      context.addIssue({
        code: "custom",
        message: "Decided Proposals require a decision record",
        path: ["decision"],
      });
    }

    if (proposal.decision && proposal.decision.kind !== proposal.status) {
      context.addIssue({
        code: "custom",
        message: "Proposal decision kind must match status",
        path: ["decision", "kind"],
      });
    }

    if (proposal.status === "stale" && !proposal.staleReason.trim()) {
      context.addIssue({
        code: "custom",
        message: "Stale Proposals require staleReason",
        path: ["staleReason"],
      });
    }

    if (proposal.status === "superseded" && !proposal.supersededBy) {
      context.addIssue({
        code: "custom",
        message: "Superseded Proposals require supersededBy",
        path: ["supersededBy"],
      });
    }

    if (proposal.status === "edited" && !proposal.originalCandidate) {
      context.addIssue({
        code: "custom",
        message: "Edited Proposals require originalCandidate",
        path: ["originalCandidate"],
      });
    }

    if (
      (proposal.status === "accepted" || proposal.status === "edited") &&
      !proposal.decision?.snapshotId
    ) {
      context.addIssue({
        code: "custom",
        message: "Accepted Proposal decisions require snapshotId",
        path: ["decision", "snapshotId"],
      });
    }
  });
export type Proposal = z.infer<typeof ProposalSchema>;

export const ProposalAvailabilitySchema = z.object({
  available: z.boolean(),
  reason: z.string().max(4000).default(""),
});
export type ProposalAvailability = z.infer<typeof ProposalAvailabilitySchema>;

export const ProposalDocumentSchema = z.object({
  proposal: ProposalSchema,
  revision: RevisionHashSchema,
  sourceAvailability: ProposalAvailabilitySchema,
  targetAvailability: ProposalAvailabilitySchema,
});
export type ProposalDocument = z.infer<typeof ProposalDocumentSchema>;

export const ProposalStorageDiagnosticSchema = z.object({
  fileName: z.string(),
  code: z.string(),
  message: z.string(),
});
export type ProposalStorageDiagnostic = z.infer<
  typeof ProposalStorageDiagnosticSchema
>;

export const ProposalInboxSchema = z.object({
  items: z.array(ProposalDocumentSchema),
  diagnostics: z.array(ProposalStorageDiagnosticSchema).default([]),
});
export type ProposalInbox = z.infer<typeof ProposalInboxSchema>;

export const CreateProposalInputSchema = z.object({
  id: z.string().uuid().optional(),
  type: ProposalTypeSchema,
  title: z.string().trim().min(1).max(200),
  summary: z.string().max(16000).default(""),
  source: ProposalSourceSchema,
  target: ProposalTargetSchema,
  contextBundleId: z.string().uuid().nullable().default(null),
  generator: ProposalGeneratorSchema,
  riskLevel: ProposalRiskLevelSchema.default("medium"),
  confidence: z.number().min(0).max(1).nullable().default(null),
  reason: z.string().max(16000).default(""),
  patches: z.array(ProposalPatchSchema).min(1),
  evidence: z.array(ProposalEvidenceSchema).default([]),
});
export type CreateProposalInput = z.input<typeof CreateProposalInputSchema>;

export const ProposalRevisionInputSchema = z.object({
  baseRevision: RevisionHashSchema,
  actor: z.string().trim().min(1).max(160).default("user"),
  note: z.string().max(4000).default(""),
});
export type ProposalRevisionInput = z.infer<typeof ProposalRevisionInputSchema>;

export const EditAndAcceptProposalInputSchema = ProposalRevisionInputSchema.extend({
  title: z.string().trim().min(1).max(200).optional(),
  summary: z.string().max(16000).optional(),
  reason: z.string().max(16000).optional(),
  patches: z.array(ProposalPatchSchema).min(1),
});
export type EditAndAcceptProposalInput = z.infer<
  typeof EditAndAcceptProposalInputSchema
>;

export const MarkProposalStaleInputSchema = ProposalRevisionInputSchema.extend({
  staleReason: z.string().trim().min(1).max(4000),
});
export type MarkProposalStaleInput = z.infer<
  typeof MarkProposalStaleInputSchema
>;

export const SupersedeProposalInputSchema = ProposalRevisionInputSchema.extend({
  supersededBy: z.string().uuid(),
});
export type SupersedeProposalInput = z.infer<
  typeof SupersedeProposalInputSchema
>;

export const ProposalBatchPreviewInputSchema = z.object({
  proposalIds: z.array(z.string().uuid()).min(1),
});
export type ProposalBatchPreviewInput = z.infer<
  typeof ProposalBatchPreviewInputSchema
>;

export const ProposalBatchAcceptInputSchema =
  ProposalBatchPreviewInputSchema.extend({
    actor: z.string().trim().min(1).max(160).default("user"),
    note: z.string().max(4000).default(""),
  });
export type ProposalBatchAcceptInput = z.infer<
  typeof ProposalBatchAcceptInputSchema
>;

export const ProposalApplyResultSchema = z.object({
  proposal: ProposalDocumentSchema,
  snapshot: ProposalSnapshotSchema.nullable(),
});
export type ProposalApplyResult = z.infer<typeof ProposalApplyResultSchema>;

export const ProposalBatchPreviewItemSchema = z.object({
  proposalId: z.string().uuid(),
  eligible: z.boolean(),
  reason: z.string().max(4000).default(""),
});
export type ProposalBatchPreviewItem = z.infer<
  typeof ProposalBatchPreviewItemSchema
>;

export const ProposalBatchPreviewResultSchema = z.object({
  items: z.array(ProposalBatchPreviewItemSchema),
});
export type ProposalBatchPreviewResult = z.infer<
  typeof ProposalBatchPreviewResultSchema
>;

export const ProposalBatchAcceptResultSchema = z.object({
  completed: z.array(ProposalApplyResultSchema),
  skipped: z.array(ProposalBatchPreviewItemSchema),
  blocked: z.array(ProposalBatchPreviewItemSchema),
  failed: z.array(ProposalBatchPreviewItemSchema),
});
export type ProposalBatchAcceptResult = z.infer<
  typeof ProposalBatchAcceptResultSchema
>;

export const PROPOSAL_ALLOWED_TRANSITIONS: Record<
  ProposalStatus,
  readonly ProposalStatus[]
> = {
  pending: ["accepted", "rejected", "edited", "stale", "superseded", "archived"],
  accepted: ["archived"],
  rejected: ["archived"],
  edited: ["archived"],
  stale: ["superseded", "archived"],
  superseded: ["archived"],
  archived: [],
};

export function canTransitionProposalStatus(
  from: ProposalStatus,
  to: ProposalStatus,
): boolean {
  return PROPOSAL_ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertProposalStatusTransition(
  from: ProposalStatus,
  to: ProposalStatus,
): void {
  if (!canTransitionProposalStatus(from, to)) {
    throw new Error(`Invalid Proposal status transition: ${from} -> ${to}`);
  }
}
