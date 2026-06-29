import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import YAML from "yaml";
import {
  ActManifestSchema,
  ArchiveCodexDocumentInputSchema,
  ArchiveSceneSectionInputSchema,
  BookManifestSchema,
  ChapterManifestSchema,
  CodexAiContextPolicySchema,
  CodexAmbiguousMentionSchema,
  CodexBuiltInCategoryIdSchema,
  CodexCategoryDocumentSchema,
  CodexCategoryIdSchema,
  CodexContextPreviewSchema,
  CodexCustomCategorySchema,
  DeleteCodexCategoryResultSchema,
  DeleteCodexDocumentInputSchema,
  DeleteCodexEntryResultSchema,
  DeleteCodexDetailTypeResultSchema,
  CodexEntryDocumentSchema,
  CodexDetailTypeDocumentSchema,
  CodexDetailTypeSchema,
  CodexEntryMetadataSchema,
  CodexEffectiveStateSchema,
  CodexKnowledgeDocumentSchema,
  CodexKnowledgeSchema,
  CodexMentionSchema,
  CodexProgressionDocumentSchema,
  CodexProgressionSchema,
  CodexRelationDocumentSchema,
  CodexRelationSchema,
  CodexResearchDocumentSchema,
  CodexResearchMetadataSchema,
  CodexSearchResultSchema,
  CreateBookInputSchema,
  CreateCodexCategoryInputSchema,
  CreateCodexDetailTypeInputSchema,
  CreateCodexEntryInputSchema,
  CreateCodexKnowledgeInputSchema,
  CreateCodexProgressionInputSchema,
  CreateCodexRelationInputSchema,
  CreateActInputSchema,
  CreateChapterInputSchema,
  CreateReviewAnchorInputSchema,
  CreateSceneInputSchema,
  CreateSceneSectionInputSchema,
  CreateSeriesInputSchema,
  CreateTimelineEventInputSchema,
  DefaultStructureTitles,
  DeleteTimelineEventInputSchema,
  MoveSceneInputSchema,
  PlanningBoardSchema,
  PlanningSceneSchema,
  ReorderInputSchema,
  RestoreSceneSectionInputSchema,
  type AgentRole,
  SceneBlockDocumentSchema,
  SceneDocumentSchema,
  SceneFrontmatterSchema,
  SceneSectionDocumentSchema,
  SceneSectionMetadataSchema,
  SceneCodexMentionsSchema,
  SectionContextTargetSchema,
  SeriesManifestSchema,
  ResolvedReviewAnchorSchema,
  ReviewAnchorSchema,
  TimelineEventDocumentSchema,
  TimelineEventSchema,
  TimelineManifestSchema,
  UpdateCodexCategoryInputSchema,
  UpdateCodexDetailTypeInputSchema,
  UpdateCodexEntryInputSchema,
  UpdateCodexKnowledgeInputSchema,
  UpdateCodexProgressionInputSchema,
  UpdateCodexRelationInputSchema,
  UpdateActInputSchema,
  UpdateBookInputSchema,
  UpdateChapterInputSchema,
  UpdateScenePlanningInputSchema,
  UpdateSceneInputSchema,
  UpdateSceneSectionInputSchema,
  UpdateSeriesCloudPolicyInputSchema,
  UpdateTimelineEventInputSchema,
  type ActManifest,
  type ArchiveCodexDocumentInput,
  type ArchiveSceneSectionInput,
  type BookManifest,
  type ChapterManifest,
  type CodexAiContextPolicy,
  type CodexAmbiguousMention,
  type CodexBuiltInCategoryId,
  type CodexCategoryDocument,
  type CodexCategoryId,
  type CodexContextExclusionReason,
  type CodexContextPreview,
  type CodexCustomCategory,
  type CodexDetailType,
  type CodexDetailTypeDocument,
  type CodexEntryDocument,
  type CodexEntryMetadata,
  type CodexEffectiveState,
  type CodexKnowledge,
  type CodexKnowledgeDocument,
  type CodexMention,
  type CodexProgression,
  type CodexProgressionDocument,
  type CodexRelation,
  type CodexRelationDocument,
  type CodexResearchDocument,
  type CodexResearchMetadata,
  type CodexSearchResult,
  type CreateBookInput,
  type CreateCodexCategoryInput,
  type CreateCodexDetailTypeInput,
  type CreateCodexEntryInput,
  type CreateCodexKnowledgeInput,
  type CreateCodexProgressionInput,
  type CreateCodexRelationInput,
  type CreateActInput,
  type CreateChapterInput,
  type DeleteCodexCategoryResult,
  type DeleteCodexDocumentInput,
  type DeleteCodexEntryResult,
  type DeleteCodexDetailTypeResult,
  type CreateReviewAnchorInput,
  type CreateSceneInput,
  type CreateSceneSectionInput,
  type CreateSeriesInput,
  type CreateTimelineEventInput,
  type DeleteTimelineEventInput,
  type HierarchyIssue,
  type HierarchyValidationResult,
  type MoveSceneInput,
  type ContextBundle,
  type ModelCallLog,
  type ModelProfile,
  type PlanningBoard,
  type PlanningAct,
  type PlanningBook,
  type PlanningChapter,
  type PlanningScene,
  type PromptPreset,
  type PromptTemplate,
  type ReorderInput,
  type RestoreSceneSectionInput,
  type SceneBlock,
  type SceneBlockDocument,
  type SceneDocument,
  type SceneCodexMentions,
  type SceneFrontmatter,
  type SceneSectionAiPolicy,
  type SceneSectionDocument,
  type SceneSectionMetadata,
  type SectionContextTarget,
  type ResolvedReviewAnchor,
  type ReviewAnchor,
  type ReviewAnchorResolution,
  type SearchResult,
  type SeriesDetail,
  type SeriesManifest,
  type SeriesSummary,
  type TimelineEvent,
  type TimelineEventDocument,
  type TimelineManifest,
  type UpdateActInput,
  type UpdateBookInput,
  type UpdateCodexCategoryInput,
  type UpdateCodexDetailTypeInput,
  type UpdateCodexEntryInput,
  type UpdateCodexKnowledgeInput,
  type UpdateCodexProgressionInput,
  type UpdateCodexRelationInput,
  type UpdateChapterInput,
  type UpdateScenePlanningInput,
  type UpdateSceneInput,
  type UpdateSceneSectionInput,
  type UpdateSeriesCloudPolicyInput,
  type UpdateTimelineEventInput,
} from "@novel-studio/contracts";
import { StorageError } from "./errors.js";
import { assertInside, atomicWrite, pathExists } from "./fileSystem.js";
import {
  applyFileTransaction,
  recoverFileTransactions,
  type FileMutation,
} from "./fileTransactions.js";
import {
  ensureAiIndexTables,
  getAgentRole,
  getContextBundle,
  getModelCallLog,
  getModelProfile,
  getPromptPreset,
  getPromptTemplate,
  listAgentRoles,
  listContextBundles,
  listModelCallLogs,
  listModelProfiles,
  listPromptPresets,
  listPromptTemplates,
  rebuildAiIndex,
  saveAgentRole,
  saveContextBundle,
  saveModelCallLog,
  saveModelProfile,
  savePromptPreset,
  savePromptTemplate,
} from "./aiFiles.js";
import {
  jsonAuthorityRevision,
  parseJsonAuthorityText,
  serializeJsonAuthority,
} from "./jsonAuthority.js";
export * from "./jsonAuthority.js";

export { StorageError } from "./errors.js";
export { pathExists } from "./fileSystem.js";

const FRONTMATTER_MARKER = "---";
const SCENE_JSON_EXTENSION = ".json";
const SERIES_FILE = "series.yaml";
const BOOK_FILE = "book.yaml";
const ACTS_DIR = "acts";
const CHAPTERS_DIR = "chapters";
const PLANNING_DIR = "planning";
const TIMELINE_FILE = "timeline.yaml";
const TIMELINE_EVENTS_DIR = "events";
const SECTIONS_DIR = "sections";
const REVIEW_DIR = "review";
const ANCHORS_DIR = "anchors";
const CODEX_DIR = "codex";
const CODEX_CATEGORIES_DIR = "categories";
const CODEX_DETAIL_TYPES_DIR = "detail-types";
const CODEX_CUSTOM_DIR = "custom";
const CODEX_RESEARCH_DIR = "entry-research";
const CODEX_RELATIONS_DIR = "relations";
const CODEX_PROGRESSIONS_DIR = "progressions";
const CODEX_KNOWLEDGE_DIR = "knowledge";

const BUILT_IN_CODEX_CATEGORIES: ReadonlyArray<{
  id: CodexBuiltInCategoryId;
  name: string;
  icon: string;
  directory: string;
}> = [
  { id: "uncategorized", name: "Uncategorized", icon: "U", directory: "uncategorized" },
  { id: "character", name: "人物", icon: "人", directory: "characters" },
  { id: "location", name: "地点", icon: "地", directory: "locations" },
  { id: "object", name: "物件", icon: "物", directory: "objects" },
  { id: "lore", name: "世界设定", icon: "界", directory: "lore" },
  { id: "organization", name: "组织", icon: "组", directory: "organizations" },
  { id: "plot-thread", name: "情节线", icon: "线", directory: "plot-threads" },
];

function toChineseOrdinal(value: number): string {
  const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  if (value <= 0) return String(value);
  if (value < 10) return digits[value] ?? String(value);
  if (value < 20) return `十${value === 10 ? "" : digits[value - 10]}`;
  const tens = Math.floor(value / 10);
  const ones = value % 10;
  return `${digits[tens]}十${ones === 0 ? "" : digits[ones]}`;
}

export function contentRevision(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function countChineseCharacters(value: string): number {
  return Array.from(value.replace(/\s/g, "")).length;
}

export function countParagraphs(value: string): number {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\n\s*\n/u).length : 0;
}

function safeSegment(value: string, fallback: string): string {
  const cleaned = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/gu, "-")
    .replace(/\s+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/[. -]+$/gu, "")
    .slice(0, 64);
  return cleaned || fallback;
}

function assertExactPermutation(
  existingIds: string[],
  orderedIds: string[],
  entityLabel: string,
): void {
  const existing = new Set(existingIds);
  const ordered = new Set(orderedIds);
  const missingIds = existingIds.filter((id) => !ordered.has(id));
  const unknownIds = orderedIds.filter((id) => !existing.has(id));
  const duplicateIds = orderedIds.filter((id, index) => orderedIds.indexOf(id) !== index);
  if (
    existingIds.length !== orderedIds.length ||
    ordered.size !== orderedIds.length ||
    missingIds.length > 0 ||
    unknownIds.length > 0
  ) {
    throw new StorageError(`${entityLabel} reorder must contain each existing ID exactly once`, "INVALID_DATA", {
      missingIds,
      unknownIds,
      duplicateIds: [...new Set(duplicateIds)],
    });
  }
}

function serializeYaml(value: unknown): string {
  return YAML.stringify(value, { lineWidth: 0 });
}

const SceneJsonAuthoritySchema = SceneFrontmatterSchema.extend({
  document: SceneBlockDocumentSchema,
});

type SceneJsonAuthority = SceneFrontmatter & { document: SceneBlockDocument };

function normalizeMarkdownContent(content: string): string {
  return content.replace(/\r\n/gu, "\n").replace(/^\n+/u, "");
}

function isSceneBreakMarkdown(segment: string): boolean {
  const compact = segment.trim();
  return (
    /^(?:\*\s*){3,}$/u.test(compact) ||
    /^(?:-\s*){3,}$/u.test(compact) ||
    /^(?:_\s*){3,}$/u.test(compact)
  );
}

function markdownSegmentToSceneBlock(segment: string): SceneBlock {
  const normalized = segment.replace(/\r\n/gu, "\n");
  const trimmed = normalized.trim();
  const heading = /^(#{1,6})\s+(.+)$/u.exec(trimmed);
  if (heading && !heading[2]!.includes("\n")) {
    return {
      id: randomUUID(),
      kind: "heading",
      level: heading[1]!.length,
      text: heading[2]!,
    };
  }

  const lines = normalized.split("\n");
  if (lines.length > 0 && lines.every((line) => /^>\s?/u.test(line) || line.trim() === "")) {
    return {
      id: randomUUID(),
      kind: "quote",
      text: lines.map((line) => line.replace(/^>\s?/u, "")).join("\n").trim(),
    };
  }

  if (isSceneBreakMarkdown(trimmed)) {
    return {
      id: randomUUID(),
      kind: "sceneBreak",
    };
  }

  return {
    id: randomUUID(),
    kind: "paragraph",
    text: normalized.trim(),
  };
}

function markdownToSceneBlockDocument(content: string): SceneBlockDocument {
  const normalized = normalizeMarkdownContent(content).replace(/\n+$/u, "");
  if (!normalized.trim()) {
    return SceneBlockDocumentSchema.parse({ schemaVersion: 1, blocks: [] });
  }
  const blocks = normalized
    .split(/\n\s*\n/u)
    .filter((segment) => segment.trim().length > 0)
    .map((segment) => markdownSegmentToSceneBlock(segment));
  return SceneBlockDocumentSchema.parse({ schemaVersion: 1, blocks });
}

function sceneBlockToMarkdown(block: SceneBlock): string {
  switch (block.kind) {
    case "paragraph":
      return block.text;
    case "heading":
      return `${"#".repeat(block.level)} ${block.text}`;
    case "quote":
      return block.text
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    case "sceneBreak":
      return "***";
    case "codexProgression":
      return "";
  }
}

function sceneBlockDocumentToMarkdown(document: SceneBlockDocument): string {
  return document.blocks
    .map((block) => sceneBlockToMarkdown(block))
    .filter((segment) => segment.trim().length > 0)
    .join("\n\n");
}

function sceneBlockToPlainText(block: SceneBlock): string {
  switch (block.kind) {
    case "paragraph":
    case "heading":
    case "quote":
      return block.text;
    case "sceneBreak":
    case "codexProgression":
      return "";
  }
}

function sceneBlockDocumentToPlainText(document: SceneBlockDocument): string {
  return document.blocks
    .map((block) => sceneBlockToPlainText(block))
    .filter((segment) => segment.trim().length > 0)
    .join("\n\n");
}

function serializeSceneDocument(metadata: SceneFrontmatter, document: SceneBlockDocument): string {
  const authority = SceneJsonAuthoritySchema.parse({ ...metadata, document });
  return serializeJsonAuthority(authority);
}

function sceneDocumentFromAuthority(
  authority: SceneJsonAuthority,
  revision: string,
  relativePath: string,
): SceneDocument {
  const metadata = SceneFrontmatterSchema.parse(authority);
  const document = SceneBlockDocumentSchema.parse(authority.document);
  const content = sceneBlockDocumentToMarkdown(document);
  const plainText = sceneBlockDocumentToPlainText(document);
  return SceneDocumentSchema.parse({
    metadata,
    document,
    plainText,
    content,
    revision,
    relativePath: relativePath.replace(/\\/gu, "/"),
    characterCount: countChineseCharacters(plainText),
    paragraphCount: countParagraphs(plainText),
  });
}

function parseSceneJsonText(value: string, relativePath: string): SceneDocument {
  const normalized = value.replace(/\r\n/gu, "\n");
  const authority = parseJsonAuthorityText(
    normalized,
    (input) => SceneJsonAuthoritySchema.parse(input),
    "Scene JSON authority file",
  );
  return sceneDocumentFromAuthority(authority, jsonAuthorityRevision(normalized), relativePath);
}

function serializeScene(metadata: SceneFrontmatter, content: string): string {
  return serializeSceneDocument(metadata, markdownToSceneBlockDocument(content));
}

function parseSceneText(value: string, relativePath: string): SceneDocument {
  return parseSceneJsonText(value, relativePath);
}

function serializeSceneSection(metadata: SceneSectionMetadata, content: string): string {
  const normalizedContent = content.replace(/\r\n/gu, "\n").replace(/^\n+/u, "");
  return `${FRONTMATTER_MARKER}\n${serializeYaml(metadata)}${FRONTMATTER_MARKER}\n\n${normalizedContent}`;
}

function parseSceneSectionText(value: string, relativePath: string): SceneSectionDocument {
  const normalized = value.replace(/\r\n/gu, "\n");
  if (!normalized.startsWith(`${FRONTMATTER_MARKER}\n`)) {
    throw new StorageError("Section file is missing YAML frontmatter", "INVALID_DATA", { relativePath });
  }
  const end = normalized.indexOf(`\n${FRONTMATTER_MARKER}\n`, 4);
  if (end < 0) {
    throw new StorageError("Section frontmatter is not closed", "INVALID_DATA", { relativePath });
  }
  const metadata = SceneSectionMetadataSchema.parse(YAML.parse(normalized.slice(4, end)));
  const content = normalized.slice(end + 5).replace(/^\n/u, "");
  return SceneSectionDocumentSchema.parse({
    metadata,
    content,
    revision: contentRevision(normalized),
    relativePath: relativePath.replace(/\\/gu, "/"),
    characterCount: countChineseCharacters(content),
  });
}

function serializeMarkdownDocument(metadata: unknown, content: string): string {
  const normalizedContent = content.replace(/\r\n/gu, "\n").replace(/^\n+/u, "");
  return `${FRONTMATTER_MARKER}\n${serializeYaml(metadata)}${FRONTMATTER_MARKER}\n\n${normalizedContent}`;
}

function splitMarkdownDocument(
  value: string,
  relativePath: string,
  label: string,
): { normalized: string; metadata: unknown; content: string } {
  const normalized = value.replace(/\r\n/gu, "\n");
  if (!normalized.startsWith(`${FRONTMATTER_MARKER}\n`)) {
    throw new StorageError(`${label}缺少 YAML frontmatter`, "INVALID_DATA", { relativePath });
  }
  const end = normalized.indexOf(`\n${FRONTMATTER_MARKER}\n`, 4);
  if (end < 0) {
    throw new StorageError(`${label} frontmatter 未闭合`, "INVALID_DATA", { relativePath });
  }
  return {
    normalized,
    metadata: YAML.parse(normalized.slice(4, end)),
    content: normalized.slice(end + 5).replace(/^\n/u, ""),
  };
}

function parseCodexResearchText(value: string, relativePath: string): CodexResearchDocument {
  const parsed = splitMarkdownDocument(value, relativePath, "Codex Research 文件");
  return CodexResearchDocumentSchema.parse({
    metadata: CodexResearchMetadataSchema.parse(parsed.metadata),
    content: parsed.content,
    revision: contentRevision(parsed.normalized),
    relativePath: relativePath.replace(/\\/gu, "/"),
  });
}

function parseCodexEntryText(
  value: string,
  relativePath: string,
  research: CodexResearchDocument,
): CodexEntryDocument {
  const parsed = splitMarkdownDocument(value, relativePath, "Codex 条目文件");
  return CodexEntryDocumentSchema.parse({
    metadata: CodexEntryMetadataSchema.parse(parsed.metadata),
    description: parsed.content,
    revision: contentRevision(parsed.normalized),
    relativePath: relativePath.replace(/\\/gu, "/"),
    research,
  });
}

function normalizeUniqueStrings(values: string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const value of values.map((item) => item.trim()).filter(Boolean)) {
    const key = value.toLocaleLowerCase("und");
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(value);
  }
  return normalized;
}

function pluralVariants(term: string): string[] {
  if (!/^[A-Za-z][A-Za-z'-]*$/u.test(term)) return [];
  if (/[^aeiou]y$/iu.test(term)) return [`${term.slice(0, -1)}ies`];
  if (/(?:s|x|z|ch|sh)$/iu.test(term)) return [`${term}es`];
  return [`${term}s`];
}

function regexStarts(content: string, term: string, caseSensitive: boolean): number[] {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const regex = new RegExp(escaped, caseSensitive ? "gu" : "giu");
  const starts: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    starts.push(match.index);
    regex.lastIndex = match.index + Math.max(match[0].length, 1);
  }
  return starts;
}

function rangeInside(
  range: { start: number; end: number },
  blockers: Array<{ start: number; end: number }>,
): boolean {
  return blockers.some((blocker) => range.start >= blocker.start && range.end <= blocker.end);
}

export function findCodexMentionsInContent(
  sceneId: string,
  content: string,
  entries: CodexEntryDocument[],
): SceneCodexMentions {
  const hits: Array<CodexMention> = [];
  for (const entry of entries.filter((item) => item.metadata.archivedAt === null)) {
    const { mention } = entry.metadata;
    const excludedTerms = normalizeUniqueStrings(mention.excludedTerms);
    const blockers = excludedTerms.flatMap((term) =>
      regexStarts(content, term, mention.caseSensitive).map((start) => ({
        start,
        end: start + term.length,
      })),
    );
    const baseTerms = [
      { term: entry.metadata.name, isAlias: false },
      ...(mention.matchAliases
        ? entry.metadata.aliases.map((term) => ({ term, isAlias: true }))
        : []),
    ];
    const excludedKeys = new Set(
      excludedTerms.map((term) =>
        mention.caseSensitive ? term : term.toLocaleLowerCase("und"),
      ),
    );
    const candidates = baseTerms.flatMap((candidate) => {
      const values = [
        candidate.term,
        ...(mention.automaticPlural ? pluralVariants(candidate.term) : []),
      ];
      return values.map((term) => ({ ...candidate, term }));
    });
    const seen = new Set<string>();
    for (const candidate of candidates) {
      const term = candidate.term.trim();
      if (!term) continue;
      const normalized = mention.caseSensitive ? term : term.toLocaleLowerCase("und");
      if (excludedKeys.has(normalized)) continue;
      const candidateKey = `${normalized}:${candidate.isAlias ? "alias" : "name"}`;
      if (seen.has(candidateKey)) continue;
      seen.add(candidateKey);
      for (const start of regexStarts(content, term, mention.caseSensitive)) {
        const end = start + term.length;
        if (rangeInside({ start, end }, blockers)) continue;
        hits.push(
          CodexMentionSchema.parse({
            sceneId,
            entryId: entry.metadata.id,
            start,
            end,
            matchedText: content.slice(start, end),
            term,
            isAlias: candidate.isAlias,
          }),
        );
      }
    }
  }

  const longestAtStart = new Map<number, number>();
  for (const hit of hits) {
    longestAtStart.set(hit.start, Math.max(longestAtStart.get(hit.start) ?? 0, hit.end - hit.start));
  }
  const longestHits = hits.filter(
    (hit) => hit.end - hit.start === longestAtStart.get(hit.start),
  );
  const groups = new Map<string, CodexMention[]>();
  for (const hit of longestHits) {
    const key = `${hit.start}:${hit.end}`;
    const group = groups.get(key) ?? [];
    if (!group.some((item) => item.entryId === hit.entryId)) group.push(hit);
    groups.set(key, group);
  }

  const mentions: CodexMention[] = [];
  const ambiguities: CodexAmbiguousMention[] = [];
  let occupiedUntil = -1;
  for (const group of [...groups.values()].sort(
    (left, right) =>
      left[0]!.start - right[0]!.start ||
      (right[0]!.end - right[0]!.start) - (left[0]!.end - left[0]!.start),
  )) {
    const first = group[0]!;
    if (first.start < occupiedUntil) continue;
    occupiedUntil = first.end;
    if (group.length > 1) {
      ambiguities.push(
        CodexAmbiguousMentionSchema.parse({
          sceneId,
          start: first.start,
          end: first.end,
          matchedText: first.matchedText,
          candidateEntryIds: group.map((item) => item.entryId).sort(),
        }),
      );
    } else {
      mentions.push(first);
    }
  }
  return SceneCodexMentionsSchema.parse({ sceneId, mentions, ambiguities });
}

export function codexContextEligibility(
  policy: CodexAiContextPolicy | string,
  input: { mentioned: boolean; pinned: boolean; archived: boolean },
): { eligible: boolean; reason?: CodexContextExclusionReason } {
  if (input.archived) return { eligible: false, reason: "archived" };
  const parsed = CodexAiContextPolicySchema.safeParse(policy);
  if (!parsed.success || parsed.data === "never") {
    return { eligible: false, reason: "never" };
  }
  if (parsed.data === "always") return { eligible: true };
  if (parsed.data === "on-mention") {
    return input.mentioned || input.pinned
      ? { eligible: true }
      : { eligible: false, reason: "not-mentioned" };
  }
  return input.pinned
    ? { eligible: true }
    : { eligible: false, reason: "manual-only" };
}

export function isSceneSectionEligibleForContext(
  policy: SceneSectionAiPolicy,
  target: SectionContextTarget,
): boolean {
  const parsedPolicy = SceneSectionMetadataSchema.shape.aiPolicy.safeParse(policy);
  const parsedTarget = SectionContextTargetSchema.safeParse(target);
  if (!parsedPolicy.success || !parsedTarget.success) return false;
  if (parsedPolicy.data === "never") return false;
  return parsedTarget.data === "local" || parsedPolicy.data === "inherit";
}

function narrativeIndexForScene(
  sceneIndexes: Map<string, number>,
  sceneId: string,
): number {
  const index = sceneIndexes.get(sceneId);
  if (!index) {
    throw new StorageError("Record references an unknown scene", "INVALID_DATA", { sceneId });
  }
  return index;
}

function isActiveForNarrativePosition(
  fromSceneId: string,
  toSceneId: string | null,
  targetIndex: number,
  sceneIndexes: Map<string, number>,
): boolean {
  const fromIndex = narrativeIndexForScene(sceneIndexes, fromSceneId);
  const toIndex = toSceneId ? narrativeIndexForScene(sceneIndexes, toSceneId) : null;
  return fromIndex <= targetIndex && (toIndex === null || targetIndex <= toIndex);
}

function progressionGroupKey(progression: CodexProgression): string {
  const targetId =
    progression.target.kind === "entry"
      ? progression.target.entryId
      : progression.target.relationId;
  return `${progression.target.kind}:${targetId}:${progression.fieldKey}`;
}

function compareProgressionsAtNarrativePosition(
  sceneIndexes: Map<string, number>,
  left: CodexProgressionDocument,
  right: CodexProgressionDocument,
): number {
  return (
    narrativeIndexForScene(sceneIndexes, left.progression.effectiveFromSceneId) -
      narrativeIndexForScene(sceneIndexes, right.progression.effectiveFromSceneId) ||
    left.progression.createdAt.localeCompare(right.progression.createdAt)
  );
}

export function effectiveProgressionsForScene(
  progressions: CodexProgressionDocument[],
  targetIndex: number,
  sceneIndexes: Map<string, number>,
): CodexProgressionDocument[] {
  const active = progressions
    .filter((document) => document.progression.archivedAt === null)
    .filter((document) =>
      isActiveForNarrativePosition(
        document.progression.effectiveFromSceneId,
        document.progression.effectiveToSceneId,
        targetIndex,
        sceneIndexes,
      ),
    )
    .sort((left, right) =>
      compareProgressionsAtNarrativePosition(sceneIndexes, left, right),
    );
  const byGroup = new Map<string, CodexProgressionDocument[]>();
  for (const document of active) {
    const key = progressionGroupKey(document.progression);
    byGroup.set(key, [...(byGroup.get(key) ?? []), document]);
  }

  const effective: CodexProgressionDocument[] = [];
  for (const documents of byGroup.values()) {
    const latestReplacement = [...documents]
      .filter((document) => document.progression.changeKind === "replacement")
      .sort((left, right) =>
        compareProgressionsAtNarrativePosition(sceneIndexes, right, left),
      )[0];
    if (!latestReplacement) {
      effective.push(...documents);
      continue;
    }
    effective.push(latestReplacement);
    const replacementIndex = narrativeIndexForScene(
      sceneIndexes,
      latestReplacement.progression.effectiveFromSceneId,
    );
    for (const document of documents) {
      if (document.progression.changeKind !== "addition") continue;
      const documentIndex = narrativeIndexForScene(
        sceneIndexes,
        document.progression.effectiveFromSceneId,
      );
      if (
        documentIndex > replacementIndex ||
        (documentIndex === replacementIndex &&
          document.progression.createdAt > latestReplacement.progression.createdAt)
      ) {
        effective.push(document);
      }
    }
  }
  return effective.sort((left, right) =>
    compareProgressionsAtNarrativePosition(sceneIndexes, left, right),
  );
}

function allExactQuoteStarts(content: string, quote: string): number[] {
  const starts: number[] = [];
  let offset = 0;
  while (offset <= content.length - quote.length) {
    const found = content.indexOf(quote, offset);
    if (found < 0) break;
    starts.push(found);
    offset = found + Math.max(quote.length, 1);
  }
  return starts;
}

function contextScore(content: string, anchor: ReviewAnchor, start: number): number {
  let score = 0;
  if (anchor.prefix) {
    const actualPrefix = content.slice(Math.max(0, start - anchor.prefix.length), start);
    if (actualPrefix === anchor.prefix) score += 2;
  }
  if (anchor.suffix) {
    const quoteEnd = start + anchor.exactQuote.length;
    const actualSuffix = content.slice(quoteEnd, quoteEnd + anchor.suffix.length);
    if (actualSuffix === anchor.suffix) score += 2;
  }
  return score;
}

export function resolveReviewAnchor(
  anchor: ReviewAnchor,
  content: string,
): ReviewAnchorResolution {
  if (content.slice(anchor.start, anchor.end) === anchor.exactQuote) {
    return {
      status: "attached",
      start: anchor.start,
      end: anchor.end,
      reason: "原字符范围仍与引用文本一致",
    };
  }
  const starts = allExactQuoteStarts(content, anchor.exactQuote);
  if (starts.length === 1) {
    return {
      status: "relocated",
      start: starts[0]!,
      end: starts[0]! + anchor.exactQuote.length,
      reason: "正文中存在唯一精确引用",
    };
  }
  if (starts.length > 1) {
    const scored = starts
      .map((start) => ({ start, score: contextScore(content, anchor, start) }))
      .sort((left, right) => right.score - left.score || Math.abs(left.start - anchor.start) - Math.abs(right.start - anchor.start));
    const best = scored[0]!;
    const runnerUp = scored[1];
    if (best.score > 0 && (!runnerUp || best.score > runnerUp.score)) {
      return {
        status: "relocated",
        start: best.start,
        end: best.start + anchor.exactQuote.length,
        reason: "前后文唯一消除了重复引用歧义",
      };
    }
    return {
      status: "orphaned",
      start: null,
      end: null,
      reason: "正文中有多个无法唯一消歧的精确引用",
    };
  }
  return {
    status: "orphaned",
    start: null,
    end: null,
    reason: "引用文本已不存在",
  };
}

async function readYaml<T>(filePath: string, parse: (input: unknown) => T): Promise<T> {
  try {
    return parse(YAML.parse(await readFile(filePath, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new StorageError("文件不存在", "NOT_FOUND", { filePath });
    }
    if (error instanceof StorageError) throw error;
    throw new StorageError("YAML 数据无效", "INVALID_DATA", {
      filePath,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

function actPath(bookRoot: string, actId: string): string {
  return path.join(bookRoot, ACTS_DIR, `${actId}.yaml`);
}

function chapterPath(bookRoot: string, chapterId: string): string {
  return path.join(bookRoot, CHAPTERS_DIR, `${chapterId}.yaml`);
}

function timelineManifestPath(seriesRoot: string): string {
  return path.join(seriesRoot, PLANNING_DIR, TIMELINE_FILE);
}

function timelineEventPath(seriesRoot: string, eventId: string): string {
  return path.join(seriesRoot, PLANNING_DIR, TIMELINE_EVENTS_DIR, `${eventId}.yaml`);
}

function sectionPath(seriesRoot: string, sceneId: string, sectionId: string): string {
  return path.join(seriesRoot, SECTIONS_DIR, sceneId, `${sectionId}.md`);
}

function reviewAnchorPath(seriesRoot: string, anchorId: string): string {
  return path.join(seriesRoot, REVIEW_DIR, ANCHORS_DIR, `${anchorId}.yaml`);
}

function codexCategoryPath(seriesRoot: string, categoryId: string): string {
  return path.join(seriesRoot, CODEX_DIR, CODEX_CATEGORIES_DIR, `${categoryId}.yaml`);
}

function codexDetailTypePath(seriesRoot: string, detailTypeId: string): string {
  return path.join(seriesRoot, CODEX_DIR, CODEX_DETAIL_TYPES_DIR, `${detailTypeId}.yaml`);
}

function builtInCodexDirectory(categoryId: CodexCategoryId): string | null {
  return BUILT_IN_CODEX_CATEGORIES.find((category) => category.id === categoryId)?.directory ?? null;
}

function codexEntryPath(
  seriesRoot: string,
  categoryId: CodexCategoryId,
  entryId: string,
): string {
  const builtInDirectory = builtInCodexDirectory(categoryId);
  return builtInDirectory
    ? path.join(seriesRoot, CODEX_DIR, builtInDirectory, `${entryId}.md`)
    : path.join(seriesRoot, CODEX_DIR, CODEX_CUSTOM_DIR, categoryId, `${entryId}.md`);
}

function codexResearchPath(seriesRoot: string, entryId: string): string {
  return path.join(seriesRoot, CODEX_DIR, CODEX_RESEARCH_DIR, `${entryId}.md`);
}

function codexRelationPath(seriesRoot: string, relationId: string): string {
  return path.join(seriesRoot, CODEX_DIR, CODEX_RELATIONS_DIR, `${relationId}.yaml`);
}

function codexProgressionPath(seriesRoot: string, progressionId: string): string {
  return path.join(seriesRoot, CODEX_DIR, CODEX_PROGRESSIONS_DIR, `${progressionId}.yaml`);
}

function codexKnowledgePath(seriesRoot: string, knowledgeId: string): string {
  return path.join(seriesRoot, CODEX_DIR, CODEX_KNOWLEDGE_DIR, `${knowledgeId}.yaml`);
}

async function readActManifest(bookRoot: string, actId: string): Promise<ActManifest> {
  return readYaml(actPath(bookRoot, actId), (value) => ActManifestSchema.parse(value));
}

async function readChapterManifest(bookRoot: string, chapterId: string): Promise<ChapterManifest> {
  return readYaml(chapterPath(bookRoot, chapterId), (value) => ChapterManifestSchema.parse(value));
}

async function writeActManifest(bookRoot: string, manifest: ActManifest): Promise<void> {
  await atomicWrite(actPath(bookRoot, manifest.id), serializeYaml(manifest));
}

async function writeChapterManifest(bookRoot: string, manifest: ChapterManifest): Promise<void> {
  await atomicWrite(chapterPath(bookRoot, manifest.id), serializeYaml(manifest));
}

async function walkSceneFiles(directory: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walkSceneFiles(fullPath)));
    else if (entry.isFile() && entry.name.endsWith(SCENE_JSON_EXTENSION)) files.push(fullPath);
  }
  return files;
}

interface ChapterContext {
  book: BookManifest;
  bookRoot: string;
  act: ActManifest;
  chapter: ChapterManifest;
}

interface BookContext {
  manifest: SeriesManifest;
  book: BookManifest;
  bookRoot: string;
}

interface ActContext {
  book: BookManifest;
  bookRoot: string;
  act: ActManifest;
}

interface SceneContext extends ChapterContext {
  scene: SceneDocument;
  scenePath: string;
}

export class ProjectRepository {
  readonly libraryRoot: string;

  constructor(libraryRoot: string) {
    this.libraryRoot = path.resolve(libraryRoot);
  }

  async initialize(): Promise<void> {
    await mkdir(this.libraryRoot, { recursive: true });
  }

  async createSeries(rawInput: CreateSeriesInput): Promise<SeriesDetail> {
    await this.initialize();
    const input = CreateSeriesInputSchema.parse(rawInput);
    const now = new Date().toISOString();
    const seriesId = randomUUID();
    const bookId = randomUUID();
    const actId = randomUUID();
    const chapterId = randomUUID();
    const seriesDirectory = `${safeSegment(input.title, "series")}-${seriesId.slice(0, 8)}`;
    const seriesRoot = assertInside(this.libraryRoot, path.join(this.libraryRoot, seriesDirectory));
    const bookRoot = path.join(seriesRoot, "books", bookId);
    const sceneDirectory = path.join(bookRoot, "manuscript", actId, chapterId);

    const manifest: SeriesManifest = SeriesManifestSchema.parse({
      schemaVersion: 1,
      id: seriesId,
      title: input.title,
      description: input.description,
      language: "zh-CN",
      cloudPolicy: "local-only",
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      bookIds: [bookId],
    });
    const book: BookManifest = BookManifestSchema.parse({
      schemaVersion: 1,
      id: bookId,
      seriesId,
      title: input.firstBookTitle,
      order: 1,
      targetCharacters: 0,
      actIds: [actId],
      createdAt: now,
      updatedAt: now,
    });
    const act: ActManifest = ActManifestSchema.parse({
      schemaVersion: 1,
      id: actId,
      bookId,
      title: DefaultStructureTitles.chapter,
      order: 1,
      chapterIds: [chapterId],
      createdAt: now,
      updatedAt: now,
    });
    const chapter: ChapterManifest = ChapterManifestSchema.parse({
      schemaVersion: 1,
      id: chapterId,
      actId,
      title: DefaultStructureTitles.act,
      order: 1,
      sceneIds: [],
      createdAt: now,
      updatedAt: now,
    });
    const timeline: TimelineManifest = TimelineManifestSchema.parse({
      schemaVersion: 1,
      eventIds: [],
      updatedAt: now,
    });

    await mkdir(sceneDirectory, { recursive: true });
    const requiredDirectories = [
      "codex/characters",
      "codex/locations",
      "codex/objects",
      "codex/lore",
      "codex/organizations",
      "codex/plot-threads",
      "codex/categories",
      "codex/custom",
      "codex/entry-research",
      "codex/relations",
      "codex/progressions",
      "codex/knowledge",
      "research/sources",
      "research/notes",
      "snippets",
      "styles",
      "agents",
      "workshop",
      "planning/events",
      "sections",
      "review/anchors",
      ".studio/inbox",
      ".studio/history",
      ".studio/cache",
      ".studio/logs",
    ];
    await Promise.all(
      requiredDirectories.map((directory) => mkdir(path.join(seriesRoot, directory), { recursive: true })),
    );
    await applyFileTransaction(seriesRoot, [
      { targetPath: path.join(seriesRoot, SERIES_FILE), content: serializeYaml(manifest) },
      { targetPath: path.join(bookRoot, BOOK_FILE), content: serializeYaml(book) },
      { targetPath: actPath(bookRoot, act.id), content: serializeYaml(act) },
      { targetPath: chapterPath(bookRoot, chapter.id), content: serializeYaml(chapter) },
      { targetPath: timelineManifestPath(seriesRoot), content: serializeYaml(timeline) },
    ]);
    await this.createScene(seriesId, { title: DefaultStructureTitles.initialScene, content: "" }, {
      bookId,
      actId,
      chapterId,
    });
    await this.rebuildIndex(seriesId);
    return this.getSeries(seriesId);
  }

  async createBook(seriesId: string, rawInput: CreateBookInput): Promise<BookManifest> {
    const input = CreateBookInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const manifest = await readYaml(path.join(seriesRoot, SERIES_FILE), (value) =>
      SeriesManifestSchema.parse(value),
    );
    const now = new Date().toISOString();
    const bookId = randomUUID();
    const actId = randomUUID();
    const chapterId = randomUUID();
    const bookRoot = assertInside(seriesRoot, path.join(seriesRoot, "books", bookId));
    const book = BookManifestSchema.parse({
      schemaVersion: 1,
      id: bookId,
      seriesId,
      title: input.title,
      order: manifest.bookIds.length + 1,
      targetCharacters: input.targetCharacters,
      actIds: [actId],
      createdAt: now,
      updatedAt: now,
    });
    const act = ActManifestSchema.parse({
      schemaVersion: 1,
      id: actId,
      bookId,
      title: DefaultStructureTitles.chapter,
      order: 1,
      chapterIds: [chapterId],
      createdAt: now,
      updatedAt: now,
    });
    const chapter = ChapterManifestSchema.parse({
      schemaVersion: 1,
      id: chapterId,
      actId,
      title: DefaultStructureTitles.act,
      order: 1,
      sceneIds: [],
      createdAt: now,
      updatedAt: now,
    });
    const updatedManifest = SeriesManifestSchema.parse({
      ...manifest,
      bookIds: [...manifest.bookIds, bookId],
      updatedAt: now,
    });
    await applyFileTransaction(seriesRoot, [
      { targetPath: path.join(seriesRoot, SERIES_FILE), content: serializeYaml(updatedManifest) },
      { targetPath: path.join(bookRoot, BOOK_FILE), content: serializeYaml(book) },
      { targetPath: actPath(bookRoot, act.id), content: serializeYaml(act) },
      { targetPath: chapterPath(bookRoot, chapter.id), content: serializeYaml(chapter) },
    ]);
    return book;
  }

  async deleteBook(seriesId: string, bookId: string): Promise<{
    deletedId: string;
    deletedActIds: string[];
    deletedChapterIds: string[];
    deletedSceneIds: string[];
  }> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const context = await this.findBookContext(seriesRoot, bookId);
    const now = new Date().toISOString();
    const bookIds = context.manifest.bookIds.filter((id) => id !== bookId);
    if (bookIds.length === context.manifest.bookIds.length) {
      throw new StorageError("Series does not reference the selected book", "INVALID_DATA", { bookId });
    }

    const remainingBooks: BookManifest[] = [];
    for (let index = 0; index < bookIds.length; index++) {
      const id = bookIds[index]!;
      const remainingBook = await readYaml(path.join(seriesRoot, "books", id, BOOK_FILE), (value) =>
        BookManifestSchema.parse(value),
      );
      remainingBooks.push(BookManifestSchema.parse({ ...remainingBook, order: index + 1, updatedAt: now }));
    }

    const acts: ActManifest[] = [];
    const chapters: ChapterManifest[] = [];
    const scenePaths: Array<{ id: string; filePath: string }> = [];
    for (const actId of context.book.actIds) {
      const act = await readActManifest(context.bookRoot, actId);
      acts.push(act);
      for (const chapterId of act.chapterIds) {
        const chapter = await readChapterManifest(context.bookRoot, chapterId);
        chapters.push(chapter);
        for (const sceneId of chapter.sceneIds) {
          scenePaths.push({ id: sceneId, filePath: await this.findScenePath(seriesRoot, sceneId) });
        }
      }
    }

    const updatedManifest = SeriesManifestSchema.parse({
      ...context.manifest,
      bookIds,
      updatedAt: now,
    });

    await applyFileTransaction(seriesRoot, [
      { targetPath: path.join(seriesRoot, SERIES_FILE), content: serializeYaml(updatedManifest) },
      ...remainingBooks.map((book) => ({
        targetPath: path.join(seriesRoot, "books", book.id, BOOK_FILE),
        content: serializeYaml(book),
      })),
      { targetPath: path.join(context.bookRoot, BOOK_FILE), delete: true },
      ...acts.map((act) => ({ targetPath: actPath(context.bookRoot, act.id), delete: true })),
      ...chapters.map((chapter) => ({ targetPath: chapterPath(context.bookRoot, chapter.id), delete: true })),
      ...scenePaths.map(({ filePath }) => ({ targetPath: filePath, delete: true })),
    ]);
    await this.unindexScenes(seriesRoot, scenePaths.map(({ id }) => id));

    return {
      deletedId: bookId,
      deletedActIds: acts.map((act) => act.id),
      deletedChapterIds: chapters.map((chapter) => chapter.id),
      deletedSceneIds: scenePaths.map(({ id }) => id),
    };
  }

  async listSeries(): Promise<SeriesSummary[]> {
    await this.initialize();
    const entries = await readdir(this.libraryRoot, { withFileTypes: true });
    const summaries: SeriesSummary[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const root = path.join(this.libraryRoot, entry.name);
      const seriesFile = path.join(root, SERIES_FILE);
      try {
        await recoverFileTransactions(root);
        const manifest = await readYaml(seriesFile, (value) => SeriesManifestSchema.parse(value));
        const scenes = await walkSceneFiles(path.join(this.libraryRoot, entry.name, "books"));
        summaries.push({
          id: manifest.id,
          title: manifest.title,
          description: manifest.description,
          updatedAt: manifest.updatedAt,
          archived: manifest.archivedAt !== null,
          bookCount: manifest.bookIds.length,
          sceneCount: scenes.length,
          directoryName: entry.name,
        });
      } catch (error) {
        if (error instanceof StorageError) continue;
        throw error;
      }
    }
    return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getSeries(seriesId: string): Promise<SeriesDetail> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const hierarchy = await this.validateHierarchy(seriesId);
    if (!hierarchy.valid) {
      throw new StorageError("Series hierarchy is incomplete", "INVALID_DATA", { issues: hierarchy.issues });
    }
    const manifest = await readYaml(path.join(seriesRoot, SERIES_FILE), (value) =>
      SeriesManifestSchema.parse(value),
    );
    const books: BookManifest[] = [];
    for (const bookId of manifest.bookIds) {
      books.push(
        await readYaml(path.join(seriesRoot, "books", bookId, BOOK_FILE), (value) =>
          BookManifestSchema.parse(value),
        ),
      );
    }
    const acts: ActManifest[] = [];
    const chapters: ChapterManifest[] = [];
    const scenes: SceneDocument[] = [];
    for (const book of books.sort((a, b) => a.order - b.order)) {
      const bookRoot = path.join(seriesRoot, "books", book.id);
      for (const actId of book.actIds) {
        const act = await this.readReferencedAct(bookRoot, book, actId);
        acts.push(act);
        for (const chapterId of act.chapterIds) {
          const chapter = await this.readReferencedChapter(bookRoot, act, chapterId);
          chapters.push(chapter);
          for (const sceneId of chapter.sceneIds) {
            const scene = await this.readReferencedScene(seriesRoot, book, act, chapter, sceneId);
            scenes.push(scene);
          }
        }
      }
    }
    return { manifest, books, acts, chapters, scenes };
  }

  async updateSeriesCloudPolicy(
    seriesId: string,
    rawInput: UpdateSeriesCloudPolicyInput,
  ): Promise<SeriesManifest> {
    const input = UpdateSeriesCloudPolicyInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const manifest = await readYaml(path.join(seriesRoot, SERIES_FILE), (value) =>
      SeriesManifestSchema.parse(value),
    );
    const updatedManifest = SeriesManifestSchema.parse({
      ...manifest,
      cloudPolicy: input.cloudPolicy,
      updatedAt: new Date().toISOString(),
    });
    await atomicWrite(path.join(seriesRoot, SERIES_FILE), serializeYaml(updatedManifest));
    return updatedManifest;
  }

  async getScene(seriesId: string, sceneId: string): Promise<SceneDocument> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const filePath = await this.findScenePath(seriesRoot, sceneId);
    return parseSceneText(await readFile(filePath, "utf8"), path.relative(seriesRoot, filePath));
  }

  async createScene(
    seriesId: string,
    rawInput: CreateSceneInput,
    location?: { bookId: string; actId: string; chapterId: string },
  ): Promise<SceneDocument> {
    const input = CreateSceneInputSchema.parse(rawInput);
    const targetLocation = location ??
      (input.bookId && input.actId && input.chapterId
        ? { bookId: input.bookId, actId: input.actId, chapterId: input.chapterId }
        : undefined);
    const series = await this.getSeriesWithoutScenes(seriesId);
    const book = targetLocation
      ? series.books.find((item) => item.id === targetLocation.bookId)
      : series.books[0];
    if (!book) throw new StorageError("Series has no available book", "INVALID_DATA");
    const actId = targetLocation?.actId ?? book.actIds[0];
    if (!actId) throw new StorageError("Book has no available act", "INVALID_DATA", { bookId: book.id });
    const act = await this.readReferencedAct(path.join(series.root, "books", book.id), book, actId);
    const chapterId = targetLocation?.chapterId ?? act.chapterIds[0];
    if (!chapterId) throw new StorageError("Act has no available chapter", "INVALID_DATA", { actId });
    const bookRoot = path.join(series.root, "books", book.id);
    const chapter = await this.readReferencedChapter(bookRoot, act, chapterId);
    const now = new Date().toISOString();
    const metadata = SceneFrontmatterSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      bookId: book.id,
      actId,
      chapterId,
      title: input.title,
      order: chapter.sceneIds.length + 1,
      status: "draft",
      pov: null,
      locationIds: [],
      characterIds: [],
      plotThreadIds: [],
      tags: [],
      goal: "",
      summary: "",
      beats: [],
      storyTime: null,
      createdAt: now,
      updatedAt: now,
    });
    const filePath = assertInside(
      series.root,
      path.join(series.root, "books", book.id, "manuscript", actId, chapterId, `${metadata.id}.json`),
    );
    const updatedChapter = ChapterManifestSchema.parse({
      ...chapter,
      sceneIds: [...chapter.sceneIds, metadata.id],
      updatedAt: now,
    });
    await applyFileTransaction(series.root, [
      { targetPath: filePath, content: serializeScene(metadata, input.content) },
      { targetPath: chapterPath(bookRoot, chapter.id), content: serializeYaml(updatedChapter) },
    ]);
    const scene = parseSceneText(await readFile(filePath, "utf8"), path.relative(series.root, filePath));
    await this.indexScene(series.root, scene);
    return scene;
  }

  async updateScene(
    seriesId: string,
    sceneId: string,
    rawInput: UpdateSceneInput,
  ): Promise<SceneDocument> {
    const input = UpdateSceneInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const filePath = await this.findScenePath(seriesRoot, sceneId);
    const currentText = await readFile(filePath, "utf8");
    const current = parseSceneText(currentText, path.relative(seriesRoot, filePath));
    if (current.revision !== input.baseRevision) {
      throw new StorageError("Scene has changed on disk", "CONFLICT", {
        currentRevision: current.revision,
        scene: current,
      });
    }
    const metadata = SceneFrontmatterSchema.parse({
      ...current.metadata,
      title: input.title,
      status: input.status ?? current.metadata.status,
      goal: input.goal ?? current.metadata.goal,
      summary: input.summary ?? current.metadata.summary,
      updatedAt: new Date().toISOString(),
    });
    await atomicWrite(filePath, serializeScene(metadata, input.content));
    const updated = await this.getScene(seriesId, sceneId);
    await this.indexScene(seriesRoot, updated);
    return updated;
  }

  async updateScenePlanning(
    seriesId: string,
    sceneId: string,
    rawInput: UpdateScenePlanningInput,
  ): Promise<SceneDocument> {
    const input = UpdateScenePlanningInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const filePath = await this.findScenePath(seriesRoot, sceneId);
    const current = parseSceneText(
      await readFile(filePath, "utf8"),
      path.relative(seriesRoot, filePath),
    );
    if (current.revision !== input.baseRevision) {
      throw new StorageError("Scene planning has changed on disk", "CONFLICT", {
        currentRevision: current.revision,
        scene: current,
      });
    }
    const { baseRevision: _baseRevision, ...changes } = input;
    const metadata = SceneFrontmatterSchema.parse({
      ...current.metadata,
      ...changes,
      updatedAt: new Date().toISOString(),
    });
    await atomicWrite(filePath, serializeSceneDocument(metadata, current.document));
    const updated = parseSceneText(
      await readFile(filePath, "utf8"),
      path.relative(seriesRoot, filePath),
    );
    await this.indexScene(seriesRoot, updated);
    return updated;
  }

  async listSceneSections(
    seriesId: string,
    sceneId: string,
  ): Promise<SceneSectionDocument[]> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    await this.getScene(seriesId, sceneId);
    const directory = assertInside(seriesRoot, path.join(seriesRoot, SECTIONS_DIR, sceneId));
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const sections: SceneSectionDocument[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const filePath = assertInside(seriesRoot, path.join(directory, entry.name));
      const document = parseSceneSectionText(
        await readFile(filePath, "utf8"),
        path.relative(seriesRoot, filePath),
      );
      if (
        document.metadata.id !== path.basename(entry.name, ".md") ||
        document.metadata.sceneId !== sceneId
      ) {
        throw new StorageError("Section file name or scene ownership is inconsistent", "INVALID_DATA", {
          sectionId: document.metadata.id,
          sceneId,
        });
      }
      sections.push(document);
    }
    return sections.sort((left, right) => left.metadata.createdAt.localeCompare(right.metadata.createdAt));
  }

  async createSceneSection(
    seriesId: string,
    sceneId: string,
    rawInput: CreateSceneSectionInput,
  ): Promise<SceneSectionDocument> {
    const input = CreateSceneSectionInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    await this.getScene(seriesId, sceneId);
    const now = new Date().toISOString();
    const metadata = SceneSectionMetadataSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      sceneId,
      title: input.title,
      kind: input.kind,
      aiPolicy: input.aiPolicy ?? (input.kind === "sensitive" ? "never" : "inherit"),
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    });
    const filePath = assertInside(seriesRoot, sectionPath(seriesRoot, sceneId, metadata.id));
    await atomicWrite(filePath, serializeSceneSection(metadata, input.content));
    return parseSceneSectionText(
      await readFile(filePath, "utf8"),
      path.relative(seriesRoot, filePath),
    );
  }

  async updateSceneSection(
    seriesId: string,
    sectionId: string,
    rawInput: UpdateSceneSectionInput,
  ): Promise<SceneSectionDocument> {
    const input = UpdateSceneSectionInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const { filePath, document: current } = await this.findSceneSection(seriesRoot, sectionId);
    await this.getScene(seriesId, current.metadata.sceneId);
    if (current.revision !== input.baseRevision) {
      throw new StorageError("Section 已被其他修改更新", "CONFLICT", {
        currentRevision: current.revision,
        section: current,
      });
    }
    if (current.metadata.archivedAt) {
      throw new StorageError("Archived section cannot be edited directly", "INVALID_DATA", { sectionId });
    }
    const metadata = SceneSectionMetadataSchema.parse({
      ...current.metadata,
      title: input.title ?? current.metadata.title,
      kind: input.kind ?? current.metadata.kind,
      aiPolicy: input.aiPolicy ?? current.metadata.aiPolicy,
      updatedAt: new Date().toISOString(),
    });
    await atomicWrite(filePath, serializeSceneSection(metadata, input.content ?? current.content));
    return parseSceneSectionText(
      await readFile(filePath, "utf8"),
      path.relative(seriesRoot, filePath),
    );
  }

  async archiveSceneSection(
    seriesId: string,
    sectionId: string,
    rawInput: ArchiveSceneSectionInput,
  ): Promise<SceneSectionDocument> {
    const input = ArchiveSceneSectionInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const { filePath, document: current } = await this.findSceneSection(seriesRoot, sectionId);
    await this.getScene(seriesId, current.metadata.sceneId);
    if (current.revision !== input.baseRevision) {
      throw new StorageError("Section 已被其他修改更新", "CONFLICT", {
        currentRevision: current.revision,
        section: current,
      });
    }
    if (current.metadata.archivedAt) return current;
    const now = new Date().toISOString();
    const metadata = SceneSectionMetadataSchema.parse({
      ...current.metadata,
      updatedAt: now,
      archivedAt: now,
    });
    await atomicWrite(filePath, serializeSceneSection(metadata, current.content));
    return parseSceneSectionText(
      await readFile(filePath, "utf8"),
      path.relative(seriesRoot, filePath),
    );
  }

  async restoreSceneSection(
    seriesId: string,
    sectionId: string,
    rawInput: RestoreSceneSectionInput,
  ): Promise<SceneSectionDocument> {
    const input = RestoreSceneSectionInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const { filePath, document: current } = await this.findSceneSection(seriesRoot, sectionId);
    await this.getScene(seriesId, current.metadata.sceneId);
    if (current.revision !== input.baseRevision) {
      throw new StorageError("Section 已被其他修改更新", "CONFLICT", {
        currentRevision: current.revision,
        section: current,
      });
    }
    if (!current.metadata.archivedAt) return current;
    const metadata = SceneSectionMetadataSchema.parse({
      ...current.metadata,
      updatedAt: new Date().toISOString(),
      archivedAt: null,
    });
    await atomicWrite(filePath, serializeSceneSection(metadata, current.content));
    return parseSceneSectionText(
      await readFile(filePath, "utf8"),
      path.relative(seriesRoot, filePath),
    );
  }

  async listSceneSectionsForContext(
    seriesId: string,
    sceneId: string,
    rawTarget: SectionContextTarget,
  ): Promise<SceneSectionDocument[]> {
    const target = SectionContextTargetSchema.parse(rawTarget);
    const sections = await this.listSceneSections(seriesId, sceneId);
    return sections.filter(
      (section) =>
        section.metadata.archivedAt === null &&
        isSceneSectionEligibleForContext(section.metadata.aiPolicy, target),
    );
  }

  async listReviewAnchors(
    seriesId: string,
    sceneId: string,
  ): Promise<ResolvedReviewAnchor[]> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const scene = await this.getScene(seriesId, sceneId);
    const directory = assertInside(
      seriesRoot,
      path.join(seriesRoot, REVIEW_DIR, ANCHORS_DIR),
    );
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const anchors: ResolvedReviewAnchor[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".yaml")) continue;
      const filePath = assertInside(seriesRoot, path.join(directory, entry.name));
      const raw = await readFile(filePath, "utf8");
      const anchor = ReviewAnchorSchema.parse(YAML.parse(raw));
      if (anchor.id !== path.basename(entry.name, ".yaml")) {
        throw new StorageError("锚点文件名与 ID 不一致", "INVALID_DATA", { anchorId: anchor.id });
      }
      if (anchor.sceneId !== sceneId) continue;
      anchors.push(
        ResolvedReviewAnchorSchema.parse({
          anchor,
          revision: contentRevision(raw),
          resolution: resolveReviewAnchor(anchor, scene.content),
        }),
      );
    }
    return anchors.sort((left, right) => left.anchor.createdAt.localeCompare(right.anchor.createdAt));
  }

  async createReviewAnchor(
    seriesId: string,
    sceneId: string,
    rawInput: CreateReviewAnchorInput,
  ): Promise<ResolvedReviewAnchor> {
    const input = CreateReviewAnchorInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const scene = await this.getScene(seriesId, sceneId);
    if (scene.revision !== input.baseRevision) {
      throw new StorageError("Scene has changed on disk", "CONFLICT", {
        currentRevision: scene.revision,
        scene,
      });
    }
    if (
      input.end > scene.content.length ||
      scene.content.slice(input.start, input.end) !== input.exactQuote
    ) {
      throw new StorageError("Review anchor range no longer matches the current scene content", "INVALID_DATA", {
        start: input.start,
        end: input.end,
      });
    }
    const now = new Date().toISOString();
    const anchor = ReviewAnchorSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      sceneId,
      blockId: randomUUID(),
      sceneRevision: scene.revision,
      exactQuote: input.exactQuote,
      prefix: scene.content.slice(Math.max(0, input.start - 96), input.start),
      suffix: scene.content.slice(input.end, input.end + 96),
      start: input.start,
      end: input.end,
      createdAt: now,
      updatedAt: now,
    });
    const raw = serializeYaml(anchor);
    const filePath = assertInside(seriesRoot, reviewAnchorPath(seriesRoot, anchor.id));
    await atomicWrite(filePath, raw);
    return ResolvedReviewAnchorSchema.parse({
      anchor,
      revision: contentRevision(raw),
      resolution: resolveReviewAnchor(anchor, scene.content),
    });
  }

  async listCodexCategories(
    seriesId: string,
    includeArchived = false,
  ): Promise<CodexCategoryDocument[]> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const builtIn = BUILT_IN_CODEX_CATEGORIES.map((category) =>
      CodexCategoryDocumentSchema.parse({
        category: {
          id: category.id,
          name: category.name,
          icon: category.icon,
          builtIn: true,
          archivedAt: null,
        },
        revision: null,
      }),
    );
    const directory = path.join(seriesRoot, CODEX_DIR, CODEX_CATEGORIES_DIR);
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return builtIn;
      throw error;
    }
    const custom: CodexCategoryDocument[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".yaml")) continue;
      const filePath = assertInside(seriesRoot, path.join(directory, entry.name));
      const raw = await readFile(filePath, "utf8");
      let category: CodexCustomCategory;
      try {
        category = CodexCustomCategorySchema.parse(YAML.parse(raw));
      } catch (error) {
        throw new StorageError("Codex 自定义类别 YAML 无效", "INVALID_DATA", {
          relativePath: path.relative(seriesRoot, filePath),
          cause: error instanceof Error ? error.message : String(error),
        });
      }
      if (category.id !== path.basename(entry.name, ".yaml")) {
        throw new StorageError("Codex 类别文件名与 ID 不一致", "INVALID_DATA", {
          categoryId: category.id,
        });
      }
      if (!includeArchived && category.archivedAt) continue;
      custom.push(
        CodexCategoryDocumentSchema.parse({
          category: {
            id: category.id,
            name: category.name,
            icon: category.icon,
            builtIn: false,
            archivedAt: category.archivedAt,
          },
          revision: contentRevision(raw),
        }),
      );
    }
    return [
      ...builtIn,
      ...custom.sort((left, right) =>
        left.category.name.localeCompare(right.category.name, "zh-CN"),
      ),
    ];
  }

  async createCodexCategory(
    seriesId: string,
    rawInput: CreateCodexCategoryInput,
  ): Promise<CodexCategoryDocument> {
    const input = CreateCodexCategoryInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    this.assertCodexCategoryNameAvailable(
      await this.listCodexCategories(seriesId, true),
      input.name,
    );
    const now = new Date().toISOString();
    const category = CodexCustomCategorySchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      name: input.name,
      icon: input.icon,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    });
    const raw = serializeYaml(category);
    await atomicWrite(codexCategoryPath(seriesRoot, category.id), raw);
    await mkdir(path.join(seriesRoot, CODEX_DIR, CODEX_CUSTOM_DIR, category.id), {
      recursive: true,
    });
    return CodexCategoryDocumentSchema.parse({
      category: {
        id: category.id,
        name: category.name,
        icon: category.icon,
        builtIn: false,
        archivedAt: null,
      },
      revision: contentRevision(raw),
    });
  }

  async updateCodexCategory(
    seriesId: string,
    categoryId: string,
    rawInput: UpdateCodexCategoryInput,
  ): Promise<CodexCategoryDocument> {
    const input = UpdateCodexCategoryInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const current = await this.readCustomCodexCategory(seriesRoot, categoryId);
    if (current.revision !== input.baseRevision) {
      throw new StorageError("Codex 类别已被其他修改更新", "CONFLICT", {
        currentRevision: current.revision,
      });
    }
    if (input.name !== undefined) {
      this.assertCodexCategoryNameAvailable(
        await this.listCodexCategories(seriesId, true),
        input.name,
        categoryId,
      );
    }
    const category = CodexCustomCategorySchema.parse({
      ...current.category,
      name: input.name ?? current.category.name,
      icon: input.icon ?? current.category.icon,
      updatedAt: new Date().toISOString(),
    });
    const raw = serializeYaml(category);
    await atomicWrite(codexCategoryPath(seriesRoot, category.id), raw);
    return CodexCategoryDocumentSchema.parse({
      category: {
        id: category.id,
        name: category.name,
        icon: category.icon,
        builtIn: false,
        archivedAt: category.archivedAt,
      },
      revision: contentRevision(raw),
    });
  }

  async archiveCodexCategory(
    seriesId: string,
    categoryId: string,
    rawInput: ArchiveCodexDocumentInput,
  ): Promise<CodexCategoryDocument> {
    return this.setCodexCategoryArchived(seriesId, categoryId, rawInput, true);
  }

  async restoreCodexCategory(
    seriesId: string,
    categoryId: string,
    rawInput: ArchiveCodexDocumentInput,
  ): Promise<CodexCategoryDocument> {
    return this.setCodexCategoryArchived(seriesId, categoryId, rawInput, false);
  }

  async deleteCodexCategory(
    seriesId: string,
    categoryId: string,
    rawInput: DeleteCodexDocumentInput,
  ): Promise<DeleteCodexCategoryResult> {
    const input = DeleteCodexDocumentInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const current = await this.readCustomCodexCategory(seriesRoot, categoryId);
    if (current.revision !== input.baseRevision) {
      throw new StorageError("Codex 绫诲埆宸茶鍏朵粬淇敼鏇存柊", "CONFLICT", {
        currentRevision: current.revision,
      });
    }

    const now = new Date().toISOString();
    const movedEntryIds: string[] = [];
    const mutations: FileMutation[] = [
      { targetPath: codexCategoryPath(seriesRoot, categoryId), delete: true },
    ];
    const entries = await this.listCodexEntriesFromRoot(seriesRoot);
    for (const entry of entries.filter((candidate) => candidate.metadata.categoryId === categoryId)) {
      const currentEntry = await this.findCodexEntry(seriesRoot, entry.metadata.id);
      const nextPath = assertInside(
        seriesRoot,
        codexEntryPath(seriesRoot, "uncategorized", entry.metadata.id),
      );
      if (nextPath !== currentEntry.filePath && (await pathExists(nextPath))) {
        throw new StorageError("Codex entry target path already exists", "INVALID_DATA", {
          entryId: entry.metadata.id,
          categoryId: "uncategorized",
        });
      }
      /*
      if (nextPath !== currentEntry.filePath && (await pathExists(nextPath))) {
        throw new StorageError("Codex 鏉＄洰鐩爣鍒嗙被璺緞宸插瓨鍦?, "INVALID_DATA", {
          entryId: entry.metadata.id,
          categoryId: "uncategorized",
        });
      }
      */
      const metadata = CodexEntryMetadataSchema.parse({
        ...currentEntry.document.metadata,
        categoryId: "uncategorized",
        updatedAt: now,
      });
      mutations.push({
        targetPath: nextPath,
        content: serializeMarkdownDocument(metadata, currentEntry.document.description),
      });
      if (nextPath !== currentEntry.filePath) {
        mutations.push({ targetPath: currentEntry.filePath, delete: true });
      }
      movedEntryIds.push(entry.metadata.id);
    }

    await applyFileTransaction(seriesRoot, mutations);
    await rm(path.join(seriesRoot, CODEX_DIR, CODEX_CUSTOM_DIR, categoryId), {
      force: true,
      recursive: true,
    });
    await this.rebuildCodexIndex(seriesRoot);
    return DeleteCodexCategoryResultSchema.parse({ deletedId: categoryId, movedEntryIds });
  }

  async listCodexDetailTypes(
    seriesId: string,
    options: { categoryId?: CodexCategoryId } = {},
  ): Promise<CodexDetailTypeDocument[]> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const directory = path.join(seriesRoot, CODEX_DIR, CODEX_DETAIL_TYPES_DIR);
    let files;
    try {
      files = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const documents: CodexDetailTypeDocument[] = [];
    const seen = new Set<string>();
    for (const entry of files) {
      if (!entry.isFile() || !entry.name.endsWith(".yaml")) continue;
      const document = await this.readCodexDetailType(seriesRoot, path.basename(entry.name, ".yaml"));
      if (seen.has(document.detailType.id)) {
        throw new StorageError("多个 Codex detail type 文件使用同一 ID", "INVALID_DATA", {
          detailTypeId: document.detailType.id,
        });
      }
      seen.add(document.detailType.id);
      if (options.categoryId && document.detailType.categoryId !== options.categoryId) continue;
      documents.push(document);
    }
    return documents.sort((left, right) =>
      left.detailType.categoryId.localeCompare(right.detailType.categoryId, "zh-CN") ||
      left.detailType.name.localeCompare(right.detailType.name, "zh-CN"),
    );
  }

  async createCodexDetailType(
    seriesId: string,
    rawInput: CreateCodexDetailTypeInput,
  ): Promise<CodexDetailTypeDocument> {
    const input = CreateCodexDetailTypeInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    await this.assertCodexCategoryWritable(seriesRoot, input.categoryId);
    this.assertCodexDetailTypeNameAvailable(
      await this.listCodexDetailTypes(seriesId, { categoryId: input.categoryId }),
      input.name,
      input.categoryId,
    );
    const now = new Date().toISOString();
    const detailType = CodexDetailTypeSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      categoryId: input.categoryId,
      name: input.name,
      nsfw: input.nsfw,
      createdAt: now,
      updatedAt: now,
    });
    const raw = serializeYaml(detailType);
    await atomicWrite(codexDetailTypePath(seriesRoot, detailType.id), raw);
    return CodexDetailTypeDocumentSchema.parse({
      detailType,
      revision: contentRevision(raw),
    });
  }

  async updateCodexDetailType(
    seriesId: string,
    detailTypeId: string,
    rawInput: UpdateCodexDetailTypeInput,
  ): Promise<CodexDetailTypeDocument> {
    const input = UpdateCodexDetailTypeInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const current = await this.readCodexDetailType(seriesRoot, detailTypeId);
    if (current.revision !== input.baseRevision) {
      throw new StorageError("Codex detail type changed on disk", "CONFLICT", {
        currentRevision: current.revision,
      });
    }
    const now = new Date().toISOString();
    const detailType = CodexDetailTypeSchema.parse({
      ...current.detailType,
      nsfw: input.nsfw,
      updatedAt: now,
    });
    const raw = serializeYaml(detailType);
    await atomicWrite(codexDetailTypePath(seriesRoot, detailTypeId), raw);
    return CodexDetailTypeDocumentSchema.parse({
      detailType,
      revision: contentRevision(raw),
    });
  }

  async deleteCodexDetailType(
    seriesId: string,
    detailTypeId: string,
    rawInput: DeleteCodexDocumentInput,
  ): Promise<DeleteCodexDetailTypeResult> {
    const input = DeleteCodexDocumentInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const current = await this.readCodexDetailType(seriesRoot, detailTypeId);
    if (current.revision !== input.baseRevision) {
      throw new StorageError("Codex detail type changed on disk", "CONFLICT", {
        currentRevision: current.revision,
      });
    }
    const usedByEntryIds = (await this.listCodexEntriesFromRoot(seriesRoot))
      .filter((entry) =>
        entry.metadata.categoryId === current.detailType.categoryId &&
        Object.prototype.hasOwnProperty.call(entry.metadata.details, current.detailType.name),
      )
      .map((entry) => entry.metadata.id);
    if (usedByEntryIds.length) {
      throw new StorageError("Codex detail type is still used by entries", "INVALID_DATA", {
        detailTypeId,
        detailTypeName: current.detailType.name,
        entryIds: usedByEntryIds,
      });
    }
    await rm(codexDetailTypePath(seriesRoot, detailTypeId), { force: true });
    return DeleteCodexDetailTypeResultSchema.parse({ deletedId: detailTypeId });
  }

  async listCodexEntries(
    seriesId: string,
    options: { categoryId?: CodexCategoryId; includeArchived?: boolean } = {},
  ): Promise<CodexEntryDocument[]> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const entries = await this.listCodexEntriesFromRoot(seriesRoot);
    return entries
      .filter(
        (entry) =>
          (options.includeArchived || entry.metadata.archivedAt === null) &&
          (!options.categoryId || entry.metadata.categoryId === options.categoryId),
      )
      .sort((left, right) =>
        left.metadata.name.localeCompare(right.metadata.name, "zh-CN"),
      );
  }

  async getCodexEntry(seriesId: string, entryId: string): Promise<CodexEntryDocument> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return (await this.findCodexEntry(seriesRoot, entryId)).document;
  }

  async createCodexEntry(
    seriesId: string,
    rawInput: CreateCodexEntryInput,
  ): Promise<CodexEntryDocument> {
    const input = CreateCodexEntryInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    await this.assertCodexCategoryWritable(seriesRoot, input.categoryId);
    const now = new Date().toISOString();
    const entryId = randomUUID();
    const metadata = CodexEntryMetadataSchema.parse({
      schemaVersion: 1,
      id: entryId,
      categoryId: input.categoryId,
      name: input.name,
      aliases: normalizeUniqueStrings(input.aliases),
      thumbnail: input.thumbnail,
      details: input.details,
      detailAiContext: input.detailAiContext,
      aiContextPolicy: input.aiContextPolicy,
      mention: {
        ...input.mention,
        excludedTerms: normalizeUniqueStrings(input.mention.excludedTerms),
      },
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    });
    const researchMetadata = CodexResearchMetadataSchema.parse({
      schemaVersion: 1,
      entryId,
      createdAt: now,
      updatedAt: now,
    });
    const entryPath = assertInside(
      seriesRoot,
      codexEntryPath(seriesRoot, metadata.categoryId, entryId),
    );
    const researchPath = assertInside(seriesRoot, codexResearchPath(seriesRoot, entryId));
    await applyFileTransaction(seriesRoot, [
      {
        targetPath: entryPath,
        content: serializeMarkdownDocument(metadata, input.description),
      },
      {
        targetPath: researchPath,
        content: serializeMarkdownDocument(researchMetadata, input.research),
      },
    ]);
    await this.rebuildCodexIndex(seriesRoot);
    return (await this.findCodexEntry(seriesRoot, entryId)).document;
  }

  async updateCodexEntry(
    seriesId: string,
    entryId: string,
    rawInput: UpdateCodexEntryInput,
  ): Promise<CodexEntryDocument> {
    const input = UpdateCodexEntryInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const current = await this.findCodexEntry(seriesRoot, entryId);
    if (current.document.metadata.archivedAt) {
      throw new StorageError("已归档 Codex 条目不能直接编辑", "INVALID_DATA", { entryId });
    }
    const changesEntry = [
      input.categoryId,
      input.name,
      input.aliases,
      input.thumbnail,
      input.details,
      input.detailAiContext,
      input.aiContextPolicy,
      input.mention,
      input.description,
    ].some((value) => value !== undefined);
    const changesResearch = input.research !== undefined;
    if (changesEntry && current.document.revision !== input.baseRevision) {
      throw new StorageError("Codex 条目已被其他修改更新", "CONFLICT", {
        currentRevision: current.document.revision,
        entry: current.document,
      });
    }
    if (changesResearch && current.document.research.revision !== input.baseResearchRevision) {
      throw new StorageError("Codex Research 已被其他修改更新", "CONFLICT", {
        currentRevision: current.document.research.revision,
        research: current.document.research,
      });
    }
    const now = new Date().toISOString();
    const mutations: FileMutation[] = [];
    if (changesEntry) {
      const nextCategoryId = input.categoryId ?? current.document.metadata.categoryId;
      if (input.categoryId !== undefined && input.categoryId !== current.document.metadata.categoryId) {
        await this.assertCodexCategoryWritable(seriesRoot, input.categoryId);
      }
      const metadata = CodexEntryMetadataSchema.parse({
        ...current.document.metadata,
        categoryId: nextCategoryId,
        name: input.name ?? current.document.metadata.name,
        aliases:
          input.aliases === undefined
            ? current.document.metadata.aliases
            : normalizeUniqueStrings(input.aliases),
        thumbnail:
          input.thumbnail === undefined
            ? current.document.metadata.thumbnail
            : input.thumbnail,
        details: input.details ?? current.document.metadata.details,
        detailAiContext:
          input.detailAiContext === undefined
            ? current.document.metadata.detailAiContext
            : input.detailAiContext,
        aiContextPolicy:
          input.aiContextPolicy ?? current.document.metadata.aiContextPolicy,
        mention: input.mention
          ? {
              ...input.mention,
              excludedTerms: normalizeUniqueStrings(input.mention.excludedTerms),
            }
          : current.document.metadata.mention,
        updatedAt: now,
      });
      const nextEntryPath = assertInside(
        seriesRoot,
        codexEntryPath(seriesRoot, nextCategoryId, entryId),
      );
      if (nextEntryPath !== current.filePath && (await pathExists(nextEntryPath))) {
        throw new StorageError("Codex 鏉＄洰鐩爣绫诲埆涓凡瀛樺湪鍚屽悕鏂囦欢", "INVALID_DATA", {
          entryId,
          categoryId: nextCategoryId,
        });
      }
      mutations.push({
        targetPath: nextEntryPath,
        content: serializeMarkdownDocument(
          metadata,
          input.description ?? current.document.description,
        ),
      });
      if (nextEntryPath !== current.filePath) {
        mutations.push({ targetPath: current.filePath, delete: true });
      }
    }
    if (changesResearch) {
      mutations.push({
        targetPath: current.researchPath,
        content: serializeMarkdownDocument(
          {
            ...current.document.research.metadata,
            updatedAt: now,
          },
          input.research!,
        ),
      });
    }
    await applyFileTransaction(seriesRoot, mutations);
    await this.rebuildCodexIndex(seriesRoot);
    return (await this.findCodexEntry(seriesRoot, entryId)).document;
  }

  async archiveCodexEntry(
    seriesId: string,
    entryId: string,
    rawInput: ArchiveCodexDocumentInput,
  ): Promise<CodexEntryDocument> {
    return this.setCodexEntryArchived(seriesId, entryId, rawInput, true);
  }

  async restoreCodexEntry(
    seriesId: string,
    entryId: string,
    rawInput: ArchiveCodexDocumentInput,
  ): Promise<CodexEntryDocument> {
    return this.setCodexEntryArchived(seriesId, entryId, rawInput, false);
  }

  async deleteCodexEntry(
    seriesId: string,
    entryId: string,
    rawInput: DeleteCodexDocumentInput,
  ): Promise<DeleteCodexEntryResult> {
    const input = DeleteCodexDocumentInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const current = await this.findCodexEntry(seriesRoot, entryId);
    if (current.document.revision !== input.baseRevision) {
      throw new StorageError("Codex 鏉＄洰宸茶鍏朵粬淇敼鏇存柊", "CONFLICT", {
        currentRevision: current.document.revision,
      });
    }
    await this.assertCodexEntryDeletable(seriesId, seriesRoot, entryId);
    await applyFileTransaction(seriesRoot, [
      { targetPath: current.filePath, delete: true },
      { targetPath: current.researchPath, delete: true },
    ]);
    await this.rebuildCodexIndex(seriesRoot);
    return DeleteCodexEntryResultSchema.parse({ deletedId: entryId });
  }

  async listCodexRelations(
    seriesId: string,
    options: { entryId?: string; includeArchived?: boolean } = {},
  ): Promise<CodexRelationDocument[]> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const directory = path.join(seriesRoot, CODEX_DIR, CODEX_RELATIONS_DIR);
    let files;
    try {
      files = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const knownEntryIds = new Set(
      (await this.listCodexEntriesFromRoot(seriesRoot)).map((entry) => entry.metadata.id),
    );
    const knownSceneIds = new Set(
      (await this.getSeries(seriesId)).scenes.map((scene) => scene.metadata.id),
    );
    const relations: CodexRelationDocument[] = [];
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith(".yaml")) continue;
      const filePath = assertInside(seriesRoot, path.join(directory, file.name));
      const raw = await readFile(filePath, "utf8");
      let relation: CodexRelation;
      try {
        relation = CodexRelationSchema.parse(YAML.parse(raw));
      } catch (error) {
        throw new StorageError("Codex 关系 YAML 无效", "INVALID_DATA", {
          relativePath: path.relative(seriesRoot, filePath),
          cause: error instanceof Error ? error.message : String(error),
        });
      }
      if (relation.id !== path.basename(file.name, ".yaml")) {
        throw new StorageError("Codex 关系文件名与 ID 不一致", "INVALID_DATA", {
          relationId: relation.id,
        });
      }
      this.assertCodexRelationReferences(relation, knownEntryIds, knownSceneIds);
      if (!options.includeArchived && relation.archivedAt) continue;
      if (
        options.entryId &&
        relation.sourceEntryId !== options.entryId &&
        relation.targetEntryId !== options.entryId
      ) {
        continue;
      }
      relations.push(
        CodexRelationDocumentSchema.parse({
          relation,
          revision: contentRevision(raw),
        }),
      );
    }
    return relations.sort((left, right) =>
      left.relation.createdAt.localeCompare(right.relation.createdAt),
    );
  }

  async createCodexRelation(
    seriesId: string,
    rawInput: CreateCodexRelationInput,
  ): Promise<CodexRelationDocument> {
    const input = CreateCodexRelationInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const entries = await this.listCodexEntriesFromRoot(seriesRoot);
    const knownEntryIds = new Set(
      entries
        .filter((entry) => entry.metadata.archivedAt === null)
        .map((entry) => entry.metadata.id),
    );
    const knownSceneIds = new Set(
      (await this.getSeries(seriesId)).scenes.map((scene) => scene.metadata.id),
    );
    const now = new Date().toISOString();
    const relation = CodexRelationSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      sourceEntryId: input.sourceEntryId,
      targetEntryId: input.targetEntryId,
      type: input.type,
      directed: input.directed ?? true,
      description: input.description ?? "",
      evidence: input.evidence ?? "",
      validFromSceneId: input.validFromSceneId ?? null,
      validToSceneId: input.validToSceneId ?? null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    });
    this.assertCodexRelationReferences(relation, knownEntryIds, knownSceneIds);
    const raw = serializeYaml(relation);
    await atomicWrite(codexRelationPath(seriesRoot, relation.id), raw);
    return CodexRelationDocumentSchema.parse({
      relation,
      revision: contentRevision(raw),
    });
  }

  async updateCodexRelation(
    seriesId: string,
    relationId: string,
    rawInput: UpdateCodexRelationInput,
  ): Promise<CodexRelationDocument> {
    const input = UpdateCodexRelationInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const current = await this.readCodexRelation(seriesRoot, relationId);
    if (current.revision !== input.baseRevision) {
      throw new StorageError("Codex 关系已被其他修改更新", "CONFLICT", {
        currentRevision: current.revision,
      });
    }
    if (current.relation.archivedAt) {
      throw new StorageError("已归档 Codex 关系不能直接编辑", "INVALID_DATA", {
        relationId,
      });
    }
    const { baseRevision: _baseRevision, ...changes } = input;
    const relation = CodexRelationSchema.parse({
      ...current.relation,
      ...changes,
      updatedAt: new Date().toISOString(),
    });
    const knownEntryIds = new Set(
      (await this.listCodexEntriesFromRoot(seriesRoot)).map(
        (entry) => entry.metadata.id,
      ),
    );
    const knownSceneIds = new Set(
      (await this.getSeries(seriesId)).scenes.map((scene) => scene.metadata.id),
    );
    this.assertCodexRelationReferences(relation, knownEntryIds, knownSceneIds);
    const raw = serializeYaml(relation);
    await atomicWrite(codexRelationPath(seriesRoot, relation.id), raw);
    return CodexRelationDocumentSchema.parse({
      relation,
      revision: contentRevision(raw),
    });
  }

  async archiveCodexRelation(
    seriesId: string,
    relationId: string,
    rawInput: ArchiveCodexDocumentInput,
  ): Promise<CodexRelationDocument> {
    return this.setCodexRelationArchived(seriesId, relationId, rawInput, true);
  }

  async restoreCodexRelation(
    seriesId: string,
    relationId: string,
    rawInput: ArchiveCodexDocumentInput,
  ): Promise<CodexRelationDocument> {
    return this.setCodexRelationArchived(seriesId, relationId, rawInput, false);
  }

  async listCodexProgressions(
    seriesId: string,
    options: {
      entryId?: string;
      relationId?: string;
      includeArchived?: boolean;
    } = {},
  ): Promise<CodexProgressionDocument[]> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const progressions = await this.listCodexProgressionsFromRoot(seriesRoot);
    return progressions
      .filter((document) => options.includeArchived || document.progression.archivedAt === null)
      .filter((document) =>
        !options.entryId ||
        (document.progression.target.kind === "entry" &&
          document.progression.target.entryId === options.entryId),
      )
      .filter((document) =>
        !options.relationId ||
        (document.progression.target.kind === "relation" &&
          document.progression.target.relationId === options.relationId),
      )
      .sort((left, right) =>
        left.progression.createdAt.localeCompare(right.progression.createdAt),
      );
  }

  async getCodexProgression(
    seriesId: string,
    progressionId: string,
  ): Promise<CodexProgressionDocument> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return this.readCodexProgression(seriesRoot, progressionId);
  }

  async createCodexProgression(
    seriesId: string,
    rawInput: CreateCodexProgressionInput,
  ): Promise<CodexProgressionDocument> {
    const input = CreateCodexProgressionInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const now = new Date().toISOString();
    const progression = CodexProgressionSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      target: input.target,
      fieldKey: input.fieldKey ?? "description",
      changeKind: input.changeKind,
      summary: input.summary,
      effectiveFromSceneId: input.effectiveFromSceneId,
      effectiveToSceneId: input.effectiveToSceneId ?? null,
      evidence: input.evidence,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    });
    await this.assertCodexProgressionReferences(seriesId, seriesRoot, progression);
    const raw = serializeYaml(progression);
    await atomicWrite(codexProgressionPath(seriesRoot, progression.id), raw);
    return CodexProgressionDocumentSchema.parse({
      progression,
      revision: contentRevision(raw),
    });
  }

  async updateCodexProgression(
    seriesId: string,
    progressionId: string,
    rawInput: UpdateCodexProgressionInput,
  ): Promise<CodexProgressionDocument> {
    const input = UpdateCodexProgressionInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const current = await this.readCodexProgression(seriesRoot, progressionId);
    if (current.revision !== input.baseRevision) {
      throw new StorageError("进展记录已被其他修改更新", "CONFLICT", {
        currentRevision: current.revision,
      });
    }
    if (current.progression.archivedAt) {
      throw new StorageError("已归档进展记录不能直接编辑", "INVALID_DATA", {
        progressionId,
      });
    }
    const { baseRevision: _baseRevision, ...changes } = input;
    const progression = CodexProgressionSchema.parse({
      ...current.progression,
      ...changes,
      updatedAt: new Date().toISOString(),
    });
    await this.assertCodexProgressionReferences(seriesId, seriesRoot, progression);
    const raw = serializeYaml(progression);
    await atomicWrite(codexProgressionPath(seriesRoot, progression.id), raw);
    return CodexProgressionDocumentSchema.parse({
      progression,
      revision: contentRevision(raw),
    });
  }

  async archiveCodexProgression(
    seriesId: string,
    progressionId: string,
    rawInput: ArchiveCodexDocumentInput,
  ): Promise<CodexProgressionDocument> {
    return this.setCodexProgressionArchived(seriesId, progressionId, rawInput, true);
  }

  async restoreCodexProgression(
    seriesId: string,
    progressionId: string,
    rawInput: ArchiveCodexDocumentInput,
  ): Promise<CodexProgressionDocument> {
    return this.setCodexProgressionArchived(seriesId, progressionId, rawInput, false);
  }

  async listCodexKnowledge(
    seriesId: string,
    options: {
      characterEntryId?: string;
      subjectEntryId?: string;
      relationId?: string;
      includeArchived?: boolean;
    } = {},
  ): Promise<CodexKnowledgeDocument[]> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const knowledge = await this.listCodexKnowledgeFromRoot(seriesRoot);
    return knowledge
      .filter((document) => options.includeArchived || document.knowledge.archivedAt === null)
      .filter((document) =>
        !options.characterEntryId ||
        document.knowledge.characterEntryId === options.characterEntryId,
      )
      .filter((document) =>
        !options.subjectEntryId ||
        document.knowledge.subjectEntryId === options.subjectEntryId,
      )
      .filter((document) =>
        !options.relationId || document.knowledge.relationId === options.relationId,
      )
      .sort((left, right) =>
        left.knowledge.createdAt.localeCompare(right.knowledge.createdAt),
      );
  }

  async getCodexKnowledge(
    seriesId: string,
    knowledgeId: string,
  ): Promise<CodexKnowledgeDocument> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return this.readCodexKnowledge(seriesRoot, knowledgeId);
  }

  async createCodexKnowledge(
    seriesId: string,
    rawInput: CreateCodexKnowledgeInput,
  ): Promise<CodexKnowledgeDocument> {
    const input = CreateCodexKnowledgeInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const now = new Date().toISOString();
    const knowledge = CodexKnowledgeSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      characterEntryId: input.characterEntryId,
      subjectEntryId: input.subjectEntryId ?? null,
      relationId: input.relationId ?? null,
      stance: input.stance,
      summary: input.summary,
      truthProgressionId: input.truthProgressionId ?? null,
      effectiveFromSceneId: input.effectiveFromSceneId,
      effectiveToSceneId: input.effectiveToSceneId ?? null,
      evidence: input.evidence,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    });
    await this.assertCodexKnowledgeReferences(seriesId, seriesRoot, knowledge);
    const raw = serializeYaml(knowledge);
    await atomicWrite(codexKnowledgePath(seriesRoot, knowledge.id), raw);
    return CodexKnowledgeDocumentSchema.parse({
      knowledge,
      revision: contentRevision(raw),
    });
  }

  async updateCodexKnowledge(
    seriesId: string,
    knowledgeId: string,
    rawInput: UpdateCodexKnowledgeInput,
  ): Promise<CodexKnowledgeDocument> {
    const input = UpdateCodexKnowledgeInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const current = await this.readCodexKnowledge(seriesRoot, knowledgeId);
    if (current.revision !== input.baseRevision) {
      throw new StorageError("角色所知已被其他修改更新", "CONFLICT", {
        currentRevision: current.revision,
      });
    }
    if (current.knowledge.archivedAt) {
      throw new StorageError("已归档角色所知不能直接编辑", "INVALID_DATA", {
        knowledgeId,
      });
    }
    const { baseRevision: _baseRevision, ...changes } = input;
    const knowledge = CodexKnowledgeSchema.parse({
      ...current.knowledge,
      ...changes,
      updatedAt: new Date().toISOString(),
    });
    await this.assertCodexKnowledgeReferences(seriesId, seriesRoot, knowledge);
    const raw = serializeYaml(knowledge);
    await atomicWrite(codexKnowledgePath(seriesRoot, knowledge.id), raw);
    return CodexKnowledgeDocumentSchema.parse({
      knowledge,
      revision: contentRevision(raw),
    });
  }

  async archiveCodexKnowledge(
    seriesId: string,
    knowledgeId: string,
    rawInput: ArchiveCodexDocumentInput,
  ): Promise<CodexKnowledgeDocument> {
    return this.setCodexKnowledgeArchived(seriesId, knowledgeId, rawInput, true);
  }

  async restoreCodexKnowledge(
    seriesId: string,
    knowledgeId: string,
    rawInput: ArchiveCodexDocumentInput,
  ): Promise<CodexKnowledgeDocument> {
    return this.setCodexKnowledgeArchived(seriesId, knowledgeId, rawInput, false);
  }

  async getCodexEffectiveState(
    seriesId: string,
    sceneId: string,
    entryId: string,
    viewerEntryId?: string,
  ): Promise<CodexEffectiveState> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const entry = await this.getCodexEntry(seriesId, entryId);
    if (entry.metadata.archivedAt) {
      throw new StorageError("已归档条目不能作为有效状态查询目标", "INVALID_DATA", {
        entryId,
      });
    }
    const { sceneIndexes } = await this.narrativeSceneIndexes(seriesId);
    const narrativeIndex = narrativeIndexForScene(sceneIndexes, sceneId);
    const relations = await this.listCodexRelations(seriesId, {
      entryId,
      includeArchived: false,
    });
    const relationIds = new Set(relations.map((document) => document.relation.id));
    const allProgressions = (await this.listCodexProgressionsFromRoot(seriesRoot))
      .filter((document) => document.progression.archivedAt === null);
    const directProgressions = allProgressions.filter(
      (document) =>
        document.progression.target.kind === "entry" &&
        document.progression.target.entryId === entryId,
    );
    const relationProgressions = allProgressions.filter(
      (document) =>
        document.progression.target.kind === "relation" &&
        Boolean(document.progression.target.relationId) &&
        relationIds.has(document.progression.target.relationId!),
    );
    const relevantProgressions = [...directProgressions, ...relationProgressions];
    const worldFacts = effectiveProgressionsForScene(
      directProgressions,
      narrativeIndex,
      sceneIndexes,
    );
    const relationStates = relations.map((relation) => ({
        relation,
        progressions: effectiveProgressionsForScene(
          relationProgressions.filter(
            (document) =>
              document.progression.target.relationId === relation.relation.id,
          ),
          narrativeIndex,
          sceneIndexes,
        ),
      }));
    const hiddenFutureProgressionCount = relevantProgressions.filter(
      (document) =>
        narrativeIndexForScene(sceneIndexes, document.progression.effectiveFromSceneId) >
        narrativeIndex,
    ).length;

    let characterKnowledge: CodexKnowledgeDocument[] = [];
    let hiddenFutureKnowledgeCount = 0;
    if (viewerEntryId) {
      const viewer = await this.getCodexEntry(seriesId, viewerEntryId);
      if (viewer.metadata.categoryId !== "character" || viewer.metadata.archivedAt) {
        throw new StorageError("角色所知查询的观察者必须是未归档人物", "INVALID_DATA", {
          viewerEntryId,
        });
      }
      const relevantKnowledge = (await this.listCodexKnowledgeFromRoot(seriesRoot))
        .filter((document) => document.knowledge.archivedAt === null)
        .filter((document) => document.knowledge.characterEntryId === viewerEntryId)
        .filter(
          (document) =>
            document.knowledge.subjectEntryId === entryId ||
            (document.knowledge.relationId
              ? relationIds.has(document.knowledge.relationId)
              : false),
        );
      characterKnowledge = relevantKnowledge
        .filter((document) =>
          isActiveForNarrativePosition(
            document.knowledge.effectiveFromSceneId,
            document.knowledge.effectiveToSceneId,
            narrativeIndex,
            sceneIndexes,
          ),
        )
        .sort(
          (left, right) =>
            narrativeIndexForScene(sceneIndexes, left.knowledge.effectiveFromSceneId) -
              narrativeIndexForScene(sceneIndexes, right.knowledge.effectiveFromSceneId) ||
            left.knowledge.createdAt.localeCompare(right.knowledge.createdAt),
        );
      hiddenFutureKnowledgeCount = relevantKnowledge.filter(
        (document) =>
          narrativeIndexForScene(sceneIndexes, document.knowledge.effectiveFromSceneId) >
          narrativeIndex,
      ).length;
    }

    return CodexEffectiveStateSchema.parse({
      sceneId,
      narrativeIndex,
      entry,
      worldFacts,
      relationStates,
      characterKnowledge,
      hiddenFutureProgressionCount,
      hiddenFutureKnowledgeCount,
    });
  }

  async listCodexMentionsForEntry(
    seriesId: string,
    entryId: string,
  ): Promise<CodexMention[]> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    await this.findCodexEntry(seriesRoot, entryId);
    const database = this.openIndex(seriesRoot);
    try {
      return database
        .prepare(
          `SELECT scene_id AS sceneId, entry_id AS entryId, start, end,
                  matched_text AS matchedText, term, is_alias AS isAlias
           FROM codex_mentions WHERE entry_id = ? ORDER BY scene_id, start`,
        )
        .all(entryId)
        .map((row) =>
          CodexMentionSchema.parse({
            ...(row as Record<string, unknown>),
            isAlias: Boolean((row as { isAlias: number }).isAlias),
          }),
        );
    } finally {
      database.close();
    }
  }

  async listCodexMentionsForScene(
    seriesId: string,
    sceneId: string,
  ): Promise<SceneCodexMentions> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    await this.getScene(seriesId, sceneId);
    const database = this.openIndex(seriesRoot);
    try {
      const mentions = database
        .prepare(
          `SELECT scene_id AS sceneId, entry_id AS entryId, start, end,
                  matched_text AS matchedText, term, is_alias AS isAlias
           FROM codex_mentions WHERE scene_id = ? ORDER BY start`,
        )
        .all(sceneId)
        .map((row) =>
          CodexMentionSchema.parse({
            ...(row as Record<string, unknown>),
            isAlias: Boolean((row as { isAlias: number }).isAlias),
          }),
        );
      const ambiguities = database
        .prepare(
          `SELECT scene_id AS sceneId, start, end, matched_text AS matchedText,
                  candidate_entry_ids AS candidateEntryIds
           FROM codex_ambiguities WHERE scene_id = ? ORDER BY start`,
        )
        .all(sceneId)
        .map((row) => {
          const value = row as Record<string, unknown>;
          return CodexAmbiguousMentionSchema.parse({
            ...value,
            candidateEntryIds: JSON.parse(String(value.candidateEntryIds)),
          });
        });
      return SceneCodexMentionsSchema.parse({ sceneId, mentions, ambiguities });
    } finally {
      database.close();
    }
  }

  async previewCodexContext(
    seriesId: string,
    sceneId: string,
    pinnedIds: string[] = [],
  ): Promise<CodexContextPreview> {
    const scene = await this.getScene(seriesId, sceneId);
    const entries = await this.listCodexEntries(seriesId, { includeArchived: true });
    const indexed = await this.listCodexMentionsForScene(seriesId, sceneId);
    const mentionedIds = new Set([
      ...indexed.mentions.map((mention) => mention.entryId),
      ...scene.metadata.characterIds,
      ...scene.metadata.locationIds,
      ...scene.metadata.plotThreadIds,
    ]);
    const pinned = new Set(pinnedIds);
    const knownIds = new Set(entries.map((entry) => entry.metadata.id));
    const unknownPinnedIds = pinnedIds.filter((entryId) => !knownIds.has(entryId));
    if (unknownPinnedIds.length) {
      throw new StorageError("上下文钉住了不存在的 Codex 条目", "INVALID_DATA", {
        unknownPinnedIds,
      });
    }
    const included: CodexEntryDocument[] = [];
    const excluded: Array<{
      entryId: string;
      name: string;
      reason: CodexContextExclusionReason;
    }> = [];
    for (const entry of entries) {
      const eligibility = codexContextEligibility(entry.metadata.aiContextPolicy, {
        mentioned: mentionedIds.has(entry.metadata.id),
        pinned: pinned.has(entry.metadata.id),
        archived: entry.metadata.archivedAt !== null,
      });
      if (eligibility.eligible) included.push(entry);
      else {
        excluded.push({
          entryId: entry.metadata.id,
          name: entry.metadata.name,
          reason: eligibility.reason!,
        });
      }
    }
    return CodexContextPreviewSchema.parse({ sceneId, included, excluded });
  }

  async saveModelProfile(seriesId: string, profile: ModelProfile): Promise<ModelProfile> {
    return saveModelProfile(await this.findSeriesRoot(seriesId), profile);
  }

  async getModelProfile(seriesId: string, profileId: string): Promise<ModelProfile> {
    return getModelProfile(await this.findSeriesRoot(seriesId), profileId);
  }

  async listModelProfiles(seriesId: string): Promise<ModelProfile[]> {
    return listModelProfiles(await this.findSeriesRoot(seriesId));
  }

  async saveAgentRole(seriesId: string, role: AgentRole): Promise<AgentRole> {
    return saveAgentRole(await this.findSeriesRoot(seriesId), role);
  }

  async getAgentRole(seriesId: string, roleId: string): Promise<AgentRole> {
    return getAgentRole(await this.findSeriesRoot(seriesId), roleId);
  }

  async listAgentRoles(seriesId: string): Promise<AgentRole[]> {
    return listAgentRoles(await this.findSeriesRoot(seriesId));
  }

  async savePromptTemplate(seriesId: string, template: PromptTemplate): Promise<PromptTemplate> {
    return savePromptTemplate(await this.findSeriesRoot(seriesId), template);
  }

  async getPromptTemplate(
    seriesId: string,
    promptTemplateId: string,
    version: number,
  ): Promise<PromptTemplate> {
    return getPromptTemplate(await this.findSeriesRoot(seriesId), promptTemplateId, version);
  }

  async listPromptTemplates(seriesId: string): Promise<PromptTemplate[]> {
    return listPromptTemplates(await this.findSeriesRoot(seriesId));
  }

  async savePromptPreset(seriesId: string, preset: PromptPreset): Promise<PromptPreset> {
    return savePromptPreset(await this.findSeriesRoot(seriesId), preset);
  }

  async getPromptPreset(seriesId: string, presetId: string): Promise<PromptPreset> {
    return getPromptPreset(await this.findSeriesRoot(seriesId), presetId);
  }

  async listPromptPresets(seriesId: string): Promise<PromptPreset[]> {
    return listPromptPresets(await this.findSeriesRoot(seriesId));
  }

  async saveContextBundle(seriesId: string, bundle: ContextBundle): Promise<ContextBundle> {
    return saveContextBundle(await this.findSeriesRoot(seriesId), bundle);
  }

  async getContextBundle(seriesId: string, contextBundleId: string): Promise<ContextBundle> {
    return getContextBundle(await this.findSeriesRoot(seriesId), contextBundleId);
  }

  async listContextBundles(seriesId: string): Promise<ContextBundle[]> {
    return listContextBundles(await this.findSeriesRoot(seriesId));
  }

  async saveModelCallLog(seriesId: string, log: ModelCallLog): Promise<ModelCallLog> {
    return saveModelCallLog(await this.findSeriesRoot(seriesId), log);
  }

  async getModelCallLog(seriesId: string, modelCallId: string): Promise<ModelCallLog> {
    return getModelCallLog(await this.findSeriesRoot(seriesId), modelCallId);
  }

  async listModelCallLogs(seriesId: string): Promise<ModelCallLog[]> {
    return listModelCallLogs(await this.findSeriesRoot(seriesId));
  }

  async rebuildAiIndex(seriesId: string): Promise<{
    indexedContextBundles: number;
    indexedModelCalls: number;
  }> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const database = this.openIndex(seriesRoot);
    try {
      return await rebuildAiIndex(seriesRoot, database);
    } finally {
      database.close();
    }
  }

  async searchCodex(seriesId: string, query: string): Promise<CodexSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const database = this.openIndex(seriesRoot);
    try {
      if (Array.from(trimmed).length < 3) {
        return database
          .prepare(
            `SELECT id AS entryId, name, category_id AS categoryId,
                    substr(description, 1, 180) AS excerpt
             FROM codex_entries
             WHERE name LIKE ? OR aliases LIKE ? OR description LIKE ? OR research LIKE ?
             ORDER BY updated_at DESC LIMIT 30`,
          )
          .all(`%${trimmed}%`, `%${trimmed}%`, `%${trimmed}%`, `%${trimmed}%`)
          .map((row) => CodexSearchResultSchema.parse(row));
      }
      const phrase = `"${trimmed.replace(/"/gu, '""')}"`;
      return database
        .prepare(
          `SELECT codex_entries.id AS entryId, codex_entries.name,
                  codex_entries.category_id AS categoryId,
                  snippet(codex_fts, 3, '<mark>', '</mark>', '…', 24) AS excerpt
           FROM codex_fts
           JOIN codex_entries ON codex_entries.id = codex_fts.id
           WHERE codex_fts MATCH ? LIMIT 30`,
        )
        .all(phrase)
        .map((row) => CodexSearchResultSchema.parse(row));
    } finally {
      database.close();
    }
  }

  async rebuildIndex(seriesId: string): Promise<{
    indexedScenes: number;
    indexedCodexEntries: number;
    indexedMentions: number;
    ambiguousMentions: number;
    indexedContextBundles: number;
    indexedModelCalls: number;
  }> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const database = this.openIndex(seriesRoot);
    database.exec(`
      DELETE FROM scene_fts;
      DELETE FROM scenes;
      DELETE FROM codex_fts;
      DELETE FROM codex_entries;
      DELETE FROM codex_mentions;
      DELETE FROM codex_ambiguities;
    `);
    database.close();
    const sceneFiles = await walkSceneFiles(path.join(seriesRoot, "books"));
    for (const filePath of sceneFiles) {
      const scene = parseSceneText(await readFile(filePath, "utf8"), path.relative(seriesRoot, filePath));
      await this.indexScene(seriesRoot, scene, false);
    }
    const codex = await this.rebuildCodexIndex(seriesRoot);
    const ai = await this.rebuildAiIndex(seriesId);
    return { indexedScenes: sceneFiles.length, ...codex, ...ai };
  }

  async search(seriesId: string, query: string): Promise<SearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const database = this.openIndex(seriesRoot);
    try {
      if (Array.from(trimmed).length < 3) {
        return database
          .prepare(
            `SELECT id AS sceneId, title, substr(content, 1, 180) AS excerpt,
                    relative_path AS relativePath
             FROM scenes WHERE title LIKE ? OR content LIKE ? ORDER BY updated_at DESC LIMIT 30`,
          )
          .all(`%${trimmed}%`, `%${trimmed}%`) as SearchResult[];
      }
      const phrase = `"${trimmed.replace(/"/gu, '""')}"`;
      return database
        .prepare(
          `SELECT scenes.id AS sceneId, scenes.title,
                  snippet(scene_fts, 2, '<mark>', '</mark>', '…', 24) AS excerpt,
                  scenes.relative_path AS relativePath
           FROM scene_fts JOIN scenes ON scenes.id = scene_fts.id
           WHERE scene_fts MATCH ? LIMIT 30`,
        )
        .all(phrase) as SearchResult[];
    } finally {
      database.close();
    }
  }

  async getPlanningBoard(seriesId: string): Promise<PlanningBoard> {
    const series = await this.getSeries(seriesId);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const scenesById = new Map(series.scenes.map((scene) => [scene.metadata.id, scene]));
    const narrativeScenes: PlanningScene[] = [];
    let narrativeIndex = 0;
    const books: PlanningBook[] = [];

    for (const book of [...series.books].sort((a, b) => a.order - b.order)) {
      const acts: PlanningAct[] = [];
      for (const act of await this.listActs(seriesId, book.id)) {
        const chapters: PlanningChapter[] = [];
        for (const chapter of await this.listChapters(seriesId, act.id)) {
          const scenes = chapter.sceneIds.map((sceneId) => {
            const scene = scenesById.get(sceneId);
            if (!scene) {
              throw new StorageError("Planning board is missing a scene referenced by a parent manifest", "INVALID_DATA", { sceneId });
            }
            narrativeIndex++;
            const projected = PlanningSceneSchema.parse({
              ...scene.metadata,
              narrativeIndex,
              characterCount: scene.characterCount,
              revision: scene.revision,
            });
            narrativeScenes.push(projected);
            return projected;
          });
          chapters.push({
            id: chapter.id,
            actId: chapter.actId,
            title: chapter.title,
            order: chapter.order,
            scenes,
          });
        }
        acts.push({ id: act.id, bookId: act.bookId, title: act.title, order: act.order, chapters });
      }
      books.push({ id: book.id, title: book.title, order: book.order, acts });
    }

    const { manifest: timeline, events: storyEvents } = await this.loadTimeline(
      seriesRoot,
      series.manifest.updatedAt,
    );
    const knownSceneIds = new Set(narrativeScenes.map((scene) => scene.id));
    for (const document of storyEvents) {
      const duplicateSceneIds = document.event.sceneIds.filter(
        (sceneId, index, values) => values.indexOf(sceneId) !== index,
      );
      const unknownSceneIds = document.event.sceneIds.filter((sceneId) => !knownSceneIds.has(sceneId));
      if (duplicateSceneIds.length || unknownSceneIds.length) {
        throw new StorageError("Story event contains invalid scene references", "INVALID_DATA", {
          eventId: document.event.id,
          duplicateSceneIds: [...new Set(duplicateSceneIds)],
          unknownSceneIds,
        });
      }
    }
    const placed = new Set(storyEvents.flatMap((document) => document.event.sceneIds));
    const dimensions = {
      povs: this.sortedUnique(narrativeScenes.flatMap((scene) => scene.pov ? [scene.pov] : [])),
      characterIds: this.sortedUnique(narrativeScenes.flatMap((scene) => scene.characterIds)),
      locationIds: this.sortedUnique(narrativeScenes.flatMap((scene) => scene.locationIds)),
      plotThreadIds: this.sortedUnique(narrativeScenes.flatMap((scene) => scene.plotThreadIds)),
      tags: this.sortedUnique(narrativeScenes.flatMap((scene) => scene.tags)),
      statuses: this.sortedUnique(narrativeScenes.map((scene) => scene.status)),
    };
    const codexEntries = await this.listCodexEntries(seriesId);
    const codexLabels = Object.fromEntries(
      codexEntries.map((entry) => [entry.metadata.id, entry.metadata.name]),
    );
    const revision = contentRevision(JSON.stringify({
      seriesId,
      sceneRevisions: narrativeScenes.map((scene) => scene.revision),
      hierarchy: books,
      timeline,
      eventRevisions: storyEvents.map((event) => event.revision),
      codexRevisions: codexEntries.map((entry) => entry.revision),
    }));
    return PlanningBoardSchema.parse({
      seriesId,
      revision,
      books,
      narrativeScenes,
      storyEvents,
      unplacedSceneIds: narrativeScenes.filter((scene) => !placed.has(scene.id)).map((scene) => scene.id),
      dimensions,
      codexLabels,
      legacyStoryTimeSceneIds: series.scenes
        .filter((scene) => scene.metadata.storyTime !== null)
        .map((scene) => scene.metadata.id),
    });
  }

  async createTimelineEvent(
    seriesId: string,
    rawInput: CreateTimelineEventInput,
  ): Promise<TimelineEventDocument> {
    const input = CreateTimelineEventInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const series = await this.getSeries(seriesId);
    this.assertTimelineSceneIds(series.scenes, input.sceneIds ?? []);
    const { manifest } = await this.loadTimeline(seriesRoot, series.manifest.updatedAt);
    const now = new Date().toISOString();
    const event = TimelineEventSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      title: input.title,
      timeKind: input.timeKind ?? "unknown",
      timeLabel: input.timeLabel ?? "时间未定",
      startsAt: input.startsAt ?? null,
      precision: input.precision ?? "custom",
      durationMinutes: input.durationMinutes ?? null,
      sceneIds: input.sceneIds ?? [],
      description: input.description ?? "",
      tags: input.tags ?? [],
      createdAt: now,
      updatedAt: now,
    });
    const updatedManifest = TimelineManifestSchema.parse({
      ...manifest,
      eventIds: [...manifest.eventIds, event.id],
      updatedAt: now,
    });
    await applyFileTransaction(seriesRoot, [
      { targetPath: timelineEventPath(seriesRoot, event.id), content: serializeYaml(event) },
      { targetPath: timelineManifestPath(seriesRoot), content: serializeYaml(updatedManifest) },
    ]);
    return this.readTimelineEventDocument(seriesRoot, event.id, updatedManifest.eventIds.length);
  }

  async updateTimelineEvent(
    seriesId: string,
    eventId: string,
    rawInput: UpdateTimelineEventInput,
  ): Promise<TimelineEventDocument> {
    const input = UpdateTimelineEventInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const series = await this.getSeries(seriesId);
    const { manifest } = await this.loadTimeline(seriesRoot, series.manifest.updatedAt);
    const storyIndex = manifest.eventIds.indexOf(eventId) + 1;
    if (storyIndex === 0) throw new StorageError("Story event does not exist", "NOT_FOUND", { eventId });
    const current = await this.readTimelineEventDocument(seriesRoot, eventId, storyIndex);
    if (current.revision !== input.baseRevision) {
      throw new StorageError("故事事件已被其他修改更新", "CONFLICT", {
        currentRevision: current.revision,
        event: current,
      });
    }
    const { baseRevision: _baseRevision, ...changes } = input;
    this.assertTimelineSceneIds(series.scenes, changes.sceneIds ?? current.event.sceneIds);
    const event = TimelineEventSchema.parse({
      ...current.event,
      ...changes,
      updatedAt: new Date().toISOString(),
    });
    await atomicWrite(timelineEventPath(seriesRoot, event.id), serializeYaml(event));
    return this.readTimelineEventDocument(seriesRoot, event.id, storyIndex);
  }

  async deleteTimelineEvent(
    seriesId: string,
    eventId: string,
    rawInput: DeleteTimelineEventInput,
  ): Promise<{ deletedId: string }> {
    const input = DeleteTimelineEventInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const series = await this.getSeries(seriesId);
    const { manifest } = await this.loadTimeline(seriesRoot, series.manifest.updatedAt);
    const storyIndex = manifest.eventIds.indexOf(eventId) + 1;
    if (storyIndex === 0) throw new StorageError("Story event does not exist", "NOT_FOUND", { eventId });
    const current = await this.readTimelineEventDocument(seriesRoot, eventId, storyIndex);
    if (current.revision !== input.baseRevision) {
      throw new StorageError("故事事件已被其他修改更新", "CONFLICT", {
        currentRevision: current.revision,
      });
    }
    const updatedManifest = TimelineManifestSchema.parse({
      ...manifest,
      eventIds: manifest.eventIds.filter((id) => id !== eventId),
      updatedAt: new Date().toISOString(),
    });
    await applyFileTransaction(seriesRoot, [
      { targetPath: timelineEventPath(seriesRoot, eventId), delete: true },
      { targetPath: timelineManifestPath(seriesRoot), content: serializeYaml(updatedManifest) },
    ]);
    return { deletedId: eventId };
  }

  async reorderTimelineEvents(
    seriesId: string,
    rawInput: ReorderInput,
  ): Promise<TimelineEventDocument[]> {
    const input = ReorderInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const series = await this.getSeries(seriesId);
    const { manifest } = await this.loadTimeline(seriesRoot, series.manifest.updatedAt);
    assertExactPermutation(manifest.eventIds, input.orderedIds, "故事事件");
    const updatedManifest = TimelineManifestSchema.parse({
      ...manifest,
      eventIds: input.orderedIds,
      updatedAt: new Date().toISOString(),
    });
    await applyFileTransaction(seriesRoot, [
      { targetPath: timelineManifestPath(seriesRoot), content: serializeYaml(updatedManifest) },
    ]);
    return Promise.all(
      input.orderedIds.map((eventId, index) =>
        this.readTimelineEventDocument(seriesRoot, eventId, index + 1),
      ),
    );
  }

  async getAct(seriesId: string, actId: string): Promise<ActManifest> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const books = await this.readBookManifests(seriesRoot);
    for (const book of books) {
      if (book.actIds.includes(actId)) {
        return this.readReferencedAct(path.join(seriesRoot, "books", book.id), book, actId);
      }
    }
    throw new StorageError("Act does not exist", "NOT_FOUND", { actId });
  }

  async updateBook(
    seriesId: string,
    bookId: string,
    rawInput: UpdateBookInput,
  ): Promise<BookManifest> {
    const input = UpdateBookInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const context = await this.findBookContext(seriesRoot, bookId);
    const updated = BookManifestSchema.parse({
      ...context.book,
      ...input,
      updatedAt: new Date().toISOString(),
    });
    await atomicWrite(path.join(context.bookRoot, BOOK_FILE), serializeYaml(updated));
    return updated;
  }

  async getChapter(seriesId: string, chapterId: string): Promise<ChapterManifest> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return (await this.findChapterContext(seriesRoot, chapterId)).chapter;
  }

  async listActs(seriesId: string, bookId: string): Promise<ActManifest[]> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const bookRoot = assertInside(seriesRoot, path.join(seriesRoot, "books", bookId));
    const book = await readYaml(path.join(bookRoot, BOOK_FILE), (value) =>
      BookManifestSchema.parse(value),
    );
    const acts = await Promise.all(
      book.actIds.map((actId) => this.readReferencedAct(bookRoot, book, actId)),
    );
    if (new Set(book.actIds).size !== book.actIds.length || acts.some((act, index) => act.order !== index + 1)) {
      throw new StorageError("Book act references or order are invalid", "INVALID_DATA", { bookId });
    }
    return acts;
  }

  async listChapters(seriesId: string, actId: string): Promise<ChapterManifest[]> {
    const act = await this.getAct(seriesId, actId);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const bookRoot = assertInside(
      seriesRoot,
      path.join(seriesRoot, "books", act.bookId),
    );
    const chapters = await Promise.all(
      act.chapterIds.map((chapterId) => this.readReferencedChapter(bookRoot, act, chapterId)),
    );
    if (
      new Set(act.chapterIds).size !== act.chapterIds.length ||
      chapters.some((chapter, index) => chapter.order !== index + 1)
    ) {
      throw new StorageError("Act chapter references or order are invalid", "INVALID_DATA", { actId });
    }
    return chapters;
  }

  async createAct(
    seriesId: string,
    bookId: string,
    rawInput: CreateActInput,
  ): Promise<ActManifest> {
    const input = CreateActInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const bookRoot = assertInside(seriesRoot, path.join(seriesRoot, "books", bookId));
    const book = await readYaml(path.join(bookRoot, BOOK_FILE), (value) =>
      BookManifestSchema.parse(value),
    );
    const now = new Date().toISOString();
    const act: ActManifest = ActManifestSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      bookId,
      title: input.title,
      order: book.actIds.length + 1,
      chapterIds: [],
      createdAt: now,
      updatedAt: now,
    });
    const updatedBook = BookManifestSchema.parse({
      ...book,
      actIds: [...book.actIds, act.id],
      updatedAt: now,
    });
    await applyFileTransaction(seriesRoot, [
      { targetPath: actPath(bookRoot, act.id), content: serializeYaml(act) },
      { targetPath: path.join(bookRoot, BOOK_FILE), content: serializeYaml(updatedBook) },
    ]);
    return act;
  }

  async createChapter(
    seriesId: string,
    actId: string,
    rawInput: CreateChapterInput,
  ): Promise<ChapterManifest> {
    const input = CreateChapterInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const act = await this.getAct(seriesId, actId);
    const bookRoot = assertInside(seriesRoot, path.join(seriesRoot, "books", act.bookId));
    const now = new Date().toISOString();
    const chapter: ChapterManifest = ChapterManifestSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      actId,
      title: input.title,
      order: act.chapterIds.length + 1,
      sceneIds: [],
      createdAt: now,
      updatedAt: now,
    });
    const updatedAct = ActManifestSchema.parse({
      ...act,
      chapterIds: [...act.chapterIds, chapter.id],
      updatedAt: now,
    });
    await applyFileTransaction(seriesRoot, [
      { targetPath: chapterPath(bookRoot, chapter.id), content: serializeYaml(chapter) },
      { targetPath: actPath(bookRoot, act.id), content: serializeYaml(updatedAct) },
    ]);
    return chapter;
  }

  async updateAct(
    seriesId: string,
    actId: string,
    rawInput: UpdateActInput,
  ): Promise<ActManifest> {
    const input = UpdateActInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const act = await this.getAct(seriesId, actId);
    const bookRoot = assertInside(seriesRoot, path.join(seriesRoot, "books", act.bookId));
    const updated = ActManifestSchema.parse({
      ...act,
      ...(input.title !== undefined ? { title: input.title } : {}),
      updatedAt: new Date().toISOString(),
    });
    await writeActManifest(bookRoot, updated);
    return updated;
  }

  async updateChapter(
    seriesId: string,
    chapterId: string,
    rawInput: UpdateChapterInput,
  ): Promise<ChapterManifest> {
    const input = UpdateChapterInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const context = await this.findChapterContext(seriesRoot, chapterId);
    const { chapter, bookRoot } = context;
    const updated = ChapterManifestSchema.parse({
      ...chapter,
      ...(input.title !== undefined ? { title: input.title } : {}),
      updatedAt: new Date().toISOString(),
    });
    await writeChapterManifest(bookRoot, updated);
    return updated;
  }

  async deleteScene(seriesId: string, sceneId: string): Promise<{ deletedId: string }> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const context = await this.findChapterContextByScene(seriesRoot, sceneId);
    const now = new Date().toISOString();
    const sceneIds = context.chapter.sceneIds.filter((id) => id !== sceneId);
    if (sceneIds.length === context.chapter.sceneIds.length) {
      throw new StorageError("Chapter does not reference the selected scene", "INVALID_DATA", { sceneId });
    }
    const prepared = await this.prepareOrderedScenes(seriesRoot, context, sceneIds, now);
    const updatedChapter = ChapterManifestSchema.parse({
      ...context.chapter,
      sceneIds,
      updatedAt: now,
    });
    await applyFileTransaction(seriesRoot, [
      ...prepared.map(({ filePath, document }) => ({
        targetPath: filePath,
        content: serializeSceneDocument(document.metadata, document.document),
      })),
      { targetPath: chapterPath(context.bookRoot, context.chapter.id), content: serializeYaml(updatedChapter) },
      { targetPath: context.scenePath, delete: true },
    ]);
    await this.unindexScenes(seriesRoot, [sceneId]);
    for (const { filePath } of prepared) {
      const scene = parseSceneText(await readFile(filePath, "utf8"), path.relative(seriesRoot, filePath));
      await this.indexScene(seriesRoot, scene);
    }
    return { deletedId: sceneId };
  }

  async deleteChapter(seriesId: string, chapterId: string): Promise<{ deletedId: string; deletedSceneIds: string[] }> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const context = await this.findChapterContext(seriesRoot, chapterId);
    const now = new Date().toISOString();
    const chapterIds = context.act.chapterIds.filter((id) => id !== chapterId);
    if (chapterIds.length === context.act.chapterIds.length) {
      throw new StorageError("Act does not reference the selected chapter", "INVALID_DATA", { chapterId });
    }
    const chapters: ChapterManifest[] = [];
    for (let index = 0; index < chapterIds.length; index++) {
      const id = chapterIds[index]!;
      const chapter = await readChapterManifest(context.bookRoot, id);
      chapters.push(ChapterManifestSchema.parse({ ...chapter, order: index + 1, updatedAt: now }));
    }
    const scenePaths = await Promise.all(
      context.chapter.sceneIds.map(async (id) => ({ id, filePath: await this.findScenePath(seriesRoot, id) })),
    );
    const updatedAct = ActManifestSchema.parse({
      ...context.act,
      chapterIds,
      updatedAt: now,
    });
    await applyFileTransaction(seriesRoot, [
      ...chapters.map((chapter) => ({
        targetPath: chapterPath(context.bookRoot, chapter.id),
        content: serializeYaml(chapter),
      })),
      { targetPath: actPath(context.bookRoot, context.act.id), content: serializeYaml(updatedAct) },
      { targetPath: chapterPath(context.bookRoot, chapterId), delete: true },
      ...scenePaths.map(({ filePath }) => ({ targetPath: filePath, delete: true })),
    ]);
    await this.unindexScenes(seriesRoot, scenePaths.map(({ id }) => id));
    return { deletedId: chapterId, deletedSceneIds: scenePaths.map(({ id }) => id) };
  }

  async deleteAct(seriesId: string, actId: string): Promise<{ deletedId: string; deletedChapterIds: string[]; deletedSceneIds: string[] }> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const context = await this.findActContext(seriesRoot, actId);
    const now = new Date().toISOString();
    const actIds = context.book.actIds.filter((id) => id !== actId);
    if (actIds.length === context.book.actIds.length) {
      throw new StorageError("Book does not reference the selected act", "INVALID_DATA", { actId });
    }
    const acts: ActManifest[] = [];
    for (let index = 0; index < actIds.length; index++) {
      const id = actIds[index]!;
      const act = await readActManifest(context.bookRoot, id);
      acts.push(ActManifestSchema.parse({ ...act, order: index + 1, updatedAt: now }));
    }
    const chapters: ChapterManifest[] = [];
    for (const chapterId of context.act.chapterIds) {
      chapters.push(await readChapterManifest(context.bookRoot, chapterId));
    }
    const scenePaths: Array<{ id: string; filePath: string }> = [];
    for (const chapter of chapters) {
      for (const sceneId of chapter.sceneIds) {
        scenePaths.push({ id: sceneId, filePath: await this.findScenePath(seriesRoot, sceneId) });
      }
    }
    const updatedBook = BookManifestSchema.parse({
      ...context.book,
      actIds,
      updatedAt: now,
    });
    await applyFileTransaction(seriesRoot, [
      ...acts.map((act) => ({ targetPath: actPath(context.bookRoot, act.id), content: serializeYaml(act) })),
      { targetPath: path.join(context.bookRoot, BOOK_FILE), content: serializeYaml(updatedBook) },
      { targetPath: actPath(context.bookRoot, actId), delete: true },
      ...chapters.map((chapter) => ({ targetPath: chapterPath(context.bookRoot, chapter.id), delete: true })),
      ...scenePaths.map(({ filePath }) => ({ targetPath: filePath, delete: true })),
    ]);
    await this.unindexScenes(seriesRoot, scenePaths.map(({ id }) => id));
    return {
      deletedId: actId,
      deletedChapterIds: chapters.map((chapter) => chapter.id),
      deletedSceneIds: scenePaths.map(({ id }) => id),
    };
  }

  async moveScene(
    seriesId: string,
    sceneId: string,
    rawInput: MoveSceneInput,
  ): Promise<SceneDocument> {
    const input = MoveSceneInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const source = await this.findChapterContextByScene(seriesRoot, sceneId);
    const target = await this.findChapterContext(seriesRoot, input.targetChapterId);
    if (source.book.id !== target.book.id) {
      throw new StorageError("Moving scenes across books is not supported", "INVALID_DATA", {
        sourceBookId: source.book.id,
        targetBookId: target.book.id,
      });
    }

    if (source.chapter.id === target.chapter.id) {
      if (input.order === undefined) return source.scene;
      const reordered = source.chapter.sceneIds.filter((id) => id !== sceneId);
      const position = Math.min(input.order, reordered.length + 1) - 1;
      reordered.splice(position, 0, sceneId);
      const scenes = await this.reorderScenes(seriesId, source.chapter.id, { orderedIds: reordered });
      return scenes.find((scene) => scene.metadata.id === sceneId)!;
    }

    const now = new Date().toISOString();
    const sourceIds = source.chapter.sceneIds.filter((id) => id !== sceneId);
    if (sourceIds.length === source.chapter.sceneIds.length) {
      throw new StorageError("Source chapter does not reference the selected scene", "INVALID_DATA", { sceneId });
    }
    const targetIds = target.chapter.sceneIds.filter((id) => id !== sceneId);
    const position = Math.min(input.order ?? targetIds.length + 1, targetIds.length + 1) - 1;
    targetIds.splice(position, 0, sceneId);

    const sourceScenes = await this.prepareOrderedScenes(seriesRoot, source, sourceIds, now);
    const targetScenes = await this.prepareOrderedScenes(seriesRoot, target, targetIds, now, source.scene);
    const updatedSourceChapter = ChapterManifestSchema.parse({
      ...source.chapter,
      sceneIds: sourceIds,
      updatedAt: now,
    });
    const updatedTargetChapter = ChapterManifestSchema.parse({
      ...target.chapter,
      sceneIds: targetIds,
      updatedAt: now,
    });
    const destinationPath = path.join(
      target.bookRoot,
      "manuscript",
      target.act.id,
      target.chapter.id,
      `${sceneId}.json`,
    );
    const mutations: FileMutation[] = [
      { targetPath: chapterPath(source.bookRoot, source.chapter.id), content: serializeYaml(updatedSourceChapter) },
      { targetPath: chapterPath(target.bookRoot, target.chapter.id), content: serializeYaml(updatedTargetChapter) },
      ...sourceScenes.map(({ filePath, document }) => ({
        targetPath: filePath,
        content: serializeSceneDocument(document.metadata, document.document),
      })),
      ...targetScenes.map(({ filePath, document }) => ({
        targetPath: document.metadata.id === sceneId ? destinationPath : filePath,
        content: serializeSceneDocument(document.metadata, document.document),
      })),
    ];
    if (path.resolve(source.scenePath) !== path.resolve(destinationPath)) {
      mutations.push({ targetPath: source.scenePath, delete: true });
    }
    await applyFileTransaction(seriesRoot, mutations);
    for (const prepared of [...sourceScenes, ...targetScenes]) {
      const finalPath = prepared.document.metadata.id === sceneId ? destinationPath : prepared.filePath;
      const indexed = parseSceneText(
        await readFile(finalPath, "utf8"),
        path.relative(seriesRoot, finalPath),
      );
      await this.indexScene(seriesRoot, indexed);
    }
    return this.getScene(seriesId, sceneId);
  }

  async reorderActs(
    seriesId: string,
    bookId: string,
    rawInput: ReorderInput,
  ): Promise<ActManifest[]> {
    const input = ReorderInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const bookRoot = assertInside(seriesRoot, path.join(seriesRoot, "books", bookId));
    const book = await readYaml(path.join(bookRoot, BOOK_FILE), (value) =>
      BookManifestSchema.parse(value),
    );

    assertExactPermutation(book.actIds, input.orderedIds, "Act");

    const now = new Date().toISOString();
    const acts: ActManifest[] = [];
    for (let i = 0; i < input.orderedIds.length; i++) {
      const id = input.orderedIds[i]!;
      const act = await readActManifest(bookRoot, id);
      const updated = ActManifestSchema.parse({ ...act, order: i + 1, updatedAt: now });
      acts.push(updated);
    }

    const updatedBook = BookManifestSchema.parse({
      ...book,
      actIds: input.orderedIds,
      updatedAt: now,
    });
    await applyFileTransaction(seriesRoot, [
      ...acts.map((act) => ({ targetPath: actPath(bookRoot, act.id), content: serializeYaml(act) })),
      { targetPath: path.join(bookRoot, BOOK_FILE), content: serializeYaml(updatedBook) },
    ]);
    return acts;
  }

  async reorderChapters(
    seriesId: string,
    actId: string,
    rawInput: ReorderInput,
  ): Promise<ChapterManifest[]> {
    const input = ReorderInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const act = await this.getAct(seriesId, actId);
    const bookRoot = assertInside(seriesRoot, path.join(seriesRoot, "books", act.bookId));

    assertExactPermutation(act.chapterIds, input.orderedIds, "Chapter");

    const now = new Date().toISOString();
    const chapters: ChapterManifest[] = [];
    for (let i = 0; i < input.orderedIds.length; i++) {
      const id = input.orderedIds[i]!;
      const chapter = await readChapterManifest(bookRoot, id);
      const updated = ChapterManifestSchema.parse({
        ...chapter,
        order: i + 1,
        updatedAt: now,
      });
      chapters.push(updated);
    }

    const updatedAct = ActManifestSchema.parse({
      ...act,
      chapterIds: input.orderedIds,
      updatedAt: now,
    });
    await applyFileTransaction(seriesRoot, [
      ...chapters.map((chapter) => ({
        targetPath: chapterPath(bookRoot, chapter.id),
        content: serializeYaml(chapter),
      })),
      { targetPath: actPath(bookRoot, act.id), content: serializeYaml(updatedAct) },
    ]);
    return chapters;
  }

  async reorderScenes(
    seriesId: string,
    chapterId: string,
    rawInput: ReorderInput,
  ): Promise<SceneDocument[]> {
    const input = ReorderInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const context = await this.findChapterContext(seriesRoot, chapterId);
    const { chapter, bookRoot } = context;
    assertExactPermutation(chapter.sceneIds, input.orderedIds, "Scene");

    const now = new Date().toISOString();
    const prepared = await this.prepareOrderedScenes(seriesRoot, context, input.orderedIds, now);

    const updatedChapter = ChapterManifestSchema.parse({
      ...chapter,
      sceneIds: input.orderedIds,
      updatedAt: now,
    });
    await applyFileTransaction(seriesRoot, [
      ...prepared.map(({ filePath, document }) => ({
        targetPath: filePath,
        content: serializeSceneDocument(document.metadata, document.document),
      })),
      { targetPath: chapterPath(bookRoot, chapter.id), content: serializeYaml(updatedChapter) },
    ]);
    const scenes: SceneDocument[] = [];
    for (const { filePath } of prepared) {
      const scene = parseSceneText(await readFile(filePath, "utf8"), path.relative(seriesRoot, filePath));
      await this.indexScene(seriesRoot, scene);
      scenes.push(scene);
    }
    return scenes;
  }

  async migrateToManifests(
    seriesId: string,
  ): Promise<{ actsCreated: number; chaptersCreated: number; snapshotPath: string }> {
    const seriesRoot = await this.findSeriesRoot(seriesId);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const snapshotDir = path.join(seriesRoot, ".studio", "snapshots", `pre-migration-${timestamp}`);
    await mkdir(snapshotDir, { recursive: true });
    await this.copyDir(path.join(seriesRoot, "books"), snapshotDir);

    const sceneFiles = await walkSceneFiles(path.join(seriesRoot, "books"));
    const scenes = await Promise.all(
      sceneFiles.map(async (filePath) =>
        parseSceneText(await readFile(filePath, "utf8"), path.relative(seriesRoot, filePath)),
      ),
    );

    const now = new Date().toISOString();
    const books = await this.readBookManifests(seriesRoot);
    const knownBookIds = new Set(books.map((book) => book.id));
    for (const scene of scenes) {
      if (!knownBookIds.has(scene.metadata.bookId)) {
        throw new StorageError("Legacy scene references a missing book and cannot be migrated", "INVALID_DATA", {
          sceneId: scene.metadata.id,
          bookId: scene.metadata.bookId,
          snapshotPath: path.relative(seriesRoot, snapshotDir),
        });
      }
    }

    const mutations: FileMutation[] = [];
    let actsCreated = 0;
    let chaptersCreated = 0;

    for (const book of books) {
      const bookRoot = path.join(seriesRoot, "books", book.id);
      const bookScenes = scenes.filter((scene) => scene.metadata.bookId === book.id);
      const discoveredActIds = [...new Set(bookScenes.map((scene) => scene.metadata.actId))];
      const actIds = [
        ...book.actIds,
        ...discoveredActIds.filter((actId) => !book.actIds.includes(actId)),
      ];
      const updatedBook = BookManifestSchema.parse({ ...book, actIds, updatedAt: now });
      mutations.push({ targetPath: path.join(bookRoot, BOOK_FILE), content: serializeYaml(updatedBook) });

      for (let actIndex = 0; actIndex < actIds.length; actIndex++) {
        const actId = actIds[actIndex]!;
        const actScenes = bookScenes.filter((scene) => scene.metadata.actId === actId);
        let existingAct: ActManifest | null = null;
        try {
          existingAct = await readActManifest(bookRoot, actId);
        } catch (error) {
          if (!(error instanceof StorageError && error.code === "NOT_FOUND")) throw error;
        }
        const discoveredChapterIds = [...new Set(actScenes.map((scene) => scene.metadata.chapterId))];
        const chapterIds = existingAct
          ? [
              ...existingAct.chapterIds,
              ...discoveredChapterIds.filter((chapterId) => !existingAct!.chapterIds.includes(chapterId)),
            ]
          : discoveredChapterIds;
        const act = ActManifestSchema.parse({
          schemaVersion: 1,
          id: actId,
          bookId: book.id,
          title: existingAct?.title ?? `Act ${actIndex + 1}`,
          order: actIndex + 1,
          chapterIds,
          createdAt: existingAct?.createdAt ?? now,
          updatedAt: now,
        });
        if (!existingAct) actsCreated++;
        mutations.push({ targetPath: actPath(bookRoot, actId), content: serializeYaml(act) });

        for (let chapterIndex = 0; chapterIndex < chapterIds.length; chapterIndex++) {
          const chapterId = chapterIds[chapterIndex]!;
          let existingChapter: ChapterManifest | null = null;
          try {
            existingChapter = await readChapterManifest(bookRoot, chapterId);
          } catch (error) {
            if (!(error instanceof StorageError && error.code === "NOT_FOUND")) throw error;
          }
          const sceneIds = actScenes
            .filter((scene) => scene.metadata.chapterId === chapterId)
            .sort((a, b) => a.metadata.order - b.metadata.order)
            .map((scene) => scene.metadata.id);
          const chapter = ChapterManifestSchema.parse({
            schemaVersion: 1,
            id: chapterId,
            actId,
            title: existingChapter?.title ?? `Chapter ${chapterIndex + 1}`,
            order: chapterIndex + 1,
            sceneIds,
            createdAt: existingChapter?.createdAt ?? now,
            updatedAt: now,
          });
          if (!existingChapter) chaptersCreated++;
          mutations.push({ targetPath: chapterPath(bookRoot, chapterId), content: serializeYaml(chapter) });
        }
      }
    }

    await applyFileTransaction(seriesRoot, mutations);
    const validation = await this.validateHierarchy(seriesId);
    if (!validation.valid) {
      throw new StorageError("迁移后层级校验失败；快照已保留", "INVALID_DATA", {
        snapshotPath: path.relative(seriesRoot, snapshotDir),
        issues: validation.issues,
      });
    }

    return {
      actsCreated,
      chaptersCreated,
      snapshotPath: path.relative(seriesRoot, snapshotDir),
    };
  }
  private async getSeriesWithoutScenes(seriesId: string): Promise<{
    root: string;
    manifest: SeriesManifest;
    books: BookManifest[];
  }> {
    const root = await this.findSeriesRoot(seriesId);
    const manifest = await readYaml(path.join(root, SERIES_FILE), (value) =>
      SeriesManifestSchema.parse(value),
    );
    const books = await Promise.all(
      manifest.bookIds.map((bookId) =>
        readYaml(path.join(root, "books", bookId, BOOK_FILE), (value) =>
          BookManifestSchema.parse(value),
        ),
      ),
    );
    return { root, manifest, books };
  }

  private async readBookManifests(seriesRoot: string): Promise<BookManifest[]> {
    const manifest = await readYaml(path.join(seriesRoot, SERIES_FILE), (value) =>
      SeriesManifestSchema.parse(value),
    );
    return Promise.all(
      manifest.bookIds.map((bookId) =>
        readYaml(path.join(seriesRoot, "books", bookId, BOOK_FILE), (value) =>
          BookManifestSchema.parse(value),
        ),
      ),
    );
  }

  async validateHierarchy(seriesId: string): Promise<HierarchyValidationResult> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const issues: HierarchyIssue[] = [];
    const books = await this.readBookManifests(seriesRoot);
    const referencedActIds = new Set<string>();
    const referencedChapterIds = new Set<string>();
    const referencedSceneIds = new Set<string>();
    let actCount = 0;
    let chapterCount = 0;

    const addIssue = (
      code: string,
      message: string,
      entityId?: string,
      relativePath?: string,
    ) => issues.push({ code, message, entityId, relativePath });
    const addDuplicates = (ids: string[], ownerId: string, kind: string) => {
      for (const id of ids.filter((value, index) => ids.indexOf(value) !== index)) {
        addIssue("DUPLICATE_REFERENCE", `${kind} contains duplicate references`, id, ownerId);
      }
    };

    const sceneFiles = await walkSceneFiles(path.join(seriesRoot, "books"));
    const scenesById = new Map<string, { document: SceneDocument; filePath: string }>();
    for (const filePath of sceneFiles) {
      try {
        const document = parseSceneText(await readFile(filePath, "utf8"), path.relative(seriesRoot, filePath));
        if (scenesById.has(document.metadata.id)) {
          addIssue("DUPLICATE_ENTITY_ID", "Multiple scene files use the same ID", document.metadata.id);
        } else {
          scenesById.set(document.metadata.id, { document, filePath });
        }
      } catch (error) {
        addIssue(
          "INVALID_SCENE_FILE",
          error instanceof Error ? error.message : "Scene file is invalid",
          undefined,
          path.relative(seriesRoot, filePath),
        );
      }
    }

    for (const book of books) {
      const bookReferencedActIds = new Set<string>();
      const bookReferencedChapterIds = new Set<string>();
      addDuplicates(book.actIds, book.id, "book.actIds");
      const bookRoot = path.join(seriesRoot, "books", book.id);
      for (let actIndex = 0; actIndex < book.actIds.length; actIndex++) {
        const actId = book.actIds[actIndex]!;
        if (referencedActIds.has(actId)) addIssue("MULTIPLE_PARENTS", "Act is referenced by multiple books", actId);
        referencedActIds.add(actId);
        bookReferencedActIds.add(actId);
        let act: ActManifest;
        try {
          act = await readActManifest(bookRoot, actId);
          actCount++;
        } catch (error) {
          addIssue("MISSING_ACT", "Book references a missing or invalid act manifest", actId);
          continue;
        }
        if (act.bookId !== book.id) addIssue("ANCESTRY_MISMATCH", "Act bookId does not match its parent book", act.id);
        if (act.order !== actIndex + 1) addIssue("ORDER_MISMATCH", "Act order does not match its parent manifest position", act.id);
        addDuplicates(act.chapterIds, act.id, "act.chapterIds");

        for (let chapterIndex = 0; chapterIndex < act.chapterIds.length; chapterIndex++) {
          const chapterId = act.chapterIds[chapterIndex]!;
          if (referencedChapterIds.has(chapterId)) addIssue("MULTIPLE_PARENTS", "Chapter is referenced by multiple acts", chapterId);
          referencedChapterIds.add(chapterId);
          bookReferencedChapterIds.add(chapterId);
          let chapter: ChapterManifest;
          try {
            chapter = await readChapterManifest(bookRoot, chapterId);
            chapterCount++;
          } catch (error) {
            addIssue("MISSING_CHAPTER", "Act references a missing or invalid chapter manifest", chapterId);
            continue;
          }
          if (chapter.actId !== act.id) addIssue("ANCESTRY_MISMATCH", "Chapter actId does not match its parent act", chapter.id);
          if (chapter.order !== chapterIndex + 1) addIssue("ORDER_MISMATCH", "Chapter order does not match its parent manifest position", chapter.id);
          addDuplicates(chapter.sceneIds, chapter.id, "chapter.sceneIds");

          for (let sceneIndex = 0; sceneIndex < chapter.sceneIds.length; sceneIndex++) {
            const sceneId = chapter.sceneIds[sceneIndex]!;
            if (referencedSceneIds.has(sceneId)) addIssue("MULTIPLE_PARENTS", "Scene is referenced by multiple chapters", sceneId);
            referencedSceneIds.add(sceneId);
            const stored = scenesById.get(sceneId);
            if (!stored) {
              addIssue("MISSING_SCENE", "Chapter references a missing scene file", sceneId);
              continue;
            }
            const { metadata } = stored.document;
            if (
              metadata.bookId !== book.id ||
              metadata.actId !== act.id ||
              metadata.chapterId !== chapter.id
            ) {
              addIssue("ANCESTRY_MISMATCH", "Scene metadata does not match its parent hierarchy", sceneId);
            }
            if (metadata.order !== sceneIndex + 1) {
              addIssue("ORDER_MISMATCH", "Scene order does not match its parent manifest position", sceneId);
            }
            const expectedPath = path.join(
              bookRoot,
              "manuscript",
              act.id,
              chapter.id,
              `${sceneId}.json`,
            );
            if (path.resolve(stored.filePath) !== path.resolve(expectedPath)) {
              addIssue("PATH_MISMATCH", "Scene file path does not match its hierarchy", sceneId, path.relative(seriesRoot, stored.filePath));
            }
          }
        }
      }

      for (const actualId of await this.listManifestIds(path.join(bookRoot, ACTS_DIR))) {
        if (!bookReferencedActIds.has(actualId)) addIssue("ORPHAN_ACT", "Act manifest is not referenced by the current book", actualId);
      }
      for (const actualId of await this.listManifestIds(path.join(bookRoot, CHAPTERS_DIR))) {
        if (!bookReferencedChapterIds.has(actualId)) addIssue("ORPHAN_CHAPTER", "Chapter manifest is not referenced by the current book", actualId);
      }
    }
    for (const sceneId of scenesById.keys()) {
      if (!referencedSceneIds.has(sceneId)) addIssue("ORPHAN_SCENE", "Scene file is not referenced by any chapter", sceneId);
    }

    return {
      valid: issues.length === 0,
      issues,
      bookCount: books.length,
      actCount,
      chapterCount,
      sceneCount: scenesById.size,
    };
  }

  private async readReferencedAct(
    bookRoot: string,
    book: BookManifest,
    actId: string,
  ): Promise<ActManifest> {
    try {
      const act = await readActManifest(bookRoot, actId);
      if (act.bookId !== book.id) {
        throw new StorageError("Act parent book reference does not match", "INVALID_DATA", { actId, bookId: book.id });
      }
      return act;
    } catch (error) {
      if (error instanceof StorageError && error.code === "NOT_FOUND") {
        throw new StorageError("Act parent book reference does not match", "INVALID_DATA", { actId, bookId: book.id });
      }
      throw error;
    }
  }

  private async readReferencedChapter(
    bookRoot: string,
    act: ActManifest,
    chapterId: string,
  ): Promise<ChapterManifest> {
    try {
      const chapter = await readChapterManifest(bookRoot, chapterId);
      if (chapter.actId !== act.id) {
        throw new StorageError("Chapter parent act reference does not match", "INVALID_DATA", { chapterId, actId: act.id });
      }
      return chapter;
    } catch (error) {
      if (error instanceof StorageError && error.code === "NOT_FOUND") {
        throw new StorageError("Chapter parent act reference does not match", "INVALID_DATA", { chapterId, actId: act.id });
      }
      throw error;
    }
  }

  private async readReferencedScene(
    seriesRoot: string,
    book: BookManifest,
    act: ActManifest,
    chapter: ChapterManifest,
    sceneId: string,
  ): Promise<SceneDocument> {
    let filePath: string;
    try {
      filePath = await this.findScenePath(seriesRoot, sceneId);
    } catch (error) {
      if (error instanceof StorageError && error.code === "NOT_FOUND") {
        throw new StorageError("Chapter references a missing scene file", "INVALID_DATA", { sceneId, chapterId: chapter.id });
      }
      throw error;
    }
    const scene = parseSceneText(await readFile(filePath, "utf8"), path.relative(seriesRoot, filePath));
    if (
      scene.metadata.bookId !== book.id ||
      scene.metadata.actId !== act.id ||
      scene.metadata.chapterId !== chapter.id
    ) {
      throw new StorageError("Scene metadata does not match its parent hierarchy", "INVALID_DATA", { sceneId });
    }
    return scene;
  }

  private async findBookContext(seriesRoot: string, bookId: string): Promise<BookContext> {
    const manifest = await readYaml(path.join(seriesRoot, SERIES_FILE), (value) =>
      SeriesManifestSchema.parse(value),
    );
    if (!manifest.bookIds.includes(bookId)) {
      throw new StorageError("Book does not exist or is not referenced by a series", "NOT_FOUND", { bookId });
    }
    const bookRoot = path.join(seriesRoot, "books", bookId);
    const book = await readYaml(path.join(bookRoot, BOOK_FILE), (value) => BookManifestSchema.parse(value));
    return { manifest, book, bookRoot };
  }

  private async findActContext(seriesRoot: string, actId: string): Promise<ActContext> {
    const books = await this.readBookManifests(seriesRoot);
    for (const book of books) {
      if (!book.actIds.includes(actId)) continue;
      const bookRoot = path.join(seriesRoot, "books", book.id);
      const act = await this.readReferencedAct(bookRoot, book, actId);
      return { book, bookRoot, act };
    }
    throw new StorageError("Act does not exist or is not referenced by a book", "NOT_FOUND", { actId });
  }

  private async findChapterContext(seriesRoot: string, chapterId: string): Promise<ChapterContext> {
    const books = await this.readBookManifests(seriesRoot);
    for (const book of books) {
      const bookRoot = path.join(seriesRoot, "books", book.id);
      for (const actId of book.actIds) {
        const act = await this.readReferencedAct(bookRoot, book, actId);
        if (!act.chapterIds.includes(chapterId)) continue;
        const chapter = await this.readReferencedChapter(bookRoot, act, chapterId);
        return { book, bookRoot, act, chapter };
      }
    }
    throw new StorageError("Chapter does not exist or is not referenced by an act", "NOT_FOUND", { chapterId });
  }

  private async findChapterContextByScene(seriesRoot: string, sceneId: string): Promise<SceneContext> {
    const scenePath = await this.findScenePath(seriesRoot, sceneId);
    const scene = parseSceneText(await readFile(scenePath, "utf8"), path.relative(seriesRoot, scenePath));
    const context = await this.findChapterContext(seriesRoot, scene.metadata.chapterId);
    if (!context.chapter.sceneIds.includes(sceneId)) {
      throw new StorageError("Scene metadata does not match its manifest references", "INVALID_DATA", { sceneId });
    }
    if (scene.metadata.bookId !== context.book.id || scene.metadata.actId !== context.act.id) {
      throw new StorageError("Scene metadata does not match its manifest references", "INVALID_DATA", { sceneId });
    }
    return { ...context, scene, scenePath };
  }

  private async prepareOrderedScenes(
    seriesRoot: string,
    context: ChapterContext,
    orderedIds: string[],
    updatedAt: string,
    movedScene?: SceneDocument,
  ): Promise<Array<{ filePath: string; document: SceneDocument }>> {
    const prepared: Array<{ filePath: string; document: SceneDocument }> = [];
    for (let index = 0; index < orderedIds.length; index++) {
      const sceneId = orderedIds[index]!;
      const filePath = movedScene?.metadata.id === sceneId
        ? await this.findScenePath(seriesRoot, sceneId)
        : await this.findScenePath(seriesRoot, sceneId);
      const current = movedScene?.metadata.id === sceneId
        ? movedScene
        : parseSceneText(await readFile(filePath, "utf8"), path.relative(seriesRoot, filePath));
      if (current.metadata.id !== sceneId) {
        throw new StorageError("Scene file ID does not match the manifest reference", "INVALID_DATA", { sceneId });
      }
      if (
        movedScene?.metadata.id !== sceneId &&
        (current.metadata.bookId !== context.book.id ||
          current.metadata.actId !== context.act.id ||
          current.metadata.chapterId !== context.chapter.id)
      ) {
        throw new StorageError("Scene to reorder does not belong to the target chapter", "INVALID_DATA", { sceneId });
      }
      const metadata = SceneFrontmatterSchema.parse({
        ...current.metadata,
        bookId: context.book.id,
        actId: context.act.id,
        chapterId: context.chapter.id,
        order: index + 1,
        updatedAt,
      });
      prepared.push({ filePath, document: { ...current, metadata } });
    }
    return prepared;
  }

  private async listManifestIds(directory: string): Promise<string[]> {
    try {
      return (await readdir(directory, { withFileTypes: true }))
        .filter((entry) => entry.isFile() && entry.name.endsWith(".yaml"))
        .map((entry) => path.basename(entry.name, ".yaml"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  private async loadTimeline(
    seriesRoot: string,
    fallbackUpdatedAt: string,
  ): Promise<{ manifest: TimelineManifest; events: TimelineEventDocument[] }> {
    let manifest: TimelineManifest;
    try {
      manifest = await readYaml(timelineManifestPath(seriesRoot), (value) =>
        TimelineManifestSchema.parse(value),
      );
    } catch (error) {
      if (!(error instanceof StorageError && error.code === "NOT_FOUND")) throw error;
      manifest = TimelineManifestSchema.parse({
        schemaVersion: 1,
        eventIds: [],
        updatedAt: fallbackUpdatedAt,
      });
    }
    if (new Set(manifest.eventIds).size !== manifest.eventIds.length) {
      throw new StorageError("故事时间线包含重复事件 ID", "INVALID_DATA");
    }
    const events: TimelineEventDocument[] = [];
    for (let index = 0; index < manifest.eventIds.length; index++) {
      const eventId = manifest.eventIds[index]!;
      try {
        events.push(await this.readTimelineEventDocument(seriesRoot, eventId, index + 1));
      } catch (error) {
        if (error instanceof StorageError && error.code === "NOT_FOUND") {
          throw new StorageError("Timeline references a missing event file", "INVALID_DATA", { eventId });
        }
        throw error;
      }
    }
    const actualEventIds = await this.listManifestIds(
      path.join(seriesRoot, PLANNING_DIR, TIMELINE_EVENTS_DIR),
    );
    const orphanEventIds = actualEventIds.filter((eventId) => !manifest.eventIds.includes(eventId));
    if (orphanEventIds.length) {
      throw new StorageError("Unreferenced story event files exist", "INVALID_DATA", { orphanEventIds });
    }
    return { manifest, events };
  }

  private async readTimelineEventDocument(
    seriesRoot: string,
    eventId: string,
    storyIndex: number,
  ): Promise<TimelineEventDocument> {
    const filePath = timelineEventPath(seriesRoot, eventId);
    let raw: string;
    try {
      raw = await readFile(filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new StorageError("Story event does not exist", "NOT_FOUND", { eventId });
      }
      throw error;
    }
    let event: TimelineEvent;
    try {
      event = TimelineEventSchema.parse(YAML.parse(raw));
    } catch (error) {
      throw new StorageError("故事事件 YAML 无效", "INVALID_DATA", {
        eventId,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
    if (event.id !== eventId) {
      throw new StorageError("Story event file name and ID differ", "INVALID_DATA", { eventId, actualId: event.id });
    }
    return TimelineEventDocumentSchema.parse({
      event,
      revision: contentRevision(raw),
      storyIndex,
    });
  }

  private assertTimelineSceneIds(scenes: SceneDocument[], sceneIds: string[]): void {
    const known = new Set(scenes.map((scene) => scene.metadata.id));
    const duplicateSceneIds = sceneIds.filter((sceneId, index) => sceneIds.indexOf(sceneId) !== index);
    const unknownSceneIds = sceneIds.filter((sceneId) => !known.has(sceneId));
    if (duplicateSceneIds.length || unknownSceneIds.length) {
      throw new StorageError("Story event scene references are invalid", "INVALID_DATA", {
        duplicateSceneIds: [...new Set(duplicateSceneIds)],
        unknownSceneIds,
      });
    }
  }

  private sortedUnique<T extends string>(values: T[]): T[] {
    return [...new Set(values)].sort((left, right) => left.localeCompare(right, "zh-CN"));
  }

  private async copyDir(source: string, destination: string): Promise<void> {
    const { mkdir: cpMkdir, readdir: cpReaddir, copyFile: cpCopyFile } =
      await import("node:fs/promises");
    await cpMkdir(destination, { recursive: true });
    const entries = await cpReaddir(source, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);
      if (entry.isDirectory()) {
        await this.copyDir(srcPath, destPath);
      } else {
        await cpCopyFile(srcPath, destPath);
      }
    }
  }

  private async findSeriesRoot(seriesId: string): Promise<string> {
    await this.initialize();
    const entries = await readdir(this.libraryRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const root = assertInside(this.libraryRoot, path.join(this.libraryRoot, entry.name));
      try {
        await recoverFileTransactions(root);
        const manifest = await readYaml(path.join(root, SERIES_FILE), (value) =>
          SeriesManifestSchema.parse(value),
        );
        if (manifest.id === seriesId) return root;
      } catch (error) {
        if (error instanceof StorageError) continue;
        throw error;
      }
    }
    throw new StorageError("系列不存在", "NOT_FOUND", { seriesId });
  }

  private async findScenePath(seriesRoot: string, sceneId: string): Promise<string> {
    const files = await walkSceneFiles(path.join(seriesRoot, "books"));
    for (const filePath of files) {
      if (path.basename(filePath, path.extname(filePath)) === sceneId) return filePath;
    }
    throw new StorageError("Scene does not exist", "NOT_FOUND", { sceneId });
  }

  private async findSceneSection(
    seriesRoot: string,
    sectionId: string,
  ): Promise<{ filePath: string; document: SceneSectionDocument }> {
    const sectionsRoot = assertInside(seriesRoot, path.join(seriesRoot, SECTIONS_DIR));
    let sceneDirectories;
    try {
      sceneDirectories = await readdir(sectionsRoot, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new StorageError("Section 不存在", "NOT_FOUND", { sectionId });
      }
      throw error;
    }
    for (const sceneDirectory of sceneDirectories) {
      if (!sceneDirectory.isDirectory()) continue;
      const filePath = assertInside(
        seriesRoot,
        path.join(sectionsRoot, sceneDirectory.name, `${sectionId}.md`),
      );
      if (!(await pathExists(filePath))) continue;
      const document = parseSceneSectionText(
        await readFile(filePath, "utf8"),
        path.relative(seriesRoot, filePath),
      );
      if (
        document.metadata.id !== sectionId ||
        document.metadata.sceneId !== sceneDirectory.name
      ) {
        throw new StorageError("Section file name or scene ownership is inconsistent", "INVALID_DATA", {
          sectionId,
        });
      }
      return { filePath, document };
    }
    throw new StorageError("Section 不存在", "NOT_FOUND", { sectionId });
  }

  private async readCustomCodexCategory(
    seriesRoot: string,
    categoryId: string,
  ): Promise<{ category: CodexCustomCategory; revision: string }> {
    if (CodexBuiltInCategoryIdSchema.safeParse(categoryId).success) {
      throw new StorageError("内置 Codex 类别不能修改或归档", "INVALID_DATA", {
        categoryId,
      });
    }
    const parsedId = CodexCategoryIdSchema.safeParse(categoryId);
    if (!parsedId.success) {
      throw new StorageError("Codex 类别 ID 无效", "NOT_FOUND", { categoryId });
    }
    const filePath = assertInside(seriesRoot, codexCategoryPath(seriesRoot, categoryId));
    let raw: string;
    try {
      raw = await readFile(filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new StorageError("Codex 自定义类别不存在", "NOT_FOUND", { categoryId });
      }
      throw error;
    }
    let category: CodexCustomCategory;
    try {
      category = CodexCustomCategorySchema.parse(YAML.parse(raw));
    } catch (error) {
      throw new StorageError("Codex 自定义类别 YAML 无效", "INVALID_DATA", {
        categoryId,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
    if (category.id !== categoryId) {
      throw new StorageError("Codex 类别文件名与 ID 不一致", "INVALID_DATA", {
        categoryId,
        actualId: category.id,
      });
    }
    return { category, revision: contentRevision(raw) };
  }

  private assertCodexCategoryNameAvailable(
    categories: CodexCategoryDocument[],
    name: string,
    exceptCategoryId?: string,
  ): void {
    const duplicate = categories.find(
      ({ category }) =>
        !category.archivedAt &&
        category.id !== exceptCategoryId &&
        category.name === name,
    );
    if (duplicate) {
      throw new StorageError("Codex category name already exists", "INVALID_DATA", {
        categoryId: duplicate.category.id,
        name,
      });
    }
    /*
    if (duplicate) {
      throw new StorageError("Codex 绫诲埆鍚嶇О宸插瓨鍦?, "INVALID_DATA", {
        categoryId: duplicate.category.id,
        name,
      });
    }
    */
  }

  private async readCodexDetailType(
    seriesRoot: string,
    detailTypeId: string,
  ): Promise<CodexDetailTypeDocument> {
    const filePath = assertInside(seriesRoot, codexDetailTypePath(seriesRoot, detailTypeId));
    let raw: string;
    try {
      raw = await readFile(filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new StorageError("Codex detail type does not exist", "NOT_FOUND", { detailTypeId });
      }
      throw error;
    }
    let detailType: CodexDetailType;
    try {
      detailType = CodexDetailTypeSchema.parse(YAML.parse(raw));
    } catch (error) {
      throw new StorageError("Codex detail type YAML is invalid", "INVALID_DATA", {
        detailTypeId,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
    if (detailType.id !== detailTypeId) {
      throw new StorageError("Codex detail type file name and ID differ", "INVALID_DATA", {
        detailTypeId,
        actualId: detailType.id,
      });
    }
    return CodexDetailTypeDocumentSchema.parse({
      detailType,
      revision: contentRevision(raw),
    });
  }

  private assertCodexDetailTypeNameAvailable(
    detailTypes: CodexDetailTypeDocument[],
    name: string,
    categoryId: CodexCategoryId,
  ): void {
    const normalizedName = name.trim().toLocaleLowerCase("und");
    const duplicate = detailTypes.find(
      (document) =>
        document.detailType.categoryId === categoryId &&
        document.detailType.name.trim().toLocaleLowerCase("und") === normalizedName,
    );
    if (duplicate) {
      throw new StorageError("Codex detail type name already exists", "INVALID_DATA", {
        categoryId,
        detailTypeId: duplicate.detailType.id,
        name,
      });
    }
  }

  private async assertCodexCategoryWritable(
    seriesRoot: string,
    categoryId: CodexCategoryId,
  ): Promise<void> {
    if (CodexBuiltInCategoryIdSchema.safeParse(categoryId).success) return;
    const category = await this.readCustomCodexCategory(seriesRoot, categoryId);
    if (category.category.archivedAt) {
      throw new StorageError("不能在已归档类别中创建 Codex 条目", "INVALID_DATA", {
        categoryId,
      });
    }
  }

  private async setCodexCategoryArchived(
    seriesId: string,
    categoryId: string,
    rawInput: ArchiveCodexDocumentInput,
    archived: boolean,
  ): Promise<CodexCategoryDocument> {
    const input = ArchiveCodexDocumentInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const current = await this.readCustomCodexCategory(seriesRoot, categoryId);
    if (current.revision !== input.baseRevision) {
      throw new StorageError("Codex 类别已被其他修改更新", "CONFLICT", {
        currentRevision: current.revision,
      });
    }
    if (archived) {
      const activeEntries = (await this.listCodexEntriesFromRoot(seriesRoot)).filter(
        (entry) =>
          entry.metadata.categoryId === categoryId && entry.metadata.archivedAt === null,
      );
      if (activeEntries.length) {
        throw new StorageError("归档自定义类别前必须先归档其中条目", "INVALID_DATA", {
          categoryId,
          activeEntryIds: activeEntries.map((entry) => entry.metadata.id),
        });
      }
    }
    if (Boolean(current.category.archivedAt) === archived) {
      return CodexCategoryDocumentSchema.parse({
        category: {
          id: current.category.id,
          name: current.category.name,
          icon: current.category.icon,
          builtIn: false,
          archivedAt: current.category.archivedAt,
        },
        revision: current.revision,
      });
    }
    const now = new Date().toISOString();
    const category = CodexCustomCategorySchema.parse({
      ...current.category,
      updatedAt: now,
      archivedAt: archived ? now : null,
    });
    const raw = serializeYaml(category);
    await atomicWrite(codexCategoryPath(seriesRoot, categoryId), raw);
    return CodexCategoryDocumentSchema.parse({
      category: {
        id: category.id,
        name: category.name,
        icon: category.icon,
        builtIn: false,
        archivedAt: category.archivedAt,
      },
      revision: contentRevision(raw),
    });
  }

  private async codexEntryLocations(
    seriesRoot: string,
  ): Promise<Array<{ filePath: string; categoryId: CodexCategoryId }>> {
    const locations: Array<{ filePath: string; categoryId: CodexCategoryId }> = [];
    for (const category of BUILT_IN_CODEX_CATEGORIES) {
      const directory = path.join(seriesRoot, CODEX_DIR, category.directory);
      let files;
      try {
        files = await readdir(directory, { withFileTypes: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw error;
      }
      for (const file of files) {
        if (!file.isFile() || !file.name.endsWith(".md")) continue;
        locations.push({
          filePath: assertInside(seriesRoot, path.join(directory, file.name)),
          categoryId: category.id,
        });
      }
    }

    const customRoot = path.join(seriesRoot, CODEX_DIR, CODEX_CUSTOM_DIR);
    let categoryDirectories;
    try {
      categoryDirectories = await readdir(customRoot, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return locations;
      throw error;
    }
    for (const categoryDirectory of categoryDirectories) {
      if (!categoryDirectory.isDirectory()) continue;
      const parsedCategoryId = zCodexCategoryId(categoryDirectory.name);
      if (CodexBuiltInCategoryIdSchema.safeParse(parsedCategoryId).success) {
        throw new StorageError("自定义 Codex 目录不能使用内置类别 ID", "INVALID_DATA", {
          categoryId: categoryDirectory.name,
        });
      }
      await this.readCustomCodexCategory(seriesRoot, parsedCategoryId);
      const directory = path.join(customRoot, categoryDirectory.name);
      const files = await readdir(directory, { withFileTypes: true });
      for (const file of files) {
        if (!file.isFile() || !file.name.endsWith(".md")) continue;
        locations.push({
          filePath: assertInside(seriesRoot, path.join(directory, file.name)),
          categoryId: parsedCategoryId,
        });
      }
    }
    return locations;
  }

  private async readCodexEntryAt(
    seriesRoot: string,
    filePath: string,
    expectedCategoryId: CodexCategoryId,
  ): Promise<{
    filePath: string;
    researchPath: string;
    document: CodexEntryDocument;
  }> {
    const raw = await readFile(filePath, "utf8");
    const split = splitMarkdownDocument(
      raw,
      path.relative(seriesRoot, filePath),
      "Codex 条目文件",
    );
    let metadata: CodexEntryMetadata;
    try {
      metadata = CodexEntryMetadataSchema.parse(split.metadata);
    } catch (error) {
      throw new StorageError("Codex 条目 frontmatter 无效", "INVALID_DATA", {
        relativePath: path.relative(seriesRoot, filePath),
        cause: error instanceof Error ? error.message : String(error),
      });
    }
    if (
      metadata.id !== path.basename(filePath, ".md") ||
      metadata.categoryId !== expectedCategoryId
    ) {
      throw new StorageError("Codex 条目文件名、类别目录或 frontmatter 不一致", "INVALID_DATA", {
        entryId: metadata.id,
        expectedCategoryId,
        actualCategoryId: metadata.categoryId,
      });
    }
    const researchPath = assertInside(seriesRoot, codexResearchPath(seriesRoot, metadata.id));
    let researchRaw: string;
    try {
      researchRaw = await readFile(researchPath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new StorageError("Codex 条目缺少独立 Research 文件", "INVALID_DATA", {
          entryId: metadata.id,
        });
      }
      throw error;
    }
    const research = parseCodexResearchText(
      researchRaw,
      path.relative(seriesRoot, researchPath),
    );
    if (research.metadata.entryId !== metadata.id) {
      throw new StorageError("Codex Research 与条目 ID 不一致", "INVALID_DATA", {
        entryId: metadata.id,
        researchEntryId: research.metadata.entryId,
      });
    }
    return {
      filePath,
      researchPath,
      document: parseCodexEntryText(
        raw,
        path.relative(seriesRoot, filePath),
        research,
      ),
    };
  }

  private async listCodexEntriesFromRoot(
    seriesRoot: string,
  ): Promise<CodexEntryDocument[]> {
    const locations = await this.codexEntryLocations(seriesRoot);
    const documents: CodexEntryDocument[] = [];
    const seen = new Set<string>();
    for (const location of locations) {
      const stored = await this.readCodexEntryAt(
        seriesRoot,
        location.filePath,
        location.categoryId,
      );
      if (seen.has(stored.document.metadata.id)) {
        throw new StorageError("多个 Codex 条目文件使用同一 ID", "INVALID_DATA", {
          entryId: stored.document.metadata.id,
        });
      }
      seen.add(stored.document.metadata.id);
      documents.push(stored.document);
    }
    return documents;
  }

  private async findCodexEntry(
    seriesRoot: string,
    entryId: string,
  ): Promise<{
    filePath: string;
    researchPath: string;
    document: CodexEntryDocument;
  }> {
    for (const location of await this.codexEntryLocations(seriesRoot)) {
      if (path.basename(location.filePath, ".md") !== entryId) continue;
      return this.readCodexEntryAt(seriesRoot, location.filePath, location.categoryId);
    }
    throw new StorageError("Codex 条目不存在", "NOT_FOUND", { entryId });
  }

  private async setCodexEntryArchived(
    seriesId: string,
    entryId: string,
    rawInput: ArchiveCodexDocumentInput,
    archived: boolean,
  ): Promise<CodexEntryDocument> {
    const input = ArchiveCodexDocumentInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const current = await this.findCodexEntry(seriesRoot, entryId);
    if (current.document.revision !== input.baseRevision) {
      throw new StorageError("Codex 条目已被其他修改更新", "CONFLICT", {
        currentRevision: current.document.revision,
      });
    }
    if (Boolean(current.document.metadata.archivedAt) === archived) {
      return current.document;
    }
    const now = new Date().toISOString();
    const metadata = CodexEntryMetadataSchema.parse({
      ...current.document.metadata,
      updatedAt: now,
      archivedAt: archived ? now : null,
    });
    await atomicWrite(
      current.filePath,
      serializeMarkdownDocument(metadata, current.document.description),
    );
    await this.rebuildCodexIndex(seriesRoot);
    return (await this.findCodexEntry(seriesRoot, entryId)).document;
  }

  private async assertCodexEntryDeletable(
    seriesId: string,
    seriesRoot: string,
    entryId: string,
  ): Promise<void> {
    const relationIds = (await this.listCodexRelations(seriesId, { includeArchived: true }))
      .filter((document) =>
        document.relation.sourceEntryId === entryId ||
        document.relation.targetEntryId === entryId,
      )
      .map((document) => document.relation.id);
    const progressions = await this.listCodexProgressionsFromRoot(seriesRoot);
    const progressionIds = progressions
      .filter((document) =>
        document.progression.target.entryId === entryId ||
        document.progression.evidence.some(
          (evidence) => evidence.sourceType === "codex-entry" && evidence.sourceId === entryId,
        ),
      )
      .map((document) => document.progression.id);
    const knowledge = await this.listCodexKnowledgeFromRoot(seriesRoot);
    const knowledgeIds = knowledge
      .filter((document) =>
        document.knowledge.characterEntryId === entryId ||
        document.knowledge.subjectEntryId === entryId ||
        document.knowledge.evidence.some(
          (evidence) => evidence.sourceType === "codex-entry" && evidence.sourceId === entryId,
        ),
      )
      .map((document) => document.knowledge.id);
    if (relationIds.length || progressionIds.length || knowledgeIds.length) {
      throw new StorageError("Codex 鏉＄洰宸茶鏁呬簨鐘舵€佸紩鐢紝涓嶈兘鐩存帴鍒犻櫎", "INVALID_DATA", {
        entryId,
        relationIds,
        progressionIds,
        knowledgeIds,
      });
    }
  }

  private async readCodexRelation(
    seriesRoot: string,
    relationId: string,
  ): Promise<CodexRelationDocument> {
    const filePath = assertInside(seriesRoot, codexRelationPath(seriesRoot, relationId));
    let raw: string;
    try {
      raw = await readFile(filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new StorageError("Codex 关系不存在", "NOT_FOUND", { relationId });
      }
      throw error;
    }
    let relation: CodexRelation;
    try {
      relation = CodexRelationSchema.parse(YAML.parse(raw));
    } catch (error) {
      throw new StorageError("Codex 关系 YAML 无效", "INVALID_DATA", {
        relationId,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
    if (relation.id !== relationId) {
      throw new StorageError("Codex 关系文件名与 ID 不一致", "INVALID_DATA", {
        relationId,
        actualId: relation.id,
      });
    }
    return CodexRelationDocumentSchema.parse({
      relation,
      revision: contentRevision(raw),
    });
  }

  private assertCodexRelationReferences(
    relation: CodexRelation,
    knownEntryIds: Set<string>,
    knownSceneIds: Set<string>,
  ): void {
    const unknownEntryIds = [relation.sourceEntryId, relation.targetEntryId].filter(
      (entryId) => !knownEntryIds.has(entryId),
    );
    const unknownSceneIds = [
      relation.validFromSceneId,
      relation.validToSceneId,
    ].filter((sceneId): sceneId is string => Boolean(sceneId) && !knownSceneIds.has(sceneId!));
    if (unknownEntryIds.length || unknownSceneIds.length) {
      throw new StorageError("Codex 关系包含未知引用", "INVALID_DATA", {
        unknownEntryIds: [...new Set(unknownEntryIds)],
        unknownSceneIds: [...new Set(unknownSceneIds)],
      });
    }
  }

  private async setCodexRelationArchived(
    seriesId: string,
    relationId: string,
    rawInput: ArchiveCodexDocumentInput,
    archived: boolean,
  ): Promise<CodexRelationDocument> {
    const input = ArchiveCodexDocumentInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const current = await this.readCodexRelation(seriesRoot, relationId);
    if (current.revision !== input.baseRevision) {
      throw new StorageError("Codex 关系已被其他修改更新", "CONFLICT", {
        currentRevision: current.revision,
      });
    }
    if (Boolean(current.relation.archivedAt) === archived) return current;
    const now = new Date().toISOString();
    const relation = CodexRelationSchema.parse({
      ...current.relation,
      updatedAt: now,
      archivedAt: archived ? now : null,
    });
    const raw = serializeYaml(relation);
    await atomicWrite(codexRelationPath(seriesRoot, relation.id), raw);
    return CodexRelationDocumentSchema.parse({
      relation,
      revision: contentRevision(raw),
    });
  }

  private async readCodexProgression(
    seriesRoot: string,
    progressionId: string,
  ): Promise<CodexProgressionDocument> {
    const filePath = assertInside(seriesRoot, codexProgressionPath(seriesRoot, progressionId));
    let raw: string;
    try {
      raw = await readFile(filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new StorageError("进展记录不存在", "NOT_FOUND", { progressionId });
      }
      throw error;
    }
    let progression: CodexProgression;
    try {
      progression = CodexProgressionSchema.parse(YAML.parse(raw));
    } catch (error) {
      throw new StorageError("进展记录 YAML 无效", "INVALID_DATA", {
        progressionId,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
    if (progression.id !== progressionId) {
      throw new StorageError("进展记录文件名与 ID 不一致", "INVALID_DATA", {
        progressionId,
        actualId: progression.id,
      });
    }
    return CodexProgressionDocumentSchema.parse({
      progression,
      revision: contentRevision(raw),
    });
  }

  private async listCodexProgressionsFromRoot(
    seriesRoot: string,
  ): Promise<CodexProgressionDocument[]> {
    const directory = path.join(seriesRoot, CODEX_DIR, CODEX_PROGRESSIONS_DIR);
    let files;
    try {
      files = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const documents: CodexProgressionDocument[] = [];
    const seen = new Set<string>();
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith(".yaml")) continue;
      const document = await this.readCodexProgression(
        seriesRoot,
        path.basename(file.name, ".yaml"),
      );
      if (seen.has(document.progression.id)) {
        throw new StorageError("多个进展记录文件使用同一 ID", "INVALID_DATA", {
          progressionId: document.progression.id,
        });
      }
      seen.add(document.progression.id);
      documents.push(document);
    }
    return documents;
  }

  private async readCodexKnowledge(
    seriesRoot: string,
    knowledgeId: string,
  ): Promise<CodexKnowledgeDocument> {
    const filePath = assertInside(seriesRoot, codexKnowledgePath(seriesRoot, knowledgeId));
    let raw: string;
    try {
      raw = await readFile(filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new StorageError("角色所知不存在", "NOT_FOUND", { knowledgeId });
      }
      throw error;
    }
    let knowledge: CodexKnowledge;
    try {
      knowledge = CodexKnowledgeSchema.parse(YAML.parse(raw));
    } catch (error) {
      throw new StorageError("角色所知 YAML 无效", "INVALID_DATA", {
        knowledgeId,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
    if (knowledge.id !== knowledgeId) {
      throw new StorageError("角色所知文件名与 ID 不一致", "INVALID_DATA", {
        knowledgeId,
        actualId: knowledge.id,
      });
    }
    return CodexKnowledgeDocumentSchema.parse({
      knowledge,
      revision: contentRevision(raw),
    });
  }

  private async listCodexKnowledgeFromRoot(
    seriesRoot: string,
  ): Promise<CodexKnowledgeDocument[]> {
    const directory = path.join(seriesRoot, CODEX_DIR, CODEX_KNOWLEDGE_DIR);
    let files;
    try {
      files = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const documents: CodexKnowledgeDocument[] = [];
    const seen = new Set<string>();
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith(".yaml")) continue;
      const document = await this.readCodexKnowledge(
        seriesRoot,
        path.basename(file.name, ".yaml"),
      );
      if (seen.has(document.knowledge.id)) {
        throw new StorageError("多个角色所知文件使用同一 ID", "INVALID_DATA", {
          knowledgeId: document.knowledge.id,
        });
      }
      seen.add(document.knowledge.id);
      documents.push(document);
    }
    return documents;
  }

  private async narrativeSceneIndexes(seriesId: string): Promise<{
    sceneIndexes: Map<string, number>;
    scenesById: Map<string, SceneDocument>;
  }> {
    const series = await this.getSeries(seriesId);
    const sceneIndexes = new Map<string, number>();
    const scenesById = new Map<string, SceneDocument>();
    for (let index = 0; index < series.scenes.length; index++) {
      const scene = series.scenes[index]!;
      sceneIndexes.set(scene.metadata.id, index + 1);
      scenesById.set(scene.metadata.id, scene);
    }
    return { sceneIndexes, scenesById };
  }

  private assertEffectiveSceneRange(
    sceneIndexes: Map<string, number>,
    effectiveFromSceneId: string,
    effectiveToSceneId: string | null,
  ): void {
    const fromIndex = narrativeIndexForScene(sceneIndexes, effectiveFromSceneId);
    if (!effectiveToSceneId) return;
    const toIndex = narrativeIndexForScene(sceneIndexes, effectiveToSceneId);
    if (toIndex <= fromIndex) {
      throw new StorageError("Effective end scene must be later than start scene", "INVALID_DATA", {
        effectiveFromSceneId,
        effectiveToSceneId,
      });
    }
  }

  private async assertEvidenceReferences(
    seriesId: string,
    seriesRoot: string,
    evidence: CodexProgression["evidence"],
  ): Promise<void> {
    const { scenesById } = await this.narrativeSceneIndexes(seriesId);
    const entryIds = new Set(
      (await this.listCodexEntriesFromRoot(seriesRoot)).map((entry) => entry.metadata.id),
    );
    const relationIds = new Set(
      (await this.listCodexRelations(seriesId, { includeArchived: true })).map(
        (relation) => relation.relation.id,
      ),
    );
    for (const item of evidence) {
      if (item.sourceType === "scene") {
        const scene = scenesById.get(item.sourceId);
        if (!scene) {
          throw new StorageError("Evidence references an unknown scene", "INVALID_DATA", {
            sourceId: item.sourceId,
          });
        }
        if (item.quote && !scene.content.includes(item.quote)) {
          throw new StorageError("Evidence quote does not appear in the referenced scene content", "INVALID_DATA", {
            sceneId: item.sourceId,
            quote: item.quote,
          });
        }
      } else if (item.sourceType === "codex-entry") {
        if (!entryIds.has(item.sourceId)) {
          throw new StorageError("证据引用未知设定条目", "INVALID_DATA", {
            sourceId: item.sourceId,
          });
        }
      } else if (!relationIds.has(item.sourceId)) {
        throw new StorageError("证据引用未知关系", "INVALID_DATA", {
          sourceId: item.sourceId,
        });
      }
    }
  }

  private async assertCodexProgressionReferences(
    seriesId: string,
    seriesRoot: string,
    progression: CodexProgression,
  ): Promise<void> {
    const { sceneIndexes } = await this.narrativeSceneIndexes(seriesId);
    this.assertEffectiveSceneRange(
      sceneIndexes,
      progression.effectiveFromSceneId,
      progression.effectiveToSceneId,
    );
    if (progression.target.kind === "entry") {
      const entryId = progression.target.entryId!;
      const entry = await this.getCodexEntry(seriesId, entryId);
      if (entry.metadata.archivedAt) {
        throw new StorageError("进展记录不能指向已归档条目", "INVALID_DATA", {
          entryId,
        });
      }
    } else {
      const relationId = progression.target.relationId!;
      const relation = await this.readCodexRelation(seriesRoot, relationId);
      if (relation.relation.archivedAt) {
        throw new StorageError("进展记录不能指向已归档关系", "INVALID_DATA", {
          relationId,
        });
      }
    }
    await this.assertEvidenceReferences(seriesId, seriesRoot, progression.evidence);
  }

  private async assertCodexKnowledgeReferences(
    seriesId: string,
    seriesRoot: string,
    knowledge: CodexKnowledge,
  ): Promise<void> {
    const { sceneIndexes } = await this.narrativeSceneIndexes(seriesId);
    this.assertEffectiveSceneRange(
      sceneIndexes,
      knowledge.effectiveFromSceneId,
      knowledge.effectiveToSceneId,
    );
    const character = await this.getCodexEntry(seriesId, knowledge.characterEntryId);
    if (character.metadata.categoryId !== "character" || character.metadata.archivedAt) {
      throw new StorageError("角色所知的知道者必须是未归档人物", "INVALID_DATA", {
        characterEntryId: knowledge.characterEntryId,
      });
    }
    if (knowledge.subjectEntryId) {
      const subject = await this.getCodexEntry(seriesId, knowledge.subjectEntryId);
      if (subject.metadata.archivedAt) {
        throw new StorageError("角色所知不能指向已归档条目", "INVALID_DATA", {
          subjectEntryId: knowledge.subjectEntryId,
        });
      }
    }
    if (knowledge.relationId) {
      const relation = await this.readCodexRelation(seriesRoot, knowledge.relationId);
      if (relation.relation.archivedAt) {
        throw new StorageError("角色所知不能指向已归档关系", "INVALID_DATA", {
          relationId: knowledge.relationId,
        });
      }
    }
    if (knowledge.truthProgressionId) {
      await this.readCodexProgression(seriesRoot, knowledge.truthProgressionId);
    }
    await this.assertEvidenceReferences(seriesId, seriesRoot, knowledge.evidence);
  }

  private async setCodexProgressionArchived(
    seriesId: string,
    progressionId: string,
    rawInput: ArchiveCodexDocumentInput,
    archived: boolean,
  ): Promise<CodexProgressionDocument> {
    const input = ArchiveCodexDocumentInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const current = await this.readCodexProgression(seriesRoot, progressionId);
    if (current.revision !== input.baseRevision) {
      throw new StorageError("进展记录已被其他修改更新", "CONFLICT", {
        currentRevision: current.revision,
      });
    }
    if (Boolean(current.progression.archivedAt) === archived) return current;
    const progression = CodexProgressionSchema.parse({
      ...current.progression,
      updatedAt: new Date().toISOString(),
      archivedAt: archived ? new Date().toISOString() : null,
    });
    const raw = serializeYaml(progression);
    await atomicWrite(codexProgressionPath(seriesRoot, progression.id), raw);
    return CodexProgressionDocumentSchema.parse({
      progression,
      revision: contentRevision(raw),
    });
  }

  private async setCodexKnowledgeArchived(
    seriesId: string,
    knowledgeId: string,
    rawInput: ArchiveCodexDocumentInput,
    archived: boolean,
  ): Promise<CodexKnowledgeDocument> {
    const input = ArchiveCodexDocumentInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const current = await this.readCodexKnowledge(seriesRoot, knowledgeId);
    if (current.revision !== input.baseRevision) {
      throw new StorageError("角色所知已被其他修改更新", "CONFLICT", {
        currentRevision: current.revision,
      });
    }
    if (Boolean(current.knowledge.archivedAt) === archived) return current;
    const knowledge = CodexKnowledgeSchema.parse({
      ...current.knowledge,
      updatedAt: new Date().toISOString(),
      archivedAt: archived ? new Date().toISOString() : null,
    });
    const raw = serializeYaml(knowledge);
    await atomicWrite(codexKnowledgePath(seriesRoot, knowledge.id), raw);
    return CodexKnowledgeDocumentSchema.parse({
      knowledge,
      revision: contentRevision(raw),
    });
  }

  private async reindexSceneCodexMentions(
    seriesRoot: string,
    scene: SceneDocument,
  ): Promise<void> {
    const entries = (await this.listCodexEntriesFromRoot(seriesRoot)).filter(
      (entry) => entry.metadata.archivedAt === null,
    );
    const result = findCodexMentionsInContent(
      scene.metadata.id,
      scene.content,
      entries,
    );
    const database = this.openIndex(seriesRoot);
    const transaction = database.transaction(() => {
      database.prepare("DELETE FROM codex_mentions WHERE scene_id = ?").run(
        scene.metadata.id,
      );
      database.prepare("DELETE FROM codex_ambiguities WHERE scene_id = ?").run(
        scene.metadata.id,
      );
      const insertMention = database.prepare(
        `INSERT INTO codex_mentions
         (scene_id, entry_id, start, end, matched_text, term, is_alias)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const mention of result.mentions) {
        insertMention.run(
          mention.sceneId,
          mention.entryId,
          mention.start,
          mention.end,
          mention.matchedText,
          mention.term,
          mention.isAlias ? 1 : 0,
        );
      }
      const insertAmbiguity = database.prepare(
        `INSERT INTO codex_ambiguities
         (scene_id, start, end, matched_text, candidate_entry_ids)
         VALUES (?, ?, ?, ?, ?)`,
      );
      for (const ambiguity of result.ambiguities) {
        insertAmbiguity.run(
          ambiguity.sceneId,
          ambiguity.start,
          ambiguity.end,
          ambiguity.matchedText,
          JSON.stringify(ambiguity.candidateEntryIds),
        );
      }
    });
    try {
      transaction();
    } finally {
      database.close();
    }
  }

  private async rebuildCodexIndex(seriesRoot: string): Promise<{
    indexedCodexEntries: number;
    indexedMentions: number;
    ambiguousMentions: number;
  }> {
    const entries = (await this.listCodexEntriesFromRoot(seriesRoot)).filter(
      (entry) => entry.metadata.archivedAt === null,
    );
    const sceneFiles = await walkSceneFiles(path.join(seriesRoot, "books"));
    const scenes = await Promise.all(
      sceneFiles.map(async (filePath) =>
        parseSceneText(await readFile(filePath, "utf8"), path.relative(seriesRoot, filePath)),
      ),
    );
    const database = this.openIndex(seriesRoot);
    const transaction = database.transaction(() => {
      database.exec(`
        DELETE FROM codex_fts;
        DELETE FROM codex_entries;
        DELETE FROM codex_mentions;
        DELETE FROM codex_ambiguities;
      `);
      const insertEntry = database.prepare(
        `INSERT INTO codex_entries
         (id, category_id, name, aliases, description, research, details, relative_path, updated_at, revision)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      const insertFts = database.prepare(
        `INSERT INTO codex_fts (id, name, aliases, description, research, details)
         VALUES (?, ?, ?, ?, ?, ?)`,
      );
      for (const entry of entries) {
        const aliases = entry.metadata.aliases.join(" ");
        const details = Object.entries(entry.metadata.details)
          .map(([key, value]) => `${key} ${value}`)
          .join("\n");
        insertEntry.run(
          entry.metadata.id,
          entry.metadata.categoryId,
          entry.metadata.name,
          aliases,
          entry.description,
          entry.research.content,
          details,
          entry.relativePath,
          entry.metadata.updatedAt,
          entry.revision,
        );
        insertFts.run(
          entry.metadata.id,
          entry.metadata.name,
          aliases,
          entry.description,
          entry.research.content,
          details,
        );
      }
      const insertMention = database.prepare(
        `INSERT INTO codex_mentions
         (scene_id, entry_id, start, end, matched_text, term, is_alias)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      const insertAmbiguity = database.prepare(
        `INSERT INTO codex_ambiguities
         (scene_id, start, end, matched_text, candidate_entry_ids)
         VALUES (?, ?, ?, ?, ?)`,
      );
      for (const scene of scenes) {
        const result = findCodexMentionsInContent(
          scene.metadata.id,
          scene.content,
          entries,
        );
        for (const mention of result.mentions) {
          insertMention.run(
            mention.sceneId,
            mention.entryId,
            mention.start,
            mention.end,
            mention.matchedText,
            mention.term,
            mention.isAlias ? 1 : 0,
          );
        }
        for (const ambiguity of result.ambiguities) {
          insertAmbiguity.run(
            ambiguity.sceneId,
            ambiguity.start,
            ambiguity.end,
            ambiguity.matchedText,
            JSON.stringify(ambiguity.candidateEntryIds),
          );
        }
      }
    });
    try {
      transaction();
      const indexedMentions = (
        database.prepare("SELECT count(*) AS count FROM codex_mentions").get() as {
          count: number;
        }
      ).count;
      const ambiguousMentions = (
        database.prepare("SELECT count(*) AS count FROM codex_ambiguities").get() as {
          count: number;
        }
      ).count;
      return {
        indexedCodexEntries: entries.length,
        indexedMentions,
        ambiguousMentions,
      };
    } finally {
      database.close();
    }
  }

  private openIndex(seriesRoot: string): Database.Database {
    const databasePath = assertInside(seriesRoot, path.join(seriesRoot, ".studio", "index.sqlite"));
    const database = new Database(databasePath);
    database.pragma("journal_mode = WAL");
    database.exec(`
      CREATE TABLE IF NOT EXISTS scenes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        revision TEXT NOT NULL
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS scene_fts USING fts5(
        id UNINDEXED,
        title,
        content,
        tokenize='trigram'
      );
      CREATE TABLE IF NOT EXISTS codex_entries (
        id TEXT PRIMARY KEY,
        category_id TEXT NOT NULL,
        name TEXT NOT NULL,
        aliases TEXT NOT NULL,
        description TEXT NOT NULL,
        research TEXT NOT NULL,
        details TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        revision TEXT NOT NULL
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS codex_fts USING fts5(
        id UNINDEXED,
        name,
        aliases,
        description,
        research,
        details,
        tokenize='trigram'
      );
      CREATE TABLE IF NOT EXISTS codex_mentions (
        scene_id TEXT NOT NULL,
        entry_id TEXT NOT NULL,
        start INTEGER NOT NULL,
        end INTEGER NOT NULL,
        matched_text TEXT NOT NULL,
        term TEXT NOT NULL,
        is_alias INTEGER NOT NULL,
        PRIMARY KEY (scene_id, entry_id, start, end)
      );
      CREATE INDEX IF NOT EXISTS codex_mentions_entry_idx
        ON codex_mentions(entry_id, scene_id, start);
      CREATE TABLE IF NOT EXISTS codex_ambiguities (
        scene_id TEXT NOT NULL,
        start INTEGER NOT NULL,
        end INTEGER NOT NULL,
        matched_text TEXT NOT NULL,
        candidate_entry_ids TEXT NOT NULL,
        PRIMARY KEY (scene_id, start, end)
      );
    `);
    ensureAiIndexTables(database);
    return database;
  }

  private async unindexScenes(seriesRoot: string, sceneIds: string[]): Promise<void> {
    if (sceneIds.length === 0) return;
    const database = this.openIndex(seriesRoot);
    const transaction = database.transaction(() => {
      for (const sceneId of sceneIds) {
        database.prepare("DELETE FROM scene_fts WHERE id = ?").run(sceneId);
        database.prepare("DELETE FROM scenes WHERE id = ?").run(sceneId);
        database.prepare("DELETE FROM codex_mentions WHERE scene_id = ?").run(sceneId);
        database.prepare("DELETE FROM codex_ambiguities WHERE scene_id = ?").run(sceneId);
      }
    });
    try {
      transaction();
    } finally {
      database.close();
    }
  }

  private async indexScene(
    seriesRoot: string,
    scene: SceneDocument,
    refreshCodex = true,
  ): Promise<void> {
    const database = this.openIndex(seriesRoot);
    const transaction = database.transaction(() => {
      database.prepare("DELETE FROM scene_fts WHERE id = ?").run(scene.metadata.id);
      database.prepare("DELETE FROM scenes WHERE id = ?").run(scene.metadata.id);
      database
        .prepare(
          `INSERT INTO scenes (id, title, content, relative_path, updated_at, revision)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          scene.metadata.id,
          scene.metadata.title,
          scene.content,
          scene.relativePath,
          scene.metadata.updatedAt,
          scene.revision,
        );
      database
        .prepare("INSERT INTO scene_fts (id, title, content) VALUES (?, ?, ?)")
        .run(scene.metadata.id, scene.metadata.title, scene.content);
    });
    try {
      transaction();
    } finally {
      database.close();
    }
    if (refreshCodex) await this.reindexSceneCodexMentions(seriesRoot, scene);
  }
}

function zCodexCategoryId(value: string): CodexCategoryId {
  const parsed = CodexCategoryIdSchema.safeParse(value);
  if (!parsed.success) {
    throw new StorageError("自定义 Codex 类别目录名必须是 UUID", "INVALID_DATA", {
      categoryId: value,
    });
  }
  return parsed.data;
}
