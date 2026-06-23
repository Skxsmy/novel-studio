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
  onOpenSeries: (seriesId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  seriesList: SeriesSummary[];
}

export function LibraryWorkspace({
  errorMessage,
  isCreatingSeries,
  isLibraryLoading,
  isOpeningSeries,
  onCreateSeries,
  onOpenSeries,
  onRefresh,
  seriesList,
}: LibraryWorkspaceProps) {
  const [description, setDescription] = useState("");
  const [firstBookTitle, setFirstBookTitle] = useState<string>(DefaultStructureTitles.volume);
  const [title, setTitle] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim() || DefaultProjectTitles.series;

    await onCreateSeries({
      description: description.trim(),
      firstBookTitle: firstBookTitle.trim() || DefaultStructureTitles.volume,
      title: trimmedTitle,
    });
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
            ) : seriesList.length > 0 ? (
              seriesList.map((series) => (
                <button
                  className="large-note large-note-button"
                  key={series.id}
                  onClick={() => void onOpenSeries(series.id)}
                  type="button"
                >
                  <h2>{series.title}</h2>
                  <p>
                    {series.bookCount} {uiText.library.volumes} / {series.sceneCount} scenes
                    <span className="pill blue">{isOpeningSeries ? "Opening" : "Open"}</span>
                  </p>
                </button>
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
    </>
  );
}
