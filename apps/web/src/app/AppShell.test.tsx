// @vitest-environment jsdom

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { EditorView } from "@codemirror/view";
import type { Editor, JSONContent } from "@tiptap/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import type { SceneBlock, SceneBlockDocument } from "@novel-studio/contracts";
import { sceneBlockDocumentToNovelEditorDocument } from "../features/write/editor";

const testDir = dirname(fileURLToPath(import.meta.url));
const workshopWorkspaceCss = readFileSync(resolve(testDir, "../features/workshop/workshop-workspace.css"), "utf8");

if (typeof Range !== "undefined") {
  if (!Range.prototype.getClientRects) {
    Object.defineProperty(Range.prototype, "getClientRects", { value: () => [] });
  }
  if (!Range.prototype.getBoundingClientRect) {
    Object.defineProperty(Range.prototype, "getBoundingClientRect", {
      value: () => ({ bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) }),
    });
  }
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

const seriesId = "11111111-1111-4111-8111-111111111111";
const bookId = "22222222-2222-4222-8222-222222222222";
const actId = "33333333-3333-4333-8333-333333333333";
const chapterId = "44444444-4444-4444-8444-444444444444";
const sceneId = "55555555-5555-4555-8555-555555555555";
const secondSceneId = "66666666-6666-4666-8666-666666666666";
const newActId = "77777777-7777-4777-8777-777777777777";
const newChapterId = "88888888-8888-4888-8888-888888888888";
const newBookId = "99999999-9999-4999-8999-999999999999";
const newBookActId = "99999999-9999-4999-8999-111111111111";
const newBookChapterId = "99999999-9999-4999-8999-222222222222";
const codexEntryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const modelProfileId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const secondModelProfileId = "bbbbbbbb-bbbb-4bbb-8bbb-cccccccccccc";
const customCategoryId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const relatedCodexEntryId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const relationId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const createdRelationId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const detailTypeId = "12121212-1212-4121-8121-121212121212";
const secondDetailTypeId = "23232323-2323-4232-8232-232323232323";
const progressionId = "34343434-3434-4434-8434-343434343434";
const secondProgressionId = "45454545-4545-4454-8545-454545454545";
const proposalId = "56565656-5656-4656-8656-565656565656";
const snapshotId = "67676767-6767-4676-8676-676767676767";
const workshopSessionId = "89898989-8989-4989-8989-898989898989";
const workshopProposalId = "79797979-7979-4797-8797-797979797979";
const workshopBasketItemId = "90909090-9090-4090-9090-909090909090";
const workshopContextBundleId = "91919191-9191-4191-9191-919191919191";
const workshopModelCallId = "92929292-9292-4292-9292-929292929292";
const workshopAttachmentId = "93939393-9393-4393-8393-939393939393";
const promptTemplateId = "00000000-0000-4000-8000-000000000405";
const revision = "a".repeat(64);
const updatedRevision = "b".repeat(64);
const firstBlockId = "10101010-1010-4010-8010-101010101010";
const secondBlockId = "20202020-2020-4020-8020-202020202020";
const thirdBlockId = "30303030-3030-4030-8030-303030303030";
const fourthBlockId = "40404040-4040-4040-8040-404040404040";
const blockIds = [firstBlockId, secondBlockId, thirdBlockId];

function testBlockId(index: number) {
  return blockIds[index] ?? `40404040-4040-4040-8040-${String(index).padStart(12, "0").slice(0, 12)}`;
}

function blockText(block: SceneBlock) {
  return block.kind === "paragraph" || block.kind === "heading" || block.kind === "quote" ? block.text ?? "" : "";
}

function blockToMarkdown(block: SceneBlock) {
  if (block.kind === "heading") return `${"#".repeat(block.level ?? 2)} ${block.text ?? ""}`;
  if (block.kind === "quote") return (block.text ?? "").split("\n").map((line) => `> ${line}`).join("\n");
  if (block.kind === "sceneBreak") return "***";
  if (block.kind === "paragraph") return block.text ?? "";
  return "";
}

function cssRule(css: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escapedSelector}\\s*\\{[^}]*\\}`).exec(css);
  expect(match).toBeTruthy();
  return match?.[0] ?? "";
}

function documentStats(document: SceneBlockDocument) {
  const plainText = document.blocks.map(blockText).filter((segment) => segment.trim().length > 0).join("\n\n");
  const content = document.blocks.map(blockToMarkdown).filter((segment) => segment.trim().length > 0).join("\n\n");
  return {
    characterCount: Array.from(plainText.replace(/\s/g, "")).length,
    content,
    paragraphCount: plainText.trim() ? plainText.trim().split(/\n\s*\n/u).length : 0,
    plainText,
  };
}

function sceneBlockDocument(content = ""): SceneBlockDocument {
  if (!content.trim()) {
    return {
      schemaVersion: 1,
      blocks: [{ id: firstBlockId, kind: "paragraph", text: "" }],
    };
  }
  return {
    schemaVersion: 1,
    blocks: content.split(/\n\s*\n/u).map((segment, index) => ({
      id: testBlockId(index),
      kind: "paragraph",
      text: segment,
    })),
  };
}

function findEditorView(label: string) {
  const editorElement = screen.getByLabelText(label);
  const view = EditorView.findFromDOM(editorElement);
  if (!view) throw new Error(`Missing CodeMirror editor for ${label}`);
  return view;
}

function setEditorValue(label: string, value: string) {
  const view = findEditorView(label);
  act(() => {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
      selection: { anchor: value.length },
    });
  });
}

function insertEditorText(label: string, value: string) {
  const view = findEditorView(label);
  const range = view.state.selection.main;
  act(() => {
    view.dispatch({
      changes: { from: range.from, to: range.to, insert: value },
      selection: { anchor: range.from + value.length },
      userEvent: "input.test",
    });
  });
}

function manuscriptEditor() {
  const element = screen.getByLabelText("Manuscript editor") as HTMLElement & { __novelStudioEditor?: Editor };
  if (!element.__novelStudioEditor) throw new Error("Missing Tiptap manuscript editor");
  return element.__novelStudioEditor;
}

function setManuscriptDocument(document: SceneBlockDocument) {
  const editor = manuscriptEditor();
  act(() => {
    editor.commands.setContent(sceneBlockDocumentToNovelEditorDocument(document) as JSONContent);
  });
}

function setManuscriptBlocks(blocks: SceneBlock[]) {
  setManuscriptDocument({ schemaVersion: 1, blocks });
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json" },
      status,
    }),
  );
}

function abortError(): DOMException {
  return new DOMException("Aborted", "AbortError");
}

function sseResponse(events: unknown[], status = 200, delayMs = 0, signal?: AbortSignal | null) {
  const response = new Response(events.map((event) => (
    `event: ${(event as { type?: string }).type ?? "message"}\n` +
    `data: ${JSON.stringify(event)}\n\n`
  )).join(""), {
    headers: { "content-type": "text/event-stream; charset=utf-8" },
    status,
  });
  if (delayMs <= 0) return Promise.resolve(response);
  return new Promise<Response>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve(response);
    }, delayMs);
    function onAbort() {
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(abortError());
    }
    signal?.addEventListener("abort", onAbort);
  });
}

function delayedJsonResponse(body: unknown, status = 200, delayMs = 0, signal?: AbortSignal | null) {
  if (delayMs <= 0) return jsonResponse(body, status);
  return new Promise<Response>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve(new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json" },
        status,
      }));
    }, delayMs);
    function onAbort() {
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(abortError());
    }
    signal?.addEventListener("abort", onAbort);
  });
}

function seriesSummary() {
  return {
    archived: false,
    bookCount: 1,
    description: "A harbor mystery",
    directoryName: "glass-harbor",
    id: seriesId,
    sceneCount: 1,
    title: "Glass Harbor",
    updatedAt: "2026-06-23T00:00:00.000Z",
  };
}

function sceneDocument(content = "", nextRevision = revision, document: SceneBlockDocument = sceneBlockDocument(content)) {
  const stats = documentStats(document);
  return {
    characterCount: stats.characterCount,
    content: stats.content,
    document,
    metadata: {
      actId,
      beats: [],
      bookId,
      chapterId,
      characterIds: [],
      conflict: "",
      createdAt: "2026-06-23T00:00:00.000Z",
      divergenceNote: "",
      durationMinutes: null,
      goal: "",
      id: sceneId,
      locationIds: [],
      order: 1,
      outcome: "",
      plannedCharacters: 0,
      planningState: "aligned",
      plotThreadIds: [],
      pov: null,
      schemaVersion: 1,
      status: "draft",
      storyTime: null,
      summary: "",
      tags: [],
      title: "Opening Scene",
      updatedAt: "2026-06-23T00:00:00.000Z",
    },
    paragraphCount: stats.paragraphCount,
    plainText: stats.plainText,
    relativePath: "books/book/manuscript/act/chapter/001-opening-scene.json",
    revision: nextRevision,
  };
}

function sceneDocumentWithMetadata(
  metadata: Partial<ReturnType<typeof sceneDocument>["metadata"]>,
  content = "",
  nextRevision = revision,
  document: SceneBlockDocument = sceneBlockDocument(content),
) {
  const scene = sceneDocument(content, nextRevision, document);
  return {
    ...scene,
    metadata: {
      ...scene.metadata,
      ...metadata,
    },
  };
}

function seriesDetail(content = "", nextRevision = revision) {
  return {
    acts: [
      {
        bookId,
        chapterIds: [chapterId],
        createdAt: "2026-06-23T00:00:00.000Z",
        id: actId,
        order: 1,
        schemaVersion: 1,
        title: "Chapter One",
        updatedAt: "2026-06-23T00:00:00.000Z",
      },
    ],
    books: [
      {
        actIds: [actId],
        createdAt: "2026-06-23T00:00:00.000Z",
        id: bookId,
        order: 1,
        schemaVersion: 1,
        seriesId,
        targetCharacters: 0,
        title: "Volume 1",
        updatedAt: "2026-06-23T00:00:00.000Z",
      },
    ],
    chapters: [
      {
        actId,
        createdAt: "2026-06-23T00:00:00.000Z",
        id: chapterId,
        order: 1,
        sceneIds: [sceneId],
        schemaVersion: 1,
        title: "Act One",
        updatedAt: "2026-06-23T00:00:00.000Z",
      },
    ],
    manifest: {
      archivedAt: null as string | null,
      bookIds: [bookId],
      createdAt: "2026-06-23T00:00:00.000Z",
      description: "A harbor mystery",
      id: seriesId,
      language: "zh-CN",
      schemaVersion: 1,
      title: "Glass Harbor",
      updatedAt: "2026-06-23T00:00:00.000Z",
    },
    scenes: [sceneDocument(content, nextRevision)],
  };
}

function seriesDetailWithNewAct(actTitle = "New Chapter") {
  const detail = seriesDetail();
  return {
    ...detail,
    acts: [
      ...detail.acts,
      {
        bookId,
        chapterIds: [],
        createdAt: "2026-06-23T00:00:00.000Z",
        id: newActId,
        order: 2,
        schemaVersion: 1,
        title: actTitle,
        updatedAt: "2026-06-23T00:00:00.000Z",
      },
    ],
    books: [{ ...detail.books[0]!, actIds: [actId, newActId] }],
  };
}

function seriesDetailWithNewBook(bookTitle = "New Volume") {
  const detail = seriesDetail();
  return {
    ...detail,
    acts: [
      ...detail.acts,
      {
        bookId: newBookId,
        chapterIds: [newBookChapterId],
        createdAt: "2026-06-23T00:00:00.000Z",
        id: newBookActId,
        order: 1,
        schemaVersion: 1,
        title: "New Chapter",
        updatedAt: "2026-06-23T00:00:00.000Z",
      },
    ],
    books: [
      ...detail.books,
      {
        actIds: [newBookActId],
        createdAt: "2026-06-23T00:00:00.000Z",
        id: newBookId,
        order: 2,
        schemaVersion: 1,
        seriesId,
        targetCharacters: 0,
        title: bookTitle,
        updatedAt: "2026-06-23T00:00:00.000Z",
      },
    ],
    chapters: [
      ...detail.chapters,
      {
        actId: newBookActId,
        createdAt: "2026-06-23T00:00:00.000Z",
        id: newBookChapterId,
        order: 1,
        sceneIds: [],
        schemaVersion: 1,
        title: "New Act",
        updatedAt: "2026-06-23T00:00:00.000Z",
      },
    ],
    manifest: {
      ...detail.manifest,
      bookIds: [bookId, newBookId],
    },
  };
}

function seriesDetailWithNewChapter(actTitle = "New Chapter", chapterTitle = "New Act") {
  const detail = seriesDetailWithNewAct(actTitle);
  return {
    ...detail,
    acts: detail.acts.map((act) => (
      act.id === newActId ? { ...act, chapterIds: [newChapterId] } : act
    )),
    chapters: [
      ...detail.chapters,
      {
        actId: newActId,
        createdAt: "2026-06-23T00:00:00.000Z",
        id: newChapterId,
        order: 1,
        sceneIds: [],
        schemaVersion: 1,
        title: chapterTitle,
        updatedAt: "2026-06-23T00:00:00.000Z",
      },
    ],
  };
}

function planningBoard() {
  const scene = sceneDocument();
  const planningScene = {
    ...scene.metadata,
    characterCount: scene.characterCount,
    narrativeIndex: 1,
    revision: scene.revision,
  };
  const secondPlanningScene = {
    ...planningScene,
    id: secondSceneId,
    narrativeIndex: 2,
    order: 2,
    revision: updatedRevision,
    title: "Second Scene",
  };

  return {
    books: [
      {
        acts: [
          {
            bookId,
            chapters: [
              {
                actId,
                id: chapterId,
                order: 1,
                scenes: [planningScene, secondPlanningScene],
                title: "Act One",
              },
            ],
            id: actId,
            order: 1,
            title: "Chapter One",
          },
        ],
        id: bookId,
        order: 1,
        title: "Volume 1",
      },
    ],
    codexLabels: {},
    dimensions: {
      characterIds: [],
      locationIds: [],
      plotThreadIds: [],
      povs: [],
      statuses: ["draft"],
      tags: [],
    },
    legacyStoryTimeSceneIds: [],
    narrativeScenes: [planningScene, secondPlanningScene],
    revision: "c".repeat(64),
    seriesId,
    storyEvents: [],
    unplacedSceneIds: [],
  };
}

function codexCategories() {
  return [
    {
      category: {
        archivedAt: null as string | null,
        builtIn: true,
        icon: "U",
        id: "uncategorized",
        name: "Uncategorized",
      },
      revision: null as string | null,
    },
    {
      category: {
        archivedAt: null as string | null,
        builtIn: true,
        icon: "C",
        id: "character",
        name: "人物",
      },
      revision: null as string | null,
    },
    {
      category: {
        archivedAt: null as string | null,
        builtIn: true,
        icon: "L",
        id: "location",
        name: "地点",
      },
      revision: null as string | null,
    },
  ];
}

function codexEntryRelativePath(categoryId: string, entryId = codexEntryId) {
  if (categoryId === "uncategorized") return `codex/uncategorized/${entryId}.json`;
  if (categoryId === "character") return `codex/characters/${entryId}.json`;
  if (categoryId === "location") return `codex/locations/${entryId}.json`;
  return `codex/custom/${categoryId}/${entryId}.json`;
}

function codexEntryDocument(
  name = "New Entry",
  categoryId = "character",
  description = "",
  entryId = codexEntryId,
  options: {
    aliases?: string[];
    detailAiContext?: Record<string, boolean>;
    details?: Record<string, string>;
    research?: string;
  } = {},
) {
  return {
    description,
    metadata: {
      aiContextPolicy: "on-mention",
      aliases: options.aliases ?? [],
      archivedAt: null as string | null,
      categoryId,
      createdAt: "2026-06-23T00:00:00.000Z",
      details: options.details ?? {},
      detailAiContext: options.detailAiContext ?? {},
      id: entryId,
      mention: {
        automaticPlural: false,
        caseSensitive: false,
        excludedTerms: [],
        matchAliases: true,
      },
      name,
      schemaVersion: 1,
      thumbnail: null as string | null,
      updatedAt: "2026-06-23T00:00:00.000Z",
    },
    relativePath: codexEntryRelativePath(categoryId, entryId),
    research: {
      content: options.research ?? "",
      metadata: {
        createdAt: "2026-06-23T00:00:00.000Z",
        entryId,
        schemaVersion: 1,
        updatedAt: "2026-06-23T00:00:00.000Z",
      },
      relativePath: `codex/entry-research/${entryId}.json`,
      revision,
    },
    revision,
  };
}

function codexDetailTypeDocument(name = "Gate rule", categoryId = "character", id = detailTypeId, nsfw = false) {
  return {
    detailType: {
      categoryId,
      createdAt: "2026-06-23T00:00:00.000Z",
      id,
      name,
      nsfw,
      schemaVersion: 1,
      updatedAt: "2026-06-23T00:00:00.000Z",
    },
    revision,
  };
}

function codexRelationDocument(
  sourceEntryId = codexEntryId,
  targetEntryId = relatedCodexEntryId,
  description = "Locks access to the quay.",
  id = relationId,
  type = "guards",
  directed = true,
  evidence = "Bell timing scene.",
) {
  return {
    relation: {
      archivedAt: null as string | null,
      createdAt: "2026-06-23T00:00:00.000Z",
      description,
      directed,
      evidence,
      id,
      schemaVersion: 1,
      sourceEntryId,
      targetEntryId,
      type,
      updatedAt: "2026-06-23T00:00:00.000Z",
      validFromSceneId: null as string | null,
      validToSceneId: null as string | null,
    },
    relativePath: `codex/relations/${id}.json`,
    revision,
  };
}

function codexProgressionDocument(
  blockId = secondBlockId,
  id = progressionId,
  options: Partial<{
    body: string;
    entryId: string;
    operation: "add" | "replace";
    sceneId: string;
    summary: string;
  }> = {},
) {
  const progressionSceneId = options.sceneId ?? sceneId;
  return {
    progression: {
      archivedAt: null as string | null,
      body: options.body ?? "Learns the lock changed.",
      createdAt: "2026-06-23T00:00:00.000Z",
      effectiveFromSceneId: progressionSceneId,
      effectiveToSceneId: null as string | null,
      entryId: options.entryId ?? codexEntryId,
      evidence: [],
      field: { kind: "description" as const, detailTypeId: null },
      fieldKey: null as string | null,
      id,
      kind: "field" as const,
      operation: options.operation ?? "add",
      relationId: null as string | null,
      schemaVersion: 1 as const,
      source: {
        kind: "write-block" as const,
        sceneId: progressionSceneId,
        blockId,
      },
      summary: options.summary ?? "Lock state changes.",
      updatedAt: "2026-06-23T00:00:00.000Z",
    },
    revision,
  };
}

function modelProfile(overrides: Partial<{
  archivedAt: string | null;
  baseUrl: string | null;
  capabilities: {
    embeddings: boolean;
    modelList: boolean;
    streamText: boolean;
    structuredOutput: boolean;
    tokenEstimate: boolean;
  };
  contextWindowTokens: number;
  credentialRef: string | null;
  id: string;
  model: string;
  provider: "mock" | "openai" | "openrouter" | "ollama" | "deepseek" | "openai-compatible" | "anthropic" | "google";
  title: string;
}> = {}) {
  return {
    archivedAt: null,
    baseUrl: null,
    capabilities: {
      embeddings: false,
      modelList: true,
      streamText: true,
      structuredOutput: false,
      tokenEstimate: true,
    },
    contextWindowTokens: 8192,
    createdAt: "2026-06-23T00:00:00.000Z",
    credentialRef: null,
    defaultParameters: {},
    id: modelProfileId,
    model: "mock-continuity-v1",
    provider: "mock" as const,
    schemaVersion: 1 as const,
    title: "Mock Continuity",
    updatedAt: "2026-06-23T00:00:00.000Z",
    ...overrides,
  };
}

function proposalDocument(
  status: "pending" | "accepted" | "rejected" | "edited" | "stale" | "superseded" | "archived" = "pending",
  overrides: Partial<{
    contextBundleId: string | null;
    evidence: Array<Record<string, unknown>>;
    generator: Record<string, unknown>;
    id: string;
    patches: Array<Record<string, unknown>>;
    reason: string;
    source: Record<string, unknown>;
    sourceAvailability: { available: boolean; reason: string };
    summary: string;
    target: Record<string, unknown>;
    targetAvailability: { available: boolean; reason: string };
    title: string;
    type: "text-replacement" | "text-insertion";
  }> = {},
) {
  const target = overrides.target ?? {
    kind: "scene-content" as const,
    targetId: sceneId,
    label: "Opening Scene",
    baseRevision: revision,
    fieldPath: [],
    blockId: null,
    range: null,
  };
  return {
    proposal: {
      schemaVersion: 2 as const,
      id: overrides.id ?? proposalId,
      seriesId,
      type: overrides.type ?? "text-replacement" as const,
      title: overrides.title ?? "Replace chase beat with continuity-safe escalation",
      summary: overrides.summary ?? "Keeps the chase consistent with Codex constraints.",
      status,
      source: overrides.source ?? {
        kind: "manual" as const,
        sourceId: null,
        label: "Workshop continuity pass",
        detail: "",
      },
      target,
      contextBundleId: overrides.contextBundleId ?? null,
      generator: overrides.generator ?? { kind: "manual" as const, actor: "user" },
      riskLevel: "medium" as const,
      confidence: 0.82,
      reason: overrides.reason ?? "Captain Veyr should not know the route before the city clock breaks.",
      staleReason: status === "stale" ? "Marked stale during Review." : "",
      supersededBy: status === "superseded" ? "99999999-9999-4999-9999-999999999999" : null,
      originalCandidate: null,
      decision: status === "pending" ? null : {
        kind: status,
        actor: "user",
        decidedAt: "2026-06-24T00:00:00.000Z",
        note: "",
        snapshotId: status === "accepted" || status === "edited" ? snapshotId : null,
        editedCandidate: null,
      },
      patches: overrides.patches ?? [{
        id: "78787878-7878-4787-8787-787878787878",
        target,
        action: "replace-text" as const,
        before: "Captain Veyr shouted from the far arch, already knowing her name.",
        after: "Captain Veyr was not in the arcade. That mattered.",
        unifiedDiff: "-Captain Veyr shouted from the far arch, already knowing her name.\n+Captain Veyr was not in the arcade. That mattered.",
      }],
      evidence: overrides.evidence ?? [{
        sourceType: "codex-entry" as const,
        sourceId: codexEntryId,
        revision,
        quote: "",
        note: "No knowledge until Scene 14.",
      }],
      createdAt: "2026-06-24T00:00:00.000Z",
      updatedAt: "2026-06-24T00:00:00.000Z",
    },
    revision,
    sourceAvailability: overrides.sourceAvailability ?? { available: true, reason: "" },
    targetAvailability: overrides.targetAvailability ?? { available: true, reason: "" },
  };
}

function proposalDocumentWithStatus(
  document: ReturnType<typeof proposalDocument>,
  status: "pending" | "accepted" | "rejected" | "edited" | "stale" | "superseded" | "archived",
) {
  return proposalDocument(status, {
    contextBundleId: document.proposal.contextBundleId,
    evidence: document.proposal.evidence,
    generator: document.proposal.generator,
    id: document.proposal.id,
    patches: document.proposal.patches,
    reason: document.proposal.reason,
    source: document.proposal.source,
    sourceAvailability: document.sourceAvailability,
    summary: document.proposal.summary,
    target: document.proposal.target,
    targetAvailability: document.targetAvailability,
    title: document.proposal.title,
    type: document.proposal.type,
  });
}

function workshopSession(overrides: Partial<{
  branchOfMessageId: string | null;
  id: string;
  kind: "chat" | "agent";
  lastMessageAt: string | null;
  status: "active" | "archived";
  title: string;
}> = {}) {
  return {
    schemaVersion: 1 as const,
    id: overrides.id ?? workshopSessionId,
    seriesId,
    kind: overrides.kind ?? "chat",
    title: overrides.title ?? "New chat",
    status: overrides.status ?? "active",
    branchOfMessageId: overrides.branchOfMessageId ?? null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    archivedAt: overrides.status === "archived" ? "2026-07-01T00:00:00.000Z" : null,
    lastMessageAt: overrides.lastMessageAt ?? null,
  };
}

function workshopBasket(items: Array<Record<string, unknown>> = []) {
  return {
    schemaVersion: 1 as const,
    id: "93939393-9393-4393-9393-939393939393",
    seriesId,
    sessionId: workshopSessionId,
    sceneId,
    blockId: null,
    selection: null,
    items,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  };
}

function workshopContextBundle() {
  return {
    schemaVersion: 1 as const,
    id: workshopContextBundleId,
    seriesId,
    sceneId,
    roleId: "continuity-editor",
    taskKind: "continuity-check",
    userRequest: "Check continuity for the opening scene.",
    promptTemplateId,
    promptTemplateVersion: 1,
    items: [
      {
        id: "role-instruction:continuity-editor",
        kind: "role-instruction",
        source: { type: "system", id: "continuity-editor", revision: null, label: "Continuity editor" },
        title: "Continuity editor",
        content: "Check continuity.",
        inclusion: "required",
        inclusionReason: "Role instruction.",
        contextPolicy: null,
        tokenEstimate: 12,
        manuallySelected: false,
        textHash: revision,
        sourceRefs: [],
      },
    ],
    excluded: [],
    estimatedUsage: { inputTokens: 12, outputTokens: 0, totalTokens: 12 },
    createdAt: "2026-07-01T00:00:00.000Z",
  };
}

function workshopAttachment(overrides: Partial<Record<string, unknown>> = {}) {
  const extractedText = typeof overrides.extractedText === "string"
    ? overrides.extractedText
    : "Parsed Workshop attachment text.";
  const parseStatus = typeof overrides.parseStatus === "string" ? overrides.parseStatus : "parsed";
  return {
    schemaVersion: 1,
    id: overrides.id ?? workshopAttachmentId,
    seriesId,
    sessionId: overrides.sessionId ?? workshopSessionId,
    messageId: overrides.messageId ?? null,
    draftToken: overrides.draftToken ?? "draft-token",
    fileName: overrides.fileName ?? "draft.md",
    mediaType: overrides.mediaType ?? "text/markdown",
    sizeBytes: overrides.sizeBytes ?? 32,
    textHash: parseStatus === "parsed" ? revision : null,
    extractedText: parseStatus === "parsed" ? extractedText : "",
    parseStatus,
    parseWarnings: [],
    parseError: parseStatus === "parsed" ? null : "Attachment parse failed.",
    createdAt: "2026-07-01T00:12:30.000Z",
    updatedAt: "2026-07-01T00:12:30.000Z",
    ...overrides,
  };
}

function promptTemplate(overrides: Partial<{
  id: string;
  roleId: string;
  name: string;
  description: string;
  system: string;
  instructions: string;
  outputSchemaName: string;
}> = {}) {
  return {
    schemaVersion: 1 as const,
    id: overrides.id ?? promptTemplateId,
    roleId: overrides.roleId ?? "continuity-editor",
    name: overrides.name ?? "Continuity check",
    version: 1,
    status: "active" as const,
    description: overrides.description ?? "Check continuity.",
    system: overrides.system ?? "You are a continuity editor.",
    instructions: overrides.instructions ?? "Check continuity.",
    components: [],
    variables: [],
    outputSchemaName: overrides.outputSchemaName ?? "continuity_report",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    archivedAt: null,
  };
}

function mockFetch(options: {
  conflictCodexUpdate?: boolean;
  codexUpdateDelayMs?: number;
  initialCodexEntries?: ReturnType<typeof codexEntryDocument>[];
  initialCodexDetailTypes?: ReturnType<typeof codexDetailTypeDocument>[];
  initialCodexProgressions?: ReturnType<typeof codexProgressionDocument>[];
  initialCodexRelations?: ReturnType<typeof codexRelationDocument>[];
  initialModelProfiles?: ReturnType<typeof modelProfile>[];
  initialProposals?: ReturnType<typeof proposalDocument>[];
  initialWorkshopAttachments?: Array<Record<string, unknown>>;
  initialWorkshopMessages?: Array<Record<string, unknown>>;
  initialWorkshopSessions?: ReturnType<typeof workshopSession>[];
  initialSeriesDetail?: ReturnType<typeof seriesDetail>;
  initialSeriesList?: ReturnType<typeof seriesSummary>[];
  providerModelCount?: number;
  workshopCallDelayMs?: number;
} = {}) {
  let detailOverride: ReturnType<typeof seriesDetail> | null = options.initialSeriesDetail ?? null;
  let seriesSummaries = options.initialSeriesList ?? [seriesSummary()];
  let codexCategoryDocs = codexCategories();
  let codexEntries: ReturnType<typeof codexEntryDocument>[] = options.initialCodexEntries ?? [];
  let codexDetailTypes: ReturnType<typeof codexDetailTypeDocument>[] = options.initialCodexDetailTypes ?? [];
  let codexProgressions: ReturnType<typeof codexProgressionDocument>[] = options.initialCodexProgressions ?? [];
  let codexRelations: ReturnType<typeof codexRelationDocument>[] = options.initialCodexRelations ?? [];
  let conflictCodexUpdate = options.conflictCodexUpdate ?? false;
  let modelProfiles: ReturnType<typeof modelProfile>[] = options.initialModelProfiles ?? [];
  let proposals = options.initialProposals ?? [proposalDocument()];
  let workshopSessions = options.initialWorkshopSessions ?? [];
  let workshopAttachments: Array<Record<string, unknown>> = options.initialWorkshopAttachments ?? [];
  let workshopMessages: Array<Record<string, unknown>> = options.initialWorkshopMessages ?? [];
  let currentWorkshopBasket = workshopBasket();
  const workshopCallDelayMs = options.workshopCallDelayMs ?? 0;
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url === "/api/v1/series" && method === "GET") {
      return jsonResponse(seriesSummaries);
    }

    if (url === "/api/v1/series" && method === "POST") {
      const body = JSON.parse(String(init?.body));
      const base = seriesDetail();
      detailOverride = {
        ...base,
        books: [{ ...base.books[0]!, title: body.firstBookTitle }],
        manifest: { ...base.manifest, description: body.description, title: body.title },
      };
      seriesSummaries = [
        {
          ...seriesSummary(),
          bookCount: detailOverride.books.length,
          description: body.description,
          sceneCount: detailOverride.scenes.length,
          title: body.title,
        },
      ];
      return jsonResponse(detailOverride, 201);
    }

    if (url === `/api/v1/series/${seriesId}/trash` && method === "POST") {
      seriesSummaries = seriesSummaries.map((series) => (
        series.id === seriesId ? { ...series, archived: true, updatedAt: "2026-06-24T00:00:00.000Z" } : series
      ));
      if (detailOverride?.manifest.id === seriesId) {
        detailOverride = {
          ...detailOverride,
          manifest: {
            ...detailOverride.manifest,
            archivedAt: "2026-06-24T00:00:00.000Z",
            updatedAt: "2026-06-24T00:00:00.000Z",
          },
        };
      }
      return jsonResponse({ ...(detailOverride ?? seriesDetail()).manifest, archivedAt: "2026-06-24T00:00:00.000Z" });
    }

    if (url === `/api/v1/series/${seriesId}/restore` && method === "POST") {
      seriesSummaries = seriesSummaries.map((series) => (
        series.id === seriesId ? { ...series, archived: false, updatedAt: "2026-06-25T00:00:00.000Z" } : series
      ));
      if (detailOverride?.manifest.id === seriesId) {
        detailOverride = {
          ...detailOverride,
          manifest: {
            ...detailOverride.manifest,
            archivedAt: null,
            updatedAt: "2026-06-25T00:00:00.000Z",
          },
        };
      }
      return jsonResponse({ ...(detailOverride ?? seriesDetail()).manifest, archivedAt: null });
    }

    if (url === `/api/v1/series/${seriesId}` && method === "DELETE") {
      const body = JSON.parse(String(init?.body));
      const title = (detailOverride ?? seriesDetail()).manifest.title;
      if (body.confirmTitle !== title) return jsonResponse({ message: "Project title confirmation does not match" }, 422);
      seriesSummaries = seriesSummaries.filter((series) => series.id !== seriesId);
      detailOverride = null;
      return jsonResponse({ deletedId: seriesId });
    }

    if (url === `/api/v1/series/${seriesId}` && method === "GET") {
      return jsonResponse(detailOverride ?? seriesDetail());
    }

    if (url === `/api/v1/series/${seriesId}/planning` && method === "GET") {
      return jsonResponse(planningBoard());
    }

    if (url === `/api/v1/series/${seriesId}/workshop/sessions` && method === "GET") {
      return jsonResponse(workshopSessions);
    }

    if (url === `/api/v1/series/${seriesId}/workshop/sessions` && method === "POST") {
      const body = JSON.parse(String(init?.body));
      const created = workshopSession({
        kind: body.kind ?? "chat",
        title: body.title ?? "New chat",
      });
      workshopSessions = [created, ...workshopSessions.filter((session) => session.id !== created.id)];
      currentWorkshopBasket = {
        ...workshopBasket(),
        sceneId: body.sceneId ?? null,
      };
      return jsonResponse(created, 201);
    }

    const workshopMessageSourceMatch = url.match(new RegExp(`^/api/v1/series/${seriesId}/workshop/messages/([^/]+)/source$`));
    if (workshopMessageSourceMatch && method === "GET") {
      const [, requestedMessageId] = workshopMessageSourceMatch;
      const message = workshopMessages.find((item) => item.id === requestedMessageId);
      if (!message) return jsonResponse({ message: "Workshop message does not exist" }, 404);
      const session = workshopSessions.find((item) => item.id === message.sessionId) ?? workshopSession();
      return jsonResponse({ session, message });
    }

    const workshopCodexToolExecuteMatch = url.match(
      new RegExp(`^/api/v1/series/${seriesId}/workshop/sessions/([^/]+)/messages/([^/]+)/tools/codex\\.create_entry/execute$`),
    );
    if (workshopCodexToolExecuteMatch && method === "POST") {
      const [, requestedSessionId, requestedMessageId] = workshopCodexToolExecuteMatch;
      const body = JSON.parse(String(init?.body));
      const message = workshopMessages.find((item) =>
        item.id === requestedMessageId && item.sessionId === requestedSessionId,
      );
      if (!message) return jsonResponse({ message: "Workshop message does not exist" }, 404);
      if (body.confirm !== true) {
        return jsonResponse({ message: "codex.create_entry requires explicit confirmation" }, 400);
      }
      if (!body.createMissingDetailTypes) {
        return jsonResponse({
          code: "CODEX_DETAIL_TYPE_CREATION_REQUIRED",
          message: "Codex Draft needs new detail types before writing: Looks.",
          missingDetailTypes: [{ label: "Looks", valuePreview: "Blonde hair." }],
          availableDetailTypes: codexDetailTypes,
        }, 409);
      }
      const createdDetailType = codexDetailTypeDocument("Looks", "character", secondDetailTypeId);
      codexDetailTypes = [...codexDetailTypes, createdDetailType];
      const created = codexEntryDocument(
        "Alice",
        "character",
        "Alice is alive.",
        relatedCodexEntryId,
        {
          aliases: ["Lin Alice", "Alice"],
          details: { [createdDetailType.detailType.id]: "Blonde hair." },
          detailAiContext: { [createdDetailType.detailType.id]: true },
          research: "Source: author-approved Workshop character ruling.",
        },
      );
      codexEntries = [created, ...codexEntries.filter((entry) => entry.metadata.id !== created.metadata.id)];
      const resultMessage = {
        schemaVersion: 1,
        id: "94949494-9494-4494-8494-949494949494",
        seriesId,
        sessionId: requestedSessionId,
        role: "result",
        mode: "agent",
        status: "succeeded",
        content: "codex.create_entry created Codex entry: Alice",
        reasoningContent: "",
        contextBundleId: null,
        modelCallId: null,
        proposalIds: [],
        attachmentIds: [],
        errorCode: null,
        errorMessage: null,
        createdAt: "2026-07-01T00:12:30.000Z",
      };
      workshopMessages = [...workshopMessages, resultMessage];
      return jsonResponse({
        createdDetailTypes: [createdDetailType],
        message,
        resultMessage,
        entry: created,
      }, 201);
    }

    const workshopSessionExportMatch = url.match(
      new RegExp(`^/api/v1/series/${seriesId}/workshop/sessions/([^/]+)/export\\?includePromptAudit=(true|false)&includeReasoning=(true|false)$`),
    );
    if (workshopSessionExportMatch && method === "GET") {
      const [, requestedSessionId, includePromptAudit, includeReasoning] = workshopSessionExportMatch;
      const session = workshopSessions.find((item) => item.id === requestedSessionId);
      if (!session) return jsonResponse({ code: "NOT_FOUND", message: "Workshop session does not exist" }, 404);
      const sessionMessages = workshopMessages
        .filter((message) => message.sessionId === requestedSessionId)
        .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)));
      const sessionAttachments = workshopAttachments.filter((attachment) =>
        attachment.sessionId === requestedSessionId,
      );
      const markdown = [
        `# Workshop Export: ${session.title}`,
        `- Include reasoning: ${includeReasoning === "true" ? "yes" : "no"}`,
        `- Include prompt audit: ${includePromptAudit === "true" ? "yes" : "no"}`,
        "",
        "## Messages",
        "",
        ...sessionMessages.flatMap((message, index) => {
          const lines = [
            `### ${index + 1}. ${message.role}`,
            "",
            "```text",
            String(message.content ?? ""),
            "```",
            "",
          ];
          const messageAttachments = (Array.isArray(message.attachmentIds) ? message.attachmentIds : [])
            .map((attachmentId) => sessionAttachments.find((attachment) => attachment.id === attachmentId))
            .filter(Boolean);
          if (messageAttachments.length > 0) {
            lines.push("Attachments:");
            for (const attachment of messageAttachments) {
              lines.push(
                `- ${String(attachment?.fileName)} (${String(attachment?.parseStatus)}, ${String(attachment?.mediaType)}, ${String(attachment?.sizeBytes)} bytes)`,
              );
            }
            lines.push("");
          }
          if (includeReasoning === "true" && String(message.reasoningContent ?? "").trim()) {
            lines.push("Reasoning:", "```text", String(message.reasoningContent), "```", "");
          }
          if (includePromptAudit === "true" && message.contextBundleId) {
            lines.push("Provider Prompt:", "```text", "Mock provider prompt.", "```", "");
          }
          return lines;
        }),
      ].join("\n");
      return Promise.resolve(
        new Response(markdown, {
          headers: { "content-type": "text/markdown; charset=utf-8" },
          status: 200,
        }),
      );
    }

    const workshopSessionMatch = url.match(new RegExp(`^/api/v1/series/${seriesId}/workshop/sessions/([^/]+)(?:/([^/]+))?(?:/([^/]+))?(?:/([^/]+))?$`));
    if (workshopSessionMatch) {
      const [, requestedSessionId, segment, action, subaction] = workshopSessionMatch;
      if (!requestedSessionId) {
        return jsonResponse({ code: "NOT_FOUND", message: "Workshop session not found" }, 404);
      }
      const session = workshopSessions.find((item) => item.id === requestedSessionId) ?? workshopSession({ id: requestedSessionId });
      if (!segment && method === "DELETE") {
        const existingSession = workshopSessions.find((item) => item.id === requestedSessionId);
        if (!existingSession) {
          return jsonResponse({ code: "NOT_FOUND", message: "Workshop session does not exist" }, 404);
        }
        const sessionMessages = workshopMessages.filter((message) => message.sessionId === requestedSessionId);
        const linkedMessage = sessionMessages.find((message) =>
          ((message.proposalIds as string[] | undefined) ?? []).length > 0,
        );
        if (linkedMessage) {
          return jsonResponse({
            code: "INVALID_DATA",
            message: "Workshop sessions with Proposal-linked messages cannot be deleted",
          }, 409);
        }
        const deletedMessageIds = sessionMessages.map((message) => String(message.id));
        const deletedMessageIdSet = new Set(deletedMessageIds);
        const deletedAttachmentIds = workshopAttachments
          .filter((attachment) => attachment.sessionId === requestedSessionId)
          .map((attachment) => String(attachment.id));
        workshopMessages = workshopMessages.filter((message) => message.sessionId !== requestedSessionId);
        workshopAttachments = workshopAttachments.filter((attachment) => attachment.sessionId !== requestedSessionId);
        workshopSessions = workshopSessions
          .filter((item) => item.id !== requestedSessionId)
          .map((item) => deletedMessageIdSet.has(String(item.branchOfMessageId))
            ? { ...item, branchOfMessageId: null }
            : item);
        return jsonResponse({
          deletedId: requestedSessionId,
          deletedMessageIds,
          deletedAttachmentIds,
          deletedBranchIds: [],
        });
      }
      if (!segment && method === "GET") {
        return jsonResponse({
          session,
          basket: currentWorkshopBasket,
          messages: workshopMessages.filter((message) => message.sessionId === requestedSessionId),
          attachments: workshopAttachments.filter((attachment) => attachment.sessionId === requestedSessionId),
        });
      }
      if (!segment && method === "PUT") {
        const body = JSON.parse(String(init?.body));
        const updated = { ...session, ...body, updatedAt: "2026-07-01T00:10:00.000Z" };
        workshopSessions = workshopSessions.map((item) => item.id === requestedSessionId ? updated : item);
        return jsonResponse(updated);
      }
      if (segment === "archive" && method === "POST") {
        const archived = { ...session, status: "archived" as const, archivedAt: "2026-07-01T00:10:00.000Z" };
        workshopSessions = workshopSessions.map((item) => item.id === requestedSessionId ? archived : item);
        return jsonResponse(archived);
      }
      if (segment === "restore" && method === "POST") {
        const restored = { ...session, status: "active" as const, archivedAt: null };
        workshopSessions = workshopSessions.map((item) => item.id === requestedSessionId ? restored : item);
        return jsonResponse(restored);
      }
      if (segment === "messages" && !action && method === "GET") {
        return jsonResponse(workshopMessages.filter((message) => message.sessionId === requestedSessionId));
      }
      if (segment === "attachments" && !action && method === "GET") {
        return jsonResponse(workshopAttachments.filter((attachment) =>
          attachment.sessionId === requestedSessionId,
        ));
      }
      if (segment === "attachments" && !action && method === "POST") {
        const body = JSON.parse(String(init?.body));
        const created = workshopAttachment({
          id: workshopAttachments.length === 0
            ? workshopAttachmentId
            : `93939393-9393-4393-8393-${String(workshopAttachments.length).padStart(12, "0").slice(0, 12)}`,
          sessionId: requestedSessionId,
          draftToken: body.draftToken,
          fileName: body.fileName,
          mediaType: body.mediaType,
          sizeBytes: body.sizeBytes,
          extractedText: `Parsed text from ${body.fileName}.`,
        });
        workshopAttachments = [...workshopAttachments, created];
        return jsonResponse(created, 201);
      }
      if (segment === "attachments" && action && method === "DELETE") {
        const deletedId = action;
        workshopAttachments = workshopAttachments.filter((attachment) => attachment.id !== deletedId);
        return jsonResponse({ deletedId });
      }
      if (segment === "messages" && !action && method === "POST") {
        const body = JSON.parse(String(init?.body));
        const message = {
          schemaVersion: 1,
          id: "94949494-9494-4494-9494-949494949494",
          seriesId,
          sessionId: requestedSessionId,
          role: body.role ?? "author",
          mode: body.mode ?? "continuity-check",
          status: "succeeded",
          content: body.content,
          reasoningContent: "",
          contextBundleId: null,
          modelCallId: null,
          proposalIds: [],
          attachmentIds: body.attachmentIds ?? [],
          errorCode: null,
          errorMessage: null,
          createdAt: "2026-07-01T00:11:00.000Z",
        };
        workshopMessages = [...workshopMessages, message];
        return jsonResponse(message, 201);
      }
      if (segment === "messages" && action && subaction === "proposals" && method === "POST") {
        const requestedMessageId = action;
        const body = JSON.parse(String(init?.body));
        const sourceMessage = workshopMessages.find((message) => message.id === requestedMessageId);
        if (!sourceMessage) return jsonResponse({ message: "Workshop message does not exist" }, 404);
        const created = proposalDocument("pending", {
          contextBundleId: sourceMessage.contextBundleId as string | null,
          evidence: body.evidence,
          generator: sourceMessage.modelCallId
            ? {
              kind: "ai",
              roleId: "continuity-editor",
              provider: "mock",
              model: "mock-continuity-v1",
              promptTemplateId,
              promptTemplateVersion: 1,
              modelCallLogId: sourceMessage.modelCallId,
            }
            : { kind: "manual", actor: "workshop" },
          id: workshopProposalId,
          patches: body.patches,
          reason: body.reason,
          source: {
            kind: "workshop-message",
            sourceId: sourceMessage.id,
            label: session.title,
            detail: sourceMessage.content,
          },
          summary: body.summary,
          target: body.target,
          title: body.title,
          type: body.type,
        });
        proposals = [created, ...proposals.filter((document) => document.proposal.id !== created.proposal.id)];
        const sourceMessageId = String(sourceMessage.id);
        const updatedMessage = {
          ...sourceMessage,
          proposalIds: Array.from(new Set([...(sourceMessage.proposalIds as string[]), created.proposal.id])),
        } as Record<string, unknown> & { id: string; proposalIds: string[] };
        workshopMessages = workshopMessages.map((message) =>
          message.id === sourceMessageId ? updatedMessage : message,
        );
        return jsonResponse({ message: updatedMessage, proposal: created }, 201);
      }
      if (segment === "messages" && action && subaction === "resend" && method === "POST") {
        const requestedMessageId = action;
        const body = JSON.parse(String(init?.body));
        const sessionMessages = workshopMessages
          .filter((message) => message.sessionId === requestedSessionId)
          .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)));
        const sourceIndex = sessionMessages.findIndex((message) => message.id === requestedMessageId);
        if (sourceIndex < 0) return jsonResponse({ message: "Workshop message does not exist" }, 404);
        const sourceMessage = sessionMessages[sourceIndex]!;
        if (
          session.kind !== "chat" ||
          sourceMessage.role !== "author" ||
          sourceMessage.mode !== "general-chat"
        ) {
          return jsonResponse({ message: "Only General Chat author messages can be resent" }, 422);
        }
        const deletedMessages = sessionMessages.slice(sourceIndex + 1);
        const deletedMessageIds = deletedMessages.map((message) => String(message.id));
        const deletedMessageIdSet = new Set(deletedMessageIds);
        const deletedAttachmentIds = workshopAttachments
          .filter((attachment) =>
            typeof attachment.messageId === "string" &&
            deletedMessageIdSet.has(attachment.messageId),
          )
          .map((attachment) => String(attachment.id));
        const updatedAuthor = {
          ...sourceMessage,
          content: String(body.content ?? sourceMessage.content).trim(),
        };
        const assistantMessage = {
          schemaVersion: 1,
          id: "98989898-9898-4898-9898-989898989898",
          seriesId,
          sessionId: requestedSessionId,
          role: "assistant",
          mode: "general-chat",
          status: "succeeded",
          content: "Workshop model response.",
          reasoningContent: "",
          contextBundleId: workshopContextBundleId,
          modelCallId: workshopModelCallId,
          proposalIds: [],
          attachmentIds: [],
          errorCode: null,
          errorMessage: null,
          createdAt: "2026-07-01T00:15:00.000Z",
        };
        workshopMessages = [
          ...workshopMessages.filter((message) =>
            message.id !== requestedMessageId &&
            !deletedMessageIdSet.has(String(message.id)) &&
            message.id !== assistantMessage.id,
          ),
          updatedAuthor,
          assistantMessage,
        ];
        workshopAttachments = workshopAttachments.filter((attachment) =>
          !deletedAttachmentIds.includes(String(attachment.id)),
        );
        workshopSessions = workshopSessions.map((item) =>
          item.id === requestedSessionId
            ? { ...item, lastMessageAt: assistantMessage.createdAt, updatedAt: assistantMessage.createdAt }
            : item,
        );
        return jsonResponse({
          authorMessage: updatedAuthor,
          assistantMessage,
          toolMessages: [],
          contextBundleId: workshopContextBundleId,
          modelCallId: workshopModelCallId,
          status: "succeeded",
          responseText: "Workshop model response.",
          estimatedUsage: { inputTokens: 12, outputTokens: 0, totalTokens: 12 },
          actualUsage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 },
          deletedAttachmentIds,
          deletedBranchIds: [],
          deletedMessageIds,
        });
      }
      if (segment === "messages" && action && !subaction && method === "DELETE") {
        const requestedMessageId = action;
        const sourceMessage = workshopMessages.find((message) => message.id === requestedMessageId);
        if (!sourceMessage) return jsonResponse({ message: "Workshop message does not exist" }, 404);
        const deletedAttachmentIds = workshopAttachments
          .filter((attachment) => attachment.messageId === requestedMessageId)
          .map((attachment) => String(attachment.id));
        workshopAttachments = workshopAttachments.filter((attachment) =>
          attachment.messageId !== requestedMessageId,
        );
        workshopMessages = workshopMessages.filter((message) => message.id !== requestedMessageId);
        const lastMessage = workshopMessages
          .filter((message) => message.sessionId === requestedSessionId)
          .at(-1) as { createdAt?: string } | undefined;
        const updatedSession = {
          ...session,
          lastMessageAt: lastMessage?.createdAt ?? null,
          updatedAt: "2026-07-01T00:14:00.000Z",
        };
        workshopSessions = workshopSessions.map((item) => item.id === requestedSessionId ? updatedSession : item);
        return jsonResponse({ deletedId: requestedMessageId, deletedAttachmentIds, session: updatedSession });
      }
      if (segment === "branch" && method === "POST") {
        const body = JSON.parse(String(init?.body));
        const sourceMessageId = String(body.sourceMessageId ?? "");
        const sourceMessages = workshopMessages.filter((message) => message.sessionId === requestedSessionId);
        const sourceIndex = sourceMessages.findIndex((message) => message.id === sourceMessageId);
        const clonedSourceMessages = sourceIndex >= 0 ? sourceMessages.slice(0, sourceIndex + 1) : [];
        const branchSession = workshopSession({
          branchOfMessageId: sourceMessageId,
          id: "95959595-9595-4595-9595-959595959595",
          kind: session.kind as "chat" | "agent",
          lastMessageAt: (clonedSourceMessages.at(-1)?.createdAt as string | undefined) ?? null,
          title: body.title ?? `${session.title} branch`,
        });
        workshopSessions = [branchSession, ...workshopSessions];
        const clonedAttachments: Array<Record<string, unknown>> = [];
        const clonedMessages = clonedSourceMessages.map((message, index) => {
          const clonedMessageId = `96969696-9696-4696-8696-${String(index + 1).padStart(12, "0")}`;
          const attachmentIds = (message.attachmentIds as string[] | undefined ?? []).map((attachmentId, attachmentIndex) => {
            const clonedAttachmentId = `97979797-9797-4797-8797-${String((index + 1) * 100 + attachmentIndex).padStart(12, "0")}`;
            const attachment = workshopAttachments.find((item) => item.id === attachmentId);
            if (attachment) {
              clonedAttachments.push({
                ...attachment,
                id: clonedAttachmentId,
                sessionId: branchSession.id,
                messageId: clonedMessageId,
              });
            }
            return clonedAttachmentId;
          });
          return {
            ...message,
            id: clonedMessageId,
            sessionId: branchSession.id,
            contextBundleId: null,
            modelCallId: null,
            proposalIds: [],
            attachmentIds,
          };
        });
        workshopMessages = [...workshopMessages, ...clonedMessages];
        workshopAttachments = [...workshopAttachments, ...clonedAttachments];
        return jsonResponse({
          branch: {
            schemaVersion: 1,
            id: "96969696-9696-4696-9696-969696969696",
            seriesId,
            sourceSessionId: requestedSessionId,
            sourceMessageId,
            sessionId: branchSession.id,
            title: branchSession.title,
            createdAt: "2026-07-01T00:12:00.000Z",
          },
          session: branchSession,
        }, 201);
      }
      if (segment === "context-basket" && !action && method === "GET") {
        return jsonResponse(currentWorkshopBasket);
      }
      if (segment === "context-basket" && !action && method === "PUT") {
        const body = JSON.parse(String(init?.body));
        currentWorkshopBasket = {
          ...currentWorkshopBasket,
          ...body,
          updatedAt: "2026-07-01T00:12:00.000Z",
        };
        return jsonResponse(currentWorkshopBasket);
      }
      if (segment === "context-preview" && method === "POST") {
        const body = JSON.parse(String(init?.body));
        return jsonResponse({
          ...workshopContextBundle(),
          userRequest: body.userRequest,
        });
      }
      if (segment === "calls" && action === "stream" && method === "POST") {
        const body = JSON.parse(String(init?.body));
        const attachmentIds = body.attachmentIds ?? [];
        const authorMessage = {
          schemaVersion: 1,
          id: "97979797-9797-4797-9797-979797979797",
          seriesId,
          sessionId: requestedSessionId,
          role: "author",
          mode: body.mode ?? "general-chat",
          status: "succeeded",
          content: body.userRequest,
          reasoningContent: "",
          contextBundleId: null,
          modelCallId: null,
          proposalIds: [],
          attachmentIds,
          errorCode: null,
          errorMessage: null,
          createdAt: "2026-07-01T00:13:00.000Z",
        };
        const assistantMessage = {
          schemaVersion: 1,
          id: "98989898-9898-4898-9898-989898989898",
          seriesId,
          sessionId: requestedSessionId,
          role: "assistant",
          mode: body.mode ?? "general-chat",
          status: "succeeded",
          content: "Workshop model response.",
          reasoningContent: "Checked the selected context before answering.",
          contextBundleId: workshopContextBundleId,
          modelCallId: workshopModelCallId,
          proposalIds: [],
          attachmentIds: [],
          errorCode: null,
          errorMessage: null,
          createdAt: "2026-07-01T00:13:01.000Z",
        };
        const result = {
          authorMessage,
          assistantMessage,
          toolMessages: [],
          contextBundleId: workshopContextBundleId,
          modelCallId: workshopModelCallId,
          status: "succeeded",
          responseText: "Workshop model response.",
          estimatedUsage: { inputTokens: 12, outputTokens: 0, totalTokens: 12 },
          actualUsage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 },
        };
        const persistStreamResult = () => {
          workshopAttachments = workshopAttachments.map((attachment) =>
            attachmentIds.includes(attachment.id) ? { ...attachment, messageId: authorMessage.id } : attachment,
          );
          workshopMessages = [
            ...workshopMessages.filter((message) => message.sessionId !== requestedSessionId),
            authorMessage,
            assistantMessage,
          ];
        };
        const streamResponse = sseResponse([
          { type: "author-message", message: authorMessage },
          { type: "metadata", contextBundleId: workshopContextBundleId, modelCallId: workshopModelCallId },
          { type: "reasoning-delta", text: "Checked the selected context before answering." },
          { type: "delta", text: "Workshop model response." },
          { type: "assistant-message", message: assistantMessage },
          { type: "done", result },
        ], 200, workshopCallDelayMs, init?.signal);
        if (workshopCallDelayMs > 0) {
          return streamResponse.then((response) => {
            if (!init?.signal?.aborted) persistStreamResult();
            return response;
          });
        }
        persistStreamResult();
        return streamResponse;
      }
      if (segment === "calls" && method === "POST") {
        const body = JSON.parse(String(init?.body));
        const attachmentIds = body.attachmentIds ?? [];
        const authorMessage = {
          schemaVersion: 1,
          id: "97979797-9797-4797-9797-979797979797",
          seriesId,
          sessionId: requestedSessionId,
          role: "author",
          mode: body.mode ?? "continuity-check",
          status: "succeeded",
          content: body.userRequest,
          reasoningContent: "",
          contextBundleId: null,
          modelCallId: null,
          proposalIds: [],
          attachmentIds,
          errorCode: null,
          errorMessage: null,
          createdAt: "2026-07-01T00:13:00.000Z",
        };
        const assistantMessage = {
          schemaVersion: 1,
          id: "98989898-9898-4898-9898-989898989898",
          seriesId,
          sessionId: requestedSessionId,
          role: "assistant",
          mode: body.mode ?? "continuity-check",
          status: "succeeded",
          content: "Workshop model response.",
          reasoningContent: "",
          contextBundleId: workshopContextBundleId,
          modelCallId: workshopModelCallId,
          proposalIds: [],
          attachmentIds: [],
          errorCode: null,
          errorMessage: null,
          createdAt: "2026-07-01T00:13:01.000Z",
        };
        const responseBody = {
          authorMessage,
          assistantMessage,
          toolMessages: [],
          contextBundleId: workshopContextBundleId,
          modelCallId: workshopModelCallId,
          status: "succeeded",
          responseText: "Workshop model response.",
          estimatedUsage: { inputTokens: 12, outputTokens: 0, totalTokens: 12 },
          actualUsage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 },
        };
        if (workshopCallDelayMs > 0) {
          return delayedJsonResponse(responseBody, 200, workshopCallDelayMs, init?.signal).then((response) => {
            if (!init?.signal?.aborted) {
              workshopMessages = [
                ...workshopMessages.filter((message) => message.sessionId !== requestedSessionId),
                authorMessage,
                assistantMessage,
              ];
              workshopAttachments = workshopAttachments.map((attachment) =>
                attachmentIds.includes(attachment.id) ? { ...attachment, messageId: authorMessage.id } : attachment,
              );
            }
            return response;
          });
        }
        workshopAttachments = workshopAttachments.map((attachment) =>
          attachmentIds.includes(attachment.id) ? { ...attachment, messageId: authorMessage.id } : attachment,
        );
        workshopMessages = [
          ...workshopMessages.filter((message) => message.sessionId !== requestedSessionId),
          authorMessage,
          assistantMessage,
        ];
        return jsonResponse(responseBody);
      }
    }

    if (url === `/api/v1/series/${seriesId}/review/proposals` && method === "GET") {
      return jsonResponse({ items: proposals, diagnostics: [] });
    }

    if (url === `/api/v1/series/${seriesId}/review/proposals/batch-preview` && method === "POST") {
      const body = JSON.parse(String(init?.body));
      return jsonResponse({
        items: body.proposalIds.map((id: string) => ({
          eligible: proposals.some((document) => document.proposal.id === id && document.proposal.status === "pending"),
          proposalId: id,
          revision: proposals.find((document) => document.proposal.id === id)?.revision ?? null,
          reason: "",
        })),
      });
    }

    if (url === `/api/v1/series/${seriesId}/review/proposals/batch-accept` && method === "POST") {
      const body = JSON.parse(String(init?.body));
      const completed = body.items
        .filter((item: { proposalId: string; baseRevision: string }) =>
          proposals.some((document) =>
            document.proposal.id === item.proposalId &&
            document.proposal.status === "pending" &&
            document.revision === item.baseRevision,
          ),
        )
        .map((item: { proposalId: string }) => {
          const current = proposals.find((document) => document.proposal.id === item.proposalId)!;
          const updated = proposalDocumentWithStatus(current, "accepted");
          proposals = proposals.map((document) => document.proposal.id === item.proposalId ? updated : document);
          return { proposal: updated, snapshot: { schemaVersion: 1, id: snapshotId, seriesId, proposalId: item.proposalId, target: updated.proposal.target, createdAt: "2026-06-24T00:00:00.000Z", targetRevision: revision, data: {} } };
        });
      return jsonResponse({ completed, skipped: [], blocked: [], failed: [] });
    }

    const proposalMatch = url.match(new RegExp(`^/api/v1/series/${seriesId}/review/proposals/([^/]+)(?:/([^/]+))?$`));
    if (proposalMatch) {
      const [, requestedProposalId, action] = proposalMatch;
      const current = proposals.find((document) => document.proposal.id === requestedProposalId);
      if (!current) return jsonResponse({ message: "Proposal does not exist" }, 404);
      if (!action && method === "GET") return jsonResponse(current);
      if (action === "accept" && method === "POST") {
        const updated = proposalDocumentWithStatus(current, "accepted");
        proposals = proposals.map((document) => document.proposal.id === requestedProposalId ? updated : document);
        return jsonResponse({
          proposal: updated,
          snapshot: {
            schemaVersion: 1,
            id: snapshotId,
            seriesId,
            proposalId: requestedProposalId,
            target: updated.proposal.target,
            createdAt: "2026-06-24T00:00:00.000Z",
            targetRevision: revision,
            data: {},
          },
        });
      }
      if (action === "edit-and-accept" && method === "POST") {
        const updated = proposalDocumentWithStatus(current, "accepted");
        proposals = proposals.map((document) => document.proposal.id === requestedProposalId ? updated : document);
        return jsonResponse({
          proposal: updated,
          snapshot: {
            schemaVersion: 1,
            id: snapshotId,
            seriesId,
            proposalId: requestedProposalId,
            target: updated.proposal.target,
            createdAt: "2026-06-24T00:00:00.000Z",
            targetRevision: revision,
            data: {},
          },
        });
      }
      if (action === "reject" && method === "POST") {
        const updated = proposalDocumentWithStatus(current, "rejected");
        proposals = proposals.map((document) => document.proposal.id === requestedProposalId ? updated : document);
        return jsonResponse(updated);
      }
      if ((action === "mark-stale" || action === "stale") && method === "POST") {
        const updated = proposalDocumentWithStatus(current, "stale");
        proposals = proposals.map((document) => document.proposal.id === requestedProposalId ? updated : document);
        return jsonResponse(updated);
      }
    }

    if (url === `/api/v1/series/${seriesId}/codex/categories` && method === "GET") {
      return jsonResponse(codexCategoryDocs);
    }

    if (url === `/api/v1/series/${seriesId}/codex/categories` && method === "POST") {
      const body = JSON.parse(String(init?.body));
      const category = {
        category: {
          archivedAt: null as string | null,
          builtIn: false,
          icon: "*",
          id: customCategoryId,
          name: body.name,
        },
        revision: updatedRevision,
      };
      codexCategoryDocs = [...codexCategoryDocs, category];
      return jsonResponse(category, 201);
    }

    if (url === `/api/v1/series/${seriesId}/codex/categories/${customCategoryId}` && method === "PUT") {
      const body = JSON.parse(String(init?.body));
      const current = codexCategoryDocs.find((document) => document.category.id === customCategoryId);
      const updated = {
        category: {
          ...(current?.category ?? {
            archivedAt: null as string | null,
            builtIn: false,
            icon: "*",
            id: customCategoryId,
            name: "Mechanism",
          }),
          name: body.name,
        },
        revision: updatedRevision,
      };
      codexCategoryDocs = codexCategoryDocs.map((document) => (
        document.category.id === customCategoryId ? updated : document
      ));
      return jsonResponse(updated);
    }

    if (url === `/api/v1/series/${seriesId}/codex/categories/${customCategoryId}` && method === "DELETE") {
      codexCategoryDocs = codexCategoryDocs.filter((document) => document.category.id !== customCategoryId);
      codexEntries = codexEntries.map((entry) => (
        entry.metadata.categoryId === customCategoryId
          ? {
              ...entry,
              metadata: {
                ...entry.metadata,
                categoryId: "uncategorized",
                updatedAt: "2026-06-24T00:00:00.000Z",
              },
              relativePath: codexEntryRelativePath("uncategorized", entry.metadata.id),
              revision: updatedRevision,
            }
          : entry
      ));
      return jsonResponse({
        deletedId: customCategoryId,
        movedEntryIds: codexEntries
          .filter((entry) => entry.metadata.categoryId === "uncategorized")
          .map((entry) => entry.metadata.id),
      });
    }

    if (url.startsWith(`/api/v1/series/${seriesId}/codex/detail-types`) && method === "GET") {
      const parsedUrl = new URL(url, "http://localhost");
      const categoryId = parsedUrl.searchParams.get("categoryId");
      return jsonResponse(codexDetailTypes.filter((document) =>
        !categoryId || document.detailType.categoryId === categoryId,
      ));
    }

    if (url === `/api/v1/series/${seriesId}/codex/detail-types` && method === "POST") {
      const body = JSON.parse(String(init?.body));
      const id = codexDetailTypes.length === 0 ? detailTypeId : secondDetailTypeId;
      const detailType = codexDetailTypeDocument(body.name, body.categoryId, id, body.nsfw ?? false);
      codexDetailTypes = [...codexDetailTypes, detailType];
      return jsonResponse(detailType, 201);
    }

    const detailTypeDeleteMatch = url.match(new RegExp(`^/api/v1/series/${seriesId}/codex/detail-types/([^/]+)$`));
    if (detailTypeDeleteMatch && method === "PUT") {
      const detailTypeIdFromUrl = detailTypeDeleteMatch[1];
      const body = JSON.parse(String(init?.body));
      const current = codexDetailTypes.find((document) => document.detailType.id === detailTypeIdFromUrl);
      if (!current) return jsonResponse({ message: "Not found" }, 404);
      const updated = {
        ...current,
        detailType: {
          ...current.detailType,
          nsfw: body.nsfw,
          updatedAt: "2026-06-24T00:00:00.000Z",
        },
        revision: updatedRevision,
      };
      codexDetailTypes = codexDetailTypes.map((document) =>
        document.detailType.id === detailTypeIdFromUrl ? updated : document,
      );
      return jsonResponse(updated);
    }
    if (detailTypeDeleteMatch && method === "DELETE") {
      const deletedId = detailTypeDeleteMatch[1];
      codexDetailTypes = codexDetailTypes.filter((document) => document.detailType.id !== deletedId);
      return jsonResponse({ deletedId });
    }

    if (url === `/api/v1/series/${seriesId}/codex/scenes/${sceneId}/mentions` && method === "GET") {
      return jsonResponse({
        ambiguities: [],
        mentions: [
          {
            end: 11,
            entryId: codexEntryId,
            isAlias: false,
            matchedText: "Harbor Lock",
            sceneId,
            start: 0,
            term: "Harbor Lock",
          },
        ],
        sceneId,
      });
    }

    if (url.startsWith(`/api/v1/series/${seriesId}/codex/context`) && method === "GET") {
      return jsonResponse({
        excluded: [
          {
            entryId: modelProfileId,
            name: "Hidden Door",
            reason: "never",
          },
        ],
        included: [
          codexEntryDocument("Harbor Lock", "location", "A storm-pressure mechanism below the west quay."),
        ],
        sceneId,
      });
    }

    if (url.startsWith(`/api/v1/series/${seriesId}/codex/relations`) && method === "GET") {
      const parsedUrl = new URL(url, "http://localhost");
      const entryId = parsedUrl.searchParams.get("entryId");
      const includeArchived = parsedUrl.searchParams.get("includeArchived") === "true";
      return jsonResponse(codexRelations.filter((document) => {
        if (!includeArchived && document.relation.archivedAt) return false;
        if (!entryId) return true;
        return document.relation.sourceEntryId === entryId || document.relation.targetEntryId === entryId;
      }));
    }

    if (url === `/api/v1/series/${seriesId}/codex/relations` && method === "POST") {
      const body = JSON.parse(String(init?.body));
      const relation = codexRelationDocument(
        body.sourceEntryId,
        body.targetEntryId,
        body.description,
        createdRelationId,
        body.type,
        body.directed,
        body.evidence,
      );
      codexRelations = [...codexRelations, relation];
      return jsonResponse(relation, 201);
    }

    const archiveRelationMatch = url.match(new RegExp(`^/api/v1/series/${seriesId}/codex/relations/([^/]+)/archive$`));
    if (archiveRelationMatch && method === "POST") {
      const archivedRelationId = archiveRelationMatch[1];
      const current = codexRelations.find((document) => document.relation.id === archivedRelationId);
      if (!current) return jsonResponse({ message: "Relation not found" }, 404);
      const archived = {
        ...current,
        relation: {
          ...current.relation,
          archivedAt: "2026-06-24T00:00:00.000Z",
          updatedAt: "2026-06-24T00:00:00.000Z",
        },
        revision: updatedRevision,
      };
      codexRelations = codexRelations.map((document) => (
        document.relation.id === archivedRelationId ? archived : document
      ));
      return jsonResponse(archived);
    }

    const entryMentionMatch = url.match(new RegExp(`^/api/v1/series/${seriesId}/codex/entries/([^/]+)/mentions$`));
    if (entryMentionMatch && method === "GET") {
      const entryId = entryMentionMatch[1];
      return jsonResponse(entryId === codexEntryId
        ? [
            {
              end: 11,
              entryId: codexEntryId,
              isAlias: false,
              matchedText: "Harbor Lock",
              sceneId,
              start: 0,
              term: "Harbor Lock",
            },
          ]
        : []);
    }

    const effectiveEntryMatch = url.match(new RegExp(`^/api/v1/series/${seriesId}/codex/entries/([^/]+)/effective`));
    if (effectiveEntryMatch && method === "GET") {
      const entryId = effectiveEntryMatch[1];
      const parsedUrl = new URL(url, "http://localhost");
      const targetBlockId = parsedUrl.searchParams.get("blockId");
      const targetSceneId = parsedUrl.searchParams.get("sceneId") ?? sceneId;
      const detail = detailOverride ?? seriesDetail();
      const scene = detail.scenes.find((candidate) => candidate.metadata.id === targetSceneId) ?? sceneDocument();
      const targetSceneIndex = detail.scenes.findIndex((candidate) => candidate.metadata.id === targetSceneId);
      const targetIndex = targetBlockId
        ? scene.document.blocks.findIndex((block) => block.id === targetBlockId)
        : Number.MAX_SAFE_INTEGER;
      const entry = codexEntries.find((candidate) => candidate.metadata.id === entryId) ??
        codexEntryDocument("Harbor Lock", "location", "Baseline lock state.", entryId);
      let description = entry.description;
      let lastProgressionId: string | null = null;
      let hiddenFutureFieldProgressionCount = 0;
      for (const progression of codexProgressions.filter((document) => (
        document.progression.entryId === entryId &&
        document.progression.kind === "field"
      ))) {
        const progressionSceneIndex = detail.scenes.findIndex((candidate) =>
          candidate.metadata.id === progression.progression.effectiveFromSceneId,
        );
        const progressionScene = detail.scenes[progressionSceneIndex];
        const progressionBlockIndex = progression.progression.source.kind === "write-block" && progressionScene
          ? progressionScene.document.blocks.findIndex((block) => block.id === progression.progression.source.blockId)
          : -1;
        const isFuture = progressionSceneIndex > targetSceneIndex ||
          (progressionSceneIndex === targetSceneIndex && progressionBlockIndex > targetIndex);
        if (!isFuture) {
          description = progression.progression.operation === "replace"
            ? progression.progression.body
            : `${progression.progression.body}\n\n${description}`.trim();
          lastProgressionId = progression.progression.id;
        } else {
          hiddenFutureFieldProgressionCount += 1;
        }
      }
      return jsonResponse({
        blockId: targetBlockId,
        entry: { ...entry, description },
        fieldStates: [{
          field: { kind: "description", detailTypeId: null },
          hiddenFutureCount: hiddenFutureFieldProgressionCount,
          lastProgressionId,
          source: lastProgressionId ? "progression" : "baseline",
        }],
        hiddenFutureFieldProgressionCount,
        sceneId: targetSceneId,
      });
    }

    if (url.startsWith(`/api/v1/series/${seriesId}/codex/progressions`) && method === "GET") {
      const parsedUrl = new URL(url, "http://localhost");
      const entryIdFilter = parsedUrl.searchParams.get("entryId");
      const sceneIdFilter = parsedUrl.searchParams.get("sceneId");
      const kindFilter = parsedUrl.searchParams.get("kind");
      return jsonResponse(codexProgressions.filter((document) => {
        if (kindFilter && document.progression.kind !== kindFilter) return false;
        if (entryIdFilter && document.progression.entryId !== entryIdFilter) return false;
        if (sceneIdFilter && document.progression.effectiveFromSceneId !== sceneIdFilter) return false;
        return true;
      }));
    }

    if (url === `/api/v1/series/${seriesId}/codex/progressions` && method === "POST") {
      const body = JSON.parse(String(init?.body));
      const progression = {
        ...codexProgressionDocument(body.source.blockId, progressionId, {
          body: body.body,
          entryId: body.entryId,
          operation: body.operation,
          summary: body.summary,
        }),
        progression: {
          ...codexProgressionDocument(body.source.blockId, progressionId).progression,
          ...body,
          id: progressionId,
          createdAt: "2026-06-24T00:00:00.000Z",
          updatedAt: "2026-06-24T00:00:00.000Z",
          archivedAt: null,
          schemaVersion: 1,
        },
      };
      codexProgressions = [...codexProgressions, progression];
      return jsonResponse(progression, 201);
    }

    const progressionMatch = url.match(new RegExp(`^/api/v1/series/${seriesId}/codex/progressions/([^/]+)$`));
    if (progressionMatch && method === "PUT") {
      const id = progressionMatch[1];
      const body = JSON.parse(String(init?.body));
      const current = codexProgressions.find((document) => document.progression.id === id);
      if (!current) return jsonResponse({ message: "Progression not found" }, 404);
      const updated = {
        ...current,
        progression: {
          ...current.progression,
          ...body,
          updatedAt: "2026-06-24T00:00:00.000Z",
        },
        revision: updatedRevision,
      };
      codexProgressions = codexProgressions.map((document) => (
        document.progression.id === id ? updated : document
      ));
      return jsonResponse(updated);
    }
    if (progressionMatch && method === "DELETE") {
      const id = progressionMatch[1];
      codexProgressions = codexProgressions.filter((document) => document.progression.id !== id);
      return jsonResponse({ deletedId: id, blockers: [] });
    }

    if (url.startsWith(`/api/v1/series/${seriesId}/codex/entries`) && method === "GET" && !url.includes(`/${codexEntryId}`)) {
      const includeArchived = url.includes("includeArchived=true");
      return jsonResponse(codexEntries.filter((entry) => includeArchived || !entry.metadata.archivedAt));
    }

    if (url === `/api/v1/series/${seriesId}/codex/entries` && method === "POST") {
      const body = JSON.parse(String(init?.body));
      const entry = codexEntryDocument(body.name, body.categoryId ?? "character");
      codexEntries = [...codexEntries, entry];
      return jsonResponse(entry, 201);
    }

    if (url === `/api/v1/series/${seriesId}/codex/entries/${codexEntryId}` && method === "GET") {
      return jsonResponse(codexEntries.find((entry) => entry.metadata.id === codexEntryId) ?? codexEntryDocument("Disk Entry"));
    }

    if (url === `/api/v1/series/${seriesId}/codex/entries/${codexEntryId}` && method === "PUT") {
      if (conflictCodexUpdate) {
        conflictCodexUpdate = false;
        const diskEntry = codexEntryDocument("Disk Entry");
        codexEntries = [diskEntry];
        return jsonResponse({ message: "Codex entry changed on disk", entry: diskEntry }, 409);
      }
      const body = JSON.parse(String(init?.body));
      const current = codexEntries.find((entry) => entry.metadata.id === codexEntryId) ?? codexEntryDocument();
      const nextCategoryId = body.categoryId ?? current.metadata.categoryId;
      const updated = {
        ...current,
        description: body.description ?? current.description,
        metadata: {
          ...current.metadata,
          aiContextPolicy: body.aiContextPolicy ?? current.metadata.aiContextPolicy,
          aliases: body.aliases ?? current.metadata.aliases,
          categoryId: nextCategoryId,
          details: body.details ?? current.metadata.details,
          detailAiContext: body.detailAiContext ?? current.metadata.detailAiContext,
          mention: body.mention ?? current.metadata.mention,
          name: body.name ?? current.metadata.name,
          updatedAt: "2026-06-24T00:00:00.000Z",
        },
        relativePath: codexEntryRelativePath(nextCategoryId, current.metadata.id),
        research: body.research === undefined
          ? current.research
          : {
              ...current.research,
              content: body.research,
              metadata: { ...current.research.metadata, updatedAt: "2026-06-24T00:00:00.000Z" },
              revision: updatedRevision,
            },
        revision: updatedRevision,
      };
      codexEntries = codexEntries.some((entry) => entry.metadata.id === codexEntryId)
        ? codexEntries.map((entry) => (entry.metadata.id === codexEntryId ? updated : entry))
        : [updated];
      return delayedJsonResponse(updated, 200, options.codexUpdateDelayMs);
    }

    if (url === `/api/v1/series/${seriesId}/codex/entries/${codexEntryId}/archive` && method === "POST") {
      const current = codexEntries.find((entry) => entry.metadata.id === codexEntryId) ?? codexEntryDocument();
      const archived = {
        ...current,
        metadata: {
          ...current.metadata,
          archivedAt: "2026-06-24T00:00:00.000Z",
          updatedAt: "2026-06-24T00:00:00.000Z",
        },
        revision: updatedRevision,
      };
      codexEntries = codexEntries.some((entry) => entry.metadata.id === codexEntryId)
        ? codexEntries.map((entry) => (entry.metadata.id === codexEntryId ? archived : entry))
        : [archived];
      return jsonResponse(archived);
    }

    if (url === `/api/v1/series/${seriesId}/codex/entries/${codexEntryId}/restore` && method === "POST") {
      const current = codexEntries.find((entry) => entry.metadata.id === codexEntryId) ?? codexEntryDocument();
      const restored = {
        ...current,
        metadata: {
          ...current.metadata,
          archivedAt: null,
          updatedAt: "2026-06-24T00:00:00.000Z",
        },
        revision,
      };
      codexEntries = codexEntries.some((entry) => entry.metadata.id === codexEntryId)
        ? codexEntries.map((entry) => (entry.metadata.id === codexEntryId ? restored : entry))
        : [restored];
      return jsonResponse(restored);
    }

    if (url === `/api/v1/series/${seriesId}/codex/entries/${codexEntryId}` && method === "DELETE") {
      codexEntries = codexEntries.filter((entry) => entry.metadata.id !== codexEntryId);
      return jsonResponse({ deletedId: codexEntryId });
    }

    if (url === `/api/v1/series/${seriesId}/ai/roles` && method === "GET") {
      return jsonResponse([{
        schemaVersion: 1,
        id: "continuity-editor",
        title: "Continuity editor",
        description: "Checks continuity.",
        persona: "",
        duties: [],
        nonDuties: [],
        challengeObligation: "",
        forbiddenActions: [],
        outputContract: "",
        readScopes: { scenes: true, codex: true, research: true, futureScenes: false },
        builtIn: true,
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z",
        archivedAt: null,
      }]);
    }

    if (url === `/api/v1/series/${seriesId}/ai/prompts` && method === "GET") {
      return jsonResponse([
        promptTemplate(),
        promptTemplate({
          id: "00000000-0000-4000-8000-000000000401",
          roleId: "lead-writing-partner",
          name: "General chat",
          description: "Talk through writing options.",
          system: "You are a writing partner.",
          instructions: "Answer directly.",
          outputSchemaName: "chat_response",
        }),
        promptTemplate({
          id: "00000000-0000-4000-8000-000000000411",
          roleId: "researcher",
          name: "Research and Codex",
          description: "Draft Codex material.",
          system: "You are a Codex researcher.",
          instructions: "Draft Codex entries and evidence notes.",
          outputSchemaName: "research_notes",
        }),
      ]);
    }

    if (url === "/api/v1/ai/model-profiles" && method === "GET") {
      return jsonResponse(modelProfiles);
    }

    if (url === "/api/v1/ai/model-profiles" && method === "POST") {
      const body = JSON.parse(String(init?.body));
      const nextId = modelProfiles.some((profile) => profile.id === modelProfileId)
        ? secondModelProfileId
        : modelProfileId;
      const profile = modelProfile({
        id: nextId,
        baseUrl: body.baseUrl,
        capabilities: body.capabilities,
        contextWindowTokens: body.contextWindowTokens,
        model: body.model,
        provider: body.provider,
        title: body.title,
      });
      modelProfiles = [profile, ...modelProfiles];
      return jsonResponse(profile, 201);
    }

    const modelProfileMatch = url.match(/^\/api\/v1\/ai\/model-profiles\/([^/]+)$/u);
    if (modelProfileMatch && method === "PUT") {
      const requestedProfileId = modelProfileMatch[1]!;
      const body = JSON.parse(String(init?.body));
      const current = modelProfiles.find((profile) => profile.id === requestedProfileId) ?? modelProfile({ id: requestedProfileId });
      const updated = modelProfile({ ...current, ...body, id: requestedProfileId });
      modelProfiles = modelProfiles.map((profile) => (profile.id === requestedProfileId ? updated : profile));
      return jsonResponse(updated);
    }

    if (modelProfileMatch && method === "DELETE") {
      const requestedProfileId = modelProfileMatch[1]!;
      const current = modelProfiles.find((profile) => profile.id === requestedProfileId) ?? modelProfile({ id: requestedProfileId });
      const archived = modelProfile({
        ...current,
        archivedAt: "2026-06-25T00:00:00.000Z",
        credentialRef: null,
      });
      modelProfiles = modelProfiles.filter((profile) => profile.id !== requestedProfileId);
      return jsonResponse(archived);
    }

    const modelCredentialMatch = url.match(/^\/api\/v1\/ai\/model-profiles\/([^/]+)\/credential$/u);
    if (modelCredentialMatch && method === "POST") {
      const requestedProfileId = modelCredentialMatch[1]!;
      const current = modelProfiles.find((profile) => profile.id === requestedProfileId) ?? modelProfile({ id: requestedProfileId });
      const updated = modelProfile({
        ...current,
        credentialRef: `novel-studio/model-profile/${requestedProfileId}`,
      });
      modelProfiles = modelProfiles.map((profile) => (profile.id === requestedProfileId ? updated : profile));
      return jsonResponse({
        credentialRef: updated.credentialRef,
        modelProfile: updated,
        storeKind: "windows-credential-manager",
      });
    }

    if (modelCredentialMatch && method === "GET") {
      const requestedProfileId = modelCredentialMatch[1]!;
      const current = modelProfiles.find((profile) => profile.id === requestedProfileId) ?? modelProfile({ id: requestedProfileId });
      return jsonResponse({
        credentialRef: current.credentialRef,
        exists: Boolean(current.credentialRef),
        modelProfile: current,
        storeKind: "windows-credential-manager",
      });
    }

    if (modelCredentialMatch && method === "DELETE") {
      const requestedProfileId = modelCredentialMatch[1]!;
      const current = modelProfiles.find((profile) => profile.id === requestedProfileId) ?? modelProfile({ id: requestedProfileId });
      const updated = modelProfile({ ...current, credentialRef: null });
      modelProfiles = modelProfiles.map((profile) => (profile.id === requestedProfileId ? updated : profile));
      return jsonResponse({
        deleted: Boolean(current.credentialRef),
        modelProfile: updated,
        storeKind: "windows-credential-manager",
      });
    }

    const modelTestMatch = url.match(/^\/api\/v1\/ai\/model-profiles\/([^/]+)\/test$/u);
    if (modelTestMatch && method === "POST") {
      const requestedProfileId = modelTestMatch[1]!;
      const profile = modelProfiles.find((candidate) => candidate.id === requestedProfileId) ?? modelProfile({ id: requestedProfileId });
      return jsonResponse({
        capabilities: profile.capabilities,
        error: null,
        modelProfileId: requestedProfileId,
        models: [
          {
            capabilities: profile.capabilities,
            contextWindowTokens: profile.contextWindowTokens,
            id: profile.model,
            title: profile.model,
          },
        ],
        ok: true,
        provider: profile.provider,
      });
    }

    const modelListMatch = url.match(/^\/api\/v1\/ai\/model-profiles\/([^/]+)\/models$/u);
    if (modelListMatch && method === "GET") {
      const requestedProfileId = modelListMatch[1]!;
      const profile = modelProfiles.find((candidate) => candidate.id === requestedProfileId) ?? modelProfile({ id: requestedProfileId });
      if (options.providerModelCount && options.providerModelCount > 2) {
        return jsonResponse(Array.from({ length: options.providerModelCount }, (_unused, index) => ({
          capabilities: profile.capabilities,
          contextWindowTokens: 128000 + index,
          id: `provider-model-${index + 1}`,
          title: `Provider Model ${index + 1}`,
        })));
      }
      return jsonResponse([
        {
          capabilities: profile.capabilities,
          contextWindowTokens: profile.contextWindowTokens,
          id: profile.model,
          title: profile.model,
        },
        {
          capabilities: {
            ...profile.capabilities,
            structuredOutput: true,
          },
          contextWindowTokens: 128000,
          id: "fetched-long-context-model",
          title: "Fetched Long Context",
        },
      ]);
    }

    const sceneDocumentMatch = url.match(new RegExp(`^/api/v1/series/${seriesId}/scenes/([^/]+)/document$`));
    if (sceneDocumentMatch && method === "GET") {
      const requestedSceneId = sceneDocumentMatch[1]!;
      const current = (detailOverride ?? seriesDetail()).scenes.find((scene) => scene.metadata.id === requestedSceneId) ??
        sceneDocument();
      return jsonResponse(current);
    }

    if (sceneDocumentMatch && method === "PUT") {
      const requestedSceneId = sceneDocumentMatch[1]!;
      const body = JSON.parse(String(init?.body));
      const current = detailOverride ?? seriesDetail();
      const existing = current.scenes.find((scene) => scene.metadata.id === requestedSceneId) ?? sceneDocument();
      const scene = sceneDocumentWithMetadata({
        ...existing.metadata,
        status: body.status ?? existing.metadata.status,
        title: body.title ?? existing.metadata.title,
      }, "", updatedRevision, body.document);
      detailOverride = {
        ...current,
        scenes: current.scenes.map((candidate) => (
          candidate.metadata.id === scene.metadata.id ? scene : candidate
        )),
      };
      return jsonResponse(scene);
    }

    const progressionBlockCreateMatch = url.match(new RegExp(`^/api/v1/series/${seriesId}/scenes/([^/]+)/progression-blocks$`));
    if (progressionBlockCreateMatch && method === "POST") {
      const requestedSceneId = progressionBlockCreateMatch[1]!;
      const body = JSON.parse(String(init?.body));
      const current = detailOverride ?? seriesDetail();
      const existing = current.scenes.find((scene) => scene.metadata.id === requestedSceneId) ?? sceneDocument();
      const blockId = existing.document.blocks.some((block) => block.id === secondBlockId)
        ? thirdBlockId
        : secondBlockId;
      const block = {
        createdAt: "2026-06-24T00:00:00.000Z",
        id: blockId,
        kind: "codexProgression" as const,
        progressionId,
        updatedAt: "2026-06-24T00:00:00.000Z",
      };
      const targetIndex = body.afterBlockId
        ? existing.document.blocks.findIndex((candidate) => candidate.id === body.afterBlockId)
        : -1;
      const insertIndex = targetIndex >= 0 ? targetIndex + 1 : existing.document.blocks.length;
      const scene = sceneDocumentWithMetadata(existing.metadata, "", updatedRevision, {
        schemaVersion: 1,
        blocks: [
          ...existing.document.blocks.slice(0, insertIndex),
          block,
          ...existing.document.blocks.slice(insertIndex),
        ],
      });
      const progression = {
        ...codexProgressionDocument(blockId, progressionId, {
          body: body.progression.body,
          entryId: body.progression.entryId,
          operation: body.progression.operation,
          sceneId: requestedSceneId,
          summary: body.progression.summary,
        }),
        progression: {
          ...codexProgressionDocument(blockId, progressionId, { sceneId: requestedSceneId }).progression,
          ...body.progression,
          id: progressionId,
          effectiveFromSceneId: requestedSceneId,
          source: {
            kind: "write-block" as const,
            sceneId: requestedSceneId,
            blockId,
          },
          createdAt: "2026-06-24T00:00:00.000Z",
          updatedAt: "2026-06-24T00:00:00.000Z",
          archivedAt: null as string | null,
          schemaVersion: 1 as const,
        },
        revision: updatedRevision,
      };
      detailOverride = {
        ...current,
        scenes: current.scenes.map((candidate) => (
          candidate.metadata.id === scene.metadata.id ? scene : candidate
        )),
      };
      codexProgressions = [
        ...codexProgressions.filter((document) => document.progression.id !== progression.progression.id),
        progression,
      ];
      return jsonResponse({ block, progression, scene }, 201);
    }

    const progressionBlockDeleteMatch = url.match(new RegExp(`^/api/v1/series/${seriesId}/scenes/([^/]+)/progression-blocks/([^/]+)$`));
    if (progressionBlockDeleteMatch && method === "DELETE") {
      const requestedSceneId = progressionBlockDeleteMatch[1]!;
      const blockId = progressionBlockDeleteMatch[2]!;
      const current = detailOverride ?? seriesDetail();
      const existing = current.scenes.find((scene) => scene.metadata.id === requestedSceneId) ?? sceneDocument();
      const block = existing.document.blocks.find((candidate) => candidate.id === blockId);
      if (!block || block.kind !== "codexProgression") return jsonResponse({ message: "Missing block" }, 422);
      const scene = sceneDocumentWithMetadata(existing.metadata, "", updatedRevision, {
        schemaVersion: 1,
        blocks: existing.document.blocks.filter((candidate) => candidate.id !== blockId),
      });
      detailOverride = {
        ...current,
        scenes: current.scenes.map((candidate) => (
          candidate.metadata.id === scene.metadata.id ? scene : candidate
        )),
      };
      codexProgressions = codexProgressions.filter((document) => document.progression.id !== block.progressionId);
      return jsonResponse({
        blockId,
        blockers: [],
        deletedId: block.progressionId,
        scene,
      });
    }

    if (url === `/api/v1/series/${seriesId}/scenes/${sceneId}` && method === "PUT") {
      const body = JSON.parse(String(init?.body));
      return jsonResponse(sceneDocument(body.content, updatedRevision));
    }

    if (url === `/api/v1/series/${seriesId}/scenes` && method === "POST") {
      const body = JSON.parse(String(init?.body));
      const current = detailOverride ?? seriesDetailWithNewChapter();
      const scene = sceneDocumentWithMetadata({
        actId: body.actId ?? actId,
        bookId: body.bookId ?? bookId,
        chapterId: body.chapterId ?? chapterId,
        id: secondSceneId,
        order: current.scenes.filter((candidate) => candidate.metadata.chapterId === (body.chapterId ?? chapterId)).length + 1,
        title: body.title,
      }, body.content ?? "", updatedRevision);
      detailOverride = {
        ...current,
        chapters: current.chapters.map((chapter) => (
          chapter.id === scene.metadata.chapterId
            ? { ...chapter, sceneIds: [...chapter.sceneIds, scene.metadata.id] }
            : chapter
        )),
        scenes: [...current.scenes, scene],
      };
      return jsonResponse(scene, 201);
    }

    if (url === `/api/v1/series/${seriesId}/scenes/${sceneId}` && method === "DELETE") {
      const current = detailOverride ?? seriesDetail();
      detailOverride = {
        ...current,
        chapters: current.chapters.map((chapter) => ({
          ...chapter,
          sceneIds: chapter.sceneIds.filter((id) => id !== sceneId),
        })),
        scenes: current.scenes.filter((scene) => scene.metadata.id !== sceneId),
      };
      return jsonResponse({ deletedId: sceneId });
    }

    if (url === `/api/v1/series/${seriesId}/books` && method === "POST") {
      const body = JSON.parse(String(init?.body));
      detailOverride = seriesDetailWithNewBook(body.title);
      return jsonResponse(detailOverride.books.find((book) => book.id === newBookId), 201);
    }

    if (url === `/api/v1/series/${seriesId}/books/${newBookId}` && method === "DELETE") {
      const current = detailOverride ?? seriesDetailWithNewBook();
      detailOverride = {
        ...current,
        books: current.books.filter((book) => book.id !== newBookId),
        manifest: { ...current.manifest, bookIds: current.manifest.bookIds.filter((id) => id !== newBookId) },
      };
      return jsonResponse({ deletedActIds: [], deletedChapterIds: [], deletedId: newBookId, deletedSceneIds: [] });
    }

    if (url === `/api/v1/series/${seriesId}/books/${bookId}` && method === "PUT") {
      const body = JSON.parse(String(init?.body));
      const current = detailOverride ?? seriesDetail();
      detailOverride = {
        ...current,
        books: current.books.map((book) => (book.id === bookId ? { ...book, title: body.title } : book)),
      };
      return jsonResponse(detailOverride.books.find((book) => book.id === bookId));
    }

    if (url === `/api/v1/series/${seriesId}/books/${bookId}/acts` && method === "POST") {
      const body = JSON.parse(String(init?.body));
      detailOverride = seriesDetailWithNewAct(body.title);
      return jsonResponse(detailOverride.acts.find((act) => act.id === newActId), 201);
    }

    if (url === `/api/v1/series/${seriesId}/books/${newBookId}/acts` && method === "POST") {
      const body = JSON.parse(String(init?.body));
      const current = detailOverride ?? seriesDetailWithNewBook();
      const createdAct = {
        bookId: newBookId,
        chapterIds: [],
        createdAt: "2026-06-23T00:00:00.000Z",
        id: newActId,
        order: current.acts.filter((act) => act.bookId === newBookId).length + 1,
        schemaVersion: 1 as const,
        title: body.title,
        updatedAt: "2026-06-23T00:00:00.000Z",
      };
      detailOverride = {
        ...current,
        acts: [...current.acts, createdAct],
        books: current.books.map((book) => (
          book.id === newBookId ? { ...book, actIds: [...book.actIds, createdAct.id] } : book
        )),
      };
      return jsonResponse(createdAct, 201);
    }

    if (url === `/api/v1/series/${seriesId}/acts/${newActId}` && method === "PUT") {
      const body = JSON.parse(String(init?.body));
      const current = detailOverride ?? seriesDetailWithNewAct();
      detailOverride = {
        ...current,
        acts: current.acts.map((act) => (act.id === newActId ? { ...act, title: body.title } : act)),
      };
      return jsonResponse(detailOverride.acts.find((act) => act.id === newActId));
    }

    if (url === `/api/v1/series/${seriesId}/acts/${newActId}` && method === "DELETE") {
      const current = detailOverride ?? seriesDetailWithNewAct();
      const deletedAct = current.acts.find((act) => act.id === newActId);
      const deletedChapterIds = deletedAct?.chapterIds ?? [];
      const deletedSceneIds = current.scenes
        .filter((scene) => deletedChapterIds.includes(scene.metadata.chapterId))
        .map((scene) => scene.metadata.id);
      detailOverride = {
        ...current,
        acts: current.acts.filter((act) => act.id !== newActId),
        books: current.books.map((book) => ({
          ...book,
          actIds: book.actIds.filter((id) => id !== newActId),
        })),
        chapters: current.chapters.filter((chapter) => !deletedChapterIds.includes(chapter.id)),
        scenes: current.scenes.filter((scene) => !deletedSceneIds.includes(scene.metadata.id)),
      };
      return jsonResponse({ deletedChapterIds, deletedId: newActId, deletedSceneIds });
    }

    if (url === `/api/v1/series/${seriesId}/acts/${newActId}/chapters` && method === "POST") {
      const body = JSON.parse(String(init?.body));
      const actTitle = detailOverride?.acts.find((act) => act.id === newActId)?.title;
      detailOverride = seriesDetailWithNewChapter(actTitle, body.title);
      return jsonResponse(detailOverride.chapters.find((chapter) => chapter.id === newChapterId), 201);
    }

    if (url === `/api/v1/series/${seriesId}/chapters/${newChapterId}` && method === "PUT") {
      const body = JSON.parse(String(init?.body));
      const current = detailOverride ?? seriesDetailWithNewChapter();
      detailOverride = {
        ...current,
        chapters: current.chapters.map((chapter) => (
          chapter.id === newChapterId ? { ...chapter, title: body.title } : chapter
        )),
      };
      return jsonResponse(detailOverride.chapters.find((chapter) => chapter.id === newChapterId));
    }

    if (url === `/api/v1/series/${seriesId}/chapters/${newChapterId}` && method === "DELETE") {
      const current = detailOverride ?? seriesDetailWithNewChapter("Chapter Two", "Act Two");
      detailOverride = {
        ...current,
        acts: current.acts.map((act) => (
          act.id === newActId ? { ...act, chapterIds: [] } : act
        )),
        chapters: current.chapters.filter((chapter) => chapter.id !== newChapterId),
      };
      return jsonResponse({ deletedId: newChapterId, deletedSceneIds: [] });
    }

    if (url === `/api/v1/series/${seriesId}/chapters/${chapterId}/scenes/reorder` && method === "POST") {
      return jsonResponse([sceneDocument("", updatedRevision)]);
    }

    return jsonResponse({ message: `Unhandled ${method} ${url}` }, 500);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function expectStructureActive(element: HTMLElement, expected: boolean) {
  expect(element.className.includes("is-active")).toBe(expected);
}

describe("App shell", () => {
  it("renders the project library and workspace navigation", async () => {
    mockFetch();
    render(<App />);

    expect(screen.getByRole("navigation", { name: "Workspaces" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: /Glass Harbor/i })).toBeTruthy();
  });

  it("creates the first project from an empty library and opens its first scene", async () => {
    const fetchMock = mockFetch({ initialSeriesList: [] });
    render(<App />);

    expect(await screen.findByText("No projects yet")).toBeTruthy();
    const createButton = screen.getByRole("button", { name: "New Project" });
    expect(createButton).toHaveProperty("disabled", false);

    fireEvent.change(screen.getByLabelText("Series title"), { target: { value: "Zero Draft" } });
    fireEvent.click(createButton);

    expect(await screen.findByRole("heading", { name: "Write" })).toBeTruthy();
    expect(await screen.findByLabelText("Scene title")).toHaveProperty("value", "Opening Scene");
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/series",
        expect.objectContaining({
          body: expect.stringContaining("Zero Draft"),
          method: "POST",
        }),
      );
    });
  });

  it("moves projects to trash, restores them, and permanently deletes only after exact title confirmation", async () => {
    const fetchMock = mockFetch();
    render(<App />);

    expect(await screen.findByRole("button", { name: /Open Glass Harbor/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Move to Trash" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/trash`,
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByRole("button", { name: "Restore" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Open Glass Harbor/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/restore`,
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByRole("button", { name: /Open Glass Harbor/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Move to Trash" }));
    expect(await screen.findByRole("button", { name: "Delete permanently" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));

    expect(screen.getByRole("dialog", { name: "Permanently delete project?" })).toBeTruthy();
    const confirmInput = screen.getByLabelText("Type the project name to permanently delete it");
    const permanentButtons = () => screen.getAllByRole("button", { name: "Delete permanently" });
    expect(permanentButtons().at(-1)).toHaveProperty("disabled", true);
    fireEvent.change(confirmInput, { target: { value: "Wrong Project" } });
    expect(permanentButtons().at(-1)).toHaveProperty("disabled", true);
    fireEvent.change(confirmInput, { target: { value: "Glass Harbor" } });
    expect(permanentButtons().at(-1)).toHaveProperty("disabled", false);
    fireEvent.click(permanentButtons().at(-1)!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}`,
        expect.objectContaining({
          body: expect.stringContaining("\"confirmTitle\":\"Glass Harbor\""),
          method: "DELETE",
        }),
      );
    });
    expect(await screen.findByText("No projects yet")).toBeTruthy();
    expect(screen.getByText("Trash is empty.")).toBeTruthy();
  });

  it("opens a project into the write workspace", async () => {
    mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));

    expect(await screen.findByLabelText("Scene title")).toHaveProperty("value", "Opening Scene");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("button", { name: "Volume" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Chapter" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Act" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Scene" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Settings/i })).toBeTruthy();
  });

  it("loads codex entries for write inline marks without rendering redundant scene codex panel", async () => {
    const fetchMock = mockFetch({
      initialCodexEntries: [
        codexEntryDocument("Harbor Lock", "location", "A storm-pressure mechanism below the west quay."),
      ],
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/codex/entries`,
        expect.objectContaining({ method: "GET" }),
      );
    });
    expect(screen.queryByText("Codex in scene")).toBeNull();
    expect(screen.queryByText("Included context")).toBeNull();
    expect(screen.queryByLabelText("Scene Codex mentions")).toBeNull();
  });

  it("shows write codex marks inline and toggles the preview from the same mark", async () => {
    mockFetch({
      initialCodexEntries: [
        codexEntryDocument("Harbor Lock", "location", "A storm-pressure mechanism below the west quay.", codexEntryId, {
          aliases: ["Bellgate"],
        }),
      ],
      initialSeriesDetail: seriesDetail("Bellgate waited under the gate."),
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    const editor = await screen.findByLabelText("Scene content");
    expect(EditorView.findFromDOM(editor)).toBeNull();
    expect(screen.getByLabelText("Manuscript editor")).toBeTruthy();
    await waitFor(() => {
      expect(editor.querySelector(".pm-codex-mention")).toBeTruthy();
    });
    const currentMark = () => {
      const nextMark = editor.querySelector(".pm-codex-mention");
      if (!nextMark) throw new Error("Missing Bellgate mark");
      return nextMark;
    };
    const mark = currentMark();

    expect(screen.queryByText(/codex marks/i)).toBeNull();
    expect(screen.queryByLabelText("Scene Codex mentions")).toBeNull();
    expect(document.querySelector(".pm-codex-preview-popover")).toBeNull();

    fireEvent.click(mark);
    let preview = screen.getByLabelText("Harbor Lock canon description") as HTMLElement;
    expect(preview.classList.contains("codex-preview-popover")).toBe(true);
    expect(preview.classList.contains("pm-codex-preview-popover")).toBe(true);
    expect(preview.style.position).toBe("absolute");
    expect(preview.style.maxHeight).toMatch(/px$/u);
    expect(preview.style.width).toMatch(/px$/u);
    expect(screen.getByText("A storm-pressure mechanism below the west quay.")).toBeTruthy();

    fireEvent.click(editor);
    expect(screen.queryByLabelText("Harbor Lock canon description")).toBeNull();

    fireEvent.click(currentMark());
    expect(screen.getByLabelText("Harbor Lock canon description")).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByLabelText("Harbor Lock canon description")).toBeNull();

    fireEvent.click(currentMark());
    fireEvent.click(currentMark());
    expect(screen.queryByLabelText("Harbor Lock canon description")).toBeNull();
  });

  it("hides and restores the scene brief without rendering a text restore label", async () => {
    mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    expect(await screen.findByText("Scene Brief")).toBeTruthy();

    fireEvent.click(screen.getByTitle("Hide panel"));
    expect(screen.queryByText("Scene Brief")).toBeNull();
    expect(screen.queryByText("Brief")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Show scene brief" }));
    expect(await screen.findByText("Scene Brief")).toBeTruthy();
  });

  it("keeps write structure selection explicit, single, and toggleable", async () => {
    mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    await screen.findByLabelText("Scene title");
    const volumeRow = screen.getByRole("button", { name: /^Volume 1/i });
    const chapterRow = screen.getByRole("button", { name: /^Chapter One/i });
    const actRow = screen.getByRole("button", { name: /^Act One/i });
    const sceneRow = screen.getByRole("button", { name: /^Opening Scene/i });

    expectStructureActive(volumeRow, false);
    expectStructureActive(chapterRow, false);
    expectStructureActive(actRow, false);
    expectStructureActive(sceneRow, false);

    fireEvent.click(volumeRow);
    expectStructureActive(volumeRow, true);
    expectStructureActive(chapterRow, false);
    expectStructureActive(actRow, false);
    expectStructureActive(sceneRow, false);

    fireEvent.click(volumeRow);
    expectStructureActive(volumeRow, false);

    fireEvent.click(chapterRow);
    expectStructureActive(chapterRow, true);
    expectStructureActive(actRow, false);
    expectStructureActive(sceneRow, false);

    fireEvent.click(actRow);
    expectStructureActive(chapterRow, false);
    expectStructureActive(actRow, true);
    expectStructureActive(sceneRow, false);

    fireEvent.click(sceneRow);
    expectStructureActive(actRow, false);
    expectStructureActive(sceneRow, true);

    fireEvent.click(sceneRow);
    expectStructureActive(sceneRow, false);
  });

  it("does not carry old child selection when a different volume is selected", async () => {
    mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    await screen.findByLabelText("Scene title");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.click(screen.getByRole("button", { name: "Volume" }));

    const newVolumeRow = await screen.findByRole("button", { name: /^New Volume/i });
    fireEvent.click(newVolumeRow);
    expectStructureActive(newVolumeRow, true);
    expectStructureActive(screen.getByRole("button", { name: /^New Chapter/i }), false);
    expectStructureActive(screen.getByRole("button", { name: /^New Act/i }), false);
    expectStructureActive(screen.getByRole("button", { name: /^Opening Scene/i }), false);

    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("button", { name: "Scene" })).toHaveProperty("disabled", true);
  });

  it("creates and deletes a selected volume from the write structure", async () => {
    const fetchMock = mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    await screen.findByLabelText("Scene title");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.click(screen.getByRole("button", { name: "Volume" }));

    expect(await screen.findByRole("button", { name: /^New Volume/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^New Volume/i }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Delete selected Volume?")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" }).at(-1)!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/books/${newBookId}`,
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    expect(screen.queryByText("New Volume")).toBeNull();
  });

  it("adds a chapter to the selected volume", async () => {
    const fetchMock = mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    await screen.findByLabelText("Scene title");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.click(screen.getByRole("button", { name: "Volume" }));
    fireEvent.click(await screen.findByRole("button", { name: /^New Volume/i }));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.click(screen.getByRole("button", { name: "Chapter" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/books/${newBookId}/acts`,
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("renames a volume from the write structure", async () => {
    const fetchMock = mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    await screen.findByLabelText("Scene title");
    fireEvent.doubleClick(screen.getByRole("button", { name: /^Volume 1/i }));
    fireEvent.change(screen.getByLabelText("Rename Volume 1"), { target: { value: "Renamed Volume" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("button", { name: /^Renamed Volume/i })).toBeTruthy();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/books/${bookId}`,
        expect.objectContaining({ method: "PUT" }),
      );
    });
  });

  it("creates a codex entry and opens its detail workspace", async () => {
    const fetchMock = mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^Codex/i }));
    await screen.findByRole("button", { name: /Character/i });
    expect(await screen.findByText("No codex entries yet.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "New Entry" }));

    expect(await screen.findByRole("heading", { name: "New Entry" })).toBeTruthy();
    expect(screen.getByLabelText("Codex entry details")).toBeTruthy();
    const focusEdit = screen.getByRole("button", { name: "Focus Edit" });
    expect(focusEdit.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(focusEdit);
    expect(screen.getByRole("button", { name: "Browse Entries" }).getAttribute("aria-pressed")).toBe("true");
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/codex/entries`,
        expect.objectContaining({ method: "POST" }),
      );
    });

    const row = screen.getAllByText("No description")
      .map((element) => element.closest("button"))
      .find(Boolean);
    expect(row).toBeTruthy();
    fireEvent.click(row!);
    expect(screen.queryByLabelText("Codex entry details")).toBeNull();
  });

  it("edits and saves a codex entry through the API", async () => {
    const fetchMock = mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^Codex/i }));
    fireEvent.click(await screen.findByRole("button", { name: "New Entry" }));

    fireEvent.change(await screen.findByLabelText("Codex entry name"), { target: { value: "Harbor Lock" } });
    setEditorValue("Codex canon description", "A storm-pressure mechanism below the west quay.");
    fireEvent.click(screen.getByRole("button", { name: "Show details" }));
    fireEvent.click(screen.getByRole("button", { name: "Manage Types" }));
    const detailTypeDialog = await screen.findByRole("dialog", { name: "Manage detail types" });
    fireEvent.change(screen.getByLabelText("New detail type name"), { target: { value: "Gate rule" } });
    fireEvent.click(within(detailTypeDialog).getByRole("button", { name: "Add Type" }));
    expect(await screen.findByText("Gate rule")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("New detail type name"), { target: { value: "Appearance" } });
    fireEvent.click(within(detailTypeDialog).getByRole("button", { name: "Add Type" }));
    const appearanceType = (await screen.findByText("Appearance")).closest(".detail-type-dialog-row");
    expect(appearanceType).toBeTruthy();
    fireEvent.click(within(appearanceType as HTMLElement).getByLabelText("NSFW"));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/codex/detail-types/${secondDetailTypeId}`,
        expect.objectContaining({
          body: JSON.stringify({ baseRevision: revision, nsfw: true }),
          method: "PUT",
        }),
      );
    });
    fireEvent.click(within(appearanceType as HTMLElement).getByRole("button", { name: "Delete" }));
    fireEvent.click(within(appearanceType as HTMLElement).getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/codex/detail-types/${secondDetailTypeId}`,
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    await waitFor(() => {
      expect(screen.queryByText("Appearance")).toBeNull();
    });
    fireEvent.click(within(detailTypeDialog).getByRole("button", { name: "Close" }));

    fireEvent.click(screen.getByRole("button", { name: "Add Detail" }));
    fireEvent.click(screen.getByLabelText("Send to AI"));
    setEditorValue("Detail 1 value", "Only opens after the bell.");
    fireEvent.click(screen.getByRole("tab", { name: "Research" }));
    fireEvent.change(screen.getByLabelText("Codex research notes"), {
      target: { value: "Research source stays private until confirmed." },
    });

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(([url, init]) => (
        url === `/api/v1/series/${seriesId}/codex/entries/${codexEntryId}` && init?.method === "PUT"
      ));
      expect(putCall).toBeTruthy();
      const body = JSON.parse(String(putCall![1]?.body));
      expect(body).toEqual(expect.objectContaining({
        baseResearchRevision: revision,
        baseRevision: revision,
        description: "A storm-pressure mechanism below the west quay.",
        detailAiContext: { "Gate rule": false },
        details: { "Gate rule": "Only opens after the bell." },
        name: "Harbor Lock",
        research: "Research source stays private until confirmed.",
      }));
      expect(body).not.toHaveProperty("tags");
    }, { timeout: 3000 });
    expect(await screen.findByRole("heading", { name: "Harbor Lock" })).toBeTruthy();
  });

  it("shows id-keyed codex details by type name and saves them without UUID labels", async () => {
    const fetchMock = mockFetch({
      initialCodexDetailTypes: [
        codexDetailTypeDocument("Current knowledge", "character", detailTypeId),
      ],
      initialCodexEntries: [
        codexEntryDocument("Lena Vale", "character", "Carries the blue-salt key.", codexEntryId, {
          detailAiContext: { [detailTypeId]: false },
          details: { [detailTypeId]: "知道蓝盐钥匙会打开潮汐署档案门。" },
        }),
      ],
      initialSeriesDetail: seriesDetail("蓝盐钥匙在雾港码头发热。"),
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^Codex/i }));
    fireEvent.click((await screen.findByText("Lena Vale")).closest("button")!);
    fireEvent.click(screen.getByRole("button", { name: "Show details" }));

    const detailTypeSelect = await screen.findByLabelText("Detail 1 type") as HTMLSelectElement;
    expect(detailTypeSelect.value).toBe("Current knowledge");
    expect(screen.queryByText(detailTypeId)).toBeNull();

    setEditorValue("Detail 1 value", "她知道蓝盐钥匙会打开潮汐署档案门，但还不知道钥匙为何回应她。");

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(([url, init]) => (
        url === `/api/v1/series/${seriesId}/codex/entries/${codexEntryId}` && init?.method === "PUT"
      ));
      expect(putCall).toBeTruthy();
      const body = JSON.parse(String(putCall![1]?.body));
      expect(body.details).toEqual({
        "Current knowledge": "她知道蓝盐钥匙会打开潮汐署档案门，但还不知道钥匙为何回应她。",
      });
      expect(body.detailAiContext).toEqual({ "Current knowledge": false });
      expect(body.details).not.toHaveProperty(detailTypeId);
      expect(body.detailAiContext).not.toHaveProperty(detailTypeId);
    }, { timeout: 3000 });
  });

  it("shows codex relations and mentions from manuscript and other codex entries", async () => {
    const fetchMock = mockFetch({
      initialCodexEntries: [
        codexEntryDocument("Harbor Lock", "location", "A storm-pressure mechanism below the west quay.", codexEntryId, {
          aliases: ["Bellgate"],
        }),
        codexEntryDocument(
          "West Quay",
          "location",
          "The Harbor Lock sits below the quay.",
          relatedCodexEntryId,
          {
            details: { Rule: "Harbor Lock opens only after the bell." },
            research: "Repair notes mention Bellgate timing.",
          },
        ),
      ],
      initialCodexRelations: [codexRelationDocument()],
      initialSeriesDetail: seriesDetail("Harbor Lock waited under the gate."),
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^Codex/i }));
    const harborRow = (await screen.findByText("Harbor Lock")).closest("button");
    expect(harborRow).toBeTruthy();
    fireEvent.click(harborRow!);

    expect(await screen.findByRole("heading", { name: "Harbor Lock" })).toBeTruthy();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/codex/entries/${codexEntryId}/mentions`,
        expect.objectContaining({ method: "GET" }),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/codex/relations?entryId=${codexEntryId}`,
        expect.objectContaining({ method: "GET" }),
      );
    });

    fireEvent.click(screen.getByRole("tab", { name: "Relations" }));
    expect(screen.getByText("RELATIONS/CONNECTIONS")).toBeTruthy();
    expect(screen.getByText("Harbor Lock -> West Quay")).toBeTruthy();
    expect(screen.getByText("Locks access to the quay.")).toBeTruthy();
    expect(screen.getByText("Bell timing scene.")).toBeTruthy();
    const relationCard = screen.getByText("Locks access to the quay.").closest("article");
    expect(relationCard).toBeTruthy();
    fireEvent.click(within(relationCard!).getByRole("button", { name: "Delete" }));
    fireEvent.click(within(relationCard!).getByRole("button", { name: "Confirm Delete" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/codex/relations/${relationId}/archive`,
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(screen.queryByText("Locks access to the quay.")).toBeNull();

    fireEvent.change(screen.getByLabelText("Relation type"), { target: { value: "signals" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Signals the bell route." } });
    fireEvent.change(screen.getByLabelText("Evidence"), { target: { value: "Found in the repair notes." } });
    fireEvent.click(screen.getByRole("button", { name: "Add Relation" }));

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(([url, init]) => (
        url === `/api/v1/series/${seriesId}/codex/relations` && init?.method === "POST"
      ));
      expect(postCall).toBeTruthy();
      const body = JSON.parse(String(postCall![1]?.body));
      expect(body).toEqual(expect.objectContaining({
        description: "Signals the bell route.",
        directed: true,
        evidence: "Found in the repair notes.",
        sourceEntryId: codexEntryId,
        targetEntryId: relatedCodexEntryId,
        type: "signals",
      }));
    });
    expect(await screen.findByText("Signals the bell route.")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Mentions" }));
    expect(screen.getAllByText("1 mention").length).toBeGreaterThan(0);
    expect(await screen.findByRole("button", { name: /Manuscript 1/i })).toBeTruthy();
    expect(screen.getByText("Opening Scene")).toBeTruthy();
    expect(screen.getAllByText("Harbor Lock").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Codex 3/i }));
    expect(screen.getAllByText("West Quay").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Canon description").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Research notes").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Detail: Rule").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Bellgate" }));
    expect(screen.getByLabelText("Harbor Lock canon description")).toBeTruthy();
    expect(screen.getAllByText("A storm-pressure mechanism below the west quay.").length).toBeGreaterThan(0);
  });

  it("shows codex baseline effective state and grouped progression history without future leakage", async () => {
    const previousSceneDocument: SceneBlockDocument = {
      schemaVersion: 1,
      blocks: [
        { id: firstBlockId, kind: "paragraph", text: "Earlier scene." },
        {
          createdAt: "2026-06-24T00:00:00.000Z",
          id: secondBlockId,
          kind: "codexProgression",
          progressionId,
          updatedAt: "2026-06-24T00:00:00.000Z",
        },
      ],
    };
    const futureSceneDocument: SceneBlockDocument = {
      schemaVersion: 1,
      blocks: [{
        createdAt: "2026-06-25T00:00:00.000Z",
        id: thirdBlockId,
        kind: "codexProgression",
        progressionId: secondProgressionId,
        updatedAt: "2026-06-25T00:00:00.000Z",
      }],
    };
    const baseDetail = seriesDetail("", revision);
    const previousScene = sceneDocumentWithMetadata(
      { id: sceneId, order: 1, title: "Opening Scene" },
      "",
      revision,
      previousSceneDocument,
    );
    const futureScene = sceneDocumentWithMetadata(
      { id: secondSceneId, order: 2, title: "Second Scene" },
      "",
      revision,
      futureSceneDocument,
    );
    const fetchMock = mockFetch({
      initialCodexEntries: [
        codexEntryDocument("Harbor Lock", "location", "Baseline lock state.", codexEntryId),
      ],
      initialCodexProgressions: [
        codexProgressionDocument(secondBlockId, progressionId, {
          body: "Previous scene truth.",
          operation: "replace",
          summary: "Previous change.",
        }),
        codexProgressionDocument(thirdBlockId, secondProgressionId, {
          body: "Future bell secret.",
          operation: "add",
          sceneId: secondSceneId,
          summary: "Future change.",
        }),
      ],
      initialSeriesDetail: {
        ...baseDetail,
        chapters: baseDetail.chapters.map((chapter) => ({
          ...chapter,
          sceneIds: [sceneId, secondSceneId],
        })),
        scenes: [previousScene, futureScene],
      },
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^Codex/i }));
    const harborRow = (await screen.findByText("Harbor Lock")).closest("button");
    expect(harborRow).toBeTruthy();
    fireEvent.click(harborRow!);

    fireEvent.click(await screen.findByRole("tab", { name: "Progressions" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/codex/progressions?kind=field&entryId=${codexEntryId}`,
        expect.objectContaining({ method: "GET" }),
      );
      expect(fetchMock.mock.calls.some(([url, init]) => (
        typeof url === "string" &&
        url.includes(`/api/v1/series/${seriesId}/codex/entries/${codexEntryId}/effective`) &&
        url.includes(`sceneId=${sceneId}`) &&
        init?.method === "GET"
      ))).toBe(true);
    });

    const baselineCard = screen.getByText("Initial state").closest(".progression-state-card");
    const effectiveCard = screen.getByText("Effective here").closest(".progression-state-card");
    expect(baselineCard).toBeTruthy();
    expect(effectiveCard).toBeTruthy();
    expect(within(baselineCard as HTMLElement).getByText("Baseline lock state.")).toBeTruthy();
    expect(within(effectiveCard as HTMLElement).getByText("Previous scene truth.")).toBeTruthy();
    expect(within(effectiveCard as HTMLElement).queryByText(/Future bell secret/)).toBeNull();
    expect(screen.getAllByText("Canon description").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 future change is hidden here.").length).toBeGreaterThan(0);
    expect(screen.getByText("History")).toBeTruthy();
    expect(screen.getByText("Previous change.")).toBeTruthy();
    expect(screen.getByText("Future change.")).toBeTruthy();
    expect(screen.queryByText(progressionId)).toBeNull();
    expect(screen.queryByText(secondProgressionId)).toBeNull();

    fireEvent.change(screen.getByLabelText("Effective story state scene"), {
      target: { value: secondSceneId },
    });
    await waitFor(() => {
      const nextEffectiveCard = screen.getByText("Effective here").closest(".progression-state-card");
      expect(nextEffectiveCard).toBeTruthy();
      expect(within(nextEffectiveCard as HTMLElement).getByText(/Future bell secret/)).toBeTruthy();
    });
  });

  it("marks codex canon description mentions inline and toggles the preview from the same mark", async () => {
    mockFetch({
      initialCodexEntries: [
        codexEntryDocument("Harbor Lock", "location", "Bellgate controls the quay.", codexEntryId),
        codexEntryDocument("West Quay", "location", "A locked west quay.", relatedCodexEntryId, {
          aliases: ["Bellgate"],
        }),
      ],
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^Codex/i }));
    const harborRow = (await screen.findByText("Harbor Lock")).closest("button");
    expect(harborRow).toBeTruthy();
    fireEvent.click(harborRow!);

    const descriptionEditor = await screen.findByLabelText("Codex canon description");
    await waitFor(() => {
      expect(descriptionEditor.querySelector(".cm-codex-mention")).toBeTruthy();
    });
    const mark = descriptionEditor.querySelector(".cm-codex-mention");
    if (!mark) throw new Error("Missing Bellgate mark");

    fireEvent.click(mark);
    const preview = screen.getByLabelText("West Quay canon description");
    expect(preview).toBeTruthy();
    expect(within(preview).getByText("A locked west quay.")).toBeTruthy();

    fireEvent.click(mark);
    expect(screen.queryByLabelText("West Quay canon description")).toBeNull();
  });

  it("preserves blank lines inserted with Enter in codex canon description", async () => {
    const fetchMock = mockFetch({
      initialCodexEntries: [codexEntryDocument("Harbor Lock", "location", "", codexEntryId)],
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^Codex/i }));
    const harborRow = (await screen.findByText("Harbor Lock")).closest("button");
    expect(harborRow).toBeTruthy();
    fireEvent.click(harborRow!);

    await screen.findByLabelText("Codex canon description");
    insertEditorText("Codex canon description", "\n");
    insertEditorText("Codex canon description", "\n");

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(([url, init]) => (
        url === `/api/v1/series/${seriesId}/codex/entries/${codexEntryId}` && init?.method === "PUT"
      ));
      expect(putCall).toBeTruthy();
      expect(JSON.parse(String(putCall![1]?.body)).description).toBe("\n\n");
    }, { timeout: 3000 });
  });

  it("preserves leading spaces in codex canon description lines", async () => {
    const fetchMock = mockFetch({
      initialCodexEntries: [codexEntryDocument("Harbor Lock", "location", "", codexEntryId)],
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^Codex/i }));
    const harborRow = (await screen.findByText("Harbor Lock")).closest("button");
    expect(harborRow).toBeTruthy();
    fireEvent.click(harborRow!);

    await screen.findByLabelText("Codex canon description");
    insertEditorText("Codex canon description", " ");
    insertEditorText("Codex canon description", "\n");
    insertEditorText("Codex canon description", " ");

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(([url, init]) => (
        url === `/api/v1/series/${seriesId}/codex/entries/${codexEntryId}` && init?.method === "PUT"
      ));
      expect(putCall).toBeTruthy();
      expect(JSON.parse(String(putCall![1]?.body)).description).toBe(" \n ");
    }, { timeout: 3000 });
  });

  it("keeps codex canon editing responsive while autosave is in flight", async () => {
    const fetchMock = mockFetch({
      codexUpdateDelayMs: 300,
      initialCodexEntries: [codexEntryDocument("Harbor Lock", "location", "", codexEntryId)],
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^Codex/i }));
    const harborRow = (await screen.findByText("Harbor Lock")).closest("button");
    expect(harborRow).toBeTruthy();
    fireEvent.click(harborRow!);

    await screen.findByLabelText("Codex canon description");
    setEditorValue("Codex canon description", "First autosave");

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url, init]) => (
        url === `/api/v1/series/${seriesId}/codex/entries/${codexEntryId}` && init?.method === "PUT"
      ))).toBe(true);
    }, { timeout: 3500 });

    const editorElement = screen.getByLabelText("Codex canon description");
    expect(editorElement.closest(".novel-editor")?.classList.contains("is-read-only")).toBe(false);
    insertEditorText("Codex canon description", " still typing");
    expect(findEditorView("Codex canon description").state.doc.toString()).toBe("First autosave still typing");

    await waitFor(() => {
      const putCalls = fetchMock.mock.calls.filter(([url, init]) => (
        url === `/api/v1/series/${seriesId}/codex/entries/${codexEntryId}` && init?.method === "PUT"
      ));
      expect(putCalls.length).toBeGreaterThanOrEqual(2);
      const latestBody = JSON.parse(String(putCalls.at(-1)![1]?.body));
      expect(latestBody.description).toBe("First autosave still typing");
      expect(latestBody.baseRevision).toBe(updatedRevision);
    }, { timeout: 7000 });

    expect(findEditorView("Codex canon description").state.doc.toString()).toBe("First autosave still typing");
  });

  it("saves codex tracking settings from the renamed tracking tab", async () => {
    const fetchMock = mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^Codex/i }));
    fireEvent.click(await screen.findByRole("button", { name: "New Entry" }));
    expect(await screen.findByRole("heading", { name: "New Entry" })).toBeTruthy();

    expect(screen.queryByRole("tab", { name: "Recognition" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Tracking" }));
    expect(screen.getByText("TRACKING/MATCHING")).toBeTruthy();
    expect(screen.getByText("AI CONTEXT")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Use case-sensitive matching for names and aliases."));
    fireEvent.click(screen.getByLabelText("Use English plural variants."));
    fireEvent.change(screen.getByPlaceholderText("Separate exclusions with commas"), {
      target: { value: "common lock, stage lock" },
    });
    fireEvent.click(screen.getByLabelText(/Never include/));

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(([url, init]) => (
        url === `/api/v1/series/${seriesId}/codex/entries/${codexEntryId}` && init?.method === "PUT"
      ));
      expect(putCall).toBeTruthy();
      const body = JSON.parse(String(putCall![1]?.body));
      expect(body.aiContextPolicy).toBe("never");
      expect(body.mention).toEqual(expect.objectContaining({
        automaticPlural: true,
        caseSensitive: true,
        excludedTerms: ["common lock", "stage lock"],
        matchAliases: true,
      }));
    }, { timeout: 3000 });
  });

  it("creates custom codex categories and saves entry category changes", async () => {
    const fetchMock = mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^Codex/i }));
    fireEvent.click(await screen.findByRole("button", { name: "New Entry" }));
    expect(await screen.findByRole("heading", { name: "New Entry" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.change(screen.getByLabelText("New category name"), { target: { value: "Mechanism" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByRole("button", { name: /Mechanism/i })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Codex entry category"), { target: { value: customCategoryId } });

    await waitFor(() => {
      const postCategory = fetchMock.mock.calls.find(([url, init]) => (
        url === `/api/v1/series/${seriesId}/codex/categories` && init?.method === "POST"
      ));
      expect(postCategory).toBeTruthy();
      const putCall = fetchMock.mock.calls.find(([url, init]) => (
        url === `/api/v1/series/${seriesId}/codex/entries/${codexEntryId}` && init?.method === "PUT"
      ));
      expect(putCall).toBeTruthy();
      const body = JSON.parse(String(putCall![1]?.body));
      expect(body.categoryId).toBe(customCategoryId);
    }, { timeout: 3000 });
    await waitFor(() => {
      expect(screen.getAllByText("Mechanism").length).toBeGreaterThan(0);
    });
  });

  it("renames and deletes custom codex categories without deleting entries", async () => {
    const fetchMock = mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^Codex/i }));
    fireEvent.click(await screen.findByRole("button", { name: "New Entry" }));
    expect(await screen.findByRole("heading", { name: "New Entry" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.change(screen.getByLabelText("New category name"), { target: { value: "Mechanism" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByRole("button", { name: /Mechanism/i })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Codex entry category"), { target: { value: customCategoryId } });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/codex/entries/${codexEntryId}`,
        expect.objectContaining({ method: "PUT" }),
      );
    }, { timeout: 3000 });

    fireEvent.doubleClick(screen.getByRole("button", { name: /Mechanism/i }));
    const renameInput = screen.getByLabelText("Rename Mechanism");
    fireEvent.change(renameInput, { target: { value: "Mechanism 2" } });
    fireEvent.keyDown(renameInput, { code: "Enter", key: "Enter" });
    expect(await screen.findByRole("button", { name: /Mechanism 2/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Delete selected category?")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" }).at(-1)!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/codex/categories/${customCategoryId}`,
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    expect(screen.queryByRole("button", { name: /Mechanism 2/i })).toBeNull();
    expect(await screen.findByRole("heading", { name: "New Entry" })).toBeTruthy();
    expect(screen.getAllByText("Uncategorized").length).toBeGreaterThan(0);
  });

  it("rejects duplicate codex category names before create", async () => {
    const fetchMock = mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^Codex/i }));
    await screen.findByRole("button", { name: /Character/i });

    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.change(screen.getByLabelText("New category name"), { target: { value: "Character" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText('Category "Character" already exists.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText("New category name"), { target: { value: "Mechanism" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByRole("button", { name: /Mechanism/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.change(screen.getByLabelText("New category name"), { target: { value: "Mechanism" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText('Category "Mechanism" already exists.')).toBeTruthy();

    const categoryCreates = fetchMock.mock.calls.filter(([url, init]) => (
      url === `/api/v1/series/${seriesId}/codex/categories` && init?.method === "POST"
    ));
    expect(categoryCreates).toHaveLength(1);
  });

  it("deletes a codex entry from the detail archive area", async () => {
    const fetchMock = mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^Codex/i }));
    fireEvent.click(await screen.findByRole("button", { name: "New Entry" }));
    expect(await screen.findByRole("heading", { name: "New Entry" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Delete Entry" }));
    expect(screen.getByText("Delete this entry?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete Entry" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/codex/entries/${codexEntryId}`,
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    expect(screen.queryByLabelText("Codex entry details")).toBeNull();
    expect(await screen.findByText("No codex entries yet.")).toBeTruthy();
  });

  it("keeps codex detail rows collapsed until needed", async () => {
    mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^Codex/i }));
    fireEvent.click(await screen.findByRole("button", { name: "New Entry" }));

    expect(await screen.findByRole("heading", { name: "New Entry" })).toBeTruthy();
    expect(screen.queryByText("No details yet.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show details" }));
    expect(screen.getByText("No details yet.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hide details" }));
    expect(screen.queryByText("No details yet.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add Detail" }));
    expect(screen.getByRole("dialog", { name: "Manage detail types" })).toBeTruthy();
    expect(screen.getByLabelText("New detail type name")).toBeTruthy();
  });

  it("shows a codex conflict and reloads the disk version", async () => {
    const fetchMock = mockFetch({ conflictCodexUpdate: true });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^Codex/i }));
    fireEvent.click(await screen.findByRole("button", { name: "New Entry" }));
    fireEvent.change(await screen.findByLabelText("Codex entry name"), { target: { value: "Local Entry" } });

    await waitFor(() => {
      expect(screen.getAllByText("This entry changed on disk. Reload it before saving again.").length).toBeGreaterThan(0);
    }, { timeout: 3000 });
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Codex entry name")).toHaveProperty("value", "Disk Entry");
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/codex/entries/${codexEntryId}`,
        expect.objectContaining({ method: "GET" }),
      );
    });
  });

  it("archives and restores a codex entry", async () => {
    const fetchMock = mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^Codex/i }));
    fireEvent.click(await screen.findByRole("button", { name: "New Entry" }));
    expect(await screen.findByRole("heading", { name: "New Entry" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Archive Entry" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/codex/entries/${codexEntryId}/archive`,
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByText("Archived entry")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Restore Entry" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/codex/entries/${codexEntryId}/restore`,
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByText("Active entry")).toBeTruthy();
  });

  it("deletes the selected chapter only after confirmation", async () => {
    const fetchMock = mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    await screen.findByLabelText("Scene title");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.click(screen.getByRole("button", { name: "Chapter" }));

    fireEvent.click(await screen.findByRole("button", { name: /^New Chapter/i }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Delete selected Chapter?")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" }).at(-1)!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/acts/${newActId}`,
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    expect(screen.queryByText("New Chapter")).toBeNull();
  });

  it("shows newly created acts and chapters in the write structure", async () => {
    mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    await screen.findByLabelText("Scene title");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.click(screen.getByRole("button", { name: "Chapter" }));
    fireEvent.doubleClick(await screen.findByRole("button", { name: /^New Chapter/i }));
    fireEvent.change(screen.getByLabelText("Rename New Chapter"), { target: { value: "Chapter Two" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("button", { name: "Collapse Chapter: Chapter Two" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Act" })).not.toHaveProperty("disabled", true);
    });
    fireEvent.click(screen.getByRole("button", { name: "Act" }));
    fireEvent.doubleClick(await screen.findByRole("button", { name: /^New Act/i }));
    fireEvent.change(screen.getByLabelText("Rename New Act"), { target: { value: "Act Two" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("button", { name: "Collapse Act: Act Two" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Collapse Chapter: Chapter Two" }));
    expect(screen.queryByText("Act Two")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Expand Chapter: Chapter Two" }));
    expect(await screen.findByRole("button", { name: "Collapse Act: Act Two" })).toBeTruthy();
  });

  it("creates a scene inside the selected act", async () => {
    const fetchMock = mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    await screen.findByLabelText("Scene title");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.click(screen.getByRole("button", { name: "Chapter" }));
    expect(await screen.findByRole("button", { name: /^New Chapter/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Act" })).not.toHaveProperty("disabled", true);
    });
    fireEvent.click(screen.getByRole("button", { name: "Act" }));
    expect(await screen.findByRole("button", { name: /^New Act/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Scene" })).not.toHaveProperty("disabled", true);
    });
    fireEvent.click(screen.getByRole("button", { name: "Scene" }));

    expect(await screen.findByLabelText("Scene title")).toHaveProperty("value", "New Scene");
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/scenes`,
        expect.objectContaining({
          body: expect.stringContaining(newChapterId),
          method: "POST",
        }),
      );
    });
  });

  it("deletes the selected act only after confirmation", async () => {
    const fetchMock = mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    await screen.findByLabelText("Scene title");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.click(screen.getByRole("button", { name: "Chapter" }));
    fireEvent.doubleClick(await screen.findByRole("button", { name: /^New Chapter/i }));
    fireEvent.change(screen.getByLabelText("Rename New Chapter"), { target: { value: "Chapter Two" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("button", { name: "Collapse Chapter: Chapter Two" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Act" })).not.toHaveProperty("disabled", true);
    });
    fireEvent.click(screen.getByRole("button", { name: "Act" }));
    fireEvent.doubleClick(await screen.findByRole("button", { name: /^New Act/i }));
    fireEvent.change(screen.getByLabelText("Rename New Act"), { target: { value: "Act Two" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    fireEvent.click(await screen.findByRole("button", { name: /^Act Two/i }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Delete selected Act?")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" }).at(-1)!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/chapters/${newChapterId}`,
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    expect(screen.queryByText("Act Two")).toBeNull();
  });

  it("deletes the selected scene only after confirmation", async () => {
    const fetchMock = mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    await screen.findByLabelText("Scene title");
    fireEvent.click(screen.getByRole("button", { name: /^Opening Scene/i }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Delete selected Scene?")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" }).at(-1)!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/scenes/${sceneId}`,
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    expect(await screen.findByText("No scene open")).toBeTruthy();
  });

  it("enters and exits focus mode from write only", async () => {
    mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    await screen.findByLabelText("Scene title");
    fireEvent.click(screen.getByRole("button", { name: "Focus" }));

    expect(screen.getByRole("button", { name: "Exit Focus" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Exit Focus" }));
    expect(screen.getByRole("button", { name: "Focus" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Focus" }));
    fireEvent.click(screen.getByRole("button", { name: "Codex" }));
    expect(screen.queryByRole("button", { name: "Exit Focus" })).toBeNull();
  });

  it("saves a changed scene through the scene document API", async () => {
    const fetchMock = mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    await screen.findByLabelText("Manuscript editor");
    setManuscriptBlocks([{ id: firstBlockId, kind: "paragraph", text: "New paragraph" }]);

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(([url, init]) => (
        url === `/api/v1/series/${seriesId}/scenes/${sceneId}/document` && init?.method === "PUT"
      ));
      expect(putCall).toBeTruthy();
      const body = JSON.parse(String(putCall![1]?.body));
      expect(body.content).toBeUndefined();
      expect(body.document.blocks[0]).toMatchObject({ kind: "paragraph", text: "New paragraph" });
    }, { timeout: 3000 });
  });

  it("renders an empty scene as a continuous manuscript surface instead of a formatting panel", async () => {
    mockFetch({
      initialSeriesDetail: seriesDetail(""),
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    const editorSurface = await screen.findByLabelText("Scene content");

    expect(editorSurface.getAttribute("data-empty")).toBe("true");
    expect(editorSurface.getAttribute("data-placeholder")).toBe("Continue the scene...");
    expect(screen.queryByRole("button", { name: "Open editor tools" })).toBeNull();
    expect(screen.queryByLabelText("Current paragraph style")).toBeNull();
    expect(document.querySelector(".scene-block")).toBeNull();
  });

  it("saves direct continuous manuscript input without the old card editor", async () => {
    const fetchMock = mockFetch({
      initialSeriesDetail: seriesDetail(""),
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    await screen.findByLabelText("Manuscript editor");

    const editor = manuscriptEditor();
    act(() => {
      editor.commands.insertContent("First line");
      editor.commands.splitBlock();
      editor.commands.insertContent("Second line");
    });

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(([url, init]) => (
        url === `/api/v1/series/${seriesId}/scenes/${sceneId}/document` && init?.method === "PUT"
      ));
      expect(putCall).toBeTruthy();
      const body = JSON.parse(String(putCall![1]?.body));
      expect(body.document.blocks.map((block: { text?: string }) => block.text)).toEqual(["First line", "Second line"]);
      expect(document.querySelector(".scene-block")).toBeNull();
    }, { timeout: 3000 });
  });

  it("saves ordinary heading and scene break blocks without UI-only markup", async () => {
    const fetchMock = mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    await screen.findByLabelText("Manuscript editor");
    setManuscriptBlocks([
      { id: firstBlockId, kind: "heading", level: 2, text: "A Hard Turn" },
      { id: secondBlockId, kind: "sceneBreak" },
    ]);

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(([url, init]) => (
        url === `/api/v1/series/${seriesId}/scenes/${sceneId}/document` && init?.method === "PUT"
      ));
      expect(putCall).toBeTruthy();
      const body = JSON.parse(String(putCall![1]?.body));
      expect(body.document.blocks.map((block: { kind: string }) => block.kind)).toEqual(["heading", "sceneBreak"]);
      expect(JSON.stringify(body)).not.toContain("scene-block");
      expect(JSON.stringify(body)).not.toContain("activeBlockMention");
      expect(document.querySelector(".scene-block")).toBeNull();
    }, { timeout: 3000 });
  });

  it("keeps Codex progression behind the top editor tool menu", async () => {
    mockFetch({
      initialSeriesDetail: seriesDetail("Opening line."),
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    await screen.findByLabelText("Manuscript editor");

    expect(screen.queryByRole("button", { name: "Insert paragraph" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete selection" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Codex progression" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Insert" }));
    expect(screen.getByRole("menuitem", { name: "Codex progression" })).toBeTruthy();
    expect(document.querySelector(".scene-block")).toBeNull();
  });

  it("preserves leading spaces inside ordinary write blocks", async () => {
    const fetchMock = mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    await screen.findByLabelText("Manuscript editor");
    setManuscriptBlocks([{ id: firstBlockId, kind: "paragraph", text: " \n " }]);

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(([url, init]) => (
        url === `/api/v1/series/${seriesId}/scenes/${sceneId}/document` && init?.method === "PUT"
      ));
      expect(putCall).toBeTruthy();
      expect(JSON.parse(String(putCall![1]?.body)).document.blocks[0].text).toBe(" \n ");
    }, { timeout: 3000 });
  });

  it("creates edits collapses and deletes write progression blocks", async () => {
    const fetchMock = mockFetch({
      initialCodexEntries: [
        codexEntryDocument("Harbor Lock", "location", "Baseline lock state.", codexEntryId),
      ],
      initialSeriesDetail: seriesDetail("Opening line."),
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    await screen.findByLabelText("Manuscript editor");
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/codex/progressions?kind=field&sceneId=${sceneId}`,
        expect.objectContaining({ method: "GET" }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Insert" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Codex progression" }));

    await waitFor(() => {
      const createCall = fetchMock.mock.calls.find(([url, init]) => (
        url === `/api/v1/series/${seriesId}/scenes/${sceneId}/progression-blocks` && init?.method === "POST"
      ));
      expect(createCall).toBeTruthy();
      const body = JSON.parse(String(createCall![1]?.body));
      expect(body).toEqual(expect.objectContaining({
        afterBlockId: firstBlockId,
        baseRevision: revision,
        progression: expect.objectContaining({
          entryId: codexEntryId,
          kind: "field",
        }),
      }));
      expect(JSON.stringify(body)).not.toContain("effectiveFromSceneId");
      expect(JSON.stringify(body)).not.toContain("\"source\"");
    });
    await waitFor(() => {
      expect(screen.queryByLabelText("Codex progression text")).toBeNull();
    });
    fireEvent.click(await screen.findByRole("button", { name: "Expand Codex progression" }, { timeout: 3000 }));
    expect(await screen.findByLabelText("Codex progression entry", {}, { timeout: 3000 })).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url, init]) => (
      url === `/api/v1/series/${seriesId}/codex/progressions` && init?.method === "POST"
    ))).toBe(false);
    expect(fetchMock.mock.calls.some(([url, init]) => (
      url === `/api/v1/series/${seriesId}/scenes/${sceneId}/document` && init?.method === "PUT"
    ))).toBe(false);

    fireEvent.change(screen.getByLabelText("Codex progression summary"), {
      target: { value: "Lock state changes." },
    });
    fireEvent.change(screen.getByLabelText("Codex progression text"), {
      target: { value: "The lock answers to the bell." },
    });

    expect(screen.getByDisplayValue("The lock answers to the bell.")).toBeTruthy();
    expect(screen.queryByLabelText("Codex progression preview")).toBeNull();
    expect(screen.queryByText("Codex progressions")).toBeNull();

    await waitFor(() => {
      const updateCall = fetchMock.mock.calls.find(([url, init]) => (
        url === `/api/v1/series/${seriesId}/codex/progressions/${progressionId}` && init?.method === "PUT"
      ));
      expect(updateCall).toBeTruthy();
      const body = JSON.parse(String(updateCall![1]?.body));
      expect(body).toEqual(expect.objectContaining({
        body: "The lock answers to the bell.",
        operation: "add",
        summary: "Lock state changes.",
      }));
    }, { timeout: 3000 });

    fireEvent.click(screen.getByRole("button", { name: "Collapse Codex progression" }));
    expect(screen.queryByLabelText("Codex progression text")).toBeNull();
    expect(screen.getAllByText("Lock state changes.").length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByRole("button", { name: "Expand Codex progression" }));
    expect(screen.getByLabelText("Codex progression text")).toBeTruthy();

    setManuscriptBlocks([
      { id: firstBlockId, kind: "paragraph", text: "Opening line." },
      {
        createdAt: "2026-06-24T00:00:00.000Z",
        id: secondBlockId,
        kind: "codexProgression",
        progressionId,
        updatedAt: "2026-06-24T00:00:00.000Z",
      },
      { id: thirdBlockId, kind: "paragraph", text: "After progression." },
      { id: fourthBlockId, kind: "paragraph", text: "End marker." },
    ]);
    const moveHandle = await screen.findByLabelText("Move Codex progression");
    fireEvent.pointerDown(moveHandle, { clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(moveHandle, { clientY: 500, pointerId: 1 });
    await waitFor(() => {
      const movedCall = fetchMock.mock.calls.find(([url, init]) => {
        if (url !== `/api/v1/series/${seriesId}/scenes/${sceneId}/document` || init?.method !== "PUT") return false;
        const blocks = JSON.parse(String(init.body)).document.blocks;
        return blocks[0]?.id === firstBlockId &&
          blocks[1]?.id === thirdBlockId &&
          blocks[2]?.id === fourthBlockId &&
          blocks[3]?.id === secondBlockId;
      });
      expect(movedCall).toBeTruthy();
    }, { timeout: 3000 });

    setManuscriptBlocks([
      { id: firstBlockId, kind: "paragraph", text: "Opening line revised." },
      {
        createdAt: "2026-06-24T00:00:00.000Z",
        id: secondBlockId,
        kind: "codexProgression",
        progressionId,
        updatedAt: "2026-06-24T00:00:00.000Z",
      },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Delete Codex progression" }));
    expect(screen.getByText("Delete this Codex progression?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete Codex progression" }));
    await waitFor(() => {
      const dirtySaveCallIndex = fetchMock.mock.calls.findIndex(([url, init]) => (
        url === `/api/v1/series/${seriesId}/scenes/${sceneId}/document` &&
        init?.method === "PUT" &&
        JSON.parse(String(init.body)).document.blocks[0].text === "Opening line revised."
      ));
      const deleteCallIndex = fetchMock.mock.calls.findIndex(([url, init]) => (
        typeof url === "string" &&
        url.startsWith(`/api/v1/series/${seriesId}/scenes/${sceneId}/progression-blocks/`) &&
        init?.method === "DELETE"
      ));
      expect(dirtySaveCallIndex).toBeGreaterThanOrEqual(0);
      expect(deleteCallIndex).toBeGreaterThan(dirtySaveCallIndex);
    }, { timeout: 3000 });
    await waitFor(() => {
      expect(screen.queryByLabelText("Codex progression text")).toBeNull();
    });
    expect(screen.queryByText("Codex progressions")).toBeNull();
    expect(manuscriptEditor().getText()).toContain("Opening line revised.");
  });

  it("renders first write progression blocks without a duplicated Write preview panel", async () => {
    const previousSceneDocument: SceneBlockDocument = {
      schemaVersion: 1,
      blocks: [
        { id: firstBlockId, kind: "paragraph", text: "Earlier scene." },
        {
          createdAt: "2026-06-24T00:00:00.000Z",
          id: secondBlockId,
          kind: "codexProgression",
          progressionId,
          updatedAt: "2026-06-24T00:00:00.000Z",
        },
      ],
    };
    const currentSceneDocument: SceneBlockDocument = {
      schemaVersion: 1,
      blocks: [{
        createdAt: "2026-06-25T00:00:00.000Z",
        id: thirdBlockId,
        kind: "codexProgression",
        progressionId: secondProgressionId,
        updatedAt: "2026-06-25T00:00:00.000Z",
      }],
    };
    const baseDetail = seriesDetail("", revision);
    const previousScene = sceneDocumentWithMetadata(
      { id: sceneId, order: 1, title: "Opening Scene" },
      "",
      revision,
      previousSceneDocument,
    );
    const currentScene = sceneDocumentWithMetadata(
      { id: secondSceneId, order: 2, title: "Second Scene" },
      "",
      revision,
      currentSceneDocument,
    );
    const fetchMock = mockFetch({
      initialCodexEntries: [
        codexEntryDocument("Harbor Lock", "location", "Baseline lock state.", codexEntryId),
      ],
      initialCodexProgressions: [
        codexProgressionDocument(secondBlockId, progressionId, {
          body: "Previous scene truth.",
          operation: "replace",
          summary: "Previous change.",
        }),
        codexProgressionDocument(thirdBlockId, secondProgressionId, {
          body: "Current scene truth.",
          operation: "add",
          sceneId: secondSceneId,
          summary: "Current change.",
        }),
      ],
      initialSeriesDetail: {
        ...baseDetail,
        chapters: baseDetail.chapters.map((chapter) => ({
          ...chapter,
          sceneIds: [sceneId, secondSceneId],
        })),
        scenes: [previousScene, currentScene],
      },
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^Second Scene/i }));

    expect(await screen.findByText("Current change.")).toBeTruthy();
    expect(screen.queryByLabelText("Codex progression text")).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "Expand Codex progression" }));
    expect(await screen.findByDisplayValue("Current scene truth.")).toBeTruthy();
    expect(screen.queryByLabelText("Codex progression preview")).toBeNull();
    expect(screen.queryByText("Codex progressions")).toBeNull();
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url, init]) => (
        typeof url === "string" &&
        url.includes(`/api/v1/series/${seriesId}/codex/entries/${codexEntryId}/effective`) &&
        init?.method === "GET"
      ))).toBe(false);
    });
  });

  it("manages multiple real model settings and service keys from settings", async () => {
    const fetchMock = mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Settings" }));

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeTruthy();
    expect(screen.getByText("Connections")).toBeTruthy();
    expect(screen.getByText("Key And Connection")).toBeTruthy();
    expect(await screen.findByText("No model settings yet")).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Mock" })).toBeNull();
    expect(screen.getByRole("option", { name: "Anthropic" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Google Gemini" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Setting name"), { target: { value: "DeepSeek Writing" } });
    fireEvent.change(screen.getByLabelText("Service key"), { target: { value: "deepseek-key-one" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Setting" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/ai/model-profiles",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const createCalls = fetchMock.mock.calls.filter(([url, init]) => (
      url === "/api/v1/ai/model-profiles" && init?.method === "POST"
    ));
    const firstCreateBody = JSON.parse(String(createCalls[0]![1]?.body));
    expect(firstCreateBody).toMatchObject({
      provider: "deepseek",
      title: "DeepSeek Writing",
    });
    expect(Object.keys(firstCreateBody).sort()).toEqual([
      "baseUrl",
      "capabilities",
      "contextWindowTokens",
      "model",
      "provider",
      "title",
    ]);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/ai/model-profiles/${modelProfileId}/credential`,
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByText("Model setting saved. Service key stored and verified.")).toBeTruthy();
    expect((await screen.findAllByText("Saved in the system credential store.")).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain("deepseek-key-one");

    fireEvent.click(screen.getByRole("button", { name: "New Connection" }));
    fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "openai" } });
    fireEvent.change(screen.getByLabelText("Setting name"), { target: { value: "OpenAI Drafting" } });
    fireEvent.change(screen.getByLabelText("Service key"), { target: { value: "openai-key-one" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Setting" }));
    await waitFor(() => {
      expect(screen.getByText("DeepSeek Writing")).toBeTruthy();
      expect(screen.getByText("OpenAI Drafting")).toBeTruthy();
    });
    const secondCreateCalls = fetchMock.mock.calls.filter(([url, init]) => (
      url === "/api/v1/ai/model-profiles" && init?.method === "POST"
    ));
    expect(secondCreateCalls).toHaveLength(2);
    const secondCreateBody = JSON.parse(String(secondCreateCalls[1]![1]?.body));
    expect(secondCreateBody).toMatchObject({
      provider: "openai",
      title: "OpenAI Drafting",
    });
    expect(Object.keys(secondCreateBody).sort()).toEqual([
      "baseUrl",
      "capabilities",
      "contextWindowTokens",
      "model",
      "provider",
      "title",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Test Connection" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/ai/model-profiles/${secondModelProfileId}/test`,
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByText("Connection ok.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Fetch Models" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/ai/model-profiles/${secondModelProfileId}/models`,
        expect.objectContaining({ method: "GET" }),
      );
    });
    fireEvent.click(await screen.findByRole("button", { name: /Fetched Long Context/i }));
    expect(screen.getByLabelText("Model id")).toHaveProperty("value", "fetched-long-context-model");
    expect(await screen.findByText("Model selected. Save the setting to use it.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Service key"), { target: { value: "openai-key-two" } });
    fireEvent.click(screen.getByRole("button", { name: "Save / Replace Key" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/ai/model-profiles/${secondModelProfileId}/credential`,
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByText("Service key stored and verified.")).toBeTruthy();
    expect((await screen.findAllByText("Saved in the system credential store.")).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain("openai-key-two");

    fireEvent.change(screen.getByLabelText("Setting name"), { target: { value: "OpenAI Drafting Updated" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Setting" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/ai/model-profiles/${secondModelProfileId}`,
        expect.objectContaining({ method: "PUT" }),
      );
    });
    const updateCalls = fetchMock.mock.calls.filter(([url, init]) => (
      url === `/api/v1/ai/model-profiles/${secondModelProfileId}` && init?.method === "PUT"
    ));
    const updateBody = JSON.parse(String(updateCalls.at(-1)?.[1]?.body));
    expect(updateBody).toMatchObject({ title: "OpenAI Drafting Updated" });
    expect(updateBody).not.toHaveProperty("credentialRef");
    expect(await screen.findByText("Model setting saved.")).toBeTruthy();
    expect((await screen.findAllByText("Saved in the system credential store.")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Delete Key" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/ai/model-profiles/${secondModelProfileId}/credential`,
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    expect(await screen.findByText("Service key removed.")).toBeTruthy();
    expect((await screen.findAllByText("No service key saved for this model.")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Archive Setting" }));
    expect(screen.getByText("Archive this setting?")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Archive Setting" }).at(-1)!);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/ai/model-profiles/${secondModelProfileId}`,
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    expect(await screen.findByText("Model setting archived.")).toBeTruthy();
    expect(screen.getByText("DeepSeek Writing")).toBeTruthy();
  });

  it("saves a global model setting and service key without opening a project", async () => {
    const fetchMock = mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Settings" }));

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeTruthy();
    expect(await screen.findByText("Shared across all projects")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Test Connection" })).toHaveProperty("disabled", false);
    expect(screen.getByRole("button", { name: "Fetch Models" })).toHaveProperty("disabled", false);
    expect(screen.getByRole("button", { name: "Save / Replace Key" })).toHaveProperty("disabled", false);

    fireEvent.change(screen.getByLabelText("Setting name"), { target: { value: "DeepSeek Global" } });
    fireEvent.input(screen.getByLabelText("Service key"), { target: { value: "sk-global-real-key-1234567890" } });
    fireEvent.click(screen.getByRole("button", { name: "Save / Replace Key" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/ai/model-profiles",
        expect.objectContaining({ method: "POST" }),
      );
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/ai/model-profiles/${modelProfileId}/credential`,
        expect.objectContaining({ method: "POST" }),
      );
    });
    const createCalls = fetchMock.mock.calls.filter(([url, init]) => (
      url === "/api/v1/ai/model-profiles" && init?.method === "POST"
    ));
    expect(JSON.parse(String(createCalls.at(-1)?.[1]?.body))).toMatchObject({
      provider: "deepseek",
      title: "DeepSeek Global",
    });
    const oldSeriesScopedModelRouteCalled = fetchMock.mock.calls.some(([url]) => {
      const value = String(url);
      return value.includes(`/api/v1/series/${seriesId}/ai/`) && value.includes(["model", "profiles"].join("-"));
    });
    expect(oldSeriesScopedModelRouteCalled).toBe(false);
    expect(await screen.findByText("Service key stored and verified.")).toBeTruthy();
    expect((await screen.findAllByText("Saved in the system credential store.")).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain("sk-global-real-key-1234567890");
  });

  it("keeps large provider model lists collapsed until the user opens them", async () => {
    const fetchMock = mockFetch({
      initialModelProfiles: [modelProfile({
        baseUrl: "https://api.deepseek.com",
        credentialRef: `novel-studio/model-profile/${modelProfileId}`,
        model: "deepseek-v4-flash",
        provider: "deepseek",
        title: "DeepSeek Saved",
      })],
      providerModelCount: 20,
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
    expect((await screen.findAllByText("Saved in the system credential store.")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Fetch Models" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/ai/model-profiles/${modelProfileId}/models`,
        expect.objectContaining({ method: "GET" }),
      );
    });

    expect(await screen.findByText("20 models available.")).toBeTruthy();
    expect(screen.queryByText("Provider Model 20")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show Models" }));
    expect(await screen.findByLabelText("Provider model list")).toBeTruthy();
    expect(await screen.findByText("Provider Model 20")).toBeTruthy();
  });

  it("connects Review to the Proposal inbox and opens exact Proposal links", async () => {
    const fetchMock = mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    await screen.findByLabelText("Scene title");

    expect(screen.queryByRole("button", { name: "Review Draft" })).toBeNull();
    expect(screen.getByLabelText("Search unavailable")).toHaveProperty("disabled", true);
    expect(screen.queryByText("18")).toBeNull();
    expect(screen.queryByText("128")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(await screen.findByRole("heading", { name: "Review" })).toBeTruthy();
    await waitFor(() => {
      expect(screen.getAllByText("Replace chase beat with continuity-safe escalation").length).toBeGreaterThan(0);
    });
    expect(fetchMock.mock.calls.some(([url]) =>
      String(url) === `/api/v1/series/${seriesId}/review/proposals`,
    )).toBe(true);

    expect(screen.queryByRole("button", { name: "Preview Batch" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Batch Review" })).toBeNull();
    expect(screen.queryByText("Impact")).toBeNull();
    expect(screen.queryByText("Proposal inbox")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Replace chase beat with continuity-safe escalation/u }));
    expect(window.location.hash).toBe(`#/review/proposals/${proposalId}`);
    expect(screen.getByText("Before / After")).toBeTruthy();
    expect(screen.getByText("Captain Veyr shouted from the far arch, already knowing her name.")).toBeTruthy();
    expect(screen.getAllByText("Captain Veyr was not in the arcade. That mattered.").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Accept" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit and Accept" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reject" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mark Stale" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/review/proposals/${proposalId}/reject`,
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByText("No pending changes")).toBeTruthy();
  });

  it("shows a recoverable Review state when a Workshop source message is unavailable", async () => {
    const unavailableProposal = proposalDocument("pending", {
      source: {
        kind: "workshop-message" as const,
        sourceId: "98989898-9898-4898-9898-989898989898",
        label: "Missing source thread",
        detail: "",
      },
      sourceAvailability: {
        available: false,
        reason: "Workshop message does not exist",
      },
    });
    const fetchMock = mockFetch({ initialProposals: [unavailableProposal] });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Open Glass Harbor/i }));
    expect(await screen.findByRole("heading", { name: "Write" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(await screen.findByText("Workshop message does not exist")).toBeTruthy();
    const unavailableButton = screen.getByRole("button", { name: "Source unavailable" });
    expect(unavailableButton).toHaveProperty("disabled", true);
    expect(screen.queryByRole("button", { name: "Go to Chat" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mark Stale" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/review/proposals/${unavailableProposal.proposal.id}/mark-stale`,
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("keeps Workshop chat messages in one broad readable column", () => {
    const stackRule = cssRule(workshopWorkspaceCss, ".workshop-chat .message-stack");
    const messageRule = cssRule(workshopWorkspaceCss, ".message");
    const userMessageRule = cssRule(workshopWorkspaceCss, ".message.user");
    const reasoningRule = cssRule(workshopWorkspaceCss, ".message-reasoning p");

    expect(stackRule).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(messageRule).toContain("width: 100%;");
    expect(messageRule).toContain("max-width: none;");
    expect(messageRule).toContain("font-size: 16px;");
    expect(messageRule).toContain("line-height: 1.68;");
    expect(userMessageRule).toContain("justify-self: stretch;");
    expect(userMessageRule).toContain("width: 100%;");
    expect(userMessageRule).not.toContain("justify-self: end;");
    expect(userMessageRule).not.toContain("52%");
    expect(reasoningRule).toContain("font-size: 14px;");
    expect(reasoningRule).toContain("line-height: 22px;");
  });

  it("connects Workshop sessions, context basket, and single-role calls without exposing audit IDs", async () => {
    const fetchMock = mockFetch({ initialModelProfiles: [modelProfile()] });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Open Glass Harbor/i }));
    expect(await screen.findByRole("heading", { name: "Write" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Workshop" }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) =>
        String(url) === `/api/v1/series/${seriesId}/workshop/sessions`,
      )).toBe(true);
    });
    expect(await screen.findByRole("heading", { name: "Workshop" })).toBeTruthy();
    const workshopPage = document.querySelector("#workshop-page") as HTMLElement;
    expect(screen.queryByText("Not connected")).toBeNull();
    expect(screen.queryByText("Context Basket")).toBeNull();
    expect(screen.queryByRole("button", { name: "Preview Context" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Model selector" })).toBeNull();
    expect(screen.queryByRole("button", { name: "System Prompt" })).toBeNull();
    fireEvent.click(within(workshopPage).getByRole("button", { name: "Call Settings" }));
    expect(await screen.findByRole("heading", { name: "Workshop settings" })).toBeTruthy();
    expect((screen.getByLabelText("Model setting") as HTMLSelectElement).value).toBe(modelProfileId);
    expect((screen.getByLabelText("Model") as HTMLSelectElement).value).toBe("mock-continuity-v1");
    fireEvent.click(screen.getByRole("button", { name: "Fetch Models" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/ai/model-profiles/${modelProfileId}/models`,
        expect.objectContaining({ method: "GET" }),
      );
    });
    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "fetched-long-context-model" },
    });
    expect((screen.getByLabelText("Model") as HTMLSelectElement).value).toBe("fetched-long-context-model");
    expect(screen.queryByLabelText("Mode")).toBeNull();
    fireEvent.click(screen.getByLabelText("Stream output"));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    const sessionsPanel = screen.getByText("Conversation branches").closest(".panel");
    expect(sessionsPanel).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add session" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Chat/u }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/workshop/sessions`,
        expect.objectContaining({ method: "POST" }),
      );
    });
    const createCall = fetchMock.mock.calls.find(([url, init]) =>
      String(url) === `/api/v1/series/${seriesId}/workshop/sessions` &&
      (init as RequestInit | undefined)?.method === "POST",
    );
    expect(JSON.parse(String((createCall?.[1] as RequestInit | undefined)?.body))).toMatchObject({
      kind: "chat",
    });
    await waitFor(() => {
      expect(screen.getAllByText("New chat").length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(await screen.findByRole("button", { name: "Context" }));
    expect(screen.queryByLabelText("Context source")).toBeNull();
    fireEvent.click(await screen.findByRole("tab", { name: /^Structure/u }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Scenes/u }));
    expect(fetchMock.mock.calls.some(([url, init]) =>
      String(url) === `/api/v1/series/${seriesId}/workshop/sessions/${workshopSessionId}/context-basket` &&
      (init as RequestInit | undefined)?.method === "PUT",
    )).toBe(false);
    expect(screen.getByText("Opening Scene")).toBeTruthy();
    expect(screen.queryByText("Current scene")).toBeNull();
    fireEvent.click(screen.getByRole("menuitem", { name: /Opening Scene/u }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/workshop/sessions/${workshopSessionId}/context-basket`,
        expect.objectContaining({ method: "PUT" }),
      );
    });

    fireEvent.change(screen.getByLabelText("Workshop message"), {
      target: { value: "Check continuity for the opening scene." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/workshop/sessions/${workshopSessionId}/calls`,
        expect.objectContaining({ method: "POST" }),
      );
    });
    const callRequest = fetchMock.mock.calls.find(([url, init]) =>
      String(url) === `/api/v1/series/${seriesId}/workshop/sessions/${workshopSessionId}/calls` &&
      (init as RequestInit | undefined)?.method === "POST",
    );
    expect(JSON.parse(String((callRequest?.[1] as RequestInit | undefined)?.body)).modelOverride).toBe(
      "fetched-long-context-model",
    );
    expect(JSON.parse(String((callRequest?.[1] as RequestInit | undefined)?.body))).toMatchObject({
      mode: "general-chat",
      taskKind: "analysis",
    });
    expect(await screen.findByText("Workshop model response.")).toBeTruthy();
    expect(screen.queryByText(workshopModelCallId)).toBeNull();
    expect(screen.queryByText(workshopContextBundleId)).toBeNull();
    expect(screen.queryByRole("button", { name: "Create Proposal" })).toBeNull();
  });

  it("runs Workshop Agent sessions without scene Proposal actions", async () => {
    const fetchMock = mockFetch({
      initialModelProfiles: [modelProfile()],
      initialWorkshopSessions: [workshopSession({ id: workshopSessionId, kind: "agent", title: "Agent drafting" })],
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Open Glass Harbor/i }));
    expect(await screen.findByRole("heading", { name: "Write" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Workshop" }));
    expect(await screen.findByRole("heading", { name: "Workshop" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Workshop message"), {
      target: { value: "Draft a Codex entry for the blue-salt key." },
    });
    const sendButton = screen.getByRole("button", { name: "Send" });
    await waitFor(() => {
      expect(sendButton).toHaveProperty("disabled", false);
    });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/workshop/sessions/${workshopSessionId}/calls/stream`,
        expect.objectContaining({ method: "POST" }),
      );
    });
    const callRequest = fetchMock.mock.calls.find(([url, init]) =>
      String(url) === `/api/v1/series/${seriesId}/workshop/sessions/${workshopSessionId}/calls/stream` &&
      (init as RequestInit | undefined)?.method === "POST",
    );
    const body = JSON.parse(String((callRequest?.[1] as RequestInit | undefined)?.body));
    expect(body).toMatchObject({
      mode: "agent",
      roleId: "researcher",
      taskKind: "research",
      promptTemplateId: "00000000-0000-4000-8000-000000000411",
      systemPrompt: "",
    });
    expect(await screen.findByText("Workshop model response.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Create Proposal" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Resend" })).toBeNull();
  });

  it("confirms missing Workshop Agent codex.create_entry detail type creation before writing entries", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    const fetchMock = mockFetch({
      initialModelProfiles: [modelProfile()],
      initialWorkshopSessions: [workshopSession({ id: workshopSessionId, kind: "agent", title: "Agent drafting" })],
      initialWorkshopMessages: [{
        schemaVersion: 1,
        id: "98989898-9898-4898-9898-989898989898",
        seriesId,
        sessionId: workshopSessionId,
        role: "tool",
        mode: "agent",
        status: "succeeded",
        content: JSON.stringify({
          schemaVersion: 1,
          tool: "codex.create_entry",
          draft: {
            aliases: [],
            categoryId: "character",
            description: "Alice is alive.",
            details: [{ label: "Looks", value: "Blonde hair." }],
            name: "Alice",
            research: "Author decision recorded in this Agent session.",
          },
        }),
        reasoningContent: "",
        contextBundleId: null,
        modelCallId: null,
        proposalIds: [],
        attachmentIds: [],
        errorCode: null,
        errorMessage: null,
        createdAt: "2026-07-01T00:12:00.000Z",
      }],
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Open Glass Harbor/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Workshop" }));
    expect(await screen.findByText("codex.create_entry")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Confirm Tool Call" }));
    expect(await screen.findByText("Create Missing Detail Types")).toBeTruthy();
    expect(screen.getByText("Will create")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create Detail Types and Run Tool" }));

    await waitFor(() => {
      const applyCall = fetchMock.mock.calls.find(([url, init]) => (
        String(url) === `/api/v1/series/${seriesId}/workshop/sessions/${workshopSessionId}/messages/98989898-9898-4898-9898-989898989898/tools/codex.create_entry/execute` &&
        (init as RequestInit | undefined)?.method === "POST" &&
        JSON.parse(String((init as RequestInit).body)).createMissingDetailTypes === true
      ));
      expect(applyCall).toBeTruthy();
      expect(JSON.parse(String((applyCall![1] as RequestInit).body))).toMatchObject({
        confirm: true,
        createMissingDetailTypes: true,
      });
    });
    expect(await screen.findByText("Created Codex entry: Alice")).toBeTruthy();
    expect(await screen.findByText("codex.create_entry created Codex entry: Alice")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Create Proposal" })).toBeNull();
  });

  it("auto-names new Workshop chats and lets authors rename sessions", async () => {
    const fetchMock = mockFetch({
      initialModelProfiles: [modelProfile()],
      initialWorkshopSessions: [workshopSession({ id: workshopSessionId, title: "New chat" })],
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Open Glass Harbor/i }));
    expect(await screen.findByRole("heading", { name: "Write" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Workshop" }));
    expect(await screen.findByRole("heading", { name: "Workshop" })).toBeTruthy();
    const sessionsPanel = screen.getByText("Conversation branches").closest(".panel") as HTMLElement;
    expect(within(sessionsPanel).getByText("New chat")).toBeTruthy();

    const messageInput = screen.getByLabelText("Workshop message");
    fireEvent.change(messageInput, {
      target: { value: "Map the opening conflict." },
    });
    fireEvent.keyDown(messageInput, { code: "Enter", key: "Enter" });
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url, init]) =>
        String(url) === `/api/v1/series/${seriesId}/workshop/sessions/${workshopSessionId}` &&
        (init as RequestInit | undefined)?.method === "PUT" &&
        JSON.parse(String((init as RequestInit).body)).title === "Map the opening conflict.",
      )).toBe(true);
    });
    expect(await within(sessionsPanel).findByText("Map the opening conflict.")).toBeTruthy();

    fireEvent.doubleClick(within(sessionsPanel).getByText("Map the opening conflict."));
    const titleInput = within(sessionsPanel).getByLabelText("Session title");
    fireEvent.change(titleInput, {
      target: { value: "Opening conflict options" },
    });
    fireEvent.keyDown(titleInput, { code: "Enter", key: "Enter" });
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url, init]) =>
        String(url) === `/api/v1/series/${seriesId}/workshop/sessions/${workshopSessionId}` &&
        (init as RequestInit | undefined)?.method === "PUT" &&
        JSON.parse(String((init as RequestInit).body)).title === "Opening conflict options",
      )).toBe(true);
    });
    expect(await within(sessionsPanel).findByText("Opening conflict options")).toBeTruthy();
  });

  it("branches Workshop chats with copied message history", async () => {
    const sourceSession = workshopSession({ id: workshopSessionId, title: "Source thread" });
    const fetchMock = mockFetch({
      initialModelProfiles: [modelProfile()],
      initialWorkshopSessions: [sourceSession],
      initialWorkshopMessages: [{
        schemaVersion: 1,
        id: "91919191-9191-4191-9191-919191919191",
        seriesId,
        sessionId: workshopSessionId,
        role: "author",
        mode: "general-chat",
        status: "succeeded",
        content: "Original branch question.",
        reasoningContent: "",
        contextBundleId: null,
        modelCallId: null,
        proposalIds: [],
        attachmentIds: [],
        errorCode: null,
        errorMessage: null,
        createdAt: "2026-07-01T00:10:00.000Z",
      }, {
        schemaVersion: 1,
        id: "92929292-9292-4292-9292-929292929292",
        seriesId,
        sessionId: workshopSessionId,
        role: "assistant",
        mode: "general-chat",
        status: "succeeded",
        content: "Original branch answer.",
        reasoningContent: "",
        contextBundleId: workshopContextBundleId,
        modelCallId: workshopModelCallId,
        proposalIds: [],
        attachmentIds: [],
        errorCode: null,
        errorMessage: null,
        createdAt: "2026-07-01T00:10:01.000Z",
      }],
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Open Glass Harbor/i }));
    expect(await screen.findByRole("heading", { name: "Write" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Workshop" }));
    expect(await screen.findByRole("heading", { name: "Workshop" })).toBeTruthy();
    expect(await screen.findByText("Original branch question.")).toBeTruthy();
    expect(await screen.findByText("Original branch answer.")).toBeTruthy();

    const sessionsPanel = screen.getByText("Conversation branches").closest(".panel") as HTMLElement;
    fireEvent.click(screen.getByRole("button", { name: "Session actions" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Branch" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/workshop/sessions/${workshopSessionId}/branch`,
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await within(sessionsPanel).findByText("Source thread branch")).toBeTruthy();
    expect(await screen.findByText("Original branch question.")).toBeTruthy();
    expect(await screen.findByText("Original branch answer.")).toBeTruthy();
  });

  it("exports Workshop sessions with the selected reasoning option", async () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const createObjectURL = vi.fn((blob: Blob) => {
      void blob;
      return "blob:workshop-export";
    });
    const revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    try {
      const otherWorkshopSessionId = "13131313-1313-4131-8131-131313131313";
      const fetchMock = mockFetch({
        initialModelProfiles: [modelProfile()],
        initialWorkshopSessions: [
          workshopSession({ id: workshopSessionId, title: "Export thread" }),
          workshopSession({ id: otherWorkshopSessionId, title: "Other export thread" }),
        ],
        initialWorkshopAttachments: [workshopAttachment({
          id: workshopAttachmentId,
          sessionId: workshopSessionId,
          messageId: "91919191-9191-4191-9191-919191919191",
          fileName: "export-secret.txt",
          mediaType: "text/plain",
          sizeBytes: 44,
          extractedText: "Attachment export body must not appear.",
        })],
        initialWorkshopMessages: [{
          schemaVersion: 1,
          id: "91919191-9191-4191-9191-919191919191",
          seriesId,
          sessionId: workshopSessionId,
          role: "author",
          mode: "general-chat",
          status: "succeeded",
          content: "Original export request.",
          reasoningContent: "",
          contextBundleId: null,
          modelCallId: null,
          proposalIds: [],
          attachmentIds: [workshopAttachmentId],
          errorCode: null,
          errorMessage: null,
          createdAt: "2026-07-01T00:10:00.000Z",
        }, {
          schemaVersion: 1,
          id: "92929292-9292-4292-9292-929292929292",
          seriesId,
          sessionId: workshopSessionId,
          role: "assistant",
          mode: "general-chat",
          status: "succeeded",
          content: "Exported answer.",
          reasoningContent: "Checked the selected context before answering.",
          contextBundleId: workshopContextBundleId,
          modelCallId: workshopModelCallId,
          proposalIds: [],
          attachmentIds: [],
          errorCode: null,
          errorMessage: null,
          createdAt: "2026-07-01T00:11:00.000Z",
        }, {
          schemaVersion: 1,
          id: "96969696-9696-4696-9696-969696969696",
          seriesId,
          sessionId: otherWorkshopSessionId,
          role: "author",
          mode: "general-chat",
          status: "succeeded",
          content: "Other session export leak text.",
          reasoningContent: "",
          contextBundleId: null,
          modelCallId: null,
          proposalIds: [],
          attachmentIds: [],
          errorCode: null,
          errorMessage: null,
          createdAt: "2026-07-01T00:12:00.000Z",
        }],
      });
      render(<App />);

      fireEvent.click(await screen.findByRole("button", { name: /Open Glass Harbor/i }));
      expect(await screen.findByRole("heading", { name: "Write" })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Workshop" }));
      expect(await screen.findByRole("heading", { name: "Workshop" })).toBeTruthy();
      expect(await screen.findByText("Original export request.")).toBeTruthy();
      const sessionsPanel = screen.getByText("Conversation branches").closest(".panel") as HTMLElement;
      expect(within(sessionsPanel).getByText("Export thread")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Session actions" }));
      const includeReasoning = screen.getByLabelText("Include reasoning") as HTMLInputElement;
      const includePromptAudit = screen.getByLabelText("Include prompt audit") as HTMLInputElement;
      expect(includeReasoning.checked).toBe(false);
      expect(includePromptAudit.checked).toBe(false);
      const exportButton = screen.getByRole("menuitem", { name: "Export" }) as HTMLButtonElement;
      await waitFor(() => {
        expect(exportButton.disabled).toBe(false);
      });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          `/api/v1/series/${seriesId}/workshop/sessions/${workshopSessionId}/export?includePromptAudit=false&includeReasoning=false`,
          expect.objectContaining({ method: "GET" }),
        );
        expect(createObjectURL).toHaveBeenCalled();
      });
      const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
      const markdown = await blob.text();
      const bytes = new Uint8Array(await blob.arrayBuffer());
      expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
      expect(markdown).toContain("export-secret.txt (parsed, text/plain, 44 bytes)");
      expect(markdown).not.toContain("Reasoning:");
      expect(markdown).not.toContain("Provider Prompt:");
      expect(markdown).not.toContain("Attachment export body must not appear.");
      expect(markdown).not.toContain("Other session export leak text.");
      await waitFor(() => {
        expect(exportButton.disabled).toBe(false);
      });
      fireEvent.click(includeReasoning);
      fireEvent.click(includePromptAudit);
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          `/api/v1/series/${seriesId}/workshop/sessions/${workshopSessionId}/export?includePromptAudit=true&includeReasoning=true`,
          expect.objectContaining({ method: "GET" }),
        );
        expect(createObjectURL).toHaveBeenCalledTimes(2);
      });
      const auditedBlob = createObjectURL.mock.calls[1]?.[0] as Blob;
      const auditedMarkdown = await auditedBlob.text();
      const auditedBytes = new Uint8Array(await auditedBlob.arrayBuffer());
      expect(Array.from(auditedBytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
      expect(auditedMarkdown).toContain("Reasoning:");
      expect(auditedMarkdown).toContain("Checked the selected context before answering.");
      expect(auditedMarkdown).toContain("Provider Prompt:");
      expect(auditedMarkdown).not.toContain("Attachment export body must not appear.");
      expect(auditedMarkdown).not.toContain("Other session export leak text.");
      expect(clickSpy).toHaveBeenCalled();
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:workshop-export");
    } finally {
      clickSpy.mockRestore();
      if (originalCreateObjectURL) {
        Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectURL });
      } else {
        Reflect.deleteProperty(URL, "createObjectURL");
      }
      if (originalRevokeObjectURL) {
        Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectURL });
      } else {
        Reflect.deleteProperty(URL, "revokeObjectURL");
      }
    }
  });

  it("edits and resends previous General Chat author messages by replacing later history", async () => {
    const firstMessageId = "91919191-9191-4191-9191-919191919191";
    const oldAnswerId = "92929292-9292-4292-9292-929292929292";
    const laterMessageId = "93939393-9393-4393-8393-939393939391";
    const laterAnswerId = "94949494-9494-4494-8494-949494949492";
    const fetchMock = mockFetch({
      initialModelProfiles: [modelProfile()],
      initialWorkshopSessions: [workshopSession({ id: workshopSessionId, title: "Resend thread" })],
      initialWorkshopAttachments: [workshopAttachment({
        id: workshopAttachmentId,
        sessionId: workshopSessionId,
        messageId: laterMessageId,
        fileName: "old-note.md",
      })],
      initialWorkshopMessages: [{
        schemaVersion: 1,
        id: firstMessageId,
        seriesId,
        sessionId: workshopSessionId,
        role: "author",
        mode: "general-chat",
        status: "succeeded",
        content: "Original request.",
        reasoningContent: "",
        contextBundleId: null,
        modelCallId: null,
        proposalIds: [],
        attachmentIds: [],
        errorCode: null,
        errorMessage: null,
        createdAt: "2026-07-01T00:10:00.000Z",
      }, {
        schemaVersion: 1,
        id: oldAnswerId,
        seriesId,
        sessionId: workshopSessionId,
        role: "assistant",
        mode: "general-chat",
        status: "succeeded",
        content: "Old answer.",
        reasoningContent: "",
        contextBundleId: workshopContextBundleId,
        modelCallId: workshopModelCallId,
        proposalIds: [],
        attachmentIds: [],
        errorCode: null,
        errorMessage: null,
        createdAt: "2026-07-01T00:10:01.000Z",
      }, {
        schemaVersion: 1,
        id: laterMessageId,
        seriesId,
        sessionId: workshopSessionId,
        role: "author",
        mode: "general-chat",
        status: "succeeded",
        content: "Later request.",
        reasoningContent: "",
        contextBundleId: null,
        modelCallId: null,
        proposalIds: [],
        attachmentIds: [workshopAttachmentId],
        errorCode: null,
        errorMessage: null,
        createdAt: "2026-07-01T00:10:02.000Z",
      }, {
        schemaVersion: 1,
        id: laterAnswerId,
        seriesId,
        sessionId: workshopSessionId,
        role: "assistant",
        mode: "general-chat",
        status: "succeeded",
        content: "Later answer.",
        reasoningContent: "",
        contextBundleId: workshopContextBundleId,
        modelCallId: workshopModelCallId,
        proposalIds: [],
        attachmentIds: [],
        errorCode: null,
        errorMessage: null,
        createdAt: "2026-07-01T00:10:03.000Z",
      }],
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Open Glass Harbor/i }));
    expect(await screen.findByRole("heading", { name: "Write" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Workshop" }));
    expect(await screen.findByRole("heading", { name: "Workshop" })).toBeTruthy();
    expect(await screen.findByText("Original request.")).toBeTruthy();
    expect(screen.getByText("Old answer.")).toBeTruthy();
    expect(screen.getByText("Later request.")).toBeTruthy();
    expect(screen.getByText("Later answer.")).toBeTruthy();
    expect(screen.getByText("old-note.md")).toBeTruthy();

    const firstArticle = screen.getByText("Original request.").closest("article") as HTMLElement;
    fireEvent.click(within(firstArticle).getByRole("button", { name: "Message actions" }));
    fireEvent.click(await within(firstArticle).findByRole("menuitem", { name: "Edit" }));
    fireEvent.change(within(firstArticle).getByLabelText("Edit message"), {
      target: { value: "Updated request." },
    });
    fireEvent.click(within(firstArticle).getByRole("button", { name: "Resend" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/workshop/sessions/${workshopSessionId}/messages/${firstMessageId}/resend`,
        expect.objectContaining({ method: "POST" }),
      );
    });
    const resendCall = fetchMock.mock.calls.find(([url, init]) =>
      String(url) === `/api/v1/series/${seriesId}/workshop/sessions/${workshopSessionId}/messages/${firstMessageId}/resend` &&
      (init as RequestInit | undefined)?.method === "POST",
    );
    expect(JSON.parse(String((resendCall?.[1] as RequestInit | undefined)?.body))).toMatchObject({
      content: "Updated request.",
      modelProfileId,
      promptTemplateId: "00000000-0000-4000-8000-000000000401",
      taskKind: "analysis",
    });
    expect(await screen.findByText("Updated request.")).toBeTruthy();
    expect(await screen.findByText("Workshop model response.")).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText("Original request.")).toBeNull();
      expect(screen.queryByText("Old answer.")).toBeNull();
      expect(screen.queryByText("Later request.")).toBeNull();
      expect(screen.queryByText("Later answer.")).toBeNull();
      expect(screen.queryByText("old-note.md")).toBeNull();
    });
  });

  it("shows the author message immediately and keeps General Chat out of Proposal creation", async () => {
    const fetchMock = mockFetch({
      initialModelProfiles: [modelProfile()],
      initialWorkshopSessions: [workshopSession({ id: workshopSessionId, title: "General chat thread" })],
      workshopCallDelayMs: 80,
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Open Glass Harbor/i }));
    expect(await screen.findByRole("heading", { name: "Write" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Workshop" }));
    expect(await screen.findByRole("heading", { name: "Workshop" })).toBeTruthy();
    const workshopPage = document.querySelector("#workshop-page") as HTMLElement;
    fireEvent.click(within(workshopPage).getByRole("button", { name: "Call Settings" }));
    expect(await screen.findByRole("heading", { name: "Workshop settings" })).toBeTruthy();
    expect(screen.queryByLabelText("Mode")).toBeNull();
    expect((screen.getByLabelText("Stream output") as HTMLInputElement).checked).toBe(true);
    fireEvent.change(screen.getByLabelText("General Chat system prompt"), {
      target: { value: "Answer as a context-aware story consultant." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    const attachmentInput = screen.getByLabelText("Choose Workshop attachment") as HTMLInputElement;
    const attachButton = within(workshopPage).getByRole("button", { name: "Attach file" }) as HTMLButtonElement;
    await waitFor(() => {
      expect(attachButton.disabled).toBe(false);
    });
    const attachmentClick = vi.spyOn(attachmentInput, "click");
    fireEvent.click(attachButton);
    expect(attachmentClick).toHaveBeenCalled();
    const attachmentFile = new File(["Attachment note for this request."], "draft.md", {
      type: "text/markdown",
    });
    fireEvent.change(attachmentInput, {
      target: { files: [attachmentFile] },
    });
    expect(await screen.findByText("draft.md")).toBeTruthy();
    expect(await screen.findByText("Ready")).toBeTruthy();
    const attachmentUpload = fetchMock.mock.calls.find(([url, init]) =>
      String(url) === `/api/v1/series/${seriesId}/workshop/sessions/${workshopSessionId}/attachments` &&
      (init as RequestInit | undefined)?.method === "POST",
    );
    expect(JSON.parse(String((attachmentUpload?.[1] as RequestInit | undefined)?.body))).toMatchObject({
      fileName: "draft.md",
      mediaType: "text/markdown",
      sizeBytes: attachmentFile.size,
    });
    const messageInput = screen.getByLabelText("Workshop message");
    fireEvent.change(messageInput, {
      target: { value: "Talk through the current scene options." },
    });
    const callsBeforeCtrlEnter = fetchMock.mock.calls.length;
    fireEvent.keyDown(messageInput, { code: "Enter", ctrlKey: true, key: "Enter" });
    expect(fetchMock.mock.calls).toHaveLength(callsBeforeCtrlEnter);
    fireEvent.keyDown(messageInput, { code: "Enter", key: "Enter" });

    expect(screen.getByText("Talk through the current scene options.")).toBeTruthy();
    expect(screen.queryByText("Workshop model response.")).toBeNull();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/workshop/sessions/${workshopSessionId}/calls/stream`,
        expect.objectContaining({ method: "POST" }),
      );
    });
    const callRequest = fetchMock.mock.calls.find(([url, init]) =>
      String(url) === `/api/v1/series/${seriesId}/workshop/sessions/${workshopSessionId}/calls/stream` &&
      (init as RequestInit | undefined)?.method === "POST",
    );
    expect(JSON.parse(String((callRequest?.[1] as RequestInit | undefined)?.body))).toMatchObject({
      mode: "general-chat",
      attachmentIds: [workshopAttachmentId],
      systemPrompt: "Answer as a context-aware story consultant.",
      taskKind: "analysis",
      userRequest: "Talk through the current scene options.",
    });
    expect(JSON.parse(String((callRequest?.[1] as RequestInit | undefined)?.body)))
      .not.toHaveProperty("base64Content");

    expect(await screen.findByText("Workshop model response.")).toBeTruthy();
    expect(screen.getAllByText("Talk through the current scene options.")).toHaveLength(1);
    expect(screen.getAllByText("Workshop model response.")).toHaveLength(1);
    expect(screen.getByText("draft.md")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Create Proposal" })).toBeNull();
    expect(screen.getByText("Reasoning available")).toBeTruthy();
    const assistantArticle = screen.getByText("Workshop model response.").closest("article") as HTMLElement;
    fireEvent.click(within(assistantArticle).getByRole("button", { name: "Message actions" }));
    const showReasoning = await within(assistantArticle).findByRole("menuitem", { name: "Show Reasoning" });
    expect(showReasoning.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(showReasoning);
    expect(screen.getByText("Checked the selected context before answering.")).toBeTruthy();
    fireEvent.click(within(assistantArticle).getByRole("button", { name: "Message actions" }));
    const hideReasoning = await within(assistantArticle).findByRole("menuitem", { name: "Hide Reasoning" });
    expect(hideReasoning.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(hideReasoning);
    expect(screen.queryByText("Checked the selected context before answering.")).toBeNull();
    fireEvent.click(within(assistantArticle).getByRole("button", { name: "Message actions" }));
    fireEvent.click(await within(assistantArticle).findByRole("menuitem", { name: "Delete" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/workshop/sessions/${workshopSessionId}/messages/98989898-9898-4898-9898-989898989898`,
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    expect(screen.queryByText("Workshop model response.")).toBeNull();
    const authorArticle = screen.getByText("Talk through the current scene options.").closest("article") as HTMLElement;
    fireEvent.click(within(authorArticle).getByRole("button", { name: "Message actions" }));
    fireEvent.click(await within(authorArticle).findByRole("menuitem", { name: "Delete" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/workshop/sessions/${workshopSessionId}/messages/97979797-9797-4797-9797-979797979797`,
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    expect(screen.queryByText("draft.md")).toBeNull();
  });

  it("allows attachment-only Workshop sends and lets the author stop an in-flight call", async () => {
    const fetchMock = mockFetch({
      initialModelProfiles: [modelProfile()],
      initialWorkshopSessions: [workshopSession({ id: workshopSessionId, title: "Attachment-only thread" })],
      workshopCallDelayMs: 120,
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Open Glass Harbor/i }));
    expect(await screen.findByRole("heading", { name: "Write" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Workshop" }));
    expect(await screen.findByRole("heading", { name: "Workshop" })).toBeTruthy();

    const attachmentInput = screen.getByLabelText("Choose Workshop attachment") as HTMLInputElement;
    const attachButton = screen.getByRole("button", { name: "Attach file" }) as HTMLButtonElement;
    await waitFor(() => {
      expect(attachButton.disabled).toBe(false);
    });
    fireEvent.change(attachmentInput, {
      target: {
        files: [new File(["Attachment-only note."], "only-file.txt", { type: "text/plain" })],
      },
    });
    expect(await screen.findByText("only-file.txt")).toBeTruthy();
    expect(await screen.findByText("Ready")).toBeTruthy();

    const sendButton = screen.getByRole("button", { name: "Send" }) as HTMLButtonElement;
    expect(sendButton.disabled).toBe(false);
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/workshop/sessions/${workshopSessionId}/calls/stream`,
        expect.objectContaining({ method: "POST" }),
      );
    });
    const callRequest = fetchMock.mock.calls.find(([url, init]) =>
      String(url) === `/api/v1/series/${seriesId}/workshop/sessions/${workshopSessionId}/calls/stream` &&
      (init as RequestInit | undefined)?.method === "POST",
    );
    expect(JSON.parse(String((callRequest?.[1] as RequestInit | undefined)?.body))).toMatchObject({
      attachmentIds: [workshopAttachmentId],
      userRequest: "Review the attached files.",
    });

    expect(screen.getByText("Review the attached files.")).toBeTruthy();
    const stopButton = screen.getByRole("button", { name: "Stop" });
    expect((screen.getByRole("button", { name: "Sending" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Attach file" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(stopButton);

    expect(await screen.findByText("Sending stopped.")).toBeTruthy();
    expect(screen.queryByText("Workshop model response.")).toBeNull();
  });

  it("keeps an in-flight Workshop stream attached to its session while authors switch sessions", async () => {
    const otherSessionId = "8a8a8a8a-8a8a-4a8a-8a8a-8a8a8a8a8a8a";
    const fetchMock = mockFetch({
      initialModelProfiles: [modelProfile()],
      initialWorkshopSessions: [
        workshopSession({ id: workshopSessionId, title: "Streaming thread" }),
        workshopSession({ id: otherSessionId, title: "Other thread" }),
      ],
      workshopCallDelayMs: 2500,
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Open Glass Harbor/i }));
    expect(await screen.findByRole("heading", { name: "Write" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Workshop" }));
    expect(await screen.findByRole("heading", { name: "Workshop" })).toBeTruthy();
    const sessionsPanel = screen.getByText("Conversation branches").closest(".panel") as HTMLElement;

    fireEvent.change(screen.getByLabelText("Workshop message"), {
      target: { value: "Keep this partial answer visible." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/workshop/sessions/${workshopSessionId}/calls/stream`,
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(screen.getByText("Keep this partial answer visible.")).toBeTruthy();
    expect(screen.getByText("Writing...")).toBeTruthy();

    fireEvent.click(within(sessionsPanel).getByText("Other thread"));
    await waitFor(() => {
      expect(screen.queryByText("Keep this partial answer visible.")).toBeNull();
    });

    fireEvent.click(within(sessionsPanel).getByText("Streaming thread"));
    expect(await screen.findByText("Keep this partial answer visible.")).toBeTruthy();
    expect(await screen.findByText("Writing...")).toBeTruthy();
    expect(screen.queryByText("Workshop model response.")).toBeNull();
    expect(await screen.findByText("Workshop model response.", {}, { timeout: 3500 })).toBeTruthy();
  });

  it("keeps permanent Workshop session delete behind session actions and removes the session", async () => {
    const otherSessionId = "8b8b8b8b-8b8b-4b8b-8b8b-8b8b8b8b8b8b";
    const confirmDelete = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmDelete);
    const fetchMock = mockFetch({
      initialModelProfiles: [modelProfile()],
      initialWorkshopSessions: [
        workshopSession({ id: workshopSessionId, title: "Delete target" }),
        workshopSession({ id: otherSessionId, title: "Remaining thread" }),
      ],
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Open Glass Harbor/i }));
    expect(await screen.findByRole("heading", { name: "Write" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Workshop" }));
    expect(await screen.findByRole("heading", { name: "Workshop" })).toBeTruthy();
    const sessionsPanel = screen.getByText("Conversation branches").closest(".panel") as HTMLElement;
    expect(within(sessionsPanel).getByText("Delete target")).toBeTruthy();
    expect(within(sessionsPanel).queryByRole("menuitem", { name: "Delete permanently" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Session actions" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete permanently" }));

    await waitFor(() => {
      expect(confirmDelete).toHaveBeenCalledWith(
        "Delete this Workshop session permanently? Its messages and attachments will be removed.",
      );
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/workshop/sessions/${workshopSessionId}`,
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    await waitFor(() => {
      expect(within(sessionsPanel).queryByText("Delete target")).toBeNull();
    });
    expect(within(sessionsPanel).getByText("Remaining thread")).toBeTruthy();
  });

  it("renders Workshop context selection as nested scene and Codex menus", async () => {
    const fetchMock = mockFetch({
      initialSeriesDetail: seriesDetail("Mara Quill checked the old press initials."),
      initialCodexDetailTypes: [codexDetailTypeDocument("Private motive", "character", detailTypeId)],
      initialCodexEntries: [
        codexEntryDocument("Mara Quill", "character", "Reporter.", codexEntryId, {
          details: { [detailTypeId]: "Protects the press initials." },
        }),
      ],
      initialWorkshopSessions: [workshopSession({ id: workshopSessionId, title: "Nested context menu" })],
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Open Glass Harbor/i }));
    expect(await screen.findByRole("heading", { name: "Write" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Workshop" }));
    expect(await screen.findByRole("heading", { name: "Workshop" })).toBeTruthy();
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) =>
        String(url) === `/api/v1/series/${seriesId}/codex/entries`,
      )).toBe(true);
    });

    fireEvent.click(await screen.findByRole("button", { name: "Context" }));
    expect(screen.queryByLabelText("Context source")).toBeNull();
    expect(screen.queryByText("Selected context")).toBeNull();

    const contextBasketPutCalls = () => fetchMock.mock.calls.filter(([url, init]) =>
      String(url) === `/api/v1/series/${seriesId}/workshop/sessions/${workshopSessionId}/context-basket` &&
      (init as RequestInit | undefined)?.method === "PUT",
    );
    expect(await screen.findByRole("menuitem", { name: /^Full Novel Text/u })).toBeTruthy();
    expect(await screen.findByRole("menuitem", { name: /^Full Outline/u })).toBeTruthy();
    fireEvent.click(await screen.findByRole("tab", { name: /^Structure/u }));
    expect(await screen.findByRole("menuitem", { name: /^Acts/u })).toBeTruthy();
    expect(await screen.findByRole("menuitem", { name: /^Chapters/u })).toBeTruthy();
    fireEvent.click(await screen.findByRole("tab", { name: /^Story scope/u }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Full Novel Text/u }));
    await waitFor(() => {
      expect(contextBasketPutCalls()).toHaveLength(1);
    });
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Full Novel Text/u }));
    await waitFor(() => {
      expect(contextBasketPutCalls()).toHaveLength(2);
    });

    fireEvent.click(await screen.findByRole("tab", { name: /^Structure/u }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Acts/u }));
    expect(contextBasketPutCalls()).toHaveLength(2);
    fireEvent.click(await screen.findByRole("menuitem", { name: /Chapter One/u }));
    await waitFor(() => {
      expect(contextBasketPutCalls()).toHaveLength(3);
    });
    const actContextBody = JSON.parse(String((contextBasketPutCalls().at(-1)?.[1] as RequestInit).body));
    expect(actContextBody.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "act", sourceId: actId }),
      expect.objectContaining({ kind: "codex-entry", sourceId: codexEntryId, note: "Linked from selected context." }),
    ]));
    fireEvent.click(screen.getByRole("button", { name: /Acts/u }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Chapters/u }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /Act One/u }));
    await waitFor(() => {
      expect(contextBasketPutCalls()).toHaveLength(4);
    });

    fireEvent.click(screen.getByRole("button", { name: /Chapters/u }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Scenes/u }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /Opening Scene/u }));
    await waitFor(() => {
      expect(contextBasketPutCalls()).toHaveLength(5);
    });
    const sceneContextBody = JSON.parse(String((contextBasketPutCalls().at(-1)?.[1] as RequestInit).body));
    expect(sceneContextBody.sceneId).toBeUndefined();
    expect(sceneContextBody.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "scene", sourceId: sceneId }),
    ]));

    fireEvent.click(screen.getByRole("button", { name: /Scenes/u }));
    fireEvent.click(await screen.findByRole("tab", { name: /^Codex/u }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Codex Entries/u }));
    expect(contextBasketPutCalls()).toHaveLength(5);
    expect(await screen.findByRole("menuitem", { name: /Mara Quill/u })).toBeTruthy();
    expect(screen.getAllByText("Added").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Codex Entries/u }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Entries by Detail/u }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /Private motive/u }));
    expect(await screen.findByRole("menuitem", { name: /Mara Quill/u })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Private motive/u }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Entries by Category/u }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /Character/u }));
    expect(await screen.findByRole("menuitem", { name: /Mara Quill/u })).toBeTruthy();
  });

  it("shows Workshop proposal card states from Proposal authority", async () => {
    const stateProposalIds = {
      rejected: "11111111-2222-4333-8444-555555555555",
      edited: "11111111-2222-4333-8444-666666666666",
      stale: "11111111-2222-4333-8444-777777777777",
      superseded: "11111111-2222-4333-8444-888888888888",
      archived: "11111111-2222-4333-8444-999999999999",
      missing: "11111111-2222-4333-8444-000000000000",
    };
    mockFetch({
      initialProposals: [
        proposalDocument("rejected", { id: stateProposalIds.rejected, title: "Rejected proposal" }),
        proposalDocument("edited", { id: stateProposalIds.edited, title: "Edited proposal" }),
        proposalDocument("stale", { id: stateProposalIds.stale, title: "Stale proposal" }),
        proposalDocument("superseded", { id: stateProposalIds.superseded, title: "Superseded proposal" }),
        proposalDocument("archived", { id: stateProposalIds.archived, title: "Archived proposal" }),
      ],
      initialWorkshopMessages: [{
        schemaVersion: 1,
        id: "98989898-9898-4898-9898-989898989898",
        seriesId,
        sessionId: workshopSessionId,
        role: "assistant",
        status: "succeeded",
        content: "Workshop message with linked proposals.",
        contextBundleId: null,
        modelCallId: null,
        proposalIds: Object.values(stateProposalIds),
        errorCode: null,
        errorMessage: null,
        createdAt: "2026-07-01T00:20:00.000Z",
      }],
      initialWorkshopSessions: [workshopSession({ id: workshopSessionId, title: "Linked proposal states" })],
    });
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Open Glass Harbor/i }));
    expect(await screen.findByRole("heading", { name: "Write" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Workshop" }));

    expect(await screen.findByText("Rejected proposal")).toBeTruthy();
    expect(screen.getByText("Edited proposal")).toBeTruthy();
    expect(screen.getByText("Stale proposal")).toBeTruthy();
    expect(screen.getByText("Superseded proposal")).toBeTruthy();
    expect(screen.getByText("Archived proposal")).toBeTruthy();
    expect(screen.getByText("Proposal unavailable")).toBeTruthy();
    expect(screen.getAllByText("Rejected").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Edited").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Stale").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Superseded").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Archived").length).toBeGreaterThan(0);
  });

  it("loads and reorders the planning board after a project is selected", async () => {
    const fetchMock = mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Plan/i }));

    expect(await screen.findByRole("heading", { name: "Storyboard" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: /Opening Scene/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Move down" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/chapters/${chapterId}/scenes/reorder`,
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("collapses and expands the sidebar", async () => {
    mockFetch();
    render(<App />);

    await screen.findByRole("button", { name: /Glass Harbor/i });
    const collapse = screen.getByRole("button", { name: "Collapse sidebar" });
    fireEvent.click(collapse);

    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeTruthy();
  });
});
