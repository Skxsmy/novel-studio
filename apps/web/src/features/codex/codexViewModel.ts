import {
  DefaultCodexEntryValues,
  type CodexCategoryDocument,
  type CodexCategoryId,
  type CodexEntryDocument,
} from "@novel-studio/contracts";

export type CodexTab = "details" | "research" | "relations" | "mentions" | "tracking";
export type CategoryFilter = "all" | CodexCategoryId;

export const codexTabs: Array<{ id: CodexTab; label: string }> = [
  { id: "details", label: "Details" },
  { id: "research", label: "Research" },
  { id: "relations", label: "Relations" },
  { id: "mentions", label: "Mentions" },
  { id: "tracking", label: "Tracking" },
];

const builtInCategoryLabels: Record<string, string> = {
  character: "Character",
  location: "Location",
  object: "Object",
  lore: "Lore",
  organization: "Organization",
  "plot-thread": "Plot Thread",
};

export function categoryLabel(categoryId: string, categories: CodexCategoryDocument[]) {
  const category = categories.find((candidate) => candidate.category.id === categoryId)?.category;
  if (category?.builtIn) return builtInCategoryLabels[category.id] ?? category.name;
  return category?.name ?? categoryId;
}

export function statusLabel(entry: CodexEntryDocument) {
  if (entry.metadata.archivedAt) return "Archived";
  if (entry.metadata.aiContextPolicy === "always") return "Tracked";
  if (entry.metadata.aiContextPolicy === "manual") return "Manual";
  return "Open";
}

export function nextEntryName(entries: CodexEntryDocument[]) {
  const names = new Set(entries.map((entry) => entry.metadata.name));
  if (!names.has(DefaultCodexEntryValues.name)) return DefaultCodexEntryValues.name;
  for (let index = 2; index < 1000; index++) {
    const candidate = `${DefaultCodexEntryValues.name} ${index}`;
    if (!names.has(candidate)) return candidate;
  }
  return `${DefaultCodexEntryValues.name} ${entries.length + 1}`;
}

export function defaultEntryCategory(activeCategory: CategoryFilter): CodexCategoryId {
  return activeCategory === "all" ? DefaultCodexEntryValues.categoryId : activeCategory;
}
