import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe("local API", () => {
  it("creates, reads and safely updates a scene", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-api-"));
    roots.push(root);
    const app = await buildApp({ libraryRoot: root });

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "纸月亮" },
    });
    expect(createResponse.statusCode).toBe(201);
    const series = createResponse.json();
    const scene = series.scenes[0];

    const updateResponse = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/scenes/${scene.metadata.id}`,
      payload: {
        baseRevision: scene.revision,
        title: "午夜电车",
        content: "最后一班电车驶过没有名字的站台。",
      },
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().content).toContain("最后一班电车");

    const staleResponse = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/scenes/${scene.metadata.id}`,
      payload: {
        baseRevision: scene.revision,
        title: "过期修改",
        content: "不应写入",
      },
    });
    expect(staleResponse.statusCode).toBe(409);
    await app.close();
  });
});

