import type { SeriesDetail } from "@novel-studio/contracts";

export interface OverviewWorkspaceProps {
  series: SeriesDetail;
}

export function OverviewWorkspace({ series }: OverviewWorkspaceProps) {
  const sceneCount = series.scenes.length;
  const firstScene = series.scenes[0];

  return (
    <>
      <div className="page-head">
        <div>
          <h2 className="page-title">Overview</h2>
          <p className="page-subtitle">The next writing decisions are visible without opening every panel.</p>
        </div>
        <button className="btn primary" type="button">Continue Scene</button>
      </div>
      <div className="overview-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Today</div>
              <div className="panel-kicker">Drafting path</div>
            </div>
          </div>
          <div className="panel-body stack">
            <div className="large-note">
              <h2>{firstScene?.metadata.title ?? "No scene"}</h2>
              <p>{firstScene?.metadata.goal || "Select a scene to see the current drafting path."}</p>
            </div>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Warnings</div>
              <div className="panel-kicker">Needs attention</div>
            </div>
            <span className="pill amber">0</span>
          </div>
          <div className="panel-body stack">
            <div className="large-note">
              <h2>No warnings</h2>
              <p>Continuity and index checks will appear here when available.</p>
            </div>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Review queue</div>
              <div className="panel-kicker">Author decisions</div>
            </div>
            <span className="pill">0</span>
          </div>
          <div className="panel-body row-list">
            <div className="large-note">
              <h2>Nothing pending</h2>
              <p>{sceneCount} scenes in this project. Review items will appear here.</p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
