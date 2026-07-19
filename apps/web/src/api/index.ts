export { ApiError, createApiClient } from "./client";
export type { ApiClient, ApiClientOptions, RequestEventStreamOptions, RequestJsonOptions } from "./client";
export { createAiApi } from "./ai";
export { createCodexApi } from "./codex";
export { createProposalApi } from "./proposals";
export { createResearchApi } from "./research";
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
  MarkProposalStaleInput,
  ProposalApplyResult,
  ProposalBatchAcceptInput,
  ProposalBatchAcceptResult,
  ProposalBatchPreviewInput,
  ProposalBatchPreviewResult,
  ProposalDocument,
  ProposalInbox,
  ProposalRevisionInput,
} from "./proposals";
export type {
  ImportResearchSourceInput,
  ResearchSourceDetail,
  ResearchSourceDocument,
  UpdateResearchSourceInput,
} from "./research";
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
  WorkshopCallStreamEvent,
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
import { createResearchApi } from "./research";
import { createSeriesApi } from "./series";
import { createWorkshopApi } from "./workshop";

const apiClient = createApiClient();

export const api = {
  ai: createAiApi(apiClient),
  codex: createCodexApi(apiClient),
  proposals: createProposalApi(apiClient),
  research: createResearchApi(apiClient),
  series: createSeriesApi(apiClient),
  workshop: createWorkshopApi(apiClient),
};
