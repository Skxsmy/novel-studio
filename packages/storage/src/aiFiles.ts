import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import type Database from "better-sqlite3";
import {
  AgentRoleSchema,
  ContextBundleAuthoritySchema,
  ContextBundleSchema,
  ContextBundleV1Schema,
  ContextBundleV2MigrationBackupSchema,
  ContextBundleV2MigrationResultSchema,
  EmbeddingModelProfileSchema,
  EmbeddingUseCaseBindingDocumentSchema,
  EmbeddingUseCaseIdSchema,
  ModelCallLogV1Schema,
  ModelCallLogV2MigrationBackupSchema,
  ModelCallLogV2MigrationResultSchema,
  ModelCallLogV2Schema,
  ModelCallLogSchema,
  NewModelCallLogV2Schema,
  ModelProfileV1Schema,
  ModelProfileV2MigrationBackupSchema,
  ModelProfileV2MigrationResultSchema,
  ModelProfileV2Schema,
  ModelProfileSchema,
  PromptPresetSchema,
  PromptTemplateSchema,
  RollbackContextBundleV2MigrationResultSchema,
  RollbackModelCallLogV2MigrationResultSchema,
  RollbackModelProfileV2MigrationResultSchema,
  type AgentRole,
  type ContextBundle,
  type ContextBundleV2MigrationBackup,
  type ContextBundleV2MigrationResult,
  type EmbeddingModelProfile,
  type EmbeddingUseCaseBindingDocument,
  type EmbeddingUseCaseId,
  type ModelCallLog,
  type ModelCallLogV2MigrationBackup,
  type ModelCallLogV2MigrationResult,
  type ModelProfile,
  type ModelProfileV2MigrationBackup,
  type ModelProfileV2MigrationResult,
  type PromptPreset,
  type PromptTemplate,
  type RollbackModelCallLogV2MigrationResult,
  type RollbackModelProfileV2MigrationResult,
  type RollbackContextBundleV2MigrationResult,
} from "@novel-studio/contracts";
import { StorageError } from "./errors.js";
import { runSeriesFileTransaction } from "./fileTransactions.js";
import { assertInside } from "./fileSystem.js";
import {
  jsonAuthorityRevision,
  parseJsonAuthorityText,
  readJsonAuthorityFile,
  serializeJsonAuthority,
  writeJsonAuthorityFile,
} from "./jsonAuthority.js";

const STUDIO_DIR = ".studio";
const MODEL_PROFILES_DIR = "model-profiles";
const EMBEDDING_PROFILES_DIR = "embedding-profiles";
const EMBEDDING_BINDINGS_DIR = "embedding-bindings";
const CONTEXT_BUNDLES_DIR = "context-bundles";
const MODEL_CALLS_DIR = "model-calls";
const PROMPTS_DIR = "prompts";
const PROMPT_ROLES_DIR = "roles";
const PROMPT_TEMPLATES_DIR = "templates";
const PROMPT_PRESETS_DIR = "presets";
const MIGRATIONS_DIR = "migrations";

export interface AiIndexCounts {
  indexedContextBundles: number;
  indexedModelCalls: number;
}

async function readJson<T>(filePath: string, parse: (input: unknown) => T): Promise<T> {
  try {
    const document = await readJsonAuthorityFile(
      path.dirname(filePath),
      filePath,
      parse,
      "AI JSON authority file",
    );
    return document.data;
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code === "ENOENT" ||
      (error instanceof StorageError && error.code === "NOT_FOUND")
    ) {
      throw new StorageError("文件不存在", "NOT_FOUND", { filePath });
    }
    if (error instanceof StorageError) throw error;
    throw new StorageError("AI JSON authority file is invalid", "INVALID_DATA", {
      filePath,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

async function writeJson<T>(
  filePath: string,
  value: unknown,
  parse: (input: unknown) => T,
): Promise<T> {
  const document = await writeJsonAuthorityFile(
    path.dirname(filePath),
    filePath,
    value,
    parse,
  );
  return document.data;
}

async function listJsonFiles(directory: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
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

function modelProfilesRoot(libraryRoot: string): string {
  return assertInside(libraryRoot, path.join(libraryRoot, STUDIO_DIR, MODEL_PROFILES_DIR));
}

function embeddingProfilesRoot(libraryRoot: string): string {
  return assertInside(libraryRoot, path.join(libraryRoot, STUDIO_DIR, EMBEDDING_PROFILES_DIR));
}

function embeddingBindingsRoot(libraryRoot: string): string {
  return assertInside(libraryRoot, path.join(libraryRoot, STUDIO_DIR, EMBEDDING_BINDINGS_DIR));
}

function contextBundlesRoot(seriesRoot: string): string {
  return assertInside(seriesRoot, path.join(seriesRoot, STUDIO_DIR, CONTEXT_BUNDLES_DIR));
}

function modelCallsRoot(seriesRoot: string): string {
  return assertInside(seriesRoot, path.join(seriesRoot, STUDIO_DIR, MODEL_CALLS_DIR));
}

function migrationsRoot(root: string): string {
  return assertInside(root, path.join(root, STUDIO_DIR, MIGRATIONS_DIR));
}

function modelProfileMigrationBackupPath(libraryRoot: string, migrationId: string): string {
  return assertInside(
    libraryRoot,
    path.join(migrationsRoot(libraryRoot), `adr-0017-model-profiles-${migrationId}.json`),
  );
}

function modelCallLogMigrationBackupPath(seriesRoot: string, migrationId: string): string {
  return assertInside(
    seriesRoot,
    path.join(migrationsRoot(seriesRoot), `adr-0017-model-calls-${migrationId}.json`),
  );
}

function contextBundleMigrationBackupPath(seriesRoot: string, migrationId: string): string {
  return assertInside(
    seriesRoot,
    path.join(migrationsRoot(seriesRoot), `adr-0017-context-bundles-${migrationId}.json`),
  );
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

function modelProfilePath(libraryRoot: string, profileId: string): string {
  return assertInside(libraryRoot, path.join(modelProfilesRoot(libraryRoot), `${profileId}.json`));
}

function embeddingProfilePath(libraryRoot: string, profileId: string): string {
  return assertInside(libraryRoot, path.join(embeddingProfilesRoot(libraryRoot), `${profileId}.json`));
}

function embeddingBindingPath(libraryRoot: string, rawUseCase: EmbeddingUseCaseId): string {
  const useCase = EmbeddingUseCaseIdSchema.parse(rawUseCase);
  return assertInside(libraryRoot, path.join(embeddingBindingsRoot(libraryRoot), `${useCase}.json`));
}

function contextBundlePath(seriesRoot: string, contextBundleId: string): string {
  return assertInside(seriesRoot, path.join(contextBundlesRoot(seriesRoot), `${contextBundleId}.json`));
}

function modelCallLogPath(seriesRoot: string, modelCallId: string): string {
  return assertInside(seriesRoot, path.join(modelCallsRoot(seriesRoot), `${modelCallId}.json`));
}

function agentRolePath(seriesRoot: string, roleId: string): string {
  return assertInside(seriesRoot, path.join(promptRolesRoot(seriesRoot), `${roleId}.json`));
}

function promptTemplatePath(seriesRoot: string, promptTemplateId: string, version: number): string {
  return assertInside(
    seriesRoot,
    path.join(promptTemplatesRoot(seriesRoot), promptTemplateId, `v${version}.json`),
  );
}

function promptPresetPath(seriesRoot: string, presetId: string): string {
  return assertInside(seriesRoot, path.join(promptPresetsRoot(seriesRoot), `${presetId}.json`));
}

function assertFileNameMatches(filePath: string, expectedName: string): void {
  if (path.basename(filePath, ".json") !== expectedName) {
    throw new StorageError("AI 文件名与文件内容不一致", "INVALID_DATA", {
      filePath,
      expectedName,
    });
  }
}

function parseModelProfileAuthority(value: unknown) {
  const version2 = ModelProfileV2Schema.safeParse(value);
  if (version2.success) return version2.data;
  return ModelProfileV1Schema.parse(value);
}

function parseModelCallLogAuthority(value: unknown) {
  const version2 = ModelCallLogV2Schema.safeParse(value);
  if (version2.success) return version2.data;
  return ModelCallLogV1Schema.parse(value);
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

export async function saveModelProfile(libraryRoot: string, rawProfile: ModelProfile): Promise<ModelProfile> {
  const profile = ModelProfileSchema.parse(rawProfile);
  await mkdir(modelProfilesRoot(libraryRoot), { recursive: true });
  return runSeriesFileTransaction(libraryRoot, () =>
    writeJson(modelProfilePath(libraryRoot, profile.id), profile, (value) =>
      ModelProfileSchema.parse(value),
    ));
}

export async function getModelProfile(libraryRoot: string, profileId: string): Promise<ModelProfile> {
  return readJson(modelProfilePath(libraryRoot, profileId), (value) => ModelProfileSchema.parse(value));
}

export async function listModelProfiles(libraryRoot: string): Promise<ModelProfile[]> {
  const files = await listJsonFiles(modelProfilesRoot(libraryRoot));
  const profiles: ModelProfile[] = [];
  for (const filePath of files) {
    const profile = await readJson(filePath, (value) => ModelProfileSchema.parse(value));
    assertFileNameMatches(filePath, profile.id);
    profiles.push(profile);
  }
  return profiles.sort((left, right) => left.title.localeCompare(right.title, "zh-CN"));
}

export async function migrateModelProfilesToV2(
  libraryRoot: string,
): Promise<ModelProfileV2MigrationResult> {
  return runSeriesFileTransaction(libraryRoot, async (commit) => {
  const migrationId = randomUUID();
  const documents: ModelProfileV2MigrationBackup["documents"] = [];
  const mutations: Array<{ targetPath: string; content: string }> = [];
  const seenIds = new Set<string>();
  for (const filePath of await listJsonFiles(modelProfilesRoot(libraryRoot))) {
    const raw = await readFile(filePath, "utf8");
    const authority = parseJsonAuthorityText(
      raw,
      parseModelProfileAuthority,
      "Model Profile migration source",
    );
    assertFileNameMatches(filePath, authority.id);
    if (seenIds.has(authority.id)) {
      throw new StorageError("Model Profile migration found a duplicate identity", "INVALID_DATA", {
        profileId: authority.id,
      });
    }
    seenIds.add(authority.id);
    if (authority.schemaVersion !== 1) continue;
    const migratedRaw = serializeJsonAuthority(ModelProfileSchema.parse(authority));
    documents.push({
      profileId: authority.id,
      relativePath: path.posix.join(STUDIO_DIR, MODEL_PROFILES_DIR, `${authority.id}.json`),
      raw,
      revision: jsonAuthorityRevision(raw),
      migratedRevision: jsonAuthorityRevision(migratedRaw),
    });
    mutations.push({ targetPath: filePath, content: migratedRaw });
  }
  const backup = ModelProfileV2MigrationBackupSchema.parse({
    schemaVersion: 1,
    scope: "library-model-profiles",
    migrationId,
    createdAt: new Date().toISOString(),
    documents,
  });
  await commit([{
    targetPath: modelProfileMigrationBackupPath(libraryRoot, migrationId),
    content: serializeJsonAuthority(backup),
  }, ...mutations]);
  return ModelProfileV2MigrationResultSchema.parse({
    migrationId,
    migratedProfileIds: documents.map((document) => document.profileId),
  });
  });
}

export async function rollbackModelProfilesV2Migration(
  libraryRoot: string,
  migrationId: string,
): Promise<RollbackModelProfileV2MigrationResult> {
  return runSeriesFileTransaction(libraryRoot, async (commit) => {
  let rawBackup: string;
  try {
    rawBackup = await readFile(modelProfileMigrationBackupPath(libraryRoot, migrationId), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new StorageError("Model Profile migration backup does not exist", "NOT_FOUND", { migrationId });
    }
    throw error;
  }
  const backup = parseJsonAuthorityText(
    rawBackup,
    (value) => ModelProfileV2MigrationBackupSchema.parse(value),
    "Model Profile migration backup",
  );
  if (backup.migrationId !== migrationId || backup.scope !== "library-model-profiles") {
    throw new StorageError("Model Profile migration backup identity does not match", "INVALID_DATA", {
      migrationId,
    });
  }
  const mutations: Array<{ targetPath: string; content: string }> = [];
  for (const document of backup.documents) {
    const expectedRelativePath = path.posix.join(
      STUDIO_DIR,
      MODEL_PROFILES_DIR,
      `${document.profileId}.json`,
    );
    if (
      document.relativePath !== expectedRelativePath ||
      jsonAuthorityRevision(document.raw) !== document.revision
    ) {
      throw new StorageError("Model Profile migration backup document is invalid", "INVALID_DATA", {
        migrationId,
        profileId: document.profileId,
      });
    }
    const original = parseJsonAuthorityText(
      document.raw,
      (value) => ModelProfileV1Schema.parse(value),
      "Model Profile rollback source",
    );
    if (original.id !== document.profileId) {
      throw new StorageError("Model Profile rollback source identity does not match", "INVALID_DATA", {
        migrationId,
        profileId: document.profileId,
      });
    }
    const targetPath = modelProfilePath(libraryRoot, document.profileId);
    let currentRaw: string;
    try {
      currentRaw = await readFile(targetPath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new StorageError("Model Profile changed after migration", "CONFLICT", {
          migrationId,
          profileId: document.profileId,
          currentRevision: null,
        });
      }
      throw error;
    }
    if (jsonAuthorityRevision(currentRaw) !== document.migratedRevision) {
      throw new StorageError("Model Profile changed after migration", "CONFLICT", {
        migrationId,
        profileId: document.profileId,
        currentRevision: jsonAuthorityRevision(currentRaw),
      });
    }
    mutations.push({ targetPath, content: document.raw });
  }
  await commit(mutations);
  return RollbackModelProfileV2MigrationResultSchema.parse({
    migrationId,
    restoredProfileIds: backup.documents.map((document) => document.profileId),
  });
  });
}

export async function saveEmbeddingModelProfile(
  libraryRoot: string,
  rawProfile: EmbeddingModelProfile,
): Promise<EmbeddingModelProfile> {
  const profile = EmbeddingModelProfileSchema.parse(rawProfile);
  await mkdir(embeddingProfilesRoot(libraryRoot), { recursive: true });
  return writeJson(embeddingProfilePath(libraryRoot, profile.id), profile, (value) =>
    EmbeddingModelProfileSchema.parse(value),
  );
}

export async function getEmbeddingModelProfile(
  libraryRoot: string,
  profileId: string,
): Promise<EmbeddingModelProfile> {
  return readJson(embeddingProfilePath(libraryRoot, profileId), (value) =>
    EmbeddingModelProfileSchema.parse(value),
  );
}

export async function listEmbeddingModelProfiles(libraryRoot: string): Promise<EmbeddingModelProfile[]> {
  const files = await listJsonFiles(embeddingProfilesRoot(libraryRoot));
  const profiles: EmbeddingModelProfile[] = [];
  for (const filePath of files) {
    const profile = await readJson(filePath, (value) => EmbeddingModelProfileSchema.parse(value));
    assertFileNameMatches(filePath, profile.id);
    profiles.push(profile);
  }
  return profiles.sort((left, right) => left.title.localeCompare(right.title, "zh-CN"));
}

export async function saveEmbeddingUseCaseBinding(
  libraryRoot: string,
  rawBinding: EmbeddingUseCaseBindingDocument,
): Promise<EmbeddingUseCaseBindingDocument> {
  const binding = EmbeddingUseCaseBindingDocumentSchema.parse(rawBinding);
  await mkdir(embeddingBindingsRoot(libraryRoot), { recursive: true });
  return writeJson(embeddingBindingPath(libraryRoot, binding.useCase), binding, (value) =>
    EmbeddingUseCaseBindingDocumentSchema.parse(value),
  );
}

export async function getEmbeddingUseCaseBinding(
  libraryRoot: string,
  useCase: EmbeddingUseCaseId,
): Promise<EmbeddingUseCaseBindingDocument> {
  return readJson(embeddingBindingPath(libraryRoot, useCase), (value) =>
    EmbeddingUseCaseBindingDocumentSchema.parse(value),
  );
}

export async function listEmbeddingUseCaseBindings(
  libraryRoot: string,
): Promise<EmbeddingUseCaseBindingDocument[]> {
  const files = await listJsonFiles(embeddingBindingsRoot(libraryRoot));
  const bindings: EmbeddingUseCaseBindingDocument[] = [];
  for (const filePath of files) {
    const binding = await readJson(filePath, (value) => EmbeddingUseCaseBindingDocumentSchema.parse(value));
    assertFileNameMatches(filePath, binding.useCase);
    bindings.push(binding);
  }
  return bindings.sort((left, right) => left.useCase.localeCompare(right.useCase, "und"));
}

export async function deleteEmbeddingUseCaseBinding(
  libraryRoot: string,
  useCase: EmbeddingUseCaseId,
): Promise<boolean> {
  try {
    await rm(embeddingBindingPath(libraryRoot, useCase));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function saveAgentRole(seriesRoot: string, rawRole: AgentRole): Promise<AgentRole> {
  const role = AgentRoleSchema.parse(rawRole);
  await mkdir(promptRolesRoot(seriesRoot), { recursive: true });
  return writeJson(agentRolePath(seriesRoot, role.id), role, (value) =>
    AgentRoleSchema.parse(value),
  );
}

export async function getAgentRole(seriesRoot: string, roleId: string): Promise<AgentRole> {
  return readJson(agentRolePath(seriesRoot, roleId), (value) => AgentRoleSchema.parse(value));
}

export async function listAgentRoles(seriesRoot: string): Promise<AgentRole[]> {
  const files = await listJsonFiles(promptRolesRoot(seriesRoot));
  const roles: AgentRole[] = [];
  for (const filePath of files) {
    const role = await readJson(filePath, (value) => AgentRoleSchema.parse(value));
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
  return writeJson(promptTemplatePath(seriesRoot, template.id, template.version), template, (value) =>
    PromptTemplateSchema.parse(value),
  );
}

export async function getPromptTemplate(
  seriesRoot: string,
  promptTemplateId: string,
  version: number,
): Promise<PromptTemplate> {
  return readJson(promptTemplatePath(seriesRoot, promptTemplateId, version), (value) =>
    PromptTemplateSchema.parse(value),
  );
}

export async function listPromptTemplates(seriesRoot: string): Promise<PromptTemplate[]> {
  const templateDirectories = await listDirectories(promptTemplatesRoot(seriesRoot));
  const templates: PromptTemplate[] = [];
  for (const directory of templateDirectories) {
    const templateId = path.basename(directory);
    for (const filePath of await listJsonFiles(directory)) {
      const template = await readJson(filePath, (value) => PromptTemplateSchema.parse(value));
      if (template.id !== templateId || path.basename(filePath, ".json") !== `v${template.version}`) {
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
  return writeJson(promptPresetPath(seriesRoot, preset.id), preset, (value) =>
    PromptPresetSchema.parse(value),
  );
}

export async function getPromptPreset(seriesRoot: string, presetId: string): Promise<PromptPreset> {
  return readJson(promptPresetPath(seriesRoot, presetId), (value) => PromptPresetSchema.parse(value));
}

export async function listPromptPresets(seriesRoot: string): Promise<PromptPreset[]> {
  const files = await listJsonFiles(promptPresetsRoot(seriesRoot));
  const presets: PromptPreset[] = [];
  for (const filePath of files) {
    const preset = await readJson(filePath, (value) => PromptPresetSchema.parse(value));
    assertFileNameMatches(filePath, preset.id);
    presets.push(preset);
  }
  return presets.sort((left, right) => left.title.localeCompare(right.title, "zh-CN"));
}

export async function saveContextBundle(seriesRoot: string, rawBundle: ContextBundle): Promise<ContextBundle> {
  return runSeriesFileTransaction(seriesRoot, async () => {
    const bundle = ContextBundleSchema.parse(rawBundle);
    await mkdir(contextBundlesRoot(seriesRoot), { recursive: true });
    return writeJson(contextBundlePath(seriesRoot, bundle.id), bundle, (value) =>
      ContextBundleSchema.parse(value),
    );
  });
}

export async function getContextBundle(seriesRoot: string, contextBundleId: string): Promise<ContextBundle> {
  return readJson(contextBundlePath(seriesRoot, contextBundleId), (value) =>
    ContextBundleSchema.parse(value),
  );
}

export async function listContextBundles(seriesRoot: string): Promise<ContextBundle[]> {
  const files = await listJsonFiles(contextBundlesRoot(seriesRoot));
  const bundles: ContextBundle[] = [];
  for (const filePath of files) {
    const bundle = await readJson(filePath, (value) => ContextBundleSchema.parse(value));
    assertFileNameMatches(filePath, bundle.id);
    bundles.push(bundle);
  }
  return bundles.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function migrateContextBundlesToV2(
  seriesRoot: string,
  seriesId: string,
): Promise<ContextBundleV2MigrationResult> {
  return runSeriesFileTransaction(seriesRoot, async (commit) => {
    const migrationId = randomUUID();
    const documents: ContextBundleV2MigrationBackup["documents"] = [];
    const mutations: Array<{ targetPath: string; content: string }> = [];
    for (const filePath of await listJsonFiles(contextBundlesRoot(seriesRoot))) {
      const raw = await readFile(filePath, "utf8");
      const authority = parseJsonAuthorityText(
        raw,
        (value) => ContextBundleAuthoritySchema.parse(value),
        "Context Bundle migration source",
      );
      assertFileNameMatches(filePath, authority.id);
      if (authority.seriesId !== seriesId) {
        throw new StorageError("Context Bundle migration found another Series identity", "INVALID_DATA", {
          contextBundleId: authority.id,
        });
      }
      if (authority.schemaVersion !== 1) continue;
      const migratedRaw = serializeJsonAuthority(ContextBundleSchema.parse(authority));
      documents.push({
        contextBundleId: authority.id,
        relativePath: path.posix.join(STUDIO_DIR, CONTEXT_BUNDLES_DIR, `${authority.id}.json`),
        raw,
        revision: jsonAuthorityRevision(raw),
        migratedRevision: jsonAuthorityRevision(migratedRaw),
      });
      mutations.push({ targetPath: filePath, content: migratedRaw });
    }
    const backup = ContextBundleV2MigrationBackupSchema.parse({
      schemaVersion: 1,
      migrationId,
      seriesId,
      createdAt: new Date().toISOString(),
      documents,
    });
    await commit([{
      targetPath: contextBundleMigrationBackupPath(seriesRoot, migrationId),
      content: serializeJsonAuthority(backup),
    }, ...mutations]);
    return ContextBundleV2MigrationResultSchema.parse({
      migrationId,
      migratedContextBundleIds: documents.map((document) => document.contextBundleId),
    });
  });
}

export async function rollbackContextBundlesV2Migration(
  seriesRoot: string,
  seriesId: string,
  migrationId: string,
): Promise<RollbackContextBundleV2MigrationResult> {
  return runSeriesFileTransaction(seriesRoot, async (commit) => {
    let rawBackup: string;
    try {
      rawBackup = await readFile(contextBundleMigrationBackupPath(seriesRoot, migrationId), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new StorageError("Context Bundle migration backup does not exist", "NOT_FOUND", { migrationId });
      }
      throw error;
    }
    const backup = parseJsonAuthorityText(
      rawBackup,
      (value) => ContextBundleV2MigrationBackupSchema.parse(value),
      "Context Bundle migration backup",
    );
    if (backup.migrationId !== migrationId || backup.seriesId !== seriesId) {
      throw new StorageError("Context Bundle migration backup identity does not match", "INVALID_DATA", { migrationId });
    }
    const mutations: Array<{ targetPath: string; content: string }> = [];
    for (const document of backup.documents) {
      const expectedRelativePath = path.posix.join(
        STUDIO_DIR,
        CONTEXT_BUNDLES_DIR,
        `${document.contextBundleId}.json`,
      );
      if (document.relativePath !== expectedRelativePath || jsonAuthorityRevision(document.raw) !== document.revision) {
        throw new StorageError("Context Bundle migration backup document is invalid", "INVALID_DATA", {
          migrationId,
          contextBundleId: document.contextBundleId,
        });
      }
      const original = parseJsonAuthorityText(
        document.raw,
        (value) => ContextBundleV1Schema.parse(value),
        "Context Bundle rollback source",
      );
      if (original.id !== document.contextBundleId || original.seriesId !== seriesId) {
        throw new StorageError("Context Bundle rollback source identity does not match", "INVALID_DATA", {
          migrationId,
          contextBundleId: document.contextBundleId,
        });
      }
      const targetPath = contextBundlePath(seriesRoot, document.contextBundleId);
      let currentRaw: string;
      try {
        currentRaw = await readFile(targetPath, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          throw new StorageError("Context Bundle changed after migration", "CONFLICT", {
            migrationId,
            contextBundleId: document.contextBundleId,
            currentRevision: null,
          });
        }
        throw error;
      }
      if (jsonAuthorityRevision(currentRaw) !== document.migratedRevision) {
        throw new StorageError("Context Bundle changed after migration", "CONFLICT", {
          migrationId,
          contextBundleId: document.contextBundleId,
          currentRevision: jsonAuthorityRevision(currentRaw),
        });
      }
      mutations.push({ targetPath, content: document.raw });
    }
    await commit(mutations);
    return RollbackContextBundleV2MigrationResultSchema.parse({
      migrationId,
      restoredContextBundleIds: backup.documents.map((document) => document.contextBundleId),
    });
  });
}

export async function saveModelCallLog(seriesRoot: string, rawLog: ModelCallLog): Promise<ModelCallLog> {
  const log = NewModelCallLogV2Schema.parse(rawLog);
  await mkdir(modelCallsRoot(seriesRoot), { recursive: true });
  return runSeriesFileTransaction(seriesRoot, () =>
    writeJson(modelCallLogPath(seriesRoot, log.id), log, (value) =>
      NewModelCallLogV2Schema.parse(value),
    ));
}

export async function getModelCallLog(seriesRoot: string, modelCallId: string): Promise<ModelCallLog> {
  return readJson(modelCallLogPath(seriesRoot, modelCallId), (value) => ModelCallLogSchema.parse(value));
}

export async function listModelCallLogs(seriesRoot: string): Promise<ModelCallLog[]> {
  const files = await listJsonFiles(modelCallsRoot(seriesRoot));
  const logs: ModelCallLog[] = [];
  for (const filePath of files) {
    const log = await readJson(filePath, (value) => ModelCallLogSchema.parse(value));
    assertFileNameMatches(filePath, log.id);
    logs.push(log);
  }
  return logs.sort((left, right) => right.startedAt.localeCompare(left.startedAt));
}

export async function migrateModelCallLogsToV2(
  seriesRoot: string,
  seriesId: string,
): Promise<ModelCallLogV2MigrationResult> {
  return runSeriesFileTransaction(seriesRoot, async (commit) => {
  const migrationId = randomUUID();
  const documents: ModelCallLogV2MigrationBackup["documents"] = [];
  const mutations: Array<{ targetPath: string; content: string }> = [];
  const seenIds = new Set<string>();
  for (const filePath of await listJsonFiles(modelCallsRoot(seriesRoot))) {
    const raw = await readFile(filePath, "utf8");
    const authority = parseJsonAuthorityText(
      raw,
      parseModelCallLogAuthority,
      "Model Call Log migration source",
    );
    assertFileNameMatches(filePath, authority.id);
    if (seenIds.has(authority.id)) {
      throw new StorageError("Model Call Log migration found a duplicate identity", "INVALID_DATA", {
        callId: authority.id,
      });
    }
    seenIds.add(authority.id);
    if (authority.seriesId !== seriesId) {
      throw new StorageError("Model Call Log migration found another Series identity", "INVALID_DATA", {
        callId: authority.id,
      });
    }
    if (authority.schemaVersion !== 1) continue;
    const migratedRaw = serializeJsonAuthority(ModelCallLogSchema.parse(authority));
    documents.push({
      callId: authority.id,
      relativePath: path.posix.join(STUDIO_DIR, MODEL_CALLS_DIR, `${authority.id}.json`),
      raw,
      revision: jsonAuthorityRevision(raw),
      migratedRevision: jsonAuthorityRevision(migratedRaw),
    });
    mutations.push({ targetPath: filePath, content: migratedRaw });
  }
  const backup = ModelCallLogV2MigrationBackupSchema.parse({
    schemaVersion: 1,
    migrationId,
    seriesId,
    createdAt: new Date().toISOString(),
    documents,
  });
  await commit([{
    targetPath: modelCallLogMigrationBackupPath(seriesRoot, migrationId),
    content: serializeJsonAuthority(backup),
  }, ...mutations]);
  return ModelCallLogV2MigrationResultSchema.parse({
    migrationId,
    migratedCallIds: documents.map((document) => document.callId),
  });
  });
}

export async function rollbackModelCallLogsV2Migration(
  seriesRoot: string,
  seriesId: string,
  migrationId: string,
): Promise<RollbackModelCallLogV2MigrationResult> {
  return runSeriesFileTransaction(seriesRoot, async (commit) => {
  let rawBackup: string;
  try {
    rawBackup = await readFile(modelCallLogMigrationBackupPath(seriesRoot, migrationId), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new StorageError("Model Call Log migration backup does not exist", "NOT_FOUND", { migrationId });
    }
    throw error;
  }
  const backup = parseJsonAuthorityText(
    rawBackup,
    (value) => ModelCallLogV2MigrationBackupSchema.parse(value),
    "Model Call Log migration backup",
  );
  if (backup.migrationId !== migrationId || backup.seriesId !== seriesId) {
    throw new StorageError("Model Call Log migration backup identity does not match", "INVALID_DATA", {
      migrationId,
    });
  }
  const mutations: Array<{ targetPath: string; content: string }> = [];
  for (const document of backup.documents) {
    const expectedRelativePath = path.posix.join(STUDIO_DIR, MODEL_CALLS_DIR, `${document.callId}.json`);
    if (
      document.relativePath !== expectedRelativePath ||
      jsonAuthorityRevision(document.raw) !== document.revision
    ) {
      throw new StorageError("Model Call Log migration backup document is invalid", "INVALID_DATA", {
        migrationId,
        callId: document.callId,
      });
    }
    const original = parseJsonAuthorityText(
      document.raw,
      (value) => ModelCallLogV1Schema.parse(value),
      "Model Call Log rollback source",
    );
    if (original.id !== document.callId || original.seriesId !== seriesId) {
      throw new StorageError("Model Call Log rollback source identity does not match", "INVALID_DATA", {
        migrationId,
        callId: document.callId,
      });
    }
    const targetPath = modelCallLogPath(seriesRoot, document.callId);
    let currentRaw: string;
    try {
      currentRaw = await readFile(targetPath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new StorageError("Model Call Log changed after migration", "CONFLICT", {
          migrationId,
          callId: document.callId,
          currentRevision: null,
        });
      }
      throw error;
    }
    if (jsonAuthorityRevision(currentRaw) !== document.migratedRevision) {
      throw new StorageError("Model Call Log changed after migration", "CONFLICT", {
        migrationId,
        callId: document.callId,
        currentRevision: jsonAuthorityRevision(currentRaw),
      });
    }
    mutations.push({ targetPath, content: document.raw });
  }
  await commit(mutations);
  return RollbackModelCallLogV2MigrationResultSchema.parse({
    migrationId,
    restoredCallIds: backup.documents.map((document) => document.callId),
  });
  });
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
