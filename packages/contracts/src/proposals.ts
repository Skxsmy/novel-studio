import { z } from "zod";
import { AiProviderSchema } from "./ai.js";
import { CodexCategoryIdSchema } from "./codex.js";
import { RevisionHashSchema } from "./common.js";
import { ResearchNoteEvidenceSchema } from "./researchNotes.js";

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
  "research-note",
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

export const ResearchNotePromotionMeaningSchema = z.enum([
  "real-world-reference",
  "world-rule",
  "inspiration-only",
]);
export type ResearchNotePromotionMeaning = z.infer<
  typeof ResearchNotePromotionMeaningSchema
>;

export const ExistingResearchNotePromotionTargetInputSchema = z.object({
  kind: z.literal("existing"),
  entryId: z.string().uuid(),
  targetRevision: RevisionHashSchema,
}).strict();
export type ExistingResearchNotePromotionTargetInput = z.infer<
  typeof ExistingResearchNotePromotionTargetInputSchema
>;

export const NewResearchNotePromotionTargetInputSchema = z.object({
  kind: z.literal("new"),
  categoryId: CodexCategoryIdSchema,
  name: z.string().trim().min(1).max(160),
}).strict();
export type NewResearchNotePromotionTargetInput = z.infer<
  typeof NewResearchNotePromotionTargetInputSchema
>;

export const ResearchNotePromotionTargetInputSchema = z.discriminatedUnion("kind", [
  ExistingResearchNotePromotionTargetInputSchema,
  NewResearchNotePromotionTargetInputSchema,
]);
export type ResearchNotePromotionTargetInput = z.infer<
  typeof ResearchNotePromotionTargetInputSchema
>;

export const CreateResearchNotePromotionInputSchema = z.object({
  seriesId: z.string().uuid(),
  baseRevision: RevisionHashSchema,
  meaning: ResearchNotePromotionMeaningSchema,
  target: ResearchNotePromotionTargetInputSchema,
  candidateText: z.string().trim().min(1).max(400_000),
}).strict();
export type CreateResearchNotePromotionInput = z.infer<
  typeof CreateResearchNotePromotionInputSchema
>;

export const ResearchNotePromotionEvidenceBaselineSchema = ResearchNoteEvidenceSchema.pick({
  id: true,
  researchDatabaseId: true,
  sourceId: true,
  sourceRevision: true,
  sourceContentHash: true,
  sourceKind: true,
  blockId: true,
  chunkId: true,
  chunkHash: true,
  quoteHash: true,
  languageTag: true,
  location: true,
});
export type ResearchNotePromotionEvidenceBaseline = z.infer<
  typeof ResearchNotePromotionEvidenceBaselineSchema
>;

export const ExistingResearchNotePromotionTargetBaselineSchema = z.object({
  kind: z.literal("existing"),
  entryId: z.string().uuid(),
}).strict();

export const NewResearchNotePromotionTargetBaselineSchema = z.object({
  kind: z.literal("new"),
  entryId: z.string().uuid(),
  categoryId: CodexCategoryIdSchema,
  name: z.string().trim().min(1).max(160),
}).strict();

export const ResearchNotePromotionTargetBaselineSchema = z.discriminatedUnion("kind", [
  ExistingResearchNotePromotionTargetBaselineSchema,
  NewResearchNotePromotionTargetBaselineSchema,
]);
export type ResearchNotePromotionTargetBaseline = z.infer<
  typeof ResearchNotePromotionTargetBaselineSchema
>;

export const ResearchNotePromotionBaselineSchema = z.object({
  schemaVersion: z.literal(1),
  meaning: ResearchNotePromotionMeaningSchema,
  researchDatabaseId: z.string().uuid(),
  noteId: z.string().uuid(),
  noteRevision: RevisionHashSchema,
  evidence: z.array(ResearchNotePromotionEvidenceBaselineSchema).min(1).max(100),
  target: ResearchNotePromotionTargetBaselineSchema,
}).strict();
export type ResearchNotePromotionBaseline = z.infer<
  typeof ResearchNotePromotionBaselineSchema
>;

const SceneContentPatchActions = new Set<z.infer<typeof ProposalPatchActionSchema>>([
  "insert-text",
  "replace-content",
  "replace-text",
]);

export const ProposalPatchSchema = z
  .object({
    id: z.string().uuid(),
    target: ProposalTargetSchema,
    action: ProposalPatchActionSchema,
    before: z.string().max(400000).nullable().default(null),
    after: z.string().max(400000).nullable().default(null),
    unifiedDiff: z.string().max(400000).default(""),
  })
  .superRefine((patch, context) => {
    if (
      patch.target.kind === "scene-content" &&
      SceneContentPatchActions.has(patch.action) &&
      !patch.target.baseRevision
    ) {
      context.addIssue({
        code: "custom",
        message: "Scene content Proposal patches require baseRevision",
        path: ["target", "baseRevision"],
      });
    }
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

export const ProposalSnapshotV1Schema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  seriesId: z.string().uuid(),
  proposalId: z.string().uuid(),
  target: ProposalTargetSchema,
  createdAt: z.string().datetime(),
  targetRevision: RevisionHashSchema,
  data: z.record(z.string(), z.unknown()),
});
export const ProposalSnapshotV2Schema = z.object({
  schemaVersion: z.literal(2),
  id: z.string().uuid(),
  seriesId: z.string().uuid(),
  proposalId: z.string().uuid(),
  target: ProposalTargetSchema,
  createdAt: z.string().datetime(),
  targetRevision: RevisionHashSchema.nullable(),
  targetAbsent: z.boolean(),
  data: z.record(z.string(), z.unknown()),
}).strict().superRefine((snapshot, context) => {
  if (snapshot.targetAbsent === (snapshot.targetRevision !== null)) {
    context.addIssue({
      code: "custom",
      message: "Proposal snapshot must record either a target revision or verified target absence",
      path: ["targetRevision"],
    });
  }
});
export const ProposalSnapshotSchema = z.union([
  ProposalSnapshotV1Schema,
  ProposalSnapshotV2Schema,
]);
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
    researchNotePromotion: ResearchNotePromotionBaselineSchema.nullable().default(null),
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

    const promotion = proposal.researchNotePromotion;
    if (proposal.source.kind === "research-note" && !promotion) {
      context.addIssue({
        code: "custom",
        message: "Research Note Proposal sources require a promotion baseline",
        path: ["researchNotePromotion"],
      });
    }
    if (promotion) {
      if (proposal.source.kind !== "research-note" || proposal.source.sourceId !== promotion.noteId) {
        context.addIssue({
          code: "custom",
          message: "Research Note promotion baseline must match the Proposal source",
          path: ["source"],
        });
      }
      const expectedTargetKind = promotion.meaning === "world-rule" ? "codex-entry" : "codex-research";
      if (proposal.target.kind !== expectedTargetKind || proposal.target.targetId !== promotion.target.entryId) {
        context.addIssue({
          code: "custom",
          message: "Research Note promotion target does not match its meaning and baseline",
          path: ["target"],
        });
      }
      if (proposal.patches.length !== 1) {
        context.addIssue({
          code: "custom",
          message: "Research Note promotion requires exactly one Codex patch",
          path: ["patches"],
        });
      } else {
        const patch = proposal.patches[0]!;
        const expectedFieldPath = promotion.meaning === "world-rule" ? "description" : "research";
        const expectedAction = promotion.target.kind === "new" ? "create-codex-entry" : "update-codex-entry";
        if (
          patch.target.kind !== proposal.target.kind
          || patch.target.targetId !== proposal.target.targetId
          || patch.action !== expectedAction
          || patch.target.fieldPath.length !== 1
          || patch.target.fieldPath[0] !== expectedFieldPath
          || patch.after === null
        ) {
          context.addIssue({
            code: "custom",
            message: "Research Note promotion patch is incompatible with its target",
            path: ["patches", 0],
          });
        }
        if (promotion.target.kind === "new" && (patch.target.baseRevision !== null || patch.before !== null)) {
          context.addIssue({
            code: "custom",
            message: "New Codex promotion targets require an absent baseline",
            path: ["patches", 0, "target", "baseRevision"],
          });
        }
        if (promotion.target.kind === "existing" && (!patch.target.baseRevision || patch.before === null)) {
          context.addIssue({
            code: "custom",
            message: "Existing Codex promotion targets require a revision and before text",
            path: ["patches", 0, "target", "baseRevision"],
          });
        }
      }
      const expectedType = promotion.target.kind === "new" ? "codex-create" : "codex-update";
      if (proposal.type !== expectedType) {
        context.addIssue({
          code: "custom",
          message: "Research Note promotion type must match target creation state",
          path: ["type"],
        });
      }
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
  researchNotePromotion: ResearchNotePromotionBaselineSchema.nullable().default(null),
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

export const ProposalBatchAcceptItemSchema = z.object({
  proposalId: z.string().uuid(),
  baseRevision: RevisionHashSchema,
});
export type ProposalBatchAcceptItem = z.infer<
  typeof ProposalBatchAcceptItemSchema
>;

export const ProposalBatchAcceptInputSchema = z.object({
  items: z.array(ProposalBatchAcceptItemSchema).min(1),
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
  revision: RevisionHashSchema.nullable().default(null),
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
