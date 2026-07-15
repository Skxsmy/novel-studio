import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { brotliCompressSync, brotliDecompressSync, constants as zlibConstants } from "node:zlib";

import { buildReferenceContract } from "./ns514-reference-contract.mjs";
import ts from "typescript";

export const AUDIT_PATH = "docs/tasks/NS-514_REFERENCE_CONTROL_AND_CAPABILITY_AUDIT.md";
export const AUDIT_START = "<!-- NS-514-AUDIT:START -->";
export const AUDIT_END = "<!-- NS-514-AUDIT:END -->";

const API_SOURCE = {
  ai: "apps/web/src/api/ai.ts",
  codex: "apps/web/src/api/codex.ts",
  proposals: "apps/web/src/api/proposals.ts",
  series: "apps/web/src/api/series.ts",
  workshop: "apps/web/src/api/workshop.ts",
};

const FEATURE_ROOT = "apps/web/src/features";
const RUNTIME_ROOT_FILES = ["apps/web/src/app/App.tsx", "apps/web/src/app/useProjectSession.ts"];
const OLD_BUTTON_SOURCE_FILES = [
  "apps/web/src/app/App.tsx",
  "apps/web/src/features/library/LibraryWorkspace.tsx",
  "apps/web/src/features/overview/OverviewWorkspace.tsx",
  "apps/web/src/features/plan/PlanWorkspace.tsx",
  "apps/web/src/features/write/WriteWorkspace.tsx",
  "apps/web/src/features/write/editor/NovelEditor.tsx",
  "apps/web/src/features/codex/CodexWorkspace.tsx",
  "apps/web/src/features/settings/SettingsWorkspace.tsx",
  "apps/web/src/features/workshop/WorkshopWorkspace.tsx",
  "apps/web/src/features/review/ReviewWorkspace.tsx",
];

const API_LABEL_OVERRIDES = {
  "series.createBook": "Create Volume",
  "series.updateBook": "Rename/update Volume",
  "series.deleteBook": "Delete Volume",
  "series.createAct": "Create Chapter",
  "series.updateAct": "Rename/update Chapter",
  "series.deleteAct": "Delete Chapter",
  "series.createChapter": "Create Act",
  "series.updateChapter": "Rename/update Act",
  "series.deleteChapter": "Delete Act",
  "series.getSceneDocument": "Load Scene block document",
  "series.updateSceneDocument": "Autosave Scene title and block document",
  "series.createSceneProgressionBlock": "Insert saved Story change block",
  "series.deleteSceneProgressionBlock": "Delete saved Story change block",
  "codex.getEffectiveEntry": "Resolve Codex entry at story position",
  "codex.listEntryMentions": "List manuscript mentions for Codex entry",
  "ai.getModelCredentialStatus": "Read model credential status without exposing secret",
  "ai.saveModelCredential": "Store model credential",
  "ai.deleteModelCredential": "Remove model credential",
  "proposals.editAndAccept": "Edit and accept Proposal",
  "proposals.markStale": "Mark Proposal stale",
  "workshop.executeCodexCreateEntryTool": "Confirm and execute Workshop Codex-entry creation",
  "workshop.executeCodexUpdateEntryTool": "Confirm and execute Workshop Codex-entry update",
  "workshop.getMessageSource": "Resolve Proposal source Workshop message",
  "workshop.runCall": "Run non-streaming Workshop AI call",
  "workshop.runCallStream": "Run streaming Workshop AI call",
};

const ABSENT_API_CAPABILITIES = new Set([
  "ai.deleteModelCredential",
  "codex.archiveEntry",
  "codex.archiveRelation",
  "codex.createRelation",
  "codex.deleteCategory",
  "codex.deleteEntry",
  "codex.restoreEntry",
  "proposals.accept",
  "proposals.editAndAccept",
  "proposals.list",
  "proposals.markStale",
  "proposals.reject",
  "series.deleteAct",
  "series.deleteBook",
  "series.deleteChapter",
  "series.deleteScene",
  "series.deleteSceneProgressionBlock",
  "series.deleteSeries",
  "series.restoreSeries",
  "series.trashSeries",
  "series.updateAct",
  "series.updateBook",
  "series.updateChapter",
  "workshop.deleteMessage",
  "workshop.getMessageSource",
  "workshop.resendMessage",
  "workshop.restoreSession",
  "workshop.updateSession",
]);

const PARTIAL_API_CAPABILITIES = new Set([
  "codex.getEffectiveEntry",
  "codex.listEntryMentions",
  "codex.listProgressions",
  "codex.listRelations",
  "codex.updateProgression",
  "series.createSceneProgressionBlock",
  "workshop.executeCodexCreateEntryTool",
  "workshop.executeCodexUpdateEntryTool",
  "workshop.runCall",
]);

const API_REFERENCE_ANCHORS = {
  ai: "Settings / Model connections and Workshop model chooser",
  codex: "Codex workspace, Codex dialogs, Write Story change, and Workshop context/review",
  proposals: "disabled Review appbar control only; no Proposal inbox surface",
  series: "Project switch/New Series, Plan, and Write",
  workshop: "Workshop workspace and request-review overlay",
};

const LOCAL_CAPABILITIES = [
  {
    key: "workspace-navigation",
    name: "Switch product workspace",
    entry: "Project rail workspace buttons",
    source: "apps/web/src/app/App.tsx",
    anchor: "function showWorkspace(workspaceId: WorkspaceId)",
    callback: "App.showWorkspace",
    coverage: "represented",
    reference: "appbar workspace buttons",
    impact: "Without it the main writing, planning, Codex, Workshop, and Settings paths cannot be entered.",
    options: "Connect the existing workspace state in place; keep Review disabled until separately decided.",
  },
  {
    key: "open-library",
    name: "Open Project Library without closing the active Series",
    entry: "Project rail project-switch action",
    source: "apps/web/src/app/App.tsx",
    anchor: "function openLibrary()",
    callback: "App.openLibrary",
    coverage: "represented",
    reference: "#project-library-button",
    impact: "Authors cannot switch or manage Series.",
    options: "Connect the reference project switch to the real library state in place.",
  },
  {
    key: "sidebar-collapse",
    name: "Collapse or expand the legacy project sidebar",
    entry: "Project rail collapse button",
    source: "apps/web/src/app/App.tsx",
    anchor: "setIsSidebarCollapsed((value) => !value)",
    callback: "App.setIsSidebarCollapsed",
    coverage: "absent",
    reference: "none; the binding replaces the rail with an appbar",
    impact: "No loss after exact replica because the old sidebar itself is intentionally absent, but its compact-layout affordance has no direct equivalent.",
    options: "Keep absent, or request a future binding revision with an appbar compact-layout control.",
  },
  {
    key: "focus-mode",
    name: "Toggle distraction-free Write focus mode",
    entry: "Write Focus button",
    source: "apps/web/src/app/App.tsx",
    anchor: "onToggleFocus={() => setIsFocusMode((value) => !value)}",
    callback: "App.onToggleFocus",
    coverage: "represented",
    reference: "write:#wr6-focus",
    impact: "Authors lose the dedicated focused drafting layout.",
    options: "Connect the existing focus state to #wr6-focus without DOM changes.",
  },
  {
    key: "proposal-deep-link",
    name: "Open a Proposal from a stable hash route",
    entry: "#/review/proposals/:proposalId",
    source: "apps/web/src/app/App.tsx",
    anchor: "function proposalIdFromLocation(): string | null",
    callback: "proposalIdFromLocation / App.openProposal",
    coverage: "absent",
    reference: "none; Review navigation is disabled",
    impact: "Proposal notifications and Workshop review links cannot land on the author decision.",
    options: "Future binding revision: enable Review with a Proposal inbox/selection route; do not hide the route behind another workspace.",
  },
  {
    key: "workshop-message-deep-link",
    name: "Open a Workshop session at a source message hash route",
    entry: "#/workshop/sessions/:sessionId/messages/:messageId",
    source: "apps/web/src/app/App.tsx",
    anchor: "function workshopRouteFromLocation(): WorkshopRoute | null",
    callback: "workshopRouteFromLocation / App.openWorkshopMessage",
    coverage: "partial",
    reference: "Workshop thread selection exists, but no message-addressable route control is defined",
    impact: "A Proposal source can open the session but not reliably focus the originating message.",
    options: "Preserve the route invisibly if it does not change the binding, or add a future explicit source-message affordance.",
  },
  {
    key: "hierarchy-selection",
    name: "Select Volume, Chapter, Act, or Scene in manuscript structure",
    entry: "Write hierarchy rows",
    source: "apps/web/src/app/useProjectSession.ts",
    anchor: "const selectVolume = useCallback(",
    callback: "selectVolume / selectAct / selectChapter / selectScene",
    coverage: "represented",
    reference: "write hierarchy rows under data-level",
    impact: "Authors cannot navigate the canonical Series → Volume → Chapter → Act → Scene hierarchy.",
    options: "Connect reference hierarchy rows to existing selection state and real documents.",
  },
  {
    key: "hierarchy-collapse",
    name: "Collapse or expand manuscript hierarchy branches",
    entry: "Write hierarchy disclosure buttons",
    source: "apps/web/src/features/write/WriteWorkspace.tsx",
    anchor: "const [collapsedBooks, setCollapsedBooks]",
    callback: "WriteWorkspace.setCollapsedNodes",
    coverage: "represented",
    reference: "write controls with data-wr6-branch",
    impact: "Large Series structures become difficult to navigate.",
    options: "Retain as reference-local presentation state over real hierarchy data.",
  },
  {
    key: "clear-structure-selection",
    name: "Clear a selected manuscript structure node",
    entry: "Write structure panel selection state",
    source: "apps/web/src/app/useProjectSession.ts",
    anchor: "const resetStructureSelection = useCallback(",
    callback: "resetStructureSelection",
    coverage: "absent",
    reference: "none",
    impact: "Selection can only change to another node; there is no explicit return to an unselected state.",
    options: "Keep implicit, or add a future binding-approved clear-selection affordance.",
  },
  {
    key: "editor-rich-text",
    name: "Edit Scene prose as structured block content with selection preservation",
    entry: "Write manuscript editor",
    source: "apps/web/src/features/write/editor/NovelEditor.tsx",
    anchor: "export function NovelEditor({",
    callback: "NovelEditor.onUpdateDocument / onCommitDocument",
    coverage: "represented",
    reference: "Write manuscript editor region (not counted as a button/input control by the binding manifest)",
    impact: "The core drafting capability is lost.",
    options: "Mount the existing editor inside the exact reference editor region without adding controls.",
  },
  {
    key: "write-scene-brief",
    name: "Show or hide the Write Scene brief panel",
    entry: "Write Show scene brief / hide panel buttons",
    source: "apps/web/src/features/write/WriteWorkspace.tsx",
    anchor: "const [isBriefVisible, setIsBriefVisible]",
    callback: "WriteWorkspace.setIsBriefVisible",
    coverage: "represented",
    reference: "write:#wr6-toggle-inspector and the Scene sidebar tab",
    impact: "Authors lose quick access to the current Scene brief while drafting.",
    options: "Map the existing local panel state to the reference writing-sidebar controls.",
  },
  {
    key: "codex-inline-preview",
    name: "Inspect Codex mentions inline from manuscript text",
    entry: "Clickable Codex marks in Write editor",
    source: "apps/web/src/features/write/editor/NovelEditor.tsx",
    anchor: "function toggleCodexPreview(codexMark: HTMLElement)",
    callback: "NovelEditor.toggleCodexPreview",
    coverage: "partial",
    reference: "Write Codex sidebar exists, but inline manuscript marks/popover are not specified",
    impact: "Authors lose in-context identity/fact lookup while drafting.",
    options: "Keep an in-editor non-structural popover only with explicit approval, or request a binding revision.",
  },
  {
    key: "codex-open-source-scene",
    name: "Open a progression or mention source Scene from Codex",
    entry: "Codex Progressions and Mentions Open Scene buttons",
    source: "apps/web/src/features/codex/CodexWorkspace.tsx",
    anchor: "onOpenScene(sourceScene.metadata.id)",
    callback: "CodexWorkspace.onOpenScene",
    coverage: "partial",
    reference: "codex: disabled Open in Write / Open Scene controls RC-253 through RC-256",
    impact: "Authors cannot move from Codex evidence back to the manuscript source.",
    options: "Approve conditional in-place enablement when a real target Scene exists; keep the binding default disabled otherwise.",
  },
  {
    key: "codex-mention-preview",
    name: "Open the selected Codex entry preview from mention evidence",
    entry: "Codex mention highlighted-snippet button",
    source: "apps/web/src/features/codex/CodexWorkspace.tsx",
    anchor: "setPreviewEntry(selectedEntry)",
    callback: "CodexWorkspace.setPreviewEntry",
    coverage: "partial",
    reference: "Codex Mentions tab exists, but no enabled entry-preview action is specified",
    impact: "Cross-entry evidence can be seen as text but not inspected in context.",
    options: "Request an explicit binding preview affordance, or approve reuse of an existing in-place mention row interaction.",
  },
  {
    key: "progression-block-reorder",
    name: "Reorder Story change blocks inside the Scene document",
    entry: "Write Story change block drag/keyboard actions",
    source: "apps/web/src/features/write/WriteWorkspace.tsx",
    anchor: "function moveProgressionBlock(blockId: string, direction:",
    callback: "moveProgressionBlock / moveProgressionBlockTo",
    coverage: "absent",
    reference: "none; the binding shows one collapsed Story change card only",
    impact: "Authors cannot control where saved story-state changes occur in prose order.",
    options: "Future binding revision with reorder affordance, or preserve keyboard/drag behavior inside the card after approval.",
  },
  {
    key: "plan-view-state",
    name: "Switch Plan views and filter/sort/select Scenes locally",
    entry: "Plan view tabs, filters, sort, and Scene cards",
    source: "apps/web/src/features/plan/PlanWorkspace.tsx",
    anchor: "const [activeView, setActiveView]",
    callback: "PlanWorkspace view/query/status/sort/selectedScene state",
    coverage: "represented",
    reference: "Plan Grid/Outline/Matrix/Timeline, Filter, Fields, and Scene controls",
    impact: "Planning data cannot be explored or narrowed.",
    options: "Reuse local presentation state with real planning-board data.",
  },
  {
    key: "codex-view-state",
    name: "Filter/search/select Codex entries and switch entry tabs/state lens",
    entry: "Codex category, search, filter, entry list, tabs, Baseline/Effective controls",
    source: "apps/web/src/features/codex/CodexWorkspace.tsx",
    anchor: "export function CodexWorkspace({ onOpenScene, series }",
    callback: "CodexWorkspace local category/filter/search/tab/state selection",
    coverage: "represented",
    reference: "Codex category/filter/list/tab/lens controls",
    impact: "Authors cannot navigate or inspect the Codex.",
    options: "Bind local view state to the exact reference controls while loading real entries.",
  },
  {
    key: "workshop-view-state",
    name: "Search/filter conversations and navigate Workshop popovers/context trees",
    entry: "Workshop session search/filter, actions, context, and model popovers",
    source: "apps/web/src/features/workshop/WorkshopWorkspace.tsx",
    anchor: "function closeFloatingSurfaces()",
    callback: "WorkshopWorkspace local filter/popover/context-view state",
    coverage: "represented",
    reference: "Workshop search/filter/action/context/model controls",
    impact: "Conversation and context selection become unusable at scale.",
    options: "Retain as local presentation state over real sessions/context.",
  },
  {
    key: "stop-workshop-call",
    name: "Abort an in-flight Workshop call",
    entry: "Workshop Stop button while calling",
    source: "apps/web/src/features/workshop/WorkshopWorkspace.tsx",
    anchor: "callAbortRef.current?.abort()",
    callback: "AbortController.abort",
    coverage: "represented",
    reference: "workshop:#wr5-stop (disabled only in the default state)",
    impact: "Authors cannot stop a long or incorrect provider request.",
    options: "Enable only while a real call is in flight; keep the existing abort boundary.",
  },
  {
    key: "reasoning-visibility",
    name: "Toggle per-message reasoning visibility and export inclusion",
    entry: "Workshop reasoning disclosure and export options",
    source: "apps/web/src/features/workshop/WorkshopWorkspace.tsx",
    anchor: "function toggleReasoning(messageId: string)",
    callback: "toggleReasoning / includeReasoningInExport",
    coverage: "partial",
    reference: "Workshop model popover has reasoning checkboxes; per-message disclosure/export options are not explicit",
    impact: "Authors lose control over sensitive reasoning visibility and exported audit content.",
    options: "Preserve only after a privacy review, or request explicit binding controls.",
  },
  {
    key: "review-patch-edit-state",
    name: "Edit structured Proposal patch text before acceptance",
    entry: "Review patch editor",
    source: "apps/web/src/features/review/ReviewWorkspace.tsx",
    anchor: "setEditedTextByPatchId",
    callback: "ReviewWorkspace.setEditedTextByPatchId",
    coverage: "absent",
    reference: "none; Review workspace is disabled",
    impact: "Authors can no longer make the smallest corrected change before accepting a Proposal.",
    options: "Future Review binding must include patch editing before edit-and-accept is reconnected.",
  },
];

function jsxAttribute(node, name, sourceFile) {
  return node.attributes.properties.find((attribute) =>
    ts.isJsxAttribute(attribute) && attribute.name.getText(sourceFile) === name,
  );
}

function jsxControlLabel(node, sourceFile) {
  const parts = [];
  function visit(child) {
    if (ts.isJsxText(child)) {
      const value = child.text.replace(/\s+/gu, " ").trim();
      if (value) parts.push(value);
    } else if (ts.isJsxExpression(child) && child.expression) {
      if (ts.isStringLiteral(child.expression)) parts.push(child.expression.text);
      else parts.push(`{${child.expression.getText(sourceFile)}}`);
    } else {
      ts.forEachChild(child, visit);
    }
  }
  node.children.forEach(visit);
  return parts.join(" ").replace(/\s+/gu, " ").trim() || "(dynamic label)";
}

export function scanHandlerlessOldButtons() {
  const controls = [];
  for (const source of OLD_BUTTON_SOURCE_FILES) {
    const text = readFileSync(source, "utf8");
    const sourceFile = ts.createSourceFile(source, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(sourceFile) === "button") {
        const onClick = jsxAttribute(node.openingElement, "onClick", sourceFile);
        const type = jsxAttribute(node.openingElement, "type", sourceFile)?.initializer?.getText(sourceFile) ?? "";
        if (!onClick && !type.includes("submit")) {
          const disabled = Boolean(jsxAttribute(node.openingElement, "disabled", sourceFile));
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
          controls.push({
            kind: "handlerless-button",
            source,
            line,
            control: jsxControlLabel(node, sourceFile),
            disabled,
            reason: disabled
              ? "Explicitly disabled old placeholder with no activation handler; it is not counted as a real capability."
              : "Enabled old button has no activation handler; it is a dead/fake legacy control, not a real capability.",
          });
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }
  return controls;
}

function excludedOldControls() {
  return [
    ...scanHandlerlessOldButtons(),
    {
      kind: "disabled-input-placeholder",
      source: "apps/web/src/app/App.tsx",
      line: 395,
      control: "Command search input",
      disabled: true,
      reason: "Explicitly disabled placeholder with no command execution path; it is not counted as a capability.",
    },
  ];
}

function walkSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walkSourceFiles(path);
    if (![".ts", ".tsx"].includes(extname(entry.name))) return [];
    if (/Reference|\.test\./u.test(entry.name)) return [];
    return [path.replaceAll("\\", "/")];
  });
}

export function runtimeSourceFiles() {
  return [...RUNTIME_ROOT_FILES, ...walkSourceFiles(FEATURE_ROOT)].sort();
}

function lineAt(text, index) {
  return text.slice(0, index).split(/\r?\n/u).length;
}

function nearestCallback(text, index) {
  const prefix = text.slice(0, index);
  const patterns = [
    /function\s+([A-Za-z0-9_]+)\s*\([^)]*\)\s*\{[^{}]*$/su,
    /const\s+([A-Za-z0-9_]+)\s*=\s*useCallback\s*\([^;]*$/su,
    /(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\([^)]*\)[^{]*\{[^{}]*$/su,
  ];
  for (const pattern of patterns) {
    const match = prefix.match(pattern);
    if (match) return match[1];
  }
  const fallbacks = [...prefix.matchAll(/(?:function\s+|const\s+)([A-Za-z0-9_]+)(?:\s*=|\s*\()/gu)];
  return fallbacks.at(-1)?.[1] ?? "component effect/callback";
}

export function scanRuntimeApiCalls() {
  const calls = [];
  for (const path of runtimeSourceFiles()) {
    const text = readFileSync(path, "utf8");
    for (const match of text.matchAll(/api\.(series|codex|ai|proposals|workshop)\.([A-Za-z0-9_]+)/gu)) {
      calls.push({
        token: `${match[1]}.${match[2]}`,
        domain: match[1],
        method: match[2],
        source: path,
        line: lineAt(text, match.index),
        callback: nearestCallback(text, match.index),
      });
    }
  }
  return calls;
}

function humanize(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .replace(/^./u, (letter) => letter.toUpperCase());
}

function apiMethodBlock(domain, method) {
  const source = readFileSync(API_SOURCE[domain], "utf8");
  const start = source.search(new RegExp(`^    ${method}\\(`, "mu"));
  if (start < 0) throw new Error(`Cannot find API implementation for ${domain}.${method}`);
  const rest = source.slice(start + 1);
  const next = rest.search(/^    [A-Za-z0-9_]+\(/mu);
  return source.slice(start, next < 0 ? source.length : start + 1 + next);
}

function apiEndpoint(domain, method) {
  const block = apiMethodBlock(domain, method);
  const route = block.match(/([`"])(\/[\s\S]*?)\1/u)?.[2];
  if (!route) throw new Error(`Cannot find API route for ${domain}.${method}`);
  const verb = block.match(/method:\s*"(GET|POST|PUT|PATCH|DELETE)"/u)?.[1] ?? "GET";
  return `${verb} ${route.replace(/\$\{([A-Za-z0-9_.]+)\}/gu, ":$1")}`;
}

function authorityBoundary(domain, method) {
  if (domain === "series") {
    if (/delete|trash|restore/iu.test(method)) return "Project JSON authority; destructive/lifecycle confirmation and atomic write boundaries remain mandatory.";
    return "Schema-versioned project JSON authority with revision/checksum validation and atomic replacement.";
  }
  if (domain === "codex") {
    return "Codex project JSON authority; base revision, archive/delete guards, story time, and character-knowledge boundaries remain mandatory.";
  }
  if (domain === "ai") {
    if (/Credential/gu.test(method)) return "Global local credential boundary; secret material is stored separately and must never be returned or logged.";
    return "Global local model-profile settings; no project manuscript authority and no implicit network fallback.";
  }
  if (domain === "proposals") {
    return "Proposal authority and target revision boundary; semantic changes require explicit author acceptance and stale-target protection.";
  }
  return "Workshop project JSON/session authority; context, Provider calls, attachments, Grants/tool confirmation, and Proposal boundaries remain mandatory.";
}

function apiCoverage(token, domain) {
  if (ABSENT_API_CAPABILITIES.has(token)) return "absent";
  if (PARTIAL_API_CAPABILITIES.has(token)) return "partial";
  return "represented";
}

function absenceReason(token, coverage, domain) {
  if (coverage === "represented") return `n/a—candidate reference area: ${API_REFERENCE_ANCHORS[domain]}.`;
  if (token.startsWith("proposals.")) return "The binding disables Review and defines no Proposal inbox, patch view, or author-decision controls.";
  if (/series\.(trashSeries|restoreSeries|deleteSeries)/u.test(token)) return "The reference project switch has no Series lifecycle menu for trash, restore, or permanent deletion.";
  if (/series\.(updateBook|updateAct|updateChapter|deleteBook|deleteAct|deleteChapter|deleteScene)/u.test(token)) return "The reference Write hierarchy exposes creation and selection, but no rename or delete action.";
  if (/codex\.(archiveEntry|restoreEntry|deleteEntry)/u.test(token)) return "Codex More is disabled and the binding defines no entry lifecycle controls.";
  if (/codex\.(createRelation|archiveRelation)/u.test(token)) return "The Relations tab exists, but Add relation is disabled and no relation lifecycle action is defined.";
  if (token === "ai.deleteModelCredential") return "The binding exposes a service-key field but no distinct remove-credential action.";
  if (/workshop\.(updateSession|restoreSession|resendMessage|deleteMessage|getMessageSource)/u.test(token)) return "The binding does not expose this conversation/message lifecycle or source-navigation action.";
  return "The binding shows only part of the existing workflow; its local handler does not prove the production operation or safety boundary.";
}

function capabilityImpact(token, coverage) {
  if (coverage === "represented") return "No omission if the candidate control is approved and connected to real state/results.";
  if (token.startsWith("proposals.")) return "Author review/approval is inaccessible; AI or bulk semantic changes cannot be safely completed through the UI.";
  if (/delete|trash|restore|archive/iu.test(token)) return "The affected item cannot complete its existing lifecycle from the replica.";
  if (/updateBook|updateAct|updateChapter/iu.test(token)) return "Authors cannot correct hierarchy names after creation.";
  if (token === "workshop.getMessageSource") return "A Proposal cannot navigate back to the evidence-bearing source message.";
  return coverage === "partial"
    ? "Part of the workflow is visible, but production data, completion, or safety behavior would be missing."
    : "The existing user operation would be unavailable from the replica.";
}

function futureOption(token, coverage, domain) {
  if (coverage === "represented") return "Approve in-place connection with no reference DOM/visual change, or leave fixture-only/disabled.";
  if (coverage === "partial") return "Approve only the structurally fitting subset; request a later binding revision for the missing state/action.";
  if (domain === "proposals") return "Revise the binding with an enabled Review workspace that preserves Proposal/revision/evidence decisions.";
  return "Keep unavailable now, or revise the binding with an explicit control before connection.";
}

export function buildOldCapabilityInventory() {
  const grouped = new Map();
  for (const call of scanRuntimeApiCalls()) {
    if (!grouped.has(call.token)) grouped.set(call.token, []);
    grouped.get(call.token).push(call);
  }
  const apiCapabilities = [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([token, calls]) => {
    const [domain, method] = token.split(".");
    const coverage = apiCoverage(token, domain);
    return {
      kind: "api-backed",
      key: token,
      name: API_LABEL_OVERRIDES[token] ?? humanize(method),
      oldEntryPoint: [...new Set(calls.map((call) => call.source.replace("apps/web/src/features/", "") + `:${call.line}`))].join("; "),
      frontendCallback: [...new Set(calls.map((call) => call.callback))].join(" / "),
      apiToken: `api.${token}`,
      apiEndpoint: apiEndpoint(domain, method),
      authorityBoundary: authorityBoundary(domain, method),
      referenceCoverage: coverage,
      referenceControl: API_REFERENCE_ANCHORS[domain],
      whyNoReferenceControl: absenceReason(token, coverage, domain),
      userImpactIfOmitted: capabilityImpact(token, coverage),
      futureReferenceOptions: futureOption(token, coverage, domain),
      authorDecisionStatus: "pending_author",
      sourceAnchors: calls.map((call) => `${call.source}:${call.line}`),
    };
  });
  const localCapabilities = LOCAL_CAPABILITIES.map((item) => ({
    kind: "frontend-local",
    key: item.key,
    name: item.name,
    oldEntryPoint: item.entry,
    frontendCallback: item.callback,
    apiToken: "none",
    apiEndpoint: "none—frontend-local",
    authorityBoundary: "Presentation/routing state only; it must not become the sole project copy or bypass an API safety boundary.",
    referenceCoverage: item.coverage,
    referenceControl: item.reference,
    whyNoReferenceControl: item.coverage === "represented" ? `n/a—${item.reference}.` : item.reference,
    userImpactIfOmitted: item.impact,
    futureReferenceOptions: item.options,
    authorDecisionStatus: "pending_author",
    sourceAnchors: [`${item.source}#${item.anchor}`],
    sourceTextAnchor: item.anchor,
  }));
  return [...apiCapabilities, ...localCapabilities].map((item, index) => ({
    id: `OC-${String(index + 1).padStart(3, "0")}`,
    ...item,
  }));
}

function controlState(surface, control) {
  const states = [control.disabled ? "disabled" : "enabled"];
  if (control.hiddenByAncestorAttribute) states.push("surface hidden by default");
  if (control.selfHidden) states.push("self hidden");
  if (control.checked !== undefined) states.push(control.checked ? "checked" : "unchecked");
  if (control.value) states.push(`value=${JSON.stringify(control.value)}`);
  if (control.aria) states.push(`ARIA ${JSON.stringify(control.aria)}`);
  return states.join("; ");
}

function controlInteraction(control) {
  if (control.disabled) return "No activation in the binding default state.";
  if (control.tag === "button" || control.tag === "a") return "Binding click mutates reference-local DOM/fixture state only.";
  if (control.type === "checkbox" || control.type === "radio") return "Binding change toggles a reference-local choice only.";
  if (control.type === "file") return "Binding opens a local file chooser trigger; no production upload is proven.";
  if (control.tag === "select") return "Binding change selects a reference-local option only.";
  return "Binding input edits a reference-local form value only.";
}

function mapped(frontend, api = "none", proposedStatus = "connect in place", structuralFit = "yes—no reference DOM change") {
  return { frontend, api, proposedStatus, structuralFit };
}

function local(frontend) {
  return mapped(frontend, "none—presentation state", "local-only");
}

function deferred(reason, fit = "yes—disable existing control") {
  return mapped(reason, "none—no matching production operation", "disabled-deferred", fit);
}

function fixture(reason) {
  return mapped(reason, "none—reference fixture behavior only", "fixture-only", "yes—retain only in non-production reference harness");
}

function referenceControlMapping(surface, control) {
  const selector = control.selector;
  const label = control.label;
  if (surface === "codex" && control.type === "radio" && /reference-index\((4|5|6|7)\)/u.test(selector)) {
    return mapped("CodexWorkspace context-policy entry draft", "api.codex.updateEntry");
  }
  if (surface === "codex" && /button\.button::reference-index\((6|7|8|9)\)/u.test(selector)) {
    return mapped(
      "CodexWorkspace.onOpenScene",
      "api.series.getSceneDocument",
      "connect in place",
      "conditional—same node; enable only when a real target Scene exists",
    );
  }
  if (surface === "workshop" && selector === "#wr5-stop") {
    return mapped(
      "WorkshopWorkspace.stopSending / AbortController.abort",
      "none—cancels the active Provider request",
      "connect in place",
      "conditional—same node; enable only while a real call is active",
    );
  }
  if (surface === "workshopReview" && selector === "#wr5-review-confirm") {
    return mapped(
      "WorkshopWorkspace.confirmCodexDraft",
      "api.workshop.executeCodexCreateEntryTool; api.workshop.executeCodexUpdateEntryTool",
      "connect in place",
      "conditional—same node; enable only after valid mappings and explicit confirmation",
    );
  }
  if (control.disabled) return deferred("Binding-disabled control; no production callback may be implied.");

  if (surface === "appbar") {
    if (selector.includes("data-workspace")) return local("App.showWorkspace candidate");
    if (selector === "#project-library-button") return mapped("App.openLibrary / useProjectSession.openSeries", "api.series.listSeries; api.series.getSeries");
    if (selector === "#new-series-button") return local("open New Series dialog");
    return local("reference appbar state");
  }
  if (surface === "newSeriesDialog") {
    if (selector === "#create-series-button") return mapped("useProjectSession.createSeries", "api.series.createSeries");
    if (/new-series-(name|volume|description)/u.test(selector)) return local("create-Series form draft");
    return local("New Series dialog open/close/reset state");
  }
  if (surface === "overview") {
    if (selector.includes("data-ov7-open")) return local("App.showWorkspace(Plan)");
    if (selector.includes("data-ov7-write")) return mapped("useProjectSession.selectScene + App.showWorkspace(Write)", "api.series.getSceneDocument");
    if (selector.includes("data-ov7-codex")) return mapped("CodexWorkspace entry selection candidate", "api.codex.listEntries; api.codex.getEntry");
    return mapped("PlanWorkspace Scene selection candidate", "api.series.getPlanningBoard");
  }
  if (surface === "settings") {
    if (selector.includes("data-st7-section")) return local("Settings section selection");
    if (selector === "#st7-add-connection") return local("SettingsWorkspace.startNewModel");
    if (["#st7-connection-name", "#st7-provider", "#st7-model", "#st7-base-url", "#st7-context-window"].includes(selector)) return local("SettingsWorkspace model-profile form state");
    if (selector === "#st7-service-key") return local("SettingsWorkspace credential draft (must never echo saved secret)");
    if (selector === "#st7-browse-models" || selector.includes("data-st7-model")) return mapped("SettingsWorkspace.fetchModels/selectProviderModel", "api.ai.listProviderModels");
    if (selector === "#st7-test-connection") return mapped("SettingsWorkspace.testConnection", "api.ai.testModelProfile");
    if (selector === "#st7-save-connection") return mapped("SettingsWorkspace.saveModelProfile/saveCredential", "api.ai.createModelProfile; api.ai.updateModelProfile; api.ai.saveModelCredential");
    if (selector === "#st7-archive-connection" || selector === "#st7-confirm-archive") return mapped("SettingsWorkspace.archiveModelProfile", "api.ai.archiveModelProfile");
    if (selector === "#st7-cancel-archive") return local("Settings archive-confirmation state");
    if (selector.includes("data-value") || ["#st7-editor-size", "#st7-reduce-motion", "#st7-save-appearance"].includes(selector)) return local("appearance preference state; no current persisted API");
    return deferred(`No pre-NS-514 production callback for Settings control ${label || selector}.`);
  }
  if (surface === "plan") {
    if (selector.includes("data-pl6-view") || /filter|fields|inspector|outline-toggle|matrix|clear-filters/u.test(selector)) return local("PlanWorkspace view/filter/inspector state");
    if (selector.includes("data-pl6-scene")) return mapped("PlanWorkspace Scene selection", "api.series.getPlanningBoard");
    if (/move-(earlier|later)/u.test(selector)) return mapped("PlanWorkspace.moveSelected", "api.series.reorderScenes");
    if (selector === "#pl6-toast-undo") return local("Plan reorder undo state");
    if (/status-filter|pov-filter|field-toggle|inspector-tab/u.test(selector)) return local("PlanWorkspace local filter/field/tab state");
    return deferred(`Reference Plan fixture editor has no matching persisted pre-NS-514 operation for ${label || selector}.`);
  }
  if (surface === "write") {
    if (/toggle|focus|close|data-wr6-mode|data-wr6-branch|data-wr6-tab/u.test(selector)) return local("WriteWorkspace panel/mode/focus/hierarchy presentation state");
    if (/add-structure|create-level/u.test(selector)) return local("open structure-creation dialog");
    if (selector.includes("data-wr6-scene")) return mapped("useProjectSession.selectScene", "api.series.getSceneDocument");
    if (selector === "#wr6-title") return mapped("useProjectSession.updateDraftTitle/commitDraftDocument", "api.series.updateSceneDocument");
    if (/story-change/u.test(selector)) return mapped("WriteWorkspace Story change selection/edit", "api.series.createSceneProgressionBlock; api.codex.updateProgression");
    if (/codex-search|data-wr6-reference/u.test(selector)) return mapped("WriteWorkspace Codex lookup", "api.codex.listEntries; api.codex.listDetailTypes");
    if (selector === "#wr6-keep-candidate" || selector === "#wr6-undo-candidate") return fixture("Reference candidate state has no pre-NS-514 Proposal-backed candidate callback.");
    return deferred(`Reference Write action ${label || selector} has no matching production callback.`);
  }
  if (surface === "codex") {
    if (/new-entry/u.test(selector)) return selector === "#confirm-create"
      ? mapped("CodexWorkspace.createEntry", "api.codex.createEntry")
      : local("open create-entry dialog");
    if (/new-category/u.test(selector)) return local("open create-category dialog");
    if (/open-schema/u.test(selector)) return local("open detail-type library");
    if (selector === "#save-entry") return mapped("CodexWorkspace.saveEntry", "api.codex.updateEntry");
    if (/data-category|data-lens|compact-category|entry-search|data-filter|data-tab|baseline-state|effective-state/u.test(selector)) return local("CodexWorkspace category/filter/search/tab/effective-state selection");
    if (selector.includes("data-id")) return mapped("CodexWorkspace.selectEntry", "api.codex.getEntry; api.codex.listEntryMentions; api.codex.listRelations; api.codex.listProgressions; api.codex.getEffectiveEntry");
    if (/canon-text|input\.input|select\.select|textarea\.textarea\.research-editor|button\.toggle/u.test(selector)) return mapped("CodexWorkspace entry draft", "api.codex.updateEntry");
    return deferred(`Reference Codex action ${label || selector} has no enabled production mapping.`);
  }
  if (surface === "workshop") {
    if (selector === "#wr5-new-button" || selector.includes("data-wr5-new")) return mapped("WorkshopWorkspace.createSession flow", "api.workshop.createSession");
    if (/session-search|data-wr5-filter|mobile-sessions/u.test(selector)) return local("Workshop session filtering/mobile drawer state");
    if (selector.includes("data-wr5-thread")) return mapped("WorkshopWorkspace.selectSession", "api.workshop.getSession");
    if (selector === "#wr5-branch") return mapped("WorkshopWorkspace.branchSession", "api.workshop.branchSession");
    if (selector === "#wr5-more-button") return local("Workshop conversation-actions popover");
    if (label === "Export") return mapped("WorkshopWorkspace.exportSession", "api.workshop.exportSession");
    if (label === "Archive") return mapped("WorkshopWorkspace.archiveSession", "api.workshop.archiveSession");
    if (label.startsWith("Delete")) return mapped("WorkshopWorkspace.deleteSession", "api.workshop.deleteSession");
    if (label === "Retry") return mapped("WorkshopWorkspace.retryAgentRun", "api.workshop.retryAgentRun");
    if (label === "Abandon") return mapped("WorkshopWorkspace.abandonAgentRun", "api.workshop.abandonAgentRun");
    if (label === "Dismiss") return local("reference request-dismissal state; no persisted operation");
    if (selector === "#wr5-review-request") return local("open Workshop tool-request review overlay");
    if (/context-button|context-tab|context-clear|context-option|context-view|context-back/u.test(selector)) return mapped("WorkshopWorkspace context basket/view state", "api.workshop.updateContextBasket");
    if (/agent-button|reference-index\((3|4|5)\)/u.test(selector) && (control.type === "radio" || selector === "#wr5-agent-button")) return mapped("WorkshopWorkspace model-profile/model selection", "api.ai.listModelProfiles; api.ai.listProviderModels");
    if (/attach|file-input/u.test(selector)) return mapped("WorkshopWorkspace.uploadAttachment", "api.workshop.uploadAttachment");
    if (selector === "#wr5-composer-input") return local("Workshop composer draft");
    if (selector === "#wr5-send") return mapped("WorkshopWorkspace.send", "api.workshop.runCallStream; api.workshop.runCall");
    if (selector === "#wr5-stop") return local("AbortController.abort while a real call is active");
    if (control.type === "checkbox") return local("Workshop response/reasoning presentation preference");
    return local("Workshop reference popover state");
  }
  if (surface === "workshopReview") {
    if (selector === "#wr5-review-confirm") return mapped("WorkshopWorkspace.confirmCodexDraft", "api.workshop.executeCodexCreateEntryTool; api.workshop.executeCodexUpdateEntryTool");
    return local("Workshop request-review mapping/dismissal state");
  }
  if (surface === "detailTypeDialog") {
    if (selector === "#new-detail-type") return mapped("CodexWorkspace.createDetailType", "api.codex.createDetailType");
    if (selector === "#delete-detail-type") return mapped("CodexWorkspace.deleteDetailType", "api.codex.deleteDetailType");
    if (label === "Save library") return mapped("CodexWorkspace.updateDetailType", "api.codex.updateDetailType");
    if (/schema-category|schema-name|schema-description|schema-ai|schema-sensitive/u.test(selector)) return local("Codex detail-type library draft/selection");
    if (selector === "#new-schema-category-button") return local("open create-category dialog");
    return local("detail-type dialog open/close state");
  }
  if (surface === "createEntryDialog") {
    if (selector === "#confirm-create") return mapped("CodexWorkspace.createEntry", "api.codex.createEntry");
    return local("Codex create-entry form/dialog state");
  }
  if (surface === "createCategoryDialog") {
    if (selector === "#confirm-category") return mapped("CodexWorkspace.createCategory", "api.codex.createCategory");
    return local("Codex create-category form/dialog state");
  }
  if (surface === "writeStructureDialog") {
    if (selector === "#wr6-confirm-structure") return mapped("useProjectSession.createVolume/createAct/createChapter/createScene", "api.series.createBook; api.series.createAct; api.series.createChapter; api.series.createScene");
    return local("Write structure-creation form/dialog state");
  }
  return fixture(`No production mapping for ${surface}:${selector}.`);
}

export function buildReferenceControlInventory(contract = buildReferenceContract()) {
  let index = 0;
  return contract.surfaces.flatMap((surface) => surface.controls.map((control) => {
    index += 1;
    const mapping = referenceControlMapping(surface.key, control);
    return {
      id: `RC-${String(index).padStart(3, "0")}`,
      workspaceReferenceNode: `${surface.key}:${control.selector}`,
      surface: surface.key,
      selector: control.selector,
      controlLabelIcon: control.label || `(unlabelled ${control.type})`,
      tag: control.tag,
      type: control.type,
      referenceState: controlState(surface, control),
      referenceInteraction: controlInteraction(control),
      existingFrontendCallback: mapping.frontend,
      existingApiEndpoint: mapping.api,
      proposedStatus: mapping.proposedStatus,
      connectsWithoutDomVisualChange: mapping.structuralFit,
      authorDecisionStatus: "pending_author",
    };
  }));
}

export function buildReferenceAudit(contract = buildReferenceContract()) {
  return {
    schemaVersion: 1,
    generated: "2026-07-15",
    bindingSource: contract.source,
    boundary: {
      referenceRule: "Every manifest control appears exactly once. Proposed mappings do not authorize P6.",
      capabilityRule: "Every reachable pre-NS-514 api.* method appears exactly once, plus manually reviewed frontend-local capabilities.",
      fakeControlRule: "Visible old controls without a handler are recorded separately and are not promoted to capabilities.",
    },
    referenceControls: buildReferenceControlInventory(contract),
    oldCapabilities: buildOldCapabilityInventory(),
    excludedOldControls: excludedOldControls(),
  };
}

function md(value) {
  return String(value).replaceAll("|", "\\|").replace(/\r?\n/gu, " ");
}

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(md).join(" | ")} |`),
  ].join("\n");
}

export function renderReferenceAudit(audit) {
  const controlsBySurface = new Map();
  for (const control of audit.referenceControls) {
    if (!controlsBySurface.has(control.surface)) controlsBySurface.set(control.surface, []);
    controlsBySurface.get(control.surface).push(control);
  }
  const controlSections = [...controlsBySurface.entries()].map(([surface, controls]) => `### ${surface} (${controls.length})

${table(
    ["ID", "Reference node", "Label/icon", "Reference state + interaction", "Existing frontend callback", "Existing API", "Proposed status", "Fits exact structure", "Author decision"],
    controls.map((control) => [
      control.id,
      `\`${control.workspaceReferenceNode}\``,
      control.controlLabelIcon,
      `${control.referenceState}; ${control.referenceInteraction}`,
      control.existingFrontendCallback,
      control.existingApiEndpoint,
      control.proposedStatus,
      control.connectsWithoutDomVisualChange,
      control.authorDecisionStatus,
    ]),
  )}`).join("\n\n");

  const capabilityRows = audit.oldCapabilities.map((capability) => [
    capability.id,
    `${capability.name} (${capability.kind})`,
    `${capability.oldEntryPoint}; ${capability.frontendCallback}`,
    `${capability.apiToken}; ${capability.apiEndpoint}; ${capability.authorityBoundary}`,
    `${capability.referenceCoverage}: ${capability.referenceControl}; ${capability.whyNoReferenceControl}`,
    capability.userImpactIfOmitted,
    capability.futureReferenceOptions,
    capability.authorDecisionStatus,
  ]);
  const fakeRows = audit.excludedOldControls.map((item) => [item.control, `${item.source}:${item.line}`, item.reason]);
  const controlCounts = Object.fromEntries([...controlsBySurface.entries()].map(([surface, items]) => [surface, items.length]));
  const dispositionCounts = Object.fromEntries(
    ["connect in place", "local-only", "disabled-deferred", "fixture-only"].map((status) => [
      status,
      audit.referenceControls.filter((item) => item.proposedStatus === status).length,
    ]),
  );
  const coverageCounts = Object.fromEntries(
    ["represented", "partial", "absent"].map((status) => [
      status,
      audit.oldCapabilities.filter((item) => item.referenceCoverage === status).length,
    ]),
  );
  const json = JSON.stringify(audit);
  const hash = createHash("sha256").update(json).digest("hex").toUpperCase();
  const encoded = brotliCompressSync(json, {
    params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 },
  }).toString("base64").match(/.{1,120}/gu).join("\n");
  return `# NS-514 Reference Control And Capability Audit

Status: P5 audit complete; all dispositions await author decision
Binding reference: \`${audit.bindingSource.path}\`
Binding SHA-256: \`${audit.bindingSource.sha256}\`
Generated: ${audit.generated}

## Decision Boundary

- This is the P5 audit required after the exact P4 replica. It does not merge,
  restore, or redesign the old UI.
- Every one of the ${audit.referenceControls.length} binding controls is listed
  once below. A proposed status is analysis, not permission to start P6.
- Every reachable pre-NS-514 \`api.*\` UI method is listed exactly once, plus
  frontend-local capabilities confirmed by source review. Old visible controls
  without handlers are recorded separately and are not misreported as working.
- Every author decision remains \`pending_author\`. Only explicitly approved
  \`connect in place\` mappings may enter P6, and only if the reference DOM and
  visual state remain unchanged. A missing capability requires a later binding
  revision; it must not be silently inserted into this replica.

## Summary

Reference controls by surface: \`${JSON.stringify(controlCounts)}\`

Proposed reference-control dispositions: \`${JSON.stringify(dispositionCounts)}\`

Old capability coverage: \`${JSON.stringify(coverageCounts)}\`

The decision-sensitive rows are the \`disabled-deferred\`, \`fixture-only\`,
\`partial\`, and \`absent\` items. In particular, the binding's disabled Review
button does not represent the old Proposal inbox, revision-safe decisions,
patch editing, or source-message navigation.

## Reference Control Inventory

${controlSections}

## Pre-NS-514 Real Capability Inventory

This table includes all real API-backed operations reached by the old UI and
all separately audited frontend-local behaviors. \`represented\` means only
that a structurally plausible reference control exists; it does not mean it is
already connected. \`partial\` and \`absent\` are capability gaps.

${table(
    ["ID", "Capability", "Old entry + callback", "API + authority boundary", "Reference coverage / why absent", "Impact if omitted", "Future reference option", "Author decision"],
    capabilityRows,
  )}

## Old Visible Controls Excluded As Fake Or Placeholder

${table(["Old control", "Source", "Why it is not a capability"], fakeRows)}

These exclusions are intentional: reconnecting them as working controls would
invent capability that did not exist before NS-514.

## Machine-Checkable Audit

Encoding: \`application/json+br+base64\`
Uncompressed JSON SHA-256: \`${hash}\`

${AUDIT_START}
\`\`\`text
${encoded}
\`\`\`
${AUDIT_END}
`;
}

export function parseReferenceAudit(markdown) {
  const start = markdown.indexOf(AUDIT_START);
  const end = markdown.indexOf(AUDIT_END);
  if (start < 0 || end < 0 || end <= start) throw new Error("NS-514 audit markers are missing or out of order");
  const block = markdown.slice(start + AUDIT_START.length, end);
  const match = block.match(/```text\s*([A-Za-z0-9+/=\s]+?)\s*```/u);
  if (!match) throw new Error("NS-514 encoded audit block is missing");
  const json = brotliDecompressSync(Buffer.from(match[1].replace(/\s+/gu, ""), "base64")).toString("utf8");
  const declaredHash = markdown.match(/Uncompressed JSON SHA-256: `([A-F0-9]{64})`/u)?.[1];
  const actualHash = createHash("sha256").update(json).digest("hex").toUpperCase();
  if (!declaredHash || declaredHash !== actualHash) throw new Error("NS-514 audit hash mismatch");
  return JSON.parse(json);
}

export function auditPathFromModule() {
  return relative(process.cwd(), AUDIT_PATH).replaceAll("\\", "/");
}
