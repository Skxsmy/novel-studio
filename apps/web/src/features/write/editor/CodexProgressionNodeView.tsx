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
  ProgressionPreview,
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
  preview: ProgressionPreview;
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
const minBoxHeight = 230;
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

function draftFromView(view: ProgressionNodeViewModel | null): ProgressionDraft {
  return view?.draft ?? {
    body: "",
    entryId: "",
    fieldSelection: "description",
    operation: "add",
    summary: "",
  };
}

function applyDraftPreview(before: string, draft: ProgressionDraft) {
  const body = draft.body.trim();
  if (draft.operation === "replace") return draft.body;
  if (!body) return before;
  return before ? `${draft.body}\n\n${before}` : draft.body;
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
  const entrySelectRef = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    setDraft(draftFromView(view));
  }, [view?.draftKey]);

  useEffect(() => {
    setSize(readStoredSize(blockId));
  }, [blockId]);

  useEffect(() => {
    storeSize(blockId, size);
  }, [blockId, size]);

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

    const handleMove = (moveEvent: PointerEvent) => {
      const nextSize: BoxSize = {};
      if (start.edge === "right" || start.edge === "corner") {
        nextSize.width = Math.max(minBoxWidth, Math.round(start.width + moveEvent.clientX - start.pointerX));
      } else if (size.width !== undefined) {
        nextSize.width = size.width;
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

  const previewAfter = applyDraftPreview(view.preview.before, draft);
  const collapsedText = draft.summary.trim() || draft.body.trim() || view.fieldLabel;

  const sizeStyle: CSSProperties = {
    height: size.height ? `${size.height}px` : undefined,
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
        <div className="codex-progression-target">
          <span>{progressionText.targetPrefix}</span>
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
        </div>
        <select
          aria-label={progressionText.aria.selectedEntry}
          className="codex-progression-entry-select"
          disabled={view.isBusy}
          onChange={(event) => patchDraft({ entryId: event.target.value, fieldSelection: "description" })}
          onMouseDown={stopEditorEvent}
          ref={entrySelectRef}
          value={draft.entryId}
        >
          {view.entryOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <button
          className="btn compact"
          disabled={view.isBusy}
          onClick={() => entrySelectRef.current?.focus()}
          onMouseDown={stopEditorEvent}
          type="button"
        >
          {progressionText.actions.selectEntry}
        </button>
        <button
          className="icon-btn"
          disabled={view.isBusy}
          onClick={() => options.onToggleCollapse(blockId)}
          onMouseDown={stopEditorEvent}
          title={view.isCollapsed ? progressionText.actions.expand : progressionText.actions.collapse}
          type="button"
        >
          {view.isCollapsed ? "+" : "-"}
        </button>
      </div>

      {view.isCollapsed ? (
        <p className="codex-progression-collapsed">{collapsedText}</p>
      ) : (
        <>
          <div className="codex-progression-meta">
            <label>
              <span>{progressionText.labels.change}</span>
              <select
                aria-label={progressionText.aria.selectedOperation}
                className="input"
                disabled={view.isBusy}
                onChange={(event) => patchDraft({ operation: event.target.value as ProgressionDraft["operation"] })}
                onMouseDown={stopEditorEvent}
                value={draft.operation}
              >
                {view.operationOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>{progressionText.labels.summary}</span>
              <input
                aria-label={progressionText.aria.selectedSummary}
                className="input"
                disabled={view.isBusy}
                onChange={(event) => patchDraft({ summary: event.target.value })}
                onMouseDown={stopEditorEvent}
                placeholder={progressionText.placeholders.summary}
                value={draft.summary}
              />
            </label>
          </div>
          <label className="codex-progression-writing-area">
            <span>{progressionText.labels.text}</span>
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
          <div className="progression-preview-grid" aria-label={progressionText.aria.selectedPreview}>
            <div>
              <span className="mini-label">{progressionText.labels.before}</span>
              <p>{view.preview.status === "failed" ? progressionText.previewUnavailable : view.preview.before || progressionText.empty}</p>
            </div>
            <div>
              <span className="mini-label">{progressionText.labels.after}</span>
              <p>{view.preview.status === "loading" ? progressionText.loading : previewAfter || progressionText.empty}</p>
            </div>
          </div>
          {view.preview.hiddenFutureCount ? (
            <p className="mini-note">{progressionText.laterChangesHidden(view.preview.hiddenFutureCount)}</p>
          ) : null}
          <div className="codex-progression-actions">
            <button
              className="btn compact"
              disabled={view.isBusy}
              onClick={() => options.onDelete(blockId)}
              onMouseDown={stopEditorEvent}
              type="button"
            >
              {uiText.actions.delete}
            </button>
          </div>
        </>
      )}
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
