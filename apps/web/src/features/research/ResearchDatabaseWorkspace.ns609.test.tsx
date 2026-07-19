// @vitest-environment jsdom

import type {
  ResearchNoteDetail,
  ResearchNoteListResult,
  ResearchNoteSummary,
  ResearchRetrievalResult,
} from "@novel-studio/contracts";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "../../api";
import { ResearchNoteCaptureDialog, ResearchNotesWorkspace } from "./ResearchNotesWorkspace";

const databaseId = "11111111-1111-4111-8111-111111111111";
const secondDatabaseId = "22222222-2222-4222-8222-222222222222";
const sourceId = "33333333-3333-4333-8333-333333333333";
const blockId = "44444444-4444-4444-8444-444444444444";
const chunkId = "55555555-5555-4555-8555-555555555555";
const noteId = "66666666-6666-4666-8666-666666666666";
const secondNoteId = "77777777-7777-4777-8777-777777777777";
const evidenceId = "88888888-8888-4888-8888-888888888888";
const now = "2026-07-20T00:00:00.000Z";
const revision = "a".repeat(64);
const nextRevision = "b".repeat(64);

function evidenceResult(): ResearchRetrievalResult {
  return {
    researchDatabaseId: databaseId,
    researchDatabaseName: "Translingual history",
    sourceId,
    sourceRevision: revision,
    sourceDisplayName: "Edo travel journal",
    sourceKind: "txt",
    chunkId,
    blockId,
    blockOrder: 0,
    chunkHash: "c".repeat(64),
    originalText: "江戸時代の宿場町では旅籠が旅人を迎えた。",
    languageTag: "ja",
    location: { kind: "text", startLine: 8, endLine: 8, startOffset: 120, endOffset: 143 },
    rank: 1,
    matchChannels: ["semantic"],
    channelContributions: [{
      channel: "semantic",
      matchedQuery: "江户时代旅馆",
      rank: 1,
      rawScore: 0.91,
      reciprocalRankContribution: 1 / 61,
    }],
    fusedScore: 1 / 61,
  };
}

function detail(options: {
  id?: string;
  title?: string;
  body?: string;
  status?: "active" | "archived";
  freshness?: ResearchNoteDetail["evidence"][number]["freshness"];
  modelUse?: ResearchNoteDetail["evidence"][number]["modelUse"];
  noteRevision?: string;
} = {}): ResearchNoteDetail {
  const status = options.status ?? "active";
  const id = options.id ?? noteId;
  const evidence = {
    id: evidenceId,
    researchDatabaseId: databaseId,
    sourceId,
    sourceRevision: revision,
    sourceContentHash: "d".repeat(64),
    sourceDisplayName: "Edo travel journal",
    sourceKind: "txt" as const,
    blockId,
    chunkId,
    chunkHash: "c".repeat(64),
    originalText: evidenceResult().originalText,
    quoteHash: "e".repeat(64),
    languageTag: "ja",
    location: evidenceResult().location,
    capturedAt: now,
  };
  return {
    note: {
      schemaVersion: 1,
      id,
      researchDatabaseId: databaseId,
      title: options.title ?? "Travel lodging detail",
      body: options.body ?? "The inn should feel communal rather than private.",
      tags: ["setting"],
      evidence: [evidence],
      status,
      createdAt: now,
      updatedAt: now,
      archivedAt: status === "archived" ? now : null,
    },
    revision: options.noteRevision ?? revision,
    evidence: [{
      evidence,
      freshness: options.freshness ?? "current",
      modelUse: options.modelUse ?? "allowed",
      currentSourceRevision: revision,
      currentSourceDisplayName: "Edo travel journal",
    }],
  };
}

function summary(value: ResearchNoteDetail): ResearchNoteSummary {
  const freshness = {
    current: 0,
    sourceRevisionChanged: 0,
    passageChanged: 0,
    sourceMissing: 0,
    unreadable: 0,
    ownershipMismatch: 0,
    modelUseForbidden: 0,
  };
  const resolved = value.evidence[0]!;
  if (resolved.freshness === "current") freshness.current = 1;
  else if (resolved.freshness === "source-revision-changed") freshness.sourceRevisionChanged = 1;
  else if (resolved.freshness === "passage-changed") freshness.passageChanged = 1;
  else if (resolved.freshness === "source-missing") freshness.sourceMissing = 1;
  else if (resolved.freshness === "unreadable") freshness.unreadable = 1;
  else if (resolved.freshness === "ownership-mismatch") freshness.ownershipMismatch = 1;
  if (resolved.modelUse === "forbidden") freshness.modelUseForbidden = 1;
  return {
    id: value.note.id,
    researchDatabaseId: value.note.researchDatabaseId,
    title: value.note.title,
    tags: value.note.tags,
    status: value.note.status,
    updatedAt: value.note.updatedAt,
    archivedAt: value.note.archivedAt,
    revision: value.revision,
    evidenceCount: value.note.evidence.length,
    freshness,
  };
}

function listResult(notes: ResearchNoteDetail[], status: "active" | "archived" = "active", owner = databaseId): ResearchNoteListResult {
  return {
    researchDatabaseId: owner,
    status,
    offset: 0,
    limit: 100,
    total: notes.length,
    notes: notes.map(summary),
    issueCount: 0,
    issues: [],
  };
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("NS-609 Research Note author workflow", () => {
  it("creates an evidence-bound Note from the exact opened passage without copying evidence into prose", async () => {
    vi.spyOn(api.research, "listNotes").mockResolvedValue(listResult([]));
    const saved = detail({ body: "A public room can stage overheard clues." });
    const create = vi.spyOn(api.research, "createNote").mockResolvedValue(saved);
    const onSaved = vi.fn();
    const { getByRole } = render(<ResearchNoteCaptureDialog
      databaseId={databaseId}
      databaseName="Translingual history"
      evidence={evidenceResult()}
      onClose={vi.fn()}
      onSaved={onSaved}
    />);
    const dialog = getByRole("dialog", { name: "Capture Research Note" });

    expect(within(dialog).getByText(evidenceResult().originalText)).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: "Inn as social stage" } });
    fireEvent.change(within(dialog).getByLabelText("Your interpretation"), { target: { value: saved.note.body } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create Note" }));

    await waitFor(() => expect(create).toHaveBeenCalledWith(databaseId, {
      title: "Inn as social stage",
      body: saved.note.body,
      evidence: [{ sourceId, sourceRevision: revision, blockId, chunkId, chunkHash: "c".repeat(64) }],
    }));
    expect(onSaved).toHaveBeenCalledWith(saved);
    expect(create.mock.calls[0]?.[1].body).not.toContain(evidenceResult().originalText);
  });

  it("appends exact evidence only to an active Note in the current database", async () => {
    const existing = detail();
    vi.spyOn(api.research, "listNotes").mockResolvedValue(listResult([existing]));
    const append = vi.spyOn(api.research, "appendNoteEvidence").mockResolvedValue(existing);
    const { getByRole } = render(<ResearchNoteCaptureDialog
      databaseId={databaseId}
      databaseName="Translingual history"
      evidence={evidenceResult()}
      onClose={vi.fn()}
      onSaved={vi.fn()}
    />);
    const dialog = getByRole("dialog", { name: "Capture Research Note" });
    await waitFor(() => expect((within(dialog).getByRole("tab", { name: "Existing note" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(within(dialog).getByRole("tab", { name: "Existing note" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Add evidence" }));

    await waitFor(() => expect(append).toHaveBeenCalledWith(databaseId, noteId, {
      baseRevision: revision,
      evidence: [{ sourceId, sourceRevision: revision, blockId, chunkId, chunkHash: "c".repeat(64) }],
    }));
  });

  it("keeps a human draft through dirty navigation and a revision conflict", async () => {
    const first = detail();
    const second = detail({ id: secondNoteId, title: "Second interpretation" });
    vi.spyOn(api.research, "listNotes").mockResolvedValue(listResult([first, second]));
    vi.spyOn(api.research, "getNote").mockImplementation(async (_databaseId, id) => id === secondNoteId ? second : first);
    vi.spyOn(api.research, "updateNote").mockRejectedValue(new ApiError("Conflict", 409, {
      code: "CONFLICT",
      message: "Research Note revision conflict",
    }));
    const onDirtyChange = vi.fn();
    const { getByLabelText, getByRole, findByDisplayValue } = render(<ResearchNotesWorkspace
      databaseId={databaseId}
      databaseName="Translingual history"
      onDirtyChange={onDirtyChange}
      refreshToken={0}
      requestedNoteId={null}
    />);

    const body = await findByDisplayValue(first.note.body) as HTMLTextAreaElement;
    fireEvent.change(body, { target: { value: "Keep this unfinished human interpretation." } });
    expect((getByRole("button", { name: /Second interpretation/u }) as HTMLButtonElement).disabled).toBe(true);
    expect(body.value).toBe("Keep this unfinished human interpretation.");
    fireEvent.click(getByRole("button", { name: "Save Note" }));

    await waitFor(() => expect(getByRole("alert").textContent).toContain("changed on disk"));
    expect((getByLabelText("Your interpretation") as HTMLTextAreaElement).value).toBe("Keep this unfinished human interpretation.");
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it("shows stale and forbidden evidence separately from editable prose, then archives and restores", async () => {
    const stale = detail({ freshness: "passage-changed", modelUse: "forbidden" });
    const archived = detail({ status: "archived", freshness: "passage-changed", modelUse: "forbidden", noteRevision: nextRevision });
    vi.spyOn(api.research, "listNotes").mockImplementation(async (_databaseId, query) =>
      query?.status === "archived" ? listResult([archived], "archived") : listResult([stale]));
    vi.spyOn(api.research, "getNote").mockImplementation(async (_databaseId, id) => id === noteId && archived.note.status === "archived" ? stale : stale);
    const archive = vi.spyOn(api.research, "archiveNote").mockResolvedValue(archived);
    const restore = vi.spyOn(api.research, "restoreNote").mockResolvedValue(detail({ noteRevision: "f".repeat(64) }));
    const view = render(<ResearchNotesWorkspace
      databaseId={databaseId}
      databaseName="Translingual history"
      onDirtyChange={vi.fn()}
      refreshToken={0}
      requestedNoteId={noteId}
    />);

    expect(await view.findByText("Original passage changed")).toBeTruthy();
    expect(view.getByText("Never send")).toBeTruthy();
    expect(view.getByText(evidenceResult().originalText)).toBeTruthy();
    expect(view.getByDisplayValue(stale.note.body)).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Archive Research Note" }));
    await waitFor(() => expect(archive).toHaveBeenCalledWith(databaseId, noteId, { baseRevision: revision }));
    await waitFor(() => expect(view.getByRole("button", { name: "Restore Research Note" })).toBeTruthy());
    fireEvent.click(view.getByRole("button", { name: "Restore Research Note" }));
    await waitFor(() => expect(restore).toHaveBeenCalledWith(databaseId, noteId, { baseRevision: nextRevision }));
  });

  it("reloads Notes under a new database owner without reusing the old selection", async () => {
    const first = detail();
    vi.spyOn(api.research, "listNotes").mockImplementation(async (owner) =>
      owner === databaseId ? listResult([first]) : listResult([], "active", secondDatabaseId));
    vi.spyOn(api.research, "getNote").mockResolvedValue(first);
    const view = render(<ResearchNotesWorkspace
      databaseId={databaseId}
      databaseName="Translingual history"
      onDirtyChange={vi.fn()}
      refreshToken={0}
      requestedNoteId={null}
    />);
    await view.findByDisplayValue(first.note.body);

    view.rerender(<ResearchNotesWorkspace
      databaseId={secondDatabaseId}
      databaseName="Private inspiration"
      onDirtyChange={vi.fn()}
      refreshToken={0}
      requestedNoteId={null}
    />);

    await waitFor(() => expect(api.research.listNotes).toHaveBeenCalledWith(secondDatabaseId, { status: "active", limit: 100 }));
    expect(await view.findByText("No active Notes")).toBeTruthy();
    expect(view.queryByDisplayValue(first.note.body)).toBeNull();
  });
});
