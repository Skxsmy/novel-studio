import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
} from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { uiText } from "../../../app/uiText";
import type {
  ProgressionDraft,
  ProgressionFieldSelection,
} from "../story-change/storyChangeViewModel";

export type ProgressionNodeOption = {
  label: string;
  value: string;
};

export type ProgressionNodeViewModel = {
  blockId: string;
  canMoveDown: boolean;
  canMoveUp: boolean;
  draft: ProgressionDraft;
  draftKey: string;
  entryLabel: string;
  entryOptions: ProgressionNodeOption[];
  fieldLabel: string;
  fieldOptions: ProgressionNodeOption[];
  isBusy: boolean;
  isCollapsed: boolean;
  isSelected: boolean;
  operationOptions: Array<{ label: string; value: ProgressionDraft["operation"] }>;
  progressionId: string;
};

export type ProgressionNodeViewOptions = {
  getView: (blockId: string) => ProgressionNodeViewModel | null;
  onDelete: (blockId: string) => void;
  onMove: (blockId: string, direction: "down" | "up") => void;
  onMoveTo: (blockId: string, targetBlockId: string, placement: "after" | "before") => void;
  onSelect: (blockId: string) => void;
  onToggleCollapse: (blockId: string) => void;
  onUpdateDraft: (blockId: string, patch: Partial<ProgressionDraft>) => void;
  subscribe: (listener: () => void) => () => void;
};

export const emptyProgressionNodeViewOptions: ProgressionNodeViewOptions = {
  getView: () => null,
  onDelete: () => undefined,
  onMove: () => undefined,
  onMoveTo: () => undefined,
  onSelect: () => undefined,
  onToggleCollapse: () => undefined,
  onUpdateDraft: () => undefined,
  subscribe: () => () => undefined,
};

const progressionText = uiText.writeProgression;
const minBoxHeight = 260;
const minBoxWidth = 320;

type BoxSize = {
  height?: number;
  width?: number;
};

type ResizeEdge = "bottom" | "corner" | "right";

function sizeStorageKey(blockId: string) {
  return `novelStudio.codexProgressionBox.v2.${blockId}`;
}

function readStoredSize(blockId: string): BoxSize {
  if (!blockId || typeof window === "undefined") return {};
  try {
    const stored = window.localStorage.getItem(sizeStorageKey(blockId));
    if (!stored) return {};
    const parsed = JSON.parse(stored) as BoxSize;
    const size: BoxSize = {};
    if (typeof parsed.height === "number") size.height = Math.max(minBoxHeight, parsed.height);
    if (typeof parsed.width === "number") size.width = Math.max(minBoxWidth, parsed.width);
    return size;
  } catch {
    return {};
  }
}

function storeSize(blockId: string, size: BoxSize) {
  if (!blockId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(sizeStorageKey(blockId), JSON.stringify(size));
  } catch {
    // UI-only sizing must never block writing.
  }
}

function progressionContainerWidth(element: HTMLElement | null) {
  const container = element?.closest(".novel-tiptap-prosemirror") ?? element?.parentElement;
  const width = container?.getBoundingClientRect().width;
  return typeof width === "number" && Number.isFinite(width) && width > 0
    ? Math.floor(width)
    : null;
}

function progressionDropTarget(element: HTMLElement | null, blockId: string, pointerY: number) {
  const container = element?.closest(".novel-tiptap-prosemirror");
  if (!container) return null;
  const orderedBlocks = Array.from(container.querySelectorAll<HTMLElement>("[data-block-id]"))
    .map((candidate) => ({
      id: candidate.getAttribute("data-block-id") ?? "",
      rect: candidate.getBoundingClientRect(),
    }))
    .filter((candidate) => candidate.id);
  const sourceIndex = orderedBlocks.findIndex((candidate) => candidate.id === blockId);
  if (sourceIndex < 0) return null;

  let insertionIndex = orderedBlocks.length;
  for (let index = 0; index < orderedBlocks.length; index += 1) {
    const rect = orderedBlocks[index]!.rect;
    if (pointerY < rect.top + rect.height / 2) {
      insertionIndex = index;
      break;
    }
  }

  const finalIndex = sourceIndex < insertionIndex ? insertionIndex - 1 : insertionIndex;
  if (finalIndex === sourceIndex) return null;
  const withoutSource = orderedBlocks.filter((candidate) => candidate.id !== blockId);
  if (!withoutSource.length) return null;
  if (finalIndex <= 0) {
    return { placement: "before" as const, targetBlockId: withoutSource[0]!.id };
  }
  if (finalIndex >= withoutSource.length) {
    return { placement: "after" as const, targetBlockId: withoutSource[withoutSource.length - 1]!.id };
  }
  return { placement: "before" as const, targetBlockId: withoutSource[finalIndex]!.id };
}

function clampBoxWidth(width: number, maxWidth: number | null) {
  if (!maxWidth) return Math.max(minBoxWidth, width);
  const minWidth = Math.min(minBoxWidth, maxWidth);
  return Math.min(maxWidth, Math.max(minWidth, width));
}

function draftFromView(view: ProgressionNodeViewModel | null): ProgressionDraft {
  return view?.draft ?? {
    body: "",
    entryId: "",
    fieldSelection: "description",
    operation: "add",
    summary: "",
  };
}

function stopEditorEvent(event: SyntheticEvent) {
  event.stopPropagation();
}

function viewSnapshot(options: ProgressionNodeViewOptions, blockId: string) {
  return () => options.getView(blockId);
}

export function CodexProgressionNodeView(props: NodeViewProps) {
  const options = props.extension.options as ProgressionNodeViewOptions;
  const blockId = String(props.node.attrs.blockId ?? "");
  const shellRef = useRef<HTMLElement | null>(null);
  const moveDragStartY = useRef<number | null>(null);
  const view = useSyncExternalStore(
    options.subscribe,
    viewSnapshot(options, blockId),
    viewSnapshot(options, blockId),
  );
  const [draft, setDraft] = useState<ProgressionDraft>(() => draftFromView(view));
  const [size, setSize] = useState<BoxSize>(() => readStoredSize(blockId));
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  useEffect(() => {
    setDraft(draftFromView(view));
  }, [view?.draftKey]);

  useEffect(() => {
    setSize(readStoredSize(blockId));
    setIsConfirmingDelete(false);
  }, [blockId]);

  useEffect(() => {
    storeSize(blockId, size);
  }, [blockId, size]);

  useEffect(() => {
    const element = shellRef.current;
    if (!element || typeof ResizeObserver === "undefined") return undefined;
    const container = element.closest(".novel-tiptap-prosemirror") ?? element.parentElement;
    if (!container) return undefined;
    const clampStoredWidth = () => {
      const maxWidth = progressionContainerWidth(element);
      setSize((current) => {
        if (current.width === undefined) return current;
        const width = clampBoxWidth(current.width, maxWidth);
        return width === current.width ? current : { ...current, width };
      });
    };
    clampStoredWidth();
    const observer = new ResizeObserver(clampStoredWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, [blockId]);

  function patchDraft(patch: Partial<ProgressionDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    options.onUpdateDraft(blockId, patch);
  }

  function startResize(edge: ResizeEdge, event: ReactPointerEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    options.onSelect(blockId);
    const rect = shellRef.current?.getBoundingClientRect();
    if (!rect) return;
    const start = {
      edge,
      height: size.height ?? rect.height,
      pointerX: event.clientX,
      pointerY: event.clientY,
      width: size.width ?? rect.width,
    };
    const maxWidth = progressionContainerWidth(shellRef.current);

    const handleMove = (moveEvent: PointerEvent) => {
      const nextSize: BoxSize = {};
      if (start.edge === "right" || start.edge === "corner") {
        nextSize.width = clampBoxWidth(Math.round(start.width + moveEvent.clientX - start.pointerX), maxWidth);
      } else if (size.width !== undefined) {
        nextSize.width = clampBoxWidth(size.width, maxWidth);
      }
      if (start.edge === "bottom" || start.edge === "corner") {
        nextSize.height = Math.max(minBoxHeight, Math.round(start.height + moveEvent.clientY - start.pointerY));
      } else if (size.height !== undefined) {
        nextSize.height = size.height;
      }
      setSize(nextSize);
    };
    const stopResize = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", stopResize);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", stopResize);
  }

  function startMoveDrag(event: ReactPointerEvent<HTMLElement>) {
    if (view?.isBusy) return;
    event.preventDefault();
    event.stopPropagation();
    options.onSelect(blockId);
    moveDragStartY.current = event.clientY;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function finishMoveDrag(event: ReactPointerEvent<HTMLElement>) {
    const startY = moveDragStartY.current;
    moveDragStartY.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (startY === null || !view || view.isBusy) return;
    event.preventDefault();
    event.stopPropagation();
    const target = progressionDropTarget(shellRef.current, blockId, event.clientY);
    if (target) options.onMoveTo(blockId, target.targetBlockId, target.placement);
  }

  function moveFromKeyboard(event: ReactKeyboardEvent<HTMLElement>) {
    if (!view || view.isBusy) return;
    if (event.key === "ArrowUp" && view.canMoveUp) {
      event.preventDefault();
      options.onMove(blockId, "up");
    }
    if (event.key === "ArrowDown" && view.canMoveDown) {
      event.preventDefault();
      options.onMove(blockId, "down");
    }
  }

  if (!view) {
    return (
      <NodeViewWrapper
        as="div"
        className="codex-progression-node is-missing"
        data-block-id={blockId}
        data-codex-progression-block="true"
        contentEditable={false}
      >
        <div className="codex-progression-head">
          <strong>{progressionText.title}</strong>
          <span>{progressionText.missingRecord}</span>
        </div>
      </NodeViewWrapper>
    );
  }

  const collapsedText = draft.summary.trim() || draft.body.trim();
  const isCollapsed = view.isCollapsed && !isConfirmingDelete;
  const sizeStyle: CSSProperties = {
    height: !view.isCollapsed && size.height ? `${size.height}px` : undefined,
    width: size.width ? `${size.width}px` : undefined,
  };

  return (
    <NodeViewWrapper
      as="section"
      className={`codex-progression-node${view.isSelected ? " is-selected" : ""}${isCollapsed ? " is-collapsed" : ""}${isConfirmingDelete ? " is-confirming-delete" : ""}`}
      data-block-id={blockId}
      data-codex-progression-block="true"
      contentEditable={false}
      onClick={() => options.onSelect(blockId)}
      ref={shellRef}
      style={sizeStyle}
    >
      <div className="codex-progression-head">
        <span
          aria-disabled={view.isBusy || (!view.canMoveUp && !view.canMoveDown)}
          aria-label={progressionText.aria.move}
          className="codex-progression-drag-handle"
          onKeyDown={moveFromKeyboard}
          onMouseDown={stopEditorEvent}
          onPointerCancel={() => {
            moveDragStartY.current = null;
          }}
          onPointerDown={startMoveDrag}
          onPointerUp={finishMoveDrag}
          role="button"
          tabIndex={0}
          title={progressionText.aria.move}
        />
        {view.isCollapsed ? (
          <button
            className="codex-progression-collapsed-line"
            disabled={view.isBusy || isConfirmingDelete}
            onClick={() => options.onToggleCollapse(blockId)}
            onMouseDown={stopEditorEvent}
            title={progressionText.actions.expand}
            type="button"
          >
            <span className="codex-progression-chip">{progressionText.title}</span>
            <span>{view.entryLabel}</span>
            <span>{view.fieldLabel}</span>
            <strong className={collapsedText ? undefined : "is-empty"}>
              {collapsedText || progressionText.emptyCollapsed}
            </strong>
          </button>
        ) : (
          <span className="codex-progression-chip">{progressionText.title}</span>
        )}
        <div className="codex-progression-node-actions">
          <button
            aria-label={view.isCollapsed ? progressionText.actions.expand : progressionText.actions.collapse}
            className="btn compact codex-progression-collapse-trigger"
            disabled={view.isBusy || isConfirmingDelete}
            onClick={() => options.onToggleCollapse(blockId)}
            onMouseDown={stopEditorEvent}
            title={view.isCollapsed ? progressionText.actions.expand : progressionText.actions.collapse}
            type="button"
          >
            {view.isCollapsed ? progressionText.actions.expandShort : progressionText.actions.collapseShort}
          </button>
          <button
            aria-label={progressionText.actions.delete}
            className="btn compact codex-progression-delete-trigger"
            disabled={view.isBusy || isConfirmingDelete}
            onClick={() => setIsConfirmingDelete(true)}
            onMouseDown={stopEditorEvent}
            title={progressionText.actions.delete}
            type="button"
          >
            {progressionText.actions.deleteShort}
          </button>
        </div>
      </div>

      {isConfirmingDelete ? (
        <div className="codex-progression-delete-confirm" role="alert">
          <span>{progressionText.confirmDeleteCopy}</span>
          <button
            className="btn compact"
            disabled={view.isBusy}
            onClick={() => setIsConfirmingDelete(false)}
            onMouseDown={stopEditorEvent}
            type="button"
          >
            {progressionText.actions.cancelDelete}
          </button>
          <button
            aria-label={progressionText.actions.confirmDelete}
            className="btn compact danger"
            disabled={view.isBusy}
            onClick={() => options.onDelete(blockId)}
            onMouseDown={stopEditorEvent}
            type="button"
          >
            {progressionText.actions.deleteShort}
          </button>
        </div>
      ) : null}

      {!view.isCollapsed && !isConfirmingDelete ? (
        <>
          <div className="codex-progression-control-row">
            <select
              aria-label={progressionText.aria.selectedEntry}
              className="codex-progression-entry-select"
              disabled={view.isBusy}
              onChange={(event) => patchDraft({ entryId: event.target.value, fieldSelection: "description" })}
              onMouseDown={stopEditorEvent}
              value={draft.entryId}
            >
              {view.entryOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select
              aria-label={progressionText.aria.selectedField}
              className="codex-progression-target-select"
              disabled={view.isBusy}
              onChange={(event) => patchDraft({ fieldSelection: event.target.value as ProgressionFieldSelection })}
              onMouseDown={stopEditorEvent}
              value={draft.fieldSelection}
            >
              {view.fieldOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select
              aria-label={progressionText.aria.selectedOperation}
              className="codex-progression-operation-select"
              disabled={view.isBusy}
              onChange={(event) => patchDraft({ operation: event.target.value as ProgressionDraft["operation"] })}
              onMouseDown={stopEditorEvent}
              value={draft.operation}
            >
              {view.operationOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <input
            aria-label={progressionText.aria.selectedSummary}
            className="codex-progression-summary-input"
            disabled={view.isBusy}
            onChange={(event) => patchDraft({ summary: event.target.value })}
            onMouseDown={stopEditorEvent}
            placeholder={progressionText.placeholders.summary}
            value={draft.summary}
          />
          <label className="codex-progression-writing-area">
            <textarea
              aria-label={progressionText.aria.selectedText}
              className="input codex-progression-body"
              disabled={view.isBusy}
              onChange={(event) => patchDraft({ body: event.target.value })}
              onMouseDown={stopEditorEvent}
              placeholder={progressionText.placeholders.text}
              value={draft.body}
            />
          </label>
        </>
      ) : null}
      <span
        aria-hidden="true"
        className="codex-progression-resize-edge is-right"
        onPointerDown={(event) => startResize("right", event)}
      />
      <span
        aria-hidden="true"
        className="codex-progression-resize-edge is-bottom"
        onPointerDown={(event) => startResize("bottom", event)}
      />
      <span
        aria-hidden="true"
        className="codex-progression-resize-edge is-corner"
        onPointerDown={(event) => startResize("corner", event)}
      />
    </NodeViewWrapper>
  );
}
