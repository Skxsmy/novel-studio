import { useEffect, useMemo, useState, type DragEvent } from "react";
import type { PlanningBoard, PlanningScene, TimelineEventDocument } from "@novel-studio/contracts";
import { api } from "./api";
import { readablePlanningState, readableSceneStatus } from "./copy";
import {
  dimensionLabel,
  projectGrid,
  projectMatrix,
  projectOutline,
  projectTimelines,
  type MatrixDimension,
  type PlanningFilter,
} from "./planning";

type PlanMode = "grid" | "outline" | "matrix" | "timeline";

interface PlanViewProps {
  board: PlanningBoard;
  onReload: () => Promise<void>;
  onOpenScene: (sceneId: string) => void;
}

const modes: Array<{ id: PlanMode; label: string }> = [
  { id: "grid", label: "故事板" },
  { id: "outline", label: "大纲" },
  { id: "matrix", label: "追踪表" },
  { id: "timeline", label: "时间线" },
];

const dimensions: Array<{ id: MatrixDimension; label: string }> = [
  { id: "pov", label: "视角" },
  { id: "character", label: "人物" },
  { id: "location", label: "地点" },
  { id: "plot-thread", label: "情节线" },
  { id: "tag", label: "标签" },
  { id: "status", label: "状态" },
];

function PlanningSceneCard({
  scene,
  selected,
  onSelect,
  onOpen,
  onDragStart,
  onDrop,
  onMove,
  onMoveChapter,
}: {
  scene: PlanningScene;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onMove: (delta: number) => void;
  onMoveChapter: (delta: number) => void;
}) {
  return (
    <article
      className={`planning-scene-card ${selected ? "selected" : ""}`}
      data-scene-id={scene.id}
      draggable
      onClick={onSelect}
      onDoubleClick={onOpen}
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <div className="scene-card-top">
        <span>{String(scene.narrativeIndex).padStart(2, "0")}</span>
        <span className="draft-dot">{readableSceneStatus(scene.status)}</span>
      </div>
      <h4>{scene.title}</h4>
      <p>{scene.summary || "尚未填写规划摘要。"}</p>
      <div className="planning-card-meta">
        <span>{scene.pov || "未设视角"}</span>
        <span>{scene.characterCount} 字</span>
      </div>
      <div className="planning-card-actions">
        <button aria-label={`前移一章 ${scene.title}`} onClick={(event) => { event.stopPropagation(); onMoveChapter(-1); }}>←</button>
        <button aria-label={`上移 ${scene.title}`} onClick={(event) => { event.stopPropagation(); onMove(-1); }}>↑</button>
        <button aria-label={`下移 ${scene.title}`} onClick={(event) => { event.stopPropagation(); onMove(1); }}>↓</button>
        <button aria-label={`后移一章 ${scene.title}`} onClick={(event) => { event.stopPropagation(); onMoveChapter(1); }}>→</button>
      </div>
      {scene.planningState !== "aligned" && <span className="divergence-chip">{readablePlanningState(scene.planningState)}</span>}
    </article>
  );
}

function ScenePlanningInspector({
  seriesId,
  scene,
  onReload,
}: {
  seriesId: string;
  scene: PlanningScene;
  onReload: () => Promise<void>;
}) {
  const [summary, setSummary] = useState(scene.summary);
  const [note, setNote] = useState(scene.divergenceNote);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSummary(scene.summary);
    setNote(scene.divergenceNote);
  }, [scene.id, scene.summary, scene.divergenceNote]);

  async function update(changes: Parameters<typeof api.updateScenePlanning>[2]) {
    setBusy(true);
    try {
      await api.updateScenePlanning(seriesId, scene.id, changes);
      await onReload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="planning-inspector" data-testid="planning-inspector">
      <p className="eyebrow">当前场景</p>
      <h3>{scene.title}</h3>
      <label>规划摘要<textarea value={summary} onChange={(event) => setSummary(event.target.value)} /></label>
      <label>分叉说明<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label>
      <button disabled={busy} onClick={() => void update({
        baseRevision: scene.revision,
        summary,
        divergenceNote: note,
        planningState: "aligned",
      })}>保存规划并标为一致</button>
      <div className="divergence-actions">
        <button disabled={busy} onClick={() => void update({
          baseRevision: scene.revision,
          planningState: "review-needed",
          divergenceNote: note || "等待作者判断计划与正文的分叉。",
        })}>标记为需要判断</button>
        <button disabled={busy} onClick={() => void update({
          baseRevision: scene.revision,
          planningState: "intentional-deviation",
          divergenceNote: note,
        })}>保留有意偏离</button>
        <button disabled={busy} onClick={() => void update({
          baseRevision: scene.revision,
          planningState: "revise-prose",
          divergenceNote: note,
        })}>保留规划，修订正文</button>
      </div>
    </aside>
  );
}

export function PlanView({ board, onReload, onOpenScene }: PlanViewProps) {
  const [mode, setMode] = useState<PlanMode>("grid");
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(
    board.narrativeScenes[0]?.id ?? null,
  );
  const [dimension, setDimension] = useState<MatrixDimension>("pov");
  const [filter, setFilter] = useState<PlanningFilter | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventTimeLabel, setEventTimeLabel] = useState("");

  useEffect(() => {
    if (selectedSceneId && board.narrativeScenes.some((scene) => scene.id === selectedSceneId)) return;
    setSelectedSceneId(board.narrativeScenes[0]?.id ?? null);
  }, [board, selectedSceneId]);

  const selectedScene = board.narrativeScenes.find((scene) => scene.id === selectedSceneId) ?? null;
  const grid = useMemo(() => projectGrid(board, filter), [board, filter]);
  const outline = useMemo(() => projectOutline(board, filter), [board, filter]);
  const matrix = useMemo(() => projectMatrix(board, dimension), [board, dimension]);
  const timelines = useMemo(() => projectTimelines(board, filter), [board, filter]);
  const filterText = filter
    ? dimensionLabel(filter.dimension, filter.value, board.codexLabels)
    : "";

  async function run(command: () => Promise<unknown>) {
    setBusy(true);
    setMessage("");
    try {
      await command();
      await onReload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "规划操作失败");
    } finally {
      setBusy(false);
    }
  }

  function chapterFor(sceneId: string) {
    for (const book of board.books) for (const act of book.acts) for (const chapter of act.chapters) {
      if (chapter.scenes.some((scene) => scene.id === sceneId)) return chapter;
    }
    return null;
  }

  async function placeScene(sceneId: string, targetChapterId: string, targetOrder: number) {
    const source = chapterFor(sceneId);
    const target = board.books.flatMap((book) => book.acts)
      .flatMap((act) => act.chapters)
      .find((chapter) => chapter.id === targetChapterId);
    if (!source || !target) throw new Error("场景层级已经变化，请刷新后重试");
    if (source.id === target.id) {
      const orderedIds = source.scenes.map((scene) => scene.id).filter((id) => id !== sceneId);
      orderedIds.splice(Math.max(0, Math.min(targetOrder - 1, orderedIds.length)), 0, sceneId);
      await api.reorderScenes(board.seriesId, source.id, { orderedIds });
    } else {
      await api.moveScene(board.seriesId, sceneId, { targetChapterId, order: targetOrder });
    }
  }

  function moveWithin(scene: PlanningScene, delta: number) {
    const chapter = chapterFor(scene.id);
    if (!chapter) return;
    const targetOrder = Math.max(1, Math.min(scene.order + delta, chapter.scenes.length));
    if (targetOrder === scene.order) return;
    void run(() => placeScene(scene.id, chapter.id, targetOrder));
  }

  function moveAcrossChapter(scene: PlanningScene, delta: number) {
    const chapters = board.books.flatMap((book) => book.acts).flatMap((act) => act.chapters);
    const currentIndex = chapters.findIndex((chapter) => chapter.id === scene.chapterId);
    const target = chapters[currentIndex + delta];
    if (!target) return;
    void run(() => placeScene(scene.id, target.id, target.scenes.length + 1));
  }

  function dropOnScene(event: DragEvent<HTMLElement>, target: PlanningScene) {
    event.preventDefault();
    event.stopPropagation();
    const sceneId = event.dataTransfer.getData("application/x-novel-studio-scene");
    if (!sceneId || sceneId === target.id) return;
    setSelectedSceneId(sceneId);
    const sourceScene = board.narrativeScenes.find((scene) => scene.id === sceneId);
    const targetOrder = sourceScene?.chapterId === target.chapterId && sourceScene.order < target.order
      ? target.order - 1
      : target.order;
    void run(() => placeScene(sceneId, target.chapterId, targetOrder));
  }

  function dropAtChapterEnd(event: DragEvent<HTMLElement>, chapterId: string, length: number) {
    event.preventDefault();
    event.stopPropagation();
    const sceneId = event.dataTransfer.getData("application/x-novel-studio-scene");
    if (!sceneId) return;
    setSelectedSceneId(sceneId);
    void run(() => placeScene(sceneId, chapterId, length + 1));
  }

  function reorderEvent(event: TimelineEventDocument, delta: number) {
    const ids = board.storyEvents.map((item) => item.event.id);
    const from = ids.indexOf(event.event.id);
    const to = Math.max(0, Math.min(from + delta, ids.length - 1));
    if (from === to) return;
    ids.splice(from, 1);
    ids.splice(to, 0, event.event.id);
    void run(() => api.reorderTimelineEvents(board.seriesId, { orderedIds: ids }));
  }

  function createEvent() {
    if (!eventTitle.trim()) return;
    void run(async () => {
      await api.createTimelineEvent(board.seriesId, {
        title: eventTitle.trim(),
        timeKind: eventTimeLabel.trim() ? "relative" : "unknown",
        timeLabel: eventTimeLabel.trim() || "时间未定",
        sceneIds: selectedScene ? [selectedScene.id] : [],
      });
      setEventTitle("");
      setEventTimeLabel("");
    });
  }

  return (
    <section className="content-page planning-page" data-testid="planning-page">
      <div className="page-heading compact">
        <div><p className="eyebrow">故事规划</p><h2>故事规划</h2></div>
        <div className="segmented" data-testid="planning-modes">
          {modes.map((item) => (
            <button className={mode === item.id ? "active" : ""} onClick={() => setMode(item.id)} key={item.id}>{item.label}</button>
          ))}
        </div>
      </div>
      <div className="planning-toolbar">
        <span>{board.narrativeScenes.length} 个场景 · {board.storyEvents.length} 个故事事件</span>
        {filter && <button className="filter-chip" onClick={() => setFilter(null)}>筛选：{filterText} ×</button>}
        <span className="planning-revision">资料版本 {board.revision.slice(0, 8)}</span>
      </div>
      {message && <div className="milestone-notice error">{message}</div>}

      <div className="planning-layout">
        <div className="planning-canvas" aria-busy={busy}>
          {mode === "grid" && <div data-testid="grid-view">
            {grid.map((book) => <div className="planning-book" key={book.id}>
              <h3>{book.title}</h3>
              {book.acts.map((act) => <section className="planning-act" key={act.id}>
                <div className="act-heading"><span>{act.title}</span><small>{act.chapters.length} 章</small></div>
                {act.chapters.map((chapter) => <div
                  className="planning-chapter"
                  key={chapter.id}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => dropAtChapterEnd(event, chapter.id, chapter.scenes.length)}
                >
                  <h4>{chapter.title}<small>{chapter.scenes.length} 场</small></h4>
                  <div className="planning-scene-grid">
                    {chapter.scenes.map((scene) => <PlanningSceneCard
                      key={scene.id}
                      scene={scene}
                      selected={selectedSceneId === scene.id}
                      onSelect={() => setSelectedSceneId(scene.id)}
                      onOpen={() => onOpenScene(scene.id)}
                      onDragStart={(event) => event.dataTransfer.setData("application/x-novel-studio-scene", scene.id)}
                      onDrop={(event) => dropOnScene(event, scene)}
                      onMove={(delta) => moveWithin(scene, delta)}
                      onMoveChapter={(delta) => moveAcrossChapter(scene, delta)}
                    />)}
                    {!chapter.scenes.length && <div className="empty-chapter-drop">拖入场景</div>}
                  </div>
                </div>)}
              </section>)}
            </div>)}
          </div>}

          {mode === "outline" && <div className="outline-view" data-testid="outline-view">
            {outline.map((row) => <button
              className={`outline-row ${row.kind} ${row.id === selectedSceneId ? "selected" : ""}`}
              style={{ paddingLeft: `${16 + row.depth * 24}px` }}
              key={`${row.kind}-${row.id}`}
              onClick={() => row.scene && setSelectedSceneId(row.id)}
              onDoubleClick={() => row.scene && onOpenScene(row.id)}
            >
              <span>{row.kind === "scene" ? String(row.scene!.narrativeIndex).padStart(2, "0") : "◆"}</span>
              <strong>{row.title}</strong>
              {row.scene && <small>{row.scene.summary || "无摘要"}</small>}
            </button>)}
          </div>}

          {mode === "matrix" && <div className="matrix-view" data-testid="matrix-view">
            <div className="dimension-tabs">{dimensions.map((item) => <button className={dimension === item.id ? "active" : ""} onClick={() => setDimension(item.id)} key={item.id}>{item.label}</button>)}</div>
            <div className="matrix-scroll"><table><thead><tr><th>{dimensions.find((item) => item.id === dimension)?.label}</th>{board.narrativeScenes.map((scene) => <th key={scene.id}>{scene.narrativeIndex}. {scene.title}</th>)}</tr></thead>
              <tbody>{matrix.length ? matrix.map((row) => <tr key={row.value}><th><button onClick={() => setFilter({ dimension, value: row.value })}>{row.label}</button></th>{board.narrativeScenes.map((scene) => <td className={row.sceneIds.includes(scene.id) ? "present" : ""} key={scene.id}>{row.sceneIds.includes(scene.id) ? "●" : ""}</td>)}</tr>) : <tr><td colSpan={board.narrativeScenes.length + 1}>当前维度还没有数据</td></tr>}</tbody>
            </table></div>
            {["character", "location", "plot-thread"].includes(dimension) && <p className="matrix-note">名称来自当前设定库；如果条目缺失，会显示稳定短号，方便排查引用。</p>}
          </div>}

          {mode === "timeline" && <div className="timeline-view" data-testid="timeline-view">
            <section><h3>叙事时间线<small>读者看到的顺序</small></h3>{timelines.narrative.map((scene) => <button className={selectedSceneId === scene.id ? "selected" : ""} onClick={() => setSelectedSceneId(scene.id)} key={scene.id}><span>{scene.narrativeIndex}</span><div><strong>{scene.title}</strong><small>{scene.pov || "未设视角"}</small></div></button>)}</section>
            <section><h3>故事时间线<small>世界中实际发生</small></h3>{timelines.story.map((event) => <article className="story-event" key={event.event.id}><span>{event.storyIndex}</span><div><strong>{event.event.title}</strong><small>{event.event.timeLabel} · {event.event.sceneIds.length} 个场景</small></div><div><button aria-label={`提前 ${event.event.title}`} onClick={() => reorderEvent(event, -1)}>↑</button><button aria-label={`推后 ${event.event.title}`} onClick={() => reorderEvent(event, 1)}>↓</button><button aria-label={`删除 ${event.event.title}`} onClick={() => void run(() => api.deleteTimelineEvent(board.seriesId, event.event.id, event.revision))}>×</button></div></article>)}</section>
            <section className="unplaced-scenes"><h3>未放置<small>尚未关联故事事件</small></h3>{timelines.unplaced.map((scene) => <button onClick={() => setSelectedSceneId(scene.id)} key={scene.id}>{scene.title}</button>)}</section>
            <section className="event-composer"><h3>新建故事事件</h3><input value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} placeholder="事件标题" /><input value={eventTimeLabel} onChange={(event) => setEventTimeLabel(event.target.value)} placeholder="时间标签，如：十年前" /><button disabled={busy || !eventTitle.trim()} onClick={createEvent}>关联当前场景并创建</button></section>
          </div>}
        </div>
        {selectedScene && <ScenePlanningInspector seriesId={board.seriesId} scene={selectedScene} onReload={onReload} />}
      </div>
    </section>
  );
}
