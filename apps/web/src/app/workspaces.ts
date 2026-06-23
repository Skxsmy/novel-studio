export type WorkspaceId = "overview" | "plan" | "write" | "codex" | "workshop" | "review" | "settings";

export interface WorkspaceDefinition {
  id: WorkspaceId;
  label: string;
  shortLabel: string;
  description: string;
}

export const workspaces: WorkspaceDefinition[] = [
  {
    id: "overview",
    label: "Overview",
    shortLabel: "OV",
    description: "Project status and next actions",
  },
  {
    id: "plan",
    label: "Plan",
    shortLabel: "PL",
    description: "Structure, timing, and scene movement",
  },
  {
    id: "write",
    label: "Write",
    shortLabel: "WR",
    description: "Scene selection, manuscript, and save status",
  },
  {
    id: "codex",
    label: "Codex",
    shortLabel: "CD",
    description: "Characters, places, facts, and continuity",
  },
  {
    id: "workshop",
    label: "Workshop",
    shortLabel: "WS",
    description: "Assistant sessions and context baskets",
  },
  {
    id: "review",
    label: "Review",
    shortLabel: "RV",
    description: "Candidates, conflicts, and decisions",
  },
  {
    id: "settings",
    label: "Settings",
    shortLabel: "ST",
    description: "Models, roles, prompts, and defaults",
  },
];
