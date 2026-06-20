import { describe, expect, it } from "vitest";
import type { ActManifest, BookManifest, ChapterManifest, SeriesDetail } from "@novel-studio/contracts";
import { nextActTitle, nextBookTitle, nextChapterTitle, seriesDetailToSummary } from "./App";

describe("App structure helpers", () => {
  it("keeps an opened series summary usable after creation", () => {
    const detail = {
      manifest: {
        id: "series-1",
        title: "雾港纪事",
        description: "退潮后出现的城市",
        updatedAt: "2026-06-20T00:00:00.000Z",
        archivedAt: null,
      },
      books: [{ id: "book-1" }],
      scenes: [{ metadata: { id: "scene-1" } }],
    } as unknown as SeriesDetail;

    expect(seriesDetailToSummary(detail)).toMatchObject({
      id: "series-1",
      title: "雾港纪事",
      sceneCount: 1,
      bookCount: 1,
      archived: false,
    });
  });

  it("names new books, acts and chapters in Chinese writing terms", () => {
    const act = { id: "act-1" } as ActManifest;
    const chapters = [
      { id: "chapter-1", actId: "act-1" },
      { id: "chapter-2", actId: "act-2" },
    ] as ChapterManifest[];

    expect(nextBookTitle([{ id: "book-1" } as BookManifest])).toBe("第二部");
    expect(nextActTitle([act])).toBe("第二幕");
    expect(nextChapterTitle(act, chapters)).toBe("第二章");
    expect(nextChapterTitle({ id: "act-3" } as ActManifest, chapters)).toBe("第一章");
  });
});
