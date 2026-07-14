export const WORKSHOP_BUILT_IN_PROMPTS = {
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
} as const;

export const DEFAULT_WORKSHOP_GENERAL_CHAT_SYSTEM_PROMPT =
  WORKSHOP_BUILT_IN_PROMPTS["general-chat"].system;
