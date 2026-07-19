import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ResearchDatabaseDocument, SeriesDetail } from "@novel-studio/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const temporaryDirectories: string[] = [];

async function fixture() {
  const libraryRoot = await mkdtemp(path.join(tmpdir(), "novel-studio-research-database-routes-"));
  temporaryDirectories.push(libraryRoot);
  return { app: await buildApp({ libraryRoot }), libraryRoot };
}

async function createSeries(app: Awaited<ReturnType<typeof buildApp>>, title: string): Promise<SeriesDetail> {
  const response = await app.inject({ method: "POST", url: "/api/v1/series", payload: { title } });
  expect(response.statusCode).toBe(201);
  return response.json<SeriesDetail>();
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("NS-603 Research Database routes", () => {
  it("creates and manages databases without an active Series", async () => {
    const { app } = await fixture();
    const createdResponse = await app.inject({
      method: "POST",
      url: "/api/v1/research/databases",
      payload: { name: "Japanese source shelf", description: "Reusable references" },
    });
    expect(createdResponse.statusCode).toBe(201);
    const created = createdResponse.json<ResearchDatabaseDocument>();
    expect(created.database.linkedSeriesIds).toEqual([]);

    const listed = await app.inject({ method: "GET", url: "/api/v1/research/databases" });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toMatchObject({
      databases: [{ database: { id: created.database.id, name: "Japanese source shelf" }, sourceCount: 0 }],
      issues: [],
    });
    const updated = await app.inject({
      method: "PUT",
      url: `/api/v1/research/databases/${created.database.id}`,
      payload: { baseRevision: created.revision, name: "Japanese folklore archive" },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().database.name).toBe("Japanese folklore archive");
    const stale = await app.inject({
      method: "PUT",
      url: `/api/v1/research/databases/${created.database.id}`,
      payload: { baseRevision: created.revision, description: "stale" },
    });
    expect(stale.statusCode).toBe(409);
    await app.close();
  });

  it("links one database to two Series and unlinks without changing its source boundary", async () => {
    const { app } = await fixture();
    const first = await createSeries(app, "First novel");
    const second = await createSeries(app, "Second novel");
    const created = (await app.inject({
      method: "POST",
      url: "/api/v1/research/databases",
      payload: { name: "Shared database" },
    })).json<ResearchDatabaseDocument>();

    const linkedResponse = await app.inject({
      method: "PUT",
      url: `/api/v1/research/databases/${created.database.id}`,
      payload: {
        baseRevision: created.revision,
        linkedSeriesIds: [first.manifest.id, second.manifest.id],
      },
    });
    expect(linkedResponse.statusCode).toBe(200);
    const linked = linkedResponse.json<ResearchDatabaseDocument>();
    expect(linked.database.linkedSeriesIds).toEqual([first.manifest.id, second.manifest.id]);

    const unlinked = await app.inject({
      method: "PUT",
      url: `/api/v1/research/databases/${created.database.id}`,
      payload: { baseRevision: linked.revision, linkedSeriesIds: [second.manifest.id] },
    });
    expect(unlinked.statusCode).toBe(200);
    expect(unlinked.json().database.linkedSeriesIds).toEqual([second.manifest.id]);
    expect((await app.inject({
      method: "POST",
      url: `/api/v1/series/${first.manifest.id}/research/sources`,
      payload: {},
    })).statusCode).toBe(404);
    await app.close();
  });

  it("rejects nonexistent Series links without changing the database revision", async () => {
    const { app } = await fixture();
    const created = (await app.inject({
      method: "POST",
      url: "/api/v1/research/databases",
      payload: { name: "Link validation" },
    })).json<ResearchDatabaseDocument>();
    const response = await app.inject({
      method: "PUT",
      url: `/api/v1/research/databases/${created.database.id}`,
      payload: {
        baseRevision: created.revision,
        linkedSeriesIds: ["00000000-0000-4000-8000-000000000001"],
      },
    });
    expect(response.statusCode).toBe(404);
    const unchanged = await app.inject({
      method: "GET",
      url: `/api/v1/research/databases/${created.database.id}`,
    });
    expect(unchanged.json().revision).toBe(created.revision);
    await app.close();
  });
});
