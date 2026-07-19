import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ResearchSourceV3Schema } from "@novel-studio/contracts";
import { afterEach, describe, expect, it } from "vitest";
import {
  ProjectRepository,
  StorageError,
  type PreparedResearchSourceImport,
} from "../src/index.js";
import { jsonAuthorityRevision, serializeJsonAuthority } from "../src/jsonAuthority.js";
import { buildResearchSourceContent } from "../src/researchContent.js";

const temporaryDirectories: string[] = [];

async function repository(): Promise<ProjectRepository> {
  const root = await mkdtemp(path.join(tmpdir(), "novel-studio-research-notes-"));
  temporaryDirectories.push(root);
  return new ProjectRepository(root);
}

function preparedImport(
  originalText: string,
  displayName: string,
  aiPermission: "allowed" | "never" = "never",
): PreparedResearchSourceImport {
  const originalBytes = Buffer.from(originalText, "utf8");
  return {
    kind: "markdown",
    mediaType: "text/markdown",
    originalFileName: `${displayName.toLocaleLowerCase("en").replace(/[^a-z0-9]+/gu, "-")}.md`,
    originalBytes,
    sizeBytes: originalBytes.byteLength,
    contentHash: createHash("sha256").update(originalBytes).digest("hex"),
    properties: {
      displayName,
      author: "Archive editor",
      declaredLanguage: null,
      tags: ["fixture"],
      aiPermission,
      useNotes: "NS-609 temporary evidence fixture",
    },
    origin: { type: "file" },
    content: {
      title: displayName,
      parserName: "ns-609-test",
      parserVersion: 1,
      warnings: [],
      sections: [],
      blocks: [{
        order: 0,
        sectionOrder: null,
        kind: "paragraph",
        text: originalText,
        location: {
          kind: "text",
          startLine: 1,
          endLine: originalText.split("\n").length,
          startOffset: 0,
          endOffset: originalText.length,
        },
      }],
    },
  };
}

function captureFrom(detail: Awaited<ReturnType<ProjectRepository["getResearchSource"]>>) {
  if (!("content" in detail)) throw new Error("Expected version 3 Research Source");
  const chunk = detail.content.chunks[0]!;
  return {
    sourceId: detail.source.id,
    sourceRevision: detail.revision,
    blockId: chunk.blockId,
    chunkId: chunk.id,
    chunkHash: chunk.textHash,
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

describe("NS-609 Research Note authority and evidence", () => {
  it("persists the full revision-checked lifecycle, multiple evidence, filtering, and restart", async () => {
    const store = await repository();
    const database = await store.createResearchDatabase({ name: "Multilingual note archive" });
    const japanese = await store.importResearchSource(
      database.database.id,
      preparedImport("港の規則は夜明けに改定された。", "Japanese harbor rules"),
    );
    const english = await store.importResearchSource(
      database.database.id,
      preparedImport("The customs bell rang twice before dawn.", "English customs record", "allowed"),
    );

    const created = await store.createResearchNote(database.database.id, {
      title: "Harbor entry ritual",
      body: "Use the contrast between written rules and the bell ritual.",
      tags: ["harbor", "ritual"],
      evidence: [captureFrom(japanese)],
    });
    expect(created.evidence[0]).toMatchObject({ freshness: "current", modelUse: "forbidden" });
    expect(created.note.evidence[0]?.originalText).toContain("夜明け");
    expect((await store.listResearchNotes(database.database.id)).notes).toEqual([
      expect.objectContaining({ id: created.note.id, evidenceCount: 1, freshness: expect.objectContaining({ current: 1 }) }),
    ]);

    const updated = await store.updateResearchNote(database.database.id, created.note.id, {
      baseRevision: created.revision,
      body: "The fictional port can contradict the archive through a two-bell ritual.",
    });
    await expect(store.updateResearchNote(database.database.id, created.note.id, {
      baseRevision: created.revision,
      title: "Stale overwrite",
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });

    const appended = await store.appendResearchNoteEvidence(database.database.id, created.note.id, {
      baseRevision: updated.revision,
      evidence: [captureFrom(english)],
    });
    expect(appended.note.evidence).toHaveLength(2);
    await expect(store.appendResearchNoteEvidence(database.database.id, created.note.id, {
      baseRevision: appended.revision,
      evidence: [captureFrom(english)],
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });

    const removed = await store.removeResearchNoteEvidence(
      database.database.id,
      created.note.id,
      appended.note.evidence[0]!.id,
      { baseRevision: appended.revision },
    );
    expect(removed.note.evidence).toHaveLength(1);
    await expect(store.removeResearchNoteEvidence(
      database.database.id,
      created.note.id,
      removed.note.evidence[0]!.id,
      { baseRevision: removed.revision },
    )).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });

    const archived = await store.archiveResearchNote(database.database.id, created.note.id, {
      baseRevision: removed.revision,
    });
    expect(archived.note.status).toBe("archived");
    await expect(store.updateResearchNote(database.database.id, created.note.id, {
      baseRevision: archived.revision,
      title: "Archived edit",
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    expect((await store.listResearchNotes(database.database.id)).total).toBe(0);
    expect((await store.listResearchNotes(database.database.id, { status: "archived" })).total).toBe(1);

    const restored = await store.restoreResearchNote(database.database.id, created.note.id, {
      baseRevision: archived.revision,
    });
    const restarted = new ProjectRepository(store.libraryRoot);
    expect((await restarted.getResearchNote(database.database.id, created.note.id)).note).toMatchObject({
      body: updated.note.body,
      status: "active",
    });
    expect(restored.revision).not.toBe(archived.revision);
  });

  it("recovers injected create and update failures without exposing partial Note authority", async () => {
    const store = await repository();
    const database = await store.createResearchDatabase({ name: "Atomic notes" });
    const source = await store.importResearchSource(
      database.database.id,
      preparedImport("事务失败不能留下半条笔记。", "Atomic evidence"),
    );

    await expect(store.createResearchNote(database.database.id, {
      title: "Interrupted create",
      evidence: [captureFrom(source)],
    }, {
      afterMutationApplied: () => {
        throw new Error("injected Research Note create failure");
      },
    })).rejects.toThrow("injected Research Note create failure");
    expect((await store.listResearchNotes(database.database.id)).total).toBe(0);

    const created = await store.createResearchNote(database.database.id, {
      title: "Stable note",
      evidence: [captureFrom(source)],
    });
    const notePath = path.join(
      store.libraryRoot,
      "research-databases",
      database.database.id,
      "notes",
      `${created.note.id}.json`,
    );
    const bytesBefore = await readFile(notePath, "utf8");
    await expect(store.updateResearchNote(database.database.id, created.note.id, {
      baseRevision: created.revision,
      body: "Must roll back",
    }, {
      afterMutationApplied: () => {
        throw new Error("injected Research Note update failure");
      },
    })).rejects.toThrow("injected Research Note update failure");
    expect(await readFile(notePath, "utf8")).toBe(bytesBefore);
    expect((await store.getResearchNote(database.database.id, created.note.id)).note.body).toBe("");
  });

  it("keeps valid Notes available beside damaged and duplicate authorities without leaking paths", async () => {
    const store = await repository();
    const database = await store.createResearchDatabase({ name: "Diagnostic notes" });
    const source = await store.importResearchSource(
      database.database.id,
      preparedImport("Valid evidence remains readable.", "Diagnostic evidence"),
    );
    const created = await store.createResearchNote(database.database.id, {
      title: "Valid note",
      evidence: [captureFrom(source)],
    });
    const notesRoot = path.join(store.libraryRoot, "research-databases", database.database.id, "notes");
    const validRaw = await readFile(path.join(notesRoot, `${created.note.id}.json`), "utf8");
    await writeFile(path.join(notesRoot, "ffffffff-ffff-4fff-8fff-ffffffffffff.json"), validRaw, "utf8");
    await writeFile(path.join(notesRoot, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee.json"), "{ damaged", "utf8");
    await writeFile(path.join(notesRoot, "not-an-id.json"), "{}", "utf8");

    const listed = await store.listResearchNotes(database.database.id, { status: "all" });
    expect(listed.notes.map((note) => note.id)).toEqual([created.note.id]);
    expect(listed.issueCount).toBe(3);
    expect(listed.issues.map((issue) => issue.code).sort()).toEqual([
      "duplicate-id",
      "invalid-authority",
      "invalid-authority",
    ]);
    expect(JSON.stringify(listed.issues)).not.toContain(store.libraryRoot);
  });

  it("resolves current, metadata-changed, passage-changed, missing, unreadable, ownership, and model-use states", async () => {
    const store = await repository();
    const database = await store.createResearchDatabase({ name: "Freshness notes" });
    const otherDatabase = await store.createResearchDatabase({ name: "Other database" });
    const source = await store.importResearchSource(
      database.database.id,
      preparedImport("The first harbor decree remained untranslated.", "Freshness evidence"),
    );
    const note = await store.createResearchNote(database.database.id, {
      title: "Evidence state matrix",
      evidence: [captureFrom(source)],
    });
    expect(note.evidence[0]).toMatchObject({ freshness: "current", modelUse: "forbidden" });

    const propertyUpdated = await store.updateResearchSource(database.database.id, source.source.id, {
      baseRevision: source.revision,
      aiPermission: "allowed",
    });
    expect((await store.getResearchNote(database.database.id, note.note.id)).evidence[0]).toMatchObject({
      freshness: "source-revision-changed",
      modelUse: "allowed",
      currentSourceRevision: propertyUpdated.revision,
    });

    const databaseRoot = path.join(store.libraryRoot, "research-databases", database.database.id);
    const sourcePath = path.join(databaseRoot, "sources", `${source.source.id}.json`);
    if (!("content" in propertyUpdated) || propertyUpdated.source.schemaVersion !== 3) {
      throw new Error("Expected version 3 source");
    }
    const contentPath = path.join(databaseRoot, propertyUpdated.source.contentRelativePath);
    const originalPath = path.join(databaseRoot, propertyUpdated.source.originalRelativePath);
    const sourceRaw = await readFile(sourcePath, "utf8");
    const contentRaw = await readFile(contentPath, "utf8");
    const originalBytes = await readFile(originalPath);

    const changedText = "The second harbor decree replaced the first passage.";
    const changedInput = preparedImport(changedText, propertyUpdated.source.displayName, "allowed");
    const changedContent = buildResearchSourceContent({
      researchDatabaseId: database.database.id,
      sourceId: source.source.id,
      originalContentHash: changedInput.contentHash,
      declaredLanguage: null,
      prepared: changedInput.content,
    });
    const changedContentRaw = serializeJsonAuthority(changedContent);
    const changedSource = ResearchSourceV3Schema.parse({
      ...propertyUpdated.source,
      sizeBytes: changedInput.sizeBytes,
      contentHash: changedInput.contentHash,
      parsedContentHash: jsonAuthorityRevision(changedContentRaw),
      updatedAt: "2026-07-20T01:00:00.000Z",
    });
    await writeFile(originalPath, changedInput.originalBytes);
    await writeFile(contentPath, changedContentRaw, "utf8");
    await writeFile(sourcePath, serializeJsonAuthority(changedSource), "utf8");
    expect((await store.getResearchNote(database.database.id, note.note.id)).evidence[0]?.freshness)
      .toBe("passage-changed");

    await writeFile(sourcePath, sourceRaw, "utf8");
    await writeFile(contentPath, contentRaw, "utf8");
    await writeFile(originalPath, originalBytes);
    await rm(sourcePath);
    expect((await store.getResearchNote(database.database.id, note.note.id)).evidence[0]?.freshness)
      .toBe("source-missing");

    await writeFile(sourcePath, "{ unreadable", "utf8");
    expect((await store.getResearchNote(database.database.id, note.note.id)).evidence[0]?.freshness)
      .toBe("unreadable");

    const foreignSource = ResearchSourceV3Schema.parse({
      ...propertyUpdated.source,
      researchDatabaseId: otherDatabase.database.id,
    });
    await writeFile(sourcePath, serializeJsonAuthority(foreignSource), "utf8");
    expect((await store.getResearchNote(database.database.id, note.note.id)).evidence[0]?.freshness)
      .toBe("ownership-mismatch");

    await writeFile(sourcePath, sourceRaw, "utf8");
    const otherSource = await store.importResearchSource(
      otherDatabase.database.id,
      preparedImport("Other database evidence.", "Foreign evidence"),
    );
    await expect(store.createResearchNote(database.database.id, {
      title: "Cross-database capture",
      evidence: [captureFrom(otherSource)],
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "NOT_FOUND" });
  });

  it("rejects a client capture after the Source revision or Chunk identity changes", async () => {
    const store = await repository();
    const database = await store.createResearchDatabase({ name: "Capture conflicts" });
    const source = await store.importResearchSource(
      database.database.id,
      preparedImport("Exact citation identity.", "Capture evidence"),
    );
    const staleCapture = captureFrom(source);
    await store.updateResearchSource(database.database.id, source.source.id, {
      baseRevision: source.revision,
      displayName: "Renamed capture evidence",
    });
    await expect(store.createResearchNote(database.database.id, {
      title: "Stale capture",
      evidence: [staleCapture],
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });
    expect((await store.listResearchNotes(database.database.id)).total).toBe(0);
  });
});
