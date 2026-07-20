import { describe, expect, it } from "vitest";
import {
  DeleteResearchDatabaseInputSchema,
  DeleteResearchSourceInputSchema,
  ReplaceResearchSourceInputSchema,
  ResearchDatabaseDeletionBlockersSchema,
  ResearchDatabaseSchema,
  ResearchLifecycleListQuerySchema,
  ResearchSourceDeletionBlockersSchema,
  ResearchSourceSchema,
} from "../src/research.js";
import {
  ResearchNoteEvidenceFreshnessSchema,
  ResearchNoteFreshnessCountsSchema,
} from "../src/researchNotes.js";

const databaseId = "11111111-1111-4111-8111-111111111111";
const sourceId = "22222222-2222-4222-8222-222222222222";
const noteId = "33333333-3333-4333-8333-333333333333";
const now = "2026-07-20T00:00:00.000Z";
const revision = "a".repeat(64);

describe("NS-610 Research lifecycle contracts", () => {
  it("compatibility-reads database version 1 and validates version 2 lifecycle", () => {
    expect(ResearchDatabaseSchema.parse({
      schemaVersion: 1,
      id: databaseId,
      name: "Legacy active database",
      linkedSeriesIds: [],
      createdAt: now,
      updatedAt: now,
    }).schemaVersion).toBe(1);

    expect(ResearchDatabaseSchema.parse({
      schemaVersion: 2,
      id: databaseId,
      name: "Archived database",
      linkedSeriesIds: [],
      createdAt: now,
      updatedAt: now,
      status: "archived",
      archivedAt: now,
      migratedFromVersion1Revision: revision,
    }).schemaVersion).toBe(2);
    expect(ResearchDatabaseSchema.safeParse({
      schemaVersion: 2,
      id: databaseId,
      name: "Contradictory database",
      linkedSeriesIds: [],
      createdAt: now,
      updatedAt: now,
      status: "active",
      archivedAt: now,
    }).success).toBe(false);
  });

  it("validates Source version 4 lifecycle without accepting malformed versions", () => {
    const base = {
      id: sourceId,
      researchDatabaseId: databaseId,
      kind: "txt" as const,
      mediaType: "text/plain" as const,
      originalFileName: "reference.txt",
      sizeBytes: 5,
      contentHash: "b".repeat(64),
      originalRelativePath: `originals/${sourceId}/1.txt`,
      contentRelativePath: `content/${sourceId}/1.json`,
      parsedContentHash: "c".repeat(64),
      parseStatus: "parsed" as const,
      parserName: "plain-text",
      parserVersion: 1,
      parseWarnings: [],
      origin: { type: "file" as const },
      importedAt: now,
      updatedAt: now,
      displayName: "Reference",
      author: "",
      declaredLanguage: "en",
      tags: [],
      aiPermission: "never" as const,
      useNotes: "",
    };
    expect(ResearchSourceSchema.parse({
      ...base,
      schemaVersion: 4,
      status: "active",
      archivedAt: null,
      contentVersion: 1,
    }).schemaVersion).toBe(4);
    expect(ResearchSourceSchema.safeParse({
      ...base,
      schemaVersion: 4,
      status: "archived",
      archivedAt: null,
      contentVersion: 0,
    }).success).toBe(false);
  });

  it("bounds lifecycle, replacement, confirmation, and status inputs", () => {
    expect(ResearchLifecycleListQuerySchema.parse({}).status).toBe("active");
    expect(ResearchLifecycleListQuerySchema.safeParse({ status: "deleted" }).success).toBe(false);
    expect(DeleteResearchDatabaseInputSchema.parse({
      baseRevision: revision,
      confirmationName: "Database",
    }).confirmationName).toBe("Database");
    expect(DeleteResearchSourceInputSchema.safeParse({
      baseRevision: revision,
      confirmationName: "",
    }).success).toBe(false);
    expect(ReplaceResearchSourceInputSchema.parse({
      baseRevision: revision,
      fileName: "replacement.txt",
      mediaType: "text/plain",
      sizeBytes: 5,
      contentBase64: "aGVsbG8=",
    }).sizeBytes).toBe(5);
    expect(ReplaceResearchSourceInputSchema.safeParse({
      baseRevision: revision,
      fileName: "../replacement.txt",
      mediaType: "text/plain",
      sizeBytes: 5,
      contentBase64: "aGVsbG8=",
    }).success).toBe(false);
  });

  it("requires blocker booleans to match their bounded reference reports", () => {
    expect(ResearchDatabaseDeletionBlockersSchema.safeParse({
      researchDatabaseId: databaseId,
      blocked: false,
      workshopReferences: [],
      pendingProposalReferences: [{
        seriesId: databaseId,
        seriesTitle: "Series",
        proposalId: sourceId,
        proposalTitle: "Pending Proposal",
        noteId,
        noteTitle: "Note",
      }],
      unreadableSeries: [],
    }).success).toBe(false);
    expect(ResearchSourceDeletionBlockersSchema.safeParse({
      researchDatabaseId: databaseId,
      sourceId,
      blocked: false,
      noteReferences: [{ noteId, noteTitle: "Note", noteStatus: "active" }],
      pendingProposalReferences: [],
      unreadableSeries: [],
    }).success).toBe(true);
  });

  it("represents archived Source freshness separately from permission", () => {
    expect(ResearchNoteEvidenceFreshnessSchema.parse("source-archived")).toBe("source-archived");
    expect(ResearchNoteFreshnessCountsSchema.parse({
      current: 0,
      sourceArchived: 1,
      sourceRevisionChanged: 0,
      passageChanged: 0,
      sourceMissing: 0,
      unreadable: 0,
      ownershipMismatch: 0,
      modelUseForbidden: 0,
    }).sourceArchived).toBe(1);
  });
});
