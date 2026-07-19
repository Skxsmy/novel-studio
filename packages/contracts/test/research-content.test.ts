import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  ImportResearchWebSourceInputSchema,
  MigrateResearchSourcesV2InputSchema,
  ResearchKeywordSearchInputSchema,
  ResearchSourceContentSchema,
  ResearchSourceV3Schema,
} from "../src/index.js";

const HASH = "a".repeat(64);

function textHash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function contentFixture() {
  const sourceId = randomUUID();
  const databaseId = randomUUID();
  const sectionId = randomUUID();
  const blockId = randomUUID();
  const text = "潮声 crossed the 海峡。";
  const location = { kind: "text" as const, startLine: 1, endLine: 1, startOffset: 0, endOffset: text.length };
  const language = { languageTag: "zh", source: "detected" as const, confidence: 0.95, detectorVersion: "test-v1" };
  const languageSpans = [
    { ...language, start: 0, end: 3 },
    { languageTag: "en", source: "detected" as const, confidence: 0.95, detectorVersion: "test-v1", start: 3, end: 15 },
    { ...language, start: 15, end: text.length },
  ];
  return {
    schemaVersion: 1 as const,
    researchDatabaseId: databaseId,
    sourceId,
    originalContentHash: HASH,
    parserName: "test-parser",
    parserVersion: 1,
    title: "Cross-language source",
    sections: [{ id: sectionId, parentSectionId: null, order: 0, title: "Opening", location }],
    blocks: [{
      id: blockId,
      sectionId,
      order: 0,
      kind: "paragraph" as const,
      text,
      textHash: textHash(text),
      location,
      language,
      languageSpans,
    }],
    chunks: [{
      id: randomUUID(),
      blockId,
      order: 0,
      text,
      textHash: textHash(text),
      location,
      language,
      languageSpans,
    }],
  };
}

describe("Research Source version 3 contracts", () => {
  it("accepts location-aware mixed-language content and a binary Source record", () => {
    const content = ResearchSourceContentSchema.parse(contentFixture());
    expect(content.chunks[0]?.languageSpans.map((span) => span.languageTag)).toEqual(["zh", "en", "zh"]);
    expect(ResearchSourceV3Schema.parse({
      schemaVersion: 3,
      id: content.sourceId,
      researchDatabaseId: content.researchDatabaseId,
      kind: "docx",
      mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      originalFileName: "source.docx",
      sizeBytes: 42,
      contentHash: HASH,
      originalRelativePath: `originals/${content.sourceId}.docx`,
      contentRelativePath: `contents/${content.sourceId}.json`,
      parsedContentHash: HASH,
      parseStatus: "parsed",
      parserName: "mammoth-docx",
      parserVersion: 1,
      parseWarnings: [],
      origin: { type: "file" },
      importedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      displayName: "Source",
      author: "",
      declaredLanguage: null,
      tags: [],
      aiPermission: "never",
      useNotes: "",
    }).schemaVersion).toBe(3);
  });

  it("rejects duplicate IDs, broken order, missing parents, and incomplete language spans", () => {
    const fixture = contentFixture();
    expect(() => ResearchSourceContentSchema.parse({
      ...fixture,
      sections: [...fixture.sections, { ...fixture.sections[0]!, order: 1 }],
    })).toThrow();
    expect(() => ResearchSourceContentSchema.parse({
      ...fixture,
      blocks: [{ ...fixture.blocks[0]!, order: 2 }],
    })).toThrow();
    expect(() => ResearchSourceContentSchema.parse({
      ...fixture,
      chunks: [{ ...fixture.chunks[0]!, blockId: randomUUID() }],
    })).toThrow();
    expect(() => ResearchSourceContentSchema.parse({
      ...fixture,
      chunks: [{ ...fixture.chunks[0]!, languageSpans: fixture.chunks[0]!.languageSpans.slice(0, 1) }],
    })).toThrow();
  });

  it("rejects credentialized web addresses and duplicate migration requests", () => {
    expect(() => ImportResearchWebSourceInputSchema.parse({ url: "https://user:secret@example.com/private" })).toThrow();
    const sourceId = randomUUID();
    expect(() => MigrateResearchSourcesV2InputSchema.parse({
      sources: [
        { sourceId, baseRevision: HASH },
        { sourceId, baseRevision: HASH },
      ],
    })).toThrow();
  });

  it("bounds single-database keyword queries and validates language filters", () => {
    expect(ResearchKeywordSearchInputSchema.parse({ query: "海峡", languageTags: ["ja-JP"] })).toMatchObject({
      purpose: "local",
      limit: 30,
    });
    expect(() => ResearchKeywordSearchInputSchema.parse({ query: " ", limit: 500 })).toThrow();
    expect(() => ResearchKeywordSearchInputSchema.parse({ query: "harbor", languageTags: ["not_a_tag"] })).toThrow();
  });
});
