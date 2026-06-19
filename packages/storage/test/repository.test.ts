import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectRepository, StorageError } from "../src/index.js";

const temporaryDirectories: string[] = [];

async function repository(): Promise<ProjectRepository> {
  const root = await mkdtemp(path.join(tmpdir(), "novel-studio-"));
  temporaryDirectories.push(root);
  return new ProjectRepository(root);
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("ProjectRepository", () => {
  it("creates a readable series and scene on disk", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "潮汐之城", description: "测试系列" });

    expect(series.manifest.title).toBe("潮汐之城");
    expect(series.scenes).toHaveLength(1);
    const scene = series.scenes[0];
    expect(scene).toBeDefined();
    const scenePath = path.join(store.libraryRoot, `${"潮汐之城"}-${series.manifest.id.slice(0, 8)}`, scene!.relativePath);
    expect(await readFile(scenePath, "utf8")).toContain("title: 开篇场景");
  });

  it("rejects stale revisions without overwriting the scene", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "失落邮局" });
    const scene = series.scenes[0]!;
    const updated = await store.updateScene(series.manifest.id, scene.metadata.id, {
      baseRevision: scene.revision,
      title: scene.metadata.title,
      content: "雨落在废弃邮局的铜门上。",
    });

    await expect(
      store.updateScene(series.manifest.id, scene.metadata.id, {
        baseRevision: scene.revision,
        title: scene.metadata.title,
        content: "这段内容不应覆盖新版本。",
      }),
    ).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });

    expect((await store.getScene(series.manifest.id, scene.metadata.id)).revision).toBe(updated.revision);
  });

  it("rebuilds the index and searches Chinese content", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "星港来信" });
    const scene = series.scenes[0]!;
    await store.updateScene(series.manifest.id, scene.metadata.id, {
      baseRevision: scene.revision,
      title: "雾中的信号",
      content: "林岚在废弃星港捕捉到一段来自未来的无线电信号。",
    });

    expect((await store.rebuildIndex(series.manifest.id)).indexedScenes).toBe(1);
    const results = await store.search(series.manifest.id, "无线电信号");
    expect(results[0]?.title).toBe("雾中的信号");
  });
});

