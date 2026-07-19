import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  MAX_RESEARCH_SOURCE_BYTES,
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

function draftFromDetail(detail: ResearchSourceDetail): SourceDraft {
  return {
    displayName: detail.source.displayName,
    author: detail.source.author,
    declaredLanguage: detail.source.declaredLanguage ?? "",
    tags: detail.source.tags.join(", "),
    aiPermission: detail.source.aiPermission,
    useNotes: detail.source.useNotes,
  };
}

function parseTags(value: string): string[] {
  return value.split(/[,，\n]/u).map((tag) => tag.trim()).filter(Boolean);
}

function sameDraft(left: SourceDraft | null, right: SourceDraft | null): boolean {
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

function selectionKey(seriesId: string): string {
  return `novel-studio.research.selected.${seriesId}`;
}

export function ReferenceResearchWorkspace({ seriesId }: ReferenceResearchWorkspaceProps) {
  const [sources, setSources] = useState<ResearchSourceDocument[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ResearchSourceDetail | null>(null);
  const [draft, setDraft] = useState<SourceDraft | null>(null);
  const [savedDraft, setSavedDraft] = useState<SourceDraft | null>(null);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [railOpen, setRailOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDirty = !sameDraft(draft, savedDraft);
  const selectedListDocument = useMemo(
    () => sources.find((document) => document.source.id === selectedSourceId) ?? null,
    [selectedSourceId, sources],
  );

  useEffect(() => {
    setSources([]);
    setSelectedSourceId(null);
    setDetail(null);
    setDraft(null);
    setSavedDraft(null);
    setError("");
    setNotice("");
    if (!seriesId) return;

    let cancelled = false;
    setIsLoadingSources(true);
    void api.research.listSources(seriesId).then((listed) => {
      if (cancelled) return;
      setSources(listed);
      const restored = globalThis.localStorage?.getItem(selectionKey(seriesId)) ?? null;
      const selected = listed.find((document) => document.source.id === restored) ?? listed[0] ?? null;
      if (restored && !listed.some((document) => document.source.id === restored)) {
        setNotice("The previously selected source is no longer available. Showing the source shelf instead.");
      }
      setSelectedSourceId(selected?.source.id ?? null);
    }).catch((reason) => {
      if (!cancelled) setError(errorMessage(reason, "Research sources could not be loaded."));
    }).finally(() => {
      if (!cancelled) setIsLoadingSources(false);
    });
    return () => {
      cancelled = true;
    };
  }, [seriesId]);

  useEffect(() => {
    if (!seriesId || !selectedSourceId) {
      setDetail(null);
      setDraft(null);
      setSavedDraft(null);
      return;
    }
    globalThis.localStorage?.setItem(selectionKey(seriesId), selectedSourceId);
    let cancelled = false;
    setIsLoadingDetail(true);
    setError("");
    void api.research.getSource(seriesId, selectedSourceId).then((loaded) => {
      if (cancelled) return;
      const nextDraft = draftFromDetail(loaded);
      setDetail(loaded);
      setDraft(nextDraft);
      setSavedDraft(nextDraft);
    }).catch((reason) => {
      if (cancelled) return;
      setSources((current) => current.filter((document) => document.source.id !== selectedSourceId));
      globalThis.localStorage?.removeItem(selectionKey(seriesId));
      setSelectedSourceId(null);
      setDetail(null);
      setDraft(null);
      setSavedDraft(null);
      setRailOpen(true);
      setError(errorMessage(reason, "The selected Research source could not be opened."));
    }).finally(() => {
      if (!cancelled) setIsLoadingDetail(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedSourceId, seriesId]);

  function chooseSource(sourceId: string) {
    setSelectedSourceId(sourceId);
    setRailOpen(false);
    setNotice("");
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !seriesId) return;
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
      const created = await api.research.importSource(seriesId, {
        fileName: file.name,
        mediaType: isMarkdown ? "text/markdown" : "text/plain",
        sizeBytes: file.size,
        contentBase64: await fileToBase64(file),
      });
      setSources((current) => [
        { source: created.source, revision: created.revision },
        ...current.filter((document) => document.source.id !== created.source.id),
      ]);
      setSelectedSourceId(created.source.id);
      const nextDraft = draftFromDetail(created);
      setDetail(created);
      setDraft(nextDraft);
      setSavedDraft(nextDraft);
      setNotice(`Imported ${created.source.originalFileName}.`);
    } catch (reason) {
      setError(errorMessage(reason, "The Research source could not be imported."));
    } finally {
      setIsUploading(false);
    }
  }

  async function saveProperties(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!seriesId || !detail || !draft || !isDirty) return;
    const tags = parseTags(draft.tags);
    const normalizedTags = tags.map((tag) => tag.toLocaleLowerCase("und"));
    if (new Set(normalizedTags).size !== normalizedTags.length) {
      setError("Remove duplicate tags before saving.");
      return;
    }
    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await api.research.updateSource(seriesId, detail.source.id, {
        baseRevision: detail.revision,
        displayName: draft.displayName,
        author: draft.author,
        declaredLanguage: draft.declaredLanguage.trim() || null,
        tags,
        aiPermission: draft.aiPermission,
        useNotes: draft.useNotes,
      });
      const nextDraft = draftFromDetail(updated);
      setDetail(updated);
      setDraft(nextDraft);
      setSavedDraft(nextDraft);
      setSources((current) => current.map((document) =>
        document.source.id === updated.source.id
          ? { source: updated.source, revision: updated.revision }
          : document,
      ));
      setNotice("Source properties saved.");
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409) {
        try {
          const latest = await api.research.getSource(seriesId, detail.source.id);
          setDetail(latest);
          setSavedDraft(draftFromDetail(latest));
          setSources((current) => current.map((document) =>
            document.source.id === latest.source.id
              ? { source: latest.source, revision: latest.revision }
              : document,
          ));
          setError("This source changed elsewhere. Your draft is still here; review it and save again to apply it to the latest revision.");
        } catch (refreshReason) {
          setError(errorMessage(refreshReason, "The latest source revision could not be loaded."));
        }
      } else {
        setError(errorMessage(reason, "Source properties could not be saved."));
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section aria-label="Research workspace" className="rs8 workspace-view" data-workspace-view="Research" hidden id="research-workspace">
      <header className="rs8-toolbar">
        <div className="rs8-heading">
          <button
            aria-expanded={railOpen}
            aria-label="Toggle source shelf"
            className="rs8-rail-toggle"
            onClick={() => setRailOpen((open) => !open)}
            type="button"
          >
            <span aria-hidden="true">=</span>
          </button>
          <div><p>Reference library</p><h1>Research</h1></div>
        </div>
        <button
          className="rs8-upload"
          disabled={!seriesId || isUploading}
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          <span aria-hidden="true">+</span>
          {isUploading ? "Importing" : "Add source"}
        </button>
        <input
          accept=".txt,.md,text/plain,text/markdown"
          aria-label="Choose a TXT or Markdown Research source"
          hidden
          onChange={(event) => void importFile(event)}
          ref={fileInputRef}
          type="file"
        />
      </header>

      <div className={`rs8-layout${railOpen ? " is-rail-open" : ""}`}>
        <aside aria-label="Research sources" className="rs8-rail">
          <div className="rs8-rail-head"><strong>Sources</strong><span>{sources.length}</span></div>
          {!seriesId ? (
            <div className="rs8-rail-empty"><strong>No Series open</strong><p>Open a Series from the Project Library before adding sources.</p></div>
          ) : isLoadingSources ? (
            <div aria-live="polite" className="rs8-loading">Loading source shelf</div>
          ) : sources.length === 0 ? (
            <div className="rs8-rail-empty"><strong>Your source shelf is empty</strong><p>Add a UTF-8 TXT or Markdown file to begin.</p></div>
          ) : (
            <div className="rs8-source-list">
              {sources.map((document) => {
                const source = document.source;
                const selected = source.id === selectedSourceId;
                return (
                  <button
                    aria-current={selected ? "true" : undefined}
                    className={`rs8-source${selected ? " is-selected" : ""}`}
                    key={source.id}
                    onClick={() => chooseSource(source.id)}
                    title={source.displayName}
                    type="button"
                  >
                    <span aria-hidden="true" className="rs8-spine"><i /></span>
                    <span className="rs8-source-copy"><strong>{source.displayName}</strong><span>{source.kind === "markdown" ? "Markdown" : "Text"} · {source.declaredLanguage ?? "Language not set"}</span></span>
                    <span aria-label="Parsed" className="rs8-ready">Ready</span>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <main className="rs8-reader">
          {(error || notice) ? <div aria-live="polite" className={`rs8-banner${error ? " is-error" : ""}`} role={error ? "alert" : "status"}>{error || notice}</div> : null}
          {!seriesId ? (
            <div className="rs8-empty"><span aria-hidden="true">NS</span><h2>Open a Series to build its source shelf</h2><p>Research sources stay with the active Series and remain separate from Canon.</p><button onClick={() => document.getElementById("project-library-button")?.click()} type="button">Open Project Library</button></div>
          ) : isLoadingDetail ? (
            <div aria-live="polite" className="rs8-reader-loading"><span /><p>Opening source</p></div>
          ) : detail ? (
            <article className="rs8-document">
              <header>
                <div className="rs8-document-mark"><span aria-hidden="true" /><em>{detail.source.kind === "markdown" ? "MD" : "TXT"}</em></div>
                <div><p>{detail.source.originalFileName}</p><h2>{detail.source.displayName}</h2><span>Imported {formatImportedAt(detail.source.importedAt)} · {formatBytes(detail.source.sizeBytes)}</span></div>
              </header>
              <div className="rs8-preview-label"><strong>Original text</strong><span>Unchanged UTF-8 source</span></div>
              <pre className="rs8-preview">{detail.originalText}</pre>
            </article>
          ) : (
            <div className="rs8-empty"><span aria-hidden="true">+</span><h2>Add a source for this Series</h2><p>TXT and Markdown are available in this first library slice.</p><button disabled={isUploading} onClick={() => fileInputRef.current?.click()} type="button">Choose file</button></div>
          )}
        </main>

        <aside aria-label="Source properties" className="rs8-inspector">
          <header><div><p>Selected source</p><h2>Properties</h2></div>{detail ? <span className="rs8-status">Parsed</span> : null}</header>
          {detail && draft ? (
            <form onSubmit={(event) => void saveProperties(event)}>
              <label><span>Display name</span><input maxLength={240} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} required value={draft.displayName} /></label>
              <label><span>Author</span><input maxLength={240} onChange={(event) => setDraft({ ...draft, author: event.target.value })} value={draft.author} /></label>
              <label><span>Declared language</span><input maxLength={64} onChange={(event) => setDraft({ ...draft, declaredLanguage: event.target.value })} placeholder="zh-CN, ja-JP, en" value={draft.declaredLanguage} /></label>
              <label><span>Tags</span><input maxLength={1200} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} placeholder="history, folklore" value={draft.tags} /></label>
              <fieldset>
                <legend>AI context permission</legend>
                <div className="rs8-permission">
                  <label><input checked={draft.aiPermission === "never"} name="research-ai-permission" onChange={() => setDraft({ ...draft, aiPermission: "never" })} type="radio" /><span>Never send</span></label>
                  <label><input checked={draft.aiPermission === "allowed"} name="research-ai-permission" onChange={() => setDraft({ ...draft, aiPermission: "allowed" })} type="radio" /><span>Allow when selected</span></label>
                </div>
              </fieldset>
              <label><span>Copyright / use notes</span><textarea maxLength={8000} onChange={(event) => setDraft({ ...draft, useNotes: event.target.value })} rows={4} value={draft.useNotes} /></label>
              <button className="rs8-save" disabled={!isDirty || isSaving || !draft.displayName.trim()} type="submit">{isSaving ? "Saving" : "Save properties"}</button>
              <details className="rs8-facts">
                <summary>Import facts</summary>
                <dl>
                  <div><dt>Type</dt><dd>{detail.source.mediaType}</dd></div>
                  <div><dt>Original file</dt><dd>{detail.source.originalFileName}</dd></div>
                  <div><dt>Size</dt><dd>{formatBytes(detail.source.sizeBytes)}</dd></div>
                  <div><dt>Parser</dt><dd>{detail.source.parserName} v{detail.source.parserVersion}</dd></div>
                  <div><dt>SHA-256</dt><dd title={detail.source.contentHash}>{detail.source.contentHash}</dd></div>
                </dl>
              </details>
            </form>
          ) : (
            <div className="rs8-inspector-empty"><p>{selectedListDocument ? "Opening source properties." : "Select a source to manage its properties."}</p></div>
          )}
        </aside>
      </div>
    </section>
  );
}
