// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { EditorView } from "@codemirror/view";
import type { Editor, JSONContent } from "@tiptap/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import type { SceneBlock, SceneBlockDocument } from "@novel-studio/contracts";
import { sceneBlockDocumentToNovelEditorDocument } from "../features/write/editor";

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
const customCategoryId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const relatedCodexEntryId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const relationId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const createdRelationId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const detailTypeId = "12121212-1212-4121-8121-121212121212";
const secondDetailTypeId = "23232323-2323-4232-8232-232323232323";
const progressionId = "34343434-3434-4434-8434-343434343434";
const secondProgressionId = "45454545-4545-4454-8545-454545454545";
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

function delayedJsonResponse(body: unknown, status = 200, delayMs = 0) {
  if (delayMs <= 0) return jsonResponse(body, status);
  return new Promise<Response>((resolve) => {
    window.setTimeout(() => {
      resolve(new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json" },
        status,
      }));
    }, delayMs);
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
      cloudPolicy: "local-only",
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
  cloudPolicy: "local-only" | "cloud-allowed";
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
    cloudPolicy: "local-only" as const,
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

function mockFetch(options: {
  conflictCodexUpdate?: boolean;
  codexUpdateDelayMs?: number;
  initialCodexEntries?: ReturnType<typeof codexEntryDocument>[];
  initialCodexDetailTypes?: ReturnType<typeof codexDetailTypeDocument>[];
  initialCodexProgressions?: ReturnType<typeof codexProgressionDocument>[];
  initialCodexRelations?: ReturnType<typeof codexRelationDocument>[];
  initialSeriesDetail?: ReturnType<typeof seriesDetail>;
  initialSeriesList?: ReturnType<typeof seriesSummary>[];
} = {}) {
  let detailOverride: ReturnType<typeof seriesDetail> | null = options.initialSeriesDetail ?? null;
  let seriesSummaries = options.initialSeriesList ?? [seriesSummary()];
  let codexCategoryDocs = codexCategories();
  let codexEntries: ReturnType<typeof codexEntryDocument>[] = options.initialCodexEntries ?? [];
  let codexDetailTypes: ReturnType<typeof codexDetailTypeDocument>[] = options.initialCodexDetailTypes ?? [];
  let codexProgressions: ReturnType<typeof codexProgressionDocument>[] = options.initialCodexProgressions ?? [];
  let codexRelations: ReturnType<typeof codexRelationDocument>[] = options.initialCodexRelations ?? [];
  let conflictCodexUpdate = options.conflictCodexUpdate ?? false;
  let modelProfiles: ReturnType<typeof modelProfile>[] = [];
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

    if (url === `/api/v1/series/${seriesId}/ai/cloud-policy` && method === "PUT") {
      const body = JSON.parse(String(init?.body));
      const current = detailOverride ?? seriesDetail();
      const manifest = { ...current.manifest, cloudPolicy: body.cloudPolicy };
      detailOverride = { ...current, manifest };
      return jsonResponse(manifest);
    }

    if (url === `/api/v1/series/${seriesId}/ai/model-profiles` && method === "GET") {
      return jsonResponse(modelProfiles);
    }

    if (url === `/api/v1/series/${seriesId}/ai/model-profiles` && method === "POST") {
      const body = JSON.parse(String(init?.body));
      const profile = modelProfile({
        baseUrl: body.baseUrl,
        capabilities: body.capabilities,
        cloudPolicy: body.cloudPolicy,
        contextWindowTokens: body.contextWindowTokens,
        model: body.model,
        provider: body.provider,
        title: body.title,
      });
      modelProfiles = [profile];
      return jsonResponse(profile, 201);
    }

    if (url === `/api/v1/series/${seriesId}/ai/model-profiles/${modelProfileId}` && method === "PUT") {
      const body = JSON.parse(String(init?.body));
      const current = modelProfiles.find((profile) => profile.id === modelProfileId) ?? modelProfile();
      const updated = modelProfile({ ...current, ...body });
      modelProfiles = modelProfiles.map((profile) => (profile.id === modelProfileId ? updated : profile));
      return jsonResponse(updated);
    }

    if (url === `/api/v1/series/${seriesId}/ai/model-profiles/${modelProfileId}` && method === "DELETE") {
      const current = modelProfiles.find((profile) => profile.id === modelProfileId) ?? modelProfile();
      const archived = modelProfile({
        ...current,
        archivedAt: "2026-06-25T00:00:00.000Z",
        credentialRef: null,
      });
      modelProfiles = modelProfiles.filter((profile) => profile.id !== modelProfileId);
      return jsonResponse(archived);
    }

    if (url === `/api/v1/series/${seriesId}/ai/model-profiles/${modelProfileId}/credential` && method === "POST") {
      const current = modelProfiles.find((profile) => profile.id === modelProfileId) ?? modelProfile();
      const updated = modelProfile({
        ...current,
        credentialRef: `novel-studio/model-profile/${seriesId}/${modelProfileId}`,
      });
      modelProfiles = modelProfiles.map((profile) => (profile.id === modelProfileId ? updated : profile));
      return jsonResponse({
        credentialRef: updated.credentialRef,
        modelProfile: updated,
        storeKind: "windows-credential-manager",
      });
    }

    if (url === `/api/v1/series/${seriesId}/ai/model-profiles/${modelProfileId}/credential` && method === "GET") {
      const current = modelProfiles.find((profile) => profile.id === modelProfileId) ?? modelProfile();
      return jsonResponse({
        credentialRef: current.credentialRef,
        exists: Boolean(current.credentialRef),
        modelProfile: current,
        storeKind: "windows-credential-manager",
      });
    }

    if (url === `/api/v1/series/${seriesId}/ai/model-profiles/${modelProfileId}/credential` && method === "DELETE") {
      const current = modelProfiles.find((profile) => profile.id === modelProfileId) ?? modelProfile();
      const updated = modelProfile({ ...current, credentialRef: null });
      modelProfiles = modelProfiles.map((profile) => (profile.id === modelProfileId ? updated : profile));
      return jsonResponse({
        deleted: Boolean(current.credentialRef),
        modelProfile: updated,
        storeKind: "windows-credential-manager",
      });
    }

    if (url === `/api/v1/series/${seriesId}/ai/model-profiles/${modelProfileId}/test` && method === "POST") {
      const profile = modelProfiles.find((candidate) => candidate.id === modelProfileId) ?? modelProfile();
      return jsonResponse({
        capabilities: profile.capabilities,
        error: null,
        modelProfileId,
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

    if (url === `/api/v1/series/${seriesId}/ai/model-profiles/${modelProfileId}/models` && method === "GET") {
      const profile = modelProfiles.find((candidate) => candidate.id === modelProfileId) ?? modelProfile();
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
    const mentions = await screen.findByLabelText("Scene Codex mentions");
    await waitFor(() => {
      expect(mentions.querySelector(".codex-mention-chip")).toBeTruthy();
    });
    const mark = mentions.querySelector(".codex-mention-chip");
    if (!mark) throw new Error("Missing Bellgate mark");

    expect(screen.queryByText(/codex marks/i)).toBeNull();
    expect(document.querySelector(".scene-content-preview")).toBeNull();

    fireEvent.click(mark);
    expect(screen.getByLabelText("Harbor Lock canon description")).toBeTruthy();
    expect(screen.getByText("A storm-pressure mechanism below the west quay.")).toBeTruthy();

    fireEvent.click(mark);
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

  it("creates a model profile and saves project policy from settings", async () => {
    const fetchMock = mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Settings" }));

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Project" }));
    fireEvent.change(await screen.findByLabelText("Project cloud policy"), { target: { value: "cloud-allowed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Policy" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/ai/cloud-policy`,
        expect.objectContaining({ method: "PUT" }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Models" }));
    expect(await screen.findByText("No model profiles yet")).toBeTruthy();
    expect(screen.getByRole("option", { name: "Anthropic" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Google Gemini" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Model title"), { target: { value: "Mock Continuity" } });
    fireEvent.change(screen.getByLabelText("Model id"), { target: { value: "mock-continuity-v1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Model" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/ai/model-profiles`,
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByText("Model saved.")).toBeTruthy();
    expect(await screen.findByText("No service key saved for this model.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Test Connection" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/ai/model-profiles/${modelProfileId}/test`,
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByText("Connection ok.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Fetch Models" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/ai/model-profiles/${modelProfileId}/models`,
        expect.objectContaining({ method: "GET" }),
      );
    });
    fireEvent.click(await screen.findByRole("button", { name: /Fetched Long Context/i }));
    expect(screen.getByLabelText("Model id")).toHaveProperty("value", "fetched-long-context-model");
    expect(await screen.findByText("Model selected. Save the profile to use it.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Service key"), { target: { value: "settings-test-key" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Model" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/ai/model-profiles/${modelProfileId}/credential`,
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByText("Model and key saved.")).toBeTruthy();
    expect(await screen.findByText("Saved in the system credential store.")).toBeTruthy();
    expect(document.body.textContent).not.toContain("settings-test-key");

    fireEvent.click(screen.getByRole("button", { name: "Delete Key" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/ai/model-profiles/${modelProfileId}/credential`,
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    expect(await screen.findByText("Service key removed.")).toBeTruthy();
    expect(await screen.findByText("No service key saved for this model.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Archive Model" }));
    expect(screen.getByText("Archive this model?")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Archive Model" }).at(-1)!);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/ai/model-profiles/${modelProfileId}`,
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    expect(await screen.findByText("Model archived.")).toBeTruthy();
    expect(await screen.findByText("No model profiles yet")).toBeTruthy();
  });

  it("keeps review and workshop visible but honest about missing backend workflows", async () => {
    const fetchMock = mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    await screen.findByLabelText("Scene title");

    expect(screen.queryByRole("button", { name: "Review Draft" })).toBeNull();
    expect(screen.getByLabelText("Search unavailable")).toHaveProperty("disabled", true);
    expect(screen.queryByText("18")).toBeNull();
    expect(screen.queryByText("128")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(await screen.findByRole("heading", { name: "Review Inbox" })).toBeTruthy();
    expect(screen.getByText("Interface retained while the review workflow is rebuilt.")).toBeTruthy();
    expect(screen.getAllByText("Not connected").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "All" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Prose" })).toHaveProperty("disabled", true);
    expect(screen.getByText("Review will be rebuilt")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Workshop" }));
    expect(await screen.findByRole("heading", { name: "Workshop" })).toBeTruthy();
    expect(screen.getByText("Interface retained while Workshop is rebuilt.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "New Session" })).toHaveProperty("disabled", true);
    expect(screen.getByPlaceholderText("Workshop is not connected")).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Send" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Insert" })).toHaveProperty("disabled", true);
    expect(screen.getByText("Workshop will be rebuilt")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open Proposal" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reject" })).toBeNull();
    expect(document.body.textContent).not.toContain("/review/proposals/");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/proposals"))).toBe(false);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/workshop/sessions"))).toBe(false);
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
