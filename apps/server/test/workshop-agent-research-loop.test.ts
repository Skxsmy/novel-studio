import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { EmbeddingRouter, ProviderRegistry, type ProviderChatRequest } from "@novel-studio/ai";
import {
  ContextBundleSchema,
  ModelProfileSchema,
  ResearchSourcePropertiesSchema,
} from "@novel-studio/contracts";
import { ProjectRepository } from "@novel-studio/storage";
import { afterEach, describe, expect, it } from "vitest";
import { parseResearchFile } from "../src/researchParsers.js";
import { runWorkshopAgent } from "../src/workshop/workshopAgentRunner.js";
import {
  ScriptedWorkshopProvider,
  scriptedAnswer,
  scriptedParallelToolResult,
  scriptedToolResult,
} from "./harness/scriptedWorkshopProvider.js";

const roots: string[] = [];
const SOURCE_TEXT = "The Moon Keeper protects the western gate at the winter solstice.";

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function lastToolResult(request: ProviderChatRequest) {
  const message = request.history?.at(-1);
  if (!message || message.role !== "tool") throw new Error("Expected the previous Research tool result");
  return JSON.parse(message.content) as Record<string, unknown>;
}

async function importSource(repository: ProjectRepository, databaseId: string) {
  const bytes = Buffer.from(SOURCE_TEXT, "utf8");
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

async function agentFixture(provider: ScriptedWorkshopProvider, request: string) {
  const libraryRoot = await mkdtemp(path.join(tmpdir(), "novel-studio-agent-research-guard-"));
  roots.push(libraryRoot);
  const repository = new ProjectRepository(libraryRoot);
  await repository.initialize();
  const series = await repository.createSeries({ title: "WorkshopAgentResearchGuard" });
  const database = await repository.createResearchDatabase({ name: "Guard references" });
  const session = await repository.createWorkshopSession(series.manifest.id, { kind: "agent", title: "Guard" });
  await repository.updateWorkshopSession(series.manifest.id, session.id, {
    activeResearchDatabaseIds: [database.database.id],
  });
  const authorMessage = await repository.createWorkshopMessage(series.manifest.id, session.id, {
    role: "author",
    mode: "agent",
    content: request,
  });
  const contextBundle = ContextBundleSchema.parse({
    schemaVersion: 1,
    id: randomUUID(),
    seriesId: series.manifest.id,
    sceneId: null,
    roleId: "workshop-agent",
    taskKind: "analysis",
    userRequest: request,
    promptTemplateId: "00000000-0000-4000-8000-000000000422",
    promptTemplateVersion: 1,
    items: [],
    excluded: [],
    estimatedUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    createdAt: new Date().toISOString(),
  });
  await repository.saveContextBundle(series.manifest.id, contextBundle);
  const providerRegistry = new ProviderRegistry();
  providerRegistry.register(provider);
  const modelProfile = ModelProfileSchema.parse({
    schemaVersion: 1,
    id: randomUUID(),
    title: "Guard model",
    provider: "mock",
    model: "mock-agent-guard-v1",
    credentialRef: null,
    defaultParameters: {},
    capabilities: { streamText: true, structuredOutput: true, embeddings: false, tokenEstimate: true, modelList: false },
    contextWindowTokens: 32000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    archivedAt: null,
  });
  return {
    database,
    repository,
    series,
    session,
    input: {
      repository,
      providerRegistry,
      embeddingRouter: new EmbeddingRouter(),
      seriesId: series.manifest.id,
      sessionId: session.id,
      authorMessage,
      contextBundle,
      providerContextBundle: contextBundle,
      modelProfile,
      activeResearchDatabaseIds: [database.database.id],
      parameters: {},
      prompt: { system: "You are a fiction-writing partner.", instructions: "Use one ordered action.", user: request },
      prepareUpdateDraft: async (draft: never) => draft,
    },
  };
}

describe("NS-607 Workshop Agent Research loop", () => {
  it("retrieves evidence automatically but still waits for author confirmation before a Codex write", async () => {
    const libraryRoot = await mkdtemp(path.join(tmpdir(), "novel-studio-agent-research-loop-"));
    roots.push(libraryRoot);
    const repository = new ProjectRepository(libraryRoot);
    await repository.initialize();
    const series = await repository.createSeries({ title: "WorkshopAgentResearch" });
    const database = await repository.createResearchDatabase({ name: "Lore references" });
    await importSource(repository, database.database.id);
    const session = await repository.createWorkshopSession(series.manifest.id, {
      kind: "agent",
      title: "Moon Keeper continuity",
    });
    await repository.updateWorkshopSession(series.manifest.id, session.id, {
      activeResearchDatabaseIds: [database.database.id],
    });
    const authorMessage = await repository.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "agent",
      content: "Check the references, then prepare a Codex entry for the Moon Keeper.",
    });
    const contextBundle = ContextBundleSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      seriesId: series.manifest.id,
      sceneId: null,
      roleId: "workshop-agent",
      taskKind: "analysis",
      userRequest: authorMessage.content,
      promptTemplateId: "00000000-0000-4000-8000-000000000422",
      promptTemplateVersion: 1,
      items: [],
      excluded: [],
      estimatedUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      createdAt: new Date().toISOString(),
    });
    await repository.saveContextBundle(series.manifest.id, contextBundle);

    const provider = new ScriptedWorkshopProvider([
      {
        name: "search lore",
        expect(request) {
          expect(request.tools?.map((tool) => tool.name)).toEqual([
            "codex.create_entry",
            "codex.update_entry",
            "research.list_sources",
            "research.search",
            "research.open_passage",
          ]);
          expect(JSON.stringify(request.prompt)).not.toContain(SOURCE_TEXT);
          expect(JSON.stringify(request.contextBundle)).not.toContain(SOURCE_TEXT);
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
        name: "open cited passage",
        expect(request) {
          const result = lastToolResult(request) as { results?: Array<Record<string, unknown>> };
          expect(result.results?.[0]?.originalText).toContain("winter solstice");
          expect(result).toMatchObject({
            nextAction: expect.stringContaining("If the returned original text answers the question"),
          });
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
        name: "request confirmed Codex write",
        expect(request) {
          const result = lastToolResult(request) as { passages?: Array<Record<string, unknown>> };
          expect(result.passages?.[0]?.originalText).toContain("western gate");
          expect(result).toMatchObject({
            nextAction: expect.stringContaining("stop retrieving and answer now"),
          });
        },
        result: scriptedToolResult({
          name: "codex.create_entry",
          arguments: {
            message: "I prepared the Moon Keeper entry from the active source.",
            draft: {
              categoryId: "character",
              name: "Moon Keeper",
              aliases: [],
              description: "Guardian of the western gate at the winter solstice.",
              details: [{ label: "Duty", value: "Protects the western gate." }],
              research: "Active source identifies the duty and seasonal timing.",
            },
          },
        }),
      },
    ]);
    const providerRegistry = new ProviderRegistry();
    providerRegistry.register(provider);
    const modelProfile = ModelProfileSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      title: "Scripted Agent model",
      provider: "mock",
      model: "mock-agent-research-v1",
      credentialRef: null,
      defaultParameters: {},
      capabilities: {
        streamText: true,
        structuredOutput: true,
        embeddings: false,
        tokenEstimate: true,
        modelList: false,
      },
      contextWindowTokens: 32000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archivedAt: null,
    });

    const result = await runWorkshopAgent({
      repository,
      providerRegistry,
      embeddingRouter: new EmbeddingRouter(),
      seriesId: series.manifest.id,
      sessionId: session.id,
      authorMessage,
      contextBundle,
      providerContextBundle: contextBundle,
      modelProfile,
      activeResearchDatabaseIds: [database.database.id],
      parameters: {},
      prompt: {
        system: "You are a fiction-writing partner.",
        instructions: "Use active references before preparing changes.",
        user: authorMessage.content,
      },
      prepareUpdateDraft: async (draft) => draft,
    });

    expect(result.run.run.status).toBe("waiting-confirmation");
    expect(result.toolMessages).toHaveLength(1);
    expect(JSON.parse(result.toolMessages[0]!.content)).toMatchObject({
      tool: "codex.create_entry",
      draft: { name: "Moon Keeper" },
    });
    expect(result.researchEvidence).toMatchObject({
      assistantMessageId: result.assistantMessage.id,
      modelCallId: result.modelCall?.id,
    });
    expect(result.researchEvidence?.citations.length).toBeGreaterThan(0);
    expect(JSON.stringify(result.researchEvidence)).not.toContain(SOURCE_TEXT);
    expect(await repository.listWorkshopResearchEvidence(series.manifest.id, session.id)).toHaveLength(1);
    expect(await repository.listCodexEntries(series.manifest.id)).toHaveLength(0);
    expect(provider.requests).toHaveLength(3);
    provider.assertExhausted();
  });

  it("executes neither side of a mixed parallel Research and Codex request", async () => {
    const provider = new ScriptedWorkshopProvider([
      {
        name: "invalid mixed read and write",
        result: scriptedParallelToolResult([
          { name: "research.search", arguments: { query: "Moon Keeper", mode: "exact" } },
          {
            name: "codex.create_entry",
            arguments: {
              message: "Create an unsafe mixed entry.",
              draft: {
                categoryId: "character",
                name: "Unsafe Mixed Entry",
                aliases: [],
                description: "Must not be written.",
                details: [],
                research: "Must not be written.",
              },
            },
          },
        ]),
      },
      {
        name: "corrected Agent prose",
        expect(request) {
          expect(request.history?.filter((message) => message.role === "tool")).toHaveLength(2);
        },
        result: scriptedAnswer("I did not run either action because read and write requests must be ordered."),
      },
    ]);
    const fixture = await agentFixture(provider, "Research first, then prepare a Codex entry.");
    const result = await runWorkshopAgent(fixture.input);
    expect(result.run.run.status).toBe("completed");
    expect(result.toolMessages).toEqual([]);
    expect(result.researchEvidence).toBeNull();
    expect(await fixture.repository.listCodexEntries(fixture.series.manifest.id)).toEqual([]);
    expect(await fixture.repository.listResearchToolAuditEvents(
      fixture.series.manifest.id,
      result.modelCall!.id,
    )).toEqual([]);
  });

  it("treats tool-shaped prose as prose and does not simulate a Research execution", async () => {
    const provider = new ScriptedWorkshopProvider([
      { name: "tool-shaped prose", result: scriptedAnswer('{"tool":"research.search","query":"Moon Keeper"}') },
    ]);
    const fixture = await agentFixture(provider, "Explain the tool request as text only.");
    const result = await runWorkshopAgent(fixture.input);
    expect(result.run.run.status).toBe("completed");
    expect(result.assistantMessage.content).toContain('"tool":"research.search"');
    expect(result.researchEvidence).toBeNull();
    expect(await fixture.repository.listResearchToolAuditEvents(
      fixture.series.manifest.id,
      result.modelCall!.id,
    )).toEqual([]);
  });

  it("forces a prose conclusion after the Agent Research no-progress budget is exhausted", async () => {
    const provider = new ScriptedWorkshopProvider([
      {
        name: "first empty search",
        result: scriptedToolResult({ name: "research.search", arguments: { query: "missing one", mode: "exact" } }),
      },
      {
        name: "second empty search",
        result: scriptedToolResult({ name: "research.search", arguments: { query: "missing two", mode: "exact" } }),
      },
      {
        name: "bounded prose conclusion",
        expect(request) {
          expect(request.toolChoice).toBeUndefined();
          expect(request.tools).toBeUndefined();
          expect((request.history ?? []).some((message) => message.role === "tool")).toBe(false);
          expect((request.history ?? []).some((message) =>
            message.role === "assistant" && Boolean(message.toolCalls?.length))).toBe(false);
          expect(request.prompt.user).toContain("Research retrieval is closed");
          expect(request.prompt.user).toContain("No matching passages were returned");
        },
        result: scriptedAnswer("No matching source was found, so I cannot confirm that detail."),
      },
    ]);
    const fixture = await agentFixture(provider, "Check the active references for a missing detail.");
    const result = await runWorkshopAgent(fixture.input);
    expect(result.run.run.status).toBe("completed");
    expect(result.toolMessages).toEqual([]);
    expect(result.assistantMessage.content).toContain("cannot confirm");
    expect(provider.requests).toHaveLength(3);
    provider.assertExhausted();
  });
});
