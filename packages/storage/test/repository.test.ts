import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  codexContextEligibility,
  findCodexMentionsInContent,
  isSceneSectionEligibleForContext,
  ProjectRepository,
  resolveReviewAnchor,
  StorageError,
} from "../src/index.js";

const temporaryDirectories: string[] = [];

async function repository(): Promise<ProjectRepository> {
  const root = await mkdtemp(path.join(tmpdir(), "novel-studio-"));
  temporaryDirectories.push(root);
  return new ProjectRepository(root);
}

function seriesRoot(store: ProjectRepository, title: string, seriesId: string): string {
  return path.join(store.libraryRoot, `${title}-${seriesId.slice(0, 8)}`);
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("ProjectRepository", () => {
  it("creates a readable series and scene on disk", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "潮汐之城", description: "测试系列" });

    expect(series.manifest.title).toBe("潮汐之城");
    expect(series.scenes).toHaveLength(1);
    const scene = series.scenes[0];
    expect(scene).toBeDefined();
    const scenePath = path.join(store.libraryRoot, `${"潮汐之城"}-${series.manifest.id.slice(0, 8)}`, scene!.relativePath);
    expect(scene!.relativePath.endsWith(".json")).toBe(true);
    const sceneAuthority = JSON.parse(await readFile(scenePath, "utf8")) as Record<string, unknown>;
    expect(sceneAuthority).toMatchObject({
      id: scene!.metadata.id,
      title: "Opening Scene",
      document: { schemaVersion: 1 },
    });
  });

  it("moves a series to trash, restores it, and permanently deletes only with exact title confirmation", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "DeleteBoundary", description: "delete test" });
    const root = seriesRoot(store, "DeleteBoundary", series.manifest.id);

    const trashed = await store.trashSeries(series.manifest.id);
    expect(trashed.archivedAt).not.toBeNull();
    expect((await store.listSeries()).find((summary) => summary.id === series.manifest.id)?.archived).toBe(true);

    const restored = await store.restoreSeries(series.manifest.id);
    expect(restored.archivedAt).toBeNull();
    expect((await store.listSeries()).find((summary) => summary.id === series.manifest.id)?.archived).toBe(false);

    await expect(store.deleteSeries(series.manifest.id, { confirmTitle: "DeleteBoundary" }))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    await expect(readFile(path.join(root, "series.json"), "utf8")).resolves.toContain("DeleteBoundary");

    await store.trashSeries(series.manifest.id);
    await expect(store.deleteSeries(series.manifest.id, { confirmTitle: "Wrong" }))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    await expect(readFile(path.join(root, "series.json"), "utf8")).resolves.toContain("DeleteBoundary");

    const deleted = await store.deleteSeries(series.manifest.id, { confirmTitle: "DeleteBoundary" });
    expect(deleted.deletedId).toBe(series.manifest.id);
    expect((await store.listSeries()).some((summary) => summary.id === series.manifest.id)).toBe(false);
    await expect(store.getSeries(series.manifest.id)).rejects.toMatchObject<Partial<StorageError>>({ code: "NOT_FOUND" });
    await expect(readFile(path.join(root, "series.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("persists scene prose as JSON blocks while preserving the legacy content projection", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "BlockAuthority" });
    const initial = series.scenes[0]!;

    const updated = await store.updateScene(series.manifest.id, initial.metadata.id, {
      baseRevision: initial.revision,
      title: "Structured Scene",
      content: "# Beat One\n\nA quiet line.\n\n> remembered words\n\n***\n\nSecond paragraph.",
    });

    expect(updated.content).toBe("# Beat One\n\nA quiet line.\n\n> remembered words\n\n***\n\nSecond paragraph.");
    expect(updated.plainText).toBe("Beat One\n\nA quiet line.\n\nremembered words\n\nSecond paragraph.");
    expect(updated.document.blocks.map((block) => block.kind)).toEqual([
      "heading",
      "paragraph",
      "quote",
      "sceneBreak",
      "paragraph",
    ]);

    const scenePath = path.join(seriesRoot(store, "BlockAuthority", series.manifest.id), updated.relativePath);
    const raw = await readFile(scenePath, "utf8");
    const authority = JSON.parse(raw) as {
      title: string;
      document: { schemaVersion: number; blocks: Array<{ kind: string; text?: string }> };
    };
    expect(authority).toMatchObject({
      title: "Structured Scene",
      document: { schemaVersion: 1 },
    });
    expect(authority.document.blocks.map((block) => block.kind)).toEqual([
      "heading",
      "paragraph",
      "quote",
      "sceneBreak",
      "paragraph",
    ]);
    expect(authority.document.blocks[0]).toMatchObject({ kind: "heading", text: "Beat One" });
    expect(authority.document.blocks[1]).toMatchObject({ kind: "paragraph", text: "A quiet line." });
  });

  it("updates scene block documents and exports readable Markdown without component state", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "DocumentApi" });
    const initial = series.scenes[0]!;
    const createdAt = "2026-06-29T00:00:00.000Z";

    const staged = await store.updateSceneBlockDocument(series.manifest.id, initial.metadata.id, {
      baseRevision: initial.revision,
      title: "Block Document",
      document: {
        schemaVersion: 1,
        blocks: [
          {
            id: "00000000-0000-4000-8000-000000000101",
            kind: "heading",
            level: 2,
            text: "Opening Signal",
          },
          {
            id: "00000000-0000-4000-8000-000000000102",
            kind: "paragraph",
            text: "Visible manuscript text.",
          },
          {
            id: "00000000-0000-4000-8000-000000000103",
            kind: "paragraph",
            text: "Progression placeholder.",
          },
          {
            id: "00000000-0000-4000-8000-000000000104",
            kind: "quote",
            text: "Quoted memory.",
          },
        ],
      },
    });
    const entry = await store.createCodexEntry(series.manifest.id, {
      categoryId: "character",
      name: "Signal Keeper",
    });
    const embedded = await store.createSceneProgressionBlock(series.manifest.id, initial.metadata.id, {
      baseRevision: staged.revision,
      afterBlockId: staged.document.blocks[1]!.id,
      progression: {
        kind: "field",
        entryId: entry.metadata.id,
        relationId: null,
        field: { kind: "description", detailTypeId: null },
        fieldKey: null,
        operation: "add",
        body: "The signal changes here.",
        summary: "Signal progression.",
        evidence: [],
      },
    });
    const progression = embedded.progression;

    const updated = await store.updateSceneBlockDocument(series.manifest.id, initial.metadata.id, {
      baseRevision: embedded.scene.revision,
      title: "Block Document",
      document: {
        schemaVersion: 1,
        blocks: [
          staged.document.blocks[0]!,
          staged.document.blocks[1]!,
          embedded.block,
          staged.document.blocks[3]!,
        ],
      },
    });

    expect(updated.revision).not.toBe(initial.revision);
    expect(updated.metadata.title).toBe("Block Document");
    expect(updated.content).toBe("## Opening Signal\n\nVisible manuscript text.\n\n> Quoted memory.");
    expect(updated.plainText).toBe("Opening Signal\n\nVisible manuscript text.\n\nQuoted memory.");
    expect(updated.document.blocks.map((block) => block.kind)).toEqual([
      "heading",
      "paragraph",
      "codexProgression",
      "quote",
    ]);

    const reloaded = await store.getSceneBlockDocument(series.manifest.id, initial.metadata.id);
    expect(reloaded.document).toEqual(updated.document);
    expect(reloaded.revision).toBe(updated.revision);

    const exported = await store.exportSceneMarkdown(series.manifest.id, initial.metadata.id);
    expect(exported).toEqual({
      sceneId: initial.metadata.id,
      revision: updated.revision,
      markdown: "## Opening Signal\n\nVisible manuscript text.\n\n> Quoted memory.",
    });
    expect(exported.markdown).not.toContain("codexProgression");
    expect(exported.markdown).not.toContain(progression.progression.id);

    await expect(
      store.updateSceneBlockDocument(series.manifest.id, initial.metadata.id, {
        baseRevision: initial.revision,
        document: { schemaVersion: 1, blocks: [] },
      }),
    ).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });

    await expect(
      store.updateSceneBlockDocument(series.manifest.id, initial.metadata.id, {
        baseRevision: updated.revision,
        document: {
          schemaVersion: 1,
          blocks: [
            {
              id: "00000000-0000-4000-8000-000000000301",
              kind: "paragraph",
              text: "First duplicate.",
            },
            {
              id: "00000000-0000-4000-8000-000000000301",
              kind: "paragraph",
              text: "Second duplicate.",
            },
          ],
        },
      }),
    ).rejects.toThrow();

    await expect(
      store.updateSceneBlockDocument(series.manifest.id, initial.metadata.id, {
        baseRevision: updated.revision,
        document: {
          schemaVersion: 1,
          blocks: [{
            id: "00000000-0000-4000-8000-000000000401",
            kind: "codexProgression",
            progressionId: "00000000-0000-4000-8000-000000000499",
            createdAt,
            updatedAt: createdAt,
          }],
        },
      }),
    ).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });

    expect((await store.getScene(series.manifest.id, initial.metadata.id)).revision).toBe(updated.revision);
  });

  it("rejects invalid embedded progression block references", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "ProgressionBlockGuards" });
    const scene = await store.updateScene(series.manifest.id, series.scenes[0]!.metadata.id, {
      baseRevision: series.scenes[0]!.revision,
      title: "Guarded Scene",
      content: "First block.\n\nSecond block.",
    });
    const otherScene = await store.createScene(series.manifest.id, {
      title: "Other Scene",
      content: "Other block.",
    });
    const [firstBlock, secondBlock] = scene.document.blocks;
    expect(firstBlock).toBeDefined();
    expect(secondBlock).toBeDefined();
    const entry = await store.createCodexEntry(series.manifest.id, {
      categoryId: "character",
      name: "Guarded Entry",
    });
    const firstEmbedded = await store.createSceneProgressionBlock(series.manifest.id, scene.metadata.id, {
      baseRevision: scene.revision,
      afterBlockId: firstBlock!.id,
      progression: {
        kind: "field",
        entryId: entry.metadata.id,
        relationId: null,
        field: { kind: "description", detailTypeId: null },
        fieldKey: null,
        operation: "add",
        body: "First block state.",
        summary: "First block state.",
        evidence: [],
      },
    });
    const secondEmbedded = await store.createSceneProgressionBlock(series.manifest.id, scene.metadata.id, {
      baseRevision: firstEmbedded.scene.revision,
      afterBlockId: secondBlock!.id,
      progression: {
        kind: "field",
        entryId: entry.metadata.id,
        relationId: null,
        field: { kind: "description", detailTypeId: null },
        fieldKey: null,
        operation: "add",
        body: "Second block state.",
        summary: "Second block state.",
        evidence: [],
      },
    });
    const otherEmbedded = await store.createSceneProgressionBlock(series.manifest.id, otherScene.metadata.id, {
      baseRevision: otherScene.revision,
      afterBlockId: otherScene.document.blocks[0]!.id,
      progression: {
        kind: "field",
        entryId: entry.metadata.id,
        relationId: null,
        field: { kind: "description", detailTypeId: null },
        fieldKey: null,
        operation: "add",
        body: "Other scene state.",
        summary: "Other scene state.",
        evidence: [],
      },
    });
    const firstProgression = firstEmbedded.progression;
    const secondProgression = secondEmbedded.progression;
    const otherProgression = otherEmbedded.progression;
    const archived = await store.archiveCodexProgression(series.manifest.id, secondProgression.progression.id, {
      baseRevision: secondProgression.revision,
    });
    const createdAt = "2026-06-29T00:00:00.000Z";

    await expect(store.updateSceneBlockDocument(series.manifest.id, scene.metadata.id, {
      baseRevision: secondEmbedded.scene.revision,
      document: {
        schemaVersion: 1,
        blocks: [
          {
            id: firstEmbedded.block.id,
            kind: "codexProgression",
            progressionId: firstProgression.progression.id,
            createdAt,
            updatedAt: createdAt,
          },
          {
            id: secondEmbedded.block.id,
            kind: "codexProgression",
            progressionId: firstProgression.progression.id,
            createdAt,
            updatedAt: createdAt,
          },
        ],
      },
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });

    await expect(store.updateSceneBlockDocument(series.manifest.id, scene.metadata.id, {
      baseRevision: secondEmbedded.scene.revision,
      document: {
        schemaVersion: 1,
        blocks: [{
          id: secondEmbedded.block.id,
          kind: "codexProgression",
          progressionId: firstProgression.progression.id,
          createdAt,
          updatedAt: createdAt,
        }],
      },
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });

    await expect(store.updateSceneBlockDocument(series.manifest.id, scene.metadata.id, {
      baseRevision: secondEmbedded.scene.revision,
      document: {
        schemaVersion: 1,
        blocks: [{
          id: firstEmbedded.block.id,
          kind: "codexProgression",
          progressionId: otherProgression.progression.id,
          createdAt,
          updatedAt: createdAt,
        }],
      },
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });

    await expect(store.updateSceneBlockDocument(series.manifest.id, scene.metadata.id, {
      baseRevision: secondEmbedded.scene.revision,
      document: {
        schemaVersion: 1,
        blocks: [{
          id: secondEmbedded.block.id,
          kind: "codexProgression",
          progressionId: archived.progression.id,
          createdAt,
          updatedAt: createdAt,
        }],
      },
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
  });

  it("creates and deletes embedded progression blocks with their linked Progression records", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "ProgressionBlockDelete" });
    const scene = await store.updateScene(series.manifest.id, series.scenes[0]!.metadata.id, {
      baseRevision: series.scenes[0]!.revision,
      title: "Block delete scene",
      content: "Before the change.",
    });
    const anchorBlock = scene.document.blocks[0]!;
    const entry = await store.createCodexEntry(series.manifest.id, {
      categoryId: "character",
      name: "Keeper",
    });
    const embedded = await store.createSceneProgressionBlock(series.manifest.id, scene.metadata.id, {
      baseRevision: scene.revision,
      afterBlockId: anchorBlock.id,
      progression: {
        kind: "field",
        entryId: entry.metadata.id,
        relationId: null,
        field: { kind: "description", detailTypeId: null },
        fieldKey: null,
        operation: "add",
        body: "Knows the lock has changed.",
        summary: "Lock knowledge changes.",
        effectiveToSceneId: null,
        evidence: [],
      },
    });

    expect(embedded.scene.document.blocks.map((block) => block.kind)).toEqual(["paragraph", "codexProgression"]);
    expect(embedded.progression.progression.source).toMatchObject({
      kind: "write-block",
      sceneId: scene.metadata.id,
      blockId: embedded.block.id,
    });

    await expect(store.deleteCodexProgression(series.manifest.id, embedded.progression.progression.id, {
      baseRevision: embedded.progression.revision,
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });

    const deleted = await store.deleteSceneProgressionBlock(series.manifest.id, scene.metadata.id, embedded.block.id, {
      baseRevision: embedded.scene.revision,
      progressionBaseRevision: embedded.progression.revision,
    });

    expect(deleted).toMatchObject({
      blockId: embedded.block.id,
      deletedId: embedded.progression.progression.id,
      blockers: [],
    });
    expect(deleted.scene?.document.blocks.map((block) => block.kind)).toEqual(["paragraph"]);
    await expect(store.getCodexProgression(series.manifest.id, embedded.progression.progression.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "NOT_FOUND" });
  });

  it("keeps embedded progression blocks when linked Progression records have blockers", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "ProgressionBlockDeleteBlocked" });
    const scene = await store.updateScene(series.manifest.id, series.scenes[0]!.metadata.id, {
      baseRevision: series.scenes[0]!.revision,
      title: "Blocked delete scene",
      content: "Before the change.\n\nChange slot.",
    });
    const slotBlock = scene.document.blocks[1]!;
    const entry = await store.createCodexEntry(series.manifest.id, {
      categoryId: "character",
      name: "Keeper",
    });
    const embedded = await store.createSceneProgressionBlock(series.manifest.id, scene.metadata.id, {
      baseRevision: scene.revision,
      afterBlockId: slotBlock.id,
      progression: {
        kind: "field",
        entryId: entry.metadata.id,
        relationId: null,
        field: { kind: "description", detailTypeId: null },
        fieldKey: null,
        operation: "add",
        body: "Knows the lock has changed.",
        summary: "Lock knowledge changes.",
        evidence: [],
      },
    });
    const progression = embedded.progression;
    await store.createCodexKnowledge(series.manifest.id, {
      characterEntryId: entry.metadata.id,
      subjectEntryId: entry.metadata.id,
      relationId: null,
      stance: "knows",
      summary: "Keeper knows about the lock.",
      truthProgressionId: progression.progression.id,
      effectiveFromSceneId: scene.metadata.id,
      evidence: [{
        note: "Observed in scene text.",
        sourceType: "scene",
        sourceId: scene.metadata.id,
        quote: "Before the change.",
      }],
    });

    const blocked = await store.deleteSceneProgressionBlock(series.manifest.id, scene.metadata.id, embedded.block.id, {
      baseRevision: embedded.scene.revision,
      progressionBaseRevision: progression.revision,
    });

    expect(blocked.deletedId).toBeNull();
    expect(blocked.scene).toBeNull();
    expect(blocked.blockers).toEqual([
      expect.objectContaining({ kind: "character-knowledge" }),
    ]);
    expect((await store.getScene(series.manifest.id, scene.metadata.id)).document.blocks[2]).toMatchObject({
      kind: "codexProgression",
      progressionId: progression.progression.id,
    });
    expect((await store.getCodexProgression(series.manifest.id, progression.progression.id)).progression.id)
      .toBe(progression.progression.id);
  });

  it("rejects stale revisions without overwriting the scene", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "失落邮局" });
    const scene = series.scenes[0]!;
    const updated = await store.updateScene(series.manifest.id, scene.metadata.id, {
      baseRevision: scene.revision,
      title: scene.metadata.title,
      content: "雨落在废弃邮局的铜门上。",
    });

    await expect(
      store.updateScene(series.manifest.id, scene.metadata.id, {
        baseRevision: scene.revision,
        title: scene.metadata.title,
        content: "这段内容不应覆盖新版本。",
      }),
    ).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });

    expect((await store.getScene(series.manifest.id, scene.metadata.id)).revision).toBe(updated.revision);
  });

  it("stores Sections separately and enforces conservative AI context policies", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "纸上暗室" });
    const scene = series.scenes[0]!;
    const note = await store.createSceneSection(series.manifest.id, scene.metadata.id, {
      title: "作者手记",
      kind: "author-note",
      content: "这里要更安静。",
    });
    const local = await store.createSceneSection(series.manifest.id, scene.metadata.id, {
      title: "本地资料",
      kind: "research",
      content: "仅供本地模型。",
    });
    const sensitive = await store.createSceneSection(series.manifest.id, scene.metadata.id, {
      title: "私人备注",
      kind: "sensitive",
      content: "永不提供给 AI。",
    });

    expect(sensitive.metadata.aiPolicy).toBe("never");
    expect((await store.getScene(series.manifest.id, scene.metadata.id)).content).toBe("");
    expect((await store.listSceneSectionsForContext(series.manifest.id, scene.metadata.id))
      .map((section) => section.metadata.id)).toEqual([note.metadata.id, local.metadata.id]);

    const updated = await store.updateSceneSection(series.manifest.id, note.metadata.id, {
      baseRevision: note.revision,
      content: "保留这一段停顿。",
    });
    await expect(store.updateSceneSection(series.manifest.id, note.metadata.id, {
      baseRevision: note.revision,
      content: "过期内容",
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });
    expect((await store.listSceneSections(series.manifest.id, scene.metadata.id))
      .find((section) => section.metadata.id === note.metadata.id)?.content).toBe("保留这一段停顿。");

    const archived = await store.archiveSceneSection(series.manifest.id, updated.metadata.id, {
      baseRevision: updated.revision,
    });
    expect(archived.metadata.archivedAt).not.toBeNull();
    expect((await store.listSceneSectionsForContext(series.manifest.id, scene.metadata.id))
      .map((section) => section.metadata.id)).not.toContain(note.metadata.id);
    const restored = await store.restoreSceneSection(series.manifest.id, archived.metadata.id, {
      baseRevision: archived.revision,
    });
    expect(restored.metadata.archivedAt).toBeNull();
    expect((await store.listSceneSectionsForContext(series.manifest.id, scene.metadata.id))
      .map((section) => section.metadata.id)).toContain(note.metadata.id);
  });

  it("relocates review anchors by exact evidence and leaves their files unchanged on reads", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "雾中证词" });
    const initial = series.scenes[0]!;
    const content = "门外下着雨。\n\n周野把信压在灯下。\n\n钟声响了三次。";
    const scene = await store.updateScene(series.manifest.id, initial.metadata.id, {
      baseRevision: initial.revision,
      title: "雨夜",
      content,
    });
    const quote = "周野把信压在灯下。";
    const start = content.indexOf(quote);
    const created = await store.createReviewAnchor(series.manifest.id, scene.metadata.id, {
      baseRevision: scene.revision,
      exactQuote: quote,
      start,
      end: start + quote.length,
    });
    const root = seriesRoot(store, "雾中证词", series.manifest.id);
    const anchorFile = path.join(root, "review", "anchors", `${created.anchor.id}.json`);
    const beforeRead = await readFile(anchorFile, "utf8");

    const movedScene = await store.updateScene(series.manifest.id, scene.metadata.id, {
      baseRevision: scene.revision,
      title: "雨夜",
      content: `一辆车驶过巷口。\n\n${content}`,
    });
    const [relocated] = await store.listReviewAnchors(series.manifest.id, movedScene.metadata.id);
    expect(relocated?.resolution).toMatchObject({ status: "relocated" });
    expect(relocated?.resolution.start).toBeGreaterThan(start);
    expect(await readFile(anchorFile, "utf8")).toBe(beforeRead);

    await store.updateScene(series.manifest.id, movedScene.metadata.id, {
      baseRevision: movedScene.revision,
      title: "雨夜",
      content: "所有灯都熄灭了。",
    });
    const [orphaned] = await store.listReviewAnchors(series.manifest.id, scene.metadata.id);
    expect(orphaned?.resolution).toMatchObject({ status: "orphaned", start: null, end: null });
  });

  it("does not guess between equally supported anchor candidates", () => {
    const quote = "他没有回头。";
    const anchor = {
      schemaVersion: 1 as const,
      id: "00000000-0000-4000-8000-000000000001",
      sceneId: "00000000-0000-4000-8000-000000000002",
      blockId: "00000000-0000-4000-8000-000000000003",
      sceneRevision: "0".repeat(64),
      exactQuote: quote,
      prefix: "",
      suffix: "",
      start: 100,
      end: 100 + quote.length,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(resolveReviewAnchor(anchor, `${quote}\n\n${quote}`).status).toBe("orphaned");
    expect(isSceneSectionEligibleForContext("never")).toBe(false);
    expect(isSceneSectionEligibleForContext("inherit")).toBe(true);
  });

  it("stores Codex Canon and Research separately with revision-protected custom categories", async () => {
    const store = await repository();
    const title = "人物档案";
    const series = await store.createSeries({ title });
    const category = await store.createCodexCategory(series.manifest.id, {
      name: "神话生物",
      icon: "兽",
    });
    const updatedCategory = await store.updateCodexCategory(
      series.manifest.id,
      category.category.id,
      {
        baseRevision: category.revision!,
        name: "异兽",
      },
    );
    await expect(
      store.updateCodexCategory(series.manifest.id, category.category.id, {
        baseRevision: category.revision!,
        name: "过期改名",
      }),
    ).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });

    const entry = await store.createCodexEntry(series.manifest.id, {
      categoryId: updatedCategory.category.id,
      name: "白泽",
      aliases: ["泽兽"],
      description: "能言，通万物之情。",
      research: "现实资料尚待核实。",
    });
    const root = seriesRoot(store, title, series.manifest.id);
    const entryFile = path.join(
      root,
      "codex",
      "custom",
      updatedCategory.category.id,
      `${entry.metadata.id}.json`,
    );
    const researchFile = path.join(
      root,
      "codex",
      "entry-research",
      `${entry.metadata.id}.json`,
    );
    expect(await readFile(entryFile, "utf8")).toContain("能言，通万物之情。");
    expect(await readFile(entryFile, "utf8")).not.toContain("现实资料尚待核实。");
    expect(await readFile(researchFile, "utf8")).toContain("现实资料尚待核实。");

    const updated = await store.updateCodexEntry(series.manifest.id, entry.metadata.id, {
      baseRevision: entry.revision,
      baseResearchRevision: entry.research.revision,
      description: "能言，知天下万物。",
      research: "参考《山海经》相关记载。",
    });
    await expect(
      store.updateCodexEntry(series.manifest.id, entry.metadata.id, {
        baseResearchRevision: entry.research.revision,
        research: "过期研究",
      }),
    ).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });
    expect((await store.getCodexEntry(series.manifest.id, entry.metadata.id)).description).toBe(
      "能言，知天下万物。",
    );

    await expect(
      store.archiveCodexCategory(series.manifest.id, category.category.id, {
        baseRevision: updatedCategory.revision!,
      }),
    ).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    const archivedEntry = await store.archiveCodexEntry(
      series.manifest.id,
      entry.metadata.id,
      { baseRevision: updated.revision },
    );
    const archivedCategory = await store.archiveCodexCategory(
      series.manifest.id,
      category.category.id,
      { baseRevision: updatedCategory.revision! },
    );
    expect(archivedEntry.metadata.archivedAt).not.toBeNull();
    expect(archivedCategory.category.archivedAt).not.toBeNull();
    const restoredCategory = await store.restoreCodexCategory(
      series.manifest.id,
      category.category.id,
      { baseRevision: archivedCategory.revision! },
    );
    const restoredEntry = await store.restoreCodexEntry(
      series.manifest.id,
      entry.metadata.id,
      { baseRevision: archivedEntry.revision },
    );
    expect(restoredCategory.category.archivedAt).toBeNull();
    expect(restoredEntry.metadata.archivedAt).toBeNull();
  });

  it("moves Codex entry files when the entry category changes", async () => {
    const store = await repository();
    const title = "CodexCategoryMove";
    const series = await store.createSeries({ title });
    const category = await store.createCodexCategory(series.manifest.id, {
      name: "Mechanism",
      icon: "M",
    });
    const entry = await store.createCodexEntry(series.manifest.id, {
      categoryId: "character",
      name: "Harbor Lock",
      description: "Weather door mechanism.",
    });
    const root = seriesRoot(store, title, series.manifest.id);
    const originalFile = path.join(root, "codex", "characters", `${entry.metadata.id}.json`);
    const movedFile = path.join(root, "codex", "custom", category.category.id, `${entry.metadata.id}.json`);
    expect(await readFile(originalFile, "utf8")).toContain("Weather door mechanism.");

    const moved = await store.updateCodexEntry(series.manifest.id, entry.metadata.id, {
      baseRevision: entry.revision,
      categoryId: category.category.id,
    });

    expect(moved.metadata.categoryId).toBe(category.category.id);
    expect(JSON.parse(await readFile(movedFile, "utf8"))).toMatchObject({
      metadata: { categoryId: category.category.id },
    });
    await expect(readFile(originalFile, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    expect((await store.getCodexEntry(series.manifest.id, entry.metadata.id)).metadata.categoryId)
      .toBe(category.category.id);
  });

  it("rejects duplicate custom Codex category names", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "CodexCategoryDuplicate" });
    const category = await store.createCodexCategory(series.manifest.id, {
      name: "Mechanism",
      icon: "M",
    });
    const other = await store.createCodexCategory(series.manifest.id, {
      name: "Weather",
      icon: "W",
    });

    await expect(
      store.createCodexCategory(series.manifest.id, {
        name: "Mechanism",
        icon: "N",
      }),
    ).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    await expect(
      store.updateCodexCategory(series.manifest.id, other.category.id, {
        baseRevision: other.revision!,
        name: category.category.name,
      }),
    ).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
  });

  it("manages reusable Codex detail types and blocks deletion while used", async () => {
    const store = await repository();
    const title = "CodexDetailTypes";
    const series = await store.createSeries({ title });
    const age = await store.createCodexDetailType(series.manifest.id, {
      categoryId: "character",
      name: "年龄",
      nsfw: true,
    });
    const appearance = await store.createCodexDetailType(series.manifest.id, {
      categoryId: "character",
      name: "样貌",
    });
    expect(age.detailType.nsfw).toBe(true);
    expect(appearance.detailType.nsfw).toBe(false);

    const updatedAge = await store.updateCodexDetailType(series.manifest.id, age.detailType.id, {
      baseRevision: age.revision,
      nsfw: false,
    });
    expect(updatedAge.detailType.nsfw).toBe(false);
    expect(updatedAge.revision).not.toBe(age.revision);
    await expect(store.updateCodexDetailType(series.manifest.id, age.detailType.id, {
      baseRevision: age.revision,
      nsfw: true,
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });

    await expect(store.createCodexDetailType(series.manifest.id, {
      categoryId: "character",
      name: "年龄",
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });

    const entry = await store.createCodexEntry(series.manifest.id, {
      categoryId: "character",
      name: "克莉斯多",
      details: { 年龄: "十七岁" },
      detailAiContext: { 年龄: false },
    });

    await expect(store.deleteCodexDetailType(series.manifest.id, updatedAge.detailType.id, {
      baseRevision: updatedAge.revision,
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });

    const deleted = await store.deleteCodexDetailType(series.manifest.id, appearance.detailType.id, {
      baseRevision: appearance.revision,
    });

    expect(deleted).toEqual({ deletedId: appearance.detailType.id });
    expect((await store.listCodexDetailTypes(series.manifest.id, { categoryId: "character" }))
      .map((document) => ({ name: document.detailType.name, nsfw: document.detailType.nsfw })))
      .toEqual([{ name: "年龄", nsfw: false }]);
    const savedEntry = await store.getCodexEntry(series.manifest.id, entry.metadata.id);
    expect(savedEntry.metadata.details).toEqual({ 年龄: "十七岁" });
    expect(savedEntry.metadata.detailAiContext).toEqual({ 年龄: false });
    await expect(readFile(
      path.join(seriesRoot(store, title, series.manifest.id), "codex", "detail-types", `${appearance.detailType.id}.json`),
      "utf8",
    )).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("blocks deleting Codex detail types used by id-keyed entry details", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "CodexDetailTypeIdUsage" });
    const detailType = await store.createCodexDetailType(series.manifest.id, {
      categoryId: "character",
      name: "Current knowledge",
    });
    await store.createCodexEntry(series.manifest.id, {
      categoryId: "character",
      name: "Lena Vale",
      details: { [detailType.detailType.id]: "Knows the blue-salt key opens Tide Office locks." },
      detailAiContext: { [detailType.detailType.id]: true },
    });

    await expect(store.deleteCodexDetailType(series.manifest.id, detailType.detailType.id, {
      baseRevision: detailType.revision,
    })).rejects.toMatchObject<Partial<StorageError>>({
      code: "INVALID_DATA",
      details: expect.objectContaining({
        detailTypeId: detailType.detailType.id,
        detailTypeName: "Current knowledge",
      }),
    });
  });

  it("deletes custom Codex categories without deleting their entries", async () => {
    const store = await repository();
    const title = "CodexCategoryDelete";
    const series = await store.createSeries({ title });
    const category = await store.createCodexCategory(series.manifest.id, {
      name: "Mechanism",
      icon: "M",
    });
    const entry = await store.createCodexEntry(series.manifest.id, {
      categoryId: category.category.id,
      name: "Harbor Lock",
      description: "Weather door mechanism.",
      research: "Private research note.",
    });
    const root = seriesRoot(store, title, series.manifest.id);
    const customFile = path.join(root, "codex", "custom", category.category.id, `${entry.metadata.id}.json`);
    const uncategorizedFile = path.join(root, "codex", "uncategorized", `${entry.metadata.id}.json`);
    const researchFile = path.join(root, "codex", "entry-research", `${entry.metadata.id}.json`);

    const deleted = await store.deleteCodexCategory(series.manifest.id, category.category.id, {
      baseRevision: category.revision!,
    });

    expect(deleted).toEqual({
      deletedId: category.category.id,
      movedEntryIds: [entry.metadata.id],
    });
    await expect(readFile(customFile, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    expect(JSON.parse(await readFile(uncategorizedFile, "utf8"))).toMatchObject({
      metadata: { categoryId: "uncategorized" },
    });
    expect(await readFile(researchFile, "utf8")).toContain("Private research note.");
    expect((await store.getCodexEntry(series.manifest.id, entry.metadata.id)).metadata.categoryId)
      .toBe("uncategorized");
    expect((await store.listCodexCategories(series.manifest.id)).some((document) =>
      document.category.id === category.category.id,
    )).toBe(false);
  });

  it("deletes Codex entries and their research files", async () => {
    const store = await repository();
    const title = "CodexEntryDelete";
    const series = await store.createSeries({ title });
    const entry = await store.createCodexEntry(series.manifest.id, {
      categoryId: "character",
      name: "Harbor Lock",
      research: "Delete this research note.",
    });
    const root = seriesRoot(store, title, series.manifest.id);
    const entryFile = path.join(root, "codex", "characters", `${entry.metadata.id}.json`);
    const researchFile = path.join(root, "codex", "entry-research", `${entry.metadata.id}.json`);

    await expect(store.deleteCodexEntry(series.manifest.id, entry.metadata.id, {
      baseRevision: "0".repeat(64),
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });

    const deleted = await store.deleteCodexEntry(series.manifest.id, entry.metadata.id, {
      baseRevision: entry.revision,
    });

    expect(deleted).toEqual({ deletedId: entry.metadata.id });
    await expect(readFile(entryFile, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(researchFile, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(store.getCodexEntry(series.manifest.id, entry.metadata.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "NOT_FOUND" });
  });

  it("indexes aliases, exclusions, English plurals and same-range ambiguity without changing scenes", async () => {
    const store = await repository();
    const title = "名称索引";
    const series = await store.createSeries({ title });
    const initial = series.scenes[0]!;
    const scene = await store.updateScene(series.manifest.id, initial.metadata.id, {
      baseRevision: initial.revision,
      title: "名字",
      content: "林岚和阿岚走过林岚港。A fox watches two foxes。夜鸦落在窗边。",
    });
    const beforeScene = await readFile(
      path.join(seriesRoot(store, title, series.manifest.id), scene.relativePath),
      "utf8",
    );
    const lin = await store.createCodexEntry(series.manifest.id, {
      categoryId: "character",
      name: "林岚",
      aliases: ["阿岚"],
      mention: {
        caseSensitive: false,
        matchAliases: true,
        automaticPlural: false,
        excludedTerms: ["林岚港"],
      },
    });
    const fox = await store.createCodexEntry(series.manifest.id, {
      categoryId: "object",
      name: "fox",
      mention: {
        caseSensitive: false,
        matchAliases: false,
        automaticPlural: true,
        excludedTerms: [],
      },
    });
    const ravenA = await store.createCodexEntry(series.manifest.id, {
      categoryId: "character",
      name: "夜鸦",
    });
    const ravenB = await store.createCodexEntry(series.manifest.id, {
      categoryId: "organization",
      name: "夜鸦",
    });
    const shortLin = await store.createCodexEntry(series.manifest.id, {
      categoryId: "organization",
      name: "林",
      mention: {
        caseSensitive: false,
        matchAliases: true,
        automaticPlural: false,
        excludedTerms: ["林岚港"],
      },
    });

    const indexed = await store.listCodexMentionsForScene(
      series.manifest.id,
      scene.metadata.id,
    );
    expect(indexed.mentions.filter((mention) => mention.entryId === lin.metadata.id))
      .toHaveLength(2);
    expect(indexed.mentions.filter((mention) => mention.entryId === fox.metadata.id))
      .toHaveLength(2);
    expect(indexed.mentions.some((mention) => mention.matchedText === "林岚港")).toBe(false);
    expect(indexed.mentions.some((mention) => mention.entryId === ravenA.metadata.id)).toBe(false);
    expect(indexed.mentions.some((mention) => mention.entryId === ravenB.metadata.id)).toBe(false);
    expect(indexed.ambiguities).toHaveLength(1);
    expect(indexed.ambiguities[0]!.candidateEntryIds.sort()).toEqual(
      [ravenA.metadata.id, ravenB.metadata.id].sort(),
    );
    expect(
      await readFile(
        path.join(seriesRoot(store, title, series.manifest.id), scene.relativePath),
        "utf8",
      ),
    ).toBe(beforeScene);

    const pure = findCodexMentionsInContent(
      scene.metadata.id,
      "林岚港 林岚",
      [lin, shortLin],
    );
    expect(pure.mentions.map((mention) => mention.matchedText)).toEqual(["林岚"]);
    expect(pure.mentions[0]!.entryId).toBe(lin.metadata.id);

    await store.updateScene(series.manifest.id, scene.metadata.id, {
      baseRevision: scene.revision,
      title: scene.metadata.title,
      content: "林岚和阿岚离开了港口。",
    });
    expect((await store.listCodexMentionsForEntry(series.manifest.id, fox.metadata.id)))
      .toHaveLength(0);
    expect((await store.listCodexMentionsForEntry(series.manifest.id, lin.metadata.id)))
      .toHaveLength(2);

    const archived = await store.archiveCodexEntry(series.manifest.id, lin.metadata.id, {
      baseRevision: lin.revision,
    });
    expect((await store.listCodexMentionsForEntry(series.manifest.id, lin.metadata.id)))
      .toHaveLength(0);
    await store.restoreCodexEntry(series.manifest.id, lin.metadata.id, {
      baseRevision: archived.revision,
    });
    expect((await store.listCodexMentionsForEntry(series.manifest.id, lin.metadata.id)))
      .toHaveLength(2);
  });

  it("keeps relation direction and conservatively previews Codex context policies", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "关系图" });
    const initial = series.scenes[0]!;
    const scene = await store.updateScene(series.manifest.id, initial.metadata.id, {
      baseRevision: initial.revision,
      title: "相遇",
      content: "林岚见到了周野。",
    });
    const lin = await store.createCodexEntry(series.manifest.id, {
      categoryId: "character",
      name: "林岚",
      aiContextPolicy: "on-mention",
    });
    const zhou = await store.createCodexEntry(series.manifest.id, {
      categoryId: "character",
      name: "周野",
      aiContextPolicy: "never",
    });
    const always = await store.createCodexEntry(series.manifest.id, {
      categoryId: "lore",
      name: "雾港法则",
      aiContextPolicy: "always",
    });
    const manual = await store.createCodexEntry(series.manifest.id, {
      categoryId: "object",
      name: "旧钥匙",
      aiContextPolicy: "manual",
    });
    const directed = await store.createCodexRelation(series.manifest.id, {
      sourceEntryId: lin.metadata.id,
      targetEntryId: zhou.metadata.id,
      type: "信任",
      directed: true,
    });
    const updatedDirected = await store.updateCodexRelation(
      series.manifest.id,
      directed.relation.id,
      {
        baseRevision: directed.revision,
        description: "林岚单方面信任周野。",
      },
    );
    await expect(
      store.updateCodexRelation(series.manifest.id, directed.relation.id, {
        baseRevision: directed.revision,
        description: "过期关系",
      }),
    ).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });
    const undirected = await store.createCodexRelation(series.manifest.id, {
      sourceEntryId: lin.metadata.id,
      targetEntryId: manual.metadata.id,
      type: "共同持有",
      directed: false,
    });
    const fromZhou = await store.listCodexRelations(series.manifest.id, {
      entryId: zhou.metadata.id,
    });
    expect(fromZhou[0]!.relation).toMatchObject({
      id: updatedDirected.relation.id,
      sourceEntryId: lin.metadata.id,
      targetEntryId: zhou.metadata.id,
      directed: true,
    });
    const fromManual = await store.listCodexRelations(series.manifest.id, {
      entryId: manual.metadata.id,
    });
    expect(fromManual[0]!.relation.id).toBe(undirected.relation.id);

    const automatic = await store.previewCodexContext(
      series.manifest.id,
      scene.metadata.id,
    );
    expect(automatic.included.map((entry) => entry.metadata.id)).toEqual(
      expect.arrayContaining([lin.metadata.id, always.metadata.id]),
    );
    expect(automatic.included.map((entry) => entry.metadata.id)).not.toContain(
      zhou.metadata.id,
    );
    expect(automatic.included.map((entry) => entry.metadata.id)).not.toContain(
      manual.metadata.id,
    );
    const pinned = await store.previewCodexContext(
      series.manifest.id,
      scene.metadata.id,
      [manual.metadata.id, zhou.metadata.id],
    );
    expect(pinned.included.map((entry) => entry.metadata.id)).toContain(manual.metadata.id);
    expect(pinned.included.map((entry) => entry.metadata.id)).not.toContain(zhou.metadata.id);
    expect(codexContextEligibility("unknown", {
      mentioned: true,
      pinned: true,
      archived: false,
    })).toMatchObject({ eligible: false, reason: "never" });
    await expect(
      store.createCodexRelation(series.manifest.id, {
        sourceEntryId: lin.metadata.id,
        targetEntryId: "00000000-0000-4000-8000-000000000999",
        type: "不存在",
      }),
    ).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
  });

  it("rejects Codex files whose file name, JSON metadata ID or category directory disagree", async () => {
    const store = await repository();
    const title = "损坏档案";
    const series = await store.createSeries({ title });
    const entry = await store.createCodexEntry(series.manifest.id, {
      categoryId: "character",
      name: "林岚",
    });
    const root = seriesRoot(store, title, series.manifest.id);
    const entryFile = path.join(
      root,
      "codex",
      "characters",
      `${entry.metadata.id}.json`,
    );
    const raw = await readFile(entryFile, "utf8");
    await writeFile(
      entryFile,
      raw.replace('"categoryId": "character"', '"categoryId": "location"'),
      "utf8",
    );
    await expect(store.listCodexEntries(series.manifest.id)).rejects.toMatchObject<
      Partial<StorageError>
    >({ code: "INVALID_DATA" });
  });

  it("physically rebuilds Codex search, mentions and ambiguity after deleting SQLite", async () => {
    const store = await repository();
    const title = "重建故事记忆";
    const series = await store.createSeries({ title });
    const initial = series.scenes[0]!;
    const scene = await store.updateScene(series.manifest.id, initial.metadata.id, {
      baseRevision: initial.revision,
      title: "港口",
      content: "守门人站在潮门前。",
    });
    await store.createCodexEntry(series.manifest.id, {
      categoryId: "character",
      name: "守门人",
      description: "潮门最后的看守者。",
    });
    await store.createCodexEntry(series.manifest.id, {
      categoryId: "organization",
      name: "守门人",
      research: "名称可能同时指一个秘密组织。",
    });
    const root = seriesRoot(store, title, series.manifest.id);
    await rm(path.join(root, ".studio", "index.sqlite"));
    expect(await store.searchCodex(series.manifest.id, "看守者")).toEqual([]);

    const rebuilt = await store.rebuildIndex(series.manifest.id);
    expect(rebuilt).toMatchObject({
      indexedScenes: 1,
      indexedCodexEntries: 2,
      indexedMentions: 0,
      ambiguousMentions: 1,
    });
    expect((await store.search(series.manifest.id, "潮门"))[0]!.sceneId).toBe(
      scene.metadata.id,
    );
    expect((await store.searchCodex(series.manifest.id, "看守者"))).toHaveLength(1);
    expect((await store.listCodexMentionsForScene(series.manifest.id, scene.metadata.id))
      .ambiguities).toHaveLength(1);
  });

  it("indexes scene search and Codex mentions from plain text block projection", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "PlainTextProjection" });
    const scene = await store.updateScene(series.manifest.id, series.scenes[0]!.metadata.id, {
      baseRevision: series.scenes[0]!.revision,
      title: "Projection Scene",
      content: "# Signal Heading\n\n> Alias Hero\n\n***\n\nFinal words.",
    });
    await store.createCodexEntry(series.manifest.id, {
      categoryId: "character",
      name: "Alias Hero",
    });

    const mentions = await store.listCodexMentionsForScene(series.manifest.id, scene.metadata.id);
    expect(mentions.mentions).toHaveLength(1);
    expect(mentions.mentions[0]!.matchedText).toBe("Alias Hero");
    expect(mentions.mentions[0]!.start).toBe("Signal Heading\n\n".length);
    expect((await store.search(series.manifest.id, "Signal"))[0]!.excerpt).not.toContain("#");
  });

  it("projects Progression additions and replacements by narrative scene without leaking future facts", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "状态沿革" });
    const opening = await store.updateScene(series.manifest.id, series.scenes[0]!.metadata.id, {
      baseRevision: series.scenes[0]!.revision,
      title: "取得钥匙",
      content: "林岚第一次握住旧钥匙。",
    });
    const lost = await store.createScene(series.manifest.id, {
      title: "遗失钥匙",
      content: "旧钥匙落进了潮水。",
    });
    const marked = await store.createScene(series.manifest.id, {
      title: "留下痕迹",
      content: "林岚的袖口留下潮水味。",
    });
    const lin = await store.createCodexEntry(series.manifest.id, {
      categoryId: "character",
      name: "林岚",
      description: "调查员。",
    });

    const holding = await store.createCodexProgression(series.manifest.id, {
      kind: "world",
      entryId: lin.metadata.id,
      relationId: null,
      fieldKey: "持有物",
      operation: "add",
      body: "林岚持有旧钥匙。",
      summary: "林岚持有旧钥匙。",
      effectiveFromSceneId: opening.metadata.id,
      source: { kind: "codex-page", sceneId: null, blockId: null },
      evidence: [{
        sourceType: "scene",
        sourceId: opening.metadata.id,
        quote: "林岚第一次握住旧钥匙。",
        note: "正文写出她获得旧钥匙。",
      }],
    });
    const lostKey = await store.createCodexProgression(series.manifest.id, {
      kind: "world",
      entryId: lin.metadata.id,
      relationId: null,
      fieldKey: "持有物",
      operation: "replace",
      body: "林岚失去旧钥匙。",
      summary: "林岚失去旧钥匙。",
      effectiveFromSceneId: lost.metadata.id,
      source: { kind: "codex-page", sceneId: null, blockId: null },
      evidence: [{
        sourceType: "scene",
        sourceId: lost.metadata.id,
        quote: "旧钥匙落进了潮水。",
        note: "正文明确写出旧钥匙离手。",
      }],
    });
    const trace = await store.createCodexProgression(series.manifest.id, {
      kind: "world",
      entryId: lin.metadata.id,
      relationId: null,
      fieldKey: "持有物",
      operation: "add",
      body: "林岚身上留下潮水痕迹。",
      summary: "林岚身上留下潮水痕迹。",
      effectiveFromSceneId: marked.metadata.id,
      source: { kind: "codex-page", sceneId: null, blockId: null },
      evidence: [{
        sourceType: "scene",
        sourceId: marked.metadata.id,
        quote: "林岚的袖口留下潮水味。",
        note: "后续痕迹追加到同一状态槽。",
      }],
    });

    expect(await store.listCodexProgressions(series.manifest.id, {
      entryId: lin.metadata.id,
      includeArchived: true,
    })).toHaveLength(3);

    const beforeFuture = await store.getCodexEffectiveState(
      series.manifest.id,
      opening.metadata.id,
      lin.metadata.id,
    );
    expect(beforeFuture.worldFacts.map((document) => document.progression.summary))
      .toEqual([holding.progression.summary]);
    expect(beforeFuture.hiddenFutureProgressionCount).toBe(2);
    expect(JSON.stringify(beforeFuture)).not.toContain(lostKey.progression.summary);

    const afterReplacement = await store.getCodexEffectiveState(
      series.manifest.id,
      lost.metadata.id,
      lin.metadata.id,
    );
    expect(afterReplacement.worldFacts.map((document) => document.progression.summary))
      .toEqual([lostKey.progression.summary]);

    const afterAddition = await store.getCodexEffectiveState(
      series.manifest.id,
      marked.metadata.id,
      lin.metadata.id,
    );
    expect(afterAddition.worldFacts.map((document) => document.progression.summary))
      .toEqual([lostKey.progression.summary, trace.progression.summary]);

    const archived = await store.archiveCodexProgression(series.manifest.id, lostKey.progression.id, {
      baseRevision: lostKey.revision,
    });
    expect((await store.getCodexEffectiveState(series.manifest.id, lost.metadata.id, lin.metadata.id))
      .worldFacts.map((document) => document.progression.summary)).toEqual([holding.progression.summary]);
    await store.restoreCodexProgression(series.manifest.id, archived.progression.id, {
      baseRevision: archived.revision,
    });
    expect((await store.getCodexEffectiveState(series.manifest.id, lost.metadata.id, lin.metadata.id))
      .worldFacts.map((document) => document.progression.summary)).toEqual([lostKey.progression.summary]);
  });

  it("isolates world and relationship progressions by same-scene block position", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "Block State Isolation" });
    const scene = await store.updateScene(series.manifest.id, series.scenes[0]!.metadata.id, {
      baseRevision: series.scenes[0]!.revision,
      title: "Two Blocks",
      content: "Before the reveal.\n\nAfter the reveal.",
    });
    const [firstBlock, secondBlock] = scene.document.blocks;
    expect(firstBlock).toBeDefined();
    expect(secondBlock).toBeDefined();
    const lin = await store.createCodexEntry(series.manifest.id, {
      categoryId: "character",
      name: "Lin",
    });
    const zhou = await store.createCodexEntry(series.manifest.id, {
      categoryId: "character",
      name: "Zhou",
    });
    const relation = await store.createCodexRelation(series.manifest.id, {
      sourceEntryId: lin.metadata.id,
      targetEntryId: zhou.metadata.id,
      type: "trust",
      directed: true,
    });
    const worldEmbedded = await store.createSceneProgressionBlock(series.manifest.id, scene.metadata.id, {
      baseRevision: scene.revision,
      afterBlockId: secondBlock!.id,
      progression: {
        kind: "world",
        entryId: lin.metadata.id,
        relationId: null,
        fieldKey: "state",
        operation: "add",
        body: "Lin learns the later-block secret.",
        summary: "Lin learns the later-block secret.",
        evidence: [{
          sourceType: "scene",
          sourceId: scene.metadata.id,
          quote: "After the reveal.",
          note: "The fact appears in the second block.",
        }],
      },
    });
    const relationEmbedded = await store.createSceneProgressionBlock(series.manifest.id, scene.metadata.id, {
      baseRevision: worldEmbedded.scene.revision,
      afterBlockId: secondBlock!.id,
      progression: {
        kind: "relationship",
        entryId: null,
        relationId: relation.relation.id,
        fieldKey: "trust",
        operation: "replace",
        body: "Trust changes in the later block.",
        summary: "Trust changes in the later block.",
        evidence: [{
          sourceType: "scene",
          sourceId: scene.metadata.id,
          quote: "After the reveal.",
          note: "The relation change appears in the second block.",
        }],
      },
    });
    const worldProgression = worldEmbedded.progression;
    const relationProgression = relationEmbedded.progression;

    const before = await store.getCodexEffectiveState(
      series.manifest.id,
      scene.metadata.id,
      lin.metadata.id,
      undefined,
      firstBlock!.id,
    );
    expect(before.worldFacts).toHaveLength(0);
    expect(before.relationStates.flatMap((state) => state.progressions)).toHaveLength(0);
    expect(before.hiddenFutureProgressionCount).toBe(2);
    const beforeJson = JSON.stringify(before);
    expect(beforeJson).not.toContain(worldProgression.progression.id);
    expect(beforeJson).not.toContain(worldProgression.progression.summary);
    expect(beforeJson).not.toContain(relationProgression.progression.id);
    expect(beforeJson).not.toContain(relationProgression.progression.summary);

    const after = await store.getCodexEffectiveState(
      series.manifest.id,
      scene.metadata.id,
      lin.metadata.id,
      undefined,
      worldEmbedded.block.id,
    );
    expect(after.worldFacts.map((document) => document.progression.summary))
      .toEqual([worldProgression.progression.summary]);
    expect(after.relationStates.flatMap((state) => state.progressions)
      .map((document) => document.progression.summary))
      .toEqual([relationProgression.progression.summary]);
    expect(after.hiddenFutureProgressionCount).toBe(0);
  });

  it("treats effectiveToSceneId as an inclusive scene boundary", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "BoundedProgression" });
    const first = await store.updateScene(series.manifest.id, series.scenes[0]!.metadata.id, {
      baseRevision: series.scenes[0]!.revision,
      title: "First",
      content: "First scene.",
    });
    const second = await store.createScene(series.manifest.id, {
      title: "Second",
      content: "Second scene.",
    });
    const third = await store.createScene(series.manifest.id, {
      title: "Third",
      content: "Third scene.",
    });
    const entry = await store.createCodexEntry(series.manifest.id, {
      categoryId: "character",
      name: "Bounded Entry",
      description: "Baseline.",
    });

    await store.createCodexProgression(series.manifest.id, {
      kind: "field",
      entryId: entry.metadata.id,
      relationId: null,
      field: { kind: "description", detailTypeId: null },
      fieldKey: null,
      operation: "add",
      body: "Bounded addition.",
      summary: "Bounded addition.",
      effectiveFromSceneId: first.metadata.id,
      effectiveToSceneId: second.metadata.id,
      source: { kind: "codex-page", sceneId: null, blockId: null },
      evidence: [],
    });

    expect((await store.getCodexEffectiveEntry(
      series.manifest.id,
      entry.metadata.id,
      first.metadata.id,
    )).entry.description).toBe("Bounded addition.\n\nBaseline.");
    expect((await store.getCodexEffectiveEntry(
      series.manifest.id,
      entry.metadata.id,
      second.metadata.id,
    )).entry.description).toBe("Bounded addition.\n\nBaseline.");
    const afterBoundary = await store.getCodexEffectiveEntry(
      series.manifest.id,
      entry.metadata.id,
      third.metadata.id,
    );
    expect(afterBoundary.entry.description).toBe("Baseline.");
    expect(afterBoundary.hiddenFutureFieldProgressionCount).toBe(0);

    await expect(store.createCodexProgression(series.manifest.id, {
      kind: "field",
      entryId: entry.metadata.id,
      relationId: null,
      field: { kind: "description", detailTypeId: null },
      fieldKey: null,
      operation: "add",
      body: "Invalid range.",
      summary: "Invalid range.",
      effectiveFromSceneId: second.metadata.id,
      effectiveToSceneId: first.metadata.id,
      source: { kind: "codex-page", sceneId: null, blockId: null },
      evidence: [],
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
  });

  it("keeps relationship progressions and character knowledge separate from world facts", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "误解与关系" });
    const first = await store.updateScene(series.manifest.id, series.scenes[0]!.metadata.id, {
      baseRevision: series.scenes[0]!.revision,
      title: "合作",
      content: "林岚决定信任周野。",
    });
    const second = await store.createScene(series.manifest.id, {
      title: "误会",
      content: "林岚误以为周野背叛了她。",
    });
    const lin = await store.createCodexEntry(series.manifest.id, {
      categoryId: "character",
      name: "林岚",
    });
    const zhou = await store.createCodexEntry(series.manifest.id, {
      categoryId: "character",
      name: "周野",
    });
    const relation = await store.createCodexRelation(series.manifest.id, {
      sourceEntryId: lin.metadata.id,
      targetEntryId: zhou.metadata.id,
      type: "信任",
      directed: true,
      description: "林岚起初选择信任周野。",
    });
    const changed = await store.createCodexProgression(series.manifest.id, {
      kind: "relationship",
      entryId: null,
      relationId: relation.relation.id,
      fieldKey: "关系状态",
      operation: "replace",
      body: "林岚暂时不再信任周野。",
      summary: "林岚暂时不再信任周野。",
      effectiveFromSceneId: second.metadata.id,
      source: { kind: "codex-page", sceneId: null, blockId: null },
      evidence: [{
        sourceType: "scene",
        sourceId: second.metadata.id,
        quote: "林岚误以为周野背叛了她。",
        note: "正文写出信任关系发生主观转折。",
      }],
    });
    const misunderstanding = await store.createCodexKnowledge(series.manifest.id, {
      characterEntryId: lin.metadata.id,
      subjectEntryId: zhou.metadata.id,
      relationId: relation.relation.id,
      stance: "misunderstands",
      summary: "林岚误以为周野已经背叛。",
      effectiveFromSceneId: second.metadata.id,
      evidence: [{
        sourceType: "scene",
        sourceId: second.metadata.id,
        quote: "林岚误以为周野背叛了她。",
        note: "这是角色主观误解，不自动成为世界真相。",
      }],
    });

    const before = await store.getCodexEffectiveState(
      series.manifest.id,
      first.metadata.id,
      zhou.metadata.id,
      lin.metadata.id,
    );
    expect(before.characterKnowledge).toHaveLength(0);
    expect(before.hiddenFutureKnowledgeCount).toBe(1);
    expect(JSON.stringify(before)).not.toContain(misunderstanding.knowledge.summary);

    const linView = await store.getCodexEffectiveState(
      series.manifest.id,
      second.metadata.id,
      zhou.metadata.id,
      lin.metadata.id,
    );
    expect(linView.characterKnowledge.map((document) => document.knowledge.stance))
      .toEqual(["misunderstands"]);
    expect(linView.characterKnowledge[0]!.knowledge.summary)
      .toBe(misunderstanding.knowledge.summary);
    expect(linView.worldFacts).toHaveLength(0);
    expect(linView.relationStates.flatMap((state) => state.progressions)
      .map((document) => document.progression.summary)).toContain(changed.progression.summary);

    const zhouView = await store.getCodexEffectiveState(
      series.manifest.id,
      second.metadata.id,
      zhou.metadata.id,
      zhou.metadata.id,
    );
    expect(zhouView.characterKnowledge).toHaveLength(0);
    expect((await store.listCodexRelations(series.manifest.id, { entryId: zhou.metadata.id }))
      [0]!.relation.description).toBe("林岚起初选择信任周野。");
  });

  it("rejects invalid Progression and Knowledge references, quotes and stale revisions", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "证据边界" });
    const scene = await store.updateScene(series.manifest.id, series.scenes[0]!.metadata.id, {
      baseRevision: series.scenes[0]!.revision,
      title: "证据场",
      content: "林岚在门口停下。",
    });
    const lin = await store.createCodexEntry(series.manifest.id, {
      categoryId: "character",
      name: "林岚",
    });
    const gate = await store.createCodexEntry(series.manifest.id, {
      categoryId: "location",
      name: "门口",
    });

    await expect(store.createCodexProgression(series.manifest.id, {
      kind: "world",
      entryId: lin.metadata.id,
      relationId: null,
      fieldKey: "位置",
      operation: "add",
      body: "这条证据引文不存在。",
      summary: "这条证据引文不存在。",
      effectiveFromSceneId: scene.metadata.id,
      source: { kind: "codex-page", sceneId: null, blockId: null },
      evidence: [{
        sourceType: "scene",
        sourceId: scene.metadata.id,
        quote: "不存在的引文",
        note: "必须被拒绝。",
      }],
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });

    await expect(store.createCodexKnowledge(series.manifest.id, {
      characterEntryId: gate.metadata.id,
      subjectEntryId: lin.metadata.id,
      stance: "knows",
      summary: "地点不能作为知道者。",
      effectiveFromSceneId: scene.metadata.id,
      evidence: [{
        sourceType: "scene",
        sourceId: scene.metadata.id,
        quote: "林岚在门口停下。",
        note: "知道者类别错误。",
      }],
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });

    const progression = await store.createCodexProgression(series.manifest.id, {
      kind: "world",
      entryId: lin.metadata.id,
      relationId: null,
      fieldKey: "位置",
      operation: "add",
      body: "林岚停在门口。",
      summary: "林岚停在门口。",
      effectiveFromSceneId: scene.metadata.id,
      source: { kind: "codex-page", sceneId: null, blockId: null },
      evidence: [{
        sourceType: "scene",
        sourceId: scene.metadata.id,
        quote: "林岚在门口停下。",
        note: "正文提供位置证据。",
      }],
    });
    const updated = await store.updateCodexProgression(
      series.manifest.id,
      progression.progression.id,
      {
        baseRevision: progression.revision,
        summary: "林岚在门口观察。",
      },
    );
    await expect(store.updateCodexProgression(
      series.manifest.id,
      progression.progression.id,
      {
        baseRevision: progression.revision,
        summary: "过期更新。",
      },
    )).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });
    await expect(store.archiveCodexProgression(series.manifest.id, progression.progression.id, {
      baseRevision: progression.revision,
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });
    expect((await store.getCodexProgression(series.manifest.id, progression.progression.id))
      .progression.summary).toBe(updated.progression.summary);
  });

  it("stores unified field Progressions as JSON and validates sources before delete", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "统一进展" });
    const scene = await store.createScene(series.manifest.id, {
      title: "潮水痕迹",
      content: "林岚的袖口带着潮水味。",
    });
    const blockId = scene.document.blocks[0]!.id;
    const character = await store.createCodexEntry(series.manifest.id, {
      categoryId: "character",
      name: "林岚",
    });
    const detailType = await store.createCodexDetailType(series.manifest.id, {
      categoryId: "character",
      name: "状态",
    });
    const locationDetail = await store.createCodexDetailType(series.manifest.id, {
      categoryId: "location",
      name: "地貌",
    });

    const progression = await store.createCodexProgression(series.manifest.id, {
      kind: "field",
      entryId: character.metadata.id,
      relationId: null,
      field: { kind: "detail", detailTypeId: detailType.detailType.id },
      fieldKey: null,
      operation: "add",
      body: "袖口带着潮水味。",
      summary: "林岚留下潮水痕迹。",
      effectiveFromSceneId: scene.metadata.id,
      source: { kind: "codex-page", sceneId: null, blockId: null },
      evidence: [],
    });

    const root = seriesRoot(store, "统一进展", series.manifest.id);
    const jsonPath = path.join(root, "codex", "progressions", `${progression.progression.id}.json`);
    const oldYamlPath = path.join(root, "codex", "progressions", `${progression.progression.id}.yaml`);
    expect(JSON.parse(await readFile(jsonPath, "utf8"))).toMatchObject({
      id: progression.progression.id,
      kind: "field",
      operation: "add",
    });
    await expect(readFile(oldYamlPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await writeFile(oldYamlPath, [
      `id: ${progression.progression.id}`,
      "kind: field",
      "operation: replace",
      "summary: stale YAML must not be runtime authority",
      "body: stale YAML must not be runtime authority",
    ].join("\n"));

    const listedProgressions = await store.listCodexProgressions(series.manifest.id, {
      kind: "field",
      entryId: character.metadata.id,
    });
    expect(listedProgressions).toHaveLength(1);
    expect(listedProgressions[0]?.progression.summary).toBe(progression.progression.summary);

    const updated = await store.updateCodexProgression(series.manifest.id, progression.progression.id, {
      baseRevision: progression.revision,
      operation: "replace",
      body: "林岚的袖口已经干透。",
      summary: "林岚的潮水痕迹消失。",
    });
    expect(updated.progression.operation).toBe("replace");

    await expect(store.createCodexProgression(series.manifest.id, {
      kind: "field",
      entryId: character.metadata.id,
      relationId: null,
      field: { kind: "description", detailTypeId: null },
      fieldKey: null,
      operation: "add",
      body: "Generic CRUD cannot attach to ordinary manuscript blocks.",
      summary: "Generic CRUD cannot attach to ordinary manuscript blocks.",
      effectiveFromSceneId: scene.metadata.id,
      source: { kind: "write-block", sceneId: scene.metadata.id, blockId },
      evidence: [],
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });

    await expect(store.updateCodexProgression(series.manifest.id, updated.progression.id, {
      baseRevision: updated.revision,
      source: { kind: "write-block", sceneId: scene.metadata.id, blockId },
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });

    await expect(store.createCodexProgression(series.manifest.id, {
      kind: "field",
      entryId: character.metadata.id,
      relationId: null,
      field: { kind: "detail", detailTypeId: locationDetail.detailType.id },
      fieldKey: null,
      operation: "add",
      body: "错误详情类型。",
      summary: "错误详情类型。",
      effectiveFromSceneId: scene.metadata.id,
      source: { kind: "codex-page", sceneId: null, blockId: null },
      evidence: [],
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });

    await expect(store.createCodexProgression(series.manifest.id, {
      kind: "field",
      entryId: character.metadata.id,
      relationId: null,
      field: { kind: "description", detailTypeId: null },
      fieldKey: null,
      operation: "add",
      body: "错误 block。",
      summary: "错误 block。",
      effectiveFromSceneId: scene.metadata.id,
      source: {
        kind: "write-block",
        sceneId: scene.metadata.id,
        blockId: "00000000-0000-4000-8000-00000000bad1",
      },
      evidence: [],
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });

    const otherScene = await store.createScene(series.manifest.id, {
      title: "Source mismatch",
      content: "A source block from the wrong scene.",
    });
    await expect(store.createCodexProgression(series.manifest.id, {
      kind: "field",
      entryId: character.metadata.id,
      relationId: null,
      field: { kind: "description", detailTypeId: null },
      fieldKey: null,
      operation: "add",
      body: "Wrong source scene.",
      summary: "Wrong source scene.",
      effectiveFromSceneId: scene.metadata.id,
      source: {
        kind: "write-block",
        sceneId: otherScene.metadata.id,
        blockId: otherScene.document.blocks[0]!.id,
      },
      evidence: [],
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });

    const otherSeries = await store.createSeries({ title: "另一个系列" });
    const otherEntry = await store.createCodexEntry(otherSeries.manifest.id, {
      categoryId: "character",
      name: "周野",
    });
    await expect(store.createCodexProgression(series.manifest.id, {
      kind: "world",
      entryId: otherEntry.metadata.id,
      relationId: null,
      field: null,
      fieldKey: "状态",
      operation: "add",
      body: "跨系列引用。",
      summary: "跨系列引用。",
      effectiveFromSceneId: scene.metadata.id,
      source: { kind: "codex-page", sceneId: null, blockId: null },
      evidence: [{
        sourceType: "scene",
        sourceId: scene.metadata.id,
        quote: "",
        note: "跨系列 entry 必须拒绝。",
      }],
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "NOT_FOUND" });

    const knowledge = await store.createCodexKnowledge(series.manifest.id, {
      characterEntryId: character.metadata.id,
      subjectEntryId: character.metadata.id,
      stance: "knows",
      summary: "林岚知道自己留下痕迹。",
      truthProgressionId: updated.progression.id,
      effectiveFromSceneId: scene.metadata.id,
      evidence: [{
        sourceType: "codex-entry",
        sourceId: character.metadata.id,
        note: "知识引用统一 JSON Progression。",
      }],
    });
    const knowledgeJsonPath = path.join(root, "codex", "knowledge", `${knowledge.knowledge.id}.json`);
    const oldKnowledgeYamlPath = path.join(root, "codex", "knowledge", `${knowledge.knowledge.id}.yaml`);
    expect(JSON.parse(await readFile(knowledgeJsonPath, "utf8"))).toMatchObject({
      id: knowledge.knowledge.id,
      truthProgressionId: updated.progression.id,
    });
    await expect(readFile(oldKnowledgeYamlPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(store.deleteCodexProgression(series.manifest.id, updated.progression.id, {
      baseRevision: updated.revision,
    })).rejects.toMatchObject<Partial<StorageError>>({
      code: "INVALID_DATA",
      details: {
        blockers: [{
          kind: "character-knowledge",
          id: knowledge.knowledge.id,
        }],
      },
    });

    const removable = await store.createCodexProgression(series.manifest.id, {
      kind: "field",
      entryId: character.metadata.id,
      relationId: null,
      field: { kind: "description", detailTypeId: null },
      fieldKey: null,
      operation: "replace",
      body: "",
      summary: "清空描述。",
      effectiveFromSceneId: scene.metadata.id,
      source: { kind: "codex-page", sceneId: null, blockId: null },
      evidence: [],
    });
    expect(await store.deleteCodexProgression(series.manifest.id, removable.progression.id, {
      baseRevision: removable.revision,
    })).toMatchObject({ deletedId: removable.progression.id, blockers: [] });
    await expect(store.getCodexProgression(series.manifest.id, removable.progression.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "NOT_FOUND" });

    const proposalSourced = await store.createCodexProgression(series.manifest.id, {
      kind: "field",
      entryId: character.metadata.id,
      relationId: null,
      field: { kind: "description", detailTypeId: null },
      fieldKey: null,
      operation: "add",
      body: "Proposal-sourced state.",
      summary: "Proposal-sourced state.",
      effectiveFromSceneId: scene.metadata.id,
      source: {
        kind: "proposal",
        sceneId: null,
        blockId: null,
        sourceId: "00000000-0000-4000-8000-00000000f001",
      },
      evidence: [],
    });
    await expect(store.deleteCodexProgression(series.manifest.id, proposalSourced.progression.id, {
      baseRevision: proposalSourced.revision,
    })).rejects.toMatchObject<Partial<StorageError>>({
      code: "INVALID_DATA",
      details: {
        blockers: [{
          kind: "proposal",
          id: "00000000-0000-4000-8000-00000000f001",
        }],
      },
    });
  });

  it("projects effective Codex fields by scene block without leaking future field data", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "Effective Fields" });
    const opening = await store.updateScene(series.manifest.id, series.scenes[0]!.metadata.id, {
      baseRevision: series.scenes[0]!.revision,
      title: "Opening",
      content: "Before signal.\n\nMiddle signal.\n\nAfter signal.",
    });
    const future = await store.createScene(series.manifest.id, {
      title: "Future",
      content: "Future reveal.",
    });
    const entry = await store.createCodexEntry(series.manifest.id, {
      categoryId: "character",
      name: "Mira",
      description: "Baseline description.",
    });
    const detailType = await store.createCodexDetailType(series.manifest.id, {
      categoryId: "character",
      name: "Status",
    });
    const entryWithDetail = await store.updateCodexEntry(series.manifest.id, entry.metadata.id, {
      baseRevision: entry.revision,
      details: { [detailType.detailType.id]: "Baseline status." },
    });
    const [firstBlock, secondBlock, thirdBlock] = opening.document.blocks;
    expect(firstBlock).toBeDefined();
    expect(secondBlock).toBeDefined();
    expect(thirdBlock).toBeDefined();

    const baselineOnly = await store.getCodexEffectiveEntry(
      series.manifest.id,
      entryWithDetail.metadata.id,
      opening.metadata.id,
      firstBlock!.id,
    );
    expect(baselineOnly.entry.description).toBe("Baseline description.");
    expect(baselineOnly.entry.metadata.details[detailType.detailType.id]).toBe("Baseline status.");
    expect(baselineOnly.hiddenFutureFieldProgressionCount).toBe(0);
    expect(baselineOnly.fieldStates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        field: { kind: "description", detailTypeId: null },
        source: "baseline",
        lastProgressionId: null,
        hiddenFutureCount: 0,
      }),
      expect.objectContaining({
        field: { kind: "detail", detailTypeId: detailType.detailType.id },
        source: "baseline",
        lastProgressionId: null,
        hiddenFutureCount: 0,
      }),
    ]));

    const firstAddBlock = await store.createSceneProgressionBlock(series.manifest.id, opening.metadata.id, {
      baseRevision: opening.revision,
      afterBlockId: firstBlock!.id,
      progression: {
        kind: "field",
        entryId: entryWithDetail.metadata.id,
        relationId: null,
        field: { kind: "description", detailTypeId: null },
        fieldKey: null,
        operation: "add",
        body: "First block addition.",
        summary: "First block summary.",
        evidence: [],
      },
    });
    const secondAddBlock = await store.createSceneProgressionBlock(series.manifest.id, opening.metadata.id, {
      baseRevision: firstAddBlock.scene.revision,
      afterBlockId: secondBlock!.id,
      progression: {
        kind: "field",
        entryId: entryWithDetail.metadata.id,
        relationId: null,
        field: { kind: "description", detailTypeId: null },
        fieldKey: null,
        operation: "add",
        body: "Second block addition.",
        summary: "Second block summary.",
        evidence: [],
      },
    });
    const thirdReplaceBlock = await store.createSceneProgressionBlock(series.manifest.id, opening.metadata.id, {
      baseRevision: secondAddBlock.scene.revision,
      afterBlockId: thirdBlock!.id,
      progression: {
        kind: "field",
        entryId: entryWithDetail.metadata.id,
        relationId: null,
        field: { kind: "description", detailTypeId: null },
        fieldKey: null,
        operation: "replace",
        body: "Third block replacement.",
        summary: "Third block summary.",
        evidence: [],
      },
    });
    const emptyDetailBlock = await store.createSceneProgressionBlock(series.manifest.id, opening.metadata.id, {
      baseRevision: thirdReplaceBlock.scene.revision,
      afterBlockId: thirdBlock!.id,
      progression: {
        kind: "field",
        entryId: entryWithDetail.metadata.id,
        relationId: null,
        field: { kind: "detail", detailTypeId: detailType.detailType.id },
        fieldKey: null,
        operation: "replace",
        body: "",
        summary: "Clear status.",
        evidence: [],
      },
    });
    const firstAdd = firstAddBlock.progression;
    const secondAdd = secondAddBlock.progression;
    const thirdReplace = thirdReplaceBlock.progression;
    const emptyDetail = emptyDetailBlock.progression;
    const futureAdd = await store.createCodexProgression(series.manifest.id, {
      kind: "field",
      entryId: entryWithDetail.metadata.id,
      relationId: null,
      field: { kind: "description", detailTypeId: null },
      fieldKey: null,
      operation: "add",
      body: "Future addition.",
      summary: "Future summary.",
      effectiveFromSceneId: future.metadata.id,
      source: { kind: "codex-page", sceneId: null, blockId: null },
      evidence: [],
    });

    const atFirstBlock = await store.getCodexEffectiveEntry(
      series.manifest.id,
      entryWithDetail.metadata.id,
      opening.metadata.id,
      firstAddBlock.block.id,
    );
    expect(atFirstBlock.entry.description).toBe("First block addition.\n\nBaseline description.");
    expect(atFirstBlock.entry.metadata.details[detailType.detailType.id]).toBe("Baseline status.");
    expect(atFirstBlock.hiddenFutureFieldProgressionCount).toBe(4);
    const firstDescriptionState = atFirstBlock.fieldStates.find(
      (state) => state.field.kind === "description",
    );
    expect(firstDescriptionState).toMatchObject({
      source: "progression",
      lastProgressionId: firstAdd.progression.id,
      hiddenFutureCount: 3,
    });
    const firstProjection = JSON.stringify(atFirstBlock);
    expect(firstProjection).not.toContain(secondAdd.progression.id);
    expect(firstProjection).not.toContain(secondAdd.progression.body);
    expect(firstProjection).not.toContain(secondAdd.progression.summary);
    expect(firstProjection).not.toContain(thirdReplace.progression.id);
    expect(firstProjection).not.toContain(thirdReplace.progression.body);
    expect(firstProjection).not.toContain(futureAdd.progression.id);
    expect(firstProjection).not.toContain(futureAdd.progression.body);
    expect(firstProjection).not.toContain(futureAdd.progression.summary);

    const atSecondBlock = await store.getCodexEffectiveEntry(
      series.manifest.id,
      entryWithDetail.metadata.id,
      opening.metadata.id,
      secondAddBlock.block.id,
    );
    expect(atSecondBlock.entry.description)
      .toBe("Second block addition.\n\nFirst block addition.\n\nBaseline description.");
    expect(atSecondBlock.hiddenFutureFieldProgressionCount).toBe(3);

    const atThirdBlock = await store.getCodexEffectiveEntry(
      series.manifest.id,
      entryWithDetail.metadata.id,
      opening.metadata.id,
      thirdReplaceBlock.block.id,
    );
    expect(atThirdBlock.entry.description).toBe("Third block replacement.");
    expect(atThirdBlock.entry.metadata.details[detailType.detailType.id]).toBe("");
    expect(atThirdBlock.hiddenFutureFieldProgressionCount).toBe(1);
    expect(atThirdBlock.fieldStates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        field: { kind: "description", detailTypeId: null },
        source: "progression",
        lastProgressionId: thirdReplace.progression.id,
        hiddenFutureCount: 1,
      }),
      expect.objectContaining({
        field: { kind: "detail", detailTypeId: detailType.detailType.id },
        source: "progression",
        lastProgressionId: emptyDetail.progression.id,
        hiddenFutureCount: 0,
      }),
    ]));
    const sceneEnd = await store.getCodexEffectiveEntry(
      series.manifest.id,
      entryWithDetail.metadata.id,
      opening.metadata.id,
    );
    expect(sceneEnd.entry.description).toBe(atThirdBlock.entry.description);
    expect(sceneEnd.entry.metadata.details[detailType.detailType.id]).toBe("");

    await expect(store.getCodexEffectiveEntry(
      series.manifest.id,
      entryWithDetail.metadata.id,
      opening.metadata.id,
      "00000000-0000-4000-8000-00000000bad2",
    )).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
  });

  it("keeps baseline edits dynamic before replace boundaries only", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "Baseline Boundary" });
    const first = await store.updateScene(series.manifest.id, series.scenes[0]!.metadata.id, {
      baseRevision: series.scenes[0]!.revision,
      title: "First",
      content: "First scene.",
    });
    const second = await store.createScene(series.manifest.id, {
      title: "Second",
      content: "Second scene.",
    });
    const third = await store.createScene(series.manifest.id, {
      title: "Third",
      content: "Third scene.",
    });
    const entry = await store.createCodexEntry(series.manifest.id, {
      categoryId: "character",
      name: "Sol",
      description: "Old baseline.",
    });

    await store.createCodexProgression(series.manifest.id, {
      kind: "field",
      entryId: entry.metadata.id,
      relationId: null,
      field: { kind: "description", detailTypeId: null },
      fieldKey: null,
      operation: "add",
      body: "Pre-replace addition.",
      summary: "Pre-replace addition.",
      effectiveFromSceneId: first.metadata.id,
      source: { kind: "codex-page", sceneId: null, blockId: null },
      evidence: [],
    });
    await store.createCodexProgression(series.manifest.id, {
      kind: "field",
      entryId: entry.metadata.id,
      relationId: null,
      field: { kind: "description", detailTypeId: null },
      fieldKey: null,
      operation: "replace",
      body: "Replacement state.",
      summary: "Replacement state.",
      effectiveFromSceneId: second.metadata.id,
      source: { kind: "codex-page", sceneId: null, blockId: null },
      evidence: [],
    });
    await store.createCodexProgression(series.manifest.id, {
      kind: "field",
      entryId: entry.metadata.id,
      relationId: null,
      field: { kind: "description", detailTypeId: null },
      fieldKey: null,
      operation: "add",
      body: "Post-replace addition.",
      summary: "Post-replace addition.",
      effectiveFromSceneId: third.metadata.id,
      source: { kind: "codex-page", sceneId: null, blockId: null },
      evidence: [],
    });

    expect((await store.getCodexEffectiveEntry(
      series.manifest.id,
      entry.metadata.id,
      first.metadata.id,
    )).entry.description).toBe("Pre-replace addition.\n\nOld baseline.");

    const updatedEntry = await store.updateCodexEntry(series.manifest.id, entry.metadata.id, {
      baseRevision: entry.revision,
      description: "New baseline.",
    });

    expect((await store.getCodexEffectiveEntry(
      series.manifest.id,
      updatedEntry.metadata.id,
      first.metadata.id,
    )).entry.description).toBe("Pre-replace addition.\n\nNew baseline.");
    expect((await store.getCodexEffectiveEntry(
      series.manifest.id,
      updatedEntry.metadata.id,
      third.metadata.id,
    )).entry.description).toBe("Post-replace addition.\n\nReplacement state.");
  });

  it("normalizes projected detail values to detail type IDs without leaking legacy name keys", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "Legacy Detail Projection" });
    const scene = await store.updateScene(series.manifest.id, series.scenes[0]!.metadata.id, {
      baseRevision: series.scenes[0]!.revision,
      title: "Projection",
      content: "Projection point.",
    });
    const entry = await store.createCodexEntry(series.manifest.id, {
      categoryId: "character",
      name: "Mira",
    });
    const detailType = await store.createCodexDetailType(series.manifest.id, {
      categoryId: "character",
      name: "Status",
    });
    const legacyEntry = await store.updateCodexEntry(series.manifest.id, entry.metadata.id, {
      baseRevision: entry.revision,
      details: { Status: "Legacy status." },
    });
    await store.createCodexProgression(series.manifest.id, {
      kind: "field",
      entryId: legacyEntry.metadata.id,
      relationId: null,
      field: { kind: "detail", detailTypeId: detailType.detailType.id },
      fieldKey: null,
      operation: "replace",
      body: "",
      summary: "Clear legacy status.",
      effectiveFromSceneId: scene.metadata.id,
      source: { kind: "codex-page", sceneId: null, blockId: null },
      evidence: [],
    });

    const effective = await store.getCodexEffectiveEntry(
      series.manifest.id,
      legacyEntry.metadata.id,
      scene.metadata.id,
    );
    expect(effective.entry.metadata.details[detailType.detailType.id]).toBe("");
    expect(effective.entry.metadata.details.Status).toBeUndefined();
    expect(JSON.stringify(effective)).not.toContain("Legacy status.");
  });

  it("saves a 200,000-character Chinese scene without changing its text", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "长夜手稿" });
    const scene = series.scenes[0]!;
    const content = "潮".repeat(200_000);
    const startedAt = Date.now();
    const updated = await store.updateScene(series.manifest.id, scene.metadata.id, {
      baseRevision: scene.revision,
      title: "长章",
      content,
    });
    expect(updated.content).toBe(content);
    expect(updated.characterCount).toBe(200_000);
    expect(Date.now() - startedAt).toBeLessThan(2_000);
  });

  it("rebuilds the index and searches Chinese content", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "星港来信" });
    const scene = series.scenes[0]!;
    await store.updateScene(series.manifest.id, scene.metadata.id, {
      baseRevision: scene.revision,
      title: "雾中的信号",
      content: "林岚在废弃星港捕捉到一段来自未来的无线电信号。",
    });

    expect((await store.rebuildIndex(series.manifest.id)).indexedScenes).toBe(1);
    const results = await store.search(series.manifest.id, "无线电信号");
    expect(results[0]?.title).toBe("雾中的信号");
  });

  it("creates act and chapter manifests alongside a new series", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "测试层级" });
    const book = series.books[0]!;
    const acts = await store.listActs(series.manifest.id, book.id);
    expect(acts).toHaveLength(1);
    expect(acts[0]!.title).toBe("New Chapter");
    const chapters = await store.listChapters(series.manifest.id, acts[0]!.id);
    expect(chapters).toHaveLength(1);
    expect(chapters[0]!.title).toBe("New Act");
  });

  it("creates a new book with its own first act and chapter", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "多部系列" });
    const secondBook = await store.createBook(series.manifest.id, { title: "第二部" });

    expect(secondBook.order).toBe(2);
    expect(secondBook.title).toBe("第二部");
    const detail = await store.getSeries(series.manifest.id);
    expect(detail.manifest.bookIds).toContain(secondBook.id);
    expect(detail.books.map((book) => book.title)).toEqual(["Volume 1", "第二部"]);
    const acts = await store.listActs(series.manifest.id, secondBook.id);
    expect(acts).toHaveLength(1);
    expect(acts[0]!.title).toBe("New Chapter");
    const chapters = await store.listChapters(series.manifest.id, acts[0]!.id);
    expect(chapters).toHaveLength(1);
    expect(chapters[0]!.title).toBe("New Act");
    expect((await store.validateHierarchy(series.manifest.id)).valid).toBe(true);
  });

  it("deletes a book with descendants and reorders remaining books", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "删除卷测试" });
    const firstBook = series.books[0]!;
    const secondBook = await store.createBook(series.manifest.id, { title: "Second Volume" });

    const result = await store.deleteBook(series.manifest.id, firstBook.id);

    expect(result.deletedId).toBe(firstBook.id);
    expect(result.deletedActIds).toHaveLength(1);
    expect(result.deletedChapterIds).toHaveLength(1);
    expect(result.deletedSceneIds).toEqual([series.scenes[0]!.metadata.id]);
    const detail = await store.getSeries(series.manifest.id);
    expect(detail.books.map((book) => ({ id: book.id, order: book.order, title: book.title }))).toEqual([
      { id: secondBook.id, order: 1, title: "Second Volume" },
    ]);
    expect(detail.scenes).toHaveLength(0);
    expect((await store.validateHierarchy(series.manifest.id)).valid).toBe(true);
  });

  it("preserves entity IDs when renaming a book", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "测试卷重命名" });
    const book = series.books[0]!;
    const updated = await store.updateBook(series.manifest.id, book.id, { title: "Renamed Volume" });

    expect(updated.id).toBe(book.id);
    expect(updated.title).toBe("Renamed Volume");
    expect((await store.getSeries(series.manifest.id)).books[0]!.title).toBe("Renamed Volume");
  });

  it("preserves entity IDs when renaming an act", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "测试重命名" });
    const book = series.books[0]!;
    const [act] = await store.listActs(series.manifest.id, book.id);
    const originalId = act!.id;
    const updated = await store.updateAct(series.manifest.id, originalId, { title: "序幕" });
    expect(updated.id).toBe(originalId);
    expect(updated.title).toBe("序幕");
  });

  it("preserves entity IDs when renaming a chapter", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "测试章重命名" });
    const book = series.books[0]!;
    const [act] = await store.listActs(series.manifest.id, book.id);
    const [chapter] = await store.listChapters(series.manifest.id, act!.id);
    const originalId = chapter!.id;
    const updated = await store.updateChapter(series.manifest.id, originalId, { title: "雨夜" });
    expect(updated.id).toBe(originalId);
    expect(updated.title).toBe("雨夜");
  });

  it("rejects reorder with unknown act IDs", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "测试重排检错" });
    const book = series.books[0]!;
    await expect(
      store.reorderActs(series.manifest.id, book.id, {
        orderedIds: ["00000000-0000-0000-0000-000000000000"],
      }),
    ).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
  });

  it("rejects reorder with unknown chapter IDs", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "测试章重排查错" });
    const book = series.books[0]!;
    const [act] = await store.listActs(series.manifest.id, book.id);
    await expect(
      store.reorderChapters(series.manifest.id, act!.id, {
        orderedIds: ["00000000-0000-0000-0000-000000000000"],
      }),
    ).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
  });

  it("moves a scene to a new chapter and updates both manifests", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "测试移动" });
    const book = series.books[0]!;
    const [act] = await store.listActs(series.manifest.id, book.id);
    const scene = series.scenes[0]!;

    const newChapter = await store.createChapter(series.manifest.id, act!.id, { title: "新章" });

    const moved = await store.moveScene(series.manifest.id, scene.metadata.id, {
      targetChapterId: newChapter.id,
    });

    expect(moved.metadata.chapterId).toBe(newChapter.id);
    expect(moved.metadata.actId).toBe(act!.id);

    // Verify chapter manifests
    const oldChapters = await store.listChapters(series.manifest.id, act!.id);
    const oldChapter = oldChapters.find((c) => c.id === scene.metadata.chapterId)!;
    const updatedNewChapter = oldChapters.find((c) => c.id === newChapter.id)!;
    expect(updatedNewChapter.sceneIds).toContain(scene.metadata.id);
  });

  it("migrates a real M2-style series with missing act/chapter manifests", async () => {
    const store = await repository();
    const title = "待迁移";
    const series = await store.createSeries({ title });
    const book = series.books[0]!;
    const [act] = await store.listActs(series.manifest.id, book.id);
    const [chapter] = await store.listChapters(series.manifest.id, act!.id);
    await store.createScene(series.manifest.id, { title: "第二个场景", content: "正文" }, {
      bookId: book.id,
      actId: act!.id,
      chapterId: chapter!.id,
    });
    const root = seriesRoot(store, title, series.manifest.id);
    await rm(path.join(root, "books", book.id, "acts"), { recursive: true });
    await rm(path.join(root, "books", book.id, "chapters"), { recursive: true });

    const result = await store.migrateToManifests(series.manifest.id);
    expect(result.snapshotPath).toBeTruthy();
    expect(result.actsCreated).toBe(1);
    expect(result.chaptersCreated).toBe(1);

    const chapters = await store.listChapters(series.manifest.id, act!.id);
    const updatedChapter = chapters.find((c) => c.id === chapter!.id)!;
    expect(updatedChapter.sceneIds).toHaveLength(2);
    expect(await store.validateHierarchy(series.manifest.id)).toMatchObject({ valid: true });
  });

  it("fails loudly when a referenced act manifest is missing", async () => {
    const store = await repository();
    const title = "缺失幕";
    const series = await store.createSeries({ title });
    const book = series.books[0]!;
    await rm(path.join(seriesRoot(store, title, series.manifest.id), "books", book.id, "acts", `${book.actIds[0]}.json`));

    await expect(store.listActs(series.manifest.id, book.id)).rejects.toMatchObject<Partial<StorageError>>({
      code: "INVALID_DATA",
    });
  });

  it("fails loudly when a referenced chapter manifest is missing", async () => {
    const store = await repository();
    const title = "缺失章";
    const series = await store.createSeries({ title });
    const book = series.books[0]!;
    const [act] = await store.listActs(series.manifest.id, book.id);
    await rm(path.join(seriesRoot(store, title, series.manifest.id), "books", book.id, "chapters", `${act!.chapterIds[0]}.json`));

    await expect(store.listChapters(series.manifest.id, act!.id)).rejects.toMatchObject<Partial<StorageError>>({
      code: "INVALID_DATA",
    });
  });

  it("rejects incomplete and duplicate reorder lists", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "完整排列" });
    const book = series.books[0]!;
    const second = await store.createAct(series.manifest.id, book.id, { title: "第二幕" });
    const [first] = await store.listActs(series.manifest.id, book.id);

    await expect(
      store.reorderActs(series.manifest.id, book.id, { orderedIds: [first!.id] }),
    ).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    await expect(
      store.reorderActs(series.manifest.id, book.id, { orderedIds: [first!.id, second.id, second.id] }),
    ).rejects.toBeTruthy();
    expect((await store.listActs(series.manifest.id, book.id)).map((act) => act.id)).toEqual([
      first!.id,
      second.id,
    ]);
  });

  it("reorders within the same chapter without duplicating a scene ID", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "同章移动" });
    const first = series.scenes[0]!;
    const second = await store.createScene(series.manifest.id, { title: "第二场", content: "" });

    const moved = await store.moveScene(series.manifest.id, first.metadata.id, {
      targetChapterId: first.metadata.chapterId,
      order: 2,
    });
    const chapter = await store.getChapter(series.manifest.id, first.metadata.chapterId);
    expect(chapter.sceneIds).toEqual([second.metadata.id, first.metadata.id]);
    expect(new Set(chapter.sceneIds).size).toBe(chapter.sceneIds.length);
    expect(moved.metadata.order).toBe(2);
  });

  it("derives the target act during a cross-act scene move and moves the file", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "跨幕移动" });
    const book = series.books[0]!;
    const scene = series.scenes[0]!;
    const targetAct = await store.createAct(series.manifest.id, book.id, { title: "第二幕" });
    const targetChapter = await store.createChapter(series.manifest.id, targetAct.id, { title: "转折" });

    const moved = await store.moveScene(series.manifest.id, scene.metadata.id, {
      targetChapterId: targetChapter.id,
    });
    expect(moved.metadata).toMatchObject({
      bookId: book.id,
      actId: targetAct.id,
      chapterId: targetChapter.id,
      order: 1,
    });
    expect(moved.relativePath.replace(/\\/gu, "/")).toContain(
      `/manuscript/${targetAct.id}/${targetChapter.id}/${scene.metadata.id}.json`,
    );
    expect(await store.validateHierarchy(series.manifest.id)).toMatchObject({ valid: true });
  });

  it("adds a default-created scene to the first real chapter manifest", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "默认落点" });
    const created = await store.createScene(series.manifest.id, { title: "新场景", content: "" });
    const chapter = await store.getChapter(series.manifest.id, created.metadata.chapterId);

    expect(chapter.sceneIds.at(-1)).toBe(created.metadata.id);
    expect(created.metadata.order).toBe(chapter.sceneIds.length);
    expect(await store.validateHierarchy(series.manifest.id)).toMatchObject({ valid: true });
  });

  it("reports damaged hierarchy through explicit validation", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "孤儿检测" });
    const scene = series.scenes[0]!;
    const chapter = await store.getChapter(series.manifest.id, scene.metadata.chapterId);
    await store.reorderScenes(series.manifest.id, chapter.id, { orderedIds: chapter.sceneIds });
    const root = seriesRoot(store, "孤儿检测", series.manifest.id);
    const chapterPath = path.join(root, "books", series.books[0]!.id, "chapters", `${chapter.id}.json`);
    await rm(chapterPath);
    const validation = await store.validateHierarchy(series.manifest.id);
    expect(validation.valid).toBe(false);
    expect(validation.issues.some((issue) => issue.code === "MISSING_CHAPTER")).toBe(true);
  });

  it("rolls back an interrupted multi-file transaction on the next access", async () => {
    const store = await repository();
    const title = "事务恢复";
    const series = await store.createSeries({ title });
    const scene = series.scenes[0]!;
    const root = seriesRoot(store, title, series.manifest.id);
    const chapterFile = path.join(
      root,
      "books",
      series.books[0]!.id,
      "chapters",
      `${scene.metadata.chapterId}.json`,
    );
    const transactionId = "00000000-0000-4000-8000-00000000feed";
    const backupFile = `${chapterFile}.${transactionId}.bak`;
    await rename(chapterFile, backupFile);
    await writeFile(chapterFile, "not: valid: JSON", "utf8");
    const transactionDirectory = path.join(root, ".studio", "transactions");
    await mkdir(transactionDirectory, { recursive: true });
    await writeFile(
      path.join(transactionDirectory, `${transactionId}.json`),
      JSON.stringify({
        id: transactionId,
        status: "committing",
        entries: [{
          target: path.relative(root, chapterFile),
          temporary: null,
          backup: path.relative(root, backupFile),
          hadOriginal: true,
          delete: false,
        }],
      }),
      "utf8",
    );

    expect((await store.getChapter(series.manifest.id, scene.metadata.chapterId)).id).toBe(
      scene.metadata.chapterId,
    );
    expect(await store.validateHierarchy(series.manifest.id)).toMatchObject({ valid: true });
  });

  it("quarantines malformed transaction journals instead of applying recovery", async () => {
    const store = await repository();
    const title = "Malformed Transaction";
    const series = await store.createSeries({ title });
    const root = seriesRoot(store, title, series.manifest.id);
    const transactionDirectory = path.join(root, ".studio", "transactions");
    await mkdir(transactionDirectory, { recursive: true });
    const journalPath = path.join(transactionDirectory, "00000000-0000-4000-8000-00000000bad0.json");
    await writeFile(journalPath, "{ not json", "utf8");

    await expect(store.getSeries(series.manifest.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    await expect(readFile(`${journalPath}.invalid`, "utf8")).resolves.toContain("not json");
  });

  it("builds one planning board with matching hierarchy and narrative order", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "规划投影" });
    const first = series.scenes[0]!;
    const second = await store.createScene(series.manifest.id, { title: "第二场", content: "正文" });
    const characterId = "00000000-0000-4000-8000-000000000101";
    const threadId = "00000000-0000-4000-8000-000000000102";
    await store.updateScenePlanning(series.manifest.id, second.metadata.id, {
      baseRevision: second.revision,
      pov: "林岚",
      characterIds: [characterId],
      plotThreadIds: [threadId],
      tags: ["主线"],
      conflict: "她必须决定是否公开证据。",
      outcome: "她暂时隐瞒证据。",
      plannedCharacters: 1200,
    });

    const board = await store.getPlanningBoard(series.manifest.id);
    expect(board.narrativeScenes.map((scene) => scene.id)).toEqual([
      first.metadata.id,
      second.metadata.id,
    ]);
    expect(board.books[0]!.acts[0]!.chapters[0]!.scenes.map((scene) => scene.id)).toEqual([
      first.metadata.id,
      second.metadata.id,
    ]);
    expect(board.dimensions).toMatchObject({
      povs: ["林岚"],
      characterIds: [characterId],
      plotThreadIds: [threadId],
      tags: ["主线"],
    });
    expect(board.unplacedSceneIds).toEqual([first.metadata.id, second.metadata.id]);
  });

  it("keeps narrative order independent from explicit story event order", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "倒叙时间线" });
    const nowScene = series.scenes[0]!;
    const flashbackScene = await store.createScene(series.manifest.id, { title: "十年前", content: "" });
    const nowEvent = await store.createTimelineEvent(series.manifest.id, {
      title: "调查开始",
      timeKind: "relative",
      timeLabel: "现在",
      sceneIds: [nowScene.metadata.id],
    });
    const pastEvent = await store.createTimelineEvent(series.manifest.id, {
      title: "旧案发生",
      timeKind: "relative",
      timeLabel: "十年前",
      sceneIds: [flashbackScene.metadata.id],
    });
    await store.reorderTimelineEvents(series.manifest.id, {
      orderedIds: [pastEvent.event.id, nowEvent.event.id],
    });

    const board = await store.getPlanningBoard(series.manifest.id);
    expect(board.narrativeScenes.map((scene) => scene.title)).toEqual(["Opening Scene", "十年前"]);
    expect(board.storyEvents.map((event) => event.event.title)).toEqual(["旧案发生", "调查开始"]);
    expect(board.unplacedSceneIds).toEqual([]);
  });

  it("creates, updates, rejects stale updates, reorders and deletes timeline events", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "事件文件" });
    const sceneId = series.scenes[0]!.metadata.id;
    const first = await store.createTimelineEvent(series.manifest.id, {
      title: "第一事件",
      sceneIds: [sceneId],
    });
    const second = await store.createTimelineEvent(series.manifest.id, { title: "第二事件" });
    await expect(
      store.createTimelineEvent(series.manifest.id, {
        title: "坏引用",
        sceneIds: ["00000000-0000-4000-8000-000000000999"],
      }),
    ).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    await expect(
      store.reorderTimelineEvents(series.manifest.id, { orderedIds: [first.event.id] }),
    ).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    const updated = await store.updateTimelineEvent(series.manifest.id, first.event.id, {
      baseRevision: first.revision,
      title: "第一事件（修订）",
      timeKind: "approximate",
      timeLabel: "深秋",
    });
    await expect(
      store.updateTimelineEvent(series.manifest.id, first.event.id, {
        baseRevision: first.revision,
        title: "过期写入",
      }),
    ).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });
    expect((await store.reorderTimelineEvents(series.manifest.id, {
      orderedIds: [second.event.id, first.event.id],
    })).map((event) => event.event.id)).toEqual([second.event.id, first.event.id]);
    expect(await store.deleteTimelineEvent(series.manifest.id, first.event.id, {
      baseRevision: updated.revision,
    })).toEqual({ deletedId: first.event.id });
    expect((await store.getPlanningBoard(series.manifest.id)).storyEvents.map((event) => event.event.id))
      .toEqual([second.event.id]);
  });

  it("reads a legacy project without timeline files without writing one", async () => {
    const store = await repository();
    const title = "旧规划项目";
    const series = await store.createSeries({ title });
    const root = seriesRoot(store, title, series.manifest.id);
    const timelineFile = path.join(root, "planning", "timeline.json");
    await rm(timelineFile);

    const board = await store.getPlanningBoard(series.manifest.id);
    expect(board.storyEvents).toEqual([]);
    expect(board.unplacedSceneIds).toEqual([series.scenes[0]!.metadata.id]);
    await expect(readFile(timelineFile, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("persists all three manual planning divergence decisions with revision protection", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "计划分叉" });
    const original = series.scenes[0]!;
    const flagged = await store.updateScenePlanning(series.manifest.id, original.metadata.id, {
      baseRevision: original.revision,
      planningState: "review-needed",
      divergenceNote: "人物拒绝按原计划离开。",
    });
    const intentional = await store.updateScenePlanning(series.manifest.id, original.metadata.id, {
      baseRevision: flagged.revision,
      planningState: "intentional-deviation",
    });
    const revise = await store.updateScenePlanning(series.manifest.id, original.metadata.id, {
      baseRevision: intentional.revision,
      planningState: "revise-prose",
    });
    const aligned = await store.updateScenePlanning(series.manifest.id, original.metadata.id, {
      baseRevision: revise.revision,
      planningState: "aligned",
      summary: "接受人物留下后的新方向。",
    });

    expect([flagged, intentional, revise, aligned].map((scene) => scene.metadata.planningState))
      .toEqual(["review-needed", "intentional-deviation", "revise-prose", "aligned"]);
    await expect(
      store.updateScenePlanning(series.manifest.id, original.metadata.id, {
        baseRevision: original.revision,
        planningState: "aligned",
      }),
    ).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });
  });
});
