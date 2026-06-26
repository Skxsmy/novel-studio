import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe("local API", () => {
  it("reports runtime identity in health checks", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-api-"));
    roots.push(root);
    const startedAt = "2026-06-20T12:00:00.000Z";
    const app = await buildApp({
      libraryRoot: root,
      version: "test-version",
      commit: "abc123def456",
      startedAt,
      workspaceRoot: path.dirname(root),
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      version: "test-version",
      commit: "abc123def456",
      startedAt,
      workspaceRoot: path.dirname(root),
      libraryRoot: root,
    });
    await app.close();
  });

  it("creates, reads and safely updates a scene", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-api-"));
    roots.push(root);
    const app = await buildApp({ libraryRoot: root });

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "纸月亮" },
    });
    expect(createResponse.statusCode).toBe(201);
    const series = createResponse.json();
    const scene = series.scenes[0];

    const updateResponse = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/scenes/${scene.metadata.id}`,
      payload: {
        baseRevision: scene.revision,
        title: "午夜电车",
        content: "最后一班电车驶过没有名字的站台。",
      },
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().content).toContain("最后一班电车");

    const staleResponse = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/scenes/${scene.metadata.id}`,
      payload: {
        baseRevision: scene.revision,
        title: "过期修改",
        content: "不应写入",
      },
    });
    expect(staleResponse.statusCode).toBe(409);
    await app.close();
  });

  it("validates hierarchy and rejects incomplete reorder commands", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-api-"));
    roots.push(root);
    const app = await buildApp({ libraryRoot: root });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "层级接口" },
    });
    const series = created.json();
    const book = series.books[0];
    const secondBookResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/books`,
      payload: { title: "第二部" },
    });
    expect(secondBookResponse.statusCode).toBe(201);
    expect(secondBookResponse.json()).toMatchObject({ title: "第二部", order: 2 });
    const secondBook = secondBookResponse.json();
    const secondBookActs = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/books/${secondBook.id}/acts`,
    });
    const secondBookAct = secondBookActs.json()[0];
    const secondBookChapters = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/acts/${secondBookAct.id}/chapters`,
    });
    const secondBookChapter = secondBookChapters.json()[0];
    const secondBookScene = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/scenes`,
      payload: {
        title: "第二部场景",
        content: "这个场景必须落在第二部。",
        bookId: secondBook.id,
        actId: secondBookAct.id,
        chapterId: secondBookChapter.id,
      },
    });
    expect(secondBookScene.statusCode).toBe(201);
    expect(secondBookScene.json().metadata).toMatchObject({
      bookId: secondBook.id,
      actId: secondBookAct.id,
      chapterId: secondBookChapter.id,
      title: "第二部场景",
    });
    const firstActs = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/books/${book.id}/acts`,
    });
    const firstAct = firstActs.json()[0];
    const secondActResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/books/${book.id}/acts`,
      payload: { title: "第二幕" },
    });
    expect(secondActResponse.statusCode).toBe(201);

    const invalidReorder = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/books/${book.id}/acts/reorder`,
      payload: { orderedIds: [firstAct.id] },
    });
    expect(invalidReorder.statusCode).toBe(422);

    const validation = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/hierarchy/validate`,
    });
    expect(validation.statusCode).toBe(200);
    expect(validation.json()).toMatchObject({ valid: true, bookCount: 2, actCount: 3, sceneCount: 2 });
    await app.close();
  });

  it("serves one planning board and persists timeline and divergence commands", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-api-"));
    roots.push(root);
    const app = await buildApp({ libraryRoot: root });
    const createdResponse = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "规划 API" },
    });
    const series = createdResponse.json();
    const scene = series.scenes[0];

    const planningResponse = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/planning`,
    });
    expect(planningResponse.statusCode).toBe(200);
    expect(planningResponse.json()).toMatchObject({
      seriesId: series.manifest.id,
      unplacedSceneIds: [scene.metadata.id],
    });

    const divergenceResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/series/${series.manifest.id}/scenes/${scene.metadata.id}/planning`,
      payload: {
        baseRevision: scene.revision,
        planningState: "review-needed",
        divergenceNote: "人物改变了行动。",
      },
    });
    expect(divergenceResponse.statusCode).toBe(200);
    expect(divergenceResponse.json().metadata.planningState).toBe("review-needed");

    const eventResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/timeline/events`,
      payload: {
        title: "世界事件",
        timeKind: "relative",
        timeLabel: "十年前",
        sceneIds: [scene.metadata.id],
      },
    });
    expect(eventResponse.statusCode).toBe(201);
    const event = eventResponse.json();

    const staleResponse = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/timeline/events/${event.event.id}`,
      payload: { baseRevision: "0".repeat(64), title: "过期事件" },
    });
    expect(staleResponse.statusCode).toBe(409);

    const updatedBoard = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/planning`,
    });
    expect(updatedBoard.json().storyEvents[0].event.title).toBe("世界事件");
    expect(updatedBoard.json().unplacedSceneIds).toEqual([]);
    await app.close();
  });

  it("serves Sections with policy filtering and validates review anchor evidence", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-api-"));
    roots.push(root);
    const app = await buildApp({ libraryRoot: root });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "写作接口" },
    });
    const series = created.json();
    const scene = series.scenes[0];

    const sensitiveResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/scenes/${scene.metadata.id}/sections`,
      payload: { title: "私人备注", kind: "sensitive", content: "不要发送" },
    });
    expect(sensitiveResponse.statusCode).toBe(201);
    expect(sensitiveResponse.json().metadata.aiPolicy).toBe("never");

    const cloudContext = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/scenes/${scene.metadata.id}/sections/context?target=cloud`,
    });
    expect(cloudContext.statusCode).toBe(200);
    expect(cloudContext.json()).toEqual([]);

    const text = "林岚推开窗。";
    const updated = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/scenes/${scene.metadata.id}`,
      payload: { baseRevision: scene.revision, title: "窗口", content: text },
    });
    const current = updated.json();
    const invalidAnchor = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/scenes/${scene.metadata.id}/anchors`,
      payload: {
        baseRevision: current.revision,
        exactQuote: "错误引用",
        start: 0,
        end: 4,
      },
    });
    expect(invalidAnchor.statusCode).toBe(422);

    const anchorResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/scenes/${scene.metadata.id}/anchors`,
      payload: {
        baseRevision: current.revision,
        exactQuote: text,
        start: 0,
        end: text.length,
      },
    });
    expect(anchorResponse.statusCode).toBe(201);
    expect(anchorResponse.json().resolution.status).toBe("attached");

    const otherCreated = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "另一作品" },
    });
    const otherSeries = otherCreated.json();
    const crossSeries = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${otherSeries.manifest.id}/sections/${sensitiveResponse.json().metadata.id}`,
      payload: { baseRevision: sensitiveResponse.json().revision, content: "越权" },
    });
    expect(crossSeries.statusCode).toBe(404);
    await app.close();
  });

  it("serves revision-protected Codex entries, relations, mentions and context previews", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-api-"));
    roots.push(root);
    const app = await buildApp({ libraryRoot: root });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "Codex 接口" },
    });
    const series = created.json();
    const scene = series.scenes[0];
    const updatedSceneResponse = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/scenes/${scene.metadata.id}`,
      payload: {
        baseRevision: scene.revision,
        title: "会面",
        content: "林岚在潮门见到周野。",
      },
    });
    expect(updatedSceneResponse.statusCode).toBe(200);

    const linResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/entries`,
      payload: {
        categoryId: "character",
        name: "林岚",
        aliases: ["阿岚"],
        description: "调查员。",
        research: "名字来源待定。",
      },
    });
    const zhouResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/entries`,
      payload: {
        categoryId: "character",
        name: "周野",
        aiContextPolicy: "never",
      },
    });
    expect(linResponse.statusCode).toBe(201);
    expect(zhouResponse.statusCode).toBe(201);
    const lin = linResponse.json();
    const zhou = zhouResponse.json();
    expect(lin.metadata).not.toHaveProperty("tags");

    const detailTypeResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/detail-types`,
      payload: {
        categoryId: "character",
        name: "年龄",
      },
    });
    expect(detailTypeResponse.statusCode).toBe(201);
    const detailType = detailTypeResponse.json();
    const detailTypes = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/codex/detail-types?categoryId=character`,
    });
    expect(detailTypes.statusCode).toBe(200);
    expect(detailTypes.json().map((document: { detailType: { name: string } }) => document.detailType.name))
      .toEqual(["年龄"]);

    const updatedLinResponse = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/codex/entries/${lin.metadata.id}`,
      payload: {
        baseRevision: lin.revision,
        details: { 年龄: "二十四岁" },
      },
    });
    expect(updatedLinResponse.statusCode).toBe(200);
    expect(updatedLinResponse.json().metadata.details).toEqual({ 年龄: "二十四岁" });

    const deleteUsedDetailType = await app.inject({
      method: "DELETE",
      url: `/api/v1/series/${series.manifest.id}/codex/detail-types/${detailType.detailType.id}`,
      payload: { baseRevision: detailType.revision },
    });
    expect(deleteUsedDetailType.statusCode).toBe(422);

    const relationResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/relations`,
      payload: {
        sourceEntryId: lin.metadata.id,
        targetEntryId: zhou.metadata.id,
        type: "信任",
        directed: true,
      },
    });
    expect(relationResponse.statusCode).toBe(201);
    expect(relationResponse.json().relation.sourceEntryId).toBe(lin.metadata.id);

    const mentions = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/codex/scenes/${scene.metadata.id}/mentions`,
    });
    expect(mentions.statusCode).toBe(200);
    expect(mentions.json().mentions).toHaveLength(2);

    const context = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/codex/context?sceneId=${scene.metadata.id}&pinnedIds=${zhou.metadata.id}`,
    });
    expect(context.statusCode).toBe(200);
    expect(context.json().included.map((entry: { metadata: { id: string } }) => entry.metadata.id))
      .toContain(lin.metadata.id);
    expect(context.json().included.map((entry: { metadata: { id: string } }) => entry.metadata.id))
      .not.toContain(zhou.metadata.id);

    const stale = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/codex/entries/${lin.metadata.id}`,
      payload: {
        baseRevision: "0".repeat(64),
        description: "不应覆盖",
      },
    });
    expect(stale.statusCode).toBe(409);

    const otherCreated = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "其他 Codex" },
    });
    const crossSeries = await app.inject({
      method: "GET",
      url: `/api/v1/series/${otherCreated.json().manifest.id}/codex/entries/${lin.metadata.id}`,
    });
    expect(crossSeries.statusCode).toBe(404);
    await app.close();
  });

  it("serves effective story facts and character knowledge without leaking future content", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-api-"));
    roots.push(root);
    const app = await buildApp({ libraryRoot: root });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "进展接口" },
    });
    const series = created.json();
    const firstScene = series.scenes[0];
    const updatedFirst = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/scenes/${firstScene.metadata.id}`,
      payload: {
        baseRevision: firstScene.revision,
        title: "初见",
        content: "林岚第一次信任周野。",
      },
    });
    const secondScene = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/scenes`,
      payload: {
        title: "误解",
        content: "林岚误以为周野背叛了她。",
      },
    });
    const lin = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/entries`,
      payload: { categoryId: "character", name: "林岚" },
    });
    const zhou = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/entries`,
      payload: { categoryId: "character", name: "周野" },
    });
    const relation = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/relations`,
      payload: {
        sourceEntryId: lin.json().metadata.id,
        targetEntryId: zhou.json().metadata.id,
        type: "信任",
      },
    });
    const progression = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/progressions`,
      payload: {
        target: {
          kind: "relation",
          entryId: null,
          relationId: relation.json().relation.id,
        },
        fieldKey: "关系状态",
        changeKind: "replacement",
        summary: "林岚暂时不再信任周野。",
        effectiveFromSceneId: secondScene.json().metadata.id,
        evidence: [{
          sourceType: "scene",
          sourceId: secondScene.json().metadata.id,
          quote: "林岚误以为周野背叛了她。",
          note: "关系变化来自第二场正文。",
        }],
      },
    });
    expect(progression.statusCode).toBe(201);
    const knowledge = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/knowledge`,
      payload: {
        characterEntryId: lin.json().metadata.id,
        subjectEntryId: zhou.json().metadata.id,
        relationId: relation.json().relation.id,
        stance: "misunderstands",
        summary: "林岚误以为周野已经背叛。",
        effectiveFromSceneId: secondScene.json().metadata.id,
        evidence: [{
          sourceType: "scene",
          sourceId: secondScene.json().metadata.id,
          quote: "林岚误以为周野背叛了她。",
          note: "这是角色主观误解。",
        }],
      },
    });
    expect(knowledge.statusCode).toBe(201);

    const early = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/codex/effective?sceneId=${updatedFirst.json().metadata.id}&entryId=${zhou.json().metadata.id}&viewerEntryId=${lin.json().metadata.id}`,
    });
    expect(early.statusCode).toBe(200);
    expect(early.json().hiddenFutureProgressionCount).toBe(1);
    expect(early.json().hiddenFutureKnowledgeCount).toBe(1);
    expect(JSON.stringify(early.json())).not.toContain("暂时不再信任");
    expect(JSON.stringify(early.json())).not.toContain("已经背叛");

    const current = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/codex/effective?sceneId=${secondScene.json().metadata.id}&entryId=${zhou.json().metadata.id}&viewerEntryId=${lin.json().metadata.id}`,
    });
    expect(current.statusCode).toBe(200);
    expect(current.json().relationStates[0].progressions[0].progression.summary)
      .toBe("林岚暂时不再信任周野。");
    expect(current.json().characterKnowledge[0].knowledge.stance).toBe("misunderstands");
    expect(current.json().characterKnowledge[0].knowledge.evidence[0].quote)
      .toBe("林岚误以为周野背叛了她。");
    await app.close();
  });
});
