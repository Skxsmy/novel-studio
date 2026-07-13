import type { ProviderPrompt } from "@novel-studio/ai";
import { z } from "zod";
import type { WorkshopCodexCreateDraft, WorkshopCodexUpdateDraft } from "./codexDraft.js";
import { WORKSHOP_AGENT_TOOL_PROTOCOL_PROMPT } from "./workshopPrompts.js";

const WorkshopCodexDraftDetailSchema = z.object({
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(100000),
}).strict();

const WorkshopCodexCreateDraftSchema = z.object({
  aliases: z.array(z.string().trim().min(1).max(200)).default([]),
  categoryId: z.enum(["character", "location", "object", "uncategorized", "lore", "organization", "plot-thread"]),
  description: z.string().trim().min(1).max(200000),
  details: z.array(WorkshopCodexDraftDetailSchema).default([]),
  name: z.string().trim().min(1).max(200),
  research: z.string().trim().min(1).max(200000),
}).strict();

const WorkshopCodexProgressionDraftSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    input: z.record(z.string(), z.unknown()),
  }).strict(),
  z.object({
    action: z.literal("update"),
    progressionId: z.string().uuid(),
    input: z.record(z.string(), z.unknown()),
  }).strict(),
  z.object({
    action: z.literal("delete"),
    progressionId: z.string().uuid(),
    input: z.record(z.string(), z.unknown()).default({}),
  }).strict(),
]);

const WorkshopCodexUpdatePatchSchema = z.object({
  aliases: z.array(z.string().trim().min(1).max(200)).optional(),
  description: z.string().trim().min(1).max(200000).optional(),
  details: z.array(WorkshopCodexDraftDetailSchema).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  progressions: z.array(WorkshopCodexProgressionDraftSchema).optional(),
  research: z.string().trim().min(1).max(200000).optional(),
}).strict().refine((patch) => Object.keys(patch).length > 0, {
  message: "Codex update patch must contain at least one change",
});

const WorkshopCodexUpdateDraftSchema = z.object({
  target: z.object({
    entryId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(200).optional(),
  }).strict().refine((target) => Boolean(target.entryId || target.name), {
    message: "Codex update target requires entryId or name",
  }),
  patch: WorkshopCodexUpdatePatchSchema,
}).strict();

export const WorkshopAgentStepSchema = z.union([
  z.object({
    schemaVersion: z.literal(1),
    type: z.literal("respond"),
    message: z.string().trim().min(1).max(400000),
  }).strict(),
  z.object({
    schemaVersion: z.literal(1),
    type: z.literal("request_tool"),
    tool: z.literal("codex.create_entry"),
    message: z.string().trim().min(1).max(4000),
    draft: WorkshopCodexCreateDraftSchema,
  }).strict(),
  z.object({
    schemaVersion: z.literal(1),
    type: z.literal("request_tool"),
    tool: z.literal("codex.update_entry"),
    message: z.string().trim().min(1).max(4000),
    draft: WorkshopCodexUpdateDraftSchema,
  }).strict(),
]);
export type WorkshopAgentStep =
  | { schemaVersion: 1; type: "respond"; message: string }
  | {
    schemaVersion: 1;
    type: "request_tool";
    tool: "codex.create_entry";
    message: string;
    draft: WorkshopCodexCreateDraft;
  }
  | {
    schemaVersion: 1;
    type: "request_tool";
    tool: "codex.update_entry";
    message: string;
    draft: WorkshopCodexUpdateDraft;
  };

export function parseWorkshopAgentStep(content: string): WorkshopAgentStep {
  return WorkshopAgentStepSchema.parse(JSON.parse(content)) as WorkshopAgentStep;
}

export function applyWorkshopAgentPrompt(prompt: ProviderPrompt): ProviderPrompt {
  return {
    ...prompt,
    instructions: [prompt.instructions, WORKSHOP_AGENT_TOOL_PROTOCOL_PROMPT].filter(Boolean).join("\n\n"),
    user: prompt.user,
  };
}

export function workshopAgentRepairPrompt(
  prompt: ProviderPrompt,
  invalidOutput: string,
  validationMessage: string,
): ProviderPrompt {
  return {
    ...prompt,
    instructions: [
      prompt.instructions,
      "Return one valid JSON object matching the Workshop Agent step schema. Return JSON only.",
      `Validation error: ${validationMessage}`,
      `Invalid output: ${invalidOutput.slice(0, 12000)}`,
    ].filter(Boolean).join("\n\n"),
  };
}
