import { describe, expect, it } from "vitest";
import {
  assertProposalStatusTransition,
  canTransitionProposalStatus,
  ProposalGeneratorSchema,
  ProposalSchema,
  ProposalSourceSchema,
  ProposalStatusSchema,
  ProposalTargetKindSchema,
  type Proposal,
} from "../src/proposals.js";

const revision =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const uuid = (seed: string) => `00000000-0000-4000-8000-${seed.padStart(12, "0")}`;

function baseProposal(overrides: Partial<Proposal> = {}): Proposal {
  const target = {
    kind: "scene-content" as const,
    targetId: uuid("10"),
    label: "Opening Scene",
    baseRevision: revision,
    fieldPath: [],
    blockId: null,
    range: null,
  };

  return ProposalSchema.parse({
    schemaVersion: 2,
    id: uuid("1"),
    seriesId: uuid("2"),
    type: "text-replacement",
    title: "Tighten opening line",
    summary: "Replace the first paragraph with a tighter version.",
    status: "pending",
    source: {
      kind: "manual",
      sourceId: null,
      label: "Author note",
      detail: "",
    },
    target,
    contextBundleId: null,
    generator: { kind: "manual", actor: "user" },
    riskLevel: "medium",
    confidence: null,
    reason: "The current line is repetitive.",
    staleReason: "",
    supersededBy: null,
    originalCandidate: null,
    decision: null,
    patches: [
      {
        id: uuid("3"),
        target,
        action: "replace-text",
        before: "Old paragraph.",
        after: "New paragraph.",
        unifiedDiff: "-Old paragraph.\n+New paragraph.",
      },
    ],
    evidence: [],
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  });
}

describe("M5 Proposal contracts", () => {
  it("covers the planned target, source, and generator kinds", () => {
    expect(ProposalTargetKindSchema.options).toEqual(
      expect.arrayContaining([
        "scene-content",
        "codex-entry",
        "detail-type",
        "codex-progression",
        "planning",
      ]),
    );

    expect(ProposalSourceSchema.parse({
      kind: "workshop-message",
      sourceId: uuid("4"),
      label: "Workshop answer",
      detail: "",
    })).toMatchObject({ kind: "workshop-message" });

    expect(ProposalGeneratorSchema.parse({
      kind: "tool",
      toolDefinitionId: "codex.updateEntry",
      toolPlanId: uuid("5"),
      actor: "workshop",
    })).toMatchObject({ kind: "tool" });
  });

  it("rejects non-manual sources without a source id", () => {
    expect(() =>
      ProposalSourceSchema.parse({
        kind: "workshop-message",
        sourceId: null,
        label: "Workshop answer",
        detail: "",
      }),
    ).toThrow(/sourceId/);
  });

  it("requires AI proposals to reference the context bundle used to generate them", () => {
    expect(() =>
      baseProposal({
        generator: {
          kind: "ai",
          roleId: "reviewer",
          modelCallLogId: uuid("6"),
          provider: "mock",
          model: "mock-model",
          promptTemplateId: uuid("7"),
          promptTemplateVersion: 1,
        },
      }),
    ).toThrow(/contextBundleId/);

    expect(
      baseProposal({
        contextBundleId: uuid("8"),
        generator: {
          kind: "ai",
          roleId: "reviewer",
          modelCallLogId: uuid("6"),
          provider: "mock",
          model: "mock-model",
          promptTemplateId: uuid("7"),
          promptTemplateVersion: 1,
        },
      }).generator.kind,
    ).toBe("ai");
  });

  it("does not allow a durable conflicted status", () => {
    expect(ProposalStatusSchema.options).not.toContain("conflicted");
    expect(() =>
      ProposalSchema.parse({
        ...baseProposal(),
        status: "conflicted",
      }),
    ).toThrow();
  });

  it("requires stale, superseded, accepted, and edited records to carry their audit payloads", () => {
    expect(() =>
      baseProposal({
        status: "stale",
        decision: {
          kind: "stale",
          actor: "user",
          decidedAt: "2026-07-01T00:00:00.000Z",
          note: "",
          snapshotId: null,
          editedCandidate: null,
        },
      }),
    ).toThrow(/staleReason/);

    expect(() =>
      baseProposal({
        status: "superseded",
        decision: {
          kind: "superseded",
          actor: "user",
          decidedAt: "2026-07-01T00:00:00.000Z",
          note: "",
          snapshotId: null,
          editedCandidate: null,
        },
      }),
    ).toThrow(/supersededBy/);

    expect(() =>
      baseProposal({
        status: "accepted",
        decision: {
          kind: "accepted",
          actor: "user",
          decidedAt: "2026-07-01T00:00:00.000Z",
          note: "",
          snapshotId: null,
          editedCandidate: null,
        },
      }),
    ).toThrow(/snapshotId/);

    expect(() =>
      baseProposal({
        status: "edited",
        decision: {
          kind: "edited",
          actor: "user",
          decidedAt: "2026-07-01T00:00:00.000Z",
          note: "",
          snapshotId: uuid("9"),
          editedCandidate: null,
        },
      }),
    ).toThrow(/originalCandidate/);
  });

  it("keeps the Proposal status machine narrow", () => {
    expect(canTransitionProposalStatus("pending", "accepted")).toBe(true);
    expect(canTransitionProposalStatus("stale", "accepted")).toBe(false);
    expect(canTransitionProposalStatus("accepted", "pending")).toBe(false);
    expect(() => assertProposalStatusTransition("accepted", "pending")).toThrow(
      /Invalid Proposal status transition/,
    );
  });
});
