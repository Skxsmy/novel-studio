import { describe, expect, it } from "vitest";
import {
  CreateResearchDatabaseInputSchema,
  ResearchDatabaseDocumentSchema,
  ResearchDatabaseListResultSchema,
  ResearchDatabaseSchema,
  UpdateResearchDatabaseInputSchema,
} from "../src/research.js";

const databaseId = "33333333-3333-4333-8333-333333333333";
const firstSeriesId = "11111111-1111-4111-8111-111111111111";
const secondSeriesId = "22222222-2222-4222-8222-222222222222";
const now = "2026-07-19T00:00:00.000Z";

describe("NS-603 Research Database contracts", () => {
  it("defines a revision-bearing library-level database linked to several Series", () => {
    const database = ResearchDatabaseSchema.parse({
      schemaVersion: 1,
      id: databaseId,
      name: "Maritime history",
      description: "Shared source shelf.",
      linkedSeriesIds: [firstSeriesId, secondSeriesId],
      createdAt: now,
      updatedAt: now,
    });
    const document = ResearchDatabaseDocumentSchema.parse({ database, revision: "a".repeat(64) });
    expect(document.database.linkedSeriesIds).toEqual([firstSeriesId, secondSeriesId]);
    expect(ResearchDatabaseSchema.safeParse({ ...database, linkedSeriesIds: [firstSeriesId, firstSeriesId] }).success)
      .toBe(false);
  });

  it("requires a real create or revision-bound update payload", () => {
    expect(CreateResearchDatabaseInputSchema.parse({ name: "Japanese folklore" }).description).toBeUndefined();
    expect(CreateResearchDatabaseInputSchema.safeParse({ name: "" }).success).toBe(false);
    expect(UpdateResearchDatabaseInputSchema.safeParse({ baseRevision: "b".repeat(64) }).success).toBe(false);
    expect(UpdateResearchDatabaseInputSchema.parse({
      baseRevision: "b".repeat(64),
      linkedSeriesIds: [firstSeriesId, secondSeriesId],
    }).linkedSeriesIds).toHaveLength(2);
  });

  it("reports damaged database directories without preventing valid summaries", () => {
    const result = ResearchDatabaseListResultSchema.parse({
      databases: [{
        database: {
          schemaVersion: 1,
          id: databaseId,
          name: "Valid shelf",
          description: "",
          linkedSeriesIds: [],
          createdAt: now,
          updatedAt: now,
        },
        revision: "c".repeat(64),
        sourceCount: 0,
      }],
      issues: [{ directoryName: "damaged", code: "invalid-authority", message: "Cannot read database metadata." }],
    });
    expect(result.databases).toHaveLength(1);
    expect(result.issues).toHaveLength(1);
  });
});
