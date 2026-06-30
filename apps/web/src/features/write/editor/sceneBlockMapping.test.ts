import { describe, expect, it } from "vitest";
import type { SceneBlockDocument } from "@novel-studio/contracts";
import {
  novelEditorDocumentToSceneBlockDocument,
  sceneBlockDocumentToNovelEditorDocument,
  type NovelEditorDocument,
} from "./sceneBlockMapping";

const firstBlockId = "11111111-1111-4111-8111-111111111111";
const secondBlockId = "22222222-2222-4222-8222-222222222222";
const thirdBlockId = "33333333-3333-4333-8333-333333333333";
const fourthBlockId = "44444444-4444-4444-8444-444444444444";
const fifthBlockId = "55555555-5555-4555-8555-555555555555";
const progressionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function nextId() {
  return "99999999-9999-4999-8999-999999999999";
}

describe("sceneBlockMapping", () => {
  it("round-trips v1 scene blocks through Tiptap JSON", () => {
    const document: SceneBlockDocument = {
      schemaVersion: 1,
      blocks: [
        { id: firstBlockId, kind: "paragraph", text: "Opening line\nSecond line" },
        { id: secondBlockId, kind: "heading", level: 2, text: "A Hard Turn" },
        { id: thirdBlockId, kind: "quote", text: "Quoted memory" },
        { id: fourthBlockId, kind: "sceneBreak" },
        {
          createdAt: "2026-06-24T00:00:00.000Z",
          id: fifthBlockId,
          kind: "codexProgression",
          progressionId,
          updatedAt: "2026-06-24T00:00:00.000Z",
        },
      ],
    };

    const editorDocument = sceneBlockDocumentToNovelEditorDocument(document);
    expect(editorDocument.content.map((node) => node.type)).toEqual([
      "paragraph",
      "heading",
      "blockquote",
      "horizontalRule",
      "codexProgressionBlock",
    ]);
    expect(editorDocument.content[0]?.content?.map((node) => node.type)).toEqual([
      "text",
      "hardBreak",
      "text",
    ]);

    expect(novelEditorDocumentToSceneBlockDocument(editorDocument, nextId)).toEqual(document);
  });

  it("strips editor runtime marks instead of saving UI-only markup", () => {
    const editorDocument: NovelEditorDocument = {
      type: "doc",
      content: [{
        attrs: { blockId: firstBlockId },
        content: [{
          marks: [{ type: "bold" }],
          text: "Marked text",
          type: "text",
        }],
        type: "paragraph",
      }],
    };

    const sceneDocument = novelEditorDocumentToSceneBlockDocument(editorDocument, nextId);
    expect(sceneDocument).toEqual({
      schemaVersion: 1,
      blocks: [{ id: firstBlockId, kind: "paragraph", text: "Marked text" }],
    });
    expect(JSON.stringify(sceneDocument)).not.toContain("bold");
  });

  it("creates an editable empty paragraph when the editor document has no supported blocks", () => {
    expect(novelEditorDocumentToSceneBlockDocument({ type: "doc", content: [] }, nextId)).toEqual({
      schemaVersion: 1,
      blocks: [{ id: nextId(), kind: "paragraph", text: "" }],
    });
  });

  it("regenerates duplicate block IDs copied by the editor runtime", () => {
    const ids = ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"];
    const editorDocument: NovelEditorDocument = {
      type: "doc",
      content: [
        {
          attrs: { blockId: firstBlockId },
          content: [{ text: "First", type: "text" }],
          type: "paragraph",
        },
        {
          attrs: { blockId: firstBlockId },
          content: [{ text: "Second", type: "text" }],
          type: "paragraph",
        },
      ],
    };

    expect(novelEditorDocumentToSceneBlockDocument(editorDocument, () => ids.shift() ?? nextId()).blocks)
      .toEqual([
        { id: firstBlockId, kind: "paragraph", text: "First" },
        { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", kind: "paragraph", text: "Second" },
      ]);
  });

  it("drops the trailing empty cursor paragraph Tiptap adds after a scene break", () => {
    const editorDocument: NovelEditorDocument = {
      type: "doc",
      content: [
        {
          attrs: { blockId: firstBlockId, level: 2 },
          content: [{ text: "A Hard Turn", type: "text" }],
          type: "heading",
        },
        { attrs: { blockId: secondBlockId }, type: "horizontalRule" },
        { attrs: { blockId: thirdBlockId }, type: "paragraph" },
      ],
    };

    expect(novelEditorDocumentToSceneBlockDocument(editorDocument, nextId).blocks)
      .toEqual([
        { id: firstBlockId, kind: "heading", level: 2, text: "A Hard Turn" },
        { id: secondBlockId, kind: "sceneBreak" },
      ]);
  });
});
