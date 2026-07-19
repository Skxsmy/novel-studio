import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import {
  ActManifestSchema,
  ArchiveCodexDocumentInputSchema,
  ArchiveSceneSectionInputSchema,
  BookManifestSchema,
  ChapterManifestSchema,
  assertProposalStatusTransition,
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
  DeleteCodexRelationResultSchema,
  DeleteCodexProgressionResultSchema,
  DeleteWorkshopAttachmentResultSchema,
  DeleteWorkshopMessageResultSchema,
  DeleteWorkshopSessionResultSchema,
  ReplaceWorkshopMessageResultSchema,
  DeleteSeriesInputSchema,
  DeleteSeriesResultSchema,
  DeleteSceneProgressionBlockInputSchema,
  DeleteSceneProgressionBlockResultSchema,
  CodexEntryDocumentSchema,
  CodexDetailTypeAuthoritySchema,
  CodexDetailTypeDocumentSchema,
  CodexDetailTypeMigrationBackupSchema,
  CodexDetailTypeMigrationResultSchema,
  CodexDetailTypeSchema,
  CodexEntryMetadataSchema,
  CodexEffectiveEntrySchema,
  CodexEffectiveStateSchema,
  CodexKnowledgeDocumentSchema,
  CodexKnowledgeSchema,
  CodexMentionSchema,
  CodexProgressionDocumentSchema,
  CodexProgressionSchema,
  CodexProgressionSceneBlockSchema,
  CodexRelationAuthoritySchema,
  CodexRelationDocumentSchema,
  CodexRelationMigrationBackupSchema,
  CodexRelationMigrationResultSchema,
  CodexRelationSchema,
  RollbackCodexRelationMigrationResultSchema,
  RollbackCodexDetailTypeMigrationResultSchema,
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
  migrateCodexDetailTypeV1ToV2,
  migrateCodexRelationV1ToV2,
  CreateSceneProgressionBlockInputSchema,
  CreateSceneProgressionBlockResultSchema,
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
  ProposalApplyResultSchema,
  ProposalBatchAcceptInputSchema,
  ProposalBatchAcceptResultSchema,
  ProposalBatchPreviewInputSchema,
  ProposalBatchPreviewResultSchema,
  ProposalDocumentSchema,
  ProposalInboxSchema,
  ProposalSchema,
  ProposalSnapshotSchema,
  CreateProposalInputSchema,
  EditAndAcceptProposalInputSchema,
  MarkProposalStaleInputSchema,
  ProposalRevisionInputSchema,
  SupersedeProposalInputSchema,
  CreateWorkshopBranchInputSchema,
  CreateWorkshopMessageInputSchema,
  CreateWorkshopSessionInputSchema,
  DEFAULT_WORKSHOP_GENERAL_CHAT_SYSTEM_PROMPT,
  UpdateWorkshopContextBasketInputSchema,
  UpdateWorkshopSessionInputSchema,
  WorkshopBranchSchema,
  WorkshopAgentRunListResultSchema,
  WorkshopAgentRunSchema,
  WorkshopContextBasketSchema,
  WorkshopContextItemRefSchema,
  WorkshopMessageAttachmentSchema,
  WorkshopMessageSourceSchema,
  WorkshopMessageSchema,
  WorkshopSessionSchema,
  WorkshopToolExecutionSchema,
  ReorderInputSchema,
  CreateResearchDatabaseInputSchema,
  ResearchDatabaseSchema,
  ResearchLegacyMigrationResultSchema,
  ResearchSourceContentPageQuerySchema,
  ResearchSourceContentPageSchema,
  ResearchSourceV3Schema,
  ResearchSourceViewSchema,
  RestoreSceneSectionInputSchema,
  type AgentRole,
  SceneBlockDocumentResponseSchema,
  SceneBlockDocumentSchema,
  SceneDocumentSchema,
  SceneFrontmatterSchema,
  SceneMarkdownExportSchema,
  SceneSectionDocumentSchema,
  SceneSectionMetadataSchema,
  SceneCodexMentionsSchema,
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
  UpdateResearchDatabaseInputSchema,
  UpdateActInputSchema,
  UpdateBookInputSchema,
  UpdateChapterInputSchema,
  UpdateSceneBlockDocumentInputSchema,
  UpdateScenePlanningInputSchema,
  UpdateSceneInputSchema,
  UpdateSceneSectionInputSchema,
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
  type CodexDetailTypeMigrationBackup,
  type CodexDetailTypeMigrationResult,
  type CodexEffectiveEntry,
  type CodexEntryDocument,
  type CodexEntryMetadata,
  type CodexFieldProgressionField,
  type CodexEffectiveState,
  type CodexKnowledge,
  type CodexKnowledgeDocument,
  type CodexMention,
  type CodexProgression,
  type CodexProgressionDocument,
  type CodexRelationAuthority,
  type CodexRelation,
  type CodexRelationDocument,
  type CodexRelationMigrationBackup,
  type CodexRelationMigrationResult,
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
  type CreateSceneProgressionBlockInput,
  type CreateSceneProgressionBlockResult,
  type CreateActInput,
  type CreateChapterInput,
  type DeleteCodexCategoryResult,
  type DeleteCodexDocumentInput,
  type DeleteCodexEntryResult,
  type DeleteCodexDetailTypeResult,
  type DeleteCodexRelationBlocker,
  type DeleteCodexRelationResult,
  type DeleteCodexProgressionResult,
  type DeleteWorkshopAttachmentResult,
  type DeleteWorkshopMessageResult,
  type DeleteWorkshopSessionResult,
  type ReplaceWorkshopMessageResult,
  type DeleteSeriesInput,
  type DeleteSeriesResult,
  type DeleteSceneProgressionBlockInput,
  type DeleteSceneProgressionBlockResult,
  type CreateReviewAnchorInput,
  type CreateSceneInput,
  type CreateSceneSectionInput,
  type CreateSeriesInput,
  type CreateTimelineEventInput,
  type DeleteTimelineEventInput,
  type RollbackCodexRelationMigrationResult,
  type RollbackCodexDetailTypeMigrationResult,
  type HierarchyIssue,
  type HierarchyValidationResult,
  type MoveSceneInput,
  type ContextBundle,
  type EmbeddingModelProfile,
  type EmbeddingUseCaseBindingDocument,
  type EmbeddingUseCaseId,
  type ModelCallLog,
  type ModelProfile,
  type PlanningBoard,
  type PlanningAct,
  type PlanningBook,
  type PlanningChapter,
  type PlanningScene,
  type CreateProposalInput,
  type EditAndAcceptProposalInput,
  type MarkProposalStaleInput,
  type Proposal,
  type ProposalApplyResult,
  type ProposalBatchAcceptInput,
  type ProposalBatchAcceptResult,
  type ProposalBatchPreviewInput,
  type ProposalBatchPreviewItem,
  type ProposalBatchPreviewResult,
  type ProposalCandidateSnapshot,
  type ProposalDocument,
  type ProposalInbox,
  type ProposalPatch,
  type ProposalRevisionInput,
  type ProposalSnapshot,
  type SupersedeProposalInput,
  type CreateWorkshopBranchInput,
  type CreateWorkshopMessageInput,
  type CreateWorkshopSessionInput,
  type UpdateWorkshopContextBasketInput,
  type UpdateWorkshopSessionInput,
  type WorkshopBranch,
  type WorkshopAgentRun,
  type WorkshopAgentRunDocument,
  type WorkshopAgentRunListResult,
  type WorkshopContextBasket,
  type WorkshopContextItemRef,
  type WorkshopMessageAttachment,
  type WorkshopMessage,
  type WorkshopMessageSource,
  type WorkshopSession,
  type WorkshopToolExecution,
  type PromptPreset,
  type PromptTemplate,
  type ReorderInput,
  type ResearchSource,
  type ResearchSourceDetail,
  type ResearchSourceContentPage,
  type ResearchSourceContentPageQuery,
  type ResearchSourceDocument,
  type ResearchSourceKind,
  type ResearchSourceMediaType,
  type ResearchSourceProperties,
  type ResearchSourceV3,
  type ResearchSourceView,
  type MigrateResearchSourcesV2Input,
  type ResearchIndexState,
  type ResearchKeywordSearchInput,
  type ResearchKeywordSearchResponse,
  type ResearchSourceV2MigrationResult,
  type CreateResearchDatabaseInput,
  type LegacyResearchSourceGroup,
  type ResearchDatabaseDocument,
  type ResearchDatabaseListResult,
  type ResearchLegacyMigrationResult,
  type UpdateResearchDatabaseInput,
  type RestoreSceneSectionInput,
  type SceneBlock,
  type SceneBlockDocument,
  type SceneBlockDocumentResponse,
  type SceneDocument,
  type SceneCodexMentions,
  type SceneFrontmatter,
  type SceneMarkdownExport,
  type SceneSectionAiPolicy,
  type SceneSectionDocument,
  type SceneSectionMetadata,
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
  type UpdateResearchSourceInput,
  type UpdateSceneBlockDocumentInput,
  type UpdateScenePlanningInput,
  type UpdateSceneInput,
  type UpdateSceneSectionInput,
  type UpdateTimelineEventInput,
} from "@novel-studio/contracts";
import { StorageError } from "./errors.js";
import { assertInside, atomicWrite, pathExists } from "./fileSystem.js";
import {
  applyFileTransaction,
  recoverFileTransactions,
  runSeriesFileTransaction,
  type FileMutation,
} from "./fileTransactions.js";
import {
  deleteEmbeddingUseCaseBinding,
  getAgentRole,
  getContextBundle,
  getEmbeddingModelProfile,
  getEmbeddingUseCaseBinding,
  getModelCallLog,
  getModelProfile,
  getPromptPreset,
  getPromptTemplate,
  listAgentRoles,
  listContextBundles,
  listEmbeddingModelProfiles,
  listEmbeddingUseCaseBindings,
  listModelCallLogs,
  listModelProfiles,
  migrateContextBundlesToV2,
  migrateModelCallLogsToV2,
  migrateModelProfilesToV2,
  listPromptPresets,
  listPromptTemplates,
  rebuildAiIndex,
  rollbackContextBundlesV2Migration,
  rollbackModelCallLogsV2Migration,
  rollbackModelProfilesV2Migration,
  saveAgentRole,
  saveContextBundle,
  saveEmbeddingModelProfile,
  saveEmbeddingUseCaseBinding,
  saveModelCallLog,
  saveModelProfile,
  savePromptPreset,
  savePromptTemplate,
} from "./aiFiles.js";
import {
  inspectIndexDatabase,
  openIndexDatabase,
  rebuildIndexDatabase,
  runIndexWriteLane,
  waitForIndexWriteLane,
  type IndexDatabaseHealth,
  type IndexRebuildOptions,
} from "./indexDatabase.js";
import {
  jsonAuthorityRevision,
  parseJsonAuthorityText,
  readJsonAuthorityFile,
  serializeJsonAuthority,
  writeJsonAuthorityFile,
} from "./jsonAuthority.js";
import {
  createProposalAuthorityFile,
  listProposalAuthorityFiles,
  proposalAuthorityPath,
  proposalSnapshotPath,
  readProposalAuthorityFile,
  writeProposalAuthorityFile,
} from "./proposalFiles.js";
import {
  createResearchDatabaseSourceFile,
  createResearchDatabaseSourceV3File,
  hasLegacyResearchMigrationReceipt,
  listLegacyResearchSourceFiles,
  listResearchDatabaseSourceFiles,
  migrateLegacyResearchSourceFiles,
  migrateResearchDatabaseSourcesV2,
  readLegacyResearchSourceFile,
  readResearchDatabaseSourceFile,
  researchDatabaseOriginalPath,
  researchDatabaseContentPath,
  updateResearchDatabaseSourceFile,
  type ResearchFileTransactionOptions,
} from "./researchFiles.js";
import {
  createResearchDatabaseFile,
  listResearchDatabaseFiles,
  readResearchDatabaseFile,
  researchDatabaseRoot,
  updateResearchDatabaseFile,
  type ResearchDatabaseTransactionOptions,
} from "./researchDatabases.js";
import {
  buildResearchSourceContent,
  type PreparedResearchContent,
} from "./researchContent.js";
import {
  inspectResearchIndex,
  rebuildResearchIndex,
  researchIndexDatabasePath,
  searchResearchIndex,
  type ResearchIndexBuildOptions,
} from "./researchIndex.js";

export {
  INDEX_APPLICATION_ID,
  INDEX_SCHEMA_CHECKSUM,
  INDEX_SCHEMA_VERSION,
  indexDatabasePath,
  inspectIndexDatabase,
  openIndexDatabase,
  rebuildIndexDatabase,
  runIndexWriteLane,
  waitForIndexWriteLane,
  type IndexDatabaseHealth,
  type IndexDatabaseHealthStatus,
  type IndexRebuildContext,
  type IndexRebuildHooks,
  type IndexRebuildOptions,
} from "./indexDatabase.js";
export {
  RESEARCH_INDEX_APPLICATION_ID,
  RESEARCH_INDEX_SCHEMA_CHECKSUM,
  RESEARCH_INDEX_SCHEMA_VERSION,
  inspectResearchIndex,
  rebuildResearchIndex,
  researchIndexDatabasePath,
  searchResearchIndex,
  type ResearchIndexBuildHooks,
  type ResearchIndexBuildOptions,
} from "./researchIndex.js";
import {
  createWorkshopAgentRunFile,
  createWorkshopAttachmentFile,
  createWorkshopSessionFile,
  listWorkshopAgentRunFiles,
  listWorkshopAttachmentFiles,
  listWorkshopBranchFiles,
  listWorkshopMessageFiles,
  listWorkshopSessionFiles,
  migrateWorkshopAuthorityToV2,
  readWorkshopAttachmentFile,
  readWorkshopAgentRunFile,
  readWorkshopContextBasketFile,
  readWorkshopMessageFile,
  readWorkshopSessionFile,
  rollbackWorkshopAuthorityV2Migration,
  workshopAttachmentPath,
  workshopAgentRunPath,
  workshopBranchPath,
  workshopContextBasketPath,
  workshopMessagePath,
  workshopSessionPath,
  writeWorkshopContextBasketFile,
  writeWorkshopAgentRunFile,
  writeWorkshopSessionFile,
} from "./workshopFiles.js";
export * from "./jsonAuthority.js";

export { StorageError } from "./errors.js";
export { pathExists } from "./fileSystem.js";

const FRONTMATTER_MARKER = "---";
const SCENE_JSON_EXTENSION = ".json";
const WORKSHOP_LINKED_CODEX_NOTE = "Linked from selected context.";
const SERIES_FILE = "series.json";

function literalLikePattern(value: string): string {
  return `%${value.replace(/[\\%_]/gu, "\\$&")}%`;
}
const BOOK_FILE = "book.json";
const ACTS_DIR = "acts";
const CHAPTERS_DIR = "chapters";
const PLANNING_DIR = "planning";
const TIMELINE_FILE = "timeline.json";
const TIMELINE_EVENTS_DIR = "events";
const SECTIONS_DIR = "sections";
const WORKSHOP_UNBOUND_CONTEXT_SCENE_ID = "00000000-0000-4000-8000-000000000000";
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

export interface WorkshopCodexDetailTypeCreationCommand {
  id: string;
  name: string;
  nsfw?: boolean;
}

export interface WorkshopCodexProgressionBinding {
  kind: CodexProgression["kind"];
  entryId: string | null;
  relationId: string | null;
  field: CodexProgression["field"];
  fieldKey: string | null;
  effectiveFromSceneId: string;
  effectiveToSceneId: string | null;
}

export type WorkshopCodexProgressionCommand =
  | {
    action: "create";
    input: CreateCodexProgressionInput;
  }
  | {
    action: "update";
    progressionId: string;
    baseRevision: string;
    binding: WorkshopCodexProgressionBinding;
    input: UpdateCodexProgressionInput;
  }
  | {
    action: "delete";
    progressionId: string;
    baseRevision: string;
    binding: WorkshopCodexProgressionBinding;
  };

export interface ExecuteWorkshopCodexCreateCommand {
  sessionId: string;
  messageId: string;
  requestHash: string;
  detailTypeCreations: WorkshopCodexDetailTypeCreationCommand[];
  entryInput: CreateCodexEntryInput;
}

export interface ExecuteWorkshopCodexUpdateCommand {
  sessionId: string;
  messageId: string;
  requestHash: string;
  entryId: string;
  baseEntryRevision: string;
  baseResearchRevision: string;
  detailTypeCreations: WorkshopCodexDetailTypeCreationCommand[];
  entryInput: UpdateCodexEntryInput | null;
  progressions: WorkshopCodexProgressionCommand[];
}

export interface WorkshopCodexCreateCommandResult {
  createdDetailTypes: CodexDetailTypeDocument[];
  entry: CodexEntryDocument;
  message: WorkshopMessage;
  resultMessage: WorkshopMessage;
}

export interface WorkshopCodexUpdateCommandResult extends WorkshopCodexCreateCommandResult {
  createdProgressions: CodexProgressionDocument[];
  deletedProgressions: DeleteCodexProgressionResult[];
  updatedProgressions: CodexProgressionDocument[];
}

function codexProgressionBinding(
  progression: CodexProgression,
): WorkshopCodexProgressionBinding {
  return {
    kind: progression.kind,
    entryId: progression.entryId,
    relationId: progression.relationId,
    field: progression.field,
    fieldKey: progression.fieldKey,
    effectiveFromSceneId: progression.effectiveFromSceneId,
    effectiveToSceneId: progression.effectiveToSceneId,
  };
}

function codexProgressionBindingMatches(
  progression: CodexProgression,
  binding: WorkshopCodexProgressionBinding,
): boolean {
  return JSON.stringify(codexProgressionBinding(progression)) === JSON.stringify(binding);
}

function assertAgentProgressionUpdateDoesNotRetarget(input: UpdateCodexProgressionInput): void {
  const retargetingFields: Array<keyof UpdateCodexProgressionInput> = [
    "kind",
    "entryId",
    "relationId",
    "field",
    "fieldKey",
    "effectiveFromSceneId",
    "effectiveToSceneId",
    "source",
  ];
  const attempted = retargetingFields.filter((field) =>
    Object.prototype.hasOwnProperty.call(input, field)
  );
  if (attempted.length > 0) {
    throw new StorageError(
      "Agent Progression updates cannot change target or Scene binding",
      "INVALID_DATA",
      { fields: attempted },
    );
  }
}

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

const SceneJsonAuthoritySchema = SceneFrontmatterSchema.extend({
  document: SceneBlockDocumentSchema,
});

type SceneJsonAuthority = SceneFrontmatter & { document: SceneBlockDocument };

const SceneSectionAuthoritySchema = SceneSectionDocumentSchema.pick({
  metadata: true,
  content: true,
});

const CodexResearchAuthoritySchema = CodexResearchDocumentSchema.pick({
  metadata: true,
  content: true,
});

const CodexEntryAuthoritySchema = CodexEntryDocumentSchema.pick({
  metadata: true,
  description: true,
});

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
  return serializeJsonAuthority(SceneSectionAuthoritySchema.parse({
    metadata,
    content: normalizedContent,
  }));
}

function parseSceneSectionText(value: string, relativePath: string): SceneSectionDocument {
  const normalized = value.replace(/\r\n/gu, "\n");
  const authority = parseJsonAuthorityText(
    normalized,
    (input) => SceneSectionAuthoritySchema.parse(input),
    "Section JSON authority file",
  );
  return SceneSectionDocumentSchema.parse({
    metadata: authority.metadata,
    content: authority.content,
    revision: jsonAuthorityRevision(normalized),
    relativePath: relativePath.replace(/\\/gu, "/"),
    characterCount: countChineseCharacters(authority.content),
  });
}

function serializeCodexResearch(metadata: CodexResearchMetadata, content: string): string {
  const normalizedContent = content.replace(/\r\n/gu, "\n").replace(/^\n+/u, "");
  return serializeJsonAuthority(CodexResearchAuthoritySchema.parse({
    metadata,
    content: normalizedContent,
  }));
}

function serializeCodexEntry(metadata: CodexEntryMetadata, description: string): string {
  const normalizedDescription = description.replace(/\r\n/gu, "\n").replace(/^\n+/u, "");
  return serializeJsonAuthority(CodexEntryAuthoritySchema.parse({
    metadata,
    description: normalizedDescription,
  }));
}

function parseCodexResearchText(value: string, relativePath: string): CodexResearchDocument {
  const normalized = value.replace(/\r\n/gu, "\n");
  const authority = parseJsonAuthorityText(
    normalized,
    (input) => CodexResearchAuthoritySchema.parse(input),
    "Codex research JSON authority file",
  );
  return CodexResearchDocumentSchema.parse({
    metadata: authority.metadata,
    content: authority.content,
    revision: jsonAuthorityRevision(normalized),
    relativePath: relativePath.replace(/\\/gu, "/"),
  });
}

function parseCodexEntryText(
  value: string,
  relativePath: string,
  research: CodexResearchDocument,
): CodexEntryDocument {
  const normalized = value.replace(/\r\n/gu, "\n");
  const authority = parseJsonAuthorityText(
    normalized,
    (input) => CodexEntryAuthoritySchema.parse(input),
    "Codex entry JSON authority file",
  );
  return CodexEntryDocumentSchema.parse({
    metadata: authority.metadata,
    description: authority.description,
    revision: jsonAuthorityRevision(normalized),
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
): boolean {
  const parsedPolicy = SceneSectionMetadataSchema.shape.aiPolicy.safeParse(policy);
  if (!parsedPolicy.success) return false;
  if (parsedPolicy.data === "never") return false;
  return true;
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
  if (progression.kind === "field") {
    const fieldKey = progression.field?.kind === "detail"
      ? `detail:${progression.field.detailTypeId}`
      : "description";
    return `field:${progression.entryId}:${fieldKey}`;
  }
  if (progression.kind === "world") {
    return `world:${progression.entryId}:${progression.fieldKey}`;
  }
  return `relationship:${progression.relationId}:${progression.fieldKey}`;
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

interface NarrativeBlockPosition {
  sceneIndex: number;
  blockIndex: number;
}

const SCENE_START_BLOCK_INDEX = -1;
const SCENE_END_BLOCK_INDEX = Number.MAX_SAFE_INTEGER;

function codexFieldKey(field: CodexFieldProgressionField): string {
  return field.kind === "description" ? "description" : `detail:${field.detailTypeId}`;
}

function descriptionField(): CodexFieldProgressionField {
  return { kind: "description", detailTypeId: null };
}

function compareNarrativeBlockPositions(
  left: NarrativeBlockPosition,
  right: NarrativeBlockPosition,
): number {
  return left.sceneIndex - right.sceneIndex || left.blockIndex - right.blockIndex;
}

function prependProgressionBody(body: string, current: string): string {
  if (!body) return current;
  if (!current) return body;
  return `${body}\n\n${current}`;
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
      .filter((document) => document.progression.operation === "replace")
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
      if (document.progression.operation !== "add") continue;
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

function effectiveProgressionsForPosition(
  progressions: CodexProgressionDocument[],
  targetPosition: NarrativeBlockPosition,
  sceneIndexes: Map<string, number>,
  progressionBlockPosition: (progression: CodexProgression) => NarrativeBlockPosition,
): CodexProgressionDocument[] {
  const active = progressions
    .filter((document) => document.progression.archivedAt === null)
    .filter((document) =>
      compareNarrativeBlockPositions(progressionBlockPosition(document.progression), targetPosition) <= 0 &&
      isActiveForNarrativePosition(
        document.progression.effectiveFromSceneId,
        document.progression.effectiveToSceneId,
        targetPosition.sceneIndex,
        sceneIndexes,
      ),
    )
    .sort((left, right) => {
      const leftPosition = progressionBlockPosition(left.progression);
      const rightPosition = progressionBlockPosition(right.progression);
      return (
        compareNarrativeBlockPositions(leftPosition, rightPosition) ||
        left.progression.createdAt.localeCompare(right.progression.createdAt)
      );
    });
  const byGroup = new Map<string, CodexProgressionDocument[]>();
  for (const document of active) {
    const key = progressionGroupKey(document.progression);
    byGroup.set(key, [...(byGroup.get(key) ?? []), document]);
  }

  const effective: CodexProgressionDocument[] = [];
  for (const documents of byGroup.values()) {
    const latestReplacement = [...documents]
      .filter((document) => document.progression.operation === "replace")
      .sort((left, right) => {
        const leftPosition = progressionBlockPosition(left.progression);
        const rightPosition = progressionBlockPosition(right.progression);
        return (
          compareNarrativeBlockPositions(rightPosition, leftPosition) ||
          right.progression.createdAt.localeCompare(left.progression.createdAt)
        );
      })[0];
    if (!latestReplacement) {
      effective.push(...documents);
      continue;
    }
    effective.push(latestReplacement);
    const replacementPosition = progressionBlockPosition(latestReplacement.progression);
    for (const document of documents) {
      if (document.progression.operation !== "add") continue;
      const documentPosition = progressionBlockPosition(document.progression);
      const positionComparison = compareNarrativeBlockPositions(documentPosition, replacementPosition);
      if (
        positionComparison > 0 ||
        (positionComparison === 0 &&
          document.progression.createdAt > latestReplacement.progression.createdAt)
      ) {
        effective.push(document);
      }
    }
  }
  return effective.sort((left, right) => {
    const leftPosition = progressionBlockPosition(left.progression);
    const rightPosition = progressionBlockPosition(right.progression);
    return (
      compareNarrativeBlockPositions(leftPosition, rightPosition) ||
      left.progression.createdAt.localeCompare(right.progression.createdAt)
    );
  });
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

async function readJson<T>(filePath: string, parse: (input: unknown) => T): Promise<T> {
  try {
    const document = await readJsonAuthorityFile(
      path.dirname(filePath),
      filePath,
      parse,
      "JSON authority file",
    );
    return document.data;
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code === "ENOENT" ||
      (error instanceof StorageError && error.code === "NOT_FOUND")
    ) {
      throw new StorageError("文件不存在", "NOT_FOUND", { filePath });
    }
    if (error instanceof StorageError) throw error;
    throw new StorageError("JSON authority data is invalid", "INVALID_DATA", {
      filePath,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

function actPath(bookRoot: string, actId: string): string {
  return path.join(bookRoot, ACTS_DIR, `${actId}.json`);
}

function chapterPath(bookRoot: string, chapterId: string): string {
  return path.join(bookRoot, CHAPTERS_DIR, `${chapterId}.json`);
}

function timelineManifestPath(seriesRoot: string): string {
  return path.join(seriesRoot, PLANNING_DIR, TIMELINE_FILE);
}

function timelineEventPath(seriesRoot: string, eventId: string): string {
  return path.join(seriesRoot, PLANNING_DIR, TIMELINE_EVENTS_DIR, `${eventId}.json`);
}

function sectionPath(seriesRoot: string, sceneId: string, sectionId: string): string {
  return path.join(seriesRoot, SECTIONS_DIR, sceneId, `${sectionId}.json`);
}

function reviewAnchorPath(seriesRoot: string, anchorId: string): string {
  return path.join(seriesRoot, REVIEW_DIR, ANCHORS_DIR, `${anchorId}.json`);
}

function codexCategoryPath(seriesRoot: string, categoryId: string): string {
  return path.join(seriesRoot, CODEX_DIR, CODEX_CATEGORIES_DIR, `${categoryId}.json`);
}

function codexDetailTypePath(seriesRoot: string, detailTypeId: string): string {
  return path.join(seriesRoot, CODEX_DIR, CODEX_DETAIL_TYPES_DIR, `${detailTypeId}.json`);
}

function codexDetailTypeMigrationBackupPath(seriesRoot: string, migrationId: string): string {
  return path.join(
    seriesRoot,
    ".studio",
    "snapshots",
    `codex-detail-types-v1-${migrationId}.json`,
  );
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
    ? path.join(seriesRoot, CODEX_DIR, builtInDirectory, `${entryId}.json`)
    : path.join(seriesRoot, CODEX_DIR, CODEX_CUSTOM_DIR, categoryId, `${entryId}.json`);
}

function codexResearchPath(seriesRoot: string, entryId: string): string {
  return path.join(seriesRoot, CODEX_DIR, CODEX_RESEARCH_DIR, `${entryId}.json`);
}

function codexRelationPath(seriesRoot: string, relationId: string): string {
  return path.join(seriesRoot, CODEX_DIR, CODEX_RELATIONS_DIR, `${relationId}.json`);
}

function codexRelationMigrationBackupPath(seriesRoot: string, migrationId: string): string {
  return path.join(
    seriesRoot,
    ".studio",
    "snapshots",
    `codex-relations-v1-${migrationId}.json`,
  );
}

function codexProgressionPath(seriesRoot: string, progressionId: string): string {
  return path.join(seriesRoot, CODEX_DIR, CODEX_PROGRESSIONS_DIR, `${progressionId}.json`);
}

function codexKnowledgePath(seriesRoot: string, knowledgeId: string): string {
  return path.join(seriesRoot, CODEX_DIR, CODEX_KNOWLEDGE_DIR, `${knowledgeId}.json`);
}

async function readActManifest(bookRoot: string, actId: string): Promise<ActManifest> {
  return readJson(actPath(bookRoot, actId), (value) => ActManifestSchema.parse(value));
}

async function readChapterManifest(bookRoot: string, chapterId: string): Promise<ChapterManifest> {
  return readJson(chapterPath(bookRoot, chapterId), (value) => ChapterManifestSchema.parse(value));
}

async function writeActManifest(bookRoot: string, manifest: ActManifest): Promise<void> {
  await atomicWrite(actPath(bookRoot, manifest.id), serializeJsonAuthority(manifest));
}

async function writeChapterManifest(bookRoot: string, manifest: ChapterManifest): Promise<void> {
  await atomicWrite(chapterPath(bookRoot, manifest.id), serializeJsonAuthority(manifest));
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
    else if (
      entry.isFile() &&
      entry.name.endsWith(SCENE_JSON_EXTENSION) &&
      fullPath.split(path.sep).includes("manuscript")
    ) {
      files.push(fullPath);
    }
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

interface PreparedSceneProposalApplication {
  proposal: Proposal;
  scene: SceneDocument;
  sceneId: string;
  scenePath: string;
  sceneContent: string;
  snapshot: ProposalSnapshot;
}

export interface WorkshopToolExecutionClaimResult {
  status: "claimed" | "existing" | "archived";
  message: WorkshopMessage;
}

export interface PreparedResearchSourceImport {
  kind: ResearchSourceKind;
  mediaType: ResearchSourceMediaType;
  originalFileName: string;
  originalBytes: Uint8Array;
  sizeBytes: number;
  contentHash: string;
  properties: ResearchSourceProperties;
  origin: ResearchSourceV3["origin"];
  content: PreparedResearchContent;
}

const workshopSessionMutationTails = new Map<string, Promise<void>>();

async function withWorkshopSessionMutationLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = workshopSessionMutationTails.get(key) ?? Promise.resolve();
  const waitForPrevious = previous.catch(() => undefined);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = waitForPrevious.then(() => gate);
  workshopSessionMutationTails.set(key, tail);
  await waitForPrevious;
  try {
    return await operation();
  } finally {
    release();
    if (workshopSessionMutationTails.get(key) === tail) {
      workshopSessionMutationTails.delete(key);
    }
  }
}

function workshopSessionMutationKey(seriesRoot: string, sessionId: string): string {
  return `${seriesRoot}\u0000${sessionId}`;
}

const workshopAgentStepTransitions: Record<string, Set<string>> = {
  pending: new Set(["pending", "running", "failed", "interrupted", "abandoned", "cancelled"]),
  running: new Set(["running", "succeeded", "failed", "interrupted", "abandoned", "cancelled"]),
  "waiting-confirmation": new Set(["waiting-confirmation", "running", "succeeded", "interrupted", "abandoned"]),
  succeeded: new Set(["succeeded"]),
  failed: new Set(["failed"]),
  interrupted: new Set(["interrupted"]),
  abandoned: new Set(["abandoned"]),
  cancelled: new Set(["cancelled"]),
};

const workshopAgentRunTransitions: Record<string, Set<string>> = {
  running: new Set(["running", "waiting-confirmation", "completed", "failed", "interrupted", "cancelled"]),
  "waiting-confirmation": new Set(["waiting-confirmation", "interrupted", "abandoned"]),
  completed: new Set(["completed"]),
  failed: new Set(["failed", "running", "abandoned"]),
  interrupted: new Set(["interrupted", "running", "waiting-confirmation", "abandoned"]),
  abandoned: new Set(["abandoned"]),
  cancelled: new Set(["cancelled"]),
};

function assertWorkshopAgentRunEvolution(current: WorkshopAgentRun, next: WorkshopAgentRun): void {
  if (!workshopAgentRunTransitions[current.status]?.has(next.status)) {
    throw new StorageError("Workshop Agent run state transition is invalid", "INVALID_DATA", {
      runId: current.id,
      from: current.status,
      to: next.status,
    });
  }
  if (
    current.modelOverride !== next.modelOverride ||
    JSON.stringify(current.parameters) !== JSON.stringify(next.parameters) ||
    JSON.stringify(current.promptSnapshot) !== JSON.stringify(next.promptSnapshot)
  ) {
    throw new StorageError("Workshop Agent run invocation inputs cannot change", "INVALID_DATA", {
      runId: current.id,
    });
  }
  if (current.degradedStructuredOutput && !next.degradedStructuredOutput) {
    throw new StorageError("Workshop Agent run degraded history cannot be cleared", "INVALID_DATA", {
      runId: current.id,
    });
  }
  if (next.steps.length < current.steps.length) {
    throw new StorageError("Workshop Agent run steps are append-only", "INVALID_DATA", { runId: current.id });
  }
  for (let index = 0; index < current.steps.length; index += 1) {
    const before = current.steps[index]!;
    const after = next.steps[index]!;
    const clearedUnusedModelCallReservation = (
      before.modelCallId !== null &&
      after.modelCallId === null &&
      ["pending", "running"].includes(before.status) &&
      ["failed", "cancelled"].includes(after.status)
    );
    if (
      before.id !== after.id ||
      before.index !== after.index ||
      before.kind !== after.kind ||
      before.attempt !== after.attempt ||
      (before.modelCallId !== after.modelCallId && !clearedUnusedModelCallReservation) ||
      JSON.stringify(before.promptSnapshot) !== JSON.stringify(after.promptSnapshot) ||
      JSON.stringify(before.inputMessageIds) !== JSON.stringify(after.inputMessageIds) ||
      before.degradedStructuredOutput !== after.degradedStructuredOutput ||
      before.startedAt !== after.startedAt
    ) {
      throw new StorageError("Workshop Agent step immutable fields changed", "INVALID_DATA", {
        runId: current.id,
        stepId: before.id,
      });
    }
    if (!workshopAgentStepTransitions[before.status]?.has(after.status)) {
      throw new StorageError("Workshop Agent step state transition is invalid", "INVALID_DATA", {
        runId: current.id,
        stepId: before.id,
        from: before.status,
        to: after.status,
      });
    }
    if (before.messageId !== null && before.messageId !== after.messageId) {
      throw new StorageError("Workshop Agent step message link cannot change", "INVALID_DATA", {
        runId: current.id,
        stepId: before.id,
      });
    }
    if (
      ["succeeded", "failed", "interrupted", "abandoned", "cancelled"].includes(before.status) &&
      JSON.stringify(before) !== JSON.stringify(after)
    ) {
      throw new StorageError("Terminal Workshop Agent steps cannot change", "INVALID_DATA", {
        runId: current.id,
        stepId: before.id,
      });
    }
  }
}

export class ProjectRepository {
  readonly libraryRoot: string;
  private readonly recoveredSeriesRoots = new Set<string>();
  private readonly seriesIdsByRoot = new Map<string, string>();

  constructor(libraryRoot: string) {
    this.libraryRoot = path.resolve(libraryRoot);
  }

  async initialize(): Promise<void> {
    await mkdir(this.libraryRoot, { recursive: true });
  }

  async getIndexDatabaseHealth(seriesId: string): Promise<IndexDatabaseHealth> {
    return inspectIndexDatabase(await this.findSeriesRoot(seriesId), seriesId);
  }

  async listResearchDatabases(): Promise<ResearchDatabaseListResult> {
    await this.initialize();
    return listResearchDatabaseFiles(this.libraryRoot);
  }

  async getResearchDatabase(databaseId: string): Promise<ResearchDatabaseDocument> {
    await this.initialize();
    return readResearchDatabaseFile(this.libraryRoot, databaseId);
  }

  async createResearchDatabase(
    rawInput: CreateResearchDatabaseInput,
    transactionOptions: ResearchDatabaseTransactionOptions = {},
  ): Promise<ResearchDatabaseDocument> {
    await this.initialize();
    const input = CreateResearchDatabaseInputSchema.parse(rawInput);
    const now = new Date().toISOString();
    return createResearchDatabaseFile(this.libraryRoot, ResearchDatabaseSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      name: input.name,
      description: input.description,
      linkedSeriesIds: [],
      createdAt: now,
      updatedAt: now,
    }), transactionOptions);
  }

  async updateResearchDatabase(
    databaseId: string,
    rawInput: UpdateResearchDatabaseInput,
  ): Promise<ResearchDatabaseDocument> {
    const input = UpdateResearchDatabaseInputSchema.parse(rawInput);
    if (input.linkedSeriesIds) {
      await Promise.all(input.linkedSeriesIds.map((seriesId) => this.findSeriesRoot(seriesId)));
    }
    return updateResearchDatabaseFile(this.libraryRoot, databaseId, input);
  }

  async listResearchSources(researchDatabaseId: string): Promise<ResearchSourceDocument[]> {
    await this.getResearchDatabase(researchDatabaseId);
    return listResearchDatabaseSourceFiles(
      researchDatabaseRoot(this.libraryRoot, researchDatabaseId),
      researchDatabaseId,
    );
  }

  async getResearchSource(researchDatabaseId: string, sourceId: string): Promise<ResearchSourceDetail> {
    await this.getResearchDatabase(researchDatabaseId);
    return readResearchDatabaseSourceFile(
      researchDatabaseRoot(this.libraryRoot, researchDatabaseId),
      researchDatabaseId,
      sourceId,
    );
  }

  async getResearchSourceView(researchDatabaseId: string, sourceId: string): Promise<ResearchSourceView> {
    const detail = await this.getResearchSource(researchDatabaseId, sourceId);
    if ("originalText" in detail) return ResearchSourceViewSchema.parse(detail);
    return ResearchSourceViewSchema.parse({
      source: detail.source,
      revision: detail.revision,
      contentSummary: {
        title: detail.content.title,
        sectionCount: detail.content.sections.length,
        blockCount: detail.content.blocks.length,
        chunkCount: detail.content.chunks.length,
      },
    });
  }

  async getResearchSourceContentPage(
    researchDatabaseId: string,
    sourceId: string,
    rawQuery: ResearchSourceContentPageQuery,
  ): Promise<ResearchSourceContentPage> {
    const query = ResearchSourceContentPageQuerySchema.parse(rawQuery);
    const detail = await this.getResearchSource(researchDatabaseId, sourceId);
    if (!("content" in detail)) {
      throw new StorageError("Upgrade this older Research source before opening structured pages", "INVALID_DATA", {
        sourceId,
      });
    }
    const totalBlocks = detail.content.blocks.length;
    if (query.offset >= totalBlocks) {
      throw new StorageError("Research source page is outside the available text", "INVALID_DATA", {
        offset: query.offset,
        sourceId,
        totalBlocks,
      });
    }
    const blocks = detail.content.blocks.slice(query.offset, query.offset + query.limit);
    return ResearchSourceContentPageSchema.parse({
      researchDatabaseId,
      sourceId,
      sourceRevision: detail.revision,
      title: detail.content.title,
      offset: query.offset,
      limit: query.limit,
      totalBlocks,
      blocks,
      previousOffset: query.offset === 0 ? null : Math.max(0, query.offset - query.limit),
      nextOffset: query.offset + blocks.length < totalBlocks ? query.offset + query.limit : null,
    });
  }

  async importResearchSource(
    researchDatabaseId: string,
    input: PreparedResearchSourceImport,
    transactionOptions: ResearchFileTransactionOptions = {},
  ): Promise<ResearchSourceDetail> {
    await this.getResearchDatabase(researchDatabaseId);
    const databaseRoot = researchDatabaseRoot(this.libraryRoot, researchDatabaseId);
    const id = randomUUID();
    const now = new Date().toISOString();
    const originalPath = researchDatabaseOriginalPath(databaseRoot, { id, kind: input.kind });
    const contentPath = researchDatabaseContentPath(databaseRoot, id);
    const content = buildResearchSourceContent({
      researchDatabaseId,
      sourceId: id,
      originalContentHash: input.contentHash,
      declaredLanguage: input.properties.declaredLanguage,
      prepared: input.content,
    });
    const parsedContentHash = jsonAuthorityRevision(serializeJsonAuthority(content));
    const source = ResearchSourceV3Schema.parse({
      schemaVersion: 3,
      id,
      researchDatabaseId,
      kind: input.kind,
      mediaType: input.mediaType,
      originalFileName: input.originalFileName,
      sizeBytes: input.sizeBytes,
      contentHash: input.contentHash,
      originalRelativePath: path.relative(databaseRoot, originalPath).split(path.sep).join("/"),
      contentRelativePath: path.relative(databaseRoot, contentPath).split(path.sep).join("/"),
      parsedContentHash,
      parseStatus: "parsed",
      parserName: input.content.parserName,
      parserVersion: input.content.parserVersion,
      parseWarnings: input.content.warnings,
      origin: input.origin,
      importedAt: now,
      updatedAt: now,
      ...input.properties,
    });
    const detail = await createResearchDatabaseSourceV3File(
      databaseRoot,
      source,
      input.originalBytes,
      content,
      transactionOptions,
    );
    await this.rebuildResearchDatabaseIndex(researchDatabaseId).catch(() => undefined);
    return detail;
  }

  async updateResearchSource(
    researchDatabaseId: string,
    sourceId: string,
    input: UpdateResearchSourceInput,
  ): Promise<ResearchSourceDetail> {
    await this.getResearchDatabase(researchDatabaseId);
    const detail = await updateResearchDatabaseSourceFile(
      researchDatabaseRoot(this.libraryRoot, researchDatabaseId),
      researchDatabaseId,
      sourceId,
      input,
    );
    await this.rebuildResearchDatabaseIndex(researchDatabaseId).catch(() => undefined);
    return detail;
  }

  async getResearchIndexState(researchDatabaseId: string): Promise<ResearchIndexState> {
    await this.getResearchDatabase(researchDatabaseId);
    const databaseRoot = researchDatabaseRoot(this.libraryRoot, researchDatabaseId);
    const sources = await this.readResearchSourceDetails(researchDatabaseId);
    return inspectResearchIndex(databaseRoot, researchDatabaseId, sources);
  }

  async rebuildResearchDatabaseIndex(
    researchDatabaseId: string,
    options: ResearchIndexBuildOptions = {},
  ): Promise<ResearchIndexState> {
    await this.getResearchDatabase(researchDatabaseId);
    const databaseRoot = researchDatabaseRoot(this.libraryRoot, researchDatabaseId);
    const sources = await this.readResearchSourceDetails(researchDatabaseId);
    return rebuildResearchIndex(databaseRoot, researchDatabaseId, sources, options);
  }

  async searchResearchSources(
    researchDatabaseId: string,
    input: ResearchKeywordSearchInput,
  ): Promise<ResearchKeywordSearchResponse> {
    await this.getResearchDatabase(researchDatabaseId);
    const databaseRoot = researchDatabaseRoot(this.libraryRoot, researchDatabaseId);
    const sources = await this.readResearchSourceDetails(researchDatabaseId);
    const state = await inspectResearchIndex(databaseRoot, researchDatabaseId, sources);
    if (state.status !== "ready") {
      await rebuildResearchIndex(databaseRoot, researchDatabaseId, sources);
    }
    return searchResearchIndex(databaseRoot, researchDatabaseId, input);
  }

  async migrateResearchSourcesV2(
    researchDatabaseId: string,
    input: MigrateResearchSourcesV2Input,
    transactionOptions: ResearchFileTransactionOptions = {},
  ): Promise<ResearchSourceV2MigrationResult> {
    await this.getResearchDatabase(researchDatabaseId);
    const databaseRoot = researchDatabaseRoot(this.libraryRoot, researchDatabaseId);
    const migration = await migrateResearchDatabaseSourcesV2(
      databaseRoot,
      researchDatabaseId,
      input,
      transactionOptions,
    );
    let indexState: ResearchIndexState;
    try {
      indexState = await this.rebuildResearchDatabaseIndex(researchDatabaseId);
    } catch {
      indexState = await this.getResearchIndexState(researchDatabaseId);
    }
    return {
      researchDatabaseId,
      ...migration,
      indexState,
    };
  }

  private async readResearchSourceDetails(researchDatabaseId: string): Promise<ResearchSourceDetail[]> {
    const documents = await this.listResearchSources(researchDatabaseId);
    return Promise.all(documents.map((document) => this.getResearchSource(researchDatabaseId, document.source.id)));
  }

  async listLegacyResearchSourceGroups(): Promise<LegacyResearchSourceGroup[]> {
    const groups: LegacyResearchSourceGroup[] = [];
    const databases = (await this.listResearchDatabases()).databases;
    for (const series of await this.listSeries()) {
      const sources = await listLegacyResearchSourceFiles(await this.findSeriesRoot(series.id), series.id);
      if (sources.length > 0) {
        const migratedResearchDatabaseIds = [];
        for (const database of databases) {
          if (await hasLegacyResearchMigrationReceipt(
            researchDatabaseRoot(this.libraryRoot, database.database.id),
            series.id,
          )) {
            migratedResearchDatabaseIds.push(database.database.id);
          }
        }
        groups.push({
          seriesId: series.id,
          seriesTitle: series.title,
          sourceCount: sources.length,
          migratedResearchDatabaseIds,
        });
      }
    }
    return groups.sort((left, right) =>
      left.seriesTitle.localeCompare(right.seriesTitle, "en")
      || left.seriesId.localeCompare(right.seriesId),
    );
  }

  async migrateLegacyResearchSources(
    researchDatabaseId: string,
    seriesId: string,
    transactionOptions: ResearchFileTransactionOptions = {},
  ): Promise<ResearchLegacyMigrationResult> {
    const database = await this.getResearchDatabase(researchDatabaseId);
    if (!database.database.linkedSeriesIds.includes(seriesId)) {
      throw new StorageError("Link this Research Database to the Series before migrating its legacy sources", "INVALID_DATA", {
        researchDatabaseId,
        seriesId,
      });
    }
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const legacyDocuments = await listLegacyResearchSourceFiles(seriesRoot, seriesId);
    const legacyDetails = await Promise.all(
      legacyDocuments.map((document) => readLegacyResearchSourceFile(seriesRoot, seriesId, document.source.id)),
    );
    const result = await migrateLegacyResearchSourceFiles(
      researchDatabaseRoot(this.libraryRoot, researchDatabaseId),
      researchDatabaseId,
      seriesId,
      legacyDetails,
      transactionOptions,
    );
    return ResearchLegacyMigrationResultSchema.parse({
      researchDatabaseId,
      seriesId,
      ...result,
    });
  }

  private async recoverSeriesRootOnce(seriesRoot: string): Promise<void> {
    const root = path.resolve(seriesRoot);
    if (this.recoveredSeriesRoots.has(root)) return;
    await recoverFileTransactions(root);
    this.recoveredSeriesRoots.add(root);
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
      "research/originals",
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
      { targetPath: path.join(seriesRoot, SERIES_FILE), content: serializeJsonAuthority(manifest) },
      { targetPath: path.join(bookRoot, BOOK_FILE), content: serializeJsonAuthority(book) },
      { targetPath: actPath(bookRoot, act.id), content: serializeJsonAuthority(act) },
      { targetPath: chapterPath(bookRoot, chapter.id), content: serializeJsonAuthority(chapter) },
      { targetPath: timelineManifestPath(seriesRoot), content: serializeJsonAuthority(timeline) },
    ]);
    await this.createScene(seriesId, { title: DefaultStructureTitles.initialScene, content: "" }, {
      bookId,
      actId,
      chapterId,
    });
    return this.getSeries(seriesId);
  }

  async createBook(seriesId: string, rawInput: CreateBookInput): Promise<BookManifest> {
    const input = CreateBookInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const manifest = await readJson(path.join(seriesRoot, SERIES_FILE), (value) =>
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
      { targetPath: path.join(seriesRoot, SERIES_FILE), content: serializeJsonAuthority(updatedManifest) },
      { targetPath: path.join(bookRoot, BOOK_FILE), content: serializeJsonAuthority(book) },
      { targetPath: actPath(bookRoot, act.id), content: serializeJsonAuthority(act) },
      { targetPath: chapterPath(bookRoot, chapter.id), content: serializeJsonAuthority(chapter) },
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
      const remainingBook = await readJson(path.join(seriesRoot, "books", id, BOOK_FILE), (value) =>
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
      { targetPath: path.join(seriesRoot, SERIES_FILE), content: serializeJsonAuthority(updatedManifest) },
      ...remainingBooks.map((book) => ({
        targetPath: path.join(seriesRoot, "books", book.id, BOOK_FILE),
        content: serializeJsonAuthority(book),
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
        await this.recoverSeriesRootOnce(root);
        const manifest = await readJson(seriesFile, (value) => SeriesManifestSchema.parse(value));
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
        if (error instanceof StorageError && error.code === "NOT_FOUND") continue;
        throw error;
      }
    }
    return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async trashSeries(seriesId: string): Promise<SeriesManifest> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const manifest = await readJson(path.join(seriesRoot, SERIES_FILE), (value) =>
      SeriesManifestSchema.parse(value),
    );
    if (manifest.archivedAt) return manifest;
    const now = new Date().toISOString();
    const archived = SeriesManifestSchema.parse({
      ...manifest,
      archivedAt: now,
      updatedAt: now,
    });
    await atomicWrite(path.join(seriesRoot, SERIES_FILE), serializeJsonAuthority(archived));
    return archived;
  }

  async restoreSeries(seriesId: string): Promise<SeriesManifest> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const manifest = await readJson(path.join(seriesRoot, SERIES_FILE), (value) =>
      SeriesManifestSchema.parse(value),
    );
    if (!manifest.archivedAt) return manifest;
    const restored = SeriesManifestSchema.parse({
      ...manifest,
      archivedAt: null,
      updatedAt: new Date().toISOString(),
    });
    await atomicWrite(path.join(seriesRoot, SERIES_FILE), serializeJsonAuthority(restored));
    return restored;
  }

  async deleteSeries(seriesId: string, rawInput: DeleteSeriesInput): Promise<DeleteSeriesResult> {
    const input = DeleteSeriesInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const manifest = await readJson(path.join(seriesRoot, SERIES_FILE), (value) =>
      SeriesManifestSchema.parse(value),
    );
    if (!manifest.archivedAt) {
      throw new StorageError("Project must be in Trash before permanent deletion", "INVALID_DATA", {
        seriesId,
      });
    }
    if (input.confirmTitle !== manifest.title) {
      throw new StorageError("Project title confirmation does not match", "INVALID_DATA", {
        seriesId,
      });
    }
    const resolvedRoot = path.resolve(seriesRoot);
    if (resolvedRoot === this.libraryRoot || path.dirname(resolvedRoot) !== this.libraryRoot) {
      throw new StorageError("Series root is outside the library delete boundary", "PATH_ESCAPE", {
        seriesId,
        seriesRoot,
        libraryRoot: this.libraryRoot,
      });
    }
    await rm(resolvedRoot, { force: true, recursive: true });
    return DeleteSeriesResultSchema.parse({ deletedId: seriesId });
  }

  async getSeries(seriesId: string): Promise<SeriesDetail> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const hierarchy = await this.validateHierarchy(seriesId);
    if (!hierarchy.valid) {
      throw new StorageError("Series hierarchy is incomplete", "INVALID_DATA", { issues: hierarchy.issues });
    }
    const manifest = await readJson(path.join(seriesRoot, SERIES_FILE), (value) =>
      SeriesManifestSchema.parse(value),
    );
    const books: BookManifest[] = [];
    for (const bookId of manifest.bookIds) {
      books.push(
        await readJson(path.join(seriesRoot, "books", bookId, BOOK_FILE), (value) =>
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

  async getScene(seriesId: string, sceneId: string): Promise<SceneDocument> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const filePath = await this.findScenePath(seriesRoot, sceneId);
    return parseSceneText(await readFile(filePath, "utf8"), path.relative(seriesRoot, filePath));
  }

  async getSceneBlockDocument(
    seriesId: string,
    sceneId: string,
  ): Promise<SceneBlockDocumentResponse> {
    return SceneBlockDocumentResponseSchema.parse(await this.getScene(seriesId, sceneId));
  }

  async updateSceneBlockDocument(
    seriesId: string,
    sceneId: string,
    rawInput: UpdateSceneBlockDocumentInput,
  ): Promise<SceneBlockDocumentResponse> {
    const input = UpdateSceneBlockDocumentInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const filePath = await this.findScenePath(seriesRoot, sceneId);
    const current = parseSceneText(
      await readFile(filePath, "utf8"),
      path.relative(seriesRoot, filePath),
    );
    if (current.revision !== input.baseRevision) {
      throw new StorageError("Scene block document has changed on disk", "CONFLICT", {
        currentRevision: current.revision,
        scene: current,
      });
    }
    const metadata = SceneFrontmatterSchema.parse({
      ...current.metadata,
      title: input.title ?? current.metadata.title,
      status: input.status ?? current.metadata.status,
      goal: input.goal ?? current.metadata.goal,
      summary: input.summary ?? current.metadata.summary,
      updatedAt: new Date().toISOString(),
    });
    await this.assertSceneProgressionBlockReferences(seriesRoot, sceneId, input.document);
    await atomicWrite(filePath, serializeSceneDocument(metadata, input.document));
    const updated = await this.getScene(seriesId, sceneId);
    await this.indexScene(seriesRoot, updated);
    return SceneBlockDocumentResponseSchema.parse(updated);
  }

  async createSceneProgressionBlock(
    seriesId: string,
    sceneId: string,
    rawInput: CreateSceneProgressionBlockInput,
  ): Promise<CreateSceneProgressionBlockResult> {
    const input = CreateSceneProgressionBlockInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const filePath = await this.findScenePath(seriesRoot, sceneId);
    const scene = parseSceneText(
      await readFile(filePath, "utf8"),
      path.relative(seriesRoot, filePath),
    );
    if (scene.revision !== input.baseRevision) {
      throw new StorageError("Scene block document has changed on disk", "CONFLICT", {
        currentRevision: scene.revision,
        scene,
      });
    }

    const currentBlocks = scene.document.blocks;
    const targetIndex = input.afterBlockId
      ? currentBlocks.findIndex((block) => block.id === input.afterBlockId)
      : -1;
    if (input.afterBlockId && targetIndex < 0) {
      throw new StorageError("Insert target scene block does not exist", "INVALID_DATA", {
        sceneId,
        blockId: input.afterBlockId,
      });
    }

    const now = new Date().toISOString();
    const blockId = randomUUID();
    const progression = CodexProgressionSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      kind: input.progression.kind,
      entryId: input.progression.entryId ?? null,
      relationId: input.progression.relationId ?? null,
      field: input.progression.field ?? null,
      fieldKey: input.progression.fieldKey ?? null,
      operation: input.progression.operation,
      body: input.progression.body ?? "",
      summary: input.progression.summary,
      effectiveFromSceneId: sceneId,
      effectiveToSceneId: input.progression.effectiveToSceneId ?? null,
      source: {
        kind: "write-block",
        sceneId,
        blockId,
      },
      evidence: input.progression.evidence,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    });
    const block = CodexProgressionSceneBlockSchema.parse({
      id: blockId,
      kind: "codexProgression",
      progressionId: progression.id,
      createdAt: now,
      updatedAt: now,
    });
    const insertIndex = targetIndex >= 0 ? targetIndex + 1 : currentBlocks.length;
    const nextDocument = SceneBlockDocumentSchema.parse({
      schemaVersion: 1,
      blocks: [
        ...currentBlocks.slice(0, insertIndex),
        block,
        ...currentBlocks.slice(insertIndex),
      ],
    });
    const metadata = SceneFrontmatterSchema.parse({
      ...scene.metadata,
      updatedAt: now,
    });

    await this.assertCodexProgressionReferences(seriesId, seriesRoot, progression, {
      knownWriteBlock: { sceneId, blockId },
    });
    await this.assertSceneProgressionBlockReferences(seriesRoot, sceneId, nextDocument, {
      knownProgression: progression,
    });

    const sceneRaw = serializeSceneDocument(metadata, nextDocument);
    const progressionRaw = serializeJsonAuthority(progression);
    const expectedSceneRevision = jsonAuthorityRevision(sceneRaw);
    const expectedProgressionRevision = jsonAuthorityRevision(progressionRaw);
    const progressionPath = codexProgressionPath(seriesRoot, progression.id);
    if (await pathExists(progressionPath)) {
      throw new StorageError("Generated progression ID already exists", "INVALID_DATA", {
        progressionId: progression.id,
      });
    }
    await applyFileTransaction(seriesRoot, [
      { targetPath: filePath, content: sceneRaw },
      { targetPath: progressionPath, content: progressionRaw },
    ]);

    const updatedScene = await this.getScene(seriesId, sceneId);
    const writtenProgression = await this.readCodexProgression(seriesRoot, progression.id);
    if (
      updatedScene.revision !== expectedSceneRevision ||
      writtenProgression.revision !== expectedProgressionRevision
    ) {
      throw new StorageError("Scene progression block transaction verification failed", "INVALID_DATA", {
        sceneId,
        blockId,
        progressionId: progression.id,
        expectedSceneRevision,
        actualSceneRevision: updatedScene.revision,
        expectedProgressionRevision,
        actualProgressionRevision: writtenProgression.revision,
      });
    }
    await this.indexScene(seriesRoot, updatedScene);
    return CreateSceneProgressionBlockResultSchema.parse({
      block,
      progression: writtenProgression,
      scene: updatedScene,
    });
  }

  async deleteSceneProgressionBlock(
    seriesId: string,
    sceneId: string,
    blockId: string,
    rawInput: DeleteSceneProgressionBlockInput,
  ): Promise<DeleteSceneProgressionBlockResult> {
    const input = DeleteSceneProgressionBlockInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const filePath = await this.findScenePath(seriesRoot, sceneId);
    const scene = parseSceneText(
      await readFile(filePath, "utf8"),
      path.relative(seriesRoot, filePath),
    );
    if (scene.revision !== input.baseRevision) {
      throw new StorageError("Scene block document has changed on disk", "CONFLICT", {
        currentRevision: scene.revision,
        scene,
      });
    }

    const block = scene.document.blocks.find((candidate) => candidate.id === blockId);
    if (!block || block.kind !== "codexProgression") {
      throw new StorageError("Scene block is not a progression block", "INVALID_DATA", {
        sceneId,
        blockId,
      });
    }

    const progressionDocument = await this.getCodexProgression(seriesId, block.progressionId);
    if (progressionDocument.revision !== input.progressionBaseRevision) {
      throw new StorageError("Progression was modified by another operation", "CONFLICT", {
        currentRevision: progressionDocument.revision,
      });
    }
    const progression = progressionDocument.progression;
    if (
      progression.source.kind !== "write-block" ||
      progression.effectiveFromSceneId !== sceneId ||
      progression.source.sceneId !== sceneId ||
      progression.source.blockId !== blockId
    ) {
      throw new StorageError("Progression source does not match the scene block", "INVALID_DATA", {
        sceneId,
        blockId,
        progressionId: block.progressionId,
      });
    }

    const blockers = await this.progressionDeleteBlockers(seriesId, block.progressionId, {
      ignoredWriteBlock: { sceneId, blockId },
    });
    if (blockers.length > 0) {
      return DeleteSceneProgressionBlockResultSchema.parse({
        blockId,
        deletedId: null,
        blockers,
        scene: null,
      });
    }

    const nextDocument: SceneBlockDocument = {
      schemaVersion: 1,
      blocks: scene.document.blocks.filter((candidate) => candidate.id !== blockId),
    };
    await this.assertSceneProgressionBlockReferences(seriesRoot, sceneId, nextDocument);

    const metadata = SceneFrontmatterSchema.parse({
      ...scene.metadata,
      updatedAt: new Date().toISOString(),
    });
    const sceneRaw = serializeSceneDocument(metadata, nextDocument);
    const expectedSceneRevision = jsonAuthorityRevision(sceneRaw);
    await applyFileTransaction(seriesRoot, [
      { targetPath: filePath, content: sceneRaw },
      { targetPath: codexProgressionPath(seriesRoot, block.progressionId), delete: true },
    ]);

    const updatedScene = await this.getScene(seriesId, sceneId);
    try {
      await this.readCodexProgression(seriesRoot, block.progressionId);
    } catch (error) {
      if (error instanceof StorageError && error.code === "NOT_FOUND") {
        if (updatedScene.revision !== expectedSceneRevision) {
          throw new StorageError("Scene progression block transaction verification failed", "INVALID_DATA", {
            sceneId,
            blockId,
            progressionId: block.progressionId,
            expectedSceneRevision,
            actualSceneRevision: updatedScene.revision,
          });
        }
        await this.indexScene(seriesRoot, updatedScene);
        return DeleteSceneProgressionBlockResultSchema.parse({
          blockId,
          deletedId: block.progressionId,
          blockers: [],
          scene: updatedScene,
        });
      }
      throw error;
    }

    throw new StorageError("Scene progression block transaction verification failed", "INVALID_DATA", {
      sceneId,
      blockId,
      progressionId: block.progressionId,
    });
  }

  async exportSceneMarkdown(seriesId: string, sceneId: string): Promise<SceneMarkdownExport> {
    const scene = await this.getScene(seriesId, sceneId);
    return SceneMarkdownExportSchema.parse({
      sceneId: scene.metadata.id,
      revision: scene.revision,
      markdown: scene.content,
    });
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
      { targetPath: chapterPath(bookRoot, chapter.id), content: serializeJsonAuthority(updatedChapter) },
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
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const filePath = assertInside(seriesRoot, path.join(directory, entry.name));
      const document = parseSceneSectionText(
        await readFile(filePath, "utf8"),
        path.relative(seriesRoot, filePath),
      );
      if (
        document.metadata.id !== path.basename(entry.name, ".json") ||
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
  ): Promise<SceneSectionDocument[]> {
    const sections = await this.listSceneSections(seriesId, sceneId);
    return sections.filter(
      (section) =>
        section.metadata.archivedAt === null &&
        isSceneSectionEligibleForContext(section.metadata.aiPolicy),
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
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const filePath = assertInside(seriesRoot, path.join(directory, entry.name));
      const raw = await readFile(filePath, "utf8");
      const anchor = parseJsonAuthorityText(
        raw,
        (value) => ReviewAnchorSchema.parse(value),
        "Review anchor JSON authority file",
      );
      if (anchor.id !== path.basename(entry.name, ".json")) {
        throw new StorageError("锚点文件名与 ID 不一致", "INVALID_DATA", { anchorId: anchor.id });
      }
      if (anchor.sceneId !== sceneId) continue;
      anchors.push(
        ResolvedReviewAnchorSchema.parse({
          anchor,
          revision: jsonAuthorityRevision(raw),
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
    const raw = serializeJsonAuthority(anchor);
    const filePath = assertInside(seriesRoot, reviewAnchorPath(seriesRoot, anchor.id));
    await atomicWrite(filePath, raw);
    return ResolvedReviewAnchorSchema.parse({
      anchor,
      revision: jsonAuthorityRevision(raw),
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
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const filePath = assertInside(seriesRoot, path.join(directory, entry.name));
      const raw = await readFile(filePath, "utf8");
      let category: CodexCustomCategory;
      try {
        category = parseJsonAuthorityText(
          raw,
          (value) => CodexCustomCategorySchema.parse(value),
          "Codex category JSON authority file",
        );
      } catch (error) {
        throw new StorageError("Codex 自定义类别 JSON 无效", "INVALID_DATA", {
          relativePath: path.relative(seriesRoot, filePath),
          cause: error instanceof Error ? error.message : String(error),
        });
      }
      if (category.id !== path.basename(entry.name, ".json")) {
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
          revision: jsonAuthorityRevision(raw),
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
    const raw = serializeJsonAuthority(category);
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
      revision: jsonAuthorityRevision(raw),
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
    const raw = serializeJsonAuthority(category);
    await atomicWrite(codexCategoryPath(seriesRoot, category.id), raw);
    return CodexCategoryDocumentSchema.parse({
      category: {
        id: category.id,
        name: category.name,
        icon: category.icon,
        builtIn: false,
        archivedAt: category.archivedAt,
      },
      revision: jsonAuthorityRevision(raw),
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
      throw new StorageError("Codex category was updated by another change", "CONFLICT", {
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
      const metadata = CodexEntryMetadataSchema.parse({
        ...currentEntry.document.metadata,
        categoryId: "uncategorized",
        updatedAt: now,
      });
      mutations.push({
        targetPath: nextPath,
        content: serializeCodexEntry(metadata, currentEntry.document.description),
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
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const document = await this.readCodexDetailType(seriesRoot, path.basename(entry.name, ".json"));
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
    return runSeriesFileTransaction(seriesRoot, async (commit) => {
      await this.assertCodexCategoryWritable(seriesRoot, input.categoryId);
      this.assertCodexDetailTypeNameAvailable(
        await this.listCodexDetailTypes(seriesId, { categoryId: input.categoryId }),
        input.name,
        input.categoryId,
      );
      const now = new Date().toISOString();
      const detailType = CodexDetailTypeSchema.parse({
        schemaVersion: 2,
        id: randomUUID(),
        categoryId: input.categoryId,
        name: input.name,
        description: input.description,
        nsfw: input.nsfw,
        createdAt: now,
        updatedAt: now,
      });
      const raw = serializeJsonAuthority(detailType);
      await commit([{ targetPath: codexDetailTypePath(seriesRoot, detailType.id), content: raw }]);
      return CodexDetailTypeDocumentSchema.parse({
        detailType,
        revision: jsonAuthorityRevision(raw),
      });
    });
  }

  async updateCodexDetailType(
    seriesId: string,
    detailTypeId: string,
    rawInput: UpdateCodexDetailTypeInput,
  ): Promise<CodexDetailTypeDocument> {
    const input = UpdateCodexDetailTypeInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return runSeriesFileTransaction(seriesRoot, async (commit) => {
      const current = await this.readCodexDetailType(seriesRoot, detailTypeId);
      if (current.revision !== input.baseRevision) {
        throw new StorageError("Codex detail type changed on disk", "CONFLICT", {
          currentRevision: current.revision,
        });
      }
      if (input.name !== undefined) {
        this.assertCodexDetailTypeNameAvailable(
          (await this.listCodexDetailTypes(seriesId, {
            categoryId: current.detailType.categoryId,
          })).filter((document) => document.detailType.id !== detailTypeId),
          input.name,
          current.detailType.categoryId,
        );
      }
      const now = new Date().toISOString();
      const detailType = CodexDetailTypeSchema.parse({
        ...current.detailType,
        name: input.name ?? current.detailType.name,
        description: input.description ?? current.detailType.description,
        nsfw: input.nsfw ?? current.detailType.nsfw,
        updatedAt: now,
      });
      const raw = serializeJsonAuthority(detailType);
      const mutations: FileMutation[] = [
        { targetPath: codexDetailTypePath(seriesRoot, detailTypeId), content: raw },
      ];
      let convertedLegacyEntryKeys = false;
      if (
        input.name !== undefined &&
        input.name !== current.detailType.name &&
        current.detailType.name !== detailTypeId
      ) {
        const entries = (await this.listCodexEntriesFromRoot(seriesRoot)).filter(
          (entry) => entry.metadata.categoryId === current.detailType.categoryId,
        );
        for (const entry of entries) {
          const details = { ...entry.metadata.details };
          const detailAiContext = { ...entry.metadata.detailAiContext };
          let entryChanged = false;
          for (const [field, values] of [
            ["details", details],
            ["detailAiContext", detailAiContext],
          ] as const) {
            if (!Object.prototype.hasOwnProperty.call(values, current.detailType.name)) continue;
            if (
              Object.prototype.hasOwnProperty.call(values, detailTypeId) &&
              values[detailTypeId] !== values[current.detailType.name]
            ) {
              throw new StorageError(
                "Codex Detail Type rename found conflicting legacy and stable Entry values",
                "INVALID_DATA",
                {
                  detailTypeId,
                  entryId: entry.metadata.id,
                  field,
                  legacyName: current.detailType.name,
                },
              );
            }
            values[detailTypeId] = values[current.detailType.name]!;
            delete values[current.detailType.name];
            entryChanged = true;
          }
          if (!entryChanged) continue;
          const stored = await this.findCodexEntry(seriesRoot, entry.metadata.id);
          const metadata = CodexEntryMetadataSchema.parse({
            ...stored.document.metadata,
            details,
            detailAiContext,
            updatedAt: now,
          });
          mutations.push({
            targetPath: stored.filePath,
            content: serializeCodexEntry(metadata, stored.document.description),
          });
          convertedLegacyEntryKeys = true;
        }
      }
      await commit(mutations);
      if (convertedLegacyEntryKeys) await this.rebuildCodexIndex(seriesRoot);
      return CodexDetailTypeDocumentSchema.parse({
        detailType,
        revision: jsonAuthorityRevision(raw),
      });
    });
  }

  async deleteCodexDetailType(
    seriesId: string,
    detailTypeId: string,
    rawInput: DeleteCodexDocumentInput,
  ): Promise<DeleteCodexDetailTypeResult> {
    const input = DeleteCodexDocumentInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return runSeriesFileTransaction(seriesRoot, async (commit) => {
      const current = await this.readCodexDetailType(seriesRoot, detailTypeId);
      if (current.revision !== input.baseRevision) {
        throw new StorageError("Codex detail type changed on disk", "CONFLICT", {
          currentRevision: current.revision,
        });
      }
      const usedByEntryIds = (await this.listCodexEntriesFromRoot(seriesRoot))
        .filter((entry) =>
          entry.metadata.categoryId === current.detailType.categoryId &&
          (
            Object.prototype.hasOwnProperty.call(entry.metadata.details, current.detailType.id) ||
            Object.prototype.hasOwnProperty.call(entry.metadata.details, current.detailType.name)
          ),
        )
        .map((entry) => entry.metadata.id);
      if (usedByEntryIds.length) {
        throw new StorageError("Codex detail type is still used by entries", "INVALID_DATA", {
          detailTypeId,
          detailTypeName: current.detailType.name,
          entryIds: usedByEntryIds,
        });
      }
      await commit([{ targetPath: codexDetailTypePath(seriesRoot, detailTypeId), delete: true }]);
      return DeleteCodexDetailTypeResultSchema.parse({ deletedId: detailTypeId });
    });
  }

  async migrateCodexDetailTypesToV2(
    seriesId: string,
  ): Promise<CodexDetailTypeMigrationResult> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const directory = path.join(seriesRoot, CODEX_DIR, CODEX_DETAIL_TYPES_DIR);
    const files = await readdir(directory, { withFileTypes: true }).catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    });
    const knownCategoryIds = new Set(
      (await this.listCodexCategories(seriesId, true)).map((document) => document.category.id),
    );
    const migrationId = randomUUID();
    const createdAt = new Date().toISOString();
    const documents: CodexDetailTypeMigrationBackup["documents"] = [];
    const mutations: FileMutation[] = [];
    const seenIds = new Set<string>();

    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith(".json")) continue;
      const filePath = assertInside(seriesRoot, path.join(directory, file.name));
      const raw = await readFile(filePath, "utf8");
      const authority = parseJsonAuthorityText(
        raw,
        (value) => CodexDetailTypeAuthoritySchema.parse(value),
        "Codex Detail Type JSON authority file",
      );
      if (authority.id !== path.basename(file.name, ".json")) {
        throw new StorageError("Codex Detail Type file name does not match ID", "INVALID_DATA", {
          detailTypeId: authority.id,
          fileName: file.name,
        });
      }
      if (seenIds.has(authority.id)) {
        throw new StorageError("Multiple Codex Detail Type files use the same ID", "INVALID_DATA", {
          detailTypeId: authority.id,
        });
      }
      seenIds.add(authority.id);
      if (!knownCategoryIds.has(authority.categoryId)) {
        throw new StorageError("Codex Detail Type references an unknown Category", "INVALID_DATA", {
          categoryId: authority.categoryId,
          detailTypeId: authority.id,
        });
      }
      if (authority.schemaVersion !== 1) continue;

      const migratedRaw = serializeJsonAuthority(migrateCodexDetailTypeV1ToV2(authority));
      documents.push({
        detailTypeId: authority.id,
        relativePath: path.posix.join(CODEX_DIR, CODEX_DETAIL_TYPES_DIR, `${authority.id}.json`),
        raw,
        revision: jsonAuthorityRevision(raw),
        migratedRevision: jsonAuthorityRevision(migratedRaw),
      });
      mutations.push({ targetPath: filePath, content: migratedRaw });
    }

    const backup = CodexDetailTypeMigrationBackupSchema.parse({
      schemaVersion: 1,
      migrationId,
      seriesId,
      createdAt,
      documents,
    });
    mutations.unshift({
      targetPath: codexDetailTypeMigrationBackupPath(seriesRoot, migrationId),
      content: serializeJsonAuthority(backup),
    });
    await applyFileTransaction(seriesRoot, mutations);
    return CodexDetailTypeMigrationResultSchema.parse({
      migrationId,
      migratedDetailTypeIds: documents.map((document) => document.detailTypeId),
    });
  }

  async rollbackCodexDetailTypeMigration(
    seriesId: string,
    migrationId: string,
  ): Promise<RollbackCodexDetailTypeMigrationResult> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const backupPath = assertInside(
      seriesRoot,
      codexDetailTypeMigrationBackupPath(seriesRoot, migrationId),
    );
    let rawBackup: string;
    try {
      rawBackup = await readFile(backupPath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new StorageError("Codex Detail Type migration backup does not exist", "NOT_FOUND", {
          migrationId,
        });
      }
      throw error;
    }
    const backup = parseJsonAuthorityText(
      rawBackup,
      (value) => CodexDetailTypeMigrationBackupSchema.parse(value),
      "Codex Detail Type migration backup",
    );
    if (backup.migrationId !== migrationId || backup.seriesId !== seriesId) {
      throw new StorageError("Codex Detail Type migration backup identity does not match", "INVALID_DATA", {
        migrationId,
      });
    }

    const mutations: FileMutation[] = [];
    for (const document of backup.documents) {
      const expectedRelativePath = path.posix.join(
        CODEX_DIR,
        CODEX_DETAIL_TYPES_DIR,
        `${document.detailTypeId}.json`,
      );
      if (document.relativePath !== expectedRelativePath) {
        throw new StorageError("Codex Detail Type migration backup path is invalid", "INVALID_DATA", {
          detailTypeId: document.detailTypeId,
          migrationId,
        });
      }
      const firstVersion = parseJsonAuthorityText(
        document.raw,
        (value) => CodexDetailTypeAuthoritySchema.parse(value),
        "Codex Detail Type migration rollback document",
      );
      if (firstVersion.schemaVersion !== 1 || firstVersion.id !== document.detailTypeId) {
        throw new StorageError("Codex Detail Type migration rollback document is invalid", "INVALID_DATA", {
          detailTypeId: document.detailTypeId,
          migrationId,
        });
      }
      if (jsonAuthorityRevision(document.raw) !== document.revision) {
        throw new StorageError("Codex Detail Type migration rollback checksum does not match", "INVALID_DATA", {
          detailTypeId: document.detailTypeId,
          migrationId,
        });
      }
      const targetPath = codexDetailTypePath(seriesRoot, document.detailTypeId);
      const currentRaw = await readFile(targetPath, "utf8");
      if (jsonAuthorityRevision(currentRaw) !== document.migratedRevision) {
        throw new StorageError("Codex Detail Type changed after migration", "CONFLICT", {
          currentRevision: jsonAuthorityRevision(currentRaw),
          detailTypeId: document.detailTypeId,
          migrationId,
        });
      }
      mutations.push({ targetPath, content: document.raw });
    }
    await applyFileTransaction(seriesRoot, mutations);
    return RollbackCodexDetailTypeMigrationResultSchema.parse({
      migrationId,
      restoredDetailTypeIds: backup.documents.map((document) => document.detailTypeId),
    });
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

  async getCodexEffectiveEntry(
    seriesId: string,
    entryId: string,
    sceneId: string,
    blockId: string | null = null,
  ): Promise<CodexEffectiveEntry> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const entry = await this.getCodexEntry(seriesId, entryId);
    if (entry.metadata.archivedAt) {
      throw new StorageError("Archived entry cannot be used for effective entry queries", "INVALID_DATA", {
        entryId,
      });
    }
    const { sceneIndexes, scenesById } = await this.narrativeSceneIndexes(seriesId);
    const targetScene = scenesById.get(sceneId);
    if (!targetScene) {
      throw new StorageError("Effective entry query references an unknown scene", "INVALID_DATA", {
        sceneId,
      });
    }
    const targetPosition = this.targetBlockPosition(sceneIndexes, targetScene, blockId);
    const fieldProgressions = (await this.listCodexProgressionsFromRoot(seriesRoot))
      .filter((document) => document.progression.archivedAt === null)
      .filter((document) =>
        document.progression.kind === "field" &&
        document.progression.entryId === entryId,
      );

    const activeProgressions: CodexProgressionDocument[] = [];
    const futureProgressions: CodexProgressionDocument[] = [];
    for (const document of fieldProgressions) {
      const progressionPosition = this.progressionBlockPosition(
        sceneIndexes,
        scenesById,
        document.progression,
      );
      const startsAfterTarget = compareNarrativeBlockPositions(progressionPosition, targetPosition) > 0;
      if (startsAfterTarget) {
        futureProgressions.push(document);
        continue;
      }
      if (
        isActiveForNarrativePosition(
          document.progression.effectiveFromSceneId,
          document.progression.effectiveToSceneId,
          targetPosition.sceneIndex,
          sceneIndexes,
        )
      ) {
        activeProgressions.push(document);
      }
    }

    activeProgressions.sort((left, right) => {
      const leftPosition = this.progressionBlockPosition(sceneIndexes, scenesById, left.progression);
      const rightPosition = this.progressionBlockPosition(sceneIndexes, scenesById, right.progression);
      return (
        compareNarrativeBlockPositions(leftPosition, rightPosition) ||
        left.progression.createdAt.localeCompare(right.progression.createdAt)
      );
    });

    const detailTypes = await this.listCodexDetailTypes(seriesId, {
      categoryId: entry.metadata.categoryId,
    });
    const detailTypesById = new Map(detailTypes.map((document) => [document.detailType.id, document.detailType]));
    const fields = new Map<string, {
      field: CodexFieldProgressionField;
      value: string;
      lastProgressionId: string | null;
    }>();
    fields.set("description", {
      field: descriptionField(),
      value: entry.description,
      lastProgressionId: null,
    });
    for (const detailType of detailTypes) {
      const value = entry.metadata.details[detailType.detailType.id] ??
        entry.metadata.details[detailType.detailType.name];
      if (value === undefined) continue;
      const field: CodexFieldProgressionField = {
        kind: "detail",
        detailTypeId: detailType.detailType.id,
      };
      fields.set(codexFieldKey(field), {
        field,
        value,
        lastProgressionId: null,
      });
    }

    for (const document of activeProgressions) {
      const field = document.progression.field;
      if (!field) {
        throw new StorageError("Field progression is missing its field target", "INVALID_DATA", {
          progressionId: document.progression.id,
        });
      }
      if (field.kind === "detail" && !detailTypesById.has(field.detailTypeId)) {
        throw new StorageError("Field progression references an unknown detail type", "INVALID_DATA", {
          progressionId: document.progression.id,
          detailTypeId: field.detailTypeId,
        });
      }
      const key = codexFieldKey(field);
      const current = fields.get(key) ?? { field, value: "", lastProgressionId: null };
      fields.set(key, {
        field,
        value: document.progression.operation === "replace"
          ? document.progression.body
          : prependProgressionBody(document.progression.body, current.value),
        lastProgressionId: document.progression.id,
      });
    }

    const hiddenFutureByField = new Map<string, number>();
    for (const document of futureProgressions) {
      const field = document.progression.field;
      if (!field) continue;
      const key = codexFieldKey(field);
      hiddenFutureByField.set(key, (hiddenFutureByField.get(key) ?? 0) + 1);
    }

    const detailTypeNames = new Set(detailTypes.map((document) => document.detailType.name));
    const projectedDetails: Record<string, string> = {};
    for (const [key, value] of Object.entries(entry.metadata.details)) {
      if (detailTypesById.has(key) || detailTypeNames.has(key)) continue;
      projectedDetails[key] = value;
    }
    for (const state of fields.values()) {
      if (state.field.kind === "detail") {
        projectedDetails[state.field.detailTypeId] = state.value;
      }
    }
    const descriptionState = fields.get("description")!;
    const projectedEntry: CodexEntryDocument = CodexEntryDocumentSchema.parse({
      ...entry,
      description: descriptionState.value,
      metadata: {
        ...entry.metadata,
        details: projectedDetails,
      },
    });

    const fieldStates = [...fields.values()]
      .sort((left, right) => {
        if (left.field.kind !== right.field.kind) return left.field.kind === "description" ? -1 : 1;
        if (left.field.kind === "description" || right.field.kind === "description") return 0;
        return left.field.detailTypeId.localeCompare(right.field.detailTypeId);
      })
      .map((state) => ({
        field: state.field,
        source: state.lastProgressionId ? "progression" as const : "baseline" as const,
        lastProgressionId: state.lastProgressionId,
        hiddenFutureCount: hiddenFutureByField.get(codexFieldKey(state.field)) ?? 0,
      }));

    return CodexEffectiveEntrySchema.parse({
      sceneId,
      blockId,
      entry: projectedEntry,
      fieldStates,
      hiddenFutureFieldProgressionCount: futureProgressions.length,
    });
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
        content: serializeCodexEntry(metadata, input.description),
      },
      {
        targetPath: researchPath,
        content: serializeCodexResearch(researchMetadata, input.research),
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
    return runSeriesFileTransaction(seriesRoot, async () => {
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
        throw new StorageError("Codex entry target category already contains a file with the same name", "INVALID_DATA", {
          entryId,
          categoryId: nextCategoryId,
        });
      }
      mutations.push({
        targetPath: nextEntryPath,
        content: serializeCodexEntry(
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
        content: serializeCodexResearch(
          CodexResearchMetadataSchema.parse({
            ...current.document.research.metadata,
            updatedAt: now,
          }),
          input.research!,
        ),
      });
    }
    await applyFileTransaction(seriesRoot, mutations);
    await this.rebuildCodexIndex(seriesRoot);
    return (await this.findCodexEntry(seriesRoot, entryId)).document;
    });
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
    return runSeriesFileTransaction(seriesRoot, async () => {
    const current = await this.findCodexEntry(seriesRoot, entryId);
    if (current.document.revision !== input.baseRevision) {
      throw new StorageError("Codex entry was updated by another change", "CONFLICT", {
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
    });
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
      if (!file.isFile() || !file.name.endsWith(".json")) continue;
      const filePath = assertInside(seriesRoot, path.join(directory, file.name));
      const raw = await readFile(filePath, "utf8");
      let authority: CodexRelationAuthority;
      try {
        authority = parseJsonAuthorityText(
          raw,
          (value) => CodexRelationAuthoritySchema.parse(value),
          "Codex relation JSON authority file",
        );
      } catch (error) {
        throw new StorageError("Codex 关系 JSON 无效", "INVALID_DATA", {
          relativePath: path.relative(seriesRoot, filePath),
          cause: error instanceof Error ? error.message : String(error),
        });
      }
      const relation = authority.schemaVersion === 1
        ? migrateCodexRelationV1ToV2(authority)
        : authority;
      if (relation.id !== path.basename(file.name, ".json")) {
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
          revision: jsonAuthorityRevision(raw),
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
      schemaVersion: 2,
      id: randomUUID(),
      sourceEntryId: input.sourceEntryId,
      targetEntryId: input.targetEntryId,
      directed: input.directed ?? true,
      description: input.description,
      evidence: input.evidence ?? "",
      validFromSceneId: input.validFromSceneId ?? null,
      validToSceneId: input.validToSceneId ?? null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    });
    this.assertCodexRelationReferences(relation, knownEntryIds, knownSceneIds);
    const raw = serializeJsonAuthority(relation);
    await atomicWrite(codexRelationPath(seriesRoot, relation.id), raw);
    return CodexRelationDocumentSchema.parse({
      relation,
      revision: jsonAuthorityRevision(raw),
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
    const raw = serializeJsonAuthority(relation);
    await atomicWrite(codexRelationPath(seriesRoot, relation.id), raw);
    return CodexRelationDocumentSchema.parse({
      relation,
      revision: jsonAuthorityRevision(raw),
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

  async deleteCodexRelation(
    seriesId: string,
    relationId: string,
    rawInput: DeleteCodexDocumentInput,
  ): Promise<DeleteCodexRelationResult> {
    const input = DeleteCodexDocumentInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return runSeriesFileTransaction(seriesRoot, async (commit) => {
      const current = await this.readCodexRelation(seriesRoot, relationId);
      if (current.revision !== input.baseRevision) {
        throw new StorageError("Codex relation was modified by another operation", "CONFLICT", {
          currentRevision: current.revision,
        });
      }
      const blockers = await this.codexRelationDeleteBlockers(seriesId, relationId);
      if (blockers.length > 0) {
        throw new StorageError("Codex relation has blocking references", "INVALID_DATA", {
          relationId,
          blockers,
        });
      }
      await commit([{ targetPath: codexRelationPath(seriesRoot, relationId), delete: true }]);
      return DeleteCodexRelationResultSchema.parse({ deletedId: relationId, blockers: [] });
    });
  }

  async migrateCodexRelationsToV2(
    seriesId: string,
  ): Promise<CodexRelationMigrationResult> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const directory = path.join(seriesRoot, CODEX_DIR, CODEX_RELATIONS_DIR);
    const files = await readdir(directory, { withFileTypes: true }).catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    });
    const knownEntryIds = new Set(
      (await this.listCodexEntriesFromRoot(seriesRoot)).map((entry) => entry.metadata.id),
    );
    const knownSceneIds = new Set(
      (await this.getSeries(seriesId)).scenes.map((scene) => scene.metadata.id),
    );
    const migrationId = randomUUID();
    const createdAt = new Date().toISOString();
    const documents: CodexRelationMigrationBackup["documents"] = [];
    const mutations: FileMutation[] = [];

    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith(".json")) continue;
      const filePath = assertInside(seriesRoot, path.join(directory, file.name));
      const raw = await readFile(filePath, "utf8");
      const authority = parseJsonAuthorityText(
        raw,
        (value) => CodexRelationAuthoritySchema.parse(value),
        "Codex relation JSON authority file",
      );
      if (authority.id !== path.basename(file.name, ".json")) {
        throw new StorageError("Codex relation file name does not match ID", "INVALID_DATA", {
          relationId: authority.id,
          fileName: file.name,
        });
      }
      const projected = authority.schemaVersion === 1
        ? migrateCodexRelationV1ToV2(authority)
        : authority;
      this.assertCodexRelationReferences(projected, knownEntryIds, knownSceneIds);
      if (authority.schemaVersion !== 1) continue;

      const migratedRaw = serializeJsonAuthority(projected);
      documents.push({
        relationId: authority.id,
        relativePath: path.posix.join(CODEX_DIR, CODEX_RELATIONS_DIR, `${authority.id}.json`),
        raw,
        revision: jsonAuthorityRevision(raw),
        migratedRevision: jsonAuthorityRevision(migratedRaw),
      });
      mutations.push({ targetPath: filePath, content: migratedRaw });
    }

    const backup = CodexRelationMigrationBackupSchema.parse({
      schemaVersion: 1,
      migrationId,
      seriesId,
      createdAt,
      documents,
    });
    mutations.unshift({
      targetPath: codexRelationMigrationBackupPath(seriesRoot, migrationId),
      content: serializeJsonAuthority(backup),
    });
    await applyFileTransaction(seriesRoot, mutations);
    return CodexRelationMigrationResultSchema.parse({
      migrationId,
      migratedRelationIds: documents.map((document) => document.relationId),
    });
  }

  async rollbackCodexRelationMigration(
    seriesId: string,
    migrationId: string,
  ): Promise<RollbackCodexRelationMigrationResult> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const backupPath = assertInside(
      seriesRoot,
      codexRelationMigrationBackupPath(seriesRoot, migrationId),
    );
    let rawBackup: string;
    try {
      rawBackup = await readFile(backupPath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new StorageError("Codex relation migration backup does not exist", "NOT_FOUND", {
          migrationId,
        });
      }
      throw error;
    }
    const backup = parseJsonAuthorityText(
      rawBackup,
      (value) => CodexRelationMigrationBackupSchema.parse(value),
      "Codex relation migration backup",
    );
    if (backup.migrationId !== migrationId || backup.seriesId !== seriesId) {
      throw new StorageError("Codex relation migration backup identity does not match", "INVALID_DATA", {
        migrationId,
      });
    }

    const mutations: FileMutation[] = [];
    for (const document of backup.documents) {
      const expectedRelativePath = path.posix.join(
        CODEX_DIR,
        CODEX_RELATIONS_DIR,
        `${document.relationId}.json`,
      );
      if (document.relativePath !== expectedRelativePath) {
        throw new StorageError("Codex relation migration backup path is invalid", "INVALID_DATA", {
          migrationId,
          relationId: document.relationId,
        });
      }
      const firstVersion = parseJsonAuthorityText(
        document.raw,
        (value) => CodexRelationAuthoritySchema.parse(value),
        "Codex relation migration rollback document",
      );
      if (firstVersion.schemaVersion !== 1 || firstVersion.id !== document.relationId) {
        throw new StorageError("Codex relation migration rollback document is invalid", "INVALID_DATA", {
          migrationId,
          relationId: document.relationId,
        });
      }
      if (jsonAuthorityRevision(document.raw) !== document.revision) {
        throw new StorageError("Codex relation migration rollback checksum does not match", "INVALID_DATA", {
          migrationId,
          relationId: document.relationId,
        });
      }
      const targetPath = codexRelationPath(seriesRoot, document.relationId);
      const currentRaw = await readFile(targetPath, "utf8");
      if (jsonAuthorityRevision(currentRaw) !== document.migratedRevision) {
        throw new StorageError("Codex relation changed after migration", "CONFLICT", {
          migrationId,
          relationId: document.relationId,
          currentRevision: jsonAuthorityRevision(currentRaw),
        });
      }
      mutations.push({ targetPath, content: document.raw });
    }
    await applyFileTransaction(seriesRoot, mutations);
    return RollbackCodexRelationMigrationResultSchema.parse({
      migrationId,
      restoredRelationIds: backup.documents.map((document) => document.relationId),
    });
  }

  async listCodexProgressions(
    seriesId: string,
    options: {
      kind?: CodexProgression["kind"];
      entryId?: string;
      relationId?: string;
      sceneId?: string;
      includeArchived?: boolean;
    } = {},
  ): Promise<CodexProgressionDocument[]> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const progressions = await this.listCodexProgressionsFromRoot(seriesRoot);
    return progressions
      .filter((document) => options.includeArchived || document.progression.archivedAt === null)
      .filter((document) => !options.kind || document.progression.kind === options.kind)
      .filter((document) =>
        !options.entryId || document.progression.entryId === options.entryId,
      )
      .filter((document) =>
        !options.relationId || document.progression.relationId === options.relationId,
      )
      .filter((document) =>
        !options.sceneId ||
        document.progression.effectiveFromSceneId === options.sceneId ||
        document.progression.source.sceneId === options.sceneId,
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
    return runSeriesFileTransaction(seriesRoot, async (commit) => {
    const now = new Date().toISOString();
    const progression = CodexProgressionSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      kind: input.kind,
      entryId: input.entryId ?? null,
      relationId: input.relationId ?? null,
      field: input.field ?? null,
      fieldKey: input.fieldKey ?? null,
      operation: input.operation,
      body: input.body ?? "",
      summary: input.summary,
      effectiveFromSceneId: input.effectiveFromSceneId,
      effectiveToSceneId: input.effectiveToSceneId ?? null,
      source: input.source,
      evidence: input.evidence,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    });
    await this.assertCodexProgressionReferences(seriesId, seriesRoot, progression);
    const raw = serializeJsonAuthority(progression);
    await commit([{ targetPath: codexProgressionPath(seriesRoot, progression.id), content: raw }]);
    return CodexProgressionDocumentSchema.parse({
      progression,
      revision: jsonAuthorityRevision(raw),
    });
    });
  }

  async updateCodexProgression(
    seriesId: string,
    progressionId: string,
    rawInput: UpdateCodexProgressionInput,
  ): Promise<CodexProgressionDocument> {
    const input = UpdateCodexProgressionInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return runSeriesFileTransaction(seriesRoot, async (commit) => {
    const current = await this.readCodexProgression(seriesRoot, progressionId);
    if (current.revision !== input.baseRevision) {
      throw new StorageError("Progression was modified by another operation", "CONFLICT", {
        currentRevision: current.revision,
      });
    }
    if (current.progression.archivedAt) {
      throw new StorageError("Archived progression cannot be edited", "INVALID_DATA", {
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
    const raw = serializeJsonAuthority(progression);
    await commit([{ targetPath: codexProgressionPath(seriesRoot, progression.id), content: raw }]);
    return CodexProgressionDocumentSchema.parse({
      progression,
      revision: jsonAuthorityRevision(raw),
    });
    });
  }

  async deleteCodexProgression(
    seriesId: string,
    progressionId: string,
    rawInput: DeleteCodexDocumentInput,
  ): Promise<DeleteCodexProgressionResult> {
    const input = DeleteCodexDocumentInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return runSeriesFileTransaction(seriesRoot, async (commit) => {
    const current = await this.readCodexProgression(seriesRoot, progressionId);
    if (current.revision !== input.baseRevision) {
      throw new StorageError("Progression was modified by another operation", "CONFLICT", {
        currentRevision: current.revision,
      });
    }
    const blockers = await this.progressionDeleteBlockers(seriesId, progressionId);
    if (blockers.length > 0) {
      throw new StorageError("Progression has blocking references", "INVALID_DATA", {
        progressionId,
        blockers,
      });
    }
    await commit([
      { targetPath: codexProgressionPath(seriesRoot, progressionId), delete: true },
    ]);
    return DeleteCodexProgressionResultSchema.parse({ deletedId: progressionId, blockers: [] });
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
    const written = await writeJsonAuthorityFile(
      seriesRoot,
      codexKnowledgePath(seriesRoot, knowledge.id),
      knowledge,
      (value) => CodexKnowledgeSchema.parse(value),
    );
    return CodexKnowledgeDocumentSchema.parse({
      knowledge: written.data,
      revision: written.revision,
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
    const written = await writeJsonAuthorityFile(
      seriesRoot,
      codexKnowledgePath(seriesRoot, knowledge.id),
      knowledge,
      (value) => CodexKnowledgeSchema.parse(value),
    );
    return CodexKnowledgeDocumentSchema.parse({
      knowledge: written.data,
      revision: written.revision,
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
    blockId: string | null = null,
  ): Promise<CodexEffectiveState> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const entry = await this.getCodexEntry(seriesId, entryId);
    if (entry.metadata.archivedAt) {
      throw new StorageError("Archived entry cannot be used for effective state queries", "INVALID_DATA", {
        entryId,
      });
    }
    const { sceneIndexes, scenesById } = await this.narrativeSceneIndexes(seriesId);
    const targetScene = scenesById.get(sceneId);
    if (!targetScene) {
      throw new StorageError("Effective state query references an unknown scene", "INVALID_DATA", {
        sceneId,
      });
    }
    const targetPosition = this.targetBlockPosition(sceneIndexes, targetScene, blockId);
    const narrativeIndex = targetPosition.sceneIndex;
    const progressionPosition = (progression: CodexProgression) =>
      this.progressionBlockPosition(sceneIndexes, scenesById, progression);
    const relations = await this.listCodexRelations(seriesId, {
      entryId,
      includeArchived: false,
    });
    const relationIds = new Set(relations.map((document) => document.relation.id));
    const allProgressions = (await this.listCodexProgressionsFromRoot(seriesRoot))
      .filter((document) => document.progression.archivedAt === null);
    const directProgressions = allProgressions.filter(
      (document) =>
        document.progression.kind === "world" &&
        document.progression.entryId === entryId,
    );
    const relationProgressions = allProgressions.filter(
      (document) =>
        document.progression.kind === "relationship" &&
        Boolean(document.progression.relationId) &&
        relationIds.has(document.progression.relationId!),
    );
    const relevantProgressions = [...directProgressions, ...relationProgressions];
    const worldFacts = effectiveProgressionsForPosition(
      directProgressions,
      targetPosition,
      sceneIndexes,
      progressionPosition,
    );
    const relationStates = relations.map((relation) => ({
        relation,
        progressions: effectiveProgressionsForPosition(
          relationProgressions.filter(
            (document) =>
              document.progression.relationId === relation.relation.id,
          ),
          targetPosition,
          sceneIndexes,
          progressionPosition,
        ),
      }));
    const hiddenFutureProgressionCount = relevantProgressions.filter(
      (document) =>
        compareNarrativeBlockPositions(progressionPosition(document.progression), targetPosition) > 0,
    ).length;

    let characterKnowledge: CodexKnowledgeDocument[] = [];
    let hiddenFutureKnowledgeCount = 0;
    if (viewerEntryId) {
      const viewer = await this.getCodexEntry(seriesId, viewerEntryId);
      if (viewer.metadata.categoryId !== "character" || viewer.metadata.archivedAt) {
        throw new StorageError("Character knowledge viewer must be an active character entry", "INVALID_DATA", {
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
    return this.withIndexRead(seriesRoot, (database) => {
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
    });
  }

  async listCodexMentionsForScene(
    seriesId: string,
    sceneId: string,
  ): Promise<SceneCodexMentions> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    await this.getScene(seriesId, sceneId);
    return this.withIndexRead(seriesRoot, (database) => {
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
    });
  }

  async previewCodexContext(
    seriesId: string,
    sceneId: string,
    pinnedIds: string[] = [],
    blockId: string | null = null,
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
    const hiddenFutureFieldProgressions: Array<{ entryId: string; name: string; count: number }> = [];
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
      if (eligibility.eligible) {
        const effectiveEntry = await this.getCodexEffectiveEntry(
          seriesId,
          entry.metadata.id,
          sceneId,
          blockId,
        );
        included.push(effectiveEntry.entry);
        if (effectiveEntry.hiddenFutureFieldProgressionCount > 0) {
          hiddenFutureFieldProgressions.push({
            entryId: entry.metadata.id,
            name: entry.metadata.name,
            count: effectiveEntry.hiddenFutureFieldProgressionCount,
          });
        }
      }
      else {
        excluded.push({
          entryId: entry.metadata.id,
          name: entry.metadata.name,
          reason: eligibility.reason!,
        });
      }
    }
    return CodexContextPreviewSchema.parse({
      sceneId,
      included,
      excluded,
      hiddenFutureFieldProgressions,
      hiddenFutureFieldProgressionCount: hiddenFutureFieldProgressions.reduce(
        (sum, item) => sum + item.count,
        0,
      ),
    });
  }

  async saveModelProfile(profile: ModelProfile): Promise<ModelProfile> {
    return saveModelProfile(this.libraryRoot, profile);
  }

  async getModelProfile(profileId: string): Promise<ModelProfile> {
    return getModelProfile(this.libraryRoot, profileId);
  }

  async listModelProfiles(): Promise<ModelProfile[]> {
    return listModelProfiles(this.libraryRoot);
  }

  async migrateModelProfilesToV2() {
    return migrateModelProfilesToV2(this.libraryRoot);
  }

  async rollbackModelProfilesV2Migration(migrationId: string) {
    return rollbackModelProfilesV2Migration(this.libraryRoot, migrationId);
  }

  async saveEmbeddingModelProfile(profile: EmbeddingModelProfile): Promise<EmbeddingModelProfile> {
    return saveEmbeddingModelProfile(this.libraryRoot, profile);
  }

  async getEmbeddingModelProfile(profileId: string): Promise<EmbeddingModelProfile> {
    return getEmbeddingModelProfile(this.libraryRoot, profileId);
  }

  async listEmbeddingModelProfiles(): Promise<EmbeddingModelProfile[]> {
    return listEmbeddingModelProfiles(this.libraryRoot);
  }

  async saveEmbeddingUseCaseBinding(
    binding: EmbeddingUseCaseBindingDocument,
  ): Promise<EmbeddingUseCaseBindingDocument> {
    const profile = await this.getEmbeddingModelProfile(binding.profileId);
    if (profile.archivedAt) {
      throw new StorageError("Archived Embedding profiles cannot be bound to a use case", "INVALID_DATA", {
        profileId: profile.id,
        useCase: binding.useCase,
      });
    }
    return saveEmbeddingUseCaseBinding(this.libraryRoot, binding);
  }

  async getEmbeddingUseCaseBinding(
    useCase: EmbeddingUseCaseId,
  ): Promise<EmbeddingUseCaseBindingDocument> {
    return getEmbeddingUseCaseBinding(this.libraryRoot, useCase);
  }

  async listEmbeddingUseCaseBindings(): Promise<EmbeddingUseCaseBindingDocument[]> {
    return listEmbeddingUseCaseBindings(this.libraryRoot);
  }

  async deleteEmbeddingUseCaseBinding(useCase: EmbeddingUseCaseId): Promise<boolean> {
    return deleteEmbeddingUseCaseBinding(this.libraryRoot, useCase);
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

  async migrateContextBundlesToV2(seriesId: string) {
    return migrateContextBundlesToV2(await this.findSeriesRoot(seriesId), seriesId);
  }

  async rollbackContextBundlesV2Migration(seriesId: string, migrationId: string) {
    return rollbackContextBundlesV2Migration(
      await this.findSeriesRoot(seriesId),
      seriesId,
      migrationId,
    );
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

  async migrateModelCallLogsToV2(seriesId: string) {
    return migrateModelCallLogsToV2(await this.findSeriesRoot(seriesId), seriesId);
  }

  async rollbackModelCallLogsV2Migration(seriesId: string, migrationId: string) {
    return rollbackModelCallLogsV2Migration(
      await this.findSeriesRoot(seriesId),
      seriesId,
      migrationId,
    );
  }

  async createWorkshopSession(
    seriesId: string,
    rawInput: CreateWorkshopSessionInput,
  ): Promise<WorkshopSession> {
    const input = CreateWorkshopSessionInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    if (input.sceneId) {
      await this.getScene(seriesId, input.sceneId);
    }
    const now = new Date().toISOString();
    const session = WorkshopSessionSchema.parse({
      schemaVersion: 2,
      id: randomUUID(),
      seriesId,
      kind: input.kind,
      generalChatSystemPrompt: input.kind === "chat"
        ? input.generalChatSystemPrompt ?? DEFAULT_WORKSHOP_GENERAL_CHAT_SYSTEM_PROMPT
        : null,
      title: input.title,
      status: "active",
      branchOfMessageId: null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      lastMessageAt: null,
    });
    const created = await createWorkshopSessionFile(seriesRoot, session);
    const basket = WorkshopContextBasketSchema.parse({
      schemaVersion: 2,
      id: randomUUID(),
      seriesId,
      sessionId: created.id,
      sceneId: input.sceneId ?? null,
      blockId: null,
      selection: null,
      items: [],
      createdAt: now,
      updatedAt: now,
    });
    await writeWorkshopContextBasketFile(seriesRoot, basket);
    return created;
  }

  async listWorkshopSessions(seriesId: string): Promise<WorkshopSession[]> {
    return listWorkshopSessionFiles(await this.findSeriesRoot(seriesId));
  }

  async migrateWorkshopAuthorityToV2(seriesId: string) {
    return migrateWorkshopAuthorityToV2(await this.findSeriesRoot(seriesId), seriesId);
  }

  async rollbackWorkshopAuthorityV2Migration(seriesId: string, migrationId: string) {
    return rollbackWorkshopAuthorityV2Migration(
      await this.findSeriesRoot(seriesId),
      seriesId,
      migrationId,
    );
  }

  async getWorkshopSession(seriesId: string, sessionId: string): Promise<WorkshopSession> {
    const session = await readWorkshopSessionFile(await this.findSeriesRoot(seriesId), sessionId);
    if (session.seriesId !== seriesId) {
      throw new StorageError("Workshop session belongs to another series", "INVALID_DATA", {
        sessionId,
      });
    }
    return session;
  }

  async createWorkshopAgentRun(
    seriesId: string,
    rawRun: WorkshopAgentRun,
  ): Promise<WorkshopAgentRunDocument> {
    const run = WorkshopAgentRunSchema.parse(rawRun);
    if (run.seriesId !== seriesId) {
      throw new StorageError("Workshop Agent run belongs to another series", "INVALID_DATA", { runId: run.id });
    }
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return withWorkshopSessionMutationLock(workshopSessionMutationKey(seriesRoot, run.sessionId), async () => {
      const session = await readWorkshopSessionFile(seriesRoot, run.sessionId);
      if (session.kind !== "agent" || session.status !== "active") {
        throw new StorageError("Workshop Agent runs require an active Agent session", "INVALID_DATA", {
          sessionId: session.id,
        });
      }
      const authorMessage = await readWorkshopMessageFile(seriesRoot, run.authorMessageId);
      if (
        authorMessage.seriesId !== seriesId ||
        authorMessage.sessionId !== session.id ||
        authorMessage.role !== "author" ||
        authorMessage.mode !== "agent"
      ) {
        throw new StorageError("Workshop Agent run author message is not owned by the Agent session", "INVALID_DATA", {
          authorMessageId: run.authorMessageId,
          sessionId: session.id,
        });
      }
      return createWorkshopAgentRunFile(seriesRoot, run);
    });
  }

  async getWorkshopAgentRun(
    seriesId: string,
    sessionId: string,
    runId: string,
  ): Promise<WorkshopAgentRunDocument> {
    const document = await readWorkshopAgentRunFile(await this.findSeriesRoot(seriesId), runId);
    if (document.run.seriesId !== seriesId || document.run.sessionId !== sessionId) {
      throw new StorageError("Workshop Agent run belongs to another session", "INVALID_DATA", {
        runId,
        sessionId,
      });
    }
    return document;
  }

  async listWorkshopAgentRuns(
    seriesId: string,
    sessionId: string,
  ): Promise<WorkshopAgentRunListResult> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const session = await readWorkshopSessionFile(seriesRoot, sessionId);
    if (session.seriesId !== seriesId) {
      throw new StorageError("Workshop session belongs to another series", "INVALID_DATA", { sessionId });
    }
    const result = await listWorkshopAgentRunFiles(seriesRoot, sessionId);
    return WorkshopAgentRunListResultSchema.parse(result);
  }

  async updateWorkshopAgentRun(
    seriesId: string,
    sessionId: string,
    runId: string,
    baseRevision: string,
    rawRun: WorkshopAgentRun,
  ): Promise<WorkshopAgentRunDocument> {
    const run = WorkshopAgentRunSchema.parse(rawRun);
    if (run.id !== runId || run.seriesId !== seriesId || run.sessionId !== sessionId) {
      throw new StorageError("Workshop Agent run identity cannot change", "INVALID_DATA", { runId, sessionId });
    }
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return withWorkshopSessionMutationLock(workshopSessionMutationKey(seriesRoot, sessionId), async () => {
      const session = await readWorkshopSessionFile(seriesRoot, sessionId);
      if (session.status === "archived") {
        throw new StorageError("Archived Workshop session cannot update Agent runs", "INVALID_DATA", {
          sessionId,
          runId,
        });
      }
      const current = await readWorkshopAgentRunFile(seriesRoot, runId);
      if (current.revision !== baseRevision) {
        throw new StorageError("Workshop Agent run changed since it was read", "CONFLICT", {
          runId,
          currentRevision: current.revision,
        });
      }
      if (
        current.run.seriesId !== run.seriesId ||
        current.run.sessionId !== run.sessionId ||
        current.run.authorMessageId !== run.authorMessageId ||
        current.run.modelProfileId !== run.modelProfileId ||
        current.run.contextBundleId !== run.contextBundleId ||
        current.run.promptTemplateId !== run.promptTemplateId ||
        current.run.promptTemplateVersion !== run.promptTemplateVersion ||
        current.run.createdAt !== run.createdAt
      ) {
        throw new StorageError("Workshop Agent run immutable identity changed", "INVALID_DATA", { runId });
      }
      assertWorkshopAgentRunEvolution(current.run, run);
      return writeWorkshopAgentRunFile(seriesRoot, run);
    });
  }

  async commitWorkshopAgentRunEffects(
    seriesId: string,
    sessionId: string,
    runId: string,
    baseRevision: string,
    rawRun: WorkshopAgentRun,
    rawMessages: WorkshopMessage[],
  ): Promise<{ run: WorkshopAgentRunDocument; messages: WorkshopMessage[] }> {
    const run = WorkshopAgentRunSchema.parse(rawRun);
    const messages = rawMessages.map((message) => WorkshopMessageSchema.parse(message));
    if (run.id !== runId || run.seriesId !== seriesId || run.sessionId !== sessionId) {
      throw new StorageError("Workshop Agent run identity cannot change", "INVALID_DATA", { runId, sessionId });
    }
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return withWorkshopSessionMutationLock(workshopSessionMutationKey(seriesRoot, sessionId), async () => {
      const session = await readWorkshopSessionFile(seriesRoot, sessionId);
      if (session.status !== "active" || session.kind !== "agent") {
        throw new StorageError("Workshop Agent effects require an active Agent session", "INVALID_DATA", { sessionId });
      }
      const current = await readWorkshopAgentRunFile(seriesRoot, runId);
      if (current.revision !== baseRevision) {
        throw new StorageError("Workshop Agent run changed since it was read", "CONFLICT", {
          runId,
          currentRevision: current.revision,
        });
      }
      assertWorkshopAgentRunEvolution(current.run, run);
      const stepIds = new Set(run.steps.map((step) => step.id));
      for (const message of messages) {
        if (
          message.seriesId !== seriesId ||
          message.sessionId !== sessionId ||
          message.mode !== "agent" ||
          message.agentRunId !== runId ||
          !message.agentStepId ||
          !stepIds.has(message.agentStepId)
        ) {
          throw new StorageError("Workshop Agent effect message is not bound to this run", "INVALID_DATA", {
            runId,
            messageId: message.id,
          });
        }
        if (await pathExists(workshopMessagePath(seriesRoot, message.id))) {
          throw new StorageError("Workshop Agent effect message already exists", "CONFLICT", { messageId: message.id });
        }
      }
      const now = run.updatedAt;
      const latestMessageAt = messages.reduce(
        (latest, message) => message.createdAt > latest ? message.createdAt : latest,
        session.lastMessageAt ?? "",
      ) || session.lastMessageAt;
      const runRaw = serializeJsonAuthority(run);
      await applyFileTransaction(seriesRoot, [
        { targetPath: workshopAgentRunPath(seriesRoot, run.id), content: runRaw },
        ...messages.map((message) => ({
          targetPath: workshopMessagePath(seriesRoot, message.id),
          content: serializeJsonAuthority(message),
        })),
        {
          targetPath: workshopSessionPath(seriesRoot, session.id),
          content: serializeJsonAuthority({
            ...session,
            updatedAt: now,
            lastMessageAt: latestMessageAt,
          }),
        },
      ]);
      return {
        run: { run, revision: jsonAuthorityRevision(runRaw) },
        messages: await Promise.all(messages.map((message) => readWorkshopMessageFile(seriesRoot, message.id))),
      };
    });
  }

  async abandonWorkshopAgentRun(
    seriesId: string,
    sessionId: string,
    runId: string,
    baseRevision: string,
    reason: string,
  ): Promise<WorkshopAgentRunDocument> {
    const current = await this.getWorkshopAgentRun(seriesId, sessionId, runId);
    if (current.revision !== baseRevision) {
      throw new StorageError("Workshop Agent run changed since it was read", "CONFLICT", {
        runId,
        currentRevision: current.revision,
      });
    }
    if (!["waiting-confirmation", "failed", "interrupted"].includes(current.run.status)) {
      throw new StorageError("Workshop Agent run cannot be abandoned from its current state", "CONFLICT", {
        runId,
        status: current.run.status,
      });
    }
    const now = new Date().toISOString();
    const steps = current.run.activeStepId
      ? current.run.steps.map((step) => step.id === current.run.activeStepId ? {
        ...step,
        status: "abandoned" as const,
        retryable: false,
        errorCode: "AGENT_RUN_ABANDONED",
        errorMessage: reason,
        startedAt: step.startedAt ?? now,
        completedAt: now,
      } : step)
      : current.run.steps;
    const run = WorkshopAgentRunSchema.parse({
      ...current.run,
      status: "abandoned",
      activeStepId: null,
      steps,
      retryable: false,
      updatedAt: now,
      completedAt: now,
    });
    return this.updateWorkshopAgentRun(seriesId, sessionId, runId, baseRevision, run);
  }

  async reconcileWorkshopAgentRuns(
    seriesId: string,
    sessionId: string,
  ): Promise<WorkshopAgentRunListResult> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return withWorkshopSessionMutationLock(workshopSessionMutationKey(seriesRoot, sessionId), async () => {
      const session = await readWorkshopSessionFile(seriesRoot, sessionId);
      const listed = await listWorkshopAgentRunFiles(seriesRoot, sessionId);
      const messages = await listWorkshopMessageFiles(seriesRoot, sessionId);
      const now = new Date().toISOString();
      const mutations: FileMutation[] = [];
      const reconciledRuns: WorkshopAgentRunDocument[] = [];

      for (const document of listed.runs) {
        if (document.run.status !== "running") {
          reconciledRuns.push(document);
          continue;
        }
        const activeStepId = document.run.activeStepId;
        const steps = document.run.steps.map((step) => step.id === activeStepId
          ? {
            ...step,
            status: "interrupted" as const,
            retryable: true,
            errorCode: "AGENT_RUN_INTERRUPTED",
            errorMessage: "The server stopped before this Agent step completed.",
            startedAt: step.startedAt ?? now,
            completedAt: now,
          }
          : step);
        const run = WorkshopAgentRunSchema.parse({
          ...document.run,
          status: "interrupted",
          activeStepId: null,
          steps,
          retryable: true,
          updatedAt: now,
          completedAt: now,
        });
        const raw = serializeJsonAuthority(run);
        mutations.push({ targetPath: workshopAgentRunPath(seriesRoot, run.id), content: raw });
        reconciledRuns.push({ run, revision: jsonAuthorityRevision(raw) });
      }

      for (const message of messages) {
        if (message.toolExecution?.status !== "running") continue;
        const nextMessage = WorkshopMessageSchema.parse({
          ...message,
          toolExecution: {
            ...message.toolExecution,
            status: "interrupted",
            retryable: true,
            completedAt: now,
            resultMessageId: null,
            errorCode: "TOOL_EXECUTION_INTERRUPTED",
            errorMessage: "The server stopped before the tool command completed.",
          },
        });
        mutations.push({
          targetPath: workshopMessagePath(seriesRoot, message.id),
          content: serializeJsonAuthority(nextMessage),
        });
        if (message.agentRunId && message.agentStepId) {
          const runIndex = reconciledRuns.findIndex((document) => document.run.id === message.agentRunId);
          const currentRun = runIndex >= 0 ? reconciledRuns[runIndex] : undefined;
          if (
            currentRun?.run.status === "waiting-confirmation" &&
            currentRun.run.activeStepId === message.agentStepId
          ) {
            const run = WorkshopAgentRunSchema.parse({
              ...currentRun.run,
              status: "interrupted",
              activeStepId: null,
              retryable: true,
              updatedAt: now,
              completedAt: now,
            });
            const raw = serializeJsonAuthority(run);
            mutations.push({ targetPath: workshopAgentRunPath(seriesRoot, run.id), content: raw });
            reconciledRuns[runIndex] = { run, revision: jsonAuthorityRevision(raw) };
          }
        }
      }

      if (mutations.length > 0) {
        mutations.push({
          targetPath: workshopSessionPath(seriesRoot, session.id),
          content: serializeJsonAuthority({ ...session, updatedAt: now }),
        });
        await applyFileTransaction(seriesRoot, mutations);
      }
      return WorkshopAgentRunListResultSchema.parse({
        runs: reconciledRuns,
        diagnostics: listed.diagnostics,
      });
    });
  }

  async updateWorkshopSession(
    seriesId: string,
    sessionId: string,
    rawInput: UpdateWorkshopSessionInput,
  ): Promise<WorkshopSession> {
    const input = UpdateWorkshopSessionInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return withWorkshopSessionMutationLock(workshopSessionMutationKey(seriesRoot, sessionId), async () => {
      const current = await readWorkshopSessionFile(seriesRoot, sessionId);
      if (current.status === "archived") {
        throw new StorageError("Archived Workshop session cannot be updated", "INVALID_DATA", {
          sessionId,
        });
      }
      if (input.expectedTitle !== undefined && current.title !== input.expectedTitle) return current;
      if (input.generalChatSystemPrompt !== undefined && current.kind !== "chat") {
        throw new StorageError("Agent sessions cannot own a General Chat system prompt", "INVALID_DATA", {
          sessionId,
        });
      }
      const { expectedTitle: _expectedTitle, ...update } = input;
      const updated = WorkshopSessionSchema.parse({
        ...current,
        ...update,
        updatedAt: new Date().toISOString(),
      });
      return writeWorkshopSessionFile(seriesRoot, updated);
    });
  }

  async archiveWorkshopSession(seriesId: string, sessionId: string): Promise<WorkshopSession> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return withWorkshopSessionMutationLock(workshopSessionMutationKey(seriesRoot, sessionId), async () => {
      const current = await readWorkshopSessionFile(seriesRoot, sessionId);
      const runningToolMessage = (await listWorkshopMessageFiles(seriesRoot, sessionId))
        .find((message) => message.toolExecution?.status === "running");
      if (runningToolMessage) {
        throw new StorageError("Workshop sessions with a running tool execution cannot be archived", "CONFLICT", {
          sessionId,
          messageId: runningToolMessage.id,
        });
      }
      const agentRuns = await listWorkshopAgentRunFiles(seriesRoot, sessionId);
      const runningAgentRun = agentRuns.runs.find((document) => document.run.status === "running");
      if (runningAgentRun) {
        throw new StorageError("Workshop sessions with a running Agent run cannot be archived", "CONFLICT", {
          sessionId,
          runId: runningAgentRun.run.id,
        });
      }
      const now = new Date().toISOString();
      return writeWorkshopSessionFile(seriesRoot, {
        ...current,
        status: "archived",
        archivedAt: current.archivedAt ?? now,
        updatedAt: now,
      });
    });
  }

  async restoreWorkshopSession(seriesId: string, sessionId: string): Promise<WorkshopSession> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return withWorkshopSessionMutationLock(workshopSessionMutationKey(seriesRoot, sessionId), async () => {
      const current = await readWorkshopSessionFile(seriesRoot, sessionId);
      return writeWorkshopSessionFile(seriesRoot, {
        ...current,
        status: "active",
        archivedAt: null,
        updatedAt: new Date().toISOString(),
      });
    });
  }

  async deleteWorkshopSession(
    seriesId: string,
    sessionId: string,
  ): Promise<DeleteWorkshopSessionResult> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return withWorkshopSessionMutationLock(workshopSessionMutationKey(seriesRoot, sessionId), async () => {
      const session = await readWorkshopSessionFile(seriesRoot, sessionId);
      if (session.seriesId !== seriesId) {
        throw new StorageError("Workshop session belongs to another series", "INVALID_DATA", {
          sessionId,
        });
      }
      const messages = await listWorkshopMessageFiles(seriesRoot, session.id);
      const agentRuns = await listWorkshopAgentRunFiles(seriesRoot, session.id);
      if (agentRuns.diagnostics.length > 0) {
        throw new StorageError("Workshop session has damaged Agent run records", "INVALID_DATA", {
          sessionId,
          diagnostics: agentRuns.diagnostics,
        });
      }
      const runningAgentRun = agentRuns.runs.find((document) => document.run.status === "running");
      if (runningAgentRun) {
        throw new StorageError("Workshop sessions with a running Agent run cannot be deleted", "CONFLICT", {
          sessionId,
          runId: runningAgentRun.run.id,
        });
      }
      const runningToolMessage = messages.find((message) => message.toolExecution?.status === "running");
      if (runningToolMessage) {
        throw new StorageError("Workshop sessions with a running tool execution cannot be deleted", "CONFLICT", {
          sessionId,
          messageId: runningToolMessage.id,
        });
      }
      const proposalLinkedMessages = messages.filter((message) => message.proposalIds.length > 0);
      if (proposalLinkedMessages.length > 0) {
        throw new StorageError("Workshop sessions with Proposal-linked messages cannot be deleted", "INVALID_DATA", {
          sessionId,
          messageIds: proposalLinkedMessages.map((message) => message.id),
        });
      }
      const attachments = await listWorkshopAttachmentFiles(seriesRoot, session.id);
      const deletedMessageIds = messages.map((message) => message.id);
      const deletedMessageIdSet = new Set(deletedMessageIds);
      const branches = (await listWorkshopBranchFiles(seriesRoot)).filter((branch) =>
        branch.sessionId === session.id || branch.sourceSessionId === session.id,
      );
      const now = new Date().toISOString();
      const relatedSessions = (await listWorkshopSessionFiles(seriesRoot))
        .filter((item) =>
          item.id !== session.id &&
          item.branchOfMessageId !== null &&
          deletedMessageIdSet.has(item.branchOfMessageId),
        )
        .map((item) => WorkshopSessionSchema.parse({
          ...item,
          branchOfMessageId: null,
          updatedAt: now,
        }));

      await applyFileTransaction(seriesRoot, [
        { targetPath: workshopSessionPath(seriesRoot, session.id), delete: true },
        { targetPath: workshopContextBasketPath(seriesRoot, session.id), delete: true },
        ...messages.map((message) => ({
          targetPath: workshopMessagePath(seriesRoot, message.id),
          delete: true,
        })),
        ...agentRuns.runs.map((document) => ({
          targetPath: workshopAgentRunPath(seriesRoot, document.run.id),
          delete: true,
        })),
        ...attachments.map((attachment) => ({
          targetPath: workshopAttachmentPath(seriesRoot, attachment.id),
          delete: true,
        })),
        ...branches.map((branch) => ({
          targetPath: workshopBranchPath(seriesRoot, branch.id),
          delete: true,
        })),
        ...relatedSessions.map((item) => ({
          targetPath: workshopSessionPath(seriesRoot, item.id),
          content: serializeJsonAuthority(item),
        })),
      ]);

      return DeleteWorkshopSessionResultSchema.parse({
        deletedId: session.id,
        deletedMessageIds,
        deletedAttachmentIds: attachments.map((attachment) => attachment.id),
        deletedBranchIds: branches.map((branch) => branch.id),
      });
    });
  }

  async listWorkshopBranches(seriesId: string): Promise<WorkshopBranch[]> {
    return (await listWorkshopBranchFiles(await this.findSeriesRoot(seriesId)))
      .filter((branch) => branch.seriesId === seriesId);
  }

  async branchWorkshopSession(
    seriesId: string,
    sessionId: string,
    rawInput: CreateWorkshopBranchInput,
  ): Promise<{ branch: WorkshopBranch; session: WorkshopSession }> {
    const input = CreateWorkshopBranchInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return withWorkshopSessionMutationLock(workshopSessionMutationKey(seriesRoot, sessionId), async () => {
    const sourceSession = await readWorkshopSessionFile(seriesRoot, sessionId);
    if (sourceSession.status === "archived") {
      throw new StorageError("Archived Workshop session cannot be branched", "INVALID_DATA", {
        sessionId,
      });
    }
    const sourceMessage = await readWorkshopMessageFile(seriesRoot, input.sourceMessageId);
    if (sourceMessage.sessionId !== sourceSession.id) {
      throw new StorageError("Source message does not belong to the Workshop session", "INVALID_DATA", {
        sessionId,
        sourceMessageId: input.sourceMessageId,
      });
    }
    const sourceMessages = await listWorkshopMessageFiles(seriesRoot, sourceSession.id);
    const sourceMessageIndex = sourceMessages.findIndex((message) => message.id === sourceMessage.id);
    if (sourceMessageIndex < 0) {
      throw new StorageError("Source message is not listed in the Workshop session", "INVALID_DATA", {
        sessionId,
        sourceMessageId: input.sourceMessageId,
      });
    }
    const branchMessages = sourceMessages.slice(0, sourceMessageIndex + 1);
    const runningToolMessage = branchMessages.find((message) => message.toolExecution?.status === "running");
    if (runningToolMessage) {
      throw new StorageError("Workshop branches cannot copy a running tool execution", "CONFLICT", {
        sessionId,
        messageId: runningToolMessage.id,
      });
    }
    const clonedMessageIds = new Map(branchMessages.map((message) => [message.id, randomUUID()]));
    const toolWithMissingResult = branchMessages.find((message) => (
      message.toolExecution?.resultMessageId !== null &&
      message.toolExecution?.resultMessageId !== undefined &&
      !clonedMessageIds.has(message.toolExecution.resultMessageId)
    ));
    if (toolWithMissingResult) {
      throw new StorageError("Workshop branch source must include the completed tool result", "CONFLICT", {
        sessionId,
        messageId: toolWithMissingResult.id,
        resultMessageId: toolWithMissingResult.toolExecution?.resultMessageId,
      });
    }
    const now = new Date().toISOString();
    const nextSession = WorkshopSessionSchema.parse({
      schemaVersion: 2,
      id: randomUUID(),
      seriesId,
      kind: sourceSession.kind,
      generalChatSystemPrompt: sourceSession.generalChatSystemPrompt,
      title: input.title ?? `${sourceSession.title} branch`,
      status: "active",
      branchOfMessageId: sourceMessage.id,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      lastMessageAt: branchMessages.at(-1)?.createdAt ?? null,
    });
    const currentBasket = await this.getWorkshopContextBasket(seriesId, sourceSession.id);
    const nextBasket = WorkshopContextBasketSchema.parse({
      ...currentBasket,
      id: randomUUID(),
      sessionId: nextSession.id,
      createdAt: now,
      updatedAt: now,
    });
    const sourceAttachments = await listWorkshopAttachmentFiles(seriesRoot, sourceSession.id);
    const sourceAttachmentById = new Map(sourceAttachments.map((attachment) => [attachment.id, attachment]));
    const clonedAttachments: WorkshopMessageAttachment[] = [];
    const clonedMessages = branchMessages.map((message) => {
      const nextMessageId = clonedMessageIds.get(message.id)!;
      const nextAttachmentIds = message.attachmentIds.map((attachmentId) => {
        const attachment = sourceAttachmentById.get(attachmentId);
        if (!attachment || attachment.messageId !== message.id) {
          throw new StorageError("Workshop branch source message has a missing attachment", "INVALID_DATA", {
            sessionId,
            messageId: message.id,
            attachmentId,
          });
        }
        const nextAttachmentId = randomUUID();
        clonedAttachments.push(WorkshopMessageAttachmentSchema.parse({
          ...attachment,
          id: nextAttachmentId,
          sessionId: nextSession.id,
          messageId: nextMessageId,
          draftToken: `branch-${nextSession.id}`,
          updatedAt: now,
        }));
        return nextAttachmentId;
      });
      return WorkshopMessageSchema.parse({
        ...message,
        id: nextMessageId,
        sessionId: nextSession.id,
        contextBundleId: null,
        modelCallId: null,
        proposalIds: [],
        agentRunId: null,
        agentStepId: null,
        attachmentIds: nextAttachmentIds,
        toolExecution: message.toolExecution
          ? {
            ...message.toolExecution,
            resultMessageId: message.toolExecution.resultMessageId
              ? clonedMessageIds.get(message.toolExecution.resultMessageId) ?? null
              : null,
          }
          : undefined,
      });
    });
    const branch = WorkshopBranchSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      seriesId,
      sourceSessionId: sourceSession.id,
      sourceMessageId: sourceMessage.id,
      sessionId: nextSession.id,
      title: nextSession.title,
      createdAt: now,
    });
    await applyFileTransaction(seriesRoot, [
      { targetPath: workshopSessionPath(seriesRoot, nextSession.id), content: serializeJsonAuthority(nextSession) },
      { targetPath: workshopContextBasketPath(seriesRoot, nextBasket.sessionId), content: serializeJsonAuthority(nextBasket) },
      ...clonedMessages.map((message) => ({
        targetPath: workshopMessagePath(seriesRoot, message.id),
        content: serializeJsonAuthority(message),
      })),
      ...clonedAttachments.map((attachment) => ({
        targetPath: workshopAttachmentPath(seriesRoot, attachment.id),
        content: serializeJsonAuthority(attachment),
      })),
      { targetPath: workshopBranchPath(seriesRoot, branch.id), content: serializeJsonAuthority(branch) },
    ]);
    return {
      branch,
      session: nextSession,
    };
    });
  }

  async listWorkshopMessages(seriesId: string, sessionId: string): Promise<WorkshopMessage[]> {
    await this.getWorkshopSession(seriesId, sessionId);
    return listWorkshopMessageFiles(await this.findSeriesRoot(seriesId), sessionId);
  }

  async listWorkshopAttachments(
    seriesId: string,
    sessionId: string,
    options: { draftToken?: string } = {},
  ): Promise<WorkshopMessageAttachment[]> {
    await this.getWorkshopSession(seriesId, sessionId);
    const attachments = await listWorkshopAttachmentFiles(await this.findSeriesRoot(seriesId), sessionId);
    return attachments.filter((attachment) =>
      !options.draftToken || attachment.draftToken === options.draftToken,
    );
  }

  async getWorkshopAttachment(
    seriesId: string,
    attachmentId: string,
  ): Promise<WorkshopMessageAttachment> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const attachment = await readWorkshopAttachmentFile(seriesRoot, attachmentId);
    if (attachment.seriesId !== seriesId) {
      throw new StorageError("Workshop message attachment belongs to another series", "INVALID_DATA", {
        attachmentId,
      });
    }
    return attachment;
  }

  async createWorkshopAttachment(
    seriesId: string,
    sessionId: string,
    rawAttachment: WorkshopMessageAttachment,
  ): Promise<WorkshopMessageAttachment> {
    const attachment = WorkshopMessageAttachmentSchema.parse(rawAttachment);
    if (attachment.seriesId !== seriesId || attachment.sessionId !== sessionId) {
      throw new StorageError("Workshop message attachment does not belong to the requested session", "INVALID_DATA", {
        attachmentId: attachment.id,
        sessionId,
      });
    }
    if (attachment.messageId !== null) {
      throw new StorageError("Workshop message attachment must be created as a draft", "INVALID_DATA", {
        attachmentId: attachment.id,
      });
    }
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return withWorkshopSessionMutationLock(workshopSessionMutationKey(seriesRoot, sessionId), async () => {
      const session = await readWorkshopSessionFile(seriesRoot, sessionId);
      if (session.status === "archived") {
        throw new StorageError("Archived Workshop session cannot receive attachments", "INVALID_DATA", {
          sessionId,
        });
      }
      return createWorkshopAttachmentFile(seriesRoot, attachment);
    });
  }

  async deleteWorkshopAttachment(
    seriesId: string,
    sessionId: string,
    attachmentId: string,
  ): Promise<DeleteWorkshopAttachmentResult> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return withWorkshopSessionMutationLock(workshopSessionMutationKey(seriesRoot, sessionId), async () => {
    const session = await readWorkshopSessionFile(seriesRoot, sessionId);
    if (session.seriesId !== seriesId) {
      throw new StorageError("Workshop session belongs to another series", "INVALID_DATA", { sessionId });
    }
    if (session.status === "archived") {
      throw new StorageError("Archived Workshop session cannot delete attachments", "INVALID_DATA", { sessionId });
    }
    const attachment = await readWorkshopAttachmentFile(seriesRoot, attachmentId);
    if (attachment.seriesId !== seriesId || attachment.sessionId !== sessionId) {
      throw new StorageError("Workshop message attachment does not belong to the requested session", "INVALID_DATA", {
        attachmentId,
        sessionId,
      });
    }
    if (attachment.messageId !== null) {
      throw new StorageError("Message-bound Workshop attachments cannot be deleted directly", "INVALID_DATA", {
        attachmentId,
        messageId: attachment.messageId,
      });
    }
    await applyFileTransaction(seriesRoot, [
      { targetPath: workshopAttachmentPath(seriesRoot, attachment.id), delete: true },
    ]);
    return DeleteWorkshopAttachmentResultSchema.parse({ deletedId: attachment.id });
    });
  }

  async getWorkshopMessageSource(
    seriesId: string,
    messageId: string,
  ): Promise<WorkshopMessageSource> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const message = await readWorkshopMessageFile(seriesRoot, messageId);
    if (message.seriesId !== seriesId) {
      throw new StorageError("Workshop message belongs to another series", "INVALID_DATA", {
        messageId,
      });
    }
    const session = await readWorkshopSessionFile(seriesRoot, message.sessionId);
    if (session.seriesId !== seriesId) {
      throw new StorageError("Workshop source session belongs to another series", "INVALID_DATA", {
        sessionId: session.id,
      });
    }
    return WorkshopMessageSourceSchema.parse({ session, message });
  }

  async createWorkshopMessage(
    seriesId: string,
    sessionId: string,
    rawInput: CreateWorkshopMessageInput,
  ): Promise<WorkshopMessage> {
    const input = CreateWorkshopMessageInputSchema.parse(rawInput);
    const now = new Date().toISOString();
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return withWorkshopSessionMutationLock(workshopSessionMutationKey(seriesRoot, sessionId), async () => {
    const session = await readWorkshopSessionFile(seriesRoot, sessionId);
    if (session.seriesId !== seriesId) {
      throw new StorageError("Workshop session belongs to another series", "INVALID_DATA", { sessionId });
    }
    if (session.status === "archived") {
      throw new StorageError("Archived Workshop session cannot receive messages", "INVALID_DATA", {
        sessionId: session.id,
      });
    }
    if (session.kind === "agent" && input.mode !== "agent") {
      throw new StorageError("Agent Workshop sessions can only receive Agent messages", "INVALID_DATA", {
        sessionId,
        mode: input.mode,
      });
    }
    if (session.kind === "chat" && input.mode === "agent") {
      throw new StorageError("General Workshop chat sessions cannot receive Agent messages", "INVALID_DATA", {
        sessionId,
      });
    }
    const attachmentIds = [...new Set(input.attachmentIds)];
    if (attachmentIds.length !== input.attachmentIds.length) {
      throw new StorageError("Workshop message cannot reference duplicate attachments", "INVALID_DATA", {
        attachmentIds: input.attachmentIds,
      });
    }
    const message = WorkshopMessageSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      seriesId,
      sessionId,
      role: input.role,
      mode: input.mode,
      status: "succeeded",
      content: input.content,
      contextBundleId: null,
      modelCallId: null,
      proposalIds: [],
      attachmentIds,
      errorCode: null,
      errorMessage: null,
      createdAt: now,
    });
    const attachmentWrites: WorkshopMessageAttachment[] = [];
    for (const attachmentId of attachmentIds) {
      const attachment = await readWorkshopAttachmentFile(seriesRoot, attachmentId);
      if (attachment.seriesId !== seriesId || attachment.sessionId !== sessionId) {
        throw new StorageError("Workshop message attachment does not belong to the requested session", "INVALID_DATA", {
          attachmentId,
          sessionId,
        });
      }
      if (attachment.draftToken !== input.draftToken) {
        throw new StorageError("Workshop message attachment belongs to another draft", "INVALID_DATA", {
          attachmentId,
        });
      }
      if (attachment.messageId !== null) {
        throw new StorageError("Workshop message attachment is already bound to a message", "INVALID_DATA", {
          attachmentId,
          messageId: attachment.messageId,
        });
      }
      if (attachment.parseStatus !== "parsed") {
        throw new StorageError("Workshop message attachment has not parsed successfully", "INVALID_DATA", {
          attachmentId,
          parseStatus: attachment.parseStatus,
        });
      }
      attachmentWrites.push(WorkshopMessageAttachmentSchema.parse({
        ...attachment,
        messageId: message.id,
        updatedAt: now,
      }));
    }
    const messagePath = workshopMessagePath(seriesRoot, message.id);
    if (await pathExists(messagePath)) {
      throw new StorageError("Workshop message already exists", "INVALID_DATA", { messageId: message.id });
    }
    const nextSession = WorkshopSessionSchema.parse({
      ...session,
      lastMessageAt: message.createdAt,
      updatedAt: message.createdAt,
    });
    await applyFileTransaction(seriesRoot, [
      { targetPath: messagePath, content: serializeJsonAuthority(message) },
      ...attachmentWrites.map((attachment) => ({
        targetPath: workshopAttachmentPath(seriesRoot, attachment.id),
        content: serializeJsonAuthority(attachment),
      })),
      { targetPath: workshopSessionPath(seriesRoot, session.id), content: serializeJsonAuthority(nextSession) },
    ]);
    return readWorkshopMessageFile(seriesRoot, message.id);
    });
  }

  async saveWorkshopMessage(seriesId: string, message: WorkshopMessage): Promise<WorkshopMessage> {
    const parsed = WorkshopMessageSchema.parse(message);
    if (parsed.seriesId !== seriesId) {
      throw new StorageError("Workshop message belongs to another series", "INVALID_DATA", {
        messageId: parsed.id,
      });
    }
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return withWorkshopSessionMutationLock(workshopSessionMutationKey(seriesRoot, parsed.sessionId), async () => {
    const session = await readWorkshopSessionFile(seriesRoot, parsed.sessionId);
    if (session.status === "archived") {
      throw new StorageError("Archived Workshop session cannot receive messages", "INVALID_DATA", {
        sessionId: session.id,
      });
    }
    if (session.kind === "agent" && parsed.mode !== "agent") {
      throw new StorageError("Agent Workshop sessions can only receive Agent messages", "INVALID_DATA", {
        sessionId: parsed.sessionId,
        mode: parsed.mode,
      });
    }
    if (session.kind === "chat" && parsed.mode === "agent") {
      throw new StorageError("General Workshop chat sessions cannot receive Agent messages", "INVALID_DATA", {
        sessionId: parsed.sessionId,
      });
    }
    for (const attachmentId of parsed.attachmentIds) {
      const attachment = await readWorkshopAttachmentFile(seriesRoot, attachmentId);
      if (attachment.seriesId !== seriesId || attachment.sessionId !== parsed.sessionId) {
        throw new StorageError("Workshop message attachment does not belong to the message session", "INVALID_DATA", {
          attachmentId,
          sessionId: parsed.sessionId,
        });
      }
      if (attachment.messageId !== parsed.id) {
        throw new StorageError("Workshop message attachment is not bound to this message", "INVALID_DATA", {
          attachmentId,
          messageId: parsed.id,
        });
      }
    }
    const messagePath = workshopMessagePath(seriesRoot, parsed.id);
    if (await pathExists(messagePath)) {
      throw new StorageError("Workshop message already exists", "INVALID_DATA", { messageId: parsed.id });
    }
    const nextSession = WorkshopSessionSchema.parse({
      ...session,
      lastMessageAt: parsed.createdAt,
      updatedAt: parsed.createdAt,
    });
    await applyFileTransaction(seriesRoot, [
      { targetPath: messagePath, content: serializeJsonAuthority(parsed) },
      { targetPath: workshopSessionPath(seriesRoot, session.id), content: serializeJsonAuthority(nextSession) },
    ]);
    return readWorkshopMessageFile(seriesRoot, parsed.id);
    });
  }

  async claimWorkshopMessageToolExecution(
    seriesId: string,
    sessionId: string,
    messageId: string,
    requestHash: string,
  ): Promise<WorkshopToolExecutionClaimResult> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return withWorkshopSessionMutationLock(workshopSessionMutationKey(seriesRoot, sessionId), async () => {
      const { session, message } = await this.getWorkshopMessageSource(seriesId, messageId);
      if (session.id !== sessionId || message.sessionId !== sessionId) {
        throw new StorageError("Workshop message does not belong to the requested session", "INVALID_DATA", {
          sessionId,
          messageId,
        });
      }
      if (session.status === "archived") {
        return { status: "archived", message };
      }
      if (session.kind !== "agent" || message.role !== "tool" || message.mode !== "agent") {
        throw new StorageError("Only Agent tool messages can record tool execution state", "INVALID_DATA", {
          messageId,
          role: message.role,
          mode: message.mode,
        });
      }
      if (message.toolExecution) {
        if (
          message.toolExecution.status !== "interrupted" ||
          !message.toolExecution.retryable ||
          message.toolExecution.requestHash !== requestHash
        ) {
          return { status: "existing", message };
        }
        const restartedAt = new Date().toISOString();
        const nextMessage = WorkshopMessageSchema.parse({
          ...message,
          toolExecution: {
            ...message.toolExecution,
            status: "running",
            attempt: message.toolExecution.attempt + 1,
            retryable: false,
            startedAt: restartedAt,
            completedAt: null,
            resultMessageId: null,
            errorCode: null,
            errorMessage: null,
          },
        });
        const mutations: FileMutation[] = [{
          targetPath: workshopMessagePath(seriesRoot, message.id),
          content: serializeJsonAuthority(nextMessage),
        }];
        if (message.agentRunId && message.agentStepId) {
          const currentRun = await readWorkshopAgentRunFile(seriesRoot, message.agentRunId);
          if (currentRun.run.status !== "interrupted") {
            return { status: "existing", message };
          }
          const restartedRun = WorkshopAgentRunSchema.parse({
            ...currentRun.run,
            status: "waiting-confirmation",
            activeStepId: message.agentStepId,
            retryable: false,
            updatedAt: restartedAt,
            completedAt: null,
          });
          mutations.push({
            targetPath: workshopAgentRunPath(seriesRoot, restartedRun.id),
            content: serializeJsonAuthority(restartedRun),
          });
        }
        mutations.push({
          targetPath: workshopSessionPath(seriesRoot, session.id),
          content: serializeJsonAuthority({ ...session, updatedAt: restartedAt }),
        });
        await applyFileTransaction(seriesRoot, mutations);
        return { status: "claimed", message: await readWorkshopMessageFile(seriesRoot, message.id) };
      }
      const startedAt = new Date().toISOString();
      const nextMessage = WorkshopMessageSchema.parse({
        ...message,
        toolExecution: {
          requestHash,
          status: "running",
          startedAt,
          completedAt: null,
          resultMessageId: null,
          errorCode: null,
          errorMessage: null,
        },
      });
      const nextSession = WorkshopSessionSchema.parse({
        ...session,
        updatedAt: startedAt,
      });
      await applyFileTransaction(seriesRoot, [
        { targetPath: workshopMessagePath(seriesRoot, message.id), content: serializeJsonAuthority(nextMessage) },
        { targetPath: workshopSessionPath(seriesRoot, session.id), content: serializeJsonAuthority(nextSession) },
      ]);
      return { status: "claimed", message: await readWorkshopMessageFile(seriesRoot, message.id) };
    });
  }

  async updateWorkshopMessageToolExecution(
    seriesId: string,
    sessionId: string,
    messageId: string,
    toolExecution: WorkshopToolExecution,
  ): Promise<WorkshopMessage> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return withWorkshopSessionMutationLock(workshopSessionMutationKey(seriesRoot, sessionId), async () => {
      const { session, message } = await this.getWorkshopMessageSource(seriesId, messageId);
      if (session.id !== sessionId || message.sessionId !== sessionId) {
        throw new StorageError("Workshop message does not belong to the requested session", "INVALID_DATA", {
          sessionId,
          messageId,
        });
      }
      if (session.status === "archived") {
        throw new StorageError("Archived Workshop session cannot update tool execution state", "INVALID_DATA", {
          sessionId,
        });
      }
      if (session.kind !== "agent" || message.role !== "tool" || message.mode !== "agent") {
        throw new StorageError("Only Agent tool messages can record tool execution state", "INVALID_DATA", {
          messageId,
          role: message.role,
          mode: message.mode,
        });
      }
      if (!message.toolExecution || message.toolExecution.status !== "running") {
        throw new StorageError("Workshop tool execution is not running", "CONFLICT", { messageId });
      }
      if (message.toolExecution.requestHash !== toolExecution.requestHash) {
        throw new StorageError("Workshop tool execution request hash changed", "CONFLICT", { messageId });
      }
      const nextMessage = WorkshopMessageSchema.parse({
        ...message,
        toolExecution: {
          ...toolExecution,
          startedAt: message.toolExecution.startedAt,
        },
      });
      const nextSession = WorkshopSessionSchema.parse({
        ...session,
        updatedAt: new Date().toISOString(),
      });
      await applyFileTransaction(seriesRoot, [
        { targetPath: workshopMessagePath(seriesRoot, message.id), content: serializeJsonAuthority(nextMessage) },
        { targetPath: workshopSessionPath(seriesRoot, session.id), content: serializeJsonAuthority(nextSession) },
      ]);
      return readWorkshopMessageFile(seriesRoot, message.id);
    });
  }

  async executeWorkshopCodexCreateCommand(
    seriesId: string,
    rawCommand: ExecuteWorkshopCodexCreateCommand,
  ): Promise<WorkshopCodexCreateCommandResult> {
    const entryInput = CreateCodexEntryInputSchema.parse(rawCommand.entryInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const result = await runSeriesFileTransaction(seriesRoot, async (commit) => {
      const session = await readWorkshopSessionFile(seriesRoot, rawCommand.sessionId);
      const toolMessage = await readWorkshopMessageFile(seriesRoot, rawCommand.messageId);
      this.assertRunningWorkshopCodexCommand(
        seriesId,
        session,
        toolMessage,
        rawCommand.requestHash,
      );
      await this.assertCodexCategoryWritable(seriesRoot, entryInput.categoryId);

      const currentDetailTypes = await this.listCodexDetailTypes(seriesId, {
        categoryId: entryInput.categoryId,
      });
      const detailTypeDocuments = [...currentDetailTypes];
      const createdDetailTypes: CodexDetailTypeDocument[] = [];
      const detailTypeMutations: FileMutation[] = [];
      const seenDetailTypeIds = new Set(currentDetailTypes.map((item) => item.detailType.id));
      const now = new Date().toISOString();
      for (const creation of rawCommand.detailTypeCreations) {
        if (seenDetailTypeIds.has(creation.id)) {
          throw new StorageError("Codex detail type command repeats an existing id", "INVALID_DATA", {
            detailTypeId: creation.id,
          });
        }
        this.assertCodexDetailTypeNameAvailable(
          detailTypeDocuments,
          creation.name,
          entryInput.categoryId,
        );
        const detailType = CodexDetailTypeSchema.parse({
          schemaVersion: 2,
          id: creation.id,
          categoryId: entryInput.categoryId,
          name: creation.name,
          description: "",
          nsfw: creation.nsfw ?? false,
          createdAt: now,
          updatedAt: now,
        });
        const detailTypePath = codexDetailTypePath(seriesRoot, detailType.id);
        if (await pathExists(detailTypePath)) {
          throw new StorageError("Codex detail type target already exists", "CONFLICT", {
            detailTypeId: detailType.id,
          });
        }
        const raw = serializeJsonAuthority(detailType);
        const document = CodexDetailTypeDocumentSchema.parse({
          detailType,
          revision: jsonAuthorityRevision(raw),
        });
        seenDetailTypeIds.add(detailType.id);
        detailTypeDocuments.push(document);
        createdDetailTypes.push(document);
        detailTypeMutations.push({ targetPath: detailTypePath, content: raw });
      }
      this.assertWorkshopCodexDetailReferences(
        entryInput.categoryId,
        entryInput.details,
        entryInput.detailAiContext,
        detailTypeDocuments,
      );

      const entryId = randomUUID();
      const metadata = CodexEntryMetadataSchema.parse({
        schemaVersion: 1,
        id: entryId,
        categoryId: entryInput.categoryId,
        name: entryInput.name,
        aliases: normalizeUniqueStrings(entryInput.aliases),
        thumbnail: entryInput.thumbnail,
        details: entryInput.details,
        detailAiContext: entryInput.detailAiContext,
        aiContextPolicy: entryInput.aiContextPolicy,
        mention: {
          ...entryInput.mention,
          excludedTerms: normalizeUniqueStrings(entryInput.mention.excludedTerms),
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
      const entryRaw = serializeCodexEntry(metadata, entryInput.description);
      const researchRaw = serializeCodexResearch(researchMetadata, entryInput.research);
      const entry = CodexEntryDocumentSchema.parse({
        metadata,
        description: entryInput.description,
        revision: jsonAuthorityRevision(entryRaw),
        relativePath: path.relative(seriesRoot, entryPath),
        research: {
          metadata: researchMetadata,
          content: entryInput.research,
          revision: jsonAuthorityRevision(researchRaw),
          relativePath: path.relative(seriesRoot, researchPath),
        },
      });
      let resultMessage = this.workshopCodexResultMessage({
        seriesId,
        session,
        toolMessage,
        content: `codex.create_entry created Codex entry: ${entry.metadata.name}`,
        createdAt: now,
      });
      const agentCompletion = await this.completeWorkshopAgentToolResult(
        seriesRoot,
        toolMessage,
        resultMessage,
        now,
      );
      resultMessage = agentCompletion.resultMessage;
      const completed = this.completeWorkshopCodexCommand(
        session,
        toolMessage,
        rawCommand.requestHash,
        resultMessage,
        now,
      );

      await commit([
        ...detailTypeMutations,
        { targetPath: entryPath, content: entryRaw },
        { targetPath: researchPath, content: researchRaw },
        {
          targetPath: workshopMessagePath(seriesRoot, resultMessage.id),
          content: serializeJsonAuthority(resultMessage),
        },
        {
          targetPath: workshopMessagePath(seriesRoot, completed.message.id),
          content: serializeJsonAuthority(completed.message),
        },
        {
          targetPath: workshopSessionPath(seriesRoot, completed.session.id),
          content: serializeJsonAuthority(completed.session),
        },
        ...(agentCompletion.runMutation ? [agentCompletion.runMutation] : []),
      ]);
      return {
        createdDetailTypes,
        entry,
        message: completed.message,
        resultMessage,
        agentRun: agentCompletion.runDocument,
      };
    });
    await this.rebuildCodexIndex(seriesRoot).catch(() => undefined);
    return result;
  }

  async recordWorkshopCodexCommandFailure(
    seriesId: string,
    input: {
      sessionId: string;
      messageId: string;
      requestHash: string;
      errorCode: string;
      errorMessage: string;
    },
  ): Promise<{
    message: WorkshopMessage;
    resultMessage: WorkshopMessage;
    agentRun: WorkshopAgentRunDocument | null;
  }> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return runSeriesFileTransaction(seriesRoot, async (commit) => {
      const session = await readWorkshopSessionFile(seriesRoot, input.sessionId);
      const toolMessage = await readWorkshopMessageFile(seriesRoot, input.messageId);
      this.assertRunningWorkshopCodexCommand(seriesId, session, toolMessage, input.requestHash);
      const completedAt = new Date().toISOString();
      const errorCode = input.errorCode.slice(0, 120) || "INVALID_DATA";
      const errorMessage = input.errorMessage.slice(0, 4000) || "The confirmed Codex command failed.";
      let resultMessage = this.workshopCodexResultMessage({
        seriesId,
        session,
        toolMessage,
        content: `${JSON.parse(toolMessage.content).tool ?? "Codex command"} failed: ${errorMessage}`,
        createdAt: completedAt,
        status: "failed",
        errorCode,
        errorMessage,
      });
      const agentCompletion = await this.completeWorkshopAgentToolResult(
        seriesRoot,
        toolMessage,
        resultMessage,
        completedAt,
      );
      resultMessage = agentCompletion.resultMessage;
      const completed = this.completeWorkshopCodexCommand(
        session,
        toolMessage,
        input.requestHash,
        resultMessage,
        completedAt,
      );
      await commit([
        { targetPath: workshopMessagePath(seriesRoot, resultMessage.id), content: serializeJsonAuthority(resultMessage) },
        { targetPath: workshopMessagePath(seriesRoot, completed.message.id), content: serializeJsonAuthority(completed.message) },
        { targetPath: workshopSessionPath(seriesRoot, completed.session.id), content: serializeJsonAuthority(completed.session) },
        ...(agentCompletion.runMutation ? [agentCompletion.runMutation] : []),
      ]);
      return {
        message: completed.message,
        resultMessage,
        agentRun: agentCompletion.runDocument,
      };
    });
  }

  async executeWorkshopCodexUpdateCommand(
    seriesId: string,
    rawCommand: ExecuteWorkshopCodexUpdateCommand,
  ): Promise<WorkshopCodexUpdateCommandResult> {
    const entryInput = rawCommand.entryInput
      ? UpdateCodexEntryInputSchema.parse(rawCommand.entryInput)
      : null;
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const result = await runSeriesFileTransaction(seriesRoot, async (commit) => {
      const session = await readWorkshopSessionFile(seriesRoot, rawCommand.sessionId);
      const toolMessage = await readWorkshopMessageFile(seriesRoot, rawCommand.messageId);
      this.assertRunningWorkshopCodexCommand(
        seriesId,
        session,
        toolMessage,
        rawCommand.requestHash,
      );
      const current = await this.findCodexEntry(seriesRoot, rawCommand.entryId);
      if (
        current.document.revision !== rawCommand.baseEntryRevision ||
        current.document.research.revision !== rawCommand.baseResearchRevision
      ) {
        throw new StorageError("Workshop Codex update draft is stale", "CONFLICT", {
          entryId: rawCommand.entryId,
          currentEntryRevision: current.document.revision,
          currentResearchRevision: current.document.research.revision,
        });
      }
      if (current.document.metadata.archivedAt) {
        throw new StorageError("Archived Codex entries cannot be updated", "INVALID_DATA", {
          entryId: rawCommand.entryId,
        });
      }

      const now = new Date().toISOString();
      const currentDetailTypes = await this.listCodexDetailTypes(seriesId, {
        categoryId: current.document.metadata.categoryId,
      });
      const detailTypeDocuments = [...currentDetailTypes];
      const createdDetailTypes: CodexDetailTypeDocument[] = [];
      const mutations: FileMutation[] = [];
      const seenDetailTypeIds = new Set(currentDetailTypes.map((item) => item.detailType.id));
      for (const creation of rawCommand.detailTypeCreations) {
        if (seenDetailTypeIds.has(creation.id)) {
          throw new StorageError("Codex detail type command repeats an existing id", "INVALID_DATA", {
            detailTypeId: creation.id,
          });
        }
        this.assertCodexDetailTypeNameAvailable(
          detailTypeDocuments,
          creation.name,
          current.document.metadata.categoryId,
        );
        const detailType = CodexDetailTypeSchema.parse({
          schemaVersion: 2,
          id: creation.id,
          categoryId: current.document.metadata.categoryId,
          name: creation.name,
          description: "",
          nsfw: creation.nsfw ?? false,
          createdAt: now,
          updatedAt: now,
        });
        const detailTypePath = codexDetailTypePath(seriesRoot, detailType.id);
        if (await pathExists(detailTypePath)) {
          throw new StorageError("Codex detail type target already exists", "CONFLICT", {
            detailTypeId: detailType.id,
          });
        }
        const raw = serializeJsonAuthority(detailType);
        const document = CodexDetailTypeDocumentSchema.parse({
          detailType,
          revision: jsonAuthorityRevision(raw),
        });
        seenDetailTypeIds.add(detailType.id);
        detailTypeDocuments.push(document);
        createdDetailTypes.push(document);
        mutations.push({ targetPath: detailTypePath, content: raw });
      }

      let updatedEntry = current.document;
      if (entryInput) {
        if (
          entryInput.baseRevision && entryInput.baseRevision !== rawCommand.baseEntryRevision
        ) {
          throw new StorageError("Workshop entry command baseline does not match its draft", "CONFLICT");
        }
        if (
          entryInput.baseResearchRevision &&
          entryInput.baseResearchRevision !== rawCommand.baseResearchRevision
        ) {
          throw new StorageError("Workshop research command baseline does not match its draft", "CONFLICT");
        }
        updatedEntry = await this.prepareWorkshopCodexEntryUpdate({
          seriesRoot,
          current,
          input: entryInput,
          detailTypes: detailTypeDocuments,
          now,
          mutations,
        });
      }

      const createdProgressions: CodexProgressionDocument[] = [];
      const updatedProgressions: CodexProgressionDocument[] = [];
      const deletedProgressions: DeleteCodexProgressionResult[] = [];
      const progressionTargets = new Set<string>();
      for (const command of rawCommand.progressions) {
        if (command.action !== "create") {
          if (progressionTargets.has(command.progressionId)) {
            throw new StorageError("Workshop command repeats a Progression target", "INVALID_DATA", {
              progressionId: command.progressionId,
            });
          }
          progressionTargets.add(command.progressionId);
        }
        if (command.action === "create") {
          const input = CreateCodexProgressionInputSchema.parse(command.input);
          const progression = CodexProgressionSchema.parse({
            schemaVersion: 1,
            id: randomUUID(),
            kind: input.kind,
            entryId: input.entryId ?? null,
            relationId: input.relationId ?? null,
            field: input.field ?? null,
            fieldKey: input.fieldKey ?? null,
            operation: input.operation,
            body: input.body ?? "",
            summary: input.summary,
            effectiveFromSceneId: input.effectiveFromSceneId,
            effectiveToSceneId: input.effectiveToSceneId ?? null,
            source: input.source,
            evidence: input.evidence,
            createdAt: now,
            updatedAt: now,
            archivedAt: null,
          });
          await this.assertWorkshopProgressionOwnedByEntry(
            seriesRoot,
            rawCommand.entryId,
            progression,
          );
          await this.assertCodexProgressionReferences(seriesId, seriesRoot, progression, {
            knownDetailTypes: createdDetailTypes.map((item) => item.detailType),
          });
          const raw = serializeJsonAuthority(progression);
          mutations.push({
            targetPath: codexProgressionPath(seriesRoot, progression.id),
            content: raw,
          });
          createdProgressions.push(CodexProgressionDocumentSchema.parse({
            progression,
            revision: jsonAuthorityRevision(raw),
          }));
          continue;
        }

        const currentProgression = await this.readCodexProgression(
          seriesRoot,
          command.progressionId,
        );
        if (
          currentProgression.revision !== command.baseRevision ||
          !codexProgressionBindingMatches(currentProgression.progression, command.binding)
        ) {
          throw new StorageError("Workshop Progression target is stale or was rebound", "CONFLICT", {
            progressionId: command.progressionId,
            currentRevision: currentProgression.revision,
          });
        }
        await this.assertWorkshopProgressionOwnedByEntry(
          seriesRoot,
          rawCommand.entryId,
          currentProgression.progression,
        );
        if (command.action === "update") {
          const input = UpdateCodexProgressionInputSchema.parse(command.input);
          assertAgentProgressionUpdateDoesNotRetarget(input);
          if (input.baseRevision !== command.baseRevision) {
            throw new StorageError("Workshop Progression command baseline does not match its draft", "CONFLICT");
          }
          const { baseRevision: _baseRevision, ...changes } = input;
          const progression = CodexProgressionSchema.parse({
            ...currentProgression.progression,
            ...changes,
            updatedAt: now,
          });
          await this.assertCodexProgressionReferences(seriesId, seriesRoot, progression, {
            knownDetailTypes: createdDetailTypes.map((item) => item.detailType),
          });
          const raw = serializeJsonAuthority(progression);
          mutations.push({
            targetPath: codexProgressionPath(seriesRoot, progression.id),
            content: raw,
          });
          updatedProgressions.push(CodexProgressionDocumentSchema.parse({
            progression,
            revision: jsonAuthorityRevision(raw),
          }));
        } else {
          const blockers = await this.progressionDeleteBlockers(seriesId, command.progressionId);
          if (blockers.length > 0) {
            throw new StorageError("Progression has blocking references", "INVALID_DATA", {
              progressionId: command.progressionId,
              blockers,
            });
          }
          mutations.push({
            targetPath: codexProgressionPath(seriesRoot, command.progressionId),
            delete: true,
          });
          deletedProgressions.push(DeleteCodexProgressionResultSchema.parse({
            deletedId: command.progressionId,
            blockers: [],
          }));
        }
      }

      const progressionSummary = [
        createdProgressions.length ? `${createdProgressions.length} progression(s) created` : "",
        updatedProgressions.length ? `${updatedProgressions.length} progression(s) updated` : "",
        deletedProgressions.length ? `${deletedProgressions.length} progression(s) deleted` : "",
      ].filter(Boolean).join("; ");
      let resultMessage = this.workshopCodexResultMessage({
        seriesId,
        session,
        toolMessage,
        content: progressionSummary
          ? `codex.update_entry updated Codex entry: ${updatedEntry.metadata.name} (${progressionSummary})`
          : `codex.update_entry updated Codex entry: ${updatedEntry.metadata.name}`,
        createdAt: now,
      });
      const agentCompletion = await this.completeWorkshopAgentToolResult(
        seriesRoot,
        toolMessage,
        resultMessage,
        now,
      );
      resultMessage = agentCompletion.resultMessage;
      const completed = this.completeWorkshopCodexCommand(
        session,
        toolMessage,
        rawCommand.requestHash,
        resultMessage,
        now,
      );
      mutations.push(
        {
          targetPath: workshopMessagePath(seriesRoot, resultMessage.id),
          content: serializeJsonAuthority(resultMessage),
        },
        {
          targetPath: workshopMessagePath(seriesRoot, completed.message.id),
          content: serializeJsonAuthority(completed.message),
        },
        {
          targetPath: workshopSessionPath(seriesRoot, completed.session.id),
          content: serializeJsonAuthority(completed.session),
        },
        ...(agentCompletion.runMutation ? [agentCompletion.runMutation] : []),
      );
      await commit(mutations);
      return {
        createdDetailTypes,
        createdProgressions,
        deletedProgressions,
        entry: updatedEntry,
        message: completed.message,
        resultMessage,
        updatedProgressions,
        agentRun: agentCompletion.runDocument,
      };
    });
    await this.rebuildCodexIndex(seriesRoot).catch(() => undefined);
    return result;
  }

  async deleteWorkshopMessage(
    seriesId: string,
    sessionId: string,
    messageId: string,
  ): Promise<DeleteWorkshopMessageResult> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return withWorkshopSessionMutationLock(workshopSessionMutationKey(seriesRoot, sessionId), async () => {
      const session = await readWorkshopSessionFile(seriesRoot, sessionId);
      if (session.seriesId !== seriesId) {
        throw new StorageError("Workshop session belongs to another series", "INVALID_DATA", {
          sessionId,
        });
      }
      if (session.status === "archived") {
        throw new StorageError("Archived Workshop session cannot delete turns", "INVALID_DATA", {
          sessionId,
        });
      }
      if (session.kind !== "chat") {
        throw new StorageError("Agent session history cannot delete individual turns", "INVALID_DATA", {
          sessionId,
        });
      }
      const sessionMessages = await listWorkshopMessageFiles(seriesRoot, sessionId);
      const messageIndex = sessionMessages.findIndex((message) => message.id === messageId);
      if (messageIndex < 0) {
        throw new StorageError("Workshop message does not exist in the requested session", "NOT_FOUND", {
          sessionId,
          messageId,
        });
      }
      let turnStart = messageIndex;
      while (turnStart >= 0 && sessionMessages[turnStart]?.role !== "author") {
        turnStart -= 1;
      }
      if (turnStart < 0) {
        throw new StorageError("Workshop message is not part of an author-started General Chat turn", "INVALID_DATA", {
          messageId,
        });
      }
      let turnEnd = turnStart + 1;
      while (turnEnd < sessionMessages.length && sessionMessages[turnEnd]?.role !== "author") {
        turnEnd += 1;
      }
      const deletedMessages = sessionMessages.slice(turnStart, turnEnd);
      const protectedMessages = deletedMessages.filter((message) =>
        message.mode !== "general-chat" ||
        (message.role !== "author" && message.role !== "assistant") ||
        message.status === "pending" ||
        message.proposalIds.length > 0,
      );
      if (protectedMessages.length > 0) {
        throw new StorageError("Workshop turn contains protected or incomplete records", "INVALID_DATA", {
          messageId,
          protectedMessageIds: protectedMessages.map((message) => message.id),
        });
      }

      const deletedMessageIds = deletedMessages.map((message) => message.id);
      const deletedMessageIdSet = new Set(deletedMessageIds);
      const remainingMessages = sessionMessages.filter((message) => !deletedMessageIdSet.has(message.id));
      const attached = (await listWorkshopAttachmentFiles(seriesRoot, sessionId))
        .filter((attachment) =>
          (attachment.messageId !== null && deletedMessageIdSet.has(attachment.messageId)) ||
          deletedMessages.some((message) => message.attachmentIds.includes(attachment.id)),
        );
      const branches = (await listWorkshopBranchFiles(seriesRoot)).filter((branch) =>
        deletedMessageIdSet.has(branch.sourceMessageId),
      );
      const lastMessage = remainingMessages.at(-1) ?? null;
      const now = new Date().toISOString();
      const relatedSessions = (await listWorkshopSessionFiles(seriesRoot))
        .filter((candidate) =>
          candidate.branchOfMessageId !== null &&
          deletedMessageIdSet.has(candidate.branchOfMessageId),
        )
        .map((candidate) => WorkshopSessionSchema.parse({
          ...candidate,
          branchOfMessageId: null,
          updatedAt: now,
        }));
      const nextSession = WorkshopSessionSchema.parse({
        ...session,
        lastMessageAt: lastMessage?.createdAt ?? null,
        updatedAt: now,
      });
      await applyFileTransaction(seriesRoot, [
        ...deletedMessages.map((message) => ({
          targetPath: workshopMessagePath(seriesRoot, message.id),
          delete: true,
        })),
        ...attached.map((attachment) => ({
          targetPath: workshopAttachmentPath(seriesRoot, attachment.id),
          delete: true,
        })),
        ...branches.map((branch) => ({
          targetPath: workshopBranchPath(seriesRoot, branch.id),
          delete: true,
        })),
        ...relatedSessions.map((candidate) => ({
          targetPath: workshopSessionPath(seriesRoot, candidate.id),
          content: serializeJsonAuthority(candidate),
        })),
        { targetPath: workshopSessionPath(seriesRoot, session.id), content: serializeJsonAuthority(nextSession) },
      ]);
      return DeleteWorkshopMessageResultSchema.parse({
        deletedMessageIds,
        deletedAttachmentIds: attached.map((attachment) => attachment.id),
        deletedBranchIds: branches.map((branch) => branch.id),
        session: await readWorkshopSessionFile(seriesRoot, session.id),
      });
    });
  }

  async replaceWorkshopGeneralChatAuthorMessage(
    seriesId: string,
    sessionId: string,
    messageId: string,
    content: string,
  ): Promise<ReplaceWorkshopMessageResult> {
    const nextContent = content.trim();
    if (!nextContent) {
      throw new StorageError("Workshop message content is required", "INVALID_DATA", { messageId });
    }
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return withWorkshopSessionMutationLock(workshopSessionMutationKey(seriesRoot, sessionId), async () => {
    const session = await readWorkshopSessionFile(seriesRoot, sessionId);
    if (session.seriesId !== seriesId) {
      throw new StorageError("Workshop session belongs to another series", "INVALID_DATA", { sessionId });
    }
    if (session.status === "archived") {
      throw new StorageError("Archived Workshop session cannot resend messages", "INVALID_DATA", { sessionId });
    }
    if (session.kind !== "chat") {
      throw new StorageError("Only General Chat sessions can resend messages", "INVALID_DATA", { sessionId });
    }
    const messages = await listWorkshopMessageFiles(seriesRoot, sessionId);
    const messageIndex = messages.findIndex((item) => item.id === messageId);
    if (messageIndex < 0) {
      throw new StorageError("Workshop message does not exist", "NOT_FOUND", { messageId });
    }
    const message = messages[messageIndex]!;
    if (message.seriesId !== seriesId || message.sessionId !== sessionId) {
      throw new StorageError("Workshop message does not belong to the requested session", "INVALID_DATA", {
        sessionId,
        messageId,
      });
    }
    if (message.role !== "author" || message.mode !== "general-chat") {
      throw new StorageError("Only General Chat author messages can be resent", "INVALID_DATA", {
        messageId,
        role: message.role,
        mode: message.mode,
      });
    }
    if (message.proposalIds.length > 0) {
      throw new StorageError("Proposal-linked Workshop messages cannot be resent", "INVALID_DATA", {
        messageId,
        proposalIds: message.proposalIds,
      });
    }
    const deletedMessages = messages.slice(messageIndex + 1);
    const protectedMessages = deletedMessages.filter((item) =>
      item.proposalIds.length > 0 ||
      item.mode !== "general-chat" ||
      item.role === "tool" ||
      item.role === "result",
    );
    if (protectedMessages.length > 0) {
      throw new StorageError("Workshop history after this message contains protected records", "INVALID_DATA", {
        messageId,
        protectedMessageIds: protectedMessages.map((item) => item.id),
      });
    }
    const deletedMessageIds = deletedMessages.map((item) => item.id);
    const deletedMessageIdSet = new Set(deletedMessageIds);
    const deletedAttachments = (await listWorkshopAttachmentFiles(seriesRoot, sessionId))
      .filter((attachment) =>
        attachment.messageId !== null &&
        deletedMessageIdSet.has(attachment.messageId),
      );
    const branches = (await listWorkshopBranchFiles(seriesRoot)).filter((branch) =>
      deletedMessageIdSet.has(branch.sourceMessageId),
    );
    const now = new Date().toISOString();
    const relatedSessions = (await listWorkshopSessionFiles(seriesRoot))
      .filter((item) =>
        item.branchOfMessageId !== null &&
        deletedMessageIdSet.has(item.branchOfMessageId),
      )
      .map((item) => WorkshopSessionSchema.parse({
        ...item,
        branchOfMessageId: null,
        updatedAt: now,
      }));
    const nextMessage = WorkshopMessageSchema.parse({
      ...message,
      content: nextContent,
    });
    const nextSession = WorkshopSessionSchema.parse({
      ...session,
      lastMessageAt: nextMessage.createdAt,
      updatedAt: now,
    });
    await applyFileTransaction(seriesRoot, [
      { targetPath: workshopMessagePath(seriesRoot, nextMessage.id), content: serializeJsonAuthority(nextMessage) },
      ...deletedMessages.map((item) => ({
        targetPath: workshopMessagePath(seriesRoot, item.id),
        delete: true,
      })),
      ...deletedAttachments.map((attachment) => ({
        targetPath: workshopAttachmentPath(seriesRoot, attachment.id),
        delete: true,
      })),
      ...branches.map((branch) => ({
        targetPath: workshopBranchPath(seriesRoot, branch.id),
        delete: true,
      })),
      ...relatedSessions.map((item) => ({
        targetPath: workshopSessionPath(seriesRoot, item.id),
        content: serializeJsonAuthority(item),
      })),
      { targetPath: workshopSessionPath(seriesRoot, session.id), content: serializeJsonAuthority(nextSession) },
    ]);
    return ReplaceWorkshopMessageResultSchema.parse({
      deletedAttachmentIds: deletedAttachments.map((attachment) => attachment.id),
      deletedBranchIds: branches.map((branch) => branch.id),
      deletedMessageIds,
      message: await readWorkshopMessageFile(seriesRoot, nextMessage.id),
      session: await readWorkshopSessionFile(seriesRoot, session.id),
    });
    });
  }

  async getWorkshopContextBasket(
    seriesId: string,
    sessionId: string,
  ): Promise<WorkshopContextBasket> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const session = await readWorkshopSessionFile(seriesRoot, sessionId);
    try {
      return await readWorkshopContextBasketFile(seriesRoot, session.id);
    } catch (error) {
      if (!(error instanceof StorageError) || error.code !== "NOT_FOUND") throw error;
      const now = new Date().toISOString();
      return writeWorkshopContextBasketFile(seriesRoot, WorkshopContextBasketSchema.parse({
        schemaVersion: 2,
        id: randomUUID(),
        seriesId,
        sessionId,
        sceneId: null,
        blockId: null,
        selection: null,
        items: [],
        createdAt: now,
        updatedAt: now,
      }));
    }
  }

  async updateWorkshopContextBasket(
    seriesId: string,
    sessionId: string,
    rawInput: UpdateWorkshopContextBasketInput,
  ): Promise<WorkshopContextBasket> {
    const input = UpdateWorkshopContextBasketInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return withWorkshopSessionMutationLock(workshopSessionMutationKey(seriesRoot, sessionId), async () => {
      const session = await readWorkshopSessionFile(seriesRoot, sessionId);
      if (session.status === "archived") {
        throw new StorageError("Archived Workshop session cannot update context", "INVALID_DATA", {
          sessionId,
        });
      }
      const current = await this.getWorkshopContextBasket(seriesId, sessionId);
      const candidate = WorkshopContextBasketSchema.parse({
        ...current,
        ...input,
        updatedAt: new Date().toISOString(),
      });
      const materialized = await this.withLinkedWorkshopCodexItems(seriesId, candidate);
      await this.validateWorkshopContextBasket(seriesId, materialized);
      return writeWorkshopContextBasketFile(seriesRoot, materialized);
    });
  }

  async createProposal(
    seriesId: string,
    rawInput: CreateProposalInput,
  ): Promise<ProposalDocument> {
    const input = CreateProposalInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const now = new Date().toISOString();
    const proposal = ProposalSchema.parse({
      schemaVersion: 2,
      id: input.id ?? randomUUID(),
      seriesId,
      type: input.type,
      title: input.title,
      summary: input.summary,
      status: "pending",
      source: input.source,
      target: input.target,
      contextBundleId: input.contextBundleId,
      generator: input.generator,
      riskLevel: input.riskLevel,
      confidence: input.confidence,
      reason: input.reason,
      staleReason: "",
      supersededBy: null,
      originalCandidate: null,
      decision: null,
      patches: input.patches,
      evidence: input.evidence,
      createdAt: now,
      updatedAt: now,
    });
    const sourceAvailability = await this.proposalSourceAvailability(seriesId, proposal);
    if (!sourceAvailability.available) {
      throw new StorageError("Proposal source is not available", "INVALID_DATA", {
        proposalId: proposal.id,
        reason: sourceAvailability.reason,
      });
    }
    const targetAvailability = await this.proposalTargetAvailability(seriesId, seriesRoot, proposal);
    if (!targetAvailability.available) {
      throw new StorageError("Proposal target is not available", "INVALID_DATA", {
        proposalId: proposal.id,
        reason: targetAvailability.reason,
      });
    }
    const file = await createProposalAuthorityFile(seriesRoot, proposal);
    return this.proposalDocument(seriesId, seriesRoot, file.proposal, file.revision);
  }

  async listProposals(seriesId: string): Promise<ProposalInbox> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const list = await listProposalAuthorityFiles(seriesRoot);
    const items = await Promise.all(
      list.files.map((file) =>
        this.proposalDocument(seriesId, seriesRoot, file.proposal, file.revision),
      ),
    );
    return ProposalInboxSchema.parse({ items, diagnostics: list.diagnostics });
  }

  async getProposal(seriesId: string, proposalId: string): Promise<ProposalDocument> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const file = await readProposalAuthorityFile(seriesRoot, proposalId);
    return this.proposalDocument(seriesId, seriesRoot, file.proposal, file.revision);
  }

  async rejectProposal(
    seriesId: string,
    proposalId: string,
    rawInput: ProposalRevisionInput,
  ): Promise<ProposalDocument> {
    const input = ProposalRevisionInputSchema.parse(rawInput);
    return this.decideProposal(seriesId, proposalId, input, "rejected");
  }

  async archiveProposal(
    seriesId: string,
    proposalId: string,
    rawInput: ProposalRevisionInput,
  ): Promise<ProposalDocument> {
    const input = ProposalRevisionInputSchema.parse(rawInput);
    return this.decideProposal(seriesId, proposalId, input, "archived");
  }

  async markProposalStale(
    seriesId: string,
    proposalId: string,
    rawInput: MarkProposalStaleInput,
  ): Promise<ProposalDocument> {
    const input = MarkProposalStaleInputSchema.parse(rawInput);
    return this.decideProposal(seriesId, proposalId, input, "stale", {
      staleReason: input.staleReason,
    });
  }

  async supersedeProposal(
    seriesId: string,
    proposalId: string,
    rawInput: SupersedeProposalInput,
  ): Promise<ProposalDocument> {
    const input = SupersedeProposalInputSchema.parse(rawInput);
    return this.decideProposal(seriesId, proposalId, input, "superseded", {
      supersededBy: input.supersededBy,
    });
  }

  async acceptProposal(
    seriesId: string,
    proposalId: string,
    rawInput: ProposalRevisionInput,
  ): Promise<ProposalApplyResult> {
    const input = ProposalRevisionInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const current = await readProposalAuthorityFile(seriesRoot, proposalId);
    this.assertProposalRevision(current.revision, input.baseRevision, current.proposal);
    assertProposalStatusTransition(current.proposal.status, "accepted");
    const application = await this.prepareSceneContentProposalApplication(seriesId, current.proposal);
    const updated = ProposalSchema.parse({
      ...current.proposal,
      status: "accepted",
      decision: {
        kind: "accepted",
        actor: input.actor,
        decidedAt: new Date().toISOString(),
        note: input.note,
        snapshotId: application.snapshot.id,
        editedCandidate: null,
      },
      updatedAt: new Date().toISOString(),
    });
    const written = await this.writeAppliedSceneProposalTransaction(seriesRoot, application, updated);
    return ProposalApplyResultSchema.parse({
      proposal: await this.proposalDocument(seriesId, seriesRoot, written.proposal, written.revision),
      snapshot: application.snapshot,
    });
  }

  async editAndAcceptProposal(
    seriesId: string,
    proposalId: string,
    rawInput: EditAndAcceptProposalInput,
  ): Promise<ProposalApplyResult> {
    const input = EditAndAcceptProposalInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const current = await readProposalAuthorityFile(seriesRoot, proposalId);
    this.assertProposalRevision(current.revision, input.baseRevision, current.proposal);
    assertProposalStatusTransition(current.proposal.status, "edited");
    const originalCandidate: ProposalCandidateSnapshot = {
      title: current.proposal.title,
      summary: current.proposal.summary,
      reason: current.proposal.reason,
      patches: current.proposal.patches,
    };
    const editedCandidate: ProposalCandidateSnapshot = {
      title: input.title ?? current.proposal.title,
      summary: input.summary ?? current.proposal.summary,
      reason: input.reason ?? current.proposal.reason,
      patches: input.patches,
    };
    const candidate = ProposalSchema.parse({
      ...current.proposal,
      title: editedCandidate.title,
      summary: editedCandidate.summary,
      reason: editedCandidate.reason,
      patches: editedCandidate.patches,
      updatedAt: new Date().toISOString(),
    });
    const application = await this.prepareSceneContentProposalApplication(seriesId, candidate);
    const updated = ProposalSchema.parse({
      ...candidate,
      status: "edited",
      originalCandidate,
      decision: {
        kind: "edited",
        actor: input.actor,
        decidedAt: new Date().toISOString(),
        note: input.note,
        snapshotId: application.snapshot.id,
        editedCandidate,
      },
      updatedAt: new Date().toISOString(),
    });
    const written = await this.writeAppliedSceneProposalTransaction(seriesRoot, application, updated);
    return ProposalApplyResultSchema.parse({
      proposal: await this.proposalDocument(seriesId, seriesRoot, written.proposal, written.revision),
      snapshot: application.snapshot,
    });
  }

  async previewProposalBatch(
    seriesId: string,
    rawInput: ProposalBatchPreviewInput,
  ): Promise<ProposalBatchPreviewResult> {
    const input = ProposalBatchPreviewInputSchema.parse(rawInput);
    const items: ProposalBatchPreviewItem[] = [];
    const sceneTargets = new Set<string>();
    for (const proposalId of input.proposalIds) {
      const item = await this.previewProposal(seriesId, proposalId);
      if (item.eligible) {
        const document = await this.getProposal(seriesId, proposalId);
        const sceneId = document.proposal.patches[0]?.target.targetId;
        if (sceneId && sceneTargets.has(sceneId)) {
          items.push({
            ...item,
            eligible: false,
            reason: "Another Proposal in this batch changes the same scene first",
          });
          continue;
        }
        if (sceneId) sceneTargets.add(sceneId);
      }
      items.push(item);
    }
    return ProposalBatchPreviewResultSchema.parse({ items });
  }

  async acceptProposalBatch(
    seriesId: string,
    rawInput: ProposalBatchAcceptInput,
  ): Promise<ProposalBatchAcceptResult> {
    const input = ProposalBatchAcceptInputSchema.parse(rawInput);
    const proposalIds = input.items.map((item) => item.proposalId);
    const preview = await this.previewProposalBatch(seriesId, { proposalIds });
    const revisionsByProposal = new Map(
      input.items.map((item) => [item.proposalId, item.baseRevision]),
    );
    const completed: ProposalApplyResult[] = [];
    const skipped: ProposalBatchPreviewItem[] = [];
    const blocked: ProposalBatchPreviewItem[] = preview.items.filter((item) => !item.eligible);
    const failed: ProposalBatchPreviewItem[] = [];

    for (const item of preview.items.filter((candidate) => candidate.eligible)) {
      try {
        const reviewedRevision = revisionsByProposal.get(item.proposalId);
        if (!reviewedRevision || item.revision !== reviewedRevision) {
          skipped.push({
            proposalId: item.proposalId,
            revision: item.revision,
            eligible: false,
            reason: "Proposal changed since batch preview",
          });
          continue;
        }
        completed.push(
          await this.acceptProposal(seriesId, item.proposalId, {
            baseRevision: reviewedRevision,
            actor: input.actor,
            note: input.note,
          }),
        );
      } catch (error) {
        failed.push({
          proposalId: item.proposalId,
          revision: item.revision,
          eligible: false,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return ProposalBatchAcceptResultSchema.parse({ completed, skipped, blocked, failed });
  }

  async rebuildAiIndex(seriesId: string): Promise<{
    indexedContextBundles: number;
    indexedModelCalls: number;
  }> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    try {
      return await runIndexWriteLane(seriesRoot, async () => {
        const database = this.openIndex(seriesRoot);
        try {
          return await rebuildAiIndex(seriesRoot, database);
        } finally {
          database.close();
        }
      });
    } catch (error) {
      const rebuilt = await this.rebuildIndexIfUnhealthy(seriesRoot, error);
      return {
        indexedContextBundles: rebuilt.indexedContextBundles,
        indexedModelCalls: rebuilt.indexedModelCalls,
      };
    }
  }

  async searchCodex(seriesId: string, query: string): Promise<CodexSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return this.withIndexRead(seriesRoot, (database) => {
      if (Array.from(trimmed).length < 3) {
        const pattern = literalLikePattern(trimmed);
        return database
          .prepare(
            `SELECT id AS entryId, name, category_id AS categoryId,
                    substr(description, 1, 180) AS excerpt
             FROM codex_entries
             WHERE name LIKE ? ESCAPE '\\'
                OR aliases LIKE ? ESCAPE '\\'
                OR description LIKE ? ESCAPE '\\'
                OR research LIKE ? ESCAPE '\\'
             ORDER BY updated_at DESC LIMIT 30`,
          )
          .all(pattern, pattern, pattern, pattern)
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
    });
  }

  async rebuildIndex(seriesId: string): Promise<{
    indexedScenes: number;
    indexedCodexEntries: number;
    indexedMentions: number;
    ambiguousMentions: number;
    indexedContextBundles: number;
    indexedModelCalls: number;
  }>;
  async rebuildIndex(seriesId: string, options: IndexRebuildOptions): Promise<{
    indexedScenes: number;
    indexedCodexEntries: number;
    indexedMentions: number;
    ambiguousMentions: number;
    indexedContextBundles: number;
    indexedModelCalls: number;
  }>;
  async rebuildIndex(seriesId: string, options: IndexRebuildOptions = {}): Promise<{
    indexedScenes: number;
    indexedCodexEntries: number;
    indexedMentions: number;
    ambiguousMentions: number;
    indexedContextBundles: number;
    indexedModelCalls: number;
  }> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return rebuildIndexDatabase(seriesRoot, seriesId, async ({ databasePath, throwIfCancelled }) => {
      const sceneFiles = await walkSceneFiles(path.join(seriesRoot, "books"));
      const sceneDatabase = this.openIndex(seriesRoot, databasePath);
      try {
        for (const filePath of sceneFiles) {
          throwIfCancelled();
          const scene = parseSceneText(await readFile(filePath, "utf8"), path.relative(seriesRoot, filePath));
          this.writeSceneProjection(sceneDatabase, scene);
        }
      } finally {
        sceneDatabase.close();
      }
      const codex = await this.rebuildCodexIndexProjection(seriesRoot, databasePath);
      throwIfCancelled();
      const database = this.openIndex(seriesRoot, databasePath);
      let ai: { indexedContextBundles: number; indexedModelCalls: number };
      try {
        ai = await rebuildAiIndex(seriesRoot, database);
      } finally {
        database.close();
      }
      return { indexedScenes: sceneFiles.length, ...codex, ...ai };
    }, options);
  }

  async search(seriesId: string, query: string): Promise<SearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return this.withIndexRead(seriesRoot, (database) => {
      if (Array.from(trimmed).length < 3) {
        const pattern = literalLikePattern(trimmed);
        return database
          .prepare(
            `SELECT id AS sceneId, title, substr(content, 1, 180) AS excerpt,
                    relative_path AS relativePath
             FROM scenes
             WHERE title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\'
             ORDER BY updated_at DESC LIMIT 30`,
          )
          .all(pattern, pattern) as SearchResult[];
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
    });
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
      { targetPath: timelineEventPath(seriesRoot, event.id), content: serializeJsonAuthority(event) },
      { targetPath: timelineManifestPath(seriesRoot), content: serializeJsonAuthority(updatedManifest) },
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
    await atomicWrite(timelineEventPath(seriesRoot, event.id), serializeJsonAuthority(event));
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
      { targetPath: timelineManifestPath(seriesRoot), content: serializeJsonAuthority(updatedManifest) },
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
      { targetPath: timelineManifestPath(seriesRoot), content: serializeJsonAuthority(updatedManifest) },
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
    await atomicWrite(path.join(context.bookRoot, BOOK_FILE), serializeJsonAuthority(updated));
    return updated;
  }

  async getChapter(seriesId: string, chapterId: string): Promise<ChapterManifest> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return (await this.findChapterContext(seriesRoot, chapterId)).chapter;
  }

  async listActs(seriesId: string, bookId: string): Promise<ActManifest[]> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const bookRoot = assertInside(seriesRoot, path.join(seriesRoot, "books", bookId));
    const book = await readJson(path.join(bookRoot, BOOK_FILE), (value) =>
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
    const book = await readJson(path.join(bookRoot, BOOK_FILE), (value) =>
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
      { targetPath: actPath(bookRoot, act.id), content: serializeJsonAuthority(act) },
      { targetPath: path.join(bookRoot, BOOK_FILE), content: serializeJsonAuthority(updatedBook) },
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
      { targetPath: chapterPath(bookRoot, chapter.id), content: serializeJsonAuthority(chapter) },
      { targetPath: actPath(bookRoot, act.id), content: serializeJsonAuthority(updatedAct) },
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
      { targetPath: chapterPath(context.bookRoot, context.chapter.id), content: serializeJsonAuthority(updatedChapter) },
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
        content: serializeJsonAuthority(chapter),
      })),
      { targetPath: actPath(context.bookRoot, context.act.id), content: serializeJsonAuthority(updatedAct) },
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
      ...acts.map((act) => ({ targetPath: actPath(context.bookRoot, act.id), content: serializeJsonAuthority(act) })),
      { targetPath: path.join(context.bookRoot, BOOK_FILE), content: serializeJsonAuthority(updatedBook) },
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
      { targetPath: chapterPath(source.bookRoot, source.chapter.id), content: serializeJsonAuthority(updatedSourceChapter) },
      { targetPath: chapterPath(target.bookRoot, target.chapter.id), content: serializeJsonAuthority(updatedTargetChapter) },
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
    const book = await readJson(path.join(bookRoot, BOOK_FILE), (value) =>
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
      ...acts.map((act) => ({ targetPath: actPath(bookRoot, act.id), content: serializeJsonAuthority(act) })),
      { targetPath: path.join(bookRoot, BOOK_FILE), content: serializeJsonAuthority(updatedBook) },
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
        content: serializeJsonAuthority(chapter),
      })),
      { targetPath: actPath(bookRoot, act.id), content: serializeJsonAuthority(updatedAct) },
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
      { targetPath: chapterPath(bookRoot, chapter.id), content: serializeJsonAuthority(updatedChapter) },
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
      mutations.push({ targetPath: path.join(bookRoot, BOOK_FILE), content: serializeJsonAuthority(updatedBook) });

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
        mutations.push({ targetPath: actPath(bookRoot, actId), content: serializeJsonAuthority(act) });

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
          mutations.push({ targetPath: chapterPath(bookRoot, chapterId), content: serializeJsonAuthority(chapter) });
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
    const manifest = await readJson(path.join(root, SERIES_FILE), (value) =>
      SeriesManifestSchema.parse(value),
    );
    const books = await Promise.all(
      manifest.bookIds.map((bookId) =>
        readJson(path.join(root, "books", bookId, BOOK_FILE), (value) =>
          BookManifestSchema.parse(value),
        ),
      ),
    );
    return { root, manifest, books };
  }

  private async readBookManifests(seriesRoot: string): Promise<BookManifest[]> {
    const manifest = await readJson(path.join(seriesRoot, SERIES_FILE), (value) =>
      SeriesManifestSchema.parse(value),
    );
    return Promise.all(
      manifest.bookIds.map((bookId) =>
        readJson(path.join(seriesRoot, "books", bookId, BOOK_FILE), (value) =>
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
    const manifest = await readJson(path.join(seriesRoot, SERIES_FILE), (value) =>
      SeriesManifestSchema.parse(value),
    );
    if (!manifest.bookIds.includes(bookId)) {
      throw new StorageError("Book does not exist or is not referenced by a series", "NOT_FOUND", { bookId });
    }
    const bookRoot = path.join(seriesRoot, "books", bookId);
    const book = await readJson(path.join(bookRoot, BOOK_FILE), (value) => BookManifestSchema.parse(value));
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
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => path.basename(entry.name, ".json"));
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
      manifest = await readJson(timelineManifestPath(seriesRoot), (value) =>
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
    const event = parseJsonAuthorityText(
      raw,
      (value) => TimelineEventSchema.parse(value),
      "Timeline event JSON authority file",
    );
    if (event.id !== eventId) {
      throw new StorageError("Story event file name and ID differ", "INVALID_DATA", { eventId, actualId: event.id });
    }
    return TimelineEventDocumentSchema.parse({
      event,
      revision: jsonAuthorityRevision(raw),
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

  private async validateWorkshopContextBasket(
    seriesId: string,
    basket: WorkshopContextBasket,
  ): Promise<void> {
    if (basket.seriesId !== seriesId) {
      throw new StorageError("Workshop context basket belongs to another series", "INVALID_DATA", {
        basketId: basket.id,
      });
    }
    await this.getWorkshopSession(seriesId, basket.sessionId);
    if (basket.sceneId) {
      await this.getScene(seriesId, basket.sceneId);
    }
    for (const item of basket.items) {
      await this.validateWorkshopContextItem(seriesId, item);
    }
  }

  private async withLinkedWorkshopCodexItems(
    seriesId: string,
    basket: WorkshopContextBasket,
  ): Promise<WorkshopContextBasket> {
    const series = await this.getSeries(seriesId);
    const entries = (await this.listCodexEntries(seriesId, { includeArchived: true }))
      .filter((entry) => entry.metadata.archivedAt === null);
    const scopeTexts = this.workshopSelectedScopeTexts(series, basket.items);
    const linkedIds = new Set<string>();
    if (scopeTexts.length > 0) {
      const combined = scopeTexts.join("\n\n");
      const mentionedIds = new Set(
        findCodexMentionsInContent(
          basket.sceneId ?? WORKSHOP_UNBOUND_CONTEXT_SCENE_ID,
          combined,
          entries,
        ).mentions.map((mention) => mention.entryId),
      );
      for (const entry of entries) {
        if (entry.metadata.aiContextPolicy === "always") {
          linkedIds.add(entry.metadata.id);
        }
        if (entry.metadata.aiContextPolicy === "on-mention" && mentionedIds.has(entry.metadata.id)) {
          linkedIds.add(entry.metadata.id);
        }
      }
    }
    const sourceItems = basket.items.filter((item) =>
      !(item.kind === "codex-entry" && item.note === WORKSHOP_LINKED_CODEX_NOTE && !linkedIds.has(item.sourceId ?? "")),
    );
    const existingCodexIds = new Set(sourceItems
      .filter((item) => item.kind === "codex-entry" && item.sourceId)
      .map((item) => item.sourceId!));
    const linkedItems = entries
      .filter((entry) => linkedIds.has(entry.metadata.id) && !existingCodexIds.has(entry.metadata.id))
      .map((entry) => WorkshopContextItemRefSchema.parse({
        id: randomUUID(),
        kind: "codex-entry",
        sourceId: entry.metadata.id,
        label: entry.metadata.name,
        pinned: true,
        note: WORKSHOP_LINKED_CODEX_NOTE,
        createdAt: new Date().toISOString(),
      }));
    return WorkshopContextBasketSchema.parse({
      ...basket,
      items: [...sourceItems, ...linkedItems],
    });
  }

  private workshopSelectedScopeTexts(
    series: SeriesDetail,
    items: WorkshopContextItemRef[],
  ): string[] {
    const texts: string[] = [];
    const selectedSceneIds = new Set<string>();
    for (const item of items) {
      if (item.kind === "full-novel") {
        texts.push(this.workshopScenesInSeriesOrder(series).map((scene) => this.workshopSceneScopeText(scene)).join("\n\n"));
      }
      if (item.kind === "full-outline") {
        texts.push(this.workshopScenesInSeriesOrder(series).map((scene) => this.workshopSceneOutlineText(scene)).join("\n\n"));
      }
      if (item.kind === "volume" && item.sourceId) {
        texts.push(this.workshopScenesForVolume(series, item.sourceId).map((scene) => this.workshopSceneScopeText(scene)).join("\n\n"));
      }
      if (item.kind === "chapter" && item.sourceId) {
        texts.push(this.workshopScenesForStoredAct(series, item.sourceId).map((scene) => this.workshopSceneScopeText(scene)).join("\n\n"));
      }
      if (item.kind === "act" && item.sourceId) {
        texts.push(this.workshopScenesForStoredChapter(series, item.sourceId).map((scene) => this.workshopSceneScopeText(scene)).join("\n\n"));
      }
      if (item.kind === "scene" && item.sourceId) {
        selectedSceneIds.add(item.sourceId);
      }
    }
    for (const sceneId of selectedSceneIds) {
      const scene = series.scenes.find((candidate) => candidate.metadata.id === sceneId);
      if (scene) texts.push(this.workshopSceneScopeText(scene));
    }
    return texts.filter((text) => text.trim().length > 0);
  }

  private workshopSceneScopeText(scene: SceneDocument): string {
    return [
      this.workshopSceneOutlineText(scene),
      scene.plainText || scene.content,
    ].filter(Boolean).join("\n\n");
  }

  private workshopSceneOutlineText(scene: SceneDocument): string {
    return [
      scene.metadata.title,
      scene.metadata.summary,
      scene.metadata.goal,
      scene.metadata.conflict,
      scene.metadata.outcome,
      scene.metadata.beats.join("\n"),
    ].filter(Boolean).join("\n");
  }

  private workshopScenesInSeriesOrder(series: SeriesDetail): SceneDocument[] {
    const ordered: SceneDocument[] = [];
    const seen = new Set<string>();
    for (const book of [...series.books].sort((left, right) => left.order - right.order)) {
      for (const act of [...series.acts].filter((item) => item.bookId === book.id).sort((left, right) => left.order - right.order)) {
        for (const scene of this.workshopScenesForStoredAct(series, act.id)) {
          ordered.push(scene);
          seen.add(scene.metadata.id);
        }
      }
    }
    ordered.push(...series.scenes
      .filter((scene) => !seen.has(scene.metadata.id))
      .sort((left, right) => left.metadata.order - right.metadata.order));
    return ordered;
  }

  private workshopScenesForVolume(series: SeriesDetail, volumeId: string): SceneDocument[] {
    return [...series.acts]
      .filter((storedAct) => storedAct.bookId === volumeId)
      .sort((left, right) => left.order - right.order)
      .flatMap((storedAct) => this.workshopScenesForStoredAct(series, storedAct.id));
  }

  private workshopScenesForStoredAct(series: SeriesDetail, storedActId: string): SceneDocument[] {
    return [...series.chapters]
      .filter((storedChapter) => storedChapter.actId === storedActId)
      .sort((left, right) => left.order - right.order)
      .flatMap((storedChapter) => this.workshopScenesForStoredChapter(series, storedChapter.id));
  }

  private workshopScenesForStoredChapter(series: SeriesDetail, storedChapterId: string): SceneDocument[] {
    return [...series.scenes]
      .filter((scene) => scene.metadata.chapterId === storedChapterId)
      .sort((left, right) => left.metadata.order - right.metadata.order);
  }

  private async validateWorkshopContextItem(
    seriesId: string,
    item: WorkshopContextItemRef,
  ): Promise<void> {
    const parsed = WorkshopContextItemRefSchema.parse(item);
    if (parsed.kind === "scene") {
      await this.getScene(seriesId, parsed.sourceId);
      return;
    }
    if (parsed.kind === "full-novel" || parsed.kind === "full-outline") {
      if (parsed.sourceId !== seriesId) {
        throw new StorageError("Workshop context project scope belongs to another series", "INVALID_DATA", {
          itemId: parsed.id,
          sourceId: parsed.sourceId,
        });
      }
      await this.getSeries(seriesId);
      return;
    }
    if (parsed.kind === "volume") {
      const series = await this.getSeries(seriesId);
      if (!series.books.some((book) => book.id === parsed.sourceId)) {
        throw new StorageError("Workshop Volume context item does not exist", "NOT_FOUND", {
          itemId: parsed.id,
          volumeId: parsed.sourceId,
        });
      }
      return;
    }
    if (parsed.kind === "chapter") {
      await this.getAct(seriesId, parsed.sourceId);
      return;
    }
    if (parsed.kind === "act") {
      await this.getChapter(seriesId, parsed.sourceId);
      return;
    }
    if (parsed.kind === "codex-entry") {
      await this.getCodexEntry(seriesId, parsed.sourceId);
      return;
    }
  }

  private async proposalDocument(
    seriesId: string,
    seriesRoot: string,
    proposal: Proposal,
    revision: string,
  ): Promise<ProposalDocument> {
    return ProposalDocumentSchema.parse({
      proposal,
      revision,
      sourceAvailability: await this.proposalSourceAvailability(seriesId, proposal),
      targetAvailability: await this.proposalTargetAvailability(seriesId, seriesRoot, proposal),
    });
  }

  private assertProposalRevision(
    currentRevision: string,
    expectedRevision: string,
    proposal: Proposal,
  ): void {
    if (currentRevision !== expectedRevision) {
      throw new StorageError("Proposal has changed on disk", "CONFLICT", {
        proposalId: proposal.id,
        currentRevision,
      });
    }
  }

  private async decideProposal(
    seriesId: string,
    proposalId: string,
    input: ProposalRevisionInput,
    status: "rejected" | "stale" | "superseded" | "archived",
    extras: Partial<Pick<Proposal, "staleReason" | "supersededBy">> = {},
  ): Promise<ProposalDocument> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const current = await readProposalAuthorityFile(seriesRoot, proposalId);
    this.assertProposalRevision(current.revision, input.baseRevision, current.proposal);
    assertProposalStatusTransition(current.proposal.status, status);
    const updated = ProposalSchema.parse({
      ...current.proposal,
      status,
      staleReason: extras.staleReason ?? current.proposal.staleReason,
      supersededBy: extras.supersededBy ?? current.proposal.supersededBy,
      decision: {
        kind: status,
        actor: input.actor,
        decidedAt: new Date().toISOString(),
        note: input.note,
        snapshotId: null,
        editedCandidate: null,
      },
      updatedAt: new Date().toISOString(),
    });
    const written = await writeProposalAuthorityFile(seriesRoot, updated);
    return this.proposalDocument(seriesId, seriesRoot, written.proposal, written.revision);
  }

  private async proposalSourceAvailability(
    seriesId: string,
    proposal: Proposal,
  ): Promise<{ available: boolean; reason: string }> {
    try {
      const source = proposal.source;
      if (source.kind !== "manual" && source.kind !== "import" && source.kind !== "tool-plan") {
        if (!source.sourceId) return { available: false, reason: "Source id is missing" };
        if (source.kind === "model-call") {
          await this.getModelCallLog(seriesId, source.sourceId);
        } else if (source.kind === "write-selection") {
          await this.getScene(seriesId, source.sourceId);
        } else if (source.kind === "codex-entry") {
          await this.getCodexEntry(seriesId, source.sourceId);
        } else if (source.kind === "workshop-message") {
          const { session } = await this.getWorkshopMessageSource(seriesId, source.sourceId);
          if (session.status === "archived") {
            return { available: false, reason: "Source Workshop session is archived" };
          }
        }
      }
      if (proposal.contextBundleId) {
        await this.getContextBundle(seriesId, proposal.contextBundleId);
      }
      if (proposal.generator.kind === "ai") {
        const log = await this.getModelCallLog(seriesId, proposal.generator.modelCallLogId);
        if (proposal.contextBundleId && log.contextBundleId !== proposal.contextBundleId) {
          return {
            available: false,
            reason: "AI model call does not match the Proposal context bundle",
          };
        }
      }
      return { available: true, reason: "" };
    } catch (error) {
      if (error instanceof StorageError && error.code === "NOT_FOUND") {
        return { available: false, reason: error.message };
      }
      throw error;
    }
  }

  private async proposalTargetAvailability(
    seriesId: string,
    seriesRoot: string,
    proposal: Proposal,
  ): Promise<{ available: boolean; reason: string }> {
    try {
      const target = proposal.target;
      if (target.kind === "scene-content" || target.kind === "scene-metadata") {
        await this.getScene(seriesId, target.targetId);
      } else if (target.kind === "codex-entry" || target.kind === "codex-research") {
        await this.getCodexEntry(seriesId, target.targetId);
      } else if (target.kind === "codex-relation") {
        await this.readCodexRelation(seriesRoot, target.targetId);
      } else if (target.kind === "codex-progression") {
        await this.getCodexProgression(seriesId, target.targetId);
      } else if (target.kind === "codex-knowledge") {
        await this.getCodexKnowledge(seriesId, target.targetId);
      } else if (target.kind === "detail-type") {
        await this.readCodexDetailType(seriesRoot, target.targetId);
      }
      return { available: true, reason: "" };
    } catch (error) {
      if (error instanceof StorageError && error.code === "NOT_FOUND") {
        return { available: false, reason: error.message };
      }
      throw error;
    }
  }

  private proposalPatchSupportIssue(proposal: Proposal): string {
    for (const patch of proposal.patches) {
      if (patch.target.kind !== "scene-content") {
        return "Only scene content patches can be applied in this milestone";
      }
      if (!["replace-content", "replace-text", "insert-text"].includes(patch.action)) {
        return "Only scene text replacement and insertion patches can be applied in this milestone";
      }
      if (!patch.target.baseRevision) {
        return "Applicable scene content patches require a base revision";
      }
      if (patch.after === null) {
        return "Applicable Proposal patches require after text";
      }
    }
    const sceneIds = new Set(proposal.patches.map((patch) => patch.target.targetId));
    if (sceneIds.size !== 1) {
      return "Batching patches across multiple scenes is not supported in this milestone";
    }
    return "";
  }

  private async prepareSceneContentProposalApplication(
    seriesId: string,
    proposal: Proposal,
  ): Promise<PreparedSceneProposalApplication> {
    const supportIssue = this.proposalPatchSupportIssue(proposal);
    if (supportIssue) {
      throw new StorageError(supportIssue, "INVALID_DATA", { proposalId: proposal.id });
    }
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const sceneId = proposal.patches[0]!.target.targetId;
    const scenePath = await this.findScenePath(seriesRoot, sceneId);
    const scene = parseSceneText(await readFile(scenePath, "utf8"), path.relative(seriesRoot, scenePath));
    for (const patch of proposal.patches) {
      if (patch.target.baseRevision !== scene.revision) {
        throw new StorageError("Proposal target has changed since it was generated", "CONFLICT", {
          proposalId: proposal.id,
          sceneId,
          expectedRevision: patch.target.baseRevision,
          currentRevision: scene.revision,
        });
      }
    }
    let content = scene.content;
    for (const patch of proposal.patches) {
      content = this.applySceneTextPatch(content, patch);
    }
    const snapshot = ProposalSnapshotSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      seriesId,
      proposalId: proposal.id,
      target: proposal.target,
      createdAt: new Date().toISOString(),
      targetRevision: scene.revision,
      data: { scene },
    });
    const metadata = SceneFrontmatterSchema.parse({
      ...scene.metadata,
      updatedAt: new Date().toISOString(),
    });
    return {
      proposal,
      scene,
      sceneId,
      scenePath,
      sceneContent: serializeScene(metadata, content),
      snapshot,
    };
  }

  private async writeAppliedSceneProposalTransaction(
    seriesRoot: string,
    application: PreparedSceneProposalApplication,
    updatedProposal: Proposal,
  ): Promise<{ proposal: Proposal; revision: string }> {
    const parsedProposal = ProposalSchema.parse(updatedProposal);
    const parsedSnapshot = ProposalSnapshotSchema.parse(application.snapshot);
    const proposalPath = proposalAuthorityPath(seriesRoot, parsedProposal.id);
    const snapshotPath = proposalSnapshotPath(seriesRoot, parsedSnapshot.id);
    if (await pathExists(snapshotPath)) {
      throw new StorageError("Proposal snapshot already exists", "INVALID_DATA", {
        snapshotId: parsedSnapshot.id,
      });
    }
    const proposalRaw = serializeJsonAuthority(parsedProposal);
    await applyFileTransaction(seriesRoot, [
      { targetPath: snapshotPath, content: serializeJsonAuthority(parsedSnapshot) },
      { targetPath: application.scenePath, content: application.sceneContent },
      { targetPath: proposalPath, content: proposalRaw },
    ]);
    const written = await readProposalAuthorityFile(seriesRoot, parsedProposal.id);
    const updatedScene = parseSceneText(
      await readFile(application.scenePath, "utf8"),
      path.relative(seriesRoot, application.scenePath),
    );
    await this.indexScene(seriesRoot, updatedScene);
    return { proposal: written.proposal, revision: written.revision };
  }

  private applySceneTextPatch(content: string, patch: ProposalPatch): string {
    const after = patch.after ?? "";
    if (patch.action === "replace-content") {
      if (patch.before !== null && content !== patch.before) {
        throw new StorageError("Proposal before text does not match current scene content", "CONFLICT", {
          patchId: patch.id,
        });
      }
      return after;
    }

    if (patch.target.range) {
      const range = patch.target.range;
      const current = content.slice(range.start, range.end);
      const expected = patch.before ?? range.text;
      if (current !== expected) {
        throw new StorageError("Proposal range no longer matches current scene content", "CONFLICT", {
          patchId: patch.id,
        });
      }
      if (patch.action === "insert-text") {
        return `${content.slice(0, range.start)}${after}${content.slice(range.start)}`;
      }
      return `${content.slice(0, range.start)}${after}${content.slice(range.end)}`;
    }

    if (patch.action === "insert-text") {
      return `${content}${after}`;
    }

    if (patch.before === null || patch.before === "") {
      throw new StorageError("Text replacement patches require before text or a range", "INVALID_DATA", {
        patchId: patch.id,
      });
    }
    const first = content.indexOf(patch.before);
    if (first < 0) {
      throw new StorageError("Proposal before text is not present in current scene content", "CONFLICT", {
        patchId: patch.id,
      });
    }
    const second = content.indexOf(patch.before, first + patch.before.length);
    if (second >= 0) {
      throw new StorageError("Proposal before text is ambiguous in current scene content", "INVALID_DATA", {
        patchId: patch.id,
      });
    }
    return `${content.slice(0, first)}${after}${content.slice(first + patch.before.length)}`;
  }

  private async previewProposal(
    seriesId: string,
    proposalId: string,
  ): Promise<ProposalBatchPreviewItem> {
    try {
      const document = await this.getProposal(seriesId, proposalId);
      if (document.proposal.status !== "pending") {
        return {
          proposalId,
          revision: document.revision,
          eligible: false,
          reason: `Proposal is ${document.proposal.status}`,
        };
      }
      if (!document.sourceAvailability.available) {
        return {
          proposalId,
          revision: document.revision,
          eligible: false,
          reason: document.sourceAvailability.reason,
        };
      }
      if (!document.targetAvailability.available) {
        return {
          proposalId,
          revision: document.revision,
          eligible: false,
          reason: document.targetAvailability.reason,
        };
      }
      const supportIssue = this.proposalPatchSupportIssue(document.proposal);
      if (supportIssue) {
        return {
          proposalId,
          revision: document.revision,
          eligible: false,
          reason: supportIssue,
        };
      }
      const sceneId = document.proposal.patches[0]!.target.targetId;
      const scene = await this.getScene(seriesId, sceneId);
      for (const patch of document.proposal.patches) {
        if (patch.target.baseRevision !== scene.revision) {
          return {
            proposalId,
            revision: document.revision,
            eligible: false,
            reason: "Target changed since Proposal creation",
          };
        }
      }
      return { proposalId, revision: document.revision, eligible: true, reason: "" };
    } catch (error) {
      if (error instanceof StorageError && error.code === "NOT_FOUND") {
        return { proposalId, revision: null, eligible: false, reason: error.message };
      }
      throw error;
    }
  }

  private async findSeriesRoot(seriesId: string): Promise<string> {
    await this.initialize();
    const entries = await readdir(this.libraryRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const root = assertInside(this.libraryRoot, path.join(this.libraryRoot, entry.name));
      try {
        await this.recoverSeriesRootOnce(root);
        const manifest = await readJson(path.join(root, SERIES_FILE), (value) =>
          SeriesManifestSchema.parse(value),
        );
        if (manifest.id === seriesId) {
          this.seriesIdsByRoot.set(path.resolve(root), seriesId);
          return root;
        }
      } catch (error) {
        if (error instanceof StorageError && error.code === "NOT_FOUND") continue;
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
        path.join(sectionsRoot, sceneDirectory.name, `${sectionId}.json`),
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
    const category = parseJsonAuthorityText(
      raw,
      (value) => CodexCustomCategorySchema.parse(value),
      "Codex category JSON authority file",
    );
    if (category.id !== categoryId) {
      throw new StorageError("Codex 类别文件名与 ID 不一致", "INVALID_DATA", {
        categoryId,
        actualId: category.id,
      });
    }
    return { category, revision: jsonAuthorityRevision(raw) };
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
    const authority = parseJsonAuthorityText(
      raw,
      (value) => CodexDetailTypeAuthoritySchema.parse(value),
      "Codex detail type JSON authority file",
    );
    const detailType = authority.schemaVersion === 1
      ? migrateCodexDetailTypeV1ToV2(authority)
      : authority;
    if (detailType.id !== detailTypeId) {
      throw new StorageError("Codex detail type file name and ID differ", "INVALID_DATA", {
        detailTypeId,
        actualId: detailType.id,
      });
    }
    return CodexDetailTypeDocumentSchema.parse({
      detailType,
      revision: jsonAuthorityRevision(raw),
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
    const raw = serializeJsonAuthority(category);
    await atomicWrite(codexCategoryPath(seriesRoot, categoryId), raw);
    return CodexCategoryDocumentSchema.parse({
      category: {
        id: category.id,
        name: category.name,
        icon: category.icon,
        builtIn: false,
        archivedAt: category.archivedAt,
      },
      revision: jsonAuthorityRevision(raw),
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
        if (!file.isFile() || !file.name.endsWith(".json")) continue;
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
        if (!file.isFile() || !file.name.endsWith(".json")) continue;
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
    const authority = parseJsonAuthorityText(
      raw,
      (value) => CodexEntryAuthoritySchema.parse(value),
      "Codex entry JSON authority file",
    );
    const metadata = authority.metadata;
    if (
      metadata.id !== path.basename(filePath, ".json") ||
      metadata.categoryId !== expectedCategoryId
    ) {
      throw new StorageError("Codex 条目文件名、类别目录或 JSON metadata 不一致", "INVALID_DATA", {
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
      if (path.basename(location.filePath, ".json") !== entryId) continue;
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
    return runSeriesFileTransaction(seriesRoot, async (commit) => {
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
    await commit([{
      targetPath: current.filePath,
      content: serializeCodexEntry(metadata, current.document.description),
    }]);
    await this.rebuildCodexIndex(seriesRoot);
    return (await this.findCodexEntry(seriesRoot, entryId)).document;
    });
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
        document.progression.entryId === entryId ||
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
      throw new StorageError("Codex entry is referenced by story state and cannot be deleted directly", "INVALID_DATA", {
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
    const authority = parseJsonAuthorityText(
      raw,
      (value) => CodexRelationAuthoritySchema.parse(value),
      "Codex relation JSON authority file",
    );
    const relation = authority.schemaVersion === 1
      ? migrateCodexRelationV1ToV2(authority)
      : authority;
    if (relation.id !== relationId) {
      throw new StorageError("Codex 关系文件名与 ID 不一致", "INVALID_DATA", {
        relationId,
        actualId: relation.id,
      });
    }
    return CodexRelationDocumentSchema.parse({
      relation,
      revision: jsonAuthorityRevision(raw),
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
    return runSeriesFileTransaction(seriesRoot, async (commit) => {
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
    const raw = serializeJsonAuthority(relation);
    await commit([{ targetPath: codexRelationPath(seriesRoot, relation.id), content: raw }]);
    return CodexRelationDocumentSchema.parse({
      relation,
      revision: jsonAuthorityRevision(raw),
    });
    });
  }

  private async readCodexProgression(
    seriesRoot: string,
    progressionId: string,
  ): Promise<CodexProgressionDocument> {
    let document;
    try {
      document = await readJsonAuthorityFile(
        seriesRoot,
        codexProgressionPath(seriesRoot, progressionId),
        (value) => CodexProgressionSchema.parse(value),
        "Codex progression",
      );
    } catch (error) {
      if (error instanceof StorageError && error.code === "NOT_FOUND") {
        throw new StorageError("Progression does not exist", "NOT_FOUND", { progressionId });
      }
      throw error;
    }
    if (document.data.id !== progressionId) {
      throw new StorageError("Progression file name does not match ID", "INVALID_DATA", {
        progressionId,
        actualId: document.data.id,
      });
    }
    return CodexProgressionDocumentSchema.parse({
      progression: document.data,
      revision: document.revision,
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
      if (!file.isFile() || !file.name.endsWith(".json")) continue;
      const document = await this.readCodexProgression(
        seriesRoot,
        path.basename(file.name, ".json"),
      );
      if (seen.has(document.progression.id)) {
        throw new StorageError("Multiple progression files use the same ID", "INVALID_DATA", {
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
    let document;
    try {
      document = await readJsonAuthorityFile(
        seriesRoot,
        codexKnowledgePath(seriesRoot, knowledgeId),
        (value) => CodexKnowledgeSchema.parse(value),
        "Codex knowledge JSON authority file",
      );
    } catch (error) {
      if (error instanceof StorageError && error.code === "NOT_FOUND") {
        throw new StorageError("角色所知不存在", "NOT_FOUND", { knowledgeId });
      }
      throw error;
    }
    if (document.data.id !== knowledgeId) {
      throw new StorageError("角色所知文件名与 ID 不一致", "INVALID_DATA", {
        knowledgeId,
        actualId: document.data.id,
      });
    }
    return CodexKnowledgeDocumentSchema.parse({
      knowledge: document.data,
      revision: document.revision,
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
      if (!file.isFile() || !file.name.endsWith(".json")) continue;
      const document = await this.readCodexKnowledge(
        seriesRoot,
        path.basename(file.name, ".json"),
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

  private targetBlockPosition(
    sceneIndexes: Map<string, number>,
    scene: SceneDocument,
    blockId: string | null,
  ): NarrativeBlockPosition {
    const sceneIndex = narrativeIndexForScene(sceneIndexes, scene.metadata.id);
    if (!blockId) {
      return { sceneIndex, blockIndex: SCENE_END_BLOCK_INDEX };
    }
    const blockIndex = scene.document.blocks.findIndex((block) => block.id === blockId);
    if (blockIndex < 0) {
      throw new StorageError("Effective entry query references an unknown scene block", "INVALID_DATA", {
        sceneId: scene.metadata.id,
        blockId,
      });
    }
    return { sceneIndex, blockIndex };
  }

  private progressionBlockPosition(
    sceneIndexes: Map<string, number>,
    scenesById: Map<string, SceneDocument>,
    progression: CodexProgression,
  ): NarrativeBlockPosition {
    const sceneIndex = narrativeIndexForScene(sceneIndexes, progression.effectiveFromSceneId);
    if (progression.source.kind !== "write-block") {
      return { sceneIndex, blockIndex: SCENE_START_BLOCK_INDEX };
    }
    if (progression.source.sceneId !== progression.effectiveFromSceneId) {
      throw new StorageError("Write-block progression source must match its effective scene", "INVALID_DATA", {
        progressionId: progression.id,
        sourceSceneId: progression.source.sceneId,
        effectiveFromSceneId: progression.effectiveFromSceneId,
      });
    }
    const scene = scenesById.get(progression.source.sceneId);
    if (!scene) {
      throw new StorageError("Write-block progression source references an unknown scene", "INVALID_DATA", {
        progressionId: progression.id,
        sceneId: progression.source.sceneId,
      });
    }
    const blockIndex = scene.document.blocks.findIndex((block) => block.id === progression.source.blockId);
    if (blockIndex < 0) {
      throw new StorageError("Write-block progression source references an unknown scene block", "INVALID_DATA", {
        progressionId: progression.id,
        sceneId: progression.source.sceneId,
        blockId: progression.source.blockId,
      });
    }
    const block = scene.document.blocks[blockIndex]!;
    if (block.kind !== "codexProgression" || block.progressionId !== progression.id) {
      throw new StorageError("Write-block progression source must reference its embedded scene progression block", "INVALID_DATA", {
        progressionId: progression.id,
        sceneId: progression.source.sceneId,
        blockId: progression.source.blockId,
      });
    }
    return { sceneIndex, blockIndex };
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
          throw new StorageError("Evidence references an unknown Codex entry", "INVALID_DATA", {
            sourceId: item.sourceId,
          });
        }
      } else if (!relationIds.has(item.sourceId)) {
        throw new StorageError("Evidence references an unknown relation", "INVALID_DATA", {
          sourceId: item.sourceId,
        });
      }
    }
  }

  private async assertSceneProgressionBlockReferences(
    seriesRoot: string,
    sceneId: string,
    document: SceneBlockDocument,
    options: { knownProgression?: CodexProgression } = {},
  ): Promise<void> {
    const seenProgressionIds = new Set<string>();
    for (const block of document.blocks) {
      if (block.kind !== "codexProgression") continue;
      if (seenProgressionIds.has(block.progressionId)) {
        throw new StorageError("Scene document references a progression more than once", "INVALID_DATA", {
          sceneId,
          blockId: block.id,
          progressionId: block.progressionId,
        });
      }
      seenProgressionIds.add(block.progressionId);

      let progressionDocument: CodexProgressionDocument;
      try {
        progressionDocument = options.knownProgression?.id === block.progressionId
          ? CodexProgressionDocumentSchema.parse({
              progression: options.knownProgression,
              revision: jsonAuthorityRevision(serializeJsonAuthority(options.knownProgression)),
            })
          : await this.readCodexProgression(seriesRoot, block.progressionId);
      } catch (error) {
        if (error instanceof StorageError && error.code === "NOT_FOUND") {
          throw new StorageError("Scene progression block references a missing progression", "INVALID_DATA", {
            sceneId,
            blockId: block.id,
            progressionId: block.progressionId,
          });
        }
        throw error;
      }

      const progression = progressionDocument.progression;
      if (progression.archivedAt) {
        throw new StorageError("Scene progression block references an archived progression", "INVALID_DATA", {
          sceneId,
          blockId: block.id,
          progressionId: block.progressionId,
        });
      }
      if (progression.source.kind !== "write-block") {
        throw new StorageError("Embedded scene progression blocks require write-block sourced progressions", "INVALID_DATA", {
          sceneId,
          blockId: block.id,
          progressionId: block.progressionId,
          sourceKind: progression.source.kind,
        });
      }
      if (
        progression.effectiveFromSceneId !== sceneId ||
        progression.source.sceneId !== sceneId ||
        progression.source.blockId !== block.id
      ) {
        throw new StorageError("Scene progression block source does not match its containing block", "INVALID_DATA", {
          sceneId,
          blockId: block.id,
          progressionId: block.progressionId,
          effectiveFromSceneId: progression.effectiveFromSceneId,
          sourceSceneId: progression.source.sceneId,
          sourceBlockId: progression.source.blockId,
        });
      }
    }
  }

  private assertRunningWorkshopCodexCommand(
    seriesId: string,
    session: WorkshopSession,
    message: WorkshopMessage,
    requestHash: string,
  ): void {
    if (
      session.seriesId !== seriesId ||
      message.seriesId !== seriesId ||
      message.sessionId !== session.id
    ) {
      throw new StorageError("Workshop Codex command crosses a Series or session boundary", "INVALID_DATA");
    }
    if (session.status !== "active") {
      throw new StorageError("Archived Workshop sessions cannot execute Codex commands", "CONFLICT", {
        sessionId: session.id,
      });
    }
    if (
      session.kind !== "agent" ||
      message.role !== "tool" ||
      message.mode !== "agent" ||
      message.status !== "succeeded"
    ) {
      throw new StorageError("Only successful Agent tool messages can execute Codex commands", "INVALID_DATA", {
        messageId: message.id,
      });
    }
    if (
      !message.toolExecution ||
      message.toolExecution.status !== "running" ||
      message.toolExecution.requestHash !== requestHash
    ) {
      throw new StorageError("Workshop Codex command execution identity does not match its claim", "CONFLICT", {
        messageId: message.id,
      });
    }
  }

  private assertWorkshopCodexDetailReferences(
    categoryId: CodexCategoryId,
    details: Record<string, string>,
    detailAiContext: Record<string, boolean>,
    detailTypes: CodexDetailTypeDocument[],
  ): void {
    const known = new Map(detailTypes.map((document) => [document.detailType.id, document.detailType]));
    for (const detailTypeId of new Set([
      ...Object.keys(details),
      ...Object.keys(detailAiContext),
    ])) {
      const detailType = known.get(detailTypeId);
      if (!detailType || detailType.categoryId !== categoryId) {
        throw new StorageError("Workshop Codex command references an unknown detail type", "INVALID_DATA", {
          categoryId,
          detailTypeId,
        });
      }
    }
  }

  private workshopCodexResultMessage(input: {
    seriesId: string;
    session: WorkshopSession;
    toolMessage: WorkshopMessage;
    content: string;
    createdAt: string;
    status?: "succeeded" | "failed";
    errorCode?: string | null;
    errorMessage?: string | null;
  }): WorkshopMessage {
    return WorkshopMessageSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      seriesId: input.seriesId,
      sessionId: input.session.id,
      role: "result",
      mode: "agent",
      status: input.status ?? "succeeded",
      content: input.content,
      reasoningContent: "",
      contextBundleId: input.toolMessage.contextBundleId,
      modelCallId: input.toolMessage.modelCallId,
      proposalIds: [],
      attachmentIds: [],
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
      createdAt: new Date(Date.parse(input.createdAt) + 1).toISOString(),
    });
  }

  private async completeWorkshopAgentToolResult(
    seriesRoot: string,
    toolMessage: WorkshopMessage,
    rawResultMessage: WorkshopMessage,
    completedAt: string,
  ): Promise<{
    resultMessage: WorkshopMessage;
    runDocument: WorkshopAgentRunDocument | null;
    runMutation: FileMutation | null;
  }> {
    if (!toolMessage.agentRunId || !toolMessage.agentStepId) {
      return { resultMessage: rawResultMessage, runDocument: null, runMutation: null };
    }
    const current = await readWorkshopAgentRunFile(seriesRoot, toolMessage.agentRunId);
    if (
      current.run.sessionId !== toolMessage.sessionId ||
      current.run.status !== "waiting-confirmation" ||
      current.run.activeStepId !== toolMessage.agentStepId
    ) {
      throw new StorageError("Workshop Agent run is not waiting for this tool request", "CONFLICT", {
        runId: current.run.id,
        messageId: toolMessage.id,
      });
    }
    const activeStep = current.run.steps.find((step) => step.id === toolMessage.agentStepId);
    if (!activeStep || activeStep.kind !== "tool-request" || activeStep.messageId !== toolMessage.id) {
      throw new StorageError("Workshop Agent tool step does not match the tool message", "CONFLICT", {
        runId: current.run.id,
        messageId: toolMessage.id,
      });
    }
    const resultStepId = randomUUID();
    const resultMessage = WorkshopMessageSchema.parse({
      ...rawResultMessage,
      agentRunId: current.run.id,
      agentStepId: resultStepId,
    });
    const resultFailed = resultMessage.status === "failed";
    const steps = [
      ...current.run.steps.map((step) => step.id === activeStep.id ? {
        ...step,
        status: "succeeded" as const,
        completedAt,
      } : step),
      {
        schemaVersion: 2 as const,
        id: resultStepId,
        index: current.run.steps.length,
        kind: "tool-result" as const,
        status: resultFailed ? "failed" as const : "succeeded" as const,
        attempt: activeStep.attempt,
        modelCallId: null,
        promptSnapshot: null,
        messageId: resultMessage.id,
        inputMessageIds: [toolMessage.id],
        degradedStructuredOutput: false,
        retryable: false,
        errorCode: resultFailed ? resultMessage.errorCode : null,
        errorMessage: resultFailed ? resultMessage.errorMessage : null,
        startedAt: completedAt,
        completedAt,
      },
    ];
    const run = WorkshopAgentRunSchema.parse({
      ...current.run,
      status: "interrupted",
      activeStepId: null,
      steps,
      retryable: true,
      updatedAt: resultMessage.createdAt,
      completedAt: resultMessage.createdAt,
    });
    assertWorkshopAgentRunEvolution(current.run, run);
    const raw = serializeJsonAuthority(run);
    return {
      resultMessage,
      runDocument: { run, revision: jsonAuthorityRevision(raw) },
      runMutation: { targetPath: workshopAgentRunPath(seriesRoot, run.id), content: raw },
    };
  }

  private completeWorkshopCodexCommand(
    session: WorkshopSession,
    toolMessage: WorkshopMessage,
    requestHash: string,
    resultMessage: WorkshopMessage,
    completedAt: string,
  ): { message: WorkshopMessage; session: WorkshopSession } {
    const failed = resultMessage.status === "failed";
    const execution = WorkshopToolExecutionSchema.parse({
      requestHash,
      status: failed ? "failed" : "succeeded",
      startedAt: toolMessage.toolExecution?.startedAt ?? completedAt,
      completedAt,
      resultMessageId: resultMessage.id,
      errorCode: failed ? resultMessage.errorCode : null,
      errorMessage: failed ? resultMessage.errorMessage : null,
    });
    return {
      message: WorkshopMessageSchema.parse({
        ...toolMessage,
        toolExecution: execution,
      }),
      session: WorkshopSessionSchema.parse({
        ...session,
        lastMessageAt: resultMessage.createdAt,
        updatedAt: resultMessage.createdAt,
      }),
    };
  }

  private async prepareWorkshopCodexEntryUpdate(input: {
    seriesRoot: string;
    current: {
      document: CodexEntryDocument;
      filePath: string;
      researchPath: string;
    };
    input: UpdateCodexEntryInput;
    detailTypes: CodexDetailTypeDocument[];
    now: string;
    mutations: FileMutation[];
  }): Promise<CodexEntryDocument> {
    const changesEntry = [
      input.input.categoryId,
      input.input.name,
      input.input.aliases,
      input.input.thumbnail,
      input.input.details,
      input.input.detailAiContext,
      input.input.aiContextPolicy,
      input.input.mention,
      input.input.description,
    ].some((value) => value !== undefined);
    const changesResearch = input.input.research !== undefined;
    const nextCategoryId = input.input.categoryId ?? input.current.document.metadata.categoryId;
    if (
      input.input.categoryId !== undefined &&
      input.input.categoryId !== input.current.document.metadata.categoryId
    ) {
      await this.assertCodexCategoryWritable(input.seriesRoot, input.input.categoryId);
    }
    const nextDetails = input.input.details ?? input.current.document.metadata.details;
    const nextDetailAiContext = input.input.detailAiContext ??
      input.current.document.metadata.detailAiContext;
    this.assertWorkshopCodexDetailReferences(
      nextCategoryId,
      nextDetails,
      nextDetailAiContext,
      input.detailTypes,
    );

    let metadata = input.current.document.metadata;
    let description = input.current.document.description;
    let entryRevision = input.current.document.revision;
    let relativePath = input.current.document.relativePath;
    if (changesEntry) {
      metadata = CodexEntryMetadataSchema.parse({
        ...input.current.document.metadata,
        categoryId: nextCategoryId,
        name: input.input.name ?? input.current.document.metadata.name,
        aliases: input.input.aliases === undefined
          ? input.current.document.metadata.aliases
          : normalizeUniqueStrings(input.input.aliases),
        thumbnail: input.input.thumbnail === undefined
          ? input.current.document.metadata.thumbnail
          : input.input.thumbnail,
        details: nextDetails,
        detailAiContext: nextDetailAiContext,
        aiContextPolicy: input.input.aiContextPolicy ?? input.current.document.metadata.aiContextPolicy,
        mention: input.input.mention
          ? {
            ...input.input.mention,
            excludedTerms: normalizeUniqueStrings(input.input.mention.excludedTerms),
          }
          : input.current.document.metadata.mention,
        updatedAt: input.now,
      });
      description = input.input.description ?? input.current.document.description;
      const nextEntryPath = assertInside(
        input.seriesRoot,
        codexEntryPath(input.seriesRoot, nextCategoryId, metadata.id),
      );
      if (nextEntryPath !== input.current.filePath && await pathExists(nextEntryPath)) {
        throw new StorageError("Codex entry target category already contains this id", "CONFLICT", {
          entryId: metadata.id,
        });
      }
      const raw = serializeCodexEntry(metadata, description);
      input.mutations.push({ targetPath: nextEntryPath, content: raw });
      if (nextEntryPath !== input.current.filePath) {
        input.mutations.push({ targetPath: input.current.filePath, delete: true });
      }
      entryRevision = jsonAuthorityRevision(raw);
      relativePath = path.relative(input.seriesRoot, nextEntryPath);
    }

    let research = input.current.document.research;
    if (changesResearch) {
      const researchMetadata = CodexResearchMetadataSchema.parse({
        ...input.current.document.research.metadata,
        updatedAt: input.now,
      });
      const content = input.input.research!;
      const raw = serializeCodexResearch(researchMetadata, content);
      input.mutations.push({ targetPath: input.current.researchPath, content: raw });
      research = CodexResearchDocumentSchema.parse({
        metadata: researchMetadata,
        content,
        revision: jsonAuthorityRevision(raw),
        relativePath: path.relative(input.seriesRoot, input.current.researchPath),
      });
    }
    return CodexEntryDocumentSchema.parse({
      metadata,
      description,
      revision: entryRevision,
      relativePath,
      research,
    });
  }

  private async assertWorkshopProgressionOwnedByEntry(
    seriesRoot: string,
    entryId: string,
    progression: CodexProgression,
  ): Promise<void> {
    if (progression.kind === "field" || progression.kind === "world") {
      if (progression.entryId !== entryId) {
        throw new StorageError("Workshop Progression belongs to another Codex entry", "INVALID_DATA", {
          entryId,
          progressionEntryId: progression.entryId,
        });
      }
      return;
    }
    const relation = await this.readCodexRelation(seriesRoot, progression.relationId!);
    if (
      relation.relation.sourceEntryId !== entryId &&
      relation.relation.targetEntryId !== entryId
    ) {
      throw new StorageError("Workshop Progression relation does not involve the target entry", "INVALID_DATA", {
        entryId,
        relationId: progression.relationId,
      });
    }
  }

  private async assertCodexProgressionReferences(
    seriesId: string,
    seriesRoot: string,
    progression: CodexProgression,
    options: {
      knownWriteBlock?: { sceneId: string; blockId: string };
      knownDetailTypes?: CodexDetailType[];
    } = {},
  ): Promise<void> {
    const { sceneIndexes } = await this.narrativeSceneIndexes(seriesId);
    this.assertEffectiveSceneRange(
      sceneIndexes,
      progression.effectiveFromSceneId,
      progression.effectiveToSceneId,
    );
    if (progression.source.sceneId && !sceneIndexes.has(progression.source.sceneId)) {
      throw new StorageError("Progression source references an unknown scene", "INVALID_DATA", {
        sceneId: progression.source.sceneId,
      });
    }
    if (progression.source.kind === "write-block") {
      if (progression.source.sceneId !== progression.effectiveFromSceneId) {
        throw new StorageError("Write-block progression source must match its effective scene", "INVALID_DATA", {
          progressionId: progression.id,
          sourceSceneId: progression.source.sceneId,
          effectiveFromSceneId: progression.effectiveFromSceneId,
        });
      }
      const scene = await this.getScene(seriesId, progression.source.sceneId!);
      const blockId = progression.source.blockId!;
      const isKnownWriteBlock = options.knownWriteBlock?.sceneId === progression.source.sceneId &&
        options.knownWriteBlock.blockId === blockId;
      const block = scene.document.blocks.find((candidate) => candidate.id === blockId);
      if (!isKnownWriteBlock && !block) {
        throw new StorageError("Progression source references an unknown scene block", "INVALID_DATA", {
          sceneId: progression.source.sceneId,
          blockId,
        });
      }
      if (
        !isKnownWriteBlock &&
        block &&
        (block.kind !== "codexProgression" || block.progressionId !== progression.id)
      ) {
        throw new StorageError("Write-block progression source must reference its embedded scene progression block", "INVALID_DATA", {
          progressionId: progression.id,
          sceneId: progression.source.sceneId,
          blockId,
        });
      }
    }
    if (progression.kind === "field" || progression.kind === "world") {
      const entryId = progression.entryId!;
      const entry = await this.getCodexEntry(seriesId, entryId);
      if (entry.metadata.archivedAt) {
        throw new StorageError("Progression cannot target an archived entry", "INVALID_DATA", {
          entryId,
        });
      }
      if (progression.kind === "field" && progression.field?.kind === "detail") {
        const knownDetailType = options.knownDetailTypes?.find(
          (detailType) => detailType.id === progression.field?.detailTypeId,
        );
        const detailType = knownDetailType
          ? CodexDetailTypeDocumentSchema.parse({
            detailType: knownDetailType,
            revision: jsonAuthorityRevision(serializeJsonAuthority(knownDetailType)),
          })
          : await this.readCodexDetailType(seriesRoot, progression.field.detailTypeId);
        if (detailType.detailType.categoryId !== entry.metadata.categoryId) {
          throw new StorageError("Progression detail type does not belong to the entry category", "INVALID_DATA", {
            entryId,
            detailTypeId: detailType.detailType.id,
          });
        }
      }
    } else {
      const relationId = progression.relationId!;
      const relation = await this.readCodexRelation(seriesRoot, relationId);
      if (relation.relation.archivedAt) {
        throw new StorageError("Progression cannot target an archived relation", "INVALID_DATA", {
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

  private async codexRelationDeleteBlockers(
    seriesId: string,
    relationId: string,
  ): Promise<DeleteCodexRelationBlocker[]> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const blockers = new Map<string, DeleteCodexRelationBlocker>();
    const add = (blocker: DeleteCodexRelationBlocker) => {
      blockers.set(`${blocker.kind}:${blocker.id}`, blocker);
    };

    for (const document of await this.listCodexProgressionsFromRoot(seriesRoot)) {
      if (
        document.progression.relationId === relationId ||
        document.progression.evidence.some(
          (evidence) => evidence.sourceType === "relation" && evidence.sourceId === relationId,
        )
      ) {
        add({
          kind: "progression",
          id: document.progression.id,
          reason: "A Codex progression references this relation",
        });
      }
    }

    for (const document of await this.listCodexKnowledgeFromRoot(seriesRoot)) {
      if (
        document.knowledge.relationId === relationId ||
        document.knowledge.evidence.some(
          (evidence) => evidence.sourceType === "relation" && evidence.sourceId === relationId,
        )
      ) {
        add({
          kind: "character-knowledge",
          id: document.knowledge.id,
          reason: "A character-knowledge record references this relation",
        });
      }
    }

    const proposals = await this.listProposals(seriesId);
    for (const document of proposals.items) {
      const proposal = document.proposal;
      const targetsRelation =
        (proposal.target.kind === "codex-relation" && proposal.target.targetId === relationId) ||
        proposal.patches.some(
          (patch) => patch.target.kind === "codex-relation" && patch.target.targetId === relationId,
        );
      const citesRelation = proposal.evidence.some(
        (evidence) =>
          evidence.sourceType === "codex-relation" && evidence.sourceId === relationId,
      );
      if (targetsRelation || citesRelation) {
        add({
          kind: "proposal",
          id: proposal.id,
          reason: "A Proposal or its audit evidence references this relation",
        });
      }
    }

    return [...blockers.values()];
  }

  private async progressionDeleteBlockers(
    seriesId: string,
    progressionId: string,
    options: { ignoredWriteBlock?: { sceneId: string; blockId: string } } = {},
  ): Promise<Array<{ kind: "write-block" | "proposal" | "model-call" | "character-knowledge"; id: string; reason: string }>> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const blockers: Array<{ kind: "write-block" | "proposal" | "model-call" | "character-knowledge"; id: string; reason: string }> = [];
    const progression = await this.readCodexProgression(seriesRoot, progressionId);
    if (progression.progression.source.kind === "proposal") {
      blockers.push({
        kind: "proposal",
        id: progression.progression.source.sourceId ?? progressionId,
        reason: "Proposal-sourced progressions must be archived until Proposal references can be audited",
      });
    }
    const knowledge = await this.listCodexKnowledgeFromRoot(seriesRoot);
    for (const document of knowledge) {
      if (document.knowledge.truthProgressionId === progressionId) {
        blockers.push({
          kind: "character-knowledge",
          id: document.knowledge.id,
          reason: "Character knowledge references this progression",
        });
      }
    }
    const series = await this.getSeries(seriesId);
    for (const scene of series.scenes) {
      for (const block of scene.document.blocks) {
        if (block.kind === "codexProgression" && block.progressionId === progressionId) {
          if (
            options.ignoredWriteBlock &&
            options.ignoredWriteBlock.sceneId === scene.metadata.id &&
            options.ignoredWriteBlock.blockId === block.id
          ) {
            continue;
          }
          blockers.push({
            kind: "write-block",
            id: block.id,
            reason: "A scene progression block references this progression",
          });
        }
      }
    }
    return blockers;
  }

  private async setCodexProgressionArchived(
    seriesId: string,
    progressionId: string,
    rawInput: ArchiveCodexDocumentInput,
    archived: boolean,
  ): Promise<CodexProgressionDocument> {
    const input = ArchiveCodexDocumentInputSchema.parse(rawInput);
    const seriesRoot = await this.findSeriesRoot(seriesId);
    return runSeriesFileTransaction(seriesRoot, async (commit) => {
    const current = await this.readCodexProgression(seriesRoot, progressionId);
    if (current.revision !== input.baseRevision) {
      throw new StorageError("Progression was modified by another operation", "CONFLICT", {
        currentRevision: current.revision,
      });
    }
    if (Boolean(current.progression.archivedAt) === archived) return current;
    const progression = CodexProgressionSchema.parse({
      ...current.progression,
      updatedAt: new Date().toISOString(),
      archivedAt: archived ? new Date().toISOString() : null,
    });
    const raw = serializeJsonAuthority(progression);
    await commit([{ targetPath: codexProgressionPath(seriesRoot, progression.id), content: raw }]);
    return CodexProgressionDocumentSchema.parse({
      progression,
      revision: jsonAuthorityRevision(raw),
    });
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
    const written = await writeJsonAuthorityFile(
      seriesRoot,
      codexKnowledgePath(seriesRoot, knowledge.id),
      knowledge,
      (value) => CodexKnowledgeSchema.parse(value),
    );
    return CodexKnowledgeDocumentSchema.parse({
      knowledge: written.data,
      revision: written.revision,
    });
  }

  private async reindexSceneCodexMentions(
    seriesRoot: string,
    scene: SceneDocument,
    databasePath?: string,
  ): Promise<void> {
    const entries = (await this.listCodexEntriesFromRoot(seriesRoot)).filter(
      (entry) => entry.metadata.archivedAt === null,
    );
    const result = findCodexMentionsInContent(
      scene.metadata.id,
      scene.plainText,
      entries,
    );
    const database = this.openIndex(seriesRoot, databasePath);
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
    try {
      return await runIndexWriteLane(seriesRoot, () => this.rebuildCodexIndexProjection(seriesRoot));
    } catch (error) {
      const rebuilt = await this.rebuildIndexIfUnhealthy(seriesRoot, error);
      return {
        indexedCodexEntries: rebuilt.indexedCodexEntries,
        indexedMentions: rebuilt.indexedMentions,
        ambiguousMentions: rebuilt.ambiguousMentions,
      };
    }
  }

  private async rebuildCodexIndexProjection(
    seriesRoot: string,
    databasePath?: string,
  ): Promise<{
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
    const database = this.openIndex(seriesRoot, databasePath);
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
          scene.plainText,
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

  private openIndex(seriesRoot: string, databasePath?: string): Database.Database {
    const targetPath = databasePath
      ? assertInside(seriesRoot, databasePath)
      : assertInside(seriesRoot, path.join(seriesRoot, ".studio", "index.sqlite"));
    const seriesId = this.seriesIdsByRoot.get(path.resolve(seriesRoot));
    if (!seriesId) {
      throw new StorageError("Series identity is unavailable for the SQLite index", "INVALID_DATA", { seriesRoot });
    }
    return openIndexDatabase(targetPath, { seriesId });
  }

  private async rebuildIndexIfUnhealthy(seriesRoot: string, originalError: unknown): Promise<{
    indexedScenes: number;
    indexedCodexEntries: number;
    indexedMentions: number;
    ambiguousMentions: number;
    indexedContextBundles: number;
    indexedModelCalls: number;
  }> {
    const expectedSeriesId = this.seriesIdsByRoot.get(path.resolve(seriesRoot));
    const health = await inspectIndexDatabase(seriesRoot, expectedSeriesId);
    if (health.status === "ready") throw originalError;
    const manifest = await readJson(path.join(seriesRoot, SERIES_FILE), (value) => SeriesManifestSchema.parse(value));
    return this.rebuildIndex(manifest.id);
  }

  private async withIndexRead<T>(
    seriesRoot: string,
    read: (database: Database.Database) => T,
  ): Promise<T> {
    const execute = () => {
      const database = this.openIndex(seriesRoot);
      try {
        return read(database);
      } finally {
        database.close();
      }
    };
    await waitForIndexWriteLane(seriesRoot);
    try {
      return execute();
    } catch (error) {
      await this.rebuildIndexIfUnhealthy(seriesRoot, error);
      await waitForIndexWriteLane(seriesRoot);
      return execute();
    }
  }

  private async unindexScenes(seriesRoot: string, sceneIds: string[]): Promise<void> {
    if (sceneIds.length === 0) return;
    try {
      await runIndexWriteLane(seriesRoot, async () => {
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
      });
    } catch (error) {
      await this.rebuildIndexIfUnhealthy(seriesRoot, error);
    }
  }

  private async indexScene(
    seriesRoot: string,
    scene: SceneDocument,
    refreshCodex = true,
  ): Promise<void> {
    try {
      await runIndexWriteLane(seriesRoot, async () => {
        await this.indexSceneProjection(seriesRoot, scene);
        if (refreshCodex) await this.reindexSceneCodexMentions(seriesRoot, scene);
      });
    } catch (error) {
      await this.rebuildIndexIfUnhealthy(seriesRoot, error);
    }
  }

  private async indexSceneProjection(
    seriesRoot: string,
    scene: SceneDocument,
    databasePath?: string,
  ): Promise<void> {
    const database = this.openIndex(seriesRoot, databasePath);
    try {
      this.writeSceneProjection(database, scene);
    } finally {
      database.close();
    }
  }

  private writeSceneProjection(database: Database.Database, scene: SceneDocument): void {
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
          scene.plainText,
          scene.relativePath,
          scene.metadata.updatedAt,
          scene.revision,
        );
      database
        .prepare("INSERT INTO scene_fts (id, title, content) VALUES (?, ?, ?)")
        .run(scene.metadata.id, scene.metadata.title, scene.plainText);
    });
    transaction();
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
