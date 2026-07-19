import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ProjectRepository,
  researchQueryExpansionsPath,
  resolveResearchQueryExpansions,
} from "../src/index.js";

const temporaryDirectories: string[] = [];

async function repository(): Promise<{ root: string; store: ProjectRepository }> {
  const root = await mkdtemp(path.join(tmpdir(), "novel-studio-research-aliases-"));
  temporaryDirectories.push(root);
  return { root, store: new ProjectRepository(root) };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("NS-605 isolated Research query expansions", () => {
  it("keeps aliases and transliterations isolated per Research Database", async () => {
    const { root, store } = await repository();
    const first = await store.createResearchDatabase({ name: "East Asia" });
    const second = await store.createResearchDatabase({ name: "Maritime" });
    const firstEmpty = await store.getResearchQueryExpansions(first.database.id);
    const secondEmpty = await store.getResearchQueryExpansions(second.database.id);

    const updated = await store.updateResearchQueryExpansions(first.database.id, {
      baseRevision: firstEmpty.revision,
      entries: [{
        id: "11111111-1111-4111-8111-111111111111",
        queryTerm: "江户",
        expansionTerm: "Edo",
        channel: "alias",
        queryLanguageTag: "zh-CN",
        expansionLanguageTag: "en",
        note: "Historical place name",
      }],
    });

    expect(updated.expansions.researchDatabaseId).toBe(first.database.id);
    expect((await store.getResearchQueryExpansions(second.database.id)).expansions.entries).toEqual([]);
    expect(researchQueryExpansionsPath(root, first.database.id)).not.toBe(researchQueryExpansionsPath(root, second.database.id));
    expect(JSON.parse(await readFile(researchQueryExpansionsPath(root, first.database.id), "utf8"))).not.toHaveProperty("revision");
  });

  it("rejects a stale revision under concurrent writes", async () => {
    const { store } = await repository();
    const database = await store.createResearchDatabase({ name: "Concurrent" });
    const initial = await store.getResearchQueryExpansions(database.database.id);
    const writes = await Promise.allSettled([1, 2].map((value) => store.updateResearchQueryExpansions(database.database.id, {
      baseRevision: initial.revision,
      entries: [{
        id: `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`,
        queryTerm: `term-${value}`,
        expansionTerm: `expanded-${value}`,
        channel: "alias",
        queryLanguageTag: null,
        expansionLanguageTag: null,
        note: "",
      }],
    })));

    expect(writes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = writes.find((result) => result.status === "rejected");
    expect(rejected?.status).toBe("rejected");
    if (rejected?.status === "rejected") {
      expect(rejected.reason).toMatchObject({ code: "CONFLICT" });
    }
  });

  it("expands terms bidirectionally while preserving channel provenance", async () => {
    const { store } = await repository();
    const database = await store.createResearchDatabase({ name: "Queries" });
    const initial = await store.getResearchQueryExpansions(database.database.id);
    const updated = await store.updateResearchQueryExpansions(database.database.id, {
      baseRevision: initial.revision,
      entries: [{
        id: "22222222-2222-4222-8222-222222222222",
        queryTerm: "旅馆",
        expansionTerm: "ryokan",
        channel: "transliteration",
        queryLanguageTag: "zh-CN",
        expansionLanguageTag: "ja-Latn",
        note: "",
      }],
    });

    expect(resolveResearchQueryExpansions("江户旅馆", updated)).toEqual([{
      channel: "transliteration",
      matchedTerm: "旅馆",
      expandedTerm: "ryokan",
      expandedQuery: "江户旅馆 ryokan",
    }]);
    expect(resolveResearchQueryExpansions("old ryokan", updated)[0]).toMatchObject({
      expandedTerm: "旅馆",
      matchedTerm: "ryokan",
    });
  });

  it("survives repository restart and reports damaged alias authority", async () => {
    const { root, store } = await repository();
    const database = await store.createResearchDatabase({ name: "Restart" });
    const initial = await store.getResearchQueryExpansions(database.database.id);
    const updated = await store.updateResearchQueryExpansions(database.database.id, {
      baseRevision: initial.revision,
      entries: [{
        id: "33333333-3333-4333-8333-333333333333",
        queryTerm: "雨港",
        expansionTerm: "Ame-no-Minato",
        channel: "transliteration",
        queryLanguageTag: "ja",
        expansionLanguageTag: "ja-Latn",
        note: "Place-name reading",
      }],
    });

    const reopened = new ProjectRepository(root);
    expect(await reopened.getResearchQueryExpansions(database.database.id)).toEqual(updated);
    await writeFile(researchQueryExpansionsPath(root, database.database.id), "{ damaged", "utf8");
    await expect(reopened.getResearchQueryExpansions(database.database.id)).rejects.toMatchObject({
      code: "INVALID_DATA",
    });
  });
});
