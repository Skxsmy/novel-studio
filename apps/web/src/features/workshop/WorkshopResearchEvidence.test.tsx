import { fireEvent, render, screen } from "@testing-library/react";
import type { ResearchToolAuditCitation, WorkshopResearchEvidence } from "@novel-studio/contracts";
import { describe, expect, it, vi } from "vitest";
import { WorkshopResearchEvidence as WorkshopResearchEvidenceView } from "./WorkshopResearchEvidence";

const databaseId = "11111111-1111-4111-8111-111111111111";
const sourceId = "22222222-2222-4222-8222-222222222222";

function citation(index: number, relationship: ResearchToolAuditCitation["relationship"] = "target"): ResearchToolAuditCitation {
  return {
    researchDatabaseId: databaseId,
    researchDatabaseName: "Lore shelf",
    sourceId,
    sourceRevision: "a".repeat(64),
    sourceDisplayName: `Moon notes ${index}`,
    sourceKind: "txt",
    chunkId: `33333333-3333-4333-8333-${String(index).padStart(12, "0")}`,
    blockId: `44444444-4444-4444-8444-${String(index).padStart(12, "0")}`,
    chunkHash: "b".repeat(64),
    languageTag: "en",
    location: { kind: "text", startLine: index, endLine: index, startOffset: index, endOffset: index + 8 },
    relationship,
    matchChannels: ["keyword-literal"],
    fusedScore: 0.5,
  };
}

function evidence(citations: ResearchToolAuditCitation[]): WorkshopResearchEvidence {
  return {
    schemaVersion: 1,
    id: "55555555-5555-4555-8555-555555555555",
    seriesId: "66666666-6666-4666-8666-666666666666",
    sessionId: "77777777-7777-4777-8777-777777777777",
    assistantMessageId: "88888888-8888-4888-8888-888888888888",
    modelCallId: "99999999-9999-4999-8999-999999999999",
    copiedFromEvidenceId: null,
    citations,
    createdAt: "2026-07-19T00:00:00.000Z",
  };
}

describe("NS-607 Workshop Research evidence", () => {
  it("opens the exact visible citation and omits audit internals", () => {
    const target = citation(2);
    const onOpenCitation = vi.fn();
    const { container } = render(<WorkshopResearchEvidenceView
      availableDatabaseIds={[databaseId]}
      evidence={evidence([citation(1, "previous"), target, citation(3, "next")])}
      onOpenCitation={onOpenCitation}
    />);
    const button = screen.getByRole("button", { name: /Moon notes 2/i });
    fireEvent.click(button);
    expect(onOpenCitation).toHaveBeenCalledWith(target);
    expect(container.textContent).not.toContain(target.chunkHash);
    expect(container.textContent).not.toContain("modelCallId");
    expect(screen.queryByText("Moon notes 1")).toBeNull();
  });

  it("bounds visible citations and marks an unavailable database as stale", () => {
    const citations = [1, 2, 3, 4, 5].map((index) => citation(index));
    render(<WorkshopResearchEvidenceView
      availableDatabaseIds={[]}
      evidence={evidence(citations)}
      onOpenCitation={vi.fn()}
    />);
    expect(screen.getAllByRole("button")).toHaveLength(4);
    expect(screen.getAllByRole("button").every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    expect(screen.getByText("1 more citation recorded")).toBeTruthy();
    expect(screen.getAllByText("Unavailable")).toHaveLength(4);
  });
});
