import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type {
  ResearchNoteDetail,
  ResearchNoteEvidenceFreshness,
  ResearchNoteListResult,
  ResearchNoteSummary,
  ResearchRetrievalResult,
  ResearchSourceLocation,
} from "@novel-studio/contracts";
import {
  AlertTriangle,
  Archive,
  BookOpenText,
  CheckCircle2,
  Database,
  FileWarning,
  Plus,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import { ApiError, api } from "../../api";
import "./research-notes.css";

interface NoteDraft {
  title: string;
  body: string;
  tags: string;
}

interface ResearchNotesWorkspaceProps {
  databaseId: string;
  databaseName: string;
  onDirtyChange: (dirty: boolean) => void;
  refreshToken: number;
  requestedNoteId: string | null;
}

interface ResearchNoteCaptureDialogProps {
  databaseId: string;
  databaseName: string;
  evidence: ResearchRetrievalResult;
  onClose: () => void;
  onSaved: (note: ResearchNoteDetail) => void;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.payload && typeof error.payload === "object") {
    const message = (error.payload as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatLocation(location: ResearchSourceLocation): string {
  if (location.kind === "text") {
    return location.startLine === location.endLine
      ? `Line ${location.startLine}`
      : `Lines ${location.startLine}-${location.endLine}`;
  }
  if (location.kind === "pdf") return `Page ${location.page}, paragraph ${location.paragraph}`;
  if (location.kind === "docx") return `${location.sectionPath.join(" / ") || "Document"}, paragraph ${location.paragraph}`;
  if (location.kind === "epub") {
    return `${location.sectionPath.join(" / ") || `Spine ${location.spineIndex + 1}`}, paragraph ${location.paragraph}`;
  }
  return `${location.sectionPath.join(" / ") || "Page"}, paragraph ${location.paragraph}`;
}

function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function parseTags(value: string): string[] {
  return value.split(/[,，\n]/u).map((tag) => tag.trim()).filter(Boolean);
}

function noteDraft(detail: ResearchNoteDetail): NoteDraft {
  return {
    title: detail.note.title,
    body: detail.note.body,
    tags: detail.note.tags.join(", "),
  };
}

function sameDraft(left: NoteDraft | null, right: NoteDraft | null): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function freshnessLabel(value: ResearchNoteEvidenceFreshness): string {
  if (value === "current") return "Current evidence";
  if (value === "source-revision-changed") return "Source metadata changed";
  if (value === "passage-changed") return "Original passage changed";
  if (value === "source-missing") return "Source missing";
  if (value === "ownership-mismatch") return "Database ownership mismatch";
  return "Evidence unreadable";
}

function summaryStatus(note: ResearchNoteSummary): { label: string; tone: "current" | "warning" | "error" } {
  const freshness = note.freshness;
  if (freshness.passageChanged + freshness.sourceMissing + freshness.unreadable + freshness.ownershipMismatch > 0) {
    return { label: "Evidence needs review", tone: "error" };
  }
  if (freshness.sourceRevisionChanged > 0) return { label: "Source changed", tone: "warning" };
  return { label: "Evidence current", tone: "current" };
}

function noteSelectionKey(databaseId: string): string {
  return `novel-studio.research.note.selected.${databaseId}`;
}

function CaptureEvidence({ evidence }: { evidence: ResearchRetrievalResult }) {
  return <section className="rn1-capture-evidence">
    <div className="rn1-evidence-spine" aria-hidden="true"><span /></div>
    <div>
      <p><Database aria-hidden="true" size={13} />{evidence.researchDatabaseName}</p>
      <h3>{evidence.sourceDisplayName}</h3>
      <div className="rn1-evidence-meta"><span>Location: {formatLocation(evidence.location)}</span><span>Matched language: {evidence.languageTag}</span></div>
      <blockquote>{evidence.originalText}</blockquote>
    </div>
  </section>;
}

export function ResearchNoteCaptureDialog({
  databaseId,
  databaseName,
  evidence,
  onClose,
  onSaved,
}: ResearchNoteCaptureDialogProps) {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [notes, setNotes] = useState<ResearchNoteSummary[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [title, setTitle] = useState(`${evidence.sourceDisplayName}: ${formatLocation(evidence.location)}`);
  const [body, setBody] = useState("");
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void api.research.listNotes(databaseId, { status: "active", limit: 100 }).then((result) => {
      if (cancelled) return;
      setNotes(result.notes);
      setSelectedNoteId(result.notes[0]?.id ?? "");
    }).catch((reason) => {
      if (!cancelled) setError(errorMessage(reason, "Existing Research Notes could not be loaded."));
    }).finally(() => {
      if (!cancelled) setIsLoadingNotes(false);
    });
    titleRef.current?.focus();
    return () => { cancelled = true; };
  }, [databaseId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) onClose();
    };
    globalThis.addEventListener("keydown", onKeyDown);
    return () => globalThis.removeEventListener("keydown", onKeyDown);
  }, [isSaving, onClose]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const selectedNote = notes.find((note) => note.id === selectedNoteId);
    if (mode === "existing" && !selectedNote) {
      setError("Choose an active Research Note before adding this evidence.");
      return;
    }
    setIsSaving(true);
    setError("");
    const capture = {
      sourceId: evidence.sourceId,
      sourceRevision: evidence.sourceRevision,
      blockId: evidence.blockId,
      chunkId: evidence.chunkId,
      chunkHash: evidence.chunkHash,
    };
    try {
      const saved = mode === "new"
        ? await api.research.createNote(databaseId, {
            title: title.trim(),
            body,
            evidence: [capture],
          })
        : await api.research.appendNoteEvidence(databaseId, selectedNoteId, {
            baseRevision: selectedNote!.revision,
            evidence: [capture],
          });
      onSaved(saved);
    } catch (reason) {
      setError(errorMessage(reason, mode === "new" ? "Research Note could not be created." : "Evidence could not be added."));
    } finally {
      setIsSaving(false);
    }
  }

  return <div className="rs9-dialog-backdrop" onMouseDown={(event) => {
    if (event.currentTarget === event.target && !isSaving) onClose();
  }}>
    <section aria-labelledby="research-note-capture-title" aria-modal="true" className="rs9-dialog rn1-capture-dialog" role="dialog">
      <header>
        <div><p>Add to {databaseName}</p><h2 id="research-note-capture-title">Capture Research Note</h2></div>
        <button aria-label="Close" disabled={isSaving} onClick={onClose} title="Close" type="button"><X aria-hidden="true" size={17} /></button>
      </header>
      <form onSubmit={(event) => void submit(event)}>
        {error ? <div className="rs9-dialog-error" role="alert">{error}</div> : null}
        <CaptureEvidence evidence={evidence} />
        <fieldset className="rn1-target-mode">
          <legend>Note destination</legend>
          <div role="tablist" aria-label="Note destination">
            <button aria-selected={mode === "new"} onClick={() => setMode("new")} role="tab" type="button">New note</button>
            <button aria-selected={mode === "existing"} disabled={isLoadingNotes || notes.length === 0} onClick={() => setMode("existing")} role="tab" type="button">Existing note</button>
          </div>
        </fieldset>
        {mode === "new" ? <>
          <label><span>Title</span><input disabled={isSaving} maxLength={200} onChange={(event) => setTitle(event.target.value)} ref={titleRef} required value={title} /></label>
          <label><span>Your interpretation</span><textarea disabled={isSaving} maxLength={400000} onChange={(event) => setBody(event.target.value)} placeholder="What matters here, and how might it inform the story?" rows={6} value={body} /></label>
        </> : <label><span>Research Note</span><select disabled={isSaving || isLoadingNotes} onChange={(event) => setSelectedNoteId(event.target.value)} required value={selectedNoteId}>{notes.map((note) => <option key={note.id} value={note.id}>{note.title}</option>)}</select></label>}
        <p className="rs9-dialog-note">The original passage stays evidence. Your Note remains separate from Canon.</p>
        <footer>
          <button className="rs8-discard" disabled={isSaving} onClick={onClose} type="button">Cancel</button>
          <button className="rs8-save" disabled={isSaving || (mode === "new" ? !title.trim() : !selectedNoteId)} type="submit"><Plus aria-hidden="true" size={14} />{isSaving ? "Saving" : mode === "new" ? "Create Note" : "Add evidence"}</button>
        </footer>
      </form>
    </section>
  </div>;
}

export function ResearchNotesWorkspace({
  databaseId,
  databaseName,
  onDirtyChange,
  refreshToken,
  requestedNoteId,
}: ResearchNotesWorkspaceProps) {
  const [filter, setFilter] = useState<"active" | "archived">("active");
  const [list, setList] = useState<ResearchNoteListResult | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ResearchNoteDetail | null>(null);
  const [draft, setDraft] = useState<NoteDraft | null>(null);
  const [savedDraft, setSavedDraft] = useState<NoteDraft | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadRevision, setReloadRevision] = useState(0);
  const [detailReloadRevision, setDetailReloadRevision] = useState(0);
  const dirty = !sameDraft(draft, savedDraft);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  useEffect(() => {
    setList(null);
    setDetail(null);
    setDraft(null);
    setSavedDraft(null);
    setSelectedNoteId(null);
    setError("");
    setNotice("");
  }, [databaseId]);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingList(true);
    void api.research.listNotes(databaseId, { status: filter, limit: 100 }).then((result) => {
      if (cancelled) return;
      setList(result);
      const restored = globalThis.localStorage?.getItem(noteSelectionKey(databaseId)) ?? null;
      const preferred = requestedNoteId && result.notes.some((note) => note.id === requestedNoteId)
        ? requestedNoteId
        : result.notes.some((note) => note.id === selectedNoteId)
          ? selectedNoteId
          : result.notes.some((note) => note.id === restored)
            ? restored
            : result.notes[0]?.id ?? null;
      setSelectedNoteId(preferred);
    }).catch((reason) => {
      if (!cancelled) setError(errorMessage(reason, "Research Notes could not be loaded."));
    }).finally(() => {
      if (!cancelled) setIsLoadingList(false);
    });
    return () => { cancelled = true; };
  }, [databaseId, filter, refreshToken, reloadRevision, requestedNoteId]);

  useEffect(() => {
    if (!selectedNoteId) {
      setDetail(null);
      setDraft(null);
      setSavedDraft(null);
      return;
    }
    globalThis.localStorage?.setItem(noteSelectionKey(databaseId), selectedNoteId);
    let cancelled = false;
    setIsLoadingDetail(true);
    setDetail(null);
    setDraft(null);
    setSavedDraft(null);
    setError("");
    void api.research.getNote(databaseId, selectedNoteId).then((loaded) => {
      if (cancelled) return;
      const nextDraft = noteDraft(loaded);
      setDetail(loaded);
      setDraft(nextDraft);
      setSavedDraft(nextDraft);
    }).catch((reason) => {
      if (!cancelled) setError(errorMessage(reason, "The selected Research Note could not be opened."));
    }).finally(() => {
      if (!cancelled) setIsLoadingDetail(false);
    });
    return () => { cancelled = true; };
  }, [databaseId, detailReloadRevision, selectedNoteId]);

  const selectedSummary = useMemo(
    () => list?.notes.find((note) => note.id === selectedNoteId) ?? null,
    [list, selectedNoteId],
  );

  function chooseNote(noteId: string) {
    if (dirty || isSaving) {
      setError("Save or discard the open Note changes before switching Notes.");
      return;
    }
    setSelectedNoteId(noteId);
    setError("");
    setNotice("");
  }

  async function saveNote(event: FormEvent) {
    event.preventDefault();
    if (!detail || !draft || !dirty) return;
    setIsSaving(true);
    setError("");
    try {
      const saved = await api.research.updateNote(databaseId, detail.note.id, {
        baseRevision: detail.revision,
        title: draft.title.trim(),
        body: draft.body,
        tags: parseTags(draft.tags),
      });
      const nextDraft = noteDraft(saved);
      setDetail(saved);
      setDraft(nextDraft);
      setSavedDraft(nextDraft);
      setNotice("Research Note saved.");
      setReloadRevision((current) => current + 1);
    } catch (reason) {
      setError(reason instanceof ApiError && reason.status === 409
        ? "This Note changed on disk. Your draft is still here; discard only after reviewing the latest version."
        : errorMessage(reason, "Research Note could not be saved."));
    } finally {
      setIsSaving(false);
    }
  }

  async function changeArchiveState() {
    if (!detail || dirty || isSaving) return;
    setIsSaving(true);
    setError("");
    try {
      const changed = detail.note.status === "active"
        ? await api.research.archiveNote(databaseId, detail.note.id, { baseRevision: detail.revision })
        : await api.research.restoreNote(databaseId, detail.note.id, { baseRevision: detail.revision });
      setDetail(changed);
      setNotice(changed.note.status === "archived" ? "Research Note archived." : "Research Note restored.");
      setFilter(changed.note.status === "archived" ? "archived" : "active");
      setReloadRevision((current) => current + 1);
    } catch (reason) {
      setError(errorMessage(reason, "Research Note lifecycle could not be changed."));
    } finally {
      setIsSaving(false);
    }
  }

  return <>
    <aside aria-label="Research Notes" className="rs8-rail rn1-note-rail">
      <div className="rs8-rail-head"><strong>{databaseName}</strong><span>{list?.total ?? 0}</span></div>
      <div aria-label="Research Note status" className="rn1-filter" role="tablist">
        <button aria-selected={filter === "active"} disabled={dirty} onClick={() => setFilter("active")} role="tab" type="button">Active</button>
        <button aria-selected={filter === "archived"} disabled={dirty} onClick={() => setFilter("archived")} role="tab" type="button">Archived</button>
      </div>
      {isLoadingList ? <div className="rs8-loading">Loading Research Notes</div> : list && list.notes.length > 0 ? <div className="rn1-note-list">{list.notes.map((note) => {
        const state = summaryStatus(note);
        const selected = note.id === selectedNoteId;
        return <button aria-current={selected ? "true" : undefined} className={selected ? "is-selected" : ""} disabled={isSaving || (dirty && !selected)} key={note.id} onClick={() => chooseNote(note.id)} type="button">
          <span aria-hidden="true" className="rn1-note-spine"><i /></span>
          <span><strong>{note.title}</strong><small>{note.evidenceCount} evidence · {formatUpdatedAt(note.updatedAt)}</small><em className={`is-${state.tone}`}>{state.label}</em></span>
        </button>;
      })}</div> : <div className="rs8-rail-empty"><strong>No {filter} Notes</strong><p>Open an exact Source passage and choose Add to project to begin an evidence-bound Note.</p></div>}
      {list && list.issueCount > 0 ? <div className="rn1-diagnostic"><FileWarning aria-hidden="true" size={15} /><span><strong>{list.issueCount} Note file{list.issueCount === 1 ? "" : "s"} need attention</strong><small>Healthy Notes remain available.</small></span></div> : null}
    </aside>

    <main className="rs8-reader rn1-note-editor">
      {(error || notice) ? <div aria-live="polite" className={`rs8-banner${error ? " is-error" : ""}`} role={error ? "alert" : "status"}>{error || notice}</div> : null}
      {isLoadingDetail ? <div aria-live="polite" className="rs8-reader-loading"><span /><p>Opening Research Note</p></div> : detail && draft ? <form onSubmit={(event) => void saveNote(event)}>
        <header>
          <div><p>{detail.note.status === "archived" ? "Archived interpretation" : "Author interpretation"}</p><span>{detail.note.evidence.length} evidence item{detail.note.evidence.length === 1 ? "" : "s"} · Updated {formatUpdatedAt(detail.note.updatedAt)}</span></div>
          <div className="rn1-editor-actions">
            <button aria-label={detail.note.status === "active" ? "Archive Research Note" : "Restore Research Note"} disabled={dirty || isSaving} onClick={() => void changeArchiveState()} title={detail.note.status === "active" ? "Archive Research Note" : "Restore Research Note"} type="button">{detail.note.status === "active" ? <Archive aria-hidden="true" size={16} /> : <RotateCcw aria-hidden="true" size={16} />}</button>
          </div>
        </header>
        <label className="rn1-title"><span>Title</span><input disabled={detail.note.status === "archived" || isSaving} maxLength={200} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required value={draft.title} /></label>
        <label className="rn1-body"><span>Your interpretation</span><textarea disabled={detail.note.status === "archived" || isSaving} maxLength={400000} onChange={(event) => setDraft({ ...draft, body: event.target.value })} placeholder="Develop what the evidence means for your work." value={draft.body} /></label>
        <label className="rn1-tags"><span>Tags</span><input disabled={detail.note.status === "archived" || isSaving} maxLength={3200} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} placeholder="history, ritual, setting" value={draft.tags} /></label>
        {detail.note.status === "active" ? <footer><span>{dirty ? "Unsaved changes" : "Saved"}</span><div><button className="rs8-discard" disabled={!dirty || isSaving} onClick={() => { setDraft(savedDraft); setError(""); }} type="button">Discard</button><button className="rs8-save" disabled={!dirty || isSaving || !draft.title.trim()} type="submit"><Save aria-hidden="true" size={14} />{isSaving ? "Saving" : "Save Note"}</button></div></footer> : <div className="rn1-archived-message"><Archive aria-hidden="true" size={16} /><span>Restore this Note before editing it.</span></div>}
      </form> : selectedSummary ? <div className="rs8-empty"><FileWarning aria-hidden="true" size={22} /><h2>Research Note unavailable</h2><p>The Note remains listed. Retry without discarding any other Note draft.</p><button onClick={() => setDetailReloadRevision((current) => current + 1)} type="button">Retry Note</button></div> : <div className="rs8-empty"><BookOpenText aria-hidden="true" size={22} /><h2>Evidence becomes a Note from Sources</h2><p>Open a search result, inspect the exact original passage, then choose Add to project. Notes do not become Canon automatically.</p></div>}
    </main>

    <aside aria-label="Research Note evidence" className="rs8-inspector rn1-evidence-inspector">
      <header><div><p>Original sources</p><h2>Evidence</h2></div>{detail ? <span className="rs8-status">{detail.evidence.length}</span> : null}</header>
      {detail ? <div className="rn1-evidence-list">{detail.evidence.map((resolved) => {
        const tone = resolved.freshness === "current" ? "current" : resolved.freshness === "source-revision-changed" ? "warning" : "error";
        return <article className={`is-${tone}`} key={resolved.evidence.id}>
          <div aria-hidden="true" className="rn1-evidence-spine"><span /></div>
          <div>
            <header><span>{resolved.currentSourceDisplayName ?? resolved.evidence.sourceDisplayName}</span>{tone === "current" ? <CheckCircle2 aria-hidden="true" size={14} /> : <AlertTriangle aria-hidden="true" size={14} />}</header>
            <p className="rn1-evidence-state">{freshnessLabel(resolved.freshness)}</p>
            <dl><div><dt>Database</dt><dd>{databaseName}</dd></div><div><dt>Location</dt><dd>{formatLocation(resolved.evidence.location)}</dd></div><div><dt>Passage language</dt><dd>{resolved.evidence.languageTag}</dd></div><div><dt>AI use</dt><dd>{resolved.modelUse === "forbidden" ? "Never send" : resolved.modelUse === "allowed" ? "Allowed when selected" : "Unknown"}</dd></div></dl>
            <blockquote>{resolved.evidence.originalText}</blockquote>
            <details><summary>Evidence identity</summary><code>{resolved.evidence.chunkHash}</code></details>
          </div>
        </article>;
      })}</div> : <div className="rs8-inspector-empty"><p>Select a Research Note to inspect the unchanged original-language evidence beside your interpretation.</p></div>}
    </aside>
  </>;
}
