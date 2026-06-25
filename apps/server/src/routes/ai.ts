import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  CreateModelProfileInputSchema,
  DeleteModelProfileCredentialResultSchema,
  ModelProfileSchema,
  ModelProfileCredentialStatusSchema,
  ProviderConnectionResultSchema,
  ProviderModelDescriptorSchema,
  SaveModelProfileCredentialInputSchema,
  SaveModelProfileCredentialResultSchema,
  UpdateModelProfileInputSchema,
  UpdateSeriesCloudPolicyInputSchema,
  type AiProvider,
  type ModelCapability,
  type ModelProfile,
} from "@novel-studio/contracts";
import {
  assertSafeCredentialRef,
  CredentialStoreError,
  type CredentialStore,
  type ProviderRegistry,
} from "@novel-studio/ai";
import type { ProjectRepository } from "@novel-studio/storage";
import {
  ensureCloudAllowed,
  ensureCredentialBoundary,
  modelError,
  providerErrorStatus,
} from "../ai/policy.js";

interface AiRouteOptions {
  providerRegistry: ProviderRegistry;
  credentialStore: CredentialStore;
}

function modelCredentialRef(seriesId: string, profileId: string): string {
  return `novel-studio/model-profile/${seriesId}/${profileId}`;
}

function defaultCapabilities(registry: ProviderRegistry, provider: AiProvider, model: string): ModelCapability {
  try {
    const descriptor = registry.get(provider).describeCapabilities();
    return descriptor.models.find((item) => item.id === model)?.capabilities ?? descriptor.capabilities;
  } catch {
    return {
      streamText: false,
      structuredOutput: false,
      embeddings: false,
      tokenEstimate: false,
      modelList: false,
    };
  }
}

function defaultContextWindow(registry: ProviderRegistry, provider: AiProvider, model: string): number {
  try {
    const descriptor = registry.get(provider).describeCapabilities();
    return descriptor.models.find((item) => item.id === model)?.contextWindowTokens ?? 8192;
  } catch {
    return 8192;
  }
}

export function registerAiRoutes(
  app: FastifyInstance,
  repository: ProjectRepository,
  options: AiRouteOptions,
): void {
  const { credentialStore, providerRegistry } = options;

  app.get<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/ai/model-profiles",
    async (request) => {
      const profiles = await repository.listModelProfiles(request.params.seriesId);
      return profiles.filter((profile) => profile.archivedAt === null);
    },
  );

  app.post<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/ai/model-profiles",
    async (request, reply) => {
      const input = CreateModelProfileInputSchema.parse(request.body);
      assertSafeCredentialRef(input.credentialRef);
      const now = new Date().toISOString();
      const profileCapabilities = !Object.values(input.capabilities).some(Boolean)
        ? defaultCapabilities(providerRegistry, input.provider, input.model)
        : input.capabilities;
      const profile = ModelProfileSchema.parse({
        schemaVersion: 1,
        id: randomUUID(),
        title: input.title,
        provider: input.provider,
        baseUrl: input.baseUrl,
        model: input.model,
        cloudPolicy: input.cloudPolicy,
        credentialRef: input.credentialRef,
        defaultParameters: input.defaultParameters,
        capabilities: profileCapabilities,
        contextWindowTokens:
          input.contextWindowTokens === 8192
            ? defaultContextWindow(providerRegistry, input.provider, input.model)
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
        baseUrl: input.baseUrl ?? current.baseUrl,
        capabilities: input.capabilities ?? current.capabilities,
        defaultParameters: input.defaultParameters ?? current.defaultParameters,
        updatedAt: new Date().toISOString(),
      });
      return repository.saveModelProfile(request.params.seriesId, updated);
    },
  );

  app.delete<{ Params: { seriesId: string; profileId: string } }>(
    "/api/v1/series/:seriesId/ai/model-profiles/:profileId",
    async (request, reply) => {
      const current = await repository.getModelProfile(request.params.seriesId, request.params.profileId);
      const credentialRef = current.credentialRef;
      if (credentialRef) {
        const profiles = await repository.listModelProfiles(request.params.seriesId);
        const shared = profiles.some((profile) => profile.id !== current.id && profile.credentialRef === credentialRef);
        if (!shared) {
          try {
            await credentialStore.deleteSecret(credentialRef);
          } catch (error) {
            if (error instanceof CredentialStoreError && error.code === "credential-store-unavailable") {
              return reply.status(503).send({
                code: error.code.toUpperCase().replace(/-/gu, "_"),
                message: error.message,
              });
            }
            throw error;
          }
        }
      }

      const now = new Date().toISOString();
      return repository.saveModelProfile(request.params.seriesId, ModelProfileSchema.parse({
        ...current,
        archivedAt: current.archivedAt ?? now,
        credentialRef: null,
        updatedAt: now,
      }));
    },
  );

  app.post<{ Params: { seriesId: string; profileId: string } }>(
    "/api/v1/series/:seriesId/ai/model-profiles/:profileId/credential",
    async (request, reply) => {
      const input = SaveModelProfileCredentialInputSchema.parse(request.body);
      const current = await repository.getModelProfile(request.params.seriesId, request.params.profileId);
      const credentialRef = modelCredentialRef(request.params.seriesId, current.id);
      try {
        await credentialStore.writeSecret(credentialRef, input.secret);
      } catch (error) {
        if (error instanceof CredentialStoreError) {
          return reply.status(503).send({
            code: error.code.toUpperCase().replace(/-/gu, "_"),
            message: error.message,
          });
        }
        throw error;
      }
      const updated = await repository.saveModelProfile(request.params.seriesId, ModelProfileSchema.parse({
        ...current,
        credentialRef,
        updatedAt: new Date().toISOString(),
      }));
      return SaveModelProfileCredentialResultSchema.parse({
        credentialRef,
        storeKind: credentialStore.kind,
        modelProfile: updated,
      });
    },
  );

  app.get<{ Params: { seriesId: string; profileId: string } }>(
    "/api/v1/series/:seriesId/ai/model-profiles/:profileId/credential",
    async (request) => {
      const current = await repository.getModelProfile(request.params.seriesId, request.params.profileId);
      let exists = false;
      if (current.credentialRef) {
        try {
          await credentialStore.readSecret(current.credentialRef);
          exists = true;
        } catch {
          exists = false;
        }
      }
      return ModelProfileCredentialStatusSchema.parse({
        credentialRef: current.credentialRef,
        storeKind: credentialStore.kind,
        exists,
        modelProfile: current,
      });
    },
  );

  app.delete<{ Params: { seriesId: string; profileId: string } }>(
    "/api/v1/series/:seriesId/ai/model-profiles/:profileId/credential",
    async (request, reply) => {
      const current = await repository.getModelProfile(request.params.seriesId, request.params.profileId);
      let deleted = false;
      const credentialRef = current.credentialRef;
      if (credentialRef) {
        try {
          await credentialStore.deleteSecret(credentialRef);
          deleted = true;
        } catch (error) {
          if (error instanceof CredentialStoreError && error.code === "credential-store-unavailable") {
            return reply.status(503).send({
              code: error.code.toUpperCase().replace(/-/gu, "_"),
              message: error.message,
            });
          }
        }
      }
      const updatedAt = new Date().toISOString();
      const profiles = await repository.listModelProfiles(request.params.seriesId);
      let updated = current;
      await Promise.all(profiles
        .filter((profile) => credentialRef && profile.credentialRef === credentialRef)
        .map(async (profile) => {
          const saved = await repository.saveModelProfile(request.params.seriesId, ModelProfileSchema.parse({
            ...profile,
            credentialRef: null,
            updatedAt,
          }));
          if (saved.id === current.id) updated = saved;
        }));
      if (!credentialRef) {
        updated = await repository.saveModelProfile(request.params.seriesId, ModelProfileSchema.parse({
          ...current,
          credentialRef: null,
          updatedAt,
        }));
      }
      return DeleteModelProfileCredentialResultSchema.parse({
        deleted,
        storeKind: credentialStore.kind,
        modelProfile: updated,
      });
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
        const adapter = providerRegistry.get(profile.provider);
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
      let adapter;
      try {
        adapter = providerRegistry.get(profile.provider);
      } catch {
        const error = modelError(
          "provider-unavailable",
          "当前版本还没有启用这个 Provider。不会伪造模型列表，也不会自动回退。",
          true,
        );
        return reply.status(503).send({ code: "PROVIDER_UNAVAILABLE", message: error.message, error });
      }
      try {
        return ProviderModelDescriptorSchema.array().parse(await adapter.listModels(profile));
      } catch (caught) {
        const error = adapter.classifyError(caught);
        return reply.status(providerErrorStatus(error)).send({
          code: error.code.toUpperCase().replace(/-/gu, "_"),
          message: error.message,
          error,
        });
      }
    },
  );
}
