import type { ProviderToolCall, ProviderToolDefinition } from "@novel-studio/ai";
import { z } from "zod";
import type { WorkshopCodexCreateDraft, WorkshopCodexUpdateDraft } from "./codexDraft.js";

export const WorkshopCodexDraftDetailSchema = z.object({
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(100000),
}).strict();

export const WorkshopCodexCreateDraftSchema = z.object({
  aliases: z.array(z.string().trim().min(1).max(200)).default([]),
  categoryId: z.enum(["character", "location", "object", "uncategorized", "lore", "organization", "plot-thread"]),
  description: z.string().trim().min(1).max(200000),
  details: z.array(WorkshopCodexDraftDetailSchema).default([]),
  name: z.string().trim().min(1).max(200),
  research: z.string().trim().min(1).max(200000),
}).strict();

export const WorkshopCodexProgressionDraftSchema = z.discriminatedUnion("action", [
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

export const WorkshopCodexUpdatePatchSchema = z.object({
  aliases: z.array(z.string().trim().min(1).max(200)).optional(),
  description: z.string().trim().min(1).max(200000).optional(),
  details: z.array(WorkshopCodexDraftDetailSchema).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  progressions: z.array(WorkshopCodexProgressionDraftSchema).optional(),
  research: z.string().trim().min(1).max(200000).optional(),
}).strict().refine((patch) => Object.keys(patch).length > 0, {
  message: "Codex update patch must contain at least one change",
});

export const WorkshopCodexUpdateDraftSchema = z.object({
  target: z.object({
    entryId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(200).optional(),
  }).strict().refine((target) => Boolean(target.entryId || target.name), {
    message: "Codex update target requires entryId or name",
  }),
  patch: WorkshopCodexUpdatePatchSchema,
}).strict();

const WorkshopCodexCreateToolArgumentsSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  draft: WorkshopCodexCreateDraftSchema,
}).strict();

const WorkshopCodexUpdateToolArgumentsSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  draft: WorkshopCodexUpdateDraftSchema,
}).strict();

export const WorkshopAgentToolArgumentsSchema = z.union([
  z.object({
    tool: z.literal("codex.create_entry"),
    arguments: WorkshopCodexCreateToolArgumentsSchema,
  }).strict(),
  z.object({
    tool: z.literal("codex.update_entry"),
    arguments: WorkshopCodexUpdateToolArgumentsSchema,
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

function jsonSchema(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
}

export function workshopAgentToolDefinitions(): ProviderToolDefinition[] {
  return [
    {
      name: "codex.create_entry",
      description: "For a latest author turn that directly asks to record a new fictional Codex entry, prepare that entry from the decisions in the conversation. The server presents the exact draft for author confirmation before any project write.",
      parameters: jsonSchema(WorkshopCodexCreateToolArgumentsSchema),
      strict: true,
    },
    {
      name: "codex.update_entry",
      description: "For a latest author turn that directly asks to change an existing Codex entry, prepare those changes. Use its entry ID when available, otherwise its current unique name. The server validates the target and presents the exact draft for author confirmation before any project write. Progression creation requires its effective Scene; progression update or deletion requires an existing progression ID.",
      parameters: jsonSchema(WorkshopCodexUpdateToolArgumentsSchema),
      strict: true,
    },
  ];
}

export function parseWorkshopAgentToolCall(call: ProviderToolCall): WorkshopAgentStep {
  let rawArguments: unknown;
  try {
    rawArguments = JSON.parse(call.arguments);
  } catch (error) {
    throw new Error(`Tool ${call.name} arguments are not valid JSON: ${error instanceof Error ? error.message : "parse failed"}`);
  }
  const parsed = WorkshopAgentToolArgumentsSchema.parse({
    tool: call.name,
    arguments: rawArguments,
  });
  if (parsed.tool === "codex.create_entry") {
    return {
      schemaVersion: 1,
      type: "request_tool",
      tool: parsed.tool,
      message: parsed.arguments.message,
      draft: parsed.arguments.draft,
    };
  }
  return {
    schemaVersion: 1,
    type: "request_tool",
    tool: parsed.tool,
    message: parsed.arguments.message,
    draft: parsed.arguments.draft as WorkshopCodexUpdateDraft,
  };
}
