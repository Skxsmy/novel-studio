import type {
  CloudPolicy,
  CreateActInput,
  CreateBookInput,
  CreateChapterInput,
  CreateSceneInput,
  CreateSeriesInput,
  SceneDocument,
  SceneStatus,
  SeriesDetail,
  SeriesSummary,
  UpdateActInput,
  UpdateBookInput,
  UpdateChapterInput,
  UpdateSceneInput,
} from "@novel-studio/contracts";
import { DefaultStructureTitles as structureDefaults } from "@novel-studio/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, api } from "../api";
import { uiText } from "./uiText";

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "failed" | "conflict";

export interface SceneDraft {
  sceneId: string;
  title: string;
  content: string;
  revision: string;
  status: SceneStatus;
  characterCount: number;
  paragraphCount: number;
}

export interface ProjectSessionState {
  activeSeries: SeriesDetail | null;
  createAct: (input?: CreateActInput) => Promise<void>;
  createVolume: (input?: CreateBookInput) => Promise<void>;
  createChapter: (input?: CreateChapterInput) => Promise<void>;
  createScene: (input?: CreateSceneInput) => Promise<void>;
  createSeries: (input: CreateSeriesInput) => Promise<void>;
  deleteAct: (actId: string) => Promise<void>;
  deleteVolume: (bookId: string) => Promise<void>;
  deleteChapter: (chapterId: string) => Promise<void>;
  deleteScene: (sceneId: string) => Promise<void>;
  draft: SceneDraft | null;
  errorMessage: string | null;
  isCreatingStructure: boolean;
  isCreatingSeries: boolean;
  isDirty: boolean;
  isLibraryLoading: boolean;
  isOpeningSeries: boolean;
  openSeries: (seriesId: string) => Promise<void>;
  refreshSeriesList: () => Promise<void>;
  saveDraft: () => Promise<void>;
  saveStatus: SaveStatus;
  selectAct: (actId: string) => void;
  selectChapter: (chapterId: string) => void;
  selectScene: (sceneId: string) => void;
  selectedActId: string | null;
  selectedChapterId: string | null;
  selectedScene: SceneDocument | null;
  seriesList: SeriesSummary[];
  updateAct: (actId: string, input: UpdateActInput) => Promise<void>;
  updateVolume: (bookId: string, input: UpdateBookInput) => Promise<void>;
  updateChapter: (chapterId: string, input: UpdateChapterInput) => Promise<void>;
  updateCloudPolicy: (cloudPolicy: CloudPolicy) => Promise<void>;
  updateDraftContent: (content: string) => void;
  updateDraftTitle: (title: string) => void;
}

function toDraft(scene: SceneDocument): SceneDraft {
  return {
    sceneId: scene.metadata.id,
    title: scene.metadata.title,
    content: scene.content,
    revision: scene.revision,
    status: scene.metadata.status,
    characterCount: scene.characterCount,
    paragraphCount: scene.paragraphCount,
  };
}

function replaceScene(series: SeriesDetail, scene: SceneDocument): SeriesDetail {
  return {
    ...series,
    scenes: series.scenes.map((current) => (current.metadata.id === scene.metadata.id ? scene : current)),
  };
}

function formatError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const payload = error.payload;
    if (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string") {
      return payload.message;
    }
    return `${fallback} (${error.status})`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export function useProjectSession(): ProjectSessionState {
  const [activeSeries, setActiveSeries] = useState<SeriesDetail | null>(null);
  const [draft, setDraft] = useState<SceneDraft | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreatingStructure, setIsCreatingStructure] = useState(false);
  const [isCreatingSeries, setIsCreatingSeries] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isLibraryLoading, setIsLibraryLoading] = useState(true);
  const [isOpeningSeries, setIsOpeningSeries] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [selectedActId, setSelectedActId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [seriesList, setSeriesList] = useState<SeriesSummary[]>([]);

  const selectedScene = useMemo(
    () => activeSeries?.scenes.find((scene) => scene.metadata.id === selectedSceneId) ?? null,
    [activeSeries, selectedSceneId],
  );

  const setStructureSelectionFromSeries = useCallback((detail: SeriesDetail, scene: SceneDocument | null) => {
    const actId = scene?.metadata.actId ?? detail.acts[0]?.id ?? detail.books[0]?.actIds[0] ?? null;
    const chapterId = scene?.metadata.chapterId ??
      (actId ? detail.chapters.find((chapter) => chapter.actId === actId)?.id : null) ??
      detail.chapters[0]?.id ??
      null;
    setSelectedActId(actId);
    setSelectedChapterId(chapterId);
  }, []);

  const refreshSeriesList = useCallback(async () => {
    setIsLibraryLoading(true);
    setErrorMessage(null);
    try {
      setSeriesList(await api.series.listSeries());
    } catch (error) {
      setErrorMessage(formatError(error, "Failed to load project library"));
    } finally {
      setIsLibraryLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSeriesList();
  }, [refreshSeriesList]);

  const openSeries = useCallback(async (seriesId: string) => {
    setIsOpeningSeries(true);
    setErrorMessage(null);
    try {
      const detail = await api.series.getSeries(seriesId);
      const firstScene = detail.scenes[0] ?? null;
      setActiveSeries(detail);
      setSelectedSceneId(firstScene?.metadata.id ?? null);
      setStructureSelectionFromSeries(detail, firstScene);
      setDraft(firstScene ? toDraft(firstScene) : null);
      setIsDirty(false);
      setSaveStatus(firstScene ? "saved" : "idle");
    } catch (error) {
      setErrorMessage(formatError(error, "Failed to open project"));
    } finally {
      setIsOpeningSeries(false);
    }
  }, []);

  const createSeries = useCallback(
    async (input: CreateSeriesInput) => {
      setIsCreatingSeries(true);
      setErrorMessage(null);
      try {
        const detail = await api.series.createSeries(input);
        const firstScene = detail.scenes[0] ?? null;
        setActiveSeries(detail);
        setSelectedSceneId(firstScene?.metadata.id ?? null);
        setStructureSelectionFromSeries(detail, firstScene);
        setDraft(firstScene ? toDraft(firstScene) : null);
        setIsDirty(false);
        setSaveStatus(firstScene ? "saved" : "idle");
        await refreshSeriesList();
      } catch (error) {
        setErrorMessage(formatError(error, "Failed to create project"));
      } finally {
        setIsCreatingSeries(false);
      }
    },
    [refreshSeriesList, setStructureSelectionFromSeries],
  );

  const reloadActiveSeries = useCallback(async (seriesId: string) => {
    const detail = await api.series.getSeries(seriesId);
    setActiveSeries(detail);
    return detail;
  }, []);

  const openSceneFromDetail = useCallback(
    (detail: SeriesDetail, scene: SceneDocument | null) => {
      setActiveSeries(detail);
      setSelectedSceneId(scene?.metadata.id ?? null);
      setStructureSelectionFromSeries(detail, scene);
      setDraft(scene ? toDraft(scene) : null);
      setIsDirty(false);
      setSaveStatus(scene ? "saved" : "idle");
    },
    [setStructureSelectionFromSeries],
  );

  const createVolume = useCallback(
    async (input: CreateBookInput = { title: structureDefaults.newVolume }) => {
      if (!activeSeries || isCreatingStructure) return;

      setIsCreatingStructure(true);
      setErrorMessage(null);
      try {
        const book = await api.series.createBook(activeSeries.manifest.id, input);
        const detail = await reloadActiveSeries(activeSeries.manifest.id);
        const actId = book.actIds[0] ?? null;
        const chapterId = actId ? detail.chapters.find((chapter) => chapter.actId === actId)?.id ?? null : null;
        setSelectedSceneId(null);
        setSelectedActId(actId);
        setSelectedChapterId(chapterId);
        setDraft(null);
        setIsDirty(false);
        setSaveStatus("idle");
      } catch (error) {
        setErrorMessage(formatError(error, uiText.errors.createVolumeFailed));
      } finally {
        setIsCreatingStructure(false);
      }
    },
    [activeSeries, isCreatingStructure, reloadActiveSeries],
  );

  const createAct = useCallback(
    async (input: CreateActInput = { title: structureDefaults.chapter }) => {
      if (!activeSeries || isCreatingStructure) return;
      const book = activeSeries.books[0];
      if (!book) {
        setErrorMessage(uiText.errors.cannotCreateChapterWithoutVolume);
        return;
      }

      setIsCreatingStructure(true);
      setErrorMessage(null);
      try {
        const act = await api.series.createAct(activeSeries.manifest.id, book.id, input);
        await reloadActiveSeries(activeSeries.manifest.id);
        setSelectedActId(act.id);
        setSelectedChapterId(null);
      } catch (error) {
        setErrorMessage(formatError(error, uiText.errors.createChapterFailed));
      } finally {
        setIsCreatingStructure(false);
      }
    },
    [activeSeries, isCreatingStructure, reloadActiveSeries],
  );

  const createChapter = useCallback(
    async (input: CreateChapterInput = { title: structureDefaults.act }) => {
      if (!activeSeries || isCreatingStructure) return;
      const actId = selectedActId ?? selectedScene?.metadata.actId ?? activeSeries.acts[0]?.id ?? activeSeries.books[0]?.actIds[0];
      if (!actId) {
        setErrorMessage(uiText.errors.cannotCreateActWithoutChapter);
        return;
      }

      setIsCreatingStructure(true);
      setErrorMessage(null);
      try {
        const chapter = await api.series.createChapter(activeSeries.manifest.id, actId, input);
        await reloadActiveSeries(activeSeries.manifest.id);
        setSelectedActId(chapter.actId);
        setSelectedChapterId(chapter.id);
      } catch (error) {
        setErrorMessage(formatError(error, uiText.errors.createActFailed));
      } finally {
        setIsCreatingStructure(false);
      }
    },
    [activeSeries, isCreatingStructure, reloadActiveSeries, selectedActId, selectedScene?.metadata.actId],
  );

  const createScene = useCallback(
    async (input: CreateSceneInput = { title: structureDefaults.scene, content: "" }) => {
      if (!activeSeries || isCreatingStructure) return;

      setIsCreatingStructure(true);
      setErrorMessage(null);
      try {
        const targetChapterId = selectedChapterId ?? selectedScene?.metadata.chapterId;
        const targetChapter = targetChapterId ? activeSeries.chapters.find((chapter) => chapter.id === targetChapterId) : null;
        const targetAct = targetChapter ? activeSeries.acts.find((act) => act.id === targetChapter.actId) : null;
        const sceneInput: CreateSceneInput = targetAct && targetChapter
          ? { ...input, bookId: targetAct.bookId, actId: targetAct.id, chapterId: targetChapter.id }
          : input;
        const scene = await api.series.createScene(activeSeries.manifest.id, sceneInput);
        const detail = await reloadActiveSeries(activeSeries.manifest.id);
        const storedScene = detail.scenes.find((candidate) => candidate.metadata.id === scene.metadata.id) ?? scene;
        setSelectedSceneId(storedScene.metadata.id);
        setSelectedActId(storedScene.metadata.actId);
        setSelectedChapterId(storedScene.metadata.chapterId);
        setDraft(toDraft(storedScene));
        setIsDirty(false);
        setSaveStatus("saved");
      } catch (error) {
        setErrorMessage(formatError(error, uiText.errors.createSceneFailed));
      } finally {
        setIsCreatingStructure(false);
      }
    },
    [activeSeries, isCreatingStructure, reloadActiveSeries, selectedChapterId, selectedScene?.metadata.chapterId],
  );

  const selectAct = useCallback(
    (actId: string) => {
      const act = activeSeries?.acts.find((candidate) => candidate.id === actId);
      if (!act) return;
      setSelectedActId(act.id);
      const chapterId = activeSeries?.chapters.find((chapter) => chapter.actId === act.id)?.id ?? null;
      setSelectedChapterId(chapterId);
    },
    [activeSeries],
  );

  const selectChapter = useCallback(
    (chapterId: string) => {
      const chapter = activeSeries?.chapters.find((candidate) => candidate.id === chapterId);
      if (!chapter) return;
      setSelectedActId(chapter.actId);
      setSelectedChapterId(chapter.id);
    },
    [activeSeries],
  );

  const selectScene = useCallback(
    (sceneId: string) => {
      const scene = activeSeries?.scenes.find((candidate) => candidate.metadata.id === sceneId) ?? null;
      if (!scene) return;

      setSelectedSceneId(sceneId);
      setSelectedActId(scene.metadata.actId);
      setSelectedChapterId(scene.metadata.chapterId);
      setDraft(toDraft(scene));
      setIsDirty(false);
      setSaveStatus("saved");
      setErrorMessage(null);
    },
    [activeSeries],
  );

  const updateVolume = useCallback(
    async (bookId: string, input: UpdateBookInput) => {
      if (!activeSeries || isCreatingStructure) return;

      setIsCreatingStructure(true);
      setErrorMessage(null);
      try {
        const book = await api.series.updateBook(activeSeries.manifest.id, bookId, input);
        setActiveSeries((current) => current
          ? { ...current, books: current.books.map((candidate) => (candidate.id === book.id ? book : candidate)) }
          : current);
      } catch (error) {
        setErrorMessage(formatError(error, uiText.errors.renameVolumeFailed));
      } finally {
        setIsCreatingStructure(false);
      }
    },
    [activeSeries, isCreatingStructure],
  );

  const updateAct = useCallback(
    async (actId: string, input: UpdateActInput) => {
      if (!activeSeries || isCreatingStructure) return;

      setIsCreatingStructure(true);
      setErrorMessage(null);
      try {
        const act = await api.series.updateAct(activeSeries.manifest.id, actId, input);
        setActiveSeries((current) => current
          ? { ...current, acts: current.acts.map((candidate) => (candidate.id === act.id ? act : candidate)) }
          : current);
        setSelectedActId(act.id);
      } catch (error) {
        setErrorMessage(formatError(error, uiText.errors.renameChapterFailed));
      } finally {
        setIsCreatingStructure(false);
      }
    },
    [activeSeries, isCreatingStructure],
  );

  const updateChapter = useCallback(
    async (chapterId: string, input: UpdateChapterInput) => {
      if (!activeSeries || isCreatingStructure) return;

      setIsCreatingStructure(true);
      setErrorMessage(null);
      try {
        const chapter = await api.series.updateChapter(activeSeries.manifest.id, chapterId, input);
        setActiveSeries((current) => current
          ? { ...current, chapters: current.chapters.map((candidate) => (candidate.id === chapter.id ? chapter : candidate)) }
          : current);
        setSelectedActId(chapter.actId);
        setSelectedChapterId(chapter.id);
      } catch (error) {
        setErrorMessage(formatError(error, uiText.errors.renameActFailed));
      } finally {
        setIsCreatingStructure(false);
      }
    },
    [activeSeries, isCreatingStructure],
  );

  const updateCloudPolicy = useCallback(
    async (cloudPolicy: CloudPolicy) => {
      if (!activeSeries) return;

      setErrorMessage(null);
      try {
        const manifest = await api.ai.updateCloudPolicy(activeSeries.manifest.id, { cloudPolicy });
        setActiveSeries((current) => (current ? { ...current, manifest } : current));
      } catch (error) {
        setErrorMessage(formatError(error, "Failed to save project cloud policy"));
        throw error;
      }
    },
    [activeSeries],
  );

  const deleteScene = useCallback(
    async (sceneId: string) => {
      if (!activeSeries || isCreatingStructure) return;
      const currentScene = activeSeries.scenes.find((scene) => scene.metadata.id === sceneId) ?? null;

      setIsCreatingStructure(true);
      setErrorMessage(null);
      try {
        await api.series.deleteScene(activeSeries.manifest.id, sceneId);
        const detail = await api.series.getSeries(activeSeries.manifest.id);
        const nextScene = detail.scenes.find((scene) => scene.metadata.chapterId === currentScene?.metadata.chapterId) ??
          detail.scenes[0] ??
          null;
        openSceneFromDetail(detail, nextScene);
      } catch (error) {
        setErrorMessage(formatError(error, uiText.errors.deleteSceneFailed));
      } finally {
        setIsCreatingStructure(false);
      }
    },
    [activeSeries, isCreatingStructure, openSceneFromDetail],
  );

  const deleteChapter = useCallback(
    async (chapterId: string) => {
      if (!activeSeries || isCreatingStructure) return;
      const currentChapter = activeSeries.chapters.find((chapter) => chapter.id === chapterId) ?? null;

      setIsCreatingStructure(true);
      setErrorMessage(null);
      try {
        await api.series.deleteChapter(activeSeries.manifest.id, chapterId);
        const detail = await api.series.getSeries(activeSeries.manifest.id);
        const nextScene = detail.scenes.find((scene) => scene.metadata.actId === currentChapter?.actId) ??
          detail.scenes[0] ??
          null;
        openSceneFromDetail(detail, nextScene);
      } catch (error) {
        setErrorMessage(formatError(error, uiText.errors.deleteActFailed));
      } finally {
        setIsCreatingStructure(false);
      }
    },
    [activeSeries, isCreatingStructure, openSceneFromDetail],
  );

  const deleteAct = useCallback(
    async (actId: string) => {
      if (!activeSeries || isCreatingStructure) return;

      setIsCreatingStructure(true);
      setErrorMessage(null);
      try {
        await api.series.deleteAct(activeSeries.manifest.id, actId);
        const detail = await api.series.getSeries(activeSeries.manifest.id);
        openSceneFromDetail(detail, detail.scenes[0] ?? null);
      } catch (error) {
        setErrorMessage(formatError(error, uiText.errors.deleteChapterFailed));
      } finally {
        setIsCreatingStructure(false);
      }
    },
    [activeSeries, isCreatingStructure, openSceneFromDetail],
  );

  const deleteVolume = useCallback(
    async (bookId: string) => {
      if (!activeSeries || isCreatingStructure) return;

      setIsCreatingStructure(true);
      setErrorMessage(null);
      try {
        await api.series.deleteBook(activeSeries.manifest.id, bookId);
        const detail = await api.series.getSeries(activeSeries.manifest.id);
        openSceneFromDetail(detail, detail.scenes[0] ?? null);
      } catch (error) {
        setErrorMessage(formatError(error, uiText.errors.deleteVolumeFailed));
      } finally {
        setIsCreatingStructure(false);
      }
    },
    [activeSeries, isCreatingStructure, openSceneFromDetail],
  );

  const updateDraftTitle = useCallback((title: string) => {
    setDraft((current) => (current ? { ...current, title } : current));
    setIsDirty(true);
    setSaveStatus("dirty");
  }, []);

  const updateDraftContent = useCallback((content: string) => {
    setDraft((current) => (current ? { ...current, content } : current));
    setIsDirty(true);
    setSaveStatus("dirty");
  }, []);

  const saveDraft = useCallback(async () => {
    if (!activeSeries || !draft || !isDirty || saveStatus === "saving") {
      return;
    }

    const title = draft.title.trim() || "Untitled Scene";
    const input: UpdateSceneInput = {
      baseRevision: draft.revision,
      content: draft.content,
      status: draft.status,
      title,
    };

    setSaveStatus("saving");
    setErrorMessage(null);

    try {
      const updated = await api.series.updateScene(activeSeries.manifest.id, draft.sceneId, input);
      setActiveSeries((current) => (current ? replaceScene(current, updated) : current));
      setSelectedSceneId(updated.metadata.id);
      setSelectedActId(updated.metadata.actId);
      setSelectedChapterId(updated.metadata.chapterId);
      setDraft(toDraft(updated));
      setIsDirty(false);
      setSaveStatus("saved");
    } catch (error) {
      setSaveStatus(error instanceof ApiError && error.status === 409 ? "conflict" : "failed");
      setErrorMessage(formatError(error, "Failed to save scene"));
    }
  }, [activeSeries, draft, isDirty, saveStatus]);

  return {
    activeSeries,
    createAct,
    createVolume,
    createChapter,
    createScene,
    createSeries,
    deleteAct,
    deleteVolume,
    deleteChapter,
    deleteScene,
    draft,
    errorMessage,
    isCreatingStructure,
    isCreatingSeries,
    isDirty,
    isLibraryLoading,
    isOpeningSeries,
    openSeries,
    refreshSeriesList,
    saveDraft,
    saveStatus,
    selectAct,
    selectChapter,
    selectScene,
    selectedActId,
    selectedChapterId,
    selectedScene,
    seriesList,
    updateAct,
    updateVolume,
    updateChapter,
    updateCloudPolicy,
    updateDraftContent,
    updateDraftTitle,
  };
}
