// @vitest-environment jsdom

import type { SceneBlockDocument, SceneDocument, SeriesDetail } from "@novel-studio/contracts";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, api } from "../api";
import { useProjectSession } from "./useProjectSession";

const seriesId = "11111111-1111-4111-8111-111111111111";
const sceneId = "22222222-2222-4222-8222-222222222222";
const blockId = "33333333-3333-4333-8333-333333333333";
const revision = "a".repeat(64);
const nextRevision = "b".repeat(64);
const document: SceneBlockDocument = {
  schemaVersion: 1,
  blocks: [{ id: blockId, kind: "paragraph", text: "Original" }],
};

function scene(title = "Opening", nextSceneRevision = revision): SceneDocument {
  return {
    characterCount: 8,
    content: "Original",
    document,
    metadata: {
      actId: "44444444-4444-4444-8444-444444444444",
      beats: [],
      bookId: "55555555-5555-4555-8555-555555555555",
      chapterId: "66666666-6666-4666-8666-666666666666",
      characterIds: [],
      conflict: "",
      createdAt: "2026-07-15T00:00:00.000Z",
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
      title,
      updatedAt: "2026-07-15T00:00:00.000Z",
    },
    paragraphCount: 1,
    plainText: "Original",
    relativePath: "books/volume/manuscript/chapter/act/001-opening.json",
    revision: nextSceneRevision,
  };
}

const detail = {
  acts: [],
  books: [],
  chapters: [],
  manifest: {
    archivedAt: null,
    bookIds: [],
    createdAt: "2026-07-15T00:00:00.000Z",
    description: "",
    id: seriesId,
    language: "zh-CN",
    schemaVersion: 1,
    title: "Autosave Series",
    updatedAt: "2026-07-15T00:00:00.000Z",
  },
  scenes: [scene()],
} as SeriesDetail;

async function openTestSeries(result: ReturnType<typeof renderHook<ReturnType<typeof useProjectSession>, unknown>>["result"]) {
  await act(async () => {
    await result.current.openSeries(seriesId);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(api.series, "listSeries").mockResolvedValue([]);
  vi.spyOn(api.series, "getSeries").mockResolvedValue(detail);
  vi.spyOn(api.series, "getSceneDocument").mockResolvedValue(scene());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Write autosave lifecycle", () => {
  it("retries a failed autosave exactly three times and waits for the next edit before a new cycle", async () => {
    const update = vi.spyOn(api.series, "updateSceneDocument").mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useProjectSession());
    await openTestSeries(result);

    act(() => result.current.updateDraftTitle("First edit"));
    expect(result.current.saveStatus).toBe("dirty");

    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    expect(update).toHaveBeenCalledTimes(1);
    expect(result.current.saveStatus).toBe("retrying");

    await act(async () => { await vi.advanceTimersByTimeAsync(450); });
    expect(update).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    expect(update).toHaveBeenCalledTimes(3);
    await act(async () => { await vi.advanceTimersByTimeAsync(1_350); });
    expect(update).toHaveBeenCalledTimes(4);
    expect(result.current.saveStatus).toBe("failed");
    expect(result.current.isDirty).toBe(true);

    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(update).toHaveBeenCalledTimes(4);

    update.mockResolvedValueOnce(scene("Second edit", nextRevision));
    act(() => result.current.updateDraftTitle("Second edit"));
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    expect(update).toHaveBeenCalledTimes(5);
    expect(result.current.saveStatus).toBe("saved");
    expect(result.current.isDirty).toBe(false);
  });

  it("does not retry a revision conflict", async () => {
    const update = vi.spyOn(api.series, "updateSceneDocument").mockRejectedValue(
      new ApiError("Conflict", 409, { message: "The Scene changed on disk." }),
    );
    const { result } = renderHook(() => useProjectSession());
    await openTestSeries(result);

    act(() => result.current.updateDraftTitle("Conflicting edit"));
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    expect(update).toHaveBeenCalledTimes(1);
    expect(result.current.saveStatus).toBe("conflict");
    expect(result.current.errorMessage).toBe("The Scene changed on disk.");

    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(update).toHaveBeenCalledTimes(1);
  });
});
