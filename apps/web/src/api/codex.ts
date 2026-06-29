import type { ApiClient } from "./client";
import type {
  CodexCategoryDocument,
  CodexCategoryId,
  CodexContextPreview,
  CodexDetailTypeDocument,
  CodexEffectiveEntry,
  CodexEntryDocument,
  CodexMention,
  CodexProgressionDocument,
  CodexRelationDocument,
  CreateCodexCategoryInput,
  CreateCodexDetailTypeInput,
  CreateCodexEntryInput,
  CreateCodexProgressionInput,
  CreateCodexRelationInput,
  ArchiveCodexDocumentInput,
  DeleteCodexCategoryResult,
  DeleteCodexDocumentInput,
  DeleteCodexDetailTypeResult,
  DeleteCodexEntryResult,
  DeleteCodexProgressionResult,
  SceneCodexMentions,
  UpdateCodexCategoryInput,
  UpdateCodexDetailTypeInput,
  UpdateCodexEntryInput,
  UpdateCodexProgressionInput,
} from "@novel-studio/contracts";

export function createCodexApi(client: ApiClient) {
  return {
    listCategories(seriesId: string, options: { includeArchived?: boolean } = {}) {
      const params = new URLSearchParams();
      if (options.includeArchived) params.set("includeArchived", "true");
      const query = params.size ? `?${params.toString()}` : "";
      return client.requestJson<CodexCategoryDocument[]>(`/series/${seriesId}/codex/categories${query}`);
    },
    createCategory(seriesId: string, input: CreateCodexCategoryInput) {
      return client.requestJson<CodexCategoryDocument>(`/series/${seriesId}/codex/categories`, {
        body: input,
        method: "POST",
      });
    },
    updateCategory(seriesId: string, categoryId: string, input: UpdateCodexCategoryInput) {
      return client.requestJson<CodexCategoryDocument>(`/series/${seriesId}/codex/categories/${categoryId}`, {
        body: input,
        method: "PUT",
      });
    },
    deleteCategory(seriesId: string, categoryId: string, input: DeleteCodexDocumentInput) {
      return client.requestJson<DeleteCodexCategoryResult>(`/series/${seriesId}/codex/categories/${categoryId}`, {
        body: input,
        method: "DELETE",
      });
    },
    listDetailTypes(seriesId: string, options: { categoryId?: CodexCategoryId } = {}) {
      const params = new URLSearchParams();
      if (options.categoryId) params.set("categoryId", options.categoryId);
      const query = params.size ? `?${params.toString()}` : "";
      return client.requestJson<CodexDetailTypeDocument[]>(`/series/${seriesId}/codex/detail-types${query}`);
    },
    createDetailType(seriesId: string, input: CreateCodexDetailTypeInput) {
      return client.requestJson<CodexDetailTypeDocument>(`/series/${seriesId}/codex/detail-types`, {
        body: input,
        method: "POST",
      });
    },
    updateDetailType(seriesId: string, detailTypeId: string, input: UpdateCodexDetailTypeInput) {
      return client.requestJson<CodexDetailTypeDocument>(`/series/${seriesId}/codex/detail-types/${detailTypeId}`, {
        body: input,
        method: "PUT",
      });
    },
    deleteDetailType(seriesId: string, detailTypeId: string, input: DeleteCodexDocumentInput) {
      return client.requestJson<DeleteCodexDetailTypeResult>(`/series/${seriesId}/codex/detail-types/${detailTypeId}`, {
        body: input,
        method: "DELETE",
      });
    },
    listEntries(seriesId: string, options: { categoryId?: CodexCategoryId; includeArchived?: boolean } = {}) {
      const params = new URLSearchParams();
      if (options.categoryId) params.set("categoryId", options.categoryId);
      if (options.includeArchived) params.set("includeArchived", "true");
      const query = params.size ? `?${params.toString()}` : "";
      return client.requestJson<CodexEntryDocument[]>(`/series/${seriesId}/codex/entries${query}`);
    },
    createEntry(seriesId: string, input: CreateCodexEntryInput) {
      return client.requestJson<CodexEntryDocument>(`/series/${seriesId}/codex/entries`, {
        body: input,
        method: "POST",
      });
    },
    getEntry(seriesId: string, entryId: string) {
      return client.requestJson<CodexEntryDocument>(`/series/${seriesId}/codex/entries/${entryId}`);
    },
    getEffectiveEntry(
      seriesId: string,
      entryId: string,
      options: { sceneId: string; blockId?: string },
    ) {
      const params = new URLSearchParams({ sceneId: options.sceneId });
      if (options.blockId) params.set("blockId", options.blockId);
      return client.requestJson<CodexEffectiveEntry>(
        `/series/${seriesId}/codex/entries/${entryId}/effective?${params.toString()}`,
      );
    },
    updateEntry(seriesId: string, entryId: string, input: UpdateCodexEntryInput) {
      return client.requestJson<CodexEntryDocument>(`/series/${seriesId}/codex/entries/${entryId}`, {
        body: input,
        method: "PUT",
      });
    },
    archiveEntry(seriesId: string, entryId: string, input: ArchiveCodexDocumentInput) {
      return client.requestJson<CodexEntryDocument>(`/series/${seriesId}/codex/entries/${entryId}/archive`, {
        body: input,
        method: "POST",
      });
    },
    restoreEntry(seriesId: string, entryId: string, input: ArchiveCodexDocumentInput) {
      return client.requestJson<CodexEntryDocument>(`/series/${seriesId}/codex/entries/${entryId}/restore`, {
        body: input,
        method: "POST",
      });
    },
    deleteEntry(seriesId: string, entryId: string, input: DeleteCodexDocumentInput) {
      return client.requestJson<DeleteCodexEntryResult>(`/series/${seriesId}/codex/entries/${entryId}`, {
        body: input,
        method: "DELETE",
      });
    },
    listEntryMentions(seriesId: string, entryId: string) {
      return client.requestJson<CodexMention[]>(`/series/${seriesId}/codex/entries/${entryId}/mentions`);
    },
    listSceneMentions(seriesId: string, sceneId: string) {
      return client.requestJson<SceneCodexMentions>(`/series/${seriesId}/codex/scenes/${sceneId}/mentions`);
    },
    listRelations(seriesId: string, options: { entryId?: string; includeArchived?: boolean } = {}) {
      const params = new URLSearchParams();
      if (options.entryId) params.set("entryId", options.entryId);
      if (options.includeArchived) params.set("includeArchived", "true");
      const query = params.size ? `?${params.toString()}` : "";
      return client.requestJson<CodexRelationDocument[]>(`/series/${seriesId}/codex/relations${query}`);
    },
    createRelation(seriesId: string, input: CreateCodexRelationInput) {
      return client.requestJson<CodexRelationDocument>(`/series/${seriesId}/codex/relations`, {
        body: input,
        method: "POST",
      });
    },
    archiveRelation(seriesId: string, relationId: string, input: ArchiveCodexDocumentInput) {
      return client.requestJson<CodexRelationDocument>(`/series/${seriesId}/codex/relations/${relationId}/archive`, {
        body: input,
        method: "POST",
      });
    },
    listProgressions(
      seriesId: string,
      options: {
        kind?: "field" | "world" | "relationship";
        entryId?: string;
        relationId?: string;
        includeArchived?: boolean;
      } = {},
    ) {
      const params = new URLSearchParams();
      if (options.kind) params.set("kind", options.kind);
      if (options.entryId) params.set("entryId", options.entryId);
      if (options.relationId) params.set("relationId", options.relationId);
      if (options.includeArchived) params.set("includeArchived", "true");
      const query = params.size ? `?${params.toString()}` : "";
      return client.requestJson<CodexProgressionDocument[]>(`/series/${seriesId}/codex/progressions${query}`);
    },
    createProgression(seriesId: string, input: CreateCodexProgressionInput) {
      return client.requestJson<CodexProgressionDocument>(`/series/${seriesId}/codex/progressions`, {
        body: input,
        method: "POST",
      });
    },
    getProgression(seriesId: string, progressionId: string) {
      return client.requestJson<CodexProgressionDocument>(`/series/${seriesId}/codex/progressions/${progressionId}`);
    },
    updateProgression(seriesId: string, progressionId: string, input: UpdateCodexProgressionInput) {
      return client.requestJson<CodexProgressionDocument>(`/series/${seriesId}/codex/progressions/${progressionId}`, {
        body: input,
        method: "PUT",
      });
    },
    deleteProgression(seriesId: string, progressionId: string, input: DeleteCodexDocumentInput) {
      return client.requestJson<DeleteCodexProgressionResult>(`/series/${seriesId}/codex/progressions/${progressionId}`, {
        body: input,
        method: "DELETE",
      });
    },
    archiveProgression(seriesId: string, progressionId: string, input: ArchiveCodexDocumentInput) {
      return client.requestJson<CodexProgressionDocument>(`/series/${seriesId}/codex/progressions/${progressionId}/archive`, {
        body: input,
        method: "POST",
      });
    },
    restoreProgression(seriesId: string, progressionId: string, input: ArchiveCodexDocumentInput) {
      return client.requestJson<CodexProgressionDocument>(`/series/${seriesId}/codex/progressions/${progressionId}/restore`, {
        body: input,
        method: "POST",
      });
    },
    previewContext(
      seriesId: string,
      sceneId: string,
      pinnedIds: string[] = [],
      options: { blockId?: string } = {},
    ) {
      const params = new URLSearchParams({ sceneId });
      if (pinnedIds.length) params.set("pinnedIds", pinnedIds.join(","));
      if (options.blockId) params.set("blockId", options.blockId);
      return client.requestJson<CodexContextPreview>(`/series/${seriesId}/codex/context?${params.toString()}`);
    },
  };
}

export type {
  ArchiveCodexDocumentInput,
  CodexCategoryDocument,
  CodexCategoryId,
  CodexContextPreview,
  CodexDetailTypeDocument,
  CodexEffectiveEntry,
  CodexEntryDocument,
  CodexMention,
  CodexProgressionDocument,
  CodexRelationDocument,
  CreateCodexCategoryInput,
  CreateCodexDetailTypeInput,
  CreateCodexEntryInput,
  CreateCodexProgressionInput,
  CreateCodexRelationInput,
  DeleteCodexCategoryResult,
  DeleteCodexDocumentInput,
  DeleteCodexDetailTypeResult,
  DeleteCodexEntryResult,
  DeleteCodexProgressionResult,
  SceneCodexMentions,
  UpdateCodexCategoryInput,
  UpdateCodexDetailTypeInput,
  UpdateCodexEntryInput,
  UpdateCodexProgressionInput,
};
