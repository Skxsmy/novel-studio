import type { ApiClient } from "./client";
import type {
  CreateModelProfileInput,
  DeleteModelProfileCredentialResult,
  ModelProfile,
  ModelProfileCredentialStatus,
  ProviderConnectionResult,
  ProviderModelDescriptor,
  SaveModelProfileCredentialInput,
  SaveModelProfileCredentialResult,
  SeriesManifest,
  UpdateModelProfileInput,
  UpdateSeriesCloudPolicyInput,
} from "@novel-studio/contracts";

export function createAiApi(client: ApiClient) {
  return {
    listModelProfiles(seriesId: string) {
      return client.requestJson<ModelProfile[]>(`/series/${seriesId}/ai/model-profiles`);
    },
    createModelProfile(seriesId: string, input: CreateModelProfileInput) {
      return client.requestJson<ModelProfile>(`/series/${seriesId}/ai/model-profiles`, {
        body: input,
        method: "POST",
      });
    },
    updateModelProfile(seriesId: string, profileId: string, input: UpdateModelProfileInput) {
      return client.requestJson<ModelProfile>(`/series/${seriesId}/ai/model-profiles/${profileId}`, {
        body: input,
        method: "PUT",
      });
    },
    archiveModelProfile(seriesId: string, profileId: string) {
      return client.requestJson<ModelProfile>(`/series/${seriesId}/ai/model-profiles/${profileId}`, {
        method: "DELETE",
      });
    },
    saveModelCredential(seriesId: string, profileId: string, input: SaveModelProfileCredentialInput) {
      return client.requestJson<SaveModelProfileCredentialResult>(
        `/series/${seriesId}/ai/model-profiles/${profileId}/credential`,
        {
          body: input,
          method: "POST",
        },
      );
    },
    getModelCredentialStatus(seriesId: string, profileId: string) {
      return client.requestJson<ModelProfileCredentialStatus>(
        `/series/${seriesId}/ai/model-profiles/${profileId}/credential`,
      );
    },
    deleteModelCredential(seriesId: string, profileId: string) {
      return client.requestJson<DeleteModelProfileCredentialResult>(
        `/series/${seriesId}/ai/model-profiles/${profileId}/credential`,
        {
          method: "DELETE",
        },
      );
    },
    testModelProfile(seriesId: string, profileId: string) {
      return client.requestJson<ProviderConnectionResult>(`/series/${seriesId}/ai/model-profiles/${profileId}/test`, {
        method: "POST",
      });
    },
    listProviderModels(seriesId: string, profileId: string) {
      return client.requestJson<ProviderModelDescriptor[]>(`/series/${seriesId}/ai/model-profiles/${profileId}/models`);
    },
    updateCloudPolicy(seriesId: string, input: UpdateSeriesCloudPolicyInput) {
      return client.requestJson<SeriesManifest>(`/series/${seriesId}/ai/cloud-policy`, {
        body: input,
        method: "PUT",
      });
    },
  };
}

export type {
  CreateModelProfileInput,
  DeleteModelProfileCredentialResult,
  ModelProfile,
  ModelProfileCredentialStatus,
  ProviderConnectionResult,
  ProviderModelDescriptor,
  SaveModelProfileCredentialInput,
  SaveModelProfileCredentialResult,
  UpdateModelProfileInput,
  UpdateSeriesCloudPolicyInput,
};
