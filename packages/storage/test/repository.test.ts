import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectRepository, StorageError } from "../src/index.js";

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
    expect(await readFile(scenePath, "utf8")).toContain("title: 开篇场景");
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
    expect(acts[0]!.title).toBe("第一幕");
    const chapters = await store.listChapters(series.manifest.id, acts[0]!.id);
    expect(chapters).toHaveLength(1);
    expect(chapters[0]!.title).toBe("第一章");
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
    await rm(path.join(seriesRoot(store, title, series.manifest.id), "books", book.id, "acts", `${book.actIds[0]}.yaml`));

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
    await rm(path.join(seriesRoot(store, title, series.manifest.id), "books", book.id, "chapters", `${act!.chapterIds[0]}.yaml`));

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
      `/manuscript/${targetAct.id}/${targetChapter.id}/${scene.metadata.id}.md`,
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
    const chapterPath = path.join(root, "books", series.books[0]!.id, "chapters", `${chapter.id}.yaml`);
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
      `${scene.metadata.chapterId}.yaml`,
    );
    const transactionId = "interrupted-test";
    const backupFile = `${chapterFile}.${transactionId}.bak`;
    await rename(chapterFile, backupFile);
    await writeFile(chapterFile, "not: valid: yaml", "utf8");
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
});
