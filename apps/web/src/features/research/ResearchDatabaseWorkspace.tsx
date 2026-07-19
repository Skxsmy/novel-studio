import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  MAX_RESEARCH_SOURCE_BYTES,
  type LegacyResearchSourceGroup,
  type ResearchDatabaseDocument,
  type ResearchDatabaseIssue,
  type ResearchDatabaseSummary,
  type ResearchSourceAiPermission,
  type ResearchSourceDetail,
  type ResearchSourceDocument,
} from "@novel-studio/contracts";
import { ApiError, api } from "../../api";
import "./reference-research.css";

interface ReferenceResearchWorkspaceProps {
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

const DATABASE_SELECTION_KEY = "novel-studio.research.database.selected";

function sourceSelectionKey(databaseId: string): string {
  return `novel-studio.research.source.selected.${databaseId}`;
}

function sourceDraftFromDetail(detail: ResearchSourceDetail): SourceDraft {
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

export function ReferenceResearchWorkspace({ seriesId }: ReferenceResearchWorkspaceProps) {
  const [databases, setDatabases] = useState<ResearchDatabaseSummary[]>([]);
  const [databaseIssues, setDatabaseIssues] = useState<ResearchDatabaseIssue[]>([]);
  const [databaseListResolved, setDatabaseListResolved] = useState(false);
  const [selectedDatabaseId, setSelectedDatabaseId] = useState<string | null>(null);
  const [databaseDocument, setDatabaseDocument] = useState<ResearchDatabaseDocument | null>(null);
  const [legacyGroups, setLegacyGroups] = useState<LegacyResearchSourceGroup[]>([]);
  const [sources, setSources] = useState<ResearchSourceDocument[]>([]);
  const [sourceShelfDatabaseId, setSourceShelfDatabaseId] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ResearchSourceDetail | null>(null);
  const [sourceDraft, setSourceDraft] = useState<SourceDraft | null>(null);
  const [savedSourceDraft, setSavedSourceDraft] = useState<SourceDraft | null>(null);
  const [databaseDraft, setDatabaseDraft] = useState<DatabaseDraft | null>(null);
  const [savedDatabaseDraft, setSavedDatabaseDraft] = useState<DatabaseDraft | null>(null);
  const [isLoadingDatabases, setIsLoadingDatabases] = useState(false);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingSource, setIsSavingSource] = useState(false);
  const [isSavingDatabase, setIsSavingDatabase] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isCreatingDatabase, setIsCreatingDatabase] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [databaseDialogOpen, setDatabaseDialogOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [railOpen, setRailOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createNameRef = useRef<HTMLInputElement>(null);

  const sourceIsDirty = !sameValue(sourceDraft, savedSourceDraft);
  const databaseIsDirty = !sameValue(databaseDraft, savedDatabaseDraft);
  const selectedDatabaseSummary = useMemo(
    () => databases.find((item) => item.database.id === selectedDatabaseId) ?? null,
    [databases, selectedDatabaseId],
  );
  const selectedListDocument = useMemo(
    () => sources.find((document) => document.source.id === selectedSourceId) ?? null,
    [selectedSourceId, sources],
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
        setSelectedDatabaseId(selected?.database.id ?? null);
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
    setSources([]);
    setSourceShelfDatabaseId(null);
    setSelectedSourceId(null);
    setDetail(null);
    setSourceDraft(null);
    setSavedSourceDraft(null);
    setDatabaseDocument(null);
    setError("");
    if (!selectedDatabaseId) {
      if (databaseListResolved) globalThis.localStorage?.removeItem(DATABASE_SELECTION_KEY);
      return;
    }
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
    if (!selectedDatabaseId || !selectedSourceId || sourceShelfDatabaseId !== selectedDatabaseId) {
      setDetail(null);
      setSourceDraft(null);
      setSavedSourceDraft(null);
      return;
    }
    globalThis.localStorage?.setItem(sourceSelectionKey(selectedDatabaseId), selectedSourceId);
    let cancelled = false;
    setIsLoadingDetail(true);
    setError("");
    void api.research.getSource(selectedDatabaseId, selectedSourceId).then((loaded) => {
      if (cancelled) return;
      const nextDraft = sourceDraftFromDetail(loaded);
      setDetail(loaded);
      setSourceDraft(nextDraft);
      setSavedSourceDraft(nextDraft);
    }).catch((reason) => {
      if (cancelled) return;
      setSources((current) => current.filter((document) => document.source.id !== selectedSourceId));
      globalThis.localStorage?.removeItem(sourceSelectionKey(selectedDatabaseId));
      setSelectedSourceId(null);
      setDetail(null);
      setSourceDraft(null);
      setSavedSourceDraft(null);
      setRailOpen(true);
      setError(errorMessage(reason, "The selected Research source could not be opened."));
    }).finally(() => {
      if (!cancelled) setIsLoadingDetail(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedDatabaseId, selectedSourceId, sourceShelfDatabaseId]);

  function chooseDatabase(databaseId: string) {
    if (sourceIsDirty || isSavingSource) {
      setError("Save or discard the open source changes before switching Research Databases.");
      return;
    }
    setSelectedDatabaseId(databaseId || null);
    setRailOpen(false);
    setNotice("");
  }

  function chooseSource(sourceId: string) {
    if (sourceIsDirty || isSavingSource) {
      setError("Save or discard the open source changes before switching sources.");
      return;
    }
    setSelectedSourceId(sourceId);
    setRailOpen(false);
    setNotice("");
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
    const lowerName = file.name.toLocaleLowerCase("en-US");
    const isMarkdown = lowerName.endsWith(".md");
    if (!isMarkdown && !lowerName.endsWith(".txt")) {
      setError("Choose a UTF-8 TXT or Markdown file.");
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
        mediaType: isMarkdown ? "text/markdown" : "text/plain",
        sizeBytes: file.size,
        contentBase64: await fileToBase64(file),
      });
      setSources((current) => [
        { source: created.source, revision: created.revision },
        ...current.filter((document) => document.source.id !== created.source.id),
      ]);
      setDatabases((current) => current.map((item) => item.database.id === selectedDatabaseId
        ? { ...item, sourceCount: item.sourceCount + 1 }
        : item));
      setSelectedSourceId(created.source.id);
      const nextDraft = sourceDraftFromDetail(created);
      setDetail(created);
      setSourceDraft(nextDraft);
      setSavedSourceDraft(nextDraft);
      setNotice(`Imported ${created.source.originalFileName}.`);
    } catch (reason) {
      setError(errorMessage(reason, "The Research source could not be imported."));
    } finally {
      setIsUploading(false);
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
          <button aria-expanded={railOpen} aria-label="Toggle source shelf" className="rs8-rail-toggle" onClick={() => setRailOpen((open) => !open)} type="button"><span aria-hidden="true">=</span></button>
          <div><p>Reference library</p><h1>Research</h1></div>
        </div>
        <div className="rs9-database-controls">
          <label className="rs9-database-select"><span>Research Database</span><select aria-label="Research Database" disabled={isLoadingDatabases || databases.length === 0} onChange={(event) => chooseDatabase(event.target.value)} value={selectedDatabaseId ?? ""}><option value="">{isLoadingDatabases ? "Loading databases" : "No databases"}</option>{databases.map((item) => <option key={item.database.id} value={item.database.id}>{item.database.name}</option>)}</select></label>
          <button aria-label="Create Research Database" className="rs9-icon-button" onClick={openCreateDialog} title="Create Research Database" type="button">+</button>
          <button aria-label="Database settings" className="rs9-settings-button" disabled={!databaseDocument} onClick={openDatabaseDialog} type="button"><span className="rs9-settings-wide">Database settings</span><span aria-hidden="true" className="rs9-settings-compact">Settings</span></button>
        </div>
        <button className="rs8-upload" disabled={!selectedDatabaseId || isUploading || isSavingSource || sourceIsDirty} onClick={() => fileInputRef.current?.click()} type="button"><span aria-hidden="true">+</span>{isUploading ? "Importing" : "Add source"}</button>
        <input accept=".txt,.md,text/plain,text/markdown" aria-label="Choose a TXT or Markdown Research source" hidden onChange={(event) => void importFile(event)} ref={fileInputRef} type="file" />
      </header>

      <div className={`rs8-layout${railOpen ? " is-rail-open" : ""}`}>
        <aside aria-label="Research sources" className="rs8-rail">
          <div className="rs8-rail-head"><strong>{selectedDatabaseSummary?.database.name ?? "Sources"}</strong><span>{sources.length}</span></div>
          {!selectedDatabaseId ? <div className="rs8-rail-empty"><strong>No Research Database selected</strong><p>Create a database to start an isolated source shelf.</p></div> : isLoadingSources ? <div aria-live="polite" className="rs8-loading">Loading source shelf</div> : sources.length === 0 ? <div className="rs8-rail-empty"><strong>This source shelf is empty</strong><p>Add a UTF-8 TXT or Markdown file to this database.</p></div> : <div className="rs8-source-list">{sources.map((document) => { const source = document.source; const selected = source.id === selectedSourceId; return <button aria-current={selected ? "true" : undefined} className={`rs8-source${selected ? " is-selected" : ""}`} disabled={isSavingSource || (sourceIsDirty && !selected)} key={source.id} onClick={() => chooseSource(source.id)} title={source.displayName} type="button"><span aria-hidden="true" className="rs8-spine"><i /></span><span className="rs8-source-copy"><strong>{source.displayName}</strong><span>{source.kind === "markdown" ? "Markdown" : "Text"} · {source.declaredLanguage ?? "Language not set"}</span></span><span aria-label="Parsed" className="rs8-ready">Ready</span></button>; })}</div>}
        </aside>

        <main className="rs8-reader">
          {(error || notice) ? <div aria-live="polite" className={`rs8-banner${error ? " is-error" : ""}`} role={error ? "alert" : "status"}>{error || notice}</div> : null}
          {databaseIssues.length > 0 ? <div className="rs8-banner is-error" role="alert">{databaseIssues.length} Research Database {databaseIssues.length === 1 ? "directory could" : "directories could"} not be opened. Other databases remain available.</div> : null}
          {isLoadingDatabases ? <div aria-live="polite" className="rs8-reader-loading"><span /><p>Opening Research Databases</p></div> : !selectedDatabaseId ? <div className="rs8-empty"><span aria-hidden="true">DB</span><h2>Create your first Research Database</h2><p>Each database keeps its own sources, originals, permissions, and future search index. It does not belong to a Series.</p><button onClick={openCreateDialog} type="button">Create Research Database</button></div> : isLoadingDetail ? <div aria-live="polite" className="rs8-reader-loading"><span /><p>Opening source</p></div> : detail ? <article className="rs8-document"><header><div className="rs8-document-mark"><span aria-hidden="true" /><em>{detail.source.kind === "markdown" ? "MD" : "TXT"}</em></div><div><p>{detail.source.originalFileName}</p><h2>{detail.source.displayName}</h2><span>{databaseDocument?.database.name} · Imported {formatImportedAt(detail.source.importedAt)} · {formatBytes(detail.source.sizeBytes)}</span></div></header><div className="rs8-preview-label"><strong>Original text</strong><span>Unchanged UTF-8 source</span></div><pre className="rs8-preview">{detail.originalText}</pre></article> : <div className="rs8-empty"><span aria-hidden="true">+</span><h2>Add a source to {databaseDocument?.database.name ?? "this database"}</h2><p>TXT and Markdown are available now. Word, text PDF, EPUB, HTML, and web addresses follow after location-aware parsing is connected.</p><button disabled={isUploading} onClick={() => fileInputRef.current?.click()} type="button">Choose file</button></div>}
        </main>

        <aside aria-label="Source properties" className="rs8-inspector">
          <header><div><p>{databaseDocument?.database.name ?? "Selected source"}</p><h2>Properties</h2></div>{sourceIsDirty ? <span className="rs8-dirty">Unsaved changes</span> : detail ? <span className="rs8-status">Parsed</span> : null}</header>
          {detail && sourceDraft ? <form onSubmit={(event) => void saveSourceProperties(event)}><label><span>Display name</span><input disabled={isSavingSource} maxLength={240} onChange={(event) => setSourceDraft({ ...sourceDraft, displayName: event.target.value })} required value={sourceDraft.displayName} /></label><label><span>Author</span><input disabled={isSavingSource} maxLength={240} onChange={(event) => setSourceDraft({ ...sourceDraft, author: event.target.value })} value={sourceDraft.author} /></label><label><span>Declared language</span><input disabled={isSavingSource} maxLength={64} onChange={(event) => setSourceDraft({ ...sourceDraft, declaredLanguage: event.target.value })} placeholder="zh-CN, ja-JP, en" value={sourceDraft.declaredLanguage} /></label><label><span>Tags</span><input disabled={isSavingSource} maxLength={1200} onChange={(event) => setSourceDraft({ ...sourceDraft, tags: event.target.value })} placeholder="history, folklore" value={sourceDraft.tags} /></label><fieldset><legend>AI context permission</legend><div className="rs8-permission"><label><input checked={sourceDraft.aiPermission === "never"} disabled={isSavingSource} name="research-ai-permission" onChange={() => setSourceDraft({ ...sourceDraft, aiPermission: "never" })} type="radio" /><span>Never send</span></label><label><input checked={sourceDraft.aiPermission === "allowed"} disabled={isSavingSource} name="research-ai-permission" onChange={() => setSourceDraft({ ...sourceDraft, aiPermission: "allowed" })} type="radio" /><span>Allow when selected</span></label></div></fieldset><label><span>Copyright / use notes</span><textarea disabled={isSavingSource} maxLength={8000} onChange={(event) => setSourceDraft({ ...sourceDraft, useNotes: event.target.value })} rows={4} value={sourceDraft.useNotes} /></label><div className="rs8-actions"><button className="rs8-discard" disabled={!sourceIsDirty || isSavingSource} onClick={discardSourceDraft} type="button">Discard changes</button><button className="rs8-save" disabled={!sourceIsDirty || isSavingSource || !sourceDraft.displayName.trim()} type="submit">{isSavingSource ? "Saving" : "Save properties"}</button></div><details className="rs8-facts"><summary>Import facts</summary><dl><div><dt>Database</dt><dd>{databaseDocument?.database.name}</dd></div><div><dt>Type</dt><dd>{detail.source.mediaType}</dd></div><div><dt>Original file</dt><dd>{detail.source.originalFileName}</dd></div><div><dt>Size</dt><dd>{formatBytes(detail.source.sizeBytes)}</dd></div><div><dt>Parser</dt><dd>{detail.source.parserName} v{detail.source.parserVersion}</dd></div><div><dt>SHA-256</dt><dd title={detail.source.contentHash}>{detail.source.contentHash}</dd></div></dl></details></form> : <div className="rs8-inspector-empty">{databaseDocument ? <><strong>{databaseDocument.database.name}</strong><p>{databaseDocument.database.description || "No database description."}</p><p>{databaseDocument.database.linkedSeriesIds.length} linked Series · {selectedDatabaseSummary?.sourceCount ?? 0} sources</p><button className="rs9-inline-command" onClick={openDatabaseDialog} type="button">Open database settings</button></> : <p>{selectedListDocument ? "Opening source properties." : "Create or select a Research Database."}</p>}</div>}
        </aside>
      </div>

      {createDialogOpen ? <div className="rs9-dialog-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target && !isCreatingDatabase) setCreateDialogOpen(false); }}><section aria-labelledby="create-research-database-title" aria-modal="true" className="rs9-dialog" role="dialog"><header><div><p>New isolated shelf</p><h2 id="create-research-database-title">Create Research Database</h2></div><button aria-label="Close" disabled={isCreatingDatabase} onClick={() => setCreateDialogOpen(false)} type="button">x</button></header><form onSubmit={(event) => void createDatabase(event)}>{dialogError ? <div className="rs9-dialog-error" role="alert">{dialogError}</div> : null}<label><span>Name</span><input maxLength={120} onChange={(event) => setCreateName(event.target.value)} ref={createNameRef} required value={createName} /></label><label><span>Description</span><textarea maxLength={4000} onChange={(event) => setCreateDescription(event.target.value)} rows={5} value={createDescription} /></label><p className="rs9-dialog-note">Sources and future indexes in this database remain separate from every other database.</p><footer><button className="rs8-discard" disabled={isCreatingDatabase} onClick={() => setCreateDialogOpen(false)} type="button">Cancel</button><button className="rs8-save" disabled={isCreatingDatabase || !createName.trim()} type="submit">{isCreatingDatabase ? "Creating" : "Create database"}</button></footer></form></section></div> : null}

      {databaseDialogOpen && databaseDocument && databaseDraft ? <div className="rs9-dialog-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) closeDatabaseDialog(); }}><section aria-labelledby="research-database-settings-title" aria-modal="true" className="rs9-dialog rs9-database-dialog" role="dialog"><header><div><p>Isolated source shelf</p><h2 id="research-database-settings-title">Database settings</h2></div><button aria-label="Close" disabled={isSavingDatabase || isMigrating} onClick={closeDatabaseDialog} type="button">x</button></header><form onSubmit={(event) => void saveDatabase(event)}>{dialogError ? <div className="rs9-dialog-error" role="alert">{dialogError}</div> : null}<label><span>Name</span><input disabled={isSavingDatabase || isMigrating} maxLength={120} onChange={(event) => setDatabaseDraft({ ...databaseDraft, name: event.target.value })} required value={databaseDraft.name} /></label><label><span>Description</span><textarea disabled={isSavingDatabase || isMigrating} maxLength={4000} onChange={(event) => setDatabaseDraft({ ...databaseDraft, description: event.target.value })} rows={4} value={databaseDraft.description} /></label>{seriesId ? <label className="rs9-series-link"><input checked={databaseDraft.linkedToCurrentSeries} disabled={isSavingDatabase || isMigrating} onChange={(event) => setDatabaseDraft({ ...databaseDraft, linkedToCurrentSeries: event.target.checked })} type="checkbox" /><span><strong>Available to current Series</strong><small>The Series references this database. It never owns or copies it.</small></span></label> : <p className="rs9-dialog-note">Open a Series only when you need to link this reusable database to that novel.</p>}{currentLegacyGroup ? <section className="rs9-migration"><div><strong>Legacy Series sources</strong><p>{currentLegacyGroup.sourceCount} source{currentLegacyGroup.sourceCount === 1 ? "" : "s"} remain in the old Series-owned location.</p></div>{legacyAlreadyMigrated ? <span>Copied</span> : <button disabled={isMigrating || isSavingDatabase || databaseIsDirty || !databaseDocument.database.linkedSeriesIds.includes(seriesId!)} onClick={() => void migrateLegacySources()} type="button">{isMigrating ? "Copying" : "Copy into this database"}</button>}</section> : null}<footer><button className="rs8-discard" disabled={isSavingDatabase || isMigrating} onClick={databaseIsDirty ? discardDatabaseChanges : closeDatabaseDialog} type="button">{databaseIsDirty ? "Discard changes" : "Close"}</button><button className="rs8-save" disabled={!databaseIsDirty || isSavingDatabase || isMigrating || !databaseDraft.name.trim()} type="submit">{isSavingDatabase ? "Saving" : "Save database"}</button></footer></form></section></div> : null}
    </section>
  );
}
