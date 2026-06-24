export function extractEditorText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return "";

  const element = node.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : null;
  if (element?.dataset.codexPreview === "true") return "";
  if (element?.dataset.mentionText) return element.dataset.mentionText;
  if (element?.tagName === "BR") return "\n";

  let text = "";
  node.childNodes.forEach((child) => {
    text += extractEditorText(child);
  });
  return text;
}

export function currentEditorCaretOffset(root: HTMLElement): number | null {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.endContainer)) return null;

  const prefix = document.createRange();
  prefix.selectNodeContents(root);
  prefix.setEnd(range.endContainer, range.endOffset);
  return extractEditorText(prefix.cloneContents()).length;
}

export function currentEditorSelectionOffsets(root: HTMLElement): { start: number; end: number } | null {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;

  const startRange = document.createRange();
  startRange.selectNodeContents(root);
  startRange.setEnd(range.startContainer, range.startOffset);

  const endRange = document.createRange();
  endRange.selectNodeContents(root);
  endRange.setEnd(range.endContainer, range.endOffset);

  const start = extractEditorText(startRange.cloneContents()).length;
  const end = extractEditorText(endRange.cloneContents()).length;
  return start <= end ? { start, end } : { start: end, end: start };
}

export function replaceEditorSelectionText(
  root: HTMLElement,
  currentText: string,
  insertedText: string,
): { caretOffset: number; text: string } {
  const selectionOffsets = currentEditorSelectionOffsets(root);
  const start = selectionOffsets?.start ?? currentText.length;
  const end = selectionOffsets?.end ?? start;
  return {
    caretOffset: start + insertedText.length,
    text: `${currentText.slice(0, start)}${insertedText}${currentText.slice(end)}`,
  };
}

export function restoreEditorCaret(root: HTMLElement, offset: number) {
  const range = document.createRange();
  let remaining = Math.max(0, offset);
  let restored = false;

  function place(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE) {
      const length = node.textContent?.length ?? 0;
      if (remaining <= length) {
        range.setStart(node, remaining);
        restored = true;
        return true;
      }
      remaining -= length;
      return false;
    }

    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return false;

    const element = node.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : null;
    if (element?.dataset.codexPreview === "true") return false;
    if (element?.dataset.mentionText) {
      const length = element.dataset.mentionText.length;
      if (remaining <= length) {
        range.setStartAfter(element);
        restored = true;
        return true;
      }
      remaining -= length;
      return false;
    }

    for (const child of Array.from(node.childNodes)) {
      if (place(child)) return true;
    }
    return false;
  }

  place(root);
  if (!restored) range.selectNodeContents(root);
  range.collapse(false);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export function previewPositionWithin(container: HTMLElement, element: HTMLElement) {
  const containerRect = container.getBoundingClientRect();
  const rect = element.getBoundingClientRect();
  const maxWidth = Math.min(520, Math.max(280, window.innerWidth - 32));
  const maxLeft = Math.max(0, container.clientWidth - maxWidth);
  return {
    left: Math.max(0, Math.min(rect.left - containerRect.left, maxLeft)),
    top: Math.max(0, rect.bottom - containerRect.top + 8),
  };
}
