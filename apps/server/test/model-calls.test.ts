import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CredentialStore } from "@novel-studio/ai";
import { buildApp } from "../src/app.js";

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

type TestApp = Awaited<ReturnType<typeof buildApp>>;

async function createPromptFixture(
  app: TestApp,
  seriesId: string,
  input: { roleTitle: string; promptName: string; system: string; instructions: string },
): Promise<{ roleId: string; promptTemplateId: string; promptTemplateVersion: number }> {
  const role = await app.inject({
    method: "POST",
    url: `/api/v1/series/${seriesId}/ai/roles`,
    payload: {
      title: input.roleTitle,
      persona: input.system,
    },
  });
  expect(role.statusCode).toBe(201);
  const prompt = await app.inject({
    method: "POST",
    url: `/api/v1/series/${seriesId}/ai/prompts`,
    payload: {
      roleId: role.json().id,
      name: input.promptName,
      status: "active",
      system: input.system,
      instructions: input.instructions,
    },
  });
  expect(prompt.statusCode).toBe(201);
  return {
    roleId: role.json().id,
    promptTemplateId: prompt.json().id,
    promptTemplateVersion: prompt.json().version,
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
      url: `/api/v1/ai/model-profiles`,
      payload: {
        title: "本地调用测试模型",
        provider: "mock",
        model: "mock-continuity-v1",
      },
    });
    expect(profile.statusCode).toBe(201);
    const continuityPrompt = await createPromptFixture(app, series.manifest.id, {
      roleTitle: "Continuity checker",
      promptName: "Continuity check",
      system: "You check continuity without applying writes.",
      instructions: "Return a concise continuity analysis.",
    });
    const rewritePrompt = await createPromptFixture(app, series.manifest.id, {
      roleTitle: "Writing partner",
      promptName: "Rewrite candidate",
      system: "You draft rewrite candidates without saving them.",
      instructions: "Return candidate prose only.",
    });

    const context = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/context/preview`,
      payload: {
        sceneId: scene.metadata.id,
        roleId: continuityPrompt.roleId,
        taskKind: "continuity-check",
        userRequest: "检查当前场景的连续性。",
        promptTemplateId: continuityPrompt.promptTemplateId,
        promptTemplateVersion: continuityPrompt.promptTemplateVersion,
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
        roleId: continuityPrompt.roleId,
        taskKind: "continuity-check",
        promptTemplateId: continuityPrompt.promptTemplateId,
        promptTemplateVersion: continuityPrompt.promptTemplateVersion,
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
      promptTemplateId: continuityPrompt.promptTemplateId,
      promptTemplateVersion: continuityPrompt.promptTemplateVersion,
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
      promptTemplateId: continuityPrompt.promptTemplateId,
      promptTemplateVersion: continuityPrompt.promptTemplateVersion,
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
        roleId: rewritePrompt.roleId,
        taskKind: "rewrite",
        userRequest: "改写当前选区，但只生成候选。",
        promptTemplateId: rewritePrompt.promptTemplateId,
        promptTemplateVersion: rewritePrompt.promptTemplateVersion,
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
        roleId: rewritePrompt.roleId,
        taskKind: "rewrite",
        promptTemplateId: rewritePrompt.promptTemplateId,
        promptTemplateVersion: rewritePrompt.promptTemplateVersion,
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
      url: `/api/v1/ai/model-profiles`,
      payload: {
        title: "失败模型",
        provider: "mock",
        model: "mock-provider-error",
      },
    });
    const prompt = await createPromptFixture(app, series.manifest.id, {
      roleTitle: "Failure continuity checker",
      promptName: "Failure continuity check",
      system: "You check continuity for provider error tests.",
      instructions: "Return a concise response.",
    });
    const context = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/context/preview`,
      payload: {
        sceneId: scene.metadata.id,
        roleId: prompt.roleId,
        taskKind: "continuity-check",
        userRequest: "触发失败。",
        promptTemplateId: prompt.promptTemplateId,
        promptTemplateVersion: prompt.promptTemplateVersion,
        modelProfileId: profile.json().id,
      },
    });
    const call = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/ai/calls`,
      payload: {
        contextBundleId: context.json().id,
        modelProfileId: profile.json().id,
        roleId: prompt.roleId,
        taskKind: "continuity-check",
        promptTemplateId: prompt.promptTemplateId,
        promptTemplateVersion: prompt.promptTemplateVersion,
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

  it("streams a DeepSeek response through the model call API", async () => {
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
    const profile = await app.inject({
      method: "POST",
      url: `/api/v1/ai/model-profiles`,
      payload: {
        title: "DeepSeek 写作模型",
        provider: "deepseek",
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-v4-flash",
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
    const credential = await app.inject({
      method: "POST",
      url: `/api/v1/ai/model-profiles/${profile.json().id}/credential`,
      payload: { secret: "deepseek-test-key" },
    });
    expect(credential.statusCode).toBe(200);
    const prompt = await createPromptFixture(app, series.manifest.id, {
      roleTitle: "DeepSeek continuity checker",
      promptName: "DeepSeek continuity check",
      system: "You check continuity through DeepSeek.",
      instructions: "Return concise story feedback.",
    });
    const context = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/context/preview`,
      payload: {
        sceneId: scene.metadata.id,
        roleId: prompt.roleId,
        taskKind: "continuity-check",
        userRequest: "检查旧钟声的连续性。",
        promptTemplateId: prompt.promptTemplateId,
        promptTemplateVersion: prompt.promptTemplateVersion,
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
        roleId: prompt.roleId,
        taskKind: "continuity-check",
        promptTemplateId: prompt.promptTemplateId,
        promptTemplateVersion: prompt.promptTemplateVersion,
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
      provider: "deepseek",
      model: "deepseek-v4-flash",
      status: "succeeded",
      error: null,
    });
    expect(JSON.stringify(saved.json())).not.toContain("deepseek-test-key");

    await app.close();
  });
});
