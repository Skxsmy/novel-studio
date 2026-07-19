import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ResearchDatabaseDocument } from "@novel-studio/contracts";
import { MAX_RESEARCH_SOURCE_BYTES } from "@novel-studio/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const temporaryDirectories: string[] = [];

async function fixture() {
  const libraryRoot = await mkdtemp(path.join(tmpdir(), "novel-studio-research-routes-"));
  temporaryDirectories.push(libraryRoot);
  const app = await buildApp({ libraryRoot });
  const created = await app.inject({
    method: "POST",
    url: "/api/v1/research/databases",
    payload: { name: "Research Routes" },
  });
  expect(created.statusCode).toBe(201);
  return { app, database: created.json<ResearchDatabaseDocument>(), libraryRoot };
}

function upload(fileName: string, mediaType: "text/plain" | "text/markdown", text: string) {
  const bytes = Buffer.from(text, "utf8");
  return {
    fileName,
    mediaType,
    sizeBytes: bytes.byteLength,
    contentBase64: bytes.toString("base64"),
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("NS-603 Research source routes", () => {
  it("imports verified TXT and Markdown bytes into versioned parsed content", async () => {
    const { app, database, libraryRoot } = await fixture();
    const sourceUrl = `/api/v1/research/databases/${database.database.id}/sources`;
    const txt = "潮汐祭的采访记录。\nA witness used the older English name.";
    const txtResponse = await app.inject({
      method: "POST",
      url: sourceUrl,
      payload: { ...upload("interview.txt", "text/plain", txt), declaredLanguage: "zh-CN" },
    });
    expect(txtResponse.statusCode).toBe(201);
    const txtSource = txtResponse.json();
    expect(txtSource).not.toHaveProperty("content");
    expect(txtSource.contentSummary).toMatchObject({ blockCount: 1, chunkCount: 1 });
    const txtPage = await app.inject({
      method: "GET",
      url: `${sourceUrl}/${txtSource.source.id}/content?offset=0&limit=40`,
    });
    expect(txtPage.json().blocks[0].text).toBe(txt);
    expect(txtSource.source).toMatchObject({
      kind: "txt",
      originalFileName: "interview.txt",
      displayName: "interview",
      aiPermission: "never",
    });

    const markdown = "# 用語\n\n月守（つきもり）は英語で Moon Keeper。";
    const mdResponse = await app.inject({
      method: "POST",
      url: sourceUrl,
      payload: { ...upload("terms.md", "text/markdown", markdown), tags: ["terminology"] },
    });
    expect(mdResponse.statusCode).toBe(201);

    const listed = await app.inject({
      method: "GET",
      url: sourceUrl,
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toHaveLength(2);
    const detail = await app.inject({
      method: "GET",
      url: `${sourceUrl}/${mdResponse.json().source.id}`,
    });
    expect(detail.json()).not.toHaveProperty("content");
    const content = await app.inject({
      method: "GET",
      url: `${sourceUrl}/${mdResponse.json().source.id}/content?offset=0&limit=40`,
    });
    expect(content.json().blocks.map((block: { text: string }) => block.text)).toEqual([
      "用語",
      "月守（つきもり）は英語で Moon Keeper。",
    ]);

    const sourceRoot = path.join(libraryRoot, "research-databases", database.database.id);
    expect(await readdir(path.join(sourceRoot, "sources"))).toHaveLength(2);
    const originalBytes = await readFile(path.join(sourceRoot, mdResponse.json().source.originalRelativePath));
    expect(originalBytes.equals(Buffer.from(markdown, "utf8"))).toBe(true);
    await app.close();
  });

  it("rejects malformed, mismatched, empty, oversized, and unsafe source uploads before authority creation", async () => {
    const { app, database } = await fixture();
    const url = `/api/v1/research/databases/${database.database.id}/sources`;
    const cases = [
      { ...upload("wrong.pdf", "text/plain", "content") },
      { ...upload("empty.txt", "text/plain", "   \n") },
      { fileName: "invalid.txt", mediaType: "text/plain", sizeBytes: 6, contentBase64: Buffer.from([0, 1, 2, 3, 0, 4]).toString("base64") },
      { fileName: "size.txt", mediaType: "text/plain", sizeBytes: 99, contentBase64: "YQ==" },
      { fileName: "../escape.txt", mediaType: "text/plain", sizeBytes: 1, contentBase64: "YQ==" },
      { fileName: "large.txt", mediaType: "text/plain", sizeBytes: MAX_RESEARCH_SOURCE_BYTES + 1, contentBase64: "YQ==" },
    ];
    for (const payload of cases) {
      const response = await app.inject({ method: "POST", url, payload });
      expect([400, 422]).toContain(response.statusCode);
      expect(response.body).not.toContain("content\"");
    }
    const listed = await app.inject({ method: "GET", url });
    expect(listed.json()).toEqual([]);
    await app.close();
  });

  it("exposes only real Research list get import and update results without logging source text", async () => {
    const { app, database } = await fixture();
    const url = `/api/v1/research/databases/${database.database.id}/sources`;
    const created = await app.inject({
      method: "POST",
      url,
      payload: upload("private.txt", "text/plain", "private manuscript-adjacent source text"),
    });
    expect(created.statusCode).toBe(201);
    const source = created.json();

    const updated = await app.inject({
      method: "PUT",
      url: `${url}/${source.source.id}`,
      payload: {
        baseRevision: source.revision,
        displayName: "Private interview",
        author: "Author supplied",
        declaredLanguage: "en",
        tags: ["interview"],
        aiPermission: "allowed",
        useNotes: "Use only in this Research Database.",
      },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().source).toMatchObject({ displayName: "Private interview", aiPermission: "allowed" });

    const stale = await app.inject({
      method: "PUT",
      url: `${url}/${source.source.id}`,
      payload: { baseRevision: source.revision, displayName: "Stale title" },
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.body).not.toContain("private manuscript-adjacent source text");
    expect((await app.inject({ method: "DELETE", url: `${url}/${source.source.id}` })).statusCode).toBe(404);
    await app.close();
  });
});
