// @vitest-environment jsdom

import { undo, redo } from "@codemirror/commands";
import { EditorView } from "@codemirror/view";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CodexEntryDocument } from "@novel-studio/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { cleanEditorPasteText, computeCodexPreviewPosition, EditorSurface } from "./EditorSurface";

const revision = "a".repeat(64);
const codexEntryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function editorView(label: string) {
  const element = screen.getByLabelText(label);
  const view = EditorView.findFromDOM(element);
  if (!view) throw new Error(`Missing CodeMirror editor for ${label}`);
  return view;
}

function codexEntryDocument(
  name = "Harbor Lock",
  description = "A storm-pressure mechanism below the west quay.",
  aliases: string[] = [],
): CodexEntryDocument {
  return {
    description,
    metadata: {
      aiContextPolicy: "on-mention",
      aliases,
      archivedAt: null,
      categoryId: "location",
      createdAt: "2026-06-23T00:00:00.000Z",
      details: {},
      detailAiContext: {},
      id: codexEntryId,
      mention: {
        automaticPlural: false,
        caseSensitive: false,
        excludedTerms: [],
        matchAliases: true,
      },
      name,
      schemaVersion: 1,
      thumbnail: null,
      updatedAt: "2026-06-23T00:00:00.000Z",
    },
    relativePath: `codex/custom/location/${codexEntryId}.md`,
    research: {
      content: "",
      metadata: {
        createdAt: "2026-06-23T00:00:00.000Z",
        entryId: codexEntryId,
        schemaVersion: 1,
        updatedAt: "2026-06-23T00:00:00.000Z",
      },
      relativePath: `codex/entry-research/${codexEntryId}.md`,
      revision,
    },
    revision,
  };
}

afterEach(() => {
  cleanup();
});

describe("EditorSurface", () => {
  it("normalizes pasted editor text without adding markup", () => {
    expect(cleanEditorPasteText("A\r\nB\rC\u00a0D")).toBe("A\nB\nC D");
  });

  it("decorates duplicate Codex mentions while preserving pure text", async () => {
    const entry = codexEntryDocument("Harbor Lock", "A storm-pressure mechanism below the west quay.", ["Bellgate"]);
    const changes: string[] = [];
    render(
      <EditorSurface
        ariaLabel="Draft"
        codexEntries={[entry]}
        onChange={(value) => changes.push(value)}
        value="Bellgate and Bellgate"
      />,
    );

    const editor = await screen.findByLabelText("Draft");
    await waitFor(() => {
      expect(editor.querySelectorAll(".cm-codex-mention")).toHaveLength(2);
    });

    const firstMark = editor.querySelectorAll(".cm-codex-mention")[0];
    if (!firstMark) throw new Error("Missing first Bellgate mark");
    fireEvent.click(firstMark);
    const preview = screen.getByLabelText("Harbor Lock canon description");
    const layer = preview.closest(".editor-tooltip-layer") as HTMLElement | null;
    expect(preview).toBeTruthy();
    expect((preview as HTMLElement).style.overflowX).toBe("hidden");
    expect((preview as HTMLElement).style.overflowY).toBe("auto");
    expect(preview.closest(".novel-editor")).toBeNull();
    expect(layer?.dataset.editorTooltipLayer).toBe("true");
    expect((preview as HTMLElement).style.zIndex).toBe("2147483000");
    expect(layer?.style.zIndex).toBe("2147483000");
    expect(editorView("Draft").state.doc.toString()).toBe("Bellgate and Bellgate");
    expect(changes).toEqual([]);
  });

  it("keeps top-layer previews open when the preview itself is clicked", async () => {
    const entry = codexEntryDocument("Harbor Lock", "A storm-pressure mechanism below the west quay.", ["Bellgate"]);
    render(
      <EditorSurface
        ariaLabel="Draft"
        codexEntries={[entry]}
        onChange={() => undefined}
        value="Bellgate"
      />,
    );

    const editor = await screen.findByLabelText("Draft");
    await waitFor(() => {
      expect(editor.querySelector(".cm-codex-mention")).toBeTruthy();
    });
    const mark = editor.querySelector(".cm-codex-mention");
    if (!mark) throw new Error("Missing Bellgate mark");

    fireEvent.click(mark);
    const preview = screen.getByLabelText("Harbor Lock canon description");
    fireEvent.pointerDown(preview);
    expect(screen.getByLabelText("Harbor Lock canon description")).toBeTruthy();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByLabelText("Harbor Lock canon description")).toBeNull();
  });

  it("closes a Codex preview when another editor position is clicked", async () => {
    const entry = codexEntryDocument("Harbor Lock", "A storm-pressure mechanism below the west quay.", ["Bellgate"]);
    render(
      <EditorSurface
        ariaLabel="Draft"
        codexEntries={[entry]}
        onChange={() => undefined}
        value="Bellgate waits here."
      />,
    );

    const editor = await screen.findByLabelText("Draft");
    await waitFor(() => {
      expect(editor.querySelector(".cm-codex-mention")).toBeTruthy();
    });
    const mark = editor.querySelector(".cm-codex-mention");
    if (!mark) throw new Error("Missing Bellgate mark");

    fireEvent.click(mark);
    expect(screen.getByLabelText("Harbor Lock canon description")).toBeTruthy();

    fireEvent.pointerDown(editor);
    expect(screen.queryByLabelText("Harbor Lock canon description")).toBeNull();
  });

  it("clamps Codex preview position to the editor's visible vertical bounds", () => {
    const base = {
      editorBounds: { bottom: 500, left: 80, right: 680, top: 100 },
      fallbackLeft: 120,
      margin: 12,
      previewSize: { height: 140, width: 420 },
      viewportBounds: { bottom: 800, left: 0, right: 1000, top: 0 },
    };

    expect(computeCodexPreviewPosition({
      ...base,
      anchor: { bottom: -180, left: 160, right: 180, top: -200 },
      anchorVertical: "visible",
    }).top).toBe(112);
    expect(computeCodexPreviewPosition({
      ...base,
      anchor: { bottom: 780, left: 160, right: 180, top: 760 },
      anchorVertical: "visible",
    }).top).toBe(348);
    expect(computeCodexPreviewPosition({
      ...base,
      anchor: null,
      anchorVertical: "above",
    }).top).toBe(112);
    expect(computeCodexPreviewPosition({
      ...base,
      anchor: null,
      anchorVertical: "below",
    }).top).toBe(348);
    expect(computeCodexPreviewPosition({
      ...base,
      anchor: null,
      anchorVertical: "below",
      editorBounds: { bottom: 138, left: 80, right: 680, top: 100 },
    }).availableHeight).toBe(14);
  });

  it("emits pure text changes and supports undo and redo", async () => {
    const changes: string[] = [];
    render(<EditorSurface ariaLabel="Draft" onChange={(value) => changes.push(value)} value="" />);

    await screen.findByLabelText("Draft");
    const view = editorView("Draft");
    view.dispatch({ changes: { from: 0, insert: "Alpha" }, selection: { anchor: 5 } });
    expect(view.state.doc.toString()).toBe("Alpha");
    expect(changes.at(-1)).toBe("Alpha");

    undo(view);
    expect(view.state.doc.toString()).toBe("");
    expect(changes.at(-1)).toBe("");

    redo(view);
    expect(view.state.doc.toString()).toBe("Alpha");
    expect(changes.at(-1)).toBe("Alpha");
  });

  it("syncs external value updates and clamps restored selection", async () => {
    const noop = () => undefined;
    const { rerender } = render(<EditorSurface ariaLabel="Draft" onChange={noop} value="Alpha" />);

    await screen.findByLabelText("Draft");
    const view = editorView("Draft");
    view.dispatch({ selection: { anchor: 5 } });

    rerender(<EditorSurface ariaLabel="Draft" onChange={noop} value="A" />);
    await waitFor(() => {
      expect(view.state.doc.toString()).toBe("A");
      expect(view.state.selection.main.head).toBe(1);
    });
  });

  it("keeps CodeMirror editable without textarea/contentEditable surface classes", async () => {
    render(<EditorSurface ariaLabel="Draft" className="canon-description-editor" onChange={() => undefined} value="Alpha" />);

    const editor = await screen.findByLabelText("Draft");
    const view = editorView("Draft");
    expect(editor.closest(".textarea")).toBeNull();
    expect(editor.closest(".inline-mention-editor")).toBeNull();
    expect(view.contentDOM.getAttribute("contenteditable")).toBe("true");
    expect(view.contentDOM.className).toContain("cm-lineWrapping");
  });
});
