import { z } from "zod";
import { AiTaskKindSchema, ModelParametersSchema, TokenUsageSchema } from "./ai.js";
import {
  CodexDetailTypeDocumentSchema,
  CodexEntryDocumentSchema,
  CodexProgressionDocumentSchema,
  DeleteCodexProgressionResultSchema,
} from "./codex.js";
import { RevisionHashSchema } from "./common.js";
import { ContextPreviewSelectionSchema } from "./context.js";
import { CreateProposalInputSchema, ProposalDocumentSchema } from "./proposals.js";

export const WORKSHOP_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
export const WORKSHOP_ATTACHMENT_MAX_COUNT = 12;

const WorkshopDraftTokenSchema = z.string().trim().min(1).max(120);
const WorkshopAttachmentIdsSchema = z
  .array(z.string().uuid())
  .max(WORKSHOP_ATTACHMENT_MAX_COUNT)
  .default([]);

function requireDraftTokenForAttachments(
  input: { attachmentIds: string[]; draftToken: string | null },
  context: z.RefinementCtx,
): void {
  if (input.attachmentIds.length > 0 && !input.draftToken) {
    context.addIssue({
      code: "custom",
      message: "draftToken is required when attachmentIds are provided",
      path: ["draftToken"],
    });
  }
}

export const WorkshopSessionStatusSchema = z.enum(["active", "archived"]);
export type WorkshopSessionStatus = z.infer<typeof WorkshopSessionStatusSchema>;

export const WorkshopMessageRoleSchema = z.enum(["author", "assistant", "system", "tool", "result"]);
export type WorkshopMessageRole = z.infer<typeof WorkshopMessageRoleSchema>;

export const WorkshopMessageStatusSchema = z.enum(["pending", "succeeded", "failed"]);
export type WorkshopMessageStatus = z.infer<typeof WorkshopMessageStatusSchema>;

export const WorkshopToolExecutionStatusSchema = z.enum([
  "running",
  "succeeded",
  "failed",
  "interrupted",
  "abandoned",
]);
export type WorkshopToolExecutionStatus = z.infer<typeof WorkshopToolExecutionStatusSchema>;

export const WorkshopToolExecutionSchema = z.object({
  requestHash: RevisionHashSchema,
  status: WorkshopToolExecutionStatusSchema,
  attempt: z.number().int().positive().default(1),
  retryable: z.boolean().default(false),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable().default(null),
  resultMessageId: z.string().uuid().nullable().default(null),
  errorCode: z.string().max(120).nullable().default(null),
  errorMessage: z.string().max(4000).nullable().default(null),
}).superRefine((execution, context) => {
  if (execution.status === "running") {
    if (execution.completedAt !== null) {
      context.addIssue({ code: "custom", path: ["completedAt"], message: "Running tool execution cannot be completed" });
    }
    if (execution.resultMessageId !== null || execution.errorCode !== null || execution.errorMessage !== null) {
      context.addIssue({ code: "custom", message: "Running tool execution cannot have a result or terminal error" });
    }
    if (execution.retryable) {
      context.addIssue({ code: "custom", path: ["retryable"], message: "Running tool execution cannot be retryable" });
    }
    return;
  }
  if (execution.completedAt === null) {
    context.addIssue({ code: "custom", path: ["completedAt"], message: "Terminal tool execution requires completedAt" });
  }
  if (execution.status === "succeeded") {
    if (execution.resultMessageId === null) {
      context.addIssue({ code: "custom", path: ["resultMessageId"], message: "Successful tool execution requires a result message" });
    }
    if (execution.errorCode !== null || execution.errorMessage !== null) {
      context.addIssue({ code: "custom", message: "Successful tool execution cannot have a terminal error" });
    }
    if (execution.retryable) {
      context.addIssue({ code: "custom", path: ["retryable"], message: "Successful tool execution cannot be retryable" });
    }
    return;
  }
  if (["interrupted", "abandoned"].includes(execution.status) && execution.resultMessageId !== null) {
    context.addIssue({ code: "custom", path: ["resultMessageId"], message: "Unfinished tool execution cannot have a result message" });
  }
  if (!execution.errorCode?.trim() || !execution.errorMessage?.trim()) {
    context.addIssue({ code: "custom", message: "Failed tool execution requires an error code and message" });
  }
  if (execution.status === "abandoned" && execution.retryable) {
    context.addIssue({ code: "custom", path: ["retryable"], message: "Abandoned tool execution cannot be retryable" });
  }
});
export type WorkshopToolExecution = z.infer<typeof WorkshopToolExecutionSchema>;

export const WorkshopConversationKindSchema = z.enum(["chat", "agent"]);
export type WorkshopConversationKind = z.infer<typeof WorkshopConversationKindSchema>;

export const WorkshopModeSchema = z.enum([
  "general-chat",
  "continuity-check",
  "agent",
  "codex-creation",
]);
export type WorkshopMode = z.infer<typeof WorkshopModeSchema>;

export const WorkshopContextItemKindSchema = z.enum([
  "full-novel",
  "full-outline",
  "act",
  "chapter",
  "scene",
  "selection",
  "codex-entry",
  "scene-section",
  "research-note",
  "note",
  "proposal-source",
  "message-attachment",
]);
export type WorkshopContextItemKind = z.infer<typeof WorkshopContextItemKindSchema>;

export const WorkshopAttachmentParseStatusSchema = z.enum(["parsed", "failed", "rejected"]);
export type WorkshopAttachmentParseStatus = z.infer<typeof WorkshopAttachmentParseStatusSchema>;

export const WorkshopMessageAttachmentSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().uuid(),
    seriesId: z.string().uuid(),
    sessionId: z.string().uuid(),
    messageId: z.string().uuid().nullable().default(null),
    draftToken: WorkshopDraftTokenSchema,
    fileName: z.string().trim().min(1).max(240),
    mediaType: z.string().trim().min(1).max(120).default("application/octet-stream"),
    sizeBytes: z.number().int().nonnegative().max(WORKSHOP_ATTACHMENT_MAX_BYTES),
    textHash: RevisionHashSchema.nullable().default(null),
    extractedText: z.string().max(400000).default(""),
    parseStatus: WorkshopAttachmentParseStatusSchema,
    parseWarnings: z.array(z.string().max(1000)).default([]),
    parseError: z.string().max(2000).nullable().default(null),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .superRefine((attachment, context) => {
    if (attachment.parseStatus === "parsed") {
      if (!attachment.textHash) {
        context.addIssue({
          code: "custom",
          message: "Parsed attachments require textHash",
          path: ["textHash"],
        });
      }
      if (!attachment.extractedText.trim()) {
        context.addIssue({
          code: "custom",
          message: "Parsed attachments require extractedText",
          path: ["extractedText"],
        });
      }
      if (attachment.parseError) {
        context.addIssue({
          code: "custom",
          message: "Parsed attachments cannot carry parseError",
          path: ["parseError"],
        });
      }
    }
  });
export type WorkshopMessageAttachment = z.infer<typeof WorkshopMessageAttachmentSchema>;

export const UploadWorkshopAttachmentInputSchema = z.object({
  draftToken: WorkshopDraftTokenSchema,
  fileName: z.string().trim().min(1).max(240),
  mediaType: z.string().trim().min(1).max(120).default("application/octet-stream"),
  sizeBytes: z.number().int().nonnegative(),
  base64Content: z.string().max(Math.ceil(WORKSHOP_ATTACHMENT_MAX_BYTES * 1.4)),
}).strict();
export type UploadWorkshopAttachmentInput = z.input<typeof UploadWorkshopAttachmentInputSchema>;

export const ListWorkshopAttachmentsQuerySchema = z.object({
  draftToken: WorkshopDraftTokenSchema.optional(),
}).strict();
export type ListWorkshopAttachmentsQuery = z.input<typeof ListWorkshopAttachmentsQuerySchema>;

export const WorkshopSessionSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  seriesId: z.string().uuid(),
  kind: WorkshopConversationKindSchema.default("chat"),
  title: z.string().trim().min(1).max(160),
  status: WorkshopSessionStatusSchema.default("active"),
  branchOfMessageId: z.string().uuid().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable().default(null),
  lastMessageAt: z.string().datetime().nullable().default(null),
});
export type WorkshopSession = z.infer<typeof WorkshopSessionSchema>;

export const WorkshopBranchSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  seriesId: z.string().uuid(),
  sourceSessionId: z.string().uuid(),
  sourceMessageId: z.string().uuid(),
  sessionId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  createdAt: z.string().datetime(),
});
export type WorkshopBranch = z.infer<typeof WorkshopBranchSchema>;

export const WorkshopMessageSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  seriesId: z.string().uuid(),
  sessionId: z.string().uuid(),
  role: WorkshopMessageRoleSchema,
  mode: WorkshopModeSchema.default("continuity-check"),
  status: WorkshopMessageStatusSchema.default("succeeded"),
  content: z.string().max(400000).default(""),
  reasoningContent: z.string().max(400000).default(""),
  contextBundleId: z.string().uuid().nullable().default(null),
  modelCallId: z.string().uuid().nullable().default(null),
  agentRunId: z.string().uuid().nullable().optional(),
  agentStepId: z.string().uuid().nullable().optional(),
  proposalIds: z.array(z.string().uuid()).default([]),
  attachmentIds: WorkshopAttachmentIdsSchema,
  errorCode: z.string().max(120).nullable().default(null),
  errorMessage: z.string().max(4000).nullable().default(null),
  toolExecution: WorkshopToolExecutionSchema.optional(),
  createdAt: z.string().datetime(),
}).superRefine((message, context) => {
  const hasAgentRun = typeof message.agentRunId === "string";
  const hasAgentStep = typeof message.agentStepId === "string";
  if (hasAgentRun !== hasAgentStep) {
    context.addIssue({
      code: "custom",
      path: [hasAgentRun ? "agentStepId" : "agentRunId"],
      message: "Agent run and step message links must be set together",
    });
  }
  if (hasAgentRun && message.mode !== "agent") {
    context.addIssue({
      code: "custom",
      path: ["agentRunId"],
      message: "Only Agent messages can link to an Agent run",
    });
  }
  if (
    message.toolExecution &&
    (message.role !== "tool" || message.mode !== "agent" || message.status !== "succeeded")
  ) {
    context.addIssue({
      code: "custom",
      path: ["toolExecution"],
      message: "Tool execution state belongs only to successful Agent tool messages",
    });
  }
});
export type WorkshopMessage = z.infer<typeof WorkshopMessageSchema>;

export const WorkshopAgentRunStatusSchema = z.enum([
  "running",
  "waiting-confirmation",
  "completed",
  "failed",
  "interrupted",
  "abandoned",
]);
export type WorkshopAgentRunStatus = z.infer<typeof WorkshopAgentRunStatusSchema>;

export const WorkshopAgentStepKindSchema = z.enum([
  "model",
  "repair",
  "tool-request",
  "tool-result",
  "continuation",
]);
export type WorkshopAgentStepKind = z.infer<typeof WorkshopAgentStepKindSchema>;

export const WorkshopAgentStepStatusSchema = z.enum([
  "pending",
  "running",
  "waiting-confirmation",
  "succeeded",
  "failed",
  "interrupted",
  "abandoned",
]);
export type WorkshopAgentStepStatus = z.infer<typeof WorkshopAgentStepStatusSchema>;

export const WorkshopProviderPromptSnapshotSchema = z.object({
  system: z.string().max(1_000_000),
  instructions: z.string().max(1_000_000),
  user: z.string().max(1_000_000),
  hash: RevisionHashSchema,
});
export type WorkshopProviderPromptSnapshot = z.infer<typeof WorkshopProviderPromptSnapshotSchema>;

export const WorkshopAgentStepRecordSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  index: z.number().int().nonnegative(),
  kind: WorkshopAgentStepKindSchema,
  status: WorkshopAgentStepStatusSchema,
  attempt: z.number().int().positive().default(1),
  modelCallId: z.string().uuid().nullable().default(null),
  promptSnapshot: WorkshopProviderPromptSnapshotSchema.nullable().default(null),
  messageId: z.string().uuid().nullable().default(null),
  inputMessageIds: z.array(z.string().uuid()).default([]),
  degradedStructuredOutput: z.boolean().default(false),
  retryable: z.boolean().default(false),
  errorCode: z.string().max(120).nullable().default(null),
  errorMessage: z.string().max(4000).nullable().default(null),
  startedAt: z.string().datetime().nullable().default(null),
  completedAt: z.string().datetime().nullable().default(null),
}).superRefine((step, context) => {
  const terminal = ["succeeded", "failed", "interrupted", "abandoned"].includes(step.status);
  if (step.status === "pending" && step.startedAt !== null) {
    context.addIssue({ code: "custom", path: ["startedAt"], message: "Pending Agent step cannot have startedAt" });
  }
  if (step.status !== "pending" && step.startedAt === null) {
    context.addIssue({ code: "custom", path: ["startedAt"], message: "Started Agent step requires startedAt" });
  }
  if (terminal !== (step.completedAt !== null)) {
    context.addIssue({ code: "custom", path: ["completedAt"], message: "Agent step completion timestamp must match terminal state" });
  }
  if (step.status === "waiting-confirmation" && step.kind !== "tool-request") {
    context.addIssue({ code: "custom", path: ["status"], message: "Only a tool-request step can wait for confirmation" });
  }
  if (["model", "repair", "continuation"].includes(step.kind) && step.status !== "pending" && step.modelCallId === null) {
    context.addIssue({ code: "custom", path: ["modelCallId"], message: "Started model Agent step requires a ModelCallLog" });
  }
  if (["model", "repair", "continuation"].includes(step.kind) && step.status !== "pending" && step.promptSnapshot === null) {
    context.addIssue({ code: "custom", path: ["promptSnapshot"], message: "Started model Agent step requires an exact prompt snapshot" });
  }
  if (["tool-request", "tool-result"].includes(step.kind) && step.promptSnapshot !== null) {
    context.addIssue({ code: "custom", path: ["promptSnapshot"], message: "Tool Agent steps cannot carry a provider prompt snapshot" });
  }
  if (["tool-request", "tool-result"].includes(step.kind) && step.status !== "pending" && step.messageId === null) {
    context.addIssue({ code: "custom", path: ["messageId"], message: "Started tool Agent step requires a message link" });
  }
  if (["failed", "interrupted", "abandoned"].includes(step.status)) {
    if (!step.errorCode?.trim() || !step.errorMessage?.trim()) {
      context.addIssue({ code: "custom", message: "Unsuccessful terminal Agent step requires error details" });
    }
  } else if (step.errorCode !== null || step.errorMessage !== null) {
    context.addIssue({ code: "custom", message: "Non-error Agent step cannot carry terminal error details" });
  }
  if (step.retryable && !["failed", "interrupted"].includes(step.status)) {
    context.addIssue({ code: "custom", path: ["retryable"], message: "Only failed or interrupted Agent steps can be retryable" });
  }
});
export type WorkshopAgentStepRecord = z.infer<typeof WorkshopAgentStepRecordSchema>;

export const WorkshopAgentRunSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  seriesId: z.string().uuid(),
  sessionId: z.string().uuid(),
  authorMessageId: z.string().uuid(),
  status: WorkshopAgentRunStatusSchema,
  modelProfileId: z.string().uuid(),
  modelOverride: z.string().trim().min(1).max(200).nullable().default(null),
  parameters: ModelParametersSchema.default({}),
  contextBundleId: z.string().uuid(),
  promptTemplateId: z.string().uuid(),
  promptTemplateVersion: z.number().int().positive(),
  promptSnapshot: WorkshopProviderPromptSnapshotSchema,
  activeStepId: z.string().uuid().nullable().default(null),
  steps: z.array(WorkshopAgentStepRecordSchema).default([]),
  degradedStructuredOutput: z.boolean().default(false),
  retryable: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable().default(null),
}).superRefine((run, context) => {
  const ids = new Set<string>();
  for (let index = 0; index < run.steps.length; index += 1) {
    const step = run.steps[index]!;
    if (ids.has(step.id)) {
      context.addIssue({ code: "custom", path: ["steps", index, "id"], message: "Agent run cannot contain duplicate step IDs" });
    }
    ids.add(step.id);
    if (step.index !== index) {
      context.addIssue({ code: "custom", path: ["steps", index, "index"], message: "Agent run step indexes must be contiguous and ordered" });
    }
  }
  const isActive = run.status === "running" || run.status === "waiting-confirmation";
  if (isActive !== (run.activeStepId !== null)) {
    context.addIssue({ code: "custom", path: ["activeStepId"], message: "Active Agent run state requires exactly one active step" });
  }
  const activeStep = run.steps.find((step) => step.id === run.activeStepId);
  if (run.activeStepId !== null && !activeStep) {
    context.addIssue({ code: "custom", path: ["activeStepId"], message: "Active Agent step must belong to the run" });
  }
  if (run.status === "running" && activeStep && activeStep.status !== "running" && activeStep.status !== "pending") {
    context.addIssue({ code: "custom", path: ["activeStepId"], message: "Running Agent run must point to a pending or running step" });
  }
  if (run.status === "waiting-confirmation" && activeStep?.status !== "waiting-confirmation") {
    context.addIssue({ code: "custom", path: ["activeStepId"], message: "Waiting Agent run must point to its confirmation step" });
  }
  const terminal = ["completed", "failed", "interrupted", "abandoned"].includes(run.status);
  if (terminal !== (run.completedAt !== null)) {
    context.addIssue({ code: "custom", path: ["completedAt"], message: "Agent run completion timestamp must match terminal state" });
  }
  if (run.status === "completed" && run.steps.at(-1)?.status !== "succeeded") {
    context.addIssue({ code: "custom", path: ["steps"], message: "Completed Agent run must end with a successful step" });
  }
  if (run.retryable && !["failed", "interrupted"].includes(run.status)) {
    context.addIssue({ code: "custom", path: ["retryable"], message: "Only failed or interrupted Agent runs can be retryable" });
  }
  if (run.degradedStructuredOutput !== run.steps.some((step) => step.degradedStructuredOutput)) {
    context.addIssue({ code: "custom", path: ["degradedStructuredOutput"], message: "Agent run degraded state must reflect its steps" });
  }
});
export type WorkshopAgentRun = z.infer<typeof WorkshopAgentRunSchema>;

export const WorkshopAgentRunDocumentSchema = z.object({
  run: WorkshopAgentRunSchema,
  revision: RevisionHashSchema,
});
export type WorkshopAgentRunDocument = z.infer<typeof WorkshopAgentRunDocumentSchema>;

export const WorkshopAgentRunDiagnosticSchema = z.object({
  fileName: z.string().min(1).max(260),
  code: z.string().min(1).max(120),
  message: z.string().min(1).max(4000),
});
export type WorkshopAgentRunDiagnostic = z.infer<typeof WorkshopAgentRunDiagnosticSchema>;

export const WorkshopAgentRunListResultSchema = z.object({
  runs: z.array(WorkshopAgentRunDocumentSchema),
  diagnostics: z.array(WorkshopAgentRunDiagnosticSchema).default([]),
});
export type WorkshopAgentRunListResult = z.infer<typeof WorkshopAgentRunListResultSchema>;

export const RetryWorkshopAgentRunInputSchema = z.object({
  baseRevision: RevisionHashSchema,
}).strict();
export type RetryWorkshopAgentRunInput = z.infer<typeof RetryWorkshopAgentRunInputSchema>;

export const AbandonWorkshopAgentRunInputSchema = z.object({
  baseRevision: RevisionHashSchema,
  reason: z.string().trim().min(1).max(1000).default("Abandoned by author."),
}).strict();
export type AbandonWorkshopAgentRunInput = z.infer<typeof AbandonWorkshopAgentRunInputSchema>;

export const WorkshopAgentRunActionResultSchema = z.object({
  agentRun: WorkshopAgentRunDocumentSchema,
  assistantMessage: WorkshopMessageSchema,
  toolMessages: z.array(WorkshopMessageSchema).default([]),
  modelCallId: z.string().uuid(),
  responseText: z.string().max(400000).default(""),
});
export type WorkshopAgentRunActionResult = z.infer<typeof WorkshopAgentRunActionResultSchema>;

export const WorkshopContextItemRefSchema = z.object({
  id: z.string().uuid(),
  kind: WorkshopContextItemKindSchema,
  sourceId: z.string().min(1).max(240).nullable().default(null),
  label: z.string().trim().min(1).max(200),
  pinned: z.boolean().default(false),
  note: z.string().max(1000).default(""),
  createdAt: z.string().datetime(),
});
export type WorkshopContextItemRef = z.infer<typeof WorkshopContextItemRefSchema>;

export const WorkshopContextBasketSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().uuid(),
    seriesId: z.string().uuid(),
    sessionId: z.string().uuid(),
    sceneId: z.string().uuid().nullable().default(null),
    blockId: z.string().uuid().nullable().default(null),
    selection: ContextPreviewSelectionSchema.nullable().default(null),
    items: z.array(WorkshopContextItemRefSchema).default([]),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .superRefine((basket, context) => {
    const seen = new Set<string>();
    for (let index = 0; index < basket.items.length; index += 1) {
      const item = basket.items[index]!;
      if (seen.has(item.id)) {
        context.addIssue({
          code: "custom",
          message: "Context basket cannot contain duplicate item IDs",
          path: ["items", index, "id"],
        });
      }
      seen.add(item.id);
      if (item.kind !== "note" && !item.sourceId) {
        context.addIssue({
          code: "custom",
          message: "Context item requires sourceId unless it is a note",
          path: ["items", index, "sourceId"],
        });
      }
    }
  });
export type WorkshopContextBasket = z.infer<typeof WorkshopContextBasketSchema>;

export const CreateWorkshopSessionInputSchema = z.object({
  title: z.string().trim().min(1).max(160).default("New chat"),
  kind: WorkshopConversationKindSchema.default("chat"),
  sceneId: z.string().uuid().nullable().optional(),
});
export type CreateWorkshopSessionInput = z.input<typeof CreateWorkshopSessionInputSchema>;

export const UpdateWorkshopSessionInputSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
}).superRefine((input, context) => {
  if (Object.keys(input).length === 0) {
    context.addIssue({ code: "custom", message: "At least one session field is required" });
  }
});
export type UpdateWorkshopSessionInput = z.infer<typeof UpdateWorkshopSessionInputSchema>;

const CreateWorkshopMessageInputBaseSchema = z.object({
  role: z.literal("author").default("author"),
  mode: WorkshopModeSchema.default("continuity-check"),
  content: z.string().trim().min(1).max(400000),
  attachmentIds: WorkshopAttachmentIdsSchema,
  draftToken: WorkshopDraftTokenSchema.nullable().default(null),
}).strict();
export const CreateWorkshopMessageInputSchema =
  CreateWorkshopMessageInputBaseSchema.superRefine(requireDraftTokenForAttachments);
export type CreateWorkshopMessageInput = z.input<typeof CreateWorkshopMessageInputSchema>;

export const ResendWorkshopMessageInputSchema = z.object({
  content: z.string().trim().min(1).max(16000).optional(),
  roleId: z.string().min(1).max(120).default("workshop-general-chat"),
  taskKind: AiTaskKindSchema.default("analysis"),
  promptTemplateId: z.string().uuid().default("00000000-0000-4000-8000-000000000421"),
  promptTemplateVersion: z.number().int().positive().default(1),
  systemPrompt: z.string().trim().max(8000).default(""),
  modelProfileId: z.string().uuid(),
  modelOverride: z.string().trim().min(1).max(200).nullable().default(null),
  tokenBudget: z.number().int().positive().nullable().default(null),
  parameters: ModelParametersSchema.default({}),
}).strict();
export type ResendWorkshopMessageInput = z.input<typeof ResendWorkshopMessageInputSchema>;

export const ExportWorkshopSessionQuerySchema = z.object({
  includeReasoning: z.union([z.boolean(), z.enum(["true", "false"])]).default(false)
    .transform((value) => value === true || value === "true"),
  includePromptAudit: z.union([z.boolean(), z.enum(["true", "false"])]).default(false)
    .transform((value) => value === true || value === "true"),
}).strict();
export type ExportWorkshopSessionQuery = z.input<typeof ExportWorkshopSessionQuerySchema>;

export const ReplaceWorkshopMessageResultSchema = z.object({
  deletedAttachmentIds: z.array(z.string().uuid()).default([]),
  deletedBranchIds: z.array(z.string().uuid()).default([]),
  deletedMessageIds: z.array(z.string().uuid()).default([]),
  message: WorkshopMessageSchema,
  session: WorkshopSessionSchema,
});
export type ReplaceWorkshopMessageResult = z.infer<typeof ReplaceWorkshopMessageResultSchema>;

export const CreateWorkshopMessageProposalInputSchema = CreateProposalInputSchema.omit({
  contextBundleId: true,
  generator: true,
  source: true,
});
export type CreateWorkshopMessageProposalInput = z.input<
  typeof CreateWorkshopMessageProposalInputSchema
>;

export const WorkshopMessageSourceSchema = z.object({
  session: WorkshopSessionSchema,
  message: WorkshopMessageSchema,
});
export type WorkshopMessageSource = z.infer<typeof WorkshopMessageSourceSchema>;

export const WorkshopMessageProposalResultSchema = z.object({
  message: WorkshopMessageSchema,
  proposal: ProposalDocumentSchema,
});
export type WorkshopMessageProposalResult = z.infer<
  typeof WorkshopMessageProposalResultSchema
>;

export const WorkshopCodexDraftDetailMappingSchema = z.object({
  label: z.string().trim().min(1).max(120),
  detailTypeId: z.string().uuid(),
}).strict();
export type WorkshopCodexDraftDetailMapping = z.input<
  typeof WorkshopCodexDraftDetailMappingSchema
>;

export const WorkshopCodexDraftDetailCreationSchema = z.object({
  label: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  nsfw: z.boolean().default(false),
}).strict();
export type WorkshopCodexDraftDetailCreation = z.input<
  typeof WorkshopCodexDraftDetailCreationSchema
>;

export const ExecuteWorkshopCodexCreateEntryToolInputSchema = z.object({
  confirm: z.literal(true),
  createMissingDetailTypes: z.boolean().default(false),
  detailCreations: z.array(WorkshopCodexDraftDetailCreationSchema).default([]),
  detailMappings: z.array(WorkshopCodexDraftDetailMappingSchema).default([]),
}).strict();
export type ExecuteWorkshopCodexCreateEntryToolInput = z.input<
  typeof ExecuteWorkshopCodexCreateEntryToolInputSchema
>;

export const ExecuteWorkshopCodexUpdateEntryToolInputSchema = ExecuteWorkshopCodexCreateEntryToolInputSchema;
export type ExecuteWorkshopCodexUpdateEntryToolInput = z.input<
  typeof ExecuteWorkshopCodexUpdateEntryToolInputSchema
>;

export const WorkshopCodexCreateEntryToolResultSchema = z.object({
  createdDetailTypes: z.array(CodexDetailTypeDocumentSchema).default([]),
  message: WorkshopMessageSchema,
  resultMessage: WorkshopMessageSchema,
  entry: CodexEntryDocumentSchema,
  continuationMessages: z.array(WorkshopMessageSchema).default([]),
  agentRun: WorkshopAgentRunDocumentSchema.nullable().default(null),
});
export type WorkshopCodexCreateEntryToolResult = z.infer<
  typeof WorkshopCodexCreateEntryToolResultSchema
>;

export const WorkshopCodexUpdateEntryToolResultSchema = z.object({
  createdProgressions: z.array(CodexProgressionDocumentSchema).default([]),
  createdDetailTypes: z.array(CodexDetailTypeDocumentSchema).default([]),
  deletedProgressions: z.array(DeleteCodexProgressionResultSchema).default([]),
  message: WorkshopMessageSchema,
  resultMessage: WorkshopMessageSchema,
  entry: CodexEntryDocumentSchema,
  updatedProgressions: z.array(CodexProgressionDocumentSchema).default([]),
  continuationMessages: z.array(WorkshopMessageSchema).default([]),
  agentRun: WorkshopAgentRunDocumentSchema.nullable().default(null),
});
export type WorkshopCodexUpdateEntryToolResult = z.infer<
  typeof WorkshopCodexUpdateEntryToolResultSchema
>;

export const WorkshopCodexDetailTypeSuggestionSchema = z.object({
  detailTypeId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  score: z.number().min(0).max(1),
  recommended: z.boolean(),
  reason: z.string().trim().min(1).max(240),
}).strict();
export type WorkshopCodexDetailTypeSuggestion = z.infer<
  typeof WorkshopCodexDetailTypeSuggestionSchema
>;

export const WorkshopCodexDetailSchemaPlannerStateSchema = z.object({
  status: z.enum(["ready", "unconfigured", "unavailable"]),
  message: z.string().trim().min(1).max(500),
}).strict();
export type WorkshopCodexDetailSchemaPlannerState = z.infer<
  typeof WorkshopCodexDetailSchemaPlannerStateSchema
>;

export const WorkshopCodexDraftMissingDetailTypeSchema = z.object({
  label: z.string().trim().min(1).max(120),
  valuePreview: z.string().max(240),
  suggestions: z.array(WorkshopCodexDetailTypeSuggestionSchema).default([]),
});
export type WorkshopCodexDraftMissingDetailType = z.infer<
  typeof WorkshopCodexDraftMissingDetailTypeSchema
>;

export const WorkshopCodexCreateEntryToolErrorSchema = z.object({
  code: z.literal("CODEX_DETAIL_TYPE_CREATION_REQUIRED"),
  message: z.string().min(1).max(4000),
  missingDetailTypes: z.array(WorkshopCodexDraftMissingDetailTypeSchema),
  availableDetailTypes: z.array(CodexDetailTypeDocumentSchema),
  planner: WorkshopCodexDetailSchemaPlannerStateSchema,
});
export type WorkshopCodexCreateEntryToolError = z.infer<
  typeof WorkshopCodexCreateEntryToolErrorSchema
>;

export const DeleteWorkshopMessageResultSchema = z.object({
  deletedId: z.string().uuid(),
  deletedAttachmentIds: z.array(z.string().uuid()).default([]),
  session: WorkshopSessionSchema,
});
export type DeleteWorkshopMessageResult = z.infer<typeof DeleteWorkshopMessageResultSchema>;

export const DeleteWorkshopSessionResultSchema = z.object({
  deletedId: z.string().uuid(),
  deletedMessageIds: z.array(z.string().uuid()).default([]),
  deletedAttachmentIds: z.array(z.string().uuid()).default([]),
  deletedBranchIds: z.array(z.string().uuid()).default([]),
});
export type DeleteWorkshopSessionResult = z.infer<typeof DeleteWorkshopSessionResultSchema>;

export const DeleteWorkshopAttachmentResultSchema = z.object({
  deletedId: z.string().uuid(),
});
export type DeleteWorkshopAttachmentResult = z.infer<typeof DeleteWorkshopAttachmentResultSchema>;

export const CreateWorkshopBranchInputSchema = z.object({
  sourceMessageId: z.string().uuid(),
  title: z.string().trim().min(1).max(160).optional(),
});
export type CreateWorkshopBranchInput = z.infer<typeof CreateWorkshopBranchInputSchema>;

export const UpdateWorkshopContextBasketInputSchema = z.object({
  sceneId: z.string().uuid().nullable().optional(),
  blockId: z.string().uuid().nullable().optional(),
  selection: ContextPreviewSelectionSchema.nullable().optional(),
  items: z.array(WorkshopContextItemRefSchema).optional(),
});
export type UpdateWorkshopContextBasketInput = z.infer<
  typeof UpdateWorkshopContextBasketInputSchema
>;

const WorkshopContextPreviewInputBaseSchema = z.object({
  mode: WorkshopModeSchema.default("general-chat"),
  userRequest: z.string().trim().min(1).max(16000),
  roleId: z.string().min(1).max(120).default("workshop-general-chat"),
  taskKind: AiTaskKindSchema.default("analysis"),
  promptTemplateId: z.string().uuid().default("00000000-0000-4000-8000-000000000421"),
  promptTemplateVersion: z.number().int().positive().default(1),
  systemPrompt: z.string().trim().max(8000).default(""),
  modelProfileId: z.string().uuid().nullable().default(null),
  modelOverride: z.string().trim().min(1).max(200).nullable().default(null),
  tokenBudget: z.number().int().positive().nullable().default(null),
  attachmentIds: WorkshopAttachmentIdsSchema,
  draftToken: WorkshopDraftTokenSchema.nullable().default(null),
}).strict();
export const WorkshopContextPreviewInputSchema =
  WorkshopContextPreviewInputBaseSchema.superRefine(requireDraftTokenForAttachments);
export type WorkshopContextPreviewInput = z.input<typeof WorkshopContextPreviewInputSchema>;

export const RunWorkshopCallInputSchema = WorkshopContextPreviewInputBaseSchema.extend({
  modelProfileId: z.string().uuid(),
  parameters: ModelParametersSchema.default({}),
}).strict().superRefine(requireDraftTokenForAttachments);
export type RunWorkshopCallInput = z.input<typeof RunWorkshopCallInputSchema>;

export const WorkshopCallResultSchema = z.object({
  authorMessage: WorkshopMessageSchema,
  assistantMessage: WorkshopMessageSchema,
  toolMessages: z.array(WorkshopMessageSchema).default([]),
  contextBundleId: z.string().uuid(),
  modelCallId: z.string().uuid(),
  status: WorkshopMessageStatusSchema,
  responseText: z.string().max(400000).default(""),
  estimatedUsage: TokenUsageSchema,
  actualUsage: TokenUsageSchema.nullable().default(null),
  agentRun: WorkshopAgentRunDocumentSchema.nullable().default(null),
});
export type WorkshopCallResult = z.infer<typeof WorkshopCallResultSchema>;

export const ResendWorkshopMessageResultSchema = WorkshopCallResultSchema.extend({
  deletedAttachmentIds: z.array(z.string().uuid()).default([]),
  deletedBranchIds: z.array(z.string().uuid()).default([]),
  deletedMessageIds: z.array(z.string().uuid()).default([]),
});
export type ResendWorkshopMessageResult = z.infer<typeof ResendWorkshopMessageResultSchema>;

export const WorkshopCallStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("author-message"),
    message: WorkshopMessageSchema,
  }),
  z.object({
    type: z.literal("metadata"),
    contextBundleId: z.string().uuid(),
    modelCallId: z.string().uuid(),
  }),
  z.object({
    type: z.literal("delta"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("reasoning-delta"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("assistant-message"),
    message: WorkshopMessageSchema,
  }),
  z.object({
    type: z.literal("error"),
    code: z.string().max(120).nullable().default(null),
    message: z.string().min(1).max(4000),
    assistantMessage: WorkshopMessageSchema.optional(),
  }),
  z.object({
    type: z.literal("done"),
    result: WorkshopCallResultSchema,
  }),
]);
export type WorkshopCallStreamEvent = z.infer<typeof WorkshopCallStreamEventSchema>;
