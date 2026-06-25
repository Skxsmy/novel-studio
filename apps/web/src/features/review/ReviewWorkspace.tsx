import { uiText } from "../../app/uiText";

export function ReviewWorkspace() {
  const text = uiText.review;

  return (
    <>
      <div className="page-head">
        <div>
          <h2 className="page-title">{text.title}</h2>
          <p className="page-subtitle">{text.subtitle}</p>
        </div>
        <span className="pill muted">{text.status}</span>
        <div className="filter-actions">
          {text.filters.map((filter) => (
            <button className="btn" disabled key={filter} type="button">{filter}</button>
          ))}
        </div>
      </div>
      <div className="review-grid is-unavailable">
        <aside className="panel no-shadow">
          <div className="panel-head">
            <div>
              <div className="panel-title">{text.queueTitle}</div>
              <div className="panel-kicker">{text.queueKicker}</div>
            </div>
            <span className="pill muted">{text.status}</span>
          </div>
          <div className="panel-body review-groups">
            <div className="unavailable-note">
              <h2>{text.queueEmptyTitle}</h2>
              <p>{text.queueEmptyBody}</p>
            </div>
          </div>
        </aside>
        <section className="panel decision-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">{text.decisionTitle}</div>
              <div className="panel-kicker">{text.decisionKicker}</div>
            </div>
          </div>
          <div className="decision-body">
            <div className="unavailable-note">
              <h2>{text.decisionEmptyTitle}</h2>
              <p>{text.decisionEmptyBody}</p>
            </div>
          </div>
        </section>
        <aside className="panel no-shadow">
          <div className="panel-head">
            <div>
              <div className="panel-title">{text.evidenceTitle}</div>
              <div className="panel-kicker">{text.evidenceKicker}</div>
            </div>
          </div>
          <div className="panel-body evidence-stack">
            <div className="unavailable-note">
              <p>{text.evidenceBody}</p>
            </div>
          </div>
        </aside>
        <aside className="panel no-shadow">
          <div className="panel-head">
            <div>
              <div className="panel-title">{text.impactTitle}</div>
              <div className="panel-kicker">{text.impactKicker}</div>
            </div>
          </div>
          <div className="panel-body impact-stack">
            <div className="unavailable-note">
              <p>{text.impactBody}</p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
