import { useMemo, useState } from "react";

import type { ProjectSessionState } from "../../app/useProjectSession";
import type { useWriteStoryChanges } from "./useWriteStoryChanges";

type InspectorPage = "scene" | "codex" | "ai" | "check";
type StoryChanges = ReturnType<typeof useWriteStoryChanges>;

const pages: Array<{ id: InspectorPage; label: string }> = [
  { id: "scene", label: "Scene" },
  { id: "codex", label: "Codex" },
  { id: "ai", label: "AI" },
  { id: "check", label: "Check" },
];

export function ReferenceWriteInspector({
  session,
  storyChanges,
}: {
  session: ProjectSessionState;
  storyChanges: StoryChanges;
}) {
  const [activePage, setActivePage] = useState<InspectorPage>("scene");
  const [codexSearch, setCodexSearch] = useState("");
  const scene = session.selectedScene;
  const normalizedSearch = codexSearch.trim().toLocaleLowerCase();
  const filteredEntries = useMemo(() => storyChanges.codexEntries.filter((entry) => (
    !entry.metadata.archivedAt && (
      !normalizedSearch ||
      entry.metadata.name.toLocaleLowerCase().includes(normalizedSearch) ||
      entry.metadata.aliases.some((alias) => alias.toLocaleLowerCase().includes(normalizedSearch))
    )
  )), [normalizedSearch, storyChanges.codexEntries]);
  const cast = scene
    ? scene.metadata.characterIds.map((id) => storyChanges.codexEntries.find((entry) => entry.metadata.id === id)).filter(Boolean)
    : [];
  const places = scene
    ? scene.metadata.locationIds.map((id) => storyChanges.codexEntries.find((entry) => entry.metadata.id === id)).filter(Boolean)
    : [];

  return (
    <aside className="wr6-inspector" id="wr6-inspector" aria-label="Writing sidebar">
      <nav className="wr6-inspector-tabs" role="tablist" aria-label="Writing resources">
        {pages.map((page) => (
          <button
            aria-controls={`wr6-pane-${page.id}`}
            aria-selected={activePage === page.id}
            className={`wr6-tab${activePage === page.id ? " is-active" : ""}`}
            data-wr6-tab={page.id}
            key={page.id}
            onClick={() => setActivePage(page.id)}
            role="tab"
            type="button"
          >
            {page.label}
          </button>
        ))}
      </nav>

      <div className="wr6-inspector-body">
        <section className="wr6-pane" data-wr6-pane="scene" hidden={activePage !== "scene"} id="wr6-pane-scene" role="tabpanel">
          <h2>Scene</h2>
          <p className="wr6-pane-intro">{scene?.metadata.title ?? "No Scene selected"}</p>
          <div className="wr6-field">
            <strong>Purpose</strong>
            <p>{scene?.metadata.goal || "No purpose has been set for this Scene."}</p>
          </div>
          <div className="wr6-field">
            <strong>Cast</strong>
            <div className="wr6-chip-line">
              {cast.length ? cast.map((entry) => entry ? (
                <button disabled key={entry.metadata.id} type="button">{entry.metadata.name}</button>
              ) : null) : <span>None linked</span>}
            </div>
          </div>
          <div className="wr6-field">
            <strong>Place</strong>
            <div className="wr6-chip-line">
              {places.length ? places.map((entry) => entry ? (
                <button disabled key={entry.metadata.id} type="button">{entry.metadata.name}</button>
              ) : null) : <span>None linked</span>}
            </div>
          </div>
          <div className="wr6-field wr6-story-field">
            <div className="wr6-field-heading">
              <span className="wr6-story-heading-copy">
                <strong>Story changes</strong>
                <small>{storyChanges.progressionBlocks.length}</small>
              </span>
              <button
                aria-label="Add Story Change"
                className="wr6-story-add"
                disabled={!scene || storyChanges.isBusy || storyChanges.isLoading || !storyChanges.codexEntries.length}
                onClick={() => void storyChanges.insertStoryChange()}
                title="Add Story Change"
                type="button"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12" /></svg>
              </button>
            </div>
            <p className="wr6-story-caption">Changes that become true from this point in the manuscript.</p>
            {storyChanges.error ? <p className="wr6-story-error" role="alert">{storyChanges.error}</p> : null}
            {storyChanges.isLoading ? <p className="wr6-story-empty">Loading Story Changes…</p> : null}
            {!storyChanges.isLoading && !storyChanges.progressionBlocks.length ? (
              <div className="wr6-story-empty">
                <strong>No Story Changes yet</strong>
                <span>Add one when a fact, relationship, or condition changes in this Scene.</span>
              </div>
            ) : null}
            {storyChanges.progressionBlocks.map((block) => {
              const view = storyChanges.progressionNodeViews[block.id];
              if (!view) return null;
              const summary = view.draft.summary.trim() || view.draft.body.trim() || "Empty Story Change";
              const operation = view.operationOptions.find((option) => option.value === view.draft.operation)?.label ?? view.draft.operation;
              return (
                <button
                  aria-label={`Open Story Change for ${view.entryLabel}`}
                  aria-current={storyChanges.selectedBlockId === block.id ? "true" : undefined}
                  className={`wr6-story-reference${storyChanges.selectedBlockId === block.id ? " is-current" : ""}`}
                  key={block.id}
                  onClick={() => storyChanges.focusStoryChange(block.id)}
                  type="button"
                >
                  <span aria-hidden="true" className="wr6-story-rail" />
                  <span className="wr6-story-reference-copy">
                    <span className="wr6-story-reference-meta">
                      <strong>{view.entryLabel}</strong>
                      <small>{view.fieldLabel} · {operation}</small>
                    </span>
                    <span className="wr6-story-reference-summary">{summary}</span>
                  </span>
                  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4l6 6-6 6" /></svg>
                </button>
              );
            })}
          </div>
        </section>

        <section className="wr6-pane" data-wr6-pane="codex" hidden={activePage !== "codex"} id="wr6-pane-codex" role="tabpanel">
          <h2>Codex</h2><p className="wr6-pane-intro">References for this Scene</p>
          <input aria-label="Search Codex entries" onChange={(event) => setCodexSearch(event.target.value)} placeholder="Search entries" type="search" value={codexSearch} />
          <div>
            {filteredEntries.map((entry) => (
              <button className="wr6-reference" disabled key={entry.metadata.id} type="button">
                <span><strong>{entry.metadata.name}</strong><span>Codex entry</span></span><em>Open</em>
              </button>
            ))}
            {!storyChanges.isLoading && !filteredEntries.length ? <p className="wr6-story-empty">No matching entries.</p> : null}
          </div>
        </section>

        <section className="wr6-pane" data-wr6-pane="ai" hidden={activePage !== "ai"} id="wr6-pane-ai" role="tabpanel">
          <h2>AI</h2><p className="wr6-pane-intro">Works on the paragraph you select</p>
          <div className="wr6-ai-empty">Select text in the manuscript.</div>
          <div className="wr6-ai-actions" style={{ marginTop: 12 }}>
            <button className="wr6-button" disabled type="button">Expand selection</button>
            <button className="wr6-button" disabled type="button">Compress selection</button>
            <button className="wr6-button" disabled type="button">Rephrase selection</button>
          </div>
          <textarea aria-label="Custom prompt" className="wr6-custom-prompt" disabled placeholder="Describe the change" />
          <button className="wr6-button primary" disabled style={{ marginTop: 8, width: "100%" }} type="button">Prepare candidate</button>
        </section>

        <section className="wr6-pane" data-wr6-pane="check" hidden={activePage !== "check"} id="wr6-pane-check" role="tabpanel">
          <h2>Check</h2><p className="wr6-pane-intro">Continuity for this Scene</p>
          <button className="wr6-check-row" disabled type="button"><span><strong>Continuity</strong><span>Not connected yet.</span></span><em>Review</em></button>
          <div className="wr6-check-row"><span><strong>POV</strong><span>{scene?.metadata.pov || "Not set"}</span></span><em>Current</em></div>
          <div className="wr6-check-row"><span><strong>Story time</strong><span>Use Plan to manage story time.</span></span><em>Open</em></div>
        </section>
      </div>
    </aside>
  );
}
