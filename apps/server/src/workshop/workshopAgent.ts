import type { ProviderPrompt } from "@novel-studio/ai";
import type { CodexBuiltInCategoryId } from "@novel-studio/contracts";
import type {
  WorkshopCodexCreateDraft,
  WorkshopCodexDraftDetail,
  WorkshopCodexUpdateDraft,
  WorkshopCodexUpdatePatch,
} from "./codexDraft.js";
import { WORKSHOP_AGENT_TOOL_PROTOCOL_PROMPT } from "./workshopPrompts.js";

export type WorkshopAgentStep =
  | {
    schemaVersion: 1;
    type: "respond";
    message: string;
  }
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

const CATEGORY_IDS: CodexBuiltInCategoryId[] = [
  "character",
  "location",
  "object",
  "lore",
  "organization",
  "plot-thread",
];

function jsonObjectText(content: string): string | null {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/iu);
  if (fenced?.[1]) return fenced[1].trim();
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start >= 0 && end > start) return content.slice(start, end + 1);
  return null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
}

function asDetails(value: unknown): WorkshopCodexDraftDetail[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const detail = item as Record<string, unknown>;
      const label = asString(detail.label);
      const detailValue = asString(detail.value);
      return label && detailValue ? { label, value: detailValue } : null;
    })
    .filter((detail): detail is WorkshopCodexDraftDetail => Boolean(detail));
}

function plainAgentMessage(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return "No assistant response was returned by the model.";
  const lines = trimmed.split(/\r?\n/u);
  const toolCallIndex = lines.findIndex((line) => /^\s*(?:Tool Call|Tool Request)\s*:/iu.test(line));
  if (toolCallIndex >= 0) {
    const beforeToolCall = lines.slice(0, toolCallIndex).join("\n").trim();
    if (beforeToolCall) return beforeToolCall;
    return "Received.";
  }
  return trimmed;
}

function normalizeDraft(value: unknown): WorkshopCodexCreateDraft | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as Record<string, unknown>;
  const categoryId = asString(draft.categoryId);
  const name = asString(draft.name);
  const description = asString(draft.description);
  if (!CATEGORY_IDS.includes(categoryId as CodexBuiltInCategoryId) || !name || !description) return null;
  return {
    aliases: asStringArray(draft.aliases),
    categoryId: categoryId as CodexBuiltInCategoryId,
    description,
    details: asDetails(draft.details),
    name,
    research: asString(draft.research) || "Author decision recorded in this Agent session.",
  };
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function asProgressions(value: unknown): NonNullable<WorkshopCodexUpdatePatch["progressions"]> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const action = asString(record.action).toLocaleLowerCase("und");
      const rawInput = record.input && typeof record.input === "object" && !Array.isArray(record.input)
        ? record.input as Record<string, unknown>
        : record;
      if (action === "create") {
        return { action: "create" as const, input: { ...rawInput } };
      }
      const progressionId = asString(record.progressionId);
      const baseRevision = asString(rawInput.baseRevision ?? record.baseRevision);
      if (!progressionId || !baseRevision) return null;
      if (action === "update") {
        return {
          action: "update" as const,
          progressionId,
          input: { ...rawInput, baseRevision },
        };
      }
      if (action === "delete") {
        return {
          action: "delete" as const,
          progressionId,
          input: { baseRevision },
        };
      }
      return null;
    })
    .filter((item): item is NonNullable<WorkshopCodexUpdatePatch["progressions"]>[number] => Boolean(item));
}

function normalizeUpdateDraft(value: unknown): WorkshopCodexUpdateDraft | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as Record<string, unknown>;
  const rawTarget = draft.target;
  const rawPatch = draft.patch;
  if (!rawTarget || typeof rawTarget !== "object" || !rawPatch || typeof rawPatch !== "object") return null;
  const targetRecord = rawTarget as Record<string, unknown>;
  const entryId = asString(targetRecord.entryId);
  const targetName = asString(targetRecord.name);
  if (!entryId && !targetName) return null;

  const patchRecord = rawPatch as Record<string, unknown>;
  const patch: WorkshopCodexUpdatePatch = {};
  if (hasOwn(patchRecord, "name")) {
    const name = asString(patchRecord.name);
    if (name) patch.name = name;
  }
  if (hasOwn(patchRecord, "aliases")) {
    patch.aliases = asStringArray(patchRecord.aliases);
  }
  if (hasOwn(patchRecord, "description")) {
    const description = asString(patchRecord.description);
    if (description) patch.description = description;
  }
  if (hasOwn(patchRecord, "details")) {
    patch.details = asDetails(patchRecord.details);
  }
  if (hasOwn(patchRecord, "research")) {
    patch.research = asString(patchRecord.research) || "Author decision recorded in this Agent session.";
  }
  if (hasOwn(patchRecord, "progressions")) {
    patch.progressions = asProgressions(patchRecord.progressions);
  }

  const hasPatch = patch.name !== undefined ||
    patch.aliases !== undefined ||
    patch.description !== undefined ||
    (patch.details !== undefined && patch.details.length > 0) ||
    (patch.progressions !== undefined && patch.progressions.length > 0) ||
    patch.research !== undefined;
  if (!hasPatch) return null;

  return {
    target: {
      ...(entryId ? { entryId } : {}),
      ...(targetName ? { name: targetName } : {}),
    },
    patch,
  };
}

export function parseWorkshopAgentStep(content: string): WorkshopAgentStep {
  const objectText = jsonObjectText(content);
  if (!objectText) {
    return {
      schemaVersion: 1,
      type: "respond",
      message: plainAgentMessage(content),
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(objectText);
  } catch {
    return {
      schemaVersion: 1,
      type: "respond",
      message: plainAgentMessage(content),
    };
  }
  if (!parsed || typeof parsed !== "object") {
    return {
      schemaVersion: 1,
      type: "respond",
      message: plainAgentMessage(content),
    };
  }
  const step = parsed as Record<string, unknown>;
  if (step.schemaVersion !== 1) {
    return {
      schemaVersion: 1,
      type: "respond",
      message: plainAgentMessage(content),
    };
  }
  if (step.tool === "codex.create_entry") {
    const draft = normalizeDraft(step.draft);
    if (draft) {
      return {
        schemaVersion: 1,
        type: "request_tool",
        tool: "codex.create_entry",
        message: asString(step.message) || "Prepared a Codex entry draft.",
        draft,
      };
    }
  }
  if (step.tool === "codex.update_entry") {
    const draft = normalizeUpdateDraft(step.draft);
    if (draft) {
      return {
        schemaVersion: 1,
        type: "request_tool",
        tool: "codex.update_entry",
        message: asString(step.message) || "Prepared a Codex entry update draft.",
        draft,
      };
    }
  }
  if (step.type === "request_tool" && step.tool === "codex.create_entry") {
    const draft = normalizeDraft(step.draft);
    if (draft) {
      return {
        schemaVersion: 1,
        type: "request_tool",
        tool: "codex.create_entry",
        message: asString(step.message) || "Prepared a Codex entry draft.",
        draft,
      };
    }
  }
  if (step.type === "request_tool" && step.tool === "codex.update_entry") {
    const draft = normalizeUpdateDraft(step.draft);
    if (draft) {
      return {
        schemaVersion: 1,
        type: "request_tool",
        tool: "codex.update_entry",
        message: asString(step.message) || "Prepared a Codex entry update draft.",
        draft,
      };
    }
  }
  return {
    schemaVersion: 1,
    type: "respond",
    message: asString(step.message) || plainAgentMessage(content),
  };
}

export function applyWorkshopAgentPrompt(prompt: ProviderPrompt): ProviderPrompt {
  return {
    ...prompt,
    instructions: [prompt.instructions, WORKSHOP_AGENT_TOOL_PROTOCOL_PROMPT].filter(Boolean).join("\n\n"),
    user: prompt.user,
  };
}
