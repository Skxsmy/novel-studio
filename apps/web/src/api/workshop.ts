import type {
  AgentRole,
  ContextBundle,
  CreateWorkshopBranchInput,
  CreateWorkshopMessageProposalInput,
  CreateWorkshopMessageInput,
  CreateWorkshopSessionInput,
  DeleteWorkshopAttachmentResult,
  DeleteWorkshopMessageResult,
  DeleteWorkshopSessionResult,
  PromptTemplate,
  RunWorkshopCallInput,
  UploadWorkshopAttachmentInput,
  UpdateWorkshopContextBasketInput,
  UpdateWorkshopSessionInput,
  WorkshopBranch,
  WorkshopCallResult,
  WorkshopCallStreamEvent,
  WorkshopContextBasket,
  WorkshopContextPreviewInput,
  WorkshopMessageAttachment,
  WorkshopMessage,
  WorkshopMessageProposalResult,
  WorkshopMessageSource,
  WorkshopSession,
} from "@novel-studio/contracts";
import type { ApiClient } from "./client";

export interface WorkshopSessionDetail {
  session: WorkshopSession;
  basket: WorkshopContextBasket;
  messages: WorkshopMessage[];
  attachments: WorkshopMessageAttachment[];
}

export interface WorkshopBranchResult {
  branch: WorkshopBranch;
  session: WorkshopSession;
}

export function createWorkshopApi(client: ApiClient) {
  return {
    listSessions(seriesId: string) {
      return client.requestJson<WorkshopSession[]>(`/series/${seriesId}/workshop/sessions`);
    },
    createSession(seriesId: string, input: CreateWorkshopSessionInput) {
      return client.requestJson<WorkshopSession>(`/series/${seriesId}/workshop/sessions`, {
        body: input,
        method: "POST",
      });
    },
    getSession(seriesId: string, sessionId: string) {
      return client.requestJson<WorkshopSessionDetail>(`/series/${seriesId}/workshop/sessions/${sessionId}`);
    },
    updateSession(seriesId: string, sessionId: string, input: UpdateWorkshopSessionInput) {
      return client.requestJson<WorkshopSession>(`/series/${seriesId}/workshop/sessions/${sessionId}`, {
        body: input,
        method: "PUT",
      });
    },
    archiveSession(seriesId: string, sessionId: string) {
      return client.requestJson<WorkshopSession>(`/series/${seriesId}/workshop/sessions/${sessionId}/archive`, {
        method: "POST",
      });
    },
    restoreSession(seriesId: string, sessionId: string) {
      return client.requestJson<WorkshopSession>(`/series/${seriesId}/workshop/sessions/${sessionId}/restore`, {
        method: "POST",
      });
    },
    deleteSession(seriesId: string, sessionId: string) {
      return client.requestJson<DeleteWorkshopSessionResult>(
        `/series/${seriesId}/workshop/sessions/${sessionId}`,
        { method: "DELETE" },
      );
    },
    listMessages(seriesId: string, sessionId: string) {
      return client.requestJson<WorkshopMessage[]>(`/series/${seriesId}/workshop/sessions/${sessionId}/messages`);
    },
    listAttachments(seriesId: string, sessionId: string, draftToken?: string) {
      const query = draftToken ? `?draftToken=${encodeURIComponent(draftToken)}` : "";
      return client.requestJson<WorkshopMessageAttachment[]>(
        `/series/${seriesId}/workshop/sessions/${sessionId}/attachments${query}`,
      );
    },
    uploadAttachment(seriesId: string, sessionId: string, input: UploadWorkshopAttachmentInput) {
      return client.requestJson<WorkshopMessageAttachment>(
        `/series/${seriesId}/workshop/sessions/${sessionId}/attachments`,
        {
          body: input,
          method: "POST",
        },
      );
    },
    deleteAttachment(seriesId: string, sessionId: string, attachmentId: string) {
      return client.requestJson<DeleteWorkshopAttachmentResult>(
        `/series/${seriesId}/workshop/sessions/${sessionId}/attachments/${attachmentId}`,
        { method: "DELETE" },
      );
    },
    getMessageSource(seriesId: string, messageId: string) {
      return client.requestJson<WorkshopMessageSource>(`/series/${seriesId}/workshop/messages/${messageId}/source`);
    },
    createMessage(seriesId: string, sessionId: string, input: CreateWorkshopMessageInput) {
      return client.requestJson<WorkshopMessage>(`/series/${seriesId}/workshop/sessions/${sessionId}/messages`, {
        body: input,
        method: "POST",
      });
    },
    deleteMessage(seriesId: string, sessionId: string, messageId: string) {
      return client.requestJson<DeleteWorkshopMessageResult>(
        `/series/${seriesId}/workshop/sessions/${sessionId}/messages/${messageId}`,
        { method: "DELETE" },
      );
    },
    createMessageProposal(
      seriesId: string,
      sessionId: string,
      messageId: string,
      input: CreateWorkshopMessageProposalInput,
    ) {
      return client.requestJson<WorkshopMessageProposalResult>(
        `/series/${seriesId}/workshop/sessions/${sessionId}/messages/${messageId}/proposals`,
        {
          body: input,
          method: "POST",
        },
      );
    },
    branchSession(seriesId: string, sessionId: string, input: CreateWorkshopBranchInput) {
      return client.requestJson<WorkshopBranchResult>(`/series/${seriesId}/workshop/sessions/${sessionId}/branch`, {
        body: input,
        method: "POST",
      });
    },
    getContextBasket(seriesId: string, sessionId: string) {
      return client.requestJson<WorkshopContextBasket>(
        `/series/${seriesId}/workshop/sessions/${sessionId}/context-basket`,
      );
    },
    updateContextBasket(seriesId: string, sessionId: string, input: UpdateWorkshopContextBasketInput) {
      return client.requestJson<WorkshopContextBasket>(
        `/series/${seriesId}/workshop/sessions/${sessionId}/context-basket`,
        {
          body: input,
          method: "PUT",
        },
      );
    },
    previewContext(seriesId: string, sessionId: string, input: WorkshopContextPreviewInput) {
      return client.requestJson<ContextBundle>(
        `/series/${seriesId}/workshop/sessions/${sessionId}/context-preview`,
        {
          body: input,
          method: "POST",
        },
      );
    },
    runCall(seriesId: string, sessionId: string, input: RunWorkshopCallInput, signal?: AbortSignal) {
      const options = {
        body: input,
        method: "POST",
      };
      return client.requestJson<WorkshopCallResult>(
        `/series/${seriesId}/workshop/sessions/${sessionId}/calls`,
        signal ? { ...options, signal } : options,
      );
    },
    runCallStream(
      seriesId: string,
      sessionId: string,
      input: RunWorkshopCallInput,
      onEvent: (event: WorkshopCallStreamEvent) => void,
      signal?: AbortSignal,
    ) {
      const options = {
        body: input,
        method: "POST",
        onEvent: (event: unknown) => onEvent(event as WorkshopCallStreamEvent),
      };
      return client.requestEventStream(
        `/series/${seriesId}/workshop/sessions/${sessionId}/calls/stream`,
        signal ? { ...options, signal } : options,
      );
    },
  };
}

export type {
  AgentRole,
  ContextBundle,
  CreateWorkshopBranchInput,
  CreateWorkshopMessageProposalInput,
  CreateWorkshopMessageInput,
  CreateWorkshopSessionInput,
  DeleteWorkshopAttachmentResult,
  DeleteWorkshopMessageResult,
  DeleteWorkshopSessionResult,
  PromptTemplate,
  RunWorkshopCallInput,
  UploadWorkshopAttachmentInput,
  UpdateWorkshopContextBasketInput,
  UpdateWorkshopSessionInput,
  WorkshopBranch,
  WorkshopCallResult,
  WorkshopCallStreamEvent,
  WorkshopContextBasket,
  WorkshopContextPreviewInput,
  WorkshopMessageAttachment,
  WorkshopMessage,
  WorkshopMessageProposalResult,
  WorkshopMessageSource,
  WorkshopSession,
};
