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

function parseSse(body: string): Array<Record<string, unknown>> {
  return body
    .split("\n\n")
    .filter(Boolean)
    .map((block) => block.split("\n").find((line) => line.startsWith("data: ")))
    .filter((line): line is string => Boolean(line))
    .map((line) => JSON.parse(line.slice("data: ".length)) as Record<string, unknown>);
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
});
