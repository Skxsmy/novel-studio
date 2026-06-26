export { ApiError, createApiClient } from "./client";
export type { ApiClient, ApiClientOptions, RequestJsonOptions } from "./client";
export { createAiApi } from "./ai";
export { createCodexApi } from "./codex";
export { createSeriesApi } from "./series";
export type {
  CreateModelProfileInput,
  ModelProfile,
  ProviderConnectionResult,
  ProviderModelDescriptor,
  SaveModelProfileCredentialInput,
  SaveModelProfileCredentialResult,
  UpdateModelProfileInput,
  UpdateSeriesCloudPolicyInput,
} from "./ai";
export type {
  ArchiveCodexDocumentInput,
  CodexEntryDocument,
  CodexContextPreview,
  CodexDetailTypeDocument,
  CodexMention,
  CodexRelationDocument,
  CreateCodexCategoryInput,
  CreateCodexDetailTypeInput,
  CreateCodexEntryInput,
  CreateCodexRelationInput,
  DeleteCodexCategoryResult,
  DeleteCodexDocumentInput,
  DeleteCodexDetailTypeResult,
  DeleteCodexEntryResult,
  SceneCodexMentions,
  UpdateCodexCategoryInput,
  UpdateCodexEntryInput,
} from "./codex";
export type { CreateSeriesInput, SeriesSummary } from "./series";

import { createApiClient } from "./client";
import { createAiApi } from "./ai";
import { createCodexApi } from "./codex";
import { createSeriesApi } from "./series";

const apiClient = createApiClient();

export const api = {
  ai: createAiApi(apiClient),
  codex: createCodexApi(apiClient),
  series: createSeriesApi(apiClient),
};
