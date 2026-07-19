import type {
  CreateResearchDatabaseInput,
  CreateResearchNoteInput,
  AppendResearchNoteEvidenceInput,
  ImportResearchSourceInput,
  ImportResearchWebSourceInput,
  LegacyResearchSourceGroup,
  MigrateResearchSourcesV2Input,
  ResearchDatabaseDocument,
  ResearchDatabaseDeletionBlockers,
  ResearchDatabaseListResult,
  ResearchIndexState,
  ResearchKeywordSearchInput,
  ResearchKeywordSearchResponse,
  ResearchEmbeddingCapabilityDocument,
  ResearchEmbeddingCapabilityState,
  ResearchMultiSearchInput,
  ResearchMultiSearchResponse,
  ResearchQueryExpansionDocument,
  ResearchLegacyMigrationResult,
  ResearchNoteDetail,
  ResearchNoteListQuery,
  ResearchNoteListResult,
  ResearchNoteRevisionInput,
  RemoveResearchNoteEvidenceInput,
  ResearchSourceContentPage,
  ResearchSourceView,
  ResearchSourceDocument,
  ResearchSourceV2MigrationResult,
  ResearchToolAuditCitation,
  ResearchVectorIndexState,
  UpdateResearchQueryExpansionsInput,
  UpdateResearchDatabaseInput,
  UpdateResearchNoteInput,
  UpdateResearchSourceInput,
  ValidateResearchEmbeddingCapabilityInput,
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
    getDatabaseDeletionBlockers(databaseId: string) {
      return client.requestJson<ResearchDatabaseDeletionBlockers>(
        `/research/databases/${databaseId}/deletion-blockers`,
      );
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
    listNotes(databaseId: string, input: ResearchNoteListQuery = {}) {
      const query = new URLSearchParams();
      if (input.status !== undefined) query.set("status", input.status);
      if (input.offset !== undefined) query.set("offset", String(input.offset));
      if (input.limit !== undefined) query.set("limit", String(input.limit));
      const suffix = query.size > 0 ? `?${query}` : "";
      return client.requestJson<ResearchNoteListResult>(`/research/databases/${databaseId}/notes${suffix}`);
    },
    getNote(databaseId: string, noteId: string) {
      return client.requestJson<ResearchNoteDetail>(`/research/databases/${databaseId}/notes/${noteId}`);
    },
    createNote(databaseId: string, input: CreateResearchNoteInput) {
      return client.requestJson<ResearchNoteDetail>(`/research/databases/${databaseId}/notes`, {
        body: input,
        method: "POST",
      });
    },
    updateNote(databaseId: string, noteId: string, input: UpdateResearchNoteInput) {
      return client.requestJson<ResearchNoteDetail>(`/research/databases/${databaseId}/notes/${noteId}`, {
        body: input,
        method: "PUT",
      });
    },
    appendNoteEvidence(databaseId: string, noteId: string, input: AppendResearchNoteEvidenceInput) {
      return client.requestJson<ResearchNoteDetail>(
        `/research/databases/${databaseId}/notes/${noteId}/evidence`,
        { body: input, method: "POST" },
      );
    },
    removeNoteEvidence(
      databaseId: string,
      noteId: string,
      evidenceId: string,
      input: RemoveResearchNoteEvidenceInput,
    ) {
      return client.requestJson<ResearchNoteDetail>(
        `/research/databases/${databaseId}/notes/${noteId}/evidence/${evidenceId}`,
        { body: input, method: "DELETE" },
      );
    },
    archiveNote(databaseId: string, noteId: string, input: ResearchNoteRevisionInput) {
      return client.requestJson<ResearchNoteDetail>(
        `/research/databases/${databaseId}/notes/${noteId}/archive`,
        { body: input, method: "POST" },
      );
    },
    restoreNote(databaseId: string, noteId: string, input: ResearchNoteRevisionInput) {
      return client.requestJson<ResearchNoteDetail>(
        `/research/databases/${databaseId}/notes/${noteId}/restore`,
        { body: input, method: "POST" },
      );
    },
    getQueryExpansions(databaseId: string) {
      return client.requestJson<ResearchQueryExpansionDocument>(
        `/research/databases/${databaseId}/query-expansions`,
      );
    },
    updateQueryExpansions(databaseId: string, input: UpdateResearchQueryExpansionsInput) {
      return client.requestJson<ResearchQueryExpansionDocument>(
        `/research/databases/${databaseId}/query-expansions`,
        { body: input, method: "PUT" },
      );
    },
    getEmbeddingCapability() {
      return client.requestJson<ResearchEmbeddingCapabilityState>("/research/embedding-capability");
    },
    validateEmbeddingCapability(input: ValidateResearchEmbeddingCapabilityInput) {
      return client.requestJson<ResearchEmbeddingCapabilityDocument>(
        "/research/embedding-capability/validate",
        { body: input, method: "POST" },
      );
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
      return client.requestJson<ResearchSourceView>(`/research/databases/${databaseId}/sources/${sourceId}`);
    },
    getSourceContentPage(databaseId: string, sourceId: string, offset: number, limit = 40) {
      const query = new URLSearchParams({ offset: String(offset), limit: String(limit) });
      return client.requestJson<ResearchSourceContentPage>(
        `/research/databases/${databaseId}/sources/${sourceId}/content?${query}`,
      );
    },
    getSourceContentPageForCitation(citation: ResearchToolAuditCitation) {
      const query = new URLSearchParams({
        sourceRevision: citation.sourceRevision,
        chunkId: citation.chunkId,
        chunkHash: citation.chunkHash,
      });
      return client.requestJson<ResearchSourceContentPage>(
        `/research/databases/${citation.researchDatabaseId}/sources/${citation.sourceId}/content/blocks/${citation.blockId}?${query}`,
      );
    },
    importSource(databaseId: string, input: ImportResearchSourceInput) {
      return client.requestJson<ResearchSourceView>(`/research/databases/${databaseId}/sources`, {
        body: input,
        method: "POST",
      });
    },
    importWebSource(databaseId: string, input: ImportResearchWebSourceInput) {
      return client.requestJson<ResearchSourceView>(`/research/databases/${databaseId}/sources/web`, {
        body: input,
        method: "POST",
      });
    },
    updateSource(databaseId: string, sourceId: string, input: UpdateResearchSourceInput) {
      return client.requestJson<ResearchSourceView>(`/research/databases/${databaseId}/sources/${sourceId}`, {
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
    getVectorIndexState(databaseId: string) {
      return client.requestJson<ResearchVectorIndexState>(`/research/databases/${databaseId}/vector-index`);
    },
    rebuildVectorIndex(databaseId: string) {
      return client.requestJson<ResearchVectorIndexState>(
        `/research/databases/${databaseId}/vector-index/rebuild`,
        { method: "POST" },
      );
    },
    search(databaseId: string, input: ResearchKeywordSearchInput) {
      return client.requestJson<ResearchKeywordSearchResponse>(`/research/databases/${databaseId}/search`, {
        body: input,
        method: "POST",
      });
    },
    searchDatabases(input: ResearchMultiSearchInput) {
      return client.requestJson<ResearchMultiSearchResponse>("/research/search", {
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
  CreateResearchNoteInput,
  AppendResearchNoteEvidenceInput,
  ImportResearchSourceInput,
  ImportResearchWebSourceInput,
  LegacyResearchSourceGroup,
  MigrateResearchSourcesV2Input,
  ResearchDatabaseDocument,
  ResearchDatabaseDeletionBlockers,
  ResearchDatabaseListResult,
  ResearchIndexState,
  ResearchKeywordSearchInput,
  ResearchKeywordSearchResponse,
  ResearchEmbeddingCapabilityDocument,
  ResearchEmbeddingCapabilityState,
  ResearchMultiSearchInput,
  ResearchMultiSearchResponse,
  ResearchQueryExpansionDocument,
  ResearchLegacyMigrationResult,
  ResearchNoteDetail,
  ResearchNoteListQuery,
  ResearchNoteListResult,
  ResearchNoteRevisionInput,
  RemoveResearchNoteEvidenceInput,
  ResearchSourceContentPage,
  ResearchSourceView,
  ResearchSourceDocument,
  ResearchSourceV2MigrationResult,
  ResearchToolAuditCitation,
  ResearchVectorIndexState,
  UpdateResearchQueryExpansionsInput,
  UpdateResearchDatabaseInput,
  UpdateResearchNoteInput,
  UpdateResearchSourceInput,
  ValidateResearchEmbeddingCapabilityInput,
};
