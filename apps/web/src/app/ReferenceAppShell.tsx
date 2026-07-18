import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";

import "../ui/reference-tokens.css";
import "./reference-shell.css";

export type ReferenceWorkspace = "Overview" | "Plan" | "Write" | "Codex" | "Workshop" | "Settings";

interface WorkspaceDefinition {
  name: ReferenceWorkspace | "Review" | "Research";
  path: string;
  disabled?: boolean;
}

interface CreatedSeries {
  id: number;
  title: string;
  volume: string;
}

const workspaces: WorkspaceDefinition[] = [
  { name: "Overview", path: "M4 5h16M4 12h10M4 19h16" },
  { name: "Plan", path: "M4 6h7v12H4zM13 6h7v5h-7zM13 13h7v5h-7z" },
  { name: "Write", path: "M5 19l4-1 10-10-3-3L6 15zM14 5l3 3" },
  { name: "Codex", path: "M6 4h12v16H6zM9 8h6M9 12h6M9 16h4" },
  { name: "Workshop", path: "M4 7h16M7 7v12M17 7v12M4 19h16M8 11h8" },
  { name: "Review", path: "M5 5h14v14H5zM8 12l3 3 5-6", disabled: true },
  { name: "Research", path: "M6 4h12v16H6zM9 8h6M9 12h4M15 16l4 4", disabled: true },
];

const workspaceContext: Record<ReferenceWorkspace, string> = {
  Overview: "Project overview",
  Plan: "Story planning",
  Write: "Manuscript",
  Codex: "Story memory",
  Workshop: "AI studio",
  Settings: "Library settings",
};

export interface ReferenceAppShellProps {
  renderWorkspace?: (state: {
    activeWorkspace: ReferenceWorkspace;
    activateWorkspace: (name: ReferenceWorkspace) => void;
  }) => ReactNode;
}

function WorkspaceIcon({ path }: { path: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d={path} />
    </svg>
  );
}

export function ReferenceAppShell({ renderWorkspace }: ReferenceAppShellProps = {}) {
  const [activeWorkspace, setActiveWorkspace] = useState<ReferenceWorkspace>("Overview");
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [seriesTitle, setSeriesTitle] = useState("");
  const [volumeTitle, setVolumeTitle] = useState("Volume 1");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [createdSeries, setCreatedSeries] = useState<CreatedSeries[]>([]);
  const nextSeriesId = useRef(1);
  const projectSwitchRef = useRef<HTMLButtonElement>(null);
  const newSeriesButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLibraryOpen || isDialogOpen) return;
    const timeout = globalThis.setTimeout(() => newSeriesButtonRef.current?.focus(), 0);
    return () => globalThis.clearTimeout(timeout);
  }, [isDialogOpen, isLibraryOpen]);

  useEffect(() => {
    if (!isDialogOpen) return;
    const timeout = globalThis.setTimeout(() => titleInputRef.current?.focus(), 0);
    return () => globalThis.clearTimeout(timeout);
  }, [isDialogOpen]);

  useEffect(() => {
    function handleDocumentClick() {
      setIsLibraryOpen(false);
    }

    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (isDialogOpen) {
          event.preventDefault();
          closeDialog();
        } else if (isLibraryOpen) {
          event.preventDefault();
          setIsLibraryOpen(false);
          projectSwitchRef.current?.focus();
        }
        return;
      }
      if (event.key !== "Tab" || !isDialogOpen || !dialogRef.current) return;
      const focusable = [
        ...dialogRef.current.querySelectorAll<HTMLElement>("button, input, textarea"),
      ].filter((element) => !element.matches(":disabled"));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first && last) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last && first) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [isDialogOpen, isLibraryOpen]);

  function activateWorkspace(name: ReferenceWorkspace) {
    setActiveWorkspace(name);
    setIsLibraryOpen(false);
  }

  function openDialog() {
    setIsLibraryOpen(false);
    setError("");
    setIsDialogOpen(true);
  }

  function closeDialog(returnFocus = true) {
    setIsDialogOpen(false);
    setError("");
    if (returnFocus) projectSwitchRef.current?.focus();
  }

  function submitNewSeries(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = seriesTitle.trim();
    const volume = volumeTitle.trim();
    if (!title) {
      setError("Enter a Series title.");
      titleInputRef.current?.focus();
      return;
    }
    if (!volume) {
      setError("Enter the first Volume title.");
      document.getElementById("new-series-volume")?.focus();
      return;
    }
    setError("");
    setIsCreating(true);
    globalThis.setTimeout(() => {
      setCreatedSeries((current) => [
        { id: nextSeriesId.current++, title, volume },
        ...current,
      ]);
      setIsCreating(false);
      setSeriesTitle("");
      setVolumeTitle("Volume 1");
      setDescription("");
      closeDialog(false);
      setIsLibraryOpen(true);
    }, 420);
  }

  return (
    <main className="prototype">
      <header className="appbar">
        <div className="brand">
          <div className="brand-mark">NS</div>
          <div>
            <strong>Novel Studio</strong>
            <span id="brand-context">{workspaceContext[activeWorkspace]}</span>
          </div>
        </div>

        <nav aria-label="Workspaces" className="workspace-switcher">
          {workspaces.map((workspace) => {
            const active = workspace.name === activeWorkspace;
            return (
              <button
                aria-current={active ? "page" : undefined}
                className={`workspace-button${active ? " is-active" : ""}`}
                data-workspace={workspace.name}
                disabled={workspace.disabled}
                key={workspace.name}
                onClick={() => {
                  if (!workspace.disabled) activateWorkspace(workspace.name as ReferenceWorkspace);
                }}
                title={workspace.name}
                type="button"
              >
                <WorkspaceIcon path={workspace.path} />
                <span>{workspace.name}</span>
              </button>
            );
          })}
        </nav>

        <div className="appbar-right">
          <button
            aria-controls="project-library-menu"
            aria-expanded={isLibraryOpen}
            className="project-switch"
            id="project-library-button"
            onClick={(event) => {
              event.stopPropagation();
              setIsLibraryOpen((open) => !open);
            }}
            ref={projectSwitchRef}
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M4 7h16v12H4zM4 7l2-3h12l2 3" />
            </svg>
            <span>
              <strong id="current-series-name">The Glass Harbor</strong>
              <span id="current-volume-name">Volume · Saltwake</span>
            </span>
            <svg aria-hidden="true" className="project-chevron" viewBox="0 0 24 24">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          <div
            aria-label="Project Library"
            className="library-menu"
            hidden={!isLibraryOpen}
            id="project-library-menu"
            onClick={(event) => event.stopPropagation()}
            role="menu"
          >
            <header className="library-menu-head">
              <strong>Project Library</strong>
              <span>Local</span>
            </header>
            <div className="library-current">
              <span className="library-current-mark">NS</span>
              <span>
                <strong id="library-current-series">The Glass Harbor</strong>
                <span id="library-current-volume">Volume · Saltwake</span>
              </span>
              <em className="library-current-status">Current</em>
            </div>
            <div className="library-created-list" id="library-created-list">
              {createdSeries.map((series) => (
                <div className="library-created-row" key={series.id}>
                  <span>
                    <strong>{series.title}</strong>
                    <span>Volume · {series.volume}</span>
                  </span>
                  <em>Created</em>
                </div>
              ))}
            </div>
            <button
              className="library-new-series"
              id="new-series-button"
              onClick={openDialog}
              ref={newSeriesButtonRef}
              role="menuitem"
              type="button"
            >
              <i>+</i>
              <span>
                <strong>New Series</strong>
                <span>Create a Series and its first Volume</span>
              </span>
            </button>
          </div>

          <button
            aria-current={activeWorkspace === "Settings" ? "page" : undefined}
            aria-label="Settings"
            className={`workspace-button settings-switch${activeWorkspace === "Settings" ? " is-active" : ""}`}
            data-workspace="Settings"
            onClick={() => activateWorkspace("Settings")}
            title="Settings"
            type="button"
          >
            <WorkspaceIcon path="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM19 12h2M3 12h2M12 3v2M12 19v2M17.66 6.34l1.41-1.41M4.93 19.07l1.41-1.41M17.66 17.66l1.41 1.41M4.93 4.93l1.41 1.41" />
          </button>
        </div>
      </header>

      <div
        className="series-dialog-backdrop"
        hidden={!isDialogOpen}
        id="new-series-dialog"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}
        ref={dialogRef}
      >
        <section aria-labelledby="new-series-title" aria-modal="true" className="series-dialog" role="dialog">
          <header className="series-dialog-head">
            <div>
              <h2 id="new-series-title">New Series</h2>
              <p>Create the project structure you will start writing in.</p>
            </div>
            <button
              aria-label="Close"
              className="series-dialog-close"
              id="close-series-dialog"
              onClick={() => closeDialog()}
              type="button"
            >
              ×
            </button>
          </header>
          <form className="series-dialog-form" id="new-series-form" onSubmit={submitNewSeries}>
            <label className="series-dialog-field">
              <span>Series title</span>
              <input
                autoComplete="off"
                id="new-series-name"
                maxLength={160}
                onChange={(event) => setSeriesTitle(event.target.value)}
                ref={titleInputRef}
                required
                type="text"
                value={seriesTitle}
              />
            </label>
            <label className="series-dialog-field">
              <span>First Volume</span>
              <input
                id="new-series-volume"
                maxLength={160}
                onChange={(event) => setVolumeTitle(event.target.value)}
                required
                type="text"
                value={volumeTitle}
              />
            </label>
            <label className="series-dialog-field">
              <span>
                Description <small>Optional</small>
              </span>
              <textarea
                id="new-series-description"
                maxLength={1000}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="A short note for the Project Library"
                value={description}
              />
            </label>
            <p className="series-dialog-error" id="new-series-error" role="alert">
              {error}
            </p>
            <div className="series-dialog-actions">
              <button
                className="series-dialog-button"
                id="cancel-series-dialog"
                onClick={() => closeDialog()}
                type="button"
              >
                Cancel
              </button>
              <button
                className="series-dialog-button primary"
                disabled={isCreating}
                id="create-series-button"
                type="submit"
              >
                {isCreating ? "Creating…" : "Create Series"}
              </button>
            </div>
          </form>
        </section>
      </div>

      {renderWorkspace ? (
        renderWorkspace({ activeWorkspace, activateWorkspace })
      ) : (
        <section
          aria-hidden="true"
          className="reference-shell-fixture"
          data-workspace-view={activeWorkspace}
        />
      )}
    </main>
  );
}
