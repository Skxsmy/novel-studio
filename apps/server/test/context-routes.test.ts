import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { BUILT_IN_PROMPT_IDS } from "../src/prompts/builtIns.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe("M4 context preview API", () => {
  it("builds an auditable ContextBundle without leaking future or forbidden material", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-context-api-"));
    roots.push(root);
    const app = await buildApp({ libraryRoot: root });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "上下文预览接口" },
    });
    const series = created.json();
    const firstScene = series.scenes[0];
    const updatedFirst = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/scenes/${firstScene.metadata.id}`,
      payload: {
        baseRevision: firstScene.revision,
        title: "旧钟声",
        content: "林岚听见旧钟声，却不知道钟声来自哪里。\n\n同场后段写出不应提前出现的钟声来源。",
        summary: "林岚听到旧钟声。",
      },
    });
    expect(updatedFirst.statusCode).toBe(200);
    const firstBlock = updatedFirst.json().document.blocks[0];
    const secondBlock = updatedFirst.json().document.blocks[1];
    const secondScene = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/scenes`,
      payload: {
        title: "密室",
        content: "林岚在后文得知旧钟声来自密室。",
      },
    });
    expect(secondScene.statusCode).toBe(201);

    const lin = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/entries`,
      payload: {
        categoryId: "character",
        name: "林岚",
        aiContextPolicy: "always",
        description: "调查员。",
      },
    });
    const bell = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/entries`,
      payload: {
        categoryId: "lore",
        name: "旧钟声",
        aiContextPolicy: "always",
        description: "每到雨夜会响起的钟声。",
      },
    });
    const forbidden = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/entries`,
      payload: {
        categoryId: "lore",
        name: "密室真相",
        aiContextPolicy: "never",
        description: "后文才揭示的密室秘密。",
      },
    });
    expect(lin.statusCode).toBe(201);
    expect(bell.statusCode).toBe(201);
    expect(forbidden.statusCode).toBe(201);
    const publicDetailType = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/detail-types`,
      payload: {
        categoryId: "lore",
        name: "公开线索",
      },
    });
    const hiddenDetailType = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/detail-types`,
      payload: {
        categoryId: "lore",
        name: "隐藏真相",
      },
    });
    const clearedDetailType = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/detail-types`,
      payload: {
        categoryId: "lore",
        name: "临时线索",
      },
    });
    expect(publicDetailType.statusCode).toBe(201);
    expect(hiddenDetailType.statusCode).toBe(201);
    expect(clearedDetailType.statusCode).toBe(201);
    const bellDetails = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/codex/entries/${bell.json().metadata.id}`,
      payload: {
        baseRevision: bell.json().revision,
        details: {
          [publicDetailType.json().detailType.id]: "旧钟声只在雨夜响起。",
          [hiddenDetailType.json().detailType.id]: "旧钟声内部藏着密室地图。",
          [clearedDetailType.json().detailType.id]: "临时线索会隐藏。",
        },
        detailAiContext: {
          [hiddenDetailType.json().detailType.id]: false,
        },
      },
    });
    expect(bellDetails.statusCode).toBe(200);

    const plannedFirst = await app.inject({
      method: "PATCH",
      url: `/api/v1/series/${series.manifest.id}/scenes/${firstScene.metadata.id}/planning`,
      payload: {
        baseRevision: updatedFirst.json().revision,
        characterIds: [lin.json().metadata.id],
      },
    });
    expect(plannedFirst.statusCode).toBe(200);

    const futureProgression = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/progressions`,
      payload: {
        kind: "world",
        entryId: bell.json().metadata.id,
        relationId: null,
        fieldKey: "真相",
        operation: "add",
        body: "林岚在后文得知旧钟声来自密室。",
        summary: "林岚在后文得知旧钟声来自密室。",
        effectiveFromSceneId: secondScene.json().metadata.id,
        source: { kind: "codex-page", sceneId: null, blockId: null },
        evidence: [{
          sourceType: "scene",
          sourceId: secondScene.json().metadata.id,
          quote: "林岚在后文得知旧钟声来自密室。",
          note: "后文才揭示。",
        }],
      },
    });
    expect(futureProgression.statusCode).toBe(201);
    const currentFieldProgression = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/scenes/${updatedFirst.json().metadata.id}/progression-blocks`,
      payload: {
        baseRevision: plannedFirst.json().revision,
        afterBlockId: firstBlock.id,
        progression: {
        kind: "field",
        entryId: bell.json().metadata.id,
        relationId: null,
        field: { kind: "description", detailTypeId: null },
        fieldKey: null,
        operation: "add",
        body: "钟声会吸引守夜人。",
        summary: "钟声吸引守夜人。",
        evidence: [],
        },
      },
    });
    expect(currentFieldProgression.statusCode).toBe(201);
    const emptyDetailProgression = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/scenes/${updatedFirst.json().metadata.id}/progression-blocks`,
      payload: {
        baseRevision: currentFieldProgression.json().scene.revision,
        afterBlockId: firstBlock.id,
        progression: {
        kind: "field",
        entryId: bell.json().metadata.id,
        relationId: null,
        field: { kind: "detail", detailTypeId: clearedDetailType.json().detailType.id },
        fieldKey: null,
        operation: "replace",
        body: "",
        summary: "清空临时线索。",
        evidence: [],
        },
      },
    });
    expect(emptyDetailProgression.statusCode).toBe(201);
    const sameSceneLaterWorldProgression = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/scenes/${updatedFirst.json().metadata.id}/progression-blocks`,
      payload: {
        baseRevision: emptyDetailProgression.json().scene.revision,
        afterBlockId: secondBlock.id,
        progression: {
        kind: "world",
        entryId: bell.json().metadata.id,
        relationId: null,
        fieldKey: "同场后段真相",
        operation: "add",
        body: "同场后段揭示旧钟声来自密室。",
        summary: "同场后段揭示旧钟声来自密室。",
        evidence: [{
          sourceType: "scene",
          sourceId: updatedFirst.json().metadata.id,
          quote: "同场后段写出不应提前出现的钟声来源。",
          note: "This later block must not enter first-block context.",
        }],
        },
      },
    });
    expect(sameSceneLaterWorldProgression.statusCode).toBe(201);
    const futureFieldProgression = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/progressions`,
      payload: {
        kind: "field",
        entryId: bell.json().metadata.id,
        relationId: null,
        field: { kind: "description", detailTypeId: null },
        fieldKey: null,
        operation: "replace",
        body: "旧钟声来自密室机关。",
        summary: "钟声真相改变。",
        effectiveFromSceneId: secondScene.json().metadata.id,
        source: { kind: "codex-page", sceneId: null, blockId: null },
        evidence: [],
      },
    });
    expect(futureFieldProgression.statusCode).toBe(201);

    const sensitiveSection = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/scenes/${firstScene.metadata.id}/sections`,
      payload: {
        title: "私密真相",
        kind: "sensitive",
        content: "密室真相不应进入上下文。",
      },
    });
    expect(sensitiveSection.statusCode).toBe(201);

    const profile = await app.inject({
      method: "POST",
      url: `/api/v1/ai/model-profiles`,
      payload: {
        title: "本地上下文测试模型",
        provider: "mock",
        model: "mock-continuity-v1",
      },
    });
    expect(profile.statusCode).toBe(201);

    const preview = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/context/preview`,
      payload: {
        sceneId: firstScene.metadata.id,
        blockId: currentFieldProgression.json().block.id,
        roleId: "continuity-editor",
        taskKind: "continuity-check",
        userRequest: "检查旧钟声这一场是否泄露后文。",
        promptTemplateId: BUILT_IN_PROMPT_IDS.continuityCheck,
        promptTemplateVersion: 1,
        manualContextIds: [
          `codex:${forbidden.json().metadata.id}`,
          `section:${sensitiveSection.json().metadata.id}`,
        ],
        modelProfileId: profile.json().id,
      },
    });
    expect(preview.statusCode).toBe(200);
    const bundle = preview.json();
    expect(bundle.sceneId).toBe(firstScene.metadata.id);
    expect(bundle.items.map((item: { kind: string }) => item.kind)).toEqual(expect.arrayContaining([
      "role-instruction",
      "prompt-template",
      "user-request",
      "scene",
      "codex-entry",
    ]));
    expect(bundle.items.every((item: { source: { id: string | null }; inclusionReason: string }) =>
      item.source.id !== undefined && item.inclusionReason.length > 0,
    )).toBe(true);
    expect(JSON.stringify(bundle.items)).toContain("林岚听见旧钟声");
    expect(JSON.stringify(bundle.items)).not.toContain("同场后段写出不应提前出现");
    expect(JSON.stringify(bundle.items)).toContain("钟声会吸引守夜人");
    expect(JSON.stringify(bundle.items)).toContain("旧钟声只在雨夜响起");
    expect(JSON.stringify(bundle.items)).toContain("每到雨夜会响起的钟声");
    expect(JSON.stringify(bundle.items)).not.toContain("旧钟声内部藏着密室地图");
    expect(JSON.stringify(bundle.items)).not.toContain("临时线索会隐藏");
    expect(JSON.stringify(bundle.items)).not.toContain("旧钟声来自密室机关");
    expect(JSON.stringify(bundle.items)).not.toContain("钟声真相改变");
    expect(JSON.stringify(bundle)).not.toContain(futureFieldProgression.json().progression.id);
    expect(JSON.stringify(bundle.items)).not.toContain("同场后段揭示旧钟声来自密室");
    expect(JSON.stringify(bundle)).not.toContain(sameSceneLaterWorldProgression.json().progression.progression.id);
    expect(JSON.stringify(bundle.items)).not.toContain("后文得知旧钟声来自密室");
    expect(JSON.stringify(bundle.items)).not.toContain("密室真相不应进入上下文");
    expect(bundle.excluded.map((item: { reason: string }) => item.reason)).toEqual(expect.arrayContaining([
      "context-policy-never",
      "hidden-section",
      "future-information",
    ]));
    expect(bundle.estimatedUsage.totalTokens).toBeGreaterThan(0);
    const codexEntryItem = bundle.items.find((item: { kind: string; source: { id: string | null } }) =>
      item.kind === "codex-entry" && item.source.id === bell.json().metadata.id,
    );
    expect(codexEntryItem.sourceRefs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "codex-entry",
        id: bell.json().metadata.id,
      }),
      expect.objectContaining({
        type: "codex-progression",
        id: currentFieldProgression.json().progression.progression.id,
      }),
    ]));

    const saved = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/context/${bundle.id}`,
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().id).toBe(bundle.id);
    expect(saved.json().items).toEqual(bundle.items);

    await app.close();
  });
});
