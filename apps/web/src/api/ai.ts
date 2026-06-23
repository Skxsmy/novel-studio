import type { ApiClient } from "./client";
import type {
  CreateModelProfileInput,
  ModelProfile,
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
    saveModelCredential(seriesId: string, profileId: string, input: SaveModelProfileCredentialInput) {
      return client.requestJson<SaveModelProfileCredentialResult>(
        `/series/${seriesId}/ai/model-profiles/${profileId}/credential`,
        {
          body: input,
          method: "POST",
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
  ModelProfile,
  ProviderConnectionResult,
  ProviderModelDescriptor,
  SaveModelProfileCredentialInput,
  SaveModelProfileCredentialResult,
  UpdateModelProfileInput,
  UpdateSeriesCloudPolicyInput,
};
