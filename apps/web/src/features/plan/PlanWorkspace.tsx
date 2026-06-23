import type { PlanningBoard, PlanningScene, SceneStatus, SeriesDetail } from "@novel-studio/contracts";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";

type PlanView = "storyboard" | "outline" | "tracking" | "timeline";
type MoveDirection = "up" | "down";
type SortMode = "narrative" | "title" | "status" | "length";
type StatusFilter = "all" | SceneStatus;

export interface PlanWorkspaceProps {
  series: SeriesDetail;
}

const planTabs: Array<{ id: PlanView; label: string }> = [
  { id: "storyboard", label: "Storyboard" },
  { id: "outline", label: "Outline" },
  { id: "tracking", label: "Matrix" },
  { id: "timeline", label: "Timeline" },
];

function statusPill(status: SceneStatus) {
  if (status === "draft" || status === "revising") return "pill amber";
  if (status === "final") return "pill green";
  return "pill";
}

function sceneSummary(scene: PlanningScene) {
  const pov = scene.pov ? `${scene.pov} / ` : "";
  return `${pov}${scene.characterCount} chars`;
}

function matchesScene(scene: PlanningScene, query: string, status: StatusFilter) {
  const normalized = query.trim().toLowerCase();
  if (status !== "all" && scene.status !== status) return false;
  if (!normalized) return true;
  return [scene.title, scene.status, scene.pov ?? "", scene.goal, scene.summary, ...scene.tags].some((value) =>
    value.toLowerCase().includes(normalized),
  );
}

function sortScenes(scenes: PlanningScene[], sortMode: SortMode) {
  const sorted = [...scenes];
  if (sortMode === "title") sorted.sort((left, right) => left.title.localeCompare(right.title));
  else if (sortMode === "status") sorted.sort((left, right) => left.status.localeCompare(right.status) || left.narrativeIndex - right.narrativeIndex);
  else if (sortMode === "length") sorted.sort((left, right) => right.characterCount - left.characterCount || left.narrativeIndex - right.narrativeIndex);
  else sorted.sort((left, right) => left.narrativeIndex - right.narrativeIndex);
  return sorted;
}

function findScenePlacement(board: PlanningBoard | null, sceneId: string | null) {
  if (!board || !sceneId) return null;

  for (const book of board.books) {
    for (const act of book.acts) {
      for (const chapter of act.chapters) {
        const index = chapter.scenes.findIndex((scene) => scene.id === sceneId);
        if (index >= 0) {
          return {
            chapterId: chapter.id,
            chapterTitle: chapter.title,
            index,
            sceneIds: chapter.scenes.map((scene) => scene.id),
          };
        }
      }
    }
  }

  return null;
}

export function PlanWorkspace({ series }: PlanWorkspaceProps) {
  const [activeView, setActiveView] = useState<PlanView>("storyboard");
  const [board, setBoard] = useState<PlanningBoard | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [movementError, setMovementError] = useState<string | null>(null);
  const [movingDirection, setMovingDirection] = useState<MoveDirection | null>(null);
  const [query, setQuery] = useState("");
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("narrative");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  async function loadPlanningBoard() {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const planningBoard = await api.series.getPlanningBoard(series.manifest.id);
      setBoard(planningBoard);
      setSelectedSceneId((current) => current ?? planningBoard.narrativeScenes[0]?.id ?? null);
      setMovementError(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load planning board");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadPlanningBoard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series.manifest.id]);

  const filteredScenes = useMemo(() => {
    if (!board) return [];
    return sortScenes(board.narrativeScenes.filter((scene) => matchesScene(scene, query, statusFilter)), sortMode);
  }, [board, query, sortMode, statusFilter]);

  const selectedScene = useMemo(
    () => board?.narrativeScenes.find((scene) => scene.id === selectedSceneId) ?? filteredScenes[0] ?? null,
    [board, filteredScenes, selectedSceneId],
  );
  const selectedPlacement = useMemo(() => findScenePlacement(board, selectedScene?.id ?? null), [board, selectedScene?.id]);
  const activeViewLabel = planTabs.find((tab) => tab.id === activeView)?.label ?? "Planning";
  const statusCounts = useMemo(() => {
    const counts = new Map<SceneStatus, number>();
    for (const scene of board?.narrativeScenes ?? []) counts.set(scene.status, (counts.get(scene.status) ?? 0) + 1);
    return [...counts.entries()];
  }, [board]);

  async function moveSelectedScene(direction: MoveDirection) {
    if (!board || !selectedScene || !selectedPlacement) return;
    const targetIndex = direction === "up" ? selectedPlacement.index - 1 : selectedPlacement.index + 1;
    if (targetIndex < 0 || targetIndex >= selectedPlacement.sceneIds.length) {
      setMovementError("This scene is already at the edge of its chapter.");
      return;
    }

    const orderedIds = [...selectedPlacement.sceneIds];
    const sourceId = orderedIds[selectedPlacement.index];
    const targetId = orderedIds[targetIndex];
    if (!sourceId || !targetId) return;
    orderedIds[selectedPlacement.index] = targetId;
    orderedIds[targetIndex] = sourceId;

    setMovementError(null);
    setMovingDirection(direction);
    try {
      await api.series.reorderScenes(series.manifest.id, selectedPlacement.chapterId, { orderedIds });
      const planningBoard = await api.series.getPlanningBoard(series.manifest.id);
      setBoard(planningBoard);
      setSelectedSceneId(selectedScene.id);
    } catch (error) {
      setMovementError(error instanceof Error ? error.message : "Failed to move scene");
    } finally {
      setMovingDirection(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2 className="page-title">Plan</h2>
          <p className="page-subtitle">Compare scene intent, order, pressure, and story time.</p>
        </div>
        <div className="segmented" role="tablist" aria-label="Planning views">
          {planTabs.map((tab) => (
            <button
              aria-selected={activeView === tab.id}
              className={`seg-btn${activeView === tab.id ? " is-active" : ""}`}
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="plan-grid">
        <section className="panel no-shadow">
          <div className="panel-body">
            <div className="filter-strip">
              <div className="filter-actions">
                <input
                  aria-label="Filter scenes"
                  className="input compact-filter"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search title, POV, goal, tag"
                  value={query}
                />
                <select
                  aria-label="Status"
                  className="select compact-select"
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                  value={statusFilter}
                >
                  <option value="all">All status</option>
                  {board?.dimensions.statuses.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                <select
                  aria-label="Sort"
                  className="select compact-select"
                  onChange={(event) => setSortMode(event.target.value as SortMode)}
                  value={sortMode}
                >
                  <option value="narrative">Narrative order</option>
                  <option value="title">Title</option>
                  <option value="status">Status</option>
                  <option value="length">Length</option>
                </select>
              </div>
              <button className="btn" disabled={isLoading} onClick={() => void loadPlanningBoard()} type="button">
                Reload
              </button>
            </div>

            <div className="plan-status-row">
              <span className="pill">{board?.narrativeScenes.length ?? 0} scenes</span>
              <span className={board?.unplacedSceneIds.length ? "pill amber" : "pill green"}>{board?.unplacedSceneIds.length ?? 0} unplaced</span>
              {statusCounts.map(([status, count]) => (
                <span className={statusPill(status)} key={status}>{count} {status}</span>
              ))}
            </div>

            <h3 className="plan-view-title">{activeViewLabel}</h3>
            {errorMessage ? <p className="alert">{errorMessage}</p> : null}
            {movementError ? <p className="alert">{movementError}</p> : null}
            {isLoading ? (
              <div className="large-note"><h2>Loading plan</h2><p>Loading the planning board.</p></div>
            ) : !board ? (
              <div className="large-note"><h2>No planning data</h2><p>The planning board is unavailable.</p></div>
            ) : activeView === "storyboard" ? (
              <StoryboardView board={board} scenes={filteredScenes} selectedSceneId={selectedScene?.id ?? null} onSelect={setSelectedSceneId} />
            ) : activeView === "outline" ? (
              <OutlineView board={board} scenes={filteredScenes} selectedSceneId={selectedScene?.id ?? null} onSelect={setSelectedSceneId} />
            ) : activeView === "tracking" ? (
              <TrackingView board={board} scenes={filteredScenes} selectedSceneId={selectedScene?.id ?? null} onSelect={setSelectedSceneId} />
            ) : (
              <TimelineView board={board} />
            )}
          </div>
        </section>

        <aside className="panel no-shadow">
          <div className="panel-head">
            <div>
              <div className="panel-title">Selected Scene</div>
              <div className="panel-kicker">{selectedScene?.title ?? "No selection"}</div>
            </div>
            {selectedScene ? <span className={statusPill(selectedScene.status)}>{selectedScene.status}</span> : null}
          </div>
          <div className="panel-body stack">
            {selectedScene ? (
              <>
                <div className="top-actions">
                  <button
                    className="btn"
                    disabled={!selectedPlacement || selectedPlacement.index === 0 || movingDirection !== null}
                    onClick={() => void moveSelectedScene("up")}
                    type="button"
                  >
                    {movingDirection === "up" ? "Moving" : "Move up"}
                  </button>
                  <button
                    className="btn"
                    disabled={!selectedPlacement || selectedPlacement.index >= selectedPlacement.sceneIds.length - 1 || movingDirection !== null}
                    onClick={() => void moveSelectedScene("down")}
                    type="button"
                  >
                    {movingDirection === "down" ? "Moving" : "Move down"}
                  </button>
                </div>
                <div className="field">
                  <label>Goal</label>
                  <textarea className="textarea" readOnly value={selectedScene.goal || "No goal set."} />
                </div>
                <div className="field">
                  <label>Conflict</label>
                  <textarea className="textarea" readOnly value={selectedScene.conflict || "No conflict set."} />
                </div>
                <div className="field">
                  <label>Outcome</label>
                  <textarea className="textarea" readOnly value={selectedScene.outcome || "No outcome set."} />
                </div>
                <details className="disclosure" open>
                  <summary>Scene pressure <span className="pill amber">{selectedScene.pov || "No POV"}</span></summary>
                  <div className="disclosure-body">
                    {selectedPlacement ? `${selectedPlacement.chapterTitle} / ${selectedPlacement.index + 1} of ${selectedPlacement.sceneIds.length}` : "Unplaced"}
                  </div>
                </details>
              </>
            ) : (
              <div className="large-note"><h2>No scene selected</h2><p>Select a scene in any planning view.</p></div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

interface PlanningViewProps {
  board: PlanningBoard;
  onSelect?: (sceneId: string) => void;
  scenes?: PlanningScene[];
  selectedSceneId?: string | null;
}

function StoryboardView({ board, onSelect, scenes = [], selectedSceneId }: PlanningViewProps) {
  if (!scenes.length) return <div className="large-note"><h2>No matching scenes</h2><p>No scenes match the current filters.</p></div>;

  const visibleScenes = new Map(scenes.map((scene) => [scene.id, scene]));
  const lanes = board.books.flatMap((book) =>
    book.acts.flatMap((act) =>
      act.chapters
        .map((chapter) => ({
          id: chapter.id,
          title: chapter.title || act.title,
          scenes: chapter.scenes.map((scene) => visibleScenes.get(scene.id)).filter((scene): scene is PlanningScene => Boolean(scene)),
        }))
        .filter((lane) => lane.scenes.length > 0),
    ),
  );
  const unplacedScenes = board.unplacedSceneIds.map((sceneId) => visibleScenes.get(sceneId)).filter((scene): scene is PlanningScene => Boolean(scene));
  if (unplacedScenes.length) lanes.push({ id: "unplaced", title: "Unplaced", scenes: unplacedScenes });

  return (
    <div className="storyboard" aria-label="Storyboard scenes">
      {lanes.map((lane) => (
        <div className="lane" key={lane.id}>
          <div className="lane-head">
            <div className="lane-title">{lane.title}</div>
            <span className="pill">{lane.scenes.length} scenes</span>
          </div>
          <div className="scene-card-list">
            {lane.scenes.map((scene) => (
              <button
                className={`plan-card${scene.id === selectedSceneId ? " is-active" : ""}`}
                key={scene.id}
                onClick={() => onSelect?.(scene.id)}
                type="button"
              >
                <div className="plan-card-top">
                  <h3>{scene.title}</h3>
                  <span className={statusPill(scene.status)}>{scene.status}</span>
                </div>
                <p>{scene.summary || sceneSummary(scene)}</p>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function OutlineView({ board, onSelect, scenes = [], selectedSceneId }: PlanningViewProps) {
  const visibleSceneIds = new Set(scenes.map((scene) => scene.id));
  return (
    <div className="row-list">
      {board.books.flatMap((book) =>
        book.acts.flatMap((act) =>
          act.chapters.flatMap((chapter) =>
            chapter.scenes.filter((scene) => visibleSceneIds.has(scene.id)).map((scene) => (
              <button
                className={`data-row${scene.id === selectedSceneId ? " is-active" : ""}`}
                key={scene.id}
                onClick={() => onSelect?.(scene.id)}
                type="button"
              >
                <div>
                  <div className="row-title">{chapter.title} / {scene.title}</div>
                  <div className="row-meta">{scene.summary || sceneSummary(scene)}</div>
                </div>
                <span className={statusPill(scene.status)}>{scene.status}</span>
              </button>
            )),
          ),
        ),
      )}
    </div>
  );
}

function TrackingView({ board, onSelect, scenes = [], selectedSceneId }: PlanningViewProps) {
  return (
    <table className="mini-matrix" aria-label="Scene tracking table">
      <thead>
        <tr><th>Scene</th><th>Status</th><th>POV</th><th>Tags</th><th>Order</th></tr>
      </thead>
      <tbody>
        {scenes.map((scene) => (
          <tr className={scene.id === selectedSceneId ? "is-active" : ""} key={scene.id} onClick={() => onSelect?.(scene.id)}>
            <td>{scene.title}</td>
            <td>{scene.status}</td>
            <td>{scene.pov || "Not set"}</td>
            <td>{scene.tags.map((tag) => board.codexLabels[tag] ?? tag).join(", ") || "None"}</td>
            <td>#{scene.narrativeIndex}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TimelineView({ board }: { board: PlanningBoard }) {
  if (!board.storyEvents.length) {
    return <div className="large-note"><h2>No timeline events</h2><p>{board.unplacedSceneIds.length} scenes are not attached to timeline events yet.</p></div>;
  }

  return (
    <div className="stack">
      {board.storyEvents.map((document) => (
        <div className="timeline-strip" key={document.event.id}>
          <strong>{document.event.title}</strong>
          <div className="timeline-track">
            <div className="timeline-cell">{document.event.timeLabel}</div>
            <div className="timeline-cell">{document.event.sceneIds.length} scenes</div>
            <div className="timeline-cell">{document.event.description}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
