import { describe, expect, it } from "vitest";
import {
  AppendResearchNoteEvidenceInputSchema,
  CreateResearchNoteInputSchema,
  MAX_RESEARCH_NOTE_BODY_CHARS,
  ResearchNoteSchema,
  UpdateResearchNoteInputSchema,
} from "../src/researchNotes.js";

const databaseId = "11111111-1111-4111-8111-111111111111";
const sourceId = "22222222-2222-4222-8222-222222222222";
const blockId = "33333333-3333-4333-8333-333333333333";
const chunkId = "44444444-4444-4444-8444-444444444444";
const evidenceId = "55555555-5555-4555-8555-555555555555";
const noteId = "66666666-6666-4666-8666-666666666666";
const revision = "a".repeat(64);
const now = "2026-07-20T00:00:00.000Z";

const capture = {
  sourceId,
  sourceRevision: revision,
  blockId,
  chunkId,
  chunkHash: "b".repeat(64),
};

describe("NS-609 Research Note contracts", () => {
  it("accepts bounded evidence capture without client-authored quote authority", () => {
    const parsed = CreateResearchNoteInputSchema.parse({
      title: "  Meiji port regulations  ",
      body: "Compare this rule with the fictional customs office.",
      tags: ["Meiji", "ports"],
      evidence: [capture],
    });
    expect(parsed.title).toBe("Meiji port regulations");
    expect(parsed.evidence).toEqual([capture]);
    expect(CreateResearchNoteInputSchema.safeParse({
      title: "Forged evidence",
      evidence: [{ ...capture, originalText: "client claim", quoteHash: "c".repeat(64) }],
    }).success).toBe(false);
  });

  it("rejects empty, duplicate, oversized, malformed, and cross-database authority", () => {
    expect(CreateResearchNoteInputSchema.safeParse({ title: "No evidence", evidence: [] }).success).toBe(false);
    expect(CreateResearchNoteInputSchema.safeParse({
      title: "Duplicates",
      evidence: [capture, capture],
    }).success).toBe(false);
    expect(CreateResearchNoteInputSchema.safeParse({
      title: "Oversized",
      body: "x".repeat(MAX_RESEARCH_NOTE_BODY_CHARS + 1),
      evidence: [capture],
    }).success).toBe(false);
    expect(AppendResearchNoteEvidenceInputSchema.safeParse({
      baseRevision: revision,
      evidence: [{ ...capture, chunkHash: "not-a-hash" }],
    }).success).toBe(false);

    const note = {
      schemaVersion: 1,
      id: noteId,
      researchDatabaseId: databaseId,
      title: "Cross-database note",
      body: "",
      tags: [],
      evidence: [{
        id: evidenceId,
        researchDatabaseId: "77777777-7777-4777-8777-777777777777",
        sourceId,
        sourceRevision: revision,
        sourceContentHash: "c".repeat(64),
        sourceDisplayName: "Source",
        sourceKind: "txt",
        blockId,
        chunkId,
        chunkHash: "b".repeat(64),
        originalText: "Original evidence",
        quoteHash: "d".repeat(64),
        languageTag: "en",
        location: { kind: "text", startLine: 1, endLine: 1, startOffset: 0, endOffset: 17 },
        capturedAt: now,
      }],
      status: "active",
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
    expect(ResearchNoteSchema.safeParse(note).success).toBe(false);
  });

  it("enforces lifecycle consistency and revision-only mutations", () => {
    expect(UpdateResearchNoteInputSchema.safeParse({ baseRevision: revision }).success).toBe(false);
    expect(UpdateResearchNoteInputSchema.safeParse({
      baseRevision: revision,
      tags: ["Lore", "lore"],
    }).success).toBe(false);

    const base = {
      schemaVersion: 1,
      id: noteId,
      researchDatabaseId: databaseId,
      title: "Lifecycle",
      body: "",
      tags: [],
      evidence: [{
        id: evidenceId,
        researchDatabaseId: databaseId,
        sourceId,
        sourceRevision: revision,
        sourceContentHash: "c".repeat(64),
        sourceDisplayName: "Source",
        sourceKind: "txt",
        blockId,
        chunkId,
        chunkHash: "b".repeat(64),
        originalText: "Original evidence",
        quoteHash: "d".repeat(64),
        languageTag: "en",
        location: { kind: "text", startLine: 1, endLine: 1, startOffset: 0, endOffset: 17 },
        capturedAt: now,
      }],
      createdAt: now,
      updatedAt: now,
    };
    expect(ResearchNoteSchema.safeParse({ ...base, status: "active", archivedAt: now }).success).toBe(false);
    expect(ResearchNoteSchema.safeParse({ ...base, status: "archived", archivedAt: null }).success).toBe(false);
  });
});
