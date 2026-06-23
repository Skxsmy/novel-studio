import type { ApiClient } from "./client";
import type {
  CodexCategoryDocument,
  CodexCategoryId,
  CodexEntryDocument,
  CreateCodexEntryInput,
} from "@novel-studio/contracts";

export function createCodexApi(client: ApiClient) {
  return {
    listCategories(seriesId: string) {
      return client.requestJson<CodexCategoryDocument[]>(`/series/${seriesId}/codex/categories`);
    },
    listEntries(seriesId: string, options: { categoryId?: CodexCategoryId } = {}) {
      const query = options.categoryId ? `?categoryId=${encodeURIComponent(options.categoryId)}` : "";
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
  };
}

export type {
  CodexCategoryDocument,
  CodexCategoryId,
  CodexEntryDocument,
  CreateCodexEntryInput,
};
