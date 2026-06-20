import { describe, expect, it } from "vitest";
import type { PlanningBoard, PlanningScene } from "@novel-studio/contracts";
import {
  filterPlanningScenes,
  projectGrid,
  projectMatrix,
  projectOutline,
  projectTimelines,
} from "./planning.js";

const ids = {
  series: "00000000-0000-4000-8000-000000000001",
  book: "00000000-0000-4000-8000-000000000002",
  act: "00000000-0000-4000-8000-000000000003",
  chapter: "00000000-0000-4000-8000-000000000004",
  first: "00000000-0000-4000-8000-000000000005",
  flashback: "00000000-0000-4000-8000-000000000006",
  character: "00000000-0000-4000-8000-000000000007",
  location: "00000000-0000-4000-8000-000000000008",
  thread: "00000000-0000-4000-8000-000000000009",
  eventPast: "00000000-0000-4000-8000-000000000010",
  eventNow: "00000000-0000-4000-8000-000000000011",
};

function scene(id: string, title: string, narrativeIndex: number, pov: string): PlanningScene {
  return {
    id,
    bookId: ids.book,
    actId: ids.act,
    chapterId: ids.chapter,
    title,
    status: "outlined",
    pov,
    locationIds: [ids.location],
    characterIds: [ids.character],
    plotThreadIds: narrativeIndex === 2 ? [ids.thread] : [],
    tags: narrativeIndex === 2 ? ["回忆"] : ["主线"],
    goal: "",
    conflict: "",
    outcome: "",
    summary: "",
    beats: [],
    plannedCharacters: 0,
    durationMinutes: null,
    planningState: "aligned",
    divergenceNote: "",
    order: narrativeIndex,
    narrativeIndex,
    characterCount: 0,
    revision: "a".repeat(64),
  };
}

const first = scene(ids.first, "现在", 1, "林岚");
const flashback = scene(ids.flashback, "十年前", 2, "周野");
const board: PlanningBoard = {
  seriesId: ids.series,
  revision: "b".repeat(64),
  books: [{
    id: ids.book,
    title: "第一部",
    order: 1,
    acts: [{
      id: ids.act,
      bookId: ids.book,
      title: "第一幕",
      order: 1,
      chapters: [{
        id: ids.chapter,
        actId: ids.act,
        title: "第一章",
        order: 1,
        scenes: [first, flashback],
      }],
    }],
  }],
  narrativeScenes: [first, flashback],
  storyEvents: [
    {
      event: {
        schemaVersion: 1,
        id: ids.eventPast,
        title: "旧案发生",
        timeKind: "relative",
        timeLabel: "十年前",
        startsAt: null,
        precision: "year",
        durationMinutes: null,
        sceneIds: [ids.flashback],
        description: "",
        tags: [],
        createdAt: "2026-06-20T00:00:00.000Z",
        updatedAt: "2026-06-20T00:00:00.000Z",
      },
      revision: "c".repeat(64),
      storyIndex: 1,
    },
    {
      event: {
        schemaVersion: 1,
        id: ids.eventNow,
        title: "调查开始",
        timeKind: "relative",
        timeLabel: "现在",
        startsAt: null,
        precision: "day",
        durationMinutes: null,
        sceneIds: [ids.first],
        description: "",
        tags: [],
        createdAt: "2026-06-20T00:00:00.000Z",
        updatedAt: "2026-06-20T00:00:00.000Z",
      },
      revision: "d".repeat(64),
      storyIndex: 2,
    },
  ],
  unplacedSceneIds: [],
  dimensions: {
    povs: ["周野", "林岚"],
    characterIds: [ids.character],
    locationIds: [ids.location],
    plotThreadIds: [ids.thread],
    tags: ["主线", "回忆"],
    statuses: ["outlined"],
  },
  legacyStoryTimeSceneIds: [],
};

describe("planning projections", () => {
  it("does not mutate the shared board while switching projections", () => {
    const before = JSON.stringify(board);
    projectGrid(board, null);
    projectOutline(board, null);
    projectMatrix(board, "tag");
    projectTimelines(board, null);
    expect(JSON.stringify(board)).toBe(before);
  });

  it("keeps the same narrative order in grid, outline and timeline", () => {
    expect(projectGrid(board, null)[0]!.acts[0]!.chapters[0]!.scenes.map((item) => item.id))
      .toEqual([ids.first, ids.flashback]);
    expect(projectOutline(board, null).filter((row) => row.kind === "scene").map((row) => row.id))
      .toEqual([ids.first, ids.flashback]);
    expect(projectTimelines(board, null).narrative.map((item) => item.id))
      .toEqual([ids.first, ids.flashback]);
  });

  it("computes matrix dimensions from scene authority fields", () => {
    expect(projectMatrix(board, "pov")).toEqual([
      { value: "周野", label: "周野", sceneIds: [ids.flashback] },
      { value: "林岚", label: "林岚", sceneIds: [ids.first] },
    ]);
    expect(projectMatrix(board, "plot-thread")[0]!.sceneIds).toEqual([ids.flashback]);
    expect(projectMatrix(board, "character")[0]!.sceneIds).toEqual([ids.first, ids.flashback]);
    expect(projectMatrix(board, "location")[0]!.sceneIds).toEqual([ids.first, ids.flashback]);
    expect(projectMatrix(board, "status")[0]!.sceneIds).toEqual([ids.first, ids.flashback]);
    expect(filterPlanningScenes(board.narrativeScenes, { dimension: "tag", value: "回忆" }))
      .toEqual([flashback]);
  });

  it("keeps flashback narrative and story order independent", () => {
    const timeline = projectTimelines(board, null);
    expect(timeline.narrative.map((item) => item.title)).toEqual(["现在", "十年前"]);
    expect(timeline.story.map((item) => item.event.title)).toEqual(["旧案发生", "调查开始"]);
  });
});
