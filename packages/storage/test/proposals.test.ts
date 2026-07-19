import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
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
import { proposalAuthorityPath, proposalSnapshotPath } from "../src/proposalFiles.js";

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

async function researchPromotionFixture(store: ProjectRepository, title: string) {
  const series = await store.createSeries({ title });
  const database = await store.createResearchDatabase({ name: `${title} archive` });
  const source = await store.importResearchSource(
    database.database.id,
    researchImport("The harbor bell marked the legal opening of the market."),
  );
  const note = await store.createResearchNote(database.database.id, {
    title: "Harbor bell custom",
    body: "The bell can become binding law in the fictional port.",
    evidence: [researchCapture(source)],
  });
  const entry = await store.createCodexEntry(series.manifest.id, {
    categoryId: "location",
    name: "Salt Harbor",
    description: "An old trading port.",
    research: "Existing non-Canon notes.",
  });
  return { series, database, source, note, entry };
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

  it("accepts existing Canon and Research promotions with exact snapshots and bounded author editing", async () => {
    const store = await repository();
    const { series, database, note, entry } = await researchPromotionFixture(
      store,
      "ResearchPromotionAccept",
    );
    const noteBefore = await store.getResearchNote(database.database.id, note.note.id);
    const canon = await store.createResearchNotePromotion(database.database.id, note.note.id, {
      seriesId: series.manifest.id,
      baseRevision: note.revision,
      meaning: "world-rule",
      target: {
        kind: "existing",
        entryId: entry.metadata.id,
        targetRevision: entry.revision,
      },
      candidateText: "The market may open only after the harbor bell rings.",
    });

    const acceptedCanon = await store.acceptProposal(series.manifest.id, canon.proposal.id, {
      baseRevision: canon.revision,
      actor: "user",
      note: "Confirmed as a fictional world rule.",
    });
    expect(acceptedCanon.proposal.proposal.status).toBe("accepted");
    expect(acceptedCanon.snapshot).toMatchObject({
      schemaVersion: 2,
      targetRevision: entry.revision,
      targetAbsent: false,
      data: { authority: { description: "An old trading port." } },
    });
    const afterCanon = await store.getCodexEntry(series.manifest.id, entry.metadata.id);
    expect(afterCanon.description).toBe(
      "An old trading port.\n\nThe market may open only after the harbor bell rings.",
    );
    expect(afterCanon.research.content).toBe("Existing non-Canon notes.");

    const research = await store.createResearchNotePromotion(database.database.id, note.note.id, {
      seriesId: series.manifest.id,
      baseRevision: note.revision,
      meaning: "real-world-reference",
      target: {
        kind: "existing",
        entryId: entry.metadata.id,
        targetRevision: afterCanon.research.revision,
      },
      candidateText: "Archive reference draft.",
    });
    const originalPatch = research.proposal.patches[0]!;
    await expect(store.editAndAcceptProposal(series.manifest.id, research.proposal.id, {
      baseRevision: research.revision,
      actor: "user",
      note: "Tampered target must not apply.",
      patches: [{
        ...originalPatch,
        target: { ...originalPatch.target, targetId: randomUUID() },
      }],
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "INVALID_DATA" });

    const editedText = "Existing non-Canon notes.\n\nAuthor-edited archive reference.";
    const acceptedResearch = await store.editAndAcceptProposal(
      series.manifest.id,
      research.proposal.id,
      {
        baseRevision: research.revision,
        actor: "user",
        note: "Kept as non-Canon reference.",
        title: "Reviewed harbor source",
        patches: [{ ...originalPatch, after: editedText }],
      },
    );
    expect(acceptedResearch.proposal.proposal).toMatchObject({
      status: "edited",
      title: "Reviewed harbor source",
      originalCandidate: { patches: [{ after: originalPatch.after }] },
      decision: { editedCandidate: { patches: [{ after: editedText }] } },
    });
    expect(acceptedResearch.snapshot).toMatchObject({
      schemaVersion: 2,
      targetRevision: afterCanon.research.revision,
      targetAbsent: false,
      data: { authority: { content: "Existing non-Canon notes." } },
    });
    const afterResearch = await store.getCodexEntry(series.manifest.id, entry.metadata.id);
    expect(afterResearch.description).toBe(afterCanon.description);
    expect(afterResearch.research.content).toBe(editedText);
    expect(await store.getResearchNote(database.database.id, note.note.id)).toEqual(noteBefore);
  });

  it("accepts a preallocated new Codex target and leaves a rejected target absent", async () => {
    const store = await repository();
    const { series, database, note } = await researchPromotionFixture(
      store,
      "ResearchPromotionCreate",
    );
    const created = await store.createResearchNotePromotion(database.database.id, note.note.id, {
      seriesId: series.manifest.id,
      baseRevision: note.revision,
      meaning: "inspiration-only",
      target: { kind: "new", categoryId: "location", name: "Bell Market" },
      candidateText: "Use the archive as atmosphere, not as world law.",
    });
    const accepted = await store.acceptProposal(series.manifest.id, created.proposal.id, {
      baseRevision: created.revision,
      actor: "user",
      note: "Create the non-Canon destination.",
    });
    expect(accepted.snapshot).toMatchObject({
      schemaVersion: 2,
      targetRevision: null,
      targetAbsent: true,
      data: {
        entryId: created.proposal.target.targetId,
        categoryId: "location",
        name: "Bell Market",
      },
    });
    const target = await store.getCodexEntry(series.manifest.id, created.proposal.target.targetId);
    expect(target).toMatchObject({
      metadata: { name: "Bell Market", categoryId: "location" },
      description: "",
      research: { content: "Use the archive as atmosphere, not as world law." },
    });
    expect(await store.searchCodex(series.manifest.id, "Bell Market")).toEqual([
      expect.objectContaining({ entryId: target.metadata.id, name: "Bell Market" }),
    ]);

    const rejected = await store.createResearchNotePromotion(database.database.id, note.note.id, {
      seriesId: series.manifest.id,
      baseRevision: note.revision,
      meaning: "world-rule",
      target: { kind: "new", categoryId: "location", name: "Rejected Port" },
      candidateText: "This must never be written.",
    });
    await store.rejectProposal(series.manifest.id, rejected.proposal.id, {
      baseRevision: rejected.revision,
      actor: "user",
      note: "Not Canon.",
    });
    await expect(store.getCodexEntry(series.manifest.id, rejected.proposal.target.targetId))
      .rejects.toMatchObject<Partial<StorageError>>({ code: "NOT_FOUND" });
  });

  it("blocks changed Note, Source, Codex target, and archived dependencies at acceptance", async () => {
    const store = await repository();

    const noteFixture = await researchPromotionFixture(store, "PromotionStaleNote");
    const noteProposal = await store.createResearchNotePromotion(
      noteFixture.database.database.id,
      noteFixture.note.note.id,
      {
        seriesId: noteFixture.series.manifest.id,
        baseRevision: noteFixture.note.revision,
        meaning: "world-rule",
        target: {
          kind: "existing",
          entryId: noteFixture.entry.metadata.id,
          targetRevision: noteFixture.entry.revision,
        },
        candidateText: "Stale Note text.",
      },
    );
    await store.updateResearchNote(noteFixture.database.database.id, noteFixture.note.note.id, {
      baseRevision: noteFixture.note.revision,
      body: "The author changed the Note after opening Review.",
    });
    await expect(store.acceptProposal(noteFixture.series.manifest.id, noteProposal.proposal.id, {
      baseRevision: noteProposal.revision,
      actor: "user",
      note: "",
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });

    const archivedNoteFixture = await researchPromotionFixture(store, "PromotionArchivedNote");
    const archivedNoteProposal = await store.createResearchNotePromotion(
      archivedNoteFixture.database.database.id,
      archivedNoteFixture.note.note.id,
      {
        seriesId: archivedNoteFixture.series.manifest.id,
        baseRevision: archivedNoteFixture.note.revision,
        meaning: "world-rule",
        target: {
          kind: "existing",
          entryId: archivedNoteFixture.entry.metadata.id,
          targetRevision: archivedNoteFixture.entry.revision,
        },
        candidateText: "Archived Note text.",
      },
    );
    await store.archiveResearchNote(
      archivedNoteFixture.database.database.id,
      archivedNoteFixture.note.note.id,
      { baseRevision: archivedNoteFixture.note.revision },
    );
    await expect(store.acceptProposal(
      archivedNoteFixture.series.manifest.id,
      archivedNoteProposal.proposal.id,
      {
        baseRevision: archivedNoteProposal.revision,
        actor: "user",
        note: "",
      },
    )).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });

    const sourceFixture = await researchPromotionFixture(store, "PromotionStaleSource");
    const sourceProposal = await store.createResearchNotePromotion(
      sourceFixture.database.database.id,
      sourceFixture.note.note.id,
      {
        seriesId: sourceFixture.series.manifest.id,
        baseRevision: sourceFixture.note.revision,
        meaning: "real-world-reference",
        target: {
          kind: "existing",
          entryId: sourceFixture.entry.metadata.id,
          targetRevision: sourceFixture.entry.research.revision,
        },
        candidateText: "Stale Source text.",
      },
    );
    await store.updateResearchSource(sourceFixture.database.database.id, sourceFixture.source.source.id, {
      baseRevision: sourceFixture.source.revision,
      displayName: "Renamed source after Review opened",
    });
    await expect(store.acceptProposal(sourceFixture.series.manifest.id, sourceProposal.proposal.id, {
      baseRevision: sourceProposal.revision,
      actor: "user",
      note: "",
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });

    const targetFixture = await researchPromotionFixture(store, "PromotionStaleTarget");
    const targetProposal = await store.createResearchNotePromotion(
      targetFixture.database.database.id,
      targetFixture.note.note.id,
      {
        seriesId: targetFixture.series.manifest.id,
        baseRevision: targetFixture.note.revision,
        meaning: "world-rule",
        target: {
          kind: "existing",
          entryId: targetFixture.entry.metadata.id,
          targetRevision: targetFixture.entry.revision,
        },
        candidateText: "Stale target text.",
      },
    );
    const changedTarget = await store.updateCodexEntry(
      targetFixture.series.manifest.id,
      targetFixture.entry.metadata.id,
      {
        baseRevision: targetFixture.entry.revision,
        description: "The author changed Canon outside Review.",
      },
    );
    await expect(store.acceptProposal(targetFixture.series.manifest.id, targetProposal.proposal.id, {
      baseRevision: targetProposal.revision,
      actor: "user",
      note: "",
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });

    const archivedProposal = await store.createResearchNotePromotion(
      targetFixture.database.database.id,
      targetFixture.note.note.id,
      {
        seriesId: targetFixture.series.manifest.id,
        baseRevision: targetFixture.note.revision,
        meaning: "world-rule",
        target: {
          kind: "existing",
          entryId: changedTarget.metadata.id,
          targetRevision: changedTarget.revision,
        },
        candidateText: "Archived target text.",
      },
    );
    await store.archiveCodexEntry(targetFixture.series.manifest.id, changedTarget.metadata.id, {
      baseRevision: changedTarget.revision,
    });
    await expect(store.acceptProposal(targetFixture.series.manifest.id, archivedProposal.proposal.id, {
      baseRevision: archivedProposal.revision,
      actor: "user",
      note: "",
    })).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });

    const collisionFixture = await researchPromotionFixture(store, "PromotionTargetCollision");
    const collisionProposal = await store.createResearchNotePromotion(
      collisionFixture.database.database.id,
      collisionFixture.note.note.id,
      {
        seriesId: collisionFixture.series.manifest.id,
        baseRevision: collisionFixture.note.revision,
        meaning: "inspiration-only",
        target: { kind: "new", categoryId: "location", name: "Reserved Harbor" },
        candidateText: "The reserved target must remain absent until acceptance.",
      },
    );
    const collisionRoot = seriesRoot(
      store,
      "PromotionTargetCollision",
      collisionFixture.series.manifest.id,
    );
    const collisionEntryId = collisionProposal.proposal.target.targetId;
    const collisionTime = new Date().toISOString();
    const collisionEntryPath = path.join(
      collisionRoot,
      path.dirname(collisionFixture.entry.relativePath),
      `${collisionEntryId}.json`,
    );
    const collisionResearchPath = path.join(
      collisionRoot,
      path.dirname(collisionFixture.entry.research.relativePath),
      `${collisionEntryId}.json`,
    );
    await writeFile(collisionEntryPath, JSON.stringify({
      metadata: {
        ...collisionFixture.entry.metadata,
        id: collisionEntryId,
        name: "Conflicting authority",
        createdAt: collisionTime,
        updatedAt: collisionTime,
      },
      description: "Created outside Review.",
    }), "utf8");
    await writeFile(collisionResearchPath, JSON.stringify({
      metadata: {
        ...collisionFixture.entry.research.metadata,
        entryId: collisionEntryId,
        createdAt: collisionTime,
        updatedAt: collisionTime,
      },
      content: "Collision research.",
    }), "utf8");
    await expect(store.acceptProposal(
      collisionFixture.series.manifest.id,
      collisionProposal.proposal.id,
      {
        baseRevision: collisionProposal.revision,
        actor: "user",
        note: "",
      },
    )).rejects.toMatchObject<Partial<StorageError>>({ code: "CONFLICT" });
    expect((await store.getCodexEntry(
      collisionFixture.series.manifest.id,
      collisionEntryId,
    )).description).toBe("Created outside Review.");
  });

  it("rolls back every authority on injected failure and applies concurrent acceptance exactly once", async () => {
    const store = await repository();
    const failedFixture = await researchPromotionFixture(store, "PromotionAtomicFailure");
    const failedProposal = await store.createResearchNotePromotion(
      failedFixture.database.database.id,
      failedFixture.note.note.id,
      {
        seriesId: failedFixture.series.manifest.id,
        baseRevision: failedFixture.note.revision,
        meaning: "world-rule",
        target: {
          kind: "existing",
          entryId: failedFixture.entry.metadata.id,
          targetRevision: failedFixture.entry.revision,
        },
        candidateText: "Atomic failure candidate.",
      },
    );
    const failedRoot = seriesRoot(
      store,
      "PromotionAtomicFailure",
      failedFixture.series.manifest.id,
    );
    const entryPath = path.join(failedRoot, failedFixture.entry.relativePath);
    const proposalPath = proposalAuthorityPath(failedRoot, failedProposal.proposal.id);
    const entryBefore = await readFile(entryPath, "utf8");
    const proposalBefore = await readFile(proposalPath, "utf8");
    await expect(store.acceptProposal(
      failedFixture.series.manifest.id,
      failedProposal.proposal.id,
      {
        baseRevision: failedProposal.revision,
        actor: "user",
        note: "Injected transaction failure.",
      },
      {
        afterMutationApplied: ({ index }) => {
          if (index === 1) throw new Error("injected promotion transaction failure");
        },
      },
    )).rejects.toThrow("injected promotion transaction failure");
    expect(await readFile(entryPath, "utf8")).toBe(entryBefore);
    expect(await readFile(proposalPath, "utf8")).toBe(proposalBefore);
    const snapshotDirectory = path.join(failedRoot, ".studio", "history", "proposal-snapshots");
    const snapshotFiles = await readdir(snapshotDirectory).catch(() => [] as string[]);
    expect(snapshotFiles).toEqual([]);
    expect((await store.getProposal(
      failedFixture.series.manifest.id,
      failedProposal.proposal.id,
    )).proposal.status).toBe("pending");

    const concurrentFixture = await researchPromotionFixture(store, "PromotionExactlyOnce");
    const concurrentProposal = await store.createResearchNotePromotion(
      concurrentFixture.database.database.id,
      concurrentFixture.note.note.id,
      {
        seriesId: concurrentFixture.series.manifest.id,
        baseRevision: concurrentFixture.note.revision,
        meaning: "world-rule",
        target: {
          kind: "existing",
          entryId: concurrentFixture.entry.metadata.id,
          targetRevision: concurrentFixture.entry.revision,
        },
        candidateText: "Exactly once candidate.",
      },
    );
    const attempts = await Promise.allSettled([
      store.acceptProposal(concurrentFixture.series.manifest.id, concurrentProposal.proposal.id, {
        baseRevision: concurrentProposal.revision,
        actor: "user",
        note: "First concurrent click.",
      }),
      store.acceptProposal(concurrentFixture.series.manifest.id, concurrentProposal.proposal.id, {
        baseRevision: concurrentProposal.revision,
        actor: "user",
        note: "Second concurrent click.",
      }),
    ]);
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    const rejected = attempts.find((attempt) => attempt.status === "rejected");
    expect(rejected).toMatchObject({ reason: { code: "CONFLICT" } });
    const finalEntry = await store.getCodexEntry(
      concurrentFixture.series.manifest.id,
      concurrentFixture.entry.metadata.id,
    );
    expect(finalEntry.description.match(/Exactly once candidate\./gu)).toHaveLength(1);
    expect((await store.getProposal(
      concurrentFixture.series.manifest.id,
      concurrentProposal.proposal.id,
    )).proposal.status).toBe("accepted");
  });
});
