import { AlertCircle, Check, Database, LoaderCircle } from "lucide-react";
import type { ResearchDatabaseSummary } from "@novel-studio/contracts";
import { uiText } from "../../app/uiText";

export type WorkshopResearchSupport = "loading" | "supported" | "unsupported" | "unknown";

export interface WorkshopResearchSourcesProps {
  activeDatabaseIds: string[];
  currentSeriesId: string;
  databases: ResearchDatabaseSummary[];
  disabled?: boolean;
  error?: string | null;
  loading?: boolean;
  onChange: (databaseIds: string[]) => void;
  saving?: boolean;
  support: WorkshopResearchSupport;
}

const text = uiText.workshop.research;

export function sortWorkshopResearchDatabases(
  databases: ResearchDatabaseSummary[],
  currentSeriesId: string,
): ResearchDatabaseSummary[] {
  return [...databases].sort((left, right) => {
    const leftLinked = left.database.linkedSeriesIds.includes(currentSeriesId);
    const rightLinked = right.database.linkedSeriesIds.includes(currentSeriesId);
    if (leftLinked !== rightLinked) return leftLinked ? -1 : 1;
    return left.database.name.localeCompare(right.database.name, "en")
      || left.database.id.localeCompare(right.database.id);
  });
}

export function WorkshopResearchSources({
  activeDatabaseIds,
  currentSeriesId,
  databases,
  disabled = false,
  error = null,
  loading = false,
  onChange,
  saving = false,
  support,
}: WorkshopResearchSourcesProps) {
  const activeIds = new Set(activeDatabaseIds);
  const sorted = sortWorkshopResearchDatabases(databases, currentSeriesId);
  const unavailableIds = activeDatabaseIds.filter((databaseId) =>
    !databases.some((database) => database.database.id === databaseId)
  );

  function toggle(databaseId: string) {
    if (disabled || saving) return;
    onChange(activeIds.has(databaseId)
      ? activeDatabaseIds.filter((id) => id !== databaseId)
      : [...activeDatabaseIds, databaseId]);
  }

  return (
    <section aria-label={text.panelLabel} className="wr7-research-sources">
      <header>
        <span className="wr7-research-mark"><Database aria-hidden="true" size={16} /></span>
        <span><strong>{text.title}</strong><small>{text.selectedCount(activeDatabaseIds.length)}</small></span>
        {saving ? <LoaderCircle aria-label={text.saving} className="wr7-spin" size={16} /> : null}
      </header>
      {support === "unsupported" ? <p className="wr7-research-notice is-warning"><AlertCircle aria-hidden="true" size={15} />{text.unsupported}</p> : null}
      {support === "unknown" ? <p className="wr7-research-notice">{text.capabilityUnknown}</p> : null}
      {support === "loading" ? <p aria-live="polite" className="wr7-research-notice">{text.checkingCapability}</p> : null}
      {error ? <p className="wr7-research-notice is-error" role="alert"><AlertCircle aria-hidden="true" size={15} />{error}</p> : null}
      {unavailableIds.length ? <p className="wr7-research-notice is-error" role="status">{text.unavailableSelection(unavailableIds.length)}</p> : null}
      <div className="wr7-research-list">
        {loading ? <p aria-live="polite" className="wr7-research-empty">{text.loading}</p> : null}
        {!loading && sorted.length === 0 ? <p className="wr7-research-empty">{text.empty}</p> : null}
        {!loading ? sorted.map((document) => {
          const database = document.database;
          const linked = database.linkedSeriesIds.includes(currentSeriesId);
          const selected = activeIds.has(database.id);
          return (
            <label className={`wr7-research-option${selected ? " is-selected" : ""}`} key={database.id}>
              <input
                checked={selected}
                disabled={disabled || saving}
                onChange={() => toggle(database.id)}
                type="checkbox"
              />
              <span className="wr7-research-check" aria-hidden="true">{selected ? <Check size={13} /> : null}</span>
              <span className="wr7-research-copy"><strong>{database.name}</strong><small>{text.sourceCount(document.sourceCount)}{linked ? ` · ${text.linked}` : ""}</small></span>
            </label>
          );
        }) : null}
      </div>
      <footer>{text.activationBoundary}</footer>
    </section>
  );
}
