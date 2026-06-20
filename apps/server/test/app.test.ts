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
    expect(validation.json()).toMatchObject({ valid: true, actCount: 2 });
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
});
