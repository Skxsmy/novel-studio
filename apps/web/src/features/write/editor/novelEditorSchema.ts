import { Extension, mergeAttributes, Node } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { CodexEntryDocument } from "@novel-studio/contracts";
import { findInlineCodexMentions } from "../../codex/inlineMentions";
import {
  CodexProgressionNodeView,
  emptyProgressionNodeViewOptions,
  type ProgressionNodeViewOptions,
} from "./CodexProgressionNodeView";
import { storyChangeAnchorLabel, storyChangeAnchorNodeName } from "./storyChangeAnchors";

function dataAttribute(name: string, dataName: string) {
  return {
    default: null,
    parseHTML: (element: HTMLElement) => element.getAttribute(`data-${dataName}`),
    renderHTML: (attributes: Record<string, unknown>) => {
      const value = attributes[name];
      return typeof value === "string" && value ? { [`data-${dataName}`]: value } : {};
    },
  };
}

const SceneBlockAttributes = Extension.create({
  name: "sceneBlockAttributes",
  addGlobalAttributes() {
    return [{
      types: ["paragraph", "heading", "blockquote", "horizontalRule"],
      attributes: {
        blockId: {
          default: null,
          parseHTML: (element) => element.getAttribute("data-block-id"),
          renderHTML: (attributes) => {
            const blockId = attributes.blockId;
            return typeof blockId === "string" && blockId ? { "data-block-id": blockId } : {};
          },
        },
      },
    }];
  },
});

export interface CodexMentionDecorationOptions {
  getEntries: () => CodexEntryDocument[];
}

function buildCodexMentionDecorations(doc: ProseMirrorNode, entries: CodexEntryDocument[]) {
  if (!entries.length) return DecorationSet.empty;
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return true;
    for (const mention of findInlineCodexMentions(node.text, entries)) {
      const from = pos + mention.start;
      const to = pos + mention.end;
      const key = `${mention.entryId}:${from}:${to}`;
      decorations.push(Decoration.inline(from, to, {
        "aria-label": mention.matchedText,
        "class": "codex-mention-mark pm-codex-mention",
        "data-codex-entry-id": mention.entryId,
        "data-codex-from": String(from),
        "data-codex-key": key,
        "data-codex-to": String(to),
        "role": "button",
        "tabindex": "0",
      }));
    }
    return true;
  });

  return DecorationSet.create(doc, decorations);
}

const CodexMentionDecorations = Extension.create<CodexMentionDecorationOptions>({
  name: "codexMentionDecorations",
  addOptions() {
    return { getEntries: () => [] };
  },
  addProseMirrorPlugins() {
    const getEntries = this.options.getEntries;
    return [
      new Plugin({
        props: {
          decorations(state) {
            return buildCodexMentionDecorations(state.doc, getEntries());
          },
        },
      }),
    ];
  },
});

const StoryChangeAnchor = Node.create<ProgressionNodeViewOptions>({
  name: storyChangeAnchorNodeName,
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  addOptions() {
    return emptyProgressionNodeViewOptions;
  },
  addAttributes() {
    return {
      blockId: dataAttribute("blockId", "block-id"),
      createdAt: dataAttribute("createdAt", "created-at"),
      progressionId: dataAttribute("progressionId", "progression-id"),
      updatedAt: dataAttribute("updatedAt", "updated-at"),
    };
  },
  parseHTML() {
    return [
      { tag: "section[data-codex-progression-block='true']" },
      { tag: "div[data-codex-progression-block='true']" },
      { tag: "span[data-story-change-anchor='true']" },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-codex-progression-block": "true",
        "contenteditable": "false",
        "class": "codex-progression-node",
      }),
      storyChangeAnchorLabel(),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodexProgressionNodeView);
  },
});

export function novelEditorExtensions(
  progressionOptions?: ProgressionNodeViewOptions,
  codexMentionOptions?: CodexMentionDecorationOptions,
) {
  return [
    StarterKit.configure({
      codeBlock: false,
      dropcursor: false,
      listKeymap: false,
    }),
    SceneBlockAttributes,
    CodexMentionDecorations.configure(codexMentionOptions ?? { getEntries: () => [] }),
    StoryChangeAnchor.configure(progressionOptions ?? emptyProgressionNodeViewOptions),
  ];
}
