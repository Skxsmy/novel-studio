import { useEffect } from "react";

import { getReferenceRuntimeText } from "./reference-source";

const RUNTIME_ID = "ns514-binding-reference-runtime";

export function omitWriteReferenceRuntime(runtime: string) {
  const writeRootToken = 'const root = document.getElementById("write-workspace");';
  const followingRootToken = 'const trigger = document.getElementById("project-library-button");';
  const writeRoot = runtime.indexOf(writeRootToken);
  const followingRoot = runtime.indexOf(followingRootToken, writeRoot + writeRootToken.length);
  if (writeRoot < 0 || followingRoot < 0) return runtime;
  const writeIife = runtime.lastIndexOf("(() => {", writeRoot);
  const followingIife = runtime.lastIndexOf("(() => {", followingRoot);
  if (writeIife < 0 || followingIife <= writeIife) return runtime;
  return `${runtime.slice(0, writeIife)}${runtime.slice(followingIife)}`;
}

export function omitCodexReferenceRuntime(runtime: string) {
  const fixturesToken = "const entries = {";
  const workspaceToken = "const workspaceButtons = [...document.querySelectorAll(\".workspace-button[data-workspace]\")];";
  const codexBehaviorToken = "function applyFilters() {";
  const workshopToken = '(() => {\n      const root = document.getElementById("workshop-workspace");';
  const fixturesStart = runtime.indexOf(fixturesToken);
  const workspaceStart = runtime.indexOf(workspaceToken, fixturesStart);
  const codexBehaviorStart = runtime.indexOf(codexBehaviorToken, workspaceStart);
  const workshopStart = runtime.indexOf(workshopToken, codexBehaviorStart);
  if (fixturesStart < 0 || workspaceStart < 0 || codexBehaviorStart < 0 || workshopStart < 0) return runtime;
  return `${runtime.slice(0, fixturesStart)}const body = document.body;\n    ${runtime.slice(workspaceStart, codexBehaviorStart)}${runtime.slice(workshopStart)}`;
}

export function omitWorkshopReferenceRuntime(runtime: string) {
  const workshopRootToken = 'const root = document.getElementById("workshop-workspace");';
  const writeRootToken = 'const root = document.getElementById("write-workspace");';
  const workshopRoot = runtime.indexOf(workshopRootToken);
  const writeRoot = runtime.indexOf(writeRootToken, workshopRoot + workshopRootToken.length);
  if (workshopRoot < 0 || writeRoot < 0) return runtime;
  const workshopIife = runtime.lastIndexOf("(() => {", workshopRoot);
  const writeIife = runtime.lastIndexOf("(() => {", writeRoot);
  if (workshopIife < 0 || writeIife <= workshopIife) return runtime;
  return `${runtime.slice(0, workshopIife)}${runtime.slice(writeIife)}`;
}

export function omitSettingsReferenceRuntime(runtime: string) {
  const settingsRootToken = 'const root = document.getElementById("settings-workspace");';
  const planRootToken = 'const root = document.getElementById("plan-workspace");';
  const settingsRoot = runtime.indexOf(settingsRootToken);
  const planRoot = runtime.indexOf(planRootToken, settingsRoot + settingsRootToken.length);
  if (settingsRoot < 0 || planRoot < 0) return runtime;
  const settingsIife = runtime.lastIndexOf("(() => {", settingsRoot);
  const planIife = runtime.lastIndexOf("(() => {", planRoot);
  if (settingsIife < 0 || planIife <= settingsIife) return runtime;
  return `${runtime.slice(0, settingsIife)}${runtime.slice(planIife)}`;
}

export function omitOverviewReferenceRuntime(runtime: string) {
  const overviewRootToken = 'const root = document.getElementById("overview-workspace");';
  const settingsRootToken = 'const root = document.getElementById("settings-workspace");';
  const overviewRoot = runtime.indexOf(overviewRootToken);
  const settingsRoot = runtime.indexOf(settingsRootToken, overviewRoot + overviewRootToken.length);
  if (overviewRoot < 0 || settingsRoot < 0) return runtime;
  const overviewIife = runtime.lastIndexOf("(() => {", overviewRoot);
  const settingsIife = runtime.lastIndexOf("(() => {", settingsRoot);
  if (overviewIife < 0 || settingsIife <= overviewIife) return runtime;
  return `${runtime.slice(0, overviewIife)}${runtime.slice(settingsIife)}`;
}

export function useReferenceRuntime(
  enabled = true,
  omitWrite = false,
  omitCodex = false,
  omitWorkshop = false,
  omitSettings = false,
  omitOverview = false,
) {
  useEffect(() => {
    if (!enabled) return;
    if (document.getElementById(RUNTIME_ID)) return;
    const script = document.createElement("script");
    script.id = RUNTIME_ID;
    const runtime = getReferenceRuntimeText();
    const withoutCodex = omitCodex ? omitCodexReferenceRuntime(runtime) : runtime;
    const withoutWorkshop = omitWorkshop ? omitWorkshopReferenceRuntime(withoutCodex) : withoutCodex;
    const withoutOverview = omitOverview ? omitOverviewReferenceRuntime(withoutWorkshop) : withoutWorkshop;
    const withoutSettings = omitSettings ? omitSettingsReferenceRuntime(withoutOverview) : withoutOverview;
    const withInitialWorkspace = omitOverview
      ? withoutSettings.replace('let lastDesignedWorkspace = "Codex";', 'let lastDesignedWorkspace = "Overview";')
      : withoutSettings;
    script.textContent = `(() => {${omitWrite ? omitWriteReferenceRuntime(withInitialWorkspace) : withInitialWorkspace}\n})();`;
    document.body.append(script);
  }, [enabled, omitCodex, omitOverview, omitSettings, omitWorkshop, omitWrite]);
}
