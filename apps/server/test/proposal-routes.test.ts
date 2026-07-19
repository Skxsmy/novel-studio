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

async function researchPromotionApiFixture(
  app: Awaited<ReturnType<typeof buildApp>>,
) {
  const databaseResponse = await app.inject({
    method: "POST",
    url: "/api/v1/research/databases",
    payload: { name: "Proposal route archive" },
  });
  expect(databaseResponse.statusCode).toBe(201);
  const databaseId = databaseResponse.json().database.id as string;
  const privateSourceText = "PRIVATE HARBOR SOURCE the bell opened the market by local custom";
  const sourceBytes = Buffer.from(privateSourceText, "utf8");
  const sourceResponse = await app.inject({
    method: "POST",
    url: `/api/v1/research/databases/${databaseId}/sources`,
    payload: {
      fileName: "harbor-source.txt",
      mediaType: "text/plain",
      sizeBytes: sourceBytes.byteLength,
      contentBase64: sourceBytes.toString("base64"),
      displayName: "Harbor source",
      aiPermission: "never",
    },
  });
  expect(sourceResponse.statusCode).toBe(201);
  const source = sourceResponse.json();
  const searchResponse = await app.inject({
    method: "POST",
    url: `/api/v1/research/databases/${databaseId}/search`,
    payload: { query: "bell opened", purpose: "local", limit: 10 },
  });
  expect(searchResponse.statusCode).toBe(200);
  const passage = searchResponse.json().results[0];
  const noteResponse = await app.inject({
    method: "POST",
    url: `/api/v1/research/databases/${databaseId}/notes`,
    payload: {
      title: "Harbor bell custom",
      body: "Author interpretation remains separate from evidence.",
      evidence: [{
        sourceId: passage.sourceId,
        sourceRevision: passage.sourceRevision,
        blockId: passage.blockId,
        chunkId: passage.chunkId,
        chunkHash: passage.chunkHash,
      }],
    },
  });
  expect(noteResponse.statusCode).toBe(201);
  return {
    databaseId,
    note: noteResponse.json(),
    privateSourceText,
    source,
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

  it("accepts and edits Research Note promotions through Review while stale dependencies fail closed", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-promotion-api-"));
    roots.push(root);
    const app = await buildApp({ libraryRoot: root });
    const seriesResponse = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "Promotion Review API" },
    });
    expect(seriesResponse.statusCode).toBe(201);
    const seriesId = seriesResponse.json().manifest.id as string;
    const codexResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${seriesId}/codex/entries`,
      payload: {
        categoryId: "location",
        name: "Bell Harbor",
        description: "A working port.",
        research: "Unconfirmed notes.",
      },
    });
    expect(codexResponse.statusCode).toBe(201);
    const originalCodex = codexResponse.json();
    const fixture = await researchPromotionApiFixture(app);

    const canonPromotionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/research/databases/${fixture.databaseId}/notes/${fixture.note.note.id}/promotions`,
      payload: {
        seriesId,
        baseRevision: fixture.note.revision,
        meaning: "world-rule",
        target: {
          kind: "existing",
          entryId: originalCodex.metadata.id,
          targetRevision: originalCodex.revision,
        },
        candidateText: "The market opens only after the bell rings.",
      },
    });
    expect(canonPromotionResponse.statusCode).toBe(201);
    const canonPromotion = canonPromotionResponse.json();
    const previewResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${seriesId}/review/proposals/batch-preview`,
      payload: { proposalIds: [canonPromotion.proposal.id] },
    });
    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.json().items[0]).toMatchObject({ eligible: true });

    const acceptedResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${seriesId}/review/proposals/${canonPromotion.proposal.id}/accept`,
      payload: {
        baseRevision: canonPromotion.revision,
        actor: "user",
        note: "Confirmed as Canon.",
      },
    });
    expect(acceptedResponse.statusCode).toBe(200);
    expect(acceptedResponse.json()).toMatchObject({
      proposal: { proposal: { status: "accepted" } },
      snapshot: { schemaVersion: 2, targetAbsent: false },
    });
    const afterCanonResponse = await app.inject({
      method: "GET",
      url: `/api/v1/series/${seriesId}/codex/entries/${originalCodex.metadata.id}`,
    });
    const afterCanon = afterCanonResponse.json();
    expect(afterCanon.description).toBe(
      "A working port.\n\nThe market opens only after the bell rings.",
    );
    expect(afterCanon.research.content).toBe("Unconfirmed notes.");

    const researchPromotionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/research/databases/${fixture.databaseId}/notes/${fixture.note.note.id}/promotions`,
      payload: {
        seriesId,
        baseRevision: fixture.note.revision,
        meaning: "real-world-reference",
        target: {
          kind: "existing",
          entryId: originalCodex.metadata.id,
          targetRevision: afterCanon.research.revision,
        },
        candidateText: "Initial reference draft.",
      },
    });
    expect(researchPromotionResponse.statusCode).toBe(201);
    const researchPromotion = researchPromotionResponse.json();
    const editedText = "Unconfirmed notes.\n\nAuthor-edited reference.";
    const editedResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${seriesId}/review/proposals/${researchPromotion.proposal.id}/edit-and-accept`,
      payload: {
        baseRevision: researchPromotion.revision,
        actor: "user",
        note: "Keep outside Canon.",
        patches: [{ ...researchPromotion.proposal.patches[0], after: editedText }],
      },
    });
    expect(editedResponse.statusCode).toBe(200);
    expect(editedResponse.json().proposal.proposal.status).toBe("edited");
    const afterResearch = (await app.inject({
      method: "GET",
      url: `/api/v1/series/${seriesId}/codex/entries/${originalCodex.metadata.id}`,
    })).json();
    expect(afterResearch.description).toBe(afterCanon.description);
    expect(afterResearch.research.content).toBe(editedText);

    const stalePromotionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/research/databases/${fixture.databaseId}/notes/${fixture.note.note.id}/promotions`,
      payload: {
        seriesId,
        baseRevision: fixture.note.revision,
        meaning: "world-rule",
        target: {
          kind: "existing",
          entryId: originalCodex.metadata.id,
          targetRevision: afterResearch.revision,
        },
        candidateText: "This stale candidate must not apply.",
      },
    });
    expect(stalePromotionResponse.statusCode).toBe(201);
    const stalePromotion = stalePromotionResponse.json();
    const noteUpdateResponse = await app.inject({
      method: "PUT",
      url: `/api/v1/research/databases/${fixture.databaseId}/notes/${fixture.note.note.id}`,
      payload: {
        baseRevision: fixture.note.revision,
        body: "Changed after Review opened.",
      },
    });
    expect(noteUpdateResponse.statusCode).toBe(200);
    const staleAcceptResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${seriesId}/review/proposals/${stalePromotion.proposal.id}/accept`,
      payload: {
        baseRevision: stalePromotion.revision,
        actor: "user",
        note: "Must fail.",
      },
    });
    expect(staleAcceptResponse.statusCode).toBe(409);
    expect(staleAcceptResponse.json()).toMatchObject({ code: "CONFLICT" });
    expect(staleAcceptResponse.body).not.toContain(fixture.privateSourceText);
    expect(staleAcceptResponse.body).not.toContain(root);
    expect(staleAcceptResponse.body).not.toContain("filePath");
    expect(staleAcceptResponse.body).not.toContain("credential");
    await app.close();
  });
});
