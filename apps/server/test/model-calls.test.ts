import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CredentialStore } from "@novel-studio/ai";
import { buildApp } from "../src/app.js";
import { BUILT_IN_PROMPT_IDS } from "../src/prompts/builtIns.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true })));
});

function parseSse(body: string): Array<Record<string, unknown>> {
  return body
    .split("\n\n")
    .filter(Boolean)
    .map((block) => block.split("\n").find((line) => line.startsWith("data: ")))
    .filter((line): line is string => Boolean(line))
    .map((line) => JSON.parse(line.slice("data: ".length)) as Record<string, unknown>);
}

function memoryCredentialStore(secret: string): CredentialStore {
  return {
    kind: "windows-credential-manager",
    async isAvailable() {
      return true;
    },
    async writeSecret() {
      return undefined;
    },
    async readSecret() {
      return secret;
    },
    async deleteSecret() {
      return undefined;
    },
  };
}

describe("NS-407 model call API", () => {
  it("streams a non-writing response and saves an auditable ModelCallLog", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-calls-api-"));
    roots.push(root);
    const app = await buildApp({ libraryRoot: root });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "调用接口" },
    });
    const series = created.json();
    const scene = series.scenes[0];
    const profile = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles`,
      payload: {
        title: "本地调用测试模型",
        provider: "mock",
        model: "mock-continuity-v1",
        cloudPolicy: "local-only",
      },
    });
    expect(profile.statusCode).toBe(201);

    const context = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/context/preview`,
      payload: {
        sceneId: scene.metadata.id,
        roleId: "continuity-editor",
        taskKind: "continuity-check",
        userRequest: "检查当前场景的连续性。",
        promptTemplateId: BUILT_IN_PROMPT_IDS.continuityCheck,
        promptTemplateVersion: 1,
        modelProfileId: profile.json().id,
      },
    });
    expect(context.statusCode).toBe(200);

    const call = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/ai/calls`,
      payload: {
        contextBundleId: context.json().id,
        modelProfileId: profile.json().id,
        roleId: "continuity-editor",
        taskKind: "continuity-check",
        promptTemplateId: BUILT_IN_PROMPT_IDS.continuityCheck,
        promptTemplateVersion: 1,
      },
    });
    expect(call.statusCode).toBe(200);
    expect(call.headers["content-type"]).toContain("text/event-stream");
    const events = parseSse(call.body);
    expect(events.map((event) => event.type)).toEqual(expect.arrayContaining([
      "metadata",
      "delta",
      "usage",
      "done",
    ]));
    const done = events.find((event) => event.type === "done");
    expect(done).toMatchObject({ status: "succeeded" });
    const metadata = events.find((event) => event.type === "metadata")!;
    expect(metadata).toMatchObject({
      contextBundleId: context.json().id,
      promptTemplateId: BUILT_IN_PROMPT_IDS.continuityCheck,
      promptTemplateVersion: 1,
    });

    const callId = metadata.callId as string;
    const saved = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/ai/calls/${callId}`,
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({
      id: callId,
      status: "succeeded",
      contextBundleId: context.json().id,
      promptTemplateId: BUILT_IN_PROMPT_IDS.continuityCheck,
      promptTemplateVersion: 1,
      responseHash: expect.any(String),
      error: null,
    });
    expect(saved.json().requestHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.stringify(saved.json())).not.toContain("sk-");
    expect(saved.json().actualUsage.totalTokens).toBeGreaterThan(0);

    const savedContext = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/ai/calls/${callId}/context`,
    });
    expect(savedContext.statusCode).toBe(200);
    expect(savedContext.json().id).toBe(context.json().id);

    const list = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/ai/calls`,
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().map((item: { id: string }) => item.id)).toContain(callId);

    const rewriteContext = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/context/preview`,
      payload: {
        sceneId: scene.metadata.id,
        roleId: "lead-writing-partner",
        taskKind: "rewrite",
        userRequest: "改写当前选区，但只生成候选。",
        promptTemplateId: BUILT_IN_PROMPT_IDS.leadWritingPartner,
        promptTemplateVersion: 1,
        modelProfileId: profile.json().id,
      },
    });
    expect(rewriteContext.statusCode).toBe(200);

    const writingTask = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/ai/calls`,
      payload: {
        contextBundleId: rewriteContext.json().id,
        modelProfileId: profile.json().id,
        roleId: "lead-writing-partner",
        taskKind: "rewrite",
        promptTemplateId: BUILT_IN_PROMPT_IDS.leadWritingPartner,
        promptTemplateVersion: 1,
      },
    });
    expect(writingTask.statusCode).toBe(200);
    const writingEvents = parseSse(writingTask.body);
    expect(writingEvents.find((event) => event.type === "done")).toMatchObject({
      status: "succeeded",
    });
    expect(writingEvents.filter((event) => event.type === "delta").map((event) => event.text).join("")).toContain("MockProvider 候选正文");
    const sceneAfterCandidateCall = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/scenes/${scene.metadata.id}`,
    });
    expect(sceneAfterCandidateCall.json().content).toBe(scene.content);

    await app.close();
  });

  it("streams provider errors and still saves a failed call log", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-calls-error-api-"));
    roots.push(root);
    const app = await buildApp({ libraryRoot: root });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "调用失败接口" },
    });
    const series = created.json();
    const scene = series.scenes[0];
    const profile = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles`,
      payload: {
        title: "失败模型",
        provider: "mock",
        model: "mock-provider-error",
      },
    });
    const context = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/context/preview`,
      payload: {
        sceneId: scene.metadata.id,
        roleId: "continuity-editor",
        taskKind: "continuity-check",
        userRequest: "触发失败。",
        promptTemplateId: BUILT_IN_PROMPT_IDS.continuityCheck,
        promptTemplateVersion: 1,
        modelProfileId: profile.json().id,
      },
    });
    const call = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/ai/calls`,
      payload: {
        contextBundleId: context.json().id,
        modelProfileId: profile.json().id,
        roleId: "continuity-editor",
        taskKind: "continuity-check",
        promptTemplateId: BUILT_IN_PROMPT_IDS.continuityCheck,
        promptTemplateVersion: 1,
      },
    });
    expect(call.statusCode).toBe(200);
    const events = parseSse(call.body);
    expect(events.map((event) => event.type)).toEqual(expect.arrayContaining(["error", "done"]));
    const metadata = events.find((event) => event.type === "metadata")!;
    const done = events.find((event) => event.type === "done")!;
    expect(done).toMatchObject({ status: "failed" });

    const saved = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/ai/calls/${metadata.callId as string}`,
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({
      status: "failed",
      errorCode: "provider-error",
      error: { code: "provider-error" },
    });
    expect(JSON.stringify(saved.json())).not.toContain("sk-");

    await app.close();
  });

  it("streams an OpenAI-compatible DeepSeek response through the model call API", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-calls-deepseek-api-"));
    roots.push(root);
    const app = await buildApp({
      libraryRoot: root,
      credentialStore: memoryCredentialStore("deepseek-test-key"),
      providerFetch: async (input, init) => {
        const url = String(input);
        if (url === "https://api.deepseek.com/chat/completions") {
          expect(new Headers(init?.headers).get("authorization")).toBe("Bearer deepseek-test-key");
          return new Response([
            'data: {"choices":[{"delta":{"content":"雨声"}}]}',
            "",
            'data: {"choices":[{"delta":{"content":"把旧钟声压低。"}}]}',
            "",
            "data: [DONE]",
            "",
            "",
          ].join("\n"), {
            status: 200,
            headers: { "content-type": "text/event-stream" },
          });
        }
        return new Response(JSON.stringify({ error: { message: "not found" } }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      },
    });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "DeepSeek 调用接口" },
    });
    const series = created.json();
    const scene = series.scenes[0];
    await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/ai/cloud-policy`,
      payload: { cloudPolicy: "cloud-allowed" },
    });
    const profile = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles`,
      payload: {
        title: "DeepSeek 写作模型",
        provider: "openai-compatible",
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-v4-flash",
        cloudPolicy: "cloud-allowed",
        credentialRef: "novel-studio/model-profile/test",
        capabilities: {
          streamText: true,
          structuredOutput: true,
          embeddings: false,
          tokenEstimate: true,
          modelList: true,
        },
        contextWindowTokens: 1_000_000,
      },
    });
    expect(profile.statusCode).toBe(201);
    const context = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/context/preview`,
      payload: {
        sceneId: scene.metadata.id,
        roleId: "continuity-editor",
        taskKind: "continuity-check",
        userRequest: "检查旧钟声的连续性。",
        promptTemplateId: BUILT_IN_PROMPT_IDS.continuityCheck,
        promptTemplateVersion: 1,
        modelProfileId: profile.json().id,
      },
    });
    expect(context.statusCode).toBe(200);
    const call = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/ai/calls`,
      payload: {
        contextBundleId: context.json().id,
        modelProfileId: profile.json().id,
        roleId: "continuity-editor",
        taskKind: "continuity-check",
        promptTemplateId: BUILT_IN_PROMPT_IDS.continuityCheck,
        promptTemplateVersion: 1,
      },
    });
    expect(call.statusCode).toBe(200);
    const events = parseSse(call.body);
    expect(events.filter((event) => event.type === "delta").map((event) => event.text).join("")).toBe("雨声把旧钟声压低。");
    const metadata = events.find((event) => event.type === "metadata")!;
    const saved = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/ai/calls/${metadata.callId as string}`,
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({
      provider: "openai-compatible",
      model: "deepseek-v4-flash",
      status: "succeeded",
      error: null,
    });
    expect(JSON.stringify(saved.json())).not.toContain("deepseek-test-key");

    await app.close();
  });
});
