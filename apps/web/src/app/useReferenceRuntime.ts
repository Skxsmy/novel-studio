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

export function useReferenceRuntime(enabled = true, omitWrite = false) {
  useEffect(() => {
    if (!enabled) return;
    if (document.getElementById(RUNTIME_ID)) return;
    const script = document.createElement("script");
    script.id = RUNTIME_ID;
    const runtime = getReferenceRuntimeText();
    script.textContent = `(() => {${omitWrite ? omitWriteReferenceRuntime(runtime) : runtime}\n})();`;
    document.body.append(script);
  }, [enabled, omitWrite]);
}
