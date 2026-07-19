// @vitest-environment jsdom

import type { ProposalDocument, SeriesDetail } from "@novel-studio/contracts";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import { ReviewWorkspace } from "./ReviewWorkspace";

const seriesId = "11111111-1111-4111-8111-111111111111";
const proposalId = "22222222-2222-4222-8222-222222222222";
const noteId = "33333333-3333-4333-8333-333333333333";
const entryId = "44444444-4444-4444-8444-444444444444";
const patchId = "55555555-5555-4555-8555-555555555555";
const databaseId = "66666666-6666-4666-8666-666666666666";
const sourceId = "77777777-7777-4777-8777-777777777777";
const evidenceId = "88888888-8888-4888-8888-888888888888";
const blockId = "99999999-9999-4999-8999-999999999999";
const chunkId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const revision = "a".repeat(64);

function promotion(): ProposalDocument {
  const target = {
    kind: "codex-entry" as const,
    targetId: entryId,
    label: "Bell Harbor",
    baseRevision: revision,
    fieldPath: ["description"],
    blockId: null,
    range: null,
  };
  return {
    proposal: {
      schemaVersion: 2,
      id: proposalId,
      seriesId,
      type: "codex-update",
      title: "Move Market bell to Bell Harbor",
      summary: "World rule from Research Note. Review is required before Codex changes.",
      status: "pending",
      source: { kind: "research-note", sourceId: noteId, label: "Market bell", detail: "Research Database" },
      target,
      contextBundleId: null,
      generator: { kind: "manual", actor: "user" },
      riskLevel: "high",
      confidence: null,
      reason: "World rule",
      staleReason: "",
      supersededBy: null,
      originalCandidate: null,
      decision: null,
      patches: [{
        id: patchId,
        target,
        action: "update-codex-entry",
        before: "A working port.",
        after: "A working port.\n\nThe market opens only after the bell rings.",
        unifiedDiff: "",
      }],
      evidence: [{
        sourceType: "research-note",
        sourceId: noteId,
        revision,
        quote: "The bell opened the harbor market by local custom.",
        note: "Harbor archive (text)",
      }],
      researchNotePromotion: {
        schemaVersion: 1,
        meaning: "world-rule",
        researchDatabaseId: databaseId,
        noteId,
        noteRevision: revision,
        evidence: [{
          id: evidenceId,
          researchDatabaseId: databaseId,
          sourceId,
          sourceRevision: revision,
          sourceContentHash: revision,
          sourceKind: "txt",
          blockId,
          chunkId,
          chunkHash: revision,
          quoteHash: revision,
          languageTag: "en",
          location: {
            kind: "text",
            startLine: 1,
            endLine: 1,
            startOffset: 0,
            endOffset: 56,
          },
        }],
        target: { kind: "existing", entryId },
      },
      createdAt: "2026-07-20T00:00:00.000Z",
      updatedAt: "2026-07-20T00:00:00.000Z",
    },
    revision,
    sourceAvailability: { available: true, reason: "" },
    targetAvailability: { available: true, reason: "" },
  };
}

function acceptedPromotion(): ProposalDocument {
  const item = promotion();
  return {
    ...item,
    proposal: {
      ...item.proposal,
      status: "accepted",
      decision: {
        kind: "accepted",
        actor: "user",
        decidedAt: "2026-07-20T01:00:00.000Z",
        note: "",
        snapshotId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        editedCandidate: null,
      },
      updatedAt: "2026-07-20T01:00:00.000Z",
    },
    revision: "b".repeat(64),
    targetAvailability: { available: false, reason: "Target changed since Proposal creation" },
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("NS-609 Review presentation", () => {
  it("opens the exact pending Research Note Proposal without applying it", async () => {
    const item = promotion();
    vi.spyOn(api.proposals, "list").mockResolvedValue({ items: [item], diagnostics: [] });
    const accept = vi.spyOn(api.proposals, "accept");
    const openResearchNote = vi.fn();
    const view = render(<ReviewWorkspace
      onOpenProposal={vi.fn()}
      onOpenResearchNote={openResearchNote}
      onOpenWorkshopMessage={vi.fn()}
      selectedProposalId={proposalId}
      series={{ manifest: { id: seriesId } } as SeriesDetail}
    />);

    expect(await view.findAllByText(item.proposal.title)).toHaveLength(2);
    expect(view.getByText("description")).toBeTruthy();
    expect(view.getByText("A working port.")).toBeTruthy();
    expect(view.getAllByText(/The market opens only after the bell rings/u)).toHaveLength(2);
    expect(view.getByRole("button", { name: "Accept" })).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Open Research Note" }));
    expect(openResearchNote).toHaveBeenCalledWith(databaseId, noteId);
    expect(accept).not.toHaveBeenCalled();
  });

  it("keeps the decided Proposal visible and returns to the exact Codex field or Research Note", async () => {
    const pending = promotion();
    const accepted = acceptedPromotion();
    vi.spyOn(api.proposals, "list")
      .mockResolvedValueOnce({ items: [pending], diagnostics: [] })
      .mockResolvedValue({ items: [accepted], diagnostics: [] });
    const accept = vi.spyOn(api.proposals, "accept").mockResolvedValue({
      proposal: accepted,
      snapshot: null,
    } as never);
    const onCodexAuthorityChanged = vi.fn();
    const onOpenCodexEntry = vi.fn();
    const onOpenResearchNote = vi.fn();
    const view = render(<ReviewWorkspace
      onCodexAuthorityChanged={onCodexAuthorityChanged}
      onOpenCodexEntry={onOpenCodexEntry}
      onOpenProposal={vi.fn()}
      onOpenResearchNote={onOpenResearchNote}
      onOpenWorkshopMessage={vi.fn()}
      selectedProposalId={proposalId}
      series={{ manifest: { id: seriesId } } as SeriesDetail}
    />);

    fireEvent.click(await view.findByRole("button", { name: "Accept" }));
    await waitFor(() => expect(accept).toHaveBeenCalledTimes(1));
    expect(onCodexAuthorityChanged).toHaveBeenCalledTimes(1);
    expect(await view.findByText("Applied to Canon Description")).toBeTruthy();
    expect(view.getByText(/Research Note and its evidence remain unchanged/u)).toBeTruthy();
    expect(view.queryByText("Target changed since Proposal creation")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Open Canon Description" }));
    expect(onOpenCodexEntry).toHaveBeenCalledWith(entryId, "canon");
    fireEvent.click(view.getByRole("button", { name: "Back to Research Note" }));
    expect(onOpenResearchNote).toHaveBeenCalledWith(databaseId, noteId);
  });

  it("refreshes stale availability after a failed acceptance instead of leaving an active Accept control", async () => {
    const pending = promotion();
    const stale = {
      ...pending,
      sourceAvailability: {
        available: false,
        reason: "Source Research Note changed since Proposal creation",
      },
    };
    vi.spyOn(api.proposals, "list")
      .mockResolvedValueOnce({ items: [pending], diagnostics: [] })
      .mockResolvedValue({ items: [stale], diagnostics: [] });
    vi.spyOn(api.proposals, "accept").mockRejectedValue(new Error("Research Note promotion source dependency changed or is unavailable"));
    const view = render(<ReviewWorkspace
      onOpenProposal={vi.fn()}
      onOpenWorkshopMessage={vi.fn()}
      selectedProposalId={proposalId}
      series={{ manifest: { id: seriesId } } as SeriesDetail}
    />);

    fireEvent.click(await view.findByRole("button", { name: "Accept" }));
    expect(await view.findByText("Source Research Note changed since Proposal creation")).toBeTruthy();
    expect(view.getByRole("button", { name: "Mark Stale" })).toBeTruthy();
    expect(view.queryByRole("button", { name: "Accept" })).toBeNull();
  });
});
