// @vitest-environment jsdom

import type {
  ResearchDatabaseDocument,
  ResearchDatabaseSummary,
  ResearchRetrievalResult,
  ResearchSourceDocument,
  ResearchSourceView,
} from "@novel-studio/contracts";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "../../api";
import { ReferenceResearchWorkspace } from "./ResearchDatabaseWorkspace";

const firstDatabaseId = "11111111-1111-4111-8111-111111111111";
const secondDatabaseId = "22222222-2222-4222-8222-222222222222";
const sourceId = "33333333-3333-4333-8333-333333333333";
const blockId = "44444444-4444-4444-8444-444444444444";
const chunkId = "55555555-5555-4555-8555-555555555555";
const now = "2026-07-19T00:00:00.000Z";
const revision = "a".repeat(64);

function database(id: string, name: string): ResearchDatabaseDocument {
  return {
    database: { schemaVersion: 1, id, name, description: "", linkedSeriesIds: [], createdAt: now, updatedAt: now },
    revision,
  };
}

function summary(id: string, name: string, sourceCount: number): ResearchDatabaseSummary {
  return { ...database(id, name), sourceCount };
}

const source = {
  schemaVersion: 3 as const,
  id: sourceId,
  researchDatabaseId: secondDatabaseId,
  kind: "txt" as const,
  mediaType: "text/plain" as const,
  originalFileName: "edo-inn.txt",
  sizeBytes: 54,
  contentHash: "b".repeat(64),
  originalRelativePath: `originals/${sourceId}.txt`,
  contentRelativePath: `content/${sourceId}.json`,
  parsedContentHash: "c".repeat(64),
  parseStatus: "parsed" as const,
  parserName: "plain-text",
  parserVersion: 1,
  parseWarnings: [],
  origin: { type: "file" as const },
  importedAt: now,
  updatedAt: now,
  displayName: "Edo inns",
  author: "",
  declaredLanguage: "ja",
  tags: ["history"],
  aiPermission: "allowed" as const,
  useNotes: "",
};

const listedSource: ResearchSourceDocument = { source, revision };
const sourceView: ResearchSourceView = {
  source,
  revision,
  contentSummary: { title: "Edo inns", sectionCount: 0, blockCount: 1, chunkCount: 1 },
};

function result(): ResearchRetrievalResult {
  return {
    researchDatabaseId: secondDatabaseId,
    researchDatabaseName: "Japanese archive",
    sourceId,
    sourceRevision: revision,
    sourceDisplayName: source.displayName,
    sourceKind: "txt",
    chunkId,
    blockId,
    blockOrder: 0,
    chunkHash: "d".repeat(64),
    originalText: "江戸時代の宿場町では旅籠が旅人を迎えた。",
    languageTag: "ja",
    location: { kind: "text", startLine: 1, endLine: 1, startOffset: 0, endOffset: 22 },
    rank: 1,
    matchChannels: ["semantic"],
    channelContributions: [{
      channel: "semantic",
      matchedQuery: "江户时代的旅馆",
      rank: 1,
      rawScore: 0.89,
      reciprocalRankContribution: 1.1 / 61,
    }],
    fusedScore: 1.1 / 61,
  };
}

function readyCapability() {
  return {
    useCase: "research.multilingual" as const,
    bindingStatus: "bound" as const,
    profileId: "66666666-6666-4666-8666-666666666666",
    profileRevision: "e".repeat(64),
    capability: {
      revision: "f".repeat(64),
      capability: {
        schemaVersion: 1 as const,
        profileId: "66666666-6666-4666-8666-666666666666",
        profileRevision: "e".repeat(64),
        useCase: "research.multilingual" as const,
        dimensions: 768,
        supportedLanguageTags: ["zh-CN", "ja", "en"],
        sharedSpaceDeclared: true,
        documentPrefix: "passage: ",
        queryPrefix: "query: ",
        validationStatus: "passed" as const,
        validationFixtureVersion: 1 as const,
        metrics: { positivePairMean: 0.8, positivePairMinimum: 0.7, negativePairMean: 0.2, separation: 0.6 },
        validatedAt: now,
        failureReason: null,
      },
    },
    usable: true,
    reason: null,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(api.research, "listDatabases").mockResolvedValue({
    databases: [summary(firstDatabaseId, "History notes", 0), summary(secondDatabaseId, "Japanese archive", 1)],
    issues: [],
  });
  vi.spyOn(api.research, "listLegacySources").mockResolvedValue([]);
  vi.spyOn(api.research, "getDatabase").mockImplementation(async (id) =>
    id === secondDatabaseId ? database(secondDatabaseId, "Japanese archive") : database(firstDatabaseId, "History notes"));
  vi.spyOn(api.research, "listSources").mockImplementation(async (id) => id === secondDatabaseId ? [listedSource] : []);
  vi.spyOn(api.research, "getSource").mockResolvedValue(sourceView);
  vi.spyOn(api.research, "getSourceContentPage").mockResolvedValue({
    researchDatabaseId: secondDatabaseId,
    sourceId,
    sourceRevision: revision,
    title: "Edo inns",
    offset: 0,
    limit: 40,
    totalBlocks: 1,
    blocks: [{
      id: blockId,
      order: 0,
      sectionId: null,
      kind: "paragraph",
      text: result().originalText,
      textHash: "d".repeat(64),
      location: result().location,
      language: { languageTag: "ja", source: "declared", confidence: 1, detectorVersion: "test" },
      languageSpans: [],
    }],
    previousOffset: null,
    nextOffset: null,
  });
  vi.spyOn(api.research, "getIndexState").mockImplementation(async (id) => ({
    researchDatabaseId: id,
    status: "ready",
    indexedSourceCount: id === secondDatabaseId ? 1 : 0,
    indexedChunkCount: id === secondDatabaseId ? 1 : 0,
    reason: null,
  }));
  vi.spyOn(api.research, "getQueryExpansions").mockImplementation(async (id) => ({
    expansions: { schemaVersion: 1, researchDatabaseId: id, entries: [], updatedAt: now },
    revision,
  }));
  vi.spyOn(api.research, "getEmbeddingCapability").mockResolvedValue(readyCapability());
  vi.spyOn(api.research, "getVectorIndexState").mockImplementation(async (id) => ({
    researchDatabaseId: id,
    status: "ready",
    indexedSourceCount: id === secondDatabaseId ? 1 : 0,
    indexedChunkCount: id === secondDatabaseId ? 1 : 0,
    dimensions: 768,
    profileId: readyCapability().profileId,
    profileRevision: readyCapability().profileRevision,
    reason: null,
  }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("NS-605 Research retrieval workspace", () => {
  it("selects multiple databases, discloses degradation, paginates, and opens a cross-database result", async () => {
    const search = vi.spyOn(api.research, "searchDatabases")
      .mockResolvedValueOnce({
        query: "江户时代的旅馆",
        selectedDatabaseIds: [firstDatabaseId, secondDatabaseId],
        requestedMode: "hybrid",
        effectiveMode: "hybrid",
        results: [result()],
        issues: [{
          researchDatabaseId: firstDatabaseId,
          code: "vector-index-stale",
          message: "Sources changed after the last vector build.",
        }],
        nextCursor: "page-2",
      })
      .mockResolvedValueOnce({
        query: "江户时代的旅馆",
        selectedDatabaseIds: [firstDatabaseId, secondDatabaseId],
        requestedMode: "hybrid",
        effectiveMode: "hybrid",
        results: [],
        issues: [],
        nextCursor: null,
      });
    const { container } = render(<ReferenceResearchWorkspace seriesId={null} />);
    const root = container.querySelector<HTMLElement>("#research-workspace")!;
    root.hidden = false;
    const scope = await within(root).findByRole("button", { name: "1 database" });
    fireEvent.click(scope);
    fireEvent.click(within(root).getByRole("checkbox", { name: /Japanese archive/u }));
    const input = within(root).getByLabelText("Search selected Research Databases");
    fireEvent.change(input, { target: { value: "江户时代的旅馆" } });
    fireEvent.click(within(root).getByRole("button", { name: "Search" }));

    await waitFor(() => expect(search).toHaveBeenCalledWith(expect.objectContaining({
      databaseIds: [firstDatabaseId, secondDatabaseId],
      mode: "hybrid",
    })));
    expect(root.querySelector(".rs11-result-database")?.textContent).toBe("Japanese archive");
    expect(within(root).getByText("Sources changed after the last vector build.")).toBeTruthy();
    expect(within(root).getByText("Semantic")).toBeTruthy();
    fireEvent.click(within(root).getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: "page-2" })));

    fireEvent.click(within(root).getByRole("button", { name: /江戸時代の宿場町/u }));
    await waitFor(() => expect((within(root).getByRole("combobox", { name: "Research Database" }) as HTMLSelectElement).value).toBe(secondDatabaseId));
    await waitFor(() => expect(root.querySelector(`#research-match-${blockId}`)?.textContent).toContain("江戸時代"));
    expect(within(root).getByRole("status").textContent).toContain("Opened Line 1 in Edo inns");
  });

  it("refreshes from the first page when a retrieval cursor becomes stale", async () => {
    const response = {
      query: "江户时代的旅馆",
      selectedDatabaseIds: [firstDatabaseId, secondDatabaseId],
      requestedMode: "hybrid" as const,
      effectiveMode: "hybrid" as const,
      results: [result()],
      issues: [],
      nextCursor: "stale-page",
    };
    const search = vi.spyOn(api.research, "searchDatabases")
      .mockResolvedValueOnce(response)
      .mockRejectedValueOnce(new ApiError("Conflict", 409, {
        code: "CONFLICT",
        message: "Research retrieval cursor no longer matches the query or indexes",
      }))
      .mockResolvedValueOnce({ ...response, nextCursor: null });
    const { container } = render(<ReferenceResearchWorkspace seriesId={null} />);
    const root = container.querySelector<HTMLElement>("#research-workspace")!;
    root.hidden = false;
    fireEvent.click(await within(root).findByRole("button", { name: "1 database" }));
    fireEvent.click(within(root).getByRole("checkbox", { name: /Japanese archive/u }));
    fireEvent.change(within(root).getByLabelText("Search selected Research Databases"), {
      target: { value: response.query },
    });
    fireEvent.click(within(root).getByRole("button", { name: "Search" }));
    fireEvent.click(await within(root).findByRole("button", { name: "Load more" }));

    await waitFor(() => expect(search).toHaveBeenCalledTimes(3));
    expect(within(root).getByRole("status").textContent).toContain("Results were refreshed from the beginning");
    expect(within(root).queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("saves isolated aliases, guards dirty close, validates capability, and rebuilds the current vector index", async () => {
    vi.mocked(api.research.getEmbeddingCapability)
      .mockResolvedValueOnce({ ...readyCapability(), usable: false, reason: "Validation required.", capability: null })
      .mockResolvedValueOnce(readyCapability());
    const updateAliases = vi.spyOn(api.research, "updateQueryExpansions").mockImplementation(async (id, input) => ({
      expansions: { schemaVersion: 1, researchDatabaseId: id, entries: input.entries, updatedAt: now },
      revision: "1".repeat(64),
    }));
    vi.spyOn(api.research, "validateEmbeddingCapability").mockResolvedValue(readyCapability().capability!);
    const rebuild = vi.spyOn(api.research, "rebuildVectorIndex").mockResolvedValue({
      researchDatabaseId: firstDatabaseId,
      status: "ready",
      indexedSourceCount: 0,
      indexedChunkCount: 0,
      dimensions: 768,
      profileId: readyCapability().profileId,
      profileRevision: readyCapability().profileRevision,
      reason: null,
    });
    const { container } = render(<ReferenceResearchWorkspace seriesId={null} />);
    const root = container.querySelector<HTMLElement>("#research-workspace")!;
    root.hidden = false;
    fireEvent.click(await within(root).findByRole("button", { name: "Retrieval settings" }));
    const dialog = within(root).getByRole("dialog", { name: "Retrieval settings" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add query alias" }));
    fireEvent.change(within(dialog).getByLabelText("Query term 1"), { target: { value: "江户" } });
    fireEvent.change(within(dialog).getByLabelText("Expansion term 1"), { target: { value: "Edo" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(within(dialog).getByRole("alert").textContent).toContain("Save or discard alias changes");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save aliases" }));
    await waitFor(() => expect(updateAliases).toHaveBeenCalledWith(firstDatabaseId, expect.objectContaining({
      entries: [expect.objectContaining({ queryTerm: "江户", expansionTerm: "Edo" })],
    })));

    fireEvent.click(within(dialog).getByRole("checkbox", { name: /Shared multilingual vector space/u }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Run validation" }));
    await waitFor(() => expect(within(dialog).getByText("Ready")).toBeTruthy());
    fireEvent.click(within(dialog).getByRole("button", { name: "Rebuild semantic index" }));
    await waitFor(() => expect(rebuild).toHaveBeenCalledWith(firstDatabaseId));
  });
});
