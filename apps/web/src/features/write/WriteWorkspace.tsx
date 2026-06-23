import { useState } from "react";
import type {
  ActManifest,
  BookManifest,
  ChapterManifest,
  CreateActInput,
  CreateBookInput,
  CreateChapterInput,
  CreateSceneInput,
  SceneDocument,
  SeriesDetail,
  UpdateActInput,
  UpdateBookInput,
  UpdateChapterInput,
} from "@novel-studio/contracts";
import { uiText } from "../../app/uiText";
import type { SaveStatus, SceneDraft } from "../../app/useProjectSession";

export interface WriteWorkspaceProps {
  draft: SceneDraft | null;
  errorMessage: string | null;
  isCreatingStructure: boolean;
  isDirty: boolean;
  isFocusMode: boolean;
  onDeleteAct: (actId: string) => Promise<void>;
  onDeleteVolume: (bookId: string) => Promise<void>;
  onDeleteChapter: (chapterId: string) => Promise<void>;
  onDeleteScene: (sceneId: string) => Promise<void>;
  onCreateAct: (input?: CreateActInput) => Promise<void>;
  onCreateVolume: (input?: CreateBookInput) => Promise<void>;
  onCreateChapter: (input?: CreateChapterInput) => Promise<void>;
  onCreateScene: (input?: CreateSceneInput) => Promise<void>;
  onSaveDraft: () => Promise<void>;
  onSelectAct: (actId: string) => void;
  onSelectChapter: (chapterId: string) => void;
  onSelectScene: (sceneId: string) => void;
  onToggleFocus: () => void;
  onUpdateAct: (actId: string, input: UpdateActInput) => Promise<void>;
  onUpdateVolume: (bookId: string, input: UpdateBookInput) => Promise<void>;
  onUpdateChapter: (chapterId: string, input: UpdateChapterInput) => Promise<void>;
  onUpdateContent: (content: string) => void;
  onUpdateTitle: (title: string) => void;
  saveStatus: SaveStatus;
  selectedActId: string | null;
  selectedChapterId: string | null;
  selectedScene: SceneDocument | null;
  series: SeriesDetail;
}

function saveText(status: SaveStatus) {
  if (status === "dirty") return "Unsaved";
  if (status === "saving") return "Saving";
  if (status === "failed") return "Failed";
  if (status === "conflict") return "Conflict";
  if (status === "saved") return "Saved just now";
  return "Idle";
}

function saveClass(status: SaveStatus) {
  if (status === "saved") return "pill green";
  if (status === "dirty" || status === "saving") return "pill amber";
  if (status === "failed" || status === "conflict") return "pill amber";
  return "pill";
}

function sceneWords(scene: SceneDocument) {
  return `${Math.max(1, Math.round(scene.characterCount / 5)).toLocaleString()} words`;
}

function sceneMeta(scene: SceneDocument) {
  const status = scene.metadata.status;
  return scene.metadata.pov ? `${status} / ${scene.metadata.pov}` : status;
}

function sortedByOrder<T extends { order: number }>(items: T[]) {
  return [...items].sort((left, right) => left.order - right.order);
}

function toggleSetValue(values: Set<string>, value: string) {
  const next = new Set(values);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

type StructureCreateType = "volume" | "act" | "chapter" | "scene";
type RenamingStructure = { type: "volume" | "act" | "chapter"; id: string; title: string };
type SelectedStructure = { type: StructureCreateType; id: string };

const structureCreateLabels: Record<StructureCreateType, string> = {
  volume: uiText.hierarchy.volume,
  act: uiText.hierarchy.chapter,
  chapter: uiText.hierarchy.act,
  scene: uiText.hierarchy.scene,
};

export function WriteWorkspace({
  draft,
  errorMessage,
  isCreatingStructure,
  isDirty,
  isFocusMode,
  onDeleteAct,
  onDeleteVolume,
  onDeleteChapter,
  onDeleteScene,
  onCreateAct,
  onCreateVolume,
  onCreateChapter,
  onCreateScene,
  onSaveDraft,
  onSelectAct,
  onSelectChapter,
  onSelectScene,
  onToggleFocus,
  onUpdateAct,
  onUpdateVolume,
  onUpdateChapter,
  onUpdateContent,
  onUpdateTitle,
  saveStatus,
  selectedActId,
  selectedChapterId,
  selectedScene,
  series,
}: WriteWorkspaceProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [renamingStructure, setRenamingStructure] = useState<RenamingStructure | null>(null);
  const [selectedStructure, setSelectedStructure] = useState<SelectedStructure | null>(null);
  const [collapsedBooks, setCollapsedBooks] = useState<Set<string>>(() => new Set());
  const [collapsedActs, setCollapsedActs] = useState<Set<string>>(() => new Set());
  const [collapsedChapters, setCollapsedChapters] = useState<Set<string>>(() => new Set());
  const charactersInScene = selectedScene
    ? selectedScene.metadata.characterIds.length + selectedScene.metadata.locationIds.length + selectedScene.metadata.plotThreadIds.length
    : 0;
  const canCreateAct = series.books.length > 0;
  const canCreateChapter = Boolean(selectedActId ?? series.acts[0]?.id ?? series.books[0]?.actIds[0]);
  const canCreateScene = Boolean(selectedChapterId ?? selectedScene?.metadata.chapterId ?? series.chapters[0]?.id);
  const actsByBook = new Map<string, ActManifest[]>();
  for (const act of sortedByOrder(series.acts)) {
    actsByBook.set(act.bookId, [...(actsByBook.get(act.bookId) ?? []), act]);
  }
  const chaptersByAct = new Map<string, ChapterManifest[]>();
  for (const chapter of sortedByOrder(series.chapters)) {
    chaptersByAct.set(chapter.actId, [...(chaptersByAct.get(chapter.actId) ?? []), chapter]);
  }
  const scenesByChapter = new Map<string, SceneDocument[]>();
  for (const scene of [...series.scenes].sort((left, right) => left.metadata.order - right.metadata.order)) {
    scenesByChapter.set(scene.metadata.chapterId, [...(scenesByChapter.get(scene.metadata.chapterId) ?? []), scene]);
  }
  const orderedBooks: BookManifest[] = sortedByOrder(series.books);
  const selectedVolume = selectedStructure?.type === "volume"
    ? series.books.find((book) => book.id === selectedStructure.id)
    : null;
  const selectedAct = selectedStructure?.type === "act"
    ? series.acts.find((act) => act.id === selectedStructure.id)
    : null;
  const selectedChapter = selectedStructure?.type === "chapter"
    ? series.chapters.find((chapter) => chapter.id === selectedStructure.id)
    : null;
  const selectedStructureScene = selectedStructure?.type === "scene"
    ? series.scenes.find((scene) => scene.metadata.id === selectedStructure.id)
    : null;
  const deleteTarget = selectedVolume
    ? { type: "volume" as const, id: selectedVolume.id, title: selectedVolume.title, label: uiText.hierarchy.volume }
    : selectedAct
      ? { type: "act" as const, id: selectedAct.id, title: selectedAct.title, label: uiText.hierarchy.chapter }
      : selectedChapter
        ? { type: "chapter" as const, id: selectedChapter.id, title: selectedChapter.title, label: uiText.hierarchy.act }
        : selectedStructureScene
          ? { type: "scene" as const, id: selectedStructureScene.metadata.id, title: selectedStructureScene.metadata.title, label: uiText.hierarchy.scene }
          : selectedScene
            ? { type: "scene" as const, id: selectedScene.metadata.id, title: selectedScene.metadata.title, label: uiText.hierarchy.scene }
            : null;

  function canCreateStructure(type: StructureCreateType) {
    if (type === "volume") return true;
    if (type === "act") return canCreateAct;
    if (type === "chapter") return canCreateChapter;
    return canCreateScene;
  }

  async function createStructure(type: StructureCreateType) {
    if (!canCreateStructure(type) || isCreatingStructure) return;
    if (type === "volume") await onCreateVolume();
    else if (type === "act") await onCreateAct();
    else if (type === "chapter") await onCreateChapter();
    else await onCreateScene();
    setIsAddOpen(false);
  }

  async function deleteSelectedStructure() {
    if (!deleteTarget || isCreatingStructure) return;
    if (deleteTarget.type === "volume") await onDeleteVolume(deleteTarget.id);
    else if (deleteTarget.type === "act") await onDeleteAct(deleteTarget.id);
    else if (deleteTarget.type === "chapter") await onDeleteChapter(deleteTarget.id);
    else await onDeleteScene(deleteTarget.id);
    setSelectedStructure(null);
    setIsDeleteOpen(false);
  }

  async function saveRename() {
    if (!renamingStructure) return;
    const title = renamingStructure.title.trim();
    if (!title) return;
    if (renamingStructure.type === "volume") await onUpdateVolume(renamingStructure.id, { title });
    else if (renamingStructure.type === "act") await onUpdateAct(renamingStructure.id, { title });
    else await onUpdateChapter(renamingStructure.id, { title });
    setRenamingStructure(null);
  }

  function cancelRename() {
    setRenamingStructure(null);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2 className="page-title">Write</h2>
          <p className="page-subtitle">Draft the selected scene with structure and story memory close at hand.</p>
        </div>
        <div className="segmented" role="tablist" aria-label="Write mode">
          <button className="seg-btn is-active" type="button">Draft</button>
          <button className="seg-btn" type="button">Revise</button>
        </div>
      </div>

      <div className="write-grid">
        <aside className="panel no-shadow structure-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">{uiText.structure.title}</div>
              <div className="panel-kicker">{series.scenes.length} scenes</div>
            </div>
            <div className="structure-head-actions">
              <button
                className="btn structure-delete-trigger"
                disabled={!deleteTarget || isCreatingStructure}
                onClick={() => {
                  setIsAddOpen(false);
                  setIsDeleteOpen((value) => !value);
                }}
                type="button"
              >
                {uiText.actions.delete}
              </button>
              <button
                className="btn structure-add-trigger"
                onClick={() => {
                  setIsDeleteOpen(false);
                  setIsAddOpen((value) => !value);
                }}
                type="button"
              >
                {uiText.actions.add}
              </button>
              {isAddOpen ? (
                <div className="structure-add-menu" aria-label={uiText.structure.createItem}>
                  {(["volume", "act", "chapter", "scene"] as StructureCreateType[]).map((type) => (
                    <button
                      className="structure-menu-option"
                      disabled={!canCreateStructure(type) || isCreatingStructure}
                      key={type}
                      onClick={() => void createStructure(type)}
                      type="button"
                    >
                      {structureCreateLabels[type]}
                    </button>
                  ))}
                </div>
              ) : null}
              {isDeleteOpen && deleteTarget ? (
                <div className="structure-confirm-menu" aria-label={uiText.structure.confirmDeletion}>
                  <div className="confirm-title">{uiText.structure.deleteSelected(deleteTarget.label)}</div>
                  <div className="confirm-copy">{deleteTarget.title}</div>
                  <div className="confirm-actions">
                    <button className="btn compact" onClick={() => setIsDeleteOpen(false)} type="button">{uiText.actions.cancel}</button>
                    <button
                      className="btn compact danger"
                      disabled={isCreatingStructure}
                      onClick={() => void deleteSelectedStructure()}
                      type="button"
                    >
                      {uiText.actions.delete}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <div className="panel-body scene-map">
            {orderedBooks.map((book) => {
              const isSelectedVolume = selectedStructure?.type === "volume" && selectedStructure.id === book.id;
              const isRenamingVolume = renamingStructure?.type === "volume" && renamingStructure.id === book.id;
              return (
              <div className="structure-book" key={book.id}>
                {isRenamingVolume ? (
                  <div className={`data-row structure-book-row structure-rename-row${isSelectedVolume ? " is-active" : ""}`}>
                    <input
                      aria-label={`Rename ${book.title}`}
                      autoFocus
                      className="input structure-rename-input"
                      onChange={(event) => setRenamingStructure({ type: "volume", id: book.id, title: event.target.value })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void saveRename();
                        if (event.key === "Escape") cancelRename();
                      }}
                      value={renamingStructure.title}
                    />
                    <div className="structure-rename-actions">
                      <button className="btn compact" disabled={isCreatingStructure} onClick={() => void saveRename()} type="button">{uiText.actions.save}</button>
                      <button className="btn compact" onClick={cancelRename} type="button">{uiText.actions.cancel}</button>
                    </div>
                  </div>
                ) : (
                  <button
                    className={`data-row structure-book-row${isSelectedVolume ? " is-active" : ""}`}
                    onClick={() => {
                      setSelectedStructure({ type: "volume", id: book.id });
                      setIsDeleteOpen(false);
                    }}
                    onDoubleClick={() => setRenamingStructure({ type: "volume", id: book.id, title: book.title })}
                    title={uiText.structure.doubleClickToRename}
                    type="button"
                  >
                    <div>
                      <div className="row-title">{book.title}</div>
                      <div className="row-meta">{book.actIds.length} chapters</div>
                    </div>
                    <span className="pill">{book.actIds.length}</span>
                  </button>
                )}
                <button
                  aria-label={`${collapsedBooks.has(book.id) ? "Expand" : "Collapse"} ${uiText.hierarchy.volume}: ${book.title}`}
                  className="tree-toggle tree-toggle-float structure-book-toggle"
                  onClick={() => setCollapsedBooks((current) => toggleSetValue(current, book.id))}
                  title={collapsedBooks.has(book.id) ? "Expand" : "Collapse"}
                  type="button"
                >
                  {collapsedBooks.has(book.id) ? "+" : "-"}
                </button>
                {!collapsedBooks.has(book.id) ? (actsByBook.get(book.id) ?? []).map((act) => {
                  const chapters = chaptersByAct.get(act.id) ?? [];
                  const isSelectedAct = act.id === selectedActId;
                  const isCollapsedAct = collapsedActs.has(act.id);
                  const isRenamingAct = renamingStructure?.type === "act" && renamingStructure.id === act.id;
                  return (
                    <div className="structure-act" key={act.id}>
                      {isRenamingAct ? (
                        <div className={`data-row structure-act-row structure-rename-row${isSelectedAct ? " is-active" : ""}`}>
                          <input
                            aria-label={`Rename ${act.title}`}
                            autoFocus
                            className="input structure-rename-input"
                            onChange={(event) => setRenamingStructure({ type: "act", id: act.id, title: event.target.value })}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") void saveRename();
                              if (event.key === "Escape") cancelRename();
                            }}
                            value={renamingStructure.title}
                          />
                          <div className="structure-rename-actions">
                            <button className="btn compact" disabled={isCreatingStructure} onClick={() => void saveRename()} type="button">{uiText.actions.save}</button>
                            <button className="btn compact" onClick={cancelRename} type="button">{uiText.actions.cancel}</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className={`data-row structure-act-row${isSelectedAct ? " is-active" : ""}`}
                          onClick={() => {
                            setSelectedStructure({ type: "act", id: act.id });
                            setIsDeleteOpen(false);
                            onSelectAct(act.id);
                          }}
                          onDoubleClick={() => setRenamingStructure({ type: "act", id: act.id, title: act.title })}
                          title={uiText.structure.doubleClickToRename}
                          type="button"
                        >
                          <div>
                            <div className="row-title">{act.title}</div>
                            <div className="row-meta">{chapters.length} acts</div>
                          </div>
                          <span className="pill">{chapters.length}</span>
                        </button>
                      )}
                      <button
                        aria-label={`${isCollapsedAct ? "Expand" : "Collapse"} ${uiText.hierarchy.chapter}: ${act.title}`}
                        className="tree-toggle tree-toggle-float"
                        onClick={() => setCollapsedActs((current) => toggleSetValue(current, act.id))}
                        title={isCollapsedAct ? "Expand" : "Collapse"}
                        type="button"
                      >
                        {isCollapsedAct ? "+" : "-"}
                      </button>
                      {!isCollapsedAct ? chapters.map((chapter) => {
                        const scenes = scenesByChapter.get(chapter.id) ?? [];
                        const isSelectedChapter = chapter.id === selectedChapterId;
                        const isCollapsedChapter = collapsedChapters.has(chapter.id);
                        const isRenamingChapter = renamingStructure?.type === "chapter" && renamingStructure.id === chapter.id;
                        return (
                          <div className="structure-chapter" key={chapter.id}>
                            {isRenamingChapter ? (
                              <div className={`data-row structure-chapter-row structure-rename-row${isSelectedChapter ? " is-active" : ""}`}>
                                <input
                                  aria-label={`Rename ${chapter.title}`}
                                  autoFocus
                                  className="input structure-rename-input"
                                  onChange={(event) => setRenamingStructure({ type: "chapter", id: chapter.id, title: event.target.value })}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") void saveRename();
                                    if (event.key === "Escape") cancelRename();
                                  }}
                                  value={renamingStructure.title}
                                />
                                <div className="structure-rename-actions">
                                  <button className="btn compact" disabled={isCreatingStructure} onClick={() => void saveRename()} type="button">{uiText.actions.save}</button>
                                  <button className="btn compact" onClick={cancelRename} type="button">{uiText.actions.cancel}</button>
                                </div>
                              </div>
                            ) : (
                              <button
                                className={`data-row structure-chapter-row${isSelectedChapter ? " is-active" : ""}`}
                                onClick={() => {
                                  setSelectedStructure({ type: "chapter", id: chapter.id });
                                  setIsDeleteOpen(false);
                                  onSelectChapter(chapter.id);
                                }}
                                onDoubleClick={() => setRenamingStructure({ type: "chapter", id: chapter.id, title: chapter.title })}
                                title={uiText.structure.doubleClickToRename}
                                type="button"
                              >
                                <div>
                                  <div className="row-title">{chapter.title}</div>
                                  <div className="row-meta">{scenes.length} scenes</div>
                                </div>
                                <span className="pill">{scenes.length}</span>
                              </button>
                            )}
                            <button
                              aria-label={`${isCollapsedChapter ? "Expand" : "Collapse"} ${uiText.hierarchy.act}: ${chapter.title}`}
                              className="tree-toggle tree-toggle-float"
                              onClick={() => setCollapsedChapters((current) => toggleSetValue(current, chapter.id))}
                              title={isCollapsedChapter ? "Expand" : "Collapse"}
                              type="button"
                            >
                              {isCollapsedChapter ? "+" : "-"}
                            </button>
                            {!isCollapsedChapter ? <div className="structure-scenes">
                              {scenes.map((scene) => (
                                <button
                                  className={`scene-row${scene.metadata.id === selectedScene?.metadata.id ? " is-active" : ""}`}
                                  key={scene.metadata.id}
                                  onClick={() => {
                                    setSelectedStructure({ type: "scene", id: scene.metadata.id });
                                    setIsDeleteOpen(false);
                                    onSelectScene(scene.metadata.id);
                                  }}
                                  type="button"
                                >
                                  <div>
                                    <div className="row-title">{scene.metadata.title}</div>
                                    <div className="row-meta">{sceneMeta(scene)}</div>
                                  </div>
                                  <span className="pill blue">{sceneWords(scene)}</span>
                                </button>
                              ))}
                            </div> : null}
                          </div>
                        );
                      }) : null}
                    </div>
                  );
                }) : null}
              </div>
              );
            })}
          </div>
        </aside>

        <section className="panel manuscript-panel" aria-label="Manuscript">
          <div className="manuscript-toolbar">
            <div className="format-tools" aria-label="Editor tools">
              <button className="tool" title="Bold" type="button">B</button>
              <button className="tool" title="Italic" type="button">I</button>
              <button className="tool" title="Quote" type="button">Q</button>
              <button className="tool" title="Scene break" type="button">S</button>
            </div>
            <div className="top-actions">
              <span className={saveClass(saveStatus)}>{saveText(saveStatus)}</span>
              <span className="pill">{selectedScene?.metadata.pov ? `${selectedScene.metadata.pov} POV` : "No POV"}</span>
              <span className="pill">{draft ? `${draft.characterCount} chars` : "No scene"}</span>
              <button
                aria-pressed={isFocusMode}
                className={`btn write-focus-action${isFocusMode ? " primary" : ""}`}
                onClick={onToggleFocus}
                type="button"
              >
                {isFocusMode ? "Exit Focus" : "Focus"}
              </button>
            </div>
          </div>

          <div className="copy-area">
            {errorMessage ? <p className="alert">{errorMessage}</p> : null}
            {draft ? (
              <>
                <div className="scene-kicker">
                  <span className={isDirty ? "pill amber" : "pill green"}>{isDirty ? "Unsaved" : "Autosave on"}</span>
                  <span className="pill violet">{charactersInScene} codex marks</span>
                </div>
                <input
                  aria-label="Scene title"
                  className="scene-title-input"
                  onChange={(event) => onUpdateTitle(event.target.value)}
                  value={draft.title}
                />
                <textarea
                  aria-label="Scene content"
                  className="editor-copy editor-copy-input"
                  onChange={(event) => onUpdateContent(event.target.value)}
                  placeholder="Continue the scene..."
                  value={draft.content}
                />
              </>
            ) : (
              <div className="large-note">
                <h2>No scene open</h2>
                <p>Select a scene to begin writing.</p>
              </div>
            )}
          </div>

          <footer className="save-bar">
            <span>{saveText(saveStatus)}</span>
            <button className="btn primary" disabled={!isDirty || saveStatus === "saving"} onClick={() => void onSaveDraft()} type="button">
              Save now
            </button>
          </footer>
        </section>

        <aside className="panel no-shadow">
          <div className="panel-head">
            <div>
              <div className="panel-title">Scene Brief</div>
              <div className="panel-kicker">Visible while writing</div>
            </div>
            <button className="icon-btn" title="Collapse panel" type="button">x</button>
          </div>
          <div className="panel-body stack">
            <div className="brief-block">
              <div className="brief-label">Goal</div>
              <p className="brief-text">{selectedScene?.metadata.goal || "No scene goal yet."}</p>
            </div>
            <div className="brief-block">
              <div className="brief-label">Cast</div>
              <p className="brief-text">{selectedScene?.metadata.characterIds.length || 0} linked characters.</p>
            </div>
            <div className="brief-block">
              <div className="brief-label">Continuity</div>
              <p className="brief-text">{selectedScene?.metadata.summary || "No continuity note yet."}</p>
            </div>
            <details className="disclosure" open>
              <summary>Codex in scene <span className="pill">{charactersInScene}</span></summary>
              <div className="disclosure-body">Characters, locations, and plot threads attached to the selected scene.</div>
            </details>
          </div>
        </aside>

      </div>
    </>
  );
}
