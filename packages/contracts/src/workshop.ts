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
import { DEFAULT_WORKSHOP_GENERAL_CHAT_SYSTEM_PROMPT } from "./workshopPrompts.js";

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

const WorkshopMessageStatusV1Schema = z.enum(["pending", "succeeded", "failed"]);
export const WorkshopMessageStatusSchema = z.enum(["pending", "succeeded", "failed", "cancelled"]);
export type WorkshopMessageStatus = z.infer<typeof WorkshopMessageStatusSchema>;

export const WorkshopReasoningOutputKindSchema = z.enum(["none", "summary", "full", "unknown"]);
export type WorkshopReasoningOutputKind = z.infer<typeof WorkshopReasoningOutputKindSchema>;

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
  "agent",
]);
export type WorkshopMode = z.infer<typeof WorkshopModeSchema>;

export const WorkshopContextItemKindSchema = z.enum([
  "full-novel",
  "full-outline",
  "volume",
  "chapter",
  "act",
  "scene",
  "codex-entry",
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

export const WorkshopSessionV1Schema = z.object({
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
export type WorkshopSessionV1 = z.infer<typeof WorkshopSessionV1Schema>;

const WorkshopSessionV2BaseSchema = z.object({
  schemaVersion: z.literal(2),
  id: z.string().uuid(),
  seriesId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  status: WorkshopSessionStatusSchema.default("active"),
  branchOfMessageId: z.string().uuid().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable().default(null),
  lastMessageAt: z.string().datetime().nullable().default(null),
});

export const WorkshopSessionV2Schema = z.discriminatedUnion("kind", [
  WorkshopSessionV2BaseSchema.extend({
    kind: z.literal("chat"),
    generalChatSystemPrompt: z.string().trim().max(8000),
  }),
  WorkshopSessionV2BaseSchema.extend({
    kind: z.literal("agent"),
    generalChatSystemPrompt: z.null(),
  }),
]);
export type WorkshopSessionV2 = z.infer<typeof WorkshopSessionV2Schema>;

export const WorkshopSessionSchema = z.union([
  WorkshopSessionV2Schema,
  WorkshopSessionV1Schema,
]).transform((session): WorkshopSessionV2 => {
  if (session.schemaVersion === 2) return session;
  return WorkshopSessionV2Schema.parse({
    ...session,
    schemaVersion: 2,
    generalChatSystemPrompt: session.kind === "agent"
      ? null
      : DEFAULT_WORKSHOP_GENERAL_CHAT_SYSTEM_PROMPT,
  });
});
export type WorkshopSession = z.infer<typeof WorkshopSessionSchema>;

export const WorkshopSessionV1RollbackSnapshotSchema = z.object({
  session: WorkshopSessionV1Schema,
  generalChatSystemPromptBackup: z.string().max(8000).nullable(),
});
export type WorkshopSessionV1RollbackSnapshot = z.infer<
  typeof WorkshopSessionV1RollbackSnapshotSchema
>;

export function workshopSessionV1RollbackSnapshot(
  rawSession: WorkshopSession,
): WorkshopSessionV1RollbackSnapshot {
  const session = WorkshopSessionSchema.parse(rawSession);
  return WorkshopSessionV1RollbackSnapshotSchema.parse({
    session: {
      schemaVersion: 1,
      id: session.id,
      seriesId: session.seriesId,
      kind: session.kind,
      title: session.title,
      status: session.status,
      branchOfMessageId: session.branchOfMessageId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      archivedAt: session.archivedAt,
      lastMessageAt: session.lastMessageAt,
    },
    generalChatSystemPromptBackup: session.generalChatSystemPrompt,
  });
}

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

const WorkshopMessageBaseShape = {
  id: z.string().uuid(),
  seriesId: z.string().uuid(),
  sessionId: z.string().uuid(),
  role: WorkshopMessageRoleSchema,
  mode: WorkshopModeSchema.default("general-chat"),
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
} satisfies z.ZodRawShape;

function refineWorkshopMessage(
  message: z.infer<z.ZodObject<typeof WorkshopMessageBaseShape>> & {
    status: WorkshopMessageStatus;
  },
  context: z.RefinementCtx,
): void {
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
  if (message.status === "cancelled" && (message.errorCode !== null || message.errorMessage !== null)) {
    context.addIssue({
      code: "custom",
      path: [message.errorCode !== null ? "errorCode" : "errorMessage"],
      message: "Cancelled Workshop messages cannot carry failure details",
    });
  }
}

export const WorkshopMessageV1Schema = z.object({
  schemaVersion: z.literal(1),
  ...WorkshopMessageBaseShape,
  status: WorkshopMessageStatusV1Schema.default("succeeded"),
}).superRefine(refineWorkshopMessage);
export type WorkshopMessageV1 = z.infer<typeof WorkshopMessageV1Schema>;

export const WorkshopMessageV2Schema = z.object({
  schemaVersion: z.literal(2),
  ...WorkshopMessageBaseShape,
  status: WorkshopMessageStatusSchema.default("succeeded"),
  reasoningOutputKind: WorkshopReasoningOutputKindSchema,
}).superRefine(refineWorkshopMessage);
export type WorkshopMessageV2 = z.infer<typeof WorkshopMessageV2Schema>;

export const WorkshopMessageAuthoritySchema = z.union([
  WorkshopMessageV2Schema,
  WorkshopMessageV1Schema,
]);

export const WorkshopMessageSchema = WorkshopMessageAuthoritySchema.transform((message): WorkshopMessageV2 => {
  if (message.schemaVersion === 2) return message;
  return WorkshopMessageV2Schema.parse({
    ...message,
    schemaVersion: 2,
    reasoningOutputKind: message.reasoningContent.trim() ? "unknown" : "none",
  });
});
export type WorkshopMessage = z.infer<typeof WorkshopMessageSchema>;

export const WorkshopMessageV1RollbackSnapshotSchema = z.object({
  message: WorkshopMessageV1Schema,
  cancelledStatusBackup: z.literal("cancelled").nullable(),
  reasoningOutputKindBackup: WorkshopReasoningOutputKindSchema,
});
export type WorkshopMessageV1RollbackSnapshot = z.infer<
  typeof WorkshopMessageV1RollbackSnapshotSchema
>;

export function workshopMessageV1RollbackSnapshot(
  rawMessage: WorkshopMessage,
): WorkshopMessageV1RollbackSnapshot {
  const message = WorkshopMessageSchema.parse(rawMessage);
  return WorkshopMessageV1RollbackSnapshotSchema.parse({
    message: {
      ...message,
      schemaVersion: 1,
      status: message.status === "cancelled" ? "failed" : message.status,
      reasoningOutputKind: undefined,
    },
    cancelledStatusBackup: message.status === "cancelled" ? "cancelled" : null,
    reasoningOutputKindBackup: message.reasoningOutputKind,
  });
}

const WorkshopAgentRunStatusV1Schema = z.enum([
  "running",
  "waiting-confirmation",
  "completed",
  "failed",
  "interrupted",
  "abandoned",
]);
export const WorkshopAgentRunStatusSchema = z.enum([
  ...WorkshopAgentRunStatusV1Schema.options,
  "cancelled",
]);
export type WorkshopAgentRunStatus = z.infer<typeof WorkshopAgentRunStatusSchema>;

export const WorkshopAgentStepKindSchema = z.enum([
  "model",
  "retry",
  "repair",
  "tool-request",
  "tool-result",
  "continuation",
]);
export type WorkshopAgentStepKind = z.infer<typeof WorkshopAgentStepKindSchema>;

const WorkshopAgentStepStatusV1Schema = z.enum([
  "pending",
  "running",
  "waiting-confirmation",
  "succeeded",
  "failed",
  "interrupted",
  "abandoned",
]);
export const WorkshopAgentStepStatusSchema = z.enum([
  ...WorkshopAgentStepStatusV1Schema.options,
  "cancelled",
]);
export type WorkshopAgentStepStatus = z.infer<typeof WorkshopAgentStepStatusSchema>;

export const WorkshopProviderPromptSnapshotSchema = z.object({
  system: z.string().max(1_000_000),
  instructions: z.string().max(1_000_000),
  user: z.string().max(1_000_000),
  hash: RevisionHashSchema,
});
export type WorkshopProviderPromptSnapshot = z.infer<typeof WorkshopProviderPromptSnapshotSchema>;

export const WorkshopProviderToolCallSnapshotSchema = z.object({
  id: z.string().trim().min(1).max(240),
  name: z.string().trim().min(1).max(240),
  arguments: z.string().max(1_000_000),
}).strict();

export const WorkshopProviderHistoryMessageSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("user"),
    content: z.string().max(1_000_000),
  }).strict(),
  z.object({
    role: z.literal("assistant"),
    content: z.string().max(1_000_000),
    reasoningContent: z.string().max(1_000_000).optional(),
    toolCalls: z.array(WorkshopProviderToolCallSnapshotSchema).max(64).optional(),
  }).strict(),
  z.object({
    role: z.literal("tool"),
    content: z.string().max(1_000_000),
    toolCallId: z.string().trim().min(1).max(240),
  }).strict(),
]);
export type WorkshopProviderHistoryMessage = z.infer<typeof WorkshopProviderHistoryMessageSchema>;

const WorkshopAgentStepRecordBaseShape = {
  id: z.string().uuid(),
  index: z.number().int().nonnegative(),
  kind: WorkshopAgentStepKindSchema,
  attempt: z.number().int().positive().default(1),
  modelCallId: z.string().uuid().nullable().default(null),
  promptSnapshot: WorkshopProviderPromptSnapshotSchema.nullable().default(null),
  historySnapshot: z.array(WorkshopProviderHistoryMessageSchema).max(1000).default([]),
  messageId: z.string().uuid().nullable().default(null),
  inputMessageIds: z.array(z.string().uuid()).default([]),
  degradedStructuredOutput: z.boolean().default(false),
  retryable: z.boolean().default(false),
  errorCode: z.string().max(120).nullable().default(null),
  errorMessage: z.string().max(4000).nullable().default(null),
  startedAt: z.string().datetime().nullable().default(null),
  completedAt: z.string().datetime().nullable().default(null),
} satisfies z.ZodRawShape;

function refineWorkshopAgentStep(
  step: z.infer<z.ZodObject<typeof WorkshopAgentStepRecordBaseShape>> & {
    status: WorkshopAgentStepStatus;
  },
  context: z.RefinementCtx,
): void {
  const terminal = ["succeeded", "failed", "interrupted", "abandoned", "cancelled"].includes(step.status);
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
  if (
    ["model", "retry", "repair", "continuation"].includes(step.kind) &&
    step.status !== "pending" &&
    step.modelCallId === null &&
    !["failed", "cancelled"].includes(step.status)
  ) {
    context.addIssue({ code: "custom", path: ["modelCallId"], message: "A model Agent step may omit ModelCallLog only for a preflight failure or cancellation" });
  }
  if (["model", "retry", "repair", "continuation"].includes(step.kind) && step.status !== "pending" && step.promptSnapshot === null) {
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
}

export const WorkshopAgentStepRecordV1Schema = z.object({
  schemaVersion: z.literal(1),
  ...WorkshopAgentStepRecordBaseShape,
  status: WorkshopAgentStepStatusV1Schema,
}).superRefine(refineWorkshopAgentStep);
export type WorkshopAgentStepRecordV1 = z.infer<typeof WorkshopAgentStepRecordV1Schema>;

export const WorkshopAgentStepRecordV2Schema = z.object({
  schemaVersion: z.literal(2),
  ...WorkshopAgentStepRecordBaseShape,
  status: WorkshopAgentStepStatusSchema,
}).superRefine(refineWorkshopAgentStep);
export type WorkshopAgentStepRecordV2 = z.infer<typeof WorkshopAgentStepRecordV2Schema>;

export const WorkshopAgentStepRecordSchema = z.union([
  WorkshopAgentStepRecordV2Schema,
  WorkshopAgentStepRecordV1Schema,
]).transform((step): WorkshopAgentStepRecordV2 => {
  if (step.schemaVersion === 2) return step;
  return WorkshopAgentStepRecordV2Schema.parse({ ...step, schemaVersion: 2 });
});
export type WorkshopAgentStepRecord = z.infer<typeof WorkshopAgentStepRecordSchema>;

const WorkshopAgentRunBaseShape = {
  id: z.string().uuid(),
  seriesId: z.string().uuid(),
  sessionId: z.string().uuid(),
  authorMessageId: z.string().uuid(),
  modelProfileId: z.string().uuid(),
  modelOverride: z.string().trim().min(1).max(200).nullable().default(null),
  parameters: ModelParametersSchema.default({}),
  contextBundleId: z.string().uuid(),
  promptTemplateId: z.string().uuid(),
  promptTemplateVersion: z.number().int().positive(),
  promptSnapshot: WorkshopProviderPromptSnapshotSchema,
  activeStepId: z.string().uuid().nullable().default(null),
  degradedStructuredOutput: z.boolean().default(false),
  retryable: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable().default(null),
} satisfies z.ZodRawShape;

function refineWorkshopAgentRun(
  run: z.infer<z.ZodObject<typeof WorkshopAgentRunBaseShape>> & {
    status: WorkshopAgentRunStatus;
    steps: WorkshopAgentStepRecordV2[] | WorkshopAgentStepRecordV1[];
  },
  context: z.RefinementCtx,
): void {
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
  const terminal = ["completed", "failed", "interrupted", "abandoned", "cancelled"].includes(run.status);
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
}

export const WorkshopAgentRunV1Schema = z.object({
  schemaVersion: z.literal(1),
  ...WorkshopAgentRunBaseShape,
  status: WorkshopAgentRunStatusV1Schema,
  steps: z.array(WorkshopAgentStepRecordV1Schema).default([]),
}).superRefine(refineWorkshopAgentRun);
export type WorkshopAgentRunV1 = z.infer<typeof WorkshopAgentRunV1Schema>;

export const WorkshopAgentRunV2Schema = z.object({
  schemaVersion: z.literal(2),
  ...WorkshopAgentRunBaseShape,
  status: WorkshopAgentRunStatusSchema,
  steps: z.array(WorkshopAgentStepRecordV2Schema).default([]),
}).superRefine(refineWorkshopAgentRun);
export type WorkshopAgentRunV2 = z.infer<typeof WorkshopAgentRunV2Schema>;

export const WorkshopAgentRunAuthoritySchema = z.union([
  WorkshopAgentRunV2Schema,
  WorkshopAgentRunV1Schema,
]);

export const WorkshopAgentRunSchema = WorkshopAgentRunAuthoritySchema.transform((run): WorkshopAgentRunV2 => {
  if (run.schemaVersion === 2) return run;
  return WorkshopAgentRunV2Schema.parse({
    ...run,
    schemaVersion: 2,
    steps: run.steps.map((step) => ({ ...step, schemaVersion: 2 })),
  });
});
export type WorkshopAgentRun = z.infer<typeof WorkshopAgentRunSchema>;

export const WorkshopAgentRunV1RollbackSnapshotSchema = z.object({
  run: WorkshopAgentRunV1Schema,
  cancelledRunStatusBackup: z.literal("cancelled").nullable(),
  cancelledStepStatusBackups: z.array(z.object({
    stepId: z.string().uuid(),
    status: z.literal("cancelled"),
  })),
});
export type WorkshopAgentRunV1RollbackSnapshot = z.infer<
  typeof WorkshopAgentRunV1RollbackSnapshotSchema
>;

export function workshopAgentRunV1RollbackSnapshot(
  rawRun: WorkshopAgentRun,
): WorkshopAgentRunV1RollbackSnapshot {
  const run = WorkshopAgentRunSchema.parse(rawRun);
  const cancelledSteps = run.steps.filter((step) => step.status === "cancelled");
  return WorkshopAgentRunV1RollbackSnapshotSchema.parse({
    run: {
      ...run,
      schemaVersion: 1,
      status: run.status === "cancelled" ? "abandoned" : run.status,
      steps: run.steps.map((step) => ({
        ...step,
        schemaVersion: 1,
        status: step.status === "cancelled" ? "abandoned" : step.status,
        errorCode: step.status === "cancelled" ? "AGENT_RUN_CANCELLED_ROLLBACK" : step.errorCode,
        errorMessage: step.status === "cancelled"
          ? "Cancelled by the author; exact status is preserved in the rollback backup."
          : step.errorMessage,
      })),
    },
    cancelledRunStatusBackup: run.status === "cancelled" ? "cancelled" : null,
    cancelledStepStatusBackups: cancelledSteps.map((step) => ({
      stepId: step.id,
      status: "cancelled" as const,
    })),
  });
}

const WorkshopAuthorityMigrationDocumentSchema = z.object({
  kind: z.enum(["message", "agent-run", "context-basket"]),
  id: z.string().uuid(),
  relativePath: z.string().trim().min(1).max(500),
  raw: z.string().min(1).max(4_000_000),
  revision: RevisionHashSchema,
  migratedRevision: RevisionHashSchema,
}).strict();

export const WorkshopAuthorityV2MigrationBackupSchema = z.object({
  schemaVersion: z.literal(1),
  migrationId: z.string().uuid(),
  seriesId: z.string().uuid(),
  createdAt: z.string().datetime(),
  documents: z.array(WorkshopAuthorityMigrationDocumentSchema),
}).strict();
export type WorkshopAuthorityV2MigrationBackup = z.infer<
  typeof WorkshopAuthorityV2MigrationBackupSchema
>;

export const WorkshopAuthorityV2MigrationResultSchema = z.object({
  migrationId: z.string().uuid(),
  migratedMessageIds: z.array(z.string().uuid()),
  migratedAgentRunIds: z.array(z.string().uuid()),
  migratedContextBasketIds: z.array(z.string().uuid()),
}).strict();
export type WorkshopAuthorityV2MigrationResult = z.infer<
  typeof WorkshopAuthorityV2MigrationResultSchema
>;

export const RollbackWorkshopAuthorityV2MigrationResultSchema = z.object({
  migrationId: z.string().uuid(),
  restoredMessageIds: z.array(z.string().uuid()),
  restoredAgentRunIds: z.array(z.string().uuid()),
  restoredContextBasketIds: z.array(z.string().uuid()),
}).strict();
export type RollbackWorkshopAuthorityV2MigrationResult = z.infer<
  typeof RollbackWorkshopAuthorityV2MigrationResultSchema
>;

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
  modelCallId: z.string().uuid().nullable(),
  responseText: z.string().max(400000).default(""),
});
export type WorkshopAgentRunActionResult = z.infer<typeof WorkshopAgentRunActionResultSchema>;

const WorkshopContextItemKindV1Schema = z.enum([
  "full-novel",
  "full-outline",
  "act",
  "chapter",
  "scene",
  "codex-entry",
]);

const WorkshopContextItemRefBaseShape = {
  id: z.string().uuid(),
  sourceId: z.string().min(1).max(240),
  label: z.string().trim().min(1).max(200),
  pinned: z.boolean().default(false),
  note: z.string().max(1000).default(""),
  createdAt: z.string().datetime(),
} satisfies z.ZodRawShape;

export const WorkshopContextItemRefV1Schema = z.object({
  ...WorkshopContextItemRefBaseShape,
  kind: WorkshopContextItemKindV1Schema,
});
export type WorkshopContextItemRefV1 = z.infer<typeof WorkshopContextItemRefV1Schema>;

export const WorkshopContextItemRefSchema = z.object({
  ...WorkshopContextItemRefBaseShape,
  kind: WorkshopContextItemKindSchema,
});
export type WorkshopContextItemRef = z.infer<typeof WorkshopContextItemRefSchema>;

const WorkshopContextBasketBaseShape = {
  id: z.string().uuid(),
  seriesId: z.string().uuid(),
  sessionId: z.string().uuid(),
  sceneId: z.string().uuid().nullable().default(null),
  blockId: z.string().uuid().nullable().default(null),
  selection: ContextPreviewSelectionSchema.nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
} satisfies z.ZodRawShape;

function refineWorkshopContextBasket(
  basket: { items: Array<{ id: string }> },
  context: z.RefinementCtx,
): void {
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
    }
}

export const WorkshopContextBasketV1Schema = z.object({
  schemaVersion: z.literal(1),
  ...WorkshopContextBasketBaseShape,
  items: z.array(WorkshopContextItemRefV1Schema).default([]),
}).superRefine(refineWorkshopContextBasket);
export type WorkshopContextBasketV1 = z.infer<typeof WorkshopContextBasketV1Schema>;

export const WorkshopContextBasketV2Schema = z.object({
  schemaVersion: z.literal(2),
  ...WorkshopContextBasketBaseShape,
  items: z.array(WorkshopContextItemRefSchema).default([]),
}).superRefine(refineWorkshopContextBasket);
export type WorkshopContextBasketV2 = z.infer<typeof WorkshopContextBasketV2Schema>;

export const WorkshopContextBasketAuthoritySchema = z.union([
  WorkshopContextBasketV2Schema,
  WorkshopContextBasketV1Schema,
]);

export const WorkshopContextBasketSchema = WorkshopContextBasketAuthoritySchema.transform(
  (basket): WorkshopContextBasketV2 => basket.schemaVersion === 2
    ? basket
    : WorkshopContextBasketV2Schema.parse({
      ...basket,
      schemaVersion: 2,
      items: basket.items.map((item) => ({
        ...item,
        kind: item.kind === "act" ? "chapter" : item.kind === "chapter" ? "act" : item.kind,
      })),
    }),
);
export type WorkshopContextBasket = z.infer<typeof WorkshopContextBasketSchema>;

export const CreateWorkshopSessionInputSchema = z.object({
  title: z.string().trim().min(1).max(160).default("New chat"),
  kind: WorkshopConversationKindSchema.default("chat"),
  sceneId: z.string().uuid().nullable().optional(),
  generalChatSystemPrompt: z.string().trim().max(8000).optional(),
}).superRefine((input, context) => {
  if (input.kind === "agent" && input.generalChatSystemPrompt !== undefined) {
    context.addIssue({
      code: "custom",
      path: ["generalChatSystemPrompt"],
      message: "Agent sessions cannot own a General Chat system prompt",
    });
  }
});
export type CreateWorkshopSessionInput = z.input<typeof CreateWorkshopSessionInputSchema>;

export const UpdateWorkshopSessionInputSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  expectedTitle: z.string().trim().min(1).max(160).optional(),
  generalChatSystemPrompt: z.string().trim().max(8000).optional(),
}).superRefine((input, context) => {
  if (input.title === undefined && input.generalChatSystemPrompt === undefined) {
    context.addIssue({ code: "custom", message: "At least one session field is required" });
  }
  if (input.expectedTitle !== undefined && input.title === undefined) {
    context.addIssue({
      code: "custom",
      path: ["expectedTitle"],
      message: "expectedTitle can only guard a title update",
    });
  }
});
export type UpdateWorkshopSessionInput = z.infer<typeof UpdateWorkshopSessionInputSchema>;

const CreateWorkshopMessageInputBaseSchema = z.object({
  role: z.literal("author").default("author"),
  mode: WorkshopModeSchema.default("general-chat"),
  content: z.string().trim().min(1).max(400000),
  attachmentIds: WorkshopAttachmentIdsSchema,
  draftToken: WorkshopDraftTokenSchema.nullable().default(null),
}).strict();
export const CreateWorkshopMessageInputSchema =
  CreateWorkshopMessageInputBaseSchema.superRefine(requireDraftTokenForAttachments);
export type CreateWorkshopMessageInput = z.input<typeof CreateWorkshopMessageInputSchema>;

export const ResendWorkshopMessageInputSchema = z.object({
  operationId: z.string().uuid().optional(),
  content: z.string().trim().min(1).max(16000).optional(),
  roleId: z.string().min(1).max(120).default("workshop-general-chat"),
  taskKind: AiTaskKindSchema.default("analysis"),
  promptTemplateId: z.string().uuid().default("00000000-0000-4000-8000-000000000421"),
  promptTemplateVersion: z.number().int().positive().default(1),
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

export const WorkshopMessageSourceSchema = z.object({
  session: WorkshopSessionSchema,
  message: WorkshopMessageSchema,
});
export type WorkshopMessageSource = z.infer<typeof WorkshopMessageSourceSchema>;

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
  deletedMessageIds: z.array(z.string().uuid()).min(1),
  deletedAttachmentIds: z.array(z.string().uuid()).default([]),
  deletedBranchIds: z.array(z.string().uuid()).default([]),
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
  operationId: z.string().uuid().optional(),
  modelProfileId: z.string().uuid(),
  parameters: ModelParametersSchema.default({}),
}).strict().superRefine(requireDraftTokenForAttachments);
export type RunWorkshopCallInput = z.input<typeof RunWorkshopCallInputSchema>;

export const WorkshopCallResultSchema = z.object({
  operationId: z.string().uuid(),
  authorMessage: WorkshopMessageSchema,
  assistantMessage: WorkshopMessageSchema,
  toolMessages: z.array(WorkshopMessageSchema).default([]),
  contextBundleId: z.string().uuid().nullable(),
  modelCallId: z.string().uuid().nullable(),
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
    operationId: z.string().uuid(),
    message: WorkshopMessageSchema,
  }),
  z.object({
    type: z.literal("assistant-start"),
    operationId: z.string().uuid(),
    assistantMessageId: z.string().uuid(),
    contextBundleId: z.string().uuid(),
    modelCallId: z.string().uuid(),
    attempt: z.number().int().positive(),
    reset: z.boolean(),
  }),
  z.object({
    type: z.literal("metadata"),
    operationId: z.string().uuid(),
    assistantMessageId: z.string().uuid(),
    contextBundleId: z.string().uuid(),
    modelCallId: z.string().uuid(),
    attempt: z.number().int().positive(),
    reset: z.boolean(),
  }),
  z.object({
    type: z.literal("delta"),
    operationId: z.string().uuid(),
    assistantMessageId: z.string().uuid(),
    modelCallId: z.string().uuid(),
    attempt: z.number().int().positive(),
    text: z.string(),
  }),
  z.object({
    type: z.literal("reasoning-delta"),
    operationId: z.string().uuid(),
    assistantMessageId: z.string().uuid(),
    modelCallId: z.string().uuid(),
    attempt: z.number().int().positive(),
    text: z.string(),
    outputKind: z.enum(["summary", "full"]),
  }),
  z.object({
    type: z.literal("assistant-message"),
    operationId: z.string().uuid(),
    message: WorkshopMessageSchema,
  }),
  z.object({
    type: z.literal("error"),
    operationId: z.string().uuid(),
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

export const CancelWorkshopCallResultSchema = z.object({
  operationId: z.string().uuid(),
  result: WorkshopCallResultSchema,
});
export type CancelWorkshopCallResult = z.infer<typeof CancelWorkshopCallResultSchema>;
