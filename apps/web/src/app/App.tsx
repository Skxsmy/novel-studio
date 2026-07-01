import { useEffect, useMemo, useState } from "react";
import { CodexWorkspace } from "../features/codex";
import { LibraryWorkspace } from "../features/library";
import { OverviewWorkspace } from "../features/overview";
import { PlanWorkspace } from "../features/plan";
import { ReviewWorkspace } from "../features/review";
import { SettingsWorkspace } from "../features/settings";
import { WorkshopWorkspace } from "../features/workshop";
import { WriteWorkspace } from "../features/write";
import { ErrorBoundary } from "./ErrorBoundary";
import "./app-shell.css";
import { uiText } from "./uiText";
import type { WorkspaceId } from "./workspaces";
import { workspaces } from "./workspaces";
import { useProjectSession, type SaveStatus } from "./useProjectSession";

function projectInitials(title: string) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "NS";
}

function saveFailurePill(status: SaveStatus) {
  if (status === "failed") return { label: "Failed", className: "pill amber" };
  if (status === "conflict") return { label: "Conflict", className: "pill amber" };
  return null;
}

function formatCount(value: number) {
  if (value >= 1000) return `${Math.round(value / 100) / 10}k`;
  return `${value}`;
}

function proposalIdFromLocation(): string | null {
  const hashMatch = window.location.hash.match(/^#\/review\/proposals\/([^/]+)$/u);
  if (hashMatch?.[1]) return decodeURIComponent(hashMatch[1]);
  const pathMatch = window.location.pathname.match(/\/review\/proposals\/([^/]+)$/u);
  if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]);
  return null;
}

export function App() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>("write");
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeProposalId, setActiveProposalId] = useState<string | null>(null);
  const session = useProjectSession();

  useEffect(() => {
    function syncProposalRoute() {
      const proposalId = proposalIdFromLocation();
      if (!proposalId) return;
      setActiveProposalId(proposalId);
      setActiveWorkspace("review");
      setIsLibraryOpen(false);
      setIsFocusMode(false);
    }
    syncProposalRoute();
    window.addEventListener("hashchange", syncProposalRoute);
    return () => window.removeEventListener("hashchange", syncProposalRoute);
  }, []);

  const activeDefinition = workspaces.find((workspace) => workspace.id === activeWorkspace) ?? workspaces.find((w) => w.id === "write")!;
  const projectTitle = session.activeSeries?.manifest.title ?? "Novel Studio";
  const projectSubtitle = session.activeSeries?.books[0]?.title ?? uiText.library.projectLibrary;
  const currentSceneTitle = session.selectedScene?.metadata.title ?? "No scene";
  const sidebarStats = useMemo(() => {
    const sceneCount = session.activeSeries?.scenes.length ?? 0;
    const bookCount = session.activeSeries?.books.length ?? 0;
    const characters = session.activeSeries?.scenes.reduce((sum, scene) => sum + scene.characterCount, 0) ?? 0;
    return [
      { label: "words", value: formatCount(Math.round(characters / 5)) },
      { label: "scenes", value: `${sceneCount}` },
      { label: uiText.library.volumes, value: `${bookCount}` },
    ];
  }, [session.activeSeries]);

  const saveState = saveFailurePill(session.saveStatus);
  const barTitle = isLibraryOpen || (!session.activeSeries && activeWorkspace !== "settings")
    ? "Novel Studio"
    : projectTitle;
  const barSubtitle = isLibraryOpen || (!session.activeSeries && activeWorkspace !== "settings")
    ? "Open or create a project"
    : `${activeDefinition.label}${activeWorkspace === "write" ? ` / ${currentSceneTitle}` : ""}`;

  function showWorkspace(workspaceId: WorkspaceId) {
    setActiveWorkspace(workspaceId);
    setIsLibraryOpen(false);
    if (workspaceId !== "write") setIsFocusMode(false);
  }

  function openProposal(proposalId: string) {
    setActiveProposalId(proposalId);
    setActiveWorkspace("review");
    setIsLibraryOpen(false);
    setIsFocusMode(false);
    window.history.replaceState(null, "", `#/review/proposals/${encodeURIComponent(proposalId)}`);
  }

  function openLibrary() {
    setIsLibraryOpen(true);
    setIsFocusMode(false);
  }

  function renderPage() {
    if (isLibraryOpen || (!session.activeSeries && activeWorkspace !== "settings")) {
      return (
        <LibraryWorkspace
          errorMessage={session.errorMessage}
          isCreatingSeries={session.isCreatingSeries}
          isLibraryLoading={session.isLibraryLoading}
          isOpeningSeries={session.isOpeningSeries}
          onCreateSeries={async (input) => {
            const created = await session.createSeries(input);
            if (created) {
              setActiveWorkspace("write");
              setIsLibraryOpen(false);
              setIsFocusMode(false);
            }
          }}
          onDeleteSeries={session.deleteSeries}
          onOpenSeries={async (seriesId) => {
            const opened = await session.openSeries(seriesId);
            if (opened) {
              setActiveWorkspace("write");
              setIsLibraryOpen(false);
              setIsFocusMode(false);
            }
          }}
          onRefresh={session.refreshSeriesList}
          onRestoreSeries={session.restoreSeries}
          onTrashSeries={session.trashSeries}
          seriesList={session.seriesList}
        />
      );
    }

    if (activeWorkspace === "settings") {
      return <SettingsWorkspace onUpdateCloudPolicy={session.updateCloudPolicy} series={session.activeSeries} />;
    }

    if (!session.activeSeries) return null;

    if (activeWorkspace === "write") {
      return (
        <WriteWorkspace
          draft={session.draft}
          errorMessage={session.errorMessage}
          isCreatingStructure={session.isCreatingStructure}
          isDirty={session.isDirty}
          isFocusMode={isFocusMode}
          onDeleteAct={session.deleteAct}
          onDeleteVolume={session.deleteVolume}
          onDeleteChapter={session.deleteChapter}
          onDeleteScene={session.deleteScene}
          onCreateAct={session.createAct}
          onCreateVolume={session.createVolume}
          onCreateChapter={session.createChapter}
          onCreateScene={session.createScene}
          onAcceptSavedSceneDocument={session.acceptSavedSceneDocument}
          onCommitDocument={session.commitDraftDocument}
          onSelectVolume={session.selectVolume}
          onSelectAct={session.selectAct}
          onSelectChapter={session.selectChapter}
          onSelectScene={session.selectScene}
          onClearStructureSelection={session.resetStructureSelection}
          onToggleFocus={() => setIsFocusMode((value) => !value)}
          onUpdateAct={session.updateAct}
          onUpdateVolume={session.updateVolume}
          onUpdateChapter={session.updateChapter}
          onUpdateDocument={session.updateDraftDocument}
          onUpdateTitle={session.updateDraftTitle}
          saveStatus={session.saveStatus}
          selectedVolumeId={session.selectedVolumeId}
          selectedActId={session.selectedActId}
          selectedChapterId={session.selectedChapterId}
          selectedScene={session.selectedScene}
          series={session.activeSeries}
        />
      );
    }

    if (activeWorkspace === "overview") return <OverviewWorkspace series={session.activeSeries} />;
    if (activeWorkspace === "plan") return <PlanWorkspace series={session.activeSeries} />;
    if (activeWorkspace === "codex") {
      return (
        <CodexWorkspace
          onOpenScene={(sceneId) => {
            session.selectScene(sceneId);
            setActiveWorkspace("write");
          }}
          series={session.activeSeries}
        />
      );
    }
    if (activeWorkspace === "workshop") {
      return <WorkshopWorkspace selectedScene={session.selectedScene} series={session.activeSeries} />;
    }
    return (
      <ReviewWorkspace
        onOpenProposal={openProposal}
        selectedProposalId={activeProposalId}
        series={session.activeSeries}
      />
    );
  }

  const pageId = isLibraryOpen ? "library-page" : `${activeWorkspace}-page`;

  return (
    <>
      <main className={`app${isSidebarCollapsed ? " is-sidebar-collapsed" : ""}${isFocusMode ? " is-focus-mode" : ""}`}>
        <aside aria-label="Project" className="project-panel">
          <header className="project-head">
            <button
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-pressed={isSidebarCollapsed}
              className="sidebar-toggle"
              onClick={() => setIsSidebarCollapsed((value) => !value)}
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              type="button"
            >
              {isSidebarCollapsed ? ">" : "<"}
            </button>
            <div className="cover-row">
              <div className="cover">{projectInitials(projectTitle)}</div>
              <div>
                <h1 className="project-name">{projectTitle}</h1>
                <p className="project-meta">{projectSubtitle}</p>
              </div>
            </div>
          </header>

          <div aria-label="Project statistics" className="quick-stats">
            {sidebarStats.map((stat) => (
              <div className="stat" key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>

          <div className="project-scroll">
            <section className="side-section">
              <div className="side-heading">
                <span>Workspaces</span>
              </div>
              <nav aria-label="Workspaces" className="row-list">
                {workspaces
                  .filter((workspace) => workspace.id !== "settings")
                  .map((workspace) => {
                    const isActive = workspace.id === activeWorkspace && !isLibraryOpen;
                    const isUnavailableShell = false;
                    const pillClass = workspace.id === "write" && saveState ? saveState.className : "pill muted";
                    const pillLabel = workspace.id === "write" ? saveState?.label ?? ""
                      : isUnavailableShell ? uiText.navigation.notConnected
                      : "";
                    return (
                      <button
                        aria-label={workspace.label}
                        className={`nav-row${isActive ? " is-active" : ""}${isUnavailableShell ? " is-unavailable" : ""}`}
                        disabled={!session.activeSeries}
                        key={workspace.id}
                        onClick={() => showWorkspace(workspace.id)}
                        title={workspace.label}
                        type="button"
                      >
                        <span>
                          <span className="row-title">{workspace.label}</span>
                          <span className="row-meta">
                            {isUnavailableShell ? uiText.navigation.notConnected : workspace.description}
                          </span>
                        </span>
                        {pillLabel ? <span className={pillClass}>{pillLabel}</span> : <span aria-hidden="true" />}
                      </button>
                    );
                  })}
              </nav>
            </section>
          </div>

          <footer className="project-foot">
            <button className={`btn${isLibraryOpen ? " primary" : ""}`} onClick={openLibrary} title="Switch Project" type="button">
              Switch Project
            </button>
            <button
              className={`btn${activeWorkspace === "settings" && !isLibraryOpen ? " primary" : ""}`}
              onClick={() => showWorkspace("settings")}
              title="Settings"
              type="button"
            >
              Settings
            </button>
          </footer>
        </aside>

        <section className="workspace">
          <header className="command-bar">
            <div className="crumb">
              <strong>{barTitle}</strong>
              <span>{barSubtitle}</span>
            </div>
            <label className="command-input is-disabled">
              <span>Q</span>
              <input
                aria-label={uiText.navigation.searchLabel}
                disabled
                placeholder={uiText.navigation.searchPlaceholder}
                readOnly
                value=""
              />
              <span className="key">Ctrl K</span>
            </label>
            <div className="top-actions">
              {!isLibraryOpen && saveState ? <span className={saveState.className}>{saveState.label}</span> : null}
            </div>
          </header>
          <ErrorBoundary>
            <div className={`page is-active`} id={pageId}>
              {renderPage()}
            </div>
          </ErrorBoundary>
        </section>
      </main>

      <section className="narrow-state">
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Desktop workspace required</div>
              <div className="panel-kicker">Window too narrow</div>
            </div>
          </div>
          <div className="panel-body">
            <p className="brief-text">Widen the window to continue reviewing this layout.</p>
          </div>
        </div>
      </section>
    </>
  );
}
