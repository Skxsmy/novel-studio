import type { Editor } from "@tiptap/core";

type Attrs = Record<string, unknown> | null | undefined;
type SelectionWithNode = Editor["state"]["selection"] & {
  node?: { attrs?: Attrs };
};

function blockIdFromAttrs(attrs: Attrs) {
  const blockId = attrs?.blockId;
  return typeof blockId === "string" && blockId ? blockId : null;
}

export function selectedBlockIdFromEditor(editor: Editor) {
  const selection = editor.state.selection as SelectionWithNode;
  const selectedNodeBlockId = blockIdFromAttrs(selection.node?.attrs);
  if (selectedNodeBlockId) return selectedNodeBlockId;

  for (let depth = selection.$from.depth; depth >= 0; depth -= 1) {
    const node = selection.$from.node(depth);
    const blockId = blockIdFromAttrs(node.attrs);
    if (blockId) return blockId;
  }

  const afterBlockId = blockIdFromAttrs(selection.$from.nodeAfter?.attrs);
  if (afterBlockId) return afterBlockId;
  return blockIdFromAttrs(selection.$from.nodeBefore?.attrs);
}
