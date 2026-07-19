import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import type { ContextBundle, ModelCallLog } from "@novel-studio/contracts";
import { afterEach, describe, expect, it } from "vitest";
import {
  ProjectRepository,
  StorageError,
  type PreparedResearchSourceImport,
} from "../src/index.js";
import { proposalSnapshotPath } from "../src/proposalFiles.js";

const temporaryDirectories: string[] = [];
const HASH = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

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

function researchImport(originalText: string): PreparedResearchSourceImport {
  const originalBytes = Buffer.from(originalText, "utf8");
  return {
    kind: "markdown",
    mediaType: "text/markdown",
    originalFileName: "proposal-evidence.md",
    originalBytes,
    sizeBytes: originalBytes.byteLength,
    contentHash: createHash("sha256").update(originalBytes).digest("hex"),
    properties: {
      displayName: "Harbor archive",
      author: "Archive editor",
      declaredLanguage: "en",
      tags: ["harbor"],
      aiPermission: "never",
      useNotes: "NS-609 Proposal fixture",
    },
    origin: { type: "file" },
    content: {
      title: "Harbor archive",
      parserName: "ns-609-proposal-test",
      parserVersion: 1,
      warnings: [],
      sections: [],
      blocks: [{
        order: 0,
        sectionOrder: null,
        kind: "paragraph",
        text: originalText,
        location: {
          kind: "text",
          startLine: 1,
          endLine: 1,
          startOffset: 0,
          endOffset: originalText.length,
        },
      }],
    },
  };
}

function researchCapture(source: Awaited<ReturnType<ProjectRepository["getResearchSource"]>>) {
  if (!("content" in source)) throw new Error("Expected a version 3 Research Source");
  const chunk = source.content.chunks[0]!;
  return {
    sourceId: source.source.id,
    sourceRevision: source.revision,
    blockId: chunk.blockId,
    chunkId: chunk.id,
    chunkHash: chunk.textHash,
  };
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

function contextBundle(seriesId: string, sceneId: string, contextBundleId = randomUUID()): ContextBundle {
  const now = "2026-07-01T00:00:00.000Z";
  return {
    schemaVersion: 2,
    id: contextBundleId,
    seriesId,
    sceneId,
    roleId: "role-context-checker",
    taskKind: "continuity-check",
    userRequest: "Check the scene.",
    promptTemplateId: randomUUID(),
    promptTemplateVersion: 1,
    items: [
      {
        id: "user-request",
        kind: "user-request",
        source: { type: "user-input", id: null, revision: null, label: "Request" },
        title: "Request",
        content: "Check the scene.",
        inclusion: "required",
        inclusionReason: "Test request.",
        contextPolicy: null,
        tokenEstimate: 4,
        manuallySelected: false,
        textHash: HASH,
        sourceRefs: [],
      },
    ],
    excluded: [],
    estimatedUsage: { inputTokens: 4, outputTokens: 0, totalTokens: 4 },
    createdAt: now,
  };
}

function modelCallLog(
  seriesId: string,
  sceneId: string,
  bundle: ContextBundle,
  modelCallId = randomUUID(),
): ModelCallLog {
  const now = "2026-07-01T00:00:00.000Z";
  return {
    schemaVersion: 2,
    id: modelCallId,
    seriesId,
    sceneId,
    roleId: bundle.roleId,
    taskKind: bundle.taskKind,
    provider: "mock",
    model: "mock-model",
    contextBundleId: bundle.id,
    promptTemplateId: bundle.promptTemplateId,
    promptTemplateVersion: bundle.promptTemplateVersion,
    requestHash: HASH,
    responseHash: HASH,
    status: "succeeded",
    resolvedParameters: {},
    estimatedUsage: bundle.estimatedUsage,
    actualUsage: { inputTokens: 4, outputTokens: 2, totalTokens: 6 },
    errorCode: null,
    errorMessage: null,
    error: null,
    startedAt: now,
    completedAt: now,
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

    const bundle = contextBundle(series.manifest.id, scene.metadata.id);
    await store.saveContextBundle(series.manifest.id, bundle);
    const otherBundle = contextBundle(series.manifest.id, scene.metadata.id);
    await store.saveContextBundle(series.manifest.id, otherBundle);
    const mismatchedLog = modelCallLog(series.manifest.id, scene.metadata.id, otherBundle);
    await store.saveModelCallLog(series.manifest.id, mismatchedLog);
    await expect(
      store.createProposal(series.manifest.id, {
        ...replacementProposalInput({
          seriesId: series.manifest.id,
          scene,
          before: "Original text.",
          after: "Mismatched AI text.",
        }),
        contextBundleId: bundle.id,
        generator: {
          kind: "ai" as const,
          roleId: bundle.roleId,
          modelCallLogId: mismatchedLog.id,
          provider: "mock" as const,
          model: "mock-model",
          promptTemplateId: bundle.promptTemplateId,
          promptTemplateVersion: bundle.promptTemplateVersion,
        },
      }),
    ).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });

    await expect(
      store.createProposal(series.manifest.id, {
        ...replacementProposalInput({
          seriesId: series.manifest.id,
          scene,
          before: "Original text.",
          after: "Workshop text.",
        }),
        source: {
          kind: "workshop-message" as const,
          sourceId: randomUUID(),
          label: "Missing Workshop message",
          detail: "",
        },
      }),
    ).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });

    await expect(
      store.createProposal(series.manifest.id, {
        ...replacementProposalInput({
          seriesId: series.manifest.id,
          scene,
          before: "Original text.",
          after: "Context text.",
        }),
        contextBundleId: randomUUID(),
      }),
    ).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });

    await expect(
      store.createProposal(series.manifest.id, {
        ...replacementProposalInput({
          seriesId: series.manifest.id,
          scene,
          before: "Original text.",
          after: "AI text.",
        }),
        contextBundleId: bundle.id,
        generator: {
          kind: "ai" as const,
          roleId: bundle.roleId,
          modelCallLogId: randomUUID(),
          provider: "mock" as const,
          model: "mock-model",
          promptTemplateId: bundle.promptTemplateId,
          promptTemplateVersion: bundle.promptTemplateVersion,
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

  it("blocks intra-batch scene conflicts and accepts only previewed revisions", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "ProposalBatchGuards" });
    const initial = series.scenes[0]!;
    const scene = await store.updateScene(series.manifest.id, initial.metadata.id, {
      baseRevision: initial.revision,
      title: "Opening",
      content: "Original text.",
    });
    const first = await store.createProposal(
      series.manifest.id,
      replacementProposalInput({
        seriesId: series.manifest.id,
        scene,
        before: "Original text.",
        after: "First text.",
      }),
    );
    const second = await store.createProposal(
      series.manifest.id,
      replacementProposalInput({
        seriesId: series.manifest.id,
        scene,
        before: "Original text.",
        after: "Second text.",
      }),
    );

    const preview = await store.previewProposalBatch(series.manifest.id, {
      proposalIds: [first.proposal.id, second.proposal.id],
    });

    expect(preview.items[0]).toMatchObject({
      proposalId: first.proposal.id,
      revision: first.revision,
      eligible: true,
    });
    expect(preview.items[1]).toMatchObject({
      proposalId: second.proposal.id,
      revision: second.revision,
      eligible: false,
      reason: "Another Proposal in this batch changes the same scene first",
    });

    const accepted = await store.acceptProposalBatch(series.manifest.id, {
      items: [{ proposalId: first.proposal.id, baseRevision: first.revision }],
      actor: "user",
      note: "Accept only previewed revision.",
    });

    expect(accepted.completed).toHaveLength(1);
    expect(accepted.blocked).toEqual([]);
    expect(accepted.skipped).toEqual([]);
    expect(accepted.failed).toEqual([]);
  });

  it("creates pending Research Note promotions without changing existing or new Codex targets", async () => {
    const store = await repository();
    const series = await store.createSeries({ title: "ResearchPromotion" });
    const database = await store.createResearchDatabase({ name: "Independent archive" });
    const source = await store.importResearchSource(
      database.database.id,
      researchImport("The harbor bell marked the legal opening of the market."),
    );
    const note = await store.createResearchNote(database.database.id, {
      title: "Harbor bell custom",
      body: "The bell can become binding law in the fictional port.",
      evidence: [researchCapture(source)],
    });
    const existing = await store.createCodexEntry(series.manifest.id, {
      categoryId: "location",
      name: "Salt Harbor",
      description: "An old trading port.",
      research: "Existing non-Canon notes.",
    });

    const existingPromotion = await store.createResearchNotePromotion(
      database.database.id,
      note.note.id,
      {
        seriesId: series.manifest.id,
        baseRevision: note.revision,
        meaning: "world-rule",
        target: {
          kind: "existing",
          entryId: existing.metadata.id,
          targetRevision: existing.revision,
        },
        candidateText: "The market may open only after the harbor bell rings.",
      },
    );
    expect(existingPromotion).toMatchObject({
      proposal: {
        status: "pending",
        type: "codex-update",
        source: { kind: "research-note", sourceId: note.note.id },
        target: { kind: "codex-entry", targetId: existing.metadata.id },
      },
      sourceAvailability: { available: true },
      targetAvailability: { available: true },
    });
    expect((await store.getCodexEntry(series.manifest.id, existing.metadata.id))).toMatchObject({
      description: "An old trading port.",
      research: { content: "Existing non-Canon notes." },
      revision: existing.revision,
    });

    const entryCountBeforeNewPromotion = (await store.listCodexEntries(series.manifest.id)).length;
    const newPromotion = await store.createResearchNotePromotion(database.database.id, note.note.id, {
      seriesId: series.manifest.id,
      baseRevision: note.revision,
      meaning: "inspiration-only",
      target: { kind: "new", categoryId: "location", name: "Bell Market" },
      candidateText: "Use the archive as atmosphere, not as world law.",
    });
    expect(newPromotion.proposal).toMatchObject({
      status: "pending",
      type: "codex-create",
      target: { kind: "codex-research", baseRevision: null },
      researchNotePromotion: { target: { kind: "new", categoryId: "location", name: "Bell Market" } },
    });
    expect((await store.listCodexEntries(series.manifest.id))).toHaveLength(entryCountBeforeNewPromotion);
    await expect(store.getCodexEntry(series.manifest.id, newPromotion.proposal.target.targetId))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "NOT_FOUND" });
    expect((await store.listProposals(series.manifest.id)).items).toHaveLength(2);

    await expect(store.createResearchNotePromotion(database.database.id, note.note.id, {
      seriesId: series.manifest.id,
      baseRevision: note.revision,
      meaning: "world-rule",
      target: {
        kind: "existing",
        entryId: existing.metadata.id,
        targetRevision: "a".repeat(64),
      },
      candidateText: "Stale target must fail.",
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });
    await expect(store.createResearchNotePromotion(database.database.id, note.note.id, {
      seriesId: randomUUID(),
      baseRevision: note.revision,
      meaning: "real-world-reference",
      target: { kind: "new", categoryId: "location", name: "No Series" },
      candidateText: "No active Series must fail.",
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "NOT_FOUND" });

    const archived = await store.archiveResearchNote(database.database.id, note.note.id, {
      baseRevision: note.revision,
    });
    await expect(store.createResearchNotePromotion(database.database.id, note.note.id, {
      seriesId: series.manifest.id,
      baseRevision: archived.revision,
      meaning: "real-world-reference",
      target: { kind: "new", categoryId: "location", name: "Archived Note" },
      candidateText: "Archived Note must fail.",
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });
    expect((await store.listProposals(series.manifest.id)).items).toHaveLength(2);
  });
});
