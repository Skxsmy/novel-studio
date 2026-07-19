// @vitest-environment jsdom

import type { ProposalDocument, SeriesDetail } from "@novel-studio/contracts";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import { ReviewWorkspace } from "./ReviewWorkspace";

const seriesId = "11111111-1111-4111-8111-111111111111";
const proposalId = "22222222-2222-4222-8222-222222222222";
const noteId = "33333333-3333-4333-8333-333333333333";
const entryId = "44444444-4444-4444-8444-444444444444";
const patchId = "55555555-5555-4555-8555-555555555555";
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
      researchNotePromotion: null,
      createdAt: "2026-07-20T00:00:00.000Z",
      updatedAt: "2026-07-20T00:00:00.000Z",
    },
    revision,
    sourceAvailability: { available: true, reason: "" },
    targetAvailability: { available: true, reason: "" },
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
    const view = render(<ReviewWorkspace
      onOpenProposal={vi.fn()}
      onOpenWorkshopMessage={vi.fn()}
      selectedProposalId={proposalId}
      series={{ manifest: { id: seriesId } } as SeriesDetail}
    />);

    expect(await view.findAllByText(item.proposal.title)).toHaveLength(2);
    expect(view.getByText("description")).toBeTruthy();
    expect(view.getByText("A working port.")).toBeTruthy();
    expect(view.getAllByText(/The market opens only after the bell rings/u)).toHaveLength(2);
    expect(view.getByRole("button", { name: "Accept" })).toBeTruthy();
    expect(accept).not.toHaveBeenCalled();
  });
});
