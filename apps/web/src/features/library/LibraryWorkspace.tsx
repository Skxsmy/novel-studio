import type { FormEvent } from "react";
import { useState } from "react";
import { DefaultProjectTitles, DefaultStructureTitles, type CreateSeriesInput, type SeriesSummary } from "@novel-studio/contracts";
import { uiText } from "../../app/uiText";

export interface LibraryWorkspaceProps {
  errorMessage: string | null;
  isCreatingSeries: boolean;
  isLibraryLoading: boolean;
  isOpeningSeries: boolean;
  onCreateSeries: (input: CreateSeriesInput) => Promise<void>;
  onDeleteSeries: (seriesId: string, confirmTitle: string) => Promise<boolean>;
  onOpenSeries: (seriesId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onRestoreSeries: (seriesId: string) => Promise<boolean>;
  onTrashSeries: (seriesId: string) => Promise<boolean>;
  seriesList: SeriesSummary[];
}

export function LibraryWorkspace({
  errorMessage,
  isCreatingSeries,
  isLibraryLoading,
  isOpeningSeries,
  onCreateSeries,
  onDeleteSeries,
  onOpenSeries,
  onRefresh,
  onRestoreSeries,
  onTrashSeries,
  seriesList,
}: LibraryWorkspaceProps) {
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SeriesSummary | null>(null);
  const [description, setDescription] = useState("");
  const [firstBookTitle, setFirstBookTitle] = useState<string>(DefaultStructureTitles.volume);
  const [title, setTitle] = useState("");
  const activeProjects = seriesList.filter((series) => !series.archived);
  const trashedProjects = seriesList.filter((series) => series.archived);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim() || DefaultProjectTitles.series;

    await onCreateSeries({
      description: description.trim(),
      firstBookTitle: firstBookTitle.trim() || DefaultStructureTitles.volume,
      title: trimmedTitle,
    });
  }

  async function permanentlyDeleteTarget() {
    if (!deleteTarget || deleteConfirmation !== deleteTarget.title) return;
    const deleted = await onDeleteSeries(deleteTarget.id, deleteConfirmation);
    if (deleted) {
      setDeleteTarget(null);
      setDeleteConfirmation("");
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2 className="page-title">Library</h2>
          <p className="page-subtitle">Open a project or start a new draft.</p>
        </div>
        <button className="btn primary" disabled={isCreatingSeries} form="create-project-form" type="submit">
          {isCreatingSeries ? "Creating" : "New Project"}
        </button>
      </div>

      <div className="library-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Projects</div>
              <div className="panel-kicker">Recent work</div>
            </div>
            <button className="btn" disabled={isLibraryLoading} onClick={() => void onRefresh()} type="button">
              Refresh
            </button>
          </div>
          <div className="panel-body stack">
            {errorMessage ? <p className="alert">{errorMessage}</p> : null}
            {isLibraryLoading ? (
              <div className="large-note">
                <h2>Loading library</h2>
                <p>Reading projects from the local workspace.</p>
              </div>
            ) : activeProjects.length > 0 ? (
              activeProjects.map((series) => (
                <article className="large-note project-card" key={series.id}>
                  <div>
                    <h2>{series.title}</h2>
                    <p>{series.bookCount} {uiText.library.volumes} / {series.sceneCount} scenes</p>
                  </div>
                  <div className="project-card-actions">
                    <button
                      aria-label={`${uiText.library.open} ${series.title}`}
                      className="btn compact primary"
                      disabled={isOpeningSeries}
                      onClick={() => void onOpenSeries(series.id)}
                      type="button"
                    >
                      {isOpeningSeries ? uiText.library.opening : uiText.library.open}
                    </button>
                    <button
                      className="btn compact"
                      disabled={isOpeningSeries}
                      onClick={() => void onTrashSeries(series.id)}
                      type="button"
                    >
                      {uiText.library.moveToTrash}
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="large-note">
                <h2>No projects yet</h2>
                <p>Create the first project in this library.</p>
              </div>
            )}
          </div>
        </section>

        <aside className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">New Project</div>
              <div className="panel-kicker">Local workspace</div>
            </div>
          </div>
          <form className="panel-body stack" id="create-project-form" onSubmit={(event) => void handleSubmit(event)}>
            <div className="field">
              <label htmlFor="series-title">Series title</label>
              <input
                className="input"
                id="series-title"
                onChange={(event) => setTitle(event.target.value)}
                placeholder={DefaultProjectTitles.series}
                value={title}
              />
            </div>
            <div className="field">
              <label htmlFor="first-book">{uiText.library.firstVolume}</label>
              <input
                className="input"
                id="first-book"
                onChange={(event) => setFirstBookTitle(event.target.value)}
                placeholder={DefaultStructureTitles.volume}
                value={firstBookTitle}
              />
            </div>
            <div className="field">
              <label htmlFor="series-description">Description</label>
              <textarea
                className="textarea"
                id="series-description"
                onChange={(event) => setDescription(event.target.value)}
                placeholder="A short note for the project library"
                rows={5}
                value={description}
              />
            </div>
          </form>
        </aside>
      </div>

      <section className="panel library-trash-panel">
        <div className="panel-head">
          <div>
            <div className="panel-title">{uiText.library.trash}</div>
            <div className="panel-kicker">{trashedProjects.length} project{trashedProjects.length === 1 ? "" : "s"}</div>
          </div>
        </div>
        <div className="panel-body stack">
          {trashedProjects.length ? trashedProjects.map((series) => (
            <article className="large-note project-card is-trashed" key={series.id}>
              <div>
                <h2>{series.title}</h2>
                <p>{series.bookCount} {uiText.library.volumes} / {series.sceneCount} scenes</p>
              </div>
              <div className="project-card-actions">
                <button
                  className="btn compact"
                  disabled={isOpeningSeries}
                  onClick={() => void onRestoreSeries(series.id)}
                  type="button"
                >
                  {uiText.library.restore}
                </button>
                <button
                  className="btn compact danger"
                  disabled={isOpeningSeries}
                  onClick={() => {
                    setDeleteTarget(series);
                    setDeleteConfirmation("");
                  }}
                  type="button"
                >
                  {uiText.library.deletePermanently}
                </button>
              </div>
            </article>
          )) : (
            <div className="large-note">
              <h2>{uiText.library.trash}</h2>
              <p>{uiText.library.trashEmpty}</p>
            </div>
          )}
        </div>
      </section>

      {deleteTarget ? (
        <div className="codex-modal-backdrop" role="presentation">
          <section
            aria-label={uiText.library.deleteProjectTitle}
            aria-modal="true"
            className="project-delete-dialog"
            role="dialog"
          >
            <header className="codex-modal-head">
              <h3>{uiText.library.deleteProjectTitle}</h3>
              <button className="btn compact" onClick={() => setDeleteTarget(null)} type="button">
                {uiText.actions.cancel}
              </button>
            </header>
            <div className="stack">
              <p className="confirm-copy">{uiText.library.deleteProjectCopy(deleteTarget.title)}</p>
              <label className="field">
                <span>{uiText.library.deleteNameLabel}</span>
                <input
                  autoFocus
                  className="input"
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                  value={deleteConfirmation}
                />
              </label>
              <div className="confirm-actions">
                <button className="btn compact" onClick={() => setDeleteTarget(null)} type="button">
                  {uiText.actions.cancel}
                </button>
                <button
                  className="btn compact danger"
                  disabled={deleteConfirmation !== deleteTarget.title || isOpeningSeries}
                  onClick={() => void permanentlyDeleteTarget()}
                  type="button"
                >
                  {uiText.library.deletePermanently}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
