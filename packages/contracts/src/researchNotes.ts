import { z } from "zod";
import {
  ResearchSourceKindSchema,
  ResearchSourceLocationSchema,
} from "./research.js";

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const BCP47_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u;

export const MAX_RESEARCH_NOTE_BODY_CHARS = 400_000;
export const MAX_RESEARCH_NOTE_EVIDENCE_ITEMS = 100;
export const MAX_RESEARCH_NOTE_QUOTE_CHARS = 100_000;

export const ResearchNoteStatusSchema = z.enum(["active", "archived"]);
export type ResearchNoteStatus = z.infer<typeof ResearchNoteStatusSchema>;

export const ResearchNoteEvidenceSchema = z.object({
  id: z.string().uuid(),
  researchDatabaseId: z.string().uuid(),
  sourceId: z.string().uuid(),
  sourceRevision: z.string().regex(SHA256_PATTERN),
  sourceContentHash: z.string().regex(SHA256_PATTERN),
  sourceDisplayName: z.string().trim().min(1).max(240),
  sourceKind: ResearchSourceKindSchema,
  blockId: z.string().uuid(),
  chunkId: z.string().uuid(),
  chunkHash: z.string().regex(SHA256_PATTERN),
  originalText: z.string().min(1).max(MAX_RESEARCH_NOTE_QUOTE_CHARS),
  quoteHash: z.string().regex(SHA256_PATTERN),
  languageTag: z.string().trim().regex(BCP47_PATTERN).max(64),
  location: ResearchSourceLocationSchema,
  capturedAt: z.string().datetime(),
}).strict();
export type ResearchNoteEvidence = z.infer<typeof ResearchNoteEvidenceSchema>;

export const ResearchNoteSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  researchDatabaseId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  body: z.string().max(MAX_RESEARCH_NOTE_BODY_CHARS).default(""),
  tags: z.array(z.string().trim().min(1).max(80)).max(40).default([]),
  evidence: z.array(ResearchNoteEvidenceSchema).min(1).max(MAX_RESEARCH_NOTE_EVIDENCE_ITEMS),
  status: ResearchNoteStatusSchema.default("active"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable().default(null),
}).strict().superRefine((note, context) => {
  const normalizedTags = note.tags.map((tag) => tag.normalize("NFKC").toLocaleLowerCase("und"));
  if (new Set(normalizedTags).size !== normalizedTags.length) {
    context.addIssue({ code: "custom", message: "Research Note tags must be unique", path: ["tags"] });
  }
  if (note.status === "active" && note.archivedAt !== null) {
    context.addIssue({ code: "custom", message: "An active Research Note cannot have archivedAt", path: ["archivedAt"] });
  }
  if (note.status === "archived" && note.archivedAt === null) {
    context.addIssue({ code: "custom", message: "An archived Research Note requires archivedAt", path: ["archivedAt"] });
  }
  const evidenceIds = new Set<string>();
  const passageKeys = new Set<string>();
  for (const [index, evidence] of note.evidence.entries()) {
    if (evidence.researchDatabaseId !== note.researchDatabaseId) {
      context.addIssue({
        code: "custom",
        message: "Research Note evidence must belong to the Note database",
        path: ["evidence", index, "researchDatabaseId"],
      });
    }
    if (evidenceIds.has(evidence.id)) {
      context.addIssue({ code: "custom", message: "Research Note evidence IDs must be unique", path: ["evidence", index, "id"] });
    }
    evidenceIds.add(evidence.id);
    const passageKey = `${evidence.sourceId}:${evidence.sourceRevision}:${evidence.chunkId}:${evidence.chunkHash}`;
    if (passageKeys.has(passageKey)) {
      context.addIssue({ code: "custom", message: "Research Note evidence passages must be unique", path: ["evidence", index] });
    }
    passageKeys.add(passageKey);
  }
});
export type ResearchNote = z.infer<typeof ResearchNoteSchema>;

export const ResearchNoteDocumentSchema = z.object({
  note: ResearchNoteSchema,
  revision: z.string().regex(SHA256_PATTERN),
});
export type ResearchNoteDocument = z.infer<typeof ResearchNoteDocumentSchema>;

export const ResearchNoteEvidenceCaptureInputSchema = z.object({
  sourceId: z.string().uuid(),
  sourceRevision: z.string().regex(SHA256_PATTERN),
  blockId: z.string().uuid(),
  chunkId: z.string().uuid(),
  chunkHash: z.string().regex(SHA256_PATTERN),
}).strict();
export type ResearchNoteEvidenceCaptureInput = z.infer<typeof ResearchNoteEvidenceCaptureInputSchema>;

function uniqueCaptureListSchema(minimum: number, maximum: number) {
  return z.array(ResearchNoteEvidenceCaptureInputSchema).min(minimum).max(maximum).superRefine((items, context) => {
    const keys = new Set<string>();
    for (const [index, item] of items.entries()) {
      const key = `${item.sourceId}:${item.sourceRevision}:${item.chunkId}:${item.chunkHash}`;
      if (keys.has(key)) {
        context.addIssue({ code: "custom", message: "Research Note evidence captures must be unique", path: [index] });
      }
      keys.add(key);
    }
  });
}

export const CreateResearchNoteInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().max(MAX_RESEARCH_NOTE_BODY_CHARS).default(""),
  tags: z.array(z.string().trim().min(1).max(80)).max(40).default([]),
  evidence: uniqueCaptureListSchema(1, MAX_RESEARCH_NOTE_EVIDENCE_ITEMS),
}).strict().superRefine((input, context) => {
  const normalized = input.tags.map((tag) => tag.normalize("NFKC").toLocaleLowerCase("und"));
  if (new Set(normalized).size !== normalized.length) {
    context.addIssue({ code: "custom", message: "Research Note tags must be unique", path: ["tags"] });
  }
});
export type CreateResearchNoteInput = z.input<typeof CreateResearchNoteInputSchema>;

export const UpdateResearchNoteInputSchema = z.object({
  baseRevision: z.string().regex(SHA256_PATTERN),
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().max(MAX_RESEARCH_NOTE_BODY_CHARS).optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
}).strict().superRefine((input, context) => {
  if (Object.keys(input).every((key) => key === "baseRevision")) {
    context.addIssue({ code: "custom", message: "At least one Research Note field is required" });
  }
  if (input.tags) {
    const normalized = input.tags.map((tag) => tag.normalize("NFKC").toLocaleLowerCase("und"));
    if (new Set(normalized).size !== normalized.length) {
      context.addIssue({ code: "custom", message: "Research Note tags must be unique", path: ["tags"] });
    }
  }
});
export type UpdateResearchNoteInput = z.infer<typeof UpdateResearchNoteInputSchema>;

export const AppendResearchNoteEvidenceInputSchema = z.object({
  baseRevision: z.string().regex(SHA256_PATTERN),
  evidence: uniqueCaptureListSchema(1, 20),
}).strict();
export type AppendResearchNoteEvidenceInput = z.infer<typeof AppendResearchNoteEvidenceInputSchema>;

export const RemoveResearchNoteEvidenceInputSchema = z.object({
  baseRevision: z.string().regex(SHA256_PATTERN),
}).strict();
export type RemoveResearchNoteEvidenceInput = z.infer<typeof RemoveResearchNoteEvidenceInputSchema>;

export const ResearchNoteRevisionInputSchema = z.object({
  baseRevision: z.string().regex(SHA256_PATTERN),
}).strict();
export type ResearchNoteRevisionInput = z.infer<typeof ResearchNoteRevisionInputSchema>;

export const DeleteResearchNoteInputSchema = ResearchNoteRevisionInputSchema.extend({
  confirmationTitle: z.string().min(1).max(200),
}).strict();
export type DeleteResearchNoteInput = z.infer<typeof DeleteResearchNoteInputSchema>;

export const ResearchNotePendingProposalReferenceSchema = z.object({
  seriesId: z.string().uuid(),
  seriesTitle: z.string().trim().min(1).max(200),
  proposalId: z.string().uuid(),
  proposalTitle: z.string().trim().min(1).max(400),
}).strict();
export type ResearchNotePendingProposalReference = z.infer<typeof ResearchNotePendingProposalReferenceSchema>;

export const ResearchNoteDeletionBlockersSchema = z.object({
  researchDatabaseId: z.string().uuid(),
  noteId: z.string().uuid(),
  blocked: z.boolean(),
  pendingProposalReferences: z.array(ResearchNotePendingProposalReferenceSchema).max(10_000),
  unreadableSeries: z.array(z.object({
    seriesId: z.string().uuid(),
    seriesTitle: z.string().trim().min(1).max(200),
    diagnosticCount: z.number().int().positive(),
  }).strict()).max(10_000),
}).strict().superRefine((result, context) => {
  const expected = result.pendingProposalReferences.length > 0 || result.unreadableSeries.length > 0;
  if (result.blocked !== expected) {
    context.addIssue({ code: "custom", path: ["blocked"], message: "Research Note blocker state is inconsistent" });
  }
});
export type ResearchNoteDeletionBlockers = z.infer<typeof ResearchNoteDeletionBlockersSchema>;

export const ResearchNoteEvidenceFreshnessSchema = z.enum([
  "current",
  "source-archived",
  "source-revision-changed",
  "passage-changed",
  "source-missing",
  "unreadable",
  "ownership-mismatch",
]);
export type ResearchNoteEvidenceFreshness = z.infer<typeof ResearchNoteEvidenceFreshnessSchema>;

export const ResearchNoteEvidenceResolutionSchema = z.object({
  evidence: ResearchNoteEvidenceSchema,
  freshness: ResearchNoteEvidenceFreshnessSchema,
  modelUse: z.enum(["allowed", "forbidden", "unknown"]),
  currentSourceRevision: z.string().regex(SHA256_PATTERN).nullable(),
  currentSourceDisplayName: z.string().trim().min(1).max(240).nullable(),
}).strict();
export type ResearchNoteEvidenceResolution = z.infer<typeof ResearchNoteEvidenceResolutionSchema>;

export const ResearchNoteFreshnessCountsSchema = z.object({
  current: z.number().int().nonnegative(),
  sourceArchived: z.number().int().nonnegative(),
  sourceRevisionChanged: z.number().int().nonnegative(),
  passageChanged: z.number().int().nonnegative(),
  sourceMissing: z.number().int().nonnegative(),
  unreadable: z.number().int().nonnegative(),
  ownershipMismatch: z.number().int().nonnegative(),
  modelUseForbidden: z.number().int().nonnegative(),
}).strict();
export type ResearchNoteFreshnessCounts = z.infer<typeof ResearchNoteFreshnessCountsSchema>;

export const ResearchNoteSummarySchema = z.object({
  id: z.string().uuid(),
  researchDatabaseId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  tags: z.array(z.string().trim().min(1).max(80)).max(40),
  status: ResearchNoteStatusSchema,
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable(),
  revision: z.string().regex(SHA256_PATTERN),
  evidenceCount: z.number().int().positive().max(MAX_RESEARCH_NOTE_EVIDENCE_ITEMS),
  freshness: ResearchNoteFreshnessCountsSchema,
}).strict();
export type ResearchNoteSummary = z.infer<typeof ResearchNoteSummarySchema>;

export const ResearchNoteDetailSchema = ResearchNoteDocumentSchema.extend({
  evidence: z.array(ResearchNoteEvidenceResolutionSchema).min(1).max(MAX_RESEARCH_NOTE_EVIDENCE_ITEMS),
});
export type ResearchNoteDetail = z.infer<typeof ResearchNoteDetailSchema>;

export const ResearchNoteListQuerySchema = z.object({
  status: z.enum(["active", "archived", "all"]).default("active"),
  offset: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});
export type ResearchNoteListQuery = z.input<typeof ResearchNoteListQuerySchema>;

export const ResearchNoteAuthorityIssueSchema = z.object({
  authorityName: z.string().min(1).max(240),
  noteId: z.string().uuid().nullable(),
  code: z.enum(["invalid-authority", "duplicate-id"]),
  message: z.string().min(1).max(500),
}).strict();
export type ResearchNoteAuthorityIssue = z.infer<typeof ResearchNoteAuthorityIssueSchema>;

export const ResearchNoteListResultSchema = z.object({
  researchDatabaseId: z.string().uuid(),
  status: z.enum(["active", "archived", "all"]),
  offset: z.number().int().nonnegative(),
  limit: z.number().int().min(1).max(100),
  total: z.number().int().nonnegative(),
  notes: z.array(ResearchNoteSummarySchema).max(100),
  issueCount: z.number().int().nonnegative(),
  issues: z.array(ResearchNoteAuthorityIssueSchema).max(100),
}).strict();
export type ResearchNoteListResult = z.infer<typeof ResearchNoteListResultSchema>;
