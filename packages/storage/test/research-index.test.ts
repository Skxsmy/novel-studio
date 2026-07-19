import { createHash } from "node:crypto";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import {
  ProjectRepository,
  inspectResearchIndex,
  researchIndexDatabasePath,
  type PreparedResearchSourceImport,
} from "../src/index.js";

const temporaryDirectories: string[] = [];

async function repository(): Promise<ProjectRepository> {
  const root = await mkdtemp(path.join(tmpdir(), "novel-studio-research-index-"));
  temporaryDirectories.push(root);
  return new ProjectRepository(root);
}

function prepared(input: {
  name: string;
  text: string;
  language: string | null;
  permission?: "never" | "allowed";
  tags?: string[];
  kind?: "txt" | "markdown";
}): PreparedResearchSourceImport {
  const bytes = Buffer.from(input.text, "utf8");
  const kind = input.kind ?? "txt";
  return {
    kind,
    mediaType: kind === "markdown" ? "text/markdown" : "text/plain",
    originalFileName: `${input.name}.${kind === "markdown" ? "md" : "txt"}`,
    originalBytes: bytes,
    sizeBytes: bytes.byteLength,
    contentHash: createHash("sha256").update(bytes).digest("hex"),
    properties: {
      displayName: input.name,
      author: input.name === "English log" ? "M. Sailor" : "",
      declaredLanguage: input.language,
      tags: input.tags ?? [],
      aiPermission: input.permission ?? "allowed",
      useNotes: "",
    },
    origin: { type: "file" },
    content: {
      title: input.name,
      parserName: "test-text",
      parserVersion: 1,
      warnings: [],
      sections: [],
      blocks: [{
        order: 0,
        sectionOrder: null,
        kind: "paragraph",
        text: input.text,
        location: {
          kind: "text",
          startLine: 1,
          endLine: 1,
          startOffset: 0,
          endOffset: input.text.length,
        },
      }],
    },
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("NS-604 isolated Research keyword index", () => {
  it("searches Chinese, Japanese, English, mixed text, literals, filters, and exact locations", async () => {
    const store = await repository();
    const database = await store.createResearchDatabase({ name: "Multilingual" });
    await store.importResearchSource(database.database.id, prepared({
      name: "Chinese tides",
      text: "潮汐航路穿过北方海峡。",
      language: "zh-CN",
      tags: ["navigation"],
      permission: "never",
    }));
    await store.importResearchSource(database.database.id, prepared({
      name: "Japanese route",
      text: "北海航路を進む船は夜明けに港へ着いた。",
      language: "ja-JP",
      tags: ["navigation"],
    }));
    await store.importResearchSource(database.database.id, prepared({
      name: "English log",
      text: "The harbor ledger records 100%_ready before dawn.",
      language: "en",
      tags: ["ledger"],
      kind: "markdown",
    }));
    await store.importResearchSource(database.database.id, prepared({
      name: "Mixed note",
      text: "潮声 crossed the harbor while 船員 waited.",
      language: null,
    }));
    await store.importResearchSource(database.database.id, prepared({
      name: "Mixed original-language note",
      text: "The archive ledger records 月守（つきもり） beside the harbor.",
      language: null,
    }));

    const chinese = await store.searchResearchSources(database.database.id, { query: "潮汐航路", purpose: "local", limit: 20 });
    expect(chinese.results[0]).toMatchObject({
      sourceDisplayName: "Chinese tides",
      languageTag: "zh-CN",
      location: { kind: "text", startLine: 1 },
    });
    expect(chinese.results[0]?.matchChannels).toContain("keyword-cjk");

    const japanese = await store.searchResearchSources(database.database.id, { query: "北海航路", purpose: "local", limit: 20 });
    expect(japanese.results.some((result) => result.sourceDisplayName === "Japanese route")).toBe(true);

    const partialJapanese = await store.searchResearchSources(database.database.id, {
      query: "北海 守 船 夜明け",
      purpose: "local",
      languageTags: ["ja"],
      limit: 20,
    });
    expect(partialJapanese.results[0]).toMatchObject({ sourceDisplayName: "Japanese route" });
    expect(partialJapanese.results[0]?.matchChannels).toContain("keyword-literal");

    const english = await store.searchResearchSources(database.database.id, {
      query: "harbor ledger",
      purpose: "local",
      sourceKinds: ["markdown"],
      languageTags: ["en"],
      tags: ["ledger"],
      author: "sailor",
      limit: 20,
    });
    expect(english.results.map((result) => result.sourceDisplayName)).toEqual(["English log"]);
    expect(english.results[0]?.matchChannels).toContain("keyword-word");

    const partialEnglish = await store.searchResearchSources(database.database.id, {
      query: "harbor guardian ledger dawn",
      purpose: "local",
      languageTags: ["en"],
      limit: 20,
    });
    expect(partialEnglish.results[0]).toMatchObject({ sourceDisplayName: "English log" });
    expect(partialEnglish.results[0]?.matchChannels).toContain("keyword-word");

    const literal = await store.searchResearchSources(database.database.id, { query: "%_", purpose: "local", limit: 20 });
    expect(literal.results.map((result) => result.sourceDisplayName)).toEqual(["English log"]);
    expect(literal.results[0]?.matchChannels).toContain("keyword-literal");

    const mixed = await store.searchResearchSources(database.database.id, { query: "crossed the harbor", purpose: "local", limit: 20 });
    expect(mixed.results[0]?.sourceDisplayName).toBe("Mixed note");
    expect(mixed.results[0]?.originalText).toContain("船員");

    const mixedJapanese = await store.searchResearchSources(database.database.id, {
      query: "つきもり",
      purpose: "local",
      languageTags: ["ja"],
      limit: 20,
    });
    expect(mixedJapanese.results).toHaveLength(1);
    expect(mixedJapanese.results[0]).toMatchObject({
      sourceDisplayName: "Mixed original-language note",
      languageTag: "ja",
    });
    const mixedJapaneseKanji = await store.searchResearchSources(database.database.id, {
      query: "月守",
      purpose: "local",
      languageTags: ["ja"],
      limit: 20,
    });
    expect(mixedJapaneseKanji.results[0]).toMatchObject({
      sourceDisplayName: "Mixed original-language note",
      languageTag: "ja",
    });
  });

  it("allows local reading of never sources but excludes their text from model-context retrieval", async () => {
    const store = await repository();
    const database = await store.createResearchDatabase({ name: "Permission boundary" });
    const blocked = await store.importResearchSource(database.database.id, prepared({
      name: "Private archive",
      text: "vermilion private harbor evidence",
      language: "en",
      permission: "never",
    }));
    await store.importResearchSource(database.database.id, prepared({
      name: "Allowed archive",
      text: "vermilion public harbor evidence",
      language: "en",
      permission: "allowed",
    }));
    expect((await store.searchResearchSources(database.database.id, {
      query: "vermilion harbor",
      purpose: "local",
      limit: 20,
    })).results.map((result) => result.sourceDisplayName).sort()).toEqual(["Allowed archive", "Private archive"]);
    expect((await store.searchResearchSources(database.database.id, {
      query: "vermilion harbor",
      purpose: "model-context",
      limit: 20,
    })).results.map((result) => result.sourceDisplayName)).toEqual(["Allowed archive"]);

    const updated = await store.updateResearchSource(database.database.id, blocked.source.id, {
      baseRevision: blocked.revision,
      aiPermission: "allowed",
    });
    expect(updated.source.aiPermission).toBe("allowed");
    expect((await store.searchResearchSources(database.database.id, {
      query: "private harbor",
      purpose: "model-context",
      limit: 20,
    })).results[0]?.sourceDisplayName).toBe("Private archive");
  });

  it("isolates identical databases and rebuilds a copied foreign index from local authority", async () => {
    const store = await repository();
    const first = await store.createResearchDatabase({ name: "First index" });
    const second = await store.createResearchDatabase({ name: "Second index" });
    await store.importResearchSource(first.database.id, prepared({
      name: "First only",
      text: "cobalt passage in the first archive",
      language: "en",
    }));
    await store.importResearchSource(second.database.id, prepared({
      name: "Second only",
      text: "amber passage in the second archive",
      language: "en",
    }));
    const firstRoot = path.join(store.libraryRoot, "research-databases", first.database.id);
    const secondRoot = path.join(store.libraryRoot, "research-databases", second.database.id);
    const firstIndex = researchIndexDatabasePath(firstRoot);
    const secondIndex = researchIndexDatabasePath(secondRoot);
    await rm(secondIndex, { force: true });
    await copyFile(firstIndex, secondIndex);

    expect(await inspectResearchIndex(secondRoot, second.database.id)).toMatchObject({ status: "damaged" });
    expect((await store.searchResearchSources(second.database.id, {
      query: "cobalt passage",
      purpose: "local",
      limit: 20,
    })).results).toEqual([]);
    expect((await store.searchResearchSources(second.database.id, {
      query: "amber passage",
      purpose: "local",
      limit: 20,
    })).results[0]?.sourceDisplayName).toBe("Second only");
    expect(await store.getResearchIndexState(second.database.id)).toMatchObject({ status: "ready" });
  });

  it("keeps the prior live index across cancellation, build failure, and swap failure", async () => {
    const store = await repository();
    const database = await store.createResearchDatabase({ name: "Atomic index" });
    await store.importResearchSource(database.database.id, prepared({
      name: "Stable",
      text: "stable silver harbor record",
      language: "en",
    }));

    await expect(store.rebuildResearchDatabaseIndex(database.database.id, {
      hooks: { afterDatabaseCreated: () => { throw new Error("injected build failure"); } },
    })).rejects.toThrow("injected build failure");
    expect((await store.searchResearchSources(database.database.id, {
      query: "silver harbor",
      purpose: "local",
      limit: 20,
    })).results).toHaveLength(1);

    await expect(store.rebuildResearchDatabaseIndex(database.database.id, {
      hooks: { afterLiveMoved: () => { throw new Error("injected swap failure"); } },
    })).rejects.toThrow("injected swap failure");
    expect((await store.searchResearchSources(database.database.id, {
      query: "silver harbor",
      purpose: "local",
      limit: 20,
    })).results).toHaveLength(1);

    const cancelled = new AbortController();
    await expect(store.rebuildResearchDatabaseIndex(database.database.id, {
      signal: cancelled.signal,
      hooks: { afterDatabaseCreated: () => cancelled.abort() },
    })).rejects.toMatchObject({ name: "AbortError" });
    expect((await store.searchResearchSources(database.database.id, {
      query: "silver harbor",
      purpose: "local",
      limit: 20,
    })).results).toHaveLength(1);
  });

  it("detects FTS divergence and restores equivalent results after deleting the derived index", async () => {
    const store = await repository();
    const database = await store.createResearchDatabase({ name: "Repair index" });
    await store.importResearchSource(database.database.id, prepared({
      name: "Repair source",
      text: "indigo compass evidence",
      language: "en",
    }));
    const root = path.join(store.libraryRoot, "research-databases", database.database.id);
    const indexPath = researchIndexDatabasePath(root);
    const before = await store.searchResearchSources(database.database.id, { query: "indigo compass", purpose: "local", limit: 20 });
    const damaged = new Database(indexPath);
    damaged.prepare("DELETE FROM reference_fts_word").run();
    damaged.close();
    expect(await store.getResearchIndexState(database.database.id)).toMatchObject({ status: "damaged" });
    const repaired = await store.searchResearchSources(database.database.id, { query: "indigo compass", purpose: "local", limit: 20 });
    expect(repaired.results.map((result) => result.chunkHash)).toEqual(before.results.map((result) => result.chunkHash));

    await rm(indexPath, { force: true });
    expect(await store.getResearchIndexState(database.database.id)).toMatchObject({ status: "missing" });
    const rebuilt = await store.searchResearchSources(database.database.id, { query: "indigo compass", purpose: "local", limit: 20 });
    expect(rebuilt.results.map((result) => result.chunkHash)).toEqual(before.results.map((result) => result.chunkHash));
  });
});
