import { z } from "zod";
import {
  ResearchRetrievalIssueSchema,
  ResearchRetrievalMatchChannelSchema,
  ResearchRetrievalResultSchema,
  ResearchSourceKindSchema,
  ResearchSourceLocationSchema,
} from "./research.js";

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const BCP47_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u;

export const RESEARCH_TOOL_DEFAULT_LIMITS = Object.freeze({
  maxToolCalls: 8,
  maxConsecutiveNoProgress: 2,
  perCallCharacterBudget: 16_000,
  perCallTokenEstimateBudget: 8_000,
  cumulativeCharacterBudget: 48_000,
  cumulativeTokenEstimateBudget: 24_000,
  searchResultLimit: 6,
  sourceResultLimit: 12,
  adjacentChunkCount: 1,
});

export const ResearchToolNameSchema = z.enum([
  "research.list_sources",
  "research.search",
  "research.open_passage",
]);
export type ResearchToolName = z.infer<typeof ResearchToolNameSchema>;

export const ResearchToolLimitsSchema = z.object({
  maxToolCalls: z.number().int().min(1).max(32),
  maxConsecutiveNoProgress: z.number().int().min(1).max(8),
  perCallCharacterBudget: z.number().int().min(1_000).max(100_000),
  perCallTokenEstimateBudget: z.number().int().min(500).max(50_000),
  cumulativeCharacterBudget: z.number().int().min(1_000).max(500_000),
  cumulativeTokenEstimateBudget: z.number().int().min(500).max(250_000),
  searchResultLimit: z.number().int().min(1).max(12),
  sourceResultLimit: z.number().int().min(1).max(50),
  adjacentChunkCount: z.number().int().min(0).max(2),
}).strict().superRefine((limits, context) => {
  if (limits.cumulativeCharacterBudget < limits.perCallCharacterBudget) {
    context.addIssue({ code: "custom", path: ["cumulativeCharacterBudget"], message: "Cumulative character budget must cover one call" });
  }
  if (limits.cumulativeTokenEstimateBudget < limits.perCallTokenEstimateBudget) {
    context.addIssue({ code: "custom", path: ["cumulativeTokenEstimateBudget"], message: "Cumulative token budget must cover one call" });
  }
});
export type ResearchToolLimits = z.infer<typeof ResearchToolLimitsSchema>;

export const ResearchListSourcesArgumentsSchema = z.object({
  databaseId: z.string().uuid(),
  cursor: z.string().trim().min(1).max(4096).optional(),
}).strict();
export type ResearchListSourcesArguments = z.infer<typeof ResearchListSourcesArgumentsSchema>;

export const ResearchSearchArgumentsSchema = z.object({
  query: z.string().trim().min(1).max(500),
  databaseIds: z.array(z.string().uuid()).min(1).max(12).optional(),
  mode: z.enum(["exact", "hybrid"]).default("hybrid"),
  sourceKinds: z.array(ResearchSourceKindSchema).max(ResearchSourceKindSchema.options.length).optional(),
  languageTags: z.array(z.string().trim().regex(BCP47_PATTERN).max(64)).max(40).optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
  author: z.string().trim().max(240).optional(),
  cursor: z.string().trim().min(1).max(4096).optional(),
}).strict().superRefine((input, context) => {
  for (const field of ["databaseIds", "sourceKinds", "languageTags", "tags"] as const) {
    const values = input[field];
    if (values && new Set(values.map((value) => value.toLocaleLowerCase("und"))).size !== values.length) {
      context.addIssue({ code: "custom", path: [field], message: `${field} must be unique` });
    }
  }
});
export type ResearchSearchArguments = z.infer<typeof ResearchSearchArgumentsSchema>;

export const ResearchOpenPassageArgumentsSchema = z.object({
  databaseId: z.string().uuid(),
  sourceId: z.string().uuid(),
  chunkId: z.string().uuid(),
  sourceRevision: z.string().regex(SHA256_PATTERN),
  chunkHash: z.string().regex(SHA256_PATTERN),
}).strict();
export type ResearchOpenPassageArguments = z.infer<typeof ResearchOpenPassageArgumentsSchema>;

export const ResearchToolArgumentsSchema = z.discriminatedUnion("tool", [
  z.object({ tool: z.literal("research.list_sources"), arguments: ResearchListSourcesArgumentsSchema }).strict(),
  z.object({ tool: z.literal("research.search"), arguments: ResearchSearchArgumentsSchema }).strict(),
  z.object({ tool: z.literal("research.open_passage"), arguments: ResearchOpenPassageArgumentsSchema }).strict(),
]);
export type ResearchToolArguments = z.infer<typeof ResearchToolArgumentsSchema>;

export const ResearchToolExhaustedReasonSchema = z.enum([
  "tool-call-limit",
  "no-progress-limit",
  "character-budget",
  "token-estimate-budget",
]).nullable();
export type ResearchToolExhaustedReason = z.infer<typeof ResearchToolExhaustedReasonSchema>;

export const ResearchToolBudgetStateSchema = z.object({
  limits: ResearchToolLimitsSchema,
  usedToolCalls: z.number().int().nonnegative(),
  usedCharacters: z.number().int().nonnegative(),
  usedTokenEstimate: z.number().int().nonnegative(),
  consecutiveNoProgress: z.number().int().nonnegative(),
  remainingToolCalls: z.number().int().nonnegative(),
  remainingCharacters: z.number().int().nonnegative(),
  remainingTokenEstimate: z.number().int().nonnegative(),
  exhaustedReason: ResearchToolExhaustedReasonSchema,
}).strict().superRefine((state, context) => {
  const invariants: Array<{
    used: number;
    remaining: number;
    limit: number;
    path: "remainingToolCalls" | "remainingCharacters" | "remainingTokenEstimate";
  }> = [
    {
      used: state.usedToolCalls,
      remaining: state.remainingToolCalls,
      limit: state.limits.maxToolCalls,
      path: "remainingToolCalls",
    },
    {
      used: state.usedCharacters,
      remaining: state.remainingCharacters,
      limit: state.limits.cumulativeCharacterBudget,
      path: "remainingCharacters",
    },
    {
      used: state.usedTokenEstimate,
      remaining: state.remainingTokenEstimate,
      limit: state.limits.cumulativeTokenEstimateBudget,
      path: "remainingTokenEstimate",
    },
  ];
  for (const invariant of invariants) {
    if (invariant.used + invariant.remaining !== invariant.limit) {
      context.addIssue({
        code: "custom",
        path: [invariant.path],
        message: "Research tool budget usage and remainder must equal the configured limit",
      });
    }
  }
  if (state.consecutiveNoProgress > state.usedToolCalls) {
    context.addIssue({
      code: "custom",
      path: ["consecutiveNoProgress"],
      message: "No-progress count cannot exceed the number of tool calls",
    });
  }
});
export type ResearchToolBudgetState = z.infer<typeof ResearchToolBudgetStateSchema>;

export const ResearchToolSourceSummarySchema = z.object({
  researchDatabaseId: z.string().uuid(),
  researchDatabaseName: z.string().trim().min(1).max(120),
  sourceId: z.string().uuid(),
  sourceRevision: z.string().regex(SHA256_PATTERN),
  displayName: z.string().trim().min(1).max(240),
  sourceKind: ResearchSourceKindSchema,
  author: z.string().max(240),
  declaredLanguage: z.string().max(64).nullable(),
  tags: z.array(z.string().max(80)).max(100),
  parseStatus: z.enum(["pending", "parsed", "failed"]),
  sectionCount: z.number().int().nonnegative().nullable(),
  blockCount: z.number().int().nonnegative().nullable(),
  chunkCount: z.number().int().nonnegative().nullable(),
}).strict();
export type ResearchToolSourceSummary = z.infer<typeof ResearchToolSourceSummarySchema>;

export const ResearchToolPassageSchema = z.object({
  researchDatabaseId: z.string().uuid(),
  researchDatabaseName: z.string().trim().min(1).max(120),
  sourceId: z.string().uuid(),
  sourceRevision: z.string().regex(SHA256_PATTERN),
  sourceDisplayName: z.string().trim().min(1).max(240),
  sourceKind: ResearchSourceKindSchema,
  chunkId: z.string().uuid(),
  blockId: z.string().uuid(),
  chunkHash: z.string().regex(SHA256_PATTERN),
  originalText: z.string().min(1).max(16_000),
  languageTag: z.string().min(1).max(64),
  location: ResearchSourceLocationSchema,
  relationship: z.enum(["previous", "target", "next"]),
  matchChannels: z.array(ResearchRetrievalMatchChannelSchema).max(7),
}).strict();
export type ResearchToolPassage = z.infer<typeof ResearchToolPassageSchema>;

const ResearchToolSuccessBaseSchema = z.object({
  schemaVersion: z.literal(1),
  ok: z.literal(true),
  budget: ResearchToolBudgetStateSchema,
}).strict();

export const ResearchListSourcesResultSchema = ResearchToolSuccessBaseSchema.extend({
  tool: z.literal("research.list_sources"),
  databaseId: z.string().uuid(),
  sources: z.array(ResearchToolSourceSummarySchema).max(RESEARCH_TOOL_DEFAULT_LIMITS.sourceResultLimit),
  nextCursor: z.string().min(1).max(4096).nullable(),
}).strict();
export type ResearchListSourcesResult = z.infer<typeof ResearchListSourcesResultSchema>;

export const ResearchSearchResultSchema = ResearchToolSuccessBaseSchema.extend({
  tool: z.literal("research.search"),
  selectedDatabaseIds: z.array(z.string().uuid()).min(1).max(12),
  requestedMode: z.enum(["exact", "hybrid"]),
  effectiveMode: z.enum(["exact", "hybrid", "degraded-exact"]),
  results: z.array(ResearchRetrievalResultSchema).max(RESEARCH_TOOL_DEFAULT_LIMITS.searchResultLimit),
  issues: z.array(ResearchRetrievalIssueSchema).max(24),
  nextCursor: z.string().min(1).max(4096).nullable(),
}).strict();
export type ResearchSearchResult = z.infer<typeof ResearchSearchResultSchema>;

export const ResearchOpenPassageResultSchema = ResearchToolSuccessBaseSchema.extend({
  tool: z.literal("research.open_passage"),
  passages: z.array(ResearchToolPassageSchema).min(1).max(3),
}).strict();
export type ResearchOpenPassageResult = z.infer<typeof ResearchOpenPassageResultSchema>;

export const ResearchToolErrorCodeSchema = z.enum([
  "INVALID_ARGUMENTS",
  "UNKNOWN_TOOL",
  "INACTIVE_DATABASE",
  "SOURCE_NOT_PERMITTED",
  "STALE_CITATION",
  "CITATION_NOT_RETURNED",
  "BUDGET_EXHAUSTED",
  "CANCELLED",
  "RETRIEVAL_FAILED",
]);
export type ResearchToolErrorCode = z.infer<typeof ResearchToolErrorCodeSchema>;

export const ResearchToolErrorResultSchema = z.object({
  schemaVersion: z.literal(1),
  ok: z.literal(false),
  tool: ResearchToolNameSchema.nullable(),
  error: z.object({
    code: ResearchToolErrorCodeSchema,
    message: z.string().trim().min(1).max(500),
    retryable: z.boolean(),
  }).strict(),
  budget: ResearchToolBudgetStateSchema,
}).strict();
export type ResearchToolErrorResult = z.infer<typeof ResearchToolErrorResultSchema>;

export const ResearchToolResultSchema = z.union([
  ResearchListSourcesResultSchema,
  ResearchSearchResultSchema,
  ResearchOpenPassageResultSchema,
  ResearchToolErrorResultSchema,
]);
export type ResearchToolResult = z.infer<typeof ResearchToolResultSchema>;

export const ResearchToolAuditCitationSchema = ResearchToolPassageSchema.omit({ originalText: true }).extend({
  fusedScore: z.number().finite().nonnegative().nullable(),
}).strict();
export type ResearchToolAuditCitation = z.infer<typeof ResearchToolAuditCitationSchema>;

export const ResearchToolArgumentSummarySchema = z.object({
  requestedDatabaseIds: z.array(z.string().uuid()).max(12),
  sourceId: z.string().uuid().nullable(),
  chunkId: z.string().uuid().nullable(),
  queryHash: z.string().regex(SHA256_PATTERN).nullable(),
  queryCharacterCount: z.number().int().nonnegative(),
  cursorProvided: z.boolean(),
}).strict();
export type ResearchToolArgumentSummary = z.infer<typeof ResearchToolArgumentSummarySchema>;

export const ResearchToolAuditEventSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  seriesId: z.string().uuid(),
  modelCallId: z.string().uuid(),
  sequence: z.number().int().positive(),
  tool: ResearchToolNameSchema.nullable(),
  status: z.enum(["succeeded", "rejected", "failed", "cancelled"]),
  argumentHash: z.string().regex(SHA256_PATTERN),
  argumentCharacterCount: z.number().int().nonnegative(),
  argumentSummary: ResearchToolArgumentSummarySchema,
  resultKeys: z.array(z.string().min(1).max(500)).max(200),
  citations: z.array(ResearchToolAuditCitationSchema).max(24),
  outputCharacterCount: z.number().int().nonnegative(),
  outputTokenEstimate: z.number().int().nonnegative(),
  madeProgress: z.boolean(),
  budgetAfter: ResearchToolBudgetStateSchema,
  errorCode: ResearchToolErrorCodeSchema.nullable(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
}).strict().superRefine((event, context) => {
  if (event.status === "succeeded" && event.errorCode !== null) {
    context.addIssue({ code: "custom", path: ["errorCode"], message: "Successful audit events cannot contain an error" });
  }
  if (event.status !== "succeeded" && event.errorCode === null) {
    context.addIssue({ code: "custom", path: ["errorCode"], message: "Unsuccessful audit events require an error code" });
  }
  if (!event.madeProgress && event.resultKeys.length > 0 && event.status !== "succeeded") {
    context.addIssue({ code: "custom", path: ["resultKeys"], message: "Rejected audit events cannot record result identities" });
  }
});
export type ResearchToolAuditEvent = z.infer<typeof ResearchToolAuditEventSchema>;
