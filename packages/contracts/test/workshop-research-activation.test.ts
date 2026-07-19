import { describe, expect, it } from "vitest";
import {
  RollbackWorkshopSessionV3MigrationResultSchema,
  UpdateWorkshopSessionInputSchema,
  WorkshopResearchEvidenceSchema,
  WorkshopSessionListResultSchema,
  WorkshopSessionSchema,
  WorkshopSessionV3MigrationBackupSchema,
  WorkshopSessionV3Schema,
} from "../src/index.js";

const SERIES_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const DATABASE_ID = "33333333-3333-4333-8333-333333333333";
const SOURCE_ID = "44444444-4444-4444-8444-444444444444";
const CHUNK_ID = "55555555-5555-4555-8555-555555555555";
const BLOCK_ID = "66666666-6666-4666-8666-666666666666";
const MESSAGE_ID = "77777777-7777-4777-8777-777777777777";
const MODEL_CALL_ID = "88888888-8888-4888-8888-888888888888";
const MIGRATION_ID = "99999999-9999-4999-8999-999999999999";
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function baseSession(schemaVersion: 1 | 2 | 3) {
  return {
    schemaVersion,
    id: SESSION_ID,
    seriesId: SERIES_ID,
    kind: "chat" as const,
    title: "Research session",
    status: "active" as const,
    branchOfMessageId: null,
    createdAt: "2026-07-19T00:00:00.000Z",
    updatedAt: "2026-07-19T00:00:00.000Z",
    archivedAt: null,
    lastMessageAt: null,
  };
}

function citation() {
  return {
    researchDatabaseId: DATABASE_ID,
    researchDatabaseName: "Reference library",
    sourceId: SOURCE_ID,
    sourceRevision: HASH_A,
    sourceDisplayName: "Japanese notes",
    sourceKind: "txt" as const,
    chunkId: CHUNK_ID,
    blockId: BLOCK_ID,
    chunkHash: HASH_B,
    languageTag: "ja",
    location: {
      kind: "text" as const,
      startLine: 4,
      endLine: 5,
      startOffset: 10,
      endOffset: 120,
    },
    relationship: "target" as const,
    matchChannels: ["semantic" as const],
    fusedScore: 0.82,
  };
}

describe("Workshop Research activation contracts", () => {
  it("projects version 1 and version 2 sessions to version 3 with no silent activation", () => {
    const version1 = WorkshopSessionSchema.parse(baseSession(1));
    const version2 = WorkshopSessionSchema.parse({
      ...baseSession(2),
      generalChatSystemPrompt: "Visible prompt",
    });

    expect(version1).toMatchObject({ schemaVersion: 3, activeResearchDatabaseIds: [] });
    expect(version2).toMatchObject({
      schemaVersion: 3,
      activeResearchDatabaseIds: [],
      generalChatSystemPrompt: "Visible prompt",
    });
  });

  it("accepts zero to twelve unique database IDs and rejects duplicates", () => {
    expect(WorkshopSessionV3Schema.parse({
      ...baseSession(3),
      generalChatSystemPrompt: "Visible prompt",
      activeResearchDatabaseIds: [],
    }).activeResearchDatabaseIds).toEqual([]);

    expect(UpdateWorkshopSessionInputSchema.parse({
      activeResearchDatabaseIds: [DATABASE_ID],
    }).activeResearchDatabaseIds).toEqual([DATABASE_ID]);
    expect(UpdateWorkshopSessionInputSchema.safeParse({
      activeResearchDatabaseIds: [DATABASE_ID, DATABASE_ID],
    }).success).toBe(false);
    expect(UpdateWorkshopSessionInputSchema.safeParse({
      activeResearchDatabaseIds: Array.from({ length: 13 }, (_, index) =>
        `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`),
    }).success).toBe(false);
  });

  it("validates exact migration and rollback result records", () => {
    const raw = JSON.stringify({ ...baseSession(2), generalChatSystemPrompt: "Visible prompt" });
    const backup = WorkshopSessionV3MigrationBackupSchema.parse({
      schemaVersion: 1,
      migrationId: MIGRATION_ID,
      seriesId: SERIES_ID,
      createdAt: "2026-07-19T00:00:00.000Z",
      documents: [{
        id: SESSION_ID,
        sourceSchemaVersion: 2,
        relativePath: `workshop/sessions/${SESSION_ID}.json`,
        raw,
        revision: HASH_A,
        migratedRevision: HASH_B,
      }],
    });
    expect(backup.documents[0]?.raw).toBe(raw);
    expect(RollbackWorkshopSessionV3MigrationResultSchema.parse({
      migrationId: MIGRATION_ID,
      restoredSessionIds: [SESSION_ID],
    }).restoredSessionIds).toEqual([SESSION_ID]);
  });

  it("persists citation identity without copied passage text", () => {
    const evidence = WorkshopResearchEvidenceSchema.parse({
      schemaVersion: 1,
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      seriesId: SERIES_ID,
      sessionId: SESSION_ID,
      assistantMessageId: MESSAGE_ID,
      modelCallId: MODEL_CALL_ID,
      citations: [citation()],
      createdAt: "2026-07-19T00:00:00.000Z",
    });

    expect(evidence.citations[0]).not.toHaveProperty("originalText");
    expect(WorkshopResearchEvidenceSchema.safeParse({
      ...evidence,
      citations: [citation(), citation()],
    }).success).toBe(false);
  });

  it("returns valid sessions beside bounded damaged-record diagnostics", () => {
    const result = WorkshopSessionListResultSchema.parse({
      sessions: [{
        ...baseSession(3),
        generalChatSystemPrompt: "Visible prompt",
        activeResearchDatabaseIds: [DATABASE_ID],
      }],
      diagnostics: [{
        fileName: "damaged.json",
        code: "INVALID_DATA",
        message: "Workshop session file is damaged",
      }],
    });
    expect(result.sessions).toHaveLength(1);
    expect(result.diagnostics[0]?.fileName).toBe("damaged.json");
  });
});
