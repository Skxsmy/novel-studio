import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CredentialStore } from "@novel-studio/ai";
import { EmbeddingModelProfileSchema } from "@novel-studio/contracts";
import { ProjectRepository } from "@novel-studio/storage";
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
  it("persists library-global embedding use-case bindings through the API", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-embedding-binding-api-"));
    roots.push(root);
    const store = new ProjectRepository(root);
    await store.initialize();
    const now = new Date().toISOString();
    const embeddingProfile = EmbeddingModelProfileSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      title: "Codex detail planner",
      provider: "mock",
      baseUrl: null,
      endpointPath: "/embed",
      model: "mock-codex-detail",
      credentialRef: null,
      dimensions: 4,
      maxInputTokens: 512,
      maxBatchSize: 16,
      maxConcurrentBatches: 2,
      normalize: true,
      supportsCustomDimensions: false,
      license: "MIT",
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    });
    await store.saveEmbeddingModelProfile(embeddingProfile);
    const app = await buildApp({ libraryRoot: root });
    const saved = await app.inject({
      method: "PUT",
      url: "/api/v1/ai/embedding-bindings/codex.detail-schema",
      payload: { profileId: embeddingProfile.id },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({
      schemaVersion: 1,
      useCase: "codex.detail-schema",
      profileId: embeddingProfile.id,
    });
    expect((await app.inject({
      method: "GET",
      url: "/api/v1/ai/embedding-bindings",
    })).json()).toHaveLength(1);
    await app.close();

    const restarted = await buildApp({ libraryRoot: root });
    expect((await restarted.inject({
      method: "GET",
      url: "/api/v1/ai/embedding-bindings",
    })).json()).toMatchObject([{ profileId: embeddingProfile.id }]);
    const missing = await restarted.inject({
      method: "PUT",
      url: "/api/v1/ai/embedding-bindings/reference.semantic-search",
      payload: { profileId: randomUUID() },
    });
    expect(missing.statusCode).toBe(404);
    const deleted = await restarted.inject({
      method: "DELETE",
      url: "/api/v1/ai/embedding-bindings/codex.detail-schema",
    });
    expect(deleted.json()).toEqual({ useCase: "codex.detail-schema", deleted: true });
    expect((await restarted.inject({
      method: "GET",
      url: "/api/v1/ai/embedding-bindings",
    })).json()).toEqual([]);
    await restarted.close();
  });

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
      url: `/api/v1/ai/model-profiles`,
    });
    expect(initialProfiles.statusCode).toBe(200);
    expect(initialProfiles.json()).toEqual([]);

    const mockProfileResponse = await app.inject({
      method: "POST",
      url: `/api/v1/ai/model-profiles`,
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
      url: `/api/v1/ai/model-profiles/${mockProfile.id}/test`,
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
      url: `/api/v1/ai/model-profiles/${mockProfile.id}/models`,
    });
    expect(models.statusCode).toBe(200);
    expect(models.json().map((item: { id: string }) => item.id)).toContain("mock-continuity-v1");

    const rejectedSecret = await app.inject({
      method: "POST",
      url: `/api/v1/ai/model-profiles`,
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
    const secrets = new Map<string, string>();
    const app = await buildApp({
      libraryRoot: root,
      credentialStore: memoryCredentialStore(secrets),
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
      payload: { title: "Provider 接口" },
    });
    const series = created.json();

    const googleProfileResponse = await app.inject({
      method: "POST",
      url: `/api/v1/ai/model-profiles`,
      payload: {
        title: "Google 测试模型",
        provider: "google",
        model: "gemini-test",
      },
    });
    expect(googleProfileResponse.statusCode).toBe(201);
    const googleProfile = googleProfileResponse.json();

    const credential = await app.inject({
      method: "POST",
      url: `/api/v1/ai/model-profiles/${googleProfile.id}/credential`,
      payload: { secret: "gemini-failure-key" },
    });
    expect(credential.statusCode).toBe(200);

    const unavailable = await app.inject({
      method: "POST",
      url: `/api/v1/ai/model-profiles/${googleProfile.id}/test`,
    });
    expect(unavailable.statusCode).toBe(503);
    expect(unavailable.json()).toMatchObject({
      ok: false,
      provider: "google",
      modelProfileId: googleProfile.id,
      error: { code: "provider-unavailable" },
    });
    expect(JSON.stringify(unavailable.json())).not.toContain("mock-continuity-v1");
    expect(requests).toContainEqual({
      url: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
      xGoogApiKey: "gemini-failure-key",
    });

    await app.close();
  });

  it("stores model settings and service keys globally across projects", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-global-ai-api-"));
    roots.push(root);
    const secrets = new Map<string, string>();
    const app = await buildApp({
      libraryRoot: root,
      credentialStore: memoryCredentialStore(secrets),
    });
    const firstSeries = (await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "First Project" },
    })).json();
    const secondSeries = (await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "Second Project" },
    })).json();

    const profileResponse = await app.inject({
      method: "POST",
      url: "/api/v1/ai/model-profiles",
      payload: {
        title: "Shared DeepSeek",
        provider: "deepseek",
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-v4-flash",
      },
    });
    expect(profileResponse.statusCode).toBe(201);
    const profile = profileResponse.json();

    const secret = "sk-realistic-global-key-1234567890";
    const credential = await app.inject({
      method: "POST",
      url: `/api/v1/ai/model-profiles/${profile.id}/credential`,
      payload: { secret },
    });
    expect(credential.statusCode).toBe(200);
    expect(credential.json().credentialRef).toBe(`novel-studio/model-profile/${profile.id}`);
    expect(credential.json().credentialRef).not.toContain(firstSeries.manifest.id);
    expect(credential.json().credentialRef).not.toContain(secondSeries.manifest.id);
    expect(secrets.get(credential.json().credentialRef)).toBe(secret);
    expect(JSON.stringify(credential.json())).not.toContain(secret);

    const updatedProfile = await app.inject({
      method: "PUT",
      url: `/api/v1/ai/model-profiles/${profile.id}`,
      payload: {
        title: "Shared DeepSeek Updated",
        provider: "deepseek",
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-v4-flash",
        capabilities: profile.capabilities,
        contextWindowTokens: profile.contextWindowTokens,
      },
    });
    expect(updatedProfile.statusCode).toBe(200);
    expect(updatedProfile.json()).toMatchObject({
      id: profile.id,
      title: "Shared DeepSeek Updated",
      credentialRef: `novel-studio/model-profile/${profile.id}`,
    });
    expect(secrets.get(credential.json().credentialRef)).toBe(secret);

    const status = await app.inject({
      method: "GET",
      url: `/api/v1/ai/model-profiles/${profile.id}/credential`,
    });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({
      credentialRef: `novel-studio/model-profile/${profile.id}`,
      exists: true,
      modelProfile: { id: profile.id, title: "Shared DeepSeek Updated" },
    });

    const profiles = await app.inject({
      method: "GET",
      url: "/api/v1/ai/model-profiles",
    });
    expect(profiles.statusCode).toBe(200);
    expect(profiles.json().map((item: { id: string }) => item.id)).toContain(profile.id);

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

    const profileResponse = await app.inject({
      method: "POST",
      url: `/api/v1/ai/model-profiles`,
      payload: {
        title: "Anthropic 写作模型",
        provider: "anthropic",
        baseUrl: null,
        model: "claude-test",
      },
    });
    expect(profileResponse.statusCode).toBe(201);
    const profile = profileResponse.json();

    const credential = await app.inject({
      method: "POST",
      url: `/api/v1/ai/model-profiles/${profile.id}/credential`,
      payload: { secret: "anthropic-test-key" },
    });
    expect(credential.statusCode).toBe(200);
    expect(JSON.stringify(credential.json())).not.toContain("anthropic-test-key");

    const models = await app.inject({
      method: "GET",
      url: `/api/v1/ai/model-profiles/${profile.id}/models`,
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

    const profileResponse = await app.inject({
      method: "POST",
      url: `/api/v1/ai/model-profiles`,
      payload: {
        title: "Gemini 写作模型",
        provider: "google",
        baseUrl: null,
        model: "gemini-test",
      },
    });
    expect(profileResponse.statusCode).toBe(201);
    const profile = profileResponse.json();

    const credential = await app.inject({
      method: "POST",
      url: `/api/v1/ai/model-profiles/${profile.id}/credential`,
      payload: { secret: "gemini-test-key" },
    });
    expect(credential.statusCode).toBe(200);
    expect(JSON.stringify(credential.json())).not.toContain("gemini-test-key");

    const models = await app.inject({
      method: "GET",
      url: `/api/v1/ai/model-profiles/${profile.id}/models`,
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

  it("does not gate providers behind project or model policy switches", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-ai-api-"));
    roots.push(root);
    let providerFetchCount = 0;
    const secrets = new Map<string, string>();
    const app = await buildApp({
      libraryRoot: root,
      credentialStore: memoryCredentialStore(secrets),
      providerFetch: async () => {
        providerFetchCount += 1;
        return new Response("{}", { status: 500 });
      },
    });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/series",
      payload: { title: "Provider gate removal" },
    });
    const series = created.json();

    const profileResponse = await app.inject({
      method: "POST",
      url: `/api/v1/ai/model-profiles`,
      payload: {
        title: "DeepSeek blocked",
        provider: "deepseek",
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-v4-flash",
      },
    });
    expect(profileResponse.statusCode).toBe(201);
    const profile = profileResponse.json();

    const credential = await app.inject({
      method: "POST",
      url: `/api/v1/ai/model-profiles/${profile.id}/credential`,
      payload: { secret: "deepseek-gate-key" },
    });
    expect(credential.statusCode).toBe(200);

    const tested = await app.inject({
      method: "POST",
      url: `/api/v1/ai/model-profiles/${profile.id}/test`,
    });
    expect(tested.statusCode).not.toBe(403);
    expect(providerFetchCount).toBe(1);

    const models = await app.inject({
      method: "GET",
      url: `/api/v1/ai/model-profiles/${profile.id}/models`,
    });
    expect(models.statusCode).not.toBe(403);
    expect(providerFetchCount).toBe(2);

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

    const profileResponse = await app.inject({
      method: "POST",
      url: `/api/v1/ai/model-profiles`,
      payload: {
        title: "OpenAI 写作模型",
        provider: "openai",
        baseUrl: null,
        model: "gpt-test",
      },
    });
    expect(profileResponse.statusCode).toBe(201);
    const profile = profileResponse.json();

    const credential = await app.inject({
      method: "POST",
      url: `/api/v1/ai/model-profiles/${profile.id}/credential`,
      payload: { secret: "openai-test-key" },
    });
    expect(credential.statusCode).toBe(200);
    expect(JSON.stringify(credential.json())).not.toContain("openai-test-key");

    const tested = await app.inject({
      method: "POST",
      url: `/api/v1/ai/model-profiles/${profile.id}/test`,
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

  it("persists a version 2 reasoning preference for the exact model only after its credential is available", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "novel-studio-reasoning-profile-api-"));
    roots.push(root);
    const secrets = new Map<string, string>();
    const providerFetch: typeof fetch = async (input) => {
      if (String(input) === "https://api.openai.com/v1/models") {
        return new Response(JSON.stringify({
          object: "list",
          data: [{ id: "gpt-5.4", object: "model", owned_by: "openai" }],
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: { message: "not found" } }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    };
    const app = await buildApp({
      libraryRoot: root,
      credentialStore: memoryCredentialStore(secrets),
      providerFetch,
    });

    const created = await app.inject({
      method: "POST",
      url: "/api/v1/ai/model-profiles",
      payload: {
        title: "Exact reasoning model",
        provider: "openai",
        model: "gpt-5.4",
        reasoningPreference: null,
      },
    });
    expect(created.statusCode, created.payload).toBe(201);
    expect(created.json()).toMatchObject({
      schemaVersion: 2,
      credentialRef: null,
      model: "gpt-5.4",
      reasoningPreference: null,
    });

    const rejectedWithoutCredential = await app.inject({
      method: "POST",
      url: "/api/v1/ai/model-profiles",
      payload: {
        title: "Unverifiable reasoning model",
        provider: "openai",
        model: "gpt-5.4",
        reasoningPreference: { mode: "effort", effort: "high" },
      },
    });
    expect(rejectedWithoutCredential.statusCode).toBe(422);
    expect((await app.inject({ method: "GET", url: "/api/v1/ai/model-profiles" })).json())
      .toHaveLength(1);

    const credential = await app.inject({
      method: "POST",
      url: `/api/v1/ai/model-profiles/${created.json().id}/credential`,
      payload: { secret: "openai-exact-reasoning-key" },
    });
    expect(credential.statusCode).toBe(200);
    expect(JSON.stringify(credential.json())).not.toContain("openai-exact-reasoning-key");

    const saved = await app.inject({
      method: "PUT",
      url: `/api/v1/ai/model-profiles/${created.json().id}`,
      payload: { reasoningPreference: { mode: "effort", effort: "high" } },
    });
    expect(saved.statusCode, saved.payload).toBe(200);
    expect(saved.json().reasoningPreference).toEqual({ mode: "effort", effort: "high" });
    expect(saved.json()).toMatchObject({
      capabilities: created.json().capabilities,
      contextWindowTokens: created.json().contextWindowTokens,
      defaultParameters: created.json().defaultParameters,
    });

    const unsupported = await app.inject({
      method: "PUT",
      url: `/api/v1/ai/model-profiles/${created.json().id}`,
      payload: { reasoningPreference: { mode: "effort", effort: "max" } },
    });
    expect(unsupported.statusCode).toBe(422);
    expect(JSON.stringify(unsupported.json())).not.toContain("openai-exact-reasoning-key");
    await app.close();

    const restarted = await buildApp({
      libraryRoot: root,
      credentialStore: memoryCredentialStore(secrets),
      providerFetch,
    });
    const restored = (await restarted.inject({
      method: "GET",
      url: "/api/v1/ai/model-profiles",
    })).json();
    expect(restored).toMatchObject([{
      id: created.json().id,
      schemaVersion: 2,
      model: "gpt-5.4",
      reasoningPreference: { mode: "effort", effort: "high" },
    }]);
    expect(JSON.stringify(restored)).not.toContain("openai-exact-reasoning-key");
    await restarted.close();
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
      url: `/api/v1/ai/model-profiles`,
      payload: {
        title: "DeepSeek 写作模型",
        provider: "deepseek",
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-v4-flash",
      },
    });
    expect(profileResponse.statusCode).toBe(201);
    const profile = profileResponse.json();
    expect(profile.credentialRef).toBeNull();
    expect(profile.capabilities.streamText).toBe(true);

    const credential = await app.inject({
      method: "POST",
      url: `/api/v1/ai/model-profiles/${profile.id}/credential`,
      payload: { secret: "deepseek-test-key" },
    });
    expect(credential.statusCode).toBe(200);
    expect(JSON.stringify(credential.json())).not.toContain("deepseek-test-key");
    expect(credential.json().credentialRef).toContain(profile.id);

    const status = await app.inject({
      method: "GET",
      url: `/api/v1/ai/model-profiles/${profile.id}/credential`,
    });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({
      credentialRef: credential.json().credentialRef,
      exists: true,
    });
    expect(JSON.stringify(status.json())).not.toContain("deepseek-test-key");

    const tested = await app.inject({
      method: "POST",
      url: `/api/v1/ai/model-profiles/${profile.id}/test`,
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
      url: `/api/v1/ai/model-profiles/${profile.id}/credential`,
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
      url: `/api/v1/ai/model-profiles`,
      payload: {
        title: "OpenAI archive target",
        provider: "openai",
        model: "gpt-test",
      },
    });
    expect(profileResponse.statusCode).toBe(201);
    const profile = profileResponse.json();

    const credential = await app.inject({
      method: "POST",
      url: `/api/v1/ai/model-profiles/${profile.id}/credential`,
      payload: { secret: "archive-test-key" },
    });
    expect(credential.statusCode).toBe(200);
    expect(secrets.size).toBe(1);

    const archived = await app.inject({
      method: "DELETE",
      url: `/api/v1/ai/model-profiles/${profile.id}`,
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
      url: `/api/v1/ai/model-profiles`,
    });
    expect(activeProfiles.statusCode).toBe(200);
    expect(activeProfiles.json()).toEqual([]);

    await app.close();
  });
});
