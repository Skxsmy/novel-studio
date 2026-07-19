import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import type {
  CodexAiContextPolicy,
  CodexCategoryDocument,
  CodexCategoryId,
  CodexDetailTypeDocument,
  CodexEffectiveEntry,
  CodexEntryDocument,
  CodexMention,
  CodexMentionRules,
  CodexProgressionDocument,
  CodexRelationDocument,
  UpdateCodexEntryInput,
} from "@novel-studio/contracts";

import type { ProjectSessionState } from "../../app/useProjectSession";
import { ApiError, api } from "../../api";
import { ReferenceSurface } from "../../ui/ReferenceSurface";
import "./reference-codex.css";

type CodexTab = "canon" | "research" | "details" | "relations" | "progressions" | "mentions";
type StateView = "baseline" | "current-scene";
type MentionSource = "manuscript" | "codex";
type SaveState = "saved" | "dirty" | "saving" | "failed" | "conflict";
type CategoryScope = "all" | "archived" | CodexCategoryId;

interface EntryDraft {
  aiContextPolicy: CodexAiContextPolicy;
  aliases: string;
  automaticPlural: boolean;
  baseResearchRevision: string;
  baseRevision: string;
  caseSensitive: boolean;
  categoryId: CodexCategoryId;
  description: string;
  detailAiContext: Record<string, boolean>;
  details: Record<string, string>;
  excludedTerms: string;
  matchAliases: boolean;
  name: string;
  research: string;
}

interface CodexContentMention {
  fieldLabel: string;
  matchedText: string;
  snippet: string;
  sourceEntry: CodexEntryDocument;
}

interface DetailTypeDraft {
  description: string;
  isNew: boolean;
  name: string;
  nsfw: boolean;
}

interface ContextMenuState {
  id: string;
  kind: "category" | "detail" | "detail-type" | "entry" | "relation";
  x: number;
  y: number;
}

type DialogState =
  | { kind: "create-category" }
  | { kind: "create-entry" }
  | { categoryId: string; kind: "rename-category" }
  | { categoryId: string; kind: "delete-category" }
  | { entryId: string; kind: "delete-entry" }
  | { detailKey: string; kind: "delete-detail" }
  | { detailTypeId: string; kind: "rename-detail-type" }
  | { detailTypeId: string; kind: "delete-detail-type" }
  | { kind: "detail-types" }
  | { kind: "create-relation" }
  | { kind: "delete-relation"; relationId: string }
  | null;

interface ReferenceCodexWorkspaceProps {
  authorityRevision?: number;
  onOpenWrite?: (sceneId: string, blockId?: string | null) => void;
  requestedEntryId?: string | null;
  requestedEntryRequestId?: number | null;
  requestedTab?: "canon" | "research" | null;
  session?: ProjectSessionState;
}

const tabs: Array<{ id: CodexTab; label: string }> = [
  { id: "canon", label: "Canon" },
  { id: "research", label: "Research" },
  { id: "details", label: "Details" },
  { id: "relations", label: "Relations" },
  { id: "progressions", label: "Progressions" },
  { id: "mentions", label: "Mentions" },
];

function initials(value: string) {
  const words = value.trim().split(/\s+/u).filter(Boolean);
  return (words.length > 1 ? `${words[0]![0] ?? ""}${words[1]![0] ?? ""}` : value.slice(0, 2)).toUpperCase();
}

function detailTypeCategoryLabel(value: string) {
  return value.replace(/s$/iu, "") || value;
}

function listText(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function draftFromEntry(entry: CodexEntryDocument): EntryDraft {
  return {
    aiContextPolicy: entry.metadata.aiContextPolicy,
    aliases: entry.metadata.aliases.join(", "),
    automaticPlural: entry.metadata.mention.automaticPlural,
    baseResearchRevision: entry.research.revision,
    baseRevision: entry.revision,
    caseSensitive: entry.metadata.mention.caseSensitive,
    categoryId: entry.metadata.categoryId,
    description: entry.description,
    detailAiContext: { ...entry.metadata.detailAiContext },
    details: { ...entry.metadata.details },
    excludedTerms: entry.metadata.mention.excludedTerms.join(", "),
    matchAliases: entry.metadata.mention.matchAliases,
    name: entry.metadata.name,
    research: entry.research.content,
  };
}

function updateInput(draft: EntryDraft): UpdateCodexEntryInput {
  const mention: CodexMentionRules = {
    automaticPlural: draft.automaticPlural,
    caseSensitive: draft.caseSensitive,
    excludedTerms: listText(draft.excludedTerms),
    matchAliases: draft.matchAliases,
  };
  return {
    aiContextPolicy: draft.aiContextPolicy,
    aliases: listText(draft.aliases),
    baseResearchRevision: draft.baseResearchRevision,
    baseRevision: draft.baseRevision,
    categoryId: draft.categoryId,
    description: draft.description,
    detailAiContext: draft.detailAiContext,
    details: draft.details,
    mention,
    name: draft.name.trim(),
    research: draft.research,
  };
}

function errorText(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (error.payload && typeof error.payload === "object" && "message" in error.payload) {
      const message = error.payload.message;
      if (typeof message === "string") return message;
    }
    return `${fallback} (${error.status})`;
  }
  return error instanceof Error ? error.message : fallback;
}

function contextMenuFromKeyboard(
  event: ReactKeyboardEvent<HTMLElement>,
  open: (x: number, y: number) => void,
) {
  if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
  event.preventDefault();
  const rect = event.currentTarget.getBoundingClientRect();
  open(rect.left + Math.min(rect.width, 24), rect.top + Math.min(rect.height, 24));
}

function matchingDetailType(key: string, detailTypes: CodexDetailTypeDocument[]) {
  return detailTypes.find((document) => document.detailType.id === key || document.detailType.name === key);
}

function detailLabel(key: string, detailTypes: CodexDetailTypeDocument[]) {
  return matchingDetailType(key, detailTypes)?.detailType.name ?? key;
}

function findOccurrences(content: string, entry: CodexEntryDocument) {
  if (!content.trim()) return [];
  const caseSensitive = entry.metadata.mention.caseSensitive;
  const terms = [entry.metadata.name, ...(entry.metadata.mention.matchAliases ? entry.metadata.aliases : [])]
    .map((term) => term.trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);
  const excluded = entry.metadata.mention.excludedTerms.map((term) => caseSensitive ? term : term.toLocaleLowerCase("und"));
  const source = caseSensitive ? content : content.toLocaleLowerCase("und");
  const matches: Array<{ end: number; matchedText: string; start: number }> = [];
  for (const term of terms) {
    const needle = caseSensitive ? term : term.toLocaleLowerCase("und");
    if (excluded.includes(needle)) continue;
    let start = source.indexOf(needle);
    while (start >= 0) {
      const end = start + needle.length;
      if (!matches.some((match) => start < match.end && end > match.start)) {
        matches.push({ end, matchedText: content.slice(start, end), start });
      }
      start = source.indexOf(needle, start + Math.max(needle.length, 1));
    }
  }
  return matches.sort((left, right) => left.start - right.start);
}

function findCodexContentMentions(
  selectedEntry: CodexEntryDocument,
  entries: CodexEntryDocument[],
  detailTypes: CodexDetailTypeDocument[],
) {
  const mentions: CodexContentMention[] = [];
  for (const sourceEntry of entries) {
    if (sourceEntry.metadata.id === selectedEntry.metadata.id || sourceEntry.metadata.archivedAt) continue;
    const sources = [
      { content: sourceEntry.description, label: "Canon Description" },
      { content: sourceEntry.research.content, label: "Research" },
      ...Object.entries(sourceEntry.metadata.details).map(([key, content]) => ({
        content,
        label: `Detail · ${detailLabel(key, detailTypes)}`,
      })),
    ];
    for (const source of sources) {
      for (const match of findOccurrences(source.content, selectedEntry)) {
        const start = Math.max(0, match.start - 70);
        const end = Math.min(source.content.length, match.end + 100);
        mentions.push({
          fieldLabel: source.label,
          matchedText: match.matchedText,
          snippet: `${start > 0 ? "…" : ""}${source.content.slice(start, end)}${end < source.content.length ? "…" : ""}`,
          sourceEntry,
        });
      }
    }
  }
  return mentions;
}

function inlineCanonSegments(content: string, entries: CodexEntryDocument[], selectedEntryId: string) {
  const matches = entries
    .filter((entry) => entry.metadata.id !== selectedEntryId && !entry.metadata.archivedAt)
    .flatMap((entry) => findOccurrences(content, entry).map((match) => ({ ...match, entry })))
    .sort((left, right) => left.start - right.start || right.end - left.end)
    .filter((match, index, all) => index === 0 || match.start >= all[index - 1]!.end);
  const segments: Array<{ entry?: CodexEntryDocument; text: string }> = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start > cursor) segments.push({ text: content.slice(cursor, match.start) });
    segments.push({ entry: match.entry, text: content.slice(match.start, match.end) });
    cursor = match.end;
  }
  if (cursor < content.length) segments.push({ text: content.slice(cursor) });
  return segments;
}

function CanonHighlights({
  content,
  entries,
  onPreview,
  selectedEntryId,
}: {
  content: string;
  entries: CodexEntryDocument[];
  onPreview: (entry: CodexEntryDocument) => void;
  selectedEntryId: string;
}) {
  return (
    <>
      {inlineCanonSegments(content, entries, selectedEntryId).map((segment, index) => segment.entry ? (
        <button
          className="codex-inline-mention"
          key={`${segment.entry.metadata.id}-${index}`}
          onClick={() => onPreview(segment.entry!)}
          type="button"
        >
          {segment.text}
        </button>
      ) : <span key={`text-${index}`}>{segment.text}</span>)}
    </>
  );
}

export function ReferenceCodexWorkspace(props: ReferenceCodexWorkspaceProps = {}) {
  if (!props.session) return <ReferenceSurface selector="#codex-workspace" />;
  return <ConnectedReferenceCodexWorkspace {...props} session={props.session} />;
}

function ConnectedReferenceCodexWorkspace({
  authorityRevision = 0,
  onOpenWrite,
  requestedEntryId = null,
  requestedEntryRequestId = null,
  requestedTab = null,
  session,
}: Required<Pick<ReferenceCodexWorkspaceProps, "session">> & Omit<ReferenceCodexWorkspaceProps, "session">) {
  const series = session.activeSeries;
  const [activeTab, setActiveTab] = useState<CodexTab>("canon");
  const [stateView, setStateView] = useState<StateView>("baseline");
  const [mentionSource, setMentionSource] = useState<MentionSource>("manuscript");
  const [categoryScope, setCategoryScope] = useState<CategoryScope>("all");
  const [categories, setCategories] = useState<CodexCategoryDocument[]>([]);
  const [entries, setEntries] = useState<CodexEntryDocument[]>([]);
  const [detailTypes, setDetailTypes] = useState<CodexDetailTypeDocument[]>([]);
  const [relations, setRelations] = useState<CodexRelationDocument[]>([]);
  const [progressions, setProgressions] = useState<CodexProgressionDocument[]>([]);
  const [manuscriptMentions, setManuscriptMentions] = useState<CodexMention[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [selectedProgressionId, setSelectedProgressionId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [effectiveEntry, setEffectiveEntry] = useState<CodexEffectiveEntry | null>(null);
  const [query, setQuery] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [isLoading, setIsLoading] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [newEntry, setNewEntry] = useState({ categoryId: "character" as CodexCategoryId, description: "", name: "" });
  const [newCategoryName, setNewCategoryName] = useState("");
  const [renameCategoryName, setRenameCategoryName] = useState("");
  const [renameDetailTypeName, setRenameDetailTypeName] = useState("");
  const [managerCategoryId, setManagerCategoryId] = useState<CodexCategoryId>("character");
  const [managerDetailTypeId, setManagerDetailTypeId] = useState<string | null>(null);
  const [detailTypeDraft, setDetailTypeDraft] = useState<DetailTypeDraft | null>(null);
  const [returnToDetailTypeLibrary, setReturnToDetailTypeLibrary] = useState(false);
  const [newDetail, setNewDetail] = useState<{ detailTypeId: string; value: string } | null>(null);
  const [relationForm, setRelationForm] = useState({ description: "", sourceEntryId: "", targetEntryId: "" });
  const [preview, setPreview] = useState<{ description: string; entry: CodexEntryDocument; loading: boolean } | null>(null);
  const canonOverlayRef = useRef<HTMLDivElement>(null);
  const handledEntryRequestRef = useRef<number | null>(null);

  const selectedEntry = selectedEntryId
    ? entries.find((entry) => entry.metadata.id === selectedEntryId) ?? null
    : null;
  const activeEntries = entries.filter((entry) => !entry.metadata.archivedAt);
  const archivedEntries = entries.filter((entry) => Boolean(entry.metadata.archivedAt));
  const filteredEntries = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("und");
    return entries.filter((entry) => {
      if (categoryScope === "archived" && !entry.metadata.archivedAt) return false;
      if (categoryScope !== "archived" && entry.metadata.archivedAt) return false;
      if (categoryScope !== "all" && categoryScope !== "archived" && entry.metadata.categoryId !== categoryScope) return false;
      if (!normalized) return true;
      return [entry.metadata.name, entry.description, ...entry.metadata.aliases, ...Object.values(entry.metadata.details)]
        .join("\n")
        .toLocaleLowerCase("und")
        .includes(normalized);
    });
  }, [categoryScope, entries, query]);
  const categoryById = useMemo(() => new Map(categories.map((document) => [document.category.id, document])), [categories]);
  const entryById = useMemo(() => new Map(entries.map((entry) => [entry.metadata.id, entry])), [entries]);
  const sceneById = useMemo(() => new Map((series?.scenes ?? []).map((scene) => [scene.metadata.id, scene])), [series?.scenes]);
  const codexMentions = useMemo(
    () => selectedEntry ? findCodexContentMentions(selectedEntry, entries, detailTypes) : [],
    [detailTypes, entries, selectedEntry],
  );
  const currentEntryDocument = stateView === "current-scene" && effectiveEntry ? effectiveEntry.entry : selectedEntry;
  const displayedDetails = stateView === "current-scene"
    ? currentEntryDocument?.metadata.details ?? {}
    : draft?.details ?? {};
  const selectedProgression = progressions.find((item) => item.progression.id === selectedProgressionId) ?? progressions[0] ?? null;
  const managerDetailTypes = detailTypes.filter((document) => document.detailType.categoryId === managerCategoryId);
  const managerDetailType = managerDetailTypeId
    ? detailTypes.find((document) => document.detailType.id === managerDetailTypeId) ?? null
    : null;
  const managerDetailTypeUseCount = managerDetailType
    ? entries.filter((entry) => (
      entry.metadata.categoryId === managerDetailType.detailType.categoryId && (
        Object.prototype.hasOwnProperty.call(entry.metadata.details, managerDetailType.detailType.id) ||
        Object.prototype.hasOwnProperty.call(entry.metadata.details, managerDetailType.detailType.name)
      )
    )).length
    : 0;
  const progressionTarget = selectedProgression ? {
    blockId: selectedProgression.progression.source.kind === "write-block"
      ? selectedProgression.progression.source.blockId
      : null,
    sceneId: selectedProgression.progression.source.sceneId ?? selectedProgression.progression.effectiveFromSceneId,
  } : null;

  useEffect(() => {
    if (!series) return;
    let active = true;
    setIsLoading(true);
    setError(null);
    Promise.all([
      api.codex.listCategories(series.manifest.id),
      api.codex.listDetailTypes(series.manifest.id),
      api.codex.listEntries(series.manifest.id, { includeArchived: true }),
    ]).then(([nextCategories, nextDetailTypes, nextEntries]) => {
      if (!active) return;
      setCategories(nextCategories);
      setDetailTypes(nextDetailTypes);
      setEntries(nextEntries);
      const isNewEntryRequest = requestedEntryRequestId !== null
        && handledEntryRequestRef.current !== requestedEntryRequestId;
      const requestedEntryExists = isNewEntryRequest && requestedEntryId
        ? nextEntries.some((entry) => entry.metadata.id === requestedEntryId)
        : false;
      if (isNewEntryRequest) {
        handledEntryRequestRef.current = requestedEntryRequestId;
        setCategoryScope("all");
        setQuery("");
        if (requestedTab) setActiveTab(requestedTab);
        if (requestedEntryId && !requestedEntryExists) {
          setError("The requested Codex Entry is no longer available.");
        }
      }
      const selectedStillExists = nextEntries.some((entry) => entry.metadata.id === selectedEntryId);
      const nextSelected = requestedEntryExists
        ? requestedEntryId
        : selectedStillExists
        ? selectedEntryId
        : nextEntries.find((entry) => !entry.metadata.archivedAt)?.metadata.id ?? nextEntries[0]?.metadata.id ?? null;
      setSelectedEntryId(nextSelected);
      const nextSelectedEntry = nextEntries.find((entry) => entry.metadata.id === nextSelected) ?? null;
      setDraft(nextSelectedEntry ? draftFromEntry(nextSelectedEntry) : null);
    }).catch((reason: unknown) => {
      if (active) setError(errorText(reason, "Failed to load Codex"));
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, [authorityRevision, requestedEntryId, requestedEntryRequestId, requestedTab, series?.manifest.id]);

  useEffect(() => {
    if (!selectedEntry) {
      setDraft(null);
      return;
    }
    setDraft(draftFromEntry(selectedEntry));
    setSaveState("saved");
    setNewDetail(null);
  }, [selectedEntryId]);

  useEffect(() => {
    if (!series || !selectedEntryId) {
      setRelations([]);
      setProgressions([]);
      setManuscriptMentions([]);
      return;
    }
    let active = true;
    Promise.all([
      api.codex.listRelations(series.manifest.id, { entryId: selectedEntryId, includeArchived: true }),
      api.codex.listProgressions(series.manifest.id, { entryId: selectedEntryId, includeArchived: true }),
      api.codex.listEntryMentions(series.manifest.id, selectedEntryId),
    ]).then(([nextRelations, nextProgressions, nextMentions]) => {
      if (!active) return;
      setRelations(nextRelations);
      setProgressions(nextProgressions);
      setSelectedProgressionId(nextProgressions[0]?.progression.id ?? null);
      setManuscriptMentions(nextMentions);
    }).catch((reason: unknown) => {
      if (active) setError(errorText(reason, "Failed to load Codex connections"));
    });
    return () => { active = false; };
  }, [selectedEntryId, series?.manifest.id]);

  useEffect(() => {
    if (stateView !== "current-scene" || !series || !selectedEntryId || !session.selectedScene) {
      setEffectiveEntry(null);
      return;
    }
    let active = true;
    api.codex.getEffectiveEntry(series.manifest.id, selectedEntryId, {
      sceneId: session.selectedScene.metadata.id,
    }).then((document) => {
      if (active) setEffectiveEntry(document);
    }).catch((reason: unknown) => {
      if (active) setError(errorText(reason, "Failed to load Current Scene state"));
    });
    return () => { active = false; };
  }, [selectedEntryId, series?.manifest.id, session.selectedScene?.metadata.id, stateView]);

  useEffect(() => {
    const close = () => setContextMenu(null);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  function replaceEntry(entry: CodexEntryDocument) {
    setEntries((current) => current.map((candidate) => candidate.metadata.id === entry.metadata.id ? entry : candidate));
  }

  function changeDraft(update: (current: EntryDraft) => EntryDraft) {
    setDraft((current) => current ? update(current) : current);
    setSaveState("dirty");
    setError(null);
  }

  async function saveDraft(nextDraft = draft) {
    if (!series || !selectedEntry || !nextDraft || isBusy || selectedEntry.metadata.archivedAt) return null;
    if (!nextDraft.name.trim()) {
      setError("Name is required.");
      return null;
    }
    setIsBusy(true);
    setSaveState("saving");
    setError(null);
    try {
      const updated = await api.codex.updateEntry(series.manifest.id, selectedEntry.metadata.id, updateInput(nextDraft));
      replaceEntry(updated);
      setDraft(draftFromEntry(updated));
      setSaveState("saved");
      return updated;
    } catch (reason) {
      setSaveState(reason instanceof ApiError && reason.status === 409 ? "conflict" : "failed");
      setError(errorText(reason, "Failed to save Codex entry"));
      return null;
    } finally {
      setIsBusy(false);
    }
  }

  async function refreshEntries(preferredEntryId = selectedEntryId) {
    if (!series) return;
    const next = await api.codex.listEntries(series.manifest.id, { includeArchived: true });
    setEntries(next);
    const preferred = next.find((entry) => entry.metadata.id === preferredEntryId);
    const fallback = next.find((entry) => !entry.metadata.archivedAt) ?? next[0] ?? null;
    const chosen = preferred ?? fallback;
    setSelectedEntryId(chosen?.metadata.id ?? null);
    setDraft(chosen ? draftFromEntry(chosen) : null);
  }

  async function createEntry() {
    if (!series || isBusy || !newEntry.name.trim()) return;
    setIsBusy(true);
    setError(null);
    try {
      const created = await api.codex.createEntry(series.manifest.id, {
        categoryId: newEntry.categoryId,
        description: newEntry.description,
        name: newEntry.name.trim(),
      });
      setEntries((current) => [...current, created]);
      setSelectedEntryId(created.metadata.id);
      setDraft(draftFromEntry(created));
      setCategoryScope(created.metadata.categoryId);
      setNewEntry({ categoryId: "character", description: "", name: "" });
      setDialog(null);
    } catch (reason) {
      setError(errorText(reason, "Failed to create Codex entry"));
    } finally {
      setIsBusy(false);
    }
  }

  async function createCategory() {
    if (!series || isBusy || !newCategoryName.trim()) return;
    setIsBusy(true);
    setError(null);
    try {
      const created = await api.codex.createCategory(series.manifest.id, { name: newCategoryName.trim() });
      setCategories((current) => [...current, created]);
      setNewCategoryName("");
      if (returnToDetailTypeLibrary) {
        setManagerCategoryId(created.category.id);
        setManagerDetailTypeId(null);
        setDetailTypeDraft(null);
        setReturnToDetailTypeLibrary(false);
        setDialog({ kind: "detail-types" });
      } else {
        setCategoryScope(created.category.id);
        setDialog(null);
      }
    } catch (reason) {
      setError(errorText(reason, "Failed to create Codex category"));
    } finally {
      setIsBusy(false);
    }
  }

  async function renameCategory(categoryId: string) {
    if (!series || isBusy || !renameCategoryName.trim()) return;
    const document = categoryById.get(categoryId);
    if (!document?.revision || document.category.builtIn) return;
    setIsBusy(true);
    try {
      const updated = await api.codex.updateCategory(series.manifest.id, categoryId, {
        baseRevision: document.revision,
        name: renameCategoryName.trim(),
      });
      setCategories((current) => current.map((candidate) => candidate.category.id === categoryId ? updated : candidate));
      setDialog(null);
    } catch (reason) {
      setError(errorText(reason, "Failed to rename Codex category"));
    } finally {
      setIsBusy(false);
    }
  }

  async function deleteCategory(categoryId: string) {
    if (!series || isBusy) return;
    const document = categoryById.get(categoryId);
    if (!document?.revision || document.category.builtIn) return;
    setIsBusy(true);
    try {
      await api.codex.deleteCategory(series.manifest.id, categoryId, { baseRevision: document.revision });
      setCategories((current) => current.filter((candidate) => candidate.category.id !== categoryId));
      setCategoryScope("uncategorized");
      await refreshEntries();
      setDialog(null);
    } catch (reason) {
      setError(errorText(reason, "Failed to delete Codex category"));
    } finally {
      setIsBusy(false);
    }
  }

  async function setEntryArchived(entryId: string, archived: boolean) {
    if (!series || isBusy) return;
    const entry = entryById.get(entryId);
    if (!entry) return;
    setIsBusy(true);
    try {
      const updated = archived
        ? await api.codex.archiveEntry(series.manifest.id, entryId, { baseRevision: entry.revision })
        : await api.codex.restoreEntry(series.manifest.id, entryId, { baseRevision: entry.revision });
      replaceEntry(updated);
      setSelectedEntryId(updated.metadata.id);
      setDraft(draftFromEntry(updated));
      if (archived) setCategoryScope("archived");
    } catch (reason) {
      setError(errorText(reason, archived ? "Failed to archive Codex entry" : "Failed to restore Codex entry"));
    } finally {
      setIsBusy(false);
    }
  }

  async function deleteEntry(entryId: string) {
    if (!series || isBusy) return;
    const entry = entryById.get(entryId);
    if (!entry) return;
    setIsBusy(true);
    try {
      await api.codex.deleteEntry(series.manifest.id, entryId, { baseRevision: entry.revision });
      const next = entries.filter((candidate) => candidate.metadata.id !== entryId);
      setEntries(next);
      const fallback = next.find((candidate) => categoryScope === "archived" ? candidate.metadata.archivedAt : !candidate.metadata.archivedAt) ?? null;
      setSelectedEntryId(fallback?.metadata.id ?? null);
      setDraft(fallback ? draftFromEntry(fallback) : null);
      setDialog(null);
    } catch (reason) {
      setError(errorText(reason, "Failed to delete Codex entry"));
    } finally {
      setIsBusy(false);
    }
  }

  async function saveNewDetail() {
    if (!draft || !newDetail?.detailTypeId) return;
    const nextDraft = {
      ...draft,
      detailAiContext: { ...draft.detailAiContext, [newDetail.detailTypeId]: true },
      details: { ...draft.details, [newDetail.detailTypeId]: newDetail.value },
    };
    if (await saveDraft(nextDraft)) setNewDetail(null);
  }

  async function deleteDetail(detailKey: string) {
    if (!draft) return;
    const details = { ...draft.details };
    const detailAiContext = { ...draft.detailAiContext };
    delete details[detailKey];
    delete detailAiContext[detailKey];
    if (await saveDraft({ ...draft, detailAiContext, details })) setDialog(null);
  }

  async function toggleDetailContext(detailKey: string) {
    if (!draft) return;
    const nextDraft = {
      ...draft,
      detailAiContext: {
        ...draft.detailAiContext,
        [detailKey]: draft.detailAiContext[detailKey] === false,
      },
    };
    await saveDraft(nextDraft);
  }

  function selectManagerDetailType(document: CodexDetailTypeDocument | null) {
    setManagerDetailTypeId(document?.detailType.id ?? null);
    setDetailTypeDraft(document ? {
      description: document.detailType.description,
      isNew: false,
      name: document.detailType.name,
      nsfw: document.detailType.nsfw,
    } : null);
  }

  function selectManagerCategory(categoryId: CodexCategoryId) {
    setManagerCategoryId(categoryId);
    selectManagerDetailType(
      detailTypes.find((document) => document.detailType.categoryId === categoryId) ?? null,
    );
  }

  function openDetailTypeLibrary(categoryId: CodexCategoryId) {
    selectManagerCategory(categoryId);
    setReturnToDetailTypeLibrary(false);
    setDialog({ kind: "detail-types" });
  }

  function beginCreateDetailType() {
    setManagerDetailTypeId(null);
    setDetailTypeDraft({
      description: "",
      isNew: true,
      name: "Untitled detail type",
      nsfw: false,
    });
  }

  function closeDialog() {
    if (dialog?.kind === "create-category" && returnToDetailTypeLibrary) {
      setReturnToDetailTypeLibrary(false);
      setDialog({ kind: "detail-types" });
      return;
    }
    if (dialog?.kind === "rename-detail-type" || dialog?.kind === "delete-detail-type") {
      setDialog({ kind: "detail-types" });
      return;
    }
    setDialog(null);
  }

  async function saveDetailTypeLibrary() {
    if (!series || !detailTypeDraft || !detailTypeDraft.name.trim() || isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      if (detailTypeDraft.isNew) {
        const created = await api.codex.createDetailType(series.manifest.id, {
          categoryId: managerCategoryId,
          description: detailTypeDraft.description,
          name: detailTypeDraft.name.trim(),
          nsfw: detailTypeDraft.nsfw,
        });
        setDetailTypes((current) => [...current, created]);
        selectManagerDetailType(created);
      } else if (managerDetailType) {
        const updated = await api.codex.updateDetailType(series.manifest.id, managerDetailType.detailType.id, {
          baseRevision: managerDetailType.revision,
          description: detailTypeDraft.description,
          nsfw: detailTypeDraft.nsfw,
        });
        setDetailTypes((current) => current.map((document) => (
          document.detailType.id === updated.detailType.id ? updated : document
        )));
        selectManagerDetailType(updated);
      }
      setDialog(null);
    } catch (reason) {
      setError(errorText(reason, "Failed to save Detail Type Library"));
    } finally {
      setIsBusy(false);
    }
  }

  async function renameDetailType(detailTypeId: string) {
    if (!series || !renameDetailTypeName.trim() || isBusy) return;
    const document = detailTypes.find((candidate) => candidate.detailType.id === detailTypeId);
    if (!document) return;
    setIsBusy(true);
    setError(null);
    try {
      const updated = await api.codex.updateDetailType(series.manifest.id, detailTypeId, {
        baseRevision: document.revision,
        name: renameDetailTypeName.trim(),
      });
      setDetailTypes((current) => current.map((candidate) => (
        candidate.detailType.id === detailTypeId ? updated : candidate
      )));
      selectManagerDetailType(updated);
      setDialog({ kind: "detail-types" });
      try {
        await refreshEntries();
      } catch (reason) {
        setError(errorText(reason, "Detail Type was renamed, but Codex Entries could not be refreshed"));
      }
    } catch (reason) {
      setError(errorText(reason, "Failed to rename Detail Type"));
    } finally {
      setIsBusy(false);
    }
  }

  async function deleteDetailType(detailTypeId: string) {
    if (!series || isBusy) return;
    const document = detailTypes.find((candidate) => candidate.detailType.id === detailTypeId);
    if (!document) return;
    setIsBusy(true);
    try {
      await api.codex.deleteDetailType(series.manifest.id, detailTypeId, { baseRevision: document.revision });
      const remaining = detailTypes.filter((candidate) => candidate.detailType.id !== detailTypeId);
      setDetailTypes(remaining);
      selectManagerDetailType(
        remaining.find((candidate) => candidate.detailType.categoryId === managerCategoryId) ?? null,
      );
      setDialog({ kind: "detail-types" });
    } catch (reason) {
      setError(errorText(reason, "This Detail Type cannot be deleted while it is in use."));
      setDialog({ kind: "detail-types" });
    } finally {
      setIsBusy(false);
    }
  }

  async function createRelation() {
    if (!series || !relationForm.sourceEntryId || !relationForm.targetEntryId || !relationForm.description.trim() || isBusy) return;
    setIsBusy(true);
    try {
      const created = await api.codex.createRelation(series.manifest.id, {
        description: relationForm.description.trim(),
        sourceEntryId: relationForm.sourceEntryId,
        targetEntryId: relationForm.targetEntryId,
      });
      if (selectedEntryId && [created.relation.sourceEntryId, created.relation.targetEntryId].includes(selectedEntryId)) {
        setRelations((current) => [...current, created]);
      }
      setRelationForm({ description: "", sourceEntryId: selectedEntryId ?? "", targetEntryId: "" });
      setDialog(null);
    } catch (reason) {
      setError(errorText(reason, "Failed to create Codex relation"));
    } finally {
      setIsBusy(false);
    }
  }

  async function deleteRelation(relationId: string) {
    if (!series || isBusy) return;
    const document = relations.find((candidate) => candidate.relation.id === relationId);
    if (!document) return;
    setIsBusy(true);
    try {
      await api.codex.deleteRelation(series.manifest.id, relationId, { baseRevision: document.revision });
      setRelations((current) => current.filter((candidate) => candidate.relation.id !== relationId));
      setDialog(null);
    } catch (reason) {
      setError(errorText(reason, "This Relation cannot be deleted while another record references it."));
      setDialog(null);
    } finally {
      setIsBusy(false);
    }
  }

  async function openCanonPreview(entry: CodexEntryDocument) {
    setPreview({ description: entry.description, entry, loading: stateView === "current-scene" });
    if (stateView !== "current-scene" || !series || !session.selectedScene) return;
    try {
      const effective = await api.codex.getEffectiveEntry(series.manifest.id, entry.metadata.id, {
        sceneId: session.selectedScene.metadata.id,
      });
      setPreview({ description: effective.entry.description, entry, loading: false });
    } catch (reason) {
      setPreview({ description: errorText(reason, "Preview unavailable"), entry, loading: false });
    }
  }

  function openContextMenu(kind: ContextMenuState["kind"], id: string, x: number, y: number) {
    setContextMenu({ id, kind, x, y });
  }

  function switchTab(tab: CodexTab, focus = false) {
    setActiveTab(tab);
    if (focus) queueMicrotask(() => document.querySelector<HTMLButtonElement>(`#codex-workspace [data-tab='${tab}']`)?.focus());
  }

  function tabKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    switchTab(tabs[next]!.id, true);
  }

  const scopeLabel = categoryScope === "all"
    ? "All entries"
    : categoryScope === "archived"
      ? "Archived Entries"
      : categoryById.get(categoryScope)?.category.name ?? "Entries";
  const selectedCategory = selectedEntry ? categoryById.get(selectedEntry.metadata.categoryId)?.category : null;
  const activeScene = session.selectedScene;
  const volume = series?.books.find((item) => item.id === activeScene?.metadata.bookId) ?? null;
  const chapter = series?.acts.find((item) => item.id === activeScene?.metadata.actId) ?? null;
  const act = series?.chapters.find((item) => item.id === activeScene?.metadata.chapterId) ?? null;
  const canEditProjection = stateView === "baseline" && !selectedEntry?.metadata.archivedAt;
  const currentSceneAvailable = Boolean(activeScene);
  const currentDescription = stateView === "current-scene"
    ? currentEntryDocument?.description ?? ""
    : draft?.description ?? "";

  return (
    <>
      <section className="workbench workspace-view codex-connected" id="codex-workspace" data-workspace-view="Codex" aria-label="Codex workspace">
        <aside className="rail" aria-label="Codex categories">
          <header className="section-head">
            <div className="head-row">
              <div><div className="eyebrow">Story memory</div><h2>Codex</h2></div>
              <button className="icon-button" aria-label="Create entry" onClick={() => setDialog({ kind: "create-entry" })} title="Create entry" type="button">+</button>
            </div>
            <div className="count">{activeEntries.length} active · {archivedEntries.length} archived</div>
          </header>
          <div className="rail-scroll">
            <div className="group-label">Library</div>
            <button className={`category${categoryScope === "all" ? " is-active" : ""}`} onClick={() => setCategoryScope("all")} type="button">
              <span className="category-mark">ALL</span><span><strong>All entries</strong><small>Across every category</small></span><span className="number">{activeEntries.length}</span>
            </button>
            {categories.filter((document) => !document.category.archivedAt).map((document) => {
              const category = document.category;
              const open = (x: number, y: number) => openContextMenu("category", category.id, x, y);
              return (
                <button
                  className={`category${categoryScope === category.id ? " is-active" : ""}`}
                  data-category={category.id}
                  key={category.id}
                  onClick={() => setCategoryScope(category.id)}
                  onContextMenu={(event) => { event.preventDefault(); open(event.clientX, event.clientY); }}
                  onKeyDown={(event) => contextMenuFromKeyboard(event, open)}
                  type="button"
                >
                  <span className="category-mark">{initials(category.name)}</span><span><strong>{category.name}</strong><small>{category.builtIn ? "Built-in category" : "Custom category"}</small></span><span className="number">{activeEntries.filter((entry) => entry.metadata.categoryId === category.id).length}</span>
                </button>
              );
            })}
            <button className="category category-create" onClick={() => setDialog({ kind: "create-category" })} type="button">
              <span className="category-mark">+</span><span><strong>New category</strong><small>Create a Codex entry type</small></span>
            </button>
            <div className="group-label">Archive</div>
            <button className={`category${categoryScope === "archived" ? " is-active" : ""}`} onClick={() => setCategoryScope("archived")} type="button">
              <span className="category-mark">AR</span><span><strong>Archived Entries</strong><small>Restore or permanently delete</small></span><span className="number">{archivedEntries.length}</span>
            </button>
          </div>
          <footer className="rail-foot">
            <button className="schema-button" onClick={() => openDetailTypeLibrary(draft?.categoryId ?? "character")} type="button">
              <span><strong>Detail type library</strong><span>Reusable fields by category</span></span><span aria-hidden="true">→</span>
            </button>
          </footer>
        </aside>

        <section className="entry-index" aria-label="Codex entries">
          <header className="section-head">
            <div className="head-row"><div><div className="eyebrow">{scopeLabel}</div><h3>Entry index</h3></div><span className="tag green">Real data</span></div>
            <div className="count">{filteredEntries.length} visible {filteredEntries.length === 1 ? "entry" : "entries"}</div>
            <div className="compact-category-controls">
              <select className="compact-category-select" aria-label="Codex category" onChange={(event) => setCategoryScope(event.target.value as CategoryScope)} value={categoryScope}>
                <option value="all">All entries</option>
                {categories.map((document) => <option key={document.category.id} value={document.category.id}>{document.category.name}</option>)}
                <option value="archived">Archived Entries</option>
              </select>
              <button className="icon-button" aria-label="Create Codex category" onClick={() => setDialog({ kind: "create-category" })} type="button">+</button>
            </div>
          </header>
          <div className="index-tools">
            <label className="search-box"><span className="search-icon" aria-hidden="true">⌕</span><input aria-label="Search Codex entries" onChange={(event) => setQuery(event.target.value)} placeholder="Search name, alias, or detail" value={query} /><span className="keycap">/</span></label>
          </div>
          <div className="entry-scroll">
            {isLoading ? <div className="entry-empty is-visible">Loading Codex…</div> : filteredEntries.map((entry) => {
              const open = (x: number, y: number) => openContextMenu("entry", entry.metadata.id, x, y);
              return (
                <button
                  aria-pressed={selectedEntryId === entry.metadata.id}
                  className={`entry-row${selectedEntryId === entry.metadata.id ? " is-selected" : ""}`}
                  data-entry-id={entry.metadata.id}
                  key={entry.metadata.id}
                  onClick={() => { setSelectedEntryId(entry.metadata.id); setPreview(null); }}
                  onContextMenu={(event) => { event.preventDefault(); setSelectedEntryId(entry.metadata.id); open(event.clientX, event.clientY); }}
                  onKeyDown={(event) => contextMenuFromKeyboard(event, open)}
                  type="button"
                >
                  <span className="avatar">{initials(entry.metadata.name)}</span><span className="entry-copy"><span className="entry-title-line"><span className={`status-dot${entry.metadata.archivedAt ? " amber" : ""}`}></span><strong>{entry.metadata.name}</strong></span><p>{entry.metadata.aliases.join(" · ") || entry.description.slice(0, 72) || "No Canon Description"}</p></span><span className="entry-meta"><strong>{Object.keys(entry.metadata.details).length}</strong><span>details</span></span>
                </button>
              );
            })}
            {!isLoading && filteredEntries.length === 0 ? <div className="entry-empty is-visible">No entries match this view.</div> : null}
          </div>
          <footer className="index-foot"><button className="button full" onClick={() => setDialog({ kind: "create-entry" })} type="button">+ New entry</button></footer>
        </section>

        <article className="detail-workspace" aria-label="Selected Codex entry">
          {selectedEntry && draft ? (
            <>
              <header className="entry-hero">
                <div className="entry-identity"><div className="hero-avatar">{initials(selectedEntry.metadata.name)}</div><div className="identity-copy"><div className="identity-meta"><span className="type">{selectedCategory?.name ?? selectedEntry.metadata.categoryId}</span><span>{selectedEntry.metadata.archivedAt ? "Archived" : "Active"}</span><span>·</span><span>{manuscriptMentions.length} manuscript mentions</span></div><h1>{selectedEntry.metadata.name}</h1><p>Aliases: {selectedEntry.metadata.aliases.join(" · ") || "None"}</p></div></div>
                <div className="hero-actions"><span className={`save-state is-${saveState}`}><span className="status-dot"></span><span>{saveState === "dirty" ? "Unsaved changes" : saveState === "saving" ? "Saving" : saveState === "conflict" ? "Conflict" : saveState === "failed" ? "Failed" : "Saved"}</span></span><button className="button ghost" disabled type="button">More</button><button className="button primary" disabled={isBusy || saveState !== "dirty" || Boolean(selectedEntry.metadata.archivedAt)} onClick={() => void saveDraft()} type="button">Save changes</button></div>
              </header>
              <section className="timebar" aria-label="Codex story position">
                <div className="state-switch" role="group" aria-label="State view"><button aria-pressed={stateView === "baseline"} className={stateView === "baseline" ? "is-active" : ""} onClick={() => { setStateView("baseline"); setPreview(null); }} type="button">Baseline</button><button aria-pressed={stateView === "current-scene"} className={stateView === "current-scene" ? "is-active" : ""} disabled={!currentSceneAvailable} onClick={() => { setStateView("current-scene"); setPreview(null); }} type="button">Current Scene</button></div>
                <div className="story-position"><strong>{stateView === "baseline" ? "Baseline" : activeScene?.metadata.title ?? "No Scene open in Write"}</strong><span>{stateView === "baseline" ? `Series: ${series?.manifest.title ?? "No Series"} · Initial state` : `Series: ${series?.manifest.title ?? "—"} / Volume: ${volume?.title ?? "—"} / Chapter: ${chapter?.title ?? "—"} / Act: ${act?.title ?? "—"} / Scene: ${activeScene?.metadata.title ?? "—"}`}</span></div>
                <span className="scene-signal">{stateView === "baseline" ? "Editable" : "Read-only projection"}</span>
              </section>
              <nav className="tabs" role="tablist" aria-label="Codex entry sections">
                {tabs.map((tab, index) => {
                  const count = tab.id === "details" ? Object.keys(displayedDetails).length : tab.id === "relations" ? relations.length : tab.id === "progressions" ? progressions.length : tab.id === "mentions" ? manuscriptMentions.length + codexMentions.length : null;
                  return <button aria-selected={activeTab === tab.id} className={`tab${activeTab === tab.id ? " is-active" : ""}`} data-tab={tab.id} key={tab.id} onClick={() => switchTab(tab.id)} onKeyDown={(event) => tabKeyDown(event, index)} role="tab" tabIndex={activeTab === tab.id ? 0 : -1} type="button">{tab.label}{count !== null ? <span className="tab-count">{count}</span> : null}</button>;
                })}
              </nav>
              {error ? <p className="codex-error" role="alert">{error}</p> : null}
              <div className="detail-scroll">
                <section className={`tab-panel${activeTab === "canon" ? " is-active" : ""}`} data-panel="canon" role="tabpanel">
                  <div className="content-grid">
                    <div className="stack">
                      <section className="card">
                        <header className="card-head"><div><h3>Canon Description</h3><p>{stateView === "baseline" ? "The confirmed baseline for this Entry" : `Effective at Scene · ${activeScene?.metadata.title ?? "No Scene"}`}</p></div><span className="tag green">Authoritative</span></header>
                        <div className="card-body stack">
                          <label><span className="label">Description</span>{stateView === "baseline" ? (
                            <div className="codex-canon-editor-wrap">
                              <textarea className="textarea canon-editor" disabled={!canEditProjection} onChange={(event) => changeDraft((current) => ({ ...current, description: event.target.value }))} onScroll={(event) => { if (canonOverlayRef.current) canonOverlayRef.current.scrollTop = event.currentTarget.scrollTop; }} value={draft.description} />
                              <div className="codex-canon-highlight" ref={canonOverlayRef}><CanonHighlights content={draft.description} entries={entries} onPreview={(entry) => void openCanonPreview(entry)} selectedEntryId={selectedEntry.metadata.id} /></div>
                            </div>
                          ) : <div aria-label="Current Scene Canon Description" className="textarea canon-editor codex-canon-readonly" role="region"><CanonHighlights content={currentDescription} entries={entries} onPreview={(entry) => void openCanonPreview(entry)} selectedEntryId={selectedEntry.metadata.id} /></div>}</label>
                          {preview ? <aside className="codex-preview-popover" aria-live="polite"><div className="codex-preview-head"><div><span className="label">{stateView === "baseline" ? "Baseline Canon summary" : `Current Scene Canon summary · ${activeScene?.metadata.title ?? "No Scene"}`}</span><strong>{preview.entry.metadata.name}</strong></div><button className="text-button" onClick={() => setPreview(null)} type="button">Close</button></div><p>{preview.loading ? "Loading Current Scene summary…" : preview.description || "No Canon Description"}</p></aside> : null}
                        </div>
                      </section>
                      <section className="card"><header className="card-head"><div><h3>Knowledge boundary</h3><p>World truth, character knowledge, and unresolved ideas remain separate authority records</p></div></header><div className="card-body"><div className="note"><strong>No combined summary</strong><span>This page does not flatten those records into a fabricated card.</span></div></div></section>
                    </div>
                    <aside className="stack">
                      <section className="card"><header className="card-head"><div><h3>Identity</h3><p>Stable naming and classification</p></div></header><div className="card-body stack"><label><span className="label">Name</span><input className="input" disabled={!canEditProjection} onChange={(event) => changeDraft((current) => ({ ...current, name: event.target.value }))} value={draft.name} /></label><label><span className="label">Aliases</span><input className="input" disabled={!canEditProjection} onChange={(event) => changeDraft((current) => ({ ...current, aliases: event.target.value }))} value={draft.aliases} /></label><label><span className="label">Category</span><select className="select" disabled={!canEditProjection} onChange={(event) => changeDraft((current) => ({ ...current, categoryId: event.target.value as CodexCategoryId }))} value={draft.categoryId}>{categories.map((document) => <option key={document.category.id} value={document.category.id}>{document.category.name}</option>)}</select></label></div></section>
                      <section className="card"><header className="card-head"><div><h3>AI context policy</h3><p>Source permissions still take priority</p></div></header><div className="card-body policy-list">{([['always', 'Always include'], ['on-mention', 'When mentioned'], ['manual', 'Manual only'], ['never', 'Never send']] as Array<[CodexAiContextPolicy, string]>).map(([value, label]) => <label className="policy" key={value}><input checked={draft.aiContextPolicy === value} disabled={!canEditProjection} name="codex-policy" onChange={() => changeDraft((current) => ({ ...current, aiContextPolicy: value }))} type="radio" /><span><strong>{label}</strong></span></label>)}</div></section>
                    </aside>
                  </div>
                </section>

                <section className={`tab-panel${activeTab === "research" ? " is-active" : ""}`} data-panel="research" role="tabpanel"><div className="content-grid"><section className="card"><header className="card-head"><div><h3>Research notes</h3><p>Research remains Baseline in both state views</p></div><span className="tag amber">Not Canon</span></header><div className="card-body stack"><textarea className="textarea research-editor" disabled={Boolean(selectedEntry.metadata.archivedAt)} onChange={(event) => changeDraft((current) => ({ ...current, research: event.target.value }))} value={draft.research} /></div></section><aside className="card"><header className="card-head"><div><h3>Sources</h3><p>Reference attachments are not implemented in this connected slice</p></div><button className="text-button" disabled type="button">Add</button></header><div className="card-body"><div className="note"><strong>No linked sources</strong><span>No source cards are shown without real records.</span></div></div></aside></div></section>

                <section className={`tab-panel${activeTab === "details" ? " is-active" : ""}`} data-panel="details" role="tabpanel"><section className="card"><header className="card-head"><div><h3>Structured Details</h3><p>{stateView === "baseline" ? "Saved values and their AI context policy" : `Read-only values effective at ${activeScene?.metadata.title ?? "the Scene open in Write"}`}</p></div><div className="codex-card-actions"><button className="button" disabled={!canEditProjection} onClick={() => { const available = detailTypes.find((document) => document.detailType.categoryId === draft.categoryId && !Object.keys(draft.details).includes(document.detailType.id)); setNewDetail({ detailTypeId: available?.detailType.id ?? "", value: "" }); }} type="button">Add Detail</button><button className="button" onClick={() => openDetailTypeLibrary(draft.categoryId)} type="button">Manage Detail Types</button></div></header><div className="card-body codex-table-wrap"><table className="detail-table"><thead><tr><th>Detail Type</th><th>Value</th><th className="context-col">Send to AI</th></tr></thead><tbody>{Object.entries(displayedDetails).map(([key, value]) => {
                  const open = (x: number, y: number) => openContextMenu("detail", key, x, y);
                  return <tr key={key} onContextMenu={(event) => { if (!canEditProjection) return; event.preventDefault(); open(event.clientX, event.clientY); }} onKeyDown={(event) => canEditProjection && contextMenuFromKeyboard(event, open)} tabIndex={canEditProjection ? 0 : -1}><td className="field-name">{detailLabel(key, detailTypes)}</td><td><textarea aria-label={`${detailLabel(key, detailTypes)} value`} className="detail-value codex-detail-editor" disabled={!canEditProjection} onChange={(event) => changeDraft((current) => ({ ...current, details: { ...current.details, [key]: event.target.value } }))} value={stateView === "baseline" ? draft.details[key] ?? "" : value} /></td><td className="context-col"><button aria-label={`Send ${detailLabel(key, detailTypes)} to AI`} aria-pressed={(currentEntryDocument?.metadata.detailAiContext[key] ?? true) !== false} className="toggle" disabled={!canEditProjection || isBusy} onClick={() => void toggleDetailContext(key)} type="button"></button></td></tr>;
                })}{newDetail && stateView === "baseline" ? <tr className="codex-new-detail"><td><select aria-label="Detail Type" className="select" onChange={(event) => setNewDetail((current) => current ? { ...current, detailTypeId: event.target.value } : current)} value={newDetail.detailTypeId}><option value="">Choose Detail Type</option>{detailTypes.filter((document) => document.detailType.categoryId === draft.categoryId && !Object.keys(draft.details).includes(document.detailType.id)).map((document) => <option key={document.detailType.id} value={document.detailType.id}>{document.detailType.name}</option>)}</select></td><td><textarea aria-label="New Detail value" className="detail-value codex-detail-editor" onChange={(event) => setNewDetail((current) => current ? { ...current, value: event.target.value } : current)} value={newDetail.value} /></td><td className="context-col"><button className="button primary" disabled={!newDetail.detailTypeId || isBusy} onClick={() => void saveNewDetail()} type="button">Save</button></td></tr> : null}</tbody></table>{Object.keys(displayedDetails).length === 0 && !newDetail ? <div className="codex-empty-table">No saved Details.</div> : null}</div></section></section>

                <section className={`tab-panel${activeTab === "relations" ? " is-active" : ""}`} data-panel="relations" role="tabpanel"><section className="card"><header className="card-head"><div><h3>Relations</h3><p>Who relates to whom, with a Simple Description</p></div><button className="button" disabled={Boolean(selectedEntry.metadata.archivedAt)} onClick={() => { const target = activeEntries.find((entry) => entry.metadata.id !== selectedEntry.metadata.id); setRelationForm({ description: "", sourceEntryId: selectedEntry.metadata.id, targetEntryId: target?.metadata.id ?? "" }); setDialog({ kind: "create-relation" }); }} type="button">Add Relation</button></header><div>{relations.length ? relations.map((document) => {
                  const relation = document.relation;
                  const open = (x: number, y: number) => openContextMenu("relation", relation.id, x, y);
                  return <div className="relation-row" key={relation.id} onContextMenu={(event) => { event.preventDefault(); open(event.clientX, event.clientY); }} onKeyDown={(event) => contextMenuFromKeyboard(event, open)} tabIndex={0}><span className="avatar">{initials(entryById.get(relation.targetEntryId)?.metadata.name ?? "Relation")}</span><span className="row-copy"><strong>{entryById.get(relation.sourceEntryId)?.metadata.name ?? "Unknown Entry"} {relation.directed ? "→" : "—"} {entryById.get(relation.targetEntryId)?.metadata.name ?? "Unknown Entry"}</strong><span>{relation.description}</span></span><span className="tag">Relation</span></div>;
                }) : <div className="codex-panel-empty">No Relations for this Entry.</div>}</div></section></section>

                <section className={`tab-panel${activeTab === "progressions" ? " is-active" : ""}`} data-panel="progressions" role="tabpanel"><section className="card"><header className="card-head"><div><h3>State history</h3><p>Ordered by narrative position</p></div><button className="button" disabled={!progressionTarget || !sceneById.has(progressionTarget.sceneId) || !onOpenWrite} onClick={() => progressionTarget && onOpenWrite?.(progressionTarget.sceneId, progressionTarget.blockId)} type="button">Open in Write</button></header><div>{progressions.length ? progressions.map((document) => {
                  const progression = document.progression;
                  const scene = sceneById.get(progression.effectiveFromSceneId);
                  return <button className={`progression-row codex-progression-button${selectedProgression?.progression.id === progression.id ? " is-current" : ""}`} key={progression.id} onClick={() => setSelectedProgressionId(progression.id)} type="button"><span className="scene">Scene: {scene?.metadata.title ?? "Missing target"}</span><span className="timeline-node"></span><span className="row-copy"><strong>{progression.kind} · {progression.operation}</strong><span>{progression.summary || progression.body || "No summary"}</span></span><span className="tag">{progression.source.kind}</span></button>;
                }) : <div className="codex-panel-empty">No Progressions for this Entry.</div>}</div></section></section>

                <section className={`tab-panel${activeTab === "mentions" ? " is-active" : ""}`} data-panel="mentions" role="tabpanel"><section className="card"><header className="card-head codex-mention-head"><div><h3>{mentionSource === "manuscript" ? "Manuscript mentions" : "Codex mentions"}</h3><p>{mentionSource === "manuscript" ? "Scene manuscript references to this Entry" : "References from other Codex content to this Entry"}</p></div><div className="codex-mention-sources" role="tablist" aria-label="Mention source"><button aria-selected={mentionSource === "manuscript"} className={mentionSource === "manuscript" ? "is-active" : ""} onClick={() => setMentionSource("manuscript")} role="tab" type="button">Manuscript mentions <span>{manuscriptMentions.length}</span></button><button aria-selected={mentionSource === "codex"} className={mentionSource === "codex" ? "is-active" : ""} onClick={() => setMentionSource("codex")} role="tab" type="button">Codex mentions <span>{codexMentions.length}</span></button></div></header><div>{mentionSource === "manuscript" ? manuscriptMentions.length ? manuscriptMentions.map((mention, index) => {
                  const scene = sceneById.get(mention.sceneId);
                  const block = scene?.document.blocks.find((candidate) => candidate.kind !== "codexProgression" && "text" in candidate && mention.start <= candidate.text.length);
                  return <div className="mention-row" key={`${mention.sceneId}-${mention.start}-${index}`}><span><strong>{scene?.metadata.title ?? "Missing Scene"}</strong><span className="row-copy"><span>{mention.isAlias ? "Alias match" : "Exact name"}</span></span></span><span className="row-copy"><strong>“{mention.matchedText}”</strong><span>Manuscript occurrence</span></span><button className="button" disabled={!scene || !onOpenWrite} onClick={() => scene && onOpenWrite?.(scene.metadata.id, block?.id ?? null)} type="button">Open Scene</button></div>;
                }) : <div className="codex-panel-empty">No Manuscript mentions.</div> : codexMentions.length ? codexMentions.map((mention, index) => <div className="mention-row codex-content-mention" key={`${mention.sourceEntry.metadata.id}-${mention.fieldLabel}-${index}`}><span><strong>{mention.sourceEntry.metadata.name}</strong><span className="row-copy"><span>{mention.fieldLabel}</span></span></span><span className="row-copy"><strong>{mention.snippet}</strong><span>Matched “{mention.matchedText}”</span></span><button className="button" onClick={() => { setSelectedEntryId(mention.sourceEntry.metadata.id); setActiveTab("canon"); }} type="button">Open Entry</button></div>) : <div className="codex-panel-empty">No Codex mentions.</div>}</div></section></section>
              </div>
            </>
          ) : <div className="codex-no-selection"><strong>{series ? "No Codex Entry selected" : "No Series open"}</strong><span>{series ? "Create or select an Entry to begin." : "Open a Series from the project library."}</span></div>}
        </article>

        {contextMenu ? <div className="codex-context-menu" onPointerDown={(event) => event.stopPropagation()} role="menu" style={{ left: contextMenu.x, top: contextMenu.y }}>{contextMenu.kind === "entry" ? (() => {
          const entry = entryById.get(contextMenu.id);
          if (!entry) return null;
          return <>{entry.metadata.archivedAt ? <button onClick={() => { setContextMenu(null); void setEntryArchived(entry.metadata.id, false); }} role="menuitem" type="button">Restore</button> : <button onClick={() => { setContextMenu(null); void setEntryArchived(entry.metadata.id, true); }} role="menuitem" type="button">Archive</button>}<button className="danger" onClick={() => { setContextMenu(null); setDialog({ entryId: entry.metadata.id, kind: "delete-entry" }); }} role="menuitem" type="button">Delete…</button></>;
        })() : contextMenu.kind === "category" ? (() => {
          const category = categoryById.get(contextMenu.id);
          const disabled = !category || category.category.builtIn || !category.revision;
          return <><button disabled={disabled} onClick={() => { if (!category) return; setRenameCategoryName(category.category.name); setDialog({ categoryId: category.category.id, kind: "rename-category" }); setContextMenu(null); }} role="menuitem" type="button">Rename…</button><button className="danger" disabled={disabled} onClick={() => { if (!category) return; setDialog({ categoryId: category.category.id, kind: "delete-category" }); setContextMenu(null); }} role="menuitem" type="button">Delete…</button>{disabled ? <span className="codex-menu-note">Built-in categories cannot be renamed or deleted.</span> : null}</>;
        })() : contextMenu.kind === "detail" ? <button className="danger" onClick={() => { setDialog({ detailKey: contextMenu.id, kind: "delete-detail" }); setContextMenu(null); }} role="menuitem" type="button">Delete Detail…</button> : contextMenu.kind === "detail-type" ? (() => {
          const detailType = detailTypes.find((document) => document.detailType.id === contextMenu.id);
          if (!detailType) return null;
          return <><button onClick={() => { setRenameDetailTypeName(detailType.detailType.name); setError(null); setDialog({ detailTypeId: contextMenu.id, kind: "rename-detail-type" }); setContextMenu(null); }} role="menuitem" type="button">Rename…</button><button className="danger" onClick={() => { setDialog({ detailTypeId: contextMenu.id, kind: "delete-detail-type" }); setContextMenu(null); }} role="menuitem" type="button">Delete Detail Type…</button></>;
        })() : <button className="danger" onClick={() => { setDialog({ kind: "delete-relation", relationId: contextMenu.id }); setContextMenu(null); }} role="menuitem" type="button">Delete Relation…</button>}</div> : null}

        {dialog ? <div className="backdrop codex-dialog-backdrop is-open" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }} role="presentation"><section aria-labelledby={dialog.kind === "detail-types" ? "schema-title" : dialog.kind === "rename-detail-type" ? "rename-detail-type-title" : undefined} className={`dialog${dialog.kind === "detail-types" ? "" : " small"}`} role="dialog" aria-modal="true"><header className="dialog-head"><div><div className="eyebrow">{dialog.kind === "detail-types" ? "Reusable structure" : "Codex"}</div><h2 id={dialog.kind === "detail-types" ? "schema-title" : dialog.kind === "rename-detail-type" ? "rename-detail-type-title" : undefined}>{dialog.kind === "create-entry" ? "Create Entry" : dialog.kind === "create-category" ? "Create Category" : dialog.kind === "rename-category" ? "Rename Category" : dialog.kind === "rename-detail-type" ? "Rename Detail Type" : dialog.kind === "detail-types" ? "Detail type library" : dialog.kind === "create-relation" ? "Create Relation" : "Confirm permanent action"}</h2>{dialog.kind === "detail-types" ? <p>Define fields once per category, then reuse stable IDs across entries.</p> : null}</div><button className="icon-button" aria-label={dialog.kind === "detail-types" ? "Close detail type library" : "Close dialog"} onClick={closeDialog} type="button">{dialog.kind === "detail-types" ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg> : "×"}</button></header><div className={`dialog-body${dialog.kind === "detail-types" ? " schema-layout" : " create-body"}`}>
          {dialog.kind === "create-entry" ? <><label><span className="label">Name</span><input autoFocus className="input" onChange={(event) => setNewEntry((current) => ({ ...current, name: event.target.value }))} value={newEntry.name} /></label><label><span className="label">Category</span><select className="select" onChange={(event) => setNewEntry((current) => ({ ...current, categoryId: event.target.value as CodexCategoryId }))} value={newEntry.categoryId}>{categories.map((document) => <option key={document.category.id} value={document.category.id}>{document.category.name}</option>)}</select></label><label><span className="label">First Canon Description</span><textarea className="textarea" onChange={(event) => setNewEntry((current) => ({ ...current, description: event.target.value }))} value={newEntry.description} /></label></> : null}
          {dialog.kind === "create-category" ? <label><span className="label">Category name</span><input autoFocus className="input" onChange={(event) => setNewCategoryName(event.target.value)} value={newCategoryName} /></label> : null}
          {dialog.kind === "rename-category" ? <label><span className="label">Category name</span><input autoFocus className="input" onChange={(event) => setRenameCategoryName(event.target.value)} value={renameCategoryName} /></label> : null}
          {dialog.kind === "rename-detail-type" ? <><label><span className="label">Display name</span><input autoFocus className="input" disabled={isBusy} onChange={(event) => setRenameDetailTypeName(event.target.value)} value={renameDetailTypeName} /></label>{error ? <p className="form-error" role="alert">{error}</p> : null}</> : null}
          {dialog.kind === "create-relation" ? <><label><span className="label">From</span><select className="select" onChange={(event) => setRelationForm((current) => ({ ...current, sourceEntryId: event.target.value }))} value={relationForm.sourceEntryId}>{activeEntries.map((entry) => <option key={entry.metadata.id} value={entry.metadata.id}>{entry.metadata.name}</option>)}</select></label><label><span className="label">To</span><select className="select" onChange={(event) => setRelationForm((current) => ({ ...current, targetEntryId: event.target.value }))} value={relationForm.targetEntryId}><option value="">Choose Entry</option>{activeEntries.filter((entry) => entry.metadata.id !== relationForm.sourceEntryId).map((entry) => <option key={entry.metadata.id} value={entry.metadata.id}>{entry.metadata.name}</option>)}</select></label><label><span className="label">Simple Description</span><textarea autoFocus className="textarea" onChange={(event) => setRelationForm((current) => ({ ...current, description: event.target.value }))} value={relationForm.description} /></label></> : null}
          {dialog.kind === "detail-types" ? <>
            <nav className="schema-categories" aria-label="Detail Type categories">
              <div className="group-label">Categories</div>
              {categories.map((document) => {
                const count = detailTypes.filter((detailType) => detailType.detailType.categoryId === document.category.id).length;
                return <button className={`category${managerCategoryId === document.category.id ? " is-active" : ""}`} data-schema-category={document.category.id} key={document.category.id} onClick={() => selectManagerCategory(document.category.id)} type="button"><span className="category-mark">{initials(document.category.name)}</span><span><strong>{document.category.name}</strong><small>{count} detail {count === 1 ? "type" : "types"}</small></span></button>;
              })}
              <button className="category category-create" onClick={() => { setReturnToDetailTypeLibrary(true); setNewCategoryName(""); setDialog({ kind: "create-category" }); }} type="button"><span className="category-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg></span><span><strong>New category</strong><small>Custom category</small></span></button>
            </nav>
            <section className="schema-list">
              <div className="head-row schema-list-head"><div className="group-label" id="schema-list-title">{detailTypeCategoryLabel(categoryById.get(managerCategoryId)?.category.name ?? "Category")} fields</div><button className="icon-button" aria-label="Create Detail Type" onClick={beginCreateDetailType} title="New Detail Type" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></button></div>
              <div className="schema-rows">
                {detailTypeDraft?.isNew ? <button className="schema-row is-active" onClick={() => setManagerDetailTypeId(null)} type="button"><span><strong>{detailTypeDraft.name || "Untitled detail type"}</strong><span>Not used yet</span></span></button> : null}
                {managerDetailTypes.map((document) => {
                  const open = (x: number, y: number) => openContextMenu("detail-type", document.detailType.id, x, y);
                  const useCount = entries.filter((entry) => entry.metadata.categoryId === document.detailType.categoryId && (Object.prototype.hasOwnProperty.call(entry.metadata.details, document.detailType.id) || Object.prototype.hasOwnProperty.call(entry.metadata.details, document.detailType.name))).length;
                  return <button className={`schema-row${managerDetailTypeId === document.detailType.id && !detailTypeDraft?.isNew ? " is-active" : ""}`} data-schema-type={document.detailType.id} key={document.detailType.id} onClick={() => selectManagerDetailType(document)} onContextMenu={(event) => { event.preventDefault(); open(event.clientX, event.clientY); }} onKeyDown={(event) => contextMenuFromKeyboard(event, open)} type="button"><span><strong>{document.detailType.name}</strong><span>{useCount ? `Used by ${useCount} ${useCount === 1 ? "Entry" : "Entries"}` : "Not used yet"}</span></span>{document.detailType.nsfw ? <span className="tag amber">Sensitive</span> : null}</button>;
                })}
                {!detailTypeDraft?.isNew && managerDetailTypes.length === 0 ? <div className="schema-empty">No Detail Types exist in this Category. Use the create control above to define one.</div> : null}
              </div>
            </section>
            <section className="schema-editor">
              {detailTypeDraft ? <>
                <div><div className="eyebrow">Selected detail type</div><h3>{detailTypeDraft.name || "Untitled detail type"}</h3></div>
                <label><span className="label">Display name</span><input className="input" disabled={!detailTypeDraft.isNew || isBusy} onChange={(event) => setDetailTypeDraft((current) => current ? { ...current, name: event.target.value } : current)} value={detailTypeDraft.name} /></label>
                <label><span className="label">Description</span><textarea className="textarea" disabled={isBusy} onChange={(event) => setDetailTypeDraft((current) => current ? { ...current, description: event.target.value } : current)} value={detailTypeDraft.description} /></label>
                <label className="checkline"><input disabled type="checkbox" /> Include in AI context by default</label>
                <label className="checkline"><input checked={detailTypeDraft.nsfw} disabled={isBusy} onChange={(event) => setDetailTypeDraft((current) => current ? { ...current, nsfw: event.target.checked } : current)} type="checkbox" /> Mark as NSFW / sensitive</label>
                <div className="note"><strong>Deletion guard</strong><span>{detailTypeDraft.isNew ? "Save the new Detail Type before lifecycle actions become available." : managerDetailTypeUseCount > 0 ? `This type cannot be deleted while ${managerDetailTypeUseCount} ${managerDetailTypeUseCount === 1 ? "Entry uses" : "Entries use"} its stable ID.` : "Rename and Delete are available from the Detail Type row context menu."}</span></div>
              </> : <div className="schema-empty">No Detail Type selected.</div>}
            </section>
          </> : null}
          {dialog.kind === "delete-category" ? <p>Delete “{categoryById.get(dialog.categoryId)?.category.name}”? Entries in this category will move to Uncategorized. This requires confirmation.</p> : null}
          {dialog.kind === "delete-entry" ? <p>Permanently delete “{entryById.get(dialog.entryId)?.metadata.name}”? The server will reject deletion if live story-state records still reference it.</p> : null}
          {dialog.kind === "delete-detail" ? <p>Delete the saved Detail “{detailLabel(dialog.detailKey, detailTypes)}” from this Entry?</p> : null}
          {dialog.kind === "delete-detail-type" ? <p>Permanently delete “{detailTypes.find((document) => document.detailType.id === dialog.detailTypeId)?.detailType.name}”? The server will block deletion while any Entry uses its stable identifier.</p> : null}
          {dialog.kind === "delete-relation" ? <p>Permanently delete this Relation? The server will block deletion if a Progression, character-knowledge record, or Proposal still references it.</p> : null}
        </div><footer className="dialog-foot"><button className="button" onClick={closeDialog} type="button">Cancel</button>{dialog.kind === "create-entry" ? <button className="button primary" disabled={!newEntry.name.trim() || isBusy} onClick={() => void createEntry()} type="button">Create Entry</button> : dialog.kind === "create-category" ? <button className="button primary" disabled={!newCategoryName.trim() || isBusy} onClick={() => void createCategory()} type="button">Create Category</button> : dialog.kind === "rename-category" ? <button className="button primary" disabled={!renameCategoryName.trim() || isBusy} onClick={() => void renameCategory(dialog.categoryId)} type="button">Rename Category</button> : dialog.kind === "rename-detail-type" ? <button className="button primary" disabled={!renameDetailTypeName.trim() || isBusy} onClick={() => void renameDetailType(dialog.detailTypeId)} type="button">Rename Detail Type</button> : dialog.kind === "create-relation" ? <button className="button primary" disabled={!relationForm.sourceEntryId || !relationForm.targetEntryId || !relationForm.description.trim() || isBusy} onClick={() => void createRelation()} type="button">Create Relation</button> : dialog.kind === "detail-types" ? <button className="button primary" disabled={!detailTypeDraft || !detailTypeDraft.name.trim() || isBusy} onClick={() => void saveDetailTypeLibrary()} type="button">Save library</button> : dialog.kind === "delete-category" ? <button className="button danger" disabled={isBusy} onClick={() => void deleteCategory(dialog.categoryId)} type="button">Delete Category</button> : dialog.kind === "delete-entry" ? <button className="button danger" disabled={isBusy} onClick={() => void deleteEntry(dialog.entryId)} type="button">Delete Entry</button> : dialog.kind === "delete-detail" ? <button className="button danger" disabled={isBusy} onClick={() => void deleteDetail(dialog.detailKey)} type="button">Delete Detail</button> : dialog.kind === "delete-detail-type" ? <button className="button danger" disabled={isBusy} onClick={() => void deleteDetailType(dialog.detailTypeId)} type="button">Delete Detail Type</button> : <button className="button danger" disabled={isBusy} onClick={() => void deleteRelation(dialog.relationId)} type="button">Delete Relation</button>}</footer></section></div> : null}
      </section>
    </>
  );
}
