export { ApiError, createApiClient } from "./client";
export type { ApiClient, ApiClientOptions, RequestJsonOptions } from "./client";
export { createAiApi } from "./ai";
export { createCodexApi } from "./codex";
export { createProposalApi } from "./proposals";
export { createSeriesApi } from "./series";
export { createWorkshopApi } from "./workshop";
export type {
  AgentRole,
  CreateModelProfileInput,
  ModelProfile,
  PromptTemplate,
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
  UpdateCodexDetailTypeInput,
  UpdateCodexEntryInput,
} from "./codex";
export type {
  EditAndAcceptProposalInput,
  ProposalApplyResult,
  ProposalBatchAcceptInput,
  ProposalBatchAcceptResult,
  ProposalBatchPreviewInput,
  ProposalBatchPreviewResult,
  ProposalDocument,
  ProposalInbox,
  ProposalRevisionInput,
} from "./proposals";
export type { CreateSeriesInput, SeriesSummary } from "./series";
export type {
  ContextBundle,
  CreateWorkshopBranchInput,
  CreateWorkshopMessageInput,
  CreateWorkshopSessionInput,
  RunWorkshopCallInput,
  UpdateWorkshopContextBasketInput,
  UpdateWorkshopSessionInput,
  WorkshopBranch,
  WorkshopCallResult,
  WorkshopContextBasket,
  WorkshopContextPreviewInput,
  WorkshopMessage,
  WorkshopSession,
  WorkshopSessionDetail,
} from "./workshop";

import { createApiClient } from "./client";
import { createAiApi } from "./ai";
import { createCodexApi } from "./codex";
import { createProposalApi } from "./proposals";
import { createSeriesApi } from "./series";
import { createWorkshopApi } from "./workshop";

const apiClient = createApiClient();

export const api = {
  ai: createAiApi(apiClient),
  codex: createCodexApi(apiClient),
  proposals: createProposalApi(apiClient),
  series: createSeriesApi(apiClient),
  workshop: createWorkshopApi(apiClient),
};
