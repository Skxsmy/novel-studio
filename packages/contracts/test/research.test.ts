import { describe, expect, it } from "vitest";
import {
  ImportResearchSourceInputSchema,
  LegacyResearchSourceSchema,
  MAX_RESEARCH_SOURCE_BYTES,
  ResearchSourceDocumentSchema,
  ResearchSourceSchema,
  UpdateResearchSourceInputSchema,
} from "../src/research.js";

const sourceId = "11111111-1111-4111-8111-111111111111";
const seriesId = "22222222-2222-4222-8222-222222222222";
const researchDatabaseId = "33333333-3333-4333-8333-333333333333";
const now = "2026-07-19T00:00:00.000Z";

describe("NS-603 Research source contracts", () => {
  it("separates immutable source facts from author-editable properties", () => {
    const source = ResearchSourceSchema.parse({
      schemaVersion: 2,
      id: sourceId,
      researchDatabaseId,
      kind: "markdown",
      mediaType: "text/markdown",
      originalFileName: "setting-notes.md",
      sizeBytes: 18,
      contentHash: "a".repeat(64),
      originalRelativePath: `originals/${sourceId}.md`,
      parseStatus: "parsed",
      parserName: "plain-text",
      parserVersion: 1,
      importedAt: now,
      updatedAt: now,
      displayName: "Setting notes",
    });
    const document = ResearchSourceDocumentSchema.parse({ source, revision: "b".repeat(64) });

    expect(document.source.aiPermission).toBe("never");
    expect(document.source.tags).toEqual([]);
    expect(document.source.author).toBe("");
    expect(document.source.originalFileName).toBe("setting-notes.md");
    expect(document.source.researchDatabaseId).toBe(researchDatabaseId);
  });

  it("accepts only bounded safe TXT and Markdown import envelopes", () => {
    expect(ImportResearchSourceInputSchema.parse({
      fileName: "reference.txt",
      mediaType: "text/plain",
      sizeBytes: 5,
      contentBase64: "aGVsbG8=",
    }).aiPermission).toBeUndefined();
    expect(ImportResearchSourceInputSchema.safeParse({
      fileName: "../reference.txt",
      mediaType: "text/plain",
      sizeBytes: 5,
      contentBase64: "aGVsbG8=",
    }).success).toBe(false);
    expect(ImportResearchSourceInputSchema.safeParse({
      fileName: "reference.txt",
      mediaType: "application/pdf",
      sizeBytes: MAX_RESEARCH_SOURCE_BYTES + 1,
      contentBase64: "%%%%",
    }).success).toBe(false);
  });

  it("validates a canonical 25 MiB base64 envelope without recursive regular-expression failure", () => {
    const bytes = Buffer.alloc(MAX_RESEARCH_SOURCE_BYTES, 65);
    const parsed = ImportResearchSourceInputSchema.parse({
      fileName: "capacity-boundary.txt",
      mediaType: "text/plain",
      sizeBytes: bytes.byteLength,
      contentBase64: bytes.toString("base64"),
    });
    expect(parsed.sizeBytes).toBe(MAX_RESEARCH_SOURCE_BYTES);
    expect(ImportResearchSourceInputSchema.safeParse({
      ...parsed,
      contentBase64: `${parsed.contentBase64.slice(0, -4)}=AAA`,
    }).success).toBe(false);
  });

  it("allows only revision-bound editable property updates", () => {
    expect(UpdateResearchSourceInputSchema.parse({
      baseRevision: "c".repeat(64),
      displayName: "Revised source name",
      declaredLanguage: "ja-JP",
      tags: ["folklore", "Meiji"],
      aiPermission: "allowed",
    })).toMatchObject({ displayName: "Revised source name", aiPermission: "allowed" });
    expect(UpdateResearchSourceInputSchema.safeParse({ baseRevision: "c".repeat(64) }).success).toBe(false);
    expect(UpdateResearchSourceInputSchema.safeParse({
      baseRevision: "c".repeat(64),
      tags: ["Lore", "lore"],
    }).success).toBe(false);
    expect(UpdateResearchSourceInputSchema.safeParse({
      baseRevision: "c".repeat(64),
      originalFileName: "replacement.txt",
    }).success).toBe(false);
  });

  it("keeps Series-owned version 1 authority behind an explicit legacy schema", () => {
    const legacy = LegacyResearchSourceSchema.parse({
      schemaVersion: 1,
      id: sourceId,
      seriesId,
      kind: "txt",
      mediaType: "text/plain",
      originalFileName: "legacy.txt",
      sizeBytes: 6,
      contentHash: "d".repeat(64),
      originalRelativePath: `research/originals/${sourceId}.txt`,
      parseStatus: "parsed",
      parserName: "plain-text",
      parserVersion: 1,
      importedAt: now,
      updatedAt: now,
      displayName: "Legacy source",
    });
    expect(legacy.seriesId).toBe(seriesId);
    expect(ResearchSourceSchema.safeParse(legacy).success).toBe(false);
  });
});
