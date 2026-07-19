import type {
  CreateResearchDatabaseInput,
  ImportResearchSourceInput,
  ImportResearchWebSourceInput,
  LegacyResearchSourceGroup,
  MigrateResearchSourcesV2Input,
  ResearchDatabaseDocument,
  ResearchDatabaseListResult,
  ResearchIndexState,
  ResearchKeywordSearchInput,
  ResearchKeywordSearchResponse,
  ResearchLegacyMigrationResult,
  ResearchSourceDetail,
  ResearchSourceDocument,
  ResearchSourceV2MigrationResult,
  UpdateResearchDatabaseInput,
  UpdateResearchSourceInput,
} from "@novel-studio/contracts";
import type { ApiClient } from "./client";

export function createResearchApi(client: ApiClient) {
  return {
    listDatabases() {
      return client.requestJson<ResearchDatabaseListResult>("/research/databases");
    },
    getDatabase(databaseId: string) {
      return client.requestJson<ResearchDatabaseDocument>(`/research/databases/${databaseId}`);
    },
    createDatabase(input: CreateResearchDatabaseInput) {
      return client.requestJson<ResearchDatabaseDocument>("/research/databases", {
        body: input,
        method: "POST",
      });
    },
    updateDatabase(databaseId: string, input: UpdateResearchDatabaseInput) {
      return client.requestJson<ResearchDatabaseDocument>(`/research/databases/${databaseId}`, {
        body: input,
        method: "PUT",
      });
    },
    listLegacySources() {
      return client.requestJson<LegacyResearchSourceGroup[]>("/research/legacy-sources");
    },
    migrateLegacySources(databaseId: string, seriesId: string) {
      return client.requestJson<ResearchLegacyMigrationResult>(
        `/research/databases/${databaseId}/migrations/series/${seriesId}`,
        { method: "POST" },
      );
    },
    listSources(databaseId: string) {
      return client.requestJson<ResearchSourceDocument[]>(`/research/databases/${databaseId}/sources`);
    },
    getSource(databaseId: string, sourceId: string) {
      return client.requestJson<ResearchSourceDetail>(`/research/databases/${databaseId}/sources/${sourceId}`);
    },
    importSource(databaseId: string, input: ImportResearchSourceInput) {
      return client.requestJson<ResearchSourceDetail>(`/research/databases/${databaseId}/sources`, {
        body: input,
        method: "POST",
      });
    },
    importWebSource(databaseId: string, input: ImportResearchWebSourceInput) {
      return client.requestJson<ResearchSourceDetail>(`/research/databases/${databaseId}/sources/web`, {
        body: input,
        method: "POST",
      });
    },
    updateSource(databaseId: string, sourceId: string, input: UpdateResearchSourceInput) {
      return client.requestJson<ResearchSourceDetail>(`/research/databases/${databaseId}/sources/${sourceId}`, {
        body: input,
        method: "PUT",
      });
    },
    getIndexState(databaseId: string) {
      return client.requestJson<ResearchIndexState>(`/research/databases/${databaseId}/index`);
    },
    rebuildIndex(databaseId: string) {
      return client.requestJson<ResearchIndexState>(`/research/databases/${databaseId}/index/rebuild`, {
        method: "POST",
      });
    },
    search(databaseId: string, input: ResearchKeywordSearchInput) {
      return client.requestJson<ResearchKeywordSearchResponse>(`/research/databases/${databaseId}/search`, {
        body: input,
        method: "POST",
      });
    },
    migrateSourcesV2(databaseId: string, input: MigrateResearchSourcesV2Input) {
      return client.requestJson<ResearchSourceV2MigrationResult>(
        `/research/databases/${databaseId}/migrations/source-v3`,
        { body: input, method: "POST" },
      );
    },
  };
}

export type {
  CreateResearchDatabaseInput,
  ImportResearchSourceInput,
  ImportResearchWebSourceInput,
  LegacyResearchSourceGroup,
  MigrateResearchSourcesV2Input,
  ResearchDatabaseDocument,
  ResearchDatabaseListResult,
  ResearchIndexState,
  ResearchKeywordSearchInput,
  ResearchKeywordSearchResponse,
  ResearchLegacyMigrationResult,
  ResearchSourceDetail,
  ResearchSourceDocument,
  ResearchSourceV2MigrationResult,
  UpdateResearchDatabaseInput,
  UpdateResearchSourceInput,
};
