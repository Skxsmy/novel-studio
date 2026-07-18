import type { SceneDocument, SceneStatus, SeriesDetail } from "@novel-studio/contracts";
import { useEffect, useMemo, useState } from "react";

import type { ProjectSessionState } from "../../app/useProjectSession";
import { api } from "../../api";
import { ReferenceSurface } from "../../ui/ReferenceSurface";
import "./overview-workspace.css";

type OverviewSession = Pick<
  ProjectSessionState,
  "activeSeries" | "selectedScene" | "selectedVolumeId"
>;

export interface ReferenceOverviewWorkspaceProps {
  onOpenPlan?: (sceneId: string | null) => void;
  onOpenWrite?: (sceneId: string) => void;
  session?: OverviewSession;
}

type ProposalQueueState =
  | { kind: "loading"; pendingCount: 0; seriesId: string | null }
  | { kind: "ready"; pendingCount: number; seriesId: string | null }
  | { kind: "error"; pendingCount: 0; seriesId: string | null };

const sceneStatusLabels: Record<SceneStatus, string> = {
  archived: "Archived",
  draft: "Draft",
  final: "Final",
  idea: "Planned",
  outlined: "Planned",
  revising: "Revising",
};

function toWordCount(characterCount: number) {
  if (characterCount <= 0) return 0;
  return Math.max(1, Math.round(characterCount / 5));
}

function formatRelativeTime(timestamp: string, now = Date.now()) {
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return "at an unknown time";
  const elapsed = Math.max(0, now - parsed);
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" }).format(new Date(parsed));
}

function sceneParentTitle(series: SeriesDetail, scene: SceneDocument) {
  return series.chapters.find((candidate) => candidate.id === scene.metadata.chapterId)?.title ?? "Act not set";
}

function scenePath(series: SeriesDetail, scene: SceneDocument) {
  const chapter = series.acts.find((candidate) => candidate.id === scene.metadata.actId)?.title ?? "Chapter not set";
  const act = sceneParentTitle(series, scene);
  return `Chapter · ${chapter} / Act · ${act} / Scene · ${scene.metadata.title}`;
}

function statusClass(status: SceneStatus) {
  if (status === "revising") return " revising";
  if (status === "draft") return " draft";
  return "";
}

function ConnectedOverviewWorkspace({
  onOpenPlan,
  onOpenWrite,
  session,
}: Required<Pick<ReferenceOverviewWorkspaceProps, "session">> & Omit<ReferenceOverviewWorkspaceProps, "session">) {
  const series = session.activeSeries;
  const seriesId = series?.manifest.id ?? null;
  const [proposalQueue, setProposalQueue] = useState<ProposalQueueState>({ kind: "loading", pendingCount: 0, seriesId: null });

  useEffect(() => {
    if (!seriesId) {
      setProposalQueue({ kind: "ready", pendingCount: 0, seriesId: null });
      return;
    }
    let current = true;
    setProposalQueue({ kind: "loading", pendingCount: 0, seriesId });
    void api.proposals.list(seriesId).then(
      (inbox) => {
        if (!current) return;
        setProposalQueue({
          kind: "ready",
          pendingCount: inbox.items.filter((document) => document.proposal.status === "pending").length,
          seriesId,
        });
      },
      () => {
        if (current) setProposalQueue({ kind: "error", pendingCount: 0, seriesId });
      },
    );
    return () => {
      current = false;
    };
  }, [seriesId]);

  const recentScenes = useMemo(() => {
    if (!series) return [];
    return [...series.scenes]
      .filter((scene) => scene.metadata.status !== "archived")
      .sort((left, right) => Date.parse(right.metadata.updatedAt) - Date.parse(left.metadata.updatedAt))
      .slice(0, 3);
  }, [series]);

  if (!series) {
    return (
      <section aria-label="Overview workspace" className="ov7 workspace-view" data-workspace-view="Overview" id="overview-workspace">
        <header className="ov7-head">
          <div className="ov7-title"><h1>No Series open</h1><p>Open a Series from the Project Library to see its overview.</p></div>
          <div className="ov7-actions">
            <button className="ov7-button" disabled type="button">Open plan</button>
            <button className="ov7-button primary" disabled type="button">Continue writing</button>
          </div>
        </header>
        <div className="ov7-scroll"><div className="ov7-content"><section className="ov7-resume" aria-labelledby="ov7-resume-title"><div><p className="ov7-eyebrow">Continue writing</p><h2 id="ov7-resume-title">No Scene selected</h2><p className="ov7-path">Select a Series and Scene to continue.</p><p className="ov7-resume-copy">Overview data appears only after the project authority has loaded.</p></div><div className="ov7-resume-state"><strong>— <span>words · No target set</span></strong><div aria-label="Scene word target unavailable" className="ov7-progress-track"><span /></div><button className="ov7-button primary" disabled type="button">Continue Scene</button></div></section></div></div>
      </section>
    );
  }

  const resumeScene = session.selectedScene;
  const currentVolume = series.books.find((book) => book.id === (resumeScene?.metadata.bookId ?? session.selectedVolumeId))
    ?? series.books[0]
    ?? null;
  const volumeScenes = currentVolume
    ? series.scenes.filter((scene) => scene.metadata.bookId === currentVolume.id && scene.metadata.status !== "archived")
    : series.scenes.filter((scene) => scene.metadata.status !== "archived");
  const volumeCharacterCount = volumeScenes.reduce((total, scene) => total + scene.characterCount, 0);
  const volumeTarget = currentVolume?.targetCharacters ?? 0;
  const targetProgress = volumeTarget > 0 ? Math.round((volumeCharacterCount / volumeTarget) * 100) : null;
  const resumeWords = resumeScene ? toWordCount(resumeScene.characterCount) : 0;
  const resumeTargetWords = resumeScene ? toWordCount(resumeScene.metadata.plannedCharacters) : 0;
  const resumeProgress = resumeTargetWords > 0 ? Math.min(100, Math.round((resumeWords / resumeTargetWords) * 100)) : 0;
  const planningAttention = volumeScenes.filter((scene) => scene.metadata.planningState === "review-needed");
  const firstPlanningAttention = planningAttention[0] ?? null;
  const canOpenPlan = Boolean(onOpenPlan);
  const canOpenResumeScene = Boolean(resumeScene && onOpenWrite);
  const volumeTitle = currentVolume?.title ?? "No Volume";
  const visibleProposalQueue = proposalQueue.seriesId === seriesId
    ? proposalQueue
    : { kind: "loading" as const, pendingCount: 0 as const, seriesId };

  const reviewQueueCopy = visibleProposalQueue.kind === "loading"
    ? "Checking author decisions."
    : visibleProposalQueue.kind === "error"
      ? "The Proposal queue is currently unavailable."
      : visibleProposalQueue.pendingCount === 0
        ? "No author decisions pending."
        : `${visibleProposalQueue.pendingCount} author decision${visibleProposalQueue.pendingCount === 1 ? "" : "s"} pending.`;
  const reviewQueueStatus = visibleProposalQueue.kind === "loading"
    ? "Checking"
    : visibleProposalQueue.kind === "error"
      ? "Unavailable"
      : visibleProposalQueue.pendingCount === 0
        ? "Clear"
        : `${visibleProposalQueue.pendingCount} pending`;

  return (
    <section aria-label="Overview workspace" className="ov7 workspace-view" data-workspace-view="Overview" id="overview-workspace">
      <header className="ov7-head">
        <div className="ov7-title">
          <h1>{series.manifest.title}</h1>
          <p>Volume · {volumeTitle} · Updated {formatRelativeTime(series.manifest.updatedAt)}</p>
        </div>
        <div className="ov7-actions">
          <button className="ov7-button" data-ov7-open="Plan" disabled={!canOpenPlan} onClick={() => onOpenPlan?.(null)} type="button">Open plan</button>
          <button className="ov7-button primary" data-ov7-write={resumeScene?.metadata.id} disabled={!canOpenResumeScene} onClick={() => resumeScene && onOpenWrite?.(resumeScene.metadata.id)} type="button">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 19l4-1 10-10-3-3L6 15zM14 5l3 3" /></svg>
            Continue writing
          </button>
        </div>
      </header>
      <div className="ov7-scroll">
        <div className="ov7-content">
          <section aria-labelledby="ov7-resume-title" className="ov7-resume">
            <div>
              <p className="ov7-eyebrow">Continue writing</p>
              <h2 id="ov7-resume-title">{resumeScene?.metadata.title ?? "No Scene selected"}</h2>
              <p className="ov7-path">{resumeScene ? scenePath(series, resumeScene) : "Select a Scene in Write to set the next writing entry."}</p>
              <p className="ov7-resume-copy">{resumeScene?.metadata.goal || resumeScene?.metadata.summary || "No Scene planning note has been added yet."}</p>
            </div>
            <div className="ov7-resume-state" data-ov7-target={resumeTargetWords} data-ov7-words={resumeWords}>
              <strong>
                <span id="ov7-current-words">{resumeScene ? resumeWords.toLocaleString("en-US") : "—"}</span>{" "}
                <span>{resumeTargetWords > 0 ? `of ${resumeTargetWords.toLocaleString("en-US")} words` : "words · No target set"}</span>
              </strong>
              <div aria-label={resumeTargetWords > 0 ? "Scene word target" : "Scene word target unavailable"} className="ov7-progress-track"><span id="ov7-scene-progress" style={{ width: `${resumeProgress}%` }} /></div>
              <button className="ov7-button primary" data-ov7-write={resumeScene?.metadata.id} disabled={!canOpenResumeScene} onClick={() => resumeScene && onOpenWrite?.(resumeScene.metadata.id)} type="button">Continue Scene</button>
            </div>
          </section>

          <section aria-label="Project progress" className="ov7-progress">
            <div className="ov7-progress-title"><strong>Project progress</strong><span>Current Volume · {volumeTitle}</span></div>
            <div className="ov7-metric"><strong id="ov7-scene-count">{volumeScenes.length}</strong><span>Scenes</span></div>
            <div className="ov7-metric"><strong id="ov7-drafted-count">{volumeScenes.filter((scene) => scene.metadata.status === "draft").length}</strong><span>Drafted</span></div>
            <div className="ov7-metric"><strong id="ov7-active-count">{volumeScenes.filter((scene) => scene.metadata.status === "revising").length}</strong><span>In revision</span></div>
            <div className="ov7-metric"><strong id="ov7-word-progress">{targetProgress === null ? "—" : `${targetProgress}%`}</strong><span>Word target</span></div>
          </section>

          <div className="ov7-columns">
            <section aria-labelledby="ov7-recent-title" className="ov7-section">
              <header className="ov7-section-head"><div><h2 id="ov7-recent-title">Recent scenes</h2><p>Resume writing without reopening the structure tree.</p></div><button className="ov7-link" data-ov7-open="Plan" disabled={!canOpenPlan} onClick={() => onOpenPlan?.(null)} type="button">View all in Plan</button></header>
              <div className="ov7-scene-list">
                {recentScenes.length > 0 ? recentScenes.map((scene) => (
                  <button className="ov7-scene-row" data-ov7-plan-id={scene.metadata.id} data-ov7-write={scene.metadata.id} disabled={!onOpenWrite} key={scene.metadata.id} onClick={() => onOpenWrite?.(scene.metadata.id)} type="button">
                    <span className="ov7-scene-index">Scene {scene.metadata.order}</span>
                    <span className="ov7-scene-copy"><strong>{scene.metadata.title}</strong><span>{sceneParentTitle(series, scene)} · edited {formatRelativeTime(scene.metadata.updatedAt)}</span></span>
                    <span className="ov7-scene-meta"><span>{toWordCount(scene.characterCount).toLocaleString("en-US")} words</span><span className={`ov7-status${statusClass(scene.metadata.status)}`}>{sceneStatusLabels[scene.metadata.status]}</span></span>
                  </button>
                )) : (
                  <button className="ov7-scene-row" disabled type="button"><span className="ov7-scene-index">Scene —</span><span className="ov7-scene-copy"><strong>No recent Scene</strong><span>Create a Scene in Plan or Write to begin.</span></span><span className="ov7-scene-meta"><span>0 words</span><span className="ov7-status">Empty</span></span></button>
                )}
              </div>
            </section>

            <aside aria-labelledby="ov7-attention-title" className="ov7-section">
              <header className="ov7-section-head"><div><h2 id="ov7-attention-title">Needs attention</h2><p><span id="ov7-attention-count">{planningAttention.length}</span> item{planningAttention.length === 1 ? "" : "s"} before the next clean draft.</p></div></header>
              <div className="ov7-attention-list">
                <button className="ov7-attention-row" data-ov7-attention={firstPlanningAttention ? "" : undefined} data-ov7-plan={firstPlanningAttention?.metadata.id} disabled={!firstPlanningAttention || !canOpenPlan} onClick={() => onOpenPlan?.(firstPlanningAttention?.metadata.id ?? null)} type="button">
                  <span className="ov7-attention-copy"><span className="ov7-attention-kind amber">Plan</span><strong>{firstPlanningAttention ? "Plan and draft differ" : "Plan and draft are aligned"}</strong><p>{firstPlanningAttention?.metadata.divergenceNote || (firstPlanningAttention ? `${firstPlanningAttention.metadata.title} is marked for planning review.` : "No Scene is currently marked for planning review.")}</p></span><span className="ov7-arrow">{firstPlanningAttention ? "›" : "—"}</span>
                </button>
                <button aria-label="Continuity warnings are not available yet" className="ov7-attention-row" disabled type="button">
                  <span className="ov7-attention-copy"><span className="ov7-attention-kind blue">Continuity</span><strong>Continuity checks unavailable</strong><p>This row will show real warnings after a continuity-analysis source is connected.</p></span><span className="ov7-arrow">—</span>
                </button>
                <div aria-live="polite" className="ov7-clear-row" role={visibleProposalQueue.kind === "error" ? "alert" : "status"}><span><strong>Review queue</strong><br />{reviewQueueCopy}</span><span className={`ov7-status${visibleProposalQueue.pendingCount > 0 ? " draft" : ""}`}>{reviewQueueStatus}</span></div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ReferenceOverviewWorkspace(props: ReferenceOverviewWorkspaceProps = {}) {
  if (!props.session) return <ReferenceSurface selector="#overview-workspace" />;
  return <ConnectedOverviewWorkspace {...props} session={props.session} />;
}
