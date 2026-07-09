import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe("NS-406 prompt roles and template versions", () => {
  it("starts with no built-in editor roles and supports user-created roles, templates, versions, and presets", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-prompts-api-"));
    roots.push(root);
    const app = await buildApp({ libraryRoot: root });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "提示词接口" },
    });
    const seriesId = created.json().manifest.id;

    const emptyResponses = await Promise.all(["roles", "prompts", "presets"].map((part) =>
      app.inject({
        method: "GET",
        url: `/api/v1/series/${seriesId}/ai/${part}`,
      }),
    ));
    expect(emptyResponses.map((response) => response.statusCode)).toEqual([200, 200, 200]);
    expect(emptyResponses.map((response) => response.json())).toEqual([[], [], []]);

    const roleResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${seriesId}/ai/roles`,
      payload: {
        title: "自定义写作搭档",
        description: "作者创建的可编辑角色。",
        persona: "直接、具体、能写。",
      },
    });
    expect(roleResponse.statusCode).toBe(201);
    expect(roleResponse.json()).toMatchObject({
      builtIn: false,
      title: "自定义写作搭档",
    });
    const roleId = roleResponse.json().id;

    const updateRole = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${seriesId}/ai/roles/${roleId}`,
      payload: { challengeObligation: "看到故事逻辑断裂时先指出风险。" },
    });
    expect(updateRole.statusCode).toBe(200);
    expect(updateRole.json().challengeObligation).toContain("故事逻辑");

    const templateResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${seriesId}/ai/prompts`,
      payload: {
        roleId,
        name: "自定义讨论模板",
        status: "active",
        system: "你是作者的写作搭档。",
        instructions: "作者要求：{{user_request}}\n\n场景：{{scene_title}}",
        variables: [
          {
            key: "user_request",
            label: "作者要求",
            required: true,
            defaultValue: null,
          },
          {
            key: "scene_title",
            label: "场景标题",
            required: false,
            defaultValue: "",
          },
        ],
      },
    });
    expect(templateResponse.statusCode).toBe(201);
    const template = templateResponse.json();
    expect(template).toMatchObject({ roleId, version: 1 });

    const missingInputPreview = await app.inject({
      method: "POST",
      url: `/api/v1/series/${seriesId}/ai/prompts/${template.id}/preview`,
      payload: { version: 1, inputs: {} },
    });
    expect(missingInputPreview.statusCode).toBe(400);
    expect(missingInputPreview.json()).toMatchObject({ code: "PROMPT_INPUT_MISSING" });

    const preview = await app.inject({
      method: "POST",
      url: `/api/v1/series/${seriesId}/ai/prompts/${template.id}/preview`,
      payload: {
        version: 1,
        inputs: {
          user_request: "改写这一段。",
          scene_title: "旧钟声",
        },
      },
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toMatchObject({
      promptTemplateId: template.id,
      promptTemplateVersion: 1,
      roleId,
    });
    expect(preview.json().finalPrompt).toContain("改写这一段。");
    expect(preview.json().finalPrompt).not.toContain("{{");

    const newVersion = await app.inject({
      method: "POST",
      url: `/api/v1/series/${seriesId}/ai/prompts/${template.id}/versions`,
      payload: {
        baseVersion: 1,
        instructions: `${template.instructions}\n\n额外要求：给两个候选版本。`,
      },
    });
    expect(newVersion.statusCode).toBe(201);
    expect(newVersion.json()).toMatchObject({
      id: template.id,
      version: 2,
    });

    const preset = await app.inject({
      method: "POST",
      url: `/api/v1/series/${seriesId}/ai/presets`,
      payload: {
        title: "我的写作搭档预设",
        roleId,
        promptTemplateId: template.id,
        promptTemplateVersion: 2,
        modelProfileId: null,
        defaultInputs: { user_request: "" },
      },
    });
    expect(preset.statusCode).toBe(201);

    const presets = await app.inject({
      method: "GET",
      url: `/api/v1/series/${seriesId}/ai/presets`,
    });
    expect(presets.statusCode).toBe(200);
    expect(presets.json()).toHaveLength(1);

    const unsafeTemplate = await app.inject({
      method: "POST",
      url: `/api/v1/series/${seriesId}/ai/prompts`,
      payload: {
        roleId,
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

    await app.close();
  });
});
