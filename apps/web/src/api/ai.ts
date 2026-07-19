import type { ApiClient } from "./client";
import type {
  AgentRole,
  CreateModelProfileInput,
  DeleteModelProfileCredentialResult,
  ModelProfile,
  ModelProfileCredentialStatus,
  PromptTemplate,
  ProviderConnectionResult,
  ProviderModelDescriptor,
  ProviderToolCapability,
  SaveModelProfileCredentialInput,
  SaveModelProfileCredentialResult,
  UpdateModelProfileInput,
} from "@novel-studio/contracts";

export function createAiApi(client: ApiClient) {
  return {
    listModelProfiles() {
      return client.requestJson<ModelProfile[]>("/ai/model-profiles");
    },
    listAgentRoles(seriesId: string) {
      return client.requestJson<AgentRole[]>(`/series/${seriesId}/ai/roles`);
    },
    listPromptTemplates(seriesId: string) {
      return client.requestJson<PromptTemplate[]>(`/series/${seriesId}/ai/prompts`);
    },
    createModelProfile(input: CreateModelProfileInput) {
      return client.requestJson<ModelProfile>("/ai/model-profiles", {
        body: input,
        method: "POST",
      });
    },
    updateModelProfile(profileId: string, input: UpdateModelProfileInput) {
      return client.requestJson<ModelProfile>(`/ai/model-profiles/${profileId}`, {
        body: input,
        method: "PUT",
      });
    },
    archiveModelProfile(profileId: string) {
      return client.requestJson<ModelProfile>(`/ai/model-profiles/${profileId}`, {
        method: "DELETE",
      });
    },
    saveModelCredential(profileId: string, input: SaveModelProfileCredentialInput) {
      return client.requestJson<SaveModelProfileCredentialResult>(
        `/ai/model-profiles/${profileId}/credential`,
        {
          body: input,
          method: "POST",
        },
      );
    },
    getModelCredentialStatus(profileId: string) {
      return client.requestJson<ModelProfileCredentialStatus>(
        `/ai/model-profiles/${profileId}/credential`,
      );
    },
    deleteModelCredential(profileId: string) {
      return client.requestJson<DeleteModelProfileCredentialResult>(
        `/ai/model-profiles/${profileId}/credential`,
        {
          method: "DELETE",
        },
      );
    },
    testModelProfile(profileId: string) {
      return client.requestJson<ProviderConnectionResult>(`/ai/model-profiles/${profileId}/test`, {
        method: "POST",
      });
    },
    listProviderModels(profileId: string) {
      return client.requestJson<ProviderModelDescriptor[]>(`/ai/model-profiles/${profileId}/models`);
    },
    getToolCapability(profileId: string) {
      return client.requestJson<ProviderToolCapability>(`/ai/model-profiles/${profileId}/tool-capability`);
    },
  };
}

export type {
  AgentRole,
  CreateModelProfileInput,
  DeleteModelProfileCredentialResult,
  ModelProfile,
  ModelProfileCredentialStatus,
  PromptTemplate,
  ProviderConnectionResult,
  ProviderModelDescriptor,
  ProviderToolCapability,
  SaveModelProfileCredentialInput,
  SaveModelProfileCredentialResult,
  UpdateModelProfileInput,
};
