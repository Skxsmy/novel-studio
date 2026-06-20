import { defaultValueCtx, Editor, rootCtx } from "@milkdown/kit/core";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { useEffect, useRef } from "react";

export interface MarkdownSelection {
  text: string;
}

interface MarkdownEditorProps {
  initialValue: string;
  onChange: (markdown: string) => void;
  onSelectionChange: (selection: MarkdownSelection | null) => void;
}

function MarkdownEditorInner({
  initialValue,
  onChange,
  onSelectionChange,
}: MarkdownEditorProps) {
  const onChangeRef = useRef(onChange);
  const onSelectionChangeRef = useRef(onSelectionChange);

  useEffect(() => {
    onChangeRef.current = onChange;
    onSelectionChangeRef.current = onSelectionChange;
  }, [onChange, onSelectionChange]);

  useEditor((root) =>
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

  return <Milkdown />;
}

export function MarkdownEditor(props: MarkdownEditorProps) {
  return (
    <MilkdownProvider>
      <MarkdownEditorInner {...props} />
    </MilkdownProvider>
  );
}
