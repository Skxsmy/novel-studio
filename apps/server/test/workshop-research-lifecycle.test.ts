import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { EmbeddingRouter, ProviderRegistry } from "@novel-studio/ai";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import {
  CapabilityOverrideWorkshopProvider,
  ScriptedWorkshopProvider,
  scriptedAnswer,
  scriptedParallelToolResult,
  scriptedToolResult,
} from "./harness/scriptedWorkshopProvider.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture(provider: ScriptedWorkshopProvider | CapabilityOverrideWorkshopProvider) {
  const libraryRoot = await mkdtemp(path.join(tmpdir(), "novel-studio-research-lifecycle-"));
  roots.push(libraryRoot);
  const providerRegistry = new ProviderRegistry();
  providerRegistry.register(provider);
  const app = await buildApp({
    libraryRoot,
    providerRegistry,
    embeddingRouter: new EmbeddingRouter(),
  });
  const series = (await app.inject({
    method: "POST",
    url: "/api/v1/series",
    payload: { title: "WorkshopResearchLifecycle" },
  })).json();
  const profile = (await app.inject({
    method: "POST",
    url: "/api/v1/ai/model-profiles",
    payload: { title: "Lifecycle model", provider: "mock", model: "mock-lifecycle-v1" },
  })).json();
  const database = (await app.inject({
    method: "POST",
    url: "/api/v1/research/databases",
    payload: { name: "Lifecycle references" },
  })).json();
  const session = (await app.inject({
    method: "POST",
    url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
    payload: { title: "Lifecycle conversation" },
  })).json();
  const activated = await app.inject({
    method: "PUT",
    url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}`,
    payload: { activeResearchDatabaseIds: [database.database.id] },
  });
  expect(activated.statusCode, activated.payload).toBe(200);
  return { app, database, libraryRoot, profile, series, session };
}

describe("NS-607 Workshop Research lifecycle", () => {
  it("rejects parallel reads once, executes neither, and accepts the corrected final answer", async () => {
    const provider = new ScriptedWorkshopProvider([
      {
        name: "invalid parallel Research request",
        result: scriptedParallelToolResult([
          { name: "research.list_sources", arguments: { databaseId: "11111111-1111-4111-8111-111111111111" } },
          { name: "research.search", arguments: { query: "gate", mode: "exact" } },
        ]),
      },
      {
        name: "corrected prose answer",
        expect(request) {
          expect(request.history?.map((message) => message.role)).toEqual(["assistant", "tool", "tool"]);
          expect(request.history?.filter((message) => message.role === "tool")
            .every((message) => message.content.includes("PARALLEL_TOOL_CALLS_REJECTED"))).toBe(true);
        },
        result: scriptedAnswer("I need one ordered source action, so I have not used either parallel request."),
      },
    ]);
    const { app, profile, series, session } = await fixture(provider);
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        operationId: randomUUID(),
        mode: "general-chat",
        userRequest: "Check the references in order.",
        modelProfileId: profile.id,
      },
    });
    expect(response.statusCode, response.payload).toBe(200);
    expect(response.json()).toMatchObject({ status: "succeeded", researchEvidence: null });
    expect(provider.requests).toHaveLength(2);
    provider.assertExhausted();
    await app.close();
  });

  it("blocks activation changes during retrieval, cancels without evidence, and never replays after restart", async () => {
    const waitForever = new Promise<void>(() => undefined);
    const provider = new ScriptedWorkshopProvider([
      {
        name: "search before cancellation",
        result: scriptedToolResult({
          name: "research.search",
          arguments: { query: "western gate", mode: "exact" },
        }),
      },
      {
        name: "Provider waits for author cancellation",
        waitFor: waitForever,
        result: scriptedAnswer("This answer must never be emitted."),
      },
    ]);
    const { app, database, libraryRoot, profile, series, session } = await fixture(provider);
    const operationId = randomUUID();
    const callPromise = app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        operationId,
        mode: "general-chat",
        userRequest: "Search the active database, but stop when I ask.",
        modelProfileId: profile.id,
      },
    });
    await provider.waitForRequests(2);

    const mutation = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}`,
      payload: { activeResearchDatabaseIds: [] },
    });
    expect(mutation.statusCode).toBe(409);

    const cancelPromise = app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls/${operationId}/cancel`,
    });
    const [call, cancelled] = await Promise.all([callPromise, cancelPromise]);
    expect(call.json()).toMatchObject({ operationId, status: "cancelled", researchEvidence: null });
    expect(cancelled.json().result).toMatchObject({ operationId, status: "cancelled" });
    expect((await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}`,
    })).json().researchEvidence).toEqual([]);
    await app.close();

    const resumedProvider = new ScriptedWorkshopProvider([
      { name: "new explicit turn", result: scriptedAnswer("A new turn completed after restart.") },
    ]);
    const resumedRegistry = new ProviderRegistry();
    resumedRegistry.register(resumedProvider);
    const resumedApp = await buildApp({
      libraryRoot,
      providerRegistry: resumedRegistry,
      embeddingRouter: new EmbeddingRouter(),
    });
    expect(resumedProvider.requests).toHaveLength(0);
    const detail = await resumedApp.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}`,
    });
    expect(detail.json().session.activeResearchDatabaseIds).toEqual([database.database.id]);
    expect(resumedProvider.requests).toHaveLength(0);

    const next = await resumedApp.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        operationId: randomUUID(),
        mode: "general-chat",
        userRequest: "Start a new turn after restart.",
        modelProfileId: profile.id,
      },
    });
    expect(next.statusCode, next.payload).toBe(200);
    expect(next.json()).toMatchObject({ status: "succeeded", responseText: "A new turn completed after restart." });
    expect(resumedProvider.requests).toHaveLength(1);
    await resumedApp.close();
  });

  it("keeps ordinary conversation available when the selected Provider has no native tools", async () => {
    const inner = new ScriptedWorkshopProvider([
      { name: "ordinary answer", result: scriptedAnswer("I can still discuss the scene without automatic source retrieval.") },
    ]);
    const provider = new CapabilityOverrideWorkshopProvider(inner, false);
    const { app, profile, series, session } = await fixture(provider);
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        operationId: randomUUID(),
        mode: "general-chat",
        userRequest: "Discuss the scene even if tools are unavailable.",
        modelProfileId: profile.id,
      },
    });
    expect(response.statusCode, response.payload).toBe(200);
    expect(response.json()).toMatchObject({ status: "succeeded", researchEvidence: null });
    expect(inner.requests[0]?.tools).toBeUndefined();
    inner.assertExhausted();
    await app.close();
  });

  it("withdraws Research tools after the no-progress budget and rejects a model that keeps calling them", async () => {
    const observations: Array<{
      toolsWithdrawn: boolean;
      toolHistoryOmitted: boolean;
      retrievalClosedInPrompt: boolean;
      noMatchingEvidenceInPrompt: boolean;
    }> = [];
    const provider = new ScriptedWorkshopProvider([
      {
        name: "first empty search",
        result: scriptedToolResult({ name: "research.search", arguments: { query: "missing term one", mode: "exact" } }),
      },
      {
        name: "second empty search exhausts no-progress budget",
        result: scriptedToolResult({ name: "research.search", arguments: { query: "missing term two", mode: "exact" } }),
      },
      {
        name: "model ignores withdrawn tools",
        expect(request) {
          observations.push({
            toolsWithdrawn: request.tools === undefined,
            toolHistoryOmitted: request.history === undefined,
            retrievalClosedInPrompt: request.prompt.user.includes("Research retrieval is closed"),
            noMatchingEvidenceInPrompt: request.prompt.user.includes("No matching passages were returned"),
          });
        },
        result: scriptedToolResult({ name: "research.search", arguments: { query: "missing term three", mode: "exact" } }),
      },
      {
        name: "model accepts budget boundary",
        expect(request) {
          observations.push({
            toolsWithdrawn: request.tools === undefined,
            toolHistoryOmitted: request.history === undefined,
            retrievalClosedInPrompt: request.prompt.user.includes("Research retrieval is closed"),
            noMatchingEvidenceInPrompt: request.prompt.user.includes("No matching passages were returned"),
          });
        },
        result: scriptedAnswer("No matching source was found within the bounded search budget."),
      },
    ]);
    const { app, profile, series, session } = await fixture(provider);
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${session.id}/calls`,
      payload: {
        operationId: randomUUID(),
        mode: "general-chat",
        userRequest: "Search repeatedly for a missing term.",
        modelProfileId: profile.id,
      },
    });
    expect(response.statusCode, response.payload).toBe(200);
    expect(response.json()).toMatchObject({ status: "succeeded", researchEvidence: null });
    expect(observations).toEqual([
      {
        toolsWithdrawn: true,
        toolHistoryOmitted: true,
        retrievalClosedInPrompt: true,
        noMatchingEvidenceInPrompt: true,
      },
      {
        toolsWithdrawn: true,
        toolHistoryOmitted: true,
        retrievalClosedInPrompt: true,
        noMatchingEvidenceInPrompt: true,
      },
    ]);
    expect(provider.requests).toHaveLength(4);
    provider.assertExhausted();
    await app.close();
  });
});
