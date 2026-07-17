import { describe, expect, it } from "vitest";
import { ContextItemKindSchema, ContextSourceTypeSchema } from "../src/context.js";
import {
  CreateWorkshopMessageInputSchema,
  CreateWorkshopSessionInputSchema,
  DeleteWorkshopMessageResultSchema,
  DeleteWorkshopSessionResultSchema,
  ExportWorkshopSessionQuerySchema,
  ResendWorkshopMessageInputSchema,
  ResendWorkshopMessageResultSchema,
  RunWorkshopCallInputSchema,
  UpdateWorkshopSessionInputSchema,
  WorkshopCallStreamEventSchema,
  WorkshopAgentRunSchema,
  WorkshopContextBasketSchema,
  WorkshopContextItemKindSchema,
  WorkshopMessageAttachmentSchema,
  WorkshopMessageSchema,
  WorkshopModeSchema,
  WorkshopSessionSchema,
  workshopAgentRunV1RollbackSnapshot,
  workshopMessageV1RollbackSnapshot,
  workshopSessionV1RollbackSnapshot,
} from "../src/workshop.js";
import { DEFAULT_WORKSHOP_GENERAL_CHAT_SYSTEM_PROMPT } from "../src/workshopPrompts.js";

const now = "2026-07-01T00:00:00.000Z";

describe("M5 Workshop contracts", () => {
  it("exposes only current Workshop modes and selectable context refs", () => {
    expect(WorkshopModeSchema.options).toEqual(["general-chat", "agent"]);
    expect(WorkshopContextItemKindSchema.options).toEqual([
      "full-novel",
      "full-outline",
      "volume",
      "chapter",
      "act",
      "scene",
      "codex-entry",
    ]);
    expect(WorkshopModeSchema.safeParse("continuity-check").success).toBe(false);
    expect(WorkshopModeSchema.safeParse("codex-creation").success).toBe(false);
    expect(WorkshopContextItemKindSchema.safeParse("proposal-source").success).toBe(false);
    expect(ContextItemKindSchema.options).toContain("book");
    expect(ContextSourceTypeSchema.options).toContain("book");
  });

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
    expect(session.schemaVersion).toBe(2);
    expect(session.generalChatSystemPrompt).toBe(DEFAULT_WORKSHOP_GENERAL_CHAT_SYSTEM_PROMPT);

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
    expect(message.mode).toBe("general-chat");
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
    expect(WorkshopMessageSchema.parse({
      ...claimedToolMessage,
      toolExecution: {
        ...claimedToolMessage.toolExecution,
        status: "failed",
        completedAt: now,
        resultMessageId: "55555555-5555-4555-8555-555555555555",
        errorCode: "INVALID_DATA",
        errorMessage: "The confirmed command failed without writing authority.",
      },
    }).toolExecution?.resultMessageId).toBe("55555555-5555-4555-8555-555555555555");
  });

  it("migrates and rolls back session prompt authority without discarding the prompt", () => {
    const migratedAgent = WorkshopSessionSchema.parse({
      schemaVersion: 1,
      id: "55555555-5555-4555-8555-555555555555",
      seriesId: "22222222-2222-4222-8222-222222222222",
      kind: "agent",
      title: "Legacy Agent",
      createdAt: now,
      updatedAt: now,
    });
    expect(migratedAgent).toMatchObject({ schemaVersion: 2, generalChatSystemPrompt: null });

    const chat = WorkshopSessionSchema.parse({
      schemaVersion: 2,
      id: "66666666-6666-4666-8666-666666666666",
      seriesId: "22222222-2222-4222-8222-222222222222",
      kind: "chat",
      generalChatSystemPrompt: "A session-specific prompt.",
      title: "Prompted chat",
      createdAt: now,
      updatedAt: now,
    });
    const rollback = workshopSessionV1RollbackSnapshot(chat);
    expect(rollback.session).toMatchObject({ schemaVersion: 1, id: chat.id, kind: "chat" });
    expect(rollback.generalChatSystemPromptBackup).toBe("A session-specific prompt.");
  });

  it("migrates Workshop messages to version 2 and preserves cancelled and reasoning metadata for rollback", () => {
    const legacy = WorkshopMessageSchema.parse({
      schemaVersion: 1,
      id: "77777777-7777-4777-8777-777777777777",
      seriesId: "22222222-2222-4222-8222-222222222222",
      sessionId: "11111111-1111-4111-8111-111111111111",
      role: "assistant",
      content: "Legacy answer.",
      reasoningContent: "Legacy reasoning without Provider output metadata.",
      createdAt: now,
    });
    expect(legacy).toMatchObject({ schemaVersion: 2, reasoningOutputKind: "unknown" });

    const cancelled = WorkshopMessageSchema.parse({
      ...legacy,
      id: "88888888-8888-4888-8888-888888888888",
      status: "cancelled",
      content: "Partial answer.",
      reasoningContent: "Visible summary.",
      reasoningOutputKind: "summary",
      errorCode: null,
      errorMessage: null,
    });
    expect(cancelled).toMatchObject({ schemaVersion: 2, status: "cancelled" });
    const rollback = workshopMessageV1RollbackSnapshot(cancelled);
    expect(rollback.message).toMatchObject({ schemaVersion: 1, status: "failed" });
    expect(rollback.cancelledStatusBackup).toBe("cancelled");
    expect(rollback.reasoningOutputKindBackup).toBe("summary");
    expect(WorkshopMessageSchema.safeParse({
      ...cancelled,
      errorCode: "ABORTED",
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
    const scope = {
      operationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      assistantMessageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      modelCallId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    };
    const start = WorkshopCallStreamEventSchema.parse({
      type: "assistant-start",
      ...scope,
      contextBundleId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      attempt: 2,
      reset: true,
    });
    expect(start).toMatchObject({ type: "assistant-start", attempt: 2, reset: true });
    const reasoning = WorkshopCallStreamEventSchema.parse({
      type: "reasoning-delta",
      ...scope,
      attempt: 2,
      text: "Checked the selected context before answering.",
      outputKind: "summary",
    });
    expect(reasoning).toMatchObject({ type: "reasoning-delta" });
    const delta = WorkshopCallStreamEventSchema.parse({
      type: "delta",
      ...scope,
      attempt: 2,
      text: "Visible answer.",
    });
    expect(delta).toMatchObject({ type: "delta" });
  });

  it("validates durable Workshop Agent run and ordered step invariants", () => {
    const run = WorkshopAgentRunSchema.parse({
      schemaVersion: 1,
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      seriesId: "22222222-2222-4222-8222-222222222222",
      sessionId: "11111111-1111-4111-8111-111111111111",
      authorMessageId: "33333333-3333-4333-8333-333333333333",
      status: "waiting-confirmation",
      modelProfileId: "44444444-4444-4444-8444-444444444444",
      contextBundleId: "55555555-5555-4555-8555-555555555555",
      promptTemplateId: "66666666-6666-4666-8666-666666666666",
      promptTemplateVersion: 1,
      promptSnapshot: {
        system: "Write with the author.",
        instructions: "Work naturally with the author.",
        user: "Add Mara to the Codex.",
        hash: "b".repeat(64),
      },
      activeStepId: "88888888-8888-4888-8888-888888888888",
      steps: [
        {
          schemaVersion: 1,
          id: "77777777-7777-4777-8777-777777777777",
          index: 0,
          kind: "model",
          status: "succeeded",
          modelCallId: "99999999-9999-4999-8999-999999999999",
          promptSnapshot: {
            system: "Write with the author.",
            instructions: "Work naturally with the author.",
            user: "Add Mara to the Codex.",
            hash: "b".repeat(64),
          },
          messageId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
          startedAt: now,
          completedAt: now,
        },
        {
          schemaVersion: 1,
          id: "88888888-8888-4888-8888-888888888888",
          index: 1,
          kind: "tool-request",
          status: "waiting-confirmation",
          messageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          startedAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    });
    expect(run.status).toBe("waiting-confirmation");
    expect(run.steps).toHaveLength(2);
    expect(run.degradedStructuredOutput).toBe(false);
    expect(run.steps[0]!.historySnapshot).toEqual([]);
  });

  it("keeps author cancellation distinct from Agent failure and preserves it in rollback backup", () => {
    const run = WorkshopAgentRunSchema.parse({
      schemaVersion: 2,
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      seriesId: "22222222-2222-4222-8222-222222222222",
      sessionId: "11111111-1111-4111-8111-111111111111",
      authorMessageId: "33333333-3333-4333-8333-333333333333",
      status: "cancelled",
      modelProfileId: "44444444-4444-4444-8444-444444444444",
      parameters: { reasoning: { mode: "effort", effort: "high" } },
      contextBundleId: "55555555-5555-4555-8555-555555555555",
      promptTemplateId: "66666666-6666-4666-8666-666666666666",
      promptTemplateVersion: 1,
      promptSnapshot: {
        system: "Write with the author.",
        instructions: "Work naturally with the author.",
        user: "Discuss Mara.",
        hash: "b".repeat(64),
      },
      activeStepId: null,
      steps: [{
        schemaVersion: 2,
        id: "77777777-7777-4777-8777-777777777777",
        index: 0,
        kind: "model",
        status: "cancelled",
        modelCallId: "99999999-9999-4999-8999-999999999999",
        promptSnapshot: {
          system: "Write with the author.",
          instructions: "Work naturally with the author.",
          user: "Discuss Mara.",
          hash: "b".repeat(64),
        },
        messageId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        retryable: false,
        errorCode: null,
        errorMessage: null,
        startedAt: now,
        completedAt: now,
      }],
      retryable: false,
      createdAt: now,
      updatedAt: now,
      completedAt: now,
    });
    expect(run).toMatchObject({ schemaVersion: 2, status: "cancelled", retryable: false });
    expect(run.steps[0]).toMatchObject({ status: "cancelled", errorCode: null, errorMessage: null });

    const rollback = workshopAgentRunV1RollbackSnapshot(run);
    expect(rollback.run).toMatchObject({ schemaVersion: 1, status: "abandoned" });
    expect(rollback.run.steps[0]).toMatchObject({ schemaVersion: 1, status: "abandoned" });
    expect(rollback.cancelledRunStatusBackup).toBe("cancelled");
    expect(rollback.cancelledStepStatusBackups).toEqual([{
      stepId: "77777777-7777-4777-8777-777777777777",
      status: "cancelled",
    }]);
  });

  it("preserves long Workshop Agent prompt snapshots beyond the message limit", () => {
    const longUserPrompt = "x".repeat(400_001);
    const run = WorkshopAgentRunSchema.parse({
      schemaVersion: 1,
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      seriesId: "22222222-2222-4222-8222-222222222222",
      sessionId: "11111111-1111-4111-8111-111111111111",
      authorMessageId: "33333333-3333-4333-8333-333333333333",
      status: "completed",
      modelProfileId: "44444444-4444-4444-8444-444444444444",
      contextBundleId: "55555555-5555-4555-8555-555555555555",
      promptTemplateId: "66666666-6666-4666-8666-666666666666",
      promptTemplateVersion: 1,
      promptSnapshot: {
        system: "Write with the author.",
        instructions: "Return a structured step.",
        user: longUserPrompt,
        hash: "b".repeat(64),
      },
      steps: [{
        schemaVersion: 1,
        id: "77777777-7777-4777-8777-777777777777",
        index: 0,
        kind: "model",
        status: "succeeded",
        modelCallId: "99999999-9999-4999-8999-999999999999",
        promptSnapshot: {
          system: "Write with the author.",
          instructions: "Return a structured step.",
          user: longUserPrompt,
          hash: "b".repeat(64),
        },
        messageId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        startedAt: now,
        completedAt: now,
      }],
      createdAt: now,
      updatedAt: now,
      completedAt: now,
    });
    expect(run.promptSnapshot.user).toHaveLength(400_001);
  });

  it("rejects duplicate steps and invalid terminal Agent run state", () => {
    const step = {
      schemaVersion: 1,
      id: "77777777-7777-4777-8777-777777777777",
      index: 0,
      kind: "model",
      status: "succeeded",
      modelCallId: "99999999-9999-4999-8999-999999999999",
      promptSnapshot: {
        system: "Write with the author.",
        instructions: "Return a structured step.",
        user: "Talk through the scene.",
        hash: "b".repeat(64),
      },
      messageId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      startedAt: now,
      completedAt: now,
    };
    const result = WorkshopAgentRunSchema.safeParse({
      schemaVersion: 1,
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      seriesId: "22222222-2222-4222-8222-222222222222",
      sessionId: "11111111-1111-4111-8111-111111111111",
      authorMessageId: "33333333-3333-4333-8333-333333333333",
      status: "completed",
      modelProfileId: "44444444-4444-4444-8444-444444444444",
      contextBundleId: "55555555-5555-4555-8555-555555555555",
      promptTemplateId: "66666666-6666-4666-8666-666666666666",
      promptTemplateVersion: 1,
      promptSnapshot: {
        system: "Write with the author.",
        instructions: "Return a structured step.",
        user: "Talk through the scene.",
        hash: "b".repeat(64),
      },
      steps: [step, { ...step, index: 2 }],
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("duplicate");
    expect(JSON.stringify(result.error?.issues)).toContain("contiguous");
    expect(JSON.stringify(result.error?.issues)).toContain("completion timestamp");
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

  it("validates complete General Chat turn delete results", () => {
    const result = DeleteWorkshopMessageResultSchema.parse({
      deletedMessageIds: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ],
      deletedAttachmentIds: ["33333333-3333-4333-8333-333333333333"],
      deletedBranchIds: ["44444444-4444-4444-8444-444444444444"],
      session: {
        schemaVersion: 1,
        id: "55555555-5555-4555-8555-555555555555",
        seriesId: "66666666-6666-4666-8666-666666666666",
        kind: "chat",
        title: "General chat",
        sceneId: null,
        branchOfMessageId: null,
        status: "active",
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
        lastMessageAt: null,
      },
    });
    expect(result.deletedMessageIds).toHaveLength(2);
    expect(result.deletedAttachmentIds).toHaveLength(1);
    expect(result.deletedBranchIds).toHaveLength(1);
  });

  it("rejects duplicate basket item IDs and source-less selectable refs", () => {
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
          kind: "scene",
          sourceId: "88888888-8888-4888-8888-888888888888",
          label: "Opening scene",
          createdAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };
    const duplicateResult = WorkshopContextBasketSchema.safeParse(base);
    expect(duplicateResult.success).toBe(false);
    expect(JSON.stringify(duplicateResult.error.issues)).toContain("duplicate");

    const sourceLessResult = WorkshopContextBasketSchema.safeParse({
      ...base,
      items: [{
        ...base.items[0],
        id: "99999999-9999-4999-8999-999999999999",
        kind: "scene",
        sourceId: null,
        label: "Opening scene",
      }],
    });
    expect(sourceLessResult.success).toBe(false);
    expect(JSON.stringify(sourceLessResult.error.issues)).toContain("sourceId");
  });

  it("migrates version 1 basket storage names to version 2 author-facing hierarchy kinds", () => {
    const migrated = WorkshopContextBasketSchema.parse({
      schemaVersion: 1,
      id: "44444444-4444-4444-8444-444444444444",
      seriesId: "22222222-2222-4222-8222-222222222222",
      sessionId: "11111111-1111-4111-8111-111111111111",
      items: [{
        id: "55555555-5555-4555-8555-555555555555",
        kind: "act",
        sourceId: "66666666-6666-4666-8666-666666666666",
        label: "Stored Act, visible Chapter",
        createdAt: now,
      }, {
        id: "77777777-7777-4777-8777-777777777777",
        kind: "chapter",
        sourceId: "88888888-8888-4888-8888-888888888888",
        label: "Stored Chapter, visible Act",
        createdAt: now,
      }],
      createdAt: now,
      updatedAt: now,
    });
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.items.map((item) => [item.kind, item.sourceId])).toEqual([
      ["chapter", "66666666-6666-4666-8666-666666666666"],
      ["act", "88888888-8888-4888-8888-888888888888"],
    ]);
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
    expect(CreateWorkshopSessionInputSchema.safeParse({
      kind: "agent",
      generalChatSystemPrompt: "Do not accept this.",
    }).success).toBe(false);
    expect(UpdateWorkshopSessionInputSchema.parse({ generalChatSystemPrompt: "Saved prompt." }))
      .toEqual({ generalChatSystemPrompt: "Saved prompt." });
    expect(UpdateWorkshopSessionInputSchema.parse({
      title: "Automatic title",
      expectedTitle: "New chat",
    })).toEqual({ title: "Automatic title", expectedTitle: "New chat" });
    expect(UpdateWorkshopSessionInputSchema.safeParse({ expectedTitle: "New chat" }).success)
      .toBe(false);
  });

  it("validates General Chat resend inputs and replacement results", () => {
    const input = ResendWorkshopMessageInputSchema.parse({
      content: "Updated request.",
      modelProfileId: "11111111-2222-4333-8444-555555555555",
    });
    expect(input.taskKind).toBe("analysis");
    expect(input.content).toBe("Updated request.");
    expect(ResendWorkshopMessageInputSchema.safeParse({
      content: "Updated request.",
      systemPrompt: "Request-local override.",
      modelProfileId: "11111111-2222-4333-8444-555555555555",
    }).success).toBe(false);
    expect(RunWorkshopCallInputSchema.safeParse({
      mode: "general-chat",
      userRequest: "Discuss this.",
      systemPrompt: "Request-local override.",
      modelProfileId: "11111111-2222-4333-8444-555555555555",
    }).success).toBe(false);

    const result = ResendWorkshopMessageResultSchema.parse({
      operationId: "99999999-9999-4999-8999-999999999999",
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
