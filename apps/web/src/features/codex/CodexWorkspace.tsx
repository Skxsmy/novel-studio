import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  DefaultCodexEntryValues,
  type CodexAiContextPolicy,
  type CodexCategoryDocument,
  type CodexCategoryId,
  type CodexDetailTypeDocument,
  type CodexEffectiveEntry,
  type CodexEntryDocument,
  type CodexFieldProgressionField,
  type CodexMention,
  type CodexProgressionDocument,
  type CodexMentionRules,
  type CodexRelationDocument,
  type CreateCodexRelationInput,
  type SceneDocument,
  type SeriesDetail,
  type UpdateCodexEntryInput,
} from "@novel-studio/contracts";
import { ApiError, api } from "../../api";
import {
  categoryLabel,
  codexTabs,
  codexText,
  commaList,
  defaultEntryCategory,
  nextEntryName,
  parseCommaList,
  statusLabel,
  type CategoryFilter,
  type CodexTab,
} from "./codexViewModel";
import { EditorSurface, type EditorSurfaceStatus } from "../editor";

interface CodexWorkspaceProps {
  onOpenScene?: (sceneId: string) => void;
  series: SeriesDetail;
}

type CodexSaveStatus = "idle" | "dirty" | "saving" | "saved" | "conflict" | "failed";
type MentionSource = "manuscript" | "codex";
type CodexRelationDirection = "outgoing" | "incoming" | "undirected";
const CODEX_AUTOSAVE_DELAY_MS = 1800;
interface DetailDraftRow {
  includeInAi: boolean;
  typeName: string;
  value: string;
}

interface CodexDraft {
  aiContextPolicy: CodexAiContextPolicy;
  aliases: string;
  baseResearchRevision: string;
  baseRevision: string;
  caseSensitive: boolean;
  categoryId: CodexCategoryId;
  automaticPlural: boolean;
  description: string;
  detailRows: DetailDraftRow[];
  excludedTerms: string;
  matchAliases: boolean;
  name: string;
  research: string;
}

interface RelationDraft {
  description: string;
  direction: CodexRelationDirection;
  evidence: string;
  targetEntryId: string;
  type: string;
}

interface HighlightSnippet {
  leading: boolean;
  range: { start: number; end: number };
  text: string;
  trailing: boolean;
}

interface CodexContentMention {
  fieldLabel: string;
  match: { start: number; end: number; matchedText: string; isAlias: boolean };
  snippet: HighlightSnippet;
  sourceEntry: CodexEntryDocument;
}

function matchingDetailType(
  key: string,
  detailTypes: CodexDetailTypeDocument[],
): CodexDetailTypeDocument | undefined {
  return detailTypes.find((document) =>
    document.detailType.id === key || document.detailType.name === key,
  );
}

function detailKeyLabel(key: string, detailTypes: CodexDetailTypeDocument[]) {
  return matchingDetailType(key, detailTypes)?.detailType.name ?? key;
}

function detailContextEnabled(entry: CodexEntryDocument, key: string, label: string) {
  return entry.metadata.detailAiContext[key] !== false && entry.metadata.detailAiContext[label] !== false;
}

function detailRowsFromEntry(
  entry: CodexEntryDocument,
  detailTypes: CodexDetailTypeDocument[],
): DetailDraftRow[] {
  const rows: DetailDraftRow[] = [];
  const handledKeys = new Set<string>();
  const entryDetailTypes = detailTypes.filter((document) =>
    document.detailType.categoryId === entry.metadata.categoryId,
  );
  for (const document of entryDetailTypes) {
    const { id, name } = document.detailType;
    const value = entry.metadata.details[id] ?? entry.metadata.details[name];
    if (value === undefined) continue;
    rows.push({
      includeInAi: detailContextEnabled(entry, id, name),
      typeName: name,
      value,
    });
    handledKeys.add(id);
    handledKeys.add(name);
  }
  for (const [key, value] of Object.entries(entry.metadata.details)) {
    if (handledKeys.has(key)) continue;
    const label = detailKeyLabel(key, detailTypes);
    rows.push({
      includeInAi: detailContextEnabled(entry, key, label),
      typeName: label,
      value,
    });
  }
  return rows;
}

function draftFromEntry(entry: CodexEntryDocument, detailTypes: CodexDetailTypeDocument[] = []): CodexDraft {
  return {
    aiContextPolicy: entry.metadata.aiContextPolicy,
    aliases: commaList(entry.metadata.aliases),
    automaticPlural: entry.metadata.mention.automaticPlural,
    baseResearchRevision: entry.research.revision,
    baseRevision: entry.revision,
    caseSensitive: entry.metadata.mention.caseSensitive,
    categoryId: entry.metadata.categoryId,
    description: entry.description,
    detailRows: detailRowsFromEntry(entry, detailTypes),
    excludedTerms: commaList(entry.metadata.mention.excludedTerms),
    matchAliases: entry.metadata.mention.matchAliases,
    name: entry.metadata.name,
    research: entry.research.content,
  };
}

function relationDraftFor(entryId: string | null, entries: CodexEntryDocument[]): RelationDraft {
  const targetEntry = entries.find((entry) => entry.metadata.id !== entryId && !entry.metadata.archivedAt);
  return {
    description: "",
    direction: "outgoing",
    evidence: "",
    targetEntryId: targetEntry?.metadata.id ?? "",
    type: "related",
  };
}

function sortEntries(entries: CodexEntryDocument[]) {
  return [...entries].sort((left, right) => left.metadata.name.localeCompare(right.metadata.name));
}

function formatCodexError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const payload = error.payload;
    if (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string") {
      return payload.message;
    }
    return `${fallback} (${error.status})`;
  }
  return error instanceof Error ? error.message : fallback;
}

function buildUpdateInput(draft: CodexDraft): UpdateCodexEntryInput {
  const name = draft.name.trim();
  if (!name) throw new Error(codexText.errors.nameRequired);

  const details: Record<string, string> = {};
  const detailAiContext: Record<string, boolean> = {};
  for (const row of draft.detailRows) {
    const typeName = row.typeName.trim();
    if (!typeName && !row.value.trim()) continue;
    if (!typeName) throw new Error(codexText.errors.detailBlank);
    if (details[typeName] !== undefined) throw new Error(codexText.errors.detailDuplicate(typeName));
    details[typeName] = row.value;
    detailAiContext[typeName] = row.includeInAi;
  }

  const mention: CodexMentionRules = {
    automaticPlural: draft.automaticPlural,
    caseSensitive: draft.caseSensitive,
    excludedTerms: parseCommaList(draft.excludedTerms),
    matchAliases: draft.matchAliases,
  };

  return {
    aiContextPolicy: draft.aiContextPolicy,
    aliases: parseCommaList(draft.aliases),
    baseResearchRevision: draft.baseResearchRevision,
    baseRevision: draft.baseRevision,
    categoryId: draft.categoryId,
    description: draft.description,
    details,
    detailAiContext,
    mention,
    name,
    research: draft.research,
  };
}

function codexDraftFingerprint(draft: CodexDraft) {
  return JSON.stringify(draft);
}

function pluralVariants(term: string) {
  if (!/^[A-Za-z]+$/.test(term)) return [];
  if (term.endsWith("y") && !/[aeiou]y$/i.test(term)) return [`${term.slice(0, -1)}ies`];
  if (/(s|x|z|ch|sh)$/i.test(term)) return [`${term}es`];
  return [`${term}s`];
}

function findTermStarts(content: string, term: string, caseSensitive: boolean) {
  if (!term) return [];
  const haystack = caseSensitive ? content : content.toLocaleLowerCase("und");
  const needle = caseSensitive ? term : term.toLocaleLowerCase("und");
  const starts: number[] = [];
  let cursor = haystack.indexOf(needle);
  while (cursor >= 0) {
    starts.push(cursor);
    cursor = haystack.indexOf(needle, cursor + Math.max(needle.length, 1));
  }
  return starts;
}

function buildTrackedTerms(entry: CodexEntryDocument) {
  const { mention } = entry.metadata;
  const excluded = new Set(
    mention.excludedTerms.map((term) =>
      mention.caseSensitive ? term.trim() : term.trim().toLocaleLowerCase("und"),
    ),
  );
  const baseTerms = [
    { term: entry.metadata.name, isAlias: false },
    ...(mention.matchAliases ? entry.metadata.aliases.map((term) => ({ term, isAlias: true })) : []),
  ];
  const seen = new Set<string>();
  const terms: Array<{ term: string; isAlias: boolean }> = [];
  for (const candidate of baseTerms) {
    for (const value of [candidate.term, ...(mention.automaticPlural ? pluralVariants(candidate.term) : [])]) {
      const term = value.trim();
      if (!term) continue;
      const key = mention.caseSensitive ? term : term.toLocaleLowerCase("und");
      if (excluded.has(key) || seen.has(`${key}:${candidate.isAlias}`)) continue;
      seen.add(`${key}:${candidate.isAlias}`);
      terms.push({ term, isAlias: candidate.isAlias });
    }
  }
  return terms.sort((left, right) => right.term.length - left.term.length);
}

function createSnippet(content: string, start: number, end: number): HighlightSnippet {
  const snippetStart = Math.max(0, start - 88);
  const snippetEnd = Math.min(content.length, end + 128);
  return {
    leading: snippetStart > 0,
    range: { start: start - snippetStart, end: end - snippetStart },
    text: content.slice(snippetStart, snippetEnd),
    trailing: snippetEnd < content.length,
  };
}

function renderHighlightedSnippet(snippet: HighlightSnippet, onOpenPreview?: () => void): ReactNode {
  const before = snippet.text.slice(0, snippet.range.start);
  const match = snippet.text.slice(snippet.range.start, snippet.range.end);
  const after = snippet.text.slice(snippet.range.end);
  return (
    <>
      {snippet.leading ? "..." : ""}
      {before}
      {onOpenPreview ? (
        <button className="codex-mention-mark" onClick={onOpenPreview} type="button">
          {match}
        </button>
      ) : (
        <mark className="codex-mention-mark">{match}</mark>
      )}
      {after}
      {snippet.trailing ? "..." : ""}
    </>
  );
}

function findMatchesInText(entry: CodexEntryDocument, content: string) {
  const { mention } = entry.metadata;
  const blockers = mention.excludedTerms.flatMap((term) =>
    findTermStarts(content, term.trim(), mention.caseSensitive).map((start) => ({
      start,
      end: start + term.trim().length,
    })),
  );
  const rawMatches = buildTrackedTerms(entry).flatMap((candidate) =>
    findTermStarts(content, candidate.term, mention.caseSensitive).map((start) => ({
      start,
      end: start + candidate.term.length,
      isAlias: candidate.isAlias,
      matchedText: content.slice(start, start + candidate.term.length),
    })),
  );
  const sorted = rawMatches
    .filter((match) => !blockers.some((blocker) => match.start >= blocker.start && match.end <= blocker.end))
    .sort((left, right) => left.start - right.start || (right.end - right.start) - (left.end - left.start));
  const matches: typeof rawMatches = [];
  let occupiedUntil = -1;
  for (const match of sorted) {
    if (match.start < occupiedUntil) continue;
    matches.push(match);
    occupiedUntil = match.end;
  }
  return matches;
}

function findCodexContentMentions(
  entry: CodexEntryDocument,
  entries: CodexEntryDocument[],
  detailTypes: CodexDetailTypeDocument[],
): CodexContentMention[] {
  const mentions: CodexContentMention[] = [];
  for (const sourceEntry of entries) {
    if (sourceEntry.metadata.id === entry.metadata.id || sourceEntry.metadata.archivedAt) continue;
    const sources = [
      { label: codexText.mentions.fieldCanon, content: sourceEntry.description },
      { label: codexText.mentions.fieldResearch, content: sourceEntry.research.content },
      ...Object.entries(sourceEntry.metadata.details).map(([label, content]) => ({
        label: codexText.mentions.fieldDetail(detailKeyLabel(label, detailTypes)),
        content,
      })),
    ];
    for (const source of sources) {
      if (!source.content.trim()) continue;
      for (const match of findMatchesInText(entry, source.content)) {
        mentions.push({
          fieldLabel: source.label,
          match,
          snippet: createSnippet(source.content, match.start, match.end),
          sourceEntry,
        });
      }
    }
  }
  return mentions;
}

function codexFieldKey(field: CodexFieldProgressionField) {
  return field.kind === "description" ? "description" : `detail:${field.detailTypeId}`;
}

function codexFieldLabel(field: CodexFieldProgressionField, detailTypes: CodexDetailTypeDocument[]) {
  if (field.kind === "description") return codexText.progressions.fieldDescription;
  const detailType = detailTypes.find((document) => document.detailType.id === field.detailTypeId)?.detailType;
  return codexText.progressions.fieldDetail(detailType?.name ?? codexText.progressions.fieldFallback);
}

function codexFieldValue(
  entry: CodexEntryDocument,
  field: CodexFieldProgressionField,
  detailTypes: CodexDetailTypeDocument[],
) {
  if (field.kind === "description") return entry.description;
  const detailType = detailTypes.find((document) => document.detailType.id === field.detailTypeId)?.detailType;
  return entry.metadata.details[field.detailTypeId] ?? (detailType ? entry.metadata.details[detailType.name] : undefined) ?? "";
}

function progressionSourceLabel(document: CodexProgressionDocument) {
  if (document.progression.source.kind === "write-block") return codexText.progressions.sourceWriteBlock;
  if (document.progression.source.kind === "codex-page") return codexText.progressions.sourceCodexPage;
  if (document.progression.source.kind === "proposal") return codexText.progressions.sourceProposal;
  return codexText.progressions.sourceUnknown;
}

function progressionOperationLabel(document: CodexProgressionDocument) {
  return document.progression.operation === "replace"
    ? codexText.progressions.operationReplace
    : codexText.progressions.operationAdd;
}

export function CodexWorkspace({ onOpenScene, series }: CodexWorkspaceProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [activeTab, setActiveTab] = useState<CodexTab>("details");
  const [activeMentionSource, setActiveMentionSource] = useState<MentionSource>("manuscript");
  const [draft, setDraft] = useState<CodexDraft | null>(null);
  const [entries, setEntries] = useState<CodexEntryDocument[]>([]);
  const [categories, setCategories] = useState<CodexCategoryDocument[]>([]);
  const [detailTypes, setDetailTypes] = useState<CodexDetailTypeDocument[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [entryMentions, setEntryMentions] = useState<CodexMention[]>([]);
  const [entryProgressions, setEntryProgressions] = useState<CodexProgressionDocument[]>([]);
  const [entryRelations, setEntryRelations] = useState<CodexRelationDocument[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [effectiveEntry, setEffectiveEntry] = useState<CodexEffectiveEntry | null>(null);
  const [isCategoryAddOpen, setIsCategoryAddOpen] = useState(false);
  const [isCategoryDeleteOpen, setIsCategoryDeleteOpen] = useState(false);
  const [isDeleteEntryOpen, setIsDeleteEntryOpen] = useState(false);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [isDetailTypeManagerOpen, setIsDetailTypeManagerOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isCreatingDetailType, setIsCreatingDetailType] = useState(false);
  const [isConnectionsLoading, setIsConnectionsLoading] = useState(false);
  const [isCreatingRelation, setIsCreatingRelation] = useState(false);
  const [isDetailFocus, setIsDetailFocus] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProgressionsLoading, setIsProgressionsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [detailTypeManagerCategoryId, setDetailTypeManagerCategoryId] = useState<CodexCategoryId>(DefaultCodexEntryValues.categoryId);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newDetailTypeCategoryId, setNewDetailTypeCategoryId] = useState<CodexCategoryId>(DefaultCodexEntryValues.categoryId);
  const [newDetailTypeName, setNewDetailTypeName] = useState("");
  const [newDetailTypeNsfw, setNewDetailTypeNsfw] = useState(false);
  const [previewEntry, setPreviewEntry] = useState<CodexEntryDocument | null>(null);
  const [progressionError, setProgressionError] = useState<string | null>(null);
  const [progressionSceneId, setProgressionSceneId] = useState(() => series.scenes[0]?.metadata.id ?? "");
  const [query, setQuery] = useState("");
  const [renamingCategory, setRenamingCategory] = useState<{ id: string; name: string; baseRevision: string } | null>(null);
  const [detailTypeDeleteId, setDetailTypeDeleteId] = useState<string | null>(null);
  const [relationDeleteId, setRelationDeleteId] = useState<string | null>(null);
  const [relationDraft, setRelationDraft] = useState<RelationDraft>(() => relationDraftFor(null, []));
  const [saveStatus, setSaveStatus] = useState<CodexSaveStatus>("idle");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [descriptionEditorStatus, setDescriptionEditorStatus] = useState<EditorSurfaceStatus | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const draftRef = useRef<CodexDraft | null>(draft);
  const selectedEntryIdRef = useRef<string | null>(selectedEntryId);

  draftRef.current = draft;
  selectedEntryIdRef.current = selectedEntryId;

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);
    setErrorMessage(null);
    setSelectedEntryId(null);
    setDraft(null);
    setActiveMentionSource("manuscript");
    setConnectionError(null);
    setEntryMentions([]);
    setEntryProgressions([]);
    setEntryRelations([]);
    setEffectiveEntry(null);
    setProgressionError(null);
    setIsProgressionsLoading(false);
    setProgressionSceneId(series.scenes[0]?.metadata.id ?? "");
    setPreviewEntry(null);
    setRelationDeleteId(null);
    setRelationDraft(relationDraftFor(null, []));
    setIsDetailsExpanded(false);
    setIsCategoryAddOpen(false);
    setIsCategoryDeleteOpen(false);
    setIsDeleteEntryOpen(false);
    setIsDetailTypeManagerOpen(false);
    setIsDetailFocus(false);
    setDetailTypeDeleteId(null);
    setRenamingCategory(null);
    setSaveStatus("idle");
    setActiveTab("details");

    Promise.all([
      api.codex.listCategories(series.manifest.id),
      api.codex.listDetailTypes(series.manifest.id),
      api.codex.listEntries(series.manifest.id, { includeArchived: showArchived }),
    ])
      .then(([nextCategories, nextDetailTypes, nextEntries]) => {
        if (!isActive) return;
        setCategories(nextCategories);
        setDetailTypes(nextDetailTypes);
        setEntries(sortEntries(nextEntries));
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        setErrorMessage(formatCodexError(error, codexText.errors.loadFailed));
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [series.manifest.id, showArchived]);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (!showArchived && entry.metadata.archivedAt) return false;
      if (activeCategory !== "all" && entry.metadata.categoryId !== activeCategory) return false;
      if (!normalizedQuery) return true;
      const haystack = [
        entry.metadata.name,
        entry.description,
        entry.research.content,
        ...entry.metadata.aliases,
        ...Object.values(entry.metadata.details),
      ].join("\n").toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [activeCategory, entries, query, showArchived]);

  const selectedEntry = selectedEntryId ? entries.find((entry) => entry.metadata.id === selectedEntryId) ?? null : null;
  const entryNameById = useMemo(() => new Map(entries.map((entry) => [entry.metadata.id, entry.metadata.name])), [entries]);
  const sceneById = useMemo(() => new Map(series.scenes.map((scene) => [scene.metadata.id, scene])), [series.scenes]);
  const sceneIndexById = useMemo(
    () => new Map(series.scenes.map((scene, index) => [scene.metadata.id, index])),
    [series.scenes],
  );
  const codexContentMentions = useMemo(
    () => (selectedEntry ? findCodexContentMentions(selectedEntry, entries, detailTypes) : []),
    [detailTypes, entries, selectedEntry],
  );
  const descriptionMentionEntries = useMemo(
    () => entries.filter((entry) => entry.metadata.id !== selectedEntryId && !entry.metadata.archivedAt),
    [entries, selectedEntryId],
  );
  const relationTargetEntries = useMemo(
    () => entries.filter((entry) => entry.metadata.id !== selectedEntryId && !entry.metadata.archivedAt),
    [entries, selectedEntryId],
  );
  const activeDetailTypes = useMemo(
    () => detailTypes.filter((document) => document.detailType.categoryId === draft?.categoryId),
    [detailTypes, draft?.categoryId],
  );
  const detailTypeNames = useMemo(() => {
    const names = new Set(activeDetailTypes.map((document) => document.detailType.name));
    for (const row of draft?.detailRows ?? []) {
      const typeName = row.typeName.trim();
      if (typeName) names.add(typeName);
    }
    return [...names].sort((left, right) => left.localeCompare(right, "zh-CN"));
  }, [activeDetailTypes, draft?.detailRows]);
  const managedDetailTypes = useMemo(
    () => detailTypes.filter((document) => document.detailType.categoryId === detailTypeManagerCategoryId),
    [detailTypes, detailTypeManagerCategoryId],
  );
  const sceneMentionCount = entryMentions.length;
  const selectedEntryRevision = selectedEntry?.revision ?? null;
  const selectedEntryDetailTypes = useMemo(
    () => detailTypes.filter((document) => document.detailType.categoryId === selectedEntry?.metadata.categoryId),
    [detailTypes, selectedEntry?.metadata.categoryId],
  );
  const progressionFields = useMemo(() => {
    const fields = new Map<string, CodexFieldProgressionField>();
    fields.set("description", { kind: "description", detailTypeId: null });
    const addField = (field: CodexFieldProgressionField | null | undefined) => {
      if (!field) return;
      fields.set(codexFieldKey(field), field);
    };
    for (const state of effectiveEntry?.fieldStates ?? []) addField(state.field);
    for (const document of entryProgressions) addField(document.progression.field);
    if (selectedEntry) {
      for (const detailType of selectedEntryDetailTypes) {
        const value = selectedEntry.metadata.details[detailType.detailType.id] ??
          selectedEntry.metadata.details[detailType.detailType.name];
        if (value !== undefined) {
          addField({ kind: "detail", detailTypeId: detailType.detailType.id });
        }
      }
    }
    return [...fields.values()];
  }, [effectiveEntry?.fieldStates, entryProgressions, selectedEntry, selectedEntryDetailTypes]);
  const effectiveFieldStateByKey = useMemo(
    () => new Map((effectiveEntry?.fieldStates ?? []).map((state) => [codexFieldKey(state.field), state])),
    [effectiveEntry?.fieldStates],
  );
  const progressionHistoryGroups = useMemo(() => {
    const sortedProgressions = [...entryProgressions]
      .filter((document) => document.progression.kind === "field" && document.progression.field)
      .sort((left, right) => {
        const leftSceneIndex = sceneIndexById.get(left.progression.effectiveFromSceneId) ?? Number.MAX_SAFE_INTEGER;
        const rightSceneIndex = sceneIndexById.get(right.progression.effectiveFromSceneId) ?? Number.MAX_SAFE_INTEGER;
        if (leftSceneIndex !== rightSceneIndex) return leftSceneIndex - rightSceneIndex;
        const leftScene = sceneById.get(left.progression.effectiveFromSceneId);
        const rightScene = sceneById.get(right.progression.effectiveFromSceneId);
        const leftBlockIndex = left.progression.source.kind === "write-block" && leftScene
          ? leftScene.document.blocks.findIndex((block) => block.id === left.progression.source.blockId)
          : -1;
        const rightBlockIndex = right.progression.source.kind === "write-block" && rightScene
          ? rightScene.document.blocks.findIndex((block) => block.id === right.progression.source.blockId)
          : -1;
        if (leftBlockIndex !== rightBlockIndex) return leftBlockIndex - rightBlockIndex;
        return left.progression.createdAt.localeCompare(right.progression.createdAt);
      });
    const groups = new Map<string, {
      field: CodexFieldProgressionField;
      items: CodexProgressionDocument[];
      label: string;
    }>();
    for (const document of sortedProgressions) {
      const field = document.progression.field;
      if (!field) continue;
      const key = codexFieldKey(field);
      const group = groups.get(key) ?? {
        field,
        items: [],
        label: codexFieldLabel(field, detailTypes),
      };
      group.items.push(document);
      groups.set(key, group);
    }
    return [...groups.values()];
  }, [detailTypes, entryProgressions, sceneById, sceneIndexById]);

  useEffect(() => {
    setProgressionSceneId((current) => {
      if (current && series.scenes.some((scene) => scene.metadata.id === current)) return current;
      return series.scenes[0]?.metadata.id ?? "";
    });
  }, [series.scenes]);

  useEffect(() => {
    if (!selectedEntryId) {
      setConnectionError(null);
      setEntryMentions([]);
      setEntryRelations([]);
      setPreviewEntry(null);
      setRelationDeleteId(null);
      setRelationDraft(relationDraftFor(null, entries));
      setIsConnectionsLoading(false);
      return;
    }
    let isActive = true;
    setConnectionError(null);
    setIsConnectionsLoading(true);
    Promise.all([
      api.codex.listEntryMentions(series.manifest.id, selectedEntryId),
      api.codex.listRelations(series.manifest.id, { entryId: selectedEntryId }),
    ])
      .then(([mentions, relations]) => {
        if (!isActive) return;
        setEntryMentions(mentions);
        setEntryRelations(relations);
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        setConnectionError(formatCodexError(error, codexText.errors.loadConnectionsFailed));
        setEntryMentions([]);
        setEntryRelations([]);
      })
      .finally(() => {
        if (isActive) setIsConnectionsLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, [series.manifest.id, selectedEntryId]);

  useEffect(() => {
    if (!selectedEntryId) {
      setEntryProgressions([]);
      setEffectiveEntry(null);
      setProgressionError(null);
      setIsProgressionsLoading(false);
      return;
    }
    const targetSceneId = progressionSceneId || series.scenes[0]?.metadata.id;
    if (!targetSceneId) {
      setEntryProgressions([]);
      setEffectiveEntry(null);
      setProgressionError(null);
      setIsProgressionsLoading(false);
      return;
    }
    let isActive = true;
    setProgressionError(null);
    setIsProgressionsLoading(true);
    Promise.all([
      api.codex.listProgressions(series.manifest.id, {
        entryId: selectedEntryId,
        kind: "field",
      }),
      api.codex.getEffectiveEntry(series.manifest.id, selectedEntryId, {
        sceneId: targetSceneId,
      }),
    ])
      .then(([progressions, effective]) => {
        if (!isActive) return;
        setEntryProgressions(progressions);
        setEffectiveEntry(effective);
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        setProgressionError(formatCodexError(error, codexText.errors.loadProgressionsFailed));
        setEntryProgressions([]);
        setEffectiveEntry(null);
      })
      .finally(() => {
        if (isActive) setIsProgressionsLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, [progressionSceneId, selectedEntryId, selectedEntryRevision, series.manifest.id, series.scenes]);

  useEffect(() => {
    setRelationDraft((current) => {
      if (current.targetEntryId && relationTargetEntries.some((entry) => entry.metadata.id === current.targetEntryId)) {
        return current;
      }
      return {
        ...current,
        targetEntryId: relationTargetEntries[0]?.metadata.id ?? "",
      };
    });
  }, [relationTargetEntries]);

  const countsByCategory = new Map<string, number>();
  for (const entry of entries.filter((candidate) => !candidate.metadata.archivedAt)) {
    countsByCategory.set(entry.metadata.categoryId, (countsByCategory.get(entry.metadata.categoryId) ?? 0) + 1);
  }
  const activeEntryCount = entries.filter((entry) => !entry.metadata.archivedAt).length;
  const archivedEntryCount = entries.length - activeEntryCount;
  const activeCategoryDocument = activeCategory === "all"
    ? null
    : categories.find(({ category }) => category.id === activeCategory) ?? null;
  const canDeleteActiveCategory = Boolean(
    activeCategoryDocument &&
    !activeCategoryDocument.category.builtIn &&
    !activeCategoryDocument.category.archivedAt &&
    activeCategoryDocument.revision,
  );

  function markDirty() {
    setSaveStatus("dirty");
    setErrorMessage(null);
  }

  function replaceEntry(entry: CodexEntryDocument) {
    setEntries((current) => {
      const exists = current.some((candidate) => candidate.metadata.id === entry.metadata.id);
      return sortEntries(exists
        ? current.map((candidate) => (candidate.metadata.id === entry.metadata.id ? entry : candidate))
        : [...current, entry]);
    });
  }

  function categoryNameExists(name: string, exceptCategoryId?: string) {
    const trimmed = name.trim();
    if (!trimmed) return false;
    return categories.some(({ category }) =>
      !category.archivedAt &&
      category.id !== exceptCategoryId &&
      (category.name === trimmed || categoryLabel(category.id, categories) === trimmed),
    );
  }

  function detailTypeNameExists(name: string, categoryId: CodexCategoryId) {
    const normalized = name.trim().toLocaleLowerCase("und");
    if (!normalized) return false;
    return detailTypes.some((document) =>
      document.detailType.categoryId === categoryId &&
      document.detailType.name.trim().toLocaleLowerCase("und") === normalized,
    );
  }

  function detailTypeUsageCount(detailType: CodexDetailTypeDocument) {
    const entryIds = new Set<string>();
    const { id, name } = detailType.detailType;
    for (const entry of entries) {
      if (
        entry.metadata.categoryId === detailType.detailType.categoryId &&
        (
          Object.prototype.hasOwnProperty.call(entry.metadata.details, id) ||
          Object.prototype.hasOwnProperty.call(entry.metadata.details, name)
        )
      ) {
        entryIds.add(entry.metadata.id);
      }
    }
    if (
      selectedEntryId &&
      draft?.categoryId === detailType.detailType.categoryId &&
      draft.detailRows.some((row) => {
        const typeName = row.typeName.trim();
        return typeName === id || typeName === name;
      })
    ) {
      entryIds.add(selectedEntryId);
    }
    return entryIds.size;
  }

  function syncEntryList(nextEntries: CodexEntryDocument[]) {
    const sortedEntries = sortEntries(nextEntries);
    setEntries(sortedEntries);
    if (!selectedEntryId) return;
    const nextSelectedEntry = sortedEntries.find((entry) => entry.metadata.id === selectedEntryId) ?? null;
    if (!nextSelectedEntry) {
      setSelectedEntryId(null);
      setDraft(null);
      setActiveMentionSource("manuscript");
      setConnectionError(null);
      setEntryMentions([]);
      setEntryRelations([]);
      setPreviewEntry(null);
      setRelationDeleteId(null);
      setRelationDraft(relationDraftFor(null, entries));
      setIsDetailsExpanded(false);
      setIsDetailTypeManagerOpen(false);
      setIsDetailFocus(false);
      setDetailTypeDeleteId(null);
      setSaveStatus("idle");
      return;
    }
    setDraft(draftFromEntry(nextSelectedEntry, detailTypes));
    setSaveStatus("idle");
  }

  function selectEntry(entry: CodexEntryDocument) {
    if (selectedEntryId === entry.metadata.id) {
      setSelectedEntryId(null);
      setDraft(null);
      setActiveMentionSource("manuscript");
      setConnectionError(null);
      setEntryMentions([]);
      setEntryRelations([]);
      setPreviewEntry(null);
      setIsDetailsExpanded(false);
      setIsDetailTypeManagerOpen(false);
      setIsDetailFocus(false);
      setDetailTypeDeleteId(null);
      setIsDeleteEntryOpen(false);
      setSaveStatus("idle");
      setActiveTab("details");
      return;
    }
    setSelectedEntryId(entry.metadata.id);
    setIsDetailFocus(false);
    setDraft(draftFromEntry(entry, detailTypes));
    setActiveMentionSource("manuscript");
    setConnectionError(null);
    setEntryMentions([]);
    setEntryRelations([]);
    setPreviewEntry(null);
    setRelationDeleteId(null);
    setRelationDraft(relationDraftFor(entry.metadata.id, entries));
    setIsDetailsExpanded(false);
    setIsDetailTypeManagerOpen(false);
    setDetailTypeDeleteId(null);
    setIsDeleteEntryOpen(false);
    setSaveStatus("idle");
    setActiveTab("details");
    setErrorMessage(null);
  }

  async function createEntry() {
    if (isCreating) return;
    setIsCreating(true);
    setErrorMessage(null);
    try {
      const entry = await api.codex.createEntry(series.manifest.id, {
        categoryId: defaultEntryCategory(activeCategory),
        name: nextEntryName(entries),
      });
      replaceEntry(entry);
      setSelectedEntryId(entry.metadata.id);
      setIsDetailFocus(false);
      setDraft(draftFromEntry(entry, detailTypes));
      setActiveMentionSource("manuscript");
      setConnectionError(null);
      setEntryMentions([]);
      setEntryRelations([]);
      setPreviewEntry(null);
      setRelationDeleteId(null);
      setRelationDraft(relationDraftFor(entry.metadata.id, entries));
      setIsDetailsExpanded(false);
      setIsDetailTypeManagerOpen(false);
      setDetailTypeDeleteId(null);
      setSaveStatus("idle");
      setActiveTab("details");
    } catch (error) {
      setErrorMessage(formatCodexError(error, codexText.errors.createFailed));
    } finally {
      setIsCreating(false);
    }
  }

  async function createCategory() {
    const name = newCategoryName.trim();
    if (!name || isCreatingCategory) return;
    if (categoryNameExists(name)) {
      setErrorMessage(codexText.errors.categoryDuplicate(name));
      return;
    }
    setIsCreatingCategory(true);
    setErrorMessage(null);
    try {
      const category = await api.codex.createCategory(series.manifest.id, { name });
      setCategories((current) => [...current, category]);
      setActiveCategory(category.category.id);
      setNewCategoryName("");
      setIsCategoryAddOpen(false);
    } catch (error) {
      setErrorMessage(formatCodexError(error, codexText.errors.createCategoryFailed));
    } finally {
      setIsCreatingCategory(false);
    }
  }

  async function createDetailType() {
    if (isCreatingDetailType) return;
    const name = newDetailTypeName.trim();
    if (!name) {
      setErrorMessage(codexText.errors.detailTypeNameRequired);
      return;
    }
    if (detailTypeNameExists(name, newDetailTypeCategoryId)) {
      setErrorMessage(codexText.errors.detailTypeDuplicate(name));
      return;
    }
    setIsCreatingDetailType(true);
    setErrorMessage(null);
    try {
      const detailType = await api.codex.createDetailType(series.manifest.id, {
        categoryId: newDetailTypeCategoryId,
        name,
        nsfw: newDetailTypeNsfw,
      });
      setDetailTypes((current) => [...current, detailType].sort((left, right) =>
        left.detailType.categoryId.localeCompare(right.detailType.categoryId, "zh-CN") ||
        left.detailType.name.localeCompare(right.detailType.name, "zh-CN"),
      ));
      setDetailTypeManagerCategoryId(detailType.detailType.categoryId);
      setNewDetailTypeName("");
      setNewDetailTypeNsfw(false);
    } catch (error) {
      setErrorMessage(formatCodexError(error, codexText.errors.createDetailTypeFailed));
    } finally {
      setIsCreatingDetailType(false);
    }
  }

  async function toggleDetailTypeNsfw(detailType: CodexDetailTypeDocument, nsfw: boolean) {
    if (isCreatingDetailType) return;
    setIsCreatingDetailType(true);
    setErrorMessage(null);
    try {
      const updated = await api.codex.updateDetailType(series.manifest.id, detailType.detailType.id, {
        baseRevision: detailType.revision,
        nsfw,
      });
      setDetailTypes((current) => current.map((document) =>
        document.detailType.id === updated.detailType.id ? updated : document,
      ));
    } catch (error) {
      setErrorMessage(formatCodexError(error, codexText.errors.updateDetailTypeFailed));
    } finally {
      setIsCreatingDetailType(false);
    }
  }

  async function deleteDetailType(detailType: CodexDetailTypeDocument) {
    if (isCreatingDetailType || detailTypeUsageCount(detailType) > 0) return;
    setIsCreatingDetailType(true);
    setErrorMessage(null);
    try {
      await api.codex.deleteDetailType(series.manifest.id, detailType.detailType.id, {
        baseRevision: detailType.revision,
      });
      setDetailTypes((current) => current.filter((document) => document.detailType.id !== detailType.detailType.id));
      setDetailTypeDeleteId(null);
    } catch (error) {
      setErrorMessage(formatCodexError(error, codexText.errors.deleteDetailTypeFailed));
    } finally {
      setIsCreatingDetailType(false);
    }
  }

  async function saveCategoryRename() {
    if (!renamingCategory || isCreatingCategory) return;
    const name = renamingCategory.name.trim();
    if (!name) {
      setErrorMessage(codexText.errors.categoryNameRequired);
      return;
    }
    if (categoryNameExists(name, renamingCategory.id)) {
      setErrorMessage(codexText.errors.categoryDuplicate(name));
      return;
    }
    setIsCreatingCategory(true);
    setErrorMessage(null);
    try {
      const category = await api.codex.updateCategory(series.manifest.id, renamingCategory.id, {
        baseRevision: renamingCategory.baseRevision,
        name,
      });
      setCategories((current) => current.map((candidate) => (
        candidate.category.id === category.category.id ? category : candidate
      )));
      setRenamingCategory(null);
    } catch (error) {
      setErrorMessage(formatCodexError(error, codexText.errors.renameCategoryFailed));
    } finally {
      setIsCreatingCategory(false);
    }
  }

  async function deleteSelectedCategory() {
    if (!activeCategoryDocument || !canDeleteActiveCategory || isCreatingCategory) return;
    const deletedCategoryId = activeCategoryDocument.category.id;
    setIsCreatingCategory(true);
    setErrorMessage(null);
    try {
      await api.codex.deleteCategory(series.manifest.id, deletedCategoryId, {
        baseRevision: activeCategoryDocument.revision!,
      });
      const nextEntries = await api.codex.listEntries(series.manifest.id, { includeArchived: showArchived });
      setCategories((current) => current.filter(({ category }) => category.id !== deletedCategoryId));
      syncEntryList(nextEntries);
      setActiveCategory("uncategorized");
      setIsCategoryDeleteOpen(false);
      setRenamingCategory(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setErrorMessage(codexText.errors.conflictDeleteCategory);
      } else {
        setErrorMessage(formatCodexError(error, codexText.errors.deleteCategoryFailed));
      }
    } finally {
      setIsCreatingCategory(false);
    }
  }

  async function saveEntry(entryToSave: CodexEntryDocument, draftToSave: CodexDraft) {
    if (isSaving || entryToSave.metadata.archivedAt) return;
    const submittedFingerprint = codexDraftFingerprint(draftToSave);
    setIsSaving(true);
    setSaveStatus("saving");
    setErrorMessage(null);
    try {
      const input = buildUpdateInput(draftToSave);
      const updated = await api.codex.updateEntry(series.manifest.id, entryToSave.metadata.id, input);
      replaceEntry(updated);
      if (selectedEntryIdRef.current === updated.metadata.id) {
        const currentDraft = draftRef.current;
        const hasUnsubmittedChanges = Boolean(
          currentDraft && codexDraftFingerprint(currentDraft) !== submittedFingerprint,
        );
        const nextDraft = hasUnsubmittedChanges && currentDraft
          ? {
              ...currentDraft,
              baseResearchRevision: updated.research.revision,
              baseRevision: updated.revision,
            }
          : draftFromEntry(updated, detailTypes);
        draftRef.current = nextDraft;
        setDraft(nextDraft);
        setSaveStatus(hasUnsubmittedChanges ? "dirty" : "saved");
      }
    } catch (error) {
      if (selectedEntryIdRef.current === entryToSave.metadata.id) {
        if (error instanceof ApiError && error.status === 409) {
          setSaveStatus("conflict");
          setErrorMessage(codexText.errors.conflictSave);
        } else {
          setSaveStatus("failed");
          setErrorMessage(formatCodexError(error, codexText.errors.saveFailed));
        }
      }
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    if (!selectedEntry || !draft || selectedEntry.metadata.archivedAt || isSaving || saveStatus !== "dirty") return;
    const timer = window.setTimeout(() => {
      void saveEntry(selectedEntry, draft);
    }, CODEX_AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draft, isSaving, saveStatus, selectedEntry]);

  async function reloadSelectedEntry() {
    if (!selectedEntryId) return;
    setErrorMessage(null);
    try {
      const entry = await api.codex.getEntry(series.manifest.id, selectedEntryId);
      replaceEntry(entry);
      setDraft(draftFromEntry(entry, detailTypes));
      setIsDetailsExpanded(false);
      setSaveStatus("idle");
    } catch (error) {
      setErrorMessage(formatCodexError(error, codexText.errors.reloadFailed));
    }
  }

  async function setArchived(archived: boolean) {
    if (!selectedEntry || isSaving) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const entry = archived
        ? await api.codex.archiveEntry(series.manifest.id, selectedEntry.metadata.id, { baseRevision: selectedEntry.revision })
        : await api.codex.restoreEntry(series.manifest.id, selectedEntry.metadata.id, { baseRevision: selectedEntry.revision });
      replaceEntry(entry);
      setDraft(draftFromEntry(entry, detailTypes));
      setIsDetailsExpanded(false);
      setSaveStatus("idle");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setSaveStatus("conflict");
        setErrorMessage(codexText.errors.conflictArchive);
      } else {
        setSaveStatus("failed");
        setErrorMessage(formatCodexError(error, archived ? codexText.errors.archiveFailed : codexText.errors.restoreFailed));
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteEntry() {
    if (!selectedEntry || isSaving) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await api.codex.deleteEntry(series.manifest.id, selectedEntry.metadata.id, {
        baseRevision: selectedEntry.revision,
      });
      setEntries((current) => current.filter((entry) => entry.metadata.id !== selectedEntry.metadata.id));
      setSelectedEntryId(null);
      setDraft(null);
      setActiveMentionSource("manuscript");
      setConnectionError(null);
      setEntryMentions([]);
      setEntryRelations([]);
      setPreviewEntry(null);
      setRelationDeleteId(null);
      setRelationDraft(relationDraftFor(null, entries));
      setIsDetailsExpanded(false);
      setIsDetailTypeManagerOpen(false);
      setIsDetailFocus(false);
      setDetailTypeDeleteId(null);
      setIsDeleteEntryOpen(false);
      setSaveStatus("idle");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setSaveStatus("conflict");
        setErrorMessage(codexText.errors.conflictDeleteEntry);
      } else {
        setSaveStatus("failed");
        setErrorMessage(formatCodexError(error, codexText.errors.deleteEntryFailed));
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function createRelation() {
    if (!selectedEntry || !relationDraft.targetEntryId || !relationDraft.type.trim() || isCreatingRelation) return;
    setIsCreatingRelation(true);
    setConnectionError(null);
    const selectedId = selectedEntry.metadata.id;
    const input: CreateCodexRelationInput = {
      description: relationDraft.description,
      directed: relationDraft.direction !== "undirected",
      evidence: relationDraft.evidence,
      sourceEntryId: relationDraft.direction === "incoming" ? relationDraft.targetEntryId : selectedId,
      targetEntryId: relationDraft.direction === "incoming" ? selectedId : relationDraft.targetEntryId,
      type: relationDraft.type.trim(),
      validFromSceneId: null,
      validToSceneId: null,
    };
    try {
      const relation = await api.codex.createRelation(series.manifest.id, input);
      setEntryRelations((current) => [...current, relation]);
      setRelationDraft(relationDraftFor(selectedId, entries));
    } catch (error) {
      setConnectionError(formatCodexError(error, codexText.errors.loadConnectionsFailed));
    } finally {
      setIsCreatingRelation(false);
    }
  }

  async function deleteRelation(document: CodexRelationDocument) {
    if (isCreatingRelation) return;
    setIsCreatingRelation(true);
    setConnectionError(null);
    try {
      await api.codex.archiveRelation(series.manifest.id, document.relation.id, {
        baseRevision: document.revision,
      });
      setEntryRelations((current) => current.filter((candidate) => candidate.relation.id !== document.relation.id));
      setRelationDeleteId(null);
    } catch (error) {
      setConnectionError(formatCodexError(error, codexText.errors.loadConnectionsFailed));
    } finally {
      setIsCreatingRelation(false);
    }
  }

  function updateDraft(mutator: (current: CodexDraft) => CodexDraft) {
    setDraft((current) => {
      const next = current ? mutator(current) : current;
      draftRef.current = next;
      return next;
    });
    markDirty();
  }

  function addDetailRow() {
    if (!draft) return;
    const used = new Set(draft.detailRows.map((row) => row.typeName.trim()).filter(Boolean));
    const nextTypeName = activeDetailTypes.find((document) => !used.has(document.detailType.name))?.detailType.name;
    if (!nextTypeName) {
      setIsDetailsExpanded(true);
      setDetailTypeManagerCategoryId(draft.categoryId);
      setNewDetailTypeCategoryId(draft.categoryId);
      setIsDetailTypeManagerOpen(true);
      return;
    }
    setIsDetailsExpanded(true);
    updateDraft((current) => ({
      ...current,
      detailRows: [...current.detailRows, { includeInAi: true, typeName: nextTypeName, value: "" }],
    }));
  }

  const fieldsDisabled = Boolean(selectedEntry?.metadata.archivedAt);
  const descriptionSelectionCount = descriptionEditorStatus
    ? Math.abs(descriptionEditorStatus.selectionTo - descriptionEditorStatus.selectionFrom)
    : 0;
  const saveStatusText = selectedEntry?.metadata.archivedAt
    ? codexText.saveStatus.archived
    : saveStatus === "conflict"
        ? codexText.saveStatus.conflict
        : saveStatus === "failed"
          ? codexText.saveStatus.failed
          : "";

  return (
    <>
      <div className="page-head">
        <div>
          <h2 className="page-title">{codexText.title}</h2>
          <p className="page-subtitle">{codexText.subtitle}</p>
        </div>
        <div className="top-actions">
          <button className="btn primary" disabled={isCreating} onClick={() => void createEntry()} type="button">
            {isCreating ? codexText.actions.creating : codexText.actions.newEntry}
          </button>
        </div>
      </div>
      <div className={`codex-grid${selectedEntry ? " detail-open" : ""}${isDetailFocus ? " is-detail-focus" : ""}`}>
        <aside className="panel no-shadow">
          <div className="panel-head">
            <div>
              <div className="panel-title">{codexText.categories.title}</div>
              <div className="panel-kicker">{codexText.counts(activeEntryCount, archivedEntryCount)}</div>
            </div>
            <div className="structure-head-actions codex-category-actions">
              <button
                className="btn structure-delete-trigger"
                disabled={!canDeleteActiveCategory || isCreatingCategory}
                onClick={() => {
                  setIsCategoryAddOpen(false);
                  setIsCategoryDeleteOpen((value) => !value);
                }}
                type="button"
              >
                {codexText.actions.deleteCategory}
              </button>
              <button
                className="btn structure-add-trigger"
                disabled={isCreatingCategory}
                onClick={() => {
                  setIsCategoryDeleteOpen(false);
                  setIsCategoryAddOpen((value) => !value);
                }}
                type="button"
              >
                {codexText.actions.addCategory}
              </button>
              {isCategoryAddOpen ? (
                <form
                  aria-label={codexText.aria.categoryCreateForm}
                  className="structure-add-menu category-add-menu"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void createCategory();
                  }}
                >
                  <input
                    aria-label={codexText.aria.newCategoryName}
                    autoFocus
                    className="input compact-input"
                    disabled={isCreatingCategory}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    placeholder={codexText.categories.namePlaceholder}
                    value={newCategoryName}
                  />
                  <button className="btn compact primary" disabled={isCreatingCategory || !newCategoryName.trim()} type="submit">
                    {codexText.actions.createCategory}
                  </button>
                </form>
              ) : null}
              {isCategoryDeleteOpen && activeCategoryDocument && canDeleteActiveCategory ? (
                <div className="structure-confirm-menu" aria-label={codexText.categories.deleteConfirmTitle}>
                  <div className="confirm-title">{codexText.categories.deleteConfirmTitle}</div>
                  <div className="confirm-copy">{categoryLabel(activeCategoryDocument.category.id, categories)}</div>
                  <div className="confirm-copy">{codexText.categories.deleteConfirmCopy}</div>
                  <div className="confirm-actions">
                    <button className="btn compact" onClick={() => setIsCategoryDeleteOpen(false)} type="button">
                      {codexText.actions.cancel}
                    </button>
                    <button
                      className="btn compact danger"
                      disabled={isCreatingCategory}
                      onClick={() => void deleteSelectedCategory()}
                      type="button"
                    >
                      {codexText.actions.deleteCategory}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <div className="panel-body taxonomy-list">
            <button
              className={`taxonomy-item${activeCategory === "all" ? " is-active" : ""}`}
                onClick={() => {
                  setActiveCategory("all");
                  setIsCategoryDeleteOpen(false);
                }}
                type="button"
              >
                <div>
                  <div className="row-title">{codexText.categories.all}</div>
                  <div className="row-meta">{codexText.categories.charactersPlacesFacts}</div>
                </div>
              <span className="pill">{activeEntryCount}</span>
            </button>
            {categories.map(({ category, revision: categoryRevision }) => {
              const label = categoryLabel(category.id, categories);
              const isRenaming = renamingCategory?.id === category.id;
              if (isRenaming) {
                return (
                  <div className={`taxonomy-item category-rename-row${activeCategory === category.id ? " is-active" : ""}`} key={category.id}>
                    <input
                      aria-label={`Rename ${label}`}
                      autoFocus
                      className="input structure-rename-input"
                      disabled={isCreatingCategory}
                      onChange={(event) => setRenamingCategory({
                        ...renamingCategory,
                        name: event.target.value,
                      })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void saveCategoryRename();
                        if (event.key === "Escape") setRenamingCategory(null);
                      }}
                      value={renamingCategory.name}
                    />
                    <div className="structure-rename-actions">
                      <button className="btn compact" disabled={isCreatingCategory} onClick={() => void saveCategoryRename()} type="button">
                        {codexText.actions.save}
                      </button>
                      <button className="btn compact" onClick={() => setRenamingCategory(null)} type="button">
                        {codexText.actions.cancel}
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <button
                  className={`taxonomy-item${activeCategory === category.id ? " is-active" : ""}`}
                  key={category.id}
                  onClick={() => {
                    setActiveCategory(category.id);
                    setIsCategoryDeleteOpen(false);
                  }}
                  onDoubleClick={() => {
                    if (!category.builtIn && categoryRevision) {
                      setRenamingCategory({ id: category.id, name: category.name, baseRevision: categoryRevision });
                    }
                  }}
                  title={category.builtIn ? undefined : codexText.categories.doubleClickToRename}
                  type="button"
                >
                  <div>
                    <div className="row-title">{label}</div>
                    <div className="row-meta">{category.builtIn ? codexText.categories.builtIn : codexText.categories.custom}</div>
                  </div>
                  <span className="pill">{countsByCategory.get(category.id) ?? 0}</span>
                </button>
              );
            })}
            <label className="checkbox-row">
              <input
                checked={showArchived}
                onChange={(event) => {
                  setShowArchived(event.target.checked);
                  if (!event.target.checked && selectedEntry?.metadata.archivedAt) {
                    setSelectedEntryId(null);
                    setDraft(null);
                    setIsDetailFocus(false);
                    setSaveStatus("idle");
                  }
                }}
                type="checkbox"
              />
              <span>{codexText.showArchived}</span>
            </label>
          </div>
        </aside>
        <section className="panel no-shadow codex-index">
          <div className="panel-head">
            <div>
              <div className="panel-title">{codexText.index.title}</div>
              <div className="panel-kicker">{codexText.index.subtitle}</div>
            </div>
            <span className="pill green">{codexText.index.editable}</span>
          </div>
          <div className="panel-body">
            {errorMessage ? <p className="alert">{errorMessage}</p> : null}
            <div className="codex-toolbar">
              <input
                className="input"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={codexText.index.searchPlaceholder}
                value={query}
              />
            </div>
            {isLoading ? (
              <div className="detail-empty">{codexText.empty.loading}</div>
            ) : filteredEntries.length > 0 ? (
              <div className="codex-table" role="table" aria-label={codexText.aria.entriesTable}>
                <div className="codex-table-head" role="row">
                  <span>{codexText.table.entry}</span>
                  <span>{codexText.table.type}</span>
                  <span>{codexText.table.aliases}</span>
                  <span>{codexText.table.status}</span>
                </div>
                {filteredEntries.map((entry) => (
                  <button
                    className={`codex-row${selectedEntryId === entry.metadata.id ? " is-active" : ""}`}
                    key={entry.metadata.id}
                    onClick={() => selectEntry(entry)}
                    role="row"
                    type="button"
                  >
                    <span>
                      <strong>{entry.metadata.name}</strong>
                      <small>{entry.description || codexText.empty.noDescription}</small>
                    </span>
                    <span>{categoryLabel(entry.metadata.categoryId, categories)}</span>
                    <span>{entry.metadata.aliases.length}</span>
                    <span className="pill">{statusLabel(entry)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="detail-empty">{query.trim() ? codexText.empty.noMatches : codexText.empty.noEntries}</div>
            )}
          </div>
        </section>
        {selectedEntry && draft ? (
          <section className="panel no-shadow codex-detail" aria-label={codexText.aria.entryDetails}>
            <div>
              <div className="entry-hero">
                <div>
                  <div className="entry-type">{categoryLabel(selectedEntry.metadata.categoryId, categories)}</div>
                  <h3 className="entry-title">{draft.name || selectedEntry.metadata.name}</h3>
                </div>
                <div className="entry-avatar">{(draft.name || selectedEntry.metadata.name).slice(0, 2).toUpperCase()}</div>
              </div>
              <div className="entry-mention-strip">
                <strong>{codexText.mentions.count(sceneMentionCount)}</strong>
              </div>
              <div className="entry-meta-line">
                {saveStatusText ? <span>{saveStatusText}</span> : <span aria-hidden="true" />}
                <div className="top-actions">
                  <button
                    aria-pressed={isDetailFocus}
                    className="btn compact"
                    onClick={() => setIsDetailFocus((current) => !current)}
                    type="button"
                  >
                    {isDetailFocus ? codexText.actions.browseEntries : codexText.actions.focusEdit}
                  </button>
                  <button className="btn compact" onClick={() => void reloadSelectedEntry()} type="button">{codexText.actions.reload}</button>
                </div>
              </div>
              <div className="codex-tabs" role="tablist" aria-label={codexText.aria.detailSections}>
                {codexTabs.map((tab) => (
                  <button
                    aria-selected={activeTab === tab.id}
                    className={`codex-tab${activeTab === tab.id ? " is-active" : ""}`}
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    role="tab"
                    type="button"
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            {errorMessage ? <p className="alert codex-detail-alert">{errorMessage}</p> : null}
            <div className={`codex-tab-panel${activeTab === "details" ? " is-active" : ""}`} role="tabpanel">
              <div className="detail-form-grid">
                <label className="field">
                  <span>{codexText.detail.name}</span>
                  <input
                    aria-label={codexText.aria.entryName}
                    className="input"
                    disabled={fieldsDisabled}
                    onChange={(event) => updateDraft((current) => ({ ...current, name: event.target.value }))}
                    value={draft.name}
                  />
                </label>
                <label className="field">
                  <span>{codexText.detail.category}</span>
                  <select
                    aria-label={codexText.aria.category}
                    className="select"
                    disabled={fieldsDisabled}
                    onChange={(event) => updateDraft((current) => ({
                      ...current,
                      categoryId: event.target.value as CodexCategoryId,
                    }))}
                    value={draft.categoryId}
                  >
                    {categories
                      .filter(({ category }) => !category.archivedAt || category.id === draft.categoryId)
                      .map(({ category }) => (
                        <option key={category.id} value={category.id}>
                          {categoryLabel(category.id, categories)}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="field wide">
                  <span>{codexText.detail.aliases}</span>
                  <input
                    className="input"
                    disabled={fieldsDisabled}
                    onChange={(event) => updateDraft((current) => ({ ...current, aliases: event.target.value }))}
                    placeholder={codexText.commaPlaceholder("aliases")}
                    value={draft.aliases}
                  />
                </label>
                <div className="field wide">
                  <span>{codexText.detail.canonDescription}</span>
                  <div className="inline-mention-shell canon-description-shell">
                    <EditorSurface
                      ariaLabel={codexText.aria.canonDescription}
                      className={`canon-description-editor${fieldsDisabled ? " is-disabled" : ""}`}
                      codexEntries={descriptionMentionEntries}
                      emptyPreviewText={codexText.empty.noDescription}
                      onChange={(value) => updateDraft((current) => ({ ...current, description: value }))}
                      onStateChange={setDescriptionEditorStatus}
                      placeholder={codexText.empty.noDescription}
                      readOnly={fieldsDisabled}
                      value={draft.description}
                    />
                    {descriptionEditorStatus ? (
                      <div className="editor-status-row">
                        <span>{`${descriptionEditorStatus.characterCount} chars / ${descriptionEditorStatus.lineCount} lines`}</span>
                        <span>{`Ln ${descriptionEditorStatus.line}, Col ${descriptionEditorStatus.column}`}</span>
                        {descriptionSelectionCount > 0 ? <span>{`${descriptionSelectionCount} selected`}</span> : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="detail-section">
                <div className="detail-section-head">
                  <button
                    aria-expanded={isDetailsExpanded}
                    aria-label={isDetailsExpanded ? codexText.actions.hideDetails : codexText.actions.showDetails}
                    className="detail-section-toggle"
                    onClick={() => setIsDetailsExpanded((current) => !current)}
                    type="button"
                  >
                    <span>{codexText.detail.details}</span>
                    <span className="pill">{codexText.detail.detailCount(draft.detailRows.length)}</span>
                  </button>
                  <div className="detail-section-actions">
                    <button
                      className="btn compact"
                      disabled={fieldsDisabled}
                      onClick={() => {
                        setDetailTypeDeleteId(null);
                        setDetailTypeManagerCategoryId(draft.categoryId);
                        setNewDetailTypeCategoryId(draft.categoryId);
                        setIsDetailTypeManagerOpen(true);
                      }}
                      type="button"
                    >
                      {codexText.actions.manageDetailTypes}
                    </button>
                    <button className="btn compact" disabled={fieldsDisabled} onClick={addDetailRow} type="button">
                      {codexText.actions.addDetail}
                    </button>
                  </div>
                </div>
                {isDetailsExpanded ? (
                  <div className="detail-section-body">
                    {draft.detailRows.length > 0 ? (
                      draft.detailRows.map((row, index) => (
                        <div className="detail-row" key={`${index}-${row.typeName}`}>
                          <div className="detail-row-controls">
                            <label className="field detail-type-select-field">
                              <span>{codexText.detail.selectType}</span>
                              <select
                                aria-label={codexText.detail.detailLabel(index + 1)}
                                className="select"
                                disabled={fieldsDisabled}
                                onChange={(event) => updateDraft((current) => ({
                                  ...current,
                                  detailRows: current.detailRows.map((candidate, rowIndex) => (
                                    rowIndex === index ? { ...candidate, typeName: event.target.value } : candidate
                                  )),
                                }))}
                                value={row.typeName}
                              >
                                {detailTypeNames.map((typeName) => (
                                  <option key={typeName} value={typeName}>
                                    {typeName}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="switch-line detail-ai-toggle">
                              <input
                                checked={row.includeInAi}
                                disabled={fieldsDisabled}
                                onChange={(event) => updateDraft((current) => ({
                                  ...current,
                                  detailRows: current.detailRows.map((candidate, rowIndex) => (
                                    rowIndex === index ? { ...candidate, includeInAi: event.target.checked } : candidate
                                  )),
                                }))}
                                type="checkbox"
                              />
                              <span>{codexText.detail.sendDetailToAi}</span>
                            </label>
                            <button
                              className="btn compact"
                              disabled={fieldsDisabled}
                              onClick={() => updateDraft((current) => ({
                                ...current,
                                detailRows: current.detailRows.filter((_, rowIndex) => rowIndex !== index),
                              }))}
                              type="button"
                            >
                              {codexText.actions.remove}
                            </button>
                          </div>
                          <div className="inline-mention-shell detail-value-shell">
                            <EditorSurface
                              ariaLabel={codexText.detail.detailValue(index + 1)}
                              className={`detail-value-editor${fieldsDisabled ? " is-disabled" : ""}`}
                              codexEntries={descriptionMentionEntries}
                              emptyPreviewText={codexText.empty.noDescription}
                              onChange={(value) => updateDraft((current) => ({
                                ...current,
                                detailRows: current.detailRows.map((candidate, rowIndex) => (
                                  rowIndex === index ? { ...candidate, value } : candidate
                                )),
                              }))}
                              placeholder={codexText.detail.valuePlaceholder}
                              readOnly={fieldsDisabled}
                              value={row.value}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="detail-empty compact-empty">{codexText.detail.noDetails}</div>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="entry-lifecycle-grid">
                <div className="archive-box">
                  <div>
                    <div className="panel-title">{selectedEntry.metadata.archivedAt ? codexText.archive.archivedTitle : codexText.archive.activeTitle}</div>
                    <div className="panel-kicker">
                      {selectedEntry.metadata.archivedAt
                        ? codexText.archive.archivedDescription
                        : codexText.archive.activeDescription}
                    </div>
                  </div>
                  {selectedEntry.metadata.archivedAt ? (
                    <button className="btn primary" disabled={isSaving} onClick={() => void setArchived(false)} type="button">
                      {codexText.actions.restoreEntry}
                    </button>
                  ) : (
                    <button className="btn danger" disabled={isSaving || saveStatus === "dirty"} onClick={() => void setArchived(true)} type="button">
                      {codexText.actions.archiveEntry}
                    </button>
                  )}
                </div>
                <div className="archive-box danger-zone">
                  <div>
                    <div className="panel-title">{codexText.archive.deleteTitle}</div>
                    <div className="panel-kicker">{codexText.archive.deleteDescription}</div>
                  </div>
                  {isDeleteEntryOpen ? (
                    <div className="inline-confirm">
                      <div>
                        <div className="confirm-title">{codexText.archive.deleteConfirmTitle}</div>
                        <div className="confirm-copy">{codexText.archive.deleteConfirmCopy}</div>
                      </div>
                      <div className="confirm-actions">
                        <button className="btn compact" onClick={() => setIsDeleteEntryOpen(false)} type="button">
                          {codexText.actions.cancel}
                        </button>
                        <button
                          className="btn compact danger"
                          disabled={isSaving}
                          onClick={() => void deleteEntry()}
                          type="button"
                        >
                          {codexText.actions.deleteEntry}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button className="btn danger" disabled={isSaving || saveStatus === "dirty"} onClick={() => setIsDeleteEntryOpen(true)} type="button">
                      {codexText.actions.deleteEntry}
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className={`codex-tab-panel${activeTab === "progressions" ? " is-active" : ""}`} role="tabpanel">
              {activeTab === "progressions" ? (
              <section className="codex-progressions-panel">
                <div className="codex-progressions-head">
                  <div>
                    <h4>{codexText.progressions.title}</h4>
                    <p>{codexText.progressions.changes(entryProgressions.length)}</p>
                  </div>
                  {series.scenes.length > 0 ? (
                    <label className="field progression-scene-field">
                      <span>{codexText.progressions.sceneLabel}</span>
                      <select
                        aria-label={codexText.aria.progressionScene}
                        className="select"
                        onChange={(event) => setProgressionSceneId(event.target.value)}
                        value={progressionSceneId}
                      >
                        {series.scenes.map((scene) => (
                          <option key={scene.metadata.id} value={scene.metadata.id}>
                            {scene.metadata.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>
                {progressionError ? <p className="alert">{progressionError}</p> : null}
                {!series.scenes.length ? (
                  <div className="detail-empty compact-empty">{codexText.progressions.emptyScene}</div>
                ) : isProgressionsLoading ? (
                  <div className="detail-empty compact-empty">{codexText.progressions.loading}</div>
                ) : (
                  <>
                    {effectiveEntry && effectiveEntry.hiddenFutureFieldProgressionCount > 0 ? (
                      <p className="mini-note progression-future-note">
                        {codexText.progressions.hiddenFuture(effectiveEntry.hiddenFutureFieldProgressionCount)}
                      </p>
                    ) : null}
                    <div className="codex-progressions-compare">
                      <section className="progression-state-card">
                        <h5>{codexText.progressions.baselineTitle}</h5>
                        {progressionFields.map((field) => {
                          const value = selectedEntry
                            ? codexFieldValue(selectedEntry, field, selectedEntryDetailTypes)
                            : "";
                          return (
                            <div className="progression-field-state" key={`baseline-${codexFieldKey(field)}`}>
                              <span>{codexFieldLabel(field, selectedEntryDetailTypes)}</span>
                              <p>{value.trim() ? value : codexText.progressions.emptyValue}</p>
                            </div>
                          );
                        })}
                      </section>
                      <section className="progression-state-card">
                        <h5>{codexText.progressions.effectiveTitle}</h5>
                        {progressionFields.map((field) => {
                          const key = codexFieldKey(field);
                          const state = effectiveFieldStateByKey.get(key);
                          const value = effectiveEntry
                            ? codexFieldValue(effectiveEntry.entry, field, selectedEntryDetailTypes)
                            : selectedEntry
                              ? codexFieldValue(selectedEntry, field, selectedEntryDetailTypes)
                              : "";
                          return (
                            <div className="progression-field-state" key={`effective-${key}`}>
                              <div>
                                <span>{codexFieldLabel(field, selectedEntryDetailTypes)}</span>
                                <span className="pill">
                                  {state?.source === "progression"
                                    ? codexText.progressions.stateProgression
                                    : codexText.progressions.stateBaseline}
                                </span>
                              </div>
                              <p>{value.trim() ? value : codexText.progressions.emptyValue}</p>
                              {state && state.hiddenFutureCount > 0 ? (
                                <small>{codexText.progressions.hiddenFuture(state.hiddenFutureCount)}</small>
                              ) : null}
                            </div>
                          );
                        })}
                      </section>
                    </div>
                    <section className="codex-progression-history">
                      <div className="detail-section-head">
                        <h5>{codexText.progressions.historyTitle}</h5>
                      </div>
                      {progressionHistoryGroups.length ? (
                        progressionHistoryGroups.map((group) => (
                          <div className="progression-history-group" key={codexFieldKey(group.field)}>
                            <div className="progression-history-group-head">
                              <strong>{group.label}</strong>
                              <span className="pill">{codexText.progressions.changes(group.items.length)}</span>
                            </div>
                            {group.items.map((document) => {
                              const sourceSceneId = document.progression.source.sceneId ?? document.progression.effectiveFromSceneId;
                              const sourceScene = sceneById.get(sourceSceneId);
                              const sourceTitle = sourceScene?.metadata.title ?? sceneById.get(document.progression.effectiveFromSceneId)?.metadata.title;
                              return (
                                <article className="progression-history-card" key={document.progression.id}>
                                  <div className="progression-history-card-head">
                                    <div>
                                      <strong>{document.progression.summary || group.label}</strong>
                                      <div className="row-meta progression-history-meta">
                                        <span>{progressionOperationLabel(document)}</span>
                                        <span>{progressionSourceLabel(document)}</span>
                                        {sourceTitle ? <span>{sourceTitle}</span> : null}
                                      </div>
                                    </div>
                                    {onOpenScene && sourceScene ? (
                                      <button
                                        className="btn compact"
                                        onClick={() => onOpenScene(sourceScene.metadata.id)}
                                        type="button"
                                      >
                                        {codexText.progressions.openScene}
                                      </button>
                                    ) : null}
                                  </div>
                                  <p>{document.progression.body.trim() ? document.progression.body : codexText.progressions.emptyValue}</p>
                                </article>
                              );
                            })}
                          </div>
                        ))
                      ) : (
                        <div className="detail-empty compact-empty">{codexText.progressions.emptyHistory}</div>
                      )}
                    </section>
                  </>
                )}
              </section>
              ) : null}
            </div>
            <div className={`codex-tab-panel${activeTab === "research" ? " is-active" : ""}`} role="tabpanel">
              <label className="field codex-research-field">
                <span>{codexText.detail.researchNotes}</span>
                <textarea
                  aria-label={codexText.aria.researchNotes}
                  className="textarea codex-research-textarea"
                  disabled={fieldsDisabled}
                  onChange={(event) => updateDraft((current) => ({ ...current, research: event.target.value }))}
                  rows={10}
                  value={draft.research}
                />
              </label>
            </div>
            <div className={`codex-tab-panel${activeTab === "relations" ? " is-active" : ""}`} role="tabpanel">
              <section className="connection-panel">
                <div className="connection-heading">
                  <h4>{codexText.relations.title}</h4>
                  <p>{codexText.relations.subtitle}</p>
                </div>
                <div className="relation-editor">
                  <label className="field">
                    <span>{codexText.relations.target}</span>
                    <select
                      className="select"
                      disabled={fieldsDisabled || isCreatingRelation || !relationTargetEntries.length}
                      onChange={(event) => setRelationDraft((current) => ({ ...current, targetEntryId: event.target.value }))}
                      value={relationDraft.targetEntryId}
                    >
                      {relationTargetEntries.map((entry) => (
                        <option key={entry.metadata.id} value={entry.metadata.id}>
                          {entry.metadata.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>{codexText.relations.relationType}</span>
                    <input
                      className="input"
                      disabled={fieldsDisabled || isCreatingRelation}
                      onChange={(event) => setRelationDraft((current) => ({ ...current, type: event.target.value }))}
                      value={relationDraft.type}
                    />
                  </label>
                  <label className="field">
                    <span>{codexText.relations.direction}</span>
                    <select
                      className="select"
                      disabled={fieldsDisabled || isCreatingRelation}
                      onChange={(event) => setRelationDraft((current) => ({
                        ...current,
                        direction: event.target.value as CodexRelationDirection,
                      }))}
                      value={relationDraft.direction}
                    >
                      <option value="outgoing">{selectedEntry.metadata.name} -&gt; target</option>
                      <option value="incoming">target -&gt; {selectedEntry.metadata.name}</option>
                      <option value="undirected">{codexText.relations.undirected}</option>
                    </select>
                  </label>
                  <label className="field wide">
                    <span>{codexText.relations.description}</span>
                    <textarea
                      className="textarea compact-textarea"
                      disabled={fieldsDisabled || isCreatingRelation}
                      onChange={(event) => setRelationDraft((current) => ({ ...current, description: event.target.value }))}
                      rows={2}
                      value={relationDraft.description}
                    />
                  </label>
                  <label className="field wide">
                    <span>{codexText.relations.evidence}</span>
                    <textarea
                      className="textarea compact-textarea"
                      disabled={fieldsDisabled || isCreatingRelation}
                      onChange={(event) => setRelationDraft((current) => ({ ...current, evidence: event.target.value }))}
                      rows={2}
                      value={relationDraft.evidence}
                    />
                  </label>
                  <div className="relation-editor-actions">
                    <button
                      className="btn primary"
                      disabled={fieldsDisabled || isCreatingRelation || !relationDraft.targetEntryId || !relationDraft.type.trim()}
                      onClick={() => void createRelation()}
                      type="button"
                    >
                      {codexText.actions.addRelation}
                    </button>
                  </div>
                </div>
                {connectionError ? <p className="alert">{connectionError}</p> : null}
                {isConnectionsLoading ? (
                  <div className="detail-empty compact-empty">{codexText.empty.loading}</div>
                ) : entryRelations.length ? (
                  <div className="relation-list">
                    {entryRelations.map((document) => {
                      const relation = document.relation;
                      const isSource = relation.sourceEntryId === selectedEntry.metadata.id;
                      const sourceName = entryNameById.get(relation.sourceEntryId) ?? relation.sourceEntryId;
                      const targetName = entryNameById.get(relation.targetEntryId) ?? relation.targetEntryId;
                      const direction = relation.directed ? (isSource ? "->" : "<-") : "--";
                      const counterpartName = isSource ? targetName : sourceName;
                      return (
                        <article className="relation-card" key={relation.id}>
                          <div className="relation-card-head">
                            <div>
                              <div className="row-title">{relation.type}</div>
                              <div className="row-meta">{selectedEntry.metadata.name} {direction} {counterpartName}</div>
                            </div>
                            <span className="pill">{relation.directed ? direction : codexText.relations.undirected}</span>
                          </div>
                          {relation.description ? <p>{relation.description}</p> : null}
                          {relation.evidence ? <p className="mini-note">{relation.evidence}</p> : null}
                          {relation.archivedAt ? <span className="pill amber">{codexText.relations.archived}</span> : null}
                          <div className="relation-card-actions">
                            {relationDeleteId === relation.id ? (
                              <>
                                <button className="btn compact danger" disabled={isCreatingRelation} onClick={() => void deleteRelation(document)} type="button">
                                  {codexText.relations.confirmDelete}
                                </button>
                                <button className="btn compact" disabled={isCreatingRelation} onClick={() => setRelationDeleteId(null)} type="button">
                                  {codexText.actions.cancel}
                                </button>
                              </>
                            ) : (
                              <button className="btn compact danger" disabled={isCreatingRelation} onClick={() => setRelationDeleteId(relation.id)} type="button">
                                {codexText.actions.deleteRelation}
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="relation-empty">{codexText.relations.empty}</div>
                )}
              </section>
            </div>
            <div className={`codex-tab-panel${activeTab === "mentions" ? " is-active" : ""}`} role="tabpanel">
              <section className="mentions-panel">
                <div className="mention-source-tabs" role="tablist" aria-label={codexText.mentions.title}>
                  <button
                    aria-selected={activeMentionSource === "manuscript"}
                    className={`mention-source-tab${activeMentionSource === "manuscript" ? " is-active" : ""}`}
                    onClick={() => setActiveMentionSource("manuscript")}
                    type="button"
                  >
                    {codexText.mentions.manuscript} <span>{entryMentions.length}</span>
                  </button>
                  <button
                    aria-selected={activeMentionSource === "codex"}
                    className={`mention-source-tab${activeMentionSource === "codex" ? " is-active" : ""}`}
                    onClick={() => setActiveMentionSource("codex")}
                    type="button"
                  >
                    {codexText.mentions.codex} <span>{codexContentMentions.length}</span>
                  </button>
                </div>
                {previewEntry ? (
                  <aside className="codex-preview-popover" aria-label={`${previewEntry.metadata.name} canon description`}>
                    <div className="codex-preview-head">
                      <div>
                        <div className="row-meta">{categoryLabel(previewEntry.metadata.categoryId, categories)}</div>
                        <strong>{previewEntry.metadata.name}</strong>
                      </div>
                      <button className="btn compact" onClick={() => setPreviewEntry(null)} type="button">
                        {codexText.actions.cancel}
                      </button>
                    </div>
                    <p>{previewEntry.description || codexText.empty.noDescription}</p>
                  </aside>
                ) : null}
                {connectionError ? <p className="alert">{connectionError}</p> : null}
                {isConnectionsLoading ? (
                  <div className="detail-empty compact-empty">{codexText.empty.loading}</div>
                ) : activeMentionSource === "manuscript" ? (
                  entryMentions.length ? (
                    <div className="mention-list">
                      {[...new Set(entryMentions.map((mention) => mention.sceneId))].map((mentionSceneId) => {
                        const scene = sceneById.get(mentionSceneId);
                        const sceneMentions = entryMentions.filter((mention) => mention.sceneId === mentionSceneId);
                        return (
                          <article className="mention-card" key={mentionSceneId}>
                            <div className="mention-card-head">
                              <strong>{scene?.metadata.title ?? mentionSceneId}</strong>
                              {onOpenScene ? (
                                <button className="btn compact" onClick={() => onOpenScene(mentionSceneId)} type="button">
                                  {codexText.mentions.openScene}
                                </button>
                              ) : null}
                            </div>
                            {sceneMentions.map((mention) => {
                              const content = scene?.content || mention.matchedText;
                              const snippet = scene?.content
                                ? createSnippet(content, mention.start, mention.end)
                                : createSnippet(content, 0, mention.matchedText.length);
                              return (
                                <p className="mention-snippet" key={`${mention.sceneId}-${mention.start}-${mention.end}`}>
                                  {renderHighlightedSnippet(snippet, () => setPreviewEntry(selectedEntry))}
                                </p>
                              );
                            })}
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="detail-empty compact-empty">{codexText.mentions.emptyManuscript}</div>
                  )
                ) : codexContentMentions.length ? (
                  <div className="mention-list">
                    {codexContentMentions.map((mention, index) => (
                      <article className="mention-card" key={`${mention.sourceEntry.metadata.id}-${mention.match.start}-${index}`}>
                        <div className="mention-card-head">
                          <div>
                            <strong>{mention.sourceEntry.metadata.name}</strong>
                            <div className="row-meta">{mention.fieldLabel}</div>
                          </div>
                        </div>
                        <p className="mention-snippet">
                          {renderHighlightedSnippet(mention.snippet, () => setPreviewEntry(selectedEntry))}
                        </p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="detail-empty compact-empty">{codexText.mentions.emptyCodex}</div>
                )}
              </section>
            </div>
            <div className={`codex-tab-panel${activeTab === "tracking" ? " is-active" : ""}`} role="tabpanel">
              <div className="tracking-panel">
                <section className="tracking-section">
                  <h4>{codexText.tracking.matching} <span className="help-dot">?</span></h4>
                  <label className="tracking-check-row">
                    <input
                      checked={draft.matchAliases}
                      disabled={fieldsDisabled}
                      onChange={(event) => updateDraft((current) => ({ ...current, matchAliases: event.target.checked }))}
                      type="checkbox"
                    />
                    <span>{codexText.tracking.trackAliases}</span>
                  </label>
                  <label className="tracking-check-row">
                    <input
                      checked={draft.caseSensitive}
                      disabled={fieldsDisabled}
                      onChange={(event) => updateDraft((current) => ({ ...current, caseSensitive: event.target.checked }))}
                      type="checkbox"
                    />
                    <span>{codexText.tracking.useCase}</span>
                  </label>
                  <label className="tracking-check-row">
                    <input
                      checked={draft.automaticPlural}
                      disabled={fieldsDisabled}
                      onChange={(event) => updateDraft((current) => ({ ...current, automaticPlural: event.target.checked }))}
                      type="checkbox"
                    />
                    <span>{codexText.tracking.usePlural}</span>
                  </label>
                  <label className="field tracking-exclusions">
                    <span>{codexText.tracking.exclusions}</span>
                    <small>{codexText.tracking.exclusionsHelp}</small>
                    <textarea
                      className="textarea compact-textarea"
                      disabled={fieldsDisabled}
                      onChange={(event) => updateDraft((current) => ({ ...current, excludedTerms: event.target.value }))}
                      placeholder={codexText.commaPlaceholder("exclusions")}
                      rows={3}
                      value={draft.excludedTerms}
                    />
                  </label>
                </section>
                <section className="tracking-section ai-context-section">
                  <h4>{codexText.tracking.aiContext} <span className="help-dot">?</span></h4>
                  {[
                    { id: "always" as const, label: codexText.tracking.always, help: codexText.tracking.alwaysHelp },
                    { id: "on-mention" as const, label: codexText.tracking.detected, help: codexText.tracking.detectedHelp },
                    { id: "manual" as const, label: codexText.tracking.manual, help: codexText.tracking.disabledHelp },
                    { id: "never" as const, label: codexText.tracking.never, help: codexText.tracking.neverHelp },
                  ].map((option) => (
                    <label className="context-radio-row" key={option.id}>
                      <input
                        checked={draft.aiContextPolicy === option.id}
                        disabled={fieldsDisabled}
                        name="codex-ai-context-policy"
                        onChange={() => updateDraft((current) => ({ ...current, aiContextPolicy: option.id }))}
                        type="radio"
                      />
                      <span>
                        <strong>{option.label}</strong>
                        {option.id === "on-mention" ? <em>Default</em> : null}
                        <small>{option.help}</small>
                      </span>
                    </label>
                  ))}
                </section>
              </div>
            </div>
          </section>
        ) : null}
      </div>
      {isDetailTypeManagerOpen ? (
        <div className="codex-modal-backdrop" role="presentation">
          <section
            aria-label={codexText.aria.detailTypeManager}
            aria-modal="true"
            className="codex-detail-type-dialog"
            role="dialog"
          >
            <header className="codex-modal-head">
              <div>
                <div className="panel-kicker">{codexText.detail.detailTypes}</div>
                <h3>{codexText.detail.manageDetailTypesTitle}</h3>
              </div>
              <button
                className="btn compact"
                disabled={isCreatingDetailType}
                onClick={() => {
                  setDetailTypeDeleteId(null);
                  setIsDetailTypeManagerOpen(false);
                }}
                type="button"
              >
                {codexText.actions.close}
              </button>
            </header>
            <div className="detail-type-dialog-grid">
              <form
                aria-label={codexText.aria.detailTypeCreateForm}
                className="detail-type-create-panel"
                onSubmit={(event) => {
                  event.preventDefault();
                  void createDetailType();
                }}
              >
                <div className="panel-title">{codexText.detail.createDetailType}</div>
                <label className="field">
                  <span>{codexText.detail.detailTypeName}</span>
                  <input
                    aria-label={codexText.aria.newDetailTypeName}
                    className="input"
                    disabled={fieldsDisabled || isCreatingDetailType}
                    onChange={(event) => setNewDetailTypeName(event.target.value)}
                    placeholder={codexText.detail.detailTypePlaceholder}
                    value={newDetailTypeName}
                  />
                </label>
                <label className="field">
                  <span>{codexText.detail.detailTypeCategory}</span>
                  <select
                    aria-label={codexText.aria.newDetailTypeCategory}
                    className="select"
                    disabled={fieldsDisabled || isCreatingDetailType}
                    onChange={(event) => {
                      const categoryId = event.target.value as CodexCategoryId;
                      setNewDetailTypeCategoryId(categoryId);
                      setDetailTypeManagerCategoryId(categoryId);
                    }}
                    value={newDetailTypeCategoryId}
                  >
                    {categories
                      .filter(({ category }) => !category.archivedAt)
                      .map(({ category }) => (
                        <option key={category.id} value={category.id}>
                          {categoryLabel(category.id, categories)}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="switch-line nsfw-switch">
                  <input
                    checked={newDetailTypeNsfw}
                    disabled={fieldsDisabled || isCreatingDetailType}
                    onChange={(event) => setNewDetailTypeNsfw(event.target.checked)}
                    type="checkbox"
                  />
                  <span>{codexText.detail.markNsfw}</span>
                </label>
                <button
                  className="btn primary"
                  disabled={fieldsDisabled || isCreatingDetailType || !newDetailTypeName.trim()}
                  type="submit"
                >
                  {codexText.actions.addDetailType}
                </button>
              </form>
              <section className="detail-type-list-panel">
                <div className="detail-type-list-toolbar">
                  <label className="field compact-field">
                    <span>{codexText.detail.manageCategory}</span>
                    <select
                      aria-label={codexText.aria.detailTypeManagerCategory}
                      className="select"
                      disabled={isCreatingDetailType}
                      onChange={(event) => setDetailTypeManagerCategoryId(event.target.value as CodexCategoryId)}
                      value={detailTypeManagerCategoryId}
                    >
                      {categories
                        .filter(({ category }) => !category.archivedAt)
                        .map(({ category }) => (
                          <option key={category.id} value={category.id}>
                            {categoryLabel(category.id, categories)}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                {managedDetailTypes.length ? (
                  <div className="detail-type-dialog-list">
                    {managedDetailTypes.map((detailType) => {
                      const usageCount = detailTypeUsageCount(detailType);
                      const isConfirmingDelete = detailTypeDeleteId === detailType.detailType.id;
                      return (
                        <article className="detail-type-dialog-row" key={detailType.detailType.id}>
                          <div>
                            <strong>{detailType.detailType.name}</strong>
                            <div className="row-meta">
                              {categoryLabel(detailType.detailType.categoryId, categories)}
                              {" · "}
                              {codexText.detail.detailTypeInUse(usageCount)}
                            </div>
                          </div>
                          <label className="switch-line nsfw-switch">
                            <input
                              checked={detailType.detailType.nsfw}
                              disabled={fieldsDisabled || isCreatingDetailType}
                              onChange={(event) => void toggleDetailTypeNsfw(detailType, event.target.checked)}
                              type="checkbox"
                            />
                            <span>{codexText.detail.nsfw}</span>
                          </label>
                          {isConfirmingDelete ? (
                            <div className="confirm-actions">
                              <button
                                className="btn compact danger"
                                disabled={fieldsDisabled || isCreatingDetailType || usageCount > 0}
                                onClick={() => void deleteDetailType(detailType)}
                                type="button"
                              >
                                {codexText.actions.deleteDetailType}
                              </button>
                              <button
                                className="btn compact"
                                disabled={isCreatingDetailType}
                                onClick={() => setDetailTypeDeleteId(null)}
                                type="button"
                              >
                                {codexText.actions.cancel}
                              </button>
                            </div>
                          ) : (
                            <button
                              className="btn compact"
                              disabled={fieldsDisabled || isCreatingDetailType || usageCount > 0}
                              onClick={() => setDetailTypeDeleteId(detailType.detailType.id)}
                              type="button"
                            >
                              {codexText.actions.deleteDetailType}
                            </button>
                          )}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="detail-empty compact-empty">{codexText.detail.noDetailTypes}</div>
                )}
              </section>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
