import { describe, expect, it } from "vitest";
import {
  RunWorkshopCallInputSchema,
  WorkshopCallStreamEventSchema,
  WorkshopContextBasketSchema,
  WorkshopMessageSchema,
  WorkshopSessionSchema,
} from "../src/workshop.js";

const now = "2026-07-01T00:00:00.000Z";

describe("M5 Workshop contracts", () => {
  it("validates persistent sessions and messages without requiring Proposals", () => {
    const session = WorkshopSessionSchema.parse({
      schemaVersion: 1,
      id: "11111111-1111-4111-8111-111111111111",
      seriesId: "22222222-2222-4222-8222-222222222222",
      title: "Continuity pass",
      createdAt: now,
      updatedAt: now,
    });
    expect(session.status).toBe("active");

    const message = WorkshopMessageSchema.parse({
      schemaVersion: 1,
      id: "33333333-3333-4333-8333-333333333333",
      seriesId: session.seriesId,
      sessionId: session.id,
      role: "assistant",
      content: "No authority writes were applied.",
      contextBundleId: null,
      modelCallId: null,
      createdAt: now,
    });
    expect(message.proposalIds).toEqual([]);
    expect(message.reasoningContent).toBe("");
  });

  it("validates Workshop stream events with visible reasoning deltas", () => {
    const reasoning = WorkshopCallStreamEventSchema.parse({
      type: "reasoning-delta",
      text: "Checked the selected context before answering.",
    });
    expect(reasoning).toMatchObject({ type: "reasoning-delta" });
    const delta = WorkshopCallStreamEventSchema.parse({
      type: "delta",
      text: "Visible answer.",
    });
    expect(delta).toMatchObject({ type: "delta" });
  });

  it("rejects duplicate basket item IDs and source-less non-note refs", () => {
    const base = {
      schemaVersion: 1,
      id: "44444444-4444-4444-8444-444444444444",
      seriesId: "22222222-2222-4222-8222-222222222222",
      sessionId: "11111111-1111-4111-8111-111111111111",
      sceneId: "55555555-5555-4555-8555-555555555555",
      items: [
        {
          id: "66666666-6666-4666-8666-666666666666",
          kind: "codex-entry",
          sourceId: "77777777-7777-4777-8777-777777777777",
          label: "Captain Veyr",
          createdAt: now,
        },
        {
          id: "66666666-6666-4666-8666-666666666666",
          kind: "scene-section",
          sourceId: null,
          label: "Private note",
          createdAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };
    const result = WorkshopContextBasketSchema.safeParse(base);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error.issues)).toContain("duplicate");
    expect(JSON.stringify(result.error.issues)).toContain("sourceId");
  });

  it("requires a concrete model profile for a single-role call", () => {
    const result = RunWorkshopCallInputSchema.safeParse({
      userRequest: "Check continuity.",
      roleId: "continuity-editor",
      taskKind: "continuity-check",
      promptTemplateId: "00000000-0000-4000-8000-000000000405",
      promptTemplateVersion: 1,
      modelProfileId: null,
    });
    expect(result.success).toBe(false);
  });
});
