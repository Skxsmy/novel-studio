import { createHash, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  AppendResearchNoteEvidenceInputSchema,
  CreateResearchNoteInputSchema,
  MAX_RESEARCH_NOTE_EVIDENCE_ITEMS,
  ResearchNoteAuthorityIssueSchema,
  ResearchNoteDetailSchema,
  ResearchNoteDocumentSchema,
  ResearchNoteEvidenceResolutionSchema,
  ResearchNoteEvidenceSchema,
  ResearchNoteFreshnessCountsSchema,
  ResearchNoteSchema,
  ResearchNoteRevisionInputSchema,
  RemoveResearchNoteEvidenceInputSchema,
  UpdateResearchNoteInputSchema,
  type AppendResearchNoteEvidenceInput,
  type CreateResearchNoteInput,
  type ResearchNote,
  type ResearchNoteAuthorityIssue,
  type ResearchNoteDetail,
  type ResearchNoteDocument,
  type ResearchNoteEvidence,
  type ResearchNoteEvidenceCaptureInput,
  type ResearchNoteEvidenceResolution,
  type ResearchNoteFreshnessCounts,
  type ResearchNoteRevisionInput,
  type RemoveResearchNoteEvidenceInput,
  type UpdateResearchNoteInput,
} from "@novel-studio/contracts";
import { StorageError } from "./errors.js";
import { runSeriesFileTransaction, type FileTransactionOptions } from "./fileTransactions.js";
import { assertInside, pathExists } from "./fileSystem.js";
import {
  jsonAuthorityRevision,
  parseJsonAuthorityText,
  readJsonAuthorityFile,
  serializeJsonAuthority,
} from "./jsonAuthority.js";
import { readResearchDatabaseSourceFile } from "./researchFiles.js";

const NOTES_DIR = "notes";
const NoteIdSchema = z.string().uuid();

export type ResearchNoteTransactionOptions = FileTransactionOptions;

export interface ResearchNoteAuthorityList {
  notes: ResearchNoteDocument[];
  issues: ResearchNoteAuthorityIssue[];
}

function notesRoot(databaseRoot: string): string {
  return assertInside(databaseRoot, path.join(databaseRoot, NOTES_DIR));
}

export function researchNoteAuthorityPath(databaseRoot: string, noteId: string): string {
  const id = NoteIdSchema.parse(noteId);
  return assertInside(databaseRoot, path.join(notesRoot(databaseRoot), `${id}.json`));
}

function evidencePassageKey(evidence: Pick<ResearchNoteEvidence, "sourceId" | "sourceRevision" | "chunkId" | "chunkHash">): string {
  return `${evidence.sourceId}:${evidence.sourceRevision}:${evidence.chunkId}:${evidence.chunkHash}`;
}

function exactTextHash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function verifyStoredEvidence(note: ResearchNote): void {
  for (const evidence of note.evidence) {
    const actualHash = exactTextHash(evidence.originalText);
    if (actualHash !== evidence.quoteHash || actualHash !== evidence.chunkHash) {
      throw new StorageError("Research Note evidence quote hash is invalid", "INVALID_DATA", {
        evidenceId: evidence.id,
        noteId: note.id,
      });
    }
  }
}

async function readNoteAuthorityAtPath(
  databaseRoot: string,
  researchDatabaseId: string,
  filePath: string,
  enforceFileIdentity = true,
): Promise<ResearchNoteDocument> {
  const authority = await readJsonAuthorityFile(
    databaseRoot,
    filePath,
    (value) => ResearchNoteSchema.parse(value),
    "Research Note authority",
  );
  const fileId = path.basename(filePath, ".json");
  if (enforceFileIdentity && authority.data.id !== fileId) {
    throw new StorageError("Research Note authority is stored under another Note ID", "INVALID_DATA", {
      actualNoteId: authority.data.id,
      fileId,
    });
  }
  if (authority.data.researchDatabaseId !== researchDatabaseId) {
    throw new StorageError("Research Note belongs to another Research Database", "INVALID_DATA", {
      actualResearchDatabaseId: authority.data.researchDatabaseId,
      noteId: authority.data.id,
      researchDatabaseId,
    });
  }
  verifyStoredEvidence(authority.data);
  return ResearchNoteDocumentSchema.parse({ note: authority.data, revision: authority.revision });
}

export async function readResearchNoteAuthorityFile(
  databaseRoot: string,
  researchDatabaseId: string,
  noteId: string,
): Promise<ResearchNoteDocument> {
  try {
    return await readNoteAuthorityAtPath(
      databaseRoot,
      researchDatabaseId,
      researchNoteAuthorityPath(databaseRoot, noteId),
    );
  } catch (error) {
    if (error instanceof StorageError && error.code === "NOT_FOUND") {
      throw new StorageError("Research Note does not exist", "NOT_FOUND", { noteId });
    }
    throw error;
  }
}

function authorityIssue(
  authorityName: string,
  noteId: string | null,
  code: ResearchNoteAuthorityIssue["code"],
  message: string,
): ResearchNoteAuthorityIssue {
  return ResearchNoteAuthorityIssueSchema.parse({
    authorityName: authorityName.slice(0, 240),
    noteId,
    code,
    message: message.slice(0, 500),
  });
}

export async function listResearchNoteAuthorityFiles(
  databaseRoot: string,
  researchDatabaseId: string,
): Promise<ResearchNoteAuthorityList> {
  let entries;
  try {
    entries = (await readdir(notesRoot(databaseRoot), { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .sort((left, right) => left.name.localeCompare(right.name, "en"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { notes: [], issues: [] };
    throw error;
  }

  const notes: ResearchNoteDocument[] = [];
  const issues: ResearchNoteAuthorityIssue[] = [];
  const seenIds = new Set<string>();
  for (const entry of entries) {
    const fileId = path.basename(entry.name, ".json");
    const parsedId = NoteIdSchema.safeParse(fileId);
    if (!parsedId.success) {
      issues.push(authorityIssue(entry.name, null, "invalid-authority", "Research Note filename is not a valid identifier."));
      continue;
    }
    try {
      const document = await readNoteAuthorityAtPath(
        databaseRoot,
        researchDatabaseId,
        assertInside(databaseRoot, path.join(notesRoot(databaseRoot), entry.name)),
        false,
      );
      const normalizedId = document.note.id.toLocaleLowerCase("en");
      if (seenIds.has(normalizedId)) {
        issues.push(authorityIssue(entry.name, document.note.id, "duplicate-id", "Research Note identifier is duplicated."));
        continue;
      }
      if (document.note.id !== parsedId.data) {
        issues.push(authorityIssue(entry.name, document.note.id, "invalid-authority", "Research Note authority is stored under another Note ID."));
        continue;
      }
      seenIds.add(normalizedId);
      notes.push(document);
    } catch (error) {
      issues.push(authorityIssue(
        entry.name,
        parsedId.data,
        "invalid-authority",
        error instanceof Error ? error.message : "Research Note authority could not be read.",
      ));
    }
  }
  notes.sort((left, right) =>
    right.note.updatedAt.localeCompare(left.note.updatedAt)
    || left.note.title.localeCompare(right.note.title, "en")
    || left.note.id.localeCompare(right.note.id, "en")
  );
  return { notes, issues };
}

async function materializeEvidence(
  databaseRoot: string,
  researchDatabaseId: string,
  capture: ResearchNoteEvidenceCaptureInput,
  capturedAt: string,
): Promise<ResearchNoteEvidence> {
  const source = await readResearchDatabaseSourceFile(databaseRoot, researchDatabaseId, capture.sourceId);
  if (source.revision !== capture.sourceRevision) {
    throw new StorageError("Research Source changed before evidence capture", "CONFLICT", {
      actualRevision: source.revision,
      expectedRevision: capture.sourceRevision,
      sourceId: capture.sourceId,
    });
  }
  if (!("content" in source)) {
    throw new StorageError("Upgrade this older Research Source before capturing evidence", "INVALID_DATA", {
      sourceId: capture.sourceId,
    });
  }
  const chunk = source.content.chunks.find((candidate) => candidate.id === capture.chunkId);
  if (!chunk || chunk.blockId !== capture.blockId || chunk.textHash !== capture.chunkHash) {
    throw new StorageError("Research passage changed before evidence capture", "CONFLICT", {
      blockId: capture.blockId,
      chunkId: capture.chunkId,
      sourceId: capture.sourceId,
    });
  }
  const block = source.content.blocks.find((candidate) => candidate.id === capture.blockId);
  if (!block) {
    throw new StorageError("Research passage block does not exist", "NOT_FOUND", {
      blockId: capture.blockId,
      sourceId: capture.sourceId,
    });
  }
  return ResearchNoteEvidenceSchema.parse({
    id: randomUUID(),
    researchDatabaseId,
    sourceId: source.source.id,
    sourceRevision: source.revision,
    sourceContentHash: source.source.contentHash,
    sourceDisplayName: source.source.displayName,
    sourceKind: source.source.kind,
    blockId: block.id,
    chunkId: chunk.id,
    chunkHash: chunk.textHash,
    originalText: chunk.text,
    quoteHash: exactTextHash(chunk.text),
    languageTag: chunk.language.languageTag,
    location: chunk.location,
    capturedAt,
  });
}

function documentFromRaw(raw: string): ResearchNoteDocument {
  const note = parseJsonAuthorityText(raw, (value) => ResearchNoteSchema.parse(value), "Research Note write verification");
  verifyStoredEvidence(note);
  return ResearchNoteDocumentSchema.parse({ note, revision: jsonAuthorityRevision(raw) });
}

function assertActive(document: ResearchNoteDocument): void {
  if (document.note.status !== "active") {
    throw new StorageError("Restore this Research Note before changing it", "INVALID_DATA", {
      noteId: document.note.id,
    });
  }
}

function assertRevision(document: ResearchNoteDocument, expectedRevision: string): void {
  if (document.revision !== expectedRevision) {
    throw new StorageError("Research Note has changed since it was opened", "CONFLICT", {
      actualRevision: document.revision,
      expectedRevision,
      noteId: document.note.id,
    });
  }
}

export async function createResearchNoteAuthorityFile(
  databaseRoot: string,
  researchDatabaseId: string,
  rawInput: CreateResearchNoteInput,
  transactionOptions: ResearchNoteTransactionOptions = {},
): Promise<ResearchNoteDocument> {
  const input = CreateResearchNoteInputSchema.parse(rawInput);
  return runSeriesFileTransaction(databaseRoot, async (commit) => {
    const id = randomUUID();
    const now = new Date().toISOString();
    const targetPath = researchNoteAuthorityPath(databaseRoot, id);
    if (await pathExists(targetPath)) {
      throw new StorageError("Research Note already exists", "CONFLICT", { noteId: id });
    }
    const evidence = await Promise.all(input.evidence.map((capture) =>
      materializeEvidence(databaseRoot, researchDatabaseId, capture, now)
    ));
    const note = ResearchNoteSchema.parse({
      schemaVersion: 1,
      id,
      researchDatabaseId,
      title: input.title,
      body: input.body,
      tags: input.tags,
      evidence,
      status: "active",
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    });
    const raw = serializeJsonAuthority(note);
    await commit([{ targetPath, content: raw }]);
    return documentFromRaw(raw);
  }, transactionOptions);
}

export async function updateResearchNoteAuthorityFile(
  databaseRoot: string,
  researchDatabaseId: string,
  noteId: string,
  rawInput: UpdateResearchNoteInput,
  transactionOptions: ResearchNoteTransactionOptions = {},
): Promise<ResearchNoteDocument> {
  const input = UpdateResearchNoteInputSchema.parse(rawInput);
  return runSeriesFileTransaction(databaseRoot, async (commit) => {
    const current = await readResearchNoteAuthorityFile(databaseRoot, researchDatabaseId, noteId);
    assertRevision(current, input.baseRevision);
    assertActive(current);
    const { baseRevision: _baseRevision, ...changes } = input;
    const updated = ResearchNoteSchema.parse({
      ...current.note,
      ...changes,
      updatedAt: new Date().toISOString(),
    });
    const raw = serializeJsonAuthority(updated);
    await commit([{ targetPath: researchNoteAuthorityPath(databaseRoot, noteId), content: raw }]);
    return documentFromRaw(raw);
  }, transactionOptions);
}

export async function appendResearchNoteEvidenceFile(
  databaseRoot: string,
  researchDatabaseId: string,
  noteId: string,
  rawInput: AppendResearchNoteEvidenceInput,
  transactionOptions: ResearchNoteTransactionOptions = {},
): Promise<ResearchNoteDocument> {
  const input = AppendResearchNoteEvidenceInputSchema.parse(rawInput);
  return runSeriesFileTransaction(databaseRoot, async (commit) => {
    const current = await readResearchNoteAuthorityFile(databaseRoot, researchDatabaseId, noteId);
    assertRevision(current, input.baseRevision);
    assertActive(current);
    if (current.note.evidence.length + input.evidence.length > MAX_RESEARCH_NOTE_EVIDENCE_ITEMS) {
      throw new StorageError("Research Note evidence limit would be exceeded", "INVALID_DATA", { noteId });
    }
    const existingKeys = new Set(current.note.evidence.map(evidencePassageKey));
    const now = new Date().toISOString();
    const appended = await Promise.all(input.evidence.map((capture) =>
      materializeEvidence(databaseRoot, researchDatabaseId, capture, now)
    ));
    if (appended.some((evidence) => existingKeys.has(evidencePassageKey(evidence)))) {
      throw new StorageError("Research Note already contains this evidence passage", "CONFLICT", { noteId });
    }
    const updated = ResearchNoteSchema.parse({
      ...current.note,
      evidence: [...current.note.evidence, ...appended],
      updatedAt: now,
    });
    const raw = serializeJsonAuthority(updated);
    await commit([{ targetPath: researchNoteAuthorityPath(databaseRoot, noteId), content: raw }]);
    return documentFromRaw(raw);
  }, transactionOptions);
}

export async function removeResearchNoteEvidenceFile(
  databaseRoot: string,
  researchDatabaseId: string,
  noteId: string,
  evidenceId: string,
  rawInput: RemoveResearchNoteEvidenceInput,
  transactionOptions: ResearchNoteTransactionOptions = {},
): Promise<ResearchNoteDocument> {
  const input = RemoveResearchNoteEvidenceInputSchema.parse(rawInput);
  const parsedEvidenceId = NoteIdSchema.parse(evidenceId);
  return runSeriesFileTransaction(databaseRoot, async (commit) => {
    const current = await readResearchNoteAuthorityFile(databaseRoot, researchDatabaseId, noteId);
    assertRevision(current, input.baseRevision);
    assertActive(current);
    if (!current.note.evidence.some((evidence) => evidence.id === parsedEvidenceId)) {
      throw new StorageError("Research Note evidence does not exist", "NOT_FOUND", { evidenceId, noteId });
    }
    if (current.note.evidence.length === 1) {
      throw new StorageError("An evidence-bound Research Note must keep at least one passage", "INVALID_DATA", { noteId });
    }
    const updated = ResearchNoteSchema.parse({
      ...current.note,
      evidence: current.note.evidence.filter((evidence) => evidence.id !== parsedEvidenceId),
      updatedAt: new Date().toISOString(),
    });
    const raw = serializeJsonAuthority(updated);
    await commit([{ targetPath: researchNoteAuthorityPath(databaseRoot, noteId), content: raw }]);
    return documentFromRaw(raw);
  }, transactionOptions);
}

async function setResearchNoteArchived(
  databaseRoot: string,
  researchDatabaseId: string,
  noteId: string,
  rawInput: ResearchNoteRevisionInput,
  status: "active" | "archived",
  transactionOptions: ResearchNoteTransactionOptions,
): Promise<ResearchNoteDocument> {
  const input = ResearchNoteRevisionInputSchema.parse(rawInput);
  return runSeriesFileTransaction(databaseRoot, async (commit) => {
    const current = await readResearchNoteAuthorityFile(databaseRoot, researchDatabaseId, noteId);
    assertRevision(current, input.baseRevision);
    if (current.note.status === status) {
      throw new StorageError(`Research Note is already ${status}`, "CONFLICT", { noteId });
    }
    const now = new Date().toISOString();
    const updated = ResearchNoteSchema.parse({
      ...current.note,
      status,
      archivedAt: status === "archived" ? now : null,
      updatedAt: now,
    });
    const raw = serializeJsonAuthority(updated);
    await commit([{ targetPath: researchNoteAuthorityPath(databaseRoot, noteId), content: raw }]);
    return documentFromRaw(raw);
  }, transactionOptions);
}

export function archiveResearchNoteAuthorityFile(
  databaseRoot: string,
  researchDatabaseId: string,
  noteId: string,
  input: ResearchNoteRevisionInput,
  transactionOptions: ResearchNoteTransactionOptions = {},
): Promise<ResearchNoteDocument> {
  return setResearchNoteArchived(databaseRoot, researchDatabaseId, noteId, input, "archived", transactionOptions);
}

export function restoreResearchNoteAuthorityFile(
  databaseRoot: string,
  researchDatabaseId: string,
  noteId: string,
  input: ResearchNoteRevisionInput,
  transactionOptions: ResearchNoteTransactionOptions = {},
): Promise<ResearchNoteDocument> {
  return setResearchNoteArchived(databaseRoot, researchDatabaseId, noteId, input, "active", transactionOptions);
}

function ownershipMismatch(error: StorageError): boolean {
  if (!error.details || typeof error.details !== "object") return false;
  return "actualResearchDatabaseId" in error.details;
}

export async function resolveResearchNoteEvidence(
  databaseRoot: string,
  researchDatabaseId: string,
  document: ResearchNoteDocument,
): Promise<ResearchNoteEvidenceResolution[]> {
  return Promise.all(document.note.evidence.map(async (evidence) => {
    try {
      const source = await readResearchDatabaseSourceFile(databaseRoot, researchDatabaseId, evidence.sourceId);
      const common = {
        evidence,
        modelUse: source.source.aiPermission === "never" ? "forbidden" as const : "allowed" as const,
        currentSourceRevision: source.revision,
        currentSourceDisplayName: source.source.displayName,
      };
      if (!("content" in source)) {
        return ResearchNoteEvidenceResolutionSchema.parse({ ...common, freshness: "unreadable" });
      }
      const chunk = source.content.chunks.find((candidate) => candidate.id === evidence.chunkId);
      const exactPassage = Boolean(
        chunk
        && chunk.blockId === evidence.blockId
        && chunk.textHash === evidence.chunkHash
        && chunk.text === evidence.originalText
        && exactTextHash(chunk.text) === evidence.quoteHash
        && isDeepStrictEqual(chunk.location, evidence.location)
      );
      return ResearchNoteEvidenceResolutionSchema.parse({
        ...common,
        freshness: exactPassage
          ? source.revision === evidence.sourceRevision ? "current" : "source-revision-changed"
          : "passage-changed",
      });
    } catch (error) {
      const freshness = error instanceof StorageError && error.code === "NOT_FOUND"
        ? "source-missing"
        : error instanceof StorageError && ownershipMismatch(error)
          ? "ownership-mismatch"
          : "unreadable";
      return ResearchNoteEvidenceResolutionSchema.parse({
        evidence,
        freshness,
        modelUse: "unknown",
        currentSourceRevision: null,
        currentSourceDisplayName: null,
      });
    }
  }));
}

export function researchNoteFreshnessCounts(
  evidence: ResearchNoteEvidenceResolution[],
): ResearchNoteFreshnessCounts {
  return ResearchNoteFreshnessCountsSchema.parse({
    current: evidence.filter((item) => item.freshness === "current").length,
    sourceRevisionChanged: evidence.filter((item) => item.freshness === "source-revision-changed").length,
    passageChanged: evidence.filter((item) => item.freshness === "passage-changed").length,
    sourceMissing: evidence.filter((item) => item.freshness === "source-missing").length,
    unreadable: evidence.filter((item) => item.freshness === "unreadable").length,
    ownershipMismatch: evidence.filter((item) => item.freshness === "ownership-mismatch").length,
    modelUseForbidden: evidence.filter((item) => item.modelUse === "forbidden").length,
  });
}

export async function readResearchNoteDetail(
  databaseRoot: string,
  researchDatabaseId: string,
  noteId: string,
): Promise<ResearchNoteDetail> {
  const document = await readResearchNoteAuthorityFile(databaseRoot, researchDatabaseId, noteId);
  return ResearchNoteDetailSchema.parse({
    ...document,
    evidence: await resolveResearchNoteEvidence(databaseRoot, researchDatabaseId, document),
  });
}
