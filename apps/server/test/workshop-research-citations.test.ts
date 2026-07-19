import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { EmbeddingRouter, ProviderRegistry, type ProviderChatRequest } from "@novel-studio/ai";
import { ResearchSourcePropertiesSchema } from "@novel-studio/contracts";
import { ProjectRepository } from "@novel-studio/storage";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { parseResearchFile } from "../src/researchParsers.js";
import {
  ScriptedWorkshopProvider,
  scriptedAnswer,
  scriptedToolResult,
} from "./harness/scriptedWorkshopProvider.js";

const roots: string[] = [];
const SOURCE_TEXT = "The winter observatory opens only after the western bell rings twice.";

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function toolResults(request: ProviderChatRequest): Array<Record<string, unknown>> {
  return (request.history ?? [])
    .filter((message) => message.role === "tool")
    .map((message) => JSON.parse(message.content) as Record<string, unknown>);
}

function successfulSearch(request: ProviderChatRequest) {
  const result = toolResults(request).find((candidate) =>
    candidate.ok === true && candidate.tool === "research.search"
  ) as { results?: Array<Record<string, unknown>> } | undefined;
  const citation = result?.results?.[0];
  if (!citation) throw new Error("Expected the original successful search citation");
  return citation;
}

async function importSource(repository: ProjectRepository, databaseId: string) {
  const bytes = Buffer.from(SOURCE_TEXT, "utf8");
  const parsed = await parseResearchFile({
    contentBase64: bytes.toString("base64"),
    fileName: "observatory.txt",
    mediaType: "text/plain",
    sizeBytes: bytes.byteLength,
  });
  return repository.importResearchSource(databaseId, {
    kind: parsed.parsed.kind,
    mediaType: "text/plain",
    originalFileName: "observatory.txt",
    originalBytes: parsed.bytes,
    sizeBytes: parsed.bytes.byteLength,
    contentHash: parsed.contentHash,
    properties: ResearchSourcePropertiesSchema.parse({
      displayName: "Observatory notes",
      declaredLanguage: "en",
      aiPermission: "allowed",
    }),
    origin: { type: "file" },
    content: {
      title: parsed.parsed.title,
      parserName: parsed.parsed.parserName,
      parserVersion: parsed.parsed.parserVersion,
      warnings: parsed.parsed.warnings,
      sections: parsed.parsed.sections,
      blocks: parsed.parsed.blocks,
    },
  });
}

async function baseFixture(provider: ScriptedWorkshopProvider) {
  const libraryRoot = await mkdtemp(path.join(tmpdir(), "novel-studio-research-citations-"));
  roots.push(libraryRoot);
  const repository = new ProjectRepository(libraryRoot);
  await repository.initialize();
  const series = await repository.createSeries({ title: "WorkshopResearchCitations" });
  const activeDatabase = await repository.createResearchDatabase({ name: "Active evidence" });
  const inactiveDatabase = await repository.createResearchDatabase({ name: "Inactive evidence" });
  await importSource(repository, activeDatabase.database.id);
  await importSource(repository, inactiveDatabase.database.id);
  const providerRegistry = new ProviderRegistry();
  providerRegistry.register(provider);
  const app = await buildApp({ libraryRoot, providerRegistry, embeddingRouter: new EmbeddingRouter() });
  const profile = (await app.inject({
    method: "POST",
    url: "/api/v1/ai/model-profiles",
    payload: { title: "Citation model", provider: "mock", model: "mock-citation-v1" },
  })).json();
  const session = (await app.inject({
    method: "POST",
    url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
    payload: { title: "Citation checks" },
  })).json();
  await app.inject({
    method: "PUT",
    url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}`,
    payload: { activeResearchDatabaseIds: [activeDatabase.database.id] },
  });
  return { activeDatabase, app, inactiveDatabase, profile, repository, series, session };
}

describe("NS-607 Workshop Research citation integrity", () => {
  it("rejects a forged Chunk hash, opens only the exact audited citation, and persists no private text", async () => {
    const forgedHash = "f".repeat(64);
    const provider = new ScriptedWorkshopProvider([
      {
        name: "search exact authority",
        result: scriptedToolResult({
          name: "research.search",
          arguments: { query: "winter observatory western bell", mode: "exact" },
        }),
      },
      {
        name: "forge stale citation",
        result: scriptedToolResult({
          name: "research.open_passage",
          arguments(request) {
            const citation = successfulSearch(request);
            return {
              databaseId: citation.researchDatabaseId,
              sourceId: citation.sourceId,
              chunkId: citation.chunkId,
              sourceRevision: citation.sourceRevision,
              chunkHash: forgedHash,
            };
          },
        }),
      },
      {
        name: "retry exact citation",
        expect(request) {
          expect(toolResults(request).at(-1)).toMatchObject({
            ok: false,
            error: { code: "CITATION_NOT_RETURNED" },
          });
        },
        result: scriptedToolResult({
          name: "research.open_passage",
          arguments(request) {
            const citation = successfulSearch(request);
            return {
              databaseId: citation.researchDatabaseId,
              sourceId: citation.sourceId,
              chunkId: citation.chunkId,
              sourceRevision: citation.sourceRevision,
              chunkHash: citation.chunkHash,
            };
          },
        }),
      },
      { name: "answer from verified passage", result: scriptedAnswer("The observatory opens after the western bell rings twice.") },
    ]);
    const { app, profile, repository, series, session } = await baseFixture(provider);
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        mode: "general-chat",
        userRequest: "Verify when the observatory opens.",
        modelProfileId: profile.id,
      },
    });
    expect(response.statusCode, response.payload).toBe(200);
    expect(response.json().researchEvidence.citations.length).toBeGreaterThan(0);
    expect(response.json().researchEvidence.citations.some(
      (citation: { chunkHash: string }) => citation.chunkHash === forgedHash,
    )).toBe(false);
    const savedCitation = response.json().researchEvidence.citations.find(
      (citation: { relationship: string }) => citation.relationship === "target",
    );
    const citationQuery = new URLSearchParams({
      sourceRevision: savedCitation.sourceRevision,
      chunkId: savedCitation.chunkId,
      chunkHash: savedCitation.chunkHash,
    });
    const exactPassage = await app.inject({
      method: "GET",
      url: `/api/v1/research/databases/${savedCitation.researchDatabaseId}/sources/${savedCitation.sourceId}/content/blocks/${savedCitation.blockId}?${citationQuery}`,
    });
    expect(exactPassage.statusCode, exactPassage.payload).toBe(200);
    expect(exactPassage.json().blocks.some(
      (block: { id: string }) => block.id === savedCitation.blockId,
    )).toBe(true);
    const forgedQuery = new URLSearchParams({
      sourceRevision: savedCitation.sourceRevision,
      chunkId: savedCitation.chunkId,
      chunkHash: forgedHash,
    });
    const stalePassage = await app.inject({
      method: "GET",
      url: `/api/v1/research/databases/${savedCitation.researchDatabaseId}/sources/${savedCitation.sourceId}/content/blocks/${savedCitation.blockId}?${forgedQuery}`,
    });
    expect(stalePassage.statusCode).toBe(409);
    expect(JSON.stringify(response.json().researchEvidence)).not.toContain(SOURCE_TEXT);
    const audits = await repository.listResearchToolAuditEvents(
      series.manifest.id,
      response.json().modelCallId,
    );
    expect(audits.map((audit) => [audit.tool, audit.status, audit.errorCode])).toEqual([
      ["research.search", "succeeded", null],
      ["research.open_passage", "rejected", "CITATION_NOT_RETURNED"],
      ["research.open_passage", "succeeded", null],
    ]);
    expect(JSON.stringify(audits)).not.toContain(SOURCE_TEXT);
    expect(JSON.stringify(await repository.getModelCallLog(
      series.manifest.id,
      response.json().modelCallId,
    ))).not.toContain(SOURCE_TEXT);
    await app.close();
  });

  it("rejects an inactive database and creates no evidence from the rejected result", async () => {
    let inactiveDatabaseId = "";
    const provider = new ScriptedWorkshopProvider([
      {
        name: "request inactive database",
        result: scriptedToolResult({
          name: "research.search",
          arguments: () => ({
            query: "private inactive source",
            databaseIds: [inactiveDatabaseId],
            mode: "exact",
          }),
        }),
      },
      {
        name: "answer without evidence",
        expect(request) {
          expect(toolResults(request).at(-1)).toMatchObject({ ok: false, error: { code: "INACTIVE_DATABASE" } });
        },
        result: scriptedAnswer("That database is not active, so I did not use it."),
      },
    ]);
    const { app, inactiveDatabase, profile, series, session } = await baseFixture(provider);
    inactiveDatabaseId = inactiveDatabase.database.id;
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        mode: "general-chat",
        userRequest: "Use the inactive database.",
        modelProfileId: profile.id,
      },
    });
    expect(response.statusCode, response.payload).toBe(200);
    expect(response.json()).toMatchObject({ status: "succeeded", researchEvidence: null });
    await app.close();
  });
});
