import { useEffect, useMemo, useState } from "react";
import type {
  ActManifest,
  BookManifest,
  ChapterManifest,
  CodexEntryDocument,
  CreateActInput,
  CreateBookInput,
  CreateChapterInput,
  CreateSceneInput,
  SceneBlock,
  SceneBlockDocument,
  SceneDocument,
  SeriesDetail,
  UpdateActInput,
  UpdateBookInput,
  UpdateChapterInput,
} from "@novel-studio/contracts";
import { api } from "../../api";
import {
  createBlock,
  createParagraphBlock,
  sceneBlockDocumentStats,
  sceneBlockToPlainText,
} from "../../app/sceneBlocks";
import { uiText } from "../../app/uiText";
import type { SaveStatus, SceneDraft } from "../../app/useProjectSession";
import { findInlineCodexMentions } from "../codex/inlineMentions";

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
  onCreateAct: (bookId?: string | null, input?: CreateActInput) => Promise<void>;
  onCreateVolume: (input?: CreateBookInput) => Promise<void>;
  onCreateChapter: (actId?: string | null, input?: CreateChapterInput) => Promise<void>;
  onCreateScene: (input?: CreateSceneInput) => Promise<void>;
  onClearStructureSelection: () => void;
  onSaveDraft: () => Promise<void>;
  onSelectVolume: (bookId: string) => void;
  onSelectAct: (actId: string) => void;
  onSelectChapter: (chapterId: string) => void;
  onSelectScene: (sceneId: string) => void;
  onToggleFocus: () => void;
  onUpdateAct: (actId: string, input: UpdateActInput) => Promise<void>;
  onUpdateVolume: (bookId: string, input: UpdateBookInput) => Promise<void>;
  onUpdateChapter: (chapterId: string, input: UpdateChapterInput) => Promise<void>;
  onUpdateDocument: (document: SceneBlockDocument) => void;
  onUpdateTitle: (title: string) => void;
  saveStatus: SaveStatus;
  selectedVolumeId: string | null;
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

type ProductStructureType = "volume" | "chapter" | "act" | "scene";
type RenamingStructure = { type: "volume" | "chapter" | "act"; id: string; title: string };
type SelectedStructure = { type: ProductStructureType; id: string };
type EditableBlockKind = "paragraph" | "heading" | "quote" | "sceneBreak";
type ActiveBlockMention = { blockId: string; entryId: string };
const structureCreateLabels: Record<ProductStructureType, string> = {
  volume: uiText.hierarchy.volume,
  chapter: uiText.hierarchy.chapter,
  act: uiText.hierarchy.act,
  scene: uiText.hierarchy.scene,
};

const blockKindLabels: Record<EditableBlockKind, string> = {
  heading: "Heading",
  paragraph: "Paragraph",
  quote: "Quote",
  sceneBreak: "Break",
};

function editableTextForBlock(block: SceneBlock): string {
  return sceneBlockToPlainText(block);
}

function blockWithText(block: SceneBlock, text: string): SceneBlock {
  if (block.kind === "paragraph" || block.kind === "heading" || block.kind === "quote") {
    return { ...block, text };
  }
  return block;
}

function convertBlockKind(block: SceneBlock, kind: EditableBlockKind): SceneBlock {
  const text = editableTextForBlock(block);
  if (kind === "heading") {
    return {
      id: block.id,
      kind,
      level: block.kind === "heading" ? block.level : 2,
      text,
    };
  }
  if (kind === "quote") {
    return {
      id: block.id,
      kind,
      text,
    };
  }
  if (kind === "sceneBreak") {
    return {
      id: block.id,
      kind,
    };
  }
  return {
    id: block.id,
    kind: "paragraph",
    text,
  };
}

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
  onClearStructureSelection,
  onSaveDraft,
  onSelectVolume,
  onSelectAct,
  onSelectChapter,
  onSelectScene,
  onToggleFocus,
  onUpdateAct,
  onUpdateVolume,
  onUpdateChapter,
  onUpdateDocument,
  onUpdateTitle,
  saveStatus,
  selectedVolumeId,
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
  const [codexEntries, setCodexEntries] = useState<CodexEntryDocument[]>([]);
  const [activeBlockMention, setActiveBlockMention] = useState<ActiveBlockMention | null>(null);
  const [isBriefVisible, setIsBriefVisible] = useState(true);
  const [isCodexLoading, setIsCodexLoading] = useState(false);
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
  const structureScene = selectedStructure?.type === "scene"
    ? series.scenes.find((scene) => scene.metadata.id === selectedStructure.id) ?? null
    : null;
  const selectedStructureChapter = selectedStructure?.type === "act"
    ? series.chapters.find((chapter) => chapter.id === selectedStructure.id) ?? null
    : null;
  const selectedStructureAct = selectedStructure?.type === "chapter"
    ? series.acts.find((act) => act.id === selectedStructure.id) ?? null
    : selectedStructureChapter
      ? series.acts.find((act) => act.id === selectedStructureChapter.actId) ?? null
      : structureScene
        ? series.acts.find((act) => act.id === structureScene.metadata.actId) ?? null
        : null;
  const selectedStructureBook = selectedStructure?.type === "volume"
    ? series.books.find((book) => book.id === selectedStructure.id) ?? null
    : selectedStructureAct
      ? series.books.find((book) => book.id === selectedStructureAct.bookId) ?? null
      : structureScene
        ? series.books.find((book) => book.id === structureScene.metadata.bookId) ?? null
        : null;
  const fallbackSceneBook = selectedScene
    ? series.books.find((book) => book.id === selectedScene.metadata.bookId) ?? null
    : null;
  const fallbackSceneAct = selectedScene
    ? series.acts.find((act) => act.id === selectedScene.metadata.actId) ?? null
    : null;
  const fallbackSceneChapter = selectedScene
    ? series.chapters.find((chapter) => chapter.id === selectedScene.metadata.chapterId) ?? null
    : null;
  const targetBookForChapter = selectedStructureBook ?? (selectedVolumeId ? series.books.find((book) => book.id === selectedVolumeId) ?? null : null) ?? fallbackSceneBook ?? orderedBooks[0] ?? null;
  const targetActForProductAct = selectedStructure?.type === "volume"
    ? null
    : selectedStructureAct ?? (selectedActId ? series.acts.find((act) => act.id === selectedActId) ?? null : null) ?? fallbackSceneAct ?? sortedByOrder(series.acts)[0] ?? null;
  const targetChapterForScene = selectedStructure?.type === "act"
    ? selectedStructureChapter
    : selectedStructure?.type === "scene"
      ? series.chapters.find((chapter) => chapter.id === structureScene?.metadata.chapterId) ?? null
      : selectedStructure
        ? null
        : (selectedChapterId ? series.chapters.find((chapter) => chapter.id === selectedChapterId) ?? null : null) ?? fallbackSceneChapter ?? sortedByOrder(series.chapters)[0] ?? null;
  const targetActForScene = targetChapterForScene
    ? series.acts.find((act) => act.id === targetChapterForScene.actId) ?? null
    : null;
  const canCreateProductChapter = Boolean(targetBookForChapter);
  const canCreateProductAct = Boolean(targetActForProductAct);
  const canCreateScene = Boolean(targetActForScene && targetChapterForScene);
  const selectedVolume = selectedStructure?.type === "volume"
    ? series.books.find((book) => book.id === selectedStructure.id)
    : null;
  // Product hierarchy is Volume -> Chapter -> Act -> Scene while the current
  // storage model is Book -> Act -> Chapter -> Scene.
  const selectedProductChapter = selectedStructure?.type === "chapter"
    ? series.acts.find((act) => act.id === selectedStructure.id)
    : null;
  const selectedProductAct = selectedStructure?.type === "act"
    ? series.chapters.find((chapter) => chapter.id === selectedStructure.id)
    : null;
  const selectedStructureScene = structureScene;
  const sceneStats = draft ? sceneBlockDocumentStats(draft.document) : null;
  const sceneEditorCharacterCount = sceneStats?.characterCount ?? draft?.characterCount ?? 0;
  const sceneEditorWordCount = sceneStats ? Math.max(sceneStats.characterCount ? 1 : 0, Math.round(sceneStats.characterCount / 5)) : 0;
  const deleteTarget = selectedVolume
    ? { type: "volume" as const, id: selectedVolume.id, title: selectedVolume.title, label: uiText.hierarchy.volume }
    : selectedProductChapter
      ? { type: "chapter" as const, id: selectedProductChapter.id, title: selectedProductChapter.title, label: uiText.hierarchy.chapter }
      : selectedProductAct
        ? { type: "act" as const, id: selectedProductAct.id, title: selectedProductAct.title, label: uiText.hierarchy.act }
        : selectedStructureScene
          ? { type: "scene" as const, id: selectedStructureScene.metadata.id, title: selectedStructureScene.metadata.title, label: uiText.hierarchy.scene }
        : null;

  function updateSceneDocumentBlocks(blocks: SceneBlock[]) {
    if (!draft) return;
    onUpdateDocument({
      schemaVersion: 1,
      blocks: blocks.length > 0 ? blocks : [createParagraphBlock()],
    });
  }

  function updateBlockText(blockId: string, text: string) {
    if (!draft) return;
    updateSceneDocumentBlocks(draft.document.blocks.map((block) =>
      block.id === blockId ? blockWithText(block, text) : block,
    ));
  }

  function updateBlockKind(blockId: string, kind: EditableBlockKind) {
    if (!draft) return;
    updateSceneDocumentBlocks(draft.document.blocks.map((block) =>
      block.id === blockId ? convertBlockKind(block, kind) : block,
    ));
  }

  function updateHeadingLevel(blockId: string, level: number) {
    if (!draft) return;
    updateSceneDocumentBlocks(draft.document.blocks.map((block) =>
      block.id === blockId && block.kind === "heading"
        ? { ...block, level }
        : block,
    ));
  }

  function insertBlockAfter(blockId: string, kind: EditableBlockKind = "paragraph") {
    if (!draft) return;
    const nextBlock = createBlock(kind);
    const nextBlocks: SceneBlock[] = [];
    for (const block of draft.document.blocks) {
      nextBlocks.push(block);
      if (block.id === blockId) nextBlocks.push(nextBlock);
    }
    updateSceneDocumentBlocks(nextBlocks.length === draft.document.blocks.length ? [...draft.document.blocks, nextBlock] : nextBlocks);
  }

  function deleteBlock(blockId: string) {
    if (!draft) return;
    updateSceneDocumentBlocks(draft.document.blocks.filter((block) => block.id !== blockId));
    setActiveBlockMention((current) => (current?.blockId === blockId ? null : current));
  }

  useEffect(() => {
    if (!selectedScene) {
      setCodexEntries([]);
      setIsCodexLoading(false);
      return;
    }

    let isActive = true;
    setIsCodexLoading(true);
    api.codex.listEntries(series.manifest.id)
      .then((entries) => {
        if (!isActive) return;
        setCodexEntries(entries);
      })
      .catch(() => {
        if (!isActive) return;
        setCodexEntries([]);
      })
      .finally(() => {
        if (isActive) setIsCodexLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [series.manifest.id, selectedScene?.metadata.id]);

  useEffect(() => {
    setActiveBlockMention(null);
  }, [draft?.sceneId]);

  function canCreateStructure(type: ProductStructureType) {
    if (type === "volume") return true;
    if (type === "chapter") return canCreateProductChapter;
    if (type === "act") return canCreateProductAct;
    return canCreateScene;
  }

  async function createStructure(type: ProductStructureType) {
    if (!canCreateStructure(type) || isCreatingStructure) return;
    if (type === "volume") await onCreateVolume();
    else if (type === "chapter") await onCreateAct(targetBookForChapter?.id ?? null);
    else if (type === "act") await onCreateChapter(targetActForProductAct?.id ?? null);
    else await onCreateScene(targetActForScene && targetChapterForScene
      ? {
          bookId: targetActForScene.bookId,
          actId: targetActForScene.id,
          chapterId: targetChapterForScene.id,
        }
      : undefined);
    setIsAddOpen(false);
  }

  function selectStructure(next: SelectedStructure, onSelect: () => void) {
    setIsDeleteOpen(false);
    if (selectedStructure?.type === next.type && selectedStructure.id === next.id) {
      setSelectedStructure(null);
      onClearStructureSelection();
      return;
    }
    setSelectedStructure(next);
    onSelect();
  }

  async function deleteSelectedStructure() {
    if (!deleteTarget || isCreatingStructure) return;
    if (deleteTarget.type === "volume") await onDeleteVolume(deleteTarget.id);
    else if (deleteTarget.type === "chapter") await onDeleteAct(deleteTarget.id);
    else if (deleteTarget.type === "act") await onDeleteChapter(deleteTarget.id);
    else await onDeleteScene(deleteTarget.id);
    setSelectedStructure(null);
    setIsDeleteOpen(false);
  }

  async function saveRename() {
    if (!renamingStructure) return;
    const title = renamingStructure.title.trim();
    if (!title) return;
    if (renamingStructure.type === "volume") await onUpdateVolume(renamingStructure.id, { title });
    else if (renamingStructure.type === "chapter") await onUpdateAct(renamingStructure.id, { title });
    else await onUpdateChapter(renamingStructure.id, { title });
    setRenamingStructure(null);
  }

  function cancelRename() {
    setRenamingStructure(null);
  }

  function renderSceneBlock(block: SceneBlock, index: number) {
    const blockNumber = index + 1;
    const blockText = editableTextForBlock(block);
    const mentions = findInlineCodexMentions(blockText, codexEntries);
    const activeEntry = activeBlockMention?.blockId === block.id
      ? codexEntries.find((entry) => entry.metadata.id === activeBlockMention.entryId) ?? null
      : null;
    const editableKind: EditableBlockKind = block.kind === "heading" ||
      block.kind === "quote" ||
      block.kind === "sceneBreak"
      ? block.kind
      : "paragraph";

    return (
      <article className={`scene-block scene-block-${block.kind}`} data-block-id={block.id} key={block.id}>
        <div className="scene-block-toolbar">
          <span className="scene-block-index">{blockNumber}</span>
          <select
            aria-label={`Block ${blockNumber} type`}
            className="input compact scene-block-kind"
            disabled={block.kind === "codexProgression"}
            onChange={(event) => updateBlockKind(block.id, event.target.value as EditableBlockKind)}
            value={editableKind}
          >
            {(["paragraph", "heading", "quote", "sceneBreak"] as EditableBlockKind[]).map((kind) => (
              <option key={kind} value={kind}>{blockKindLabels[kind]}</option>
            ))}
          </select>
          {block.kind === "heading" ? (
            <select
              aria-label={`Block ${blockNumber} heading level`}
              className="input compact scene-block-level"
              onChange={(event) => updateHeadingLevel(block.id, Number(event.target.value))}
              value={block.level}
            >
              {[1, 2, 3, 4, 5, 6].map((level) => (
                <option key={level} value={level}>{`H${level}`}</option>
              ))}
            </select>
          ) : null}
          <div className="scene-block-actions">
            <button
              aria-label={`Add block after ${blockNumber}`}
              className="btn compact"
              onClick={() => insertBlockAfter(block.id)}
              type="button"
            >
              Add
            </button>
            <button
              aria-label={`Delete block ${blockNumber}`}
              className="btn compact"
              onClick={() => deleteBlock(block.id)}
              type="button"
            >
              Delete
            </button>
          </div>
        </div>

        {block.kind === "paragraph" || block.kind === "quote" ? (
          <textarea
            aria-label={`Scene block ${blockNumber}`}
            className="input scene-block-textarea"
            onChange={(event) => updateBlockText(block.id, event.target.value)}
            placeholder="Continue the scene..."
            value={block.text}
          />
        ) : block.kind === "heading" ? (
          <input
            aria-label={`Scene block ${blockNumber}`}
            className="input scene-block-heading-input"
            onChange={(event) => updateBlockText(block.id, event.target.value)}
            placeholder="Heading"
            value={block.text}
          />
        ) : block.kind === "sceneBreak" ? (
          <div aria-label={`Scene block ${blockNumber}`} className="scene-break-block">
            <span />
            <strong>Scene break</strong>
            <span />
          </div>
        ) : (
          <div aria-label={`Scene block ${blockNumber}`} className="scene-progression-placeholder">
            Progression block
          </div>
        )}

        {mentions.length ? (
          <div className="scene-block-mentions" aria-label={`Block ${blockNumber} Codex mentions`}>
            {mentions.map((mention) => (
              <button
                className="block-codex-mention"
                key={`${mention.entryId}-${mention.start}-${mention.end}`}
                onClick={() => setActiveBlockMention((current) =>
                  current?.blockId === block.id && current.entryId === mention.entryId
                    ? null
                    : { blockId: block.id, entryId: mention.entryId },
                )}
                type="button"
              >
                {mention.matchedText}
              </button>
            ))}
          </div>
        ) : null}

        {activeEntry ? (
          <div className="scene-content-preview" aria-label={`${activeEntry.metadata.name} canon description`}>
            <div className="preview-title">{activeEntry.metadata.name}</div>
            <p>{activeEntry.description || "No description"}</p>
          </div>
        ) : null}
      </article>
    );
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
          {!isBriefVisible ? (
            <button
              aria-label="Show scene brief"
              className="icon-btn brief-restore-action"
              onClick={() => setIsBriefVisible(true)}
              title="Show scene brief"
              type="button"
            >
              <span aria-hidden="true">▦</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className={`write-grid${isBriefVisible ? "" : " is-brief-hidden"}`}>
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
                  {(["volume", "chapter", "act", "scene"] as ProductStructureType[]).map((type) => (
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
                      selectStructure({ type: "volume", id: book.id }, () => onSelectVolume(book.id));
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
                  const isSelectedAct = selectedStructure?.type === "chapter" && selectedStructure.id === act.id;
                  const isCollapsedAct = collapsedActs.has(act.id);
                  const isRenamingAct = renamingStructure?.type === "chapter" && renamingStructure.id === act.id;
                  return (
                    <div className="structure-act" key={act.id}>
                      {isRenamingAct ? (
                        <div className={`data-row structure-act-row structure-rename-row${isSelectedAct ? " is-active" : ""}`}>
                          <input
                            aria-label={`Rename ${act.title}`}
                            autoFocus
                            className="input structure-rename-input"
                            onChange={(event) => setRenamingStructure({ type: "chapter", id: act.id, title: event.target.value })}
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
                            selectStructure({ type: "chapter", id: act.id }, () => onSelectAct(act.id));
                          }}
                          onDoubleClick={() => setRenamingStructure({ type: "chapter", id: act.id, title: act.title })}
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
                        const isSelectedChapter = selectedStructure?.type === "act" && selectedStructure.id === chapter.id;
                        const isCollapsedChapter = collapsedChapters.has(chapter.id);
                        const isRenamingChapter = renamingStructure?.type === "act" && renamingStructure.id === chapter.id;
                        return (
                          <div className="structure-chapter" key={chapter.id}>
                            {isRenamingChapter ? (
                              <div className={`data-row structure-chapter-row structure-rename-row${isSelectedChapter ? " is-active" : ""}`}>
                                <input
                                  aria-label={`Rename ${chapter.title}`}
                                  autoFocus
                                  className="input structure-rename-input"
                                  onChange={(event) => setRenamingStructure({ type: "act", id: chapter.id, title: event.target.value })}
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
                                  selectStructure({ type: "act", id: chapter.id }, () => onSelectChapter(chapter.id));
                                }}
                                onDoubleClick={() => setRenamingStructure({ type: "act", id: chapter.id, title: chapter.title })}
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
                                  className={`scene-row${selectedStructure?.type === "scene" && selectedStructure.id === scene.metadata.id ? " is-active" : ""}`}
                                  key={scene.metadata.id}
                                  onClick={() => {
                                    selectStructure({ type: "scene", id: scene.metadata.id }, () => onSelectScene(scene.metadata.id));
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
              <span className="pill">{draft ? `${sceneEditorCharacterCount} chars / ${sceneEditorWordCount} words` : "No scene"}</span>
              {draft ? <span className="pill">{`${draft.document.blocks.length} blocks`}</span> : null}
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
                  {isCodexLoading ? <span className="pill">Loading codex</span> : null}
                </div>
                <input
                  aria-label="Scene title"
                  className="scene-title-input"
                  onChange={(event) => onUpdateTitle(event.target.value)}
                  value={draft.title}
                />
                <div aria-label="Scene content" className="scene-block-editor">
                  {draft.document.blocks.map((block, index) => renderSceneBlock(block, index))}
                </div>
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
            {draft ? <span className="save-bar-meta">{`${draft.paragraphCount} paragraphs`}</span> : null}
            <button className="btn primary" disabled={!isDirty || saveStatus === "saving"} onClick={() => void onSaveDraft()} type="button">
              Save now
            </button>
          </footer>
        </section>

        {isBriefVisible ? (
          <aside className="panel no-shadow">
            <div className="panel-head">
              <div>
                <div className="panel-title">Scene Brief</div>
                <div className="panel-kicker">Visible while writing</div>
              </div>
              <button
                className="icon-btn"
                onClick={() => setIsBriefVisible(false)}
                title="Hide panel"
                type="button"
              >
                x
              </button>
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
            </div>
          </aside>
        ) : null}

      </div>
    </>
  );
}
