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
  BookManifestSchema,
  CreateSceneInputSchema,
  CreateSeriesInputSchema,
  SceneDocumentSchema,
  SceneFrontmatterSchema,
  SeriesManifestSchema,
  UpdateSceneInputSchema,
  type BookManifest,
  type CreateSceneInput,
  type CreateSeriesInput,
  type SceneDocument,
  type SceneFrontmatter,
  type SearchResult,
  type SeriesDetail,
  type SeriesManifest,
  type SeriesSummary,
  type UpdateSceneInput,
} from "@novel-studio/contracts";

const FRONTMATTER_MARKER = "---";
const SERIES_FILE = "series.yaml";
const BOOK_FILE = "book.yaml";

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
      ".studio/inbox",
      ".studio/history",
      ".studio/cache",
      ".studio/logs",
    ];
    await Promise.all(
      requiredDirectories.map((directory) => mkdir(path.join(seriesRoot, directory), { recursive: true })),
    );
    await atomicWrite(path.join(seriesRoot, SERIES_FILE), serializeYaml(manifest));
    await atomicWrite(path.join(bookRoot, BOOK_FILE), serializeYaml(book));
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
      const seriesFile = path.join(this.libraryRoot, entry.name, SERIES_FILE);
      try {
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
    const sceneFiles = await walkSceneFiles(path.join(seriesRoot, "books"));
    const scenes = await Promise.all(
      sceneFiles.map(async (filePath) =>
        parseSceneText(await readFile(filePath, "utf8"), path.relative(seriesRoot, filePath)),
      ),
    );
    scenes.sort((a, b) => a.metadata.order - b.metadata.order);
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
    const actId = location?.actId ?? book.actIds[0] ?? randomUUID();
    const chapterId = location?.chapterId ?? randomUUID();
    const existing = await walkSceneFiles(path.join(series.root, "books"));
    const now = new Date().toISOString();
    const metadata = SceneFrontmatterSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      bookId: book.id,
      actId,
      chapterId,
      title: input.title,
      order: existing.length + 1,
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
    await atomicWrite(filePath, serializeScene(metadata, input.content));
    const scene = await this.getScene(seriesId, metadata.id);
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

  private async findSeriesRoot(seriesId: string): Promise<string> {
    await this.initialize();
    const entries = await readdir(this.libraryRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const root = assertInside(this.libraryRoot, path.join(this.libraryRoot, entry.name));
      try {
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

