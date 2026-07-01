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

function proposalPayload(scene: {
  metadata: { id: string; title: string };
  revision: string;
}) {
  const target = {
    kind: "scene-content",
    targetId: scene.metadata.id,
    label: scene.metadata.title,
    baseRevision: scene.revision,
    fieldPath: [],
    blockId: null,
    range: null,
  };
  return {
    type: "text-replacement",
    title: "Replace the first sentence",
    summary: "Review route Proposal fixture.",
    source: {
      kind: "manual",
      sourceId: null,
      label: "Manual review",
      detail: "",
    },
    target,
    contextBundleId: null,
    generator: { kind: "manual", actor: "user" },
    riskLevel: "medium",
    confidence: null,
    reason: "The revision is more direct.",
    patches: [
      {
        id: randomUUID(),
        target,
        action: "replace-text",
        before: "Old API text.",
        after: "New API text.",
        unifiedDiff: "-Old API text.\n+New API text.",
      },
    ],
    evidence: [],
  };
}

describe("M5 Proposal API routes", () => {
  it("creates, lists, previews, and accepts a Proposal through review routes", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-proposal-api-"));
    roots.push(root);
    const app = await buildApp({ libraryRoot: root });
    const createdSeries = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "ProposalApi" },
    });
    expect(createdSeries.statusCode).toBe(201);
    const series = createdSeries.json();
    const initialScene = series.scenes[0];
    const updatedScene = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/scenes/${initialScene.metadata.id}`,
      payload: {
        baseRevision: initialScene.revision,
        title: "Opening",
        content: "Old API text.\n\nSecond line.",
      },
    });
    expect(updatedScene.statusCode).toBe(200);

    const createdProposal = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/review/proposals`,
      payload: proposalPayload(updatedScene.json()),
    });
    expect(createdProposal.statusCode).toBe(201);
    expect(createdProposal.json().proposal.status).toBe("pending");

    const list = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/review/proposals`,
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().items).toHaveLength(1);
    expect(list.json().diagnostics).toEqual([]);

    const preview = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/review/proposals/batch-preview`,
      payload: { proposalIds: [createdProposal.json().proposal.id] },
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.json().items[0]).toMatchObject({ eligible: true });

    const accepted = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/review/proposals/${createdProposal.json().proposal.id}/accept`,
      payload: {
        baseRevision: createdProposal.json().revision,
        actor: "user",
        note: "Approved in route test.",
      },
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().proposal.proposal.status).toBe("accepted");
    expect(accepted.json().snapshot.proposalId).toBe(createdProposal.json().proposal.id);

    const scene = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/scenes/${initialScene.metadata.id}`,
    });
    expect(scene.statusCode).toBe(200);
    expect(scene.json().content).toContain("New API text.");
    expect(scene.json().content).not.toContain("Old API text.");

    await app.close();
  });

  it("reports blocked items during batch accept instead of silently skipping them", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-proposal-batch-api-"));
    roots.push(root);
    const app = await buildApp({ libraryRoot: root });
    const createdSeries = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "ProposalBatchApi" },
    });
    expect(createdSeries.statusCode).toBe(201);
    const series = createdSeries.json();
    const initialScene = series.scenes[0];
    const updatedScene = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/scenes/${initialScene.metadata.id}`,
      payload: {
        baseRevision: initialScene.revision,
        title: "Opening",
        content: "Old API text.\n\nSecond line.",
      },
    });
    expect(updatedScene.statusCode).toBe(200);

    const firstProposal = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/review/proposals`,
      payload: proposalPayload(updatedScene.json()),
    });
    expect(firstProposal.statusCode).toBe(201);

    const blockedProposal = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/review/proposals`,
      payload: {
        ...proposalPayload(updatedScene.json()),
        title: "Blocked batch item",
      },
    });
    expect(blockedProposal.statusCode).toBe(201);
    const stale = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/review/proposals/${blockedProposal.json().proposal.id}/stale`,
      payload: {
        baseRevision: blockedProposal.json().revision,
        actor: "user",
        note: "No longer applicable.",
        staleReason: "Marked stale before batch accept.",
      },
    });
    expect(stale.statusCode).toBe(200);

    const accepted = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/review/proposals/batch-accept`,
      payload: {
        items: [
          {
            proposalId: firstProposal.json().proposal.id,
            baseRevision: firstProposal.json().revision,
          },
          {
            proposalId: blockedProposal.json().proposal.id,
            baseRevision: blockedProposal.json().revision,
          },
        ],
        actor: "user",
        note: "Batch accept route test.",
      },
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().completed).toHaveLength(1);
    expect(accepted.json().blocked).toHaveLength(1);
    expect(accepted.json().blocked[0]).toMatchObject({
      proposalId: blockedProposal.json().proposal.id,
      eligible: false,
    });
    expect(accepted.json().skipped).toEqual([]);
    expect(accepted.json().failed).toEqual([]);

    await app.close();
  });
});
