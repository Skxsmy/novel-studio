import {
  DefaultCodexEntryValues,
  type CodexCategoryDocument,
  type CodexCategoryId,
  type CodexEntryDocument,
} from "@novel-studio/contracts";

export type CodexTab = "details" | "research" | "relations" | "mentions" | "tracking";
export type CategoryFilter = "all" | CodexCategoryId;

export const codexText = {
  actions: {
    addCategory: "Add",
    addDetail: "Add Detail",
    addDetailType: "Add Type",
    addRelation: "Add Relation",
    archiveEntry: "Archive Entry",
    cancel: "Cancel",
    close: "Close",
    deleteCategory: "Delete",
    deleteEntry: "Delete Entry",
    deleteDetailType: "Delete",
    deleteRelation: "Delete",
    createCategory: "Create",
    creating: "Creating",
    hideDetails: "Hide details",
    manageDetailTypes: "Manage Types",
    newEntry: "New Entry",
    reload: "Reload",
    remove: "Remove",
    restoreEntry: "Restore Entry",
    save: "Save",
    showDetails: "Show details",
  },
  archive: {
    activeDescription: "Archive hides the entry from active lists and automatic mention/context indexing.",
    activeTitle: "Active entry",
    archivedDescription: "Archived entries stay on disk and can be restored.",
    archivedTitle: "Archived entry",
    deleteConfirmCopy: "This removes the entry and its research notes from disk.",
    deleteConfirmTitle: "Delete this entry?",
    deleteDescription: "Delete is permanent and is blocked if story-state records still reference the entry.",
    deleteTitle: "Delete entry",
  },
  aria: {
    detailSections: "Codex detail sections",
    entriesTable: "Codex entries",
    entryDetails: "Codex entry details",
    entryName: "Codex entry name",
    canonDescription: "Codex canon description",
    category: "Codex entry category",
    categoryCreateForm: "Create category",
    detailTypeCreateForm: "Create detail type",
    detailTypeManager: "Manage detail types",
    detailTypeManagerCategory: "Detail type manager category",
    researchNotes: "Codex research notes",
    newCategoryName: "New category name",
    newDetailTypeCategory: "New detail type category",
    newDetailTypeName: "New detail type name",
  },
  categories: {
    all: "All entries",
    builtIn: "Built-in",
    charactersPlacesFacts: "Characters, places, facts",
    custom: "Custom",
    deleteConfirmCopy: "Entries in this category move to Uncategorized.",
    deleteConfirmTitle: "Delete selected category?",
    doubleClickToRename: "Double-click to rename",
    namePlaceholder: "New category name",
    title: "Categories",
  },
  detail: {
    aliases: "Aliases",
    canonDescription: "Canon description",
    caseSensitive: "Case sensitive",
    category: "Category",
    contextPolicy: "Context policy",
    detailLabel: (index: number) => `Detail ${index} type`,
    detailValue: (index: number) => `Detail ${index} value`,
    details: "Details",
    detailCount: (count: number) => `${count} ${count === 1 ? "detail" : "details"}`,
    createDetailType: "Create type",
    detailTypeCategory: "Category",
    detailTypes: "Detail types",
    detailTypeInUse: (count: number) => `${count} ${count === 1 ? "entry" : "entries"}`,
    detailTypeName: "Type name",
    detailTypePlaceholder: "New type name",
    excludedTerms: "Excluded terms",
    englishPluralVariants: "English plural variants",
    labelPlaceholder: "Label",
    manageCategory: "Manage category",
    manageDetailTypesTitle: "Manage Detail Types",
    markNsfw: "NSFW detail type",
    matchAliases: "Match aliases",
    name: "Name",
    noDetails: "No details yet.",
    noDetailTypes: "No detail types yet.",
    nsfw: "NSFW",
    researchNotes: "Research notes",
    sendDetailToAi: "Send to AI",
    selectType: "Type",
    valuePlaceholder: "Detail",
  },
  empty: {
    loading: "Loading codex entries.",
    noEntries: "No codex entries yet.",
    noMatches: "No entries match this search.",
    noDescription: "No description",
  },
  errors: {
    archiveFailed: "Failed to archive codex entry",
    categoryDuplicate: (name: string) => `Category "${name}" already exists.`,
    categoryNameRequired: "Category name is required.",
    conflictArchive: "This entry changed on disk. Reload it before changing archive state.",
    conflictDeleteCategory: "This category changed on disk. Reload before deleting it.",
    conflictDeleteEntry: "This entry changed on disk. Reload it before deleting.",
    conflictSave: "This entry changed on disk. Reload it before saving again.",
    createCategoryFailed: "Failed to create category",
    createDetailTypeFailed: "Failed to create detail type",
    createFailed: "Failed to create codex entry",
    deleteCategoryFailed: "Failed to delete category",
    deleteDetailTypeFailed: "Failed to delete detail type",
    deleteEntryFailed: "Failed to delete codex entry",
    detailBlank: "Detail type is required.",
    detailDuplicate: (label: string) => `Detail "${label}" is duplicated.`,
    detailTypeDuplicate: (name: string) => `Detail type "${name}" already exists.`,
    detailTypeNameRequired: "Detail type name is required.",
    updateDetailTypeFailed: "Failed to update detail type",
    loadFailed: "Failed to load codex entries",
    loadConnectionsFailed: "Failed to load Codex connections",
    nameRequired: "Name is required.",
    reloadFailed: "Failed to reload codex entry",
    renameCategoryFailed: "Failed to rename category",
    restoreFailed: "Failed to restore codex entry",
    saveFailed: "Failed to save codex entry",
  },
  index: {
    editable: "Editable",
    searchPlaceholder: "Search name, alias, or detail",
    subtitle: "Click an entry to open details; click again to close.",
    title: "Entry Index",
  },
  policy: {
    always: "Always include",
    manual: "Manual only",
    never: "Never include",
    onMention: "When mentioned",
  },
  mentions: {
    ambiguous: "Ambiguous",
    codex: "Codex",
    count: (count: number) => `${count} ${count === 1 ? "mention" : "mentions"}`,
    emptyCodex: "No other Codex entries mention this entry yet.",
    emptyManuscript: "No manuscript mentions for this entry yet.",
    fieldCanon: "Canon description",
    fieldDetail: (label: string) => `Detail: ${label}`,
    fieldResearch: "Research notes",
    manuscript: "Manuscript",
    openScene: "Open",
    title: "Mentions",
  },
  relations: {
    archived: "Archived",
    confirmDelete: "Confirm Delete",
    description: "Description",
    direction: "Direction",
    empty: "No linked relations",
    evidence: "Evidence",
    relationType: "Relation type",
    subtitle: "Add connections to other entries to build a network of information.",
    target: "Target entry",
    title: "RELATIONS/CONNECTIONS",
    undirected: "Undirected",
  },
  tracking: {
    aiContext: "AI CONTEXT",
    always: "Always include this entry in the AI context.",
    alwaysHelp: "This entry is treated as global story memory.",
    detected: "Include when detected",
    detectedHelp: "This entry is added when its name or alias is detected.",
    disabledHelp: "Do not add this entry automatically when detected.",
    exclusions: "Exclusions",
    exclusionsHelp: "List phrases that should not match this entry when the entry name or any alias is a common word or phrase.",
    manual: "Do not include in the AI context when detected.",
    matching: "TRACKING/MATCHING",
    never: "Never include",
    neverHelp: "This entry will never be shown to the AI at all.",
    trackAliases: "Track this entry by name/alias.",
    useCase: "Use case-sensitive matching for names and aliases.",
    usePlural: "Use English plural variants.",
  },
  saveStatus: {
    archived: "Archived",
    conflict: "Conflict",
    dirty: "Unsaved changes",
    ready: "Ready",
    saved: "Saved",
    saving: "Saving",
  },
  table: {
    aliases: "Aliases",
    entry: "Entry",
    status: "Status",
    type: "Type",
  },
  title: "Codex",
  subtitle: "Browse story memory densely; open an entry only when details are needed.",
  showArchived: "Show archived",
  counts: (active: number, archived: number) => `${active} active / ${archived} archived`,
  listHint: "Select an entry to open its detail workspace.",
  commaPlaceholder: (label: string) => `Separate ${label} with commas`,
} as const;

export const codexTabs: Array<{ id: CodexTab; label: string }> = [
  { id: "details", label: "Details" },
  { id: "research", label: "Research" },
  { id: "relations", label: "Relations" },
  { id: "mentions", label: "Mentions" },
  { id: "tracking", label: "Tracking" },
];

const builtInCategoryLabels: Record<string, string> = {
  uncategorized: "Uncategorized",
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
  if (entry.metadata.aiContextPolicy === "never") return "Private";
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

export function commaList(values: string[]) {
  return values.join(", ");
}

export function parseCommaList(value: string) {
  const seen = new Set<string>();
  const parsed: string[] = [];
  for (const item of value.split(",")) {
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    parsed.push(trimmed);
  }
  return parsed;
}
