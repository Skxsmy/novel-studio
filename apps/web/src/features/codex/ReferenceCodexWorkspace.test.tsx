// @vitest-environment jsdom

import type { CodexEntryDocument, SeriesDetail } from "@novel-studio/contracts";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getReferenceElementSnapshot, getReferenceStyleText } from "../../app/reference-source";
import type { ProjectSessionState } from "../../app/useProjectSession";
import { api } from "../../api";
import { ReferenceCodexWorkspace } from "./ReferenceCodexWorkspace";

const seriesId = "11111111-1111-4111-8111-111111111111";
const sceneId = "22222222-2222-4222-8222-222222222222";
const blockId = "33333333-3333-4333-8333-333333333333";
const maraId = "44444444-4444-4444-8444-444444444444";
const ivoId = "55555555-5555-4555-8555-555555555555";
const archivedId = "66666666-6666-4666-8666-666666666666";
const customCategoryId = "77777777-7777-4777-8777-777777777777";
const appearanceId = "88888888-8888-4888-8888-888888888888";
const voiceId = "99999999-9999-4999-8999-999999999999";
const motivationId = "99999999-9999-4999-8999-999999999998";
const relationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const progressionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const revision = "a".repeat(64);
const timestamp = "2026-07-15T00:00:00.000Z";

function entry(
  id: string,
  name: string,
  description: string,
  overrides: Partial<CodexEntryDocument["metadata"]> = {},
): CodexEntryDocument {
  return {
    description,
    metadata: {
      aiContextPolicy: "on-mention",
      aliases: [],
      archivedAt: null,
      categoryId: "character",
      createdAt: timestamp,
      detailAiContext: {},
      details: {},
      id,
      mention: { automaticPlural: false, caseSensitive: false, excludedTerms: [], matchAliases: true },
      name,
      schemaVersion: 1,
      thumbnail: null,
      updatedAt: timestamp,
      ...overrides,
    },
    relativePath: `codex/characters/${id}.json`,
    research: {
      content: `${name} baseline research.`,
      metadata: { createdAt: timestamp, entryId: id, schemaVersion: 1, updatedAt: timestamp },
      relativePath: `codex/entry-research/${id}.json`,
      revision,
    },
    revision,
  };
}

const mara = entry(maraId, "Mara Venn", "Mara trusts Ivo with the archive key.");
const ivoBase = entry(ivoId, "Ivo Rell", "Ivo keeps the archive key hidden.", { aliases: ["Ivo"] });
const ivo = { ...ivoBase, research: { ...ivoBase.research, content: "Mara Venn is named in Ivo Rell baseline research." } };
const archived = entry(archivedId, "Old Witness", "An archived witness.", { archivedAt: timestamp });

const scene = {
  characterCount: 35,
  content: "Mara asks Ivo for the archive key.",
  document: { schemaVersion: 1 as const, blocks: [{ id: blockId, kind: "paragraph" as const, text: "Mara asks Ivo for the archive key." }] },
  metadata: {
    actId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    beats: [],
    bookId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    chapterId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    characterIds: [],
    conflict: "",
    createdAt: timestamp,
    divergenceNote: "",
    durationMinutes: null,
    goal: "Find the key",
    id: sceneId,
    locationIds: [],
    order: 1,
    outcome: "",
    plannedCharacters: 0,
    planningState: "aligned" as const,
    plotThreadIds: [],
    pov: "Mara",
    schemaVersion: 1 as const,
    status: "draft" as const,
    storyTime: null,
    summary: "",
    tags: [],
    title: "Archive Door",
    updatedAt: timestamp,
  },
  paragraphCount: 1,
  plainText: "Mara asks Ivo for the archive key.",
  relativePath: "books/volume/manuscript/chapter/act/001-archive-door.json",
  revision,
};

const series = {
  acts: [{ bookId: scene.metadata.bookId, chapterIds: [scene.metadata.chapterId], createdAt: timestamp, id: scene.metadata.actId, order: 1, schemaVersion: 1, title: "Chapter One", updatedAt: timestamp }],
  books: [{ actIds: [scene.metadata.actId], createdAt: timestamp, id: scene.metadata.bookId, order: 1, schemaVersion: 1, seriesId, targetCharacters: 0, title: "Volume One", updatedAt: timestamp }],
  chapters: [{ actId: scene.metadata.actId, createdAt: timestamp, id: scene.metadata.chapterId, order: 1, sceneIds: [sceneId], schemaVersion: 1, title: "Act One", updatedAt: timestamp }],
  manifest: { archivedAt: null, bookIds: [scene.metadata.bookId], createdAt: timestamp, description: "Acceptance fixture", id: seriesId, language: "zh-CN", schemaVersion: 1, title: "Audit Series", updatedAt: timestamp },
  scenes: [scene],
} as SeriesDetail;

function session(overrides: Partial<ProjectSessionState> = {}) {
  return {
    activeSeries: series,
    selectedScene: scene,
    selectScene: vi.fn(),
    ...overrides,
  } as ProjectSessionState;
}

function updatedFromInput(document: CodexEntryDocument, input: Record<string, unknown>): CodexEntryDocument {
  return {
    ...document,
    description: typeof input.description === "string" ? input.description : document.description,
    metadata: {
      ...document.metadata,
      aliases: Array.isArray(input.aliases) ? input.aliases as string[] : document.metadata.aliases,
      categoryId: (input.categoryId as CodexEntryDocument["metadata"]["categoryId"]) ?? document.metadata.categoryId,
      detailAiContext: (input.detailAiContext as Record<string, boolean>) ?? document.metadata.detailAiContext,
      details: (input.details as Record<string, string>) ?? document.metadata.details,
      name: typeof input.name === "string" ? input.name : document.metadata.name,
    },
    research: {
      ...document.research,
      content: typeof input.research === "string" ? input.research : document.research.content,
    },
  };
}

beforeEach(() => {
  vi.spyOn(api.codex, "listCategories").mockResolvedValue([
    { category: { archivedAt: null, builtIn: true, icon: "CH", id: "character", name: "Characters" }, revision: null },
    { category: { archivedAt: null, builtIn: false, icon: "WT", id: customCategoryId, name: "Witnesses" }, revision },
  ]);
  vi.spyOn(api.codex, "listDetailTypes").mockResolvedValue([
    { detailType: { categoryId: "character", createdAt: timestamp, description: "Visible physical traits.", id: appearanceId, name: "Appearance", nsfw: false, schemaVersion: 2, updatedAt: timestamp }, revision },
    { detailType: { categoryId: "character", createdAt: timestamp, description: "Speech patterns and word choice.", id: voiceId, name: "Voice", nsfw: false, schemaVersion: 2, updatedAt: timestamp }, revision },
  ]);
  vi.spyOn(api.codex, "listEntries").mockResolvedValue([mara, ivo, archived]);
  vi.spyOn(api.codex, "listRelations").mockResolvedValue([]);
  vi.spyOn(api.codex, "listProgressions").mockResolvedValue([{
    progression: {
      archivedAt: null,
      body: "Mara recognizes the archive mechanism.",
      createdAt: timestamp,
      effectiveFromSceneId: sceneId,
      effectiveToSceneId: null,
      entryId: maraId,
      evidence: [],
      field: { detailTypeId: null, kind: "description" },
      fieldKey: null,
      id: progressionId,
      kind: "field",
      operation: "add",
      relationId: null,
      schemaVersion: 1,
      source: { blockId, kind: "write-block", sceneId, sourceId: null },
      summary: "Recognizes the mechanism.",
      updatedAt: timestamp,
    },
    revision,
  }]);
  vi.spyOn(api.codex, "listEntryMentions").mockResolvedValue([{ end: 4, entryId: maraId, isAlias: false, matchedText: "Mara", sceneId, start: 0, term: "Mara" }]);
  vi.spyOn(api.codex, "getEffectiveEntry").mockImplementation(async (_seriesId, entryId) => ({
    blockId: null,
    entry: entryId === ivoId
      ? { ...ivo, description: "Ivo has already moved the archive key in the current Scene." }
      : { ...mara, description: "Mara now knows Ivo moved the archive key.", metadata: { ...mara.metadata, details: { [appearanceId]: "Rain-soaked coat" } } },
    fieldStates: [],
    hiddenFutureFieldProgressionCount: 1,
    sceneId,
  }));
  vi.spyOn(api.codex, "updateEntry").mockImplementation(async (_seriesId, entryId, input) => updatedFromInput(entryId === ivoId ? ivo : mara, input as Record<string, unknown>));
  vi.spyOn(api.codex, "archiveEntry").mockImplementation(async () => ({ ...mara, metadata: { ...mara.metadata, archivedAt: timestamp } }));
  vi.spyOn(api.codex, "restoreEntry").mockImplementation(async () => mara);
  vi.spyOn(api.codex, "deleteEntry").mockResolvedValue({ deletedId: maraId });
  vi.spyOn(api.codex, "updateCategory").mockImplementation(async (_seriesId, _categoryId, input) => ({ category: { archivedAt: null, builtIn: false, icon: "WT", id: customCategoryId, name: input.name ?? "Witnesses" }, revision }));
  vi.spyOn(api.codex, "deleteCategory").mockResolvedValue({ deletedId: customCategoryId, movedEntryIds: [] });
  vi.spyOn(api.codex, "createCategory").mockResolvedValue({ category: { archivedAt: null, builtIn: false, icon: "CR", id: customCategoryId, name: "Creatures" }, revision });
  vi.spyOn(api.codex, "createEntry").mockResolvedValue(mara);
  vi.spyOn(api.codex, "createDetailType").mockImplementation(async (_seriesId, input) => ({ detailType: { categoryId: input.categoryId, createdAt: timestamp, description: input.description ?? "", id: motivationId, name: input.name, nsfw: input.nsfw ?? false, schemaVersion: 2, updatedAt: timestamp }, revision }));
  vi.spyOn(api.codex, "updateDetailType").mockImplementation(async (_seriesId, detailTypeId, input) => ({ detailType: { categoryId: "character", createdAt: timestamp, description: input.description ?? (detailTypeId === appearanceId ? "Visible physical traits." : "Speech patterns and word choice."), id: detailTypeId, name: input.name ?? (detailTypeId === appearanceId ? "Appearance" : "Voice"), nsfw: input.nsfw ?? false, schemaVersion: 2, updatedAt: timestamp }, revision: "b".repeat(64) }));
  vi.spyOn(api.codex, "deleteDetailType").mockResolvedValue({ deletedId: voiceId });
  vi.spyOn(api.codex, "createRelation").mockResolvedValue({
    relation: { archivedAt: null, createdAt: timestamp, description: "Mara trusts Ivo.", directed: true, evidence: "", id: relationId, schemaVersion: 2, sourceEntryId: maraId, targetEntryId: ivoId, updatedAt: timestamp, validFromSceneId: null, validToSceneId: null },
    revision,
  });
  vi.spyOn(api.codex, "deleteRelation").mockResolvedValue({ blockers: [], deletedId: relationId });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("NS-514 P3 Codex reference workspace", () => {
  it("matches the NS-514 manifest for Codex", () => {
    const { container } = render(<ReferenceCodexWorkspace />);
    const root = container.querySelector<HTMLElement>("#codex-workspace")!;
    expect(root.className).toBe("workbench workspace-view");
    expect(root.hidden).toBe(false);
    expect(root.innerHTML).toBe(getReferenceElementSnapshot("#codex-workspace").innerHtml);
    expect([...root.children].map((child) => `${child.tagName.toLowerCase()}.${child.className}`)).toEqual([
      "aside.rail",
      "section.entry-index",
      "article.detail-workspace",
    ]);
    expect(root.querySelectorAll("button,input,textarea,select")).toHaveLength(58);
    expect(root.querySelector<HTMLElement>(".category.is-active")?.dataset.category).toBe("all");
    expect(root.querySelector<HTMLElement>(".entry-row.is-selected")?.dataset.id).toBe("rin");
    expect(root.querySelector("[data-tab='canon']")?.getAttribute("aria-selected")).toBe("true");
    for (const anchor of ["Rin Vale", "Marek Sol", "Harbor Lock", "West Quay", "Night Watch Captain"]) {
      expect(root.textContent).toContain(anchor);
    }
    const css = getReferenceStyleText();
    expect(css).toContain("@media (max-width: 1180px)");
    expect(css).toContain("@media (max-width: 760px)");
  });

  it("loads real Codex entries and manages category and entry lifecycle from keyboard-reachable context menus", async () => {
    render(<ReferenceCodexWorkspace session={session()} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Mara Venn" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Archived Entries/u })).toBeTruthy();
    expect(screen.queryByText("Story lenses")).toBeNull();
    expect(screen.queryByText("In Scene")).toBeNull();
    expect(screen.queryByText("Changed")).toBeNull();
    expect(screen.queryByText("Watch")).toBeNull();
    expect(screen.queryByText("Reload")).toBeNull();

    const witnessCategory = screen.getByRole("button", { name: /Witnesses/u });
    fireEvent.keyDown(witnessCategory, { key: "F10", shiftKey: true });
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename…" }));
    fireEvent.change(screen.getByLabelText("Category name"), { target: { value: "Witness Circle" } });
    fireEvent.click(screen.getByRole("button", { name: "Rename Category" }));
    await waitFor(() => expect(api.codex.updateCategory).toHaveBeenCalledWith(seriesId, customCategoryId, {
      baseRevision: revision,
      name: "Witness Circle",
    }));
    expect(await screen.findByRole("button", { name: /Witness Circle/u })).toBeTruthy();

    const maraRow = screen.getByRole("button", { name: /Mara Venn/u });
    fireEvent.keyDown(maraRow, { key: "F10", shiftKey: true });
    fireEvent.click(screen.getByRole("menuitem", { name: "Archive" }));
    await waitFor(() => expect(api.codex.archiveEntry).toHaveBeenCalledWith(seriesId, maraId, { baseRevision: revision }));
    expect(screen.getByRole("button", { name: /Archived Entries/u }).classList.contains("is-active")).toBe(true);

    fireEvent.keyDown(screen.getByRole("button", { name: /Mara Venn/u }), { key: "ContextMenu" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Restore" }));
    await waitFor(() => expect(api.codex.restoreEntry).toHaveBeenCalledWith(seriesId, maraId, { baseRevision: revision }));
    fireEvent.click(screen.getByRole("button", { name: /All entries/u }));
    fireEvent.keyDown(screen.getByRole("button", { name: /Mara Venn/u }), { key: "F10", shiftKey: true });
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete…" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Entry" }));
    await waitFor(() => expect(api.codex.deleteEntry).toHaveBeenCalledWith(seriesId, maraId, { baseRevision: revision }));

    const renamedCategory = screen.getByRole("button", { name: /Witness Circle/u });
    fireEvent.keyDown(renamedCategory, { key: "ContextMenu" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete…" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Category" }));
    await waitFor(() => expect(api.codex.deleteCategory).toHaveBeenCalledWith(seriesId, customCategoryId, { baseRevision: revision }));
  });

  it("adds and deletes structural Detail rows and deletes an unused Detail Type from context menus", async () => {
    render(<ReferenceCodexWorkspace session={session()} />);
    await screen.findByRole("heading", { level: 1, name: "Mara Venn" });
    fireEvent.click(screen.getByRole("tab", { name: /^Details/u }));
    fireEvent.click(screen.getByRole("button", { name: "Add Detail" }));
    fireEvent.change(screen.getByLabelText("Detail Type"), { target: { value: appearanceId } });
    fireEvent.change(screen.getByLabelText("New Detail value"), { target: { value: "Silver coat" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByDisplayValue("Silver coat")).toBeTruthy();
    const savedRow = screen.getByDisplayValue("Silver coat").closest("tr")!;
    fireEvent.keyDown(savedRow, { key: "F10", shiftKey: true });
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete Detail…" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Detail" }));
    await waitFor(() => expect(screen.queryByDisplayValue("Silver coat")).toBeNull());
    expect(api.codex.updateEntry).toHaveBeenLastCalledWith(seriesId, maraId, expect.objectContaining({ details: {} }));

    fireEvent.click(screen.getByRole("button", { name: "Manage Detail Types" }));
    const voiceRow = screen.getByRole("button", { name: /Voice/u });
    fireEvent.keyDown(voiceRow, { key: "ContextMenu" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete Detail Type…" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Detail Type" }));
    await waitFor(() => expect(api.codex.deleteDetailType).toHaveBeenCalledWith(seriesId, voiceId, { baseRevision: revision }));
  });

  it("reproduces the three-column Detail Type Library and persists descriptions", async () => {
    render(<ReferenceCodexWorkspace session={session()} />);
    await screen.findByRole("heading", { level: 1, name: "Mara Venn" });
    fireEvent.click(screen.getByRole("button", { name: /Detail type library/u }));

    const dialog = screen.getByRole("dialog", { name: "Detail type library" });
    const layout = dialog.querySelector(".dialog-body.schema-layout")!;
    expect([...layout.children].map((element) => element.className)).toEqual([
      "schema-categories",
      "schema-list",
      "schema-editor",
    ]);
    expect(dialog.querySelector(".codex-detail-type-manager")).toBeNull();
    expect(screen.queryByPlaceholderText("New Detail Type name")).toBeNull();
    expect(screen.getByRole("navigation", { name: "Detail Type categories" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Characters.*2 detail types/u })).toBeTruthy();
    expect(screen.getByText("Character fields")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Appearance.*Not used yet/u }).classList.contains("is-active")).toBe(true);

    const displayName = screen.getByLabelText("Display name") as HTMLInputElement;
    const description = screen.getByLabelText("Description") as HTMLTextAreaElement;
    const aiDefault = screen.getByLabelText("Include in AI context by default") as HTMLInputElement;
    expect(displayName.disabled).toBe(true);
    expect(aiDefault.disabled).toBe(true);
    expect(description.value).toBe("Visible physical traits.");
    expect(screen.queryByRole("button", { name: "Delete Detail Type" })).toBeNull();

    fireEvent.change(description, { target: { value: "Visible traits used for continuity." } });
    fireEvent.click(screen.getByLabelText("Mark as NSFW / sensitive"));
    fireEvent.click(screen.getByRole("button", { name: "Save library" }));
    await waitFor(() => expect(api.codex.updateDetailType).toHaveBeenCalledWith(seriesId, appearanceId, {
      baseRevision: revision,
      description: "Visible traits used for continuity.",
      nsfw: true,
    }));

    fireEvent.click(screen.getByRole("button", { name: /Detail type library/u }));
    expect((screen.getByLabelText("Description") as HTMLTextAreaElement).value).toBe("Visible traits used for continuity.");

    const appearanceRow = screen.getByRole("button", { name: /Appearance.*Not used yet/u });
    fireEvent.keyDown(appearanceRow, { key: "F10", shiftKey: true });
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename…" }));
    expect(screen.getByRole("dialog", { name: "Rename Detail Type" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Physical appearance" } });
    fireEvent.click(screen.getByRole("button", { name: "Rename Detail Type" }));
    await waitFor(() => expect(api.codex.updateDetailType).toHaveBeenLastCalledWith(seriesId, appearanceId, {
      baseRevision: "b".repeat(64),
      name: "Physical appearance",
    }));
    expect(await screen.findByRole("heading", { level: 3, name: "Physical appearance" })).toBeTruthy();
    expect(api.codex.listEntries).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: "Create Detail Type" }));
    const newName = screen.getByLabelText("Display name") as HTMLInputElement;
    expect(newName.disabled).toBe(false);
    fireEvent.change(newName, { target: { value: "Motivation" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "What currently drives the character." } });
    fireEvent.click(screen.getByRole("button", { name: "Save library" }));
    await waitFor(() => expect(api.codex.createDetailType).toHaveBeenCalledWith(seriesId, {
      categoryId: "character",
      description: "What currently drives the character.",
      name: "Motivation",
      nsfw: false,
    }));
  });

  it("creates and deletes a description-only relation without archive controls", async () => {
    render(<ReferenceCodexWorkspace session={session()} />);
    await screen.findByRole("heading", { level: 1, name: "Mara Venn" });
    fireEvent.click(screen.getByRole("tab", { name: /^Relations/u }));
    fireEvent.click(screen.getByRole("button", { name: "Add Relation" }));
    expect(screen.queryByLabelText("Type")).toBeNull();
    fireEvent.change(screen.getByLabelText("Simple Description"), { target: { value: "Mara trusts Ivo." } });
    fireEvent.click(screen.getByRole("button", { name: "Create Relation" }));

    expect(await screen.findByText("Mara trusts Ivo.")).toBeTruthy();
    const relationRow = screen.getByText("Mara trusts Ivo.").closest("div.relation-row")!;
    fireEvent.keyDown(relationRow, { key: "F10", shiftKey: true });
    expect(screen.queryByRole("menuitem", { name: /Archive/u })).toBeNull();
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete Relation…" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Relation" }));
    await waitFor(() => expect(api.codex.deleteRelation).toHaveBeenCalledWith(seriesId, relationId, { baseRevision: revision }));
    expect("archiveRelation" in api.codex).toBe(false);
  });

  it("switches Baseline and Current Scene using the Write-selected Scene without future leakage", async () => {
    render(<ReferenceCodexWorkspace session={session()} />);
    await screen.findByRole("heading", { level: 1, name: "Mara Venn" });
    fireEvent.click(screen.getByRole("button", { name: "Current Scene" }));

    await waitFor(() => expect(document.querySelector(".codex-canon-readonly")?.textContent).toBe("Mara now knows Ivo moved the archive key."));
    expect((screen.getByRole("textbox", { name: "Appearance value" }) as HTMLTextAreaElement).disabled).toBe(true);
    expect(screen.queryByText("Effective view")).toBeNull();
    expect(screen.queryByText(/future/u)).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Research" }));
    expect(screen.getByDisplayValue("Mara Venn baseline research.")).toBeTruthy();
  });

  it("opens real Progression and Mention targets in Write", async () => {
    const openWrite = vi.fn();
    render(<ReferenceCodexWorkspace onOpenWrite={openWrite} session={session()} />);
    await screen.findByRole("heading", { level: 1, name: "Mara Venn" });
    fireEvent.click(screen.getByRole("tab", { name: /^Progressions/u }));
    fireEvent.click(screen.getByRole("button", { name: "Open in Write" }));
    expect(openWrite).toHaveBeenCalledWith(sceneId, blockId);

    fireEvent.click(screen.getByRole("tab", { name: /^Mentions/u }));
    fireEvent.click(screen.getByRole("button", { name: "Open Scene" }));
    expect(openWrite).toHaveBeenCalledWith(sceneId, blockId);
  });

  it("keeps Mention sources stable while Canon popovers follow Baseline and Current Scene", async () => {
    render(<ReferenceCodexWorkspace session={session()} />);
    await screen.findByRole("heading", { level: 1, name: "Mara Venn" });

    const baselineIvo = screen.getByRole("button", { name: "Ivo" });
    fireEvent.click(baselineIvo);
    expect(await screen.findByText("Ivo keeps the archive key hidden.")).toBeTruthy();
    expect(screen.getByText("Baseline Canon summary")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    fireEvent.click(screen.getByRole("tab", { name: /^Mentions/u }));
    fireEvent.click(screen.getByRole("tab", { name: /Codex mentions/u }));
    expect(screen.getByRole("tab", { name: /Codex mentions/u }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Mara Venn is named in Ivo Rell baseline research.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Current Scene" }));
    expect(screen.getByRole("tab", { name: /Codex mentions/u }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Mara Venn is named in Ivo Rell baseline research.")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Canon" }));
    await waitFor(() => expect(document.querySelector(".codex-canon-readonly")?.textContent).toBe("Mara now knows Ivo moved the archive key."));
    expect(document.querySelector("[data-panel='canon']")?.classList.contains("is-active")).toBe(true);
    const currentSceneIvo = document.querySelector<HTMLButtonElement>(".codex-canon-readonly .codex-inline-mention");
    expect(currentSceneIvo?.textContent).toBe("Ivo");
    fireEvent.click(currentSceneIvo!);
    expect(await screen.findByText("Ivo has already moved the archive key in the current Scene.")).toBeTruthy();
    expect(screen.getByText(/Current Scene Canon summary/u)).toBeTruthy();
  });
});
