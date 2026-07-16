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

  it("moves projects to trash, restores them, and permanently deletes with title confirmation", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-api-"));
    roots.push(root);
    const app = await buildApp({ libraryRoot: root });

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "Project Delete API" },
    });
    expect(createResponse.statusCode).toBe(201);
    const series = createResponse.json();

    const trashed = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/trash`,
    });
    expect(trashed.statusCode).toBe(200);
    expect(trashed.json().archivedAt).not.toBeNull();

    const restored = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/restore`,
    });
    expect(restored.statusCode).toBe(200);
    expect(restored.json().archivedAt).toBeNull();

    const activeDeleteRejected = await app.inject({
      method: "DELETE",
      url: `/api/v1/series/${series.manifest.id}`,
      payload: { confirmTitle: "Project Delete API" },
    });
    expect(activeDeleteRejected.statusCode).toBe(422);

    await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/trash`,
    });
    const rejected = await app.inject({
      method: "DELETE",
      url: `/api/v1/series/${series.manifest.id}`,
      payload: { confirmTitle: "Wrong" },
    });
    expect(rejected.statusCode).toBe(422);

    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/v1/series/${series.manifest.id}`,
      payload: { confirmTitle: "Project Delete API" },
    });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json()).toEqual({ deletedId: series.manifest.id });

    const missing = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}`,
    });
    expect(missing.statusCode).toBe(404);
    await app.close();
  });

  it("serves scene block document update and Markdown export APIs", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-api-"));
    roots.push(root);
    const app = await buildApp({ libraryRoot: root });

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "Document API" },
    });
    expect(createResponse.statusCode).toBe(201);
    const series = createResponse.json();
    const scene = series.scenes[0];

    const initialDocument = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/scenes/${scene.metadata.id}/document`,
    });
    expect(initialDocument.statusCode).toBe(200);
    expect(initialDocument.json()).toMatchObject({
      revision: scene.revision,
      document: { schemaVersion: 1, blocks: [] },
    });

    const stagedDocument = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/scenes/${scene.metadata.id}/document`,
      payload: {
        baseRevision: scene.revision,
        title: "Block API",
        document: {
          schemaVersion: 1,
          blocks: [
            {
              id: "00000000-0000-4000-8000-000000001101",
              kind: "heading",
              level: 3,
              text: "Signal",
            },
            {
              id: "00000000-0000-4000-8000-000000001102",
              kind: "paragraph",
              text: "Scene text from the document endpoint.",
            },
            {
              id: "00000000-0000-4000-8000-000000001103",
              kind: "paragraph",
              text: "Progression placeholder.",
            },
          ],
        },
      },
    });
    expect(stagedDocument.statusCode).toBe(200);

    const entry = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/entries`,
      payload: { categoryId: "character", name: "Signal Keeper" },
    });
    expect(entry.statusCode).toBe(201);
    const embedded = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/scenes/${scene.metadata.id}/progression-blocks`,
      payload: {
        baseRevision: stagedDocument.json().revision,
        afterBlockId: "00000000-0000-4000-8000-000000001102",
        progression: {
          kind: "field",
          entryId: entry.json().metadata.id,
          relationId: null,
          field: { kind: "description", detailTypeId: null },
          fieldKey: null,
          operation: "add",
          body: "The signal changes here.",
          summary: "Signal progression.",
          evidence: [],
        },
      },
    });
    expect(embedded.statusCode).toBe(201);

    const updateDocument = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/scenes/${scene.metadata.id}/document`,
      payload: {
        baseRevision: embedded.json().scene.revision,
        title: "Block API",
        document: {
          schemaVersion: 1,
          blocks: [
            stagedDocument.json().document.blocks[0],
            stagedDocument.json().document.blocks[1],
            embedded.json().block,
          ],
        },
      },
    });
    expect(updateDocument.statusCode).toBe(200);
    expect(updateDocument.json()).toMatchObject({
      metadata: { title: "Block API" },
      content: "### Signal\n\nScene text from the document endpoint.",
      plainText: "Signal\n\nScene text from the document endpoint.",
    });
    expect(updateDocument.json().revision).not.toBe(scene.revision);

    const exportResponse = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/scenes/${scene.metadata.id}/export/markdown`,
    });
    expect(exportResponse.statusCode).toBe(200);
    expect(exportResponse.json()).toEqual({
      sceneId: scene.metadata.id,
      revision: updateDocument.json().revision,
      markdown: "### Signal\n\nScene text from the document endpoint.",
    });
    expect(exportResponse.json().markdown).not.toContain("codexProgression");
    expect(exportResponse.json().markdown).not.toContain(embedded.json().progression.progression.id);

    const staleResponse = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/scenes/${scene.metadata.id}/document`,
      payload: {
        baseRevision: scene.revision,
        document: { schemaVersion: 1, blocks: [] },
      },
    });
    expect(staleResponse.statusCode).toBe(409);

    const duplicateBlockResponse = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/scenes/${scene.metadata.id}/document`,
      payload: {
        baseRevision: updateDocument.json().revision,
        document: {
          schemaVersion: 1,
          blocks: [
            {
              id: "00000000-0000-4000-8000-000000001301",
              kind: "paragraph",
              text: "First duplicate.",
            },
            {
              id: "00000000-0000-4000-8000-000000001301",
              kind: "paragraph",
              text: "Second duplicate.",
            },
          ],
        },
      },
    });
    expect(duplicateBlockResponse.statusCode).toBe(400);

    await app.close();
  });

  it("deletes write progression blocks through the scene API", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-api-"));
    roots.push(root);
    const app = await buildApp({ libraryRoot: root });

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "Progression Block Delete API" },
    });
    expect(createResponse.statusCode).toBe(201);
    const series = createResponse.json();
    const scene = series.scenes[0];

    const stagedDocument = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/scenes/${scene.metadata.id}/document`,
      payload: {
        baseRevision: scene.revision,
        title: "Progression scene",
        document: {
          schemaVersion: 1,
          blocks: [
            {
              id: "00000000-0000-4000-8000-000000001501",
              kind: "paragraph",
              text: "Before change.",
            },
            {
              id: "00000000-0000-4000-8000-000000001502",
              kind: "paragraph",
              text: "",
            },
          ],
        },
      },
    });
    expect(stagedDocument.statusCode).toBe(200);

    const entry = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/entries`,
      payload: { categoryId: "character", name: "Keeper" },
    });
    expect(entry.statusCode).toBe(201);
    const embedded = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/scenes/${scene.metadata.id}/progression-blocks`,
      payload: {
        baseRevision: stagedDocument.json().revision,
        afterBlockId: stagedDocument.json().document.blocks[0].id,
        progression: {
          kind: "field",
          entryId: entry.json().metadata.id,
          relationId: null,
          field: { kind: "description", detailTypeId: null },
          fieldKey: null,
          operation: "add",
          body: "Changed at the slot.",
          summary: "Slot change.",
          effectiveToSceneId: null,
          evidence: [],
        },
      },
    });
    expect(embedded.statusCode).toBe(201);
    expect(embedded.json().scene.document.blocks.map((block: { kind: string }) => block.kind)).toEqual([
      "paragraph",
      "codexProgression",
      "paragraph",
    ]);

    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/v1/series/${series.manifest.id}/scenes/${scene.metadata.id}/progression-blocks/${embedded.json().block.id}`,
      payload: {
        baseRevision: embedded.json().scene.revision,
        progressionBaseRevision: embedded.json().progression.revision,
      },
    });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json()).toMatchObject({
      blockId: embedded.json().block.id,
      deletedId: embedded.json().progression.progression.id,
      blockers: [],
    });
    expect(deleted.json().scene.document.blocks.map((block: { kind: string }) => block.kind)).toEqual([
      "paragraph",
      "paragraph",
    ]);

    const missing = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/codex/progressions/${embedded.json().progression.progression.id}`,
    });
    expect(missing.statusCode).toBe(404);
    await app.close();
  });

  it("serves unified Progression JSON CRUD APIs", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-api-"));
    roots.push(root);
    const app = await buildApp({ libraryRoot: root });

    const createSeries = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "统一进展 API" },
    });
    const series = createSeries.json();
    const scene = series.scenes[0];
    const entry = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/entries`,
      payload: { categoryId: "character", name: "林岚" },
    });
    const detailType = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/detail-types`,
      payload: { categoryId: "character", name: "状态" },
    });

    const created = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/progressions`,
      payload: {
        kind: "field",
        entryId: entry.json().metadata.id,
        relationId: null,
        field: { kind: "detail", detailTypeId: detailType.json().detailType.id },
        fieldKey: null,
        operation: "add",
        body: "袖口带着潮水味。",
        summary: "林岚留下潮水痕迹。",
        effectiveFromSceneId: scene.metadata.id,
        source: { kind: "codex-page", sceneId: null, blockId: null },
        evidence: [],
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().progression).toMatchObject({
      kind: "field",
      operation: "add",
      body: "袖口带着潮水味。",
    });

    const listed = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/codex/progressions?kind=field&entryId=${entry.json().metadata.id}`,
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toHaveLength(1);

    const updated = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/codex/progressions/${created.json().progression.id}`,
      payload: {
        baseRevision: created.json().revision,
        operation: "replace",
        body: "",
        summary: "清空状态。",
      },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().progression.operation).toBe("replace");

    const stale = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/codex/progressions/${created.json().progression.id}`,
      payload: {
        baseRevision: created.json().revision,
        summary: "过期更新。",
      },
    });
    expect(stale.statusCode).toBe(409);

    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/v1/series/${series.manifest.id}/codex/progressions/${created.json().progression.id}`,
      payload: { baseRevision: updated.json().revision },
    });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json()).toMatchObject({
      deletedId: created.json().progression.id,
      blockers: [],
    });

    const missing = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/codex/progressions/${created.json().progression.id}`,
    });
    expect(missing.statusCode).toBe(404);
    await app.close();
  });

  it("serves effective Codex entry projection by scene block position", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-api-"));
    roots.push(root);
    const app = await buildApp({ libraryRoot: root });

    const createSeries = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "Effective Entry API" },
    });
    expect(createSeries.statusCode).toBe(201);
    const series = createSeries.json();
    const scene = series.scenes[0];
    const updatedScene = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/scenes/${scene.metadata.id}`,
      payload: {
        baseRevision: scene.revision,
        title: "Projected Scene",
        content: "Before change.\n\nAfter change.",
      },
    });
    expect(updatedScene.statusCode).toBe(200);
    const [firstBlock, secondBlock] = updatedScene.json().document.blocks;

    const entry = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/entries`,
      payload: {
        categoryId: "character",
        name: "Mira",
        description: "Baseline description.",
      },
    });
    expect(entry.statusCode).toBe(201);

    const firstAdd = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/scenes/${updatedScene.json().metadata.id}/progression-blocks`,
      payload: {
        baseRevision: updatedScene.json().revision,
        afterBlockId: firstBlock.id,
        progression: {
          kind: "field",
          entryId: entry.json().metadata.id,
          relationId: null,
          field: { kind: "description", detailTypeId: null },
          fieldKey: null,
          operation: "add",
          body: "Visible at first block.",
          summary: "First block summary.",
          evidence: [],
        },
      },
    });
    expect(firstAdd.statusCode).toBe(201);
    const secondReplace = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/scenes/${updatedScene.json().metadata.id}/progression-blocks`,
      payload: {
        baseRevision: firstAdd.json().scene.revision,
        afterBlockId: secondBlock.id,
        progression: {
          kind: "field",
          entryId: entry.json().metadata.id,
          relationId: null,
          field: { kind: "description", detailTypeId: null },
          fieldKey: null,
          operation: "replace",
          body: "Visible at second block.",
          summary: "Second block summary.",
          evidence: [],
        },
      },
    });
    expect(secondReplace.statusCode).toBe(201);

    const firstEffective = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/codex/entries/${entry.json().metadata.id}/effective?sceneId=${updatedScene.json().metadata.id}&blockId=${firstAdd.json().block.id}`,
    });
    expect(firstEffective.statusCode).toBe(200);
    expect(firstEffective.json().entry.description).toBe("Visible at first block.\n\nBaseline description.");
    expect(firstEffective.json().hiddenFutureFieldProgressionCount).toBe(1);
    expect(firstEffective.json().fieldStates[0]).toMatchObject({
      source: "progression",
      lastProgressionId: firstAdd.json().progression.progression.id,
      hiddenFutureCount: 1,
    });
    const firstJson = JSON.stringify(firstEffective.json());
    expect(firstJson).not.toContain(secondReplace.json().progression.id);
    expect(firstJson).not.toContain(secondReplace.json().progression.body);
    expect(firstJson).not.toContain(secondReplace.json().progression.summary);

    const codexPreview = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/codex/context?sceneId=${updatedScene.json().metadata.id}&blockId=${firstAdd.json().block.id}&pinnedIds=${entry.json().metadata.id}`,
    });
    expect(codexPreview.statusCode).toBe(200);
    expect(codexPreview.json().hiddenFutureFieldProgressionCount).toBe(1);
    expect(codexPreview.json().hiddenFutureFieldProgressions).toEqual([{
      entryId: entry.json().metadata.id,
      name: "Mira",
      count: 1,
    }]);
    const previewJson = JSON.stringify(codexPreview.json());
    expect(previewJson).not.toContain(secondReplace.json().progression.progression.id);
    expect(previewJson).not.toContain(secondReplace.json().progression.progression.body);
    expect(previewJson).not.toContain(secondReplace.json().progression.progression.summary);

    const secondEffective = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/codex/entries/${entry.json().metadata.id}/effective?sceneId=${updatedScene.json().metadata.id}&blockId=${secondReplace.json().block.id}`,
    });
    expect(secondEffective.statusCode).toBe(200);
    expect(secondEffective.json().entry.description).toBe("Visible at second block.");
    expect(secondEffective.json().hiddenFutureFieldProgressionCount).toBe(0);
    expect(secondEffective.json().fieldStates[0]).toMatchObject({
      source: "progression",
      lastProgressionId: secondReplace.json().progression.progression.id,
      hiddenFutureCount: 0,
    });

    const missingScene = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/codex/entries/${entry.json().metadata.id}/effective`,
    });
    expect(missingScene.statusCode).toBe(422);
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

    const sectionContext = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/scenes/${scene.metadata.id}/sections/context`,
    });
    expect(sectionContext.statusCode).toBe(200);
    expect(sectionContext.json()).toEqual([]);

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
        nsfw: true,
      },
    });
    expect(detailTypeResponse.statusCode).toBe(201);
    const detailType = detailTypeResponse.json();
    expect(detailType.detailType.nsfw).toBe(true);
    const updatedDetailTypeResponse = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/codex/detail-types/${detailType.detailType.id}`,
      payload: {
        baseRevision: detailType.revision,
        nsfw: false,
      },
    });
    expect(updatedDetailTypeResponse.statusCode).toBe(200);
    const updatedDetailType = updatedDetailTypeResponse.json();
    expect(updatedDetailType.detailType.nsfw).toBe(false);
    const detailTypes = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/codex/detail-types?categoryId=character`,
    });
    expect(detailTypes.statusCode).toBe(200);
    expect(detailTypes.json().map((document: { detailType: { name: string; nsfw: boolean } }) => ({
      name: document.detailType.name,
      nsfw: document.detailType.nsfw,
    }))).toEqual([{ name: "年龄", nsfw: false }]);

    const updatedLinResponse = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/codex/entries/${lin.metadata.id}`,
      payload: {
        baseRevision: lin.revision,
        detailAiContext: { 年龄: false },
        details: { 年龄: "二十四岁" },
      },
    });
    expect(updatedLinResponse.statusCode).toBe(200);
    expect(updatedLinResponse.json().metadata.details).toEqual({ 年龄: "二十四岁" });
    expect(updatedLinResponse.json().metadata.detailAiContext).toEqual({ 年龄: false });

    const deleteUsedDetailType = await app.inject({
      method: "DELETE",
      url: `/api/v1/series/${series.manifest.id}/codex/detail-types/${updatedDetailType.detailType.id}`,
      payload: { baseRevision: updatedDetailType.revision },
    });
    expect(deleteUsedDetailType.statusCode).toBe(422);

    const relationResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/relations`,
      payload: {
        sourceEntryId: lin.metadata.id,
        targetEntryId: zhou.metadata.id,
        description: "林岚信任周野。",
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

    const staleRelationDelete = await app.inject({
      method: "DELETE",
      url: `/api/v1/series/${series.manifest.id}/codex/relations/${relationResponse.json().relation.id}`,
      payload: { baseRevision: "0".repeat(64) },
    });
    expect(staleRelationDelete.statusCode).toBe(409);
    const relationDelete = await app.inject({
      method: "DELETE",
      url: `/api/v1/series/${series.manifest.id}/codex/relations/${relationResponse.json().relation.id}`,
      payload: { baseRevision: relationResponse.json().revision },
    });
    expect(relationDelete.statusCode).toBe(200);
    expect(relationDelete.json()).toEqual({
      deletedId: relationResponse.json().relation.id,
      blockers: [],
    });
    await app.close();
  });

  it("persists Detail Type Rename descriptions and NSFW state through create update and list", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-api-"));
    roots.push(root);
    const app = await buildApp({ libraryRoot: root });
    const createdSeries = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "Detail Type descriptions" },
    });
    const series = createdSeries.json();
    const created = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/detail-types`,
      payload: {
        categoryId: "character",
        description: "Visible physical traits used for prose consistency.",
        name: "Appearance",
        nsfw: false,
      },
    });

    expect(created.statusCode).toBe(201);
    expect(created.json().detailType).toMatchObject({
      schemaVersion: 2,
      description: "Visible physical traits used for prose consistency.",
    });

    const updated = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/codex/detail-types/${created.json().detailType.id}`,
      payload: {
        baseRevision: created.json().revision,
        name: "Physical appearance",
        description: "Visible traits that should remain stable across Scenes.",
        nsfw: true,
      },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().detailType).toMatchObject({
      name: "Physical appearance",
      description: "Visible traits that should remain stable across Scenes.",
      nsfw: true,
    });

    const stale = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/codex/detail-types/${created.json().detailType.id}`,
      payload: {
        baseRevision: created.json().revision,
        description: "Stale edit",
      },
    });
    expect(stale.statusCode).toBe(409);

    const invalid = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/codex/detail-types/${created.json().detailType.id}`,
      payload: {
        baseRevision: updated.json().revision,
        description: "x".repeat(4001),
      },
    });
    expect(invalid.statusCode).toBe(400);

    const listed = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/codex/detail-types?categoryId=character`,
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toEqual([updated.json()]);
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
        description: "林岚信任周野。",
      },
    });
    const progression = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/progressions`,
      payload: {
        kind: "relationship",
        entryId: null,
        relationId: relation.json().relation.id,
        fieldKey: "关系状态",
        operation: "replace",
        body: "林岚暂时不再信任周野。",
        summary: "林岚暂时不再信任周野。",
        effectiveFromSceneId: secondScene.json().metadata.id,
        source: { kind: "codex-page", sceneId: null, blockId: null },
        evidence: [{
          sourceType: "scene",
          sourceId: secondScene.json().metadata.id,
          quote: "林岚误以为周野背叛了她。",
          note: "关系变化来自第二场正文。",
        }],
      },
    });
    expect(progression.statusCode).toBe(201);
    const blockedRelationDelete = await app.inject({
      method: "DELETE",
      url: `/api/v1/series/${series.manifest.id}/codex/relations/${relation.json().relation.id}`,
      payload: { baseRevision: relation.json().revision },
    });
    expect(blockedRelationDelete.statusCode).toBe(422);
    expect(blockedRelationDelete.json().details.blockers).toEqual([
      expect.objectContaining({
        kind: "progression",
        id: progression.json().progression.id,
      }),
    ]);
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
