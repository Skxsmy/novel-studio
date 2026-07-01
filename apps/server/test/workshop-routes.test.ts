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

async function createSeriesWithMockProfile(model = "mock-continuity-v1") {
  const root = await mkdtemp(path.join(tmpdir(), "novel-studio-workshop-api-"));
  roots.push(root);
  const app = await buildApp({ libraryRoot: root });
  const created = await app.inject({
    method: "POST",
    url: "/api/v1/series",
    payload: { title: "WorkshopApi" },
  });
  const series = created.json();
  const profile = await app.inject({
    method: "POST",
    url: `/api/v1/series/${series.manifest.id}/ai/model-profiles`,
    payload: {
      title: "Workshop mock model",
      provider: "mock",
      model,
      cloudPolicy: "local-only",
    },
  });
  expect(profile.statusCode).toBe(201);
  return { app, series, profile: profile.json() };
}

describe("M5 Workshop API routes", () => {
  it("persists sessions, previews context, and saves a successful single-role call", async () => {
    const { app, series, profile } = await createSeriesWithMockProfile();
    const scene = series.scenes[0];
    const sessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { title: "Continuity pass", sceneId: scene.metadata.id },
    });
    expect(sessionResponse.statusCode).toBe(201);
    const session = sessionResponse.json();

    const basket = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/context-basket`,
      payload: {
        items: [{
          id: "11111111-1111-4111-8111-111111111111",
          kind: "scene",
          sourceId: scene.metadata.id,
          label: scene.metadata.title,
          pinned: true,
          note: "",
          createdAt: "2026-07-01T00:00:00.000Z",
        }],
      },
    });
    expect(basket.statusCode).toBe(200);
    expect(basket.json().items).toHaveLength(1);

    const preview = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/context-preview`,
      payload: {
        userRequest: "Check continuity for this scene.",
        roleId: "continuity-editor",
        taskKind: "continuity-check",
        promptTemplateId: BUILT_IN_PROMPT_IDS.continuityCheck,
        promptTemplateVersion: 1,
        modelProfileId: profile.id,
      },
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.json().items.length).toBeGreaterThan(0);

    const call = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        userRequest: "Check continuity for this scene.",
        roleId: "continuity-editor",
        taskKind: "continuity-check",
        promptTemplateId: BUILT_IN_PROMPT_IDS.continuityCheck,
        promptTemplateVersion: 1,
        modelProfileId: profile.id,
      },
    });
    expect(call.statusCode).toBe(200);
    expect(call.json()).toMatchObject({ status: "succeeded" });
    expect(call.json().responseText).toContain("MockProvider");

    const messages = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/messages`,
    });
    expect(messages.statusCode).toBe(200);
    expect(messages.json().map((message: { role: string }) => message.role)).toEqual(["author", "assistant"]);

    const modelLog = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/ai/calls/${call.json().modelCallId}`,
    });
    expect(modelLog.statusCode).toBe(200);
    expect(modelLog.json()).toMatchObject({
      id: call.json().modelCallId,
      contextBundleId: call.json().contextBundleId,
      status: "succeeded",
    });

    const proposals = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/review/proposals`,
    });
    expect(proposals.statusCode).toBe(200);
    expect(proposals.json().items).toEqual([]);

    await app.close();
  });

  it("preserves input and context on model failure without creating an empty Proposal", async () => {
    const { app, series, profile } = await createSeriesWithMockProfile("mock-provider-error");
    const scene = series.scenes[0];
    const sessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { title: "Failing call", sceneId: scene.metadata.id },
    });
    const session = sessionResponse.json();

    const call = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        userRequest: "This request should be preserved.",
        roleId: "continuity-editor",
        taskKind: "continuity-check",
        promptTemplateId: BUILT_IN_PROMPT_IDS.continuityCheck,
        promptTemplateVersion: 1,
        modelProfileId: profile.id,
      },
    });
    expect(call.statusCode).toBe(200);
    expect(call.json()).toMatchObject({ status: "failed" });

    const messages = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/messages`,
    });
    expect(messages.json()[0]).toMatchObject({
      role: "author",
      content: "This request should be preserved.",
    });
    expect(messages.json()[1]).toMatchObject({
      role: "assistant",
      status: "failed",
      contextBundleId: call.json().contextBundleId,
      modelCallId: call.json().modelCallId,
    });

    const context = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/context/${call.json().contextBundleId}`,
    });
    expect(context.statusCode).toBe(200);
    expect(context.json().userRequest).toBe("This request should be preserved.");

    const proposals = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/review/proposals`,
    });
    expect(proposals.json().items).toEqual([]);

    await app.close();
  });
});
