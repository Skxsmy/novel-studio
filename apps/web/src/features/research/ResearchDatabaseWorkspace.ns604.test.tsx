// @vitest-environment jsdom

import type {
  ResearchDatabaseDocument,
  ResearchDatabaseSummary,
  ResearchIndexState,
  ResearchKeywordSearchResult,
  ResearchSourceDetail,
  ResearchSourceContentPage,
  ResearchSourceDocument,
  ResearchSourceView,
} from "@novel-studio/contracts";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "../../api";
import { ReferenceResearchWorkspace } from "./ResearchDatabaseWorkspace";

const databaseId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const sourceId = "22222222-2222-4222-8222-222222222222";
const blockId = "33333333-3333-4333-8333-333333333333";
const chunkId = "44444444-4444-4444-8444-444444444444";
const importedAt = "2026-07-19T02:00:00.000Z";
const sha = "a".repeat(64);
type ResearchSourceDetailV2 = Extract<ResearchSourceDetail, { originalText: string }>;
type ResearchSourceDetailV3 = Extract<ResearchSourceDetail, { content: object }>;

function databaseDocument(): ResearchDatabaseDocument {
  return {
    database: {
      schemaVersion: 1,
      id: databaseId,
      name: "Original Language Archive",
      description: "Chinese, Japanese, and English reference material.",
      linkedSeriesIds: [],
      createdAt: importedAt,
      updatedAt: importedAt,
    },
    revision: "1".repeat(64),
  };
}

function databaseSummary(sourceCount = 1): ResearchDatabaseSummary {
  return { ...databaseDocument(), sourceCount };
}

function readyIndex(overrides: Partial<ResearchIndexState> = {}): ResearchIndexState {
  return {
    researchDatabaseId: databaseId,
    status: "ready",
    indexedSourceCount: 1,
    indexedChunkCount: 1,
    reason: null,
    ...overrides,
  };
}

function v3Detail(overrides: Partial<ResearchSourceDetailV3["source"]> = {}): ResearchSourceDetailV3 {
  const kind = overrides.kind ?? "docx";
  const source = {
    schemaVersion: 3 as const,
    id: sourceId,
    researchDatabaseId: databaseId,
    kind,
    mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" as const,
    originalFileName: "harbor-notes.docx",
    sizeBytes: 2048,
    contentHash: sha,
    originalRelativePath: `originals/${sourceId}.docx`,
    contentRelativePath: `content/${sourceId}.json`,
    parsedContentHash: "b".repeat(64),
    parseStatus: "parsed" as const,
    parserName: "mammoth",
    parserVersion: 1,
    parseWarnings: [],
    origin: { type: "file" as const },
    importedAt,
    updatedAt: importedAt,
    displayName: "Harbor terminology",
    author: "Archive editor",
    declaredLanguage: "ja-JP",
    tags: ["harbor"],
    aiPermission: "never" as const,
    useNotes: "Private working source",
    ...overrides,
  };
  return {
    source,
    revision: "c".repeat(64),
    content: {
      schemaVersion: 1,
      researchDatabaseId: databaseId,
      sourceId,
      originalContentHash: source.contentHash,
      parserName: source.parserName,
      parserVersion: source.parserVersion,
      title: "Harbor terminology",
      sections: [],
      blocks: [{
        id: blockId,
        order: 0,
        sectionId: null,
        kind: "paragraph",
        text: "月守（つきもり）は夜明け前に港へ着いた。",
        textHash: "d".repeat(64),
        location: { kind: "docx", sectionPath: ["用語"], paragraph: 3 },
        language: { languageTag: "ja-JP", source: "declared", confidence: 1, detectorVersion: "script-v1" },
        languageSpans: [{ start: 0, end: 23, languageTag: "ja-JP", source: "declared", confidence: 1, detectorVersion: "script-v1" }],
      }],
      chunks: [{
        id: chunkId,
        order: 0,
        blockId,
        text: "月守（つきもり）は夜明け前に港へ着いた。",
        textHash: "d".repeat(64),
        location: { kind: "docx", sectionPath: ["用語"], paragraph: 3 },
        language: { languageTag: "ja-JP", source: "declared", confidence: 1, detectorVersion: "script-v1" },
        languageSpans: [{ start: 0, end: 23, languageTag: "ja-JP", source: "declared", confidence: 1, detectorVersion: "script-v1" }],
      }],
    },
  };
}

function v2Detail(): ResearchSourceDetailV2 {
  return {
    source: {
      schemaVersion: 2,
      id: sourceId,
      researchDatabaseId: databaseId,
      kind: "txt",
      mediaType: "text/plain",
      originalFileName: "legacy.txt",
      sizeBytes: 18,
      contentHash: sha,
      originalRelativePath: `originals/${sourceId}.txt`,
      parseStatus: "parsed",
      parserName: "plain-text",
      parserVersion: 1,
      importedAt,
      updatedAt: importedAt,
      displayName: "Legacy notes",
      author: "",
      declaredLanguage: "en",
      tags: [],
      aiPermission: "never",
      useNotes: "",
    },
    revision: "e".repeat(64),
    originalText: "Old harbor notes.",
  };
}

function v3View(detail = v3Detail()): ResearchSourceView {
  return {
    source: detail.source,
    revision: detail.revision,
    contentSummary: {
      title: detail.content.title,
      sectionCount: detail.content.sections.length,
      blockCount: detail.content.blocks.length,
      chunkCount: detail.content.chunks.length,
    },
  };
}

function contentPage(detail = v3Detail(), offset = 0): ResearchSourceContentPage {
  return {
    researchDatabaseId: databaseId,
    sourceId: detail.source.id,
    sourceRevision: detail.revision,
    title: detail.content.title,
    offset,
    limit: 40,
    totalBlocks: detail.content.blocks.length,
    blocks: detail.content.blocks.slice(offset, offset + 40),
    previousOffset: null,
    nextOffset: null,
  };
}

function manyBlockDetail(): ResearchSourceDetailV3 {
  const detail = v3Detail();
  const blocks = Array.from({ length: 85 }, (_, index) => ({
    ...detail.content.blocks[0]!,
    id: `${(index + 1).toString(16).padStart(8, "0")}-0000-4000-8000-${(index + 1).toString(16).padStart(12, "0")}`,
    order: index,
    text: `Reader block ${index + 1}`,
  }));
  return {
    ...detail,
    content: {
      ...detail.content,
      blocks,
      chunks: blocks.map((block) => ({
        ...detail.content.chunks[0]!,
        id: `${(block.order + 101).toString(16).padStart(8, "0")}-0000-4000-8000-${(block.order + 101).toString(16).padStart(12, "0")}`,
        blockId: block.id,
        order: 0,
        text: block.text,
      })),
    },
  };
}

function listed(detail: ResearchSourceDetail): ResearchSourceDocument {
  return { source: detail.source, revision: detail.revision };
}

function arrange(detail: ResearchSourceDetail | null = v3Detail()) {
  vi.spyOn(api.research, "listDatabases").mockResolvedValue({ databases: [databaseSummary(detail ? 1 : 0)], issues: [] });
  vi.spyOn(api.research, "listLegacySources").mockResolvedValue([]);
  vi.spyOn(api.research, "getDatabase").mockResolvedValue(databaseDocument());
  vi.spyOn(api.research, "listSources").mockResolvedValue(detail ? [listed(detail)] : []);
  vi.spyOn(api.research, "getSource").mockResolvedValue(
    detail ? ("content" in detail ? v3View(detail) : detail) : v3View(),
  );
}

beforeEach(() => {
  vi.spyOn(api.research, "getIndexState").mockResolvedValue(readyIndex());
  vi.spyOn(api.research, "getSourceContentPage").mockResolvedValue(contentPage());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("NS-604 original-language Research workspace", () => {
  it("maps a Word file by extension and imports it into only the selected database", async () => {
    arrange(null);
    const created = v3View();
    const importSource = vi.spyOn(api.research, "importSource").mockResolvedValue(created);

    const { container } = render(<ReferenceResearchWorkspace seriesId={null} />);
    const root = container.querySelector<HTMLElement>("#research-workspace")!;
    root.hidden = false;
    await waitFor(() => expect(within(root).getByText("This source shelf is empty")).toBeTruthy());
    const file = new File(["PK-docx"], "harbor-notes.docx", { type: "application/octet-stream" });
    fireEvent.change(within(root).getByLabelText("Choose a Research source file"), { target: { files: [file] } });

    await waitFor(() => expect(importSource).toHaveBeenCalledTimes(1));
    expect(importSource.mock.calls[0]?.[0]).toBe(databaseId);
    expect(importSource.mock.calls[0]?.[1]).toMatchObject({
      fileName: "harbor-notes.docx",
      mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    await waitFor(() => expect(within(root).getByText("月守（つきもり）は夜明け前に港へ着いた。")).toBeTruthy());
  });

  it("opens the source menu and submits a controlled web snapshot", async () => {
    arrange(null);
    const webDetail = v3Detail({
      kind: "web-snapshot",
      mediaType: "text/html",
      originalFileName: "example-com-reference.html",
      displayName: "Example reference",
      origin: {
        type: "web",
        requestedUrl: "https://example.com/reference",
        finalUrl: "https://example.com/reference",
        redirectChain: [],
        fetchedAt: importedAt,
        responseMediaType: "text/html",
      },
    });
    const importWebSource = vi.spyOn(api.research, "importWebSource").mockResolvedValue(v3View(webDetail));

    const { container } = render(<ReferenceResearchWorkspace seriesId={null} />);
    const root = container.querySelector<HTMLElement>("#research-workspace")!;
    root.hidden = false;
    const addSource = within(root).getByRole("button", { name: "Add source" }) as HTMLButtonElement;
    await waitFor(() => expect(addSource.disabled).toBe(false));
    fireEvent.click(addSource);
    fireEvent.click(within(root).getByRole("menuitem", { name: /Web address/u }));
    const dialog = within(root).getByRole("dialog", { name: "Add web page" });
    fireEvent.change(within(dialog).getByLabelText("Web address"), { target: { value: "https://example.com/reference" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save snapshot" }));

    await waitFor(() => expect(importWebSource).toHaveBeenCalledWith(databaseId, { url: "https://example.com/reference" }));
    await waitFor(() => expect(within(root).queryByRole("dialog", { name: "Add web page" })).toBeNull());
    expect(within(root).getAllByText("Example reference").length).toBeGreaterThan(0);
  });

  it("keeps source authority visible when the first content page cannot be read", async () => {
    const detail = v3Detail();
    arrange(detail);
    vi.mocked(api.research.getSourceContentPage)
      .mockRejectedValueOnce(new Error("page read failed"))
      .mockResolvedValueOnce(contentPage(detail));

    const { container } = render(<ReferenceResearchWorkspace seriesId={null} />);
    const root = container.querySelector<HTMLElement>("#research-workspace")!;
    root.hidden = false;

    await within(root).findByText("Source page unavailable");
    expect(within(root).getByRole("alert").textContent).toContain("page read failed");
    expect(within(root).getByTitle("Harbor terminology")).toBeTruthy();
    expect((within(root).getByLabelText("Display name") as HTMLInputElement).value).toBe("Harbor terminology");
    fireEvent.click(within(root).getByRole("button", { name: "Retry page" }));
    await waitFor(() => expect(within(root).getByText("月守（つきもり）は夜明け前に港へ着いた。")).toBeTruthy());
    expect(api.research.getSourceContentPage).toHaveBeenCalledTimes(2);
    expect(within(root).queryByRole("alert")).toBeNull();
  });

  it("keeps a transiently unavailable source selected and retries its details", async () => {
    const detail = v3Detail();
    arrange(detail);
    vi.mocked(api.research.getSource)
      .mockRejectedValueOnce(new ApiError("Unavailable", 500, {
        code: "INTERNAL_ERROR",
        message: "temporary detail failure",
      }))
      .mockResolvedValueOnce(v3View(detail));

    const { container } = render(<ReferenceResearchWorkspace seriesId={null} />);
    const root = container.querySelector<HTMLElement>("#research-workspace")!;
    root.hidden = false;

    await within(root).findByRole("heading", { name: "Source unavailable" });
    expect((await within(root).findByRole("alert")).textContent).toContain("temporary detail failure");
    const selectedSource = within(root).getByTitle("Harbor terminology");
    expect(selectedSource.getAttribute("aria-current")).toBe("true");
    expect(localStorage.getItem(`novel-studio.research.source.selected.${databaseId}`)).toBe(sourceId);
    expect(within(root).getByRole("button", { name: "Retry source" })).toBeTruthy();
    fireEvent.click(selectedSource);

    await waitFor(() => expect(within(root).getByText("月守（つきもり）は夜明け前に港へ着いた。")).toBeTruthy());
    expect(api.research.getSource).toHaveBeenCalledTimes(2);
    expect((within(root).getByLabelText("Display name") as HTMLInputElement).value).toBe("Harbor terminology");
    expect(within(root).queryByRole("alert")).toBeNull();
  });

  it("uses a result for the selected unavailable source as a detail retry", async () => {
    const detail = v3Detail();
    arrange(detail);
    vi.mocked(api.research.getSource)
      .mockRejectedValueOnce(new ApiError("Unavailable", 500, {
        code: "INTERNAL_ERROR",
        message: "temporary detail failure",
      }))
      .mockResolvedValueOnce(v3View(detail));
    vi.spyOn(api.research, "search").mockResolvedValue({
      researchDatabaseId: databaseId,
      query: "月守",
      results: [{
        researchDatabaseId: databaseId,
        sourceId,
        sourceRevision: detail.revision,
        sourceDisplayName: detail.source.displayName,
        sourceKind: detail.source.kind,
        chunkId,
        blockId,
        blockOrder: 0,
        chunkHash: "d".repeat(64),
        originalText: detail.content.chunks[0]!.text,
        languageTag: "ja-JP",
        location: detail.content.chunks[0]!.location,
        matchChannels: ["keyword-cjk"],
        score: 1,
      }],
    });

    const { container } = render(<ReferenceResearchWorkspace seriesId={null} />);
    const root = container.querySelector<HTMLElement>("#research-workspace")!;
    root.hidden = false;
    await within(root).findByRole("heading", { name: "Source unavailable" });
    const input = within(root).getByLabelText("Search selected Research Database");
    fireEvent.change(input, { target: { value: "月守" } });
    fireEvent.click(within(root).getByRole("button", { name: "Search" }));
    fireEvent.click(await within(root).findByRole("button", { name: /月守（つきもり）/u }));

    await waitFor(() => expect(api.research.getSource).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(root.querySelector(`#research-match-${blockId}`)?.textContent).toBe("月守"));
    expect(within(root).getByRole("status").textContent).toContain("Opened 用語 · paragraph 3");
    expect(within(root).queryByRole("alert")).toBeNull();
  });

  it("searches only the selected database and opens the exact original-language location", async () => {
    const detail = v3Detail();
    arrange(detail);
    const result: ResearchKeywordSearchResult = {
      researchDatabaseId: databaseId,
      sourceId,
      sourceRevision: detail.revision,
      sourceDisplayName: detail.source.displayName,
      sourceKind: detail.source.kind,
      chunkId,
      blockId,
      blockOrder: 0,
      chunkHash: "d".repeat(64),
      originalText: detail.content.chunks[0]!.text,
      languageTag: "ja-JP",
      location: detail.content.chunks[0]!.location,
      matchChannels: ["keyword-cjk"],
      score: 1,
    };
    const search = vi.spyOn(api.research, "search").mockResolvedValue({
      researchDatabaseId: databaseId,
      query: "月守",
      results: [result],
    });

    const { container } = render(<ReferenceResearchWorkspace seriesId={null} />);
    const root = container.querySelector<HTMLElement>("#research-workspace")!;
    root.hidden = false;
    const input = await within(root).findByLabelText("Search selected Research Database");
    fireEvent.change(input, { target: { value: "月守" } });
    fireEvent.click(within(root).getByRole("button", { name: "Search" }));

    await waitFor(() => expect(search).toHaveBeenCalledWith(databaseId, { query: "月守", purpose: "local", limit: 30 }));
    expect(within(root).getByRole("heading", { name: "1 result for “月守”" })).toBeTruthy();
    fireEvent.change(input, { target: { value: "未提交的新查询" } });
    expect(within(root).getByRole("heading", { name: "1 result for “月守”" })).toBeTruthy();
    expect(within(root).getByText("用語 · paragraph 3")).toBeTruthy();
    fireEvent.click(within(root).getByRole("button", { name: /月守（つきもり）/u }));
    await waitFor(() => expect(root.querySelector(`#research-block-${blockId}`)?.classList.contains("is-highlighted")).toBe(true));
    expect(root.querySelector(`#research-match-${blockId}`)?.textContent).toBe("月守");
    expect(within(root).getByRole("status").textContent).toContain("Opened 用語 · paragraph 3");
  });

  it("keeps search results retryable until the matching page actually opens", async () => {
    const detail = v3Detail();
    arrange(detail);
    vi.mocked(api.research.getSourceContentPage)
      .mockResolvedValueOnce(contentPage(detail))
      .mockRejectedValueOnce(new Error("matching page failed"))
      .mockResolvedValueOnce(contentPage(detail));
    vi.spyOn(api.research, "search").mockResolvedValue({
      researchDatabaseId: databaseId,
      query: "月守",
      results: [{
        researchDatabaseId: databaseId,
        sourceId,
        sourceRevision: detail.revision,
        sourceDisplayName: detail.source.displayName,
        sourceKind: detail.source.kind,
        chunkId,
        blockId,
        blockOrder: 0,
        chunkHash: "d".repeat(64),
        originalText: detail.content.chunks[0]!.text,
        languageTag: "ja-JP",
        location: detail.content.chunks[0]!.location,
        matchChannels: ["keyword-cjk"],
        score: 1,
      }],
    });

    const { container } = render(<ReferenceResearchWorkspace seriesId={null} />);
    const root = container.querySelector<HTMLElement>("#research-workspace")!;
    root.hidden = false;
    const input = await within(root).findByLabelText("Search selected Research Database");
    fireEvent.change(input, { target: { value: "月守" } });
    fireEvent.click(within(root).getByRole("button", { name: "Search" }));
    const result = await within(root).findByRole("button", { name: /月守（つきもり）/u });
    fireEvent.click(result);

    await waitFor(() => expect(within(root).getByRole("alert").textContent).toContain("matching page failed"));
    expect(within(root).queryByText(/^Opened /u)).toBeNull();
    const retry = within(root).getByRole("button", { name: /月守（つきもり）/u }) as HTMLButtonElement;
    await waitFor(() => expect(retry.disabled).toBe(false));
    fireEvent.click(retry);
    await waitFor(() => expect(root.querySelector(`#research-match-${blockId}`)?.textContent).toBe("月守"));
    expect(within(root).getByRole("status").textContent).toContain("Opened 用語 · paragraph 3");
  });

  it("cancels a pending result-page jump when the author reselects the source", async () => {
    const detail = manyBlockDetail();
    arrange(detail);
    const targetBlock = detail.content.blocks[80]!;
    const targetChunk = detail.content.chunks[80]!;
    let resolveTargetPage!: (page: ResearchSourceContentPage) => void;
    const targetPage = new Promise<ResearchSourceContentPage>((resolve) => {
      resolveTargetPage = resolve;
    });
    vi.mocked(api.research.getSourceContentPage)
      .mockResolvedValueOnce({ ...contentPage(detail, 0), nextOffset: 40 })
      .mockReturnValueOnce(targetPage);
    vi.spyOn(api.research, "search").mockResolvedValue({
      researchDatabaseId: databaseId,
      query: "Reader block 81",
      results: [{
        researchDatabaseId: databaseId,
        sourceId,
        sourceRevision: detail.revision,
        sourceDisplayName: detail.source.displayName,
        sourceKind: detail.source.kind,
        chunkId: targetChunk.id,
        blockId: targetBlock.id,
        blockOrder: targetBlock.order,
        chunkHash: targetChunk.textHash,
        originalText: targetChunk.text,
        languageTag: targetChunk.language.languageTag,
        location: targetChunk.location,
        matchChannels: ["keyword-word"],
        score: 1,
      }],
    });

    const { container } = render(<ReferenceResearchWorkspace seriesId={null} />);
    const root = container.querySelector<HTMLElement>("#research-workspace")!;
    root.hidden = false;
    await waitFor(() => expect(within(root).getByText("Reader block 1")).toBeTruthy());
    fireEvent.change(within(root).getByLabelText("Search selected Research Database"), {
      target: { value: "Reader block 81" },
    });
    fireEvent.click(within(root).getByRole("button", { name: "Search" }));
    fireEvent.click(await within(root).findByRole("button", { name: /Reader block 81/u }));
    await waitFor(() => expect(api.research.getSourceContentPage).toHaveBeenLastCalledWith(
      databaseId,
      sourceId,
      80,
      40,
    ));

    fireEvent.click(within(root).getByTitle("Harbor terminology"));
    const next = within(root).getByRole("button", { name: "Next" }) as HTMLButtonElement;
    await waitFor(() => expect(next.disabled).toBe(false));
    resolveTargetPage({ ...contentPage(detail, 80), previousOffset: 40 });
    await Promise.resolve();
    expect(within(root).getByText("Reader block 1")).toBeTruthy();
    expect(within(root).queryByText("Reader block 81")).toBeNull();
  });

  it("upgrades version 2 sources explicitly and refreshes the structured reader", async () => {
    const legacy = v2Detail();
    const migrated = v3Detail({ kind: "txt", mediaType: "text/plain", originalFileName: "legacy.txt", displayName: "Legacy notes" });
    arrange(legacy);
    vi.mocked(api.research.listSources).mockResolvedValueOnce([listed(legacy)]).mockResolvedValueOnce([listed(migrated)]);
    vi.mocked(api.research.getSource).mockResolvedValueOnce(legacy).mockResolvedValueOnce(v3View(migrated));
    const migrate = vi.spyOn(api.research, "migrateSourcesV2").mockResolvedValue({
      researchDatabaseId: databaseId,
      migratedSourceIds: [sourceId],
      skippedSourceIds: [],
      indexState: readyIndex(),
    });

    const { container } = render(<ReferenceResearchWorkspace seriesId={null} />);
    const root = container.querySelector<HTMLElement>("#research-workspace")!;
    root.hidden = false;
    const upgrade = await within(root).findByRole("button", { name: /Upgrade older sources/u });
    fireEvent.click(upgrade);

    await waitFor(() => expect(migrate).toHaveBeenCalledWith(databaseId, {
      sources: [{ sourceId, baseRevision: legacy.revision }],
    }));
    await waitFor(() => expect(within(root).getByText("Parsed text")).toBeTruthy());
    expect(within(root).queryByRole("button", { name: /Upgrade older sources/u })).toBeNull();
  });

  it("shows a damaged index and rebuilds only the selected database", async () => {
    arrange(v3Detail());
    vi.mocked(api.research.getIndexState).mockResolvedValue(readyIndex({ status: "damaged", reason: "Index checksum mismatch." }));
    const rebuild = vi.spyOn(api.research, "rebuildIndex").mockResolvedValue(readyIndex());

    const { container } = render(<ReferenceResearchWorkspace seriesId={null} />);
    const root = container.querySelector<HTMLElement>("#research-workspace")!;
    root.hidden = false;
    await waitFor(() => expect(within(root).getByText("Search needs repair")).toBeTruthy());
    fireEvent.click(within(root).getByRole("button", { name: "Rebuild" }));

    await waitFor(() => expect(rebuild).toHaveBeenCalledWith(databaseId));
    await waitFor(() => expect(within(root).getByText("Search ready")).toBeTruthy());
  });

  it("pages a large structured source without mounting every block", async () => {
    const detail = manyBlockDetail();
    arrange(detail);
    vi.mocked(api.research.getSourceContentPage).mockImplementation(async (_databaseId, _sourceId, offset) => ({
      ...contentPage(detail, offset),
      previousOffset: offset === 0 ? null : Math.max(0, offset - 40),
      nextOffset: offset + 40 < detail.content.blocks.length ? offset + 40 : null,
    }));

    const { container } = render(<ReferenceResearchWorkspace seriesId={null} />);
    const root = container.querySelector<HTMLElement>("#research-workspace")!;
    root.hidden = false;
    await waitFor(() => expect(within(root).getByText("Reader block 1")).toBeTruthy());
    expect(within(root).queryByText("Reader block 41")).toBeNull();
    fireEvent.click(within(root).getByRole("button", { name: "Next" }));
    await waitFor(() => expect(within(root).getByText("Reader block 41")).toBeTruthy());
    expect(api.research.getSourceContentPage).toHaveBeenLastCalledWith(databaseId, sourceId, 40, 40);
    expect(within(root).queryByText("Reader block 1")).toBeNull();
  });
});
