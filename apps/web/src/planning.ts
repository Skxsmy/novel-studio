import type {
  PlanningAct,
  PlanningBoard,
  PlanningBook,
  PlanningChapter,
  PlanningScene,
  TimelineEventDocument,
} from "@novel-studio/contracts";

export type MatrixDimension =
  | "pov"
  | "character"
  | "location"
  | "plot-thread"
  | "tag"
  | "status";

export interface PlanningFilter {
  dimension: MatrixDimension;
  value: string;
}

export interface OutlineRow {
  kind: "book" | "act" | "chapter" | "scene";
  id: string;
  depth: number;
  title: string;
  scene?: PlanningScene;
}

export interface MatrixRow {
  value: string;
  label: string;
  sceneIds: string[];
}

export interface TimelineProjection {
  narrative: PlanningScene[];
  story: TimelineEventDocument[];
  unplaced: PlanningScene[];
}

export function valuesForScene(scene: PlanningScene, dimension: MatrixDimension): string[] {
  switch (dimension) {
    case "pov":
      return scene.pov ? [scene.pov] : [];
    case "character":
      return scene.characterIds;
    case "location":
      return scene.locationIds;
    case "plot-thread":
      return scene.plotThreadIds;
    case "tag":
      return scene.tags;
    case "status":
      return [scene.status];
  }
}

export function sceneMatchesFilter(scene: PlanningScene, filter: PlanningFilter | null): boolean {
  return filter === null || valuesForScene(scene, filter.dimension).includes(filter.value);
}

export function filterPlanningScenes(
  scenes: PlanningScene[],
  filter: PlanningFilter | null,
): PlanningScene[] {
  return scenes.filter((scene) => sceneMatchesFilter(scene, filter));
}

export function projectGrid(
  board: PlanningBoard,
  filter: PlanningFilter | null,
): PlanningBook[] {
  return board.books.map((book) => ({
    ...book,
    acts: book.acts.map((act): PlanningAct => ({
      ...act,
      chapters: act.chapters.map((chapter): PlanningChapter => ({
        ...chapter,
        scenes: filterPlanningScenes(chapter.scenes, filter),
      })),
    })),
  }));
}

export function projectOutline(
  board: PlanningBoard,
  filter: PlanningFilter | null,
): OutlineRow[] {
  const rows: OutlineRow[] = [];
  for (const book of board.books) {
    rows.push({ kind: "book", id: book.id, depth: 0, title: book.title });
    for (const act of book.acts) {
      rows.push({ kind: "act", id: act.id, depth: 1, title: act.title });
      for (const chapter of act.chapters) {
        rows.push({ kind: "chapter", id: chapter.id, depth: 2, title: chapter.title });
        for (const scene of filterPlanningScenes(chapter.scenes, filter)) {
          rows.push({ kind: "scene", id: scene.id, depth: 3, title: scene.title, scene });
        }
      }
    }
  }
  return rows;
}

function dimensionValues(board: PlanningBoard, dimension: MatrixDimension): string[] {
  switch (dimension) {
    case "pov":
      return board.dimensions.povs;
    case "character":
      return board.dimensions.characterIds;
    case "location":
      return board.dimensions.locationIds;
    case "plot-thread":
      return board.dimensions.plotThreadIds;
    case "tag":
      return board.dimensions.tags;
    case "status":
      return board.dimensions.statuses;
  }
}

export function dimensionLabel(
  dimension: MatrixDimension,
  value: string,
  codexLabels: Record<string, string> = {},
): string {
  if (["character", "location", "plot-thread"].includes(dimension)) {
    return codexLabels[value] ?? `#${value.slice(0, 8)}`;
  }
  return value;
}

export function projectMatrix(board: PlanningBoard, dimension: MatrixDimension): MatrixRow[] {
  return dimensionValues(board, dimension).map((value) => ({
    value,
    label: dimensionLabel(dimension, value, board.codexLabels),
    sceneIds: board.narrativeScenes
      .filter((scene) => valuesForScene(scene, dimension).includes(value))
      .map((scene) => scene.id),
  }));
}

export function projectTimelines(
  board: PlanningBoard,
  filter: PlanningFilter | null,
): TimelineProjection {
  const narrative = filterPlanningScenes(board.narrativeScenes, filter);
  const visibleIds = new Set(narrative.map((scene) => scene.id));
  return {
    narrative,
    story: filter === null
      ? board.storyEvents
      : board.storyEvents.filter((event) => event.event.sceneIds.some((id) => visibleIds.has(id))),
    unplaced: board.unplacedSceneIds
      .map((sceneId) => board.narrativeScenes.find((scene) => scene.id === sceneId))
      .filter((scene): scene is PlanningScene => scene !== undefined)
      .filter((scene) => sceneMatchesFilter(scene, filter)),
  };
}
