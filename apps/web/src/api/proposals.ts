import type {
  EditAndAcceptProposalInput,
  ProposalApplyResult,
  ProposalBatchAcceptInput,
  ProposalBatchAcceptResult,
  ProposalBatchPreviewInput,
  ProposalBatchPreviewResult,
  ProposalDocument,
  ProposalInbox,
  ProposalRevisionInput,
} from "@novel-studio/contracts";
import type { ApiClient } from "./client";

export function createProposalApi(client: ApiClient) {
  return {
    list(seriesId: string) {
      return client.requestJson<ProposalInbox>(`/series/${seriesId}/review/proposals`);
    },
    get(seriesId: string, proposalId: string) {
      return client.requestJson<ProposalDocument>(
        `/series/${seriesId}/review/proposals/${proposalId}`,
      );
    },
    accept(seriesId: string, proposalId: string, input: ProposalRevisionInput) {
      return client.requestJson<ProposalApplyResult>(
        `/series/${seriesId}/review/proposals/${proposalId}/accept`,
        { body: input, method: "POST" },
      );
    },
    editAndAccept(
      seriesId: string,
      proposalId: string,
      input: EditAndAcceptProposalInput,
    ) {
      return client.requestJson<ProposalApplyResult>(
        `/series/${seriesId}/review/proposals/${proposalId}/edit-and-accept`,
        { body: input, method: "POST" },
      );
    },
    reject(seriesId: string, proposalId: string, input: ProposalRevisionInput) {
      return client.requestJson<ProposalDocument>(
        `/series/${seriesId}/review/proposals/${proposalId}/reject`,
        { body: input, method: "POST" },
      );
    },
    batchPreview(seriesId: string, input: ProposalBatchPreviewInput) {
      return client.requestJson<ProposalBatchPreviewResult>(
        `/series/${seriesId}/review/proposals/batch-preview`,
        { body: input, method: "POST" },
      );
    },
    batchAccept(seriesId: string, input: ProposalBatchAcceptInput) {
      return client.requestJson<ProposalBatchAcceptResult>(
        `/series/${seriesId}/review/proposals/batch-accept`,
        { body: input, method: "POST" },
      );
    },
  };
}

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
};
