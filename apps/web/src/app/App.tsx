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

interface WorkshopRoute {
  sessionId: string;
  messageId: string;
}

type RailIconId = WorkspaceId | "projects";

function railLabel(id: WorkspaceId) {
  if (id === "overview") return "Home";
  if (id === "workshop") return "Work";
  return workspaces.find((workspace) => workspace.id === id)?.label ?? id;
}

function RailIcon({ id }: { id: RailIconId }) {
  let path: string;
  if (id === "overview") path = "M4 5h16M4 12h10M4 19h16";
  else if (id === "plan") path = "M4 6h7v12H4zM13 6h7v5h-7zM13 13h7v5h-7z";
  else if (id === "write") path = "M5 19l4-1 10-10-3-3L6 15zM14 5l3 3";
  else if (id === "codex") path = "M6 4h12v16H6zM9 8h6M9 12h6M9 16h4";
  else if (id === "workshop") path = "M4 7h16M7 7v12M17 7v12M4 19h16M8 11h8";
  else if (id === "review") path = "M5 5h14v14H5zM8 12l3 3 5-6";
  else if (id === "settings") path = "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM19 12h2M3 12h2M12 3v2M12 19v2M17.66 6.34l1.41-1.41M4.93 19.07l1.41-1.41M17.66 17.66l1.41 1.41M4.93 4.93l1.41 1.41";
  else path = "M4 7h16v12H4zM4 7l2-3h12l2 3";

  return (
    <svg aria-hidden="true" className="rail-icon" viewBox="0 0 24 24">
      <path d={path} />
    </svg>
  );
}

function workshopRouteFromLocation(): WorkshopRoute | null {
  const hashMatch = window.location.hash.match(/^#\/workshop\/sessions\/([^/]+)\/messages\/([^/]+)$/u);
  if (hashMatch?.[1] && hashMatch[2]) {
    return {
      sessionId: decodeURIComponent(hashMatch[1]),
      messageId: decodeURIComponent(hashMatch[2]),
    };
  }
  const pathMatch = window.location.pathname.match(/\/workshop\/sessions\/([^/]+)\/messages\/([^/]+)$/u);
  if (pathMatch?.[1] && pathMatch[2]) {
    return {
      sessionId: decodeURIComponent(pathMatch[1]),
      messageId: decodeURIComponent(pathMatch[2]),
    };
  }
  return null;
}

export function App() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>("write");
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeProposalId, setActiveProposalId] = useState<string | null>(null);
  const [activeWorkshopRoute, setActiveWorkshopRoute] = useState<WorkshopRoute | null>(null);
  const session = useProjectSession();

  useEffect(() => {
    function syncWorkspaceRoute() {
      const proposalId = proposalIdFromLocation();
      if (proposalId) {
        setActiveProposalId(proposalId);
        setActiveWorkshopRoute(null);
        setActiveWorkspace("review");
        setIsLibraryOpen(false);
        setIsFocusMode(false);
        return;
      }
      const workshopRoute = workshopRouteFromLocation();
      if (workshopRoute) {
        setActiveWorkshopRoute(workshopRoute);
        setActiveWorkspace("workshop");
        setIsLibraryOpen(false);
        setIsFocusMode(false);
      }
    }
    syncWorkspaceRoute();
    window.addEventListener("hashchange", syncWorkspaceRoute);
    return () => window.removeEventListener("hashchange", syncWorkspaceRoute);
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
    setActiveWorkshopRoute(null);
  }

  function openProposal(proposalId: string) {
    setActiveProposalId(proposalId);
    setActiveWorkshopRoute(null);
    setActiveWorkspace("review");
    setIsLibraryOpen(false);
    setIsFocusMode(false);
    window.history.replaceState(null, "", `#/review/proposals/${encodeURIComponent(proposalId)}`);
  }

  function openWorkshopMessage(sessionId: string, messageId: string) {
    setActiveWorkshopRoute({ sessionId, messageId });
    setActiveWorkspace("workshop");
    setIsLibraryOpen(false);
    setIsFocusMode(false);
    window.history.replaceState(
      null,
      "",
      `#/workshop/sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(messageId)}`,
    );
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
      return <SettingsWorkspace />;
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
      return (
        <WorkshopWorkspace
          onOpenProposal={openProposal}
          selectedMessageId={activeWorkshopRoute?.messageId ?? null}
          selectedScene={session.selectedScene}
          selectedSessionId={activeWorkshopRoute?.sessionId ?? null}
          series={session.activeSeries}
        />
      );
    }
    return (
      <ReviewWorkspace
        onOpenWorkshopMessage={openWorkshopMessage}
        onOpenProposal={openProposal}
        selectedProposalId={activeProposalId}
        series={session.activeSeries}
      />
    );
  }

  const pageId = isLibraryOpen ? "library-page" : `${activeWorkspace}-page`;
  const isWorkshopSurface = !isLibraryOpen && activeWorkspace === "workshop";

  return (
    <>
      <main className={`app${isSidebarCollapsed ? " is-sidebar-collapsed" : ""}${isFocusMode ? " is-focus-mode" : ""}${isWorkshopSurface ? " is-workshop-surface" : ""}`}>
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
              <span className="sidebar-toggle-arrow">{isSidebarCollapsed ? ">" : "<"}</span>
              <span className="sidebar-toggle-brand">{projectInitials(projectTitle)}</span>
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
                        <span className="nav-copy">
                          <RailIcon id={workspace.id} />
                          <span className="row-title">{isSidebarCollapsed ? railLabel(workspace.id) : workspace.label}</span>
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
              <RailIcon id="projects" />
              <span className="footer-label">Switch Project</span>
            </button>
            <button
              className={`btn${activeWorkspace === "settings" && !isLibraryOpen ? " primary" : ""}`}
              onClick={() => showWorkspace("settings")}
              title="Settings"
              type="button"
            >
              <RailIcon id="settings" />
              <span className="footer-label">Settings</span>
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
