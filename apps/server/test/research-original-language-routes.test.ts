import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ResearchSourceV2Schema, type ResearchDatabaseDocument } from "@novel-studio/contracts";
import { ProjectRepository } from "@novel-studio/storage";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";

const temporaryDirectories: string[] = [];

async function fixture() {
  const libraryRoot = await mkdtemp(path.join(tmpdir(), "novel-studio-research-original-routes-"));
  temporaryDirectories.push(libraryRoot);
  const acquire = vi.fn(async (url: string) => ({
    bytes: Buffer.from(`<!doctype html><html><head><title>Fetched archive</title><script>privatePayload()</script></head><body onload="privatePayload()"><h1>港湾网页</h1><p>Web harbor evidence in English.</p><a href="https://example.com/next">next page</a></body></html>`),
    origin: {
      type: "web" as const,
      requestedUrl: url,
      finalUrl: "https://public.example/archive",
      redirectChain: ["https://public.example/archive"],
      fetchedAt: "2026-07-19T00:00:00.000Z",
      responseMediaType: "text/html" as const,
    },
  }));
  const app = await buildApp({ libraryRoot, researchWebAcquire: acquire });
  const created = await app.inject({
    method: "POST",
    url: "/api/v1/research/databases",
    payload: { name: "Original language routes" },
  });
  return { acquire, app, database: created.json<ResearchDatabaseDocument>(), libraryRoot };
}

function filePayload(fileName: string, mediaType: string, text: string) {
  const bytes = Buffer.from(text, "utf8");
  return { fileName, mediaType, sizeBytes: bytes.byteLength, contentBase64: bytes.toString("base64") };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("NS-604 Research original-language routes", () => {
  it("imports parsed content, builds the selected database index, searches locations, and enforces model permission", async () => {
    const { app, database } = await fixture();
    const root = `/api/v1/research/databases/${database.database.id}`;
    const imported = await app.inject({
      method: "POST",
      url: `${root}/sources`,
      payload: {
        ...filePayload("route.md", "text/markdown", "# 北海航路\n\n港を出た船。\n\nThe harbor ledger was sealed."),
        declaredLanguage: "ja-JP",
        tags: ["navigation"],
        aiPermission: "never",
      },
    });
    expect(imported.statusCode).toBe(201);
    expect(imported.json().source.schemaVersion).toBe(3);
    expect(imported.json().content.sections[0].title).toBe("北海航路");

    const local = await app.inject({
      method: "POST",
      url: `${root}/search`,
      payload: { query: "北海航路", purpose: "local" },
    });
    expect(local.statusCode).toBe(200);
    expect(local.json().results[0]).toMatchObject({
      researchDatabaseId: database.database.id,
      sourceId: imported.json().source.id,
      location: { kind: "text", startLine: 1 },
    });
    const model = await app.inject({
      method: "POST",
      url: `${root}/search`,
      payload: { query: "北海航路", purpose: "model-context" },
    });
    expect(model.json().results).toEqual([]);
    expect((await app.inject({ method: "GET", url: `${root}/index` })).json()).toMatchObject({ status: "ready" });
    expect((await app.inject({ method: "POST", url: `${root}/index/rebuild` })).json()).toMatchObject({ status: "ready" });
    await app.close();
  });

  it("imports exactly one sanitized managed web snapshot without following page links", async () => {
    const { acquire, app, database, libraryRoot } = await fixture();
    const root = `/api/v1/research/databases/${database.database.id}`;
    const response = await app.inject({
      method: "POST",
      url: `${root}/sources/web`,
      payload: { url: "https://submitted.example/start", aiPermission: "allowed" },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().source).toMatchObject({
      kind: "web-snapshot",
      displayName: "Fetched archive",
      origin: {
        requestedUrl: "https://submitted.example/start",
        finalUrl: "https://public.example/archive",
      },
    });
    expect(acquire).toHaveBeenCalledOnce();
    const databaseRoot = path.join(libraryRoot, "research-databases", database.database.id);
    const snapshot = await readFile(path.join(databaseRoot, response.json().source.originalRelativePath), "utf8");
    expect(snapshot).toContain("Web harbor evidence");
    expect(snapshot).not.toMatch(/script|onload|privatePayload/iu);
    expect((await app.inject({
      method: "POST",
      url: `${root}/search`,
      payload: { query: "Web harbor evidence" },
    })).json().results[0]).toMatchObject({ sourceKind: "web-snapshot", location: { kind: "html" } });
    await app.close();
  });

  it("migrates version 2 only through the explicit revision-bearing route", async () => {
    const { app, database, libraryRoot } = await fixture();
    const databaseRoot = path.join(libraryRoot, "research-databases", database.database.id);
    const sourceId = randomUUID();
    const text = "# Legacy source\n\nExact migration text.";
    const contentHash = createHash("sha256").update(text, "utf8").digest("hex");
    const originalPath = path.join(databaseRoot, "originals", `${sourceId}.md`);
    const source = ResearchSourceV2Schema.parse({
      schemaVersion: 2,
      id: sourceId,
      researchDatabaseId: database.database.id,
      kind: "markdown",
      mediaType: "text/markdown",
      originalFileName: "legacy.md",
      sizeBytes: Buffer.byteLength(text),
      contentHash,
      originalRelativePath: path.relative(databaseRoot, originalPath).replace(/\\/gu, "/"),
      parseStatus: "parsed",
      parserName: "plain-text",
      parserVersion: 1,
      importedAt: "2026-07-19T00:00:00.000Z",
      updatedAt: "2026-07-19T00:00:00.000Z",
      displayName: "Legacy source",
      author: "",
      declaredLanguage: "en",
      tags: [],
      aiPermission: "never",
      useNotes: "",
    });
    const sourceRaw = `${JSON.stringify(source, null, 2)}\n`;
    const version2Revision = createHash("sha256").update(sourceRaw, "utf8").digest("hex");
    await mkdir(path.dirname(originalPath), { recursive: true });
    await mkdir(path.join(databaseRoot, "sources"), { recursive: true });
    await writeFile(originalPath, text, "utf8");
    await writeFile(path.join(databaseRoot, "sources", `${sourceId}.json`), sourceRaw, "utf8");
    const stale = await app.inject({
      method: "POST",
      url: `/api/v1/research/databases/${database.database.id}/migrations/source-v3`,
      payload: { sources: [{ sourceId, baseRevision: "a".repeat(64) }] },
    });
    expect(stale.statusCode).toBe(409);
    const migrated = await app.inject({
      method: "POST",
      url: `/api/v1/research/databases/${database.database.id}/migrations/source-v3`,
      payload: { sources: [{ sourceId, baseRevision: version2Revision }] },
    });
    expect(migrated.statusCode).toBe(200);
    expect(migrated.json()).toMatchObject({ migratedSourceIds: [sourceId], indexState: { status: "ready" } });
    expect((await new ProjectRepository(libraryRoot).getResearchSource(database.database.id, sourceId)).source.schemaVersion).toBe(3);
    await app.close();
  });
});
