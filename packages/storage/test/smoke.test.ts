import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectRepository } from "../src/index.js";

const temporaryDirectories: string[] = [];

async function freshRepository(): Promise<{
  root: string;
  store: ProjectRepository;
}> {
  const root = await mkdtemp(path.join(tmpdir(), "novel-studio-smoke-"));
  temporaryDirectories.push(root);
  return { root, store: new ProjectRepository(root) };
}

async function getSeriesRoot(
  store: ProjectRepository,
  seriesId: string,
): Promise<string> {
  const summary = (await store.listSeries()).find((item) => item.id === seriesId);
  expect(summary).toBeDefined();
  return path.join(store.libraryRoot, summary!.directoryName);
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("M3 to M4 smoke coverage", () => {
  it("keeps a created Chinese scene readable after restart and SQLite rebuild", async () => {
    const { root, store } = await freshRepository();
    const series = await store.createSeries({
      title: "烟测作品",
      description: "用于验证文件为真、索引可重建。",
    });
    const scene = series.scenes[0]!;
    const content = "第一场：雨落在码头。\n\n她把信藏进袖口。";
    const saved = await store.updateScene(series.manifest.id, scene.metadata.id, {
      baseRevision: scene.revision,
      title: "雨夜码头",
      content,
    });

    const seriesRoot = await getSeriesRoot(store, series.manifest.id);
    const sceneFile = await readFile(path.join(seriesRoot, saved.relativePath), "utf8");
    const sceneJson = JSON.parse(sceneFile);
    expect(sceneJson.title).toBe("雨夜码头");
    expect(sceneJson.document.blocks.map((block: { text?: string }) => block.text).join("\n\n"))
      .toBe(content);

    const restarted = new ProjectRepository(root);
    expect((await restarted.getScene(series.manifest.id, scene.metadata.id)).content)
      .toBe(content);

    await Promise.all(
      ["index.sqlite", "index.sqlite-shm", "index.sqlite-wal"].map((fileName) =>
        rm(path.join(seriesRoot, ".studio", fileName), { force: true }),
      ),
    );
    const rebuilt = await restarted.rebuildIndex(series.manifest.id);
    expect(rebuilt).toMatchObject({
      indexedScenes: 1,
      indexedCodexEntries: 0,
      indexedMentions: 0,
    });
    expect((await restarted.search(series.manifest.id, "码头")).map((item) => item.sceneId))
      .toContain(scene.metadata.id);
  });

  it("keeps hierarchy IDs stable while adding books, acts, chapters and moving scenes", async () => {
    const { store } = await freshRepository();
    const series = await store.createSeries({ title: "层级烟测" });
    const book = series.books[0]!;
    const openingScene = series.scenes[0]!;
    const secondBook = await store.createBook(series.manifest.id, {
      title: "第二部",
    });
    const secondAct = await store.createAct(series.manifest.id, book.id, {
      title: "第二幕",
    });
    const secondChapter = await store.createChapter(series.manifest.id, secondAct.id, {
      title: "第二章",
    });
    const newScene = await store.createScene(
      series.manifest.id,
      {
        title: "转场",
        content: "第二幕的新场景。",
      },
      {
        bookId: book.id,
        actId: secondAct.id,
        chapterId: secondChapter.id,
      },
    );

    const moved = await store.moveScene(series.manifest.id, openingScene.metadata.id, {
      targetChapterId: secondChapter.id,
      order: 1,
    });

    expect(secondBook.order).toBe(2);
    expect(moved.metadata.id).toBe(openingScene.metadata.id);
    expect(moved.metadata.bookId).toBe(book.id);
    expect(moved.metadata.actId).toBe(secondAct.id);
    expect(moved.metadata.chapterId).toBe(secondChapter.id);

    const validation = await store.validateHierarchy(series.manifest.id);
    expect(validation).toMatchObject({
      valid: true,
      bookCount: 2,
      actCount: 3,
      chapterCount: 3,
      sceneCount: 2,
    });

    const board = await store.getPlanningBoard(series.manifest.id);
    const targetChapter = board.books[0]!.acts
      .find((act) => act.id === secondAct.id)!
      .chapters.find((chapter) => chapter.id === secondChapter.id)!;
    expect(targetChapter.scenes.map((scene) => scene.id)).toEqual([
      openingScene.metadata.id,
      newScene.metadata.id,
    ]);
  });

  it("indexes Codex mentions, respects context policy and hides future facts", async () => {
    const { store } = await freshRepository();
    const series = await store.createSeries({ title: "设定烟测" });
    const firstScene = series.scenes[0]!;
    const firstContent = "林岚在潮门看见周野。";
    const updatedFirst = await store.updateScene(series.manifest.id, firstScene.metadata.id, {
      baseRevision: firstScene.revision,
      title: "初见",
      content: firstContent,
    });
    const secondContent = "林岚误以为周野背叛了她。";
    const secondScene = await store.createScene(series.manifest.id, {
      title: "误会",
      content: secondContent,
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
    const tideGate = await store.createCodexEntry(series.manifest.id, {
      categoryId: "location",
      name: "潮门",
      aiContextPolicy: "manual",
    });

    const mentions = await store.listCodexMentionsForScene(
      series.manifest.id,
      updatedFirst.metadata.id,
    );
    expect(new Set(mentions.mentions.map((mention) => mention.entryId))).toEqual(new Set([
      lin.metadata.id,
      zhou.metadata.id,
      tideGate.metadata.id,
    ]));

    const unpinnedContext = await store.previewCodexContext(
      series.manifest.id,
      updatedFirst.metadata.id,
    );
    expect(unpinnedContext.included.map((entry) => entry.metadata.id)).toContain(lin.metadata.id);
    expect(unpinnedContext.excluded.find((entry) => entry.entryId === zhou.metadata.id)?.reason)
      .toBe("never");
    expect(unpinnedContext.excluded.find((entry) => entry.entryId === tideGate.metadata.id)?.reason)
      .toBe("manual-only");

    const pinnedContext = await store.previewCodexContext(
      series.manifest.id,
      updatedFirst.metadata.id,
      [tideGate.metadata.id, zhou.metadata.id],
    );
    expect(pinnedContext.included.map((entry) => entry.metadata.id)).toContain(tideGate.metadata.id);
    expect(pinnedContext.included.map((entry) => entry.metadata.id)).not.toContain(zhou.metadata.id);

    await store.createCodexProgression(series.manifest.id, {
      kind: "world",
      entryId: zhou.metadata.id,
      relationId: null,
      fieldKey: "身体状态",
      operation: "replace",
      body: "周野此时已带伤。",
      summary: "周野此时已带伤。",
      effectiveFromSceneId: secondScene.metadata.id,
      source: { kind: "codex-page", sceneId: null, blockId: null },
      evidence: [{
        sourceType: "scene",
        sourceId: secondScene.metadata.id,
        quote: secondContent,
        note: "第二场正文显示关系误会已经发生。",
      }],
    });
    await store.createCodexKnowledge(series.manifest.id, {
      characterEntryId: lin.metadata.id,
      subjectEntryId: zhou.metadata.id,
      relationId: null,
      stance: "misunderstands",
      summary: "林岚误以为周野背叛。",
      effectiveFromSceneId: secondScene.metadata.id,
      evidence: [{
        sourceType: "scene",
        sourceId: secondScene.metadata.id,
        quote: secondContent,
        note: "这是角色视角中的误会，不是世界真相。",
      }],
    });

    const earlyState = await store.getCodexEffectiveState(
      series.manifest.id,
      updatedFirst.metadata.id,
      zhou.metadata.id,
      lin.metadata.id,
    );
    expect(earlyState.hiddenFutureProgressionCount).toBe(1);
    expect(earlyState.hiddenFutureKnowledgeCount).toBe(1);
    expect(JSON.stringify(earlyState)).not.toContain("周野此时已带伤");
    expect(JSON.stringify(earlyState)).not.toContain("林岚误以为周野背叛");

    const currentState = await store.getCodexEffectiveState(
      series.manifest.id,
      secondScene.metadata.id,
      zhou.metadata.id,
      lin.metadata.id,
    );
    expect(currentState.worldFacts[0]?.progression.summary).toBe("周野此时已带伤。");
    expect(currentState.characterKnowledge[0]?.knowledge.summary).toBe("林岚误以为周野背叛。");
  });
});
