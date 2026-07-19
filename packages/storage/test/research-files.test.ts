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
describe("NS-602 Research source authority files", () => {
  it("commits the original and authority together and recovers an injected partial import", async () => {
    const store = await createRepository();
    const series = await store.createSeries({ title: "ResearchAtomic" });

    await expect(store.importResearchSource(series.manifest.id, preparedImport(), {
      afterMutationApplied: ({ index }) => {
        if (index === 0) throw new Error("injected Research import failure");
      },
    })).rejects.toThrow("injected Research import failure");

    expect(await store.listResearchSources(series.manifest.id)).toEqual([]);
    const seriesRoot = path.join(store.libraryRoot, `ResearchAtomic-${series.manifest.id.slice(0, 8)}`);
    expect(await readdir(path.join(seriesRoot, "research", "sources"))).toEqual([]);
    expect(await readdir(path.join(seriesRoot, "research", "originals"))).toEqual([]);

    const created = await store.importResearchSource(series.manifest.id, preparedImport());
    expect(created.originalText).toContain("海辺の町");
    expect(created.source.aiPermission).toBe("never");
    expect(await readFile(path.join(seriesRoot, created.source.originalRelativePath), "utf8"))
      .toBe(preparedImport().originalText);
  });

  it("rejects duplicate source content without creating a second authority record", async () => {
    const store = await createRepository();
    const series = await store.createSeries({ title: "ResearchDuplicate" });
    const first = await store.importResearchSource(series.manifest.id, preparedImport());

    await expect(store.importResearchSource(series.manifest.id, {
      ...preparedImport(),
      originalFileName: "same-content-different-name.md",
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });
    expect((await store.listResearchSources(series.manifest.id)).map((item) => item.source.id)).toEqual([
      first.source.id,
    ]);
  });

  it("serializes concurrent duplicate imports so exactly one source is created", async () => {
    const store = await createRepository();
    const series = await store.createSeries({ title: "ResearchConcurrentDuplicate" });
    const attempts = await Promise.allSettled(Array.from({ length: 12 }, (_, index) =>
      store.importResearchSource(series.manifest.id, {
        ...preparedImport(),
        originalFileName: `same-content-${index}.md`,
      })));

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(11);
    expect(await store.listResearchSources(series.manifest.id)).toHaveLength(1);
  });

  it("rejects an authority record redirected away from its canonical managed original", async () => {
    const store = await createRepository();
    const series = await store.createSeries({ title: "ResearchCanonicalOriginal" });
    const created = await store.importResearchSource(series.manifest.id, preparedImport());
    const seriesRoot = path.join(store.libraryRoot, `ResearchCanonicalOriginal-${series.manifest.id.slice(0, 8)}`);
    const redirectedRelativePath = "research/originals/redirected.md";
    await writeFile(path.join(seriesRoot, redirectedRelativePath), created.originalText, "utf8");
    const authorityPath = path.join(seriesRoot, "research", "sources", `${created.source.id}.json`);
    const authority = JSON.parse(await readFile(authorityPath, "utf8")) as Record<string, unknown>;
    authority.originalRelativePath = redirectedRelativePath;
    await writeFile(authorityPath, `${JSON.stringify(authority, null, 2)}\n`, "utf8");

    await expect(store.getResearchSource(series.manifest.id, created.source.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
  });

  it("rejects a cross-Series authority before listing or updating it and leaves bytes unchanged", async () => {
    const store = await createRepository();
    const series = await store.createSeries({ title: "ResearchSeriesBoundary" });
    const created = await store.importResearchSource(series.manifest.id, preparedImport());
    const seriesRoot = path.join(store.libraryRoot, `ResearchSeriesBoundary-${series.manifest.id.slice(0, 8)}`);
    const authorityPath = path.join(seriesRoot, "research", "sources", `${created.source.id}.json`);
    const authority = JSON.parse(await readFile(authorityPath, "utf8")) as Record<string, unknown>;
    authority.seriesId = "00000000-0000-4000-8000-000000000001";
    const damagedRaw = `${JSON.stringify(authority, null, 2)}\n`;
    await writeFile(authorityPath, damagedRaw, "utf8");
    const damagedRevision = createHash("sha256").update(damagedRaw, "utf8").digest("hex");

    await expect(store.listResearchSources(series.manifest.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    await expect(store.updateResearchSource(series.manifest.id, created.source.id, {
      baseRevision: damagedRevision,
      displayName: "Must not be written",
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    expect(await readFile(authorityPath, "utf8")).toBe(damagedRaw);
  });

  it("rejects a property update before writing when the managed original is damaged", async () => {
    const store = await createRepository();
    const series = await store.createSeries({ title: "ResearchDamagedOriginal" });
    const created = await store.importResearchSource(series.manifest.id, preparedImport());
    const seriesRoot = path.join(store.libraryRoot, `ResearchDamagedOriginal-${series.manifest.id.slice(0, 8)}`);
    const authorityPath = path.join(seriesRoot, "research", "sources", `${created.source.id}.json`);
    const authorityBefore = await readFile(authorityPath, "utf8");
    await writeFile(path.join(seriesRoot, created.source.originalRelativePath), "tampered source", "utf8");

    await expect(store.updateResearchSource(series.manifest.id, created.source.id, {
      baseRevision: created.revision,
      displayName: "Must not be committed",
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    expect(await readFile(authorityPath, "utf8")).toBe(authorityBefore);
  });

  it("survives repository restart and preserves immutable facts and original bytes across revision-safe updates", async () => {
    const store = await createRepository();
    const series = await store.createSeries({ title: "ResearchRevision" });
    const created = await store.importResearchSource(series.manifest.id, preparedImport());
    const originalFacts = {
      contentHash: created.source.contentHash,
      importedAt: created.source.importedAt,
      originalFileName: created.source.originalFileName,
      originalRelativePath: created.source.originalRelativePath,
      sizeBytes: created.source.sizeBytes,
    };

    const restarted = new ProjectRepository(store.libraryRoot);
    const listed = await restarted.listResearchSources(series.manifest.id);
    expect(listed).toHaveLength(1);
    const updated = await restarted.updateResearchSource(series.manifest.id, created.source.id, {
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
    await expect(restarted.updateResearchSource(series.manifest.id, created.source.id, {
      baseRevision: created.revision,
      displayName: "Stale overwrite",
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });
    expect((await restarted.getResearchSource(series.manifest.id, created.source.id)).source.displayName)
      .toBe("Japanese coastal source");
  });
});
