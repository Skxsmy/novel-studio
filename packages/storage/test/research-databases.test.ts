import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { LegacyResearchSourceSchema } from "@novel-studio/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectRepository, StorageError } from "../src/index.js";
import { createLegacyResearchSourceFile } from "../src/researchFiles.js";

const temporaryDirectories: string[] = [];

async function createRepository(): Promise<ProjectRepository> {
  const root = await mkdtemp(path.join(tmpdir(), "novel-studio-research-databases-"));
  temporaryDirectories.push(root);
  return new ProjectRepository(root);
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("NS-603 Research Database authority", () => {
  it("creates, lists, updates, and restarts isolated databases while names stay unique", async () => {
    const store = await createRepository();
    const first = await store.createResearchDatabase({ name: "Japanese folklore", description: "Shared references" });
    const second = await store.createResearchDatabase({ name: "Maritime history" });

    expect((await store.listResearchDatabases()).databases.map((item) => item.database.name))
      .toEqual(["Japanese folklore", "Maritime history"]);
    await expect(store.createResearchDatabase({ name: "  japanese folklore  " }))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });

    const updated = await store.updateResearchDatabase(first.database.id, {
      baseRevision: first.revision,
      name: "Japanese folklore archive",
      description: "Reusable across novels.",
    });
    expect(updated.database.description).toBe("Reusable across novels.");
    await expect(store.updateResearchDatabase(first.database.id, {
      baseRevision: first.revision,
      description: "Stale overwrite",
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });

    const restarted = new ProjectRepository(store.libraryRoot);
    expect((await restarted.getResearchDatabase(first.database.id)).database.name)
      .toBe("Japanese folklore archive");
    expect((await restarted.getResearchDatabase(second.database.id)).database.linkedSeriesIds).toEqual([]);
  });

  it("keeps valid databases available when another database authority is damaged", async () => {
    const store = await createRepository();
    const valid = await store.createResearchDatabase({ name: "Valid database" });
    const damaged = await store.createResearchDatabase({ name: "Damaged database" });
    await writeFile(
      path.join(store.libraryRoot, "research-databases", damaged.database.id, "database.json"),
      "{ damaged",
      "utf8",
    );

    const listed = await store.listResearchDatabases();
    expect(listed.databases.map((item) => item.database.id)).toEqual([valid.database.id]);
    expect(listed.issues).toEqual([expect.objectContaining({ directoryName: damaged.database.id })]);
    expect((await store.getResearchDatabase(valid.database.id)).database.name).toBe("Valid database");
  });

  it("does not expose partial authority after injected database creation failure", async () => {
    const store = await createRepository();
    await expect(store.createResearchDatabase({ name: "Incomplete" }, {
      afterMutationApplied: () => {
        throw new Error("injected database create failure");
      },
    })).rejects.toThrow("injected database create failure");
    expect(await store.listResearchDatabases()).toEqual({ databases: [], issues: [] });
  });

  it("links one database to two real Series and rejects a missing Series before mutation", async () => {
    const store = await createRepository();
    const firstSeries = await store.createSeries({ title: "First novel" });
    const secondSeries = await store.createSeries({ title: "Second novel" });
    const database = await store.createResearchDatabase({ name: "Shared history" });

    const linked = await store.updateResearchDatabase(database.database.id, {
      baseRevision: database.revision,
      linkedSeriesIds: [firstSeries.manifest.id, secondSeries.manifest.id],
    });
    expect(linked.database.linkedSeriesIds).toEqual([firstSeries.manifest.id, secondSeries.manifest.id]);
    const bytesBefore = await readFile(
      path.join(store.libraryRoot, "research-databases", database.database.id, "database.json"),
      "utf8",
    );
    await expect(store.updateResearchDatabase(database.database.id, {
      baseRevision: linked.revision,
      linkedSeriesIds: ["00000000-0000-4000-8000-000000000001"],
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "NOT_FOUND" });
    expect(await readFile(
      path.join(store.libraryRoot, "research-databases", database.database.id, "database.json"),
      "utf8",
    )).toBe(bytesBefore);

    const unlinked = await store.updateResearchDatabase(database.database.id, {
      baseRevision: linked.revision,
      linkedSeriesIds: [secondSeries.manifest.id],
    });
    expect(unlinked.database.linkedSeriesIds).toEqual([secondSeries.manifest.id]);
  });

  it("copies legacy Series sources explicitly and keeps exact rollback bytes after failure and success", async () => {
    const store = await createRepository();
    const series = await store.createSeries({ title: "Legacy research novel" });
    const database = await store.createResearchDatabase({ name: "Migrated shelf" });
    const linked = await store.updateResearchDatabase(database.database.id, {
      baseRevision: database.revision,
      linkedSeriesIds: [series.manifest.id],
    });
    expect(linked.database.linkedSeriesIds).toEqual([series.manifest.id]);

    const seriesRoot = path.join(store.libraryRoot, `Legacy-research-novel-${series.manifest.id.slice(0, 8)}`);
    const legacySourceId = "11111111-1111-4111-8111-111111111111";
    const originalText = "旧资料原文。\nLegacy English evidence.";
    const contentHash = createHash("sha256").update(originalText, "utf8").digest("hex");
    const legacy = LegacyResearchSourceSchema.parse({
      schemaVersion: 1,
      id: legacySourceId,
      seriesId: series.manifest.id,
      kind: "markdown",
      mediaType: "text/markdown",
      originalFileName: "legacy.md",
      sizeBytes: Buffer.byteLength(originalText, "utf8"),
      contentHash,
      originalRelativePath: `research/originals/${legacySourceId}.md`,
      parseStatus: "parsed",
      parserName: "plain-text",
      parserVersion: 1,
      importedAt: "2026-07-19T00:00:00.000Z",
      updatedAt: "2026-07-19T00:00:00.000Z",
      displayName: "Legacy evidence",
      author: "Original researcher",
      declaredLanguage: "zh-CN",
      tags: ["legacy"],
      aiPermission: "never",
      useNotes: "Migration fixture",
    });
    const legacyDetail = await createLegacyResearchSourceFile(seriesRoot, legacy, originalText);
    const legacyAuthorityPath = path.join(seriesRoot, "research", "sources", `${legacySourceId}.json`);
    const legacyOriginalPath = path.join(seriesRoot, legacy.originalRelativePath);
    const authorityBefore = await readFile(legacyAuthorityPath, "utf8");
    const originalBefore = await readFile(legacyOriginalPath, "utf8");
    expect((await store.listLegacyResearchSourceGroups())[0]).toMatchObject({
      seriesId: series.manifest.id,
      sourceCount: 1,
    });

    await expect(store.migrateLegacyResearchSources(database.database.id, series.manifest.id, {
      afterMutationApplied: ({ index }) => {
        if (index === 0) throw new Error("injected migration failure");
      },
    })).rejects.toThrow("injected migration failure");
    expect(await store.listResearchSources(database.database.id)).toEqual([]);
    expect(await readFile(legacyAuthorityPath, "utf8")).toBe(authorityBefore);
    expect(await readFile(legacyOriginalPath, "utf8")).toBe(originalBefore);

    const migrated = await store.migrateLegacyResearchSources(database.database.id, series.manifest.id);
    expect(migrated.importedSourceIds).toHaveLength(1);
    const copied = await store.getResearchSource(database.database.id, migrated.importedSourceIds[0]!);
    expect(copied.originalText).toBe(originalText);
    expect(copied.source).toMatchObject({
      contentHash,
      displayName: legacyDetail.source.displayName,
      researchDatabaseId: database.database.id,
      legacyOrigin: {
        seriesId: series.manifest.id,
        sourceId: legacySourceId,
        sourceRevision: legacyDetail.revision,
      },
    });
    expect(await readFile(legacyAuthorityPath, "utf8")).toBe(authorityBefore);
    expect(await readFile(legacyOriginalPath, "utf8")).toBe(originalBefore);
  });
});
