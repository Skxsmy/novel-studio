import { Extension, mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
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

export function novelEditorExtensions(progressionOptions?: ProgressionNodeViewOptions) {
  return [
    StarterKit.configure({
      codeBlock: false,
      dropcursor: false,
      listKeymap: false,
    }),
    SceneBlockAttributes,
    StoryChangeAnchor.configure(progressionOptions ?? emptyProgressionNodeViewOptions),
  ];
}
