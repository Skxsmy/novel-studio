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

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("M5 Workshop storage", () => {
  it("persists sessions and messages as reloadable JSON authority", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "WorkshopStorage" });
    const scene = series.scenes[0]!;
    const session = await store.createWorkshopSession(series.manifest.id, {
      title: "Scene continuity pass",
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
    const message = await store.createWorkshopMessage(series.manifest.id, session.id, {
      role: "assistant",
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
});
