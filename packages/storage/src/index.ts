import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import YAML from "yaml";
import {
  ActManifestSchema,
  ArchiveSceneSectionInputSchema,
  BookManifestSchema,
  ChapterManifestSchema,
  CreateActInputSchema,
  CreateChapterInputSchema,
  CreateReviewAnchorInputSchema,
  CreateSceneInputSchema,
  CreateSceneSectionInputSchema,
  CreateSeriesInputSchema,
  CreateTimelineEventInputSchema,
  DeleteTimelineEventInputSchema,
  MoveSceneInputSchema,
  PlanningBoardSchema,
  PlanningSceneSchema,
  ReorderInputSchema,
  RestoreSceneSectionInputSchema,
  SceneDocumentSchema,
  SceneFrontmatterSchema,
  SceneSectionDocumentSchema,
  SceneSectionMetadataSchema,
  SectionContextTargetSchema,
  SeriesManifestSchema,
  ResolvedReviewAnchorSchema,
  ReviewAnchorSchema,
  TimelineEventDocumentSchema,
  TimelineEventSchema,
  TimelineManifestSchema,
  UpdateActInputSchema,
  UpdateChapterInputSchema,
  UpdateScenePlanningInputSchema,
  UpdateSceneInputSchema,
  UpdateSceneSectionInputSchema,
  UpdateTimelineEventInputSchema,
  type ActManifest,
  type ArchiveSceneSectionInput,
  type BookManifest,
  type ChapterManifest,
  type CreateActInput,
  type CreateChapterInput,
  type CreateReviewAnchorInput,
  type CreateSceneInput,
  type CreateSceneSectionInput,
  type CreateSeriesInput,
  type CreateTimelineEventInput,
  type DeleteTimelineEventInput,
  type HierarchyIssue,
  type HierarchyValidationResult,
  type MoveSceneInput,
  type PlanningBoard,
  type PlanningAct,
  type PlanningBook,
  type PlanningChapter,
  type PlanningScene,
  type ReorderInput,
  type RestoreSceneSectionInput,
  type SceneDocument,
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
  type UpdateChapterInput,
  type UpdateScenePlanningInput,
  type UpdateSceneInput,
  type UpdateSceneSectionInput,
  type UpdateTimelineEventInput,
} from "@novel-studio/contracts";

const FRONTMATTER_MARKER = "---";
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

function toChineseOrdinal(value: number): string {
  const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  if (value <= 0) return String(value);
  if (value < 10) return digits[value] ?? String(value);
  if (value < 20) return `十${value === 10 ? "" : digits[value - 10]}`;
  const tens = Math.floor(value / 10);
  const ones = value % 10;
  return `${digits[tens]}十${ones === 0 ? "" : digits[ones]}`;
}

export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NOT_FOUND"
      | "CONFLICT"
      | "INVALID_DATA"
      | "PATH_ESCAPE",
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "StorageError";
  }
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

function assertInside(root: string, candidate: string): string {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new StorageError("路径超出作品库范围", "PATH_ESCAPE", {
      root: resolvedRoot,
      candidate: resolvedCandidate,
    });
  }
  return resolvedCandidate;
}

async function atomicWrite(filePath: string, value: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(tempPath, value, { encoding: "utf8", flag: "wx" });
  try {
    await rename(tempPath, filePath);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}

interface FileMutation {
  targetPath: string;
  content?: string;
  delete?: boolean;
}

interface TransactionEntry {
  target: string;
  temporary: string | null;
  backup: string;
  hadOriginal: boolean;
  delete: boolean;
}

interface TransactionJournal {
  id: string;
  status: "prepared" | "committing" | "committed";
  entries: TransactionEntry[];
}

async function recoverFileTransactions(seriesRoot: string): Promise<void> {
  const transactionRoot = path.join(seriesRoot, ".studio", "transactions");
  let files: string[];
  try {
    files = (await readdir(transactionRoot, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => path.join(transactionRoot, entry.name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }

  for (const journalPath of files) {
    const journal = JSON.parse(await readFile(journalPath, "utf8")) as TransactionJournal;
    const entries = journal.entries.map((entry) => ({
      ...entry,
      target: assertInside(seriesRoot, path.join(seriesRoot, entry.target)),
      temporary: entry.temporary
        ? assertInside(seriesRoot, path.join(seriesRoot, entry.temporary))
        : null,
      backup: assertInside(seriesRoot, path.join(seriesRoot, entry.backup)),
    }));

    if (journal.status === "committed") {
      await Promise.all(
        entries.flatMap((entry) => [
          rm(entry.backup, { force: true }),
          ...(entry.temporary ? [rm(entry.temporary, { force: true })] : []),
        ]),
      );
      await rm(journalPath, { force: true });
      continue;
    }

    for (const entry of [...entries].reverse()) {
      if (entry.hadOriginal && (await pathExists(entry.backup))) {
        await rm(entry.target, { force: true });
        await rename(entry.backup, entry.target);
      } else if (!entry.hadOriginal) {
        await rm(entry.target, { force: true });
      }
      if (entry.temporary) await rm(entry.temporary, { force: true });
    }
    await rm(journalPath, { force: true });
  }
}

async function applyFileTransaction(
  seriesRoot: string,
  mutations: FileMutation[],
): Promise<void> {
  const uniqueTargets = new Set(mutations.map((mutation) => path.resolve(mutation.targetPath)));
  if (uniqueTargets.size !== mutations.length) {
    throw new StorageError("文件事务包含重复目标", "INVALID_DATA");
  }

  await recoverFileTransactions(seriesRoot);
  const id = randomUUID();
  const transactionRoot = path.join(seriesRoot, ".studio", "transactions");
  await mkdir(transactionRoot, { recursive: true });
  const journalPath = path.join(transactionRoot, `${id}.json`);
  const entries: TransactionEntry[] = [];

  for (const mutation of mutations) {
    const targetPath = assertInside(seriesRoot, mutation.targetPath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    const temporary = mutation.delete ? null : `${targetPath}.${id}.tmp`;
    if (temporary) {
      if (mutation.content === undefined) {
        throw new StorageError("文件事务缺少写入内容", "INVALID_DATA", { targetPath });
      }
      await writeFile(temporary, mutation.content, { encoding: "utf8", flag: "wx" });
    }
    entries.push({
      target: path.relative(seriesRoot, targetPath),
      temporary: temporary ? path.relative(seriesRoot, temporary) : null,
      backup: path.relative(seriesRoot, `${targetPath}.${id}.bak`),
      hadOriginal: await pathExists(targetPath),
      delete: mutation.delete ?? false,
    });
  }

  const writeJournal = async (status: TransactionJournal["status"]) =>
    atomicWrite(journalPath, JSON.stringify({ id, status, entries } satisfies TransactionJournal));

  await writeJournal("prepared");
  try {
    await writeJournal("committing");
    for (const entry of entries) {
      const target = path.join(seriesRoot, entry.target);
      const backup = path.join(seriesRoot, entry.backup);
      if (entry.hadOriginal) await rename(target, backup);
      if (entry.temporary) await rename(path.join(seriesRoot, entry.temporary), target);
    }
    await writeJournal("committed");
    await Promise.all(entries.map((entry) => rm(path.join(seriesRoot, entry.backup), { force: true })));
    await rm(journalPath, { force: true });
  } catch (error) {
    await recoverFileTransactions(seriesRoot);
    throw error;
  }
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
    throw new StorageError(`${entityLabel}重排必须是现有 ID 的完整无重复排列`, "INVALID_DATA", {
      missingIds,
      unknownIds,
      duplicateIds: [...new Set(duplicateIds)],
    });
  }
}

function serializeYaml(value: unknown): string {
  return YAML.stringify(value, { lineWidth: 0 });
}

function serializeScene(metadata: SceneFrontmatter, content: string): string {
  const normalizedContent = content.replace(/\r\n/gu, "\n").replace(/^\n+/u, "");
  return `${FRONTMATTER_MARKER}\n${serializeYaml(metadata)}${FRONTMATTER_MARKER}\n\n${normalizedContent}`;
}

function parseSceneText(value: string, relativePath: string): SceneDocument {
  const normalized = value.replace(/\r\n/gu, "\n");
  if (!normalized.startsWith(`${FRONTMATTER_MARKER}\n`)) {
    throw new StorageError("场景文件缺少 YAML frontmatter", "INVALID_DATA", {
      relativePath,
    });
  }
  const end = normalized.indexOf(`\n${FRONTMATTER_MARKER}\n`, 4);
  if (end < 0) {
    throw new StorageError("场景文件 frontmatter 未闭合", "INVALID_DATA", {
      relativePath,
    });
  }
  const yamlText = normalized.slice(4, end);
  const contentStart = end + 5;
  const content = normalized.slice(contentStart).replace(/^\n/u, "");
  const metadata = SceneFrontmatterSchema.parse(YAML.parse(yamlText));
  return SceneDocumentSchema.parse({
    metadata,
    content,
    revision: contentRevision(normalized),
    relativePath: relativePath.replace(/\\/gu, "/"),
    characterCount: countChineseCharacters(content),
    paragraphCount: countParagraphs(content),
  });
}

function serializeSceneSection(metadata: SceneSectionMetadata, content: string): string {
  const normalizedContent = content.replace(/\r\n/gu, "\n").replace(/^\n+/u, "");
  return `${FRONTMATTER_MARKER}\n${serializeYaml(metadata)}${FRONTMATTER_MARKER}\n\n${normalizedContent}`;
}

function parseSceneSectionText(value: string, relativePath: string): SceneSectionDocument {
  const normalized = value.replace(/\r\n/gu, "\n");
  if (!normalized.startsWith(`${FRONTMATTER_MARKER}\n`)) {
    throw new StorageError("Section 文件缺少 YAML frontmatter", "INVALID_DATA", { relativePath });
  }
  const end = normalized.indexOf(`\n${FRONTMATTER_MARKER}\n`, 4);
  if (end < 0) {
    throw new StorageError("Section 文件 frontmatter 未闭合", "INVALID_DATA", { relativePath });
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
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(fullPath);
  }
  return files;
}

interface ChapterContext {
  book: BookManifest;
  bookRoot: string;
  act: ActManifest;
  chapter: ChapterManifest;
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
      title: "第一幕",
      order: 1,
      chapterIds: [chapterId],
      createdAt: now,
      updatedAt: now,
    });
    const chapter: ChapterManifest = ChapterManifestSchema.parse({
      schemaVersion: 1,
      id: chapterId,
      actId,
      title: "第一章",
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
    await this.createScene(seriesId, { title: "开篇场景", content: "" }, {
      bookId,
      actId,
      chapterId,
    });
    await this.rebuildIndex(seriesId);
    return this.getSeries(seriesId);
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
      throw new StorageError("作品层级不完整", "INVALID_DATA", { issues: hierarchy.issues });
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
    const scenes: SceneDocument[] = [];
    for (const book of books.sort((a, b) => a.order - b.order)) {
      const bookRoot = path.join(seriesRoot, "books", book.id);
      for (const actId of book.actIds) {
        const act = await this.readReferencedAct(bookRoot, book, actId);
        for (const chapterId of act.chapterIds) {
          const chapter = await this.readReferencedChapter(bookRoot, act, chapterId);
          for (const sceneId of chapter.sceneIds) {
            const scene = await this.readReferencedScene(seriesRoot, book, act, chapter, sceneId);
            scenes.push(scene);
          }
        }
      }
    }
    return { manifest, books, scenes };
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
    const series = await this.getSeriesWithoutScenes(seriesId);
    const book = location
      ? series.books.find((item) => item.id === location.bookId)
      : series.books[0];
    if (!book) throw new StorageError("作品没有可用单本", "INVALID_DATA");
    const actId = location?.actId ?? book.actIds[0];
    if (!actId) throw new StorageError("单本没有可用幕", "INVALID_DATA", { bookId: book.id });
    const act = await this.readReferencedAct(path.join(series.root, "books", book.id), book, actId);
    const chapterId = location?.chapterId ?? act.chapterIds[0];
    if (!chapterId) throw new StorageError("幕没有可用章", "INVALID_DATA", { actId });
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
      path.join(series.root, "books", book.id, "manuscript", actId, chapterId, `${metadata.id}.md`),
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
      throw new StorageError("场景已被其他修改更新", "CONFLICT", {
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
      throw new StorageError("场景规划已被其他修改更新", "CONFLICT", {
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
    await atomicWrite(filePath, serializeScene(metadata, current.content));
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
        throw new StorageError("Section 文件名或场景归属不一致", "INVALID_DATA", {
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
      throw new StorageError("已归档 Section 不能直接编辑", "INVALID_DATA", { sectionId });
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
      throw new StorageError("场景已被其他修改更新", "CONFLICT", {
        currentRevision: scene.revision,
        scene,
      });
    }
    if (
      input.end > scene.content.length ||
      scene.content.slice(input.start, input.end) !== input.exactQuote
    ) {
      throw new StorageError("锚点范围与当前正文引用不一致", "INVALID_DATA", {
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

  async rebuildIndex(seriesId: string): Promise<{ indexedScenes: number }> {
    const seriesRoot = await this.findSeriesRoot(seriesId);
    const database = this.openIndex(seriesRoot);
    database.exec("DELETE FROM scene_fts; DELETE FROM scenes;");
    database.close();
    const sceneFiles = await walkSceneFiles(path.join(seriesRoot, "books"));
    for (const filePath of sceneFiles) {
      const scene = parseSceneText(await readFile(filePath, "utf8"), path.relative(seriesRoot, filePath));
      await this.indexScene(seriesRoot, scene);
    }
    return { indexedScenes: sceneFiles.length };
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
              throw new StorageError("规划查询缺少父清单引用的场景", "INVALID_DATA", { sceneId });
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
        throw new StorageError("故事事件包含无效场景引用", "INVALID_DATA", {
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
    const revision = contentRevision(JSON.stringify({
      seriesId,
      sceneRevisions: narrativeScenes.map((scene) => scene.revision),
      hierarchy: books,
      timeline,
      eventRevisions: storyEvents.map((event) => event.revision),
    }));
    return PlanningBoardSchema.parse({
      seriesId,
      revision,
      books,
      narrativeScenes,
      storyEvents,
      unplacedSceneIds: narrativeScenes.filter((scene) => !placed.has(scene.id)).map((scene) => scene.id),
      dimensions,
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
    if (storyIndex === 0) throw new StorageError("故事事件不存在", "NOT_FOUND", { eventId });
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
    if (storyIndex === 0) throw new StorageError("故事事件不存在", "NOT_FOUND", { eventId });
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
    throw new StorageError("幕不存在", "NOT_FOUND", { actId });
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
      throw new StorageError("单本的幕引用或顺序无效", "INVALID_DATA", { bookId });
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
      throw new StorageError("幕的章引用或顺序无效", "INVALID_DATA", { actId });
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
      throw new StorageError("NS-301 不支持场景跨单本移动", "INVALID_DATA", {
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
      throw new StorageError("源章没有引用待移动场景", "INVALID_DATA", { sceneId });
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
      `${sceneId}.md`,
    );
    const mutations: FileMutation[] = [
      { targetPath: chapterPath(source.bookRoot, source.chapter.id), content: serializeYaml(updatedSourceChapter) },
      { targetPath: chapterPath(target.bookRoot, target.chapter.id), content: serializeYaml(updatedTargetChapter) },
      ...sourceScenes.map(({ filePath, document }) => ({
        targetPath: filePath,
        content: serializeScene(document.metadata, document.content),
      })),
      ...targetScenes.map(({ filePath, document }) => ({
        targetPath: document.metadata.id === sceneId ? destinationPath : filePath,
        content: serializeScene(document.metadata, document.content),
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

    assertExactPermutation(book.actIds, input.orderedIds, "幕");

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

    assertExactPermutation(act.chapterIds, input.orderedIds, "章");

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
    assertExactPermutation(chapter.sceneIds, input.orderedIds, "场景");

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
        content: serializeScene(document.metadata, document.content),
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
        throw new StorageError("旧场景引用了不存在的单本，无法迁移", "INVALID_DATA", {
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
          title: existingAct?.title ?? `第${toChineseOrdinal(actIndex + 1)}幕`,
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
            title: existingChapter?.title ?? `第${toChineseOrdinal(chapterIndex + 1)}章`,
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
        addIssue("DUPLICATE_REFERENCE", `${kind}包含重复引用`, id, ownerId);
      }
    };

    const sceneFiles = await walkSceneFiles(path.join(seriesRoot, "books"));
    const scenesById = new Map<string, { document: SceneDocument; filePath: string }>();
    for (const filePath of sceneFiles) {
      try {
        const document = parseSceneText(await readFile(filePath, "utf8"), path.relative(seriesRoot, filePath));
        if (scenesById.has(document.metadata.id)) {
          addIssue("DUPLICATE_ENTITY_ID", "多个场景文件使用同一 ID", document.metadata.id);
        } else {
          scenesById.set(document.metadata.id, { document, filePath });
        }
      } catch (error) {
        addIssue(
          "INVALID_SCENE_FILE",
          error instanceof Error ? error.message : "场景文件无效",
          undefined,
          path.relative(seriesRoot, filePath),
        );
      }
    }

    for (const book of books) {
      const bookReferencedActIds = new Set<string>();
      const bookReferencedChapterIds = new Set<string>();
      addDuplicates(book.actIds, book.id, "单本.actIds");
      const bookRoot = path.join(seriesRoot, "books", book.id);
      for (let actIndex = 0; actIndex < book.actIds.length; actIndex++) {
        const actId = book.actIds[actIndex]!;
        if (referencedActIds.has(actId)) addIssue("MULTIPLE_PARENTS", "幕被多个单本引用", actId);
        referencedActIds.add(actId);
        bookReferencedActIds.add(actId);
        let act: ActManifest;
        try {
          act = await readActManifest(bookRoot, actId);
          actCount++;
        } catch (error) {
          addIssue("MISSING_ACT", "单本引用的幕清单不存在或无效", actId);
          continue;
        }
        if (act.bookId !== book.id) addIssue("ANCESTRY_MISMATCH", "幕的 bookId 与父单本不一致", act.id);
        if (act.order !== actIndex + 1) addIssue("ORDER_MISMATCH", "幕 order 与父清单位置不一致", act.id);
        addDuplicates(act.chapterIds, act.id, "幕.chapterIds");

        for (let chapterIndex = 0; chapterIndex < act.chapterIds.length; chapterIndex++) {
          const chapterId = act.chapterIds[chapterIndex]!;
          if (referencedChapterIds.has(chapterId)) addIssue("MULTIPLE_PARENTS", "章被多个幕引用", chapterId);
          referencedChapterIds.add(chapterId);
          bookReferencedChapterIds.add(chapterId);
          let chapter: ChapterManifest;
          try {
            chapter = await readChapterManifest(bookRoot, chapterId);
            chapterCount++;
          } catch (error) {
            addIssue("MISSING_CHAPTER", "幕引用的章清单不存在或无效", chapterId);
            continue;
          }
          if (chapter.actId !== act.id) addIssue("ANCESTRY_MISMATCH", "章的 actId 与父幕不一致", chapter.id);
          if (chapter.order !== chapterIndex + 1) addIssue("ORDER_MISMATCH", "章 order 与父清单位置不一致", chapter.id);
          addDuplicates(chapter.sceneIds, chapter.id, "章.sceneIds");

          for (let sceneIndex = 0; sceneIndex < chapter.sceneIds.length; sceneIndex++) {
            const sceneId = chapter.sceneIds[sceneIndex]!;
            if (referencedSceneIds.has(sceneId)) addIssue("MULTIPLE_PARENTS", "场景被多个章引用", sceneId);
            referencedSceneIds.add(sceneId);
            const stored = scenesById.get(sceneId);
            if (!stored) {
              addIssue("MISSING_SCENE", "章引用的场景文件不存在", sceneId);
              continue;
            }
            const { metadata } = stored.document;
            if (
              metadata.bookId !== book.id ||
              metadata.actId !== act.id ||
              metadata.chapterId !== chapter.id
            ) {
              addIssue("ANCESTRY_MISMATCH", "场景 frontmatter 与父层级不一致", sceneId);
            }
            if (metadata.order !== sceneIndex + 1) {
              addIssue("ORDER_MISMATCH", "场景 order 与父清单位置不一致", sceneId);
            }
            const expectedPath = path.join(
              bookRoot,
              "manuscript",
              act.id,
              chapter.id,
              `${sceneId}.md`,
            );
            if (path.resolve(stored.filePath) !== path.resolve(expectedPath)) {
              addIssue("PATH_MISMATCH", "场景物理路径与层级不一致", sceneId, path.relative(seriesRoot, stored.filePath));
            }
          }
        }
      }

      for (const actualId of await this.listManifestIds(path.join(bookRoot, ACTS_DIR))) {
        if (!bookReferencedActIds.has(actualId)) addIssue("ORPHAN_ACT", "幕清单未被当前单本引用", actualId);
      }
      for (const actualId of await this.listManifestIds(path.join(bookRoot, CHAPTERS_DIR))) {
        if (!bookReferencedChapterIds.has(actualId)) addIssue("ORPHAN_CHAPTER", "章清单未被当前单本引用", actualId);
      }
    }
    for (const sceneId of scenesById.keys()) {
      if (!referencedSceneIds.has(sceneId)) addIssue("ORPHAN_SCENE", "场景文件未被任何章引用", sceneId);
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
        throw new StorageError("幕的父单本引用不一致", "INVALID_DATA", { actId, bookId: book.id });
      }
      return act;
    } catch (error) {
      if (error instanceof StorageError && error.code === "NOT_FOUND") {
        throw new StorageError("单本引用的幕清单不存在", "INVALID_DATA", { actId, bookId: book.id });
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
        throw new StorageError("章的父幕引用不一致", "INVALID_DATA", { chapterId, actId: act.id });
      }
      return chapter;
    } catch (error) {
      if (error instanceof StorageError && error.code === "NOT_FOUND") {
        throw new StorageError("幕引用的章清单不存在", "INVALID_DATA", { chapterId, actId: act.id });
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
        throw new StorageError("章引用的场景文件不存在", "INVALID_DATA", { sceneId, chapterId: chapter.id });
      }
      throw error;
    }
    const scene = parseSceneText(await readFile(filePath, "utf8"), path.relative(seriesRoot, filePath));
    if (
      scene.metadata.bookId !== book.id ||
      scene.metadata.actId !== act.id ||
      scene.metadata.chapterId !== chapter.id
    ) {
      throw new StorageError("场景 frontmatter 与父层级不一致", "INVALID_DATA", { sceneId });
    }
    return scene;
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
    throw new StorageError("章不存在或未被幕引用", "NOT_FOUND", { chapterId });
  }

  private async findChapterContextByScene(seriesRoot: string, sceneId: string): Promise<SceneContext> {
    const scenePath = await this.findScenePath(seriesRoot, sceneId);
    const scene = parseSceneText(await readFile(scenePath, "utf8"), path.relative(seriesRoot, scenePath));
    const context = await this.findChapterContext(seriesRoot, scene.metadata.chapterId);
    if (!context.chapter.sceneIds.includes(sceneId)) {
      throw new StorageError("场景未被其 frontmatter 指定的章引用", "INVALID_DATA", { sceneId });
    }
    if (scene.metadata.bookId !== context.book.id || scene.metadata.actId !== context.act.id) {
      throw new StorageError("场景 frontmatter 的祖先引用不一致", "INVALID_DATA", { sceneId });
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
        throw new StorageError("场景文件 ID 与清单引用不一致", "INVALID_DATA", { sceneId });
      }
      if (
        movedScene?.metadata.id !== sceneId &&
        (current.metadata.bookId !== context.book.id ||
          current.metadata.actId !== context.act.id ||
          current.metadata.chapterId !== context.chapter.id)
      ) {
        throw new StorageError("待重排场景不属于目标章", "INVALID_DATA", { sceneId });
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
          throw new StorageError("时间线引用的事件文件不存在", "INVALID_DATA", { eventId });
        }
        throw error;
      }
    }
    const actualEventIds = await this.listManifestIds(
      path.join(seriesRoot, PLANNING_DIR, TIMELINE_EVENTS_DIR),
    );
    const orphanEventIds = actualEventIds.filter((eventId) => !manifest.eventIds.includes(eventId));
    if (orphanEventIds.length) {
      throw new StorageError("存在未被时间线引用的故事事件文件", "INVALID_DATA", { orphanEventIds });
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
        throw new StorageError("故事事件不存在", "NOT_FOUND", { eventId });
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
      throw new StorageError("故事事件文件名与 ID 不一致", "INVALID_DATA", { eventId, actualId: event.id });
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
      throw new StorageError("故事事件场景引用无效", "INVALID_DATA", {
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
      if (path.basename(filePath, ".md") === sceneId) return filePath;
    }
    throw new StorageError("场景不存在", "NOT_FOUND", { sceneId });
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
        throw new StorageError("Section 文件名或场景归属不一致", "INVALID_DATA", {
          sectionId,
        });
      }
      return { filePath, document };
    }
    throw new StorageError("Section 不存在", "NOT_FOUND", { sectionId });
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
    `);
    return database;
  }

  private async indexScene(seriesRoot: string, scene: SceneDocument): Promise<void> {
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
  }
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}
