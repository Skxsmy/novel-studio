import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { Editor, JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import type { SceneBlock, SceneBlockDocument } from "@novel-studio/contracts";
import { createParagraphBlock } from "../../../app/sceneBlocks";
import { uiText } from "../../../app/uiText";
import { selectedBlockIdFromEditor } from "./editorSelection";
import { novelEditorExtensions } from "./novelEditorSchema";
import {
  novelEditorDocumentToSceneBlockDocument,
  sceneBlockDocumentToNovelEditorDocument,
  type NovelEditorDocument,
} from "./sceneBlockMapping";
import { storyChangeAnchorSelector } from "./storyChangeAnchors";
import "./editorStyles.css";

type EditableSceneBlockKind = "paragraph" | "heading" | "quote" | "sceneBreak";

export interface NovelEditorProps {
  canAddStoryChange: boolean;
  document: SceneBlockDocument;
  isStoryChangeBusy: boolean;
  onAddStoryChangeAfter: (blockId: string | null) => void;
  onChange: (document: SceneBlockDocument) => void;
  onDeleteCurrent: (blockId: string | null) => void;
  onInsertParagraphAfter: (blockId: string | null) => string | null;
  onSelectStoryChange: (blockId: string) => void;
}

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

function documentsEqual(left: SceneBlockDocument, right: SceneBlockDocument) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function editableKindForBlock(block: SceneBlock | null): EditableSceneBlockKind | "storyChange" {
  if (!block) return "paragraph";
  if (block.kind === "codexProgression") return "storyChange";
  return block.kind;
}

function isEmptyManuscript(document: SceneBlockDocument) {
  return document.blocks.every((block) => {
    if (block.kind === "sceneBreak" || block.kind === "codexProgression") return false;
    return (block.text ?? "").length === 0;
  });
}

function needsBlockIdNormalization(document: NovelEditorDocument) {
  return (document.content ?? []).some((node) => {
    if (!["paragraph", "heading", "blockquote", "horizontalRule", "storyChangeAnchor"].includes(node.type)) return false;
    return typeof node.attrs?.blockId !== "string" || !node.attrs.blockId;
  });
}

export function NovelEditor({
  canAddStoryChange,
  document,
  isStoryChangeBusy,
  onAddStoryChangeAfter,
  onChange,
  onDeleteCurrent,
  onInsertParagraphAfter,
  onSelectStoryChange,
}: NovelEditorProps) {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(() => document.blocks[0]?.id ?? null);
  const [renderVersion, setRenderVersion] = useState(0);
  const isApplyingExternalDocument = useRef(false);
  const pendingFocusBlockId = useRef<string | null>(null);
  const onAddStoryChangeAfterRef = useRef(onAddStoryChangeAfter);
  const onChangeRef = useRef(onChange);
  const onDeleteCurrentRef = useRef(onDeleteCurrent);
  const onInsertParagraphAfterRef = useRef(onInsertParagraphAfter);
  const onSelectStoryChangeRef = useRef(onSelectStoryChange);

  useEffect(() => {
    onAddStoryChangeAfterRef.current = onAddStoryChangeAfter;
    onChangeRef.current = onChange;
    onDeleteCurrentRef.current = onDeleteCurrent;
    onInsertParagraphAfterRef.current = onInsertParagraphAfter;
    onSelectStoryChangeRef.current = onSelectStoryChange;
  }, [
    onAddStoryChangeAfter,
    onChange,
    onDeleteCurrent,
    onInsertParagraphAfter,
    onSelectStoryChange,
  ]);

  const extensions = useMemo(() => novelEditorExtensions(), []);

  function syncSelection(editor: Editor) {
    const nextBlockId = selectedBlockIdFromEditor(editor);
    setActiveBlockId(nextBlockId);
  }

  const editor = useEditor({
    content: sceneBlockDocumentToNovelEditorDocument(document) as JSONContent,
    editorProps: {
      attributes: {
        "aria-label": uiText.writeEditor.aria.editor,
        "class": "novel-tiptap-prosemirror",
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
    const focusBlockId = pendingFocusBlockId.current;
    pendingFocusBlockId.current = null;
    if (!focusBlockId || !focusBlock(editor, focusBlockId)) restoreSelection(editor, selectionFrom);
    syncSelection(editor);
    isApplyingExternalDocument.current = false;
  }, [document, editor]);

  function focusEditorEnd() {
    if (!editor) return;
    editor.chain().focus("end").run();
    syncSelection(editor);
  }

  function handleEditorClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target instanceof HTMLElement
      ? event.target.closest(storyChangeAnchorSelector)
      : null;
    const blockId = target?.getAttribute("data-block-id");
    if (blockId) onSelectStoryChangeRef.current(blockId);
  }

  const activeBlock = document.blocks.find((block) => block.id === activeBlockId) ?? null;
  const activeKind = editableKindForBlock(activeBlock);
  const canEditCurrentBlock = Boolean(activeBlockId && activeKind !== "storyChange");
  const isEmpty = isEmptyManuscript(document);

  return (
    <div className="novel-tiptap-shell">
      <div
        className="novel-editor-action-rail"
        aria-label={uiText.writeEditor.aria.toolbar}
      >
        <button
          aria-label={uiText.writeEditor.tools.addParagraph}
          className="tool"
          disabled={!editor}
          onClick={() => {
            pendingFocusBlockId.current = onInsertParagraphAfterRef.current(activeBlockId);
          }}
          title={uiText.writeEditor.tools.addParagraph}
          type="button"
        >
          +
        </button>
        <button
          aria-label={uiText.writeEditor.tools.storyChange}
          className="tool story-change-tool"
          disabled={!editor || !canAddStoryChange || isStoryChangeBusy}
          onClick={() => onAddStoryChangeAfterRef.current(activeBlockId)}
          title={uiText.writeEditor.tools.storyChange}
          type="button"
        >
          {uiText.writeProgression.title}
        </button>
        <button
          aria-label={uiText.writeEditor.tools.deleteCurrent}
          className="tool"
          disabled={!editor || !activeBlockId || !canEditCurrentBlock && activeKind !== "storyChange"}
          onClick={() => onDeleteCurrentRef.current(activeBlockId)}
          title={uiText.writeEditor.tools.deleteCurrent}
          type="button"
        >
          x
        </button>
      </div>
      <EditorContent
        aria-label={uiText.writeEditor.aria.content}
        className="novel-tiptap-editor"
        data-empty={isEmpty ? "true" : "false"}
        data-placeholder={uiText.writeEditor.placeholders.scene}
        data-render-version={renderVersion}
        editor={editor}
        onClick={handleEditorClick}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) focusEditorEnd();
        }}
      />
    </div>
  );
}
