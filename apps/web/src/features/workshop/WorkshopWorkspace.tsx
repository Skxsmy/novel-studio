import { uiText } from "../../app/uiText";

export function WorkshopWorkspace() {
  const text = uiText.workshop;

  return (
    <>
      <div className="page-head">
        <div>
          <h2 className="page-title">{text.title}</h2>
          <p className="page-subtitle">{text.subtitle}</p>
        </div>
        <span className="pill muted">{text.status}</span>
        <button className="btn primary" disabled type="button">{text.newSession}</button>
      </div>
      <div className="workshop-grid is-unavailable">
        <aside className="panel no-shadow">
          <div className="panel-head">
            <div>
              <div className="panel-title">{text.sessionsTitle}</div>
              <div className="panel-kicker">{text.sessionsKicker}</div>
            </div>
          </div>
          <div className="panel-body row-list">
            <div className="unavailable-note">
              <h2>{text.sessionsEmptyTitle}</h2>
              <p>{text.sessionsEmptyBody}</p>
            </div>
          </div>
        </aside>
        <section className="panel chat">
          <div className="message-stack">
            <div className="unavailable-note">
              <h2>{text.conversationEmptyTitle}</h2>
              <p>{text.conversationEmptyBody}</p>
            </div>
          </div>
          <div className="composer">
            <input className="input" disabled placeholder={text.inputPlaceholder} />
            <button className="btn primary" disabled type="button">{text.send}</button>
          </div>
        </section>
        <aside className="panel no-shadow">
          <div className="panel-head">
            <div>
              <div className="panel-title">{text.basketTitle}</div>
              <div className="panel-kicker">{text.basketKicker}</div>
            </div>
            <button className="btn" disabled type="button">{text.insert}</button>
          </div>
          <div className="panel-body stack">
            <div className="unavailable-note">
              <h2>{text.basketEmptyTitle}</h2>
              <p>{text.basketEmptyBody}</p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
