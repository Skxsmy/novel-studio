import { ReferenceCodexWorkspace } from "../features/codex/ReferenceCodexWorkspace";
import { ReferenceOverviewWorkspace } from "../features/overview/ReferenceOverviewWorkspace";
import { ReferencePlanWorkspace } from "../features/plan/ReferencePlanWorkspace";
import { ReferenceSettingsWorkspace } from "../features/settings/ReferenceSettingsWorkspace";
import { ReferenceWorkshopWorkspace } from "../features/workshop/ReferenceWorkshopWorkspace";
import { ReferenceConnectedWriteWorkspace } from "../features/write/ReferenceWriteWorkspace";
import { ReferenceSurface } from "../ui/ReferenceSurface";
import { ReferenceGlobalOverlays, ReferenceInFrameOverlays } from "./ReferenceOverlays";
import { useReferenceRuntime } from "./useReferenceRuntime";
import { useReferenceStyleSheet } from "./useReferenceStyleSheet";

export interface ReferenceReplicaProps {
  connectWrite?: boolean;
  enableRuntime?: boolean;
}

export function ReferenceReplica({ connectWrite = true, enableRuntime = true }: ReferenceReplicaProps = {}) {
  useReferenceStyleSheet();
  useReferenceRuntime(enableRuntime, connectWrite);

  return (
    <>
      <main className="prototype">
        <ReferenceSurface selector=".appbar" />
        <ReferenceSurface selector="#new-series-dialog" />
        <ReferenceOverviewWorkspace />
        <ReferenceSettingsWorkspace />
        <ReferencePlanWorkspace />
        {connectWrite ? <ReferenceConnectedWriteWorkspace /> : <ReferenceSurface selector="#write-workspace" />}
        <ReferenceCodexWorkspace />
        <ReferenceWorkshopWorkspace />
        <ReferenceInFrameOverlays />
      </main>
      <ReferenceGlobalOverlays includeWriteStructure={!connectWrite} />
    </>
  );
}
