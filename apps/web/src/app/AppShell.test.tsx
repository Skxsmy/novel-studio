// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

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
const codexEntryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const modelProfileId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const revision = "a".repeat(64);
const updatedRevision = "b".repeat(64);

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json" },
      status,
    }),
  );
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

function sceneDocument(content = "", nextRevision = revision) {
  return {
    characterCount: content.length,
    content,
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
    paragraphCount: content ? 1 : 0,
    relativePath: "books/book/manuscript/act/chapter/001-opening-scene.md",
    revision: nextRevision,
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
      archivedAt: null,
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
    books: [
      ...detail.books,
      {
        actIds: [],
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
        archivedAt: null,
        builtIn: true,
        icon: "C",
        id: "character",
        name: "人物",
      },
      revision: null,
    },
    {
      category: {
        archivedAt: null,
        builtIn: true,
        icon: "L",
        id: "location",
        name: "地点",
      },
      revision: null,
    },
  ];
}

function codexEntryDocument(name = "New Entry") {
  return {
    description: "",
    metadata: {
      aiContextPolicy: "on-mention",
      aliases: [],
      archivedAt: null,
      categoryId: "character",
      createdAt: "2026-06-23T00:00:00.000Z",
      details: {},
      id: codexEntryId,
      mention: {
        automaticPlural: false,
        caseSensitive: false,
        excludedTerms: [],
        matchAliases: true,
      },
      name,
      schemaVersion: 1,
      tags: [],
      thumbnail: null,
      updatedAt: "2026-06-23T00:00:00.000Z",
    },
    relativePath: "codex/characters/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.md",
    research: {
      content: "",
      metadata: {
        createdAt: "2026-06-23T00:00:00.000Z",
        entryId: codexEntryId,
        schemaVersion: 1,
        updatedAt: "2026-06-23T00:00:00.000Z",
      },
      relativePath: "codex/entry-research/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.md",
      revision,
    },
    revision,
  };
}

function modelProfile(overrides: Partial<{
  archivedAt: string | null;
  baseUrl: string | null;
  cloudPolicy: "local-only" | "cloud-allowed";
  credentialRef: string | null;
  id: string;
  model: string;
  provider: "mock" | "openai";
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

function mockFetch() {
  let detailOverride: ReturnType<typeof seriesDetail> | null = null;
  let codexEntries: ReturnType<typeof codexEntryDocument>[] = [];
  let modelProfiles: ReturnType<typeof modelProfile>[] = [];
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url === "/api/v1/series" && method === "GET") {
      return jsonResponse([seriesSummary()]);
    }

    if (url === "/api/v1/series" && method === "POST") {
      const body = JSON.parse(String(init?.body));
      detailOverride = {
        ...seriesDetail(),
        books: [{ ...seriesDetail().books[0]!, title: body.firstBookTitle }],
        manifest: { ...seriesDetail().manifest, description: body.description, title: body.title },
      };
      return jsonResponse(detailOverride, 201);
    }

    if (url === `/api/v1/series/${seriesId}` && method === "GET") {
      return jsonResponse(detailOverride ?? seriesDetail());
    }

    if (url === `/api/v1/series/${seriesId}/planning` && method === "GET") {
      return jsonResponse(planningBoard());
    }

    if (url === `/api/v1/series/${seriesId}/codex/categories` && method === "GET") {
      return jsonResponse(codexCategories());
    }

    if (url === `/api/v1/series/${seriesId}/codex/entries` && method === "GET") {
      return jsonResponse(codexEntries);
    }

    if (url === `/api/v1/series/${seriesId}/codex/entries` && method === "POST") {
      const body = JSON.parse(String(init?.body));
      const entry = codexEntryDocument(body.name);
      codexEntries = [entry];
      return jsonResponse(entry, 201);
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
        cloudPolicy: body.cloudPolicy,
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
      ]);
    }

    if (url === `/api/v1/series/${seriesId}/scenes/${sceneId}` && method === "PUT") {
      const body = JSON.parse(String(init?.body));
      return jsonResponse(sceneDocument(body.content, updatedRevision));
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

    if (url === `/api/v1/series/${seriesId}/acts/${newActId}` && method === "PUT") {
      const body = JSON.parse(String(init?.body));
      const current = detailOverride ?? seriesDetailWithNewAct();
      detailOverride = {
        ...current,
        acts: current.acts.map((act) => (act.id === newActId ? { ...act, title: body.title } : act)),
      };
      return jsonResponse(detailOverride.acts.find((act) => act.id === newActId));
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

describe("App shell", () => {
  it("renders the project library and workspace navigation", async () => {
    mockFetch();
    render(<App />);

    expect(screen.getByRole("navigation", { name: "Workspaces" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: /Glass Harbor/i })).toBeTruthy();
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
    expect(await screen.findByText("No codex entries yet.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "New Entry" }));

    expect(await screen.findByRole("heading", { name: "New Entry" })).toBeTruthy();
    expect(screen.getByLabelText("Codex entry details")).toBeTruthy();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/codex/entries`,
        expect.objectContaining({ method: "POST" }),
      );
    });

    const row = screen.getByText("No description").closest("button");
    expect(row).toBeTruthy();
    fireEvent.click(row!);
    expect(screen.queryByLabelText("Codex entry details")).toBeNull();
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

  it("saves a changed scene through the API", async () => {
    const fetchMock = mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Glass Harbor/i }));
    const editor = await screen.findByLabelText("Scene content");
    fireEvent.change(editor, { target: { value: "New paragraph" } });
    fireEvent.click(screen.getByRole("button", { name: "Save now" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/scenes/${sceneId}`,
        expect.objectContaining({ method: "PUT" }),
      );
    });
    await waitFor(() => {
      expect(screen.getAllByText("Saved").length).toBeGreaterThan(0);
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

    fireEvent.click(screen.getByRole("button", { name: "Test Connection" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/series/${seriesId}/ai/model-profiles/${modelProfileId}/test`,
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByText("Connection ok.")).toBeTruthy();
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
