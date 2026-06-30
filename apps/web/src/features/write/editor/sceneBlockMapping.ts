import type {
  CodexProgressionSceneBlock,
  SceneBlock,
  SceneBlockDocument,
} from "@novel-studio/contracts";
import { createParagraphBlock } from "../../../app/sceneBlocks";
import { storyChangeAnchorNodeName } from "./storyChangeAnchors";

export type NovelEditorNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: NovelEditorNode[];
  marks?: Array<Record<string, unknown>>;
  text?: string;
};

export type NovelEditorDocument = {
  type: "doc";
  content: NovelEditorNode[];
};

type CreateBlockId = () => string;

function textNodesFromText(text: string): NovelEditorNode[] {
  if (!text) return [];
  const nodes: NovelEditorNode[] = [];
  const parts = text.split("\n");
  parts.forEach((part, index) => {
    if (index > 0) nodes.push({ type: "hardBreak" });
    if (part) nodes.push({ type: "text", text: part });
  });
  return nodes;
}

function textFromNodes(nodes: NovelEditorNode[] | undefined): string {
  if (!nodes?.length) return "";
  return nodes.map((node) => {
    if (node.type === "text") return node.text ?? "";
    if (node.type === "hardBreak") return "\n";
    return textFromNodes(node.content);
  }).join("");
}

function blockIdFromNode(node: NovelEditorNode, createBlockId: CreateBlockId, seenBlockIds: Set<string>) {
  const blockId = node.attrs?.blockId;
  const candidate = typeof blockId === "string" && blockId ? blockId : createBlockId();
  if (!seenBlockIds.has(candidate)) {
    seenBlockIds.add(candidate);
    return candidate;
  }
  let next = createBlockId();
  while (seenBlockIds.has(next)) next = createBlockId();
  seenBlockIds.add(next);
  return next;
}

function progressionDatesFromNode(node: NovelEditorNode) {
  const now = new Date().toISOString();
  return {
    createdAt: typeof node.attrs?.createdAt === "string" ? node.attrs.createdAt : now,
    updatedAt: typeof node.attrs?.updatedAt === "string" ? node.attrs.updatedAt : now,
  };
}

function paragraphNodeFromBlock(block: Extract<SceneBlock, { kind: "paragraph" }>): NovelEditorNode {
  return {
    type: "paragraph",
    attrs: { blockId: block.id },
    content: textNodesFromText(block.text),
  };
}

export function sceneBlockDocumentToNovelEditorDocument(document: SceneBlockDocument): NovelEditorDocument {
  const blocks = document.blocks.length ? document.blocks : [createParagraphBlock()];
  const content = blocks.map((block): NovelEditorNode => {
    if (block.kind === "heading") {
      return {
        type: "heading",
        attrs: { blockId: block.id, level: block.level },
        content: textNodesFromText(block.text),
      };
    }
    if (block.kind === "quote") {
      return {
        type: "blockquote",
        attrs: { blockId: block.id },
        content: [{
          type: "paragraph",
          attrs: { blockId: block.id },
          content: textNodesFromText(block.text),
        }],
      };
    }
    if (block.kind === "sceneBreak") {
      return {
        type: "horizontalRule",
        attrs: { blockId: block.id },
      };
    }
    if (block.kind === "codexProgression") {
      return {
        type: storyChangeAnchorNodeName,
        attrs: {
          blockId: block.id,
          createdAt: block.createdAt,
          progressionId: block.progressionId,
          updatedAt: block.updatedAt,
        },
      };
    }
    return paragraphNodeFromBlock(block);
  });
  return { type: "doc", content };
}

export function novelEditorDocumentToSceneBlockDocument(
  document: NovelEditorDocument,
  createBlockId: CreateBlockId,
): SceneBlockDocument {
  const blocks: SceneBlock[] = [];
  const seenBlockIds = new Set<string>();

  for (const node of document.content ?? []) {
    if (node.type === "heading") {
      blocks.push({
        id: blockIdFromNode(node, createBlockId, seenBlockIds),
        kind: "heading",
        level: typeof node.attrs?.level === "number" ? node.attrs.level : 2,
        text: textFromNodes(node.content),
      });
      continue;
    }

    if (node.type === "blockquote") {
      blocks.push({
        id: blockIdFromNode(node, createBlockId, seenBlockIds),
        kind: "quote",
        text: textFromNodes(node.content),
      });
      continue;
    }

    if (node.type === "horizontalRule") {
      blocks.push({
        id: blockIdFromNode(node, createBlockId, seenBlockIds),
        kind: "sceneBreak",
      });
      continue;
    }

    if (node.type === storyChangeAnchorNodeName || node.type === "storyChangeAnchor") {
      const progressionId = node.attrs?.progressionId;
      if (typeof progressionId !== "string" || !progressionId) continue;
      const dates = progressionDatesFromNode(node);
      blocks.push({
        id: blockIdFromNode(node, createBlockId, seenBlockIds),
        kind: "codexProgression",
        progressionId,
        createdAt: dates.createdAt,
        updatedAt: dates.updatedAt,
      } satisfies CodexProgressionSceneBlock);
      continue;
    }

    if (node.type === "paragraph") {
      const text = textFromNodes(node.content);
      const previousBlock = blocks.at(-1);
      if (
        text === "" &&
        node === document.content.at(-1) &&
        (previousBlock?.kind === "sceneBreak" || previousBlock?.kind === "codexProgression")
      ) {
        continue;
      }
      blocks.push({
        id: blockIdFromNode(node, createBlockId, seenBlockIds),
        kind: "paragraph",
        text,
      });
    }
  }

  return {
    schemaVersion: 1,
    blocks: blocks.length ? blocks : [createParagraphBlock("", createBlockId())],
  };
}
