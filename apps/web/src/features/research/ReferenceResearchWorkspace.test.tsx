// @vitest-environment jsdom

import type {
  LegacyResearchSourceGroup,
  ResearchDatabaseDocument,
  ResearchDatabaseSummary,
  ResearchSourceDetail,
  ResearchSourceDocument,
} from "@novel-studio/contracts";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "../../api";
import { ReferenceResearchWorkspace } from "./ResearchDatabaseWorkspace";

const seriesId = "11111111-1111-4111-8111-111111111111";
const databaseAId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const databaseBId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const txtId = "22222222-2222-4222-8222-222222222222";
const mdId = "33333333-3333-4333-8333-333333333333";
const requestedNoteId = "44444444-4444-4444-8444-444444444444";
const importedAt = "2026-07-19T02:00:00.000Z";
type ResearchSourceDetailV2 = Extract<ResearchSourceDetail, { originalText: string }>;

function databaseDocument(
  id = databaseAId,
  overrides: Partial<ResearchDatabaseDocument["database"]> = {},
): ResearchDatabaseDocument {
  return {
    database: {
      schemaVersion: 1,
      id,
      name: id === databaseBId ? "Language Archive" : "Harbor Research",
      description: id === databaseBId ? "Japanese and English terminology." : "Primary historical sources.",
      linkedSeriesIds: [],
      createdAt: importedAt,
      updatedAt: importedAt,
      ...overrides,
    },
    revision: id === databaseBId ? "2".repeat(64) : "1".repeat(64),
  };
}

function databaseSummary(document: ResearchDatabaseDocument, sourceCount = 0): ResearchDatabaseSummary {
  return { ...document, sourceCount };
}

function detail(
  id = txtId,
  databaseId = databaseAId,
  overrides: Partial<ResearchSourceDetailV2["source"]> = {},
): ResearchSourceDetailV2 {
  const kind = overrides.kind ?? "txt";
  const source: ResearchSourceDetailV2["source"] = {
    schemaVersion: 2,
    id,
    researchDatabaseId: databaseId,
    kind,
    mediaType: kind === "markdown" ? "text/markdown" as const : "text/plain" as const,
    originalFileName: kind === "markdown" ? "terms.md" : "interview.txt",
    sizeBytes: 42,
    contentHash: id === mdId ? "b".repeat(64) : "a".repeat(64),
    originalRelativePath: `originals/${id}.${kind === "markdown" ? "md" : "txt"}`,
    parseStatus: "parsed" as const,
    parserName: "plain-text" as const,
    parserVersion: 1 as const,
    importedAt,
    updatedAt: importedAt,
    displayName: kind === "markdown" ? "Japanese terms" : "Harbor interview",
    author: "Field researcher",
    declaredLanguage: kind === "markdown" ? "ja-JP" : "en",
    tags: ["harbor"],
    aiPermission: "never" as const,
    useNotes: "Private source",
    ...overrides,
  };
  return {
    source,
    revision: id === mdId ? "d".repeat(64) : "c".repeat(64),
    originalText: kind === "markdown" ? "# 用語\n\n月守（つきもり）" : "The harbor bell rang before dawn.",
  };
}

function listed(sourceDetail: ResearchSourceDetail): ResearchSourceDocument {
  return { source: sourceDetail.source, revision: sourceDetail.revision };
}

beforeEach(() => {
  vi.spyOn(api.research, "getIndexState").mockImplementation(async (researchDatabaseId) => ({
    researchDatabaseId,
    status: "ready",
    indexedSourceCount: 0,
    indexedChunkCount: 0,
    reason: null,
  }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("NS-603 Research Database workspace", () => {
  it("returns from Review to the exact Research Database and Note", async () => {
    const firstDatabase = databaseDocument();
    const secondDatabase = databaseDocument(databaseBId);
    vi.spyOn(api.research, "listDatabases").mockResolvedValue({
      databases: [databaseSummary(firstDatabase), databaseSummary(secondDatabase)],
      issues: [],
    });
    vi.spyOn(api.research, "listLegacySources").mockResolvedValue([]);
    vi.spyOn(api.research, "getDatabase").mockImplementation(async (databaseId) =>
      databaseId === databaseBId ? secondDatabase : firstDatabase,
    );
    vi.spyOn(api.research, "listSources").mockResolvedValue([]);
    vi.spyOn(api.research, "listNotes").mockResolvedValue({
      researchDatabaseId: databaseBId,
      status: "active",
      offset: 0,
      limit: 100,
      total: 1,
      notes: [{
        id: requestedNoteId,
        researchDatabaseId: databaseBId,
        title: "Returned harbor Note",
        tags: ["review"],
        status: "active",
        updatedAt: importedAt,
        archivedAt: null,
        revision: "9".repeat(64),
        evidenceCount: 1,
        freshness: {
          current: 1,
          sourceRevisionChanged: 0,
          passageChanged: 0,
          sourceMissing: 0,
          unreadable: 0,
          ownershipMismatch: 0,
          modelUseForbidden: 1,
        },
      }],
      issueCount: 0,
      issues: [],
    });
    vi.spyOn(api.research, "getNote").mockResolvedValue({
      note: {
        schemaVersion: 1,
        id: requestedNoteId,
        researchDatabaseId: databaseBId,
        title: "Returned harbor Note",
        body: "This is the exact Note opened from Review.",
        tags: ["review"],
        evidence: [],
        status: "active",
        createdAt: importedAt,
        updatedAt: importedAt,
        archivedAt: null,
      },
      revision: "9".repeat(64),
      evidence: [],
    } as never);

    const { container } = render(<ReferenceResearchWorkspace
      requestedNote={{ databaseId: databaseBId, noteId: requestedNoteId, requestId: 1 }}
      seriesId={seriesId}
    />);
    const root = container.querySelector<HTMLElement>("#research-workspace")!;
    root.hidden = false;

    const returnedBody = await within(root).findByDisplayValue("This is the exact Note opened from Review.");
    expect(returnedBody).toBeTruthy();
    expect((within(root).getByLabelText("Research Database") as HTMLSelectElement).value).toBe(databaseBId);
    expect(within(root).getByRole("tab", { name: "Notes" }).getAttribute("aria-selected")).toBe("true");

    fireEvent.change(returnedBody, { target: { value: "The author continues editing after the return." } });
    await waitFor(() => expect((within(root).getByRole("button", { name: "Save Note" }) as HTMLButtonElement).disabled).toBe(false));
    expect(within(root).queryByText("Save or discard the open Research changes before returning to this Note.")).toBeNull();
  });

  it("creates a Research Database without an open Series", async () => {
    const created = databaseDocument();
    vi.spyOn(api.research, "listDatabases").mockResolvedValue({ databases: [], issues: [] });
    vi.spyOn(api.research, "listLegacySources").mockResolvedValue([]);
    vi.spyOn(api.research, "getDatabase").mockResolvedValue(created);
    vi.spyOn(api.research, "listSources").mockResolvedValue([]);
    const createDatabase = vi.spyOn(api.research, "createDatabase").mockResolvedValue(created);

    const { container } = render(<ReferenceResearchWorkspace seriesId={null} />);
    const root = container.querySelector<HTMLElement>("#research-workspace")!;
    root.hidden = false;
    await waitFor(() => expect(within(root).getByText("No Research Database selected")).toBeTruthy());

    fireEvent.click(within(root).getByTitle("Create Research Database"));
    const dialog = within(root).getByRole("dialog", { name: "Create Research Database" });
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Harbor Research" } });
    fireEvent.change(within(dialog).getByLabelText("Description"), { target: { value: "Primary historical sources." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create database" }));

    await waitFor(() => expect(createDatabase).toHaveBeenCalledWith({
      name: "Harbor Research",
      description: "Primary historical sources.",
    }));
    await waitFor(() => expect(within(root).getByText("This source shelf is empty")).toBeTruthy());
    expect((within(root).getByLabelText("Research Database") as HTMLSelectElement).value).toBe(databaseAId);
    const settingsButton = within(root).getByRole("button", { name: "Database settings" }) as HTMLButtonElement;
    await waitFor(() => expect(settingsButton.disabled).toBe(false));
    fireEvent.click(settingsButton);
    const settings = within(root).getByRole("dialog", { name: "Database settings" });
    expect(within(settings).getByText("Open a Series only when you need to link", { exact: false })).toBeTruthy();
  });

  it("switches between isolated databases without leaking source shelves", async () => {
    const txt = detail();
    const markdown = detail(mdId, databaseBId, { kind: "markdown" });
    const firstDatabase = databaseDocument();
    const secondDatabase = databaseDocument(databaseBId);
    vi.spyOn(api.research, "listDatabases").mockResolvedValue({
      databases: [databaseSummary(firstDatabase, 1), databaseSummary(secondDatabase, 1)],
      issues: [],
    });
    vi.spyOn(api.research, "listLegacySources").mockResolvedValue([]);
    vi.spyOn(api.research, "getDatabase").mockImplementation(async (databaseId) =>
      databaseId === databaseBId ? secondDatabase : firstDatabase,
    );
    vi.spyOn(api.research, "listSources").mockImplementation(async (databaseId) =>
      databaseId === databaseBId ? [listed(markdown)] : [listed(txt)],
    );
    const getSource = vi.spyOn(api.research, "getSource").mockImplementation(async (_databaseId, sourceId) =>
      sourceId === mdId ? markdown : txt,
    );

    const { container } = render(<ReferenceResearchWorkspace seriesId={seriesId} />);
    const root = container.querySelector<HTMLElement>("#research-workspace")!;
    root.hidden = false;
    await waitFor(() => expect(within(root).getByText("The harbor bell rang before dawn.")).toBeTruthy());
    expect(within(root).queryByRole("button", { name: /Japanese terms/u })).toBeNull();

    fireEvent.change(within(root).getByLabelText("Research Database"), { target: { value: databaseBId } });
    await waitFor(() => expect(within(root).getByText("月守（つきもり）", { exact: false })).toBeTruthy());
    expect(within(root).queryByRole("button", { name: /Harbor interview/u })).toBeNull();
    expect(within(root).getByRole("button", { name: /Japanese terms/u }).getAttribute("aria-current")).toBe("true");
    expect(getSource).toHaveBeenLastCalledWith(databaseBId, mdId);
    expect(getSource).not.toHaveBeenCalledWith(databaseBId, txtId);
  });

  it("links one database to the current Series and explicitly copies legacy sources", async () => {
    const originalDatabase = databaseDocument();
    const linkedDatabase = {
      ...originalDatabase,
      database: { ...originalDatabase.database, linkedSeriesIds: [seriesId] },
      revision: "3".repeat(64),
    };
    const migrated = detail();
    const legacyGroup: LegacyResearchSourceGroup = {
      seriesId,
      seriesTitle: "Salt Lantern",
      sourceCount: 1,
      migratedResearchDatabaseIds: [],
    };
    vi.spyOn(api.research, "listDatabases").mockResolvedValue({
      databases: [databaseSummary(originalDatabase)],
      issues: [],
    });
    vi.spyOn(api.research, "listLegacySources").mockResolvedValue([legacyGroup]);
    vi.spyOn(api.research, "getDatabase").mockResolvedValue(originalDatabase);
    const listSources = vi.spyOn(api.research, "listSources")
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([listed(migrated)]);
    vi.spyOn(api.research, "getSource").mockResolvedValue(migrated);
    const updateDatabase = vi.spyOn(api.research, "updateDatabase").mockResolvedValue(linkedDatabase);
    const migrate = vi.spyOn(api.research, "migrateLegacySources").mockResolvedValue({
      researchDatabaseId: databaseAId,
      seriesId,
      importedSourceIds: [txtId],
      skippedDuplicateSourceIds: [],
    });

    const { container } = render(<ReferenceResearchWorkspace seriesId={seriesId} />);
    const root = container.querySelector<HTMLElement>("#research-workspace")!;
    root.hidden = false;
    await waitFor(() => expect(within(root).getByText("This source shelf is empty")).toBeTruthy());
    const settingsButton = within(root).getByRole("button", { name: "Database settings" }) as HTMLButtonElement;
    await waitFor(() => expect(settingsButton.disabled).toBe(false));
    fireEvent.click(settingsButton);
    let dialog = within(root).getByRole("dialog", { name: "Database settings" });
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /Available to current Series/u }));
    expect((within(dialog).getByRole("button", { name: "Copy into this database" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(dialog).getByRole("button", { name: "Save database" }));
    await waitFor(() => expect(updateDatabase).toHaveBeenCalledWith(databaseAId, expect.objectContaining({
      baseRevision: originalDatabase.revision,
      linkedSeriesIds: [seriesId],
    })));

    fireEvent.click(settingsButton);
    dialog = within(root).getByRole("dialog", { name: "Database settings" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Copy into this database" }));
    await waitFor(() => expect(migrate).toHaveBeenCalledWith(databaseAId, seriesId));
    await waitFor(() => expect(within(dialog).getByText("Copied")).toBeTruthy());
    expect(listSources).toHaveBeenCalledTimes(2);
    expect(within(root).getByRole("button", { name: /Harbor interview/u })).toBeTruthy();
  });

  it("locks database settings during save and preserves the author draft across a revision conflict", async () => {
    const original = databaseDocument();
    const latest = {
      ...original,
      database: { ...original.database, description: "Changed in another window." },
      revision: "4".repeat(64),
    };
    vi.spyOn(api.research, "listDatabases").mockResolvedValue({ databases: [databaseSummary(original)], issues: [] });
    vi.spyOn(api.research, "listLegacySources").mockResolvedValue([]);
    vi.spyOn(api.research, "getDatabase")
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce(latest);
    vi.spyOn(api.research, "listSources").mockResolvedValue([]);
    let rejectUpdate!: (reason?: unknown) => void;
    vi.spyOn(api.research, "updateDatabase").mockImplementation(() => new Promise((_resolve, reject) => {
      rejectUpdate = reject;
    }));

    const { container } = render(<ReferenceResearchWorkspace seriesId={seriesId} />);
    const root = container.querySelector<HTMLElement>("#research-workspace")!;
    root.hidden = false;
    const settingsButton = within(root).getByRole("button", { name: "Database settings" }) as HTMLButtonElement;
    await waitFor(() => expect(settingsButton.disabled).toBe(false));
    fireEvent.click(settingsButton);
    const dialog = within(root).getByRole("dialog", { name: "Database settings" });
    const description = within(dialog).getByLabelText("Description") as HTMLTextAreaElement;
    fireEvent.change(description, { target: { value: "Author database notes." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save database" }));

    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Saving" })).toBeTruthy());
    expect(description.disabled).toBe(true);
    expect(within(dialog).getAllByRole("button", { name: "Close" }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    rejectUpdate(new ApiError("Conflict", 409, { code: "CONFLICT", message: "Changed" }));

    await waitFor(() => expect(within(dialog).getByRole("alert").textContent).toContain("Your draft is still here"));
    expect(description.value).toBe("Author database notes.");
    expect(description.disabled).toBe(false);
    expect(within(dialog).getByRole("button", { name: "Save database" })).toBeTruthy();
  });

  it("imports into only the selected database", async () => {
    const database = databaseDocument();
    const markdown = detail(mdId, databaseAId, { kind: "markdown" });
    vi.spyOn(api.research, "listDatabases").mockResolvedValue({ databases: [databaseSummary(database)], issues: [] });
    vi.spyOn(api.research, "listLegacySources").mockResolvedValue([]);
    vi.spyOn(api.research, "getDatabase").mockResolvedValue(database);
    vi.spyOn(api.research, "listSources").mockResolvedValue([]);
    vi.spyOn(api.research, "getSource").mockResolvedValue(markdown);
    const importSource = vi.spyOn(api.research, "importSource").mockResolvedValue(markdown);

    const { container } = render(<ReferenceResearchWorkspace seriesId={null} />);
    const root = container.querySelector<HTMLElement>("#research-workspace")!;
    root.hidden = false;
    await waitFor(() => expect(within(root).getByText("This source shelf is empty")).toBeTruthy());
    const file = new File([markdown.originalText], "terms.md", { type: "text/markdown" });
    fireEvent.change(within(root).getByLabelText("Choose a Research source file"), { target: { files: [file] } });

    await waitFor(() => expect(importSource).toHaveBeenCalledTimes(1));
    expect(importSource.mock.calls[0]?.[0]).toBe(databaseAId);
    expect(importSource.mock.calls[0]?.[1]).toMatchObject({ fileName: "terms.md", mediaType: "text/markdown" });
    await waitFor(() => expect(within(root).getByText("月守（つきもり）", { exact: false })).toBeTruthy());
  });

  it("saves source properties with conflict recovery while immutable facts remain read only", async () => {
    const original = detail();
    const latest = { ...original, revision: "e".repeat(64), source: { ...original.source, displayName: "Latest server title" } };
    const saved = {
      ...latest,
      revision: "f".repeat(64),
      source: { ...latest.source, displayName: "Author draft title", aiPermission: "allowed" as const },
    };
    const database = databaseDocument();
    vi.spyOn(api.research, "listDatabases").mockResolvedValue({ databases: [databaseSummary(database, 1)], issues: [] });
    vi.spyOn(api.research, "listLegacySources").mockResolvedValue([]);
    vi.spyOn(api.research, "getDatabase").mockResolvedValue(database);
    vi.spyOn(api.research, "listSources").mockResolvedValue([listed(original)]);
    const getSource = vi.spyOn(api.research, "getSource")
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce(latest);
    const updateSource = vi.spyOn(api.research, "updateSource")
      .mockRejectedValueOnce(new ApiError("Conflict", 409, { code: "CONFLICT", message: "Changed" }))
      .mockResolvedValueOnce(saved);

    const { container } = render(<ReferenceResearchWorkspace seriesId={seriesId} />);
    const root = container.querySelector<HTMLElement>("#research-workspace")!;
    root.hidden = false;
    const displayName = await within(root).findByLabelText("Display name");
    fireEvent.change(displayName, { target: { value: "Author draft title" } });
    fireEvent.click(within(root).getByText("Allow when selected"));
    fireEvent.click(within(root).getByRole("button", { name: "Save properties" }));

    await waitFor(() => expect(getSource).toHaveBeenCalledTimes(2));
    expect(within(root).getByRole("alert").textContent).toContain("Your draft is still here");
    expect((within(root).getByLabelText("Display name") as HTMLInputElement).value).toBe("Author draft title");
    fireEvent.click(within(root).getByRole("button", { name: "Save properties" }));
    await waitFor(() => expect(updateSource).toHaveBeenCalledTimes(2));
    expect(updateSource.mock.calls[1]?.[2]).toMatchObject({
      baseRevision: latest.revision,
      displayName: "Author draft title",
      aiPermission: "allowed",
    });
    expect(within(root).queryByLabelText("Original file")).toBeNull();
    expect(within(root).getAllByText("interview.txt")).toHaveLength(2);
  });

  it("blocks database and source switching until an unsaved source draft is discarded", async () => {
    const txt = detail();
    const markdown = detail(mdId, databaseAId, { kind: "markdown" });
    const firstDatabase = databaseDocument();
    const secondDatabase = databaseDocument(databaseBId);
    vi.spyOn(api.research, "listDatabases").mockResolvedValue({
      databases: [databaseSummary(firstDatabase, 2), databaseSummary(secondDatabase)],
      issues: [],
    });
    vi.spyOn(api.research, "listLegacySources").mockResolvedValue([]);
    vi.spyOn(api.research, "getDatabase").mockImplementation(async (databaseId) =>
      databaseId === databaseBId ? secondDatabase : firstDatabase,
    );
    vi.spyOn(api.research, "listSources").mockImplementation(async (databaseId) =>
      databaseId === databaseAId ? [listed(txt), listed(markdown)] : [],
    );
    const getSource = vi.spyOn(api.research, "getSource").mockImplementation(async (_databaseId, sourceId) =>
      sourceId === mdId ? markdown : txt,
    );

    const { container } = render(<ReferenceResearchWorkspace seriesId={seriesId} />);
    const root = container.querySelector<HTMLElement>("#research-workspace")!;
    root.hidden = false;
    const displayName = await within(root).findByLabelText("Display name");
    fireEvent.change(displayName, { target: { value: "Uncommitted author title" } });

    expect(within(root).getByText("Unsaved changes")).toBeTruthy();
    expect((within(root).getByRole("button", { name: /Japanese terms/u }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(root).getByRole("button", { name: "Add source" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(root).getByLabelText("Research Database"), { target: { value: databaseBId } });
    expect((within(root).getByLabelText("Research Database") as HTMLSelectElement).value).toBe(databaseAId);
    expect(within(root).getByRole("alert").textContent).toContain("before switching Research Databases");
    expect((within(root).getByLabelText("Display name") as HTMLInputElement).value).toBe("Uncommitted author title");

    fireEvent.click(within(root).getByRole("button", { name: "Discard changes" }));
    expect((within(root).getByLabelText("Display name") as HTMLInputElement).value).toBe("Harbor interview");
    const markdownButton = within(root).getByRole("button", { name: /Japanese terms/u });
    expect((markdownButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(markdownButton);
    await waitFor(() => expect(getSource).toHaveBeenCalledWith(databaseAId, mdId));
    await waitFor(() => expect(within(root).getByText("月守（つきもり）", { exact: false })).toBeTruthy());
  });

  it("falls back safely when the restored Research Database no longer exists", async () => {
    const database = databaseDocument();
    localStorage.setItem("novel-studio.research.database.selected", databaseBId);
    vi.spyOn(api.research, "listDatabases").mockResolvedValue({ databases: [databaseSummary(database)], issues: [] });
    vi.spyOn(api.research, "listLegacySources").mockResolvedValue([]);
    vi.spyOn(api.research, "getDatabase").mockResolvedValue(database);
    vi.spyOn(api.research, "listSources").mockResolvedValue([]);

    const { container } = render(<ReferenceResearchWorkspace seriesId={null} />);
    const root = container.querySelector<HTMLElement>("#research-workspace")!;
    root.hidden = false;
    await waitFor(() => expect(within(root).getByText(/previously selected Research Database is no longer available/u)).toBeTruthy());
    expect((within(root).getByLabelText("Research Database") as HTMLSelectElement).value).toBe(databaseAId);
    expect(localStorage.getItem("novel-studio.research.database.selected")).toBe(databaseAId);
  });

  it("falls back safely when the restored source no longer exists", async () => {
    const txt = detail();
    const database = databaseDocument();
    localStorage.setItem("novel-studio.research.database.selected", databaseAId);
    localStorage.setItem(`novel-studio.research.source.selected.${databaseAId}`, mdId);
    vi.spyOn(api.research, "listDatabases").mockResolvedValue({ databases: [databaseSummary(database, 1)], issues: [] });
    vi.spyOn(api.research, "listLegacySources").mockResolvedValue([]);
    vi.spyOn(api.research, "getDatabase").mockResolvedValue(database);
    vi.spyOn(api.research, "listSources").mockResolvedValue([listed(txt)]);
    vi.spyOn(api.research, "getSource").mockResolvedValue(txt);

    const { container } = render(<ReferenceResearchWorkspace seriesId={seriesId} />);
    const root = container.querySelector<HTMLElement>("#research-workspace")!;
    root.hidden = false;
    await waitFor(() => expect(within(root).getByText(/previously selected source is no longer available/u)).toBeTruthy());
    expect(within(root).getByRole("button", { name: /Harbor interview/u }).getAttribute("aria-current")).toBe("true");
    await waitFor(() => expect(localStorage.getItem(`novel-studio.research.source.selected.${databaseAId}`)).toBe(txtId));
  });

  it("returns to the source shelf when a listed source disappears before its detail opens", async () => {
    const txt = detail();
    const markdown = detail(mdId, databaseAId, { kind: "markdown" });
    const database = databaseDocument();
    localStorage.setItem("novel-studio.research.database.selected", databaseAId);
    localStorage.setItem(`novel-studio.research.source.selected.${databaseAId}`, txtId);
    vi.spyOn(api.research, "listDatabases").mockResolvedValue({ databases: [databaseSummary(database, 2)], issues: [] });
    vi.spyOn(api.research, "listLegacySources").mockResolvedValue([]);
    vi.spyOn(api.research, "getDatabase").mockResolvedValue(database);
    vi.spyOn(api.research, "listSources").mockResolvedValue([listed(txt), listed(markdown)]);
    vi.spyOn(api.research, "getSource").mockRejectedValue(new ApiError("Missing", 404, {
      code: "NOT_FOUND",
      message: "The source disappeared",
    }));

    const { container } = render(<ReferenceResearchWorkspace seriesId={seriesId} />);
    const root = container.querySelector<HTMLElement>("#research-workspace")!;
    root.hidden = false;
    await waitFor(() => expect(within(root).getByRole("alert").textContent).toContain("source disappeared"));
    expect(within(root).queryByRole("button", { name: /Harbor interview/u })).toBeNull();
    expect(within(root).getByRole("button", { name: /Japanese terms/u }).getAttribute("aria-current")).toBeNull();
    expect(root.querySelector(".rs8-layout")?.classList.contains("is-rail-open")).toBe(true);
    expect(localStorage.getItem(`novel-studio.research.source.selected.${databaseAId}`)).toBeNull();
  });

  it("keeps the empty shelf stable and reports local or server upload failures without fake sources", async () => {
    const database = databaseDocument();
    vi.spyOn(api.research, "listDatabases").mockResolvedValue({ databases: [databaseSummary(database)], issues: [] });
    vi.spyOn(api.research, "listLegacySources").mockResolvedValue([]);
    vi.spyOn(api.research, "getDatabase").mockResolvedValue(database);
    vi.spyOn(api.research, "listSources").mockResolvedValue([]);
    const importSource = vi.spyOn(api.research, "importSource")
      .mockRejectedValue(new ApiError("Duplicate source", 409, { code: "CONFLICT", message: "This source is already in the shelf" }));

    const { container } = render(<ReferenceResearchWorkspace seriesId={seriesId} />);
    const root = container.querySelector<HTMLElement>("#research-workspace")!;
    root.hidden = false;
    await waitFor(() => expect(within(root).getByText("This source shelf is empty")).toBeTruthy());

    fireEvent.change(within(root).getByLabelText("Choose a Research source file"), {
      target: { files: [new File(["binary"], "archive.doc", { type: "application/msword" })] },
    });
    expect(within(root).getByRole("alert").textContent).toContain("Word (.docx)");
    expect(importSource).not.toHaveBeenCalled();

    fireEvent.change(within(root).getByLabelText("Choose a Research source file"), {
      target: { files: [new File(["same source"], "duplicate.txt", { type: "text/plain" })] },
    });
    await waitFor(() => expect(importSource).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(within(root).getByRole("alert").textContent).toContain("already in the shelf"));
    expect(within(root).getByText("This source shelf is empty")).toBeTruthy();
    expect(within(root).queryAllByRole("button", { name: /Ready/u })).toHaveLength(0);
  });
});
