import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true })));
});

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "novel-studio-workshop-research-routes-"));
  roots.push(root);
  const app = await buildApp({ libraryRoot: root });
  const seriesResponse = await app.inject({
    method: "POST",
    url: "/api/v1/series",
    payload: { title: "WorkshopResearchRoutes" },
  });
  expect(seriesResponse.statusCode).toBe(201);
  return { app, root, series: seriesResponse.json() };
}

describe("NS-607 Workshop Research activation routes", () => {
  it("persists isolated explicit activation, branch snapshots, archive protection, and detail evidence", async () => {
    const { app, series } = await fixture();
    const linkedResponse = await app.inject({
      method: "POST",
      url: "/api/v1/research/databases",
      payload: { name: "Linked database" },
    });
    const unlinkedResponse = await app.inject({
      method: "POST",
      url: "/api/v1/research/databases",
      payload: { name: "Unlinked database" },
    });
    const linked = linkedResponse.json();
    const unlinked = unlinkedResponse.json();
    await app.inject({
      method: "PUT",
      url: `/api/v1/research/databases/${linked.database.id}`,
      payload: { baseRevision: linked.revision, linkedSeriesIds: [series.manifest.id] },
    });

    const firstResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { title: "First" },
    });
    const secondResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { title: "Second" },
    });
    const first = firstResponse.json();
    const second = secondResponse.json();
    expect(first).toMatchObject({ schemaVersion: 3, activeResearchDatabaseIds: [] });

    const activated = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${first.id}`,
      payload: { activeResearchDatabaseIds: [unlinked.database.id, linked.database.id] },
    });
    expect(activated.statusCode, activated.payload).toBe(200);
    expect(activated.json().activeResearchDatabaseIds).toEqual([
      unlinked.database.id,
      linked.database.id,
    ]);

    const listed = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().diagnostics).toEqual([]);
    expect(listed.json().sessions.find((session: { id: string }) => session.id === second.id)
      .activeResearchDatabaseIds).toEqual([]);

    const author = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${first.id}/messages`,
      payload: { role: "author", mode: "general-chat", content: "Compare these references." },
    });
    const branch = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${first.id}/branch`,
      payload: { sourceMessageId: author.json().id, title: "Research branch" },
    });
    expect(branch.statusCode, branch.payload).toBe(201);
    expect(branch.json().session.activeResearchDatabaseIds)
      .toEqual(activated.json().activeResearchDatabaseIds);

    const blockers = await app.inject({
      method: "GET",
      url: `/api/v1/research/databases/${linked.database.id}/deletion-blockers`,
    });
    expect(blockers.statusCode, blockers.payload).toBe(200);
    expect(blockers.json()).toMatchObject({ blocked: true, unreadableSeries: [] });
    expect(blockers.json().workshopReferences).toEqual(expect.arrayContaining([
      expect.objectContaining({ seriesTitle: "WorkshopResearchRoutes", sessionTitle: "First", sessionStatus: "active" }),
      expect.objectContaining({ seriesTitle: "WorkshopResearchRoutes", sessionTitle: "Research branch", sessionStatus: "active" }),
    ]));

    const detail = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${branch.json().session.id}`,
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().researchEvidence).toEqual([]);

    await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${branch.json().session.id}/archive`,
    });
    const archivedUpdate = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${branch.json().session.id}`,
      payload: { activeResearchDatabaseIds: [] },
    });
    expect(archivedUpdate.statusCode).toBe(422);

    const missing = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions/${second.id}`,
      payload: { activeResearchDatabaseIds: [randomUUID()] },
    });
    expect(missing.statusCode).toBe(404);
    await app.close();
  });

  it("returns valid sessions beside a bounded damaged-record diagnostic", async () => {
    const { app, root, series } = await fixture();
    const valid = (await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
      payload: { title: "Valid" },
    })).json();
    const seriesRoot = path.join(root, `WorkshopResearchRoutes-${series.manifest.id.slice(0, 8)}`);
    const damagedPath = path.join(seriesRoot, "workshop", "sessions", `${randomUUID()}.json`);
    await mkdir(path.dirname(damagedPath), { recursive: true });
    await writeFile(damagedPath, "{damaged-json\n", "utf8");

    const listed = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/workshop/sessions`,
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().sessions.map((session: { id: string }) => session.id)).toEqual([valid.id]);
    expect(listed.json().diagnostics).toHaveLength(1);
    expect(listed.json().diagnostics[0]).toMatchObject({ code: "INVALID_DATA" });
    expect(listed.json().diagnostics[0].fileName).not.toContain("\\");
    expect(listed.json().diagnostics[0].fileName).not.toContain("/");
    await app.close();
  });
});
