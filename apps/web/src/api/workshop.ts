import type {
  AgentRole,
  ContextBundle,
  CreateWorkshopBranchInput,
  CreateWorkshopMessageInput,
  CreateWorkshopSessionInput,
  PromptTemplate,
  RunWorkshopCallInput,
  UpdateWorkshopContextBasketInput,
  UpdateWorkshopSessionInput,
  WorkshopBranch,
  WorkshopCallResult,
  WorkshopContextBasket,
  WorkshopContextPreviewInput,
  WorkshopMessage,
  WorkshopSession,
} from "@novel-studio/contracts";
import type { ApiClient } from "./client";

export interface WorkshopSessionDetail {
  session: WorkshopSession;
  basket: WorkshopContextBasket;
  messages: WorkshopMessage[];
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
    listMessages(seriesId: string, sessionId: string) {
      return client.requestJson<WorkshopMessage[]>(`/series/${seriesId}/workshop/sessions/${sessionId}/messages`);
    },
    createMessage(seriesId: string, sessionId: string, input: CreateWorkshopMessageInput) {
      return client.requestJson<WorkshopMessage>(`/series/${seriesId}/workshop/sessions/${sessionId}/messages`, {
        body: input,
        method: "POST",
      });
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
    runCall(seriesId: string, sessionId: string, input: RunWorkshopCallInput) {
      return client.requestJson<WorkshopCallResult>(
        `/series/${seriesId}/workshop/sessions/${sessionId}/calls`,
        {
          body: input,
          method: "POST",
        },
      );
    },
  };
}

export type {
  AgentRole,
  ContextBundle,
  CreateWorkshopBranchInput,
  CreateWorkshopMessageInput,
  CreateWorkshopSessionInput,
  PromptTemplate,
  RunWorkshopCallInput,
  UpdateWorkshopContextBasketInput,
  UpdateWorkshopSessionInput,
  WorkshopBranch,
  WorkshopCallResult,
  WorkshopContextBasket,
  WorkshopContextPreviewInput,
  WorkshopMessage,
  WorkshopSession,
};
