// @vitest-environment jsdom

import type { ResearchSourceDetail, ResearchSourceDocument } from "@novel-studio/contracts";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "../../api";
import { ReferenceResearchWorkspace } from "./ReferenceResearchWorkspace";

const seriesId = "11111111-1111-4111-8111-111111111111";
const txtId = "22222222-2222-4222-8222-222222222222";
const mdId = "33333333-3333-4333-8333-333333333333";
const importedAt = "2026-07-19T02:00:00.000Z";

function detail(id = txtId, overrides: Partial<ResearchSourceDetail["source"]> = {}): ResearchSourceDetail {
  const kind = overrides.kind ?? "txt";
  const source = {
    schemaVersion: 1 as const,
    id,
    seriesId,
    kind,
    mediaType: kind === "markdown" ? "text/markdown" as const : "text/plain" as const,
    originalFileName: kind === "markdown" ? "terms.md" : "interview.txt",
    sizeBytes: 42,
    contentHash: id === mdId ? "b".repeat(64) : "a".repeat(64),
    originalRelativePath: `research/originals/${id}.${kind === "markdown" ? "md" : "txt"}`,
    parseStatus: "parsed" as const,
    parserName: "plain-text" as const,
    parserVersion: 1 as const,
    importedAt,
    updatedAt: importedAt,
    displayName: kind === "markdown" ? "Japanese terms" : "Harbor interview",
    author: "Field researcher",
    declaredLanguage: kind === "markdown" ? "ja-JP" : "en",
    tags: ["harbor"],
    aiPermission: "never" as const,
    useNotes: "Private source",
    ...overrides,
  };
  return {
    source,
    revision: id === mdId ? "d".repeat(64) : "c".repeat(64),
    originalText: kind === "markdown" ? "# 用語\n\n月守（つきもり）" : "The harbor bell rang before dawn.",
  };
}

function listed(sourceDetail: ResearchSourceDetail): ResearchSourceDocument {
  return { source: sourceDetail.source, revision: sourceDetail.revision };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("NS-602 Research workspace", () => {
  it("imports lists selects and previews real TXT and Markdown sources through the API", async () => {
    const txt = detail();
    const markdown = detail(mdId, { kind: "markdown" });
    vi.spyOn(api.research, "listSources").mockResolvedValue([listed(txt)]);
    vi.spyOn(api.research, "getSource").mockImplementation(async (_seriesId, sourceId) =>
      sourceId === mdId ? markdown : txt,
    );
    const importSource = vi.spyOn(api.research, "importSource").mockResolvedValue(markdown);

    const { container } = render(<ReferenceResearchWorkspace seriesId={seriesId} />);
    const root = container.querySelector<HTMLElement>("#research-workspace")!;
    root.hidden = false;
    await waitFor(() => expect(within(root).getByText("The harbor bell rang before dawn.")).toBeTruthy());
    expect(within(root).getByRole("button", { name: /Harbor interview/u })).toBeTruthy();

    const file = new File([markdown.originalText], "terms.md", { type: "text/markdown" });
    fireEvent.change(within(root).getByLabelText("Choose a TXT or Markdown Research source"), {
      target: { files: [file] },
    });
    await waitFor(() => expect(importSource).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(within(root).getByText("月守（つきもり）", { exact: false })).toBeTruthy());
    expect(importSource.mock.calls[0]?.[1]).toMatchObject({
      fileName: "terms.md",
      mediaType: "text/markdown",
      sizeBytes: file.size,
    });
    expect(within(root).getByRole("button", { name: /Japanese terms/u }).getAttribute("aria-current")).toBe("true");
    expect(within(root).queryByRole("button", { name: /Delete|Archive|Reparse|Search/u })).toBeNull();
  });

  it("saves editable source properties with revision conflict recovery while immutable facts remain read only", async () => {
    const original = detail();
    const latest = { ...original, revision: "e".repeat(64), source: { ...original.source, displayName: "Latest server title" } };
    const saved = {
      ...latest,
      revision: "f".repeat(64),
      source: { ...latest.source, displayName: "Author draft title", aiPermission: "allowed" as const },
    };
    vi.spyOn(api.research, "listSources").mockResolvedValue([listed(original)]);
    const getSource = vi.spyOn(api.research, "getSource")
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce(latest);
    const updateSource = vi.spyOn(api.research, "updateSource")
      .mockRejectedValueOnce(new ApiError("Conflict", 409, { code: "CONFLICT", message: "Changed" }))
      .mockResolvedValueOnce(saved);

    const { container } = render(<ReferenceResearchWorkspace seriesId={seriesId} />);
    const root = container.querySelector<HTMLElement>("#research-workspace")!;
    root.hidden = false;
    const displayName = await within(root).findByLabelText("Display name");
    fireEvent.change(displayName, { target: { value: "Author draft title" } });
    fireEvent.click(within(root).getByText("Allow when selected"));
    fireEvent.click(within(root).getByRole("button", { name: "Save properties" }));

    await waitFor(() => expect(getSource).toHaveBeenCalledTimes(2));
    expect(within(root).getByRole("alert").textContent).toContain("Your draft is still here");
    expect((within(root).getByLabelText("Display name") as HTMLInputElement).value).toBe("Author draft title");
    fireEvent.click(within(root).getByRole("button", { name: "Save properties" }));
    await waitFor(() => expect(updateSource).toHaveBeenCalledTimes(2));
    expect(updateSource.mock.calls[1]?.[2]).toMatchObject({
      baseRevision: latest.revision,
      displayName: "Author draft title",
      aiPermission: "allowed",
    });
    expect(within(root).queryByLabelText("Original file")).toBeNull();
    expect(within(root).getAllByText("interview.txt")).toHaveLength(2);
  });

  it("falls back safely when the restored source no longer exists", async () => {
    const txt = detail();
    localStorage.setItem(`novel-studio.research.selected.${seriesId}`, mdId);
    vi.spyOn(api.research, "listSources").mockResolvedValue([listed(txt)]);
    vi.spyOn(api.research, "getSource").mockResolvedValue(txt);

    const { container } = render(<ReferenceResearchWorkspace seriesId={seriesId} />);
    const root = container.querySelector<HTMLElement>("#research-workspace")!;
    root.hidden = false;
    await waitFor(() => expect(within(root).getByText(/previously selected source is no longer available/u)).toBeTruthy());
    expect(within(root).getByRole("button", { name: /Harbor interview/u }).getAttribute("aria-current")).toBe("true");
    expect(localStorage.getItem(`novel-studio.research.selected.${seriesId}`)).toBe(txtId);
  });

  it("returns to the source shelf when a listed source disappears before its detail opens", async () => {
    const txt = detail();
    const markdown = detail(mdId, { kind: "markdown" });
    localStorage.setItem(`novel-studio.research.selected.${seriesId}`, txtId);
    vi.spyOn(api.research, "listSources").mockResolvedValue([listed(txt), listed(markdown)]);
    vi.spyOn(api.research, "getSource").mockRejectedValue(new ApiError("Missing", 404, {
      code: "NOT_FOUND",
      message: "The source disappeared",
    }));

    const { container } = render(<ReferenceResearchWorkspace seriesId={seriesId} />);
    const root = container.querySelector<HTMLElement>("#research-workspace")!;
    root.hidden = false;
    await waitFor(() => expect(within(root).getByRole("alert").textContent).toContain("source disappeared"));
    expect(within(root).queryByRole("button", { name: /Harbor interview/u })).toBeNull();
    expect(within(root).getByRole("button", { name: /Japanese terms/u }).getAttribute("aria-current")).toBeNull();
    expect(root.querySelector(".rs8-layout")?.classList.contains("is-rail-open")).toBe(true);
    expect(localStorage.getItem(`novel-studio.research.selected.${seriesId}`)).toBeNull();
  });

  it("keeps the empty shelf stable and reports local or server upload failures without fake sources", async () => {
    vi.spyOn(api.research, "listSources").mockResolvedValue([]);
    const importSource = vi.spyOn(api.research, "importSource")
      .mockRejectedValue(new ApiError("Duplicate source", 409, { code: "CONFLICT", message: "This source is already in the shelf" }));

    const { container } = render(<ReferenceResearchWorkspace seriesId={seriesId} />);
    const root = container.querySelector<HTMLElement>("#research-workspace")!;
    root.hidden = false;
    await waitFor(() => expect(within(root).getByText("Your source shelf is empty")).toBeTruthy());

    fireEvent.change(within(root).getByLabelText("Choose a TXT or Markdown Research source"), {
      target: { files: [new File(["binary"], "archive.pdf", { type: "application/pdf" })] },
    });
    expect(within(root).getByRole("alert").textContent).toContain("Choose a UTF-8 TXT or Markdown file");
    expect(importSource).not.toHaveBeenCalled();

    fireEvent.change(within(root).getByLabelText("Choose a TXT or Markdown Research source"), {
      target: { files: [new File(["same source"], "duplicate.txt", { type: "text/plain" })] },
    });
    await waitFor(() => expect(importSource).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(within(root).getByRole("alert").textContent).toContain("already in the shelf"));
    expect(within(root).getByText("Your source shelf is empty")).toBeTruthy();
    expect(within(root).queryAllByRole("button", { name: /Ready/u })).toHaveLength(0);
  });
});
