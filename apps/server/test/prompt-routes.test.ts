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

describe("NS-406 prompt roles and template versions", () => {
  it("seeds built-in editors, clones roles, previews declarative templates and keeps old versions", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-prompts-api-"));
    roots.push(root);
    const app = await buildApp({ libraryRoot: root });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "提示词接口" },
    });
    const seriesId = created.json().manifest.id;

    const concurrentSeedResponses = await Promise.all(["roles", "prompts", "presets"].map((part) =>
      app.inject({
        method: "GET",
        url: `/api/v1/series/${seriesId}/ai/${part}`,
      }),
    ));
    expect(concurrentSeedResponses.map((response) => response.statusCode)).toEqual([200, 200, 200]);

    const rolesResponse = await app.inject({
      method: "GET",
      url: `/api/v1/series/${seriesId}/ai/roles`,
    });
    expect(rolesResponse.statusCode).toBe(200);
    const roles = rolesResponse.json();
    expect(roles).toHaveLength(7);
    expect(roles.map((role: { title: string }) => role.title)).toEqual(expect.arrayContaining([
      "主笔伙伴",
      "结构编辑",
      "人物编辑",
      "连续性编辑",
      "文风编辑",
      "冷酷读者",
      "研究员",
    ]));

    const overwriteBuiltIn = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${seriesId}/ai/roles/continuity-editor`,
      payload: { title: "覆盖内置角色" },
    });
    expect(overwriteBuiltIn.statusCode).toBe(409);

    const cloneResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${seriesId}/ai/roles/continuity-editor/clone`,
      payload: { title: "我的连续性编辑" },
    });
    expect(cloneResponse.statusCode).toBe(201);
    expect(cloneResponse.json()).toMatchObject({ title: "我的连续性编辑", builtIn: false });

    const updateClone = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${seriesId}/ai/roles/${cloneResponse.json().id}`,
      payload: { challengeObligation: "看到证据不足时必须停下来说明。" },
    });
    expect(updateClone.statusCode).toBe(200);
    expect(updateClone.json().challengeObligation).toContain("证据不足");

    const promptsResponse = await app.inject({
      method: "GET",
      url: `/api/v1/series/${seriesId}/ai/prompts`,
    });
    expect(promptsResponse.statusCode).toBe(200);
    const prompts = promptsResponse.json();
    const continuityV1 = prompts.find((template: { id: string; version: number }) =>
      template.id === BUILT_IN_PROMPT_IDS.continuityCheck && template.version === 1,
    );
    expect(continuityV1).toBeTruthy();

    const missingInputPreview = await app.inject({
      method: "POST",
      url: `/api/v1/series/${seriesId}/ai/prompts/${BUILT_IN_PROMPT_IDS.continuityCheck}/preview`,
      payload: { version: 1, inputs: {} },
    });
    expect(missingInputPreview.statusCode).toBe(400);
    expect(missingInputPreview.json()).toMatchObject({ code: "PROMPT_INPUT_MISSING" });

    const preview = await app.inject({
      method: "POST",
      url: `/api/v1/series/${seriesId}/ai/prompts/${BUILT_IN_PROMPT_IDS.continuityCheck}/preview`,
      payload: {
        version: 1,
        inputs: {
          user_request: "检查旧钟声是否提前泄露。",
          scene_title: "旧钟声",
        },
      },
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toMatchObject({
      promptTemplateId: BUILT_IN_PROMPT_IDS.continuityCheck,
      promptTemplateVersion: 1,
      roleId: "continuity-editor",
    });
    expect(preview.json().finalPrompt).toContain("检查旧钟声是否提前泄露。");
    expect(preview.json().finalPrompt).not.toContain("{{");

    const newVersion = await app.inject({
      method: "POST",
      url: `/api/v1/series/${seriesId}/ai/prompts/${BUILT_IN_PROMPT_IDS.continuityCheck}/versions`,
      payload: {
        baseVersion: 1,
        instructions: `${continuityV1.instructions}\n\n额外要求：先列出最可能误伤作者意图的判断。`,
      },
    });
    expect(newVersion.statusCode).toBe(201);
    expect(newVersion.json()).toMatchObject({
      id: BUILT_IN_PROMPT_IDS.continuityCheck,
      version: 2,
    });

    const promptsAfterVersion = await app.inject({
      method: "GET",
      url: `/api/v1/series/${seriesId}/ai/prompts`,
    });
    const continuityVersions = promptsAfterVersion.json()
      .filter((template: { id: string }) => template.id === BUILT_IN_PROMPT_IDS.continuityCheck)
      .sort((left: { version: number }, right: { version: number }) => left.version - right.version);
    expect(continuityVersions.map((template: { version: number }) => template.version)).toEqual([1, 2]);
    expect(continuityVersions[0].instructions).toBe(continuityV1.instructions);
    expect(continuityVersions[1].instructions).toContain("额外要求");

    const unsafeTemplate = await app.inject({
      method: "POST",
      url: `/api/v1/series/${seriesId}/ai/prompts`,
      payload: {
        roleId: "continuity-editor",
        name: "错误表达式模板",
        system: "你是测试模板。",
        instructions: "请处理 {{ user_request.toUpperCase() }}",
        variables: [{
          key: "user_request",
          label: "作者要求",
          required: true,
          defaultValue: null,
        }],
      },
    });
    expect(unsafeTemplate.statusCode).toBe(201);
    const unsafePreview = await app.inject({
      method: "POST",
      url: `/api/v1/series/${seriesId}/ai/prompts/${unsafeTemplate.json().id}/preview`,
      payload: { version: 1, inputs: { user_request: "不要执行表达式" } },
    });
    expect(unsafePreview.statusCode).toBe(422);
    expect(unsafePreview.json()).toMatchObject({ code: "PROMPT_TEMPLATE_INVALID" });

    const presets = await app.inject({
      method: "GET",
      url: `/api/v1/series/${seriesId}/ai/presets`,
    });
    expect(presets.statusCode).toBe(200);
    expect(presets.json()).toHaveLength(7);

    await app.close();
  });
});
