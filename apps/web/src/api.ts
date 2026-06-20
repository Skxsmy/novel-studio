import type {
  ActManifest,
  ChapterManifest,
  CreateActInput,
  CreateChapterInput,
  CreateSceneInput,
  CreateSeriesInput,
  CreateTimelineEventInput,
  MoveSceneInput,
  HierarchyValidationResult,
  PlanningBoard,
  ReorderInput,
  SceneDocument,
  SearchResult,
  SeriesDetail,
  SeriesSummary,
  TimelineEventDocument,
  UpdateActInput,
  UpdateChapterInput,
  UpdateSceneInput,
  UpdateScenePlanningInput,
  UpdateTimelineEventInput,
} from "@novel-studio/contracts";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("content-type", "application/json");
  const response = await fetch(url, { ...init, headers });
  const body = (await response.json()) as T | { message?: string };
  if (!response.ok) {
    throw new ApiError(
      "message" in (body as object) && typeof (body as { message?: unknown }).message === "string"
        ? (body as { message: string }).message
        : `请求失败 (${response.status})`,
      response.status,
      body,
    );
  }
  return body as T;
}

export const api = {
  listSeries: () => request<SeriesSummary[]>("/api/v1/series"),
  createSeries: (input: CreateSeriesInput) =>
    request<SeriesDetail>("/api/v1/series", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getSeries: (seriesId: string) => request<SeriesDetail>(`/api/v1/series/${seriesId}`),
  getPlanningBoard: (seriesId: string) =>
    request<PlanningBoard>(`/api/v1/series/${seriesId}/planning`),
  validateHierarchy: (seriesId: string) =>
    request<HierarchyValidationResult>(`/api/v1/series/${seriesId}/hierarchy/validate`),
  createScene: (seriesId: string, input: CreateSceneInput) =>
    request<SceneDocument>(`/api/v1/series/${seriesId}/scenes`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateScene: (seriesId: string, sceneId: string, input: UpdateSceneInput) =>
    request<SceneDocument>(`/api/v1/series/${seriesId}/scenes/${sceneId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  updateScenePlanning: (seriesId: string, sceneId: string, input: UpdateScenePlanningInput) =>
    request<SceneDocument>(`/api/v1/series/${seriesId}/scenes/${sceneId}/planning`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  createTimelineEvent: (seriesId: string, input: CreateTimelineEventInput) =>
    request<TimelineEventDocument>(`/api/v1/series/${seriesId}/timeline/events`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateTimelineEvent: (seriesId: string, eventId: string, input: UpdateTimelineEventInput) =>
    request<TimelineEventDocument>(`/api/v1/series/${seriesId}/timeline/events/${eventId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  deleteTimelineEvent: (seriesId: string, eventId: string, baseRevision: string) =>
    request<{ deletedId: string }>(`/api/v1/series/${seriesId}/timeline/events/${eventId}`, {
      method: "DELETE",
      body: JSON.stringify({ baseRevision }),
    }),
  reorderTimelineEvents: (seriesId: string, input: ReorderInput) =>
    request<TimelineEventDocument[]>(`/api/v1/series/${seriesId}/timeline/events/reorder`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  search: (seriesId: string, query: string) =>
    request<SearchResult[]>(`/api/v1/series/${seriesId}/search?q=${encodeURIComponent(query)}`),
  listActs: (seriesId: string, bookId: string) =>
    request<ActManifest[]>(`/api/v1/series/${seriesId}/books/${bookId}/acts`),
  createAct: (seriesId: string, bookId: string, input: CreateActInput) =>
    request<ActManifest>(`/api/v1/series/${seriesId}/books/${bookId}/acts`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateAct: (seriesId: string, actId: string, input: UpdateActInput) =>
    request<ActManifest>(`/api/v1/series/${seriesId}/acts/${actId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  reorderActs: (seriesId: string, bookId: string, input: ReorderInput) =>
    request<ActManifest[]>(`/api/v1/series/${seriesId}/books/${bookId}/acts/reorder`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  listChapters: (seriesId: string, actId: string) =>
    request<ChapterManifest[]>(`/api/v1/series/${seriesId}/acts/${actId}/chapters`),
  createChapter: (seriesId: string, actId: string, input: CreateChapterInput) =>
    request<ChapterManifest>(`/api/v1/series/${seriesId}/acts/${actId}/chapters`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateChapter: (seriesId: string, chapterId: string, input: UpdateChapterInput) =>
    request<ChapterManifest>(`/api/v1/series/${seriesId}/chapters/${chapterId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  reorderChapters: (seriesId: string, actId: string, input: ReorderInput) =>
    request<ChapterManifest[]>(`/api/v1/series/${seriesId}/acts/${actId}/chapters/reorder`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  moveScene: (seriesId: string, sceneId: string, input: MoveSceneInput) =>
    request<SceneDocument>(`/api/v1/series/${seriesId}/scenes/${sceneId}/move`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  reorderScenes: (seriesId: string, chapterId: string, input: ReorderInput) =>
    request<SceneDocument[]>(`/api/v1/series/${seriesId}/chapters/${chapterId}/scenes/reorder`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  migrateSeries: (seriesId: string) =>
    request<{ actsCreated: number; chaptersCreated: number; snapshotPath: string }>(
      `/api/v1/series/${seriesId}/migrate`,
      { method: "POST" },
    ),
};
