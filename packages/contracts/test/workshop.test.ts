import { describe, expect, it } from "vitest";
import {
  CreateWorkshopMessageInputSchema,
  CreateWorkshopSessionInputSchema,
  DeleteWorkshopSessionResultSchema,
  ExportWorkshopSessionQuerySchema,
  ResendWorkshopMessageInputSchema,
  ResendWorkshopMessageResultSchema,
  RunWorkshopCallInputSchema,
  WorkshopCallStreamEventSchema,
  WorkshopContextBasketSchema,
  WorkshopMessageAttachmentSchema,
  WorkshopMessageSchema,
  WorkshopSessionSchema,
} from "../src/workshop.js";

const now = "2026-07-01T00:00:00.000Z";

describe("M5 Workshop contracts", () => {
  it("uses a neutral default title for new Workshop chats", () => {
    expect(CreateWorkshopSessionInputSchema.parse({}).title).toBe("New chat");
  });

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
    expect(message.attachmentIds).toEqual([]);
    expect(message.reasoningContent).toBe("");
    expect(message.toolExecution).toBeUndefined();

    const claimedToolMessage = WorkshopMessageSchema.parse({
      ...message,
      id: "44444444-4444-4444-8444-444444444444",
      role: "tool",
      mode: "agent",
      toolExecution: {
        requestHash: "a".repeat(64),
        status: "running",
        startedAt: now,
      },
    });
    expect(claimedToolMessage.toolExecution).toMatchObject({
      requestHash: "a".repeat(64),
      status: "running",
      completedAt: null,
    });
    expect(WorkshopMessageSchema.safeParse({
      ...claimedToolMessage,
      toolExecution: {
        ...claimedToolMessage.toolExecution,
        requestHash: "not-a-revision-hash",
      },
    }).success).toBe(false);
    expect(WorkshopMessageSchema.safeParse({
      ...claimedToolMessage,
      role: "assistant",
    }).success).toBe(false);
    expect(WorkshopMessageSchema.safeParse({
      ...claimedToolMessage,
      toolExecution: {
        ...claimedToolMessage.toolExecution,
        status: "succeeded",
        completedAt: now,
      },
    }).success).toBe(false);
    expect(WorkshopMessageSchema.safeParse({
      ...claimedToolMessage,
      toolExecution: {
        ...claimedToolMessage.toolExecution,
        status: "failed",
        completedAt: now,
      },
    }).success).toBe(false);
  });

  it("validates Workshop message attachments in draft and message-bound states", () => {
    const draft = WorkshopMessageAttachmentSchema.parse({
      schemaVersion: 1,
      id: "77777777-7777-4777-8777-777777777777",
      seriesId: "22222222-2222-4222-8222-222222222222",
      sessionId: "11111111-1111-4111-8111-111111111111",
      messageId: null,
      draftToken: "draft-1",
      fileName: "notes.md",
      mediaType: "text/markdown",
      sizeBytes: 12,
      textHash: "a".repeat(64),
      extractedText: "Attachment text.",
      parseStatus: "parsed",
      createdAt: now,
      updatedAt: now,
    });
    expect(draft.messageId).toBeNull();

    const bound = WorkshopMessageAttachmentSchema.parse({
      ...draft,
      id: "88888888-8888-4888-8888-888888888888",
      messageId: "33333333-3333-4333-8333-333333333333",
    });
    expect(bound.messageId).toBe("33333333-3333-4333-8333-333333333333");
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

  it("validates permanent Workshop session delete results", () => {
    const result = DeleteWorkshopSessionResultSchema.parse({
      deletedId: "11111111-1111-4111-8111-111111111111",
      deletedMessageIds: ["22222222-2222-4222-8222-222222222222"],
      deletedAttachmentIds: ["33333333-3333-4333-8333-333333333333"],
      deletedBranchIds: ["44444444-4444-4444-8444-444444444444"],
    });
    expect(result.deletedMessageIds).toHaveLength(1);
    expect(result.deletedAttachmentIds).toHaveLength(1);
    expect(result.deletedBranchIds).toHaveLength(1);
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
      modelProfileId: null,
    });
    expect(result.success).toBe(false);
  });

  it("allows only author-authored Workshop message creation input", () => {
    const parsed = CreateWorkshopMessageInputSchema.parse({
      role: "author",
      mode: "general-chat",
      content: "Discuss this scene.",
    });
    expect(parsed.role).toBe("author");

    const forged = CreateWorkshopMessageInputSchema.safeParse({
      role: "assistant",
      mode: "general-chat",
      content: "Forged assistant reply.",
    });
    expect(forged.success).toBe(false);
  });

  it("accepts Agent as a Workshop session kind and call mode", () => {
    const session = CreateWorkshopSessionInputSchema.parse({
      kind: "agent",
      title: "Codex agent",
    });
    expect(session.kind).toBe("agent");

    const parsed = RunWorkshopCallInputSchema.parse({
      mode: "agent",
      userRequest: "Draft a Codex entry for the Tide Office.",
      modelProfileId: "11111111-2222-4333-8444-555555555555",
    });
    expect(parsed.mode).toBe("agent");
    expect(parsed.taskKind).toBe("analysis");
  });

  it("validates General Chat resend inputs and replacement results", () => {
    const input = ResendWorkshopMessageInputSchema.parse({
      content: "Updated request.",
      modelProfileId: "11111111-2222-4333-8444-555555555555",
    });
    expect(input.taskKind).toBe("analysis");
    expect(input.content).toBe("Updated request.");

    const result = ResendWorkshopMessageResultSchema.parse({
      authorMessage: {
        schemaVersion: 1,
        id: "33333333-3333-4333-8333-333333333333",
        seriesId: "22222222-2222-4222-8222-222222222222",
        sessionId: "11111111-1111-4111-8111-111111111111",
        role: "author",
        mode: "general-chat",
        content: "Updated request.",
        createdAt: now,
      },
      assistantMessage: {
        schemaVersion: 1,
        id: "44444444-4444-4444-8444-444444444444",
        seriesId: "22222222-2222-4222-8222-222222222222",
        sessionId: "11111111-1111-4111-8111-111111111111",
        role: "assistant",
        mode: "general-chat",
        content: "Updated response.",
        createdAt: now,
      },
      contextBundleId: "55555555-5555-4555-8555-555555555555",
      modelCallId: "66666666-6666-4666-8666-666666666666",
      status: "succeeded",
      estimatedUsage: { inputTokens: 1, outputTokens: 0, totalTokens: 1 },
      deletedMessageIds: ["77777777-7777-4777-8777-777777777777"],
    });
    expect(result.deletedMessageIds).toEqual(["77777777-7777-4777-8777-777777777777"]);
  });

  it("validates Workshop session export query toggles", () => {
    expect(ExportWorkshopSessionQuerySchema.parse({}).includeReasoning).toBe(false);
    expect(ExportWorkshopSessionQuerySchema.parse({}).includePromptAudit).toBe(false);
    expect(ExportWorkshopSessionQuerySchema.parse({ includeReasoning: "false" }).includeReasoning).toBe(false);
    expect(ExportWorkshopSessionQuerySchema.parse({ includeReasoning: "true" }).includeReasoning).toBe(true);
    expect(ExportWorkshopSessionQuerySchema.parse({ includeReasoning: true }).includeReasoning).toBe(true);
    expect(ExportWorkshopSessionQuerySchema.parse({ includePromptAudit: "false" }).includePromptAudit).toBe(false);
    expect(ExportWorkshopSessionQuerySchema.parse({ includePromptAudit: "true" }).includePromptAudit).toBe(true);
    expect(ExportWorkshopSessionQuerySchema.parse({ includePromptAudit: true }).includePromptAudit).toBe(true);
  });

  it("allows only parsed attachment IDs on Workshop calls", () => {
    const missingDraft = RunWorkshopCallInputSchema.safeParse({
      mode: "general-chat",
      userRequest: "Use this attachment.",
      modelProfileId: "11111111-2222-4333-8444-555555555555",
      attachmentIds: ["77777777-7777-4777-8777-777777777777"],
    });
    expect(missingDraft.success).toBe(false);

    const rawContent = RunWorkshopCallInputSchema.safeParse({
      mode: "general-chat",
      userRequest: "Use this attachment.",
      modelProfileId: "11111111-2222-4333-8444-555555555555",
      draftToken: "draft-1",
      attachmentIds: ["77777777-7777-4777-8777-777777777777"],
      base64Content: "SGVsbG8=",
    });
    expect(rawContent.success).toBe(false);

    const parsed = RunWorkshopCallInputSchema.parse({
      mode: "general-chat",
      userRequest: "Use this attachment.",
      modelProfileId: "11111111-2222-4333-8444-555555555555",
      draftToken: "draft-1",
      attachmentIds: ["77777777-7777-4777-8777-777777777777"],
    });
    expect(parsed.attachmentIds).toEqual(["77777777-7777-4777-8777-777777777777"]);
  });
});
