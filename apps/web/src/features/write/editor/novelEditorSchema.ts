import { Extension, mergeAttributes, Node } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
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

const StoryChangeAnchor = Node.create({
  name: storyChangeAnchorNodeName,
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return {
      blockId: dataAttribute("blockId", "block-id"),
      createdAt: dataAttribute("createdAt", "created-at"),
      progressionId: dataAttribute("progressionId", "progression-id"),
      updatedAt: dataAttribute("updatedAt", "updated-at"),
    };
  },
  parseHTML() {
    return [{ tag: "span[data-story-change-anchor='true']" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-story-change-anchor": "true",
        "contenteditable": "false",
        "role": "button",
        "tabindex": "0",
        "class": "story-change-anchor",
      }),
      storyChangeAnchorLabel(),
    ];
  },
});

export function novelEditorExtensions() {
  return [
    StarterKit.configure({
      codeBlock: false,
      dropcursor: false,
      listKeymap: false,
    }),
    SceneBlockAttributes,
    StoryChangeAnchor,
  ];
}
