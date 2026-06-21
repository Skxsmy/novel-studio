import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe("M4 model settings API", () => {
  it("stores model profiles without secrets and tests MockProvider connections", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-ai-api-"));
    roots.push(root);
    const app = await buildApp({ libraryRoot: root });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "模型设置接口" },
    });
    const series = created.json();

    const initialProfiles = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles`,
    });
    expect(initialProfiles.statusCode).toBe(200);
    expect(initialProfiles.json()).toEqual([]);

    const mockProfileResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles`,
      payload: {
        title: "本地测试模型",
        provider: "mock",
        model: "mock-continuity-v1",
      },
    });
    expect(mockProfileResponse.statusCode).toBe(201);
    const mockProfile = mockProfileResponse.json();
    expect(mockProfile.credentialRef).toBeNull();
    expect(mockProfile.capabilities.streamText).toBe(true);

    const testConnection = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles/${mockProfile.id}/test`,
    });
    expect(testConnection.statusCode).toBe(200);
    expect(testConnection.json()).toMatchObject({
      ok: true,
      provider: "mock",
      modelProfileId: mockProfile.id,
      error: null,
    });

    const models = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles/${mockProfile.id}/models`,
    });
    expect(models.statusCode).toBe(200);
    expect(models.json().map((item: { id: string }) => item.id)).toContain("mock-continuity-v1");

    const rejectedSecret = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles`,
      payload: {
        title: "错误密钥",
        provider: "mock",
        model: "mock-continuity-v1",
        credentialRef: "sk-this-should-not-be-saved",
      },
    });
    expect(rejectedSecret.statusCode).toBe(400);

    await app.close();
  });

  it("blocks cloud providers when the series is local-only and never falls back to MockProvider", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-ai-api-"));
    roots.push(root);
    const app = await buildApp({ libraryRoot: root });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "云端权限接口" },
    });
    const series = created.json();

    const cloudProfileResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles`,
      payload: {
        title: "云端测试模型",
        provider: "openai",
        model: "gpt-test",
        cloudPolicy: "cloud-allowed",
        credentialRef: "novel-studio:openai:test",
      },
    });
    expect(cloudProfileResponse.statusCode).toBe(201);
    const cloudProfile = cloudProfileResponse.json();

    const localOnlyBlocked = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles/${cloudProfile.id}/test`,
    });
    expect(localOnlyBlocked.statusCode).toBe(403);
    expect(localOnlyBlocked.json()).toMatchObject({
      code: "CLOUD_DISABLED",
      error: { code: "cloud-disabled" },
    });

    const policy = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/ai/cloud-policy`,
      payload: { cloudPolicy: "cloud-allowed" },
    });
    expect(policy.statusCode).toBe(200);
    expect(policy.json().cloudPolicy).toBe("cloud-allowed");

    const unavailable = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles/${cloudProfile.id}/test`,
    });
    expect(unavailable.statusCode).toBe(503);
    expect(unavailable.json()).toMatchObject({
      ok: false,
      provider: "openai",
      modelProfileId: cloudProfile.id,
      error: { code: "provider-unavailable" },
    });
    expect(JSON.stringify(unavailable.json())).not.toContain("mock-continuity-v1");

    await app.close();
  });
});
