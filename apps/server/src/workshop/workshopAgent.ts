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
  research: z.string().trim().min(1).max(200000).optional().describe(
    "New Research text to append. Do not repeat or rewrite existing Research content.",
  ),
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
      description: "Prepare one new fictional Codex entry only when the author explicitly asks to create, record, add, or save it. Natural requests such as 'record this as an entry' or 'save this to Codex' are explicit write intent: when the target and content are sufficient, call this tool instead of claiming in prose that the entry was recorded. Do not call it for brainstorming, prose writing, discussion, a rejected suggestion, or merely because Codex was mentioned. Use only author-provided or author-confirmed decisions from the conversation; a short correction remains binding in later turns. Canonical fields contain only the current accepted facts: omit rejected alternatives entirely, including negated wording or edit-history notes. The server validates the exact draft and presents it for author confirmation before any project write.",
      parameters: jsonSchema(WorkshopCodexCreateToolArgumentsSchema),
      strict: true,
    },
    {
      name: "codex.update_entry",
      description: "Prepare changes to one existing Codex entry only when the author explicitly asks to update, record, or save those changes. Natural requests such as 'update this change in the setting' are explicit write intent: when the target and change are sufficient, call this tool instead of claiming in prose that the entry was updated. Do not call it for brainstorming, prose writing, discussion, a rejected suggestion, or an ambiguous target. Preserve earlier author corrections and exclusions. Every supplied ordinary patch field is a full replacement value, not a delta: carry forward all still-valid accepted content from the existing field, apply only the requested change, and omit rejected alternatives entirely even as negations or edit-history notes. Use the entry ID when available, otherwise its current unique name. The server validates the target and presents the exact draft for author confirmation before any project write. Progression creation requires its effective Scene; progression update or deletion requires an existing progression ID.",
      parameters: jsonSchema(WorkshopCodexUpdateToolArgumentsSchema),
      strict: true,
    },
  ];
}

function repairUnescapedJsonStringQuotes(value: string): string {
  let repaired = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    if (!inString) {
      repaired += character;
      if (character === '"') inString = true;
      continue;
    }
    if (escaped) {
      repaired += character;
      escaped = false;
      continue;
    }
    if (character === "\\") {
      repaired += character;
      escaped = true;
      continue;
    }
    if (character !== '"') {
      repaired += character;
      continue;
    }
    const nextNonWhitespace = value.slice(index + 1).match(/^\s*([,:}\]])/u)?.[1];
    if (nextNonWhitespace) {
      repaired += character;
      inString = false;
    } else {
      repaired += '\\"';
    }
  }
  return repaired;
}

function parseToolArguments(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch (originalError) {
    try {
      return JSON.parse(repairUnescapedJsonStringQuotes(value));
    } catch {
      throw originalError;
    }
  }
}

export function parseWorkshopAgentToolCall(call: ProviderToolCall): WorkshopAgentStep {
  let rawArguments: unknown;
  try {
    rawArguments = parseToolArguments(call.arguments);
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
