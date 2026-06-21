import { defaultValueCtx, Editor, editorViewCtx, rootCtx } from "@milkdown/kit/core";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { TextSelection } from "@milkdown/prose/state";
import { useEffect, useRef } from "react";

export interface MarkdownSelection {
  text: string;
}

export interface MarkdownTextSelectionRequest {
  key: string;
  text: string;
}

interface MarkdownEditorProps {
  initialValue: string;
  onChange: (markdown: string) => void;
  onSelectionChange: (selection: MarkdownSelection | null) => void;
  selectTextRequest?: MarkdownTextSelectionRequest | null;
}

function locateTextRangeInDocument(
  doc: Parameters<typeof TextSelection.create>[0],
  text: string,
): { from: number; to: number } | null {
  const fullMap: number[] = [];
  const fullChars: string[] = [];
  doc.descendants((node, position) => {
    if (!node.isText || !node.text) return true;
    Array.from(node.text).forEach((character, offset) => {
      fullChars.push(character);
      fullMap.push(position + offset);
    });
    return true;
  });
  const fullText = fullChars.join("");
  const exactTarget = text.trim();
  const exactIndex = fullText.indexOf(exactTarget);
  if (exactIndex >= 0) {
    return {
      from: fullMap[exactIndex] ?? 1,
      to: (fullMap[exactIndex + Array.from(exactTarget).length - 1] ?? 1) + 1,
    };
  }

  const normalizedChars: string[] = [];
  const normalizedMap: number[] = [];
  fullChars.forEach((character, index) => {
    if (/\s/u.test(character)) return;
    normalizedChars.push(character);
    normalizedMap.push(fullMap[index] ?? 1);
  });
  const normalizedText = normalizedChars.join("");
  const normalizedTarget = Array.from(exactTarget).filter((character) => !/\s/u.test(character)).join("");
  const normalizedIndex = normalizedText.indexOf(normalizedTarget);
  if (normalizedIndex < 0) return null;
  return {
    from: normalizedMap[normalizedIndex] ?? 1,
    to: (normalizedMap[normalizedIndex + normalizedTarget.length - 1] ?? 1) + 1,
  };
}

function MarkdownEditorInner({
  initialValue,
  onChange,
  onSelectionChange,
  selectTextRequest,
}: MarkdownEditorProps) {
  const onChangeRef = useRef(onChange);
  const onSelectionChangeRef = useRef(onSelectionChange);

  useEffect(() => {
    onChangeRef.current = onChange;
    onSelectionChangeRef.current = onSelectionChange;
  }, [onChange, onSelectionChange]);

  const { get } = useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, initialValue);
        ctx.get(listenerCtx)
          .markdownUpdated((_ctx, markdown) => onChangeRef.current(markdown))
          .selectionUpdated((_ctx, selection) => {
            if (selection.empty) {
              onSelectionChangeRef.current(null);
              return;
            }
            const text = selection.$from.doc.textBetween(selection.from, selection.to, "\n");
            onSelectionChangeRef.current(text ? { text } : null);
          });
      })
      .use(commonmark)
      .use(listener),
    [],
  );

  useEffect(() => {
    if (!selectTextRequest) return;
    const request = selectTextRequest;
    let cancelled = false;
    let attempts = 0;

    function trySelect(): boolean {
      const editor = get();
      if (!editor) return false;
      return editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const targetText = request.text.trim();
        const range = locateTextRangeInDocument(view.state.doc, targetText);
        if (!range) return false;
        const transaction = view.state.tr.setSelection(
          TextSelection.create(view.state.doc, range.from, range.to),
        ).scrollIntoView();
        view.dispatch(transaction);
        view.focus();
        return true;
      });
    }

    function schedule(): void {
      window.setTimeout(() => {
        if (cancelled) return;
        attempts += 1;
        if (trySelect() || attempts >= 20) return;
        schedule();
      }, 80);
    }

    schedule();
    return () => {
      cancelled = true;
    };
  }, [get, selectTextRequest]);

  return <Milkdown />;
}

export function MarkdownEditor(props: MarkdownEditorProps) {
  return (
    <MilkdownProvider>
      <MarkdownEditorInner {...props} />
    </MilkdownProvider>
  );
}
