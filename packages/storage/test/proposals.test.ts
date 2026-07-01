import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectRepository, StorageError } from "../src/index.js";
import { proposalSnapshotPath } from "../src/proposalFiles.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

async function repository(): Promise<ProjectRepository> {
  const root = await mkdtemp(path.join(tmpdir(), "novel-studio-proposals-"));
  temporaryDirectories.push(root);
  return new ProjectRepository(root);
}

function seriesRoot(store: ProjectRepository, title: string, seriesId: string): string {
  return path.join(store.libraryRoot, `${title}-${seriesId.slice(0, 8)}`);
}

function target(scene: { metadata: { id: string; title: string }; revision: string }) {
  return {
    kind: "scene-content" as const,
    targetId: scene.metadata.id,
    label: scene.metadata.title,
    baseRevision: scene.revision,
    fieldPath: [],
    blockId: null,
    range: null,
  };
}

function replacementProposalInput(input: {
  id?: string;
  seriesId: string;
  scene: { metadata: { id: string; title: string }; revision: string };
  before: string;
  after: string;
}) {
  const patchTarget = target(input.scene);
  return {
    id: input.id,
    type: "text-replacement" as const,
    title: "Replace opening line",
    summary: "Replace a stale draft line.",
    source: {
      kind: "manual" as const,
      sourceId: null,
      label: "Author request",
      detail: "",
    },
    target: patchTarget,
    contextBundleId: null,
    generator: { kind: "manual" as const, actor: "user" },
    riskLevel: "medium" as const,
    confidence: null,
    reason: "The old line is weaker than the revised line.",
    patches: [
      {
        id: randomUUID(),
        target: patchTarget,
        action: "replace-text" as const,
        before: input.before,
        after: input.after,
        unifiedDiff: `-${input.before}\n+${input.after}`,
      },
    ],
    evidence: [],
  };
}

describe("M5 Proposal storage", () => {
  it("accepts a scene-content Proposal by snapshotting before the authority write", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "ProposalFlow" });
    const initial = series.scenes[0]!;
    const scene = await store.updateScene(series.manifest.id, initial.metadata.id, {
      baseRevision: initial.revision,
      title: "Opening",
      content: "Old paragraph.\n\nSecond paragraph.",
    });
    const created = await store.createProposal(
      series.manifest.id,
      replacementProposalInput({
        seriesId: series.manifest.id,
        scene,
        before: "Old paragraph.",
        after: "New paragraph.",
      }),
    );

    expect(created.proposal.status).toBe("pending");
    const accepted = await store.acceptProposal(series.manifest.id, created.proposal.id, {
      baseRevision: created.revision,
      actor: "user",
      note: "Approved after review.",
    });

    expect(accepted.proposal.proposal.status).toBe("accepted");
    expect(accepted.snapshot?.proposalId).toBe(created.proposal.id);
    const updatedScene = await store.getScene(series.manifest.id, scene.metadata.id);
    expect(updatedScene.content).toContain("New paragraph.");
    expect(updatedScene.content).not.toContain("Old paragraph.");
    const snapshotRaw = await readFile(
      proposalSnapshotPath(
        seriesRoot(store, "ProposalFlow", series.manifest.id),
        accepted.snapshot!.id,
      ),
      "utf8",
    );
    expect(snapshotRaw).toContain("Old paragraph.");
  });

  it("isolates corrupted Proposal files while keeping valid inbox items readable", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "ProposalCorrupt" });
    const scene = series.scenes[0]!;
    await store.createProposal(
      series.manifest.id,
      replacementProposalInput({
        seriesId: series.manifest.id,
        scene,
        before: "",
        after: "Inserted text.",
      }),
    );
    const inboxRoot = path.join(
      seriesRoot(store, "ProposalCorrupt", series.manifest.id),
      ".studio",
      "inbox",
      "proposals",
    );
    await mkdir(inboxRoot, { recursive: true });
    await writeFile(path.join(inboxRoot, "bad.json"), "{ not json", "utf8");

    const inbox = await store.listProposals(series.manifest.id);

    expect(inbox.items).toHaveLength(1);
    expect(inbox.diagnostics).toEqual([
      expect.objectContaining({ fileName: "bad.json", code: "INVALID_DATA" }),
    ]);
  });

  it("rejects duplicate ids, unavailable sources, and stale target revisions", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "ProposalGuards" });
    const initial = series.scenes[0]!;
    const scene = await store.updateScene(series.manifest.id, initial.metadata.id, {
      baseRevision: initial.revision,
      title: "Opening",
      content: "Original text.",
    });
    const proposalId = randomUUID();
    const input = replacementProposalInput({
      id: proposalId,
      seriesId: series.manifest.id,
      scene,
      before: "Original text.",
      after: "Accepted text.",
    });
    const created = await store.createProposal(series.manifest.id, input);
    await expect(store.createProposal(series.manifest.id, input))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });

    await expect(
      store.createProposal(series.manifest.id, {
        ...replacementProposalInput({
          seriesId: series.manifest.id,
          scene,
          before: "Original text.",
          after: "Another text.",
        }),
        source: {
          kind: "model-call" as const,
          sourceId: randomUUID(),
          label: "Missing call",
          detail: "",
        },
      }),
    ).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });

    await store.updateScene(series.manifest.id, scene.metadata.id, {
      baseRevision: scene.revision,
      title: scene.metadata.title,
      content: "Changed outside review.",
    });
    const preview = await store.previewProposalBatch(series.manifest.id, {
      proposalIds: [created.proposal.id],
    });
    expect(preview.items[0]).toMatchObject({
      proposalId: created.proposal.id,
      eligible: false,
      reason: "Target changed since Proposal creation",
    });
    await expect(
      store.acceptProposal(series.manifest.id, created.proposal.id, {
        baseRevision: created.revision,
        actor: "user",
        note: "",
      }),
    ).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });
  });
});
