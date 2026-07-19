import type {
  ImportResearchSourceInput,
  ResearchSourceDetail,
  ResearchSourceDocument,
  UpdateResearchSourceInput,
} from "@novel-studio/contracts";
import type { ApiClient } from "./client";

export function createResearchApi(client: ApiClient) {
  return {
    listSources(seriesId: string) {
      return client.requestJson<ResearchSourceDocument[]>(`/series/${seriesId}/research/sources`);
    },
    getSource(seriesId: string, sourceId: string) {
      return client.requestJson<ResearchSourceDetail>(`/series/${seriesId}/research/sources/${sourceId}`);
    },
    importSource(seriesId: string, input: ImportResearchSourceInput) {
      return client.requestJson<ResearchSourceDetail>(`/series/${seriesId}/research/sources`, {
        body: input,
        method: "POST",
      });
    },
    updateSource(seriesId: string, sourceId: string, input: UpdateResearchSourceInput) {
      return client.requestJson<ResearchSourceDetail>(`/series/${seriesId}/research/sources/${sourceId}`, {
        body: input,
        method: "PUT",
      });
    },
  };
}

export type {
  ImportResearchSourceInput,
  ResearchSourceDetail,
  ResearchSourceDocument,
  UpdateResearchSourceInput,
};
