import { randomUUID } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
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
    const database = openIndexDatabase(databasePath, { createIfMissing: true, seriesId: randomUUID() });
    try {
      expect(database.pragma("application_id")[0]).toMatchObject({ application_id: INDEX_APPLICATION_ID });
      expect(database.pragma("user_version")[0]).toMatchObject({ user_version: INDEX_SCHEMA_VERSION });
      expect(database.pragma("foreign_keys")[0]).toMatchObject({ foreign_keys: 1 });
      expect(database.pragma("busy_timeout")[0]).toMatchObject({ timeout: 5000 });
      expect(database.pragma("journal_mode")[0]).toMatchObject({ journal_mode: "wal" });
      expect(database.prepare("SELECT v FROM scene_fts_config WHERE k = 'secure-delete'").get())
        .toMatchObject({ v: 1 });
      expect(database.prepare("SELECT v FROM codex_fts_config WHERE k = 'secure-delete'").get())
        .toMatchObject({ v: 1 });
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

  it("rejects a foreign database without changing its bytes or journal mode", async () => {
    const root = await temporaryRoot("novel-studio-index-foreign-");
    const databasePath = indexDatabasePath(root);
    const foreign = new Database(databasePath);
    foreign.exec("CREATE TABLE foreign_rows (id TEXT PRIMARY KEY, value TEXT NOT NULL)");
    foreign.prepare("INSERT INTO foreign_rows (id, value) VALUES (?, ?)").run("one", "preserve me");
    foreign.pragma("application_id = 73");
    expect(foreign.pragma("journal_mode")[0]).toMatchObject({ journal_mode: "delete" });
    foreign.close();
    const before = await readFile(databasePath);

    expect(() => openIndexDatabase(databasePath)).toThrow("belongs to another application");

    expect(await readFile(databasePath)).toEqual(before);
    const reopened = new Database(databasePath, { readonly: true, fileMustExist: true });
    try {
      expect(reopened.pragma("journal_mode")[0]).toMatchObject({ journal_mode: "delete" });
      expect(reopened.prepare("SELECT value FROM foreign_rows WHERE id = 'one'").get())
        .toMatchObject({ value: "preserve me" });
    } finally {
      reopened.close();
    }
  });

  it("classifies legacy drift wrong identity unsupported versions and corruption without trusting them", async () => {
    const legacyRoot = await temporaryRoot("novel-studio-index-legacy-");
    const legacy = new Database(indexDatabasePath(legacyRoot));
    legacy.exec("CREATE TABLE legacy_rows (id TEXT PRIMARY KEY)");
    legacy.close();
    expect(await inspectIndexDatabase(legacyRoot)).toMatchObject({ status: "legacy-v0" });

    const driftRoot = await temporaryRoot("novel-studio-index-drift-");
    const driftPath = indexDatabasePath(driftRoot);
    openIndexDatabase(driftPath, { createIfMissing: true }).close();
    const drift = new Database(driftPath);
    drift.prepare("UPDATE index_schema_migrations SET checksum = ? WHERE version = 1").run("0".repeat(64));
    drift.close();
    expect(await inspectIndexDatabase(driftRoot)).toMatchObject({ status: "schema-drift" });

    const identityRoot = await temporaryRoot("novel-studio-index-identity-");
    const identityPath = indexDatabasePath(identityRoot);
    openIndexDatabase(identityPath, { createIfMissing: true }).close();
    const identity = new Database(identityPath);
    identity.pragma("application_id = 73");
    identity.close();
    expect(await inspectIndexDatabase(identityRoot)).toMatchObject({ status: "wrong-identity" });

    const versionRoot = await temporaryRoot("novel-studio-index-version-");
    const versionPath = indexDatabasePath(versionRoot);
    openIndexDatabase(versionPath, { createIfMissing: true }).close();
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

    const otherRoot = await temporaryRoot("novel-studio-index-other-lane-");
    let releaseBlocked!: () => void;
    let markBlocked!: () => void;
    const blockedStarted = new Promise<void>((resolve) => { markBlocked = resolve; });
    const blocked = new Promise<void>((resolve) => { releaseBlocked = resolve; });
    const sameSeries = runIndexWriteLane(root, async () => {
      markBlocked();
      await blocked;
    });
    await blockedStarted;
    const otherSeries = runIndexWriteLane(otherRoot, async () => "independent");
    await expect(otherSeries).resolves.toBe("independent");
    releaseBlocked();
    await sameSeries;

    await expect(runIndexWriteLane(root, async () => { throw new Error("injected lane failure"); }))
      .rejects.toThrow("injected lane failure");
    await expect(runIndexWriteLane(root, async () => "released")).resolves.toBe("released");
  });

  it("builds uniquely and keeps the old live index readable across cancellation build failure and swap failure", async () => {
    const root = await temporaryRoot();
    const livePath = indexDatabasePath(root);
    openIndexDatabase(livePath, { createIfMissing: true, seriesId: "series-atomic" }).close();
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

    const cancelledBeforeSwap = new AbortController();
    await expect(rebuildIndexDatabase(root, "series-atomic", async ({ databasePath }) => {
      insertScene(databasePath, "cancelled-before-swap", "must not become live");
    }, {
      signal: cancelledBeforeSwap.signal,
      hooks: { beforeSwap: () => cancelledBeforeSwap.abort() },
    })).rejects.toMatchObject({ name: "AbortError" });
    expect(sceneIds(livePath)).toEqual(["old-scene"]);

    await expect(rebuildIndexDatabase(root, "series-atomic", async ({ databasePath }) => {
      insertScene(databasePath, "failed-after-new-move", "must roll back after install");
    }, {
      hooks: { afterNewMoved: () => { throw new Error("injected post-install failure"); } },
    })).rejects.toThrow("injected post-install failure");
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

  it("replaces corrupt and foreign live artifacts without opening or mutating them", async () => {
    const corruptRoot = await temporaryRoot("novel-studio-index-rebuild-corrupt-");
    const corruptPath = indexDatabasePath(corruptRoot);
    await writeFile(corruptPath, Buffer.from("not a sqlite database", "utf8"));
    await rebuildIndexDatabase(corruptRoot, "series-corrupt", async ({ databasePath }) => {
      insertScene(databasePath, "recovered-corrupt", "rebuilt from authority");
    });
    expect(sceneIds(corruptPath)).toEqual(["recovered-corrupt"]);
    expect(await inspectIndexDatabase(corruptRoot)).toMatchObject({ status: "ready" });

    const foreignRoot = await temporaryRoot("novel-studio-index-rebuild-foreign-");
    const foreignPath = indexDatabasePath(foreignRoot);
    const foreign = new Database(foreignPath);
    foreign.exec("CREATE TABLE foreign_rows (value TEXT NOT NULL)");
    foreign.prepare("INSERT INTO foreign_rows (value) VALUES (?)").run("not Novel Studio");
    foreign.pragma("application_id = 73");
    foreign.close();
    await rebuildIndexDatabase(foreignRoot, "series-foreign", async ({ databasePath }) => {
      insertScene(databasePath, "recovered-foreign", "rebuilt from authority");
    });
    expect(sceneIds(foreignPath)).toEqual(["recovered-foreign"]);
    expect(await inspectIndexDatabase(foreignRoot)).toMatchObject({ status: "ready" });
  });

  it("rejects a built database with damaged FTS shadow data and preserves the live index", async () => {
    const root = await temporaryRoot("novel-studio-index-fts-integrity-");
    const livePath = indexDatabasePath(root);
    openIndexDatabase(livePath, { createIfMissing: true, seriesId: "series-fts-integrity" }).close();
    insertScene(livePath, "old-scene", "old live row");

    await expect(rebuildIndexDatabase(root, "series-fts-integrity", async ({ databasePath }) => {
      insertScene(databasePath, "damaged-fts", "must not become live");
      const database = new Database(databasePath);
      try {
        database.exec("DROP TABLE scene_fts_data");
      } finally {
        database.close();
      }
    })).rejects.toThrow();
    expect(sceneIds(livePath)).toEqual(["old-scene"]);
  });

  it("rejects a built database when core and FTS projection rows diverge", async () => {
    const root = await temporaryRoot("novel-studio-index-fts-pair-");
    const livePath = indexDatabasePath(root);
    openIndexDatabase(livePath, { createIfMissing: true, seriesId: "series-fts-pair" }).close();
    insertScene(livePath, "old-scene", "old live row");

    await expect(rebuildIndexDatabase(root, "series-fts-pair", async ({ databasePath }) => {
      const database = openIndexDatabase(databasePath);
      try {
        database.prepare(
          `INSERT INTO scenes (id, title, content, relative_path, updated_at, revision)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).run("missing-fts", "missing-fts", "not indexed", "books/missing.md", new Date().toISOString(), HASH_A);
      } finally {
        database.close();
      }
    })).rejects.toThrow("projections are inconsistent");
    expect(sceneIds(livePath)).toEqual(["old-scene"]);
  });

  it("keeps readers behind the replacement gap and self-rebuilds a missing live index", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "KernelReaderRecovery" });
    const scene = await store.updateScene(series.manifest.id, series.scenes[0]!.metadata.id, {
      baseRevision: series.scenes[0]!.revision,
      title: "Reader recovery",
      content: "A visible phrase survives index replacement.",
    });
    const root = await seriesRoot(store, series.manifest.id);
    const livePath = indexDatabasePath(root);
    await Promise.all(["", "-wal", "-shm", "-journal"].map((suffix) => rm(`${livePath}${suffix}`, { force: true })));
    expect((await store.search(series.manifest.id, "visible phrase"))[0]?.sceneId).toBe(scene.metadata.id);

    let markMoved!: () => void;
    let releaseSwap!: () => void;
    const moved = new Promise<void>((resolve) => { markMoved = resolve; });
    const holdSwap = new Promise<void>((resolve) => { releaseSwap = resolve; });
    const rebuilding = store.rebuildIndex(series.manifest.id, {
      hooks: {
        afterLiveMoved: async () => {
          markMoved();
          await holdSwap;
        },
      },
    });
    await moved;
    let readSettled = false;
    const reading = store.search(series.manifest.id, "visible phrase").finally(() => { readSettled = true; });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(readSettled).toBe(false);
    releaseSwap();
    await rebuilding;
    expect((await reading)[0]?.sceneId).toBe(scene.metadata.id);
  });

  it("repairs an unhealthy index after an authority write instead of reporting a lost save", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "KernelWriteRecovery" });
    const root = await seriesRoot(store, series.manifest.id);
    const livePath = indexDatabasePath(root);
    await Promise.all(["", "-wal", "-shm", "-journal"].map((suffix) => rm(`${livePath}${suffix}`, { force: true })));
    await writeFile(livePath, Buffer.from("not a sqlite database", "utf8"));

    const updated = await store.updateScene(series.manifest.id, series.scenes[0]!.metadata.id, {
      baseRevision: series.scenes[0]!.revision,
      title: "Recovered save",
      content: "The authority write survives a damaged derived index.",
    });
    expect(updated.content).toContain("survives a damaged derived index");
    expect((await store.search(series.manifest.id, "damaged derived"))[0]?.sceneId)
      .toBe(updated.metadata.id);
    expect(await inspectIndexDatabase(root)).toMatchObject({ status: "ready" });
  });

  it("preserves the old recovery bundle when cleanup of a failed live install is obstructed", async () => {
    const root = await temporaryRoot("novel-studio-index-recovery-bundle-");
    const livePath = indexDatabasePath(root);
    openIndexDatabase(livePath, { createIfMissing: true, seriesId: "series-recovery-bundle" }).close();
    insertScene(livePath, "old-scene", "the prior index must remain recoverable");

    await expect(rebuildIndexDatabase(root, "series-recovery-bundle", async ({ databasePath }) => {
      insertScene(databasePath, "new-scene", "the failed replacement");
    }, {
      hooks: {
        afterNewMoved: async () => {
          await mkdir(`${livePath}-wal`, { recursive: true });
          await writeFile(path.join(`${livePath}-wal`, "obstruction"), "injected cleanup failure", "utf8");
          throw new Error("injected post-install failure");
        },
      },
    })).rejects.toThrow("new live artifact could not be removed");

    const buildRoot = path.join(root, ".studio", "index-build");
    const rollbackNames = (await readdir(buildRoot)).filter((name) => name.endsWith(".rollback.sqlite"));
    expect(rollbackNames).toHaveLength(1);
    expect(sceneIds(path.join(buildRoot, rollbackNames[0]!))).toEqual(["old-scene"]);
  });

  it("rejects a valid Novel Studio index copied from another Series and rebuilds local authority", async () => {
    const store = await repository();
    const first = await store.createSeries({ title: "KernelSeriesFirst" });
    const second = await store.createSeries({ title: "KernelSeriesSecond" });
    const firstScene = await store.updateScene(first.manifest.id, first.scenes[0]!.metadata.id, {
      baseRevision: first.scenes[0]!.revision,
      title: "First Series only",
      content: "The cobalt archive belongs only to the first Series.",
    });
    const secondScene = await store.updateScene(second.manifest.id, second.scenes[0]!.metadata.id, {
      baseRevision: second.scenes[0]!.revision,
      title: "Second Series only",
      content: "The amber registry belongs only to the second Series.",
    });
    const firstRoot = await seriesRoot(store, first.manifest.id);
    const secondRoot = await seriesRoot(store, second.manifest.id);
    const firstIndex = indexDatabasePath(firstRoot);
    const secondIndex = indexDatabasePath(secondRoot);
    await Promise.all(["", "-wal", "-shm", "-journal"].map((suffix) => rm(`${secondIndex}${suffix}`, { force: true })));
    await copyFile(firstIndex, secondIndex);

    expect(await inspectIndexDatabase(secondRoot, second.manifest.id)).toMatchObject({ status: "series-mismatch" });
    expect(await store.search(second.manifest.id, "cobalt archive")).toEqual([]);
    expect((await store.search(second.manifest.id, "amber registry"))[0]?.sceneId).toBe(secondScene.metadata.id);
    expect((await store.search(first.manifest.id, "cobalt archive"))[0]?.sceneId).toBe(firstScene.metadata.id);
  });

  it("classifies core-to-FTS divergence and rebuilds before returning search results", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "KernelFtsRecovery" });
    const scene = await store.updateScene(series.manifest.id, series.scenes[0]!.metadata.id, {
      baseRevision: series.scenes[0]!.revision,
      title: "FTS recovery",
      content: "The vermilion compass remains in authority.",
    });
    const root = await seriesRoot(store, series.manifest.id);
    const database = new Database(indexDatabasePath(root));
    try {
      database.prepare("DELETE FROM scene_fts WHERE id = ?").run(scene.metadata.id);
    } finally {
      database.close();
    }

    expect(await inspectIndexDatabase(root, series.manifest.id)).toMatchObject({ status: "corrupt" });
    expect((await store.search(series.manifest.id, "vermilion compass"))[0]?.sceneId).toBe(scene.metadata.id);
    expect(await inspectIndexDatabase(root, series.manifest.id)).toMatchObject({ status: "ready" });
  });

  it("treats missing persistent FTS secure-delete policy as rebuildable schema drift", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "KernelFtsPolicy" });
    const root = await seriesRoot(store, series.manifest.id);
    const database = new Database(indexDatabasePath(root));
    try {
      database.prepare("INSERT INTO scene_fts(scene_fts, rank) VALUES ('secure-delete', 0)").run();
    } finally {
      database.close();
    }

    expect(await inspectIndexDatabase(root, series.manifest.id)).toMatchObject({ status: "schema-drift" });
    await store.search(series.manifest.id, "anything");
    expect(await inspectIndexDatabase(root, series.manifest.id)).toMatchObject({ status: "ready" });
  });

  it("treats percent and underscore as literal short-query characters", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "KernelLiteralSearch" });
    await store.updateScene(series.manifest.id, series.scenes[0]!.metadata.id, {
      baseRevision: series.scenes[0]!.revision,
      title: "Plain scene",
      content: "No symbolic marker appears here.",
    });
    const markedScene = await store.createScene(series.manifest.id, {
      title: "Measured scene",
      content: "The instrument reads 100%_ready.",
    });
    await store.createCodexEntry(series.manifest.id, {
      categoryId: "character",
      name: "Plain gauge",
      description: "No symbolic marker.",
    });
    const markedEntry = await store.createCodexEntry(series.manifest.id, {
      categoryId: "character",
      name: "100%_gauge",
      description: "A literal percent and underscore label.",
    });

    expect((await store.search(series.manifest.id, "%")).map((result) => result.sceneId))
      .toEqual([markedScene.metadata.id]);
    expect((await store.search(series.manifest.id, "_")).map((result) => result.sceneId))
      .toEqual([markedScene.metadata.id]);
    expect((await store.searchCodex(series.manifest.id, "%")).map((result) => result.entryId))
      .toEqual([markedEntry.metadata.id]);
    expect((await store.searchCodex(series.manifest.id, "_")).map((result) => result.entryId))
      .toEqual([markedEntry.metadata.id]);
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
