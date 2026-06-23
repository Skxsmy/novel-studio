import { useEffect, useMemo, useState } from "react";
import {
  type CodexCategoryDocument,
  type CodexEntryDocument,
  type SeriesDetail,
} from "@novel-studio/contracts";
import { api } from "../../api";
import {
  categoryLabel,
  codexTabs,
  defaultEntryCategory,
  nextEntryName,
  statusLabel,
  type CategoryFilter,
  type CodexTab,
} from "./codexViewModel";

interface CodexWorkspaceProps {
  series: SeriesDetail;
}

export function CodexWorkspace({ series }: CodexWorkspaceProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [activeTab, setActiveTab] = useState<CodexTab>("details");
  const [entries, setEntries] = useState<CodexEntryDocument[]>([]);
  const [categories, setCategories] = useState<CodexCategoryDocument[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);
    setErrorMessage(null);
    setSelectedEntryId(null);
    setActiveTab("details");

    Promise.all([
      api.codex.listCategories(series.manifest.id),
      api.codex.listEntries(series.manifest.id),
    ])
      .then(([nextCategories, nextEntries]) => {
        if (!isActive) return;
        setCategories(nextCategories);
        setEntries(nextEntries);
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        setErrorMessage(error instanceof Error ? error.message : "Failed to load codex entries");
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [series.manifest.id]);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (activeCategory !== "all" && entry.metadata.categoryId !== activeCategory) return false;
      if (!normalizedQuery) return true;
      const haystack = [
        entry.metadata.name,
        entry.description,
        entry.research.content,
        ...entry.metadata.aliases,
        ...entry.metadata.tags,
        ...Object.values(entry.metadata.details),
      ].join("\n").toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [activeCategory, entries, query]);

  const selectedEntry = selectedEntryId
    ? entries.find((entry) => entry.metadata.id === selectedEntryId) ?? null
    : null;

  const countsByCategory = new Map<string, number>();
  for (const entry of entries) {
    countsByCategory.set(entry.metadata.categoryId, (countsByCategory.get(entry.metadata.categoryId) ?? 0) + 1);
  }

  async function createEntry() {
    if (isCreating) return;
    setIsCreating(true);
    setErrorMessage(null);
    try {
      const entry = await api.codex.createEntry(series.manifest.id, {
        categoryId: defaultEntryCategory(activeCategory),
        name: nextEntryName(entries),
      });
      setEntries((current) => [...current, entry].sort((left, right) => left.metadata.name.localeCompare(right.metadata.name)));
      setSelectedEntryId(entry.metadata.id);
      setActiveTab("details");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create codex entry");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2 className="page-title">Codex</h2>
          <p className="page-subtitle">Browse story memory densely; open an entry only when details are needed.</p>
        </div>
        <div className="top-actions">
          <button className="btn" type="button">Import</button>
          <button className="btn primary" disabled={isCreating} onClick={() => void createEntry()} type="button">
            {isCreating ? "Creating" : "New Entry"}
          </button>
        </div>
      </div>
      <div className={`codex-grid${selectedEntry ? " detail-open" : ""}`}>
        <aside className="panel no-shadow">
          <div className="panel-head">
            <div>
              <div className="panel-title">Categories</div>
              <div className="panel-kicker">{entries.length} entries</div>
            </div>
          </div>
          <div className="panel-body taxonomy-list">
            <button
              className={`taxonomy-item${activeCategory === "all" ? " is-active" : ""}`}
              onClick={() => setActiveCategory("all")}
              type="button"
            >
              <div>
                <div className="row-title">All entries</div>
                <div className="row-meta">Characters, places, facts</div>
              </div>
              <span className="pill">{entries.length}</span>
            </button>
            {categories.map(({ category }) => (
              <button
                className={`taxonomy-item${activeCategory === category.id ? " is-active" : ""}`}
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                type="button"
              >
                <div>
                  <div className="row-title">{categoryLabel(category.id, categories)}</div>
                  <div className="row-meta">{category.builtIn ? "Built-in" : "Custom"}</div>
                </div>
                <span className="pill">{countsByCategory.get(category.id) ?? 0}</span>
              </button>
            ))}
          </div>
        </aside>
        <section className="panel no-shadow codex-index">
          <div className="panel-head">
            <div>
              <div className="panel-title">Entry Index</div>
              <div className="panel-kicker">Click an entry to open details; click again to close.</div>
            </div>
            <span className="pill green">Scene-aware</span>
          </div>
          <div className="panel-body">
            {errorMessage ? <p className="alert">{errorMessage}</p> : null}
            <div className="codex-toolbar">
              <input
                className="input"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, alias, tag, or detail"
                value={query}
              />
            </div>
            {isLoading ? (
              <div className="detail-empty">Loading codex entries.</div>
            ) : filteredEntries.length > 0 ? (
              <div className="codex-table" role="table" aria-label="Codex entries">
                <div className="codex-table-head" role="row">
                  <span>Entry</span>
                  <span>Type</span>
                  <span>Aliases</span>
                  <span>Tags</span>
                  <span>Status</span>
                </div>
                {filteredEntries.map((entry) => (
                  <button
                    className={`codex-row${selectedEntryId === entry.metadata.id ? " is-active" : ""}`}
                    key={entry.metadata.id}
                    onClick={() => {
                      setSelectedEntryId((current) => (current === entry.metadata.id ? null : entry.metadata.id));
                      setActiveTab("details");
                    }}
                    role="row"
                    type="button"
                  >
                    <span>
                      <strong>{entry.metadata.name}</strong>
                      <small>{entry.description || "No description"}</small>
                    </span>
                    <span>{categoryLabel(entry.metadata.categoryId, categories)}</span>
                    <span>{entry.metadata.aliases.length}</span>
                    <span>{entry.metadata.tags.length}</span>
                    <span className="pill">{statusLabel(entry)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="detail-empty">No codex entries yet.</div>
            )}
          </div>
        </section>
        {selectedEntry ? (
          <section className="panel no-shadow codex-detail" aria-label="Codex entry details">
            <div>
              <div className="entry-hero">
                <div>
                  <div className="entry-type">{categoryLabel(selectedEntry.metadata.categoryId, categories)}</div>
                  <h3 className="entry-title">{selectedEntry.metadata.name}</h3>
                </div>
                <div className="entry-avatar">{selectedEntry.metadata.name.slice(0, 2).toUpperCase()}</div>
              </div>
              <div className="entry-meta-line">
                <span>Context policy: {selectedEntry.metadata.aiContextPolicy}</span>
                <strong>{selectedEntry.metadata.aliases.length} aliases</strong>
              </div>
              <div className="codex-tabs" role="tablist" aria-label="Codex detail sections">
                {codexTabs.map((tab) => (
                  <button
                    aria-selected={activeTab === tab.id}
                    className={`codex-tab${activeTab === tab.id ? " is-active" : ""}`}
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    role="tab"
                    type="button"
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className={`codex-tab-panel${activeTab === "details" ? " is-active" : ""}`} role="tabpanel">
              <div className="detail-form-grid">
                <label className="field">
                  <span>Name</span>
                  <input className="input" readOnly value={selectedEntry.metadata.name} />
                </label>
                <label className="field">
                  <span>Category</span>
                  <input className="input" readOnly value={categoryLabel(selectedEntry.metadata.categoryId, categories)} />
                </label>
                <label className="field wide">
                  <span>Aliases</span>
                  <input className="input" readOnly value={selectedEntry.metadata.aliases.join(", ")} />
                </label>
                <label className="field wide">
                  <span>Canon description</span>
                  <textarea className="textarea" readOnly rows={6} value={selectedEntry.description} />
                </label>
              </div>
              {Object.entries(selectedEntry.metadata.details).length > 0 ? (
                <div className="detail-form-grid">
                  {Object.entries(selectedEntry.metadata.details).map(([key, value]) => (
                    <label className="field wide" key={key}>
                      <span>{key}</span>
                      <textarea className="textarea" readOnly rows={4} value={value} />
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
            <div className={`codex-tab-panel${activeTab === "research" ? " is-active" : ""}`} role="tabpanel">
              <label className="field">
                <span>Research notes</span>
                <textarea className="textarea" readOnly rows={10} value={selectedEntry.research.content} />
              </label>
            </div>
            <div className={`codex-tab-panel${activeTab === "relations" ? " is-active" : ""}`} role="tabpanel">
              <div className="detail-empty">No relations loaded for this entry.</div>
            </div>
            <div className={`codex-tab-panel${activeTab === "mentions" ? " is-active" : ""}`} role="tabpanel">
              <div className="detail-form-grid">
                <label className="field">
                  <span>Match aliases</span>
                  <input className="input" readOnly value={selectedEntry.metadata.mention.matchAliases ? "On" : "Off"} />
                </label>
                <label className="field">
                  <span>Case sensitive</span>
                  <input className="input" readOnly value={selectedEntry.metadata.mention.caseSensitive ? "On" : "Off"} />
                </label>
                <label className="field wide">
                  <span>Excluded terms</span>
                  <input className="input" readOnly value={selectedEntry.metadata.mention.excludedTerms.join(", ")} />
                </label>
              </div>
            </div>
            <div className={`codex-tab-panel${activeTab === "tracking" ? " is-active" : ""}`} role="tabpanel">
              <div className="detail-form-grid">
                <label className="field">
                  <span>Status</span>
                  <input className="input" readOnly value={statusLabel(selectedEntry)} />
                </label>
                <label className="field">
                  <span>Tags</span>
                  <input className="input" readOnly value={selectedEntry.metadata.tags.join(", ")} />
                </label>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
