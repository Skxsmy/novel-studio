import { useEffect, useMemo, useRef, useState } from "react";

import { sceneBlockDocumentStats } from "../../app/sceneBlocks";
import { useProjectSession, type ProjectSessionState, type SaveStatus } from "../../app/useProjectSession";
import { NovelEditor } from "./editor/NovelEditor";
import { ReferenceWriteHierarchy } from "./ReferenceWriteHierarchy";
import { ReferenceWriteInspector } from "./ReferenceWriteInspector";
import { useWriteStoryChanges } from "./useWriteStoryChanges";
import "./reference-write.css";

function savePresentation(status: SaveStatus, hasScene: boolean) {
  if (!hasScene) return { className: "is-idle", label: "No Scene" };
  if (status === "dirty" || status === "saving") return { className: "is-saving", label: "Saving" };
  if (status === "retrying") return { className: "is-retrying", label: "Retrying" };
  if (status === "failed") return { className: "is-failed", label: "Failed" };
  if (status === "conflict") return { className: "is-conflict", label: "Conflict" };
  return { className: "is-saved", label: "Saved" };
}

function ConnectedWriteWorkspace() {
  const session = useProjectSession();
  const openingSeriesRef = useRef<string | null>(null);

  useEffect(() => {
    if (session.isLibraryLoading || session.isOpeningSeries || session.activeSeries) return;
    const firstSeries = session.seriesList[0];
    if (!firstSeries || openingSeriesRef.current === firstSeries.id) return;
    openingSeriesRef.current = firstSeries.id;
    void session.openSeries(firstSeries.id);
  }, [session.activeSeries, session.isLibraryLoading, session.isOpeningSeries, session.openSeries, session.seriesList]);

  return <ReferenceWriteWorkspace session={session} />;
}

export function ReferenceConnectedWriteWorkspace() {
  return <ConnectedWriteWorkspace />;
}

export function ReferenceWriteWorkspace({ session }: { session: ProjectSessionState }) {
  const [isOutlineOpen, setIsOutlineOpen] = useState(() => window.innerWidth > 1180);
  const [isInspectorOpen, setIsInspectorOpen] = useState(() => window.innerWidth > 1500);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [selectionToolbar, setSelectionToolbar] = useState<{ left: number; top: number } | null>(null);
  const paperRef = useRef<HTMLElement>(null);
  const storyChanges = useWriteStoryChanges(session);
  const series = session.activeSeries;
  const draft = session.draft;
  const scene = session.selectedScene;
  const stats = useMemo(() => draft ? sceneBlockDocumentStats(draft.document) : null, [draft]);
  const wordCount = stats ? Math.max(stats.characterCount ? 1 : 0, Math.round(stats.characterCount / 5)) : 0;
  const sceneIndex = series && scene
    ? [...series.scenes]
      .sort((left, right) => left.metadata.order - right.metadata.order)
      .findIndex((candidate) => candidate.metadata.id === scene.metadata.id)
    : -1;
  const volume = series?.books.find((item) => item.id === scene?.metadata.bookId) ?? null;
  const chapter = series?.acts.find((item) => item.id === scene?.metadata.actId) ?? null;
  const act = series?.chapters.find((item) => item.id === scene?.metadata.chapterId) ?? null;
  const save = savePresentation(session.saveStatus, Boolean(draft));
  const rootClassName = [
    "wr6 workspace-view",
    isOutlineOpen ? "has-outline" : "",
    isInspectorOpen ? "has-inspector" : "",
    isFocusMode ? "is-focus" : "",
  ].filter(Boolean).join(" ");

  function toggleOutline() {
    setIsOutlineOpen((current) => {
      const next = !current;
      if (next && window.innerWidth <= 1180) setIsInspectorOpen(false);
      return next;
    });
  }

  function toggleInspector() {
    setIsInspectorOpen((current) => {
      const next = !current;
      if (next && window.innerWidth <= 1180) setIsOutlineOpen(false);
      return next;
    });
  }

  useEffect(() => {
    function closePanelsAtReferenceBreakpoints() {
      if (window.innerWidth <= 1180) {
        setIsOutlineOpen(false);
        setIsInspectorOpen(false);
      } else if (window.innerWidth <= 1500) {
        setIsInspectorOpen(false);
      }
    }
    window.addEventListener("resize", closePanelsAtReferenceBreakpoints);
    return () => window.removeEventListener("resize", closePanelsAtReferenceBreakpoints);
  }, []);

  useEffect(() => {
    function updateSelectionToolbar() {
      const paper = paperRef.current;
      const selection = window.getSelection();
      if (!paper || !selection || selection.rangeCount === 0 || selection.isCollapsed || !selection.toString().trim()) {
        setSelectionToolbar(null);
        return;
      }
      const anchor = selection.anchorNode;
      const focus = selection.focusNode;
      if (!anchor || !focus || !paper.contains(anchor) || !paper.contains(focus)) {
        setSelectionToolbar(null);
        return;
      }
      const elementFor = (node: Node) => node instanceof Element ? node : node.parentElement;
      const anchorBlock = elementFor(anchor)?.closest("[data-block-id]");
      const focusBlock = elementFor(focus)?.closest("[data-block-id]");
      if (!anchorBlock || anchorBlock !== focusBlock) {
        setSelectionToolbar(null);
        return;
      }
      const rangeRect = selection.getRangeAt(0).getBoundingClientRect();
      const paperRect = paper.getBoundingClientRect();
      const toolbarWidth = 540;
      const maxLeft = Math.max(16, paper.clientWidth - toolbarWidth - 16);
      const center = rangeRect.left - paperRect.left + rangeRect.width / 2;
      setSelectionToolbar({
        left: Math.min(maxLeft, Math.max(16, center - toolbarWidth / 2)),
        top: Math.max(42, rangeRect.top - paperRect.top - 8),
      });
    }
    document.addEventListener("selectionchange", updateSelectionToolbar);
    return () => document.removeEventListener("selectionchange", updateSelectionToolbar);
  }, []);

  useEffect(() => {
    setSelectionToolbar(null);
  }, [draft?.sceneId]);

  return (
    <section aria-label="Write workspace" className={rootClassName} data-workspace-view="Write" hidden id="write-workspace">
      <header className="wr6-commandbar">
        <div className="wr6-command-group">
          <button
            aria-controls="wr6-outline"
            aria-expanded={isOutlineOpen}
            aria-label="Toggle manuscript structure"
            className="wr6-icon"
            onClick={toggleOutline}
            type="button"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M4 12h16M4 19h10" /></svg>
          </button>
          <div aria-label="Writing mode" className="wr6-mode">
            <button aria-pressed="true" className="is-active" disabled type="button">Draft</button>
            <button aria-pressed="false" disabled type="button">Revise</button>
          </div>
        </div>

        <nav aria-label="Current story position" className="wr6-breadcrumbs">
          <span>Series · {series?.manifest.title ?? "No Series"}</span><i>/</i>
          <span>Volume · {volume?.title ?? "—"}</span><i>/</i>
          <span>Chapter · {chapter?.title ?? "—"}</span><i>/</i>
          <span>Act · {act?.title ?? "—"}</span><i>/</i>
          <span>Scene · {scene?.metadata.title ?? "—"}</span>
        </nav>

        <div className="wr6-command-actions">
          <button
            aria-pressed={isFocusMode}
            className={`wr6-button${isFocusMode ? " is-active" : ""}`}
            onClick={() => setIsFocusMode((current) => !current)}
            type="button"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" /></svg>
            <span className="wr6-button-label">{isFocusMode ? "Exit Focus" : "Focus"}</span>
          </button>
          <button
            aria-controls="wr6-inspector"
            aria-expanded={isInspectorOpen}
            aria-label="Toggle writing sidebar"
            className="wr6-icon"
            onClick={toggleInspector}
            type="button"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4zM15 4v16" /></svg>
          </button>
        </div>
      </header>

      {series ? (
        <div className="wr6-layout">
          <ReferenceWriteHierarchy onClose={() => setIsOutlineOpen(false)} session={session} />

          <main aria-label="Scene editor" className="wr6-editor-shell">
            <div className="wr6-editor-scroll">
              <div className="wr6-candidate-bar" role="status" hidden>
                <span>Candidate ready</span>
                <div className="wr6-candidate-actions"><button disabled type="button">Keep</button><button disabled type="button">Undo</button></div>
              </div>
              <article className="wr6-paper" ref={paperRef}>
                <div className="wr6-scene-label">{sceneIndex >= 0 ? `Scene ${sceneIndex + 1}` : "Scene"}</div>
                <input
                  aria-label="Scene title"
                  className="wr6-title"
                  disabled={!draft}
                  onChange={(event) => session.updateDraftTitle(event.target.value)}
                  value={draft?.title ?? ""}
                />
                <div
                  aria-label="Selection actions"
                  className="wr6-selection-toolbar"
                  hidden={!selectionToolbar}
                  role="toolbar"
                  style={selectionToolbar ?? undefined}
                >
                  <button className="wr6-action" disabled type="button">Comment</button>
                  <button className="wr6-action" disabled type="button">Add to Snippet</button>
                  <button className="wr6-action ai" disabled type="button">Expand</button>
                  <button className="wr6-action ai" disabled type="button">Compress</button>
                  <button className="wr6-action ai" disabled type="button">Rephrase</button>
                  <button className="wr6-action ai" disabled type="button">Custom Prompt</button>
                </div>
                {session.errorMessage ? <p className="wr6-editor-error" role="alert">{session.errorMessage}</p> : null}
                {draft ? (
                  <div className="wr6-copy">
                    <NovelEditor
                      codexEntries={storyChanges.codexEntries}
                      document={draft.document}
                      focusBlockId={storyChanges.focusBlockId}
                      onActiveBlockChange={storyChanges.setActiveEditorBlockId}
                      onChange={session.updateDraftDocument}
                      onDeleteProgressionBlock={storyChanges.deleteBlock}
                      onFocusBlockHandled={(blockId) => {
                        if (storyChanges.focusBlockId === blockId) storyChanges.setFocusBlockId(null);
                      }}
                      onMoveProgressionBlock={storyChanges.moveBlock}
                      onMoveProgressionBlockTo={storyChanges.moveBlockTo}
                      onSelectStoryChange={storyChanges.setSelectedBlockId}
                      onToggleProgressionCollapse={storyChanges.toggleBlock}
                      onUpdateProgressionDraft={storyChanges.updateBlockDraft}
                      progressionNodeViews={storyChanges.progressionNodeViews}
                      resolveCodexPreviewDescription={storyChanges.resolvePreviewDescription}
                      storyChangePresentation="write-story-change"
                    />
                  </div>
                ) : (
                  <div className="wr6-empty-editor"><strong>Select a Scene</strong><span>Choose a Scene in Manuscript to begin writing.</span></div>
                )}
              </article>
            </div>

            <footer aria-label="Writing status" className="wr6-status">
              <div className="wr6-status-group">
                <span aria-atomic="true" aria-live="polite" className={`wr6-save ${save.className}`} role="status">
                  <span aria-hidden="true" className="wr6-save-indicator" />
                  <span className="wr6-save-label">{save.label}</span>
                </span>
                <span>{wordCount} words</span>
                <span>{stats?.paragraphCount ?? 0} paragraphs</span>
              </div>
              <div className="wr6-status-group"><span>POV · {scene?.metadata.pov || "Not set"}</span><button className="wr6-status-action" disabled type="button">Continuity</button></div>
            </footer>
          </main>

          <ReferenceWriteInspector session={session} storyChanges={storyChanges} />
        </div>
      ) : (
        <div className="wr6-unavailable" role="status">
          <strong>{session.isLibraryLoading || session.isOpeningSeries ? "Opening manuscript…" : "No Series is open"}</strong>
          <span>{session.errorMessage ?? "Open or create a Series from Project Library."}</span>
        </div>
      )}
    </section>
  );
}
