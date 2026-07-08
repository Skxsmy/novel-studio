import type {
  CodexBuiltInCategoryId,
  CodexDetailTypeDocument,
  CodexEntryDocument,
  CreateCodexProgressionInput,
  CreateCodexEntryInput,
  DeleteCodexDocumentInput,
  UpdateCodexEntryInput,
  UpdateCodexProgressionInput,
  WorkshopCodexDraftDetailMapping,
  WorkshopCodexDraftMissingDetailType,
} from "@novel-studio/contracts";

type DraftField =
  | "operation"
  | "category"
  | "name"
  | "aliases"
  | "description"
  | "details"
  | "relations"
  | "progression"
  | "research"
  | "review"
  | "openQuestions"
  | "applicationStatus";

export interface WorkshopCodexDraftDetail {
  label: string;
  value: string;
}

export interface WorkshopCodexCreateDraft {
  aliases: string[];
  categoryId: CodexBuiltInCategoryId;
  description: string;
  details: WorkshopCodexDraftDetail[];
  name: string;
  research: string;
}

export interface CodexCreateEntryToolRequest {
  schemaVersion: 1;
  tool: "codex.create_entry";
  draft: WorkshopCodexCreateDraft;
}

export interface WorkshopCodexUpdateTarget {
  entryId?: string;
  name?: string;
}

export interface WorkshopCodexUpdatePatch {
  aliases?: string[];
  description?: string;
  details?: WorkshopCodexDraftDetail[];
  name?: string;
  progressions?: WorkshopCodexProgressionDraft[];
  research?: string;
}

export type WorkshopCodexProgressionDraft =
  | {
    action: "create";
    input: Partial<CreateCodexProgressionInput>;
  }
  | {
    action: "update";
    progressionId: string;
    input: Partial<UpdateCodexProgressionInput> & { baseRevision: string };
  }
  | {
    action: "delete";
    progressionId: string;
    input: DeleteCodexDocumentInput;
  };

export interface WorkshopCodexUpdateDraft {
  target: WorkshopCodexUpdateTarget;
  patch: WorkshopCodexUpdatePatch;
}

export interface CodexUpdateEntryToolRequest {
  schemaVersion: 1;
  tool: "codex.update_entry";
  draft: WorkshopCodexUpdateDraft;
}

export class WorkshopCodexDetailTypeCreationRequiredError extends Error {
  readonly code = "CODEX_DETAIL_TYPE_CREATION_REQUIRED";
  readonly missingDetailTypes: WorkshopCodexDraftMissingDetailType[];
  readonly availableDetailTypes: CodexDetailTypeDocument[];

  constructor(
    missingDetailTypes: WorkshopCodexDraftMissingDetailType[],
    availableDetailTypes: CodexDetailTypeDocument[],
  ) {
    super(
      `Codex Draft needs new detail types before writing: ${
        missingDetailTypes.map((detail) => detail.label).join(", ")
      }.`,
    );
    this.name = "WorkshopCodexDetailTypeCreationRequiredError";
    this.missingDetailTypes = missingDetailTypes;
    this.availableDetailTypes = availableDetailTypes;
  }
}

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/iu;

const FIELD_ALIASES: Record<string, DraftField> = {
  aliases: "aliases",
  applicationstatus: "applicationStatus",
  canondescription: "description",
  category: "category",
  details: "details",
  name: "name",
  openquestions: "openQuestions",
  operation: "operation",
  progressionnotes: "progression",
  "research/evidence": "research",
  researchevidence: "research",
  relations: "relations",
  reviewnotes: "review",
  target: "review",
  别名: "aliases",
  分类: "category",
  类别: "category",
  名称: "name",
  名字: "name",
  详情: "details",
  设定描述: "description",
  正典描述: "description",
  角色描述: "description",
};

const CATEGORY_ALIASES: Array<{ id: CodexBuiltInCategoryId; labels: string[] }> = [
  { id: "character", labels: ["character", "人物", "角色"] },
  { id: "location", labels: ["location", "地点", "场所", "地点条目"] },
  { id: "object", labels: ["object", "item", "material", "mineral", "物件", "物品", "道具", "材料", "矿物", "矿石", "魔法材料"] },
  { id: "lore", labels: ["lore", "world", "worldbuilding", "世界设定", "设定", "传说"] },
  { id: "organization", labels: ["organization", "组织", "机构"] },
  { id: "plot-thread", labels: ["plot-thread", "plot thread", "情节线", "线索"] },
];

function stripCodeFence(content: string): string {
  const fenced = content.match(/```(?:yaml|yml|text|markdown)?\s*([\s\S]*?)```/iu);
  return fenced ? fenced[1] ?? "" : content;
}

function normalizeFieldLabel(label: string): string {
  return label
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("und")
    .replace(/\s+/gu, "")
    .replace(/[._-]/gu, "");
}

function normalizeDetailLabel(label: string): string {
  return label
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("und")
    .replace(/[\s._\-:/\\|]+/gu, "");
}

function topLevelField(line: string): { field: DraftField; value: string } | null {
  const match = line.match(/^\s{0,4}([^:：]{1,80})[:：]\s*(.*)$/u);
  if (!match) return null;
  const field = FIELD_ALIASES[normalizeFieldLabel(match[1] ?? "")];
  if (!field) return null;
  return { field, value: match[2] ?? "" };
}

function appendSection(sections: Map<DraftField, string[]>, field: DraftField, value: string): void {
  const bucket = sections.get(field) ?? [];
  if (value.trim() !== ">") bucket.push(value);
  sections.set(field, bucket);
}

function parseSections(content: string): Map<DraftField, string[]> {
  const raw = stripCodeFence(content);
  const start = raw.search(/Codex Draft/iu);
  const draft = start >= 0 ? raw.slice(start) : raw;
  const sections = new Map<DraftField, string[]>();
  let current: DraftField | null = null;

  for (const line of draft.split(/\r?\n/u)) {
    if (/^\s*Codex Draft\s*$/iu.test(line)) continue;
    const field = topLevelField(line);
    if (field) {
      current = field.field;
      appendSection(sections, current, field.value);
      continue;
    }
    if (current) appendSection(sections, current, line);
  }
  return sections;
}

function sectionText(sections: Map<DraftField, string[]>, field: DraftField): string {
  return (sections.get(field) ?? [])
    .join("\n")
    .replace(/^\s*>\s*$/u, "")
    .split(/\r?\n/u)
    .map((line) => line.replace(/^\s{2,}/u, "").trimEnd())
    .join("\n")
    .trim();
}

function parseAliases(value: string): string[] {
  return value
    .split(/[,，、\n]/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function categoryIdFromDraft(value: string): CodexBuiltInCategoryId {
  const normalized = value
    .normalize("NFKC")
    .replace(/[()]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("und");
  for (const candidate of CATEGORY_ALIASES) {
    if (candidate.labels.some((label) => normalized.includes(label.toLocaleLowerCase("und")))) {
      return candidate.id;
    }
  }
  throw new Error(`Codex Draft category is not recognized: ${value || "(missing)"}.`);
}

function parseDetails(value: string): WorkshopCodexDraftDetail[] {
  const details: WorkshopCodexDraftDetail[] = [];
  let current: WorkshopCodexDraftDetail | null = null;
  for (const rawLine of value.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^(?:[-*]\s*)?([^:：]{1,80})[:：]\s*(.*)$/u);
    if (match) {
      if (current) details.push(current);
      const label = (match[1] ?? "").trim();
      current = label
        ? { label, value: (match[2] ?? "").trim() }
        : null;
      continue;
    }
    if (current) current.value = `${current.value}\n${line}`.trim();
  }
  if (current) details.push(current);
  return details;
}

function valuePreview(value: string): string {
  const normalized = value.replace(/\s+/gu, " ").trim();
  return normalized.length > 240 ? `${normalized.slice(0, 237)}...` : normalized;
}

function jsonBlock(content: string): string | null {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/iu);
  if (fenced?.[1]) return fenced[1];
  const objectStart = content.indexOf("{");
  const objectEnd = content.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) return content.slice(objectStart, objectEnd + 1);
  return null;
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") return parseAliases(value);
  return [];
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function researchFromJson(value: unknown): string {
  const text = stringValue(value);
  if (!text) return "Author requested this Codex creation in the Agent session.";
  if (/(?:无来源|无外部资料|无故事内部参考|纯推测|speculative|no source|no evidence)/iu.test(text)) {
    return "Author requested this Codex creation in the Agent session. External/source evidence was not supplied.";
  }
  return text;
}

function parseJsonDraft(content: string): WorkshopCodexCreateDraft | null {
  const block = jsonBlock(content);
  if (!block) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(block);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const root = parsed as Record<string, unknown>;
  const entry = (root.entry && typeof root.entry === "object" ? root.entry : root) as Record<string, unknown>;
  const name = stringValue(entry.name);
  const description = stringValue(entry.description ?? entry.canonDescription ?? entry["canon_description"]);
  const category = stringValue(entry.category ?? entry.categoryId ?? entry.type);
  if (!name || !description) return null;

  const details: WorkshopCodexDraftDetail[] = [];
  const rawDetails = entry.details;
  if (rawDetails && typeof rawDetails === "object" && !Array.isArray(rawDetails)) {
    for (const [label, value] of Object.entries(rawDetails)) {
      const detailValue = typeof value === "string" ? value.trim() : JSON.stringify(value);
      if (label.trim() && detailValue.trim()) details.push({ label: label.trim(), value: detailValue.trim() });
    }
  }

  return {
    aliases: stringArray(entry.aliases),
    categoryId: categoryIdFromDraft(category),
    description,
    details,
    name,
    research: researchFromJson(entry.evidence ?? entry.research ?? entry.source),
  };
}

export function renderWorkshopCodexCreateDraft(draft: WorkshopCodexCreateDraft): string {
  const lines = [
    "Codex Draft",
    "Operation: create",
    `Category: ${draft.categoryId}`,
    `Name: ${draft.name}`,
  ];
  if (draft.aliases.length) lines.push(`Aliases: ${draft.aliases.join(", ")}`);
  lines.push("Canon Description: >");
  lines.push(...draft.description.split(/\r?\n/u).map((line) => `  ${line}`));
  if (draft.details.length) {
    lines.push("Details:");
    for (const detail of draft.details) {
      lines.push(`  ${detail.label}: ${detail.value}`);
    }
  }
  if (draft.research.trim()) {
    lines.push("Research / Evidence:");
    lines.push(...draft.research.split(/\r?\n/u).map((line) => `  ${line}`));
  }
  return lines.join("\n");
}

export function serializeCodexCreateEntryToolRequest(draft: WorkshopCodexCreateDraft): string {
  return JSON.stringify({
    schemaVersion: 1,
    tool: "codex.create_entry",
    draft,
  } satisfies CodexCreateEntryToolRequest, null, 2);
}

export function renderWorkshopCodexUpdateDraft(draft: WorkshopCodexUpdateDraft): string {
  const lines = [
    "Codex Draft",
    "Operation: update",
    `Target: ${draft.target.entryId ?? draft.target.name ?? "(missing)"}`,
  ];
  if (draft.patch.name) lines.push(`Name: ${draft.patch.name}`);
  if (draft.patch.aliases) lines.push(`Aliases: ${draft.patch.aliases.join(", ")}`);
  if (draft.patch.description) {
    lines.push("Canon Description: >");
    lines.push(...draft.patch.description.split(/\r?\n/u).map((line) => `  ${line}`));
  }
  if (draft.patch.details?.length) {
    lines.push("Details:");
    for (const detail of draft.patch.details) {
      lines.push(`  ${detail.label}: ${detail.value}`);
    }
  }
  if (draft.patch.research?.trim()) {
    lines.push("Research / Evidence:");
    lines.push(...draft.patch.research.split(/\r?\n/u).map((line) => `  ${line}`));
  }
  return lines.join("\n");
}

export function serializeCodexUpdateEntryToolRequest(draft: WorkshopCodexUpdateDraft): string {
  return JSON.stringify({
    schemaVersion: 1,
    tool: "codex.update_entry",
    draft,
  } satisfies CodexUpdateEntryToolRequest, null, 2);
}

function parseStructuredCodexCreateEntryToolRequest(content: string): CodexCreateEntryToolRequest | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const request = parsed as Partial<CodexCreateEntryToolRequest>;
  if (request.schemaVersion !== 1 || request.tool !== "codex.create_entry") return null;
  const draft = request.draft;
  if (!draft || typeof draft !== "object") return null;
  if (
    !["character", "location", "object", "lore", "organization", "plot-thread"].includes(draft.categoryId) ||
    typeof draft.description !== "string" ||
    !Array.isArray(draft.details) ||
    typeof draft.name !== "string" ||
    typeof draft.research !== "string" ||
    !Array.isArray(draft.aliases)
  ) {
    return null;
  }
  return {
    schemaVersion: 1,
    tool: "codex.create_entry",
    draft: {
      aliases: draft.aliases.map((alias) => String(alias).trim()).filter(Boolean),
      categoryId: draft.categoryId,
      description: draft.description.trim(),
      details: draft.details
        .map((detail) => ({
          label: String((detail as Partial<WorkshopCodexDraftDetail>).label ?? "").trim(),
          value: String((detail as Partial<WorkshopCodexDraftDetail>).value ?? "").trim(),
        }))
        .filter((detail) => detail.label && detail.value),
      name: draft.name.trim(),
      research: draft.research.trim() || "Author requested this Codex creation in the Agent session.",
    },
  };
}

function optionalStringValue(value: unknown): string | undefined {
  const text = stringValue(value);
  return text ? text : undefined;
}

function parseProgressionDrafts(value: unknown): WorkshopCodexProgressionDraft[] {
  if (!Array.isArray(value)) return [];
  const drafts: WorkshopCodexProgressionDraft[] = [];
  for (const item of value) {
    const record = recordValue(item);
    if (!record) continue;
    const action = stringValue(record.action).toLocaleLowerCase("und");
    const rawInput = recordValue(record.input) ?? record;
    if (action === "create") {
      drafts.push({
        action: "create",
        input: { ...rawInput } as Partial<CreateCodexProgressionInput>,
      });
      continue;
    }
    const progressionId = optionalStringValue(record.progressionId);
    if (!progressionId) continue;
    if (action === "update") {
      const baseRevision = optionalStringValue(rawInput.baseRevision ?? record.baseRevision);
      if (!baseRevision) continue;
      drafts.push({
        action: "update",
        progressionId,
        input: {
          ...rawInput,
          baseRevision,
        } as Partial<UpdateCodexProgressionInput> & { baseRevision: string },
      });
      continue;
    }
    if (action === "delete") {
      const baseRevision = optionalStringValue(rawInput.baseRevision ?? record.baseRevision);
      if (!baseRevision) continue;
      drafts.push({
        action: "delete",
        progressionId,
        input: { baseRevision },
      });
    }
  }
  return drafts;
}

function parseStructuredCodexUpdateEntryToolRequest(content: string): CodexUpdateEntryToolRequest | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const request = parsed as Partial<CodexUpdateEntryToolRequest>;
  if (request.schemaVersion !== 1 || request.tool !== "codex.update_entry") return null;
  const draft = request.draft;
  if (!draft || typeof draft !== "object") return null;
  const target = (draft as Partial<WorkshopCodexUpdateDraft>).target;
  const patch = (draft as Partial<WorkshopCodexUpdateDraft>).patch;
  if (!target || typeof target !== "object" || !patch || typeof patch !== "object") return null;

  const entryId = optionalStringValue((target as Record<string, unknown>).entryId);
  const targetName = optionalStringValue((target as Record<string, unknown>).name);
  if (!entryId && !targetName) return null;

  const patchRecord = patch as Record<string, unknown>;
  const normalizedPatch: WorkshopCodexUpdatePatch = {};
  if (hasOwn(patchRecord, "name")) {
    const name = optionalStringValue(patchRecord.name);
    if (name) normalizedPatch.name = name;
  }
  if (hasOwn(patchRecord, "aliases")) {
    normalizedPatch.aliases = stringArray(patchRecord.aliases);
  }
  if (hasOwn(patchRecord, "description")) {
    const description = optionalStringValue(patchRecord.description);
    if (description) normalizedPatch.description = description;
  }
  if (hasOwn(patchRecord, "details")) {
    normalizedPatch.details = Array.isArray(patchRecord.details)
      ? patchRecord.details
        .map((detail) => ({
          label: String((detail as Partial<WorkshopCodexDraftDetail>).label ?? "").trim(),
          value: String((detail as Partial<WorkshopCodexDraftDetail>).value ?? "").trim(),
        }))
        .filter((detail) => detail.label && detail.value)
      : [];
  }
  if (hasOwn(patchRecord, "research")) {
    const research = optionalStringValue(patchRecord.research);
    if (research) normalizedPatch.research = research;
  }
  if (hasOwn(patchRecord, "progressions")) {
    normalizedPatch.progressions = parseProgressionDrafts(patchRecord.progressions);
  }
  const hasPatch = normalizedPatch.name !== undefined ||
    normalizedPatch.aliases !== undefined ||
    normalizedPatch.description !== undefined ||
    (normalizedPatch.details !== undefined && normalizedPatch.details.length > 0) ||
    (normalizedPatch.progressions !== undefined && normalizedPatch.progressions.length > 0) ||
    normalizedPatch.research !== undefined;
  if (!hasPatch) return null;

  return {
    schemaVersion: 1,
    tool: "codex.update_entry",
    draft: {
      target: {
        ...(entryId ? { entryId } : {}),
        ...(targetName ? { name: targetName } : {}),
      },
      patch: normalizedPatch,
    },
  };
}

export function parseCodexCreateEntryToolRequest(content: string): CodexCreateEntryToolRequest {
  const structured = parseStructuredCodexCreateEntryToolRequest(content);
  if (structured) return structured;
  throw new Error("codex.create_entry execution requires a structured tool request.");
}

export function parseCodexUpdateEntryToolRequest(content: string): CodexUpdateEntryToolRequest {
  const structured = parseStructuredCodexUpdateEntryToolRequest(content);
  if (structured) return structured;
  throw new Error("codex.update_entry execution requires a structured tool request.");
}

function detailTypeIdFromLabel(label: string): string | null {
  return label.match(UUID_PATTERN)?.[0] ?? null;
}

function mappingByLabel(mappings: WorkshopCodexDraftDetailMapping[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const mapping of mappings) {
    const normalized = normalizeDetailLabel(mapping.label);
    const previous = result.get(normalized);
    if (previous && previous !== mapping.detailTypeId) {
      throw new Error(`Detail mapping for "${mapping.label}" is duplicated with different targets.`);
    }
    result.set(normalized, mapping.detailTypeId);
  }
  return result;
}

function resolveDraftDetails(
  draftDetails: WorkshopCodexDraftDetail[],
  detailTypes: CodexDetailTypeDocument[],
  detailMappings: WorkshopCodexDraftDetailMapping[],
): { details: Record<string, string>; detailAiContext: Record<string, boolean> } {
  if (!draftDetails.length) return { details: {}, detailAiContext: {} };

  const detailTypesById = new Map(detailTypes.map((document) => [document.detailType.id, document]));
  const exactDetailTypesByName = new Map<string, CodexDetailTypeDocument[]>();
  for (const detailType of detailTypes) {
    const key = normalizeDetailLabel(detailType.detailType.name);
    exactDetailTypesByName.set(key, [...(exactDetailTypesByName.get(key) ?? []), detailType]);
  }
  const explicitMappings = mappingByLabel(detailMappings);

  const seenDraftLabels = new Map<string, string>();
  const missingDetailTypes: WorkshopCodexDraftMissingDetailType[] = [];
  const details: Record<string, string> = {};
  const detailAiContext: Record<string, boolean> = {};

  for (const draftDetail of draftDetails) {
    const normalizedLabel = normalizeDetailLabel(draftDetail.label);
    const previousLabel = seenDraftLabels.get(normalizedLabel);
    if (previousLabel) {
      throw new Error(
        `Codex Draft repeats detail "${draftDetail.label}" after "${previousLabel}". ` +
        "Use each reusable detail type once before applying.",
      );
    }
    seenDraftLabels.set(normalizedLabel, draftDetail.label);

    const explicitDetailTypeId = explicitMappings.get(normalizedLabel);
    const labelDetailTypeId = detailTypeIdFromLabel(draftDetail.label);
    const exactMatches = exactDetailTypesByName.get(normalizedLabel) ?? [];
    let resolvedDetailType: CodexDetailTypeDocument | null = null;

    if (explicitDetailTypeId) {
      const explicitDetailType = detailTypesById.get(explicitDetailTypeId);
      if (!explicitDetailType) {
        throw new Error(
          `Detail mapping for "${draftDetail.label}" references an unknown detail type.`,
        );
      }
      resolvedDetailType = explicitDetailType;
    } else if (labelDetailTypeId && detailTypesById.has(labelDetailTypeId)) {
      resolvedDetailType = detailTypesById.get(labelDetailTypeId) ?? null;
    } else if (exactMatches.length === 1) {
      resolvedDetailType = exactMatches[0]!;
    } else {
      missingDetailTypes.push({
        label: draftDetail.label,
        valuePreview: valuePreview(draftDetail.value),
      });
      continue;
    }

    if (!resolvedDetailType) {
      throw new Error(`Detail type for "${draftDetail.label}" could not be resolved.`);
    }
    const resolvedDetailTypeId = resolvedDetailType.detailType.id;
    const value = normalizeDetailLabel(draftDetail.label) === normalizeDetailLabel(resolvedDetailType.detailType.name)
      ? draftDetail.value
      : `${draftDetail.label}: ${draftDetail.value}`;
    details[resolvedDetailTypeId] = details[resolvedDetailTypeId]
      ? `${details[resolvedDetailTypeId]}\n${value}`
      : value;
    detailAiContext[resolvedDetailTypeId] = true;
  }

  if (missingDetailTypes.length) {
    throw new WorkshopCodexDetailTypeCreationRequiredError(missingDetailTypes, detailTypes);
  }

  return { details, detailAiContext };
}

export function parseWorkshopCodexCreateDraft(content: string): WorkshopCodexCreateDraft {
  const jsonDraft = parseJsonDraft(content);
  if (jsonDraft) return jsonDraft;

  const sections = parseSections(content);
  const operation = sectionText(sections, "operation").toLocaleLowerCase("und");
  if (operation && !operation.includes("create")) {
    throw new Error("Only Codex Draft operation=create can be applied as a new Codex entry.");
  }

  const name = sectionText(sections, "name");
  if (!name) {
    throw new Error("Codex Draft is missing Name.");
  }

  const researchParts = [
    sectionText(sections, "research"),
    sectionText(sections, "review"),
    sectionText(sections, "openQuestions"),
  ].filter(Boolean);

  return {
    aliases: parseAliases(sectionText(sections, "aliases")),
    categoryId: categoryIdFromDraft(sectionText(sections, "category")),
    description: sectionText(sections, "description"),
    details: parseDetails(sectionText(sections, "details")),
    name,
    research: researchParts.join("\n\n"),
  };
}

export function codexCreateEntryInputFromWorkshopDraft(
  draft: WorkshopCodexCreateDraft,
  detailTypes: CodexDetailTypeDocument[],
  detailMappings: WorkshopCodexDraftDetailMapping[] = [],
): CreateCodexEntryInput {
  const { details, detailAiContext } = resolveDraftDetails(
    draft.details,
    detailTypes.filter((document) => document.detailType.categoryId === draft.categoryId),
    detailMappings,
  );

  return {
    aiContextPolicy: "on-mention",
    aliases: draft.aliases,
    categoryId: draft.categoryId,
    description: draft.description,
    detailAiContext,
    details,
    mention: {
      automaticPlural: false,
      caseSensitive: false,
      excludedTerms: [],
      matchAliases: true,
    },
    name: draft.name,
    research: draft.research,
    thumbnail: null,
  };
}

function mergedResearch(current: string, update: string): string {
  const currentText = current.trim();
  const updateText = update.trim();
  if (!currentText) return updateText;
  if (!updateText || currentText.includes(updateText)) return currentText;
  return `${currentText}\n\n${updateText}`;
}

export function codexUpdateEntryInputFromWorkshopDraft(
  entry: CodexEntryDocument,
  draft: WorkshopCodexUpdateDraft,
  detailTypes: CodexDetailTypeDocument[],
  detailMappings: WorkshopCodexDraftDetailMapping[] = [],
): UpdateCodexEntryInput | null {
  const input: Partial<UpdateCodexEntryInput> = {};
  let changesEntry = false;

  if (draft.patch.name !== undefined) {
    input.name = draft.patch.name;
    changesEntry = true;
  }
  if (draft.patch.aliases !== undefined) {
    input.aliases = draft.patch.aliases;
    changesEntry = true;
  }
  if (draft.patch.description !== undefined) {
    input.description = draft.patch.description;
    changesEntry = true;
  }
  if (draft.patch.details?.length) {
    const { details, detailAiContext } = resolveDraftDetails(
      draft.patch.details,
      detailTypes.filter((document) => document.detailType.categoryId === entry.metadata.categoryId),
      detailMappings,
    );
    input.details = {
      ...entry.metadata.details,
      ...details,
    };
    input.detailAiContext = {
      ...entry.metadata.detailAiContext,
      ...detailAiContext,
    };
    changesEntry = true;
  }

  if (changesEntry) {
    input.baseRevision = entry.revision;
  }
  if (draft.patch.research !== undefined) {
    input.baseResearchRevision = entry.research.revision;
    input.research = mergedResearch(entry.research.content, draft.patch.research);
  }
  if (!changesEntry && input.research === undefined) {
    return null;
  }
  return input as UpdateCodexEntryInput;
}
