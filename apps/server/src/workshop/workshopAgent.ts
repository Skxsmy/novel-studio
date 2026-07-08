import type { ProviderPrompt } from "@novel-studio/ai";
import type { CodexBuiltInCategoryId } from "@novel-studio/contracts";
import type {
  WorkshopCodexCreateDraft,
  WorkshopCodexDraftDetail,
  WorkshopCodexUpdateDraft,
  WorkshopCodexUpdatePatch,
} from "./codexDraft.js";

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

const AGENT_PROTOCOL_PROMPT = [
  "Workshop surface: Dialogue Agent.",
  "",
  "This is a server-side agent run, not General Chat. Return exactly one JSON object and no Markdown.",
  "The JSON object must be one of these shapes:",
  "",
  '{"schemaVersion":1,"type":"respond","message":"author-facing reply"}',
  "",
  '{"schemaVersion":1,"type":"request_tool","tool":"codex.create_entry","message":"short author-facing draft note","draft":{"categoryId":"character|location|object|lore|organization|plot-thread","name":"...","aliases":[],"description":"...","details":[{"label":"...","value":"..."}],"research":"..."}}',
  "",
  '{"schemaVersion":1,"type":"request_tool","tool":"codex.update_entry","message":"short author-facing update note","draft":{"target":{"entryId":"optional existing entry id","name":"existing entry name when id is unknown"},"patch":{"name":"optional new name","aliases":["optional replacement aliases"],"description":"optional replacement canon description","details":[{"label":"existing detail type label or new label needing confirmation","value":"..."}],"research":"source/evidence note","progressions":[{"action":"create","input":{"kind":"field","field":{"kind":"description"},"operation":"replace","body":"new effective text","summary":"short change summary","effectiveFromSceneId":"scene uuid","source":{"kind":"codex-page","sceneId":null,"blockId":null,"sourceId":null},"evidence":[]}},{"action":"update","progressionId":"existing progression id","input":{"baseRevision":"64 hex revision","body":"updated text"}},{"action":"delete","progressionId":"existing progression id","baseRevision":"64 hex revision"}]}}}',
  "",
  "Runtime rules:",
  "- Do not write Tool Call text. Tool calls are JSON agent steps consumed by the server.",
  "- Do not claim project files changed. Only tool result messages may say that.",
  "- If the author asks for a new Codex/story-memory entry and gives enough content or asks you to draft it, return request_tool with tool codex.create_entry.",
  "- If the author asks to modify, revise, update, expand, rename, or freely change an existing Codex/story-memory entry and identifies it by name or id, return request_tool with tool codex.update_entry.",
  "- codex.update_entry may update entry fields and may also create, update, or delete Codex progressions through patch.progressions. Use existing progressionId and baseRevision for update/delete. For progression create, include effectiveFromSceneId. If the progression targets the same Codex entry, entryId may be omitted and the server will bind it to the target entry.",
  "- Explicit author authorization, including freeform instructions such as '自由发挥', '随便', or '已授权', is sufficient source for drafting or updating story canon. Do not ask for external evidence merely because the story material is invented by the author.",
  "- If the requested update has a named target but no exact entry id is available, set draft.target.name and let the server resolve it.",
  "- Ask in respond only when the target entry is missing or ambiguous, the requested write is not a Codex entry create/update, or no supported patch can be drafted.",
  "- If no available tool fits, return respond.",
  "- Choose categoryId from the enum only. Use a category only when the author's intent clearly fits it; ask in respond when the category is ambiguous.",
  "- Treat explicit author decisions as draft content. Do not mark author-invented story material as external evidence.",
  "- Put source/evidence context in draft.research; use an author-decision note when the source is the current Agent conversation.",
].join("\n");

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
      message: "Agent did not return a valid structured step.",
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(objectText);
  } catch {
    return {
      schemaVersion: 1,
      type: "respond",
      message: "I need a structured response before continuing.",
    };
  }
  if (!parsed || typeof parsed !== "object") {
    return {
      schemaVersion: 1,
      type: "respond",
      message: "I need a structured response before continuing.",
    };
  }
  const step = parsed as Record<string, unknown>;
  if (step.schemaVersion !== 1) {
    return {
      schemaVersion: 1,
      type: "respond",
      message: "I need a structured response before continuing.",
    };
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
    message: asString(step.message) || "I need a structured response before continuing.",
  };
}

export function applyWorkshopAgentPrompt(prompt: ProviderPrompt): ProviderPrompt {
  return {
    ...prompt,
    instructions: [prompt.instructions, AGENT_PROTOCOL_PROMPT].filter(Boolean).join("\n\n"),
  };
}
