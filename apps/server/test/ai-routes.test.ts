import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CredentialStore } from "@novel-studio/ai";
import { buildApp } from "../src/app.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true })));
});

function memoryCredentialStore(values = new Map<string, string>()): CredentialStore {
  return {
    kind: "windows-credential-manager",
    async isAvailable() {
      return true;
    },
    async writeSecret(targetName, secret) {
      values.set(targetName, secret);
    },
    async readSecret(targetName) {
      const secret = values.get(targetName);
      if (!secret) throw new Error("credential missing");
      return secret;
    },
    async deleteSecret(targetName) {
      values.delete(targetName);
    },
  };
}

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

  it("does not fall back to MockProvider when a configured provider is unavailable", async () => {
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

  it("saves a DeepSeek key to the credential store and tests the provider", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-ai-api-"));
    roots.push(root);
    const secrets = new Map<string, string>();
    const requests: Array<{ url: string; authorization: string | null }> = [];
    const app = await buildApp({
      libraryRoot: root,
      credentialStore: memoryCredentialStore(secrets),
      providerFetch: async (input, init) => {
        const url = String(input);
        requests.push({
          url,
          authorization: new Headers(init?.headers).get("authorization"),
        });
        if (url === "https://api.deepseek.com/models") {
          return new Response(JSON.stringify({
            object: "list",
            data: [
              { id: "deepseek-v4-flash", object: "model", owned_by: "deepseek" },
              { id: "deepseek-v4-pro", object: "model", owned_by: "deepseek" },
            ],
          }), { status: 200, headers: { "content-type": "application/json" } });
        }
        return new Response(JSON.stringify({ error: { message: "not found" } }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      },
    });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "DeepSeek 配置接口" },
    });
    const series = created.json();

    const profileResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles`,
      payload: {
        title: "DeepSeek 写作模型",
        provider: "deepseek",
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-v4-flash",
        cloudPolicy: "cloud-allowed",
      },
    });
    expect(profileResponse.statusCode).toBe(201);
    const profile = profileResponse.json();
    expect(profile.credentialRef).toBeNull();
    expect(profile.capabilities.streamText).toBe(true);

    const credential = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles/${profile.id}/credential`,
      payload: { secret: "deepseek-test-key" },
    });
    expect(credential.statusCode).toBe(200);
    expect(JSON.stringify(credential.json())).not.toContain("deepseek-test-key");
    expect(credential.json().credentialRef).toContain(profile.id);

    const status = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles/${profile.id}/credential`,
    });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({
      credentialRef: credential.json().credentialRef,
      exists: true,
    });
    expect(JSON.stringify(status.json())).not.toContain("deepseek-test-key");

    const tested = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles/${profile.id}/test`,
    });
    expect(tested.statusCode).toBe(200);
    expect(tested.json()).toMatchObject({
      ok: true,
      provider: "deepseek",
      models: [
        { id: "deepseek-v4-flash" },
        { id: "deepseek-v4-pro" },
      ],
    });
    expect(requests).toContainEqual({
      url: "https://api.deepseek.com/models",
      authorization: "Bearer deepseek-test-key",
    });

    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles/${profile.id}/credential`,
    });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json()).toMatchObject({ deleted: true });
    expect(deleted.json().modelProfile.credentialRef).toBeNull();
    expect(secrets.size).toBe(0);

    await app.close();
  });
});
