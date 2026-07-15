import type { SeriesDetail } from "@novel-studio/contracts";
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from "react";

import type { ProjectSessionState } from "../../app/useProjectSession";

type HierarchyKind = "volume" | "chapter" | "act" | "scene";
type HierarchyTarget = {
  id: string;
  kind: HierarchyKind;
  title: string;
};
type ContextState = {
  left: number;
  target: HierarchyTarget;
  top: number;
  trigger: HTMLButtonElement;
};
type CreateLevel = HierarchyKind;

function ordered<T extends { order: number }>(items: T[]) {
  return [...items].sort((left, right) => left.order - right.order);
}

function cascadeSummary(target: HierarchyTarget, series: SeriesDetail) {
  if (target.kind === "scene") return "This permanently deletes this Scene.";
  if (target.kind === "act") {
    const sceneCount = series.scenes.filter((scene) => scene.metadata.chapterId === target.id).length;
    return `This permanently deletes ${sceneCount} Scene${sceneCount === 1 ? "" : "s"}.`;
  }
  if (target.kind === "chapter") {
    const acts = series.chapters.filter((act) => act.actId === target.id);
    const actIds = new Set(acts.map((act) => act.id));
    const sceneCount = series.scenes.filter((scene) => actIds.has(scene.metadata.chapterId)).length;
    return `This permanently deletes ${acts.length} Act${acts.length === 1 ? "" : "s"} and ${sceneCount} Scene${sceneCount === 1 ? "" : "s"}.`;
  }
  const chapters = series.acts.filter((chapter) => chapter.bookId === target.id);
  const chapterIds = new Set(chapters.map((chapter) => chapter.id));
  const acts = series.chapters.filter((act) => chapterIds.has(act.actId));
  const actIds = new Set(acts.map((act) => act.id));
  const sceneCount = series.scenes.filter((scene) => actIds.has(scene.metadata.chapterId)).length;
  return `This permanently deletes ${chapters.length} Chapter${chapters.length === 1 ? "" : "s"}, ${acts.length} Act${acts.length === 1 ? "" : "s"}, and ${sceneCount} Scene${sceneCount === 1 ? "" : "s"}.`;
}

function clampMenuPosition(left: number, top: number, width = 210, height = 116) {
  const margin = 10;
  return {
    left: Math.max(margin, Math.min(left, window.innerWidth - width - margin)),
    top: Math.max(margin, Math.min(top, window.innerHeight - height - margin)),
  };
}

export function ReferenceWriteHierarchy({
  onClose,
  session,
}: {
  onClose: () => void;
  session: ProjectSessionState;
}) {
  const series = session.activeSeries!;
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [context, setContext] = useState<ContextState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HierarchyTarget | null>(null);
  const [renaming, setRenaming] = useState<HierarchyTarget | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [createLevel, setCreateLevel] = useState<CreateLevel | null>(null);
  const [createTitle, setCreateTitle] = useState("");
  const [createError, setCreateError] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const deleteCancelRef = useRef<HTMLButtonElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  const maps = useMemo(() => {
    const chaptersByVolume = new Map<string, typeof series.acts>();
    const actsByChapter = new Map<string, typeof series.chapters>();
    const scenesByAct = new Map<string, typeof series.scenes>();
    for (const chapter of ordered(series.acts)) {
      chaptersByVolume.set(chapter.bookId, [...(chaptersByVolume.get(chapter.bookId) ?? []), chapter]);
    }
    for (const act of ordered(series.chapters)) {
      actsByChapter.set(act.actId, [...(actsByChapter.get(act.actId) ?? []), act]);
    }
    for (const scene of [...series.scenes].sort((left, right) => left.metadata.order - right.metadata.order)) {
      scenesByAct.set(scene.metadata.chapterId, [...(scenesByAct.get(scene.metadata.chapterId) ?? []), scene]);
    }
    return { actsByChapter, chaptersByVolume, scenesByAct };
  }, [series]);

  const selectedVolumeId = session.selectedVolumeId ?? session.selectedScene?.metadata.bookId ?? null;
  const selectedChapterId = session.selectedActId ?? session.selectedScene?.metadata.actId ?? null;
  const selectedActId = session.selectedChapterId ?? session.selectedScene?.metadata.chapterId ?? null;
  const selectedSceneId = session.selectedScene?.metadata.id ?? null;
  const createParent = useMemo(() => {
    const volume = series.books.find((item) => item.id === selectedVolumeId) ?? ordered(series.books)[0] ?? null;
    const chapter = series.acts.find((item) => item.id === selectedChapterId) ??
      (volume ? (maps.chaptersByVolume.get(volume.id) ?? [])[0] ?? null : null);
    const act = series.chapters.find((item) => item.id === selectedActId) ??
      (chapter ? (maps.actsByChapter.get(chapter.id) ?? [])[0] ?? null : null);
    return { act, chapter, volume };
  }, [maps, selectedActId, selectedChapterId, selectedVolumeId, series]);

  useEffect(() => {
    function closeTransient(event: PointerEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(".wr6-context-menu, .wr6-structure-create")) return;
      setContext(null);
      setIsCreateMenuOpen(false);
    }
    function closeFromKeyboard(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (deleteTarget) {
        setDeleteTarget(null);
        setDeleteError("");
        context?.trigger.focus();
      } else if (context) {
        context.trigger.focus();
        setContext(null);
      } else {
        setIsCreateMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeTransient);
    document.addEventListener("keydown", closeFromKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeTransient);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, [context, deleteTarget]);

  useEffect(() => {
    if (renaming) renameInputRef.current?.focus();
  }, [renaming]);

  useEffect(() => {
    if (deleteTarget) deleteCancelRef.current?.focus();
  }, [deleteTarget]);

  useEffect(() => {
    if (createLevel) createInputRef.current?.focus();
  }, [createLevel]);

  function toggleBranch(id: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openContext(event: MouseEvent<HTMLButtonElement>, target: HierarchyTarget) {
    event.preventDefault();
    event.stopPropagation();
    const position = clampMenuPosition(event.clientX, event.clientY);
    setContext({ ...position, target, trigger: event.currentTarget });
    setDeleteTarget(null);
    setIsCreateMenuOpen(false);
  }

  function openContextFromKeyboard(event: KeyboardEvent<HTMLButtonElement>, target: HierarchyTarget) {
    if (!(event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const position = clampMenuPosition(rect.left + 20, rect.bottom + 4);
    setContext({ ...position, target, trigger: event.currentTarget });
    setDeleteTarget(null);
  }

  function beginRename() {
    if (!context) return;
    setRenaming(context.target);
    setRenameTitle(context.target.title);
    setContext(null);
  }

  async function submitRename(event?: FormEvent) {
    event?.preventDefault();
    if (!renaming) return;
    const title = renameTitle.trim();
    if (!title) return;
    if (renaming.kind === "volume") await session.updateVolume(renaming.id, { title });
    else if (renaming.kind === "chapter") await session.updateAct(renaming.id, { title });
    else if (renaming.kind === "act") await session.updateChapter(renaming.id, { title });
    else await session.renameScene(renaming.id, title);
    setRenaming(null);
  }

  function beginDelete() {
    if (!context) return;
    setDeleteTarget(context.target);
    setDeleteError("");
  }

  async function confirmDelete() {
    if (!deleteTarget || session.isCreatingStructure) return;
    setDeleteError("");
    if (session.isDirty) {
      const saved = await session.saveDraft();
      if (!saved) {
        setDeleteError("The current Scene could not be saved. Nothing was deleted.");
        return;
      }
    }
    if (deleteTarget.kind === "volume") await session.deleteVolume(deleteTarget.id);
    else if (deleteTarget.kind === "chapter") await session.deleteAct(deleteTarget.id);
    else if (deleteTarget.kind === "act") await session.deleteChapter(deleteTarget.id);
    else await session.deleteScene(deleteTarget.id);
    setDeleteTarget(null);
    setContext(null);
  }

  function canCreate(level: CreateLevel) {
    if (level === "volume") return true;
    if (level === "chapter") return Boolean(createParent.volume);
    if (level === "act") return Boolean(createParent.chapter);
    return Boolean(createParent.volume && createParent.chapter && createParent.act);
  }

  function createParentLabel(level: CreateLevel) {
    if (level === "volume") return `Inside ${series.manifest.title}`;
    if (level === "chapter") return `Inside ${createParent.volume?.title ?? "Volume"}`;
    if (level === "act") return `Inside ${createParent.chapter?.title ?? "Chapter"}`;
    return `Inside ${createParent.act?.title ?? "Act"}`;
  }

  function openCreate(level: CreateLevel) {
    if (!canCreate(level)) return;
    setCreateLevel(level);
    setCreateTitle(`New ${level[0]?.toUpperCase()}${level.slice(1)}`);
    setCreateError("");
    setIsCreateMenuOpen(false);
  }

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    if (!createLevel || session.isCreatingStructure) return;
    const title = createTitle.trim();
    if (!title) {
      setCreateError("Enter a title.");
      return;
    }
    if (createLevel === "volume") await session.createVolume({ title });
    else if (createLevel === "chapter") await session.createAct(createParent.volume?.id ?? null, { title });
    else if (createLevel === "act") await session.createChapter(createParent.chapter?.id ?? null, { title });
    else if (createParent.volume && createParent.chapter && createParent.act) {
      await session.createScene({
        title,
        content: "",
        bookId: createParent.volume.id,
        actId: createParent.chapter.id,
        chapterId: createParent.act.id,
      });
    }
    setCreateLevel(null);
  }

  function titleArea(target: HierarchyTarget, selected: boolean, onSelect: () => void) {
    if (renaming?.id === target.id && renaming.kind === target.kind) {
      return (
        <form className="wr6-tree-rename" onSubmit={submitRename}>
          <input
            aria-label={`Rename ${target.kind}`}
            onBlur={() => void submitRename()}
            onChange={(event) => setRenameTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setRenaming(null);
              }
            }}
            ref={renameInputRef}
            value={renameTitle}
          />
        </form>
      );
    }
    return (
      <button
        aria-current={selected ? "true" : undefined}
        className="wr6-tree-title-area"
        onClick={onSelect}
        onContextMenu={(event) => openContext(event, target)}
        onKeyDown={(event) => openContextFromKeyboard(event, target)}
        type="button"
      >
        <strong>{target.title}</strong>
        <small>{target.kind[0]?.toUpperCase()}{target.kind.slice(1)}</small>
      </button>
    );
  }

  return (
    <>
      <aside className="wr6-outline" id="wr6-outline" aria-label="Manuscript structure">
        <header className="wr6-panel-head">
          <div><strong>Manuscript</strong><span>{series.manifest.title}</span></div>
          <div className="wr6-panel-actions">
            <div className="wr6-structure-create">
              <button
                aria-controls="wr6-structure-menu"
                aria-expanded={isCreateMenuOpen}
                aria-label="Create manuscript item"
                className="wr6-icon"
                id="wr6-add-structure"
                onClick={() => setIsCreateMenuOpen((current) => !current)}
                type="button"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              </button>
              <div className="wr6-structure-menu" id="wr6-structure-menu" role="menu" hidden={!isCreateMenuOpen}>
                {(["volume", "chapter", "act", "scene"] as CreateLevel[]).map((level) => (
                  <button disabled={!canCreate(level)} key={level} onClick={() => openCreate(level)} role="menuitem" type="button">
                    <strong>New {level[0]?.toUpperCase()}{level.slice(1)}</strong>
                  </button>
                ))}
              </div>
            </div>
            <button aria-label="Close manuscript structure" className="wr6-icon" onClick={onClose} type="button">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        </header>

        <div className="wr6-tree" role="tree" aria-label="Series structure">
          <div className="wr6-tree-row" data-level="series" role="treeitem" aria-expanded={!collapsed.has(series.manifest.id)}>
            <button aria-label={`${collapsed.has(series.manifest.id) ? "Expand" : "Collapse"} Series`} className="wr6-tree-chevron-button" onClick={() => toggleBranch(series.manifest.id)} type="button"><span className="wr6-chevron">⌄</span></button>
            <button className="wr6-tree-title-area" onClick={() => toggleBranch(series.manifest.id)} type="button"><strong>{series.manifest.title}</strong><small>Series</small></button>
          </div>
          <div className="wr6-tree-branch" role="group" hidden={collapsed.has(series.manifest.id)}>
            {ordered(series.books).map((volume) => {
              const volumeTarget: HierarchyTarget = { id: volume.id, kind: "volume", title: volume.title };
              const volumeCollapsed = collapsed.has(volume.id);
              return (
                <div key={volume.id}>
                  <div className={`wr6-tree-row${selectedVolumeId === volume.id ? " is-target" : ""}`} data-level="volume" role="treeitem" aria-expanded={!volumeCollapsed}>
                    <button aria-label={`${volumeCollapsed ? "Expand" : "Collapse"} Volume ${volume.title}`} className="wr6-tree-chevron-button" onClick={() => toggleBranch(volume.id)} type="button"><span className="wr6-chevron">⌄</span></button>
                    {titleArea(volumeTarget, selectedVolumeId === volume.id, () => session.selectVolume(volume.id))}
                  </div>
                  <div className="wr6-tree-branch" role="group" hidden={volumeCollapsed}>
                    {(maps.chaptersByVolume.get(volume.id) ?? []).map((chapter) => {
                      const chapterTarget: HierarchyTarget = { id: chapter.id, kind: "chapter", title: chapter.title };
                      const chapterCollapsed = collapsed.has(chapter.id);
                      return (
                        <div key={chapter.id}>
                          <div className={`wr6-tree-row${selectedChapterId === chapter.id ? " is-target" : ""}`} data-level="chapter" role="treeitem" aria-expanded={!chapterCollapsed}>
                            <button aria-label={`${chapterCollapsed ? "Expand" : "Collapse"} Chapter ${chapter.title}`} className="wr6-tree-chevron-button" onClick={() => toggleBranch(chapter.id)} type="button"><span className="wr6-chevron">⌄</span></button>
                            {titleArea(chapterTarget, selectedChapterId === chapter.id, () => session.selectAct(chapter.id))}
                          </div>
                          <div className="wr6-tree-branch" role="group" hidden={chapterCollapsed}>
                            {(maps.actsByChapter.get(chapter.id) ?? []).map((act) => {
                              const actTarget: HierarchyTarget = { id: act.id, kind: "act", title: act.title };
                              const actCollapsed = collapsed.has(act.id);
                              return (
                                <div key={act.id}>
                                  <div className={`wr6-tree-row${selectedActId === act.id ? " is-target" : ""}`} data-level="act" role="treeitem" aria-expanded={!actCollapsed}>
                                    <button aria-label={`${actCollapsed ? "Expand" : "Collapse"} Act ${act.title}`} className="wr6-tree-chevron-button" onClick={() => toggleBranch(act.id)} type="button"><span className="wr6-chevron">⌄</span></button>
                                    {titleArea(actTarget, selectedActId === act.id, () => session.selectChapter(act.id))}
                                  </div>
                                  <div className="wr6-tree-branch" role="group" hidden={actCollapsed}>
                                    {(maps.scenesByAct.get(act.id) ?? []).map((scene) => {
                                      const sceneTarget: HierarchyTarget = { id: scene.metadata.id, kind: "scene", title: scene.metadata.title };
                                      const selected = selectedSceneId === scene.metadata.id;
                                      return (
                                        <div className={`wr6-tree-row${selected ? " is-current" : ""}`} data-level="scene" key={scene.metadata.id} role="treeitem">
                                          <span aria-hidden="true" className="wr6-tree-dot">•</span>
                                          {titleArea(sceneTarget, selected, () => session.selectScene(scene.metadata.id))}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {context && !deleteTarget ? (
        <div className="wr6-context-menu" onPointerDown={(event) => event.stopPropagation()} role="menu" style={{ left: context.left, top: context.top }}>
          <button onClick={beginRename} role="menuitem" type="button">Rename</button>
          <button className="is-danger" onClick={beginDelete} role="menuitem" type="button">Delete</button>
        </div>
      ) : null}

      {context && deleteTarget ? (
        <div aria-labelledby="wr6-delete-title" className="wr6-context-menu wr6-delete-confirm" onPointerDown={(event) => event.stopPropagation()} role="dialog" style={{ left: context.left, top: context.top }}>
          <strong id="wr6-delete-title">Delete {deleteTarget.title}?</strong>
          <p>{cascadeSummary(deleteTarget, series)}</p>
          {deleteError ? <p className="wr6-context-error" role="alert">{deleteError}</p> : null}
          <div>
            <button onClick={() => { setDeleteTarget(null); setDeleteError(""); context.trigger.focus(); }} ref={deleteCancelRef} type="button">Cancel</button>
            <button className="is-danger" disabled={session.isCreatingStructure} onClick={() => void confirmDelete()} type="button">Delete</button>
          </div>
        </div>
      ) : null}

      {createLevel ? (
        <div className="backdrop is-open wr6-connected-backdrop" id="wr6-structure-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateLevel(null); }}>
          <section aria-labelledby="wr6-structure-title" aria-modal="true" className="dialog small" role="dialog">
            <header className="dialog-head"><div><div className="eyebrow">Manuscript structure</div><h2 id="wr6-structure-title">Create {createLevel[0]?.toUpperCase()}{createLevel.slice(1)}</h2><p>{createParentLabel(createLevel)}</p></div><button aria-label="Close create manuscript item" className="icon-button" onClick={() => setCreateLevel(null)} type="button">×</button></header>
            <form onSubmit={submitCreate}>
              <div className="dialog-body create-body">
                <label><span className="label">Title</span><input autoComplete="off" className="input" onChange={(event) => setCreateTitle(event.target.value)} ref={createInputRef} value={createTitle} /></label>
                <p className="form-error" role="alert">{createError}</p>
              </div>
              <footer className="dialog-foot"><button className="button" onClick={() => setCreateLevel(null)} type="button">Cancel</button><button className="button primary" disabled={session.isCreatingStructure} type="submit">Create</button></footer>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
