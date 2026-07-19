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
const PRIVATE_SOURCE_TEXT = "The Moon Keeper protects the western gate at the winter solstice.";

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function lastToolResult(request: ProviderChatRequest) {
  const message = request.history?.at(-1);
  if (!message || message.role !== "tool") throw new Error("Expected the previous Research tool result");
  return JSON.parse(message.content) as Record<string, unknown>;
}

function parseSseEvents(payload: string): Array<Record<string, unknown>> {
  return payload
    .trim()
    .split(/\r?\n\r?\n/u)
    .map((block) => block.split(/\r?\n/u).find((line) => line.startsWith("data:")))
    .filter((line): line is string => Boolean(line))
    .map((line) => JSON.parse(line.slice(5).trimStart()) as Record<string, unknown>);
}

async function importText(repository: ProjectRepository, databaseId: string) {
  const bytes = Buffer.from(PRIVATE_SOURCE_TEXT, "utf8");
  const parsed = await parseResearchFile({
    contentBase64: bytes.toString("base64"),
    fileName: "moon-keeper.txt",
    mediaType: "text/plain",
    sizeBytes: bytes.byteLength,
  });
  return repository.importResearchSource(databaseId, {
    kind: parsed.parsed.kind,
    mediaType: "text/plain",
    originalFileName: "moon-keeper.txt",
    originalBytes: parsed.bytes,
    sizeBytes: parsed.bytes.byteLength,
    contentHash: parsed.contentHash,
    properties: ResearchSourcePropertiesSchema.parse({
      displayName: "Moon Keeper notes",
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

describe("NS-607 General Chat Research loop", () => {
  it("lists, searches, opens exact evidence, then answers in one bounded author turn", async () => {
    const libraryRoot = await mkdtemp(path.join(tmpdir(), "novel-studio-workshop-research-loop-"));
    roots.push(libraryRoot);
    const repository = new ProjectRepository(libraryRoot);
    await repository.initialize();
    const series = await repository.createSeries({ title: "WorkshopResearchLoop" });
    const database = await repository.createResearchDatabase({ name: "Lore references" });
    await importText(repository, database.database.id);

    const provider = new ScriptedWorkshopProvider([
      {
        name: "list permitted sources",
        expect(request) {
          expect(request.history).toBeUndefined();
          expect(request.tools?.map((tool) => tool.name)).toEqual([
            "research.list_sources",
            "research.search",
            "research.open_passage",
          ]);
          expect(request.tools?.[0]?.description).toContain("Lore references");
          expect(request.tools?.[0]?.description).toContain(database.database.id);
          expect(JSON.stringify(request.prompt)).not.toContain(PRIVATE_SOURCE_TEXT);
          expect(JSON.stringify(request.contextBundle)).not.toContain(PRIVATE_SOURCE_TEXT);
        },
        result: scriptedToolResult({
          name: "research.list_sources",
          arguments: { databaseId: database.database.id },
        }),
      },
      {
        name: "search exact phrase",
        expect(request) {
          expect(request.history?.map((message) => message.role)).toEqual(["assistant", "tool"]);
          expect(lastToolResult(request)).toMatchObject({ ok: true, tool: "research.list_sources" });
        },
        result: scriptedToolResult({
          name: "research.search",
          arguments: {
            query: "Moon Keeper western gate winter solstice",
            databaseIds: [database.database.id],
            mode: "exact",
          },
        }),
      },
      {
        name: "open exact citation",
        expect(request) {
          expect(request.history?.map((message) => message.role)).toEqual([
            "assistant", "tool", "assistant", "tool",
          ]);
          const result = lastToolResult(request) as { results?: Array<Record<string, unknown>> };
          expect(result.results?.[0]?.originalText).toContain("Moon Keeper");
        },
        result: scriptedToolResult({
          name: "research.open_passage",
          arguments(request) {
            const result = lastToolResult(request) as { results?: Array<Record<string, unknown>> };
            const citation = result.results?.[0];
            if (!citation) throw new Error("Expected a search citation");
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
      {
        name: "final author answer",
        expect(request) {
          expect(request.history?.map((message) => message.role)).toEqual([
            "assistant", "tool", "assistant", "tool", "assistant", "tool",
          ]);
          const result = lastToolResult(request) as { passages?: Array<Record<string, unknown>> };
          expect(result.passages?.some((passage) =>
            String(passage.originalText).includes("winter solstice"))).toBe(true);
        },
        result: scriptedAnswer(
          "Keep the western-gate scene at the winter solstice; the active source states that boundary directly.",
        ),
      },
    ]);
    const providerRegistry = new ProviderRegistry();
    providerRegistry.register(provider);
    const app = await buildApp({
      libraryRoot,
      providerRegistry,
      embeddingRouter: new EmbeddingRouter(),
    });
    const profileResponse = await app.inject({
      method: "POST",
      url: "/api/v1/ai/model-profiles",
      payload: { title: "Scripted author model", provider: "mock", model: "mock-continuity-v1" },
    });
    expect(profileResponse.statusCode).toBe(201);
    const sessionResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { title: "Gate continuity" },
    });
    const session = sessionResponse.json();
    await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}`,
      payload: { activeResearchDatabaseIds: [database.database.id] },
    });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        mode: "general-chat",
        userRequest: "When should the Moon Keeper guard the western gate? Check the references before answering.",
        modelProfileId: profileResponse.json().id,
      },
    });
    expect(response.statusCode, response.payload).toBe(200);
    expect(response.json()).toMatchObject({
      status: "succeeded",
      responseText: expect.stringContaining("winter solstice"),
      researchEvidence: {
        assistantMessageId: response.json().assistantMessage.id,
        modelCallId: response.json().modelCallId,
      },
    });
    expect(response.json().researchEvidence.citations.length).toBeGreaterThan(0);
    expect(JSON.stringify(response.json().researchEvidence)).not.toContain(PRIVATE_SOURCE_TEXT);
    expect(provider.requests).toHaveLength(4);
    provider.assertExhausted();

    const detail = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}`,
    });
    expect(detail.json().researchEvidence).toHaveLength(1);
    expect(detail.json().researchEvidence[0].assistantMessageId).toBe(response.json().assistantMessage.id);
    expect(await repository.listResearchToolAuditEvents(
      series.manifest.id,
      response.json().modelCallId,
    )).toHaveLength(3);
    await app.close();
  });

  it("streams bounded Research activity without exposing the query or passage text", async () => {
    const libraryRoot = await mkdtemp(path.join(tmpdir(), "novel-studio-workshop-research-stream-"));
    roots.push(libraryRoot);
    const repository = new ProjectRepository(libraryRoot);
    await repository.initialize();
    const series = await repository.createSeries({ title: "WorkshopResearchStream" });
    const database = await repository.createResearchDatabase({ name: "Stream references" });
    await importText(repository, database.database.id);
    const provider = new ScriptedWorkshopProvider([
      {
        name: "stream search",
        result: scriptedToolResult({
          name: "research.search",
          arguments: {
            query: "Moon Keeper western gate winter solstice",
            databaseIds: [database.database.id],
            mode: "exact",
          },
        }),
      },
      {
        name: "stream open",
        result: scriptedToolResult({
          name: "research.open_passage",
          arguments(request) {
            const result = lastToolResult(request) as { results?: Array<Record<string, unknown>> };
            const citation = result.results?.[0];
            if (!citation) throw new Error("Expected a streamed search citation");
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
      { name: "stream answer", result: scriptedAnswer("The source places the duty at the winter solstice.") },
    ]);
    const providerRegistry = new ProviderRegistry();
    providerRegistry.register(provider);
    const app = await buildApp({ libraryRoot, providerRegistry, embeddingRouter: new EmbeddingRouter() });
    const profile = (await app.inject({
      method: "POST",
      url: "/api/v1/ai/model-profiles",
      payload: { title: "Stream model", provider: "mock", model: "mock-stream-v1" },
    })).json();
    const session = (await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { title: "Stream Research" },
    })).json();
    await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}`,
      payload: { activeResearchDatabaseIds: [database.database.id] },
    });

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls/stream`,
      payload: {
        operationId: randomUUID(),
        mode: "general-chat",
        userRequest: "Check the gate timing in the active source.",
        modelProfileId: profile.id,
      },
    });
    expect(response.statusCode, response.payload).toBe(200);
    const events = parseSseEvents(response.payload);
    const activities = events.filter((event) => event.type === "research-activity");
    expect(activities.map((event) => [event.phase, event.status])).toEqual([
      ["searching", "started"],
      ["searching", "completed"],
      ["reading", "started"],
      ["reading", "completed"],
    ]);
    expect(JSON.stringify(activities)).not.toContain("Moon Keeper");
    expect(JSON.stringify(activities)).not.toContain(PRIVATE_SOURCE_TEXT);
    expect(events.at(-1)).toMatchObject({ type: "done", result: { status: "succeeded" } });
    await app.close();
  });
});
