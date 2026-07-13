import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ProviderAdapterError, ProviderRegistry, type ProviderAdapter, type ProviderObjectRequest, type ProviderTextRequest } from "@novel-studio/ai";
import {
  ContextBundleSchema,
  ModelProfileSchema,
  type ContextBundle,
  type ModelProfile,
} from "@novel-studio/contracts";
import { ProjectRepository } from "@novel-studio/storage";
import { z } from "zod";
import { runWorkshopAgent } from "../src/workshop/workshopAgentRunner.js";

const roots: string[] = [];
const now = "2026-07-13T00:00:00.000Z";
const hash = "a".repeat(64);

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true })));
});

class QueuedProvider implements ProviderAdapter {
  readonly provider = "mock" as const;
  readonly objects: unknown[];
  readonly texts: string[];
  objectCalls = 0;
  textCalls = 0;

  constructor(input: { objects?: unknown[]; texts?: string[] }) {
    this.objects = [...(input.objects ?? [])];
    this.texts = [...(input.texts ?? [])];
  }

  describeCapabilities() {
    return {
      provider: this.provider,
      title: "Queued Provider",
      capabilities: { streamText: true, structuredOutput: true, embeddings: false, tokenEstimate: true, modelList: false },
      models: [],
    };
  }

  async testConnection(modelProfile: ModelProfile) {
    return {
      ok: true,
      provider: this.provider,
      modelProfileId: modelProfile.id,
      capabilities: modelProfile.capabilities,
      models: [],
      error: null,
    };
  }

  async listModels() { return []; }

  async *streamText(_request: ProviderTextRequest) {
    this.textCalls += 1;
    yield this.texts.shift() ?? "";
  }

  async generateObject<T>(_request: ProviderObjectRequest, schema: z.ZodType<T>): Promise<T> {
    this.objectCalls += 1;
    const value = this.objects.shift();
    if (value instanceof Error) throw value;
    return schema.parse(value);
  }

  async embed() { return []; }

  estimateTokens() { return { inputTokens: 10, outputTokens: 0, totalTokens: 10 }; }

  classifyError(error: unknown) {
    if (error instanceof ProviderAdapterError) return error.detail;
    return {
      code: "structured-output-failed" as const,
      message: error instanceof Error ? error.message : "Invalid structured output",
      retryable: true,
      providerStatus: null,
      rawErrorHash: null,
    };
  }
}

function profile(structuredOutput = true): ModelProfile {
  return ModelProfileSchema.parse({
    schemaVersion: 1,
    id: randomUUID(),
    title: "Agent model",
    provider: "mock",
    model: "queued-agent",
    credentialRef: null,
    defaultParameters: {},
    capabilities: {
      streamText: true,
      structuredOutput,
      embeddings: false,
      tokenEstimate: true,
      modelList: false,
    },
    contextWindowTokens: 32000,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  });
}

function context(seriesId: string, userRequest: string): ContextBundle {
  return ContextBundleSchema.parse({
    schemaVersion: 1,
    id: randomUUID(),
    seriesId,
    sceneId: null,
    roleId: "workshop-agent",
    taskKind: "analysis",
    userRequest,
    promptTemplateId: "00000000-0000-4000-8000-000000000422",
    promptTemplateVersion: 1,
    items: [],
    excluded: [],
    estimatedUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    createdAt: now,
  });
}

async function fixture(provider: QueuedProvider, structuredOutput = true) {
  const root = await mkdtemp(path.join(tmpdir(), "novel-studio-agent-runner-"));
  roots.push(root);
  const repository = new ProjectRepository(root);
  const series = await repository.createSeries({ title: "AgentRunner" });
  const session = await repository.createWorkshopSession(series.manifest.id, { kind: "agent", title: "Agent" });
  const authorMessage = await repository.createWorkshopMessage(series.manifest.id, session.id, {
    role: "author",
    mode: "agent",
    content: "Let's work on Mara.",
  });
  const bundle = context(series.manifest.id, authorMessage.content);
  await repository.saveContextBundle(series.manifest.id, bundle);
  const providerRegistry = new ProviderRegistry();
  providerRegistry.register(provider);
  return {
    repository,
    providerRegistry,
    seriesId: series.manifest.id,
    sessionId: session.id,
    authorMessage,
    contextBundle: bundle,
    providerContextBundle: bundle,
    modelProfile: profile(structuredOutput),
    parameters: {},
    prompt: { system: "You are a fiction-writing partner.", instructions: "Return one structured Agent step.", user: authorMessage.content },
    prepareUpdateDraft: async (draft: never) => draft,
  };
}

describe("NS-509 Workshop Agent runner", () => {
  it("completes an ordinary structured Agent response without a tool", async () => {
    const provider = new QueuedProvider({ objects: [{ schemaVersion: 1, type: "respond", message: "Mara needs a sharper scene objective." }] });
    const input = await fixture(provider);
    const result = await runWorkshopAgent(input);
    expect(result.run.run).toMatchObject({ status: "completed", degradedStructuredOutput: false });
    expect(result.run.run.steps.map((step) => step.kind)).toEqual(["model"]);
    expect(result.assistantMessage.content).toBe("Mara needs a sharper scene objective.");
    expect(result.toolMessages).toEqual([]);
    expect(provider.objectCalls).toBe(1);
    expect(provider.textCalls).toBe(0);
  });

  it("persists a structured Codex tool request and waits for author confirmation", async () => {
    const provider = new QueuedProvider({ objects: [{
      schemaVersion: 1,
      type: "request_tool",
      tool: "codex.create_entry",
      message: "I prepared Mara's character entry.",
      draft: {
        categoryId: "character",
        name: "Mara Venn",
        aliases: ["Mara"],
        description: "A harbor pilot who knows the old channels.",
        details: [{ label: "Appearance", value: "Black hair and a scar over her left brow." }],
        research: "Author decision in this Agent conversation.",
      },
    }] });
    const result = await runWorkshopAgent(await fixture(provider));
    expect(result.run.run.status).toBe("waiting-confirmation");
    expect(result.run.run.steps.map((step) => [step.kind, step.status])).toEqual([
      ["model", "succeeded"],
      ["tool-request", "waiting-confirmation"],
    ]);
    expect(result.toolMessages).toHaveLength(1);
    expect(JSON.parse(result.toolMessages[0]!.content)).toMatchObject({
      tool: "codex.create_entry",
      draft: { name: "Mara Venn", aliases: ["Mara"] },
    });
  });

  it("records one repair step and accepts a valid repaired Agent result", async () => {
    const provider = new QueuedProvider({ objects: [
      { schemaVersion: 1, type: "request_tool", tool: "codex.create_entry", message: "Missing draft." },
      { schemaVersion: 1, type: "respond", message: "Let's decide what Mara wants before recording her." },
    ] });
    const result = await runWorkshopAgent(await fixture(provider));
    expect(provider.objectCalls).toBe(2);
    expect(result.run.run.status).toBe("completed");
    expect(result.run.run.steps.map((step) => [step.kind, step.status, step.attempt])).toEqual([
      ["model", "failed", 1],
      ["repair", "succeeded", 2],
    ]);
  });

  it("fails after one invalid repair without creating a tool message", async () => {
    const provider = new QueuedProvider({ objects: [
      { schemaVersion: 1, type: "request_tool", tool: "codex.create_entry", message: "Missing draft." },
      { schemaVersion: 1, type: "request_tool", tool: "codex.update_entry", message: "Still missing draft." },
    ] });
    const result = await runWorkshopAgent(await fixture(provider));
    expect(provider.objectCalls).toBe(2);
    expect(result.run.run.status).toBe("failed");
    expect(result.run.run.steps).toHaveLength(2);
    expect(result.run.run.steps[1]).toMatchObject({ kind: "repair", status: "failed" });
    expect(result.toolMessages).toEqual([]);
    expect(result.assistantMessage.status).toBe("failed");
  });

  it("uses the degraded JSON boundary on the selected unstructured profile without Provider fallback", async () => {
    const provider = new QueuedProvider({ texts: [JSON.stringify({ schemaVersion: 1, type: "respond", message: "We can keep the scene intimate." })] });
    const result = await runWorkshopAgent(await fixture(provider, false));
    expect(result.run.run).toMatchObject({ status: "completed", degradedStructuredOutput: true });
    expect(result.run.run.steps[0]).toMatchObject({ degradedStructuredOutput: true });
    expect(provider.textCalls).toBe(1);
    expect(provider.objectCalls).toBe(0);
    expect(result.modelCall.provider).toBe("mock");
    expect(result.modelCall.model).toBe("queued-agent");
  });

  it("returns the model structured pending-draft revision without server keyword rewriting", async () => {
    const provider = new QueuedProvider({ objects: [{
      schemaVersion: 1,
      type: "request_tool",
      tool: "codex.create_entry",
      message: "Revised as requested.",
      draft: {
        categoryId: "object",
        name: "Starglass",
        aliases: ["Night shard"],
        description: "A blue mineral used as a navigation marker.",
        details: [{ label: "Origin", value: "Recovered from the eastern breakwater." }],
        research: "Revised by the author in this Agent conversation.",
      },
    }] });
    const result = await runWorkshopAgent(await fixture(provider));
    const request = JSON.parse(result.toolMessages[0]!.content);
    expect(request.draft).toMatchObject({
      name: "Starglass",
      aliases: ["Night shard"],
      description: "A blue mineral used as a navigation marker.",
    });
  });
});
