import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  CreateModelProfileInputSchema,
  DeleteEmbeddingUseCaseBindingResultSchema,
  EmbeddingUseCaseBindingDocumentSchema,
  EmbeddingUseCaseIdSchema,
  DeleteModelProfileCredentialResultSchema,
  ModelProfileSchema,
  ModelProfileCredentialStatusSchema,
  normalizeReasoningConfigurationForModel,
  ProviderConnectionResultSchema,
  ProviderModelDescriptorSchema,
  SaveModelProfileCredentialInputSchema,
  SaveModelProfileCredentialResultSchema,
  SetEmbeddingUseCaseBindingInputSchema,
  UpdateModelProfileInputSchema,
  type AiProvider,
  type ModelCapability,
  type ModelProfile,
  type ReasoningConfiguration,
} from "@novel-studio/contracts";
import {
  CredentialStoreError,
  type EmbeddingRouter,
  type CredentialStore,
  type ProviderRegistry,
} from "@novel-studio/ai";
import { StorageError, type ProjectRepository } from "@novel-studio/storage";
import {
  ensureCredentialBoundary,
  modelError,
  providerErrorStatus,
} from "../ai/policy.js";

interface AiRouteOptions {
  providerRegistry: ProviderRegistry;
  credentialStore: CredentialStore;
  embeddingRouter: EmbeddingRouter;
}

function modelCredentialRef(profileId: string): string {
  return `novel-studio/model-profile/${profileId}`;
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

async function validateExactModelReasoningPreference(
  registry: ProviderRegistry,
  profile: ModelProfile,
  preference: ReasoningConfiguration | null,
): Promise<void> {
  ensureCredentialBoundary(profile);
  if (!profile.credentialRef && profile.provider !== "mock" && profile.provider !== "ollama") {
    throw new StorageError("The exact model reasoning preference cannot be verified without its Provider credential", "INVALID_DATA", {
      provider: profile.provider,
      model: profile.model,
      cause: "Provider credential is not configured",
    });
  }
  let adapter;
  try {
    adapter = registry.get(profile.provider);
  } catch {
    throw new StorageError("The selected Provider is not available", "INVALID_DATA", {
      provider: profile.provider,
      model: profile.model,
    });
  }
  let descriptor = adapter.describeCapabilities().models.find((model) => model.id === profile.model);
  if (!descriptor) {
    try {
      descriptor = (await adapter.listModels(profile)).find((model) => model.id === profile.model);
    } catch (error) {
      throw new StorageError("The exact model descriptor could not be verified", "INVALID_DATA", {
        provider: profile.provider,
        model: profile.model,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }
  if (!descriptor) {
    throw new StorageError("The exact model descriptor does not exist", "INVALID_DATA", {
      provider: profile.provider,
      model: profile.model,
    });
  }
  try {
    normalizeReasoningConfigurationForModel(descriptor.reasoning, preference);
  } catch (error) {
    throw new StorageError("The reasoning preference is not supported by the exact model", "INVALID_DATA", {
      provider: profile.provider,
      model: profile.model,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

export function registerAiRoutes(
  app: FastifyInstance,
  repository: ProjectRepository,
  options: AiRouteOptions,
): void {
  const { credentialStore, embeddingRouter, providerRegistry } = options;

  app.get(
    "/api/v1/ai/embedding-bindings",
    async () => repository.listEmbeddingUseCaseBindings(),
  );

  app.put<{ Params: { useCase: string } }>(
    "/api/v1/ai/embedding-bindings/:useCase",
    async (request) => {
      const useCase = EmbeddingUseCaseIdSchema.parse(request.params.useCase);
      const input = SetEmbeddingUseCaseBindingInputSchema.parse(request.body);
      const binding = await repository.saveEmbeddingUseCaseBinding(EmbeddingUseCaseBindingDocumentSchema.parse({
        schemaVersion: 1,
        useCase,
        profileId: input.profileId,
        updatedAt: new Date().toISOString(),
      }));
      embeddingRouter.bindUseCase(binding.useCase, binding.profileId);
      return binding;
    },
  );

  app.delete<{ Params: { useCase: string } }>(
    "/api/v1/ai/embedding-bindings/:useCase",
    async (request) => {
      const useCase = EmbeddingUseCaseIdSchema.parse(request.params.useCase);
      const deleted = await repository.deleteEmbeddingUseCaseBinding(useCase);
      embeddingRouter.unbindUseCase(useCase);
      return DeleteEmbeddingUseCaseBindingResultSchema.parse({
        useCase,
        deleted,
      });
    },
  );

  app.get(
    "/api/v1/ai/model-profiles",
    async () => {
      const profiles = await repository.listModelProfiles();
      return profiles.filter((profile) => profile.archivedAt === null);
    },
  );

  app.post(
    "/api/v1/ai/model-profiles",
    async (request, reply) => {
      const input = CreateModelProfileInputSchema.parse(request.body);
      const now = new Date().toISOString();
      const profileCapabilities = !Object.values(input.capabilities).some(Boolean)
        ? defaultCapabilities(providerRegistry, input.provider, input.model)
        : input.capabilities;
      const profile = ModelProfileSchema.parse({
        schemaVersion: 2,
        id: randomUUID(),
        title: input.title,
        provider: input.provider,
        baseUrl: input.baseUrl,
        model: input.model,
        credentialRef: null,
        defaultParameters: input.defaultParameters,
        reasoningPreference: input.reasoningPreference,
        capabilities: profileCapabilities,
        contextWindowTokens:
          input.contextWindowTokens === 8192
            ? defaultContextWindow(providerRegistry, input.provider, input.model)
            : input.contextWindowTokens,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      });
      if (profile.reasoningPreference !== null) {
        await validateExactModelReasoningPreference(providerRegistry, profile, profile.reasoningPreference);
      }
      return reply.status(201).send(await repository.saveModelProfile(profile));
    },
  );

  app.put<{ Params: { profileId: string } }>(
    "/api/v1/ai/model-profiles/:profileId",
    async (request) => {
      const input = UpdateModelProfileInputSchema.parse(request.body);
      const current = await repository.getModelProfile(request.params.profileId);
      const modelIdentityChanged =
        (input.provider !== undefined && input.provider !== current.provider) ||
        (input.model !== undefined && input.model !== current.model);
      const reasoningPreference = Object.prototype.hasOwnProperty.call(input, "reasoningPreference")
        ? input.reasoningPreference ?? null
        : modelIdentityChanged
          ? null
          : current.reasoningPreference;
      const updated = ModelProfileSchema.parse({
        ...current,
        ...input,
        baseUrl: input.baseUrl ?? current.baseUrl,
        capabilities: input.capabilities ?? current.capabilities,
        credentialRef: current.credentialRef,
        defaultParameters: input.defaultParameters ?? current.defaultParameters,
        reasoningPreference,
        updatedAt: new Date().toISOString(),
      });
      if (
        updated.reasoningPreference !== null && (
          Object.prototype.hasOwnProperty.call(input, "reasoningPreference") ||
          modelIdentityChanged ||
          Object.prototype.hasOwnProperty.call(input, "baseUrl")
        )
      ) {
        await validateExactModelReasoningPreference(
          providerRegistry,
          updated,
          updated.reasoningPreference,
        );
      }
      return repository.saveModelProfile(updated);
    },
  );

  app.delete<{ Params: { profileId: string } }>(
    "/api/v1/ai/model-profiles/:profileId",
    async (request, reply) => {
      const current = await repository.getModelProfile(request.params.profileId);
      const credentialRef = current.credentialRef;
      if (credentialRef) {
        const profiles = await repository.listModelProfiles();
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
      return repository.saveModelProfile(ModelProfileSchema.parse({
        ...current,
        archivedAt: current.archivedAt ?? now,
        credentialRef: null,
        updatedAt: now,
      }));
    },
  );

  app.post<{ Params: { profileId: string } }>(
    "/api/v1/ai/model-profiles/:profileId/credential",
    async (request, reply) => {
      const input = SaveModelProfileCredentialInputSchema.parse(request.body);
      const current = await repository.getModelProfile(request.params.profileId);
      const credentialRef = modelCredentialRef(current.id);
      try {
        await credentialStore.writeSecret(credentialRef, input.secret);
        const storedSecret = await credentialStore.readSecret(credentialRef);
        if (storedSecret !== input.secret) {
          try {
            await credentialStore.deleteSecret(credentialRef);
          } catch {
            // Best-effort cleanup after a failed verification.
          }
          return reply.status(503).send({
            code: "CREDENTIAL_WRITE_FAILED",
            message: "Credential store verification failed after saving the service key.",
          });
        }
      } catch (error) {
        if (error instanceof CredentialStoreError) {
          return reply.status(503).send({
            code: error.code.toUpperCase().replace(/-/gu, "_"),
            message: error.message,
          });
        }
        throw error;
      }
      const updated = await repository.saveModelProfile(ModelProfileSchema.parse({
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

  app.get<{ Params: { profileId: string } }>(
    "/api/v1/ai/model-profiles/:profileId/credential",
    async (request) => {
      const current = await repository.getModelProfile(request.params.profileId);
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

  app.delete<{ Params: { profileId: string } }>(
    "/api/v1/ai/model-profiles/:profileId/credential",
    async (request, reply) => {
      const current = await repository.getModelProfile(request.params.profileId);
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
      const profiles = await repository.listModelProfiles();
      let updated = current;
      await Promise.all(profiles
        .filter((profile) => credentialRef && profile.credentialRef === credentialRef)
        .map(async (profile) => {
          const saved = await repository.saveModelProfile(ModelProfileSchema.parse({
            ...profile,
            credentialRef: null,
            updatedAt,
          }));
          if (saved.id === current.id) updated = saved;
        }));
      if (!credentialRef) {
        updated = await repository.saveModelProfile(ModelProfileSchema.parse({
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

  app.post<{ Params: { profileId: string } }>(
    "/api/v1/ai/model-profiles/:profileId/test",
    async (request, reply) => {
      const profile = await repository.getModelProfile(request.params.profileId);
      const blocked = ensureCredentialBoundary(profile);
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

  app.get<{ Params: { profileId: string } }>(
    "/api/v1/ai/model-profiles/:profileId/models",
    async (request, reply) => {
      const profile = await repository.getModelProfile(request.params.profileId);
      const blocked = ensureCredentialBoundary(profile);
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
