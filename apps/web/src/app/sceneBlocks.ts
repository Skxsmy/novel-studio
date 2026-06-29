import type {
  SceneBlock,
  SceneBlockDocument,
  CodexProgressionSceneBlock,
  SceneHeadingBlock,
  SceneParagraphBlock,
  SceneQuoteBlock,
} from "@novel-studio/contracts";

function randomBlockId() {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (randomUUID) return randomUUID.call(globalThis.crypto);
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (marker) => {
    const value = Math.floor(Math.random() * 16);
    const nibble = marker === "x" ? value : (value & 0x3) | 0x8;
    return nibble.toString(16);
  });
}

export function createParagraphBlock(text = "", id = randomBlockId()): SceneParagraphBlock {
  return {
    id,
    kind: "paragraph",
    text,
  };
}

export function createHeadingBlock(text = ""): SceneHeadingBlock {
  return {
    id: randomBlockId(),
    kind: "heading",
    level: 2,
    text,
  };
}

export function createQuoteBlock(text = ""): SceneQuoteBlock {
  return {
    id: randomBlockId(),
    kind: "quote",
    text,
  };
}

export function createSceneBreakBlock(): SceneBlock {
  return {
    id: randomBlockId(),
    kind: "sceneBreak",
  };
}

export function createCodexProgressionBlock(
  progressionId: string,
  id = randomBlockId(),
): CodexProgressionSceneBlock {
  const now = new Date().toISOString();
  return {
    id,
    kind: "codexProgression",
    progressionId,
    createdAt: now,
    updatedAt: now,
  };
}

export function createBlock(kind: SceneBlock["kind"]): SceneBlock {
  if (kind === "heading") return createHeadingBlock();
  if (kind === "quote") return createQuoteBlock();
  if (kind === "sceneBreak") return createSceneBreakBlock();
  if (kind === "codexProgression") return createParagraphBlock();
  return createParagraphBlock();
}

export function ensureEditableSceneBlockDocument(document: SceneBlockDocument): SceneBlockDocument {
  if (document.blocks.length > 0) return document;
  return { schemaVersion: 1, blocks: [createParagraphBlock()] };
}

export function sceneBlockToMarkdown(block: SceneBlock): string {
  if (block.kind === "paragraph") return block.text;
  if (block.kind === "heading") return `${"#".repeat(block.level)} ${block.text}`;
  if (block.kind === "quote") {
    return block.text
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
  }
  if (block.kind === "sceneBreak") return "***";
  return "";
}

export function sceneBlockDocumentToMarkdown(document: SceneBlockDocument): string {
  return document.blocks
    .map((block) => sceneBlockToMarkdown(block))
    .filter((segment) => segment.trim().length > 0)
    .join("\n\n");
}

export function sceneBlockToPlainText(block: SceneBlock): string {
  if (block.kind === "paragraph" || block.kind === "heading" || block.kind === "quote") return block.text;
  return "";
}

export function sceneBlockDocumentToPlainText(document: SceneBlockDocument): string {
  return document.blocks
    .map((block) => sceneBlockToPlainText(block))
    .filter((segment) => segment.trim().length > 0)
    .join("\n\n");
}

export function sceneBlockDocumentStats(document: SceneBlockDocument) {
  const plainText = sceneBlockDocumentToPlainText(document);
  const characterCount = Array.from(plainText.replace(/\s/g, "")).length;
  const paragraphCount = plainText.trim() ? plainText.trim().split(/\n\s*\n/u).length : 0;
  return {
    characterCount,
    content: sceneBlockDocumentToMarkdown(document),
    paragraphCount,
    plainText,
  };
}
