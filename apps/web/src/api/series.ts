import type { ApiClient } from "./client";
import type {
  ActManifest,
  BookManifest,
  ChapterManifest,
  CreateActInput,
  CreateBookInput,
  CreateChapterInput,
  CreateSceneInput,
  CreateSeriesInput,
  MoveSceneInput,
  PlanningBoard,
  ReorderInput,
  SceneBlockDocumentResponse,
  SceneDocument,
  SceneMarkdownExport,
  SeriesDetail,
  SeriesSummary,
  UpdateActInput,
  UpdateBookInput,
  UpdateChapterInput,
  UpdateSceneBlockDocumentInput,
  UpdateSceneInput,
} from "@novel-studio/contracts";

export function createSeriesApi(client: ApiClient) {
  return {
    listSeries() {
      return client.requestJson<SeriesSummary[]>("/series");
    },
    getSeries(seriesId: string) {
      return client.requestJson<SeriesDetail>(`/series/${seriesId}`);
    },
    getPlanningBoard(seriesId: string) {
      return client.requestJson<PlanningBoard>(`/series/${seriesId}/planning`);
    },
    createSeries(input: CreateSeriesInput) {
      return client.requestJson<SeriesDetail>("/series", {
        body: input,
        method: "POST",
      });
    },
    createBook(seriesId: string, input: CreateBookInput) {
      return client.requestJson<BookManifest>(`/series/${seriesId}/books`, {
        body: input,
        method: "POST",
      });
    },
    deleteBook(seriesId: string, bookId: string) {
      return client.requestJson<{
        deletedId: string;
        deletedActIds: string[];
        deletedChapterIds: string[];
        deletedSceneIds: string[];
      }>(`/series/${seriesId}/books/${bookId}`, { method: "DELETE" });
    },
    updateBook(seriesId: string, bookId: string, input: UpdateBookInput) {
      return client.requestJson<BookManifest>(`/series/${seriesId}/books/${bookId}`, {
        body: input,
        method: "PUT",
      });
    },
    createAct(seriesId: string, bookId: string, input: CreateActInput) {
      return client.requestJson<ActManifest>(`/series/${seriesId}/books/${bookId}/acts`, {
        body: input,
        method: "POST",
      });
    },
    createChapter(seriesId: string, actId: string, input: CreateChapterInput) {
      return client.requestJson<ChapterManifest>(`/series/${seriesId}/acts/${actId}/chapters`, {
        body: input,
        method: "POST",
      });
    },
    updateAct(seriesId: string, actId: string, input: UpdateActInput) {
      return client.requestJson<ActManifest>(`/series/${seriesId}/acts/${actId}`, {
        body: input,
        method: "PUT",
      });
    },
    deleteAct(seriesId: string, actId: string) {
      return client.requestJson<{ deletedId: string; deletedChapterIds: string[]; deletedSceneIds: string[] }>(
        `/series/${seriesId}/acts/${actId}`,
        { method: "DELETE" },
      );
    },
    updateChapter(seriesId: string, chapterId: string, input: UpdateChapterInput) {
      return client.requestJson<ChapterManifest>(`/series/${seriesId}/chapters/${chapterId}`, {
        body: input,
        method: "PUT",
      });
    },
    deleteChapter(seriesId: string, chapterId: string) {
      return client.requestJson<{ deletedId: string; deletedSceneIds: string[] }>(
        `/series/${seriesId}/chapters/${chapterId}`,
        { method: "DELETE" },
      );
    },
    createScene(seriesId: string, input: CreateSceneInput) {
      return client.requestJson<SceneDocument>(`/series/${seriesId}/scenes`, {
        body: input,
        method: "POST",
      });
    },
    getScene(seriesId: string, sceneId: string) {
      return client.requestJson<SceneDocument>(`/series/${seriesId}/scenes/${sceneId}`);
    },
    getSceneDocument(seriesId: string, sceneId: string) {
      return client.requestJson<SceneBlockDocumentResponse>(`/series/${seriesId}/scenes/${sceneId}/document`);
    },
    updateSceneDocument(seriesId: string, sceneId: string, input: UpdateSceneBlockDocumentInput) {
      return client.requestJson<SceneBlockDocumentResponse>(`/series/${seriesId}/scenes/${sceneId}/document`, {
        body: input,
        method: "PUT",
      });
    },
    exportSceneMarkdown(seriesId: string, sceneId: string) {
      return client.requestJson<SceneMarkdownExport>(`/series/${seriesId}/scenes/${sceneId}/export/markdown`);
    },
    updateScene(seriesId: string, sceneId: string, input: UpdateSceneInput) {
      return client.requestJson<SceneDocument>(`/series/${seriesId}/scenes/${sceneId}`, {
        body: input,
        method: "PUT",
      });
    },
    deleteScene(seriesId: string, sceneId: string) {
      return client.requestJson<{ deletedId: string }>(`/series/${seriesId}/scenes/${sceneId}`, {
        method: "DELETE",
      });
    },
    moveScene(seriesId: string, sceneId: string, input: MoveSceneInput) {
      return client.requestJson<SceneDocument>(`/series/${seriesId}/scenes/${sceneId}/move`, {
        body: input,
        method: "POST",
      });
    },
    reorderScenes(seriesId: string, chapterId: string, input: ReorderInput) {
      return client.requestJson<SceneDocument[]>(`/series/${seriesId}/chapters/${chapterId}/scenes/reorder`, {
        body: input,
        method: "POST",
      });
    },
  };
}

export type {
  ActManifest,
  BookManifest,
  ChapterManifest,
  CreateActInput,
  CreateBookInput,
  CreateChapterInput,
  CreateSceneInput,
  CreateSeriesInput,
  MoveSceneInput,
  PlanningBoard,
  ReorderInput,
  SceneBlockDocumentResponse,
  SceneDocument,
  SceneMarkdownExport,
  SeriesDetail,
  SeriesSummary,
  UpdateActInput,
  UpdateBookInput,
  UpdateChapterInput,
  UpdateSceneBlockDocumentInput,
  UpdateSceneInput,
};
