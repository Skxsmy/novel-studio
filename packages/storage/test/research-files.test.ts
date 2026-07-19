import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
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
