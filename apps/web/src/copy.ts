import type {
  CodexAiContextPolicy,
  CodexContextExclusionReason,
  CodexKnowledgeStance,
  CodexProgressionChangeKind,
  PlanningState,
  SceneSectionAiPolicy,
  SceneStatus,
} from "@novel-studio/contracts";

export const appName = "小说工作室";

export const codexPolicyLabels: Record<CodexAiContextPolicy, string> = {
  always: "始终可作为资料",
  "on-mention": "正文提到时可用",
  manual: "只在我选择时提供",
  never: "永不提供给模型",
};

export const sectionPolicyLabels: Record<SceneSectionAiPolicy, string> = {
  inherit: "跟随本次调用范围",
  "local-only": "只给本地模型",
  never: "永不提供给模型",
};

export const contextExclusionLabels: Record<CodexContextExclusionReason, string> = {
  "not-mentioned": "当前场景没有明确提到",
  "manual-only": "需要你主动选择",
  never: "已设为永不提供给模型",
  archived: "条目已归档",
};

export const progressionChangeLabels: Record<CodexProgressionChangeKind, string> = {
  addition: "追加事实",
  replacement: "替换此前状态",
};

export const knowledgeStanceLabels: Record<CodexKnowledgeStance, string> = {
  knows: "知道",
  believes: "相信",
  misunderstands: "误解",
};

export const sceneStatusLabels: Record<SceneStatus, string> = {
  idea: "想法",
  outlined: "已列大纲",
  draft: "草稿",
  revising: "修订中",
  final: "定稿",
  archived: "已归档",
};

export const planningStateLabels: Record<PlanningState, string> = {
  aligned: "与规划一致",
  "review-needed": "需要判断",
  "intentional-deviation": "有意偏离",
  "revise-prose": "正文待修订",
};

export function readableSceneStatus(status: SceneStatus): string {
  return sceneStatusLabels[status] ?? status;
}

export function readablePlanningState(state: PlanningState): string {
  return planningStateLabels[state] ?? state;
}
