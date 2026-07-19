import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ResearchSourceV2Schema } from "@novel-studio/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectRepository, StorageError, type PreparedResearchSourceImport } from "../src/index.js";
import {
  createResearchDatabaseSourceFile,
  researchDatabaseOriginalPath,
} from "../src/researchFiles.js";
import { buildResearchSourceContent } from "../src/researchContent.js";

const temporaryDirectories: string[] = [];

async function repository(): Promise<ProjectRepository> {
  const root = await mkdtemp(path.join(tmpdir(), "novel-studio-research-content-"));
  temporaryDirectories.push(root);
  return new ProjectRepository(root);
}

function prepared(bytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 255, 17, 42])): PreparedResearchSourceImport {
  const text = "港湾記録 and harbor evidence.";
  return {
    kind: "docx",
    mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    originalFileName: "harbor.docx",
    originalBytes: bytes,
    sizeBytes: bytes.byteLength,
    contentHash: createHash("sha256").update(bytes).digest("hex"),
    properties: {
      displayName: "Harbor archive",
      author: "Archivist",
      declaredLanguage: null,
      tags: ["maritime"],
      aiPermission: "never",
      useNotes: "Binary authority fixture",
    },
    origin: { type: "file" },
    content: {
      title: "Harbor archive",
      parserName: "test-docx",
      parserVersion: 1,
      warnings: [],
      sections: [],
      blocks: [{
        order: 0,
        sectionOrder: null,
        kind: "paragraph",
        text,
        location: { kind: "docx", sectionPath: [], paragraph: 1 },
      }],
    },
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("NS-604 binary Research authority and version 2 migration", () => {
  it("rejects cyclic section parents and dangling block sections instead of dropping them", () => {
    const cyclic = prepared();
    cyclic.content.sections = [{
      order: 0,
      parentOrder: 0,
      title: "Invalid self parent",
      location: { kind: "docx", sectionPath: ["Invalid self parent"], paragraph: 1 },
    }];
    cyclic.content.blocks[0]!.sectionOrder = 0;
    expect(() => buildResearchSourceContent({
      researchDatabaseId: randomUUID(),
      sourceId: randomUUID(),
      originalContentHash: cyclic.contentHash,
      declaredLanguage: null,
      prepared: cyclic.content,
    })).toThrow("section parent is invalid");

    const dangling = prepared();
    dangling.content.blocks[0]!.sectionOrder = 7;
    expect(() => buildResearchSourceContent({
      researchDatabaseId: randomUUID(),
      sourceId: randomUUID(),
      originalContentHash: dangling.contentHash,
      declaredLanguage: null,
      prepared: dangling.content,
    })).toThrow("block section is invalid");
  });

  it("commits binary original, Source, and parsed content atomically with exact restart verification", async () => {
    const store = await repository();
    const database = await store.createResearchDatabase({ name: "Binary archive" });
    const input = prepared();
    await expect(store.importResearchSource(database.database.id, input, {
      afterMutationApplied: ({ index }) => {
        if (index === 1) throw new Error("injected parsed-content transaction failure");
      },
    })).rejects.toThrow("injected parsed-content transaction failure");

    const databaseRoot = path.join(store.libraryRoot, "research-databases", database.database.id);
    expect(await store.listResearchSources(database.database.id)).toEqual([]);
    expect(await readdir(path.join(databaseRoot, "sources"))).toEqual([]);
    expect(await readdir(path.join(databaseRoot, "originals"))).toEqual([]);
    expect(await readdir(path.join(databaseRoot, "contents"))).toEqual([]);

    const created = await store.importResearchSource(database.database.id, input);
    expect(created.source.schemaVersion).toBe(3);
    expect("content" in created && created.content.chunks[0]?.text).toContain("harbor evidence");
    expect(await readFile(path.join(databaseRoot, created.source.originalRelativePath))).toEqual(Buffer.from(input.originalBytes));

    const restarted = new ProjectRepository(store.libraryRoot);
    const reopened = await restarted.getResearchSource(database.database.id, created.source.id);
    expect(reopened.source.contentHash).toBe(input.contentHash);
    expect("content" in reopened && reopened.content.chunks[0]?.location).toMatchObject({ kind: "docx", paragraph: 1 });
  });

  it("rejects tampered binary or parsed content before a property update", async () => {
    const store = await repository();
    const database = await store.createResearchDatabase({ name: "Tamper checks" });
    const first = await store.importResearchSource(database.database.id, prepared());
    const root = path.join(store.libraryRoot, "research-databases", database.database.id);
    const authorityPath = path.join(root, "sources", `${first.source.id}.json`);
    const authorityBefore = await readFile(authorityPath, "utf8");
    await writeFile(path.join(root, first.source.originalRelativePath), Buffer.from("changed"));
    await expect(store.updateResearchSource(database.database.id, first.source.id, {
      baseRevision: first.revision,
      displayName: "Must not save",
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    expect(await readFile(authorityPath, "utf8")).toBe(authorityBefore);

    const secondDatabase = await store.createResearchDatabase({ name: "Content tamper" });
    const second = await store.importResearchSource(secondDatabase.database.id, prepared(Buffer.from("other binary")));
    const secondRoot = path.join(store.libraryRoot, "research-databases", secondDatabase.database.id);
    const contentPath = path.join(secondRoot, second.source.schemaVersion === 3 ? second.source.contentRelativePath : "missing");
    const content = JSON.parse(await readFile(contentPath, "utf8")) as { chunks: Array<{ text: string }> };
    content.chunks[0]!.text = "tampered parsed text";
    await writeFile(contentPath, `${JSON.stringify(content, null, 2)}\n`, "utf8");
    await expect(store.getResearchSource(secondDatabase.database.id, second.source.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
  });

  it("explicitly migrates version 2 with exact rollback and unchanged original bytes", async () => {
    const store = await repository();
    const database = await store.createResearchDatabase({ name: "Version migration" });
    const databaseRoot = path.join(store.libraryRoot, "research-databases", database.database.id);
    const sourceId = randomUUID();
    const originalText = "# 航路\n\n港を出た船。\n\nThe vessel crossed the sea.";
    const contentHash = createHash("sha256").update(originalText, "utf8").digest("hex");
    const originalPath = researchDatabaseOriginalPath(databaseRoot, { id: sourceId, kind: "markdown" });
    const source = ResearchSourceV2Schema.parse({
      schemaVersion: 2,
      id: sourceId,
      researchDatabaseId: database.database.id,
      kind: "markdown",
      mediaType: "text/markdown",
      originalFileName: "legacy.md",
      sizeBytes: Buffer.byteLength(originalText),
      contentHash,
      originalRelativePath: path.relative(databaseRoot, originalPath).replace(/\\/gu, "/"),
      parseStatus: "parsed",
      parserName: "plain-text",
      parserVersion: 1,
      importedAt: "2026-07-19T00:00:00.000Z",
      updatedAt: "2026-07-19T00:00:00.000Z",
      displayName: "Legacy route",
      author: "",
      declaredLanguage: "ja-JP",
      tags: [],
      aiPermission: "never",
      useNotes: "",
    });
    const version2 = await createResearchDatabaseSourceFile(databaseRoot, source, originalText);
    const sourcePath = path.join(databaseRoot, "sources", `${sourceId}.json`);
    const sourceRaw = await readFile(sourcePath, "utf8");
    const originalBytes = await readFile(originalPath);

    await expect(store.migrateResearchSourcesV2(database.database.id, {
      sources: [{ sourceId, baseRevision: version2.revision }],
    }, {
      afterMutationApplied: ({ index }) => {
        if (index === 0) throw new Error("injected v2 migration failure");
      },
    })).rejects.toThrow("injected v2 migration failure");
    expect(await readFile(sourcePath, "utf8")).toBe(sourceRaw);
    expect(await readFile(originalPath)).toEqual(originalBytes);

    const migrated = await store.migrateResearchSourcesV2(database.database.id, {
      sources: [{ sourceId, baseRevision: version2.revision }],
    });
    expect(migrated.migratedSourceIds).toEqual([sourceId]);
    const detail = await store.getResearchSource(database.database.id, sourceId);
    expect(detail.source.schemaVersion).toBe(3);
    expect("content" in detail && detail.content.sections[0]?.title).toBe("航路");
    expect(await readFile(originalPath)).toEqual(originalBytes);
    const rollbackPath = path.join(databaseRoot, "migrations", "source-v2", `${sourceId}.${version2.revision}.json`);
    expect(await readFile(rollbackPath, "utf8")).toBe(sourceRaw);
  });

  it("rejects stale migration revisions without creating rollback or content files", async () => {
    const store = await repository();
    const database = await store.createResearchDatabase({ name: "Stale migration" });
    await expect(store.migrateResearchSourcesV2(database.database.id, {
      sources: [{ sourceId: randomUUID(), baseRevision: "a".repeat(64) }],
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "NOT_FOUND" });
  });
});
