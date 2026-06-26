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
    const requests: Array<{ url: string; xGoogApiKey: string | null }> = [];
    const app = await buildApp({
      libraryRoot: root,
      credentialStore: memoryCredentialStore(new Map([["novel-studio:google:test", "gemini-failure-key"]])),
      providerFetch: async (input, init) => {
        const url = String(input);
        requests.push({
          url,
          xGoogApiKey: new Headers(init?.headers).get("x-goog-api-key"),
        });
        return new Response(JSON.stringify({
          error: { code: 503, message: "service unavailable", status: "UNAVAILABLE" },
        }), { status: 503, headers: { "content-type": "application/json" } });
      },
    });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "云端权限接口" },
    });
    const series = created.json();

    await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/ai/cloud-policy`,
      payload: { cloudPolicy: "cloud-allowed" },
    });

    const cloudProfileResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles`,
      payload: {
        title: "云端测试模型",
        provider: "google",
        model: "gemini-test",
        cloudPolicy: "cloud-allowed",
        credentialRef: "novel-studio:google:test",
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
      provider: "google",
      modelProfileId: cloudProfile.id,
      error: { code: "provider-unavailable" },
    });
    expect(JSON.stringify(unavailable.json())).not.toContain("mock-continuity-v1");
    expect(requests).toContainEqual({
      url: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
      xGoogApiKey: "gemini-failure-key",
    });

    await app.close();
  });

  it("saves an Anthropic key and fetches current provider models", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-anthropic-api-"));
    roots.push(root);
    const secrets = new Map<string, string>();
    const requests: Array<{
      anthropicVersion: string | null;
      url: string;
      xApiKey: string | null;
    }> = [];
    const app = await buildApp({
      libraryRoot: root,
      credentialStore: memoryCredentialStore(secrets),
      providerFetch: async (input, init) => {
        const url = String(input);
        const headers = new Headers(init?.headers);
        requests.push({
          anthropicVersion: headers.get("anthropic-version"),
          url,
          xApiKey: headers.get("x-api-key"),
        });
        if (url === "https://api.anthropic.com/v1/models?limit=1000") {
          return new Response(JSON.stringify({
            data: [{
              id: "claude-test",
              display_name: "Claude Test",
              max_input_tokens: 200000,
              max_tokens: 64000,
              type: "model",
            }],
            first_id: "claude-test",
            has_more: false,
            last_id: "claude-test",
          }), { status: 200, headers: { "content-type": "application/json" } });
        }
        return new Response(JSON.stringify({ error: { type: "not_found_error", message: "not found" } }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      },
    });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "Anthropic 配置接口" },
    });
    const series = created.json();

    await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/ai/cloud-policy`,
      payload: { cloudPolicy: "cloud-allowed" },
    });

    const profileResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles`,
      payload: {
        title: "Anthropic 写作模型",
        provider: "anthropic",
        baseUrl: null,
        model: "claude-test",
        cloudPolicy: "cloud-allowed",
      },
    });
    expect(profileResponse.statusCode).toBe(201);
    const profile = profileResponse.json();

    const credential = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles/${profile.id}/credential`,
      payload: { secret: "anthropic-test-key" },
    });
    expect(credential.statusCode).toBe(200);
    expect(JSON.stringify(credential.json())).not.toContain("anthropic-test-key");

    const models = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles/${profile.id}/models`,
    });
    expect(models.statusCode).toBe(200);
    expect(models.json()).toEqual([
      expect.objectContaining({
        id: "claude-test",
        title: "Claude Test",
        contextWindowTokens: 200000,
      }),
    ]);
    expect(requests).toContainEqual({
      anthropicVersion: "2023-06-01",
      url: "https://api.anthropic.com/v1/models?limit=1000",
      xApiKey: "anthropic-test-key",
    });

    await app.close();
  });

  it("saves a Gemini key and fetches current provider models", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-gemini-api-"));
    roots.push(root);
    const secrets = new Map<string, string>();
    const requests: Array<{
      authorization: string | null;
      url: string;
      xGoogApiKey: string | null;
    }> = [];
    const app = await buildApp({
      libraryRoot: root,
      credentialStore: memoryCredentialStore(secrets),
      providerFetch: async (input, init) => {
        const url = String(input);
        const headers = new Headers(init?.headers);
        requests.push({
          authorization: headers.get("authorization"),
          url,
          xGoogApiKey: headers.get("x-goog-api-key"),
        });
        if (url === "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000") {
          return new Response(JSON.stringify({
            models: [
              {
                name: "models/gemini-test",
                baseModelId: "gemini-test",
                displayName: "Gemini Test",
                inputTokenLimit: 1048576,
                outputTokenLimit: 8192,
                supportedGenerationMethods: ["generateContent"],
              },
              {
                name: "models/text-embedding-test",
                baseModelId: "text-embedding-test",
                displayName: "Embedding Test",
                inputTokenLimit: 8192,
                supportedGenerationMethods: ["embedContent"],
              },
            ],
          }), { status: 200, headers: { "content-type": "application/json" } });
        }
        return new Response(JSON.stringify({ error: { code: 404, message: "not found", status: "NOT_FOUND" } }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      },
    });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "Gemini 配置接口" },
    });
    const series = created.json();

    await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/ai/cloud-policy`,
      payload: { cloudPolicy: "cloud-allowed" },
    });

    const profileResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles`,
      payload: {
        title: "Gemini 写作模型",
        provider: "google",
        baseUrl: null,
        model: "gemini-test",
        cloudPolicy: "cloud-allowed",
      },
    });
    expect(profileResponse.statusCode).toBe(201);
    const profile = profileResponse.json();

    const credential = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles/${profile.id}/credential`,
      payload: { secret: "gemini-test-key" },
    });
    expect(credential.statusCode).toBe(200);
    expect(JSON.stringify(credential.json())).not.toContain("gemini-test-key");

    const models = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles/${profile.id}/models`,
    });
    expect(models.statusCode).toBe(200);
    expect(models.json()).toEqual([
      expect.objectContaining({
        id: "gemini-test",
        title: "Gemini Test",
        contextWindowTokens: 1048576,
      }),
    ]);
    expect(requests).toContainEqual({
      authorization: null,
      url: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
      xGoogApiKey: "gemini-test-key",
    });

    await app.close();
  });

  it("blocks cloud providers until both project and model policies allow them", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-ai-api-"));
    roots.push(root);
    let providerFetchCount = 0;
    const app = await buildApp({
      libraryRoot: root,
      providerFetch: async () => {
        providerFetchCount += 1;
        return new Response("{}", { status: 500 });
      },
    });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "Cloud policy gates" },
    });
    const series = created.json();

    const profileResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles`,
      payload: {
        title: "DeepSeek blocked",
        provider: "deepseek",
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-v4-flash",
        cloudPolicy: "cloud-allowed",
        credentialRef: "novel-studio:model:test",
      },
    });
    expect(profileResponse.statusCode).toBe(201);
    const profile = profileResponse.json();

    const projectBlocked = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles/${profile.id}/test`,
    });
    expect(projectBlocked.statusCode).toBe(403);
    expect(projectBlocked.json()).toMatchObject({
      code: "CLOUD_DISABLED",
      error: { code: "cloud-disabled" },
    });
    expect(providerFetchCount).toBe(0);

    await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/ai/cloud-policy`,
      payload: { cloudPolicy: "cloud-allowed" },
    });
    const localProfile = await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles/${profile.id}`,
      payload: { cloudPolicy: "local-only" },
    });
    expect(localProfile.statusCode).toBe(200);

    const profileBlocked = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles/${profile.id}/models`,
    });
    expect(profileBlocked.statusCode).toBe(403);
    expect(profileBlocked.json()).toMatchObject({
      code: "CLOUD_DISABLED",
      error: { code: "cloud-disabled" },
    });
    expect(providerFetchCount).toBe(0);

    await app.close();
  });

  it("tests an OpenAI profile through the official chat-compatible provider path", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-openai-api-"));
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
        if (url === "https://api.openai.com/v1/models") {
          return new Response(JSON.stringify({
            object: "list",
            data: [{ id: "gpt-test", object: "model", owned_by: "openai" }],
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
      payload: { title: "OpenAI 配置接口" },
    });
    const series = created.json();

    await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/ai/cloud-policy`,
      payload: { cloudPolicy: "cloud-allowed" },
    });

    const profileResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles`,
      payload: {
        title: "OpenAI 写作模型",
        provider: "openai",
        baseUrl: null,
        model: "gpt-test",
        cloudPolicy: "cloud-allowed",
      },
    });
    expect(profileResponse.statusCode).toBe(201);
    const profile = profileResponse.json();

    const credential = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles/${profile.id}/credential`,
      payload: { secret: "openai-test-key" },
    });
    expect(credential.statusCode).toBe(200);
    expect(JSON.stringify(credential.json())).not.toContain("openai-test-key");

    const tested = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles/${profile.id}/test`,
    });
    expect(tested.statusCode).toBe(200);
    expect(tested.json()).toMatchObject({
      ok: true,
      provider: "openai",
      models: [{ id: "gpt-test" }],
    });
    expect(requests).toContainEqual({
      url: "https://api.openai.com/v1/models",
      authorization: "Bearer openai-test-key",
    });

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

    await app.inject({
      method: "PUT",
      url: `/api/v1/series/${series.manifest.id}/ai/cloud-policy`,
      payload: { cloudPolicy: "cloud-allowed" },
    });

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

  it("archives model profiles and removes profile-owned service keys", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-ai-api-"));
    roots.push(root);
    const secrets = new Map<string, string>();
    const app = await buildApp({
      libraryRoot: root,
      credentialStore: memoryCredentialStore(secrets),
    });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "Profile archive" },
    });
    const series = created.json();

    const profileResponse = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles`,
      payload: {
        title: "OpenAI archive target",
        provider: "openai",
        model: "gpt-test",
        cloudPolicy: "cloud-allowed",
      },
    });
    expect(profileResponse.statusCode).toBe(201);
    const profile = profileResponse.json();

    const credential = await app.inject({
      method: "POST",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles/${profile.id}/credential`,
      payload: { secret: "archive-test-key" },
    });
    expect(credential.statusCode).toBe(200);
    expect(secrets.size).toBe(1);

    const archived = await app.inject({
      method: "DELETE",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles/${profile.id}`,
    });
    expect(archived.statusCode).toBe(200);
    expect(archived.json()).toMatchObject({
      archivedAt: expect.any(String),
      credentialRef: null,
      id: profile.id,
    });
    expect(secrets.size).toBe(0);
    expect(JSON.stringify(archived.json())).not.toContain("archive-test-key");

    const activeProfiles = await app.inject({
      method: "GET",
      url: `/api/v1/series/${series.manifest.id}/ai/model-profiles`,
    });
    expect(activeProfiles.statusCode).toBe(200);
    expect(activeProfiles.json()).toEqual([]);

    await app.close();
  });
});
