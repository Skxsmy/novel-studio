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

  it("fails closed across Research Database, Series, Codex target, and archived Note identities", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-promotion-isolation-api-"));
    roots.push(root);
    const app = await buildApp({ libraryRoot: root });
    const firstSeries = (await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "Promotion owner" },
    })).json();
    const secondSeries = (await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "Unrelated Series" },
    })).json();
    const firstEntryResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${firstSeries.manifest.id}/codex/entries`,
      payload: { categoryId: "location", name: "Owner Harbor", description: "Owner Canon." },
    });
    const secondEntryResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${secondSeries.manifest.id}/codex/entries`,
      payload: { categoryId: "location", name: "Foreign Harbor", description: "Foreign Canon." },
    });
    expect(firstEntryResponse.statusCode).toBe(201);
    expect(secondEntryResponse.statusCode).toBe(201);
    const firstEntry = firstEntryResponse.json();
    const secondEntry = secondEntryResponse.json();
    const fixture = await researchPromotionApiFixture(app);
    const otherDatabaseResponse = await app.inject({
      method: "POST",
      url: "/api/v1/research/databases",
      payload: { name: "Unrelated archive" },
    });
    const otherDatabaseId = otherDatabaseResponse.json().database.id as string;
    const payload = {
      seriesId: firstSeries.manifest.id,
      baseRevision: fixture.note.revision,
      meaning: "world-rule",
      target: {
        kind: "existing",
        entryId: firstEntry.metadata.id,
        targetRevision: firstEntry.revision,
      },
      candidateText: "The private source must not cross an authority boundary.",
    };

    const crossDatabase = await app.inject({
      method: "POST",
      url: `/api/v1/research/databases/${otherDatabaseId}/notes/${fixture.note.note.id}/promotions`,
      payload,
    });
    expect(crossDatabase.statusCode).toBe(404);

    const crossCodexTarget = await app.inject({
      method: "POST",
      url: `/api/v1/research/databases/${fixture.databaseId}/notes/${fixture.note.note.id}/promotions`,
      payload: {
        ...payload,
        target: {
          kind: "existing",
          entryId: secondEntry.metadata.id,
          targetRevision: secondEntry.revision,
        },
      },
    });
    expect(crossCodexTarget.statusCode).toBe(404);

    const promotionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/research/databases/${fixture.databaseId}/notes/${fixture.note.note.id}/promotions`,
      payload,
    });
    expect(promotionResponse.statusCode).toBe(201);
    const promotion = promotionResponse.json();
    const crossSeriesRead = await app.inject({
      method: "GET",
      url: `/api/v1/series/${secondSeries.manifest.id}/review/proposals/${promotion.proposal.id}`,
    });
    expect(crossSeriesRead.statusCode).toBe(404);
    const crossSeriesAccept = await app.inject({
      method: "POST",
      url: `/api/v1/series/${secondSeries.manifest.id}/review/proposals/${promotion.proposal.id}/accept`,
      payload: { baseRevision: promotion.revision, actor: "user", note: "Cross-Series attempt." },
    });
    expect(crossSeriesAccept.statusCode).toBe(404);

    const archivedNoteResponse = await app.inject({
      method: "POST",
      url: `/api/v1/research/databases/${fixture.databaseId}/notes/${fixture.note.note.id}/archive`,
      payload: { baseRevision: fixture.note.revision },
    });
    expect(archivedNoteResponse.statusCode).toBe(200);
    const archivedAccept = await app.inject({
      method: "POST",
      url: `/api/v1/series/${firstSeries.manifest.id}/review/proposals/${promotion.proposal.id}/accept`,
      payload: { baseRevision: promotion.revision, actor: "user", note: "Archived Note attempt." },
    });
    expect(archivedAccept.statusCode).toBe(409);
    const unchangedOwner = (await app.inject({
      method: "GET",
      url: `/api/v1/series/${firstSeries.manifest.id}/codex/entries/${firstEntry.metadata.id}`,
    })).json();
    const unchangedForeign = (await app.inject({
      method: "GET",
      url: `/api/v1/series/${secondSeries.manifest.id}/codex/entries/${secondEntry.metadata.id}`,
    })).json();
    expect(unchangedOwner.description).toBe("Owner Canon.");
    expect(unchangedForeign.description).toBe("Foreign Canon.");

    const publicFailures = [crossDatabase, crossCodexTarget, crossSeriesRead, crossSeriesAccept, archivedAccept];
    for (const response of publicFailures) {
      expect(response.body).not.toContain(fixture.privateSourceText);
      expect(response.body).not.toContain(root);
      expect(response.body).not.toContain("filePath");
      expect(response.body).not.toContain("originalRelativePath");
      expect(response.body).not.toContain("credential");
      expect(response.body).not.toContain("contentBase64");
    }
    await app.close();
  });
});
