import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  EmbeddingModelProfileSchema,
  ModelProfileSchema,
  type AgentRole,
  type ContextBundle,
  type EmbeddingModelProfile,
  type EmbeddingUseCaseBindingDocument,
  type ModelCallLog,
  type ModelProfile,
  type PromptPreset,
  type PromptTemplate,
} from "@novel-studio/contracts";
import { ProjectRepository, StorageError } from "../src/index.js";

const temporaryDirectories: string[] = [];
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

async function repository(): Promise<ProjectRepository> {
  const root = await mkdtemp(path.join(tmpdir(), "novel-studio-ai-"));
  temporaryDirectories.push(root);
  return new ProjectRepository(root);
}

async function seriesRoot(store: ProjectRepository, seriesId: string): Promise<string> {
  const suffix = `-${seriesId.slice(0, 8)}`;
  const entries = await readdir(store.libraryRoot, { withFileTypes: true });
  const match = entries.find((entry) => entry.isDirectory() && entry.name.endsWith(suffix));
  if (!match) throw new Error(`Series root not found for ${seriesId}`);
  return path.join(store.libraryRoot, match.name);
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("M4 AI file persistence", () => {
  it("persists embedding use-case bindings across repository restart and deletes them explicitly", async () => {
    const store = await repository();
    const now = new Date().toISOString();
    const profile = EmbeddingModelProfileSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      title: "Codex schema embedding",
      provider: "mock",
      baseUrl: null,
      endpointPath: "/embed",
      model: "mock-codex-schema",
      credentialRef: null,
      dimensions: 4,
      maxInputTokens: 512,
      maxBatchSize: 16,
      maxConcurrentBatches: 2,
      normalize: true,
      supportsCustomDimensions: false,
      license: "MIT",
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    });
    const binding: EmbeddingUseCaseBindingDocument = {
      schemaVersion: 1,
      useCase: "codex.detail-schema",
      profileId: profile.id,
      updatedAt: now,
    };
    await store.saveEmbeddingModelProfile(profile);
    await store.saveEmbeddingUseCaseBinding(binding);

    const restarted = new ProjectRepository(store.libraryRoot);
    await restarted.initialize();
    expect(await restarted.getEmbeddingUseCaseBinding("codex.detail-schema")).toEqual(binding);
    expect(await restarted.listEmbeddingUseCaseBindings()).toEqual([binding]);
    expect(await readFile(
      path.join(store.libraryRoot, ".studio", "embedding-bindings", "codex.detail-schema.json"),
      "utf8",
    )).toContain(profile.id);

    expect(await restarted.deleteEmbeddingUseCaseBinding("codex.detail-schema")).toBe(true);
    expect(await restarted.deleteEmbeddingUseCaseBinding("codex.detail-schema")).toBe(false);
    await expect(restarted.getEmbeddingUseCaseBinding("codex.detail-schema")).rejects.toMatchObject<Partial<StorageError>>({
      code: "NOT_FOUND",
    });
  });

  it("rejects embedding bindings to missing profiles", async () => {
    const store = await repository();
    await expect(store.saveEmbeddingUseCaseBinding({
      schemaVersion: 1,
      useCase: "codex.detail-schema",
      profileId: randomUUID(),
      updatedAt: new Date().toISOString(),
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "NOT_FOUND" });
    expect(await store.listEmbeddingUseCaseBindings()).toEqual([]);
  });

  it("stores model profiles, prompts, context bundles and call logs without API keys", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "镜城 AI 文件" });
    const scene = series.scenes[0]!;
    const now = new Date().toISOString();
    const modelProfileId = randomUUID();
    const embeddingProfileId = randomUUID();
    const promptTemplateId = randomUUID();
    const promptPresetId = randomUUID();
    const contextBundleId = randomUUID();
    const modelCallId = randomUUID();

    const profile: ModelProfile = {
      schemaVersion: 1,
      id: modelProfileId,
      title: "Mock 上下文检查",
      provider: "mock",
      model: "mock-continuity-v1",
      credentialRef: "novel-studio:test:credential-ref",
      defaultParameters: { temperature: 0.2, maxOutputTokens: 800 },
      capabilities: {
        streamText: true,
        structuredOutput: true,
        embeddings: false,
        tokenEstimate: true,
        modelList: true,
      },
      contextWindowTokens: 32000,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
    const embeddingProfile: EmbeddingModelProfile = {
      schemaVersion: 1,
      id: embeddingProfileId,
      title: "BGE Small zh",
      provider: "local-http",
      baseUrl: "http://127.0.0.1:8080",
      endpointPath: "/embed",
      model: "BAAI/bge-small-zh-v1.5",
      credentialRef: "novel-studio:embedding:credential-ref",
      dimensions: 512,
      maxInputTokens: 512,
      maxBatchSize: 32,
      maxConcurrentBatches: 2,
      normalize: true,
      supportsCustomDimensions: false,
      license: "MIT",
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
    const role: AgentRole = {
      schemaVersion: 1,
      id: "role-context-checker",
      title: "上下文检查",
      description: "检查前后矛盾。",
      persona: "冷静核对证据。",
      duties: ["指出矛盾并给出证据。"],
      nonDuties: ["不做润色"],
      challengeObligation: "必须指出不合逻辑处。",
      forbiddenActions: ["直接改写正文", "直接更新已确认设定"],
      outputContract: "按风险、证据和建议输出。",
      readScopes: { scenes: true, codex: true, research: false },
      builtIn: false,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
    const templateV1: PromptTemplate = {
      schemaVersion: 1,
      id: promptTemplateId,
      roleId: role.id,
      name: "连续性检查",
      version: 1,
      status: "active",
      description: "只做分析，不改正文。",
      system: "你根据小说上下文检查连续性。",
      instructions: "请指出矛盾，并引用上下文证据。",
      components: [],
      variables: [{ key: "user_request", label: "作者要求", description: "", required: true, defaultValue: null }],
      outputSchemaName: "continuity_report",
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
    const templateV2: PromptTemplate = {
      ...templateV1,
      version: 2,
      instructions: "请指出矛盾、遗漏和未来信息泄漏，并引用上下文证据。",
    };
    const preset: PromptPreset = {
      schemaVersion: 1,
      id: promptPresetId,
      title: "默认连续性检查",
      roleId: role.id,
      promptTemplateId,
      promptTemplateVersion: 2,
      modelProfileId,
      defaultInputs: { user_request: "检查本场连续性。" },
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
    const bundle: ContextBundle = {
      schemaVersion: 2,
      id: contextBundleId,
      seriesId: series.manifest.id,
      sceneId: scene.metadata.id,
      roleId: role.id,
      taskKind: "continuity-check",
      userRequest: "检查这一场有没有和前文矛盾。",
      promptTemplateId,
      promptTemplateVersion: 2,
      items: [
        {
          id: "current-scene",
          kind: "scene",
          source: {
            type: "scene",
            id: scene.metadata.id,
            revision: scene.revision,
            label: scene.metadata.title,
          },
          title: "当前场景",
          content: scene.content,
          inclusion: "required",
          inclusionReason: "当前写作场景",
          contextPolicy: "always",
          tokenEstimate: 120,
          manuallySelected: false,
          textHash: HASH_A,
        },
      ],
      excluded: [
        {
          source: { type: "codex-entry", id: randomUUID(), revision: null, label: "后文身份" },
          reason: "future-information",
          title: "后文身份",
          note: "当前场景之后才揭示。",
        },
      ],
      estimatedUsage: { inputTokens: 120, outputTokens: 80, totalTokens: 200 },
      createdAt: now,
    };
    const callLog: ModelCallLog = {
      schemaVersion: 2,
      id: modelCallId,
      seriesId: series.manifest.id,
      sceneId: scene.metadata.id,
      roleId: role.id,
      taskKind: "continuity-check",
      provider: "mock",
      model: profile.model,
      contextBundleId,
      promptTemplateId,
      promptTemplateVersion: 2,
      requestHash: HASH_A,
      resolvedParameters: { temperature: 0.2, maxOutputTokens: 800 },
      responseHash: HASH_B,
      status: "succeeded",
      estimatedUsage: { inputTokens: 120, outputTokens: 80, totalTokens: 200 },
      actualUsage: { inputTokens: 118, outputTokens: 42, totalTokens: 160 },
      errorCode: null,
      errorMessage: null,
      error: null,
      startedAt: now,
      completedAt: now,
    };

    await store.saveModelProfile(profile);
    await store.saveEmbeddingModelProfile(embeddingProfile);
    await store.saveAgentRole(series.manifest.id, role);
    await store.savePromptTemplate(series.manifest.id, templateV1);
    await store.savePromptTemplate(series.manifest.id, templateV2);
    await store.savePromptPreset(series.manifest.id, preset);
    await store.saveContextBundle(series.manifest.id, bundle);
    await store.saveModelCallLog(series.manifest.id, callLog);

    expect(await store.getModelProfile(modelProfileId)).toMatchObject({
      id: modelProfileId,
      credentialRef: "novel-studio:test:credential-ref",
    });
    expect(await store.getEmbeddingModelProfile(embeddingProfileId)).toMatchObject({
      id: embeddingProfileId,
      model: "BAAI/bge-small-zh-v1.5",
      dimensions: 512,
      credentialRef: "novel-studio:embedding:credential-ref",
    });
    expect((await store.listEmbeddingModelProfiles()).map((item) => item.id)).toEqual([
      embeddingProfileId,
    ]);
    expect(await store.getAgentRole(series.manifest.id, role.id)).toMatchObject({ title: "上下文检查" });
    expect((await store.listPromptTemplates(series.manifest.id)).map((template) => template.version)).toEqual([1, 2]);
    expect(await store.getPromptPreset(series.manifest.id, promptPresetId)).toMatchObject({
      promptTemplateVersion: 2,
    });
    expect((await store.listContextBundles(series.manifest.id)).map((item) => item.id)).toEqual([
      contextBundleId,
    ]);
    expect((await store.listModelCallLogs(series.manifest.id)).map((item) => item.id)).toEqual([
      modelCallId,
    ]);

    const root = await seriesRoot(store, series.manifest.id);
    const profileFile = await readFile(
      path.join(store.libraryRoot, ".studio", "model-profiles", `${modelProfileId}.json`),
      "utf8",
    );
    const embeddingProfileFile = await readFile(
      path.join(store.libraryRoot, ".studio", "embedding-profiles", `${embeddingProfileId}.json`),
      "utf8",
    );
    expect(JSON.parse(profileFile)).toMatchObject({
      credentialRef: "novel-studio:test:credential-ref",
    });
    expect(JSON.parse(embeddingProfileFile)).toMatchObject({
      credentialRef: "novel-studio:embedding:credential-ref",
      dimensions: 512,
    });
    expect(profileFile).not.toContain("sk-");
    expect(embeddingProfileFile).not.toContain("sk-");

    await rm(path.join(root, ".studio", "index.sqlite"), { force: true });
    await rm(path.join(root, ".studio", "index.sqlite-shm"), { force: true });
    await rm(path.join(root, ".studio", "index.sqlite-wal"), { force: true });
    const rebuilt = await store.rebuildIndex(series.manifest.id);
    expect(rebuilt.indexedContextBundles).toBe(1);
    expect(rebuilt.indexedModelCalls).toBe(1);

    const database = new Database(path.join(root, ".studio", "index.sqlite"));
    try {
      expect(database.prepare("SELECT count(*) AS count FROM ai_context_bundles").get()).toMatchObject({
        count: 1,
      });
      expect(database.prepare("SELECT count(*) AS count FROM ai_model_calls").get()).toMatchObject({
        count: 1,
      });
    } finally {
      database.close();
    }
  });

  it("rejects invalid AI contracts and corrupt AI JSON files", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "坏 AI 文件" });
    const root = await seriesRoot(store, series.manifest.id);
    const profileId = randomUUID();

    expect(ModelProfileSchema.safeParse({
      schemaVersion: 1,
      id: profileId,
      title: "未知 Provider",
      provider: "not-real",
      model: "x",
      capabilities: {
        streamText: false,
        structuredOutput: false,
        embeddings: false,
        tokenEstimate: false,
        modelList: false,
      },
      contextWindowTokens: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).success).toBe(false);

    expect(EmbeddingModelProfileSchema.safeParse({
      schemaVersion: 1,
      id: randomUUID(),
      title: "坏 Embedding 权限",
      provider: "local-http",
      baseUrl: "http://127.0.0.1:8080",
      endpointPath: "/embed",
      model: "BAAI/bge-small-zh-v1.5",
      credentialRef: "Bearer very-secret-token",
      dimensions: 512,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).success).toBe(false);

    expect(ModelProfileSchema.safeParse({
      schemaVersion: 1,
      id: profileId,
      title: "坏权限",
      provider: "mock",
      model: "x",
      credentialRef: "sk-this-should-not-be-saved",
      capabilities: {
        streamText: false,
        structuredOutput: false,
        embeddings: false,
        tokenEstimate: false,
        modelList: false,
      },
      contextWindowTokens: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).success).toBe(false);

    const directory = path.join(store.libraryRoot, ".studio", "model-profiles");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, `${profileId}.json`), "not: valid: JSON", "utf8");

    await expect(store.listModelProfiles()).rejects.toMatchObject<Partial<StorageError>>({
      code: "INVALID_DATA",
    });
  });

  it("persists new version 2 Context Bundles with internal book evidence", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "Context Bundle V2 book" });
    const root = await seriesRoot(store, series.manifest.id);
    const volumeId = series.books[0]!.id;
    const bundle: ContextBundle = {
      schemaVersion: 2,
      id: randomUUID(),
      seriesId: series.manifest.id,
      sceneId: null,
      roleId: "workshop-general-chat",
      taskKind: "analysis",
      userRequest: "Use this Volume evidence.",
      promptTemplateId: randomUUID(),
      promptTemplateVersion: 1,
      items: [{
        id: "volume-evidence",
        kind: "book",
        source: { type: "book", id: volumeId, revision: null, label: "Volume 1" },
        sourceRefs: [],
        title: "Volume: Volume 1",
        content: "Volume evidence.",
        inclusion: "selected",
        inclusionReason: "Author selected this Volume.",
        contextPolicy: "manual",
        tokenEstimate: 3,
        manuallySelected: true,
        textHash: null,
      }],
      excluded: [],
      estimatedUsage: { inputTokens: 3, outputTokens: 0, totalTokens: 3 },
      createdAt: "2026-07-17T00:00:00.000Z",
    };

    expect(await store.saveContextBundle(series.manifest.id, bundle)).toMatchObject({
      schemaVersion: 2,
      items: [{ kind: "book", source: { type: "book", id: volumeId } }],
    });
    expect(JSON.parse(await readFile(
      path.join(root, ".studio", "context-bundles", `${bundle.id}.json`),
      "utf8",
    ))).toMatchObject({
      schemaVersion: 2,
      items: [{ kind: "book", source: { type: "book", id: volumeId } }],
    });
  });

  it("rejects cancelled Model Call Logs with error fields without creating authority", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "Cancelled Model Call validation" });
    const root = await seriesRoot(store, series.manifest.id);
    const callId = randomUUID();
    const nullParametersCallId = randomUUID();
    const now = "2026-07-17T00:00:00.000Z";
    const invalidLog = {
      schemaVersion: 2,
      id: callId,
      seriesId: series.manifest.id,
      sceneId: null,
      roleId: "workshop-general-chat",
      taskKind: "analysis",
      provider: "mock",
      model: "mock-continuity-v1",
      contextBundleId: randomUUID(),
      promptTemplateId: randomUUID(),
      promptTemplateVersion: 1,
      requestHash: HASH_A,
      resolvedParameters: {},
      responseHash: null,
      status: "cancelled",
      estimatedUsage: { inputTokens: 1, outputTokens: 0, totalTokens: 1 },
      actualUsage: { inputTokens: 1, outputTokens: 0, totalTokens: 1 },
      errorCode: "provider-error",
      errorMessage: "Cancelled calls cannot keep an error.",
      error: {
        code: "provider-error",
        message: "Cancelled calls cannot keep an error.",
        retryable: false,
      },
      startedAt: now,
      completedAt: now,
    } as ModelCallLog;

    await expect(store.saveModelCallLog(series.manifest.id, invalidLog)).rejects.toThrow();
    await expect(store.saveModelCallLog(series.manifest.id, {
      ...invalidLog,
      id: nullParametersCallId,
      status: "succeeded",
      resolvedParameters: null,
      responseHash: HASH_B,
      errorCode: null,
      errorMessage: null,
      error: null,
    })).rejects.toThrow();
    await expect(readFile(
      path.join(root, ".studio", "model-calls", `${callId}.json`),
      "utf8",
    )).rejects.toMatchObject<NodeJS.ErrnoException>({ code: "ENOENT" });
    await expect(readFile(
      path.join(root, ".studio", "model-calls", `${nullParametersCallId}.json`),
      "utf8",
    )).rejects.toMatchObject<NodeJS.ErrnoException>({ code: "ENOENT" });
  });

  it("explicitly migrates and exactly rolls back version 1 Model Profiles and Model Call Logs", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "AI authority migration" });
    const root = await seriesRoot(store, series.manifest.id);
    const now = "2026-07-17T00:00:00.000Z";
    const profileId = randomUUID();
    const callId = randomUUID();
    const contextBundleId = randomUUID();
    const promptTemplateId = randomUUID();
    const profilePath = path.join(store.libraryRoot, ".studio", "model-profiles", `${profileId}.json`);
    const callPath = path.join(root, ".studio", "model-calls", `${callId}.json`);
    await mkdir(path.dirname(profilePath), { recursive: true });
    await mkdir(path.dirname(callPath), { recursive: true });
    const legacyProfileRaw = `${JSON.stringify({
      schemaVersion: 1,
      id: profileId,
      title: "Legacy exact model",
      provider: "mock",
      baseUrl: null,
      model: "mock-legacy",
      credentialRef: null,
      defaultParameters: { temperature: 0.4 },
      capabilities: {
        streamText: true,
        structuredOutput: true,
        embeddings: false,
        tokenEstimate: true,
        modelList: true,
      },
      contextWindowTokens: 8192,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    }, null, 2)}\n`;
    const legacyCallRaw = `${JSON.stringify({
      schemaVersion: 1,
      id: callId,
      seriesId: series.manifest.id,
      sceneId: null,
      roleId: "workshop-general-chat",
      taskKind: "analysis",
      provider: "mock",
      model: "mock-legacy",
      contextBundleId,
      promptTemplateId,
      promptTemplateVersion: 1,
      requestHash: HASH_A,
      responseHash: HASH_B,
      status: "succeeded",
      estimatedUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      actualUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      errorCode: null,
      errorMessage: null,
      error: null,
      startedAt: now,
      completedAt: now,
    }, null, 2)}\n`;
    await writeFile(profilePath, legacyProfileRaw, "utf8");
    await writeFile(callPath, legacyCallRaw, "utf8");

    expect(await store.getModelProfile(profileId)).toMatchObject({
      schemaVersion: 2,
      reasoningPreference: null,
    });
    expect(await store.getModelCallLog(series.manifest.id, callId)).toMatchObject({
      schemaVersion: 2,
      resolvedParameters: null,
    });
    expect(await readFile(profilePath, "utf8")).toBe(legacyProfileRaw);
    expect(await readFile(callPath, "utf8")).toBe(legacyCallRaw);

    const profileMigration = await store.migrateModelProfilesToV2();
    const callMigration = await store.migrateModelCallLogsToV2(series.manifest.id);
    expect(profileMigration.migratedProfileIds).toEqual([profileId]);
    expect(callMigration.migratedCallIds).toEqual([callId]);
    expect(JSON.parse(await readFile(profilePath, "utf8"))).toMatchObject({
      schemaVersion: 2,
      reasoningPreference: null,
    });
    expect(JSON.parse(await readFile(callPath, "utf8"))).toMatchObject({
      schemaVersion: 2,
      resolvedParameters: null,
    });

    expect((await store.rollbackModelProfilesV2Migration(profileMigration.migrationId)).restoredProfileIds)
      .toEqual([profileId]);
    expect((await store.rollbackModelCallLogsV2Migration(
      series.manifest.id,
      callMigration.migrationId,
    )).restoredCallIds).toEqual([callId]);
    expect(await readFile(profilePath, "utf8")).toBe(legacyProfileRaw);
    expect(await readFile(callPath, "utf8")).toBe(legacyCallRaw);

    const changedProfileMigration = await store.migrateModelProfilesToV2();
    await writeFile(profilePath, `${await readFile(profilePath, "utf8")} `, "utf8");
    await expect(store.rollbackModelProfilesV2Migration(changedProfileMigration.migrationId))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });

    const missingCallMigration = await store.migrateModelCallLogsToV2(series.manifest.id);
    await rm(callPath);
    await expect(store.rollbackModelCallLogsV2Migration(
      series.manifest.id,
      missingCallMigration.migrationId,
    )).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });
  });

  it("does not rewrite valid version 1 AI authority when a migration source is damaged", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "Damaged AI migration" });
    const root = await seriesRoot(store, series.manifest.id);
    const now = "2026-07-17T00:00:00.000Z";
    const profileId = "11111111-1111-4111-8111-111111111111";
    const callId = "22222222-2222-4222-8222-222222222222";
    const profileDirectory = path.join(store.libraryRoot, ".studio", "model-profiles");
    const callDirectory = path.join(root, ".studio", "model-calls");
    await mkdir(profileDirectory, { recursive: true });
    await mkdir(callDirectory, { recursive: true });
    const profileRaw = `${JSON.stringify({
      schemaVersion: 1,
      id: profileId,
      title: "Valid legacy profile",
      provider: "mock",
      model: "mock-valid",
      capabilities: {
        streamText: true,
        structuredOutput: false,
        embeddings: false,
        tokenEstimate: true,
        modelList: true,
      },
      createdAt: now,
      updatedAt: now,
    }, null, 2)}\n`;
    const callRaw = `${JSON.stringify({
      schemaVersion: 1,
      id: callId,
      seriesId: series.manifest.id,
      roleId: "workshop-general-chat",
      taskKind: "analysis",
      provider: "mock",
      model: "mock-valid",
      contextBundleId: "33333333-3333-4333-8333-333333333333",
      promptTemplateId: "44444444-4444-4444-8444-444444444444",
      promptTemplateVersion: 1,
      requestHash: HASH_A,
      status: "started",
      estimatedUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      startedAt: now,
    }, null, 2)}\n`;
    const profilePath = path.join(profileDirectory, `${profileId}.json`);
    const callPath = path.join(callDirectory, `${callId}.json`);
    await writeFile(profilePath, profileRaw, "utf8");
    await writeFile(path.join(profileDirectory, "ffffffff-ffff-4fff-8fff-ffffffffffff.json"), "{damaged\n", "utf8");
    await writeFile(callPath, callRaw, "utf8");
    await writeFile(path.join(callDirectory, "ffffffff-ffff-4fff-8fff-ffffffffffff.json"), "{damaged\n", "utf8");

    await expect(store.migrateModelProfilesToV2())
      .rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    await expect(store.migrateModelCallLogsToV2(series.manifest.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    expect(await readFile(profilePath, "utf8")).toBe(profileRaw);
    expect(await readFile(callPath, "utf8")).toBe(callRaw);
  });

  it("migrates Context Bundle evidence to version 2 without changing legacy act and chapter meaning and restores exact bytes", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "Context Bundle migration" });
    const root = await seriesRoot(store, series.manifest.id);
    const bundleId = randomUUID();
    const storedActId = randomUUID();
    const storedChapterId = randomUUID();
    const promptTemplateId = randomUUID();
    const bundlePath = path.join(root, ".studio", "context-bundles", `${bundleId}.json`);
    const now = "2026-07-17T00:00:00.000Z";
    await mkdir(path.dirname(bundlePath), { recursive: true });
    const legacyRaw = `${JSON.stringify({
      schemaVersion: 1,
      id: bundleId,
      seriesId: series.manifest.id,
      sceneId: null,
      roleId: "workshop-general-chat",
      taskKind: "analysis",
      userRequest: "Preserve internal hierarchy evidence.",
      promptTemplateId,
      promptTemplateVersion: 1,
      items: [
        {
          id: "legacy-act",
          kind: "act",
          source: { type: "act", id: storedActId, revision: null, label: "Stored ActManifest" },
          sourceRefs: [],
          title: "Author-facing Chapter",
          content: "Stored ActManifest evidence.",
          inclusion: "selected",
          inclusionReason: "Legacy basket selection",
          contextPolicy: "manual",
          tokenEstimate: 5,
          manuallySelected: true,
          textHash: null,
        },
        {
          id: "legacy-chapter",
          kind: "chapter",
          source: { type: "chapter", id: storedChapterId, revision: null, label: "Stored ChapterManifest" },
          sourceRefs: [],
          title: "Author-facing Act",
          content: "Stored ChapterManifest evidence.",
          inclusion: "selected",
          inclusionReason: "Legacy basket selection",
          contextPolicy: "manual",
          tokenEstimate: 5,
          manuallySelected: true,
          textHash: null,
        },
      ],
      excluded: [],
      estimatedUsage: { inputTokens: 10, outputTokens: 0, totalTokens: 10 },
      createdAt: now,
    }, null, 2)}\n`;
    await writeFile(bundlePath, legacyRaw, "utf8");

    expect((await store.getContextBundle(series.manifest.id, bundleId)).items).toMatchObject([
      { kind: "act", source: { type: "act", id: storedActId } },
      { kind: "chapter", source: { type: "chapter", id: storedChapterId } },
    ]);
    expect(await readFile(bundlePath, "utf8")).toBe(legacyRaw);

    const migration = await store.migrateContextBundlesToV2(series.manifest.id);
    expect(migration.migratedContextBundleIds).toEqual([bundleId]);
    expect(JSON.parse(await readFile(bundlePath, "utf8"))).toMatchObject({
      schemaVersion: 2,
      items: [
        { kind: "act", source: { type: "act", id: storedActId } },
        { kind: "chapter", source: { type: "chapter", id: storedChapterId } },
      ],
    });
    expect((await store.rollbackContextBundlesV2Migration(
      series.manifest.id,
      migration.migrationId,
    )).restoredContextBundleIds).toEqual([bundleId]);
    expect(await readFile(bundlePath, "utf8")).toBe(legacyRaw);

    const changedMigration = await store.migrateContextBundlesToV2(series.manifest.id);
    await writeFile(bundlePath, `${await readFile(bundlePath, "utf8")} `, "utf8");
    await expect(store.rollbackContextBundlesV2Migration(
      series.manifest.id,
      changedMigration.migrationId,
    )).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });

    await writeFile(bundlePath, legacyRaw, "utf8");
    const missingMigration = await store.migrateContextBundlesToV2(series.manifest.id);
    await rm(bundlePath);
    await expect(store.rollbackContextBundlesV2Migration(
      series.manifest.id,
      missingMigration.migrationId,
    )).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });
  });

  it("rejects damaged Context Bundle migration input without rewriting valid version 1 authority", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "Context Bundle damage" });
    const root = await seriesRoot(store, series.manifest.id);
    const directory = path.join(root, ".studio", "context-bundles");
    const validId = "11111111-1111-4111-8111-111111111111";
    const damagedId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const now = "2026-07-17T00:00:00.000Z";
    await mkdir(directory, { recursive: true });
    const validRaw = `${JSON.stringify({
      schemaVersion: 1,
      id: validId,
      seriesId: series.manifest.id,
      sceneId: null,
      roleId: "workshop-general-chat",
      taskKind: "analysis",
      userRequest: "Keep this valid source unchanged.",
      promptTemplateId: "22222222-2222-4222-8222-222222222222",
      promptTemplateVersion: 1,
      items: [],
      excluded: [],
      estimatedUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      createdAt: now,
    }, null, 2)}\n`;
    const validPath = path.join(directory, `${validId}.json`);
    const damagedPath = path.join(directory, `${damagedId}.json`);
    await writeFile(validPath, validRaw, "utf8");
    await writeFile(damagedPath, "{damaged-json\n", "utf8");

    await expect(store.migrateContextBundlesToV2(series.manifest.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    expect(await readFile(validPath, "utf8")).toBe(validRaw);
    expect(await readFile(damagedPath, "utf8")).toBe("{damaged-json\n");
  });
});
