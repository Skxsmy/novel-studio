import { z } from "zod";
import { AiTaskKindSchema, ModelParametersSchema, TokenUsageSchema } from "./ai.js";
import { ContextPreviewSelectionSchema } from "./context.js";
import { CreateProposalInputSchema, ProposalDocumentSchema } from "./proposals.js";

export const WorkshopSessionStatusSchema = z.enum(["active", "archived"]);
export type WorkshopSessionStatus = z.infer<typeof WorkshopSessionStatusSchema>;

export const WorkshopMessageRoleSchema = z.enum(["author", "assistant", "system", "tool", "result"]);
export type WorkshopMessageRole = z.infer<typeof WorkshopMessageRoleSchema>;

export const WorkshopMessageStatusSchema = z.enum(["pending", "succeeded", "failed"]);
export type WorkshopMessageStatus = z.infer<typeof WorkshopMessageStatusSchema>;

export const WorkshopContextItemKindSchema = z.enum([
  "scene",
  "selection",
  "codex-entry",
  "scene-section",
  "research-note",
  "note",
  "proposal-source",
]);
export type WorkshopContextItemKind = z.infer<typeof WorkshopContextItemKindSchema>;

export const WorkshopSessionSchema = z.object({
  schemaVersion: z.literal(1),
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
  status: WorkshopMessageStatusSchema.default("succeeded"),
  content: z.string().max(400000).default(""),
  contextBundleId: z.string().uuid().nullable().default(null),
  modelCallId: z.string().uuid().nullable().default(null),
  proposalIds: z.array(z.string().uuid()).default([]),
  errorCode: z.string().max(120).nullable().default(null),
  errorMessage: z.string().max(4000).nullable().default(null),
  createdAt: z.string().datetime(),
});
export type WorkshopMessage = z.infer<typeof WorkshopMessageSchema>;

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
  title: z.string().trim().min(1).max(160).default("Scene continuity pass"),
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

export const CreateWorkshopMessageInputSchema = z.object({
  role: WorkshopMessageRoleSchema.default("author"),
  content: z.string().trim().min(1).max(400000),
});
export type CreateWorkshopMessageInput = z.input<typeof CreateWorkshopMessageInputSchema>;

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

export const WorkshopContextPreviewInputSchema = z.object({
  userRequest: z.string().trim().min(1).max(16000),
  roleId: z.string().min(1).max(120).default("continuity-editor"),
  taskKind: AiTaskKindSchema.default("continuity-check"),
  promptTemplateId: z.string().uuid(),
  promptTemplateVersion: z.number().int().positive().default(1),
  modelProfileId: z.string().uuid().nullable().default(null),
  tokenBudget: z.number().int().positive().nullable().default(null),
});
export type WorkshopContextPreviewInput = z.input<typeof WorkshopContextPreviewInputSchema>;

export const RunWorkshopCallInputSchema = WorkshopContextPreviewInputSchema.extend({
  modelProfileId: z.string().uuid(),
  parameters: ModelParametersSchema.default({}),
});
export type RunWorkshopCallInput = z.input<typeof RunWorkshopCallInputSchema>;

export const WorkshopCallResultSchema = z.object({
  authorMessage: WorkshopMessageSchema,
  assistantMessage: WorkshopMessageSchema,
  contextBundleId: z.string().uuid(),
  modelCallId: z.string().uuid(),
  status: WorkshopMessageStatusSchema,
  responseText: z.string().max(400000).default(""),
  estimatedUsage: TokenUsageSchema,
  actualUsage: TokenUsageSchema.nullable().default(null),
});
export type WorkshopCallResult = z.infer<typeof WorkshopCallResultSchema>;
