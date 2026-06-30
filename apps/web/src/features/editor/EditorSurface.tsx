import { useEffect, useRef } from "react";
import { defaultKeymap, history, historyKeymap, redo, undo } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import {
  Annotation,
  Compartment,
  EditorSelection,
  EditorState,
  RangeSetBuilder,
  StateEffect,
  StateField,
  type Extension,
  type StateCommand,
} from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  highlightSpecialChars,
  keymap,
  placeholder as editorPlaceholder,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import type { CodexEntryDocument } from "@novel-studio/contracts";
import { uiText } from "../../app/uiText";
import { findInlineCodexMentions } from "../codex/inlineMentions";

export interface EditorSurfaceStatus {
  characterCount: number;
  column: number;
  hasSelection: boolean;
  line: number;
  lineCount: number;
  selectedText: string;
  selectionFrom: number;
  selectionTo: number;
  value: string;
  wordCount: number;
}

export interface EditorSurfaceProps {
  ariaLabel: string;
  className?: string;
  codexEntries?: CodexEntryDocument[];
  emptyPreviewText?: string;
  onChange: (value: string) => void;
  onStateChange?: (status: EditorSurfaceStatus) => void;
  placeholder?: string;
  readOnly?: boolean;
  value: string;
}

interface CodexPreviewState {
  entry: CodexEntryDocument;
  from: number;
  key: string;
  to: number;
}

interface RectBounds {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

interface SizeBounds {
  height: number;
  width: number;
}

interface PreviewPositionInput {
  anchor: RectBounds | null;
  anchorVertical: "above" | "below" | "visible";
  editorBounds: RectBounds;
  fallbackLeft: number;
  margin?: number;
  previewSize: SizeBounds;
  viewportBounds: RectBounds;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function rectBounds(rect: RectBounds): RectBounds {
  return {
    bottom: rect.bottom,
    left: rect.left,
    right: rect.right,
    top: rect.top,
  };
}

function intersectBounds(left: RectBounds, right: RectBounds): RectBounds {
  return {
    bottom: Math.min(left.bottom, right.bottom),
    left: Math.max(left.left, right.left),
    right: Math.min(left.right, right.right),
    top: Math.max(left.top, right.top),
  };
}

function boundsHeight(bounds: RectBounds) {
  return Math.max(0, bounds.bottom - bounds.top);
}

function boundsWidth(bounds: RectBounds) {
  return Math.max(0, bounds.right - bounds.left);
}

export function computeCodexPreviewPosition(input: PreviewPositionInput) {
  const margin = input.margin ?? 12;
  const visibleBounds = intersectBounds(input.editorBounds, input.viewportBounds);
  const visibleLeft = visibleBounds.left + margin;
  const visibleRight = visibleBounds.right - margin;
  const visibleTop = visibleBounds.top + margin;
  const visibleBottom = visibleBounds.bottom - margin;
  const maxLeft = Math.max(visibleLeft, visibleRight - input.previewSize.width);
  const maxTop = Math.max(visibleTop, visibleBottom - input.previewSize.height);
  const preferredLeft = input.anchor?.left ?? input.fallbackLeft;
  const left = clamp(preferredLeft, visibleLeft, maxLeft);

  if (!input.anchor) {
    const top = input.anchorVertical === "below" ? maxTop : visibleTop;
    return {
      availableHeight: Math.max(0, visibleBottom - visibleTop),
      left,
      top,
    };
  }

  const belowTop = input.anchor.bottom + 8;
  const aboveTop = input.anchor.top - input.previewSize.height - 8;
  const preferredTop =
    belowTop + input.previewSize.height <= visibleBottom || aboveTop < visibleTop
      ? belowTop
      : aboveTop;

  return {
    availableHeight: Math.max(0, visibleBottom - visibleTop),
    left,
    top: clamp(preferredTop, visibleTop, maxTop),
  };
}

const externalDocumentUpdate = Annotation.define<boolean>();
const setCodexPreview = StateEffect.define<CodexPreviewState | null>();
const tooltipLayerId = "novel-editor-tooltip-layer";
const tooltipLayerZIndex = "2147483000";

export function cleanEditorPasteText(text: string) {
  return text.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ");
}

function countEditorWords(text: string) {
  const cjkCount = text.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const latinWordCount = text
    .replace(/[\u3400-\u9fff]/g, " ")
    .match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g)?.length ?? 0;
  return cjkCount + latinWordCount;
}

function editorStatusForView(view: EditorView): EditorSurfaceStatus {
  const { state } = view;
  const value = state.doc.toString();
  const selection = state.selection.main;
  const line = state.doc.lineAt(selection.head);
  return {
    characterCount: value.length,
    column: selection.head - line.from + 1,
    hasSelection: !selection.empty,
    line: line.number,
    lineCount: state.doc.lines,
    selectedText: selection.empty ? "" : state.sliceDoc(selection.from, selection.to),
    selectionFrom: selection.from,
    selectionTo: selection.to,
    value,
    wordCount: countEditorWords(value),
  };
}

function readOnlyExtension(readOnly: boolean): Extension {
  return [
    EditorState.readOnly.of(readOnly),
    EditorView.editable.of(!readOnly),
    EditorView.contentAttributes.of({
      "aria-readonly": readOnly ? "true" : "false",
    }),
  ];
}

const insertSoftIndent: StateCommand = ({ state, dispatch }) => {
  const changes = state.changeByRange((range) => ({
    changes: { from: range.from, to: range.to, insert: "  " },
    range: EditorSelection.cursor(range.from + 2),
  }));
  dispatch?.(state.update(changes, { scrollIntoView: true, userEvent: "input.indent" }));
  return true;
};

const removeSoftIndent: StateCommand = ({ state, dispatch }) => {
  const changes = state.changeByRange((range) => {
    const line = state.doc.lineAt(range.from);
    const beforeCursor = state.doc.sliceString(line.from, range.from);
    const removable = beforeCursor.endsWith("  ") ? 2 : beforeCursor.endsWith(" ") ? 1 : 0;
    return removable
      ? {
          changes: { from: range.from - removable, to: range.from, insert: "" },
          range: EditorSelection.cursor(range.from - removable),
        }
      : { range };
  });
  dispatch?.(state.update(changes, { scrollIntoView: true, userEvent: "delete.indent" }));
  return true;
};

const editorSurfaceTheme = EditorView.theme({
  "&": {
    backgroundColor: "transparent",
    color: "inherit",
    height: "100%",
    maxWidth: "100%",
    width: "100%",
  },
  ".cm-scroller": {
    fontFamily: "inherit",
    lineHeight: "inherit",
    maxWidth: "100%",
    overflowX: "hidden",
  },
  ".cm-content": {
    boxSizing: "border-box",
    caretColor: "var(--ink)",
    fontFamily: "inherit",
    lineHeight: "inherit",
    maxWidth: "100%",
    minWidth: "0",
    overflowWrap: "anywhere",
    whiteSpace: "pre-wrap",
    width: "100%",
    wordBreak: "break-word",
  },
  ".cm-line": {
    overflowWrap: "anywhere",
    padding: "0",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
});

function createCodexPreviewDom(preview: CodexPreviewState, emptyText: string) {
  const dom = document.createElement("aside");
  dom.className = "codex-preview-popover cm-codex-preview-popover";
  dom.setAttribute("aria-label", `${preview.entry.metadata.name} canon description`);
  dom.dataset.codexPreview = "true";
  dom.style.backgroundColor = "#fffaf0";
  dom.style.border = "1px solid #8f8170";
  dom.style.boxShadow = "0 18px 44px rgba(31, 37, 35, 0.32)";
  dom.style.color = "#1f2723";
  dom.style.isolation = "isolate";
  dom.style.opacity = "1";
  dom.style.overflowX = "hidden";
  dom.style.overflowY = "auto";
  dom.style.pointerEvents = "auto";
  dom.style.position = "absolute";
  dom.style.zIndex = tooltipLayerZIndex;

  const head = document.createElement("div");
  head.className = "codex-preview-head";
  const titleBlock = document.createElement("div");
  const kicker = document.createElement("div");
  kicker.className = "row-meta";
  kicker.textContent = "Codex";
  const title = document.createElement("strong");
  title.textContent = preview.entry.metadata.name;
  titleBlock.append(kicker, title);
  head.append(titleBlock);

  const body = document.createElement("p");
  body.textContent = preview.entry.description || emptyText;
  dom.append(head, body);

  return dom;
}

function editorTooltipLayer(ownerDocument: Document) {
  let layer = ownerDocument.getElementById(tooltipLayerId);
  if (!layer) {
    layer = ownerDocument.createElement("div");
    layer.id = tooltipLayerId;
    layer.className = "editor-tooltip-layer";
    layer.dataset.editorTooltipLayer = "true";
    layer.style.position = "absolute";
    layer.style.top = "0";
    layer.style.left = "0";
    layer.style.width = "100%";
    layer.style.height = "0";
    layer.style.overflow = "visible";
    layer.style.pointerEvents = "none";
    layer.style.zIndex = tooltipLayerZIndex;
    ownerDocument.body.appendChild(layer);
  }
  return layer;
}

function editorWindow(view: EditorView) {
  return view.dom.ownerDocument.defaultView ?? window;
}

const codexPreviewField = (emptyText: string) => StateField.define<CodexPreviewState | null>({
  create() {
    return null;
  },
  update(value, transaction) {
    if (transaction.docChanged) value = null;
    for (const effect of transaction.effects) {
      if (effect.is(setCodexPreview)) value = effect.value;
    }
    return value;
  },
});

function closestMentionElement(target: EventTarget | null): HTMLElement | null {
  return target instanceof HTMLElement ? target.closest<HTMLElement>(".cm-codex-mention") : null;
}

function buildCodexDecorations(view: EditorView, entries: CodexEntryDocument[]) {
  const content = view.state.doc.toString();
  const mentions = findInlineCodexMentions(content, entries);
  const builder = new RangeSetBuilder<Decoration>();

  for (const mention of mentions) {
    const entry = entries.find((candidate) => candidate.metadata.id === mention.entryId);
    if (!entry) continue;
    const key = `${mention.entryId}:${mention.start}:${mention.end}`;
    builder.add(
      mention.start,
      mention.end,
      Decoration.mark({
        attributes: {
          "aria-label": mention.matchedText,
          "data-codex-entry-id": mention.entryId,
          "data-codex-from": String(mention.start),
          "data-codex-key": key,
          "data-codex-to": String(mention.end),
        },
        class: "codex-mention-mark cm-codex-mention",
      }),
    );
  }

  return builder.finish();
}

interface CodexMentionPluginConfig {
  entries: CodexEntryDocument[];
  emptyPreviewText: string;
  previewField: StateField<CodexPreviewState | null>;
}

class CodexMentionPlugin {
  decorations: DecorationSet;
  private entries: CodexEntryDocument[];
  private entriesById: Map<string, CodexEntryDocument>;
  private emptyPreviewText: string;
  private lastAnchorLeft: number | null = null;
  private layer: HTMLElement;
  private positionHandle = -1;
  private previewDom: HTMLElement | null = null;
  private previewField: StateField<CodexPreviewState | null>;
  private previewKey: string | null = null;
  private view: EditorView;
  private readonly reposition: () => void;

  constructor(view: EditorView, config: CodexMentionPluginConfig) {
    this.view = view;
    this.entries = config.entries;
    this.emptyPreviewText = config.emptyPreviewText;
    this.previewField = config.previewField;
    this.entriesById = new Map(config.entries.map((entry) => [entry.metadata.id, entry]));
    this.layer = editorTooltipLayer(view.dom.ownerDocument);
    this.reposition = () => this.queuePositionPreview();
    this.decorations = buildCodexDecorations(view, config.entries);
    view.dom.ownerDocument.addEventListener("scroll", this.reposition, true);
    editorWindow(view).addEventListener("resize", this.reposition);
    this.syncPreview();
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = buildCodexDecorations(update.view, this.entries);
    }
    if (update.docChanged || update.geometryChanged || update.viewportChanged || update.transactions.length) {
      this.syncPreview();
    }
  }

  destroy() {
    if (this.positionHandle >= 0) editorWindow(this.view).clearTimeout(this.positionHandle);
    this.removePreview();
    this.view.dom.ownerDocument.removeEventListener("scroll", this.reposition, true);
    editorWindow(this.view).removeEventListener("resize", this.reposition);
  }

  togglePreview(view: EditorView, markElement: HTMLElement) {
    const entryId = markElement.dataset.codexEntryId;
    const entry = entryId ? this.entriesById.get(entryId) : null;
    const from = Number(markElement.dataset.codexFrom);
    const to = Number(markElement.dataset.codexTo);
    const key = markElement.dataset.codexKey;
    if (!entry || !Number.isFinite(from) || !Number.isFinite(to) || !key) return true;

    const current = view.state.field(this.previewField);
    const next = current?.key === key ? null : { entry, from, key, to };
    view.dispatch({ effects: setCodexPreview.of(next) });
    return true;
  }

  closePreview(view: EditorView) {
    if (!view.state.field(this.previewField)) return false;
    view.dispatch({ effects: setCodexPreview.of(null) });
    return false;
  }

  private syncPreview() {
    const preview = this.view.state.field(this.previewField);
    if (!preview) {
      this.removePreview();
      return;
    }

    if (!this.previewDom || this.previewKey !== preview.key) {
      this.removePreview();
      this.previewDom = createCodexPreviewDom(preview, this.emptyPreviewText);
      this.previewKey = preview.key;
      this.layer.appendChild(this.previewDom);
    }
    this.queuePositionPreview();
  }

  private positionPreview() {
    const preview = this.view.state.field(this.previewField);
    const dom = this.previewDom;
    if (!preview || !dom) return;

    const coords = this.view.coordsAtPos(preview.from);
    const doc = this.view.dom.ownerDocument;
    const docElement = doc.documentElement;
    const win = doc.defaultView ?? window;
    const scrollX = win.scrollX;
    const scrollY = win.scrollY;
    const viewportBounds = {
      bottom: docElement.clientHeight,
      left: 0,
      right: docElement.clientWidth,
      top: 0,
    };
    const margin = 12;
    const editorBounds = this.visibleEditorBounds(viewportBounds);
    const visibleRanges = this.view.visibleRanges;
    const firstVisible = visibleRanges[0]?.from ?? 0;
    const lastVisible = visibleRanges[visibleRanges.length - 1]?.to ?? this.view.state.doc.length;
    const anchorVertical = coords
      ? "visible"
      : preview.to <= firstVisible
        ? "above"
        : preview.from >= lastVisible
          ? "below"
          : "visible";
    const rect = dom.getBoundingClientRect();
    const width = rect.width || Math.min(560, Math.max(280, docElement.clientWidth * 0.76));
    const height = rect.height || 140;
    const anchor = coords ? rectBounds(coords) : null;
    if (coords) this.lastAnchorLeft = coords.left;
    const fallbackLeft = this.lastAnchorLeft ?? editorBounds.left + margin;
    const position = computeCodexPreviewPosition({
      anchor,
      anchorVertical,
      editorBounds,
      fallbackLeft,
      margin,
      previewSize: { height, width },
      viewportBounds,
    });

    dom.style.left = `${Math.round(scrollX + position.left)}px`;
    dom.style.maxHeight = `${Math.round(position.availableHeight)}px`;
    dom.style.top = `${Math.round(scrollY + position.top)}px`;
  }

  private queuePositionPreview() {
    const win = editorWindow(this.view);
    if (this.positionHandle >= 0) win.clearTimeout(this.positionHandle);
    this.positionHandle = win.setTimeout(() => {
      this.positionHandle = -1;
      this.positionPreview();
    }, 0);
  }

  private removePreview() {
    this.previewDom?.remove();
    this.previewDom = null;
    this.previewKey = null;
  }

  private visibleEditorBounds(viewportBounds: RectBounds) {
    const win = editorWindow(this.view);
    let bounds = rectBounds(this.view.dom.getBoundingClientRect());
    for (let node = this.view.dom.parentElement; node; node = node.parentElement) {
      const style = win.getComputedStyle(node);
      const clips = /(auto|scroll|hidden|clip)/.test(
        `${style.overflow} ${style.overflowX} ${style.overflowY}`,
      );
      if (clips) bounds = intersectBounds(bounds, rectBounds(node.getBoundingClientRect()));
    }
    const viewportClipped = intersectBounds(bounds, viewportBounds);
    if (boundsHeight(viewportClipped) > 0 && boundsWidth(viewportClipped) > 0) return viewportClipped;
    return intersectBounds(rectBounds(this.view.dom.getBoundingClientRect()), viewportBounds);
  }
}

const codexMentionPlugin = ViewPlugin.define<CodexMentionPlugin, CodexMentionPluginConfig>(
  (view, config) => new CodexMentionPlugin(view, config),
  {
    decorations: (plugin) => plugin.decorations,
    eventHandlers: {
      pointerdown(event, view) {
        if (closestMentionElement(event.target)) return false;
        if (event.target instanceof HTMLElement && event.target.closest("[data-codex-preview='true']")) return false;
        return this.closePreview(view);
      },
      click(event, view) {
        const mark = closestMentionElement(event.target);
        if (!mark) return false;
        event.preventDefault();
        return this.togglePreview(view, mark);
      },
      keydown(event, view) {
        if (event.key === "Escape") {
          view.dispatch({ effects: setCodexPreview.of(null) });
          return false;
        }
        if (event.key !== "Enter" && event.key !== " ") return false;
        const mark = closestMentionElement(event.target);
        if (!mark) return false;
        event.preventDefault();
        return this.togglePreview(view, mark);
      },
    },
  },
);

function codexMentionExtension(entries: CodexEntryDocument[], emptyPreviewText: string): Extension {
  const previewField = codexPreviewField(emptyPreviewText);
  return [
    previewField,
    codexMentionPlugin.of({ emptyPreviewText, entries, previewField }),
  ];
}

function createEditorState(config: {
  ariaLabel: string;
  codexEntries: CodexEntryDocument[];
  codexCompartment: Compartment;
  emptyPreviewText: string;
  onChange: (value: string) => void;
  onStateChange?: (status: EditorSurfaceStatus) => void;
  placeholderCompartment: Compartment;
  placeholderText: string;
  readOnly: boolean;
  readOnlyCompartment: Compartment;
  value: string;
}) {
  return EditorState.create({
    doc: config.value,
    extensions: [
      history(),
      highlightSpecialChars(),
      editorSurfaceTheme,
      markdown(),
      EditorView.lineWrapping,
      EditorView.clipboardInputFilter.of(cleanEditorPasteText),
      EditorView.contentAttributes.of({
        "aria-label": config.ariaLabel,
        role: "textbox",
        spellcheck: "true",
      }),
      keymap.of([
        { key: "Tab", run: insertSoftIndent },
        { key: "Shift-Tab", run: removeSoftIndent },
        { key: "Mod-z", run: undo },
        { key: "Mod-y", run: redo },
        ...historyKeymap,
        ...defaultKeymap,
      ]),
      EditorView.updateListener.of((update) => {
        const isExternalUpdate = update.transactions.some((transaction) => transaction.annotation(externalDocumentUpdate));
        if (update.docChanged && !isExternalUpdate) {
          config.onChange(update.state.doc.toString());
        }
        if (update.docChanged || update.selectionSet || update.focusChanged) {
          config.onStateChange?.(editorStatusForView(update.view));
        }
      }),
      config.readOnlyCompartment.of(readOnlyExtension(config.readOnly)),
      config.placeholderCompartment.of(config.placeholderText ? editorPlaceholder(config.placeholderText) : []),
      config.codexCompartment.of(codexMentionExtension(config.codexEntries, config.emptyPreviewText)),
    ],
  });
}

export function EditorSurface({
  ariaLabel,
  className = "",
  codexEntries = [],
  emptyPreviewText = uiText.writeEditor.empty.noDescription,
  onChange,
  onStateChange,
  placeholder = "",
  readOnly = false,
  value,
}: EditorSurfaceProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onStateChangeRef = useRef(onStateChange);
  const readOnlyCompartmentRef = useRef(new Compartment());
  const placeholderCompartmentRef = useRef(new Compartment());
  const codexCompartmentRef = useRef(new Compartment());

  onChangeRef.current = onChange;
  onStateChangeRef.current = onStateChange;

  useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      parent: hostRef.current,
      state: createEditorState({
        ariaLabel,
        codexCompartment: codexCompartmentRef.current,
        codexEntries,
        emptyPreviewText,
        onChange: (nextValue) => onChangeRef.current(nextValue),
        onStateChange: (status) => onStateChangeRef.current?.(status),
        placeholderCompartment: placeholderCompartmentRef.current,
        placeholderText: placeholder,
        readOnly,
        readOnlyCompartment: readOnlyCompartmentRef.current,
        value,
      }),
    });
    viewRef.current = view;
    onStateChangeRef.current?.(editorStatusForView(view));
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentValue = view.state.doc.toString();
    if (currentValue === value) return;
    const nextHead = Math.min(value.length, view.state.selection.main.head);
    view.dispatch({
      annotations: externalDocumentUpdate.of(true),
      changes: { from: 0, to: currentValue.length, insert: value },
      effects: setCodexPreview.of(null),
      selection: { anchor: nextHead },
    });
  }, [value]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: readOnlyCompartmentRef.current.reconfigure(readOnlyExtension(readOnly)),
    });
  }, [readOnly]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: placeholderCompartmentRef.current.reconfigure(placeholder ? editorPlaceholder(placeholder) : []),
    });
  }, [placeholder]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: codexCompartmentRef.current.reconfigure(codexMentionExtension(codexEntries, emptyPreviewText)),
    });
  }, [codexEntries, emptyPreviewText]);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      const host = hostRef.current;
      const view = viewRef.current;
      if (!host || !view) return;
      const target = event.target as Node | null;
      if (target && host.contains(target)) return;
      if (target instanceof HTMLElement && target.closest("[data-codex-preview='true']")) return;
      view.dispatch({ effects: setCodexPreview.of(null) });
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);

  return (
    <div
      className={`novel-editor${readOnly ? " is-read-only" : ""}${className ? ` ${className}` : ""}`}
      data-editor-surface="true"
      ref={hostRef}
    />
  );
}

