import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, brotliDecompressSync, constants as zlibConstants } from "node:zlib";

import { JSDOM } from "jsdom";

export const REFERENCE_PATH = "docs/design/ui-redesign/novel-studio-full-ui-redesign-reference.html";
export const MANIFEST_PATH = "docs/tasks/NS-514_REFERENCE_MANIFEST.md";
export const CONTRACT_START = "<!-- NS-514-REFERENCE-CONTRACT:START -->";
export const CONTRACT_END = "<!-- NS-514-REFERENCE-CONTRACT:END -->";

const SURFACE_DEFINITIONS = [
  ["appbar", ".appbar", "visible"],
  ["newSeriesDialog", "#new-series-dialog", "hidden-attribute"],
  ["overview", "#overview-workspace", "hidden-attribute"],
  ["settings", "#settings-workspace", "hidden-attribute"],
  ["plan", "#plan-workspace", "hidden-attribute"],
  ["write", "#write-workspace", "hidden-attribute"],
  ["codex", "#codex-workspace", "visible-active-workspace"],
  ["workshop", "#workshop-workspace", "hidden-attribute"],
  ["workshopReview", "#wr5-review-backdrop", "closed-without-is-open"],
  ["workshopToast", "#wr5-toast", "closed-without-is-visible"],
  ["detailTypeDialog", "#schema-backdrop", "closed-without-is-open"],
  ["createEntryDialog", "#create-backdrop", "closed-without-is-open"],
  ["createCategoryDialog", "#category-backdrop", "closed-without-is-open"],
  ["writeStructureDialog", "#wr6-structure-backdrop", "closed-without-is-open"],
];

const FIXTURE_FAMILIES = [
  {
    surface: "shell/library",
    rule: "Project names, current-project state, library rows, and created-Series examples are fixture-only.",
    examples: ["The Glass Harbor", "Project Library", "New Series"],
  },
  {
    surface: "overview",
    rule: "Resume target, progress totals, metrics, recent Scenes, and attention items are fixture-only.",
    examples: ["A Weather Door", "1,080 of 1,100 words", "39%", "Broken Gauge", "Low Water"],
  },
  {
    surface: "settings",
    rule: "Connections, models, roles, prompts, paths, usage values, and readiness states are fixture-only.",
    examples: ["DeepSeek Primary", "BAAI/bge-small-zh-v1.5", "Continuity Editor", "D:\\hermes\\novel-studio-library"],
  },
  {
    surface: "plan",
    rule: "Scene cards, hierarchy counts, filters, beats, progress, time values, and divergence warnings are fixture-only.",
    examples: ["5 scenes", "The Harbor Opens", "Pressure Door", "Tide Bell", "After the Bell"],
  },
  {
    surface: "write",
    rule: "Hierarchy rows, manuscript prose, word/save state, selection, inspector facts, and issue rows are fixture-only.",
    examples: ["Saltwake", "The Harbor Opens", "Pressure Door", "Story change", "Pressure lock"],
  },
  {
    surface: "codex",
    rule: "Entries, category counts, Canon/Research/Detail values, relations, Progressions, mentions, and story position are fixture-only.",
    examples: ["Rin Vale", "Marek Sol", "Harbor Lock", "West Quay", "Night Watch Captain"],
  },
  {
    surface: "workshop",
    rule: "Sessions, messages, attachments, context counts, model choices, tool requests/results, and review mappings are fixture-only.",
    examples: ["Harbor lock continuity", "Pressure logic branch", "lock-notes.docx", "Claude Sonnet 4", "Update Rin Vale"],
  },
  {
    surface: "dialogs/overlays",
    rule: "Example form values, suggested mappings, names, descriptions, and confirmation summaries are fixture-only.",
    examples: ["Appearance · suggested", "Physical markers", "Private vow", "Volume 1"],
  },
];

const INTERACTION_SUMMARY = [
  ["shared shell", "Workspace buttons switch only among reference workspaces; project switch toggles the library menu; outside click and Escape dismiss the menu/dialog; New Series validates fields and adds a local fixture row."],
  ["overview", "Resume/Open Plan/Open Write actions switch reference workspaces; refresh mutates only local fixture metrics and status."],
  ["settings", "Section navigation, connection/model/role/prompt editing, local dialogs, test/save/archive/export controls, appearance, and privacy settings mutate only reference fixture state."],
  ["plan", "View switching, filters, field toggles, selection, inspector tabs, drag/reorder, move/undo, hierarchy collapse, beats, and plan/draft decisions mutate only fixture state."],
  ["write", "Outline/inspector toggles, panel tabs, selection actions, candidate keep/undo, scene loading, hierarchy creation, menus/popovers, and issue actions mutate only fixture/editor state."],
  ["codex", "Category/filter/search/entry selection, tabs, effective/history state, detail policy toggles, schema/category/entry dialogs, and local save/delete guards mutate only fixture state."],
  ["workshop", "Session selection/search/menu actions, context/model popovers, context selection, message send, attachment trigger, tool-request review, mapping validation, and dismissal mutate only fixture state."],
];

const normalizeText = (value = "") => value.replace(/\s+/gu, " ").trim();
const quoteAttribute = (value) => JSON.stringify(value);

function elementSignature(element) {
  const classes = [...element.classList].map((name) => `.${name}`).join("");
  const state = [
    element.hasAttribute("hidden") ? "[hidden]" : "",
    element.hasAttribute("disabled") ? "[disabled]" : "",
  ].join("");
  return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${classes}${state}`;
}

function surfaceSelectorForControl(control, root) {
  if (control.id) return `#${control.id}`;
  const dataAttributes = [...control.attributes]
    .filter((attribute) => attribute.name.startsWith("data-"))
    .map((attribute) => `[${attribute.name}=${quoteAttribute(attribute.value)}]`)
    .join("");
  let base = `${control.tagName.toLowerCase()}${dataAttributes}`;
  if (!dataAttributes) {
    const classSelector = [...control.classList].map((name) => `.${name}`).join("");
    base = `${control.tagName.toLowerCase()}${classSelector}`;
  }
  const matches = [...root.querySelectorAll(base)];
  if (matches.length <= 1) return base;
  return `${base}::reference-index(${matches.indexOf(control) + 1})`;
}

function controlLabel(control) {
  if (control.getAttribute("aria-label")) return normalizeText(control.getAttribute("aria-label"));
  if (control.title) return normalizeText(control.title);
  if (control.tagName === "SELECT") {
    return normalizeText(control.selectedOptions[0]?.textContent ?? control.value);
  }
  if (control.tagName === "INPUT" && ["text", "search", "number", "url", "password"].includes(control.type)) {
    return normalizeText(control.value || control.placeholder);
  }
  if (control.tagName === "TEXTAREA") return normalizeText(control.value || control.placeholder);
  return normalizeText(control.textContent || control.value || control.placeholder);
}

function controlValue(control) {
  if (control.tagName === "SELECT") return control.value;
  if (control.tagName === "TEXTAREA") return control.value;
  if (control.tagName === "INPUT" && !["button", "submit", "reset", "checkbox", "radio", "file"].includes(control.type)) {
    return control.value;
  }
  return undefined;
}

function extractControls(root) {
  return [...root.querySelectorAll("button, input, textarea, select, a")].map((control) => {
    const aria = Object.fromEntries(
      ["aria-current", "aria-expanded", "aria-pressed", "aria-selected", "aria-haspopup"]
        .filter((name) => control.hasAttribute(name))
        .map((name) => [name, control.getAttribute(name)]),
    );
    const result = {
      selector: surfaceSelectorForControl(control, root),
      tag: control.tagName.toLowerCase(),
      type: control.getAttribute("type") || (control.tagName === "A" ? "link" : control.tagName.toLowerCase()),
      label: controlLabel(control),
      disabled: Boolean(control.disabled || control.hasAttribute("disabled")),
      selfHidden: control.hasAttribute("hidden"),
      hiddenByAncestorAttribute: Boolean(control.closest("[hidden]")),
      checked: "checked" in control ? Boolean(control.checked) : undefined,
      aria: Object.keys(aria).length ? aria : undefined,
      value: controlValue(control),
    };
    return Object.fromEntries(Object.entries(result).filter(([, value]) => value !== undefined));
  });
}

function declarationObject(style) {
  return Object.fromEntries([...style].map((name) => [name, style.getPropertyValue(name).trim()]));
}

function extractCss(document) {
  const rules = [...document.styleSheets[0].cssRules];
  const rootRule = rules.find((rule) => rule.selectorText === ":root");
  const baseSelectors = [
    ":root",
    "*",
    "html, body",
    "body",
    "button, input, textarea, select",
    "button",
    "button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible",
  ];
  const baseRules = baseSelectors.map((selector) => {
    const rule = rules.find((candidate) => candidate.selectorText === selector);
    return { selector, declarations: declarationObject(rule.style) };
  });
  const mediaQueries = rules.filter((rule) => rule.type === 4).map((mediaRule, index) => ({
    index: index + 1,
    condition: mediaRule.conditionText,
    rules: [...mediaRule.cssRules]
      .filter((rule) => rule.selectorText)
      .map((rule) => ({ selector: rule.selectorText, declarations: declarationObject(rule.style) })),
  }));
  const stateSelectors = [];
  const collectStateSelectors = (cssRules) => {
    for (const rule of cssRules) {
      if (rule.selectorText && /(?:\[hidden\]|:disabled|:checked|:focus|:hover|\[aria-|\.is-|\.has-|body\.)/u.test(rule.selectorText)) {
        stateSelectors.push(rule.selectorText);
      }
      if (rule.cssRules) collectStateSelectors([...rule.cssRules]);
    }
  };
  collectStateSelectors(rules);
  return {
    tokens: Object.fromEntries([...rootRule.style].filter((name) => name.startsWith("--")).map((name) => [name, rootRule.style.getPropertyValue(name).trim()])),
    baseRules,
    mediaQueries,
    stateSelectors: [...new Set(stateSelectors)].sort(),
  };
}

function extractEventBindings(html, document) {
  const script = [...document.scripts].at(-1)?.textContent ?? "";
  const scriptIndex = html.lastIndexOf(script);
  const firstLine = html.slice(0, scriptIndex).split(/\r?\n/u).length;
  const listenerLines = script.split(/\r?\n/u).flatMap((line, index) => {
    const normalized = normalizeText(line);
    return normalized.includes("addEventListener(") ? [{ line: firstLine + index, code: normalized }] : [];
  });
  const eventCounts = {};
  for (const match of script.matchAll(/addEventListener\(\s*["']([^"']+)["']/gu)) {
    eventCounts[match[1]] = (eventCounts[match[1]] ?? 0) + 1;
  }
  const functions = [...script.matchAll(/function\s+([A-Za-z0-9_]+)\s*\(/gu)].map((match) => match[1]);
  return {
    totalListenerStatements: listenerLines.length,
    eventCounts: Object.fromEntries(Object.entries(eventCounts).sort(([a], [b]) => a.localeCompare(b))),
    namedFunctions: functions,
    listenerLines,
  };
}

function extractSurface(document, definition) {
  const [key, selector, defaultVisibility] = definition;
  const root = document.querySelector(selector);
  if (!root) throw new Error(`Missing reference surface ${selector}`);
  const ids = [root, ...root.querySelectorAll("[id]")].map((element) => element.id).filter(Boolean);
  const classes = [...new Set([root, ...root.querySelectorAll("[class]")].flatMap((element) => [...element.classList]))].sort();
  const directChildren = [...root.children].map(elementSignature);
  const secondLevelOrder = [...root.children].map((child) => ({
    region: elementSignature(child),
    children: [...child.children].map(elementSignature),
  }));
  const controls = extractControls(root);
  return {
    key,
    selector,
    root: elementSignature(root),
    defaultVisibility,
    directChildren,
    secondLevelOrder,
    ids,
    classes,
    controlCount: controls.length,
    controls,
  };
}

export function buildReferenceContract(referencePath = REFERENCE_PATH) {
  const html = readFileSync(referencePath, "utf8");
  const dom = new JSDOM(html);
  const { document } = dom.window;
  const prototype = document.querySelector(".prototype");
  const surfaces = SURFACE_DEFINITIONS.map((definition) => extractSurface(document, definition));
  const navigation = [...document.querySelectorAll(".appbar .workspace-button[data-workspace]")].map((button) => ({
    workspace: button.dataset.workspace,
    selector: surfaceSelectorForControl(button, document.querySelector(".appbar")),
    label: controlLabel(button),
    active: button.classList.contains("is-active"),
    disabled: button.disabled,
    ariaCurrent: button.getAttribute("aria-current"),
  }));
  const css = extractCss(document);
  const totalControls = surfaces.reduce((total, surface) => total + surface.controlCount, 0);
  return {
    schemaVersion: 1,
    source: {
      path: referencePath.replaceAll("\\", "/"),
      sha256: createHash("sha256").update(html).digest("hex").toUpperCase(),
      bytes: Buffer.byteLength(html),
      lines: html.split(/\r?\n/u).length,
      language: document.documentElement.lang,
      title: document.title,
    },
    authority: {
      reproductionRule: "P0-P4 reproduce this reference exactly; no old UI structure is merged into the replica.",
      runtimeRule: "Reference JavaScript and fixture state describe reference interactions only, not production API success.",
      fixtureRule: "Every literal project, story, count, Provider/profile, path, message, and status value is fixture-only unless it is an explicit UI label.",
    },
    rootOrder: {
      body: [...document.body.children].map(elementSignature),
      prototype: [...prototype.children].map(elementSignature),
    },
    workspaceNavigation: navigation,
    surfaces,
    totalControls,
    css,
    interactions: {
      summary: INTERACTION_SUMMARY.map(([surface, behavior]) => ({ surface, behavior })),
      sourceInventory: extractEventBindings(html, document),
    },
    fixtureFamilies: FIXTURE_FAMILIES,
  };
}

function markdownTable(headers, rows) {
  const head = `| ${headers.join(" | ")} |`;
  const divider = `| ${headers.map(() => "---").join(" | ")} |`;
  return [head, divider, ...rows.map((row) => `| ${row.join(" | ")} |`)].join("\n");
}

export function renderReferenceManifest(contract) {
  const surfaceRows = contract.surfaces.map((surface) => [
    surface.key,
    `\`${surface.selector}\``,
    surface.defaultVisibility,
    String(surface.controlCount),
    surface.directChildren.map((child) => `\`${child}\``).join(" → ") || "none",
  ]);
  const navigationRows = contract.workspaceNavigation.map((item) => [
    item.workspace,
    item.label,
    item.active ? "active" : "inactive",
    item.disabled ? "disabled" : "enabled",
  ]);
  const interactionRows = contract.interactions.summary.map((item) => [item.surface, item.behavior]);
  const mediaRows = contract.css.mediaQueries.map((query) => [
    String(query.index),
    `\`${query.condition}\``,
    String(query.rules.length),
  ]);
  const fixtureRows = contract.fixtureFamilies.map((family) => [
    family.surface,
    family.rule,
    family.examples.map((example) => `\`${example}\``).join(", "),
  ]);
  const contractJson = JSON.stringify(contract);
  const contractHash = createHash("sha256").update(contractJson).digest("hex").toUpperCase();
  const encodedContract = brotliCompressSync(contractJson, {
    params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 },
  }).toString("base64").match(/.{1,120}/gu).join("\n");
  return `# NS-514 Binding Reference Manifest

Status: P1 reference contract
Source: \`${contract.source.path}\`
Source SHA-256: \`${contract.source.sha256}\`
Generated: 2026-07-15

## Contract Boundary

- This manifest describes only the tracked binding reference HTML.
- P0 through P4 are an exact UI reproduction. No old UI control, API, route,
  callback, test expectation, or layout is an implementation requirement here.
- Reference JavaScript is a local interaction specification. Its simulated
  success, counts, story facts, Provider/profile values, paths, and messages
  are fixtures, not product data or backend evidence.
- The complete machine block below freezes all tokens, base rules, top-level
  and child-region order, surface classes/IDs, controls and default states,
  state selectors, event-listener source lines, and media-query declarations.

## Source Identity

${markdownTable(["Property", "Value"], [
    ["Bytes", String(contract.source.bytes)],
    ["Lines", String(contract.source.lines)],
    ["Document language", contract.source.language],
    ["Document title", contract.source.title],
    ["Total inventoried controls", String(contract.totalControls)],
    ["CSS custom properties", String(Object.keys(contract.css.tokens).length)],
    ["Media queries", String(contract.css.mediaQueries.length)],
    ["Listener statements", String(contract.interactions.sourceInventory.totalListenerStatements)],
  ])}

## Top-Level Order

Body order:

${contract.rootOrder.body.map((node, index) => `${index + 1}. \`${node}\``).join("\n")}

Application-frame order:

${contract.rootOrder.prototype.map((node, index) => `${index + 1}. \`${node}\``).join("\n")}

## Surface And Region Inventory

${markdownTable(["Surface", "Root", "Default", "Controls", "Direct child order"], surfaceRows)}

Every class, ID, second-level child order, control selector, label, value,
enabled/disabled state, hidden ancestry, checked state, and ARIA state is in the
machine block. That inventory is the P1 source for the per-surface P2/P3 tests.

## Workspace Navigation Defaults

${markdownTable(["Workspace", "Label", "Selection", "Availability"], navigationRows)}

Codex is the default visible workspace. Review and Research are disabled in
the reference. Settings is a separate icon control in the same appbar.

## Reference Interaction Inventory

${markdownTable(["Surface", "Reference-only behavior"], interactionRows)}

The machine block records every source line containing an event-listener
registration, its event type counts, and the named reference functions. These
are reference behaviors only and do not authorize production API calls.

## Responsive Contract

${markdownTable(["#", "Condition", "Rule count"], mediaRows)}

The machine block stores every selector and declaration inside all media
queries, including both reduced-motion blocks. Structural diagnostics may
compare these rules, but they are not user visual acceptance.

## Fixture-Only Content

The binding classification is exhaustive by category: every literal project,
story, count, profile/model, filesystem path, session/message, and status value
is fixture-only unless it is an explicit interface label. The examples below
are anchors for each category, not permission to treat unlisted literals as
production data.

${markdownTable(["Surface", "Fixture rule", "Anchors"], fixtureRows)}

## Machine-Checkable Contract

Encoding: \`application/json+br+base64\`
Uncompressed JSON SHA-256: \`${contractHash}\`

${CONTRACT_START}
\`\`\`text
${encodedContract}
\`\`\`
${CONTRACT_END}
`;
}

export function parseManifestContract(markdown) {
  const start = markdown.indexOf(CONTRACT_START);
  const end = markdown.indexOf(CONTRACT_END);
  if (start < 0 || end < 0 || end <= start) throw new Error("NS-514 contract markers are missing or out of order");
  const block = markdown.slice(start + CONTRACT_START.length, end);
  const match = block.match(/```text\s*([A-Za-z0-9+/=\s]+?)\s*```/u);
  if (!match) throw new Error("NS-514 encoded contract block is missing");
  const json = brotliDecompressSync(Buffer.from(match[1].replace(/\s+/gu, ""), "base64")).toString("utf8");
  const declaredHash = markdown.match(/Uncompressed JSON SHA-256: `([A-F0-9]{64})`/u)?.[1];
  const actualHash = createHash("sha256").update(json).digest("hex").toUpperCase();
  if (!declaredHash || declaredHash !== actualHash) throw new Error("NS-514 contract JSON checksum does not match");
  return JSON.parse(json);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.stdout.write(renderReferenceManifest(buildReferenceContract()));
}
