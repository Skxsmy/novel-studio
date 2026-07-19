import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ProjectRepository,
  embeddingModelProfileRevision,
  researchEmbeddingCapabilityPath,
} from "../src/index.js";

const roots: string[] = [];

async function repository(): Promise<{ root: string; store: ProjectRepository }> {
  const root = await mkdtemp(path.join(tmpdir(), "novel-studio-research-capability-"));
  roots.push(root);
  return { root, store: new ProjectRepository(root) };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("NS-605 Research embedding capability authority", () => {
  it("confines capability files to the dedicated authority directory", async () => {
    const { root } = await repository();
    expect(() => researchEmbeddingCapabilityPath(root, "../../outside"))
      .toThrowError();
  });

  it("binds a revision-safe capability to the exact profile projection", async () => {
    const { root, store } = await repository();
    const profile = await store.saveEmbeddingModelProfile({
      schemaVersion: 1,
      id: randomUUID(),
      title: "Multilingual",
      provider: "mock",
      baseUrl: null,
      endpointPath: "/embed",
      model: "fixture",
      dimensions: 3,
      maxInputTokens: 512,
      maxBatchSize: 32,
      maxConcurrentBatches: 2,
      normalize: true,
      supportsCustomDimensions: false,
      license: "test",
      credentialRef: null,
      createdAt: "2026-07-19T00:00:00.000Z",
      updatedAt: "2026-07-19T00:00:00.000Z",
      archivedAt: null,
    });
    const profileRevision = embeddingModelProfileRevision(profile);
    const capability = {
      schemaVersion: 1 as const,
      profileId: profile.id,
      profileRevision,
      useCase: "research.multilingual" as const,
      dimensions: profile.dimensions,
      supportedLanguageTags: ["zh-CN", "ja", "en"],
      sharedSpaceDeclared: true,
      documentPrefix: "passage: ",
      queryPrefix: "query: ",
      validationStatus: "passed" as const,
      validationFixtureVersion: 1 as const,
      metrics: { positivePairMean: 0.8, positivePairMinimum: 0.7, negativePairMean: 0.2, separation: 0.6 },
      validatedAt: "2026-07-19T00:00:00.000Z",
      failureReason: null,
    };
    const saved = await store.saveResearchEmbeddingCapability(capability, null);

    expect((await store.getResearchEmbeddingCapability(profile.id)).revision).toBe(saved.revision);
    expect(researchEmbeddingCapabilityPath(root, profile.id)).toContain(profile.id);
    await expect(store.saveResearchEmbeddingCapability({ ...capability, queryPrefix: "query2: " }, null))
      .rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects capability reuse after the profile changes", async () => {
    const { store } = await repository();
    const profile = await store.saveEmbeddingModelProfile({
      schemaVersion: 1,
      id: randomUUID(),
      title: "Mutable",
      provider: "mock",
      baseUrl: null,
      endpointPath: "/embed",
      model: "fixture",
      dimensions: 3,
      maxInputTokens: 512,
      maxBatchSize: 32,
      maxConcurrentBatches: 2,
      normalize: true,
      supportsCustomDimensions: false,
      license: "test",
      credentialRef: null,
      createdAt: "2026-07-19T00:00:00.000Z",
      updatedAt: "2026-07-19T00:00:00.000Z",
      archivedAt: null,
    });
    const staleRevision = embeddingModelProfileRevision(profile);
    await store.saveEmbeddingModelProfile({
      ...profile,
      title: "Changed",
      updatedAt: "2026-07-19T00:01:00.000Z",
    });
    await expect(store.saveResearchEmbeddingCapability({
      schemaVersion: 1,
      profileId: profile.id,
      profileRevision: staleRevision,
      useCase: "research.multilingual",
      dimensions: 3,
      supportedLanguageTags: ["zh-CN", "ja", "en"],
      sharedSpaceDeclared: true,
      documentPrefix: "",
      queryPrefix: "",
      validationStatus: "failed",
      validationFixtureVersion: 1,
      metrics: null,
      validatedAt: "2026-07-19T00:00:00.000Z",
      failureReason: "fixture failed",
    }, null)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
