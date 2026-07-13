import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  EmbeddingModelProfileSchema,
  type CodexDetailTypeDocument,
  type EmbeddingModelProfile,
} from "@novel-studio/contracts";
import {
  EmbeddingRouter,
  type EmbeddingAdapter,
  type EmbeddingBatchAdapterRequest,
} from "@novel-studio/ai";
import { ProjectRepository } from "@novel-studio/storage";
import { codexCreateEntryInputFromWorkshopDraft } from "../src/workshop/codexDraft.js";
import { planWorkshopDetailSchema } from "../src/workshop/detailSchemaPlanner.js";

const roots: string[] = [];
const NOW = "2026-07-13T00:00:00.000Z";

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true })));
});

async function repository(): Promise<ProjectRepository> {
  const root = await mkdtemp(path.join(tmpdir(), "novel-studio-detail-planner-"));
  roots.push(root);
  const store = new ProjectRepository(root);
  await store.initialize();
  return store;
}

function profile(overrides: Partial<EmbeddingModelProfile> = {}): EmbeddingModelProfile {
  return EmbeddingModelProfileSchema.parse({
    schemaVersion: 1,
    id: randomUUID(),
    title: "Detail planner",
    provider: "mock",
    baseUrl: null,
    endpointPath: "/embed",
    model: "mock-detail-planner",
    credentialRef: null,
    dimensions: 2,
    maxInputTokens: 512,
    maxBatchSize: 16,
    maxConcurrentBatches: 2,
    normalize: false,
    supportsCustomDimensions: false,
    license: "MIT",
    createdAt: NOW,
    updatedAt: NOW,
    archivedAt: null,
    ...overrides,
  });
}

function detailType(name: string, categoryId = "character"): CodexDetailTypeDocument {
  return {
    detailType: {
      schemaVersion: 1,
      id: randomUUID(),
      categoryId,
      name,
      nsfw: false,
      createdAt: NOW,
      updatedAt: NOW,
    },
    revision: "a".repeat(64),
  };
}

function vectorAdapter(
  embeddingProfile: EmbeddingModelProfile,
  vectors: Record<string, number[]>,
): EmbeddingAdapter {
  return {
    profile: embeddingProfile,
    async embedBatch(request: EmbeddingBatchAdapterRequest) {
      return { vectors: request.inputs.map((input) => vectors[input.text] ?? [0, 0]) };
    },
  };
}

describe("Workshop detail schema planner", () => {
  it("ranks same-category reusable detail types through the bound embedding profile", async () => {
    const store = await repository();
    const embeddingProfile = profile();
    await store.saveEmbeddingModelProfile(embeddingProfile);
    await store.saveEmbeddingUseCaseBinding({
      schemaVersion: 1,
      useCase: "codex.detail-schema",
      profileId: embeddingProfile.id,
      updatedAt: NOW,
    });
    const appearance = detailType("Appearance");
    const history = detailType("History");
    const locationAppearance = detailType("Appearance", "location");
    const router = new EmbeddingRouter();
    router.registerProfile(embeddingProfile, vectorAdapter(embeddingProfile, {
      Looks: [1, 0],
      Appearance: [1, 0.01],
      History: [0, 1],
    }));
    router.bindUseCase("codex.detail-schema", embeddingProfile.id);

    const plan = await planWorkshopDetailSchema({
      categoryId: "character",
      missingDetailTypes: [{ label: "Looks", valuePreview: "Blonde hair", suggestions: [] }],
      availableDetailTypes: [history, locationAppearance, appearance],
      embeddingRouter: router,
      repository: store,
    });

    expect(plan.planner.status).toBe("ready");
    expect(plan.missingDetailTypes[0]?.suggestions[0]).toMatchObject({
      detailTypeId: appearance.detailType.id,
      name: "Appearance",
      recommended: true,
    });
    expect(plan.missingDetailTypes[0]?.suggestions.some(
      (item) => item.detailTypeId === locationAppearance.detailType.id,
    )).toBe(false);
  });

  it("keeps exact matches deterministic without embedding", () => {
    const appearance = detailType("Appearance");
    const input = codexCreateEntryInputFromWorkshopDraft({
      aliases: [],
      categoryId: "character",
      description: "Alice is alive.",
      details: [{ label: " appearance ", value: "Blonde hair." }],
      name: "Alice",
      research: "Author decision.",
    }, [appearance]);

    expect(input.details).toEqual({ [appearance.detailType.id]: "Blonde hair." });
  });

  it("leaves ambiguous semantic candidates as author choices", async () => {
    const store = await repository();
    const embeddingProfile = profile();
    await store.saveEmbeddingModelProfile(embeddingProfile);
    await store.saveEmbeddingUseCaseBinding({
      schemaVersion: 1,
      useCase: "codex.detail-schema",
      profileId: embeddingProfile.id,
      updatedAt: NOW,
    });
    const appearance = detailType("Appearance");
    const presentation = detailType("Presentation");
    const router = new EmbeddingRouter();
    router.registerProfile(embeddingProfile, vectorAdapter(embeddingProfile, {
      Looks: [1, 0],
      Appearance: [1, 0],
      Presentation: [0.999, 0.001],
    }));
    router.bindUseCase("codex.detail-schema", embeddingProfile.id);

    const plan = await planWorkshopDetailSchema({
      categoryId: "character",
      missingDetailTypes: [{ label: "Looks", valuePreview: "Blonde", suggestions: [] }],
      availableDetailTypes: [appearance, presentation],
      embeddingRouter: router,
      repository: store,
    });

    expect(plan.missingDetailTypes[0]?.suggestions).toHaveLength(2);
    expect(plan.missingDetailTypes[0]?.suggestions.every((item) => !item.recommended)).toBe(true);
  });

  it("degrades to manual mapping when embedding is unconfigured or unavailable without fallback", async () => {
    const store = await repository();
    const appearance = detailType("Appearance");
    const router = new EmbeddingRouter();
    const unconfigured = await planWorkshopDetailSchema({
      categoryId: "character",
      missingDetailTypes: [{ label: "Looks", valuePreview: "Blonde", suggestions: [] }],
      availableDetailTypes: [appearance],
      embeddingRouter: router,
      repository: store,
    });
    expect(unconfigured.planner.status).toBe("unconfigured");
    expect(unconfigured.missingDetailTypes[0]?.suggestions).toEqual([]);

    const embeddingProfile = profile();
    await store.saveEmbeddingModelProfile(embeddingProfile);
    await store.saveEmbeddingUseCaseBinding({
      schemaVersion: 1,
      useCase: "codex.detail-schema",
      profileId: embeddingProfile.id,
      updatedAt: NOW,
    });
    let providerCalls = 0;
    router.registerProfile(embeddingProfile, {
      profile: embeddingProfile,
      async embedBatch() {
        providerCalls += 1;
        throw new Error("provider unavailable");
      },
    });
    router.bindUseCase("codex.detail-schema", embeddingProfile.id);
    const unavailable = await planWorkshopDetailSchema({
      categoryId: "character",
      missingDetailTypes: [{ label: "Looks", valuePreview: "Blonde", suggestions: [] }],
      availableDetailTypes: [appearance],
      embeddingRouter: router,
      repository: store,
    });
    expect(unavailable.planner.status).toBe("unavailable");
    expect(unavailable.planner.message).toContain("no fallback model");
    expect(unavailable.missingDetailTypes[0]?.suggestions).toEqual([]);
    expect(providerCalls).toBe(1);

    await rm(path.join(
      store.libraryRoot,
      ".studio",
      "embedding-profiles",
      `${embeddingProfile.id}.json`,
    ));
    const missingProfile = await planWorkshopDetailSchema({
      categoryId: "character",
      missingDetailTypes: [{ label: "Looks", valuePreview: "Blonde", suggestions: [] }],
      availableDetailTypes: [appearance],
      embeddingRouter: router,
      repository: store,
    });
    expect(missingProfile.planner.status).toBe("unavailable");
    expect(missingProfile.planner.message).toContain("missing or invalid");
    expect(providerCalls).toBe(1);

    await store.saveEmbeddingModelProfile({
      ...embeddingProfile,
      archivedAt: NOW,
      updatedAt: NOW,
    });
    const archived = await planWorkshopDetailSchema({
      categoryId: "character",
      missingDetailTypes: [{ label: "Looks", valuePreview: "Blonde", suggestions: [] }],
      availableDetailTypes: [appearance],
      embeddingRouter: router,
      repository: store,
    });
    expect(archived.planner.status).toBe("unavailable");
    expect(archived.planner.message).toContain("archived");
    expect(providerCalls).toBe(1);
  });
});
