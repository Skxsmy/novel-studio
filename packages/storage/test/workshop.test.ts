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
    const message = await store.createWorkshopMessage(series.manifest.id, session.id, {
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
    const second = await store.createWorkshopMessage(series.manifest.id, session.id, {
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
    const message = await store.createWorkshopMessage(series.manifest.id, session.id, {
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
    const message = await store.createWorkshopMessage(series.manifest.id, session.id, {
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
});
