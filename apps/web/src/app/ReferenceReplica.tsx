import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ResearchToolAuditCitation } from "@novel-studio/contracts";

import { ReferenceCodexWorkspace } from "../features/codex/ReferenceCodexWorkspace";
import { ReferenceOverviewWorkspace } from "../features/overview/ReferenceOverviewWorkspace";
import { ReferencePlanWorkspace } from "../features/plan/ReferencePlanWorkspace";
import { ReferenceResearchWorkspace } from "../features/research/ResearchDatabaseWorkspace";
import { ReviewWorkspace } from "../features/review";
import { ReferenceSettingsWorkspace } from "../features/settings/ReferenceSettingsWorkspace";
import { ReferenceWorkshopWorkspace } from "../features/workshop/ReferenceWorkshopWorkspace";
import { ReferenceWriteWorkspace } from "../features/write/ReferenceWriteWorkspace";
import { ReferenceSurface } from "../ui/ReferenceSurface";
import { ConnectedProjectLibrary } from "./ConnectedProjectLibrary";
import { useProjectSession, type ProjectSessionState } from "./useProjectSession";
import { ReferenceGlobalOverlays, ReferenceInFrameOverlays } from "./ReferenceOverlays";
import { useReferenceRuntime } from "./useReferenceRuntime";
import { useReferenceStyleSheet } from "./useReferenceStyleSheet";

export interface ReferenceReplicaProps {
  connectCodex?: boolean;
  connectOverview?: boolean;
  connectResearch?: boolean;
  connectSettings?: boolean;
  connectWorkshop?: boolean;
  connectWrite?: boolean;
  enableRuntime?: boolean;
}

function ProjectIdentityBridge({ session }: { session: ProjectSessionState }) {
  const series = session.activeSeries;
  const volume = series?.books.find((book) => book.id === (session.selectedScene?.metadata.bookId ?? session.selectedVolumeId))
    ?? series?.books[0]
    ?? null;

  useLayoutEffect(() => {
    const seriesTitle = series?.manifest.title ?? "No Series open";
    const volumeTitle = volume ? `Volume · ${volume.title}` : "Open a Series from the Project Library";
    for (const id of ["current-series-name", "library-current-series"]) {
      const target = document.getElementById(id);
      if (target) target.textContent = seriesTitle;
    }
    for (const id of ["current-volume-name", "library-current-volume"]) {
      const target = document.getElementById(id);
      if (target) target.textContent = volumeTitle;
    }
    document.getElementById("project-library-button")?.setAttribute(
      "aria-label",
      `${seriesTitle}. ${volumeTitle}. Open Project Library`,
    );
  }, [series?.manifest.title, volume?.title]);

  return null;
}

function ConnectedProjectWorkspaces({
  connectCodex,
  connectOverview,
  connectResearch,
  connectSettings,
  connectWorkshop,
  connectWrite,
}: {
  connectCodex: boolean;
  connectOverview: boolean;
  connectResearch: boolean;
  connectSettings: boolean;
  connectWorkshop: boolean;
  connectWrite: boolean;
}) {
  const session = useProjectSession();
  const openingSeriesRef = useRef<string | null>(null);
  const [writeTarget, setWriteTarget] = useState<{ blockId: string | null; sceneId: string } | null>(null);
  const [providerReturnSessionId, setProviderReturnSessionId] = useState<string | null>(null);
  const [requestedWorkshopSessionId, setRequestedWorkshopSessionId] = useState<string | null>(null);
  const [reviewProposalId, setReviewProposalId] = useState<string | null>(null);
  const [modelProfilesRevision, setModelProfilesRevision] = useState(0);
  const [codexAuthorityRevision, setCodexAuthorityRevision] = useState(0);
  const [researchCitation, setResearchCitation] = useState<ResearchToolAuditCitation | null>(null);
  const [codexTarget, setCodexTarget] = useState<{
    entryId: string;
    requestId: number;
    tab: "canon" | "research";
  } | null>(null);
  const [researchNoteTarget, setResearchNoteTarget] = useState<{
    databaseId: string;
    noteId: string;
    requestId: number;
  } | null>(null);
  const navigationRequestRef = useRef(0);

  useEffect(() => {
    if (session.isLibraryLoading || session.isOpeningSeries || session.activeSeries) return;
    const firstSeries = session.seriesList[0];
    if (!firstSeries || openingSeriesRef.current === firstSeries.id) return;
    openingSeriesRef.current = firstSeries.id;
    void session.openSeries(firstSeries.id);
  }, [session.activeSeries, session.isLibraryLoading, session.isOpeningSeries, session.openSeries, session.seriesList]);

  function openWriteTarget(sceneId: string, blockId: string | null = null) {
    session.selectScene(sceneId);
    setWriteTarget({ blockId, sceneId });
    queueMicrotask(() => document.querySelector<HTMLButtonElement>(".workspace-button[data-workspace='Write']")?.click());
  }

  function openPlan() {
    document.querySelector<HTMLButtonElement>(".workspace-button[data-workspace='Plan']")?.click();
  }

  function openProviderSettings(sessionId: string | null) {
    setProviderReturnSessionId(sessionId);
    document.querySelector<HTMLButtonElement>(".workspace-button[data-workspace='Settings']")?.click();
    queueMicrotask(() => {
      document.querySelector<HTMLButtonElement>("[data-st7-section='connections']")?.click();
    });
  }

  function returnToWorkshop() {
    document.querySelector<HTMLButtonElement>(".workspace-button[data-workspace='Workshop']")?.click();
    setProviderReturnSessionId(null);
  }

  function openResearchCitation(citation: ResearchToolAuditCitation) {
    setResearchCitation(citation);
    document.querySelector<HTMLButtonElement>(".workspace-button[data-workspace='Research']")?.click();
  }

  function openReviewProposal(proposalId: string) {
    setReviewProposalId(proposalId);
    queueMicrotask(() => document.querySelector<HTMLButtonElement>(".workspace-button[data-workspace='Review']")?.click());
  }

  function openReviewCodexEntry(entryId: string, tab: "canon" | "research") {
    navigationRequestRef.current += 1;
    setCodexTarget({ entryId, requestId: navigationRequestRef.current, tab });
    setCodexAuthorityRevision((current) => current + 1);
    queueMicrotask(() => document.querySelector<HTMLButtonElement>(".workspace-button[data-workspace='Codex']")?.click());
  }

  function openReviewResearchNote(databaseId: string, noteId: string) {
    navigationRequestRef.current += 1;
    setResearchNoteTarget({ databaseId, noteId, requestId: navigationRequestRef.current });
    queueMicrotask(() => document.querySelector<HTMLButtonElement>(".workspace-button[data-workspace='Research']")?.click());
  }

  function openReviewWorkshopMessage(sessionId: string) {
    setRequestedWorkshopSessionId(sessionId);
    queueMicrotask(() => document.querySelector<HTMLButtonElement>(".workspace-button[data-workspace='Workshop']")?.click());
  }

  return (
    <>
      <ConnectedProjectLibrary session={session} />
      <ProjectIdentityBridge session={session} />
      {connectOverview ? (
        <ReferenceOverviewWorkspace onOpenPlan={openPlan} onOpenWrite={openWriteTarget} session={session} />
      ) : <ReferenceOverviewWorkspace />}
      <ReferenceSettingsWorkspace
        connected={connectSettings}
        onModelProfilesChanged={() => setModelProfilesRevision((current) => current + 1)}
      />
      <ReferencePlanWorkspace />
      {connectResearch ? <ReferenceResearchNavigationBridge enableReview={Boolean(session.activeSeries)} /> : null}
      {connectResearch ? <ReferenceResearchWorkspace
        onOpenProposal={openReviewProposal}
        requestedCitation={researchCitation}
        requestedNote={researchNoteTarget}
        seriesId={session.activeSeries?.manifest.id ?? null}
        seriesTitle={session.activeSeries?.manifest.title ?? null}
      /> : null}
      {connectResearch && session.activeSeries ? <section className="workspace-view rn1-review-view" data-workspace-view="Review" hidden>
        <ReviewWorkspace
          key={reviewProposalId ?? "proposal-inbox"}
          onCodexAuthorityChanged={() => setCodexAuthorityRevision((current) => current + 1)}
          onOpenCodexEntry={openReviewCodexEntry}
          onOpenProposal={setReviewProposalId}
          onOpenResearchNote={openReviewResearchNote}
          onOpenWorkshopMessage={(sessionId) => openReviewWorkshopMessage(sessionId)}
          selectedProposalId={reviewProposalId}
          series={session.activeSeries}
        />
      </section> : null}
      {connectWrite ? <ReferenceWriteWorkspace requestedBlockId={writeTarget?.blockId ?? null} session={session} /> : <ReferenceSurface selector="#write-workspace" />}
      {connectCodex ? (
        <ReferenceCodexWorkspace
          authorityRevision={codexAuthorityRevision}
          onOpenWrite={openWriteTarget}
          requestedEntryId={codexTarget?.entryId ?? null}
          requestedEntryRequestId={codexTarget?.requestId ?? null}
          requestedTab={codexTarget?.tab ?? null}
          session={session}
        />
      ) : <ReferenceCodexWorkspace />}
      {connectWorkshop ? (
        <ReferenceWorkshopWorkspace
          modelProfilesRevision={modelProfilesRevision}
          onCodexAuthorityChanged={() => setCodexAuthorityRevision((current) => current + 1)}
          onOpenProviderSettings={openProviderSettings}
          onOpenResearchCitation={openResearchCitation}
          requestedSessionId={providerReturnSessionId ?? requestedWorkshopSessionId}
          session={session}
        />
      ) : <ReferenceWorkshopWorkspace />}
      {connectWorkshop && providerReturnSessionId ? (
        <WorkshopProviderSettingsBridge onReturn={returnToWorkshop} />
      ) : null}
    </>
  );
}

function ReferenceResearchNavigationBridge({ enableReview }: { enableReview: boolean }) {
  useLayoutEffect(() => {
    const buttons = [...document.querySelectorAll<HTMLButtonElement>(".workspace-button[data-workspace]")];
    const connectedWorkspaces = enableReview ? ["Research", "Review"] : ["Research"];
    const connectedButtons = buttons.filter((button) => connectedWorkspaces.includes(button.dataset.workspace ?? ""));
    if (connectedButtons.length === 0) return;
    const disabledStates = new Map(connectedButtons.map((button) => [button, button.disabled]));
    const workspaceContexts: Record<string, string> = {
      Codex: "Story memory",
      Overview: "Project overview",
      Plan: "Structure and continuity",
      Research: "Reference library",
      Settings: "Project and application settings",
      Workshop: "Development conversations",
      Write: "Manuscript editor",
    };
    const listeners = new Map<HTMLButtonElement, () => void>();

    function activateWorkspace(workspace: string) {
      buttons.forEach((button) => {
        const active = button.dataset.workspace === workspace;
        button.classList.toggle("is-active", active);
        if (active) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      });
      document.querySelectorAll<HTMLElement>("[data-workspace-view]").forEach((view) => {
        view.hidden = view.dataset.workspaceView !== workspace;
      });
      const context = document.getElementById("brand-context");
      if (context) context.textContent = workspaceContexts[workspace] ?? "Novel Studio";
    }

    connectedButtons.forEach((button) => { button.disabled = false; });
    buttons.forEach((button) => {
      if (button.disabled) return;
      const listener = () => {
        const workspace = button.dataset.workspace;
        if (workspace) globalThis.setTimeout(() => activateWorkspace(workspace), 0);
      };
      listeners.set(button, listener);
      button.addEventListener("click", listener);
    });
    return () => {
      listeners.forEach((listener, button) => button.removeEventListener("click", listener));
      disabledStates.forEach((wasDisabled, button) => { button.disabled = wasDisabled; });
    };
  }, [enableReview]);
  return null;
}

export function WorkshopProviderSettingsBridge({ onReturn }: { onReturn: () => void }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const page = document.querySelector<HTMLElement>("[data-st7-page='connections']");
    const nav = document.querySelector<HTMLElement>("[data-st7-section='connections'] span");
    if (!page || !nav) return;
    const originalNav = nav.textContent;
    nav.textContent = "Model connections";
    page.classList.add("is-provider-bridge");
    setTarget(page);
    return () => {
      nav.textContent = originalNav;
      page.classList.remove("is-provider-bridge");
      setTarget(null);
    };
  }, []);

  if (!target) return null;
  return createPortal(
    <section className="workshop-provider-settings-bridge">
      <header><div><strong>Opened from Workshop</strong><p>Changes apply to the library-wide model connections. Return to the same conversation when you are finished.</p></div><button className="st7-button" onClick={onReturn} type="button">Return to Workshop</button></header>
    </section>,
    target,
  );
}

export function ReferenceReplica({
  connectCodex,
  connectOverview = true,
  connectResearch = connectOverview,
  connectSettings = true,
  connectWorkshop = true,
  connectWrite = true,
  enableRuntime = true,
}: ReferenceReplicaProps = {}) {
  const shouldConnectCodex = connectCodex ?? connectWrite;
  const hasConnectedProjectWorkspace = connectOverview || connectWrite || shouldConnectCodex || connectWorkshop || connectResearch;
  const prototypeRef = useRef<HTMLElement>(null);
  useReferenceStyleSheet();
  useReferenceRuntime(
    enableRuntime,
    connectWrite,
    shouldConnectCodex,
    connectWorkshop,
    connectSettings,
    connectOverview,
    hasConnectedProjectWorkspace,
  );

  useLayoutEffect(() => {
    if (!connectOverview || !prototypeRef.current) return;
    const root = prototypeRef.current;
    root.querySelectorAll<HTMLButtonElement>(".workspace-button[data-workspace]").forEach((button) => {
      const active = button.dataset.workspace === "Overview";
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    root.querySelectorAll<HTMLElement>("[data-workspace-view]").forEach((view) => {
      view.hidden = view.dataset.workspaceView !== "Overview";
    });
    const context = root.querySelector<HTMLElement>("#brand-context");
    if (context) context.textContent = "Project overview";
  }, [connectOverview]);

  return (
    <>
      <main className="prototype" ref={prototypeRef}>
        <ReferenceSurface selector=".appbar" />
        <ReferenceSurface selector="#new-series-dialog" />
        {hasConnectedProjectWorkspace ? (
          <ConnectedProjectWorkspaces
            connectCodex={shouldConnectCodex}
            connectOverview={connectOverview}
            connectResearch={connectResearch}
            connectSettings={connectSettings}
            connectWorkshop={connectWorkshop}
            connectWrite={connectWrite}
          />
        ) : (
          <>
            <ReferenceOverviewWorkspace />
            <ReferenceSettingsWorkspace connected={connectSettings} />
            <ReferencePlanWorkspace />
            <ReferenceSurface selector="#write-workspace" />
            <ReferenceCodexWorkspace />
            <ReferenceWorkshopWorkspace />
          </>
        )}
        <ReferenceInFrameOverlays includeWorkshop={!connectWorkshop} />
      </main>
      <ReferenceGlobalOverlays includeCodex={!shouldConnectCodex} includeWriteStructure={!connectWrite} />
    </>
  );
}
