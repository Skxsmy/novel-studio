import type { ProviderToolCall, ProviderToolDefinition } from "@novel-studio/ai";
import type { WorkshopMode } from "@novel-studio/contracts";
import { researchRetrievalToolDefinitions } from "../researchToolGateway.js";
import { workshopAgentToolDefinitions } from "./workshopAgent.js";

export type WorkshopToolName =
  | "research.list_sources"
  | "research.search"
  | "research.open_passage"
  | "codex.create_entry"
  | "codex.update_entry";

export type WorkshopToolExecution = "automatic-read" | "author-confirmed-write";

export interface WorkshopToolPolicy {
  name: WorkshopToolName;
  modes: ReadonlyArray<Extract<WorkshopMode, "general-chat" | "agent">>;
  effect: "read" | "write";
  execution: WorkshopToolExecution;
  confirmation: "none" | "exact-author-confirmation";
  replay: "safe-with-current-budgets" | "never-without-authority-proof";
}

export const WORKSHOP_TOOL_POLICIES: readonly WorkshopToolPolicy[] = [
  {
    name: "research.list_sources",
    modes: ["general-chat", "agent"],
    effect: "read",
    execution: "automatic-read",
    confirmation: "none",
    replay: "safe-with-current-budgets",
  },
  {
    name: "research.search",
    modes: ["general-chat", "agent"],
    effect: "read",
    execution: "automatic-read",
    confirmation: "none",
    replay: "safe-with-current-budgets",
  },
  {
    name: "research.open_passage",
    modes: ["general-chat", "agent"],
    effect: "read",
    execution: "automatic-read",
    confirmation: "none",
    replay: "safe-with-current-budgets",
  },
  {
    name: "codex.create_entry",
    modes: ["agent"],
    effect: "write",
    execution: "author-confirmed-write",
    confirmation: "exact-author-confirmation",
    replay: "never-without-authority-proof",
  },
  {
    name: "codex.update_entry",
    modes: ["agent"],
    effect: "write",
    execution: "author-confirmed-write",
    confirmation: "exact-author-confirmation",
    replay: "never-without-authority-proof",
  },
] as const;

const policyByName = new Map(WORKSHOP_TOOL_POLICIES.map((policy) => [policy.name, policy]));

export function workshopToolPolicy(name: string): WorkshopToolPolicy | null {
  return policyByName.get(name as WorkshopToolName) ?? null;
}

export function workshopToolDefinitionsForStep(input: {
  mode: Extract<WorkshopMode, "general-chat" | "agent">;
  nativeToolCalls: boolean;
  activeDatabases: Array<{ id: string; name: string }>;
  allowResearchTools: boolean;
}): ProviderToolDefinition[] {
  if (!input.nativeToolCalls) return [];
  const definitions = [
    ...(input.mode === "agent" ? workshopAgentToolDefinitions() : []),
    ...(input.allowResearchTools
      ? researchRetrievalToolDefinitions(true, input.activeDatabases)
      : []),
  ];
  return definitions.filter((definition) => {
    const policy = workshopToolPolicy(definition.name);
    return Boolean(policy?.modes.includes(input.mode));
  });
}

export type WorkshopToolCallGuardDecision =
  | { action: "none" }
  | { action: "execute-read"; call: ProviderToolCall; policy: WorkshopToolPolicy }
  | { action: "request-confirmation"; call: ProviderToolCall; policy: WorkshopToolPolicy }
  | { action: "reject"; calls: ProviderToolCall[]; code: string; message: string };

export function guardWorkshopToolCalls(input: {
  mode: Extract<WorkshopMode, "general-chat" | "agent">;
  calls: ProviderToolCall[];
  availableToolNames: ReadonlySet<string>;
  unavailableToolReasons?: ReadonlyMap<string, { code: string; message: string }>;
}): WorkshopToolCallGuardDecision {
  if (input.calls.length === 0) return { action: "none" };
  if (input.calls.length > 1) {
    return {
      action: "reject",
      calls: input.calls,
      code: "PARALLEL_TOOL_CALLS_REJECTED",
      message: "Return exactly one ordered tool call. Automatic reads and author-confirmed writes cannot share one step.",
    };
  }

  const call = input.calls[0]!;
  const policy = workshopToolPolicy(call.name);
  if (!policy || !policy.modes.includes(input.mode) || !input.availableToolNames.has(call.name)) {
    const unavailableReason = policy?.modes.includes(input.mode)
      ? input.unavailableToolReasons?.get(call.name)
      : null;
    return {
      action: "reject",
      calls: [call],
      code: unavailableReason?.code ?? "TOOL_NOT_AVAILABLE",
      message: unavailableReason?.message ??
        "That tool is not available in the current Workshop mode and state. Use one declared tool or answer directly.",
    };
  }
  if (policy.execution === "automatic-read") return { action: "execute-read", call, policy };
  return { action: "request-confirmation", call, policy };
}

export function guardWorkshopToolResult(input: {
  call: ProviderToolCall;
  result: unknown;
}): { ok: true } | { ok: false; code: string; message: string } {
  const policy = workshopToolPolicy(input.call.name);
  if (!policy) {
    return { ok: false, code: "UNKNOWN_TOOL_RESULT", message: "The tool result has no Workshop policy." };
  }
  if (policy.execution !== "automatic-read") {
    return {
      ok: false,
      code: "WRITE_RESULT_REQUIRES_CONFIRMATION_PATH",
      message: "A write result cannot enter the automatic read continuation path.",
    };
  }
  if (!input.result || typeof input.result !== "object") {
    return { ok: false, code: "INVALID_TOOL_RESULT", message: "The Research tool returned an invalid result." };
  }
  const candidate = input.result as { ok?: unknown; tool?: unknown };
  if (typeof candidate.ok !== "boolean" || candidate.tool !== input.call.name) {
    return {
      ok: false,
      code: "TOOL_RESULT_IDENTITY_MISMATCH",
      message: "The Research tool result does not match the requested tool identity.",
    };
  }
  return { ok: true };
}
