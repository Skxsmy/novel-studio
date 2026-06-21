import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ModelProfileSchema,
  type AgentRole,
  type ContextBundle,
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
  it("stores model profiles, prompts, context bundles and call logs without API keys", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "镜城 AI 文件" });
    const scene = series.scenes[0]!;
    const now = new Date().toISOString();
    const modelProfileId = randomUUID();
    const promptTemplateId = randomUUID();
    const promptPresetId = randomUUID();
    const contextBundleId = randomUUID();
    const modelCallId = randomUUID();

    const profile: ModelProfile = {
      schemaVersion: 1,
      id: modelProfileId,
      title: "Mock 连续性编辑",
      provider: "mock",
      model: "mock-continuity-v1",
      cloudPolicy: "local-only",
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
    const role: AgentRole = {
      schemaVersion: 1,
      id: "continuity-editor",
      title: "连续性编辑",
      description: "检查前后矛盾。",
      persona: "冷静核对证据。",
      duties: ["指出矛盾并给出证据。"],
      nonDuties: ["不做润色"],
      challengeObligation: "必须指出不合逻辑处。",
      forbiddenActions: ["直接改写正文", "直接更新已确认设定"],
      outputContract: "按风险、证据和建议输出。",
      readScopes: { scenes: true, codex: true, research: false },
      builtIn: true,
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
      system: "你是中文长篇小说的连续性编辑。",
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
      schemaVersion: 1,
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
          access: "local-only",
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
      schemaVersion: 1,
      id: modelCallId,
      seriesId: series.manifest.id,
      sceneId: scene.metadata.id,
      roleId: role.id,
      taskKind: "continuity-check",
      provider: "mock",
      model: profile.model,
      cloudPolicy: "local-only",
      contextBundleId,
      promptTemplateId,
      promptTemplateVersion: 2,
      requestHash: HASH_A,
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

    await store.saveModelProfile(series.manifest.id, profile);
    await store.saveAgentRole(series.manifest.id, role);
    await store.savePromptTemplate(series.manifest.id, templateV1);
    await store.savePromptTemplate(series.manifest.id, templateV2);
    await store.savePromptPreset(series.manifest.id, preset);
    await store.saveContextBundle(series.manifest.id, bundle);
    await store.saveModelCallLog(series.manifest.id, callLog);

    expect(await store.getModelProfile(series.manifest.id, modelProfileId)).toMatchObject({
      id: modelProfileId,
      credentialRef: "novel-studio:test:credential-ref",
    });
    expect(await store.getAgentRole(series.manifest.id, role.id)).toMatchObject({ title: "连续性编辑" });
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
      path.join(root, ".studio", "model-profiles", `${modelProfileId}.yaml`),
      "utf8",
    );
    expect(profileFile).toContain("credentialRef: novel-studio:test:credential-ref");
    expect(profileFile).not.toContain("sk-");

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

  it("rejects invalid AI contracts and corrupt AI YAML files", async () => {
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
      cloudPolicy: "local-only",
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

    expect(ModelProfileSchema.safeParse({
      schemaVersion: 1,
      id: profileId,
      title: "坏权限",
      provider: "mock",
      model: "x",
      cloudPolicy: "secret-cloud",
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

    const directory = path.join(root, ".studio", "model-profiles");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, `${profileId}.yaml`), "not: valid: yaml", "utf8");

    await expect(store.listModelProfiles(series.manifest.id)).rejects.toMatchObject<Partial<StorageError>>({
      code: "INVALID_DATA",
    });
  });
});
