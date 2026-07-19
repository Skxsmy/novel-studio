import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import {
  MAX_RESEARCH_SOURCE_BYTES,
  type LegacyResearchSourceGroup,
  type ResearchDatabaseDocument,
  type ResearchDatabaseIssue,
  type ResearchDatabaseSummary,
  type ResearchIndexState,
  type ResearchEmbeddingCapabilityState,
  type ResearchQueryExpansion,
  type ResearchQueryExpansionDocument,
  type ResearchRetrievalIssue,
  type ResearchRetrievalMatchChannel,
  type ResearchRetrievalMode,
  type ResearchRetrievalResult,
  type ResearchSourceAiPermission,
  type ResearchSourceBlock,
  type ResearchSourceContentPage,
  type ResearchSourceDocument,
  type ResearchSourceKind,
  type ResearchSourceLocation,
  type ResearchSourceMediaType,
  type ResearchSourceView,
  type ResearchToolAuditCitation,
  type ResearchVectorIndexState,
} from "@novel-studio/contracts";
import {
  BookOpenText,
  Check,
  ChevronDown,
  Database,
  FileText,
  FileUp,
  Globe2,
  Menu,
  Network,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { ApiError, api } from "../../api";
import { ResearchNoteCaptureDialog, ResearchNotesWorkspace } from "./ResearchNotesWorkspace";
import "./reference-research.css";

interface ReferenceResearchWorkspaceProps {
  requestedCitation?: ResearchToolAuditCitation | null;
  seriesId: string | null;
}

interface SourceDraft {
  displayName: string;
  author: string;
  declaredLanguage: string;
  tags: string;
  aiPermission: ResearchSourceAiPermission;
  useNotes: string;
}

interface DatabaseDraft {
  name: string;
  description: string;
  linkedToCurrentSeries: boolean;
}

interface PendingResearchResult {
  query: string;
  result: ResearchRetrievalResult;
}

interface HighlightedResearchPassage {
  blockId: string;
  passageText: string;
  query: string;
}

const DATABASE_SELECTION_KEY = "novel-studio.research.database.selected";
const SOURCE_PAGE_SIZE = 40;

const SOURCE_MEDIA_TYPES: Record<string, ResearchSourceMediaType> = {
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".epub": "application/epub+zip",
  ".htm": "text/html",
  ".html": "text/html",
  ".markdown": "text/markdown",
  ".md": "text/markdown",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".xhtml": "application/xhtml+xml",
};

const SOURCE_FILE_ACCEPT = [
  ".txt", ".md", ".markdown", ".docx", ".pdf", ".epub", ".html", ".htm", ".xhtml",
  ...Object.values(SOURCE_MEDIA_TYPES),
].join(",");

function sourceSelectionKey(databaseId: string): string {
  return `novel-studio.research.source.selected.${databaseId}`;
}

function researchViewKey(databaseId: string): string {
  return `novel-studio.research.view.${databaseId}`;
}

function sourceDraftFromDetail(detail: ResearchSourceView): SourceDraft {
  return {
    displayName: detail.source.displayName,
    author: detail.source.author,
    declaredLanguage: detail.source.declaredLanguage ?? "",
    tags: detail.source.tags.join(", "),
    aiPermission: detail.source.aiPermission,
    useNotes: detail.source.useNotes,
  };
}

function databaseDraftFromDocument(
  document: ResearchDatabaseDocument,
  seriesId: string | null,
): DatabaseDraft {
  return {
    name: document.database.name,
    description: document.database.description,
    linkedToCurrentSeries: seriesId ? document.database.linkedSeriesIds.includes(seriesId) : false,
  };
}

function parseTags(value: string): string[] {
  return value.split(/[,，\n]/u).map((tag) => tag.trim()).filter(Boolean);
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.payload && typeof error.payload === "object") {
    const message = (error.payload as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatImportedAt(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function sourceKindLabel(kind: ResearchSourceKind): string {
  const labels: Record<ResearchSourceKind, string> = {
    docx: "Word",
    epub: "EPUB",
    html: "HTML",
    markdown: "Markdown",
    pdf: "PDF",
    txt: "Text",
    "web-snapshot": "Web snapshot",
  };
  return labels[kind];
}

function sourceKindMark(kind: ResearchSourceKind): string {
  const marks: Record<ResearchSourceKind, string> = {
    docx: "DOCX",
    epub: "EPUB",
    html: "HTML",
    markdown: "MD",
    pdf: "PDF",
    txt: "TXT",
    "web-snapshot": "WEB",
  };
  return marks[kind];
}

function mediaTypeForFile(fileName: string): ResearchSourceMediaType | null {
  const lowerName = fileName.toLocaleLowerCase("en-US");
  const extension = Object.keys(SOURCE_MEDIA_TYPES).find((candidate) => lowerName.endsWith(candidate));
  return extension ? SOURCE_MEDIA_TYPES[extension]! : null;
}

function formatLocation(location: ResearchSourceLocation): string {
  if (location.kind === "text") {
    return location.startLine === location.endLine
      ? `Line ${location.startLine}`
      : `Lines ${location.startLine}-${location.endLine}`;
  }
  if (location.kind === "pdf") return `Page ${location.page} · paragraph ${location.paragraph}`;
  if (location.kind === "docx") {
    return `${location.sectionPath.join(" › ") || "Document"} · paragraph ${location.paragraph}`;
  }
  if (location.kind === "epub") {
    return `${location.sectionPath.join(" › ") || `Spine ${location.spineIndex + 1}`} · paragraph ${location.paragraph}`;
  }
  return `${location.sectionPath.join(" › ") || "Page"} · paragraph ${location.paragraph}`;
}

function matchChannelLabel(channel: ResearchRetrievalMatchChannel): string {
  if (channel === "keyword-cjk") return "CJK";
  if (channel === "keyword-literal") return "Literal";
  if (channel === "keyword-word") return "Word";
  if (channel === "alias") return "Alias";
  if (channel === "transliteration") return "Transliteration";
  if (channel === "query-translation") return "Translation";
  return "Semantic";
}

function findResearchMatchRange(
  blockText: string,
  highlighted: HighlightedResearchPassage | null,
): { start: number; end: number } | null {
  if (!highlighted) return null;
  for (const candidate of [highlighted.query.trim(), highlighted.passageText]) {
    if (!candidate) continue;
    const exactIndex = blockText.indexOf(candidate);
    if (exactIndex >= 0) return { start: exactIndex, end: exactIndex + candidate.length };
    if (/^[\u0000-\u007f]+$/u.test(candidate)) {
      const foldedIndex = blockText.toLocaleLowerCase().indexOf(candidate.toLocaleLowerCase());
      if (foldedIndex >= 0) return { start: foldedIndex, end: foldedIndex + candidate.length };
    }
  }
  return null;
}

function ResearchTextBlock({
  block,
  highlighted,
}: {
  block: ResearchSourceBlock;
  highlighted: HighlightedResearchPassage | null;
}) {
  const isHighlighted = highlighted?.blockId === block.id;
  const range = isHighlighted ? findResearchMatchRange(block.text, highlighted) : null;
  const content: ReactNode = range ? <>
    {block.text.slice(0, range.start)}
    <mark className="rs10-search-match" id={`research-match-${block.id}`}>{block.text.slice(range.start, range.end)}</mark>
    {block.text.slice(range.end)}
  </> : block.text;
  const className = `rs10-text-block is-${block.kind}${isHighlighted ? " is-highlighted" : ""}`;
  const shared = {
    className,
    id: `research-block-${block.id}`,
  };
  if (block.kind === "heading") return <h3 {...shared}>{content}</h3>;
  if (block.kind === "quote") return <blockquote {...shared}>{content}</blockquote>;
  if (block.kind === "list-item") return <p {...shared}><span aria-hidden="true">•</span>{content}</p>;
  return <p {...shared}>{content}</p>;
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.slice(index, index + 0x8000));
  }
  return btoa(binary);
}

function sortDatabases(databases: ResearchDatabaseSummary[]): ResearchDatabaseSummary[] {
  return [...databases].sort((left, right) =>
    left.database.name.localeCompare(right.database.name, "en")
    || left.database.id.localeCompare(right.database.id),
  );
}

export function ReferenceResearchWorkspace({ requestedCitation = null, seriesId }: ReferenceResearchWorkspaceProps) {
  const [databases, setDatabases] = useState<ResearchDatabaseSummary[]>([]);
  const [databaseIssues, setDatabaseIssues] = useState<ResearchDatabaseIssue[]>([]);
  const [databaseListResolved, setDatabaseListResolved] = useState(false);
  const [selectedDatabaseId, setSelectedDatabaseId] = useState<string | null>(null);
  const [databaseDocument, setDatabaseDocument] = useState<ResearchDatabaseDocument | null>(null);
  const [legacyGroups, setLegacyGroups] = useState<LegacyResearchSourceGroup[]>([]);
  const [sources, setSources] = useState<ResearchSourceDocument[]>([]);
  const [sourceShelfDatabaseId, setSourceShelfDatabaseId] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ResearchSourceView | null>(null);
  const [contentPage, setContentPage] = useState<ResearchSourceContentPage | null>(null);
  const [sourceDraft, setSourceDraft] = useState<SourceDraft | null>(null);
  const [savedSourceDraft, setSavedSourceDraft] = useState<SourceDraft | null>(null);
  const [databaseDraft, setDatabaseDraft] = useState<DatabaseDraft | null>(null);
  const [savedDatabaseDraft, setSavedDatabaseDraft] = useState<DatabaseDraft | null>(null);
  const [isLoadingDatabases, setIsLoadingDatabases] = useState(false);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isLoadingContentPage, setIsLoadingContentPage] = useState(false);
  const [sourceLoadRevision, setSourceLoadRevision] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingSource, setIsSavingSource] = useState(false);
  const [isSavingDatabase, setIsSavingDatabase] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isMigratingSources, setIsMigratingSources] = useState(false);
  const [indexState, setIndexState] = useState<ResearchIndexState | null>(null);
  const [isLoadingIndex, setIsLoadingIndex] = useState(false);
  const [isRebuildingIndex, setIsRebuildingIndex] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchScopeIds, setSearchScopeIds] = useState<string[]>([]);
  const [searchMode, setSearchMode] = useState<ResearchRetrievalMode>("hybrid");
  const [searchResults, setSearchResults] = useState<ResearchRetrievalResult[] | null>(null);
  const [searchIssues, setSearchIssues] = useState<ResearchRetrievalIssue[]>([]);
  const [searchNextCursor, setSearchNextCursor] = useState<string | null>(null);
  const [searchEffectiveMode, setSearchEffectiveMode] = useState<"exact" | "hybrid" | "degraded-exact">("exact");
  const [searchResultQuery, setSearchResultQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [scopeMenuOpen, setScopeMenuOpen] = useState(false);
  const [retrievalDialogOpen, setRetrievalDialogOpen] = useState(false);
  const [queryExpansions, setQueryExpansions] = useState<ResearchQueryExpansionDocument | null>(null);
  const [queryExpansionDraft, setQueryExpansionDraft] = useState<ResearchQueryExpansion[]>([]);
  const [isSavingQueryExpansions, setIsSavingQueryExpansions] = useState(false);
  const [embeddingCapability, setEmbeddingCapability] = useState<ResearchEmbeddingCapabilityState | null>(null);
  const [vectorIndexState, setVectorIndexState] = useState<ResearchVectorIndexState | null>(null);
  const [isValidatingCapability, setIsValidatingCapability] = useState(false);
  const [isRebuildingVector, setIsRebuildingVector] = useState(false);
  const [capabilityLanguages, setCapabilityLanguages] = useState("zh-CN, ja, en");
  const [capabilityQueryPrefix, setCapabilityQueryPrefix] = useState("");
  const [capabilityDocumentPrefix, setCapabilityDocumentPrefix] = useState("");
  const [sharedSpaceDeclared, setSharedSpaceDeclared] = useState(false);
  const [pendingSearchResult, setPendingSearchResult] = useState<PendingResearchResult | null>(null);
  const [highlightedPassage, setHighlightedPassage] = useState<HighlightedResearchPassage | null>(null);
  const [pendingExternalCitation, setPendingExternalCitation] = useState<ResearchToolAuditCitation | null>(null);
  const [isCreatingDatabase, setIsCreatingDatabase] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [databaseDialogOpen, setDatabaseDialogOpen] = useState(false);
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
  const [webDialogOpen, setWebDialogOpen] = useState(false);
  const [webUrl, setWebUrl] = useState("");
  const [isImportingWeb, setIsImportingWeb] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [railOpen, setRailOpen] = useState(false);
  const [researchView, setResearchView] = useState<"sources" | "notes">("sources");
  const [noteIsDirty, setNoteIsDirty] = useState(false);
  const [noteRefreshToken, setNoteRefreshToken] = useState(0);
  const [requestedNoteId, setRequestedNoteId] = useState<string | null>(null);
  const [openedSearchResult, setOpenedSearchResult] = useState<ResearchRetrievalResult | null>(null);
  const [captureEvidence, setCaptureEvidence] = useState<ResearchRetrievalResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createNameRef = useRef<HTMLInputElement>(null);
  const webUrlRef = useRef<HTMLInputElement>(null);
  const openedCitationKeyRef = useRef<string | null>(null);

  const sourceIsDirty = !sameValue(sourceDraft, savedSourceDraft);
  const databaseIsDirty = !sameValue(databaseDraft, savedDatabaseDraft);
  const queryExpansionsDirty = !sameValue(queryExpansionDraft, queryExpansions?.expansions.entries ?? []);
  const selectedDatabaseSummary = useMemo(
    () => databases.find((item) => item.database.id === selectedDatabaseId) ?? null,
    [databases, selectedDatabaseId],
  );
  const selectedListDocument = useMemo(
    () => sources.find((document) => document.source.id === selectedSourceId) ?? null,
    [selectedSourceId, sources],
  );
  const versionTwoSources = useMemo(
    () => sources.filter((document) => document.source.schemaVersion === 2),
    [sources],
  );
  const currentLegacyGroup = useMemo(
    () => seriesId ? legacyGroups.find((group) => group.seriesId === seriesId) ?? null : null,
    [legacyGroups, seriesId],
  );
  const legacyAlreadyMigrated = Boolean(
    currentLegacyGroup
    && selectedDatabaseId
    && currentLegacyGroup.migratedResearchDatabaseIds.includes(selectedDatabaseId),
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoadingDatabases(true);
    void Promise.all([api.research.listDatabases(), api.research.listLegacySources()]).then(
      ([result, legacy]) => {
        if (cancelled) return;
        setDatabases(result.databases);
        setDatabaseIssues(result.issues);
        setLegacyGroups(legacy);
        const restored = globalThis.localStorage?.getItem(DATABASE_SELECTION_KEY) ?? null;
        const restoredDatabase = result.databases.find((item) => item.database.id === restored) ?? null;
        const selected = restoredDatabase
          ?? result.databases[0]
          ?? null;
        if (restored && !restoredDatabase) {
          setNotice("The previously selected Research Database is no longer available.");
        }
        const selectedId = selected?.database.id ?? null;
        if (selectedId) {
          globalThis.localStorage?.setItem(DATABASE_SELECTION_KEY, selectedId);
        } else {
          globalThis.localStorage?.removeItem(DATABASE_SELECTION_KEY);
        }
        setSelectedDatabaseId(selectedId);
        setDatabaseListResolved(true);
      },
      (reason) => {
        if (!cancelled) setError(errorMessage(reason, "Research Databases could not be loaded."));
      },
    ).finally(() => {
      if (!cancelled) setIsLoadingDatabases(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setDatabaseDialogOpen(false);
    setDatabaseDraft(null);
    setSavedDatabaseDraft(null);
  }, [seriesId]);

  useEffect(() => {
    if (!requestedCitation || !databaseListResolved) return;
    const key = [
      requestedCitation.researchDatabaseId,
      requestedCitation.sourceId,
      requestedCitation.sourceRevision,
      requestedCitation.blockId,
      requestedCitation.chunkHash,
    ].join(":");
    if (openedCitationKeyRef.current === key) return;
    if (sourceIsDirty || isSavingSource) {
      setError("Save or discard the open source changes before opening Workshop evidence.");
      return;
    }
    if (!databases.some((database) => database.database.id === requestedCitation.researchDatabaseId)) {
      openedCitationKeyRef.current = key;
      setError("The Research Database for this Workshop citation is no longer available.");
      return;
    }
    openedCitationKeyRef.current = key;
    setResearchView("sources");
    setPendingExternalCitation(requestedCitation);
    setSelectedDatabaseId(requestedCitation.researchDatabaseId);
    setSelectedSourceId(requestedCitation.sourceId);
    setRailOpen(false);
    setSearchResults(null);
    setHighlightedPassage(null);
    setNotice("");
    setError("");
  }, [databaseListResolved, databases, isSavingSource, requestedCitation, sourceIsDirty]);

  useEffect(() => {
    if (!selectedDatabaseId) {
      setResearchView("sources");
      setNoteIsDirty(false);
      setRequestedNoteId(null);
      return;
    }
    const restored = globalThis.localStorage?.getItem(researchViewKey(selectedDatabaseId));
    setResearchView(restored === "notes" ? "notes" : "sources");
    setNoteIsDirty(false);
    setRequestedNoteId(null);
  }, [selectedDatabaseId]);

  useEffect(() => {
    setSources([]);
    setSourceShelfDatabaseId(null);
    setSelectedSourceId(null);
    setDetail(null);
    setContentPage(null);
    setSourceDraft(null);
    setSavedSourceDraft(null);
    setDatabaseDocument(null);
    setIndexState(null);
    setQueryExpansions(null);
    setQueryExpansionDraft([]);
    setVectorIndexState(null);
    setSearchQuery("");
    setSearchResults(null);
    setSearchIssues([]);
    setSearchNextCursor(null);
    setSearchResultQuery("");
    setPendingSearchResult((current) =>
      current?.result.researchDatabaseId === selectedDatabaseId ? current : null);
    setHighlightedPassage(null);
    setOpenedSearchResult(null);
    setCaptureEvidence(null);
    setSourceMenuOpen(false);
    setWebDialogOpen(false);
    setError("");
    if (!selectedDatabaseId) {
      if (databaseListResolved) globalThis.localStorage?.removeItem(DATABASE_SELECTION_KEY);
      return;
    }
    setSearchScopeIds((current) => current.length === 0 ? [selectedDatabaseId] : current);
    globalThis.localStorage?.setItem(DATABASE_SELECTION_KEY, selectedDatabaseId);
    let cancelled = false;
    setIsLoadingSources(true);
    void Promise.all([
      api.research.getDatabase(selectedDatabaseId),
      api.research.listSources(selectedDatabaseId),
    ]).then(([database, listed]) => {
      if (cancelled) return;
      setDatabaseDocument(database);
      setSources(listed);
      setSourceShelfDatabaseId(selectedDatabaseId);
      const restored = globalThis.localStorage?.getItem(sourceSelectionKey(selectedDatabaseId)) ?? null;
      const selected = listed.find((document) => document.source.id === restored) ?? listed[0] ?? null;
      if (restored && !listed.some((document) => document.source.id === restored)) {
        setNotice("The previously selected source is no longer available in this database.");
      }
      setSelectedSourceId(selected?.source.id ?? null);
    }).catch((reason) => {
      if (!cancelled) setError(errorMessage(reason, "This Research Database could not be opened."));
    }).finally(() => {
      if (!cancelled) setIsLoadingSources(false);
    });
    return () => {
      cancelled = true;
    };
  }, [databaseListResolved, selectedDatabaseId]);

  useEffect(() => {
    if (!selectedDatabaseId) return;
    let cancelled = false;
    void Promise.allSettled([
      api.research.getQueryExpansions(selectedDatabaseId),
      api.research.getEmbeddingCapability(),
      api.research.getVectorIndexState(selectedDatabaseId),
    ]).then(([expansionsResult, capabilityResult, vectorResult]) => {
      if (cancelled) return;
      if (expansionsResult.status === "fulfilled") {
        setQueryExpansions(expansionsResult.value);
        setQueryExpansionDraft(expansionsResult.value.expansions.entries);
      } else {
        setError(errorMessage(expansionsResult.reason, "Query aliases could not be loaded."));
      }
      if (capabilityResult.status === "fulfilled") {
        setEmbeddingCapability(capabilityResult.value);
        const capability = capabilityResult.value.capability?.capability;
        if (capability) {
          setCapabilityLanguages(capability.supportedLanguageTags.join(", "));
          setCapabilityQueryPrefix(capability.queryPrefix);
          setCapabilityDocumentPrefix(capability.documentPrefix);
          setSharedSpaceDeclared(capability.sharedSpaceDeclared);
        }
      }
      if (vectorResult.status === "fulfilled") setVectorIndexState(vectorResult.value);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedDatabaseId]);

  useEffect(() => {
    if (!selectedDatabaseId) return;
    let cancelled = false;
    setIsLoadingIndex(true);
    void api.research.getIndexState(selectedDatabaseId).then((state) => {
      if (!cancelled) setIndexState(state);
    }).catch((reason) => {
      if (!cancelled) setError(errorMessage(reason, "The search index state could not be read."));
    }).finally(() => {
      if (!cancelled) setIsLoadingIndex(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedDatabaseId]);

  useEffect(() => {
    if (!selectedDatabaseId || !selectedSourceId || sourceShelfDatabaseId !== selectedDatabaseId) {
      setDetail(null);
      setContentPage(null);
      setSourceDraft(null);
      setSavedSourceDraft(null);
      return;
    }
    globalThis.localStorage?.setItem(sourceSelectionKey(selectedDatabaseId), selectedSourceId);
    let cancelled = false;
    setIsLoadingDetail(true);
    setError("");
    setDetail(null);
    setContentPage(null);
    setSourceDraft(null);
    setSavedSourceDraft(null);
    void (async () => {
      try {
        const loaded = await api.research.getSource(selectedDatabaseId, selectedSourceId);
        if (cancelled) return;
        const nextDraft = sourceDraftFromDetail(loaded);
        setDetail(loaded);
        setSourceDraft(nextDraft);
        setSavedSourceDraft(nextDraft);
        if (loaded.source.schemaVersion !== 3) {
          setContentPage(null);
          return;
        }
        try {
          const page = await api.research.getSourceContentPage(
            selectedDatabaseId,
            selectedSourceId,
            0,
            SOURCE_PAGE_SIZE,
          );
          if (!cancelled) setContentPage(page);
        } catch (reason) {
          if (cancelled) return;
          setContentPage(null);
          setError(errorMessage(reason, "The source page could not be opened."));
        }
      } catch (reason) {
        if (cancelled) return;
        setDetail(null);
        setContentPage(null);
        setSourceDraft(null);
        setSavedSourceDraft(null);
        setRailOpen(true);
        if (reason instanceof ApiError && reason.status === 404) {
          setSources((current) => current.filter((document) => document.source.id !== selectedSourceId));
          globalThis.localStorage?.removeItem(sourceSelectionKey(selectedDatabaseId));
          setSelectedSourceId(null);
          setPendingSearchResult(null);
          setSearchResults(null);
        }
        setError(errorMessage(reason, "The selected Research source could not be opened."));
      } finally {
        if (!cancelled) setIsLoadingDetail(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDatabaseId, selectedSourceId, sourceShelfDatabaseId, sourceLoadRevision]);

  useEffect(() => {
    if (!detail || detail.source.schemaVersion !== 3 || !pendingSearchResult || !selectedDatabaseId) return;
    const target = pendingSearchResult.result;
    if (detail.source.id !== target.sourceId) return;
    let cancelled = false;
    const offset = Math.floor(target.blockOrder / SOURCE_PAGE_SIZE) * SOURCE_PAGE_SIZE;
    setIsLoadingContentPage(true);
    void api.research.getSourceContentPage(
      selectedDatabaseId,
      target.sourceId,
      offset,
      SOURCE_PAGE_SIZE,
    ).then((page) => {
      if (cancelled) return;
      setContentPage(page);
      setHighlightedPassage({
        blockId: target.blockId,
        passageText: target.originalText,
        query: pendingSearchResult.query,
      });
      setOpenedSearchResult(target);
      setPendingSearchResult(null);
      setSearchResults(null);
      setError("");
      setNotice(`Opened ${formatLocation(target.location)} in ${target.sourceDisplayName}.`);
    }).catch((reason) => {
      if (!cancelled) {
        setPendingSearchResult(null);
        setOpenedSearchResult(null);
        setNotice("");
        setError(errorMessage(reason, "The matching source page could not be opened."));
      }
    }).finally(() => {
      if (!cancelled) setIsLoadingContentPage(false);
    });
    return () => {
      cancelled = true;
    };
  }, [detail, pendingSearchResult, selectedDatabaseId]);

  useEffect(() => {
    if (
      !pendingSearchResult
      || pendingSearchResult.result.researchDatabaseId !== selectedDatabaseId
      || sourceShelfDatabaseId !== selectedDatabaseId
    ) return;
    if (sources.some((document) => document.source.id === pendingSearchResult.result.sourceId)) {
      setSelectedSourceId(pendingSearchResult.result.sourceId);
    }
  }, [pendingSearchResult, selectedDatabaseId, sourceShelfDatabaseId, sources]);

  useEffect(() => {
    if (
      !pendingExternalCitation
      || pendingExternalCitation.researchDatabaseId !== selectedDatabaseId
      || sourceShelfDatabaseId !== selectedDatabaseId
    ) return;
    if (sources.some((document) => document.source.id === pendingExternalCitation.sourceId)) {
      setSelectedSourceId(pendingExternalCitation.sourceId);
    } else if (!isLoadingSources) {
      setPendingExternalCitation(null);
      setError("The Source for this Workshop citation is no longer available.");
    }
  }, [isLoadingSources, pendingExternalCitation, selectedDatabaseId, sourceShelfDatabaseId, sources]);

  useEffect(() => {
    if (
      !pendingExternalCitation
      || !detail
      || detail.source.id !== pendingExternalCitation.sourceId
      || selectedDatabaseId !== pendingExternalCitation.researchDatabaseId
    ) return;
    let cancelled = false;
    setIsLoadingContentPage(true);
    void api.research.getSourceContentPageForCitation(pendingExternalCitation).then((page) => {
      if (cancelled) return;
      setContentPage(page);
      setHighlightedPassage({
        blockId: pendingExternalCitation.blockId,
        passageText: "",
        query: "",
      });
      setOpenedSearchResult(null);
      setNotice(`Opened ${formatLocation(pendingExternalCitation.location)} from Workshop evidence.`);
      setPendingExternalCitation(null);
      setError("");
    }).catch((reason) => {
      if (!cancelled) {
        setPendingExternalCitation(null);
        setError(errorMessage(reason, "The cited Research passage could not be opened."));
      }
    }).finally(() => {
      if (!cancelled) setIsLoadingContentPage(false);
    });
    return () => {
      cancelled = true;
    };
  }, [detail, pendingExternalCitation, selectedDatabaseId]);

  useEffect(() => {
    if (!highlightedPassage || !contentPage?.blocks.some((block) => block.id === highlightedPassage.blockId)) return;
    const timeout = globalThis.setTimeout(() => {
      const match = document.getElementById(`research-match-${highlightedPassage.blockId}`);
      const block = document.getElementById(`research-block-${highlightedPassage.blockId}`);
      (match ?? block)?.scrollIntoView?.({ block: "center" });
    }, 0);
    return () => globalThis.clearTimeout(timeout);
  }, [contentPage, highlightedPassage]);

  function chooseDatabase(databaseId: string) {
    if (sourceIsDirty || isSavingSource || noteIsDirty) {
      setError(`Save or discard the open ${noteIsDirty ? "Note" : "source"} changes before switching Research Databases.`);
      return;
    }
    setSelectedDatabaseId(databaseId || null);
    setRailOpen(false);
    setNotice("");
    setSearchResults(null);
    setSearchResultQuery("");
    setHighlightedPassage(null);
    setPendingSearchResult(null);
    setOpenedSearchResult(null);
    setCaptureEvidence(null);
    setIsLoadingContentPage(false);
  }

  function chooseSource(sourceId: string) {
    if (sourceIsDirty || isSavingSource) {
      setError("Save or discard the open source changes before switching sources.");
      return;
    }
    if (sourceId === selectedSourceId && !detail && !isLoadingDetail) {
      retrySelectedSource();
      return;
    }
    setSelectedSourceId(sourceId);
    setRailOpen(false);
    setNotice("");
    setSearchResults(null);
    setSearchResultQuery("");
    setHighlightedPassage(null);
    setPendingSearchResult(null);
    setOpenedSearchResult(null);
    setIsLoadingContentPage(false);
  }

  function chooseResearchView(view: "sources" | "notes") {
    if (view === researchView || !selectedDatabaseId) return;
    if (sourceIsDirty || isSavingSource || noteIsDirty) {
      setError(`Save or discard the open ${noteIsDirty ? "Note" : "source"} changes before changing Research views.`);
      return;
    }
    globalThis.localStorage?.setItem(researchViewKey(selectedDatabaseId), view);
    setResearchView(view);
    setRailOpen(false);
    setSourceMenuOpen(false);
    setError("");
    setNotice("");
  }

  function retrySelectedSource() {
    if (!selectedSourceId || isLoadingDetail) return;
    setError("");
    setNotice("");
    setSourceLoadRevision((current) => current + 1);
  }

  function openFilePicker() {
    if (sourceIsDirty || isSavingSource) {
      setError("Save or discard the open source changes before importing another source.");
      return;
    }
    setSourceMenuOpen(false);
    fileInputRef.current?.click();
  }

  function openWebDialog() {
    if (sourceIsDirty || isSavingSource) {
      setError("Save or discard the open source changes before importing another source.");
      return;
    }
    setSourceMenuOpen(false);
    setWebUrl("");
    setDialogError("");
    setWebDialogOpen(true);
    globalThis.setTimeout(() => webUrlRef.current?.focus(), 0);
  }

  function openCreateDialog() {
    setCreateName("");
    setCreateDescription("");
    setDialogError("");
    setCreateDialogOpen(true);
    globalThis.setTimeout(() => createNameRef.current?.focus(), 0);
  }

  async function createDatabase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createName.trim()) return;
    setIsCreatingDatabase(true);
    setDialogError("");
    try {
      const created = await api.research.createDatabase({
        name: createName,
        description: createDescription,
      });
      setDatabases((current) => sortDatabases([
        ...current,
        { ...created, sourceCount: 0 },
      ]));
      setSelectedDatabaseId(created.database.id);
      setCreateDialogOpen(false);
      setNotice(`Created ${created.database.name}.`);
    } catch (reason) {
      setDialogError(errorMessage(reason, "The Research Database could not be created."));
    } finally {
      setIsCreatingDatabase(false);
    }
  }

  function openDatabaseDialog() {
    if (!databaseDocument) return;
    const nextDraft = databaseDraftFromDocument(databaseDocument, seriesId);
    setDatabaseDraft(nextDraft);
    setSavedDatabaseDraft(nextDraft);
    setDialogError("");
    setDatabaseDialogOpen(true);
  }

  function closeDatabaseDialog() {
    if (databaseIsDirty) {
      setDialogError("Save or discard the database changes before closing.");
      return;
    }
    setDatabaseDialogOpen(false);
    setDialogError("");
  }

  function discardDatabaseChanges() {
    setDatabaseDraft(savedDatabaseDraft);
    setDialogError("");
    setDatabaseDialogOpen(false);
  }

  async function saveDatabase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!databaseDocument || !databaseDraft || !databaseIsDirty) return;
    const linkedSeriesIds = [...databaseDocument.database.linkedSeriesIds];
    if (seriesId) {
      const currentIndex = linkedSeriesIds.indexOf(seriesId);
      if (databaseDraft.linkedToCurrentSeries && currentIndex < 0) linkedSeriesIds.push(seriesId);
      if (!databaseDraft.linkedToCurrentSeries && currentIndex >= 0) linkedSeriesIds.splice(currentIndex, 1);
    }
    setIsSavingDatabase(true);
    setDialogError("");
    try {
      const updated = await api.research.updateDatabase(databaseDocument.database.id, {
        baseRevision: databaseDocument.revision,
        name: databaseDraft.name,
        description: databaseDraft.description,
        linkedSeriesIds,
      });
      const nextDraft = databaseDraftFromDocument(updated, seriesId);
      setDatabaseDocument(updated);
      setDatabaseDraft(nextDraft);
      setSavedDatabaseDraft(nextDraft);
      setDatabases((current) => sortDatabases(current.map((item) =>
        item.database.id === updated.database.id ? { ...updated, sourceCount: item.sourceCount } : item,
      )));
      setDatabaseDialogOpen(false);
      setNotice("Research Database settings saved.");
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) {
        try {
          const latest = await api.research.getDatabase(databaseDocument.database.id);
          setDatabaseDocument(latest);
          setSavedDatabaseDraft(databaseDraftFromDocument(latest, seriesId));
          setDialogError("This database changed elsewhere. Your draft is still here; review it and save again.");
        } catch (refreshReason) {
          setDialogError(errorMessage(refreshReason, "The latest database revision could not be loaded."));
        }
      } else {
        setDialogError(errorMessage(reason, "Research Database settings could not be saved."));
      }
    } finally {
      setIsSavingDatabase(false);
    }
  }

  async function migrateLegacySources() {
    if (!databaseDocument || !seriesId || !currentLegacyGroup || legacyAlreadyMigrated) return;
    if (!databaseDocument.database.linkedSeriesIds.includes(seriesId)) {
      setDialogError("Link this database to the current Series and save before copying legacy sources.");
      return;
    }
    setIsMigrating(true);
    setDialogError("");
    try {
      const result = await api.research.migrateLegacySources(databaseDocument.database.id, seriesId);
      const listed = await api.research.listSources(databaseDocument.database.id);
      setSources(listed);
      setLegacyGroups((current) => current.map((group) => group.seriesId === seriesId ? {
        ...group,
        migratedResearchDatabaseIds: [...group.migratedResearchDatabaseIds, databaseDocument.database.id],
      } : group));
      setDatabases((current) => current.map((item) => item.database.id === databaseDocument.database.id
        ? { ...item, sourceCount: listed.length }
        : item));
      setNotice(`Copied ${result.importedSourceIds.length} legacy source${result.importedSourceIds.length === 1 ? "" : "s"}.`);
    } catch (reason) {
      setDialogError(errorMessage(reason, "Legacy Research sources could not be copied."));
    } finally {
      setIsMigrating(false);
    }
  }

  function applyImportedDetail(created: ResearchSourceView, message: string) {
    setSources((current) => [
      { source: created.source, revision: created.revision },
      ...current.filter((document) => document.source.id !== created.source.id),
    ]);
    setDatabases((current) => current.map((item) => item.database.id === created.source.researchDatabaseId
      ? { ...item, sourceCount: item.sourceCount + 1 }
      : item));
    setSelectedSourceId(created.source.id);
    const nextDraft = sourceDraftFromDetail(created);
    setDetail(created);
    setContentPage(null);
    setSourceDraft(nextDraft);
    setSavedSourceDraft(nextDraft);
    setSearchResults(null);
    setSearchResultQuery("");
    globalThis.localStorage?.setItem(researchViewKey(created.source.researchDatabaseId), "sources");
    setResearchView("sources");
    setNotice(message);
  }

  async function refreshIndexState(databaseId: string) {
    try {
      setIndexState(await api.research.getIndexState(databaseId));
    } catch {
      setIndexState(null);
    }
  }

  async function openContentPage(offset: number) {
    if (!selectedDatabaseId || !detail || detail.source.schemaVersion !== 3 || isLoadingContentPage) return;
    setIsLoadingContentPage(true);
    setError("");
    try {
      setContentPage(await api.research.getSourceContentPage(
        selectedDatabaseId,
        detail.source.id,
        offset,
        SOURCE_PAGE_SIZE,
      ));
      setHighlightedPassage(null);
      setOpenedSearchResult(null);
    } catch (reason) {
      setError(errorMessage(reason, "The source page could not be opened."));
    } finally {
      setIsLoadingContentPage(false);
    }
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedDatabaseId) return;
    if (sourceIsDirty || isSavingSource) {
      setError("Save or discard the open source changes before importing another source.");
      return;
    }
    setError("");
    setNotice("");
    const mediaType = mediaTypeForFile(file.name);
    if (!mediaType) {
      setError("Choose a TXT, Markdown, Word (.docx), text PDF, EPUB, HTML, or XHTML file.");
      return;
    }
    if (file.size === 0) {
      setError("The selected file is empty.");
      return;
    }
    if (file.size > MAX_RESEARCH_SOURCE_BYTES) {
      setError(`The selected file is larger than ${formatBytes(MAX_RESEARCH_SOURCE_BYTES)}.`);
      return;
    }
    setIsUploading(true);
    try {
      const created = await api.research.importSource(selectedDatabaseId, {
        fileName: file.name,
        mediaType,
        sizeBytes: file.size,
        contentBase64: await fileToBase64(file),
      });
      applyImportedDetail(created, `Imported ${created.source.originalFileName}.`);
      await refreshIndexState(selectedDatabaseId);
    } catch (reason) {
      setError(errorMessage(reason, "The Research source could not be imported."));
    } finally {
      setIsUploading(false);
    }
  }

  async function importWebSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDatabaseId || !webUrl.trim()) return;
    setIsImportingWeb(true);
    setDialogError("");
    try {
      const created = await api.research.importWebSource(selectedDatabaseId, { url: webUrl.trim() });
      applyImportedDetail(created, `Saved a snapshot of ${created.source.displayName}.`);
      setWebDialogOpen(false);
      await refreshIndexState(selectedDatabaseId);
    } catch (reason) {
      setDialogError(errorMessage(reason, "The web page could not be imported."));
    } finally {
      setIsImportingWeb(false);
    }
  }

  async function searchDatabase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDatabaseId || !searchQuery.trim() || searchScopeIds.length === 0) return;
    if (sourceIsDirty || isSavingSource) {
      setError("Save or discard the open source changes before searching this database.");
      return;
    }
    setIsSearching(true);
    setError("");
    setNotice("");
    setOpenedSearchResult(null);
    setHighlightedPassage(null);
    try {
      const response = await api.research.searchDatabases({
        databaseIds: searchScopeIds,
        query: searchQuery.trim(),
        purpose: "local",
        mode: searchMode,
        limit: 20,
      });
      setSearchResults(response.results);
      setSearchResultQuery(response.query);
      setSearchIssues(response.issues);
      setSearchNextCursor(response.nextCursor);
      setSearchEffectiveMode(response.effectiveMode);
      await refreshIndexState(selectedDatabaseId);
    } catch (reason) {
      setError(errorMessage(reason, "This Research Database could not be searched."));
    } finally {
      setIsSearching(false);
    }
  }

  async function loadMoreSearchResults() {
    if (!searchNextCursor || !searchQuery.trim() || isSearching) return;
    setIsSearching(true);
    setError("");
    try {
      const response = await api.research.searchDatabases({
        databaseIds: searchScopeIds,
        query: searchQuery.trim(),
        purpose: "local",
        mode: searchMode,
        limit: 20,
        cursor: searchNextCursor,
      });
      setSearchResults((current) => [...(current ?? []), ...response.results]);
      setSearchIssues(response.issues);
      setSearchNextCursor(response.nextCursor);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) {
        try {
          const refreshed = await api.research.searchDatabases({
            databaseIds: searchScopeIds,
            query: searchQuery.trim(),
            purpose: "local",
            mode: searchMode,
            limit: 20,
          });
          setSearchResults(refreshed.results);
          setSearchResultQuery(refreshed.query);
          setSearchIssues(refreshed.issues);
          setSearchNextCursor(refreshed.nextCursor);
          setSearchEffectiveMode(refreshed.effectiveMode);
          setNotice("Research sources or retrieval settings changed. Results were refreshed from the beginning.");
        } catch (refreshReason) {
          setError(errorMessage(refreshReason, "Research results changed and could not be refreshed."));
        }
      } else {
        setError(errorMessage(reason, "More Research results could not be loaded."));
      }
    } finally {
      setIsSearching(false);
    }
  }

  function openSearchResult(result: ResearchRetrievalResult) {
    if (sourceIsDirty || isSavingSource) {
      setError("Save or discard the open source changes before opening a search result.");
      return;
    }
    const retryUnavailableSource = result.sourceId === selectedSourceId && !detail && !isLoadingDetail;
    setOpenedSearchResult(null);
    setPendingSearchResult({ query: searchResultQuery, result });
    if (result.researchDatabaseId !== selectedDatabaseId) {
      setSelectedDatabaseId(result.researchDatabaseId);
    }
    setSelectedSourceId(result.sourceId);
    if (retryUnavailableSource) setSourceLoadRevision((current) => current + 1);
    setRailOpen(false);
    setError("");
    setNotice("");
  }

  function toggleSearchScope(databaseId: string) {
    setSearchScopeIds((current) => {
      if (current.includes(databaseId)) {
        if (current.length === 1) return current;
        return current.filter((id) => id !== databaseId);
      }
      if (current.length >= 12) {
        setError("A search can include at most 12 Research Databases.");
        return current;
      }
      return [...current, databaseId];
    });
    setSearchResults(null);
    setSearchIssues([]);
    setSearchNextCursor(null);
  }

  function addQueryExpansion() {
    setQueryExpansionDraft((current) => [...current, {
      id: crypto.randomUUID(),
      queryTerm: "",
      expansionTerm: "",
      channel: "alias",
      queryLanguageTag: null,
      expansionLanguageTag: null,
      note: "",
    }]);
  }

  async function saveQueryExpansions() {
    if (!selectedDatabaseId || !queryExpansions) return;
    setIsSavingQueryExpansions(true);
    setDialogError("");
    try {
      const saved = await api.research.updateQueryExpansions(selectedDatabaseId, {
        baseRevision: queryExpansions.revision,
        entries: queryExpansionDraft,
      });
      setQueryExpansions(saved);
      setQueryExpansionDraft(saved.expansions.entries);
      setNotice("Database query aliases saved.");
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) {
        try {
          const latest = await api.research.getQueryExpansions(selectedDatabaseId);
          setQueryExpansions(latest);
          setDialogError("These aliases changed elsewhere. Your draft remains here; review it and save again.");
        } catch (refreshReason) {
          setDialogError(errorMessage(refreshReason, "The latest aliases could not be loaded."));
        }
      } else {
        setDialogError(errorMessage(reason, "Query aliases could not be saved."));
      }
    } finally {
      setIsSavingQueryExpansions(false);
    }
  }

  function openRetrievalDialog() {
    setDialogError("");
    setRetrievalDialogOpen(true);
    if (!selectedDatabaseId) return;
    void Promise.all([
      api.research.getEmbeddingCapability(),
      api.research.getVectorIndexState(selectedDatabaseId),
    ]).then(([capability, vectorState]) => {
      setEmbeddingCapability(capability);
      setVectorIndexState(vectorState);
    }).catch((reason) => {
      setDialogError(errorMessage(reason, "Retrieval state could not be refreshed."));
    });
  }

  async function validateEmbeddingCapability() {
    setIsValidatingCapability(true);
    setDialogError("");
    try {
      await api.research.validateEmbeddingCapability({
        supportedLanguageTags: parseTags(capabilityLanguages),
        sharedSpaceDeclared,
        documentPrefix: capabilityDocumentPrefix,
        queryPrefix: capabilityQueryPrefix,
      });
      const state = await api.research.getEmbeddingCapability();
      setEmbeddingCapability(state);
      setNotice(state.usable ? "Multilingual Embedding validation passed." : state.reason ?? "Validation failed.");
    } catch (reason) {
      setDialogError(errorMessage(reason, "Multilingual Embedding validation could not run."));
    } finally {
      setIsValidatingCapability(false);
    }
  }

  async function rebuildVectorIndex() {
    if (!selectedDatabaseId) return;
    setIsRebuildingVector(true);
    setDialogError("");
    try {
      const state = await api.research.rebuildVectorIndex(selectedDatabaseId);
      setVectorIndexState(state);
      setNotice(`Semantic index rebuilt for ${state.indexedChunkCount} permitted passage${state.indexedChunkCount === 1 ? "" : "s"}.`);
    } catch (reason) {
      setDialogError(errorMessage(reason, "The semantic index could not be rebuilt."));
    } finally {
      setIsRebuildingVector(false);
    }
  }

  async function rebuildIndex() {
    if (!selectedDatabaseId || isRebuildingIndex) return;
    if (sourceIsDirty || isSavingSource) {
      setError("Save or discard the open source changes before rebuilding search.");
      return;
    }
    setIsRebuildingIndex(true);
    setError("");
    try {
      const rebuilt = await api.research.rebuildIndex(selectedDatabaseId);
      setIndexState(rebuilt);
      setNotice(`Search rebuilt for ${rebuilt.indexedSourceCount} source${rebuilt.indexedSourceCount === 1 ? "" : "s"}.`);
    } catch (reason) {
      setError(errorMessage(reason, "Search could not be rebuilt."));
    } finally {
      setIsRebuildingIndex(false);
    }
  }

  async function migrateVersionTwoSources() {
    if (!selectedDatabaseId || versionTwoSources.length === 0 || isMigratingSources) return;
    if (sourceIsDirty || isSavingSource) {
      setError("Save or discard the open source changes before upgrading older sources.");
      return;
    }
    setIsMigratingSources(true);
    setError("");
    try {
      const result = await api.research.migrateSourcesV2(selectedDatabaseId, {
        sources: versionTwoSources.map((document) => ({
          sourceId: document.source.id,
          baseRevision: document.revision,
        })),
      });
      const listed = await api.research.listSources(selectedDatabaseId);
      setSources(listed);
      setIndexState(result.indexState);
      if (selectedSourceId) {
        const loaded = await api.research.getSource(selectedDatabaseId, selectedSourceId);
        const nextDraft = sourceDraftFromDetail(loaded);
        setDetail(loaded);
        setSourceDraft(nextDraft);
        setSavedSourceDraft(nextDraft);
      }
      setNotice(`Upgraded ${result.migratedSourceIds.length} older source${result.migratedSourceIds.length === 1 ? "" : "s"}.`);
    } catch (reason) {
      setError(errorMessage(reason, "Older Research sources could not be upgraded."));
    } finally {
      setIsMigratingSources(false);
    }
  }

  async function saveSourceProperties(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDatabaseId || !detail || !sourceDraft || !sourceIsDirty) return;
    const tags = parseTags(sourceDraft.tags);
    const normalizedTags = tags.map((tag) => tag.toLocaleLowerCase("und"));
    if (new Set(normalizedTags).size !== normalizedTags.length) {
      setError("Remove duplicate tags before saving.");
      return;
    }
    setIsSavingSource(true);
    setError("");
    setNotice("");
    try {
      const updated = await api.research.updateSource(selectedDatabaseId, detail.source.id, {
        baseRevision: detail.revision,
        displayName: sourceDraft.displayName,
        author: sourceDraft.author,
        declaredLanguage: sourceDraft.declaredLanguage.trim() || null,
        tags,
        aiPermission: sourceDraft.aiPermission,
        useNotes: sourceDraft.useNotes,
      });
      const nextDraft = sourceDraftFromDetail(updated);
      setDetail(updated);
      setSourceDraft(nextDraft);
      setSavedSourceDraft(nextDraft);
      setSources((current) => current.map((document) => document.source.id === updated.source.id
        ? { source: updated.source, revision: updated.revision }
        : document));
      setNotice("Source properties saved.");
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) {
        try {
          const latest = await api.research.getSource(selectedDatabaseId, detail.source.id);
          setDetail(latest);
          setSavedSourceDraft(sourceDraftFromDetail(latest));
          setSources((current) => current.map((document) => document.source.id === latest.source.id
            ? { source: latest.source, revision: latest.revision }
            : document));
          setError("This source changed elsewhere. Your draft is still here; review it and save again.");
        } catch (refreshReason) {
          setError(errorMessage(refreshReason, "The latest source revision could not be loaded."));
        }
      } else {
        setError(errorMessage(reason, "Source properties could not be saved."));
      }
    } finally {
      setIsSavingSource(false);
    }
  }

  function discardSourceDraft() {
    if (!savedSourceDraft) return;
    setSourceDraft(savedSourceDraft);
    setError("");
    setNotice("");
  }

  return (
    <section aria-label="Research workspace" className="rs8 rs9 workspace-view" data-workspace-view="Research" hidden id="research-workspace">
      <header className="rs8-toolbar rs9-toolbar">
        <div className="rs8-heading">
          <button aria-expanded={railOpen} aria-label={`Toggle ${researchView === "sources" ? "source" : "Note"} shelf`} className="rs8-rail-toggle" onClick={() => setRailOpen((open) => !open)} title={`Toggle ${researchView === "sources" ? "source" : "Note"} shelf`} type="button"><Menu aria-hidden="true" size={17} /></button>
          <div><p>Reference library</p><h1>Research</h1></div>
        </div>
        <div className="rs9-database-controls">
          <label className="rs9-database-select"><span>Research Database</span><select aria-label="Research Database" disabled={isLoadingDatabases || databases.length === 0 || noteIsDirty} onChange={(event) => chooseDatabase(event.target.value)} value={selectedDatabaseId ?? ""}><option value="">{isLoadingDatabases ? "Loading databases" : "No databases"}</option>{databases.map((item) => <option key={item.database.id} value={item.database.id}>{item.database.name}</option>)}</select></label>
          <button aria-label="Create Research Database" className="rs9-icon-button" disabled={noteIsDirty} onClick={openCreateDialog} title="Create Research Database" type="button"><Plus aria-hidden="true" size={17} /></button>
          <button aria-label="Database settings" className="rs9-settings-button" disabled={!databaseDocument || noteIsDirty} onClick={openDatabaseDialog} type="button"><Settings2 aria-hidden="true" size={14} /><span className="rs9-settings-wide">Database settings</span><span className="rs9-settings-compact">Settings</span></button>
          <div aria-label="Research content" className="rs12-view-tabs" role="tablist"><button aria-selected={researchView === "sources"} disabled={researchView === "notes" && noteIsDirty} onClick={() => chooseResearchView("sources")} role="tab" type="button">Sources</button><button aria-selected={researchView === "notes"} disabled={!selectedDatabaseId || (researchView === "sources" && sourceIsDirty)} onClick={() => chooseResearchView("notes")} role="tab" type="button">Notes</button></div>
        </div>
        <div className="rs10-add-source">
          <button aria-expanded={sourceMenuOpen} aria-haspopup="menu" className="rs8-upload" disabled={!selectedDatabaseId || isUploading || isImportingWeb || isSavingSource || sourceIsDirty || noteIsDirty} onClick={() => setSourceMenuOpen((open) => !open)} type="button"><Plus aria-hidden="true" size={15} />{isUploading || isImportingWeb ? "Importing" : "Add source"}<ChevronDown aria-hidden="true" size={13} /></button>
          {sourceMenuOpen ? <div aria-label="Add source" className="rs10-source-menu" role="menu"><button onClick={openFilePicker} role="menuitem" type="button"><FileUp aria-hidden="true" size={16} /><span><strong>File</strong><small>Text, Word, PDF, EPUB, or HTML</small></span></button><button onClick={openWebDialog} role="menuitem" type="button"><Globe2 aria-hidden="true" size={16} /><span><strong>Web address</strong><small>Save a controlled page snapshot</small></span></button></div> : null}
        </div>
        <input accept={SOURCE_FILE_ACCEPT} aria-label="Choose a Research source file" hidden onChange={(event) => void importFile(event)} ref={fileInputRef} type="file" />
      </header>

      <div className={`rs8-layout${railOpen ? " is-rail-open" : ""}`}>
        {researchView === "sources" ? <>
        <aside aria-label="Research sources" className="rs8-rail">
          <div className="rs8-rail-head"><strong>{selectedDatabaseSummary?.database.name ?? "Sources"}</strong><span>{sources.length}</span></div>
          {selectedDatabaseId ? <section aria-label="Search index" className={`rs10-index-state is-${indexState?.status ?? "unknown"}`}><Database aria-hidden="true" size={15} /><div><strong>{isLoadingIndex ? "Checking search" : indexState?.status === "ready" ? "Search ready" : indexState?.status === "damaged" ? "Search damaged" : indexState?.status === "stale" ? "Search out of date" : indexState?.status === "missing" ? "Search not built" : "Search unavailable"}</strong><span>{indexState?.status === "ready" ? `${indexState.indexedChunkCount} searchable passages` : indexState?.reason ?? "Rebuild to prepare this database."}</span></div><button aria-label="Rebuild search index" disabled={isRebuildingIndex || isLoadingSources || sourceIsDirty} onClick={() => void rebuildIndex()} title="Rebuild search index" type="button"><RefreshCw aria-hidden="true" className={isRebuildingIndex ? "is-spinning" : ""} size={15} /></button></section> : null}
          {versionTwoSources.length > 0 ? <button className="rs10-upgrade" disabled={isMigratingSources || sourceIsDirty} onClick={() => void migrateVersionTwoSources()} type="button"><RefreshCw aria-hidden="true" size={14} /><span><strong>{isMigratingSources ? "Upgrading sources" : "Upgrade older sources"}</strong><small>{versionTwoSources.length} source{versionTwoSources.length === 1 ? "" : "s"} need location-aware text</small></span></button> : null}
          {!selectedDatabaseId ? <div className="rs8-rail-empty"><strong>No Research Database selected</strong><p>Create a database to start an isolated source shelf.</p></div> : isLoadingSources ? <div aria-live="polite" className="rs8-loading">Loading source shelf</div> : sources.length === 0 ? <div className="rs8-rail-empty"><strong>This source shelf is empty</strong><p>Add a file or save a web page to this isolated database.</p></div> : <div className="rs8-source-list">{sources.map((document) => { const source = document.source; const selected = source.id === selectedSourceId; return <button aria-current={selected ? "true" : undefined} className={`rs8-source${selected ? " is-selected" : ""}`} disabled={isSavingSource || (sourceIsDirty && !selected)} key={source.id} onClick={() => chooseSource(source.id)} title={source.displayName} type="button"><span aria-hidden="true" className="rs8-spine"><i /></span><span className="rs8-source-copy"><strong>{source.displayName}</strong><span>{sourceKindLabel(source.kind)} · {source.declaredLanguage ?? "Language not set"}</span></span><span aria-label="Parsed" className="rs8-ready">Ready</span></button>; })}</div>}
        </aside>

        <main className="rs8-reader">
          {(error || notice) ? <div aria-live="polite" className={`rs8-banner${error ? " is-error" : ""}`} role={error ? "alert" : "status"}>{error || notice}</div> : null}
          {databaseIssues.length > 0 ? <div className="rs8-banner is-error" role="alert">{databaseIssues.length} Research Database {databaseIssues.length === 1 ? "directory could" : "directories could"} not be opened. Other databases remain available.</div> : null}
          {selectedDatabaseId ? <div className="rs11-search-console">
            <div className="rs11-search-options">
              <div className="rs11-scope-control">
                <button aria-expanded={scopeMenuOpen} aria-haspopup="menu" onClick={() => setScopeMenuOpen((open) => !open)} type="button"><Database aria-hidden="true" size={14} /><span>{searchScopeIds.length} database{searchScopeIds.length === 1 ? "" : "s"}</span><ChevronDown aria-hidden="true" size={13} /></button>
                {scopeMenuOpen ? <div aria-label="Search scope" className="rs11-scope-menu" role="menu">{databases.map((item) => { const checked = searchScopeIds.includes(item.database.id); return <label key={item.database.id}><input checked={checked} disabled={!checked && searchScopeIds.length >= 12} onChange={() => toggleSearchScope(item.database.id)} type="checkbox" /><span><strong>{item.database.name}</strong><small>{item.sourceCount} source{item.sourceCount === 1 ? "" : "s"}</small></span>{checked ? <Check aria-hidden="true" size={14} /> : null}</label>; })}</div> : null}
              </div>
              <div aria-label="Retrieval mode" className="rs11-mode-switch" role="group"><button aria-pressed={searchMode === "exact"} onClick={() => { setSearchMode("exact"); setSearchResults(null); }} type="button">Exact</button><button aria-pressed={searchMode === "hybrid"} onClick={() => { setSearchMode("hybrid"); setSearchResults(null); }} type="button">Hybrid</button></div>
              <button aria-label="Retrieval settings" className="rs11-retrieval-settings" onClick={openRetrievalDialog} title="Retrieval settings" type="button"><SlidersHorizontal aria-hidden="true" size={15} /></button>
            </div>
            <form className="rs10-searchbar" onSubmit={(event) => void searchDatabase(event)} role="search"><Search aria-hidden="true" size={17} /><label><span className="rs10-visually-hidden">Search selected Research Databases</span><input aria-label="Search selected Research Databases" disabled={isSearching || sourceIsDirty} maxLength={500} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search original-language evidence across the selected databases" value={searchQuery} /></label>{searchQuery || searchResults !== null ? <button aria-label="Clear search" className="rs10-search-clear" disabled={isSearching} onClick={() => { setSearchQuery(""); setSearchResults(null); setSearchIssues([]); setSearchNextCursor(null); setSearchResultQuery(""); setPendingSearchResult(null); setHighlightedPassage(null); setIsLoadingContentPage(false); }} title="Clear search" type="button"><X aria-hidden="true" size={15} /></button> : null}<button className="rs10-search-submit" disabled={isSearching || sourceIsDirty || !searchQuery.trim() || searchScopeIds.length === 0} type="submit">{isSearching ? "Searching" : "Search"}</button></form>
          </div> : null}
          {indexState && indexState.status !== "ready" && sources.length > 0 ? <div className={`rs10-index-callout is-${indexState.status}`}><div><strong>{indexState.status === "damaged" ? "Search needs repair" : indexState.status === "stale" ? "Sources changed since the last index" : "Search will be built when needed"}</strong><span>{indexState.reason ?? "The original sources remain available."}</span></div>{indexState.status !== "missing" ? <button disabled={isRebuildingIndex || sourceIsDirty} onClick={() => void rebuildIndex()} type="button"><RefreshCw aria-hidden="true" size={14} />{isRebuildingIndex ? "Rebuilding" : "Rebuild"}</button> : null}</div> : null}
          {searchResults !== null ? <section aria-label="Search results" className="rs10-search-results rs11-search-results">
            <header><div><p>{searchScopeIds.length} database{searchScopeIds.length === 1 ? "" : "s"} · {searchEffectiveMode === "degraded-exact" ? "Hybrid degraded to Exact" : `${searchEffectiveMode[0]?.toUpperCase()}${searchEffectiveMode.slice(1)}`}</p><h2>{searchResults.length} result{searchResults.length === 1 ? "" : "s"} for “{searchResultQuery}”</h2></div><span>Original-language evidence</span></header>
            {searchIssues.length > 0 ? <div className="rs11-retrieval-issues">{searchIssues.map((issue) => <p key={`${issue.researchDatabaseId}:${issue.code}`}><strong>{databases.find((item) => item.database.id === issue.researchDatabaseId)?.database.name ?? "Unavailable database"}</strong><span>{issue.message}</span></p>)}</div> : null}
            {searchResults.length === 0 ? <div className="rs10-no-results"><Search aria-hidden="true" size={22} /><strong>No matching passage</strong><p>Try another spelling, add an alias, or review the selected databases and retrieval mode.</p></div> : <><ol>{searchResults.map((result) => <li key={`${result.researchDatabaseId}:${result.sourceId}:${result.chunkId}`}><button disabled={isLoadingContentPage || isLoadingDetail} onClick={() => openSearchResult(result)} type="button"><span className="rs11-result-database"><Database aria-hidden="true" size={13} />{result.researchDatabaseName}</span><span className="rs10-location-ribbon"><BookOpenText aria-hidden="true" size={14} /><strong>{formatLocation(result.location)}</strong><em>{result.languageTag}</em></span><span className="rs10-result-source">{result.sourceDisplayName}<small>{sourceKindLabel(result.sourceKind)}</small></span><span className="rs10-result-text">{result.originalText}</span><span className="rs10-match-channels">{result.channelContributions.map((contribution) => <small key={contribution.channel} title={`Rank ${contribution.rank} for ${contribution.matchedQuery}`}>{matchChannelLabel(contribution.channel)}</small>)}</span></button></li>)}</ol>{searchNextCursor ? <button className="rs11-load-more" disabled={isSearching} onClick={() => void loadMoreSearchResults()} type="button">{isSearching ? "Loading" : "Load more"}</button> : null}</>}
          </section> : isLoadingDatabases ? <div aria-live="polite" className="rs8-reader-loading"><span /><p>Opening Research Databases</p></div> : !selectedDatabaseId ? <div className="rs8-empty"><Database aria-hidden="true" size={23} /><h2>Create your first Research Database</h2><p>Each database keeps its own sources, originals, permissions, and search index. It does not belong to a Series.</p><button onClick={openCreateDialog} type="button">Create Research Database</button></div> : isLoadingDetail ? <div aria-live="polite" className="rs8-reader-loading"><span /><p>Opening source</p></div> : detail ? <article className="rs8-document"><header><div className="rs8-document-mark"><span aria-hidden="true" /><em>{sourceKindMark(detail.source.kind)}</em></div><div><p>{detail.source.originalFileName}</p><h2>{detail.source.displayName}</h2><span>{databaseDocument?.database.name} · Imported {formatImportedAt(detail.source.importedAt)} · {formatBytes(detail.source.sizeBytes)}</span></div></header>{detail.source.schemaVersion === 3 && detail.source.parseWarnings.length > 0 ? <div className="rs10-parse-warning"><strong>Imported with {detail.source.parseWarnings.length} warning{detail.source.parseWarnings.length === 1 ? "" : "s"}</strong><span>{detail.source.parseWarnings.join(" ")}</span></div> : null}<div className="rs8-preview-label"><strong>{"originalText" in detail ? "Original text" : "Parsed text"}</strong><span>{"originalText" in detail ? "Upgrade this source to add locations" : `${detail.contentSummary.blockCount} blocks · locations preserved from the original`}</span></div>{"originalText" in detail ? <pre className="rs8-preview">{detail.originalText}</pre> : isLoadingContentPage && !contentPage ? <div aria-live="polite" className="rs8-reader-loading"><span /><p>Opening source page</p></div> : contentPage ? <><div className="rs10-text-blocks">{contentPage.blocks.map((block) => <ResearchTextBlock block={block} highlighted={block.id === highlightedPassage?.blockId ? highlightedPassage : null} key={block.id} />)}</div><nav aria-label="Source pages" className="rs10-source-pages"><button disabled={contentPage.previousOffset === null || isLoadingContentPage} onClick={() => void openContentPage(contentPage.previousOffset ?? 0)} type="button">Previous</button><span>Blocks {contentPage.offset + 1}-{contentPage.offset + contentPage.blocks.length} of {contentPage.totalBlocks}</span><button disabled={contentPage.nextOffset === null || isLoadingContentPage} onClick={() => void openContentPage(contentPage.nextOffset ?? 0)} type="button">Next</button></nav></> : <div className="rs8-empty"><FileText aria-hidden="true" size={20} /><h2>Source page unavailable</h2><p>The Source and its properties remain available.</p><button disabled={isLoadingContentPage} onClick={() => void openContentPage(0)} type="button"><RefreshCw aria-hidden="true" size={14} />Retry page</button></div>}</article> : selectedListDocument ? <div className="rs8-empty"><FileText aria-hidden="true" size={23} /><h2>Source unavailable</h2><p>The Source remains in this database. Try opening its details again.</p><button disabled={isLoadingDetail} onClick={retrySelectedSource} type="button"><RefreshCw aria-hidden="true" size={14} />Retry source</button></div> : <div className="rs8-empty"><FileText aria-hidden="true" size={23} /><h2>Add a source to {databaseDocument?.database.name ?? "this database"}</h2><p>Import text, Markdown, Word (.docx), text PDF, EPUB, HTML, XHTML, or a controlled web-page snapshot.</p><button disabled={isUploading || isImportingWeb} onClick={openFilePicker} type="button">Choose file</button></div>}
          {openedSearchResult && searchResults === null && detail?.source.id === openedSearchResult.sourceId && highlightedPassage?.blockId === openedSearchResult.blockId ? <div className="rs12-opened-evidence"><span><strong>Exact passage opened</strong><small>{formatLocation(openedSearchResult.location)} remains separate from your interpretation.</small></span><button onClick={() => setCaptureEvidence(openedSearchResult)} type="button"><Plus aria-hidden="true" size={14} />Add to project</button></div> : null}
        </main>

        <aside aria-label="Source properties" className="rs8-inspector">
          <header><div><p>{databaseDocument?.database.name ?? "Selected source"}</p><h2>Properties</h2></div>{sourceIsDirty ? <span className="rs8-dirty">Unsaved changes</span> : detail ? <span className="rs8-status">Parsed</span> : null}</header>
          {detail && sourceDraft ? <form onSubmit={(event) => void saveSourceProperties(event)}><label><span>Display name</span><input disabled={isSavingSource} maxLength={240} onChange={(event) => setSourceDraft({ ...sourceDraft, displayName: event.target.value })} required value={sourceDraft.displayName} /></label><label><span>Author</span><input disabled={isSavingSource} maxLength={240} onChange={(event) => setSourceDraft({ ...sourceDraft, author: event.target.value })} value={sourceDraft.author} /></label><label><span>Declared language</span><input disabled={isSavingSource} maxLength={64} onChange={(event) => setSourceDraft({ ...sourceDraft, declaredLanguage: event.target.value })} placeholder="zh-CN, ja-JP, en" value={sourceDraft.declaredLanguage} /></label><label><span>Tags</span><input disabled={isSavingSource} maxLength={1200} onChange={(event) => setSourceDraft({ ...sourceDraft, tags: event.target.value })} placeholder="history, folklore" value={sourceDraft.tags} /></label><fieldset><legend>AI context permission</legend><div className="rs8-permission"><label><input checked={sourceDraft.aiPermission === "never"} disabled={isSavingSource} name="research-ai-permission" onChange={() => setSourceDraft({ ...sourceDraft, aiPermission: "never" })} type="radio" /><span>Never send</span></label><label><input checked={sourceDraft.aiPermission === "allowed"} disabled={isSavingSource} name="research-ai-permission" onChange={() => setSourceDraft({ ...sourceDraft, aiPermission: "allowed" })} type="radio" /><span>Allow when selected</span></label></div></fieldset><label><span>Copyright / use notes</span><textarea disabled={isSavingSource} maxLength={8000} onChange={(event) => setSourceDraft({ ...sourceDraft, useNotes: event.target.value })} rows={4} value={sourceDraft.useNotes} /></label><div className="rs8-actions"><button className="rs8-discard" disabled={!sourceIsDirty || isSavingSource} onClick={discardSourceDraft} type="button">Discard changes</button><button className="rs8-save" disabled={!sourceIsDirty || isSavingSource || !sourceDraft.displayName.trim()} type="submit">{isSavingSource ? "Saving" : "Save properties"}</button></div><details className="rs8-facts"><summary>Import facts</summary><dl><div><dt>Database</dt><dd>{databaseDocument?.database.name}</dd></div><div><dt>Type</dt><dd>{sourceKindLabel(detail.source.kind)} · {detail.source.mediaType}</dd></div><div><dt>Original file</dt><dd>{detail.source.originalFileName}</dd></div>{detail.source.schemaVersion === 3 && detail.source.origin.type === "web" ? <div><dt>Page URL</dt><dd title={detail.source.origin.finalUrl}>{detail.source.origin.finalUrl}</dd></div> : null}<div><dt>Size</dt><dd>{formatBytes(detail.source.sizeBytes)}</dd></div><div><dt>Parser</dt><dd>{detail.source.parserName} v{detail.source.parserVersion}</dd></div><div><dt>SHA-256</dt><dd title={detail.source.contentHash}>{detail.source.contentHash}</dd></div></dl></details></form> : <div className="rs8-inspector-empty">{selectedListDocument ? <p>{isLoadingDetail ? "Opening source properties." : "Source properties are temporarily unavailable."}</p> : databaseDocument ? <><strong>{databaseDocument.database.name}</strong><p>{databaseDocument.database.description || "No database description."}</p><p>{databaseDocument.database.linkedSeriesIds.length} linked Series · {selectedDatabaseSummary?.sourceCount ?? 0} sources</p><button className="rs9-inline-command" onClick={openDatabaseDialog} type="button">Open database settings</button></> : <p>Create or select a Research Database.</p>}</div>}
        </aside>
        </> : selectedDatabaseId ? <ResearchNotesWorkspace
          databaseId={selectedDatabaseId}
          databaseName={databaseDocument?.database.name ?? selectedDatabaseSummary?.database.name ?? "Research Database"}
          onDirtyChange={setNoteIsDirty}
          refreshToken={noteRefreshToken}
          requestedNoteId={requestedNoteId}
        /> : null}
      </div>

      {captureEvidence && selectedDatabaseId ? <ResearchNoteCaptureDialog
        databaseId={selectedDatabaseId}
        databaseName={databaseDocument?.database.name ?? selectedDatabaseSummary?.database.name ?? "Research Database"}
        evidence={captureEvidence}
        onClose={() => setCaptureEvidence(null)}
        onSaved={(saved) => {
          setCaptureEvidence(null);
          setRequestedNoteId(saved.note.id);
          setNoteRefreshToken((current) => current + 1);
          globalThis.localStorage?.setItem(researchViewKey(selectedDatabaseId), "notes");
          setResearchView("notes");
          setNotice("");
          setError("");
        }}
      /> : null}

      {retrievalDialogOpen ? <div className="rs9-dialog-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target && !queryExpansionsDirty && !isSavingQueryExpansions && !isValidatingCapability && !isRebuildingVector) setRetrievalDialogOpen(false); }}><section aria-labelledby="research-retrieval-settings-title" aria-modal="true" className="rs9-dialog rs11-retrieval-dialog" role="dialog"><header><div><p>{databaseDocument?.database.name ?? "Research Database"}</p><h2 id="research-retrieval-settings-title">Retrieval settings</h2></div><button aria-label="Close" disabled={isSavingQueryExpansions || isValidatingCapability || isRebuildingVector} onClick={() => { if (queryExpansionsDirty) setDialogError("Save or discard alias changes before closing."); else setRetrievalDialogOpen(false); }} title="Close" type="button"><X aria-hidden="true" size={17} /></button></header><div className="rs11-retrieval-body">
        {dialogError ? <div className="rs9-dialog-error" role="alert">{dialogError}</div> : null}
        <section aria-labelledby="semantic-capability-title" className="rs11-retrieval-section"><div className="rs11-section-heading"><div><Network aria-hidden="true" size={17} /><span><strong id="semantic-capability-title">Multilingual semantic retrieval</strong><small>{embeddingCapability?.usable ? "Validated for the current profile revision" : embeddingCapability?.reason ?? "Checking the research.multilingual binding"}</small></span></div><span className={`rs11-state is-${embeddingCapability?.usable ? "ready" : "attention"}`}>{embeddingCapability?.usable ? "Ready" : "Unavailable"}</span></div><div className="rs11-capability-grid"><label><span>Language coverage</span><input disabled={isValidatingCapability} onChange={(event) => setCapabilityLanguages(event.target.value)} placeholder="zh-CN, ja, en" value={capabilityLanguages} /></label><label><span>Query prefix</span><input disabled={isValidatingCapability} onChange={(event) => setCapabilityQueryPrefix(event.target.value)} placeholder="query: " value={capabilityQueryPrefix} /></label><label><span>Document prefix</span><input disabled={isValidatingCapability} onChange={(event) => setCapabilityDocumentPrefix(event.target.value)} placeholder="passage: " value={capabilityDocumentPrefix} /></label><label className="rs11-shared-space"><input checked={sharedSpaceDeclared} disabled={isValidatingCapability} onChange={(event) => setSharedSpaceDeclared(event.target.checked)} type="checkbox" /><span><strong>Shared multilingual vector space</strong><small>The selected profile places Chinese, Japanese, and English in one comparable space.</small></span></label></div><div className="rs11-section-actions"><button disabled={isValidatingCapability || embeddingCapability?.bindingStatus !== "bound" || !sharedSpaceDeclared} onClick={() => void validateEmbeddingCapability()} type="button"><Check aria-hidden="true" size={14} />{isValidatingCapability ? "Validating" : "Run validation"}</button></div></section>
        <section aria-labelledby="semantic-index-title" className="rs11-retrieval-section"><div className="rs11-section-heading"><div><Database aria-hidden="true" size={17} /><span><strong id="semantic-index-title">Current database vector index</strong><small>{vectorIndexState?.reason ?? `${vectorIndexState?.indexedChunkCount ?? 0} permitted passages indexed`}</small></span></div><span className={`rs11-state is-${vectorIndexState?.status === "ready" ? "ready" : "attention"}`}>{vectorIndexState?.status ?? "Unknown"}</span></div><div className="rs11-section-actions"><button disabled={!embeddingCapability?.usable || isRebuildingVector || sourceIsDirty} onClick={() => void rebuildVectorIndex()} type="button"><RefreshCw aria-hidden="true" className={isRebuildingVector ? "is-spinning" : ""} size={14} />{isRebuildingVector ? "Building" : "Rebuild semantic index"}</button></div></section>
        <section aria-labelledby="query-aliases-title" className="rs11-retrieval-section"><div className="rs11-section-heading"><div><SlidersHorizontal aria-hidden="true" size={17} /><span><strong id="query-aliases-title">Aliases and transliterations</strong><small>Stored only in this database and searched in either direction.</small></span></div><button aria-label="Add query alias" onClick={addQueryExpansion} title="Add query alias" type="button"><Plus aria-hidden="true" size={15} /></button></div>{queryExpansionDraft.length === 0 ? <div className="rs11-alias-empty">No aliases in this database.</div> : <div className="rs11-alias-list">{queryExpansionDraft.map((entry, index) => <div className="rs11-alias-row" key={entry.id}><input aria-label={`Query term ${index + 1}`} maxLength={200} onChange={(event) => setQueryExpansionDraft((current) => current.map((item) => item.id === entry.id ? { ...item, queryTerm: event.target.value } : item))} placeholder="Term used in a query" value={entry.queryTerm} /><span aria-hidden="true">↔</span><input aria-label={`Expansion term ${index + 1}`} maxLength={200} onChange={(event) => setQueryExpansionDraft((current) => current.map((item) => item.id === entry.id ? { ...item, expansionTerm: event.target.value } : item))} placeholder="Alternate spelling or language" value={entry.expansionTerm} /><select aria-label={`Expansion channel ${index + 1}`} onChange={(event) => setQueryExpansionDraft((current) => current.map((item) => item.id === entry.id ? { ...item, channel: event.target.value as "alias" | "transliteration" } : item))} value={entry.channel}><option value="alias">Alias</option><option value="transliteration">Transliteration</option></select><button aria-label={`Remove expansion ${index + 1}`} onClick={() => setQueryExpansionDraft((current) => current.filter((item) => item.id !== entry.id))} title="Remove expansion" type="button"><Trash2 aria-hidden="true" size={14} /></button></div>)}</div>}<div className="rs11-section-actions"><button disabled={!queryExpansionsDirty || isSavingQueryExpansions} onClick={() => setQueryExpansionDraft(queryExpansions?.expansions.entries ?? [])} type="button">Discard</button><button disabled={!queryExpansionsDirty || isSavingQueryExpansions || queryExpansionDraft.some((entry) => !entry.queryTerm.trim() || !entry.expansionTerm.trim())} onClick={() => void saveQueryExpansions()} type="button">{isSavingQueryExpansions ? "Saving" : "Save aliases"}</button></div></section>
      </div></section></div> : null}

      {webDialogOpen ? <div className="rs9-dialog-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target && !isImportingWeb) setWebDialogOpen(false); }}><section aria-labelledby="import-research-web-title" aria-modal="true" className="rs9-dialog" role="dialog"><header><div><p>Controlled snapshot</p><h2 id="import-research-web-title">Add web page</h2></div><button aria-label="Close" disabled={isImportingWeb} onClick={() => setWebDialogOpen(false)} title="Close" type="button"><X aria-hidden="true" size={17} /></button></header><form onSubmit={(event) => void importWebSource(event)}>{dialogError ? <div className="rs9-dialog-error" role="alert">{dialogError}</div> : null}<label><span>Web address</span><input disabled={isImportingWeb} maxLength={4096} onChange={(event) => setWebUrl(event.target.value)} placeholder="https://example.com/reference" ref={webUrlRef} required type="url" value={webUrl} /></label><p className="rs9-dialog-note">Novel Studio follows a limited redirect chain, accepts only public HTML pages, removes active content, and stores a fixed local snapshot in this database.</p><footer><button className="rs8-discard" disabled={isImportingWeb} onClick={() => setWebDialogOpen(false)} type="button">Cancel</button><button className="rs8-save" disabled={isImportingWeb || !webUrl.trim()} type="submit">{isImportingWeb ? "Saving snapshot" : "Save snapshot"}</button></footer></form></section></div> : null}

      {createDialogOpen ? <div className="rs9-dialog-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target && !isCreatingDatabase) setCreateDialogOpen(false); }}><section aria-labelledby="create-research-database-title" aria-modal="true" className="rs9-dialog" role="dialog"><header><div><p>New isolated shelf</p><h2 id="create-research-database-title">Create Research Database</h2></div><button aria-label="Close" disabled={isCreatingDatabase} onClick={() => setCreateDialogOpen(false)} title="Close" type="button"><X aria-hidden="true" size={17} /></button></header><form onSubmit={(event) => void createDatabase(event)}>{dialogError ? <div className="rs9-dialog-error" role="alert">{dialogError}</div> : null}<label><span>Name</span><input maxLength={120} onChange={(event) => setCreateName(event.target.value)} ref={createNameRef} required value={createName} /></label><label><span>Description</span><textarea maxLength={4000} onChange={(event) => setCreateDescription(event.target.value)} rows={5} value={createDescription} /></label><p className="rs9-dialog-note">Sources and future indexes in this database remain separate from every other database.</p><footer><button className="rs8-discard" disabled={isCreatingDatabase} onClick={() => setCreateDialogOpen(false)} type="button">Cancel</button><button className="rs8-save" disabled={isCreatingDatabase || !createName.trim()} type="submit">{isCreatingDatabase ? "Creating" : "Create database"}</button></footer></form></section></div> : null}

      {databaseDialogOpen && databaseDocument && databaseDraft ? <div className="rs9-dialog-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) closeDatabaseDialog(); }}><section aria-labelledby="research-database-settings-title" aria-modal="true" className="rs9-dialog rs9-database-dialog" role="dialog"><header><div><p>Isolated source shelf</p><h2 id="research-database-settings-title">Database settings</h2></div><button aria-label="Close" disabled={isSavingDatabase || isMigrating} onClick={closeDatabaseDialog} title="Close" type="button"><X aria-hidden="true" size={17} /></button></header><form onSubmit={(event) => void saveDatabase(event)}>{dialogError ? <div className="rs9-dialog-error" role="alert">{dialogError}</div> : null}<label><span>Name</span><input disabled={isSavingDatabase || isMigrating} maxLength={120} onChange={(event) => setDatabaseDraft({ ...databaseDraft, name: event.target.value })} required value={databaseDraft.name} /></label><label><span>Description</span><textarea disabled={isSavingDatabase || isMigrating} maxLength={4000} onChange={(event) => setDatabaseDraft({ ...databaseDraft, description: event.target.value })} rows={4} value={databaseDraft.description} /></label>{seriesId ? <label className="rs9-series-link"><input checked={databaseDraft.linkedToCurrentSeries} disabled={isSavingDatabase || isMigrating} onChange={(event) => setDatabaseDraft({ ...databaseDraft, linkedToCurrentSeries: event.target.checked })} type="checkbox" /><span><strong>Available to current Series</strong><small>The Series references this database. It never owns or copies it.</small></span></label> : <p className="rs9-dialog-note">Open a Series only when you need to link this reusable database to that novel.</p>}{currentLegacyGroup ? <section className="rs9-migration"><div><strong>Legacy Series sources</strong><p>{currentLegacyGroup.sourceCount} source{currentLegacyGroup.sourceCount === 1 ? "" : "s"} remain in the old Series-owned location.</p></div>{legacyAlreadyMigrated ? <span>Copied</span> : <button disabled={isMigrating || isSavingDatabase || databaseIsDirty || !databaseDocument.database.linkedSeriesIds.includes(seriesId!)} onClick={() => void migrateLegacySources()} type="button">{isMigrating ? "Copying" : "Copy into this database"}</button>}</section> : null}<footer><button className="rs8-discard" disabled={isSavingDatabase || isMigrating} onClick={databaseIsDirty ? discardDatabaseChanges : closeDatabaseDialog} type="button">{databaseIsDirty ? "Discard changes" : "Close"}</button><button className="rs8-save" disabled={!databaseIsDirty || isSavingDatabase || isMigrating || !databaseDraft.name.trim()} type="submit">{isSavingDatabase ? "Saving" : "Save database"}</button></footer></form></section></div> : null}
    </section>
  );
}
