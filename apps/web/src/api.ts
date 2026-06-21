import type {
  ActManifest,
  ArchiveCodexDocumentInput,
  BookManifest,
  ChapterManifest,
  ArchiveSceneSectionInput,
  CreateActInput,
  CreateBookInput,
  CodexCategoryDocument,
  CodexCategoryId,
  CodexContextPreview,
  CodexEffectiveState,
  CodexEntryDocument,
  CodexKnowledgeDocument,
  CodexMention,
  CodexProgressionDocument,
  CodexRelationDocument,
  CodexSearchResult,
  ContextBundle,
  ContextPreviewInput,
  CreateCodexCategoryInput,
  CreateCodexEntryInput,
  CreateCodexKnowledgeInput,
  CreateCodexProgressionInput,
  CreateCodexRelationInput,
  CreateChapterInput,
  CreateModelProfileInput,
  CreateReviewAnchorInput,
  CreateSceneInput,
  CreateSceneSectionInput,
  CreateSeriesInput,
  CreateTimelineEventInput,
  MoveSceneInput,
  ModelProfile,
  HierarchyValidationResult,
  PlanningBoard,
  ProviderConnectionResult,
  ProviderModelDescriptor,
  ReorderInput,
  RestoreSceneSectionInput,
  SceneCodexMentions,
  SceneDocument,
  SceneSectionDocument,
  SectionContextTarget,
  ResolvedReviewAnchor,
  SearchResult,
  SeriesDetail,
  SeriesSummary,
  TimelineEventDocument,
  UpdateActInput,
  UpdateCodexCategoryInput,
  UpdateCodexEntryInput,
  UpdateCodexKnowledgeInput,
  UpdateCodexProgressionInput,
  UpdateCodexRelationInput,
  UpdateChapterInput,
  UpdateModelProfileInput,
  UpdateSceneInput,
  UpdateSceneSectionInput,
  UpdateScenePlanningInput,
  UpdateSeriesCloudPolicyInput,
  UpdateTimelineEventInput,
  SeriesManifest,
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
  updateSeriesCloudPolicy: (seriesId: string, input: UpdateSeriesCloudPolicyInput) =>
    request<SeriesManifest>(`/api/v1/series/${seriesId}/ai/cloud-policy`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  listModelProfiles: (seriesId: string) =>
    request<ModelProfile[]>(`/api/v1/series/${seriesId}/ai/model-profiles`),
  createModelProfile: (seriesId: string, input: CreateModelProfileInput) =>
    request<ModelProfile>(`/api/v1/series/${seriesId}/ai/model-profiles`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateModelProfile: (
    seriesId: string,
    modelProfileId: string,
    input: UpdateModelProfileInput,
  ) =>
    request<ModelProfile>(
      `/api/v1/series/${seriesId}/ai/model-profiles/${modelProfileId}`,
      { method: "PUT", body: JSON.stringify(input) },
    ),
  testModelProfile: (seriesId: string, modelProfileId: string) =>
    request<ProviderConnectionResult>(
      `/api/v1/series/${seriesId}/ai/model-profiles/${modelProfileId}/test`,
      { method: "POST" },
    ),
  listProviderModels: (seriesId: string, modelProfileId: string) =>
    request<ProviderModelDescriptor[]>(
      `/api/v1/series/${seriesId}/ai/model-profiles/${modelProfileId}/models`,
    ),
  previewContext: (seriesId: string, input: ContextPreviewInput) =>
    request<ContextBundle>(`/api/v1/series/${seriesId}/context/preview`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getContextBundle: (seriesId: string, contextBundleId: string) =>
    request<ContextBundle>(`/api/v1/series/${seriesId}/context/${contextBundleId}`),
  createBook: (seriesId: string, input: CreateBookInput) =>
    request<BookManifest>(`/api/v1/series/${seriesId}/books`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getScene: (seriesId: string, sceneId: string) =>
    request<SceneDocument>(`/api/v1/series/${seriesId}/scenes/${sceneId}`),
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
  listSceneSections: (seriesId: string, sceneId: string) =>
    request<SceneSectionDocument[]>(`/api/v1/series/${seriesId}/scenes/${sceneId}/sections`),
  createSceneSection: (seriesId: string, sceneId: string, input: CreateSceneSectionInput) =>
    request<SceneSectionDocument>(`/api/v1/series/${seriesId}/scenes/${sceneId}/sections`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateSceneSection: (seriesId: string, sectionId: string, input: UpdateSceneSectionInput) =>
    request<SceneSectionDocument>(`/api/v1/series/${seriesId}/sections/${sectionId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  archiveSceneSection: (seriesId: string, sectionId: string, input: ArchiveSceneSectionInput) =>
    request<SceneSectionDocument>(`/api/v1/series/${seriesId}/sections/${sectionId}/archive`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  restoreSceneSection: (seriesId: string, sectionId: string, input: RestoreSceneSectionInput) =>
    request<SceneSectionDocument>(`/api/v1/series/${seriesId}/sections/${sectionId}/restore`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  listSceneSectionsForContext: (
    seriesId: string,
    sceneId: string,
    target: SectionContextTarget,
  ) => request<SceneSectionDocument[]>(
    `/api/v1/series/${seriesId}/scenes/${sceneId}/sections/context?target=${target}`,
  ),
  listReviewAnchors: (seriesId: string, sceneId: string) =>
    request<ResolvedReviewAnchor[]>(`/api/v1/series/${seriesId}/scenes/${sceneId}/anchors`),
  createReviewAnchor: (seriesId: string, sceneId: string, input: CreateReviewAnchorInput) =>
    request<ResolvedReviewAnchor>(`/api/v1/series/${seriesId}/scenes/${sceneId}/anchors`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  listCodexCategories: (seriesId: string, includeArchived = false) =>
    request<CodexCategoryDocument[]>(
      `/api/v1/series/${seriesId}/codex/categories?includeArchived=${includeArchived}`,
    ),
  createCodexCategory: (seriesId: string, input: CreateCodexCategoryInput) =>
    request<CodexCategoryDocument>(`/api/v1/series/${seriesId}/codex/categories`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateCodexCategory: (
    seriesId: string,
    categoryId: string,
    input: UpdateCodexCategoryInput,
  ) =>
    request<CodexCategoryDocument>(
      `/api/v1/series/${seriesId}/codex/categories/${categoryId}`,
      { method: "PUT", body: JSON.stringify(input) },
    ),
  archiveCodexCategory: (
    seriesId: string,
    categoryId: string,
    input: ArchiveCodexDocumentInput,
  ) =>
    request<CodexCategoryDocument>(
      `/api/v1/series/${seriesId}/codex/categories/${categoryId}/archive`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  restoreCodexCategory: (
    seriesId: string,
    categoryId: string,
    input: ArchiveCodexDocumentInput,
  ) =>
    request<CodexCategoryDocument>(
      `/api/v1/series/${seriesId}/codex/categories/${categoryId}/restore`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  listCodexEntries: (
    seriesId: string,
    options: { categoryId?: CodexCategoryId; includeArchived?: boolean } = {},
  ) => {
    const query = new URLSearchParams();
    if (options.categoryId) query.set("categoryId", options.categoryId);
    if (options.includeArchived) query.set("includeArchived", "true");
    const suffix = query.size ? `?${query}` : "";
    return request<CodexEntryDocument[]>(
      `/api/v1/series/${seriesId}/codex/entries${suffix}`,
    );
  },
  createCodexEntry: (seriesId: string, input: CreateCodexEntryInput) =>
    request<CodexEntryDocument>(`/api/v1/series/${seriesId}/codex/entries`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getCodexEntry: (seriesId: string, entryId: string) =>
    request<CodexEntryDocument>(
      `/api/v1/series/${seriesId}/codex/entries/${entryId}`,
    ),
  updateCodexEntry: (
    seriesId: string,
    entryId: string,
    input: UpdateCodexEntryInput,
  ) =>
    request<CodexEntryDocument>(
      `/api/v1/series/${seriesId}/codex/entries/${entryId}`,
      { method: "PUT", body: JSON.stringify(input) },
    ),
  archiveCodexEntry: (
    seriesId: string,
    entryId: string,
    input: ArchiveCodexDocumentInput,
  ) =>
    request<CodexEntryDocument>(
      `/api/v1/series/${seriesId}/codex/entries/${entryId}/archive`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  restoreCodexEntry: (
    seriesId: string,
    entryId: string,
    input: ArchiveCodexDocumentInput,
  ) =>
    request<CodexEntryDocument>(
      `/api/v1/series/${seriesId}/codex/entries/${entryId}/restore`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  listCodexMentionsForEntry: (seriesId: string, entryId: string) =>
    request<CodexMention[]>(
      `/api/v1/series/${seriesId}/codex/entries/${entryId}/mentions`,
    ),
  listCodexMentionsForScene: (seriesId: string, sceneId: string) =>
    request<SceneCodexMentions>(
      `/api/v1/series/${seriesId}/codex/scenes/${sceneId}/mentions`,
    ),
  listCodexRelations: (
    seriesId: string,
    options: { entryId?: string; includeArchived?: boolean } = {},
  ) => {
    const query = new URLSearchParams();
    if (options.entryId) query.set("entryId", options.entryId);
    if (options.includeArchived) query.set("includeArchived", "true");
    const suffix = query.size ? `?${query}` : "";
    return request<CodexRelationDocument[]>(
      `/api/v1/series/${seriesId}/codex/relations${suffix}`,
    );
  },
  createCodexRelation: (seriesId: string, input: CreateCodexRelationInput) =>
    request<CodexRelationDocument>(`/api/v1/series/${seriesId}/codex/relations`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateCodexRelation: (
    seriesId: string,
    relationId: string,
    input: UpdateCodexRelationInput,
  ) =>
    request<CodexRelationDocument>(
      `/api/v1/series/${seriesId}/codex/relations/${relationId}`,
      { method: "PUT", body: JSON.stringify(input) },
    ),
  archiveCodexRelation: (
    seriesId: string,
    relationId: string,
    input: ArchiveCodexDocumentInput,
  ) =>
    request<CodexRelationDocument>(
      `/api/v1/series/${seriesId}/codex/relations/${relationId}/archive`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  restoreCodexRelation: (
    seriesId: string,
    relationId: string,
    input: ArchiveCodexDocumentInput,
  ) =>
    request<CodexRelationDocument>(
      `/api/v1/series/${seriesId}/codex/relations/${relationId}/restore`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  listCodexProgressions: (
    seriesId: string,
    options: { entryId?: string; relationId?: string; includeArchived?: boolean } = {},
  ) => {
    const query = new URLSearchParams();
    if (options.entryId) query.set("entryId", options.entryId);
    if (options.relationId) query.set("relationId", options.relationId);
    if (options.includeArchived) query.set("includeArchived", "true");
    const suffix = query.size ? `?${query}` : "";
    return request<CodexProgressionDocument[]>(
      `/api/v1/series/${seriesId}/codex/progressions${suffix}`,
    );
  },
  createCodexProgression: (seriesId: string, input: CreateCodexProgressionInput) =>
    request<CodexProgressionDocument>(`/api/v1/series/${seriesId}/codex/progressions`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateCodexProgression: (
    seriesId: string,
    progressionId: string,
    input: UpdateCodexProgressionInput,
  ) =>
    request<CodexProgressionDocument>(
      `/api/v1/series/${seriesId}/codex/progressions/${progressionId}`,
      { method: "PUT", body: JSON.stringify(input) },
    ),
  archiveCodexProgression: (
    seriesId: string,
    progressionId: string,
    input: ArchiveCodexDocumentInput,
  ) =>
    request<CodexProgressionDocument>(
      `/api/v1/series/${seriesId}/codex/progressions/${progressionId}/archive`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  restoreCodexProgression: (
    seriesId: string,
    progressionId: string,
    input: ArchiveCodexDocumentInput,
  ) =>
    request<CodexProgressionDocument>(
      `/api/v1/series/${seriesId}/codex/progressions/${progressionId}/restore`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  listCodexKnowledge: (
    seriesId: string,
    options: {
      characterEntryId?: string;
      subjectEntryId?: string;
      relationId?: string;
      includeArchived?: boolean;
    } = {},
  ) => {
    const query = new URLSearchParams();
    if (options.characterEntryId) query.set("characterEntryId", options.characterEntryId);
    if (options.subjectEntryId) query.set("subjectEntryId", options.subjectEntryId);
    if (options.relationId) query.set("relationId", options.relationId);
    if (options.includeArchived) query.set("includeArchived", "true");
    const suffix = query.size ? `?${query}` : "";
    return request<CodexKnowledgeDocument[]>(
      `/api/v1/series/${seriesId}/codex/knowledge${suffix}`,
    );
  },
  createCodexKnowledge: (seriesId: string, input: CreateCodexKnowledgeInput) =>
    request<CodexKnowledgeDocument>(`/api/v1/series/${seriesId}/codex/knowledge`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateCodexKnowledge: (
    seriesId: string,
    knowledgeId: string,
    input: UpdateCodexKnowledgeInput,
  ) =>
    request<CodexKnowledgeDocument>(
      `/api/v1/series/${seriesId}/codex/knowledge/${knowledgeId}`,
      { method: "PUT", body: JSON.stringify(input) },
    ),
  archiveCodexKnowledge: (
    seriesId: string,
    knowledgeId: string,
    input: ArchiveCodexDocumentInput,
  ) =>
    request<CodexKnowledgeDocument>(
      `/api/v1/series/${seriesId}/codex/knowledge/${knowledgeId}/archive`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  restoreCodexKnowledge: (
    seriesId: string,
    knowledgeId: string,
    input: ArchiveCodexDocumentInput,
  ) =>
    request<CodexKnowledgeDocument>(
      `/api/v1/series/${seriesId}/codex/knowledge/${knowledgeId}/restore`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  getCodexEffectiveState: (
    seriesId: string,
    sceneId: string,
    entryId: string,
    viewerEntryId?: string,
  ) => {
    const query = new URLSearchParams({ sceneId, entryId });
    if (viewerEntryId) query.set("viewerEntryId", viewerEntryId);
    return request<CodexEffectiveState>(
      `/api/v1/series/${seriesId}/codex/effective?${query}`,
    );
  },
  previewCodexContext: (seriesId: string, sceneId: string, pinnedIds: string[] = []) => {
    const query = new URLSearchParams({ sceneId });
    if (pinnedIds.length) query.set("pinnedIds", pinnedIds.join(","));
    return request<CodexContextPreview>(
      `/api/v1/series/${seriesId}/codex/context?${query}`,
    );
  },
  searchCodex: (seriesId: string, query: string) =>
    request<CodexSearchResult[]>(
      `/api/v1/series/${seriesId}/codex/search?q=${encodeURIComponent(query)}`,
    ),
  rebuildIndex: (seriesId: string) =>
    request<{
      indexedScenes: number;
      indexedCodexEntries: number;
      indexedMentions: number;
      ambiguousMentions: number;
    }>(`/api/v1/series/${seriesId}/index/rebuild`, { method: "POST" }),
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
