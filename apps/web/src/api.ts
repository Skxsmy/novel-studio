import type {
  CreateSceneInput,
  CreateSeriesInput,
  SceneDocument,
  SearchResult,
  SeriesDetail,
  SeriesSummary,
  UpdateSceneInput,
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
  search: (seriesId: string, query: string) =>
    request<SearchResult[]>(`/api/v1/series/${seriesId}/search?q=${encodeURIComponent(query)}`),
};
