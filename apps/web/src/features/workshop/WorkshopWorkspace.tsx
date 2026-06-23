export function WorkshopWorkspace() {
  return (
    <>
      <div className="page-head">
        <div>
          <h2 className="page-title">Workshop</h2>
          <p className="page-subtitle">Talk with assistant roles around explicit scene context.</p>
        </div>
        <button className="btn primary" type="button">New Session</button>
      </div>
      <div className="workshop-grid">
        <aside className="panel no-shadow">
          <div className="panel-head">
            <div>
              <div className="panel-title">Sessions</div>
              <div className="panel-kicker">Branches</div>
            </div>
          </div>
          <div className="panel-body row-list">
            <div className="large-note">
              <h2>No sessions</h2>
              <p>Start a new session to work with an assistant role.</p>
            </div>
          </div>
        </aside>
        <section className="panel chat">
          <div className="message-stack">
            <div className="large-note">
              <h2>No conversation</h2>
              <p>Select or create a session to begin.</p>
            </div>
          </div>
          <div className="composer">
            <input className="input" placeholder="Ask about this scene" />
            <button className="btn primary" type="button">Send</button>
          </div>
        </section>
        <aside className="panel no-shadow">
          <div className="panel-head">
            <div>
              <div className="panel-title">Context Basket</div>
              <div className="panel-kicker">0 selected</div>
            </div>
            <button className="btn" type="button">Insert</button>
          </div>
          <div className="panel-body stack">
            <div className="large-note">
              <h2>Empty basket</h2>
              <p>Add scenes, codex entries, or plan items to provide context.</p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
