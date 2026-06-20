import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
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
      aiPolicy: "local-only",
      content: "仅供本地模型。",
    });
    const sensitive = await store.createSceneSection(series.manifest.id, scene.metadata.id, {
      title: "私人备注",
      kind: "sensitive",
      content: "永不提供给 AI。",
    });

    expect(sensitive.metadata.aiPolicy).toBe("never");
    expect((await store.getScene(series.manifest.id, scene.metadata.id)).content).toBe("");
    expect((await store.listSceneSectionsForContext(series.manifest.id, scene.metadata.id, "local"))
      .map((section) => section.metadata.id)).toEqual([note.metadata.id, local.metadata.id]);
    expect((await store.listSceneSectionsForContext(series.manifest.id, scene.metadata.id, "cloud"))
      .map((section) => section.metadata.id)).toEqual([note.metadata.id]);

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
    expect((await store.listSceneSectionsForContext(series.manifest.id, scene.metadata.id, "local"))
      .map((section) => section.metadata.id)).not.toContain(note.metadata.id);
    const restored = await store.restoreSceneSection(series.manifest.id, archived.metadata.id, {
      baseRevision: archived.revision,
    });
    expect(restored.metadata.archivedAt).toBeNull();
    expect((await store.listSceneSectionsForContext(series.manifest.id, scene.metadata.id, "local"))
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
    const anchorFile = path.join(root, "review", "anchors", `${created.anchor.id}.yaml`);
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
    expect(isSceneSectionEligibleForContext("never", "local")).toBe(false);
    expect(isSceneSectionEligibleForContext("local-only", "cloud")).toBe(false);
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
    expect(board.narrativeScenes.map((scene) => scene.title)).toEqual(["开篇场景", "十年前"]);
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
    const timelineFile = path.join(root, "planning", "timeline.yaml");
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
