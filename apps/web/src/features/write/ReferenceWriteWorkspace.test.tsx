// @vitest-environment jsdom

import type { SceneBlockDocument, SeriesDetail } from "@novel-studio/contracts";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectSessionState } from "../../app/useProjectSession";
import { api } from "../../api";
import { ReferenceWriteWorkspace } from "./ReferenceWriteWorkspace";

const seriesId = "11111111-1111-4111-8111-111111111111";
const volumeId = "22222222-2222-4222-8222-222222222222";
const chapterId = "33333333-3333-4333-8333-333333333333";
const actId = "44444444-4444-4444-8444-444444444444";
const sceneId = "55555555-5555-4555-8555-555555555555";
const blockId = "66666666-6666-4666-8666-666666666666";
const codexEntryId = "77777777-7777-4777-8777-777777777777";
const progressionBlockId = "88888888-8888-4888-8888-888888888888";
const progressionId = "99999999-9999-4999-8999-999999999999";
const revision = "a".repeat(64);
const document: SceneBlockDocument = {
  schemaVersion: 1,
  blocks: [{ id: blockId, kind: "paragraph", text: "Mara opens the real manuscript at the audit gate." }],
};

const scene = {
  characterCount: 38,
  content: "Mara opens the real manuscript at the audit gate.",
  document,
  metadata: {
    actId: chapterId,
    beats: [],
    bookId: volumeId,
    chapterId: actId,
    characterIds: [],
    conflict: "",
    createdAt: "2026-07-15T00:00:00.000Z",
    divergenceNote: "",
    durationMinutes: null,
    goal: "Open the gate",
    id: sceneId,
    locationIds: [],
    order: 1,
    outcome: "",
    plannedCharacters: 0,
    planningState: "aligned",
    plotThreadIds: [],
    pov: "Mara",
    schemaVersion: 1,
    status: "draft",
    storyTime: null,
    summary: "",
    tags: [],
    title: "Audit Gate",
    updatedAt: "2026-07-15T00:00:00.000Z",
  },
  paragraphCount: 1,
  plainText: "Mara opens the real manuscript at the audit gate.",
  relativePath: "books/volume/manuscript/chapter/act/001-audit-gate.json",
  revision,
};

const series = {
  acts: [{
    bookId: volumeId,
    chapterIds: [actId],
    createdAt: "2026-07-15T00:00:00.000Z",
    id: chapterId,
    order: 1,
    schemaVersion: 1,
    title: "Chapter One",
    updatedAt: "2026-07-15T00:00:00.000Z",
  }],
  books: [{
    actIds: [chapterId],
    createdAt: "2026-07-15T00:00:00.000Z",
    id: volumeId,
    order: 1,
    schemaVersion: 1,
    seriesId,
    targetCharacters: 0,
    title: "Volume One",
    updatedAt: "2026-07-15T00:00:00.000Z",
  }],
  chapters: [{
    actId: chapterId,
    createdAt: "2026-07-15T00:00:00.000Z",
    id: actId,
    order: 1,
    sceneIds: [sceneId],
    schemaVersion: 1,
    title: "Act One",
    updatedAt: "2026-07-15T00:00:00.000Z",
  }],
  manifest: {
    archivedAt: null,
    bookIds: [volumeId],
    createdAt: "2026-07-15T00:00:00.000Z",
    description: "Acceptance fixture",
    id: seriesId,
    language: "zh-CN",
    schemaVersion: 1,
    title: "Audit Series",
    updatedAt: "2026-07-15T00:00:00.000Z",
  },
  scenes: [scene],
} as SeriesDetail;

function session(overrides: Partial<ProjectSessionState> = {}) {
  return {
    acceptSavedSceneDocument: vi.fn(),
    activeSeries: series,
    commitDraftDocument: vi.fn(async () => scene),
    createAct: vi.fn(async () => undefined),
    createChapter: vi.fn(async () => undefined),
    createScene: vi.fn(async () => undefined),
    createSeries: vi.fn(async () => true),
    createVolume: vi.fn(async () => undefined),
    deleteAct: vi.fn(async () => undefined),
    deleteChapter: vi.fn(async () => undefined),
    deleteScene: vi.fn(async () => undefined),
    deleteSeries: vi.fn(async () => true),
    deleteVolume: vi.fn(async () => undefined),
    draft: {
      characterCount: scene.characterCount,
      content: scene.content,
      document,
      paragraphCount: 1,
      revision,
      sceneId,
      status: "draft",
      title: "Audit Gate",
    },
    errorMessage: null,
    isCreatingSeries: false,
    isCreatingStructure: false,
    isDirty: false,
    isLibraryLoading: false,
    isOpeningSeries: false,
    openSeries: vi.fn(async () => true),
    refreshSeriesList: vi.fn(async () => undefined),
    renameScene: vi.fn(async () => undefined),
    resetStructureSelection: vi.fn(),
    restoreSeries: vi.fn(async () => true),
    saveDraft: vi.fn(async () => true),
    saveStatus: "saved",
    selectAct: vi.fn(),
    selectChapter: vi.fn(),
    selectScene: vi.fn(),
    selectVolume: vi.fn(),
    selectedActId: chapterId,
    selectedChapterId: actId,
    selectedScene: scene,
    selectedVolumeId: volumeId,
    seriesList: [],
    trashSeries: vi.fn(async () => true),
    updateAct: vi.fn(async () => undefined),
    updateChapter: vi.fn(async () => undefined),
    updateDraftDocument: vi.fn(),
    updateDraftTitle: vi.fn(),
    updateVolume: vi.fn(async () => undefined),
    ...overrides,
  } as ProjectSessionState;
}

beforeEach(() => {
  vi.spyOn(api.codex, "listEntries").mockResolvedValue([{
    description: "A concise Canon Description.",
    metadata: {
      aliases: [],
      archivedAt: null,
      categoryId: "character",
      id: codexEntryId,
      mention: {
        automaticPlural: false,
        caseSensitive: false,
        excludedTerms: [],
        matchAliases: true,
      },
      name: "Mara",
    },
  } as never]);
  vi.spyOn(api.codex, "listDetailTypes").mockResolvedValue([]);
  vi.spyOn(api.codex, "listProgressions").mockResolvedValue([]);
  vi.spyOn(api.codex, "getEffectiveEntry").mockResolvedValue({
    entry: { description: "Effective Canon Description at this block." },
  } as never);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("NS-514 P6 connected Write workspace", () => {
  it("connects real Write data and the complete NovelEditor without fixture manuscript claims", async () => {
    const current = session({ saveStatus: "retrying" });
    const { container } = render(<ReferenceWriteWorkspace session={current} />);
    const root = container.querySelector<HTMLElement>("#write-workspace")!;
    root.hidden = false;

    expect((screen.getByRole("textbox", { name: "Scene title" }) as HTMLInputElement).value).toBe("Audit Gate");
    expect(screen.getByText("Mara opens the real manuscript at the audit gate.")).toBeTruthy();
    expect(root.textContent).not.toContain("Saltwake");
    expect((screen.getByRole("button", { name: "Draft" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Revise" }) as HTMLButtonElement).disabled).toBe(true);
    const save = screen.getByRole("status", { name: "" });
    expect(save.classList.contains("wr6-save")).toBe(true);
    expect(save.classList.contains("is-retrying")).toBe(true);
    expect(save.textContent).toContain("Retrying");
    expect(root.querySelectorAll(".wr6-save")).toHaveLength(1);

    const manuscriptParagraph = screen.getByText("Mara opens the real manuscript at the audit gate.");
    const selectionSpy = vi.spyOn(window, "getSelection").mockReturnValue({
      anchorNode: manuscriptParagraph,
      focusNode: manuscriptParagraph,
      getRangeAt: () => ({
        getBoundingClientRect: () => ({ bottom: 40, height: 20, left: 20, right: 120, top: 20, width: 100, x: 20, y: 20, toJSON: () => ({}) }),
      }),
      isCollapsed: false,
      rangeCount: 1,
      toString: () => "Mara",
    } as unknown as Selection);
    act(() => window.document.dispatchEvent(new window.Event("selectionchange")));
    await waitFor(() => expect(screen.getByRole("toolbar", { name: "Selection actions" }).hasAttribute("hidden")).toBe(false));
    selectionSpy.mockRestore();

    await waitFor(() => expect(root.querySelector(".pm-codex-mention")).toBeTruthy());
    fireEvent.click(root.querySelector(".pm-codex-mention")!);
    await waitFor(() => expect(screen.getByText("Effective Canon Description at this block.")).toBeTruthy());
    expect(api.codex.getEffectiveEntry).toHaveBeenCalledWith(seriesId, codexEntryId, { blockId, sceneId });

    expect((screen.getByRole("button", { name: "Add Story Change" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("tab", { name: "AI" }));
    expect((screen.getByRole("button", { name: "Prepare candidate" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Continuity" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Comment", hidden: true }) as HTMLButtonElement).disabled).toBe(true);
    expect([...root.children].map((child) => `${child.tagName.toLowerCase()}.${child.className}`)).toEqual([
      "header.wr6-commandbar",
      "div.wr6-layout",
    ]);
  });

  it("manages Story changes from the Scene page without adding an editor insertion control", async () => {
    const createStoryChange = vi.spyOn(api.series, "createSceneProgressionBlock").mockRejectedValue(new Error("Test insertion stopped"));
    const { container } = render(<ReferenceWriteWorkspace session={session()} />);
    container.querySelector<HTMLElement>("#write-workspace")!.hidden = false;

    const add = await waitFor(() => {
      const button = screen.getByRole("button", { name: "Add Story Change" }) as HTMLButtonElement;
      expect(button.disabled).toBe(false);
      return button;
    });
    expect(add.closest(".wr6-field-heading")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Insert" })).toBeNull();
    fireEvent.click(add);
    await waitFor(() => expect(createStoryChange).toHaveBeenCalledWith(seriesId, sceneId, {
      afterBlockId: blockId,
      baseRevision: revision,
      progression: expect.objectContaining({ entryId: codexEntryId, kind: "field" }),
    }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Test insertion stopped"));
  });

  it("renders Story Change as a labeled Write surface while preserving its legacy actions", async () => {
    const storyChangeDocument: SceneBlockDocument = {
      schemaVersion: 1,
      blocks: [
        document.blocks[0]!,
        {
          createdAt: "2026-07-15T00:00:00.000Z",
          id: progressionBlockId,
          kind: "codexProgression",
          progressionId,
          updatedAt: "2026-07-15T00:00:00.000Z",
        },
      ],
    };
    vi.mocked(api.codex.listProgressions).mockResolvedValue([{
      progression: {
        archivedAt: null,
        body: "Mara now knows the gate only opens for a true name.",
        createdAt: "2026-07-15T00:00:00.000Z",
        effectiveFromSceneId: sceneId,
        effectiveToSceneId: null,
        entryId: codexEntryId,
        evidence: [],
        field: { detailTypeId: null, kind: "description" },
        fieldKey: null,
        id: progressionId,
        kind: "field",
        operation: "add",
        relationId: null,
        schemaVersion: 1,
        source: { blockId: progressionBlockId, kind: "write-block", sceneId },
        summary: "The gate's true-name rule becomes known.",
        updatedAt: "2026-07-15T00:00:00.000Z",
      },
      revision,
    } as never]);
    const { container } = render(<ReferenceWriteWorkspace session={session({
      draft: {
        characterCount: scene.characterCount,
        content: scene.content,
        document: storyChangeDocument,
        paragraphCount: 1,
        revision,
        sceneId,
        status: "draft",
        title: "Audit Gate",
      },
    })} />);
    const root = container.querySelector<HTMLElement>("#write-workspace")!;
    root.hidden = false;

    const sidebarItem = await screen.findByRole("button", { name: "Open Story Change for Mara" });
    expect(sidebarItem.textContent).toContain("The gate's true-name rule becomes known.");
    expect(sidebarItem.closest(".wr6-story-field")?.querySelector(".wr6-story-heading-copy small")?.textContent).toBe("1");

    fireEvent.click(sidebarItem);
    const storyChange = await waitFor(() => root.querySelector<HTMLElement>(".codex-progression-node.is-write-story-change")!);
    expect(storyChange).toBeTruthy();
    expect(within(storyChange).getByText("Story change")).toBeTruthy();
    expect(within(storyChange).getByText("Codex entry")).toBeTruthy();
    expect(within(storyChange).getByText("Field")).toBeTruthy();
    expect(within(storyChange).getByText("Change mode")).toBeTruthy();
    expect(within(storyChange).getByText("Summary")).toBeTruthy();
    expect(within(storyChange).getByText("What becomes true")).toBeTruthy();
    expect(within(storyChange).queryByText("Codex progression")).toBeNull();

    fireEvent.click(within(storyChange).getByRole("button", { name: "Delete Codex progression" }));
    expect(within(storyChange).getByText("Delete this Story Change?")).toBeTruthy();
    expect(within(storyChange).getByText("This removes it from the Scene and cannot be undone.")).toBeTruthy();
  });

  it("renames and confirms deletion from hierarchy title context menus without exposing Series lifecycle actions", async () => {
    const current = session();
    const { container } = render(<ReferenceWriteWorkspace session={current} />);
    container.querySelector<HTMLElement>("#write-workspace")!.hidden = false;
    await waitFor(() => expect((screen.getByRole("button", { name: "Add Story Change" }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByRole("button", { name: "Add Story Change" }).closest(".wr6-field-heading")).toBeTruthy();

    fireEvent.contextMenu(screen.getByRole("button", { name: "Volume OneVolume" }), { clientX: 40, clientY: 60 });
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    const dialog = screen.getByRole("dialog", { name: "Delete Volume One?" });
    expect(dialog.textContent).toContain("1 Chapter, 1 Act, and 1 Scene");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(current.deleteVolume).toHaveBeenCalledWith(volumeId));

    fireEvent.contextMenu(screen.getByRole("button", { name: "Chapter OneChapter" }), { clientX: 40, clientY: 60 });
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    const rename = screen.getByRole("textbox", { name: "Rename chapter" });
    fireEvent.change(rename, { target: { value: "Chapter Renamed" } });
    fireEvent.submit(rename.closest("form")!);
    await waitFor(() => expect(current.updateAct).toHaveBeenCalledWith(chapterId, { title: "Chapter Renamed" }));

    fireEvent.contextMenu(screen.getByRole("button", { name: "Audit SeriesSeries" }));
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.keyDown(screen.getByRole("button", { name: "Audit GateScene" }), { key: "F10", shiftKey: true });
    expect(screen.getByRole("menuitem", { name: "Rename" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeTruthy();
  });
});
