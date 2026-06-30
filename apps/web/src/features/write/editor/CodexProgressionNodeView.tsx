import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
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
  onSelect: (blockId: string) => void;
  onToggleCollapse: (blockId: string) => void;
  onUpdateDraft: (blockId: string, patch: Partial<ProgressionDraft>) => void;
  subscribe: (listener: () => void) => () => void;
};

export const emptyProgressionNodeViewOptions: ProgressionNodeViewOptions = {
  getView: () => null,
  onDelete: () => undefined,
  onSelect: () => undefined,
  onToggleCollapse: () => undefined,
  onUpdateDraft: () => undefined,
  subscribe: () => () => undefined,
};

const progressionText = uiText.writeProgression;
const minBoxHeight = 150;
const minBoxWidth = 360;

type BoxSize = {
  height?: number;
  width?: number;
};

type ResizeEdge = "bottom" | "corner" | "right";

function sizeStorageKey(blockId: string) {
  return `novelStudio.codexProgressionBox.${blockId}`;
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
  const view = useSyncExternalStore(
    options.subscribe,
    viewSnapshot(options, blockId),
    viewSnapshot(options, blockId),
  );
  const [draft, setDraft] = useState<ProgressionDraft>(() => draftFromView(view));
  const [size, setSize] = useState<BoxSize>(() => readStoredSize(blockId));

  useEffect(() => {
    setDraft(draftFromView(view));
  }, [view?.draftKey]);

  useEffect(() => {
    setSize(readStoredSize(blockId));
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

  const sizeStyle: CSSProperties = {
    height: !view.isCollapsed && size.height ? `${size.height}px` : undefined,
    width: size.width ? `${size.width}px` : undefined,
  };

  return (
    <NodeViewWrapper
      as="section"
      className={`codex-progression-node${view.isSelected ? " is-selected" : ""}${view.isCollapsed ? " is-collapsed" : ""}`}
      data-block-id={blockId}
      data-codex-progression-block="true"
      contentEditable={false}
      onClick={() => options.onSelect(blockId)}
      ref={shellRef}
      style={sizeStyle}
    >
      <div className="codex-progression-head">
        <button
          aria-label={progressionText.aria.move}
          className="codex-progression-handle"
          data-drag-handle
          onMouseDown={stopEditorEvent}
          title={progressionText.aria.move}
          type="button"
        >
          ::
        </button>
        {view.isCollapsed ? (
          <button
            className="codex-progression-collapsed-line"
            disabled={view.isBusy}
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
          <>
            <span className="codex-progression-chip">{progressionText.title}</span>
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
          </>
        )}
        <button
          aria-label={view.isCollapsed ? progressionText.actions.expand : progressionText.actions.collapse}
          className="icon-btn"
          disabled={view.isBusy}
          onClick={() => options.onToggleCollapse(blockId)}
          onMouseDown={stopEditorEvent}
          title={view.isCollapsed ? progressionText.actions.expand : progressionText.actions.collapse}
          type="button"
        >
          {view.isCollapsed ? "+" : "-"}
        </button>
        <button
          aria-label={progressionText.actions.delete}
          className="icon-btn"
          disabled={view.isBusy}
          onClick={() => options.onDelete(blockId)}
          onMouseDown={stopEditorEvent}
          title={progressionText.actions.delete}
          type="button"
        >
          x
        </button>
      </div>

      {!view.isCollapsed ? (
        <>
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
