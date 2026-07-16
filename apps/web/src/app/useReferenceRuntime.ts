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

export function useReferenceRuntime(enabled = true, omitWrite = false, omitCodex = false) {
  useEffect(() => {
    if (!enabled) return;
    if (document.getElementById(RUNTIME_ID)) return;
    const script = document.createElement("script");
    script.id = RUNTIME_ID;
    const runtime = getReferenceRuntimeText();
    const withoutCodex = omitCodex ? omitCodexReferenceRuntime(runtime) : runtime;
    script.textContent = `(() => {${omitWrite ? omitWriteReferenceRuntime(withoutCodex) : withoutCodex}\n})();`;
    document.body.append(script);
  }, [enabled, omitCodex, omitWrite]);
}
