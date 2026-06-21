import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  CreateModelProfileInputSchema,
  ModelProfileSchema,
  ProviderConnectionResultSchema,
  ProviderModelDescriptorSchema,
  UpdateModelProfileInputSchema,
  UpdateSeriesCloudPolicyInputSchema,
  type AiProvider,
  type ModelCapability,
  type ModelProfile,
} from "@novel-studio/contracts";
import { assertSafeCredentialRef, createDefaultProviderRegistry } from "@novel-studio/ai";
import type { ProjectRepository } from "@novel-studio/storage";
import {
  ensureCloudAllowed,
  ensureCredentialBoundary,
  modelError,
  providerErrorStatus,
} from "../ai/policy.js";

const registry = createDefaultProviderRegistry();

function defaultCapabilities(provider: AiProvider, model: string): ModelCapability {
  if (provider !== "mock") {
    return {
      streamText: false,
      structuredOutput: false,
      embeddings: false,
      tokenEstimate: false,
      modelList: false,
    };
  }
  const descriptor = registry.get("mock").describeCapabilities();
  return descriptor.models.find((item) => item.id === model)?.capabilities ?? descriptor.capabilities;
}

function defaultContextWindow(provider: AiProvider, model: string): number {
  if (provider !== "mock") return 8192;
  const descriptor = registry.get("mock").describeCapabilities();
  return descriptor.models.find((item) => item.id === model)?.contextWindowTokens ?? 32000;
}

export function registerAiRoutes(app: FastifyInstance, repository: ProjectRepository): void {
  app.get<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/ai/model-profiles",
    async (request) => repository.listModelProfiles(request.params.seriesId),
  );

  app.post<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/ai/model-profiles",
    async (request, reply) => {
      const input = CreateModelProfileInputSchema.parse(request.body);
      assertSafeCredentialRef(input.credentialRef);
      const now = new Date().toISOString();
      const profileCapabilities = input.provider === "mock" && !Object.values(input.capabilities).some(Boolean)
        ? defaultCapabilities(input.provider, input.model)
        : input.capabilities;
      const profile = ModelProfileSchema.parse({
        schemaVersion: 1,
        id: randomUUID(),
        title: input.title,
        provider: input.provider,
        model: input.model,
        cloudPolicy: input.cloudPolicy,
        credentialRef: input.credentialRef,
        defaultParameters: input.defaultParameters,
        capabilities: profileCapabilities,
        contextWindowTokens:
          input.provider === "mock" && input.contextWindowTokens === 8192
            ? defaultContextWindow(input.provider, input.model)
            : input.contextWindowTokens,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      });
      return reply.status(201).send(await repository.saveModelProfile(request.params.seriesId, profile));
    },
  );

  app.put<{ Params: { seriesId: string; profileId: string } }>(
    "/api/v1/series/:seriesId/ai/model-profiles/:profileId",
    async (request) => {
      const input = UpdateModelProfileInputSchema.parse(request.body);
      assertSafeCredentialRef(input.credentialRef);
      const current = await repository.getModelProfile(request.params.seriesId, request.params.profileId);
      const updated = ModelProfileSchema.parse({
        ...current,
        ...input,
        capabilities: input.capabilities ?? current.capabilities,
        defaultParameters: input.defaultParameters ?? current.defaultParameters,
        updatedAt: new Date().toISOString(),
      });
      return repository.saveModelProfile(request.params.seriesId, updated);
    },
  );

  app.put<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/ai/cloud-policy",
    async (request) => {
      const input = UpdateSeriesCloudPolicyInputSchema.parse(request.body);
      return repository.updateSeriesCloudPolicy(request.params.seriesId, input);
    },
  );

  app.post<{ Params: { seriesId: string; profileId: string } }>(
    "/api/v1/series/:seriesId/ai/model-profiles/:profileId/test",
    async (request, reply) => {
      const [series, profile] = await Promise.all([
        repository.getSeries(request.params.seriesId),
        repository.getModelProfile(request.params.seriesId, request.params.profileId),
      ]);
      const blocked = ensureCloudAllowed(series.manifest, profile) ?? ensureCredentialBoundary(profile);
      if (blocked) {
        return reply.status(providerErrorStatus(blocked)).send({
          code: blocked.code.toUpperCase().replace(/-/gu, "_"),
          message: blocked.message,
          error: blocked,
        });
      }
      try {
        const adapter = registry.get(profile.provider);
        const result = ProviderConnectionResultSchema.parse(await adapter.testConnection(profile));
        if (!result.ok && result.error) {
          return reply.status(providerErrorStatus(result.error)).send(result);
        }
        return result;
      } catch {
        const error = modelError(
          "provider-unavailable",
          "当前版本还没有启用这个 Provider。不会自动回退到其他模型。",
          true,
        );
        return reply.status(503).send(ProviderConnectionResultSchema.parse({
          ok: false,
          provider: profile.provider,
          modelProfileId: profile.id,
          capabilities: profile.capabilities,
          models: [],
          error,
        }));
      }
    },
  );

  app.get<{ Params: { seriesId: string; profileId: string } }>(
    "/api/v1/series/:seriesId/ai/model-profiles/:profileId/models",
    async (request, reply) => {
      const [series, profile] = await Promise.all([
        repository.getSeries(request.params.seriesId),
        repository.getModelProfile(request.params.seriesId, request.params.profileId),
      ]);
      const blocked = ensureCloudAllowed(series.manifest, profile) ?? ensureCredentialBoundary(profile);
      if (blocked) {
        return reply.status(providerErrorStatus(blocked)).send({
          code: blocked.code.toUpperCase().replace(/-/gu, "_"),
          message: blocked.message,
          error: blocked,
        });
      }
      try {
        const adapter = registry.get(profile.provider);
        return ProviderModelDescriptorSchema.array().parse(await adapter.listModels(profile));
      } catch {
        const error = modelError(
          "provider-unavailable",
          "当前版本还没有启用这个 Provider。不会伪造模型列表，也不会自动回退。",
          true,
        );
        return reply.status(503).send({ code: "PROVIDER_UNAVAILABLE", message: error.message, error });
      }
    },
  );
}
