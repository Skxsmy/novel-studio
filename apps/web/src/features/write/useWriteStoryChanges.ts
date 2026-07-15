import type {
  CodexDetailTypeDocument,
  CodexEntryDocument,
  CodexProgressionDocument,
  SceneBlock,
} from "@novel-studio/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { ProjectSessionState } from "../../app/useProjectSession";
import { createParagraphBlock } from "../../app/sceneBlocks";
import { uiText } from "../../app/uiText";
import { api } from "../../api";
import type { ProgressionNodeViewModel } from "./editor/CodexProgressionNodeView";
import {
  fieldFromSelection,
  fieldLabel,
  isSceneWriteProgression,
  progressionDraftFromDocument,
  type ProgressionDraft,
} from "./story-change/storyChangeViewModel";

const progressionText = uiText.writeProgression;
type ProgressionBlock = Extract<SceneBlock, { kind: "codexProgression" }>;

function toggleSetValue(current: Set<string>, id: string) {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function useWriteStoryChanges(session: ProjectSessionState) {
  const { activeSeries: series, draft, selectedScene } = session;
  const [codexEntries, setCodexEntries] = useState<CodexEntryDocument[]>([]);
  const [codexDetailTypes, setCodexDetailTypes] = useState<CodexDetailTypeDocument[]>([]);
  const [sceneProgressions, setSceneProgressions] = useState<CodexProgressionDocument[]>([]);
  const [progressionDrafts, setProgressionDrafts] = useState<Record<string, ProgressionDraft>>({});
  const [collapsedBlocks, setCollapsedBlocks] = useState<Set<string>>(() => new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [activeEditorBlockId, setActiveEditorBlockId] = useState<string | null>(null);
  const [focusBlockId, setFocusBlockId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const progressionsById = useMemo(
    () => new Map(sceneProgressions.map((document) => [document.progression.id, document])),
    [sceneProgressions],
  );
  const progressionBlocks = useMemo(
    () => draft?.document.blocks.filter((block): block is ProgressionBlock => block.kind === "codexProgression") ?? [],
    [draft?.document.blocks],
  );
  const progressionBlockIds = progressionBlocks.map((block) => block.id).join("|");
  const isBusy = Boolean(busyId) || session.saveStatus === "saving" || session.saveStatus === "retrying";

  const updateDocumentBlocks = useCallback((blocks: SceneBlock[]) => {
    if (!draft) return;
    session.updateDraftDocument({
      schemaVersion: 1,
      blocks: blocks.length > 0 ? blocks : [createParagraphBlock()],
    });
  }, [draft, session.updateDraftDocument]);

  const saveDirtyDraft = useCallback(async () => {
    if (!draft || !session.isDirty) return null;
    return session.commitDraftDocument(draft.document, {
      baseRevision: draft.revision,
      status: draft.status,
      title: draft.title,
    });
  }, [draft, session.commitDraftDocument, session.isDirty]);

  const insertStoryChange = useCallback(async () => {
    if (!series || !draft || !selectedScene || isBusy) return;
    const entry = codexEntries.find((candidate) => !candidate.metadata.archivedAt);
    if (!entry) {
      setError(progressionText.errors.missingEntry);
      return;
    }
    const operationId = activeEditorBlockId ?? "new-progression-block";
    setBusyId(operationId);
    setError(null);
    try {
      const savedScene = await saveDirtyDraft();
      const result = await api.series.createSceneProgressionBlock(series.manifest.id, draft.sceneId, {
        baseRevision: savedScene?.revision ?? draft.revision,
        afterBlockId: activeEditorBlockId,
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
      session.acceptSavedSceneDocument(result.scene);
      setSceneProgressions((current) => [
        ...current.filter((document) => document.progression.id !== result.progression.progression.id),
        result.progression,
      ]);
      setProgressionDrafts((current) => ({
        ...current,
        [result.progression.progression.id]: progressionDraftFromDocument(result.progression),
      }));
      setCollapsedBlocks((current) => {
        const next = new Set(current);
        next.add(result.block.id);
        return next;
      });
      setSelectedBlockId(result.block.id);
      setFocusBlockId(result.block.id);
    } catch (caught) {
      setError(errorMessage(caught, progressionText.errors.addFailed));
    } finally {
      setBusyId(null);
    }
  }, [activeEditorBlockId, codexEntries, draft, isBusy, saveDirtyDraft, selectedScene, series, session.acceptSavedSceneDocument]);

  const updateProgressionDraft = useCallback((progressionId: string, patch: Partial<ProgressionDraft>) => {
    setError(null);
    setProgressionDrafts((current) => {
      const source = current[progressionId] ??
        (progressionsById.get(progressionId) ? progressionDraftFromDocument(progressionsById.get(progressionId)!) : null);
      if (!source) return current;
      return { ...current, [progressionId]: { ...source, ...patch } };
    });
  }, [progressionsById]);

  const saveProgression = useCallback(async (progressionId: string, draftOverride?: ProgressionDraft) => {
    if (!series || busyId) return;
    const progression = progressionsById.get(progressionId);
    const progressionDraft = draftOverride ?? progressionDrafts[progressionId];
    if (!progression || !progressionDraft) return;
    setBusyId(progressionId);
    setError(null);
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
    } catch (caught) {
      setError(errorMessage(caught, progressionText.errors.saveFailed));
    } finally {
      setBusyId(null);
    }
  }, [busyId, progressionDrafts, progressionsById, series]);

  const moveBlock = useCallback((blockId: string, direction: "down" | "up") => {
    if (!draft) return;
    const index = draft.document.blocks.findIndex((block) => block.id === blockId && block.kind === "codexProgression");
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= draft.document.blocks.length) return;
    const nextBlocks = [...draft.document.blocks];
    const current = nextBlocks[index];
    const target = nextBlocks[targetIndex];
    if (!current || !target) return;
    nextBlocks[index] = target;
    nextBlocks[targetIndex] = current;
    updateDocumentBlocks(nextBlocks);
    setSelectedBlockId(blockId);
    setFocusBlockId(blockId);
  }, [draft, updateDocumentBlocks]);

  const moveBlockTo = useCallback((blockId: string, targetBlockId: string, placement: "after" | "before") => {
    if (!draft || blockId === targetBlockId) return;
    const current = draft.document.blocks.find((block) => block.id === blockId && block.kind === "codexProgression");
    if (!current) return;
    const remaining = draft.document.blocks.filter((block) => block.id !== blockId);
    const targetIndex = remaining.findIndex((block) => block.id === targetBlockId);
    if (targetIndex < 0) return;
    const insertIndex = placement === "before" ? targetIndex : targetIndex + 1;
    const nextBlocks = [...remaining.slice(0, insertIndex), current, ...remaining.slice(insertIndex)];
    if (nextBlocks.map((block) => block.id).join("|") === draft.document.blocks.map((block) => block.id).join("|")) return;
    updateDocumentBlocks(nextBlocks);
    setSelectedBlockId(blockId);
    setFocusBlockId(blockId);
  }, [draft, updateDocumentBlocks]);

  const deleteBlock = useCallback(async (blockId: string) => {
    if (!series || !draft || isBusy) return;
    const block = progressionBlocks.find((candidate) => candidate.id === blockId);
    const progression = block ? progressionsById.get(block.progressionId) : null;
    if (!block || !progression) {
      setError(progressionText.errors.notLoaded);
      return;
    }
    setBusyId(block.id);
    setError(null);
    try {
      const savedScene = await saveDirtyDraft();
      const result = await api.series.deleteSceneProgressionBlock(series.manifest.id, draft.sceneId, block.id, {
        baseRevision: savedScene?.revision ?? draft.revision,
        progressionBaseRevision: progression.revision,
      });
      if (result.blockers.length > 0) {
        setError(result.blockers.map((blocker) => blocker.reason).join(" "));
        return;
      }
      if (result.scene) session.acceptSavedSceneDocument(result.scene);
      setSceneProgressions((current) => current.filter((document) => document.progression.id !== block.progressionId));
      setProgressionDrafts((current) => {
        const next = { ...current };
        delete next[block.progressionId];
        return next;
      });
      setCollapsedBlocks((current) => {
        const next = new Set(current);
        next.delete(block.id);
        return next;
      });
      setSelectedBlockId((current) => (current === block.id ? null : current));
    } catch (caught) {
      setError(errorMessage(caught, progressionText.errors.deleteFailed));
    } finally {
      setBusyId(null);
    }
  }, [draft, isBusy, progressionBlocks, progressionsById, saveDirtyDraft, series, session.acceptSavedSceneDocument]);

  const focusStoryChange = useCallback((blockId: string) => {
    setCollapsedBlocks((current) => {
      const next = new Set(current);
      next.delete(blockId);
      return next;
    });
    setSelectedBlockId(blockId);
    setFocusBlockId(blockId);
  }, []);

  const resolvePreviewDescription = useCallback(async (entryId: string, blockId: string | null) => {
    if (!series || !selectedScene) return "";
    const effective = await api.codex.getEffectiveEntry(series.manifest.id, entryId, {
      sceneId: selectedScene.metadata.id,
      ...(blockId ? { blockId } : {}),
    });
    return effective.entry.description;
  }, [selectedScene, series]);

  useEffect(() => {
    if (!series || !selectedScene) {
      setCodexEntries([]);
      setCodexDetailTypes([]);
      setSceneProgressions([]);
      setIsLoading(false);
      return;
    }
    let active = true;
    setIsLoading(true);
    Promise.all([
      api.codex.listEntries(series.manifest.id),
      api.codex.listDetailTypes(series.manifest.id),
      api.codex.listProgressions(series.manifest.id, { kind: "field", sceneId: selectedScene.metadata.id }),
    ]).then(([entries, detailTypes, progressions]) => {
      if (!active) return;
      setCodexEntries(entries);
      setCodexDetailTypes(detailTypes);
      setSceneProgressions(progressions.filter((document) => isSceneWriteProgression(document, selectedScene.metadata.id)));
    }).catch(() => {
      if (!active) return;
      setCodexEntries([]);
      setCodexDetailTypes([]);
      setSceneProgressions([]);
      setError(progressionText.errors.notLoaded);
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, [selectedScene?.metadata.id, series?.manifest.id]);

  useEffect(() => {
    setError(null);
    setSelectedBlockId(null);
    setActiveEditorBlockId(null);
    setFocusBlockId(null);
    setCollapsedBlocks(new Set(progressionBlocks.map((block) => block.id)));
  }, [draft?.sceneId]);

  useEffect(() => {
    if (!progressionBlocks.length) {
      setSelectedBlockId(null);
      return;
    }
    if (!selectedBlockId || !progressionBlocks.some((block) => block.id === selectedBlockId)) {
      setSelectedBlockId(progressionBlocks[0]?.id ?? null);
    }
  }, [progressionBlockIds, progressionBlocks, selectedBlockId]);

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
    if (busyId || !series) return;
    const dirty = sceneProgressions.find((document) => {
      const progressionDraft = progressionDrafts[document.progression.id];
      return progressionDraft && progressionDraft.entryId && (
        document.progression.entryId !== progressionDraft.entryId ||
        document.progression.operation !== progressionDraft.operation ||
        document.progression.body !== progressionDraft.body ||
        document.progression.summary !== progressionDraft.summary ||
        JSON.stringify(document.progression.field) !== JSON.stringify(fieldFromSelection(progressionDraft.fieldSelection))
      );
    });
    const progressionDraft = dirty ? progressionDrafts[dirty.progression.id] : null;
    if (!dirty || !progressionDraft) return;
    const timer = window.setTimeout(() => void saveProgression(dirty.progression.id, progressionDraft), 900);
    return () => window.clearTimeout(timer);
  }, [busyId, progressionDrafts, saveProgression, sceneProgressions, series]);

  const progressionNodeViews = useMemo(() => {
    const views: Record<string, ProgressionNodeViewModel> = {};
    const blocks = draft?.document.blocks ?? [];
    for (const block of progressionBlocks) {
      const blockIndex = blocks.findIndex((candidate) => candidate.id === block.id);
      const progression = progressionsById.get(block.progressionId);
      const progressionDraft = progressionDrafts[block.progressionId] ??
        (progression ? progressionDraftFromDocument(progression) : null);
      if (!progressionDraft) continue;
      const selectedEntry = codexEntries.find((entry) => entry.metadata.id === progressionDraft.entryId) ?? null;
      const entryOptions = codexEntries
        .filter((entry) => !entry.metadata.archivedAt || entry.metadata.id === progressionDraft.entryId)
        .map((entry) => ({ label: entry.metadata.name, value: entry.metadata.id }));
      if (progressionDraft.entryId && !entryOptions.some((option) => option.value === progressionDraft.entryId)) {
        entryOptions.push({ label: selectedEntry?.metadata.name ?? progressionText.missingRecord, value: progressionDraft.entryId });
      }
      const detailOptions = selectedEntry
        ? codexDetailTypes.filter((document) => document.detailType.categoryId === selectedEntry.metadata.categoryId)
        : [];
      const fieldOptions = [
        { label: progressionText.fieldDescription, value: "description" },
        ...detailOptions.map((document) => ({ label: document.detailType.name, value: `detail:${document.detailType.id}` })),
      ];
      if (!fieldOptions.some((option) => option.value === progressionDraft.fieldSelection)) {
        fieldOptions.push({
          label: fieldLabel(progressionDraft.fieldSelection, codexDetailTypes),
          value: progressionDraft.fieldSelection,
        });
      }
      views[block.id] = {
        blockId: block.id,
        canMoveDown: blockIndex >= 0 && blockIndex < blocks.length - 1,
        canMoveUp: blockIndex > 0,
        draft: progressionDraft,
        draftKey: [
          progressionDraft.entryId,
          progressionDraft.fieldSelection,
          progressionDraft.operation,
          progressionDraft.summary,
          progressionDraft.body,
        ].join("\u001f"),
        entryLabel: selectedEntry?.metadata.name ?? progressionText.missingRecord,
        entryOptions,
        fieldLabel: fieldLabel(progressionDraft.fieldSelection, codexDetailTypes),
        fieldOptions,
        isBusy: Boolean(busyId && (busyId === block.id || busyId === block.progressionId)),
        isCollapsed: collapsedBlocks.has(block.id),
        isSelected: selectedBlockId === block.id,
        operationOptions: [
          { label: progressionText.operations.add, value: "add" },
          { label: progressionText.operations.replace, value: "replace" },
        ],
        progressionId: block.progressionId,
      };
    }
    return views;
  }, [busyId, codexDetailTypes, codexEntries, collapsedBlocks, draft?.document.blocks, progressionBlocks, progressionDrafts, progressionsById, selectedBlockId]);

  return {
    activeEditorBlockId,
    codexEntries,
    error,
    focusBlockId,
    focusStoryChange,
    insertStoryChange,
    isBusy,
    isLoading,
    moveBlock,
    moveBlockTo,
    progressionBlocks,
    progressionNodeViews,
    resolvePreviewDescription,
    selectedBlockId,
    setActiveEditorBlockId,
    setFocusBlockId,
    setSelectedBlockId,
    toggleBlock: (blockId: string) => setCollapsedBlocks((current) => toggleSetValue(current, blockId)),
    updateBlockDraft: (blockId: string, patch: Partial<ProgressionDraft>) => {
      const block = progressionBlocks.find((candidate) => candidate.id === blockId);
      if (block) updateProgressionDraft(block.progressionId, patch);
    },
    deleteBlock,
  };
}
