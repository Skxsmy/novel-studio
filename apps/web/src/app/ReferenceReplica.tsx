import { useEffect, useRef, useState } from "react";

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
  connectWrite?: boolean;
  enableRuntime?: boolean;
}

function ConnectedProjectWorkspaces({ connectCodex, connectWrite }: { connectCodex: boolean; connectWrite: boolean }) {
  const session = useProjectSession();
  const openingSeriesRef = useRef<string | null>(null);
  const [writeTarget, setWriteTarget] = useState<{ blockId: string | null; sceneId: string } | null>(null);

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

  return (
    <>
      {connectWrite ? <ReferenceWriteWorkspace requestedBlockId={writeTarget?.blockId ?? null} session={session} /> : <ReferenceSurface selector="#write-workspace" />}
      {connectCodex ? <ReferenceCodexWorkspace onOpenWrite={openWriteTarget} session={session} /> : <ReferenceCodexWorkspace />}
    </>
  );
}

export function ReferenceReplica({ connectCodex, connectWrite = true, enableRuntime = true }: ReferenceReplicaProps = {}) {
  const shouldConnectCodex = connectCodex ?? connectWrite;
  useReferenceStyleSheet();
  useReferenceRuntime(enableRuntime, connectWrite, shouldConnectCodex);

  return (
    <>
      <main className="prototype">
        <ReferenceSurface selector=".appbar" />
        <ReferenceSurface selector="#new-series-dialog" />
        <ReferenceOverviewWorkspace />
        <ReferenceSettingsWorkspace />
        <ReferencePlanWorkspace />
        {connectWrite || shouldConnectCodex ? (
          <ConnectedProjectWorkspaces connectCodex={shouldConnectCodex} connectWrite={connectWrite} />
        ) : (
          <>
            <ReferenceSurface selector="#write-workspace" />
            <ReferenceCodexWorkspace />
          </>
        )}
        <ReferenceWorkshopWorkspace />
        <ReferenceInFrameOverlays />
      </main>
      <ReferenceGlobalOverlays includeCodex={!shouldConnectCodex} includeWriteStructure={!connectWrite} />
    </>
  );
}
