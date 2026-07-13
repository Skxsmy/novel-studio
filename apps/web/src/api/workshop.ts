import type {
  AgentRole,
  AbandonWorkshopAgentRunInput,
  ContextBundle,
  CreateWorkshopBranchInput,
  CreateWorkshopMessageProposalInput,
  ExecuteWorkshopCodexCreateEntryToolInput,
  ExecuteWorkshopCodexUpdateEntryToolInput,
  CreateWorkshopMessageInput,
  CreateWorkshopSessionInput,
  DeleteWorkshopAttachmentResult,
  DeleteWorkshopMessageResult,
  DeleteWorkshopSessionResult,
  ResendWorkshopMessageInput,
  ResendWorkshopMessageResult,
  RetryWorkshopAgentRunInput,
  RunWorkshopCallInput,
  UploadWorkshopAttachmentInput,
  UpdateWorkshopContextBasketInput,
  UpdateWorkshopSessionInput,
  WorkshopBranch,
  WorkshopAgentRunActionResult,
  WorkshopAgentRunDocument,
  WorkshopAgentRunListResult,
  WorkshopCallResult,
  WorkshopCallStreamEvent,
  WorkshopCodexCreateEntryToolError,
  WorkshopCodexCreateEntryToolResult,
  WorkshopCodexUpdateEntryToolResult,
  WorkshopCodexDraftDetailMapping,
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
  agentRuns: WorkshopAgentRunListResult;
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
    retryAgentRun(seriesId: string, sessionId: string, runId: string, input: RetryWorkshopAgentRunInput) {
      return client.requestJson<WorkshopAgentRunActionResult>(
        `/series/${seriesId}/workshop/sessions/${sessionId}/agent-runs/${runId}/retry`,
        { body: input, method: "POST" },
      );
    },
    abandonAgentRun(seriesId: string, sessionId: string, runId: string, input: AbandonWorkshopAgentRunInput) {
      return client.requestJson<WorkshopAgentRunDocument>(
        `/series/${seriesId}/workshop/sessions/${sessionId}/agent-runs/${runId}/abandon`,
        { body: input, method: "POST" },
      );
    },
    exportSession(
      seriesId: string,
      sessionId: string,
      options: { includePromptAudit?: boolean; includeReasoning?: boolean } = {},
    ) {
      const params = new URLSearchParams({
        includePromptAudit: options.includePromptAudit ? "true" : "false",
        includeReasoning: options.includeReasoning ? "true" : "false",
      });
      return client.requestJson<string>(
        `/series/${seriesId}/workshop/sessions/${sessionId}/export?${params.toString()}`,
      );
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
    resendMessage(
      seriesId: string,
      sessionId: string,
      messageId: string,
      input: ResendWorkshopMessageInput,
    ) {
      return client.requestJson<ResendWorkshopMessageResult>(
        `/series/${seriesId}/workshop/sessions/${sessionId}/messages/${messageId}/resend`,
        {
          body: input,
          method: "POST",
        },
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
    executeCodexCreateEntryTool(
      seriesId: string,
      sessionId: string,
      messageId: string,
      input: ExecuteWorkshopCodexCreateEntryToolInput,
    ) {
      return client.requestJson<WorkshopCodexCreateEntryToolResult>(
        `/series/${seriesId}/workshop/sessions/${sessionId}/messages/${messageId}/tools/codex.create_entry/execute`,
        {
          body: input,
          method: "POST",
        },
      );
    },
    executeCodexUpdateEntryTool(
      seriesId: string,
      sessionId: string,
      messageId: string,
      input: ExecuteWorkshopCodexUpdateEntryToolInput,
    ) {
      return client.requestJson<WorkshopCodexUpdateEntryToolResult>(
        `/series/${seriesId}/workshop/sessions/${sessionId}/messages/${messageId}/tools/codex.update_entry/execute`,
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
  AbandonWorkshopAgentRunInput,
  ContextBundle,
  CreateWorkshopBranchInput,
  CreateWorkshopMessageProposalInput,
  ExecuteWorkshopCodexCreateEntryToolInput,
  ExecuteWorkshopCodexUpdateEntryToolInput,
  CreateWorkshopMessageInput,
  CreateWorkshopSessionInput,
  DeleteWorkshopAttachmentResult,
  DeleteWorkshopMessageResult,
  DeleteWorkshopSessionResult,
  ResendWorkshopMessageInput,
  ResendWorkshopMessageResult,
  RetryWorkshopAgentRunInput,
  RunWorkshopCallInput,
  UploadWorkshopAttachmentInput,
  UpdateWorkshopContextBasketInput,
  UpdateWorkshopSessionInput,
  WorkshopBranch,
  WorkshopAgentRunActionResult,
  WorkshopAgentRunDocument,
  WorkshopAgentRunListResult,
  WorkshopCallResult,
  WorkshopCallStreamEvent,
  WorkshopCodexCreateEntryToolError,
  WorkshopCodexCreateEntryToolResult,
  WorkshopCodexUpdateEntryToolResult,
  WorkshopCodexDraftDetailMapping,
  WorkshopContextBasket,
  WorkshopContextPreviewInput,
  WorkshopMessageAttachment,
  WorkshopMessage,
  WorkshopMessageProposalResult,
  WorkshopMessageSource,
  WorkshopSession,
};
