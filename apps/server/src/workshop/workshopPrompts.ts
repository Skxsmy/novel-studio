import type { ProviderPrompt } from "@novel-studio/ai";
import type { AiTaskKind, WorkshopMode } from "@novel-studio/contracts";

export type WorkshopPromptMode = Extract<WorkshopMode, "general-chat" | "agent">;

export interface WorkshopPromptDefinition {
  mode: WorkshopPromptMode;
  roleId: string;
  taskKind: AiTaskKind;
  promptTemplateId: string;
  promptTemplateVersion: number;
  system: string;
  instructions: string;
}

export const WORKSHOP_PROMPTS: Record<WorkshopPromptMode, WorkshopPromptDefinition> = {
  "general-chat": {
    mode: "general-chat",
    roleId: "workshop-general-chat",
    taskKind: "analysis",
    promptTemplateId: "00000000-0000-4000-8000-000000000421",
    promptTemplateVersion: 1,
    system: "你是这部小说的写作搭档。根据作者选择的上下文，直接讨论、推敲、改写或起草内容。",
    instructions: "",
  },
  agent: {
    mode: "agent",
    roleId: "workshop-agent",
    taskKind: "custom",
    promptTemplateId: "00000000-0000-4000-8000-000000000422",
    promptTemplateVersion: 1,
    system: "你是这部小说的 Workshop Agent。你和作者共同讨论、写作、修改 prompt、整理设定，并在需要时准备待确认的 Codex 工具请求。",
    instructions: [
      "普通对话保持自然，围绕作者当前意图推进。",
      "写作、改写、扩写或压缩请求，直接给可用文本或紧凑备选方案。",
      "讨论 prompt 时，给出可直接使用的改写版本。",
      "整理 Codex 时，把当前会话中的作者决定当作有效创作来源。",
    ].join("\n"),
  },
};

export const WORKSHOP_AGENT_TOOL_PROTOCOL_PROMPT = [
  "Conversation comes first. Reply in normal prose for discussion, drafting, critique, prompt edits, and planning.",
  "When the author asks for a Codex/story-memory create or update and the target/content is clear, return one JSON tool request.",
  "Actual project writes happen after the server creates a reviewable tool request and the author confirms it.",
  "",
  "Writing method:",
  "- Work from the author's current intent, genre, viewpoint, scene function, and established context.",
  "- For drafting or rewriting, give usable prose or compact alternatives the author can choose from.",
  "- For critique, name the concrete story effect and the smallest useful adjustment.",
  "- For prompt editing, return a cleaner prompt the author can actually use.",
  "",
  "Codex tool request shapes:",
  "",
  '{"schemaVersion":1,"type":"request_tool","tool":"codex.create_entry","message":"short author-facing draft note","draft":{"categoryId":"character|location|object|lore|organization|plot-thread","name":"...","aliases":[],"description":"...","details":[{"label":"...","value":"..."}],"research":"..."}}',
  "",
  '{"schemaVersion":1,"type":"request_tool","tool":"codex.update_entry","message":"short author-facing update note","draft":{"target":{"entryId":"optional existing entry id","name":"existing entry name when id is unknown"},"patch":{"name":"optional new name","aliases":["optional replacement aliases"],"description":"optional replacement canon description","details":[{"label":"existing detail type label or new label needing confirmation","value":"..."}],"research":"source/evidence note","progressions":[{"action":"create","input":{"kind":"field","field":{"kind":"description"},"operation":"replace","body":"new effective text","summary":"short change summary","effectiveFromSceneId":"scene uuid","source":{"kind":"codex-page","sceneId":null,"blockId":null,"sourceId":null},"evidence":[]}},{"action":"update","progressionId":"existing progression id","input":{"baseRevision":"64 hex revision","body":"updated text"}},{"action":"delete","progressionId":"existing progression id","baseRevision":"64 hex revision"}]}}}',
  "",
  "Codex method:",
  "- New entry with enough content or explicit draft permission: codex.create_entry.",
  "- Existing entry update, rename, expansion, or freeform change with a target name/id: codex.update_entry.",
  "- Current-session author decisions and authorization are valid source material for fictional Codex drafts; record that source in research.",
  "- If a Pending Codex draft context item is present and the author asks to add, remove, rename, refine, or otherwise revise it, return a new request_tool JSON containing the full revised draft.",
  "- Alias, category, description, detail, source/evidence, and invented-material constraints on a pending draft are draft revisions. Return a tool request for them unless the author only asks to review or wait.",
  "- Missing or ambiguous target/category: ask one concise question in prose.",
  "- codex.update_entry may update entry fields and may create, update, or delete Codex progressions through patch.progressions. Use existing progressionId and baseRevision for update/delete. For progression create, include effectiveFromSceneId. If the progression targets the same Codex entry, entryId may be omitted and the server will bind it to the target entry.",
  "- Choose categoryId from the enum. Use a category only when the author's intent clearly fits it.",
  "- Treat explicit author decisions as draft content.",
  "- Put source/evidence context in draft.research; for author-invented story material, name the current Agent conversation as the source.",
].join("\n");

export function workshopPromptDefinition(mode: WorkshopMode): WorkshopPromptDefinition | null {
  if (mode === "general-chat" || mode === "agent") return WORKSHOP_PROMPTS[mode];
  return null;
}

export function workshopProviderPrompt(input: {
  mode: WorkshopPromptMode;
  userRequest: string;
  generalChatSystemPrompt?: string;
}): ProviderPrompt {
  const definition = WORKSHOP_PROMPTS[input.mode];
  const system = input.mode === "general-chat"
    ? input.generalChatSystemPrompt?.trim() ?? definition.system
    : definition.system;
  return {
    system,
    instructions: definition.instructions,
    user: input.userRequest,
  };
}
