import { useEffect, useMemo, useState } from "react";
import type {
  ActManifest,
  BookManifest,
  ChapterManifest,
  CodexDetailTypeDocument,
  CodexEntryDocument,
  CodexProgressionDocument,
  CreateActInput,
  CreateBookInput,
  CreateChapterInput,
  CreateSceneInput,
  SceneBlock,
  SceneBlockDocument,
  SceneBlockDocumentResponse,
  SceneDocument,
  SceneStatus,
  SeriesDetail,
  UpdateActInput,
  UpdateBookInput,
  UpdateChapterInput,
} from "@novel-studio/contracts";
import { api } from "../../api";
import {
  createParagraphBlock,
  sceneBlockDocumentStats,
} from "../../app/sceneBlocks";
import { uiText } from "../../app/uiText";
import type { SaveStatus, SceneDraft } from "../../app/useProjectSession";
import { findInlineCodexMentions } from "../codex/inlineMentions";
import { NovelEditor } from "./editor";
import type { ProgressionNodeViewModel } from "./editor/CodexProgressionNodeView";
import {
  fieldFromSelection,
  fieldLabel,
  isSceneWriteProgression,
  type ProgressionDraft,
  progressionDraftFromDocument,
} from "./story-change/storyChangeViewModel";

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
  onAcceptSavedSceneDocument: (scene: SceneBlockDocumentResponse) => void;
  onCommitDocument: (
    document: SceneBlockDocument,
    options?: { baseRevision?: string; status?: SceneStatus; title?: string },
  ) => Promise<SceneBlockDocumentResponse>;
  onCreateAct: (bookId?: string | null, input?: CreateActInput) => Promise<void>;
  onCreateVolume: (input?: CreateBookInput) => Promise<void>;
  onCreateChapter: (actId?: string | null, input?: CreateChapterInput) => Promise<void>;
  onCreateScene: (input?: CreateSceneInput) => Promise<void>;
  onClearStructureSelection: () => void;
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
  if (status === "failed") return "Failed";
  if (status === "conflict") return "Conflict";
  return "";
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
type ActiveBlockMention = { blockId: string; entryId: string };
const progressionText = uiText.writeProgression;
const structureCreateLabels: Record<ProductStructureType, string> = {
  volume: uiText.hierarchy.volume,
  chapter: uiText.hierarchy.chapter,
  act: uiText.hierarchy.act,
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
  onAcceptSavedSceneDocument,
  onCommitDocument,
  onCreateAct,
  onCreateVolume,
  onCreateChapter,
  onCreateScene,
  onClearStructureSelection,
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
  const [codexDetailTypes, setCodexDetailTypes] = useState<CodexDetailTypeDocument[]>([]);
  const [sceneProgressions, setSceneProgressions] = useState<CodexProgressionDocument[]>([]);
  const [progressionDrafts, setProgressionDrafts] = useState<Record<string, ProgressionDraft>>({});
  const [collapsedProgressionBlocks, setCollapsedProgressionBlocks] = useState<Set<string>>(() => new Set());
  const [progressionBusyId, setProgressionBusyId] = useState<string | null>(null);
  const [progressionError, setProgressionError] = useState<string | null>(null);
  const [selectedProgressionBlockId, setSelectedProgressionBlockId] = useState<string | null>(null);
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
  const progressionsById = useMemo(() => new Map(
    sceneProgressions.map((document) => [document.progression.id, document]),
  ), [sceneProgressions]);
  const progressionBlocks = draft?.document.blocks.filter((block) => block.kind === "codexProgression") ?? [];
  const progressionBlockIds = progressionBlocks.map((block) => block.id).join("|");

  function updateSceneDocumentBlocks(blocks: SceneBlock[]) {
    if (!draft) return;
    onUpdateDocument({
      schemaVersion: 1,
      blocks: blocks.length > 0 ? blocks : [createParagraphBlock()],
    });
  }

  function insertParagraphAfter(blockId: string | null) {
    if (!draft) return null;
    const nextBlock = createParagraphBlock();
    const nextBlocks: SceneBlock[] = [];
    for (const block of draft.document.blocks) {
      nextBlocks.push(block);
      if (block.id === blockId) nextBlocks.push(nextBlock);
    }
    updateSceneDocumentBlocks(nextBlocks.length === draft.document.blocks.length
      ? [...draft.document.blocks, nextBlock]
      : nextBlocks);
    return nextBlock.id;
  }

  function deleteCurrentEditorBlock(blockId: string | null) {
    if (!draft || !blockId) return;
    const block = draft.document.blocks.find((candidate) => candidate.id === blockId);
    if (!block) return;
    if (block.kind === "codexProgression") {
      void deleteProgressionBlock(block);
      return;
    }
    updateSceneDocumentBlocks(draft.document.blocks.filter((candidate) => candidate.id !== blockId));
    setActiveBlockMention((current) => (current?.blockId === blockId ? null : current));
  }

  function updateProgressionDraft(progressionId: string, patch: Partial<ProgressionDraft>) {
    setProgressionError(null);
    setProgressionDrafts((current) => {
      const source = current[progressionId] ??
        (progressionsById.get(progressionId) ? progressionDraftFromDocument(progressionsById.get(progressionId)!) : null);
      if (!source) return current;
      return {
        ...current,
        [progressionId]: { ...source, ...patch },
      };
    });
  }

  function progressionErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error) return error.message;
    return fallback;
  }

  async function saveDirtyDraftForProgressionCommand() {
    if (!draft || !isDirty) return null;
    return onCommitDocument(draft.document, {
      baseRevision: draft.revision,
      status: draft.status,
      title: draft.title,
    });
  }

  async function insertProgressionBlockAfter(blockId: string | null) {
    if (!draft || !selectedScene || progressionBusyId) return;
    const entry = codexEntries.find((candidate) => !candidate.metadata.archivedAt);
    if (!entry) {
      setProgressionError(progressionText.errors.missingEntry);
      return;
    }

    setProgressionBusyId(blockId ?? "new-progression-block");
    setProgressionError(null);
    try {
      const savedScene = await saveDirtyDraftForProgressionCommand();
      const result = await api.series.createSceneProgressionBlock(series.manifest.id, draft.sceneId, {
        baseRevision: savedScene?.revision ?? draft.revision,
        afterBlockId: blockId,
        progression: {
          kind: "field",
          entryId: entry.metadata.id,
          relationId: null,
          field: { kind: "description", detailTypeId: null },
          fieldKey: null,
          operation: "add",
          body: "",
          summary: "",
          effectiveToSceneId: null,
          evidence: [],
        },
      });
      onAcceptSavedSceneDocument(result.scene);
      setSceneProgressions((current) => [
        ...current.filter((document) => document.progression.id !== result.progression.progression.id),
        result.progression,
      ]);
      setProgressionDrafts((current) => ({
        ...current,
        [result.progression.progression.id]: progressionDraftFromDocument(result.progression),
      }));
      setCollapsedProgressionBlocks((current) => {
        const next = new Set(current);
        next.delete(result.block.id);
        return next;
      });
      setSelectedProgressionBlockId(result.block.id);
    } catch (error) {
      setProgressionError(progressionErrorMessage(error, progressionText.errors.addFailed));
    } finally {
      setProgressionBusyId(null);
    }
  }

  async function saveProgression(progressionId: string, draftOverride?: ProgressionDraft) {
    const progression = progressionsById.get(progressionId);
    const progressionDraft = draftOverride ?? progressionDrafts[progressionId];
    if (!progression || !progressionDraft || progressionBusyId) return;
    setProgressionBusyId(progressionId);
    setProgressionError(null);
    try {
      const updated = await api.codex.updateProgression(series.manifest.id, progressionId, {
        baseRevision: progression.revision,
        kind: "field",
        entryId: progressionDraft.entryId,
        relationId: null,
        field: fieldFromSelection(progressionDraft.fieldSelection),
        fieldKey: null,
        operation: progressionDraft.operation,
        body: progressionDraft.body,
        summary: progressionDraft.summary,
      });
      setSceneProgressions((current) => current.map((document) => (
        document.progression.id === updated.progression.id ? updated : document
      )));
      setProgressionDrafts((current) => ({
        ...current,
        [updated.progression.id]: progressionDraftFromDocument(updated),
      }));
    } catch (error) {
      setProgressionError(progressionErrorMessage(error, progressionText.errors.saveFailed));
    } finally {
      setProgressionBusyId(null);
    }
  }

  function progressionDraftMatchesDocument(document: CodexProgressionDocument, progressionDraft: ProgressionDraft) {
    return document.progression.entryId === progressionDraft.entryId &&
      document.progression.operation === progressionDraft.operation &&
      document.progression.body === progressionDraft.body &&
      document.progression.summary === progressionDraft.summary &&
      JSON.stringify(document.progression.field) === JSON.stringify(fieldFromSelection(progressionDraft.fieldSelection));
  }

  function progressionBlockById(blockId: string) {
    return progressionBlocks.find((block) => block.id === blockId) ?? null;
  }

  function updateProgressionDraftByBlockId(blockId: string, patch: Partial<ProgressionDraft>) {
    const block = progressionBlockById(blockId);
    if (!block) return;
    updateProgressionDraft(block.progressionId, patch);
  }

  function deleteProgressionBlockById(blockId: string) {
    const block = progressionBlockById(blockId);
    if (block) void deleteProgressionBlock(block);
  }

  async function deleteProgressionBlock(block: Extract<SceneBlock, { kind: "codexProgression" }>) {
    if (!draft || progressionBusyId) return;
    const progression = progressionsById.get(block.progressionId);
    if (!progression) {
      setProgressionError(progressionText.errors.notLoaded);
      return;
    }
    setProgressionBusyId(block.id);
    setProgressionError(null);
    try {
      const savedScene = await saveDirtyDraftForProgressionCommand();
      const result = await api.series.deleteSceneProgressionBlock(series.manifest.id, draft.sceneId, block.id, {
        baseRevision: savedScene?.revision ?? draft.revision,
        progressionBaseRevision: progression.revision,
      });
      if (result.blockers.length > 0) {
        setProgressionError(result.blockers.map((blocker) => blocker.reason).join(" "));
        return;
      }
      if (result.scene) onAcceptSavedSceneDocument(result.scene);
      setSceneProgressions((current) => current.filter((document) => document.progression.id !== block.progressionId));
      setProgressionDrafts((current) => {
        const next = { ...current };
        delete next[block.progressionId];
        return next;
      });
      setCollapsedProgressionBlocks((current) => {
        const next = new Set(current);
        next.delete(block.id);
        return next;
      });
      setSelectedProgressionBlockId((current) => (current === block.id ? null : current));
    } catch (error) {
      setProgressionError(progressionErrorMessage(error, progressionText.errors.deleteFailed));
    } finally {
      setProgressionBusyId(null);
    }
  }

  useEffect(() => {
    if (!selectedScene) {
      setCodexEntries([]);
      setCodexDetailTypes([]);
      setSceneProgressions([]);
      setIsCodexLoading(false);
      return;
    }

    let isActive = true;
    setIsCodexLoading(true);
    Promise.all([
      api.codex.listEntries(series.manifest.id),
      api.codex.listDetailTypes(series.manifest.id),
      api.codex.listProgressions(series.manifest.id, {
        kind: "field",
        sceneId: selectedScene.metadata.id,
      }),
    ])
      .then(([entries, detailTypes, progressions]) => {
        if (!isActive) return;
        setCodexEntries(entries);
        setCodexDetailTypes(detailTypes);
        setSceneProgressions(progressions.filter((document) =>
          isSceneWriteProgression(document, selectedScene.metadata.id),
        ));
      })
      .catch(() => {
        if (!isActive) return;
        setCodexEntries([]);
        setCodexDetailTypes([]);
        setSceneProgressions([]);
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
    setProgressionError(null);
    setSelectedProgressionBlockId(null);
  }, [draft?.sceneId]);

  useEffect(() => {
    if (!progressionBlocks.length) {
      setSelectedProgressionBlockId(null);
      return;
    }
    if (!selectedProgressionBlockId || !progressionBlocks.some((block) => block.id === selectedProgressionBlockId)) {
      setSelectedProgressionBlockId(progressionBlocks[0]?.id ?? null);
    }
  }, [progressionBlockIds, progressionBlocks, selectedProgressionBlockId]);

  useEffect(() => {
    setProgressionDrafts((current) => {
      const next: Record<string, ProgressionDraft> = {};
      for (const document of sceneProgressions) {
        next[document.progression.id] = current[document.progression.id] ?? progressionDraftFromDocument(document);
      }
      return next;
    });
  }, [sceneProgressions]);

  useEffect(() => {
    if (progressionBusyId) return;
    const dirtyProgression = sceneProgressions.find((document) => {
      const progressionDraft = progressionDrafts[document.progression.id];
      return progressionDraft &&
        progressionDraft.entryId &&
        !progressionDraftMatchesDocument(document, progressionDraft);
    });
    if (!dirtyProgression) return;
    const progressionDraft = progressionDrafts[dirtyProgression.progression.id];
    const timer = window.setTimeout(() => {
      if (!progressionDraft) return;
      void saveProgression(dirtyProgression.progression.id, progressionDraft);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [progressionBusyId, progressionDrafts, sceneProgressions]);

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

  const sceneMentions = sceneStats ? findInlineCodexMentions(sceneStats.plainText, codexEntries) : [];
  const activeMentionEntry = activeBlockMention
    ? codexEntries.find((entry) => entry.metadata.id === activeBlockMention.entryId) ?? null
    : null;
  const progressionNodeViews = useMemo(() => {
    const views: Record<string, ProgressionNodeViewModel> = {};
    for (const block of progressionBlocks) {
      const progression = progressionsById.get(block.progressionId);
      const draft = progressionDrafts[block.progressionId] ??
        (progression ? progressionDraftFromDocument(progression) : null);
      if (!draft) continue;
      const selectedEntry = codexEntries.find((entry) => entry.metadata.id === draft.entryId) ?? null;
      const entryOptions = codexEntries
        .filter((entry) => !entry.metadata.archivedAt || entry.metadata.id === draft.entryId)
        .map((entry) => ({ label: entry.metadata.name, value: entry.metadata.id }));
      if (draft.entryId && !entryOptions.some((option) => option.value === draft.entryId)) {
        entryOptions.push({ label: selectedEntry?.metadata.name ?? progressionText.missingRecord, value: draft.entryId });
      }
      const detailOptions = selectedEntry
        ? codexDetailTypes.filter((document) => document.detailType.categoryId === selectedEntry.metadata.categoryId)
        : [];
      const fieldOptions = [
        { label: progressionText.fieldDescription, value: "description" },
        ...detailOptions.map((document) => ({
          label: document.detailType.name,
          value: `detail:${document.detailType.id}`,
        })),
      ];
      if (!fieldOptions.some((option) => option.value === draft.fieldSelection)) {
        fieldOptions.push({ label: fieldLabel(draft.fieldSelection, codexDetailTypes), value: draft.fieldSelection });
      }
      views[block.id] = {
        blockId: block.id,
        draft,
        draftKey: [
          draft.entryId,
          draft.fieldSelection,
          draft.operation,
          draft.summary,
          draft.body,
        ].join("\u001f"),
        entryLabel: selectedEntry?.metadata.name ?? progressionText.missingRecord,
        entryOptions,
        fieldLabel: fieldLabel(draft.fieldSelection, codexDetailTypes),
        fieldOptions,
        isBusy: Boolean(progressionBusyId && (
          progressionBusyId === block.id || progressionBusyId === block.progressionId
        )),
        isCollapsed: collapsedProgressionBlocks.has(block.id),
        isSelected: selectedProgressionBlockId === block.id,
        operationOptions: [
          { label: progressionText.operations.add, value: "add" },
          { label: progressionText.operations.replace, value: "replace" },
        ],
        progressionId: block.progressionId,
      };
    }
    return views;
  }, [
    codexDetailTypes,
    codexEntries,
    collapsedProgressionBlocks,
    progressionBlocks,
    progressionBusyId,
    progressionDrafts,
    progressionsById,
    selectedProgressionBlockId,
  ]);

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
            <div className="top-actions">
              <span className="pill">{selectedScene?.metadata.pov ? `${selectedScene.metadata.pov} POV` : "No POV"}</span>
              <span className="pill">{draft ? `${sceneEditorCharacterCount} chars / ${sceneEditorWordCount} words` : "No scene"}</span>
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
                {isCodexLoading ? (
                  <div className="scene-kicker">
                    <span className="pill">Loading codex</span>
                  </div>
                ) : null}
                {progressionError ? <p className="alert">{progressionError}</p> : null}
                <input
                  aria-label="Scene title"
                  className="scene-title-input"
                  onChange={(event) => onUpdateTitle(event.target.value)}
                  value={draft.title}
                />
                <NovelEditor
                  canAddStoryChange={Boolean(codexEntries.length)}
                  document={draft.document}
                  isStoryChangeBusy={Boolean(progressionBusyId)}
                  onAddStoryChangeAfter={(blockId) => void insertProgressionBlockAfter(blockId)}
                  onChange={onUpdateDocument}
                  onDeleteCurrent={deleteCurrentEditorBlock}
                  onDeleteProgressionBlock={deleteProgressionBlockById}
                  onInsertParagraphAfter={insertParagraphAfter}
                  onSelectStoryChange={setSelectedProgressionBlockId}
                  onToggleProgressionCollapse={(blockId) => setCollapsedProgressionBlocks((current) => toggleSetValue(current, blockId))}
                  onUpdateProgressionDraft={updateProgressionDraftByBlockId}
                  progressionNodeViews={progressionNodeViews}
                />
                {sceneMentions.length ? (
                  <div className="scene-codex-mentions" aria-label={uiText.writeEditor.aria.codexMentions}>
                    {sceneMentions.map((mention) => (
                      <button
                        className="codex-mention-chip"
                        key={`${mention.entryId}-${mention.start}-${mention.end}`}
                        onClick={() => setActiveBlockMention((current) =>
                          current?.entryId === mention.entryId
                            ? null
                            : { blockId: "scene", entryId: mention.entryId },
                        )}
                        type="button"
                      >
                        {mention.matchedText}
                      </button>
                    ))}
                  </div>
                ) : null}
                {activeMentionEntry ? (
                  <div className="scene-content-preview" aria-label={`${activeMentionEntry.metadata.name} canon description`}>
                    <div className="preview-title">{activeMentionEntry.metadata.name}</div>
                    <p>{activeMentionEntry.description || "No description"}</p>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="large-note">
                <h2>No scene open</h2>
                <p>Select a scene to begin writing.</p>
              </div>
            )}
          </div>

          {saveStatus === "failed" || saveStatus === "conflict" ? (
            <footer className="save-bar is-error">
              <span>{saveText(saveStatus)}</span>
              {draft ? <span className="save-bar-meta">{`${draft.paragraphCount} paragraphs`}</span> : null}
            </footer>
          ) : null}
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
