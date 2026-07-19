import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectRepository, StorageError, type PreparedResearchSourceImport } from "../src/index.js";

const temporaryDirectories: string[] = [];

async function createRepository(): Promise<ProjectRepository> {
  const root = await mkdtemp(path.join(tmpdir(), "novel-studio-research-"));
  temporaryDirectories.push(root);
  return new ProjectRepository(root);
}

function preparedImport(originalText = "海辺の町についての資料。\nEnglish note."): PreparedResearchSourceImport {
  return {
    kind: "markdown",
    mediaType: "text/markdown",
    originalFileName: "source-notes.md",
    originalText,
    sizeBytes: Buffer.byteLength(originalText, "utf8"),
    contentHash: createHash("sha256").update(originalText, "utf8").digest("hex"),
    properties: {
      displayName: "Source notes",
      author: "A. Researcher",
      declaredLanguage: "ja-JP",
      tags: ["coast"],
      aiPermission: "never",
      useNotes: "Private reference",
    },
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});
describe("NS-603 Research source authority files", () => {
  it("commits the original and authority together and recovers an injected partial import", async () => {
    const store = await createRepository();
    const database = await store.createResearchDatabase({ name: "Research Atomic" });

    await expect(store.importResearchSource(database.database.id, preparedImport(), {
      afterMutationApplied: ({ index }) => {
        if (index === 0) throw new Error("injected Research import failure");
      },
    })).rejects.toThrow("injected Research import failure");

    expect(await store.listResearchSources(database.database.id)).toEqual([]);
    const databaseRoot = path.join(store.libraryRoot, "research-databases", database.database.id);
    expect(await readdir(path.join(databaseRoot, "sources"))).toEqual([]);
    expect(await readdir(path.join(databaseRoot, "originals"))).toEqual([]);

    const created = await store.importResearchSource(database.database.id, preparedImport());
    expect(created.originalText).toContain("海辺の町");
    expect(created.source.aiPermission).toBe("never");
    expect(await readFile(path.join(databaseRoot, created.source.originalRelativePath), "utf8"))
      .toBe(preparedImport().originalText);
  });

  it("rejects duplicate content inside one database but accepts the same content in another", async () => {
    const store = await createRepository();
    const firstDatabase = await store.createResearchDatabase({ name: "First database" });
    const secondDatabase = await store.createResearchDatabase({ name: "Second database" });
    const first = await store.importResearchSource(firstDatabase.database.id, preparedImport());

    await expect(store.importResearchSource(firstDatabase.database.id, {
      ...preparedImport(),
      originalFileName: "same-content-different-name.md",
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });
    expect((await store.listResearchSources(firstDatabase.database.id)).map((item) => item.source.id)).toEqual([
      first.source.id,
    ]);
    const isolatedCopy = await store.importResearchSource(secondDatabase.database.id, preparedImport());
    expect(isolatedCopy.source.contentHash).toBe(first.source.contentHash);
    expect(isolatedCopy.source.researchDatabaseId).toBe(secondDatabase.database.id);
  });

  it("serializes concurrent duplicate imports so exactly one source is created", async () => {
    const store = await createRepository();
    const database = await store.createResearchDatabase({ name: "Concurrent duplicate" });
    const attempts = await Promise.allSettled(Array.from({ length: 12 }, (_, index) =>
      store.importResearchSource(database.database.id, {
        ...preparedImport(),
        originalFileName: `same-content-${index}.md`,
      })));

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(11);
    expect(await store.listResearchSources(database.database.id)).toHaveLength(1);
  });

  it("rejects an authority record redirected away from its canonical managed original", async () => {
    const store = await createRepository();
    const database = await store.createResearchDatabase({ name: "Canonical original" });
    const created = await store.importResearchSource(database.database.id, preparedImport());
    const databaseRoot = path.join(store.libraryRoot, "research-databases", database.database.id);
    const redirectedRelativePath = "originals/redirected.md";
    await writeFile(path.join(databaseRoot, redirectedRelativePath), created.originalText, "utf8");
    const authorityPath = path.join(databaseRoot, "sources", `${created.source.id}.json`);
    const authority = JSON.parse(await readFile(authorityPath, "utf8")) as Record<string, unknown>;
    authority.originalRelativePath = redirectedRelativePath;
    await writeFile(authorityPath, `${JSON.stringify(authority, null, 2)}\n`, "utf8");

    await expect(store.getResearchSource(database.database.id, created.source.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
  });

  it("rejects a cross-database authority before listing or updating it and leaves bytes unchanged", async () => {
    const store = await createRepository();
    const database = await store.createResearchDatabase({ name: "Database boundary" });
    const created = await store.importResearchSource(database.database.id, preparedImport());
    const databaseRoot = path.join(store.libraryRoot, "research-databases", database.database.id);
    const authorityPath = path.join(databaseRoot, "sources", `${created.source.id}.json`);
    const authority = JSON.parse(await readFile(authorityPath, "utf8")) as Record<string, unknown>;
    authority.researchDatabaseId = "00000000-0000-4000-8000-000000000001";
    const damagedRaw = `${JSON.stringify(authority, null, 2)}\n`;
    await writeFile(authorityPath, damagedRaw, "utf8");
    const damagedRevision = createHash("sha256").update(damagedRaw, "utf8").digest("hex");

    await expect(store.listResearchSources(database.database.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    await expect(store.updateResearchSource(database.database.id, created.source.id, {
      baseRevision: damagedRevision,
      displayName: "Must not be written",
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    expect(await readFile(authorityPath, "utf8")).toBe(damagedRaw);
  });

  it("rejects a property update before writing when the managed original is damaged", async () => {
    const store = await createRepository();
    const database = await store.createResearchDatabase({ name: "Damaged original" });
    const created = await store.importResearchSource(database.database.id, preparedImport());
    const databaseRoot = path.join(store.libraryRoot, "research-databases", database.database.id);
    const authorityPath = path.join(databaseRoot, "sources", `${created.source.id}.json`);
    const authorityBefore = await readFile(authorityPath, "utf8");
    await writeFile(path.join(databaseRoot, created.source.originalRelativePath), "tampered source", "utf8");

    await expect(store.updateResearchSource(database.database.id, created.source.id, {
      baseRevision: created.revision,
      displayName: "Must not be committed",
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    expect(await readFile(authorityPath, "utf8")).toBe(authorityBefore);
  });

  it("survives repository restart and preserves immutable facts and original bytes across revision-safe updates", async () => {
    const store = await createRepository();
    const database = await store.createResearchDatabase({ name: "Revision database" });
    const created = await store.importResearchSource(database.database.id, preparedImport());
    const originalFacts = {
      contentHash: created.source.contentHash,
      importedAt: created.source.importedAt,
      originalFileName: created.source.originalFileName,
      originalRelativePath: created.source.originalRelativePath,
      sizeBytes: created.source.sizeBytes,
    };

    const restarted = new ProjectRepository(store.libraryRoot);
    const listed = await restarted.listResearchSources(database.database.id);
    expect(listed).toHaveLength(1);
    const updated = await restarted.updateResearchSource(database.database.id, created.source.id, {
      baseRevision: listed[0]!.revision,
      displayName: "Japanese coastal source",
      author: "Revised catalog author",
      declaredLanguage: "ja-JP",
      tags: ["coast", "folklore"],
      aiPermission: "allowed",
      useNotes: "Cleared for the selected model context.",
    });

    expect(updated.source).toMatchObject(originalFacts);
    expect(updated.source.displayName).toBe("Japanese coastal source");
    expect(updated.source.tags).toEqual(["coast", "folklore"]);
    expect(updated.originalText).toBe(created.originalText);
    await expect(restarted.updateResearchSource(database.database.id, created.source.id, {
      baseRevision: created.revision,
      displayName: "Stale overwrite",
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });
    expect((await restarted.getResearchSource(database.database.id, created.source.id)).source.displayName)
      .toBe("Japanese coastal source");
  });
});
