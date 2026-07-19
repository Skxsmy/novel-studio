// @vitest-environment jsdom

import type {
  ResearchDatabaseDocument,
  ResearchDatabaseSummary,
  ResearchIndexState,
  ResearchKeywordSearchResult,
  ResearchSourceDetail,
  ResearchSourceDocument,
} from "@novel-studio/contracts";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
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

function listed(detail: ResearchSourceDetail): ResearchSourceDocument {
  return { source: detail.source, revision: detail.revision };
}

function arrange(detail: ResearchSourceDetail | null = v3Detail()) {
  vi.spyOn(api.research, "listDatabases").mockResolvedValue({ databases: [databaseSummary(detail ? 1 : 0)], issues: [] });
  vi.spyOn(api.research, "listLegacySources").mockResolvedValue([]);
  vi.spyOn(api.research, "getDatabase").mockResolvedValue(databaseDocument());
  vi.spyOn(api.research, "listSources").mockResolvedValue(detail ? [listed(detail)] : []);
  vi.spyOn(api.research, "getSource").mockResolvedValue(detail ?? v3Detail());
}

beforeEach(() => {
  vi.spyOn(api.research, "getIndexState").mockResolvedValue(readyIndex());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("NS-604 original-language Research workspace", () => {
  it("maps a Word file by extension and imports it into only the selected database", async () => {
    arrange(null);
    const created = v3Detail();
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
    const importWebSource = vi.spyOn(api.research, "importWebSource").mockResolvedValue(webDetail);

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
    expect(within(root).getByText("用語 · paragraph 3")).toBeTruthy();
    fireEvent.click(within(root).getByRole("button", { name: /月守（つきもり）/u }));
    await waitFor(() => expect(root.querySelector(`#research-block-${blockId}`)?.classList.contains("is-highlighted")).toBe(true));
    expect(within(root).getByRole("status").textContent).toContain("Opened 用語 · paragraph 3");
  });

  it("upgrades version 2 sources explicitly and refreshes the structured reader", async () => {
    const legacy = v2Detail();
    const migrated = v3Detail({ kind: "txt", mediaType: "text/plain", originalFileName: "legacy.txt", displayName: "Legacy notes" });
    arrange(legacy);
    vi.mocked(api.research.listSources).mockResolvedValueOnce([listed(legacy)]).mockResolvedValueOnce([listed(migrated)]);
    vi.mocked(api.research.getSource).mockResolvedValueOnce(legacy).mockResolvedValueOnce(migrated);
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
});
