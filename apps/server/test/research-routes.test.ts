import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { SeriesDetail } from "@novel-studio/contracts";
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
    url: "/api/v1/series",
    payload: { title: "Research Routes" },
  });
  expect(created.statusCode).toBe(201);
  return { app, libraryRoot, series: created.json<SeriesDetail>() };
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

describe("NS-602 Research routes", () => {
  it("imports only verified UTF-8 TXT and Markdown source bytes", async () => {
    const { app, libraryRoot, series } = await fixture();
    const txt = "潮汐祭的采访记录。\nA witness used the older English name.";
    const txtResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/research/sources`,
      payload: { ...upload("interview.txt", "text/plain", txt), declaredLanguage: "zh-CN" },
    });
    expect(txtResponse.statusCode).toBe(201);
    const txtSource = txtResponse.json();
    expect(txtSource.originalText).toBe(txt);
    expect(txtSource.source).toMatchObject({
      kind: "txt",
      originalFileName: "interview.txt",
      displayName: "interview",
      aiPermission: "never",
    });

    const markdown = "# 用語\n\n月守（つきもり）は英語で Moon Keeper。";
    const mdResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/research/sources`,
      payload: { ...upload("terms.md", "text/markdown", markdown), tags: ["terminology"] },
    });
    expect(mdResponse.statusCode).toBe(201);

    const listed = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/research/sources`,
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toHaveLength(2);
    const detail = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/research/sources/${mdResponse.json().source.id}`,
    });
    expect(detail.json().originalText).toBe(markdown);

    const seriesDirectory = (await readdir(libraryRoot)).find((name) => name.endsWith(series.manifest.id.slice(0, 8)));
    expect(seriesDirectory).toBeDefined();
    const sourceRoot = path.join(libraryRoot, seriesDirectory!, "research");
    expect(await readdir(path.join(sourceRoot, "sources"))).toHaveLength(2);
    const originalBytes = await readFile(path.join(libraryRoot, seriesDirectory!, mdResponse.json().source.originalRelativePath));
    expect(originalBytes.equals(Buffer.from(markdown, "utf8"))).toBe(true);
    await app.close();
  });

  it("rejects malformed, mismatched, empty, oversized, and unsafe source uploads before authority creation", async () => {
    const { app, series } = await fixture();
    const url = `/api/v1/series/${series.manifest.id}/research/sources`;
    const cases = [
      { ...upload("wrong.md", "text/plain", "content") },
      { ...upload("empty.txt", "text/plain", "   \n") },
      { fileName: "invalid.txt", mediaType: "text/plain", sizeBytes: 1, contentBase64: "/w==" },
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
    const { app, series } = await fixture();
    const url = `/api/v1/series/${series.manifest.id}/research/sources`;
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
        useNotes: "Use only for this Series.",
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
