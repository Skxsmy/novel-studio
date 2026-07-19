import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type {
  CodexEntryDocument,
  ProposalDocument,
  ResearchDatabaseDocument,
  ResearchKeywordSearchResponse,
  ResearchNoteDetail,
  ResearchNoteListResult,
} from "@novel-studio/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const temporaryDirectories: string[] = [];

async function fixture() {
  const libraryRoot = await mkdtemp(path.join(tmpdir(), "novel-studio-research-note-routes-"));
  temporaryDirectories.push(libraryRoot);
  return { app: await buildApp({ libraryRoot }), libraryRoot };
}

async function createDatabase(app: Awaited<ReturnType<typeof buildApp>>, name: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/research/databases",
    payload: { name },
  });
  expect(response.statusCode).toBe(201);
  return response.json<ResearchDatabaseDocument>();
}

async function importAndFindPassage(
  app: Awaited<ReturnType<typeof buildApp>>,
  databaseId: string,
  text: string,
  displayName: string,
) {
  const bytes = Buffer.from(text, "utf8");
  const imported = await app.inject({
    method: "POST",
    url: `/api/v1/research/databases/${databaseId}/sources`,
    payload: {
      fileName: `${displayName.replace(/\s+/gu, "-").toLocaleLowerCase("en")}.txt`,
      mediaType: "text/plain",
      sizeBytes: bytes.byteLength,
      contentBase64: bytes.toString("base64"),
      displayName,
      aiPermission: "never",
    },
  });
  expect(imported.statusCode).toBe(201);
  const searched = await app.inject({
    method: "POST",
    url: `/api/v1/research/databases/${databaseId}/search`,
    payload: { query: text.split(/\s+/u)[0], purpose: "local", limit: 10 },
  });
  expect(searched.statusCode).toBe(200);
  const result = searched.json<ResearchKeywordSearchResponse>().results[0];
  expect(result).toBeDefined();
  return {
    sourceId: result!.sourceId,
    sourceRevision: result!.sourceRevision,
    blockId: result!.blockId,
    chunkId: result!.chunkId,
    chunkHash: result!.chunkHash,
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

describe("NS-609 Research Note HTTP routes", () => {
  it("connects bounded create/list/read/update/evidence/archive/restore behavior", async () => {
    const { app } = await fixture();
    const database = await createDatabase(app, "HTTP note archive");
    const firstEvidence = await importAndFindPassage(
      app,
      database.database.id,
      "harbor customs changed before dawn",
      "Harbor customs",
    );
    const secondEvidence = await importAndFindPassage(
      app,
      database.database.id,
      "signal bells documented the night watch",
      "Signal bells",
    );

    const createdResponse = await app.inject({
      method: "POST",
      url: `/api/v1/research/databases/${database.database.id}/notes`,
      payload: {
        title: "Port ritual",
        body: "The fictional ritual can contradict the official record.",
        tags: ["port"],
        evidence: [firstEvidence],
      },
    });
    expect(createdResponse.statusCode).toBe(201);
    const created = createdResponse.json<ResearchNoteDetail>();
    expect(created).toMatchObject({
      note: { title: "Port ritual", status: "active" },
      evidence: [{ freshness: "current", modelUse: "forbidden" }],
    });

    for (const title of ["Second note", "Third note"]) {
      expect((await app.inject({
        method: "POST",
        url: `/api/v1/research/databases/${database.database.id}/notes`,
        payload: { title, evidence: [firstEvidence] },
      })).statusCode).toBe(201);
    }
    const listedResponse = await app.inject({
      method: "GET",
      url: `/api/v1/research/databases/${database.database.id}/notes?status=active&offset=0&limit=2`,
    });
    expect(listedResponse.statusCode).toBe(200);
    const listed = listedResponse.json<ResearchNoteListResult>();
    expect(listed).toMatchObject({ total: 3, offset: 0, limit: 2, issueCount: 0 });
    expect(listed.notes).toHaveLength(2);
    expect(JSON.stringify(listed.notes)).not.toContain("fictional ritual");

    const updatedResponse = await app.inject({
      method: "PUT",
      url: `/api/v1/research/databases/${database.database.id}/notes/${created.note.id}`,
      payload: { baseRevision: created.revision, body: "Revised author interpretation." },
    });
    expect(updatedResponse.statusCode).toBe(200);
    const updated = updatedResponse.json<ResearchNoteDetail>();

    const appendedResponse = await app.inject({
      method: "POST",
      url: `/api/v1/research/databases/${database.database.id}/notes/${created.note.id}/evidence`,
      payload: { baseRevision: updated.revision, evidence: [secondEvidence] },
    });
    expect(appendedResponse.statusCode).toBe(200);
    const appended = appendedResponse.json<ResearchNoteDetail>();
    expect(appended.evidence).toHaveLength(2);

    const removedResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/research/databases/${database.database.id}/notes/${created.note.id}/evidence/${appended.note.evidence[0]!.id}`,
      payload: { baseRevision: appended.revision },
    });
    expect(removedResponse.statusCode).toBe(200);
    const removed = removedResponse.json<ResearchNoteDetail>();
    expect(removed.evidence).toHaveLength(1);

    const archivedResponse = await app.inject({
      method: "POST",
      url: `/api/v1/research/databases/${database.database.id}/notes/${created.note.id}/archive`,
      payload: { baseRevision: removed.revision },
    });
    expect(archivedResponse.statusCode).toBe(200);
    const archived = archivedResponse.json<ResearchNoteDetail>();
    expect(archived.note.status).toBe("archived");
    const archivedEdit = await app.inject({
      method: "PUT",
      url: `/api/v1/research/databases/${database.database.id}/notes/${created.note.id}`,
      payload: { baseRevision: archived.revision, title: "Must not save" },
    });
    expect(archivedEdit.statusCode).toBe(422);

    const restoredResponse = await app.inject({
      method: "POST",
      url: `/api/v1/research/databases/${database.database.id}/notes/${created.note.id}/restore`,
      payload: { baseRevision: archived.revision },
    });
    expect(restoredResponse.statusCode).toBe(200);
    const reopened = await app.inject({
      method: "GET",
      url: `/api/v1/research/databases/${database.database.id}/notes/${created.note.id}`,
    });
    expect(reopened.statusCode).toBe(200);
    expect(reopened.json<ResearchNoteDetail>().note).toMatchObject({
      body: "Revised author interpretation.",
      status: "active",
    });
    await app.close();
  });

  it("classifies validation, conflict, not-found, cross-database, and damaged authority without path or Source leakage", async () => {
    const { app, libraryRoot } = await fixture();
    const database = await createDatabase(app, "Error boundary");
    const otherDatabase = await createDatabase(app, "Other error boundary");
    const privateText = "PRIVATE-SOURCE-BODY exact evidence";
    const evidence = await importAndFindPassage(app, database.database.id, privateText, "Private evidence");
    const foreignEvidence = await importAndFindPassage(
      app,
      otherDatabase.database.id,
      "foreign database passage",
      "Foreign passage",
    );

    const forged = await app.inject({
      method: "POST",
      url: `/api/v1/research/databases/${database.database.id}/notes`,
      payload: {
        title: "Forged",
        evidence: [{ ...evidence, originalText: "client supplied quote" }],
      },
    });
    expect(forged.statusCode).toBe(400);
    expect(forged.body).not.toContain(privateText);

    const crossDatabase = await app.inject({
      method: "POST",
      url: `/api/v1/research/databases/${database.database.id}/notes`,
      payload: { title: "Cross database", evidence: [foreignEvidence] },
    });
    expect(crossDatabase.statusCode).toBe(404);
    expect(crossDatabase.body).not.toContain("foreign database passage");

    const created = (await app.inject({
      method: "POST",
      url: `/api/v1/research/databases/${database.database.id}/notes`,
      payload: { title: "Damage target", evidence: [evidence] },
    })).json<ResearchNoteDetail>();
    const stale = await app.inject({
      method: "PUT",
      url: `/api/v1/research/databases/${database.database.id}/notes/${created.note.id}`,
      payload: { baseRevision: "a".repeat(64), title: "Stale" },
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toEqual({ code: "CONFLICT", message: "Research Note has changed since it was opened" });

    const missing = await app.inject({
      method: "GET",
      url: `/api/v1/research/databases/${database.database.id}/notes/00000000-0000-4000-8000-000000000001`,
    });
    expect(missing.statusCode).toBe(404);

    const notePath = path.join(
      libraryRoot,
      "research-databases",
      database.database.id,
      "notes",
      `${created.note.id}.json`,
    );
    await writeFile(notePath, "{ damaged", "utf8");
    const damaged = await app.inject({
      method: "GET",
      url: `/api/v1/research/databases/${database.database.id}/notes/${created.note.id}`,
    });
    expect(damaged.statusCode).toBe(422);
    expect(damaged.body).not.toContain(libraryRoot);
    expect(damaged.body).not.toContain("filePath");
    expect(damaged.body).not.toContain(privateText);

    const diagnostics = await app.inject({
      method: "GET",
      url: `/api/v1/research/databases/${database.database.id}/notes?status=all&limit=100`,
    });
    expect(diagnostics.statusCode).toBe(200);
    expect(diagnostics.json<ResearchNoteListResult>()).toMatchObject({ total: 0, issueCount: 1 });
    expect(diagnostics.body).not.toContain(libraryRoot);
    expect(diagnostics.body).not.toContain("filePath");

    const oversizedPage = await app.inject({
      method: "GET",
      url: `/api/v1/research/databases/${database.database.id}/notes?limit=101`,
    });
    expect(oversizedPage.statusCode).toBe(400);
    await app.close();
  });

  it("creates one pending Codex Proposal and performs no pre-acceptance Codex write", async () => {
    const { app } = await fixture();
    const database = await createDatabase(app, "Promotion archive");
    const evidence = await importAndFindPassage(
      app,
      database.database.id,
      "The bell opened the harbor market by local custom.",
      "Harbor custom",
    );
    const noteResponse = await app.inject({
      method: "POST",
      url: `/api/v1/research/databases/${database.database.id}/notes`,
      payload: {
        title: "Market bell",
        body: "Turn the custom into a fictional world rule.",
        evidence: [evidence],
      },
    });
    const note = noteResponse.json<ResearchNoteDetail>();
    const seriesResponse = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "Promotion API" },
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
    const codex = codexResponse.json<CodexEntryDocument>();

    const promotedResponse = await app.inject({
      method: "POST",
      url: `/api/v1/research/databases/${database.database.id}/notes/${note.note.id}/promotions`,
      payload: {
        seriesId,
        baseRevision: note.revision,
        meaning: "world-rule",
        target: {
          kind: "existing",
          entryId: codex.metadata.id,
          targetRevision: codex.revision,
        },
        candidateText: "The market opens only after the bell rings.",
      },
    });
    expect(promotedResponse.statusCode).toBe(201);
    const promotion = promotedResponse.json<ProposalDocument>();
    expect(promotion).toMatchObject({
      proposal: {
        status: "pending",
        type: "codex-update",
        source: { kind: "research-note", sourceId: note.note.id },
        target: { kind: "codex-entry", targetId: codex.metadata.id },
      },
      sourceAvailability: { available: true },
      targetAvailability: { available: true },
    });

    const inboxResponse = await app.inject({
      method: "GET",
      url: `/api/v1/series/${seriesId}/review/proposals`,
    });
    expect(inboxResponse.statusCode).toBe(200);
    expect(inboxResponse.json().items).toHaveLength(1);
    const unchangedResponse = await app.inject({
      method: "GET",
      url: `/api/v1/series/${seriesId}/codex/entries/${codex.metadata.id}`,
    });
    expect(unchangedResponse.json<CodexEntryDocument>()).toMatchObject({
      description: "A working port.",
      research: { content: "Unconfirmed notes." },
      revision: codex.revision,
    });
    expect(promotedResponse.body).not.toContain("credentialRef");
    expect(promotedResponse.body).not.toContain("filePath");
    await app.close();
  });
});
