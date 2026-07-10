import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".hermes",
  "node_modules",
  "dist",
  ".vite",
  ".npm-cache",
]);

const ROOT_ENTRY_FILES = [
  "AGENTS.md",
  "README.md",
  "ROADMAP.md",
  "STATUS.md",
  "HANDOFF.md",
  "TASKS.md",
  "CHANGELOG.md",
  "docs/README.md",
];

const CANONICAL_HIERARCHY = "Series → Volume → Chapter → Act → Scene";

function normalize(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function read(root, relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function lineCount(text) {
  return text.length === 0 ? 0 : text.split(/\r?\n/u).length;
}

export function collectMarkdownFiles(root) {
  const files = [];

  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(normalize(path.relative(root, absolute)));
      }
    }
  }

  walk(root);
  return files.sort();
}

function decodeTarget(rawTarget) {
  const withoutTitle = rawTarget.trim().replace(/^<|>$/gu, "").split(/\s+"/u)[0];
  try {
    return decodeURIComponent(withoutTitle);
  } catch {
    return withoutTitle;
  }
}

function targetExists(root, sourceFile, rawTarget) {
  const target = decodeTarget(rawTarget);
  if (/^(?:https?:\/\/|mailto:|#)/iu.test(target)) return true;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(target)) return true;

  const filePart = target.split("#", 1)[0].split("?", 1)[0];
  if (!filePart) return true;
  const resolved = path.resolve(root, path.dirname(sourceFile), filePart);
  return existsSync(resolved);
}

export function checkMarkdownLinks(root, markdownFiles = collectMarkdownFiles(root)) {
  const errors = [];
  const linkPattern = /\[[^\]]*\]\(([^)]+)\)/gu;

  for (const file of markdownFiles) {
    const text = read(root, file);
    for (const match of text.matchAll(linkPattern)) {
      if (!targetExists(root, file, match[1])) {
        errors.push(`${file}: missing Markdown link target ${match[1]}`);
      }
    }
  }
  return errors;
}

function resolveBacktickReference(root, sourceFile, reference) {
  if (reference.startsWith("docs/")) return path.join(root, reference);
  if (/^(?:AGENTS|CHANGELOG|HANDOFF|PROJECT|README|ROADMAP|STATUS|TASKS)\.md$/u.test(reference)) {
    return path.join(root, reference);
  }
  return path.resolve(root, path.dirname(sourceFile), reference);
}

export function checkCurrentDocumentReferences(root, activeTaskId) {
  const files = [
    ...ROOT_ENTRY_FILES,
    `docs/tasks/${activeTaskId}.md`,
    `docs/testing/${activeTaskId}_ACCEPTANCE.md`,
  ];
  const errors = [];
  const referencePattern = /`([^`\r\n]+\.(?:md|html))`/gu;

  for (const file of files) {
    if (!existsSync(path.join(root, file))) {
      errors.push(`${file}: required current document is missing`);
      continue;
    }
    const text = read(root, file);
    for (const match of text.matchAll(referencePattern)) {
      const reference = match[1];
      if (/[<*>]|(?:NS-XXX|TASK-ID)/u.test(reference)) continue;
      if (/\s/u.test(reference) || /^(?:https?:\/\/|file:)/iu.test(reference)) continue;
      if (!existsSync(resolveBacktickReference(root, file, reference))) {
        errors.push(`${file}: missing backtick document reference ${reference}`);
      }
    }
  }
  return errors;
}

export function getActiveTaskId(root) {
  const status = read(root, "STATUS.md");
  const match = status.match(/Active task:\s*`((?:NS|GOV)-\d{3})\b/u);
  return match?.[1] ?? null;
}

function extractAcceptanceIds(text, taskId) {
  return new Set(text.match(new RegExp(`${taskId}-A\\d{2}`, "gu")) ?? []);
}

export function checkActiveTask(root) {
  const errors = [];
  const taskId = getActiveTaskId(root);
  if (!taskId) return ["STATUS.md: missing one supported Active task declaration"];

  const tasks = read(root, "TASKS.md");
  const activeRows = [...tasks.matchAll(/^\|\s*((?:NS|GOV)-\d{3})\s*\|\s*in_progress\s*\|/gmu)].map(
    (match) => match[1],
  );
  if (activeRows.length !== 1 || activeRows[0] !== taskId) {
    errors.push(`TASKS.md: expected exactly one in_progress row for ${taskId}; found ${activeRows.join(", ") || "none"}`);
  }

  const taskFile = `docs/tasks/${taskId}.md`;
  const acceptanceFile = `docs/testing/${taskId}_ACCEPTANCE.md`;
  if (!existsSync(path.join(root, taskFile))) errors.push(`${taskFile}: active task file is missing`);
  if (!existsSync(path.join(root, acceptanceFile))) errors.push(`${acceptanceFile}: active acceptance file is missing`);
  if (errors.length > 0) return errors;

  const task = read(root, taskFile);
  const acceptance = read(root, acceptanceFile);
  if (!/^Status:\s*in_progress\s*$/mu.test(task)) errors.push(`${taskFile}: active task Status must be in_progress`);
  if (!/^Status:\s*(?:in_progress|manual_pending)\s*$/mu.test(acceptance)) {
    errors.push(`${acceptanceFile}: active acceptance Status must be in_progress or manual_pending`);
  }

  const taskIds = extractAcceptanceIds(task, taskId);
  const acceptanceIds = extractAcceptanceIds(acceptance, taskId);
  for (const id of taskIds) {
    if (!acceptanceIds.has(id)) errors.push(`${acceptanceFile}: missing acceptance row for ${id}`);
  }
  for (const id of acceptanceIds) {
    if (!taskIds.has(id)) errors.push(`${taskFile}: acceptance record contains undeclared ${id}`);
  }

  const rows = acceptance
    .split(/\r?\n/u)
    .filter((line) => new RegExp(`^\\|\\s*${taskId}-A\\d{2}\\s*\\|`, "u").test(line));
  for (const row of rows) {
    const cells = row.split("|").slice(1, -1).map((cell) => cell.trim());
    const [id, status, proofTarget] = cells;
    if (!/^(?:planned|in_progress|passed|manual_pending|blocked|not_applicable)$/u.test(status)) {
      errors.push(`${acceptanceFile}: ${id} has invalid status ${status}`);
    }
    if (!proofTarget || proofTarget.length < 12 || /^covered by tests\.?$/iu.test(proofTarget)) {
      errors.push(`${acceptanceFile}: ${id} needs an exact proof target`);
    }
  }

  return errors;
}

export function checkMainlineMapping(root) {
  const status = read(root, "STATUS.md");
  const errors = [];
  const activeTaskId = getActiveTaskId(root);
  const milestone = status.match(/Active milestone:\s*`M(\d+)\b/u)?.[1] ?? null;
  const last = status.match(/Last completed mainline task:\s*`NS-(\d{3})\s*\/\s*M(\d+)(?:\.[^`]*)?`/u);
  const next = status.match(/Next mainline task:\s*`NS-(\d{3})\s*\/\s*M(\d+)(?:\.[^`]*)?`/u);

  if (!milestone) errors.push("STATUS.md: missing Active milestone `M#` declaration");
  if (!last) errors.push("STATUS.md: missing Last completed mainline task `NS-### / M#...` declaration");
  if (!next) errors.push("STATUS.md: missing Next mainline task `NS-### / M#...` declaration");
  if (!milestone || !last || !next) return errors;

  const expectedHundred = Number(milestone);
  for (const [label, match] of [["last completed", last], ["next", next]]) {
    const nsNumber = Number(match[1]);
    const sliceMilestone = Number(match[2]);
    if (Math.floor(nsNumber / 100) !== expectedHundred || sliceMilestone !== expectedHundred) {
      errors.push(`STATUS.md: ${label} mainline mapping ${match[0]} does not belong to M${milestone}`);
    }
  }
  if (Number(next[1]) !== Number(last[1]) + 1) {
    errors.push(`STATUS.md: next mainline NS-${next[1]} must immediately follow NS-${last[1]}`);
  }
  if (activeTaskId?.startsWith("NS-")) {
    const activeMainline = status.match(/Active task:\s*`(NS-\d{3})\s*\/\s*M(\d+)(?:\.[^`]*)?`/u);
    if (!activeMainline) {
      errors.push("STATUS.md: an active NS task must declare its matching M slice; NS is mainline-only");
    } else if (activeMainline[1] !== `NS-${next[1]}` || Number(activeMainline[2]) !== expectedHundred) {
      errors.push(`STATUS.md: active mainline task ${activeMainline[1]} must match next mainline NS-${next[1]} in M${milestone}`);
    }
  }
  return errors;
}

export function checkCanonicalHierarchy(root, activeTaskId = getActiveTaskId(root)) {
  const errors = [];
  const required = [
    "AGENTS.md",
    "PROJECT.md",
    "STATUS.md",
    "docs/product/README.md",
    "docs/product/PRODUCT_SPEC.md",
    "docs/product/REQUIREMENTS_TRACEABILITY.md",
    "docs/product/USER_EXPERIENCE_SPEC.md",
    "docs/architecture/ARCHITECTURE.md",
    "docs/architecture/TARGET_ARCHITECTURE.md",
    "docs/architecture/DATA_MODEL.md",
  ];
  if (activeTaskId) {
    required.push(`docs/tasks/${activeTaskId}.md`, `docs/testing/${activeTaskId}_ACCEPTANCE.md`);
  }
  for (const file of required) {
    if (!existsSync(path.join(root, file))) {
      errors.push(`${file}: required hierarchy document is missing`);
      continue;
    }
    if (!read(root, file).includes(CANONICAL_HIERARCHY)) {
      errors.push(`${file}: missing canonical hierarchy ${CANONICAL_HIERARCHY}`);
    }
  }

  const mappedFiles = [
    "AGENTS.md",
    "PROJECT.md",
    "STATUS.md",
    "docs/architecture/ARCHITECTURE.md",
    "docs/architecture/TARGET_ARCHITECTURE.md",
    "docs/architecture/DATA_MODEL.md",
  ];
  const mappingPairs = [["Series", "series"], ["Volume", "book"], ["Chapter", "act"], ["Act", "chapter"], ["Scene", "scene"]];
  for (const file of mappedFiles) {
    const text = read(root, file);
    for (const [product, storage] of mappingPairs) {
      const pair = new RegExp(`\\b${product}\\b[^\\r\\n]{0,80}\\b${storage}\\b`, "u");
      if (!pair.test(text)) errors.push(`${file}: missing compatibility mapping ${product} → ${storage}`);
    }
  }

  const forbiddenProductChains = [
    /作品库\s*→\s*系列\s*→\s*单本\s*→\s*幕\s*→\s*章\s*→\s*场景/u,
    /Series\s*→\s*Book\s*→\s*Act\s*→\s*Chapter\s*→\s*Scene/u,
  ];
  for (const file of ["AGENTS.md", "PROJECT.md", "docs/product/README.md", "docs/product/PRODUCT_SPEC.md", "docs/product/USER_EXPERIENCE_SPEC.md"]) {
    const text = read(root, file);
    for (const pattern of forbiddenProductChains) {
      if (pattern.test(text)) errors.push(`${file}: contains forbidden author-facing hierarchy ${pattern}`);
    }
  }
  return errors;
}

export function checkAdrStatuses(root) {
  const errors = [];
  const directory = path.join(root, "docs", "adr");
  const files = readdirSync(directory).filter((name) => /^\d{4}-.+\.md$/u.test(name)).sort();
  const ids = new Set(files.map((name) => name.slice(0, 4)));

  for (const file of files) {
    const relative = `docs/adr/${file}`;
    const text = read(root, relative);
    const status = text.match(/^Status:\s*(.+)$/mu)?.[1]?.trim();
    if (!status || !/^(?:Accepted|Superseded by ADR-\d{4}(?: and ADR-\d{4})?(?: for .+)?)$/u.test(status)) {
      errors.push(`${relative}: invalid or missing ADR Status`);
      continue;
    }
    for (const match of status.matchAll(/ADR-(\d{4})/gu)) {
      if (!ids.has(match[1])) errors.push(`${relative}: superseding ADR-${match[1]} does not exist`);
    }
  }
  return errors;
}

export function checkEntryDocumentOwnership(root) {
  const errors = [];
  const limits = new Map([
    ["AGENTS.md", 190],
    ["README.md", 90],
    ["ROADMAP.md", 60],
    ["STATUS.md", 120],
    ["HANDOFF.md", 100],
    ["TASKS.md", 120],
    ["CHANGELOG.md", 120],
    ["docs/README.md", 100],
  ]);

  for (const [file, maximum] of limits) {
    const count = lineCount(read(root, file));
    if (count > maximum) errors.push(`${file}: ${count} lines exceeds ownership limit ${maximum}`);
  }

  const forbiddenByFile = new Map([
    ["README.md", [/## Current State/iu, /next slice/iu, /Active task:\s*`(?:NS|GOV)-/iu]],
    ["ROADMAP.md", [/## In Progress/iu, /## Next Gates/iu, /must be accepted before/iu]],
    ["CHANGELOG.md", [/Current Validation Snapshot/iu, /npm\.cmd run/iu, /passed \d+\/\d+/iu]],
    ["docs/README.md", [/## Current Warning/iu]],
  ]);
  for (const [file, patterns] of forbiddenByFile) {
    const text = read(root, file);
    for (const pattern of patterns) {
      if (pattern.test(text)) errors.push(`${file}: contains duplicated live-state pattern ${pattern}`);
    }
  }
  return errors;
}

export function checkKnownStaleClaims(root) {
  const errors = [];
  const rules = [
    ["docs/product/AI_EDITORIAL_SYSTEM.md", /写入 Markdown/u],
    ["docs/architecture/API.md", /写入 Markdown/u],
    ["docs/product/REQUIREMENTS_TRACEABILITY.md", /写入 Markdown/u],
    ["docs/architecture/ARCHITECTURE.md", /普通生命周期使用归档和恢复，不用删除表达/u],
    ["docs/architecture/DATA_MODEL.md", /M4 只保留 `Proposal` 契约/u],
    ["docs/adr/0012-scene-block-documents-and-codex-field-progression.md", /implementation active/iu],
  ];
  for (const [file, pattern] of rules) {
    if (pattern.test(read(root, file))) errors.push(`${file}: contains stale claim ${pattern}`);
  }
  return errors;
}

export function checkRepository(root) {
  const activeTaskId = getActiveTaskId(root);
  const checks = [
    checkMarkdownLinks(root),
    checkActiveTask(root),
    checkMainlineMapping(root),
    checkCanonicalHierarchy(root, activeTaskId),
    checkAdrStatuses(root),
    checkEntryDocumentOwnership(root),
    checkKnownStaleClaims(root),
    activeTaskId ? checkCurrentDocumentReferences(root, activeTaskId) : [],
  ];
  return checks.flat();
}

function main() {
  const currentFile = fileURLToPath(import.meta.url);
  const root = path.resolve(path.dirname(currentFile), "..");
  const errors = checkRepository(root);
  if (errors.length > 0) {
    console.error(`Documentation check failed with ${errors.length} issue(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Documentation check passed for ${collectMarkdownFiles(root).length} Markdown files.`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) main();
