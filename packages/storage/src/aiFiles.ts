import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type Database from "better-sqlite3";
import YAML from "yaml";
import {
  AgentRoleSchema,
  ContextBundleSchema,
  ModelCallLogSchema,
  ModelProfileSchema,
  PromptPresetSchema,
  PromptTemplateSchema,
  type AgentRole,
  type ContextBundle,
  type ModelCallLog,
  type ModelProfile,
  type PromptPreset,
  type PromptTemplate,
} from "@novel-studio/contracts";
import { StorageError } from "./errors.js";
import { assertInside, atomicWrite } from "./fileSystem.js";

const STUDIO_DIR = ".studio";
const MODEL_PROFILES_DIR = "model-profiles";
const CONTEXT_BUNDLES_DIR = "context-bundles";
const MODEL_CALLS_DIR = "model-calls";
const PROMPTS_DIR = "prompts";
const PROMPT_ROLES_DIR = "roles";
const PROMPT_TEMPLATES_DIR = "templates";
const PROMPT_PRESETS_DIR = "presets";

export interface AiIndexCounts {
  indexedContextBundles: number;
  indexedModelCalls: number;
}

function serializeYaml(value: unknown): string {
  return YAML.stringify(value, { lineWidth: 0 });
}

async function readYaml<T>(filePath: string, parse: (input: unknown) => T): Promise<T> {
  try {
    return parse(YAML.parse(await readFile(filePath, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new StorageError("文件不存在", "NOT_FOUND", { filePath });
    }
    if (error instanceof StorageError) throw error;
    throw new StorageError("AI 文件 YAML 数据无效", "INVALID_DATA", {
      filePath,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

async function listYamlFiles(directory: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".yaml"))
    .map((entry) => path.join(directory, entry.name))
    .sort();
}

async function listDirectories(directory: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(directory, entry.name))
    .sort();
}

function modelProfilesRoot(seriesRoot: string): string {
  return assertInside(seriesRoot, path.join(seriesRoot, STUDIO_DIR, MODEL_PROFILES_DIR));
}

function contextBundlesRoot(seriesRoot: string): string {
  return assertInside(seriesRoot, path.join(seriesRoot, STUDIO_DIR, CONTEXT_BUNDLES_DIR));
}

function modelCallsRoot(seriesRoot: string): string {
  return assertInside(seriesRoot, path.join(seriesRoot, STUDIO_DIR, MODEL_CALLS_DIR));
}

function promptRolesRoot(seriesRoot: string): string {
  return assertInside(seriesRoot, path.join(seriesRoot, PROMPTS_DIR, PROMPT_ROLES_DIR));
}

function promptTemplatesRoot(seriesRoot: string): string {
  return assertInside(seriesRoot, path.join(seriesRoot, PROMPTS_DIR, PROMPT_TEMPLATES_DIR));
}

function promptPresetsRoot(seriesRoot: string): string {
  return assertInside(seriesRoot, path.join(seriesRoot, PROMPTS_DIR, PROMPT_PRESETS_DIR));
}

function modelProfilePath(seriesRoot: string, profileId: string): string {
  return assertInside(seriesRoot, path.join(modelProfilesRoot(seriesRoot), `${profileId}.yaml`));
}

function contextBundlePath(seriesRoot: string, contextBundleId: string): string {
  return assertInside(seriesRoot, path.join(contextBundlesRoot(seriesRoot), `${contextBundleId}.yaml`));
}

function modelCallLogPath(seriesRoot: string, modelCallId: string): string {
  return assertInside(seriesRoot, path.join(modelCallsRoot(seriesRoot), `${modelCallId}.yaml`));
}

function agentRolePath(seriesRoot: string, roleId: string): string {
  return assertInside(seriesRoot, path.join(promptRolesRoot(seriesRoot), `${roleId}.yaml`));
}

function promptTemplatePath(seriesRoot: string, promptTemplateId: string, version: number): string {
  return assertInside(
    seriesRoot,
    path.join(promptTemplatesRoot(seriesRoot), promptTemplateId, `v${version}.yaml`),
  );
}

function promptPresetPath(seriesRoot: string, presetId: string): string {
  return assertInside(seriesRoot, path.join(promptPresetsRoot(seriesRoot), `${presetId}.yaml`));
}

function assertFileNameMatches(filePath: string, expectedName: string): void {
  if (path.basename(filePath, ".yaml") !== expectedName) {
    throw new StorageError("AI 文件名与文件内容不一致", "INVALID_DATA", {
      filePath,
      expectedName,
    });
  }
}

export function ensureAiIndexTables(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS ai_context_bundles (
      id TEXT PRIMARY KEY,
      series_id TEXT NOT NULL,
      scene_id TEXT,
      role_id TEXT NOT NULL,
      task_kind TEXT NOT NULL,
      prompt_template_id TEXT NOT NULL,
      prompt_template_version INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ai_context_bundles_scene_idx
      ON ai_context_bundles(scene_id, created_at);
    CREATE TABLE IF NOT EXISTS ai_model_calls (
      id TEXT PRIMARY KEY,
      series_id TEXT NOT NULL,
      scene_id TEXT,
      role_id TEXT NOT NULL,
      task_kind TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      status TEXT NOT NULL,
      context_bundle_id TEXT NOT NULL,
      prompt_template_id TEXT NOT NULL,
      prompt_template_version INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS ai_model_calls_scene_idx
      ON ai_model_calls(scene_id, started_at);
  `);
}

export async function saveModelProfile(seriesRoot: string, rawProfile: ModelProfile): Promise<ModelProfile> {
  const profile = ModelProfileSchema.parse(rawProfile);
  await mkdir(modelProfilesRoot(seriesRoot), { recursive: true });
  await atomicWrite(modelProfilePath(seriesRoot, profile.id), serializeYaml(profile));
  return profile;
}

export async function getModelProfile(seriesRoot: string, profileId: string): Promise<ModelProfile> {
  return readYaml(modelProfilePath(seriesRoot, profileId), (value) => ModelProfileSchema.parse(value));
}

export async function listModelProfiles(seriesRoot: string): Promise<ModelProfile[]> {
  const files = await listYamlFiles(modelProfilesRoot(seriesRoot));
  const profiles: ModelProfile[] = [];
  for (const filePath of files) {
    const profile = await readYaml(filePath, (value) => ModelProfileSchema.parse(value));
    assertFileNameMatches(filePath, profile.id);
    profiles.push(profile);
  }
  return profiles.sort((left, right) => left.title.localeCompare(right.title, "zh-CN"));
}

export async function saveAgentRole(seriesRoot: string, rawRole: AgentRole): Promise<AgentRole> {
  const role = AgentRoleSchema.parse(rawRole);
  await mkdir(promptRolesRoot(seriesRoot), { recursive: true });
  await atomicWrite(agentRolePath(seriesRoot, role.id), serializeYaml(role));
  return role;
}

export async function getAgentRole(seriesRoot: string, roleId: string): Promise<AgentRole> {
  return readYaml(agentRolePath(seriesRoot, roleId), (value) => AgentRoleSchema.parse(value));
}

export async function listAgentRoles(seriesRoot: string): Promise<AgentRole[]> {
  const files = await listYamlFiles(promptRolesRoot(seriesRoot));
  const roles: AgentRole[] = [];
  for (const filePath of files) {
    const role = await readYaml(filePath, (value) => AgentRoleSchema.parse(value));
    assertFileNameMatches(filePath, role.id);
    roles.push(role);
  }
  return roles.sort((left, right) => left.title.localeCompare(right.title, "zh-CN"));
}

export async function savePromptTemplate(
  seriesRoot: string,
  rawTemplate: PromptTemplate,
): Promise<PromptTemplate> {
  const template = PromptTemplateSchema.parse(rawTemplate);
  const directory = path.dirname(promptTemplatePath(seriesRoot, template.id, template.version));
  await mkdir(directory, { recursive: true });
  await atomicWrite(promptTemplatePath(seriesRoot, template.id, template.version), serializeYaml(template));
  return template;
}

export async function getPromptTemplate(
  seriesRoot: string,
  promptTemplateId: string,
  version: number,
): Promise<PromptTemplate> {
  return readYaml(promptTemplatePath(seriesRoot, promptTemplateId, version), (value) =>
    PromptTemplateSchema.parse(value),
  );
}

export async function listPromptTemplates(seriesRoot: string): Promise<PromptTemplate[]> {
  const templateDirectories = await listDirectories(promptTemplatesRoot(seriesRoot));
  const templates: PromptTemplate[] = [];
  for (const directory of templateDirectories) {
    const templateId = path.basename(directory);
    for (const filePath of await listYamlFiles(directory)) {
      const template = await readYaml(filePath, (value) => PromptTemplateSchema.parse(value));
      if (template.id !== templateId || path.basename(filePath, ".yaml") !== `v${template.version}`) {
        throw new StorageError("提示词模板路径与文件内容不一致", "INVALID_DATA", {
          filePath,
          templateId: template.id,
          version: template.version,
        });
      }
      templates.push(template);
    }
  }
  return templates.sort((left, right) => {
    const byName = left.name.localeCompare(right.name, "zh-CN");
    if (byName !== 0) return byName;
    return left.version - right.version;
  });
}

export async function savePromptPreset(seriesRoot: string, rawPreset: PromptPreset): Promise<PromptPreset> {
  const preset = PromptPresetSchema.parse(rawPreset);
  await mkdir(promptPresetsRoot(seriesRoot), { recursive: true });
  await atomicWrite(promptPresetPath(seriesRoot, preset.id), serializeYaml(preset));
  return preset;
}

export async function getPromptPreset(seriesRoot: string, presetId: string): Promise<PromptPreset> {
  return readYaml(promptPresetPath(seriesRoot, presetId), (value) => PromptPresetSchema.parse(value));
}

export async function listPromptPresets(seriesRoot: string): Promise<PromptPreset[]> {
  const files = await listYamlFiles(promptPresetsRoot(seriesRoot));
  const presets: PromptPreset[] = [];
  for (const filePath of files) {
    const preset = await readYaml(filePath, (value) => PromptPresetSchema.parse(value));
    assertFileNameMatches(filePath, preset.id);
    presets.push(preset);
  }
  return presets.sort((left, right) => left.title.localeCompare(right.title, "zh-CN"));
}

export async function saveContextBundle(seriesRoot: string, rawBundle: ContextBundle): Promise<ContextBundle> {
  const bundle = ContextBundleSchema.parse(rawBundle);
  await mkdir(contextBundlesRoot(seriesRoot), { recursive: true });
  await atomicWrite(contextBundlePath(seriesRoot, bundle.id), serializeYaml(bundle));
  return bundle;
}

export async function getContextBundle(seriesRoot: string, contextBundleId: string): Promise<ContextBundle> {
  return readYaml(contextBundlePath(seriesRoot, contextBundleId), (value) =>
    ContextBundleSchema.parse(value),
  );
}

export async function listContextBundles(seriesRoot: string): Promise<ContextBundle[]> {
  const files = await listYamlFiles(contextBundlesRoot(seriesRoot));
  const bundles: ContextBundle[] = [];
  for (const filePath of files) {
    const bundle = await readYaml(filePath, (value) => ContextBundleSchema.parse(value));
    assertFileNameMatches(filePath, bundle.id);
    bundles.push(bundle);
  }
  return bundles.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function saveModelCallLog(seriesRoot: string, rawLog: ModelCallLog): Promise<ModelCallLog> {
  const log = ModelCallLogSchema.parse(rawLog);
  await mkdir(modelCallsRoot(seriesRoot), { recursive: true });
  await atomicWrite(modelCallLogPath(seriesRoot, log.id), serializeYaml(log));
  return log;
}

export async function getModelCallLog(seriesRoot: string, modelCallId: string): Promise<ModelCallLog> {
  return readYaml(modelCallLogPath(seriesRoot, modelCallId), (value) => ModelCallLogSchema.parse(value));
}

export async function listModelCallLogs(seriesRoot: string): Promise<ModelCallLog[]> {
  const files = await listYamlFiles(modelCallsRoot(seriesRoot));
  const logs: ModelCallLog[] = [];
  for (const filePath of files) {
    const log = await readYaml(filePath, (value) => ModelCallLogSchema.parse(value));
    assertFileNameMatches(filePath, log.id);
    logs.push(log);
  }
  return logs.sort((left, right) => right.startedAt.localeCompare(left.startedAt));
}

export async function rebuildAiIndex(seriesRoot: string, database: Database.Database): Promise<AiIndexCounts> {
  ensureAiIndexTables(database);
  database.exec(`
    DELETE FROM ai_context_bundles;
    DELETE FROM ai_model_calls;
  `);
  const contextBundles = await listContextBundles(seriesRoot);
  const modelCalls = await listModelCallLogs(seriesRoot);
  const insertContext = database.prepare(`
    INSERT INTO ai_context_bundles (
      id, series_id, scene_id, role_id, task_kind,
      prompt_template_id, prompt_template_version, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertCall = database.prepare(`
    INSERT INTO ai_model_calls (
      id, series_id, scene_id, role_id, task_kind, provider, model, status,
      context_bundle_id, prompt_template_id, prompt_template_version,
      started_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const transaction = database.transaction(() => {
    for (const bundle of contextBundles) {
      insertContext.run(
        bundle.id,
        bundle.seriesId,
        bundle.sceneId,
        bundle.roleId,
        bundle.taskKind,
        bundle.promptTemplateId,
        bundle.promptTemplateVersion,
        bundle.createdAt,
      );
    }
    for (const log of modelCalls) {
      insertCall.run(
        log.id,
        log.seriesId,
        log.sceneId,
        log.roleId,
        log.taskKind,
        log.provider,
        log.model,
        log.status,
        log.contextBundleId,
        log.promptTemplateId,
        log.promptTemplateVersion,
        log.startedAt,
        log.completedAt,
      );
    }
  });
  transaction();
  return {
    indexedContextBundles: contextBundles.length,
    indexedModelCalls: modelCalls.length,
  };
}
