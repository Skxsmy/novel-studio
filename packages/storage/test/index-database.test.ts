import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import type { ContextBundle, ModelCallLog } from "@novel-studio/contracts";

import {
  INDEX_APPLICATION_ID,
  INDEX_SCHEMA_CHECKSUM,
  INDEX_SCHEMA_VERSION,
  ProjectRepository,
  indexDatabasePath,
  inspectIndexDatabase,
  openIndexDatabase,
  rebuildIndexDatabase,
  runIndexWriteLane,
} from "../src/index.js";

const temporaryDirectories: string[] = [];
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

async function temporaryRoot(prefix = "novel-studio-index-"): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  temporaryDirectories.push(root);
  await mkdir(path.join(root, ".studio"), { recursive: true });
  return root;
}

async function repository(): Promise<ProjectRepository> {
  const root = await temporaryRoot("novel-studio-index-repository-");
  return new ProjectRepository(root);
}

async function seriesRoot(store: ProjectRepository, seriesId: string): Promise<string> {
  const suffix = `-${seriesId.slice(0, 8)}`;
  const entries = await readdir(store.libraryRoot, { withFileTypes: true });
  const match = entries.find((entry) => entry.isDirectory() && entry.name.endsWith(suffix));
  if (!match) throw new Error(`Series root not found for ${seriesId}`);
  return path.join(store.libraryRoot, match.name);
}

function insertScene(databasePath: string, id: string, content: string): void {
  const database = openIndexDatabase(databasePath);
  try {
    database.prepare(
      `INSERT INTO scenes (id, title, content, relative_path, updated_at, revision)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, id, content, `books/${id}.md`, new Date().toISOString(), HASH_A);
    database.prepare("INSERT INTO scene_fts (id, title, content) VALUES (?, ?, ?)")
      .run(id, id, content);
  } finally {
    database.close();
  }
}

function sceneIds(databasePath: string): string[] {
  const database = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    return (database.prepare("SELECT id FROM scenes ORDER BY id").all() as Array<{ id: string }>)
      .map((row) => row.id);
  } finally {
    database.close();
  }
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("NS-602 versioned index database kernel", () => {
  it("enforces application identity schema checksum connection policy and ready health", async () => {
    const root = await temporaryRoot();
    const databasePath = indexDatabasePath(root);
    const database = openIndexDatabase(databasePath, { seriesId: randomUUID() });
    try {
      expect(database.pragma("application_id")[0]).toMatchObject({ application_id: INDEX_APPLICATION_ID });
      expect(database.pragma("user_version")[0]).toMatchObject({ user_version: INDEX_SCHEMA_VERSION });
      expect(database.pragma("foreign_keys")[0]).toMatchObject({ foreign_keys: 1 });
      expect(database.pragma("busy_timeout")[0]).toMatchObject({ timeout: 5000 });
      expect(database.pragma("journal_mode")[0]).toMatchObject({ journal_mode: "wal" });
      expect(database.prepare("SELECT checksum FROM index_schema_migrations WHERE version = 1").get())
        .toMatchObject({ checksum: INDEX_SCHEMA_CHECKSUM });
    } finally {
      database.close();
    }
    expect(await inspectIndexDatabase(root)).toMatchObject({
      status: "ready",
      applicationId: INDEX_APPLICATION_ID,
      userVersion: INDEX_SCHEMA_VERSION,
      schemaChecksum: INDEX_SCHEMA_CHECKSUM,
      quickCheck: "ok",
    });
  });

  it("classifies legacy drift wrong identity unsupported versions and corruption without trusting them", async () => {
    const legacyRoot = await temporaryRoot("novel-studio-index-legacy-");
    const legacy = new Database(indexDatabasePath(legacyRoot));
    legacy.exec("CREATE TABLE legacy_rows (id TEXT PRIMARY KEY)");
    legacy.close();
    expect(await inspectIndexDatabase(legacyRoot)).toMatchObject({ status: "legacy-v0" });

    const driftRoot = await temporaryRoot("novel-studio-index-drift-");
    const driftPath = indexDatabasePath(driftRoot);
    openIndexDatabase(driftPath).close();
    const drift = new Database(driftPath);
    drift.prepare("UPDATE index_schema_migrations SET checksum = ? WHERE version = 1").run("0".repeat(64));
    drift.close();
    expect(await inspectIndexDatabase(driftRoot)).toMatchObject({ status: "schema-drift" });

    const identityRoot = await temporaryRoot("novel-studio-index-identity-");
    const identityPath = indexDatabasePath(identityRoot);
    openIndexDatabase(identityPath).close();
    const identity = new Database(identityPath);
    identity.pragma("application_id = 73");
    identity.close();
    expect(await inspectIndexDatabase(identityRoot)).toMatchObject({ status: "wrong-identity" });

    const versionRoot = await temporaryRoot("novel-studio-index-version-");
    const versionPath = indexDatabasePath(versionRoot);
    openIndexDatabase(versionPath).close();
    const version = new Database(versionPath);
    version.pragma("user_version = 99");
    version.close();
    expect(await inspectIndexDatabase(versionRoot)).toMatchObject({ status: "unsupported-version" });

    const corruptRoot = await temporaryRoot("novel-studio-index-corrupt-");
    await writeFile(indexDatabasePath(corruptRoot), Buffer.from("not a sqlite database", "utf8"));
    expect(await inspectIndexDatabase(corruptRoot)).toMatchObject({ status: "corrupt" });
  });

  it("serializes one per-Series write and rebuild lane", async () => {
    const root = await temporaryRoot();
    const order: string[] = [];
    let releaseFirst!: () => void;
    let markFirstStarted!: () => void;
    const firstCanFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });
    const first = runIndexWriteLane(root, async () => {
      order.push("first:start");
      markFirstStarted();
      await firstCanFinish;
      order.push("first:end");
    });
    const second = runIndexWriteLane(root, async () => {
      order.push("second:start");
      order.push("second:end");
    });
    await firstStarted;
    expect(order).toEqual(["first:start"]);
    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(["first:start", "first:end", "second:start", "second:end"]);
  });

  it("builds uniquely and keeps the old live index readable across cancellation build failure and swap failure", async () => {
    const root = await temporaryRoot();
    const livePath = indexDatabasePath(root);
    openIndexDatabase(livePath, { seriesId: "series-atomic" }).close();
    insertScene(livePath, "old-scene", "old live row");

    const cancelled = new AbortController();
    await expect(rebuildIndexDatabase(root, "series-atomic", async ({ databasePath, throwIfCancelled }) => {
      insertScene(databasePath, "cancelled-scene", "must not become live");
      throwIfCancelled();
    }, {
      signal: cancelled.signal,
      hooks: { afterDatabaseCreated: () => cancelled.abort() },
    })).rejects.toMatchObject({ name: "AbortError" });
    expect(sceneIds(livePath)).toEqual(["old-scene"]);

    await expect(rebuildIndexDatabase(root, "series-atomic", async ({ databasePath }) => {
      insertScene(databasePath, "failed-build-scene", "must not become live");
      throw new Error("injected build failure");
    })).rejects.toThrow("injected build failure");
    expect(sceneIds(livePath)).toEqual(["old-scene"]);

    await expect(rebuildIndexDatabase(root, "series-atomic", async ({ databasePath }) => {
      insertScene(databasePath, "failed-swap-scene", "must not become live");
      return undefined;
    }, {
      hooks: { afterLiveMoved: () => { throw new Error("injected swap failure"); } },
    })).rejects.toThrow("injected swap failure");
    expect(sceneIds(livePath)).toEqual(["old-scene"]);

    await rebuildIndexDatabase(root, "series-atomic", async ({ databasePath }) => {
      insertScene(databasePath, "new-scene", "validated replacement row");
    });
    expect(sceneIds(livePath)).toEqual(["new-scene"]);
    expect(await inspectIndexDatabase(root)).toMatchObject({ status: "ready" });
    expect(await readdir(path.join(root, ".studio", "index-build"))).toEqual([]);
  });

  it("preserves Scene Codex mention ambiguity Context Bundle and Model Call projections behind the versioned kernel", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "KernelCompatibility" });
    const scene = await store.updateScene(series.manifest.id, series.scenes[0]!.metadata.id, {
      baseRevision: series.scenes[0]!.revision,
      title: "Harbor gate",
      content: "The Warden waited beside the silver tide gate.",
    });
    await store.createCodexEntry(series.manifest.id, {
      categoryId: "character",
      name: "Warden",
      description: "The harbor guard.",
    });
    await store.createCodexEntry(series.manifest.id, {
      categoryId: "organization",
      name: "Warden",
      research: "The same name is used by a hidden order.",
    });

    const now = new Date().toISOString();
    const roleId = randomUUID();
    const promptTemplateId = randomUUID();
    const contextBundleId = randomUUID();
    const bundle: ContextBundle = {
      schemaVersion: 2,
      id: contextBundleId,
      seriesId: series.manifest.id,
      sceneId: scene.metadata.id,
      roleId,
      taskKind: "continuity-check",
      userRequest: "Check the harbor continuity.",
      promptTemplateId,
      promptTemplateVersion: 1,
      items: [{
        id: "current-scene",
        kind: "scene",
        source: { type: "scene", id: scene.metadata.id, revision: scene.revision, label: scene.metadata.title },
        title: scene.metadata.title,
        content: scene.content,
        inclusion: "required",
        inclusionReason: "Current scene",
        contextPolicy: "always",
        tokenEstimate: 40,
        manuallySelected: false,
        textHash: HASH_A,
      }],
      excluded: [],
      estimatedUsage: { inputTokens: 40, outputTokens: 20, totalTokens: 60 },
      createdAt: now,
    };
    const call: ModelCallLog = {
      schemaVersion: 2,
      id: randomUUID(),
      seriesId: series.manifest.id,
      sceneId: scene.metadata.id,
      roleId,
      taskKind: "continuity-check",
      provider: "mock",
      model: "mock-author-model",
      contextBundleId,
      promptTemplateId,
      promptTemplateVersion: 1,
      requestHash: HASH_A,
      resolvedParameters: { temperature: 0.2, maxOutputTokens: 200 },
      responseHash: HASH_B,
      status: "succeeded",
      estimatedUsage: { inputTokens: 40, outputTokens: 20, totalTokens: 60 },
      actualUsage: { inputTokens: 39, outputTokens: 18, totalTokens: 57 },
      errorCode: null,
      errorMessage: null,
      error: null,
      startedAt: now,
      completedAt: now,
    };
    await store.saveContextBundle(series.manifest.id, bundle);
    await store.saveModelCallLog(series.manifest.id, call);

    const rebuilt = await store.rebuildIndex(series.manifest.id);
    expect(rebuilt).toMatchObject({
      indexedScenes: 1,
      indexedCodexEntries: 2,
      indexedMentions: 0,
      ambiguousMentions: 1,
      indexedContextBundles: 1,
      indexedModelCalls: 1,
    });
    expect((await store.search(series.manifest.id, "silver tide"))[0]?.sceneId).toBe(scene.metadata.id);
    expect(await store.searchCodex(series.manifest.id, "Warden")).toHaveLength(2);
    expect((await store.listCodexMentionsForScene(series.manifest.id, scene.metadata.id)).ambiguities).toHaveLength(1);

    const database = new Database(indexDatabasePath(await seriesRoot(store, series.manifest.id)), { readonly: true });
    try {
      expect(database.prepare("SELECT count(*) AS count FROM ai_context_bundles").get()).toMatchObject({ count: 1 });
      expect(database.prepare("SELECT count(*) AS count FROM ai_model_calls").get()).toMatchObject({ count: 1 });
    } finally {
      database.close();
    }
    expect(await store.getIndexDatabaseHealth(series.manifest.id)).toMatchObject({ status: "ready" });
  });
});
