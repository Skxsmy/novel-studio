import type { ProviderPrompt } from "@novel-studio/ai";
import {
  WORKSHOP_BUILT_IN_PROMPTS,
  type AiTaskKind,
  type WorkshopMode,
} from "@novel-studio/contracts";

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

export const WORKSHOP_PROMPTS: Record<WorkshopPromptMode, WorkshopPromptDefinition> =
  WORKSHOP_BUILT_IN_PROMPTS;

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
