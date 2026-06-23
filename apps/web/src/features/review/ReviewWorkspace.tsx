export function ReviewWorkspace() {
  return (
    <>
      <div className="page-head">
        <div>
          <h2 className="page-title">Review Inbox</h2>
          <p className="page-subtitle">Work through author decisions with evidence and impact visible at the same time.</p>
        </div>
        <div className="filter-actions">
          <button className="btn primary" type="button">All</button>
          <button className="btn" type="button">Prose</button>
          <button className="btn" type="button">Continuity</button>
          <button className="btn" type="button">Facts</button>
          <button className="btn" type="button">Calls</button>
        </div>
      </div>
      <div className="review-stats">
        <div className="review-stat"><strong>0</strong><span>open</span></div>
        <div className="review-stat"><strong>0</strong><span>continuity</span></div>
        <div className="review-stat"><strong>0</strong><span>prose</span></div>
        <div className="review-stat"><strong>0</strong><span>fact updates</span></div>
        <div className="review-stat"><strong>0</strong><span>call retries</span></div>
      </div>
      <div className="review-grid">
        <aside className="panel no-shadow">
          <div className="panel-head">
            <div>
              <div className="panel-title">Queue</div>
              <div className="panel-kicker">Grouped decisions</div>
            </div>
            <span className="pill">0</span>
          </div>
          <div className="panel-body review-groups">
            <div className="large-note">
              <h2>Empty queue</h2>
              <p>Candidates, continuity issues, and fact updates will appear here.</p>
            </div>
          </div>
        </aside>
        <section className="panel decision-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">No item selected</div>
              <div className="panel-kicker">Choose from the queue</div>
            </div>
          </div>
          <div className="decision-body">
            <div className="large-note">
              <h2>Nothing to review</h2>
              <p>Select an item from the queue to see the comparison and evidence.</p>
            </div>
          </div>
        </section>
        <aside className="panel no-shadow">
          <div className="panel-head">
            <div>
              <div className="panel-title">Evidence</div>
              <div className="panel-kicker">Before accepting</div>
            </div>
          </div>
          <div className="panel-body evidence-stack">
            <div className="large-note">
              <h2>No evidence</h2>
              <p>Evidence will appear when a review item is selected.</p>
            </div>
          </div>
        </aside>
        <aside className="panel no-shadow">
          <div className="panel-head">
            <div>
              <div className="panel-title">Impact</div>
              <div className="panel-kicker">Decision scope</div>
            </div>
          </div>
          <div className="panel-body impact-stack">
            <div className="large-note">
              <h2>No impact</h2>
              <p>Impact details will appear when a review item is selected.</p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
