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
  showTooltip,
  tooltips,
  type Tooltip,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import type { CodexEntryDocument } from "@novel-studio/contracts";
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

const externalDocumentUpdate = Annotation.define<boolean>();
const setCodexPreview = StateEffect.define<CodexPreviewState | null>();

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

function codexTooltip(preview: CodexPreviewState, emptyText: string): Tooltip {
  return {
    above: false,
    end: preview.to,
    pos: preview.from,
    strictSide: false,
    create() {
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
      dom.style.position = "relative";
      dom.style.zIndex = "1000";

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

      return {
        dom,
        offset: { x: 0, y: 8 },
        resize: true,
      };
    },
  };
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
  provide(field) {
    return showTooltip.compute([field], (state) => {
      const preview = state.field(field);
      return preview ? codexTooltip(preview, emptyText) : null;
    });
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
  previewField: StateField<CodexPreviewState | null>;
}

class CodexMentionPlugin {
  decorations: DecorationSet;
  private entries: CodexEntryDocument[];
  private entriesById: Map<string, CodexEntryDocument>;
  private previewField: StateField<CodexPreviewState | null>;

  constructor(view: EditorView, config: CodexMentionPluginConfig) {
    this.entries = config.entries;
    this.previewField = config.previewField;
    this.entriesById = new Map(config.entries.map((entry) => [entry.metadata.id, entry]));
    this.decorations = buildCodexDecorations(view, config.entries);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = buildCodexDecorations(update.view, this.entries);
    }
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
}

const codexMentionPlugin = ViewPlugin.define<CodexMentionPlugin, CodexMentionPluginConfig>(
  (view, config) => new CodexMentionPlugin(view, config),
  {
    decorations: (plugin) => plugin.decorations,
    eventHandlers: {
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
    codexMentionPlugin.of({ entries, previewField }),
    tooltips({ position: "absolute" }),
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
  emptyPreviewText = "No description",
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

