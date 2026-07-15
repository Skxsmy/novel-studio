import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import type { Editor, JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import type { CodexEntryDocument, SceneBlock, SceneBlockDocument } from "@novel-studio/contracts";
import { createParagraphBlock } from "../../../app/sceneBlocks";
import { uiText } from "../../../app/uiText";
import type { ProgressionDraft } from "../story-change/storyChangeViewModel";
import type { ProgressionNodeViewModel } from "./CodexProgressionNodeView";
import { selectedBlockIdFromEditor } from "./editorSelection";
import { novelEditorExtensions } from "./novelEditorSchema";
import {
  novelEditorDocumentToSceneBlockDocument,
  sceneBlockDocumentToNovelEditorDocument,
  type NovelEditorDocument,
} from "./sceneBlockMapping";
import { storyChangeAnchorSelector } from "./storyChangeAnchors";
import "./editorStyles.css";

export interface NovelEditorProps {
  codexEntries: CodexEntryDocument[];
  document: SceneBlockDocument;
  emptyCodexPreviewText?: string;
  focusBlockId: string | null;
  onActiveBlockChange: (blockId: string | null) => void;
  onChange: (document: SceneBlockDocument) => void;
  onDeleteProgressionBlock: (blockId: string) => void;
  onFocusBlockHandled: (blockId: string) => void;
  onMoveProgressionBlock: (blockId: string, direction: "down" | "up") => void;
  onMoveProgressionBlockTo: (blockId: string, targetBlockId: string, placement: "after" | "before") => void;
  onSelectStoryChange: (blockId: string) => void;
  onToggleProgressionCollapse: (blockId: string) => void;
  onUpdateProgressionDraft: (blockId: string, patch: Partial<ProgressionDraft>) => void;
  progressionNodeViews: Record<string, ProgressionNodeViewModel>;
  resolveCodexPreviewDescription?: (entryId: string, blockId: string | null) => Promise<string>;
  storyChangePresentation?: "standard" | "write-story-change";
}

interface ActiveCodexPreview {
  description: string;
  entry: CodexEntryDocument;
  isLoading: boolean;
  key: string;
  style: CSSProperties;
}

interface RelativeRect {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

interface RelativeBounds extends RelativeRect {}

interface Size {
  height: number;
  width: number;
}

type ProgressionNodeStore = {
  getView: (blockId: string) => ProgressionNodeViewModel | null;
  setViews: (views: Record<string, ProgressionNodeViewModel>) => void;
  subscribe: (listener: () => void) => () => void;
};

function createEditorBlockId() {
  return createParagraphBlock().id;
}

function editorJsonToSceneDocument(editor: Editor) {
  return novelEditorDocumentToSceneBlockDocument(editor.getJSON() as NovelEditorDocument, createEditorBlockId);
}

function isTextSelectionPosition(value: number, editor: Editor) {
  return value > 0 && value <= editor.state.doc.content.size;
}

function restoreSelection(editor: Editor, position: number) {
  const nextPosition = isTextSelectionPosition(position, editor)
    ? position
    : Math.max(1, Math.min(editor.state.doc.content.size, position));
  try {
    editor.commands.setTextSelection(nextPosition);
  } catch {
    editor.commands.focus("end");
  }
}

function positionForBlockId(editor: Editor, blockId: string) {
  let position: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (node.attrs.blockId === blockId) {
      position = Math.min(pos + 1, pos + node.nodeSize - 1);
      return false;
    }
    return true;
  });
  return position;
}

function focusBlock(editor: Editor, blockId: string) {
  const position = positionForBlockId(editor, blockId);
  if (position === null) return false;
  editor.chain().focus().setTextSelection(position).run();
  return true;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function computeNovelCodexPreviewPosition(input: {
  anchor: RelativeRect;
  boundary?: RelativeBounds;
  margin?: number;
  previewSize: Size;
  shellSize: Size;
}) {
  const margin = input.margin ?? 12;
  const shellWidth = Math.max(0, input.shellSize.width);
  const shellHeight = Math.max(0, input.shellSize.height);
  const boundary = input.boundary ?? {
    bottom: shellHeight,
    left: 0,
    right: shellWidth,
    top: 0,
  };
  const boundaryWidth = Math.max(0, boundary.right - boundary.left);
  const boundaryHeight = Math.max(0, boundary.bottom - boundary.top);
  const availableWidth = Math.max(0, boundaryWidth - margin * 2);
  const width = Math.min(input.previewSize.width, availableWidth);
  const availableHeight = Math.max(0, boundaryHeight - margin * 2);
  const previewHeight = Math.min(input.previewSize.height, availableHeight);
  const minLeft = boundary.left + margin;
  const maxLeft = Math.max(minLeft, boundary.right - width - margin);
  const left = clamp(input.anchor.left, minLeft, maxLeft);
  const belowTop = input.anchor.bottom + 8;
  const aboveTop = input.anchor.top - previewHeight - 8;
  const minTop = boundary.top + margin;
  const maxTop = Math.max(minTop, boundary.bottom - previewHeight - margin);
  const preferredTop = belowTop + previewHeight <= boundary.bottom - margin || aboveTop < minTop
    ? belowTop
    : aboveTop;
  const top = clamp(preferredTop, minTop, maxTop);

  return {
    left,
    maxHeight: Math.max(0, boundary.bottom - top - margin),
    top,
    width,
  };
}

function findCodexMark(shell: HTMLElement, key: string) {
  return Array.from(shell.querySelectorAll<HTMLElement>(".pm-codex-mention"))
    .find((mark) => mark.dataset.codexKey === key) ?? null;
}

function codexPreviewStyle(mark: HTMLElement, shell: HTMLElement, preview: HTMLElement | null = null): CSSProperties {
  const anchor = mark.getBoundingClientRect();
  const bounds = shell.getBoundingClientRect();
  const boundaryElement = shell.closest<HTMLElement>(".copy-area") ?? shell;
  const boundaryBounds = boundaryElement.getBoundingClientRect();
  const shellWidth = bounds.width || shell.clientWidth || 720;
  const shellHeight = bounds.height || shell.clientHeight || 420;
  const previewBounds = preview?.getBoundingClientRect();
  const position = computeNovelCodexPreviewPosition({
    anchor: {
      bottom: anchor.bottom - bounds.top,
      left: anchor.left - bounds.left,
      right: anchor.right - bounds.left,
      top: anchor.top - bounds.top,
    },
    boundary: {
      bottom: boundaryBounds.bottom - bounds.top,
      left: boundaryBounds.left - bounds.left,
      right: boundaryBounds.right - bounds.left,
      top: boundaryBounds.top - bounds.top,
    },
    previewSize: {
      height: previewBounds?.height || 180,
      width: previewBounds?.width || Math.min(560, Math.max(280, shellWidth - 24)),
    },
    shellSize: { height: shellHeight, width: shellWidth },
  });
  return {
    left: `${Math.round(position.left)}px`,
    maxHeight: `${Math.round(position.maxHeight)}px`,
    maxWidth: "calc(100% - 24px)",
    position: "absolute",
    top: `${Math.round(position.top)}px`,
    width: `${Math.round(position.width)}px`,
  };
}

function documentsEqual(left: SceneBlockDocument, right: SceneBlockDocument) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function createProgressionNodeStore(initialViews: Record<string, ProgressionNodeViewModel>): ProgressionNodeStore {
  let views = initialViews;
  const listeners = new Set<() => void>();
  return {
    getView: (blockId) => views[blockId] ?? null,
    setViews: (nextViews) => {
      views = nextViews;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function isEmptyManuscript(document: SceneBlockDocument) {
  return document.blocks.every((block) => {
    if (block.kind === "sceneBreak" || block.kind === "codexProgression") return false;
    return (block.text ?? "").length === 0;
  });
}

function needsBlockIdNormalization(document: NovelEditorDocument) {
  return (document.content ?? []).some((node) => {
    if (!["paragraph", "heading", "blockquote", "horizontalRule", "codexProgressionBlock"].includes(node.type)) return false;
    return typeof node.attrs?.blockId !== "string" || !node.attrs.blockId;
  });
}

export function NovelEditor({
  codexEntries,
  document,
  emptyCodexPreviewText = uiText.writeEditor.empty.noDescription,
  focusBlockId,
  onActiveBlockChange,
  onChange,
  onDeleteProgressionBlock,
  onFocusBlockHandled,
  onMoveProgressionBlock,
  onMoveProgressionBlockTo,
  onSelectStoryChange,
  onToggleProgressionCollapse,
  onUpdateProgressionDraft,
  progressionNodeViews,
  resolveCodexPreviewDescription,
  storyChangePresentation = "standard",
}: NovelEditorProps) {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(() => document.blocks[0]?.id ?? null);
  const [activeCodexPreview, setActiveCodexPreview] = useState<ActiveCodexPreview | null>(null);
  const [renderVersion, setRenderVersion] = useState(0);
  const codexEntriesRef = useRef(codexEntries);
  const isApplyingExternalDocument = useRef(false);
  const progressionNodeStoreRef = useRef(createProgressionNodeStore(progressionNodeViews));
  const shellRef = useRef<HTMLDivElement | null>(null);
  const previewRequestRef = useRef(0);
  const onActiveBlockChangeRef = useRef(onActiveBlockChange);
  const onChangeRef = useRef(onChange);
  const onDeleteProgressionBlockRef = useRef(onDeleteProgressionBlock);
  const onFocusBlockHandledRef = useRef(onFocusBlockHandled);
  const onMoveProgressionBlockRef = useRef(onMoveProgressionBlock);
  const onMoveProgressionBlockToRef = useRef(onMoveProgressionBlockTo);
  const onSelectStoryChangeRef = useRef(onSelectStoryChange);
  const onToggleProgressionCollapseRef = useRef(onToggleProgressionCollapse);
  const onUpdateProgressionDraftRef = useRef(onUpdateProgressionDraft);

  useEffect(() => {
    onActiveBlockChangeRef.current = onActiveBlockChange;
    onChangeRef.current = onChange;
    onDeleteProgressionBlockRef.current = onDeleteProgressionBlock;
    onFocusBlockHandledRef.current = onFocusBlockHandled;
    onMoveProgressionBlockRef.current = onMoveProgressionBlock;
    onMoveProgressionBlockToRef.current = onMoveProgressionBlockTo;
    onSelectStoryChangeRef.current = onSelectStoryChange;
    onToggleProgressionCollapseRef.current = onToggleProgressionCollapse;
    onUpdateProgressionDraftRef.current = onUpdateProgressionDraft;
  }, [
    onActiveBlockChange,
    onChange,
    onDeleteProgressionBlock,
    onFocusBlockHandled,
    onMoveProgressionBlock,
    onMoveProgressionBlockTo,
    onSelectStoryChange,
    onToggleProgressionCollapse,
    onUpdateProgressionDraft,
  ]);

  useEffect(() => {
    progressionNodeStoreRef.current.setViews(progressionNodeViews);
  }, [progressionNodeViews]);

  const extensions = useMemo(() => novelEditorExtensions({
    getView: (blockId) => progressionNodeStoreRef.current.getView(blockId),
    onDelete: (blockId) => onDeleteProgressionBlockRef.current(blockId),
    onMove: (blockId, direction) => onMoveProgressionBlockRef.current(blockId, direction),
    onMoveTo: (blockId, targetBlockId, placement) => onMoveProgressionBlockToRef.current(blockId, targetBlockId, placement),
    onSelect: (blockId) => onSelectStoryChangeRef.current(blockId),
    onToggleCollapse: (blockId) => onToggleProgressionCollapseRef.current(blockId),
    onUpdateDraft: (blockId, patch) => onUpdateProgressionDraftRef.current(blockId, patch),
    presentation: storyChangePresentation,
    subscribe: (listener) => progressionNodeStoreRef.current.subscribe(listener),
  }, {
    getEntries: () => codexEntriesRef.current,
  }), [storyChangePresentation]);

  function syncSelection(editor: Editor) {
    const nextBlockId = selectedBlockIdFromEditor(editor);
    setActiveBlockId(nextBlockId);
    onActiveBlockChangeRef.current(nextBlockId);
  }

  const editor = useEditor({
    content: sceneBlockDocumentToNovelEditorDocument(document) as JSONContent,
    editorProps: {
      attributes: {
        "aria-label": uiText.writeEditor.aria.editor,
        "class": "novel-tiptap-prosemirror",
      },
      handleDOMEvents: {
        keydown: (_view, event) => {
          if (event.key === "Escape") {
            setActiveCodexPreview(null);
            return false;
          }
          if (event.key !== "Enter" && event.key !== " ") return false;
          const codexMark = event.target instanceof HTMLElement
            ? event.target.closest<HTMLElement>(".pm-codex-mention")
            : null;
          if (!codexMark) return false;
          event.preventDefault();
          toggleCodexPreview(codexMark);
          return true;
        },
      },
    },
    extensions,
    immediatelyRender: true,
    onCreate: ({ editor }) => {
      syncSelection(editor);
    },
    onSelectionUpdate: ({ editor }) => {
      syncSelection(editor);
      setRenderVersion((version) => version + 1);
    },
    onTransaction: () => {
      setRenderVersion((version) => version + 1);
    },
    onUpdate: ({ editor }) => {
      if (isApplyingExternalDocument.current) return;
      const currentJson = editor.getJSON() as NovelEditorDocument;
      const nextDocument = editorJsonToSceneDocument(editor);
      if (needsBlockIdNormalization(currentJson)) {
        const selectionFrom = editor.state.selection.from;
        isApplyingExternalDocument.current = true;
        editor.commands.setContent(sceneBlockDocumentToNovelEditorDocument(nextDocument) as JSONContent, { emitUpdate: false });
        restoreSelection(editor, selectionFrom);
        isApplyingExternalDocument.current = false;
      }
      onChangeRef.current(nextDocument);
      syncSelection(editor);
    },
  });

  useEffect(() => {
    codexEntriesRef.current = codexEntries;
    setActiveCodexPreview(null);
    if (editor) editor.view.dispatch(editor.state.tr.setMeta("codexMentionRefresh", true));
  }, [codexEntries, editor]);

  function refreshActiveCodexPreview() {
    setActiveCodexPreview((current) => {
      if (!current) return current;
      const shell = shellRef.current;
      const mark = shell ? findCodexMark(shell, current.key) : null;
      if (!shell || !mark) return null;
      return {
        ...current,
        style: codexPreviewStyle(mark, shell, shell.querySelector<HTMLElement>(".pm-codex-preview-popover")),
      };
    });
  }

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      const shell = shellRef.current;
      const target = event.target as Node | null;
      if (!shell || !target || shell.contains(target)) return;
      setActiveCodexPreview(null);
    }

    globalThis.document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => globalThis.document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);

  useEffect(() => {
    function handleCodexMentionKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveCodexPreview(null);
        return;
      }
      if (event.key !== "Enter" && event.key !== " ") return;
      const codexMark = event.target instanceof HTMLElement
        ? event.target.closest<HTMLElement>(".pm-codex-mention")
        : null;
      if (!codexMark || !shellRef.current?.contains(codexMark)) return;
      event.preventDefault();
      toggleCodexPreview(codexMark);
    }

    globalThis.document.addEventListener("keydown", handleCodexMentionKeydown, true);
    return () => globalThis.document.removeEventListener("keydown", handleCodexMentionKeydown, true);
  }, []);

  useEffect(() => {
    if (!activeCodexPreview) return;
    const ownerWindow = shellRef.current?.ownerDocument.defaultView ?? window;
    const handle = ownerWindow.setTimeout(() => refreshActiveCodexPreview(), 0);
    return () => ownerWindow.clearTimeout(handle);
  }, [activeCodexPreview?.key, renderVersion]);

  useEffect(() => {
    if (!activeCodexPreview) return;
    const ownerDocument = shellRef.current?.ownerDocument ?? globalThis.document;
    const ownerWindow = ownerDocument.defaultView ?? window;
    let handle = -1;
    const scheduleRefresh = () => {
      if (handle >= 0) ownerWindow.clearTimeout(handle);
      handle = ownerWindow.setTimeout(() => {
        handle = -1;
        refreshActiveCodexPreview();
      }, 0);
    };

    ownerDocument.addEventListener("scroll", scheduleRefresh, true);
    ownerWindow.addEventListener("resize", scheduleRefresh);
    return () => {
      if (handle >= 0) ownerWindow.clearTimeout(handle);
      ownerDocument.removeEventListener("scroll", scheduleRefresh, true);
      ownerWindow.removeEventListener("resize", scheduleRefresh);
    };
  }, [activeCodexPreview?.key]);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement & { __novelStudioEditor?: Editor };
    dom.__novelStudioEditor = editor;
    return () => {
      delete dom.__novelStudioEditor;
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const currentDocument = editorJsonToSceneDocument(editor);
    if (documentsEqual(currentDocument, document)) return;
    const selectionFrom = editor.state.selection.from;
    isApplyingExternalDocument.current = true;
    editor.commands.setContent(sceneBlockDocumentToNovelEditorDocument(document) as JSONContent, { emitUpdate: false });
    if (!focusBlockId || !focusBlock(editor, focusBlockId)) restoreSelection(editor, selectionFrom);
    else onFocusBlockHandledRef.current(focusBlockId);
    syncSelection(editor);
    isApplyingExternalDocument.current = false;
  }, [document, editor, focusBlockId]);

  useEffect(() => {
    if (!editor || !focusBlockId) return;
    if (focusBlock(editor, focusBlockId)) onFocusBlockHandledRef.current(focusBlockId);
  }, [document, editor, focusBlockId]);

  function focusEditorEnd() {
    if (!editor) return;
    editor.chain().focus("end").run();
    syncSelection(editor);
  }

  function toggleCodexPreview(codexMark: HTMLElement) {
    const entryId = codexMark.dataset.codexEntryId;
    const key = codexMark.dataset.codexKey;
    const entry = entryId ? codexEntriesRef.current.find((candidate) => candidate.metadata.id === entryId) : null;
    const shell = shellRef.current;
    if (!entry || !key || !shell) return;
    const style = codexPreviewStyle(codexMark, shell, shell.querySelector<HTMLElement>(".pm-codex-preview-popover"));
    if (activeCodexPreview?.key === key) {
      previewRequestRef.current += 1;
      setActiveCodexPreview(null);
      return;
    }
    const blockId = codexMark.closest<HTMLElement>("[data-block-id]")?.dataset.blockId ?? activeBlockId;
    const requestId = previewRequestRef.current + 1;
    previewRequestRef.current = requestId;
    setActiveCodexPreview({
      description: resolveCodexPreviewDescription ? "" : entry.description,
      entry,
      isLoading: Boolean(resolveCodexPreviewDescription),
      key,
      style,
    });
    if (!resolveCodexPreviewDescription) return;
    void resolveCodexPreviewDescription(entry.metadata.id, blockId).then((description) => {
      if (previewRequestRef.current !== requestId) return;
      setActiveCodexPreview((current) => current?.key === key
        ? { ...current, description, isLoading: false }
        : current);
    }).catch(() => {
      if (previewRequestRef.current !== requestId) return;
      setActiveCodexPreview((current) => current?.key === key
        ? { ...current, description: "", isLoading: false }
        : current);
    });
  }

  function handleEditorClick(event: MouseEvent<HTMLDivElement>) {
    const codexMark = event.target instanceof HTMLElement
      ? event.target.closest<HTMLElement>(".pm-codex-mention")
      : null;
    if (codexMark) {
      event.preventDefault();
      toggleCodexPreview(codexMark);
      return;
    }
    setActiveCodexPreview(null);

    const target = event.target instanceof HTMLElement
      ? event.target.closest(storyChangeAnchorSelector)
      : null;
    const blockId = target?.getAttribute("data-block-id");
    if (blockId) onSelectStoryChangeRef.current(blockId);
  }

  const isEmpty = isEmptyManuscript(document);

  return (
    <div
      className="novel-tiptap-shell"
      onPointerDown={(event) => {
        const target = event.target instanceof HTMLElement ? event.target : null;
        if (target?.closest(".pm-codex-mention, .pm-codex-preview-popover")) return;
        setActiveCodexPreview(null);
      }}
      ref={shellRef}
    >
      <EditorContent
        aria-label={uiText.writeEditor.aria.content}
        className="novel-tiptap-editor"
        data-empty={isEmpty ? "true" : "false"}
        data-placeholder={uiText.writeEditor.placeholders.scene}
        data-render-version={renderVersion}
        editor={editor}
        onClick={handleEditorClick}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setActiveCodexPreview(null);
            return;
          }
          if (event.key !== "Enter" && event.key !== " ") return;
          const codexMark = event.target instanceof HTMLElement
            ? event.target.closest<HTMLElement>(".pm-codex-mention")
            : null;
          if (!codexMark) return;
          event.preventDefault();
          toggleCodexPreview(codexMark);
        }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) focusEditorEnd();
        }}
      />
      {activeCodexPreview ? (
        <aside
          aria-label={uiText.writeEditor.aria.codexDescriptionPreview(activeCodexPreview.entry.metadata.name)}
          className="codex-preview-popover pm-codex-preview-popover"
          data-codex-preview="true"
          style={activeCodexPreview.style}
        >
          <div className="codex-preview-head">
            <div>
              <div className="row-meta">Codex</div>
              <strong>{activeCodexPreview.entry.metadata.name}</strong>
            </div>
          </div>
          <p aria-busy={activeCodexPreview.isLoading}>
            {activeCodexPreview.isLoading
              ? uiText.writeEditor.loadingCodex
              : activeCodexPreview.description || emptyCodexPreviewText}
          </p>
        </aside>
      ) : null}
    </div>
  );
}
