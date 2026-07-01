import type { FastifyInstance } from "fastify";
import {
  CreateProposalInputSchema,
  EditAndAcceptProposalInputSchema,
  MarkProposalStaleInputSchema,
  ProposalBatchAcceptInputSchema,
  ProposalBatchPreviewInputSchema,
  ProposalRevisionInputSchema,
  SupersedeProposalInputSchema,
} from "@novel-studio/contracts";
import type { ProjectRepository } from "@novel-studio/storage";

export function registerProposalRoutes(
  app: FastifyInstance,
  repository: ProjectRepository,
): void {
  app.get<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/review/proposals",
    async (request) => repository.listProposals(request.params.seriesId),
  );

  app.post<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/review/proposals",
    async (request, reply) => {
      const input = CreateProposalInputSchema.parse(request.body);
      const proposal = await repository.createProposal(request.params.seriesId, input);
      return reply.status(201).send(proposal);
    },
  );

  app.post<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/review/proposals/batch-preview",
    async (request) => {
      const input = ProposalBatchPreviewInputSchema.parse(request.body);
      return repository.previewProposalBatch(request.params.seriesId, input);
    },
  );

  app.post<{ Params: { seriesId: string } }>(
    "/api/v1/series/:seriesId/review/proposals/batch-accept",
    async (request) => {
      const input = ProposalBatchAcceptInputSchema.parse(request.body);
      return repository.acceptProposalBatch(request.params.seriesId, input);
    },
  );

  app.get<{ Params: { seriesId: string; proposalId: string } }>(
    "/api/v1/series/:seriesId/review/proposals/:proposalId",
    async (request) =>
      repository.getProposal(request.params.seriesId, request.params.proposalId),
  );

  app.post<{ Params: { seriesId: string; proposalId: string } }>(
    "/api/v1/series/:seriesId/review/proposals/:proposalId/accept",
    async (request) => {
      const input = ProposalRevisionInputSchema.parse(request.body);
      return repository.acceptProposal(
        request.params.seriesId,
        request.params.proposalId,
        input,
      );
    },
  );

  app.post<{ Params: { seriesId: string; proposalId: string } }>(
    "/api/v1/series/:seriesId/review/proposals/:proposalId/edit-and-accept",
    async (request) => {
      const input = EditAndAcceptProposalInputSchema.parse(request.body);
      return repository.editAndAcceptProposal(
        request.params.seriesId,
        request.params.proposalId,
        input,
      );
    },
  );

  app.post<{ Params: { seriesId: string; proposalId: string } }>(
    "/api/v1/series/:seriesId/review/proposals/:proposalId/reject",
    async (request) => {
      const input = ProposalRevisionInputSchema.parse(request.body);
      return repository.rejectProposal(
        request.params.seriesId,
        request.params.proposalId,
        input,
      );
    },
  );

  app.post<{ Params: { seriesId: string; proposalId: string } }>(
    "/api/v1/series/:seriesId/review/proposals/:proposalId/stale",
    async (request) => {
      const input = MarkProposalStaleInputSchema.parse(request.body);
      return repository.markProposalStale(
        request.params.seriesId,
        request.params.proposalId,
        input,
      );
    },
  );

  app.post<{ Params: { seriesId: string; proposalId: string } }>(
    "/api/v1/series/:seriesId/review/proposals/:proposalId/supersede",
    async (request) => {
      const input = SupersedeProposalInputSchema.parse(request.body);
      return repository.supersedeProposal(
        request.params.seriesId,
        request.params.proposalId,
        input,
      );
    },
  );

  app.post<{ Params: { seriesId: string; proposalId: string } }>(
    "/api/v1/series/:seriesId/review/proposals/:proposalId/archive",
    async (request) => {
      const input = ProposalRevisionInputSchema.parse(request.body);
      return repository.archiveProposal(
        request.params.seriesId,
        request.params.proposalId,
        input,
      );
    },
  );
}
