import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

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
        content: "林岚听见旧钟声，却不知道钟声来自哪里。",
        summary: "林岚听到旧钟声。",
      },
    });
    expect(updatedFirst.statusCode).toBe(200);
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

    await app.inject({
      method: "PATCH",
      url: `/api/v1/series/${series.manifest.id}/scenes/${firstScene.metadata.id}/planning`,
      payload: {
        baseRevision: updatedFirst.json().revision,
        characterIds: [lin.json().metadata.id],
      },
    });

    const futureProgression = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/progressions`,
      payload: {
        target: {
          kind: "entry",
          entryId: bell.json().metadata.id,
          relationId: null,
        },
        fieldKey: "真相",
        changeKind: "addition",
        summary: "林岚在后文得知旧钟声来自密室。",
        effectiveFromSceneId: secondScene.json().metadata.id,
        evidence: [{
          sourceType: "scene",
          sourceId: secondScene.json().metadata.id,
          quote: "林岚在后文得知旧钟声来自密室。",
          note: "后文才揭示。",
        }],
      },
    });
    expect(futureProgression.statusCode).toBe(201);

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
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles`,
      payload: {
        title: "本地上下文测试模型",
        provider: "mock",
        model: "mock-continuity-v1",
      },
    });
    expect(profile.statusCode).toBe(201);

    const promptTemplateId = randomUUID();
    const preview = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/context/preview`,
      payload: {
        sceneId: firstScene.metadata.id,
        roleId: "continuity-editor",
        taskKind: "continuity-check",
        userRequest: "检查旧钟声这一场是否泄露后文。",
        promptTemplateId,
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
      "user-request",
      "scene",
      "codex-entry",
    ]));
    expect(bundle.items.every((item: { source: { id: string | null }; inclusionReason: string }) =>
      item.source.id !== undefined && item.inclusionReason.length > 0,
    )).toBe(true);
    expect(JSON.stringify(bundle.items)).toContain("林岚听见旧钟声");
    expect(JSON.stringify(bundle.items)).not.toContain("后文得知旧钟声来自密室");
    expect(JSON.stringify(bundle.items)).not.toContain("密室真相不应进入上下文");
    expect(bundle.excluded.map((item: { reason: string }) => item.reason)).toEqual(expect.arrayContaining([
      "context-policy-never",
      "hidden-section",
      "future-information",
    ]));
    expect(bundle.estimatedUsage.totalTokens).toBeGreaterThan(0);

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
