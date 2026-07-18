import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ReferenceCodexWorkspace } from "../features/codex/ReferenceCodexWorkspace";
import { ReferenceOverviewWorkspace } from "../features/overview/ReferenceOverviewWorkspace";
import { ReferencePlanWorkspace } from "../features/plan/ReferencePlanWorkspace";
import { ReferenceSettingsWorkspace } from "../features/settings/ReferenceSettingsWorkspace";
import { ReferenceWorkshopWorkspace } from "../features/workshop/ReferenceWorkshopWorkspace";
import { ReferenceWriteWorkspace } from "../features/write/ReferenceWriteWorkspace";
import { ReferenceSurface } from "../ui/ReferenceSurface";
import { useProjectSession } from "./useProjectSession";
import { ReferenceGlobalOverlays, ReferenceInFrameOverlays } from "./ReferenceOverlays";
import { useReferenceRuntime } from "./useReferenceRuntime";
import { useReferenceStyleSheet } from "./useReferenceStyleSheet";

export interface ReferenceReplicaProps {
  connectCodex?: boolean;
  connectSettings?: boolean;
  connectWorkshop?: boolean;
  connectWrite?: boolean;
  enableRuntime?: boolean;
}

function ConnectedProjectWorkspaces({
  connectCodex,
  connectWorkshop,
  connectWrite,
}: {
  connectCodex: boolean;
  connectWorkshop: boolean;
  connectWrite: boolean;
}) {
  const session = useProjectSession();
  const openingSeriesRef = useRef<string | null>(null);
  const [writeTarget, setWriteTarget] = useState<{ blockId: string | null; sceneId: string } | null>(null);
  const [providerReturnSessionId, setProviderReturnSessionId] = useState<string | null>(null);

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

  return (
    <>
      {connectWrite ? <ReferenceWriteWorkspace requestedBlockId={writeTarget?.blockId ?? null} session={session} /> : <ReferenceSurface selector="#write-workspace" />}
      {connectCodex ? <ReferenceCodexWorkspace onOpenWrite={openWriteTarget} session={session} /> : <ReferenceCodexWorkspace />}
      {connectWorkshop ? (
        <ReferenceWorkshopWorkspace
          onOpenProviderSettings={openProviderSettings}
          requestedSessionId={providerReturnSessionId}
          session={session}
        />
      ) : <ReferenceWorkshopWorkspace />}
      {connectWorkshop && providerReturnSessionId ? (
        <WorkshopProviderSettingsBridge onReturn={returnToWorkshop} />
      ) : null}
    </>
  );
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
  connectSettings = true,
  connectWorkshop = true,
  connectWrite = true,
  enableRuntime = true,
}: ReferenceReplicaProps = {}) {
  const shouldConnectCodex = connectCodex ?? connectWrite;
  useReferenceStyleSheet();
  useReferenceRuntime(enableRuntime, connectWrite, shouldConnectCodex, connectWorkshop, connectSettings);

  return (
    <>
      <main className="prototype">
        <ReferenceSurface selector=".appbar" />
        <ReferenceSurface selector="#new-series-dialog" />
        <ReferenceOverviewWorkspace />
        <ReferenceSettingsWorkspace connected={connectSettings} />
        <ReferencePlanWorkspace />
        {connectWrite || shouldConnectCodex || connectWorkshop ? (
          <ConnectedProjectWorkspaces
            connectCodex={shouldConnectCodex}
            connectWorkshop={connectWorkshop}
            connectWrite={connectWrite}
          />
        ) : (
          <>
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
