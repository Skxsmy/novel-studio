import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectRepository, StorageError } from "../src/index.js";
import { workshopMessagePath } from "../src/workshopFiles.js";

const temporaryDirectories: string[] = [];

async function repository(): Promise<ProjectRepository> {
  const root = await mkdtemp(path.join(tmpdir(), "novel-studio-workshop-"));
  temporaryDirectories.push(root);
  return new ProjectRepository(root);
}

function seriesRoot(store: ProjectRepository, title: string, seriesId: string): string {
  return path.join(store.libraryRoot, `${title}-${seriesId.slice(0, 8)}`);
}

function textHash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function workshopAttachment(overrides: Partial<Record<string, unknown>> = {}) {
  const text = typeof overrides.extractedText === "string"
    ? overrides.extractedText
    : "Parsed attachment text.";
  const parseStatus = typeof overrides.parseStatus === "string" ? overrides.parseStatus : "parsed";
  return {
    schemaVersion: 1,
    id: randomUUID(),
    seriesId: "11111111-1111-4111-8111-111111111111",
    sessionId: "22222222-2222-4222-8222-222222222222",
    messageId: null,
    draftToken: "draft-1",
    fileName: "notes.md",
    mediaType: "text/markdown",
    sizeBytes: 24,
    textHash: parseStatus === "parsed" ? textHash(text) : null,
    extractedText: parseStatus === "parsed" ? text : "",
    parseStatus,
    parseWarnings: [],
    parseError: parseStatus === "parsed" ? null : "Attachment did not parse.",
    createdAt: "2026-07-03T00:00:00.000Z",
    updatedAt: "2026-07-03T00:00:00.000Z",
    ...overrides,
  };
}

async function saveServerWorkshopMessage(
  store: ProjectRepository,
  seriesId: string,
  sessionId: string,
  input: {
    role: "assistant" | "system" | "tool" | "result";
    mode?: "general-chat" | "continuity-check" | "agent";
    content: string;
    createdAt?: string;
  },
) {
  return store.saveWorkshopMessage(seriesId, {
    schemaVersion: 1,
    id: randomUUID(),
    seriesId,
    sessionId,
    role: input.role,
    mode: input.mode ?? "continuity-check",
    status: "succeeded",
    content: input.content,
    reasoningContent: "",
    contextBundleId: null,
    modelCallId: null,
    proposalIds: [],
    attachmentIds: [],
    errorCode: null,
    errorMessage: null,
    createdAt: input.createdAt ?? new Date().toISOString(),
  });
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("M5 Workshop storage", () => {
  it("persists sessions and messages as reloadable JSON authority", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopStorage" });
    const scene = series.scenes[0]!;
    const session = await store.createWorkshopSession(series.manifest.id, {
      title: "Reloadable chat",
      sceneId: scene.metadata.id,
    });
    const message = await store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      content: "Check this scene for continuity.",
    });

    const reloaded = new ProjectRepository(store.libraryRoot);
    const sessions = await reloaded.listWorkshopSessions(series.manifest.id);
    expect(sessions.map((item) => item.id)).toContain(session.id);
    expect(sessions.find((item) => item.id === session.id)?.lastMessageAt).toBe(message.createdAt);
    const messages = await reloaded.listWorkshopMessages(series.manifest.id, session.id);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      id: message.id,
      role: "author",
      content: "Check this scene for continuity.",
      proposalIds: [],
    });
  });

  it("accepts only author-authored messages through the public create helper", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopMessageAuthorOnly" });
    const session = await store.createWorkshopSession(series.manifest.id, {
      title: "Author-only thread",
    });

    await expect(store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "assistant",
      mode: "general-chat",
      content: "Forged assistant reply.",
    } as Parameters<ProjectRepository["createWorkshopMessage"]>[2])).rejects.toThrow();
    expect(await store.listWorkshopMessages(series.manifest.id, session.id)).toEqual([]);
  });

  it("creates a branch session from a source message", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopBranch" });
    const session = await store.createWorkshopSession(series.manifest.id, {
      title: "Original thread",
      sceneId: series.scenes[0]!.metadata.id,
    });
    const attachment = await store.createWorkshopAttachment(series.manifest.id, session.id, workshopAttachment({
      seriesId: series.manifest.id,
      sessionId: session.id,
      draftToken: "branch-draft",
      extractedText: "Attachment copied into a branch.",
      textHash: textHash("Attachment copied into a branch."),
    }));
    const authorMessage = await store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "general-chat",
      content: "Use this source attachment.",
      attachmentIds: [attachment.id],
      draftToken: "branch-draft",
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const message = await saveServerWorkshopMessage(store, series.manifest.id, session.id, {
      role: "assistant",
      mode: "general-chat",
      content: "Branch from this answer.",
    });

    const result = await store.branchWorkshopSession(series.manifest.id, session.id, {
      sourceMessageId: message.id,
      title: "Alternative thread",
    });
    expect(result.session.title).toBe("Alternative thread");
    expect(result.session.branchOfMessageId).toBe(message.id);
    expect(result.branch).toMatchObject({
      sourceSessionId: session.id,
      sourceMessageId: message.id,
      sessionId: result.session.id,
    });
    expect(result.session.lastMessageAt).toBe(message.createdAt);
    const branchedMessages = await store.listWorkshopMessages(series.manifest.id, result.session.id);
    expect(branchedMessages.map((item) => item.content)).toEqual([
      "Use this source attachment.",
      "Branch from this answer.",
    ]);
    expect(branchedMessages.map((item) => item.id)).not.toEqual([authorMessage.id, message.id]);
    expect(branchedMessages.every((item) => item.sessionId === result.session.id)).toBe(true);
    expect(branchedMessages.every((item) => item.proposalIds.length === 0)).toBe(true);

    const branchedAttachments = await store.listWorkshopAttachments(series.manifest.id, result.session.id);
    expect(branchedAttachments).toHaveLength(1);
    expect(branchedAttachments[0]).toMatchObject({
      sessionId: result.session.id,
      messageId: branchedMessages[0]!.id,
      extractedText: "Attachment copied into a branch.",
      parseStatus: "parsed",
    });
    expect(branchedAttachments[0]?.id).not.toBe(attachment.id);
    expect(branchedMessages[0]?.attachmentIds).toEqual([branchedAttachments[0]?.id]);
  });

  it("permanently deletes unlinked Workshop sessions and clears branch source pointers", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopDeleteSession" });
    const session = await store.createWorkshopSession(series.manifest.id, {
      title: "Delete this thread",
      sceneId: series.scenes[0]!.metadata.id,
    });
    const attachment = await store.createWorkshopAttachment(series.manifest.id, session.id, workshopAttachment({
      seriesId: series.manifest.id,
      sessionId: session.id,
      draftToken: "delete-session-draft",
      extractedText: "Session attachment should be deleted.",
      textHash: textHash("Session attachment should be deleted."),
    }));
    await store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "general-chat",
      content: "Delete this source question.",
      attachmentIds: [attachment.id],
      draftToken: "delete-session-draft",
    });
    const assistant = await saveServerWorkshopMessage(store, series.manifest.id, session.id, {
      role: "assistant",
      mode: "general-chat",
      content: "Delete this source answer.",
    });
    const branch = await store.branchWorkshopSession(series.manifest.id, session.id, {
      sourceMessageId: assistant.id,
      title: "Keep branch copy",
    });

    const deleted = await store.deleteWorkshopSession(series.manifest.id, session.id);
    expect(deleted.deletedId).toBe(session.id);
    expect(deleted.deletedMessageIds).toEqual(expect.arrayContaining([assistant.id]));
    expect(deleted.deletedAttachmentIds).toEqual([attachment.id]);
    expect(deleted.deletedBranchIds).toEqual([branch.branch.id]);
    await expect(store.getWorkshopSession(series.manifest.id, session.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "NOT_FOUND" });
    await expect(store.getWorkshopAttachment(series.manifest.id, attachment.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "NOT_FOUND" });
    expect(await store.listWorkshopBranches(series.manifest.id)).toEqual([]);
    const branchSession = await store.getWorkshopSession(series.manifest.id, branch.session.id);
    expect(branchSession.title).toBe("Keep branch copy");
    expect(branchSession.branchOfMessageId).toBeNull();
    expect(await store.listWorkshopMessages(series.manifest.id, branch.session.id)).toHaveLength(2);
  });

  it("deletes General Chat messages without leaving stale session timestamps", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopDeleteMessage" });
    const session = await store.createWorkshopSession(series.manifest.id, {
      title: "General chat thread",
      sceneId: series.scenes[0]!.metadata.id,
    });
    const first = await store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "general-chat",
      content: "Keep this question.",
    });
    const second = await saveServerWorkshopMessage(store, series.manifest.id, session.id, {
      role: "assistant",
      mode: "general-chat",
      content: "Delete this answer.",
    });

    const deleted = await store.deleteWorkshopMessage(series.manifest.id, session.id, second.id);
    expect(deleted.deletedId).toBe(second.id);
    expect(deleted.session.lastMessageAt).toBe(first.createdAt);
    expect((await store.listWorkshopMessages(series.manifest.id, session.id)).map((message) => message.id))
      .toEqual([first.id]);

    const deletedFirst = await store.deleteWorkshopMessage(series.manifest.id, session.id, first.id);
    expect(deletedFirst.session.lastMessageAt).toBeNull();
    expect(await store.listWorkshopMessages(series.manifest.id, session.id)).toEqual([]);
  });

  it("resends a General Chat author message by replacing it and truncating later history", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopResendMessage" });
    const session = await store.createWorkshopSession(series.manifest.id, {
      title: "General chat thread",
      sceneId: series.scenes[0]!.metadata.id,
    });
    const first = await store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "general-chat",
      content: "Original question.",
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const firstAnswer = await saveServerWorkshopMessage(store, series.manifest.id, session.id, {
      role: "assistant",
      mode: "general-chat",
      content: "Original answer.",
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const laterAttachment = await store.createWorkshopAttachment(series.manifest.id, session.id, workshopAttachment({
      seriesId: series.manifest.id,
      sessionId: session.id,
      draftToken: "resend-draft",
      extractedText: "Later attachment should be removed.",
      textHash: textHash("Later attachment should be removed."),
    }));
    const laterQuestion = await store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "general-chat",
      content: "Later question.",
      attachmentIds: [laterAttachment.id],
      draftToken: "resend-draft",
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const laterAnswer = await saveServerWorkshopMessage(store, series.manifest.id, session.id, {
      role: "assistant",
      mode: "general-chat",
      content: "Later answer.",
    });
    const branch = await store.branchWorkshopSession(series.manifest.id, session.id, {
      sourceMessageId: firstAnswer.id,
      title: "Old answer branch",
    });

    const result = await store.replaceWorkshopGeneralChatAuthorMessage(
      series.manifest.id,
      session.id,
      first.id,
      "  Updated question.  ",
    );

    expect(result.message).toMatchObject({
      id: first.id,
      content: "Updated question.",
      role: "author",
      mode: "general-chat",
    });
    expect(result.session.lastMessageAt).toBe(first.createdAt);
    expect(result.deletedMessageIds).toEqual([firstAnswer.id, laterQuestion.id, laterAnswer.id]);
    expect(result.deletedAttachmentIds).toEqual([laterAttachment.id]);
    expect(result.deletedBranchIds).toEqual([branch.branch.id]);
    expect((await store.listWorkshopMessages(series.manifest.id, session.id)).map((message) => message.content))
      .toEqual(["Updated question."]);
    await expect(store.getWorkshopAttachment(series.manifest.id, laterAttachment.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "NOT_FOUND" });
    expect(await store.listWorkshopBranches(series.manifest.id)).toEqual([]);
    expect((await store.getWorkshopSession(series.manifest.id, branch.session.id)).branchOfMessageId).toBeNull();
    expect(await store.listWorkshopMessages(series.manifest.id, branch.session.id)).toHaveLength(2);
  });

  it("rejects resend outside General Chat and when later protected records would be erased", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopResendGuard" });
    const chatSession = await store.createWorkshopSession(series.manifest.id, {
      title: "Guarded chat",
    });
    const first = await store.createWorkshopMessage(series.manifest.id, chatSession.id, {
      role: "author",
      mode: "general-chat",
      content: "Original question.",
    });
    const protectedResult = await store.saveWorkshopMessage(series.manifest.id, {
      schemaVersion: 1,
      id: randomUUID(),
      seriesId: series.manifest.id,
      sessionId: chatSession.id,
      role: "result",
      mode: "general-chat",
      status: "succeeded",
      content: "Protected tool result.",
      reasoningContent: "",
      contextBundleId: null,
      modelCallId: null,
      proposalIds: [],
      attachmentIds: [],
      errorCode: null,
      errorMessage: null,
      createdAt: new Date(new Date(first.createdAt).getTime() + 1_000).toISOString(),
    });
    await expect(store.replaceWorkshopGeneralChatAuthorMessage(
      series.manifest.id,
      chatSession.id,
      first.id,
      "Updated question.",
    )).rejects.toMatchObject<Partial<StorageError>>({
      code: "INVALID_DATA",
      message: "Workshop history after this message contains protected records",
    });
    expect((await store.listWorkshopMessages(series.manifest.id, chatSession.id)).map((message) => message.id))
      .toEqual([first.id, protectedResult.id]);

    const agentSession = await store.createWorkshopSession(series.manifest.id, {
      kind: "agent",
      title: "Agent thread",
    });
    const agentAuthor = await store.createWorkshopMessage(series.manifest.id, agentSession.id, {
      role: "author",
      mode: "agent",
      content: "Draft a Codex entry.",
    });
    await expect(store.replaceWorkshopGeneralChatAuthorMessage(
      series.manifest.id,
      agentSession.id,
      agentAuthor.id,
      "Updated Agent request.",
    )).rejects.toMatchObject<Partial<StorageError>>({
      code: "INVALID_DATA",
      message: "Only General Chat sessions can resend messages",
    });
  });

  it("persists and deletes draft Workshop message attachments", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopAttachmentDraft" });
    const session = await store.createWorkshopSession(series.manifest.id, {
      title: "Attachment draft",
      sceneId: series.scenes[0]!.metadata.id,
    });
    const created = await store.createWorkshopAttachment(series.manifest.id, session.id, workshopAttachment({
      seriesId: series.manifest.id,
      sessionId: session.id,
      extractedText: "This markdown attachment is ready.",
      textHash: textHash("This markdown attachment is ready."),
    }));

    const reloaded = new ProjectRepository(store.libraryRoot);
    const attachments = await reloaded.listWorkshopAttachments(series.manifest.id, session.id, {
      draftToken: "draft-1",
    });
    expect(attachments).toHaveLength(1);
    expect(attachments[0]).toMatchObject({
      id: created.id,
      messageId: null,
      parseStatus: "parsed",
      extractedText: "This markdown attachment is ready.",
    });

    const deleted = await reloaded.deleteWorkshopAttachment(series.manifest.id, session.id, created.id);
    expect(deleted.deletedId).toBe(created.id);
    expect(await reloaded.listWorkshopAttachments(series.manifest.id, session.id)).toEqual([]);
  });

  it("binds parsed draft attachments to messages and cascades unlinked message deletion", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopAttachmentBind" });
    const session = await store.createWorkshopSession(series.manifest.id, {
      title: "Attachment bind",
      sceneId: series.scenes[0]!.metadata.id,
    });
    const attachment = await store.createWorkshopAttachment(series.manifest.id, session.id, workshopAttachment({
      seriesId: series.manifest.id,
      sessionId: session.id,
      draftToken: "draft-bind",
      extractedText: "Bound attachment text.",
      textHash: textHash("Bound attachment text."),
    }));
    const failedAttachment = await store.createWorkshopAttachment(series.manifest.id, session.id, workshopAttachment({
      seriesId: series.manifest.id,
      sessionId: session.id,
      draftToken: "draft-failed",
      fileName: "scan.pdf",
      mediaType: "application/pdf",
      parseStatus: "failed",
      textHash: null,
      extractedText: "",
      parseError: "PDF has no extractable text; OCR is required.",
    }));
    const otherSession = await store.createWorkshopSession(series.manifest.id, {
      title: "Other session",
      sceneId: series.scenes[0]!.metadata.id,
    });
    const otherAttachment = await store.createWorkshopAttachment(series.manifest.id, otherSession.id, workshopAttachment({
      seriesId: series.manifest.id,
      sessionId: otherSession.id,
      draftToken: "draft-bind",
    }));

    await expect(store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "general-chat",
      content: "Wrong draft token.",
      attachmentIds: [attachment.id],
      draftToken: "other-draft",
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    await expect(store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "general-chat",
      content: "Failed attachment.",
      attachmentIds: [failedAttachment.id],
      draftToken: "draft-failed",
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    await expect(store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "general-chat",
      content: "Cross-session attachment.",
      attachmentIds: [otherAttachment.id],
      draftToken: "draft-bind",
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });

    const message = await store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "author",
      mode: "general-chat",
      content: "Use the attachment.",
      attachmentIds: [attachment.id],
      draftToken: "draft-bind",
    });
    expect(message.attachmentIds).toEqual([attachment.id]);
    const boundAttachment = await store.getWorkshopAttachment(series.manifest.id, attachment.id);
    expect(boundAttachment.messageId).toBe(message.id);
    await expect(store.deleteWorkshopAttachment(series.manifest.id, session.id, attachment.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });

    const deleted = await store.deleteWorkshopMessage(series.manifest.id, session.id, message.id);
    expect(deleted.deletedAttachmentIds).toEqual([attachment.id]);
    await expect(store.getWorkshopAttachment(series.manifest.id, attachment.id))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "NOT_FOUND" });
  });

  it("updates context basket refs and rejects missing scene targets", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopBasket" });
    const scene = series.scenes[0]!;
    const session = await store.createWorkshopSession(series.manifest.id, {
      title: "Context thread",
      sceneId: scene.metadata.id,
    });
    const item = {
      id: "11111111-1111-4111-8111-111111111111",
      kind: "scene" as const,
      sourceId: scene.metadata.id,
      label: scene.metadata.title,
      pinned: false,
      note: "",
      createdAt: "2026-07-01T00:00:00.000Z",
    };

    const basket = await store.updateWorkshopContextBasket(series.manifest.id, session.id, {
      items: [item],
    });
    expect(basket.items[0]).toMatchObject({ pinned: false });

    const pinned = await store.updateWorkshopContextBasket(series.manifest.id, session.id, {
      items: [{ ...item, pinned: true }],
    });
    expect(pinned.items[0]).toMatchObject({ pinned: true });

    await expect(store.updateWorkshopContextBasket(series.manifest.id, session.id, {
      items: [{ ...item, sourceId: "22222222-2222-4222-8222-222222222222" }],
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "NOT_FOUND" });
  });

  it("creates linked Proposals from Workshop messages and reports unavailable sources", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopProposal" });
    const scene = series.scenes[0]!;
    const session = await store.createWorkshopSession(series.manifest.id, {
      title: "Proposal thread",
      sceneId: scene.metadata.id,
    });
    const message = await saveServerWorkshopMessage(store, series.manifest.id, session.id, {
      role: "assistant",
      content: "Insert this continuity-safe replacement beat.",
    });
    const target = {
      kind: "scene-content" as const,
      targetId: scene.metadata.id,
      label: scene.metadata.title,
      baseRevision: scene.revision,
      fieldPath: [],
      blockId: null,
      range: null,
    };

    const result = await store.createProposalFromWorkshopMessage(series.manifest.id, session.id, message.id, {
      type: "text-insertion",
      title: "Insert Workshop beat",
      summary: "Workshop candidate",
      target,
      riskLevel: "medium",
      confidence: null,
      reason: "Review before applying.",
      patches: [{
        id: "11111111-1111-4111-8111-111111111111",
        target,
        action: "insert-text",
        before: null,
        after: "Insert this continuity-safe replacement beat.",
        unifiedDiff: "+Insert this continuity-safe replacement beat.",
      }],
      evidence: [{
        sourceType: "workshop-message",
        sourceId: message.id,
        revision: null,
        quote: "",
        note: "Workshop source message.",
      }],
    });

    expect(result.proposal.proposal.source).toMatchObject({
      kind: "workshop-message",
      sourceId: message.id,
      label: "Proposal thread",
    });
    expect(result.message.proposalIds).toEqual([result.proposal.proposal.id]);
    const messages = await store.listWorkshopMessages(series.manifest.id, session.id);
    expect(messages[0]?.proposalIds).toEqual([result.proposal.proposal.id]);
    await expect(store.deleteWorkshopMessage(series.manifest.id, session.id, message.id))
      .rejects.toMatchObject<Partial<StorageError>>({
        code: "INVALID_DATA",
        message: "Workshop messages linked to Proposals cannot be deleted",
      });
    await expect(store.deleteWorkshopSession(series.manifest.id, session.id))
      .rejects.toMatchObject<Partial<StorageError>>({
        code: "INVALID_DATA",
        message: "Workshop sessions with Proposal-linked messages cannot be deleted",
      });

    await store.archiveWorkshopSession(series.manifest.id, session.id);
    const archivedSource = await store.getProposal(series.manifest.id, result.proposal.proposal.id);
    expect(archivedSource.sourceAvailability).toEqual({
      available: false,
      reason: "Source Workshop session is archived",
    });

    await rm(
      workshopMessagePath(seriesRoot(store, "WorkshopProposal", series.manifest.id), message.id),
      { force: true },
    );
    const missingSource = await store.getProposal(series.manifest.id, result.proposal.proposal.id);
    expect(missingSource.sourceAvailability).toMatchObject({
      available: false,
      reason: "Workshop message does not exist",
    });
  });

  it("rejects Proposal creation from General Chat Workshop messages", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopGeneralChatProposal" });
    const scene = series.scenes[0]!;
    const session = await store.createWorkshopSession(series.manifest.id, {
      title: "General chat thread",
      sceneId: scene.metadata.id,
    });
    const message = await saveServerWorkshopMessage(store, series.manifest.id, session.id, {
      role: "assistant",
      mode: "general-chat",
      content: "This is a discussion response, not a write candidate.",
    });
    const target = {
      kind: "scene-content" as const,
      targetId: scene.metadata.id,
      label: scene.metadata.title,
      baseRevision: scene.revision,
      fieldPath: [],
      blockId: null,
      range: null,
    };

    await expect(store.createProposalFromWorkshopMessage(series.manifest.id, session.id, message.id, {
      type: "text-insertion",
      title: "Blocked General Chat proposal",
      summary: "Should not be allowed",
      target,
      riskLevel: "medium",
      confidence: null,
      reason: "General Chat is not Review input.",
      patches: [{
        id: "11111111-1111-4111-8111-111111111111",
        target,
        action: "insert-text",
        before: null,
        after: message.content,
        unifiedDiff: `+${message.content}`,
      }],
      evidence: [{
        sourceType: "workshop-message",
        sourceId: message.id,
        revision: null,
        quote: "",
        note: "General Chat source.",
      }],
    })).rejects.toMatchObject<Partial<StorageError>>({
      code: "INVALID_DATA",
      message: "General Chat messages cannot create Proposals",
    });
  });

  it("keeps Workshop Agent and chat messages isolated by session kind", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopAgentIsolation" });
    const chatSession = await store.createWorkshopSession(series.manifest.id, {
      title: "Chat thread",
    });
    const agentSession = await store.createWorkshopSession(series.manifest.id, {
      kind: "agent",
      title: "Agent thread",
    });

    await expect(store.createWorkshopMessage(series.manifest.id, chatSession.id, {
      role: "author",
      mode: "agent",
      content: "Create a Codex entry.",
    })).rejects.toMatchObject<Partial<StorageError>>({
      code: "INVALID_DATA",
      message: "General Workshop chat sessions cannot receive Agent messages",
    });

    await expect(store.createWorkshopMessage(series.manifest.id, agentSession.id, {
      role: "author",
      mode: "general-chat",
      content: "Talk normally.",
    })).rejects.toMatchObject<Partial<StorageError>>({
      code: "INVALID_DATA",
      message: "Agent Workshop sessions can only receive Agent messages",
    });

    const message = await store.createWorkshopMessage(series.manifest.id, agentSession.id, {
      role: "author",
      mode: "agent",
      content: "Create a Codex entry.",
    });
    expect(message.mode).toBe("agent");
  });

  it("rejects generic scene Proposals from Agent Workshop messages", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopCodexCreationProposal" });
    const scene = series.scenes[0]!;
    const session = await store.createWorkshopSession(series.manifest.id, {
      kind: "agent",
      title: "Agent thread",
      sceneId: scene.metadata.id,
    });
    const message = await saveServerWorkshopMessage(store, series.manifest.id, session.id, {
      role: "assistant",
      mode: "agent",
      content: "Prepared an Agent-only Codex draft.",
    });
    const target = {
      kind: "scene-content" as const,
      targetId: scene.metadata.id,
      label: scene.metadata.title,
      baseRevision: scene.revision,
      fieldPath: [],
      blockId: null,
      range: null,
    };

    await expect(store.createProposalFromWorkshopMessage(series.manifest.id, session.id, message.id, {
      type: "text-insertion",
      title: "Blocked Agent proposal",
      summary: "Should not be routed to manuscript Review",
      target,
      riskLevel: "medium",
      confidence: null,
      reason: "Agent needs a tool adapter.",
      patches: [{
        id: "11111111-1111-4111-8111-111111111111",
        target,
        action: "insert-text",
        before: null,
        after: message.content,
        unifiedDiff: `+${message.content}`,
      }],
      evidence: [{
        sourceType: "workshop-message",
        sourceId: message.id,
        revision: null,
        quote: "",
        note: "Agent source.",
      }],
    })).rejects.toMatchObject<Partial<StorageError>>({
      code: "INVALID_DATA",
      message: "Agent messages require an approved tool adapter or dedicated Proposal path",
    });
  });
});
