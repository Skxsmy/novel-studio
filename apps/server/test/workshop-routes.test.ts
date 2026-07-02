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
    url: `/api/v1/ai/model-profiles`,
    payload: {
      title: "Workshop mock model",
      provider: "mock",
      model,
    },
  });
  expect(profile.statusCode).toBe(201);
  return { app, series, profile: profile.json() };
}

describe("M5 Workshop API routes", () => {
  it("persists sessions, previews context, and saves a successful single-role call", async () => {
    const { app, series, profile } = await createSeriesWithMockProfile();
    const scene = series.scenes[0];
    const detectedCodex = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/entries`,
      payload: {
        categoryId: "object",
        name: "Blue Lantern",
        description: "A signal lamp that marks the tide office.",
      },
    });
    expect(detectedCodex.statusCode).toBe(201);
    const manualCodex = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/entries`,
      payload: {
        categoryId: "object",
        name: "Hidden Manual",
        aiContextPolicy: "manual",
      },
    });
    expect(manualCodex.statusCode).toBe(201);
    const neverCodex = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/codex/entries`,
      payload: {
        categoryId: "object",
        name: "Forbidden Relic",
        aiContextPolicy: "never",
      },
    });
    expect(neverCodex.statusCode).toBe(201);
    const selectedSceneResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/scenes`,
      payload: {
        bookId: scene.metadata.bookId,
        actId: scene.metadata.actId,
        chapterId: scene.metadata.chapterId,
        title: "Selected evidence scene",
        content: "The Blue Lantern, Hidden Manual, and Forbidden Relic were all named in this selected scene.",
      },
    });
    expect(selectedSceneResponse.statusCode).toBe(201);
    const selectedScene = selectedSceneResponse.json();
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
          kind: "full-novel",
          sourceId: series.manifest.id,
          label: "Full Novel Text",
          pinned: true,
          note: "",
          createdAt: "2026-07-01T00:00:00.000Z",
        }, {
          id: "11111111-1111-4111-8111-111111111112",
          kind: "full-outline",
          sourceId: series.manifest.id,
          label: "Full Outline",
          pinned: true,
          note: "",
          createdAt: "2026-07-01T00:00:00.000Z",
        }, {
          id: "11111111-1111-4111-8111-111111111113",
          kind: "act",
          sourceId: scene.metadata.actId,
          label: "Selected act",
          pinned: true,
          note: "",
          createdAt: "2026-07-01T00:00:00.000Z",
        }, {
          id: "11111111-1111-4111-8111-111111111114",
          kind: "chapter",
          sourceId: scene.metadata.chapterId,
          label: "Selected chapter",
          pinned: true,
          note: "",
          createdAt: "2026-07-01T00:00:00.000Z",
        }, {
          id: "11111111-1111-4111-8111-111111111115",
          kind: "scene",
          sourceId: selectedScene.metadata.id,
          label: selectedScene.metadata.title,
          pinned: true,
          note: "",
          createdAt: "2026-07-01T00:00:00.000Z",
        }],
      },
    });
    expect(basket.statusCode).toBe(200);
    expect(basket.json().items).toHaveLength(6);
    expect(basket.json().items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "codex-entry",
        sourceId: detectedCodex.json().metadata.id,
        note: "Linked from selected context.",
      }),
    ]));

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
    const previewItems = preview.json().items as Array<{ kind: string; source: { id: string | null }; title: string }>;
    expect(previewItems.map((item) => item.kind)).toEqual(expect.arrayContaining([
      "full-novel",
      "full-outline",
      "act",
      "chapter",
      "scene",
      "codex-entry",
    ]));
    expect(previewItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "scene", source: expect.objectContaining({ id: selectedScene.metadata.id }) }),
      expect.objectContaining({ kind: "codex-entry", source: expect.objectContaining({ id: detectedCodex.json().metadata.id }) }),
    ]));
    expect(previewItems.some((item) => item.source.id === manualCodex.json().metadata.id)).toBe(false);
    expect(previewItems.some((item) => item.source.id === neverCodex.json().metadata.id)).toBe(false);

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

    const assistantMessage = messages.json().find((message: { role: string }) => message.role === "assistant");
    const target = {
      kind: "scene-content",
      targetId: scene.metadata.id,
      label: scene.metadata.title,
      baseRevision: scene.revision,
      fieldPath: [],
      blockId: null,
      range: null,
    };
    const createdProposal = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/messages/${assistantMessage.id}/proposals`,
      payload: {
        type: "text-insertion",
        title: "Insert Workshop response",
        summary: "Workshop candidate",
        target,
        riskLevel: "medium",
        confidence: null,
        reason: "Review before applying.",
        patches: [{
          id: "11111111-1111-4111-8111-111111111111",
          target,
          action: "insert-text",
          before: null,
          after: assistantMessage.content,
          unifiedDiff: `+${assistantMessage.content}`,
        }],
        evidence: [{
          sourceType: "workshop-message",
          sourceId: assistantMessage.id,
          revision: null,
          quote: "",
          note: "Workshop source message.",
        }],
      },
    });
    expect(createdProposal.statusCode).toBe(201);
    expect(createdProposal.json().proposal.proposal.source).toMatchObject({
      kind: "workshop-message",
      sourceId: assistantMessage.id,
      label: "Continuity pass",
    });
    expect(createdProposal.json().message.proposalIds).toEqual([createdProposal.json().proposal.proposal.id]);

    const sourceMessage = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/workshop/messages/${assistantMessage.id}/source`,
    });
    expect(sourceMessage.statusCode).toBe(200);
    expect(sourceMessage.json().session.id).toBe(session.id);
    expect(sourceMessage.json().message.id).toBe(assistantMessage.id);

    const linkedMessages = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/messages`,
    });
    expect(linkedMessages.json().find((message: { id: string }) => message.id === assistantMessage.id).proposalIds)
      .toEqual([createdProposal.json().proposal.proposal.id]);

    await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/archive`,
    });
    const archivedSourceProposal = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/review/proposals/${createdProposal.json().proposal.proposal.id}`,
    });
    expect(archivedSourceProposal.statusCode).toBe(200);
    expect(archivedSourceProposal.json().sourceAvailability).toMatchObject({
      available: false,
      reason: "Source Workshop session is archived",
    });

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
