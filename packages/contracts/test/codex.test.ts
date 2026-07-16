import { describe, expect, it } from "vitest";
import {
  CodexDetailTypeSchema,
  CodexDetailTypeV1Schema,
  CodexRelationSchema,
  CodexRelationV1Schema,
  CreateCodexDetailTypeInputSchema,
  CreateCodexRelationInputSchema,
  migrateCodexDetailTypeV1ToV2,
  migrateCodexRelationV1ToV2,
  UpdateCodexDetailTypeInputSchema,
} from "../src/codex.js";

const sourceEntryId = "00000000-0000-4000-8000-000000000001";
const targetEntryId = "00000000-0000-4000-8000-000000000002";
const relationId = "00000000-0000-4000-8000-000000000003";
const timestamp = "2026-07-15T00:00:00.000Z";

describe("Codex Detail Type contracts", () => {
  it("accepts Detail Type v2 descriptions and projects v1 without inventing text", () => {
    const detailTypeId = "00000000-0000-4000-8000-000000000004";
    const firstVersion = CodexDetailTypeV1Schema.parse({
      schemaVersion: 1,
      id: detailTypeId,
      categoryId: "character",
      name: "Appearance",
      nsfw: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const migrated = migrateCodexDetailTypeV1ToV2(firstVersion);
    const secondVersion = CodexDetailTypeSchema.parse({
      ...migrated,
      description: "  Visible traits used for prose consistency.  ",
    });

    expect(migrated).toMatchObject({ schemaVersion: 2, description: "" });
    expect(secondVersion.description).toBe("Visible traits used for prose consistency.");
    expect(CreateCodexDetailTypeInputSchema.parse({
      categoryId: "character",
      name: "Pronouns",
    }).description).toBe("");
    expect(UpdateCodexDetailTypeInputSchema.parse({
      baseRevision: "a".repeat(64),
      name: "  Physical appearance  ",
    }).name).toBe("Physical appearance");
  });
});

describe("Codex relation contracts", () => {
  it("accepts description-only Codex relation v2 documents without type", () => {
    const relation = CodexRelationSchema.parse({
      schemaVersion: 2,
      id: relationId,
      sourceEntryId,
      targetEntryId,
      description: "Mara trusts Ivo with the archive key.",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    expect(relation).not.toHaveProperty("type");
    expect(relation.description).toBe("Mara trusts Ivo with the archive key.");
  });

  it("requires a non-empty Simple Description when creating a relation", () => {
    expect(() => CreateCodexRelationInputSchema.parse({
      sourceEntryId,
      targetEntryId,
      description: "   ",
    })).toThrow();
  });

  it("drops the first-version type field when migrating to relation v2", () => {
    const firstVersion = CodexRelationV1Schema.parse({
      schemaVersion: 1,
      id: relationId,
      sourceEntryId,
      targetEntryId,
      type: "trust",
      description: "",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const migrated = migrateCodexRelationV1ToV2(firstVersion);

    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.description).toBe("");
    expect(migrated).not.toHaveProperty("type");
  });
});
