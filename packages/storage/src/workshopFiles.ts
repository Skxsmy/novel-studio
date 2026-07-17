import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  WorkshopAgentRunSchema,
  WorkshopAgentRunAuthoritySchema,
  WorkshopAuthorityV2MigrationBackupSchema,
  WorkshopAuthorityV2MigrationResultSchema,
  WorkshopBranchSchema,
  WorkshopContextBasketSchema,
  WorkshopContextBasketAuthoritySchema,
  WorkshopMessageAttachmentSchema,
  WorkshopMessageAuthoritySchema,
  WorkshopMessageSchema,
  RollbackWorkshopAuthorityV2MigrationResultSchema,
  WorkshopSessionSchema,
  type WorkshopAgentRun,
  type WorkshopAgentRunDiagnostic,
  type WorkshopAgentRunDocument,
  type WorkshopAuthorityV2MigrationBackup,
  type WorkshopAuthorityV2MigrationResult,
  type WorkshopBranch,
  type WorkshopContextBasket,
  type WorkshopMessageAttachment,
  type WorkshopMessage,
  type WorkshopSession,
  type RollbackWorkshopAuthorityV2MigrationResult,
} from "@novel-studio/contracts";
import { StorageError } from "./errors.js";
import { runSeriesFileTransaction } from "./fileTransactions.js";
import { assertInside, pathExists } from "./fileSystem.js";
import {
  jsonAuthorityRevision,
  parseJsonAuthorityText,
  readJsonAuthorityFile,
  serializeJsonAuthority,
  writeJsonAuthorityFile,
} from "./jsonAuthority.js";

const WORKSHOP_DIR = "workshop";
const SESSIONS_DIR = "sessions";
const BRANCHES_DIR = "branches";
const MESSAGES_DIR = "messages";
const ATTACHMENTS_DIR = "attachments";
const CONTEXT_BASKETS_DIR = "context-baskets";
const AGENT_RUNS_DIR = "agent-runs";
const MIGRATIONS_DIR = "migrations";

function workshopRoot(seriesRoot: string): string {
  return assertInside(seriesRoot, path.join(seriesRoot, WORKSHOP_DIR));
}

function sessionsRoot(seriesRoot: string): string {
  return assertInside(seriesRoot, path.join(workshopRoot(seriesRoot), SESSIONS_DIR));
}

function branchesRoot(seriesRoot: string): string {
  return assertInside(seriesRoot, path.join(workshopRoot(seriesRoot), BRANCHES_DIR));
}

function messagesRoot(seriesRoot: string): string {
  return assertInside(seriesRoot, path.join(workshopRoot(seriesRoot), MESSAGES_DIR));
}

function attachmentsRoot(seriesRoot: string): string {
  return assertInside(seriesRoot, path.join(workshopRoot(seriesRoot), ATTACHMENTS_DIR));
}

function contextBasketsRoot(seriesRoot: string): string {
  return assertInside(seriesRoot, path.join(workshopRoot(seriesRoot), CONTEXT_BASKETS_DIR));
}

function agentRunsRoot(seriesRoot: string): string {
  return assertInside(seriesRoot, path.join(workshopRoot(seriesRoot), AGENT_RUNS_DIR));
}

function migrationsRoot(seriesRoot: string): string {
  return assertInside(seriesRoot, path.join(workshopRoot(seriesRoot), MIGRATIONS_DIR));
}

function workshopAuthorityMigrationBackupPath(seriesRoot: string, migrationId: string): string {
  return assertInside(
    seriesRoot,
    path.join(migrationsRoot(seriesRoot), `adr-0017-${migrationId}.json`),
  );
}

export function workshopSessionPath(seriesRoot: string, sessionId: string): string {
  return assertInside(seriesRoot, path.join(sessionsRoot(seriesRoot), `${sessionId}.json`));
}

export function workshopBranchPath(seriesRoot: string, branchId: string): string {
  return assertInside(seriesRoot, path.join(branchesRoot(seriesRoot), `${branchId}.json`));
}

export function workshopMessagePath(seriesRoot: string, messageId: string): string {
  return assertInside(seriesRoot, path.join(messagesRoot(seriesRoot), `${messageId}.json`));
}

export function workshopAttachmentPath(seriesRoot: string, attachmentId: string): string {
  return assertInside(seriesRoot, path.join(attachmentsRoot(seriesRoot), `${attachmentId}.json`));
}

export function workshopContextBasketPath(seriesRoot: string, sessionId: string): string {
  return assertInside(seriesRoot, path.join(contextBasketsRoot(seriesRoot), `${sessionId}.json`));
}

export function workshopAgentRunPath(seriesRoot: string, runId: string): string {
  return assertInside(seriesRoot, path.join(agentRunsRoot(seriesRoot), `${runId}.json`));
}

async function listJsonFiles(directory: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(directory, entry.name))
    .sort();
}

async function readSessionFile(filePath: string): Promise<WorkshopSession> {
  const document = await readJsonAuthorityFile(
    path.dirname(filePath),
    filePath,
    (value) => WorkshopSessionSchema.parse(value),
    "Workshop session file",
  );
  return document.data;
}
async function readBranchFile(filePath: string): Promise<WorkshopBranch> {
  const document = await readJsonAuthorityFile(
    path.dirname(filePath),
    filePath,
    (value) => WorkshopBranchSchema.parse(value),
    "Workshop branch file",
  );
  return document.data;
}

async function readMessageFile(filePath: string): Promise<WorkshopMessage> {
  const document = await readJsonAuthorityFile(
    path.dirname(filePath),
    filePath,
    (value) => WorkshopMessageSchema.parse(value),
    "Workshop message file",
  );
  return document.data;
}

async function readAttachmentFile(filePath: string): Promise<WorkshopMessageAttachment> {
  const document = await readJsonAuthorityFile(
    path.dirname(filePath),
    filePath,
    (value) => WorkshopMessageAttachmentSchema.parse(value),
    "Workshop message attachment file",
  );
  return document.data;
}

async function readAgentRunFile(filePath: string): Promise<WorkshopAgentRunDocument> {
  const document = await readJsonAuthorityFile(
    path.dirname(filePath),
    filePath,
    (value) => WorkshopAgentRunSchema.parse(value),
    "Workshop Agent run file",
  );
  return { run: document.data, revision: document.revision };
}

export async function listWorkshopAgentRunFiles(
  seriesRoot: string,
  sessionId?: string,
): Promise<{ runs: WorkshopAgentRunDocument[]; diagnostics: WorkshopAgentRunDiagnostic[] }> {
  const runs: WorkshopAgentRunDocument[] = [];
  const diagnostics: WorkshopAgentRunDiagnostic[] = [];
  for (const filePath of await listJsonFiles(agentRunsRoot(seriesRoot))) {
    try {
      const document = await readAgentRunFile(filePath);
      if (!sessionId || document.run.sessionId === sessionId) runs.push(document);
    } catch (error) {
      diagnostics.push({
        fileName: path.basename(filePath),
        code: error instanceof StorageError ? error.code : "UNKNOWN",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  runs.sort((left, right) => left.run.createdAt.localeCompare(right.run.createdAt));
  return { runs, diagnostics };
}

export async function readWorkshopAgentRunFile(
  seriesRoot: string,
  runId: string,
): Promise<WorkshopAgentRunDocument> {
  try {
    return await readAgentRunFile(workshopAgentRunPath(seriesRoot, runId));
  } catch (error) {
    if (error instanceof StorageError && error.code === "NOT_FOUND") {
      throw new StorageError("Workshop Agent run does not exist", "NOT_FOUND", { runId });
    }
    throw error;
  }
}

export async function createWorkshopAgentRunFile(
  seriesRoot: string,
  run: WorkshopAgentRun,
): Promise<WorkshopAgentRunDocument> {
  const parsed = WorkshopAgentRunSchema.parse(run);
  const filePath = workshopAgentRunPath(seriesRoot, parsed.id);
  if (await pathExists(filePath)) {
    throw new StorageError("Workshop Agent run already exists", "INVALID_DATA", { runId: parsed.id });
  }
  await mkdir(agentRunsRoot(seriesRoot), { recursive: true });
  return writeWorkshopAgentRunFile(seriesRoot, parsed);
}

export async function writeWorkshopAgentRunFile(
  seriesRoot: string,
  run: WorkshopAgentRun,
): Promise<WorkshopAgentRunDocument> {
  return runSeriesFileTransaction(seriesRoot, async () => {
    const document = await writeJsonAuthorityFile(
      seriesRoot,
      workshopAgentRunPath(seriesRoot, run.id),
      run,
      (value) => WorkshopAgentRunSchema.parse(value),
    );
    return { run: document.data, revision: document.revision };
  });
}

export async function migrateWorkshopAuthorityToV2(
  seriesRoot: string,
  seriesId: string,
): Promise<WorkshopAuthorityV2MigrationResult> {
  return runSeriesFileTransaction(seriesRoot, async (commit) => {
  const migrationId = randomUUID();
  const documents: WorkshopAuthorityV2MigrationBackup["documents"] = [];
  const mutations: Array<{ targetPath: string; content: string }> = [];
  const seenMessageIds = new Set<string>();
  const seenRunIds = new Set<string>();
  const seenContextBasketIds = new Set<string>();

  for (const filePath of await listJsonFiles(messagesRoot(seriesRoot))) {
    const raw = await readFile(filePath, "utf8");
    const authority = parseJsonAuthorityText(
      raw,
      (value) => WorkshopMessageAuthoritySchema.parse(value),
      "Workshop message migration source",
    );
    const fileId = path.basename(filePath, ".json");
    if (authority.id !== fileId || seenMessageIds.has(authority.id)) {
      throw new StorageError("Workshop message migration found an invalid or duplicate identity", "INVALID_DATA", {
        fileName: path.basename(filePath),
        messageId: authority.id,
      });
    }
    seenMessageIds.add(authority.id);
    if (authority.seriesId !== seriesId) {
      throw new StorageError("Workshop message migration found another Series identity", "INVALID_DATA", {
        messageId: authority.id,
      });
    }
    if (authority.schemaVersion !== 1) continue;
    const migratedRaw = serializeJsonAuthority(WorkshopMessageSchema.parse(authority));
    documents.push({
      kind: "message",
      id: authority.id,
      relativePath: path.posix.join(WORKSHOP_DIR, MESSAGES_DIR, `${authority.id}.json`),
      raw,
      revision: jsonAuthorityRevision(raw),
      migratedRevision: jsonAuthorityRevision(migratedRaw),
    });
    mutations.push({ targetPath: filePath, content: migratedRaw });
  }

  for (const filePath of await listJsonFiles(agentRunsRoot(seriesRoot))) {
    const raw = await readFile(filePath, "utf8");
    const authority = parseJsonAuthorityText(
      raw,
      (value) => WorkshopAgentRunAuthoritySchema.parse(value),
      "Workshop Agent run migration source",
    );
    const fileId = path.basename(filePath, ".json");
    if (authority.id !== fileId || seenRunIds.has(authority.id)) {
      throw new StorageError("Workshop Agent run migration found an invalid or duplicate identity", "INVALID_DATA", {
        fileName: path.basename(filePath),
        runId: authority.id,
      });
    }
    seenRunIds.add(authority.id);
    if (authority.seriesId !== seriesId) {
      throw new StorageError("Workshop Agent run migration found another Series identity", "INVALID_DATA", {
        runId: authority.id,
      });
    }
    if (authority.schemaVersion !== 1) continue;
    const migratedRaw = serializeJsonAuthority(WorkshopAgentRunSchema.parse(authority));
    documents.push({
      kind: "agent-run",
      id: authority.id,
      relativePath: path.posix.join(WORKSHOP_DIR, AGENT_RUNS_DIR, `${authority.id}.json`),
      raw,
      revision: jsonAuthorityRevision(raw),
      migratedRevision: jsonAuthorityRevision(migratedRaw),
    });
    mutations.push({ targetPath: filePath, content: migratedRaw });
  }

  for (const filePath of await listJsonFiles(contextBasketsRoot(seriesRoot))) {
    const raw = await readFile(filePath, "utf8");
    const authority = parseJsonAuthorityText(
      raw,
      (value) => WorkshopContextBasketAuthoritySchema.parse(value),
      "Workshop context basket migration source",
    );
    const fileId = path.basename(filePath, ".json");
    if (authority.sessionId !== fileId || seenContextBasketIds.has(authority.id)) {
      throw new StorageError("Workshop context basket migration found an invalid or duplicate identity", "INVALID_DATA", {
        fileName: path.basename(filePath),
        basketId: authority.id,
      });
    }
    seenContextBasketIds.add(authority.id);
    if (authority.seriesId !== seriesId) {
      throw new StorageError("Workshop context basket migration found another Series identity", "INVALID_DATA", {
        basketId: authority.id,
      });
    }
    if (authority.schemaVersion !== 1) continue;
    const migratedRaw = serializeJsonAuthority(WorkshopContextBasketSchema.parse(authority));
    documents.push({
      kind: "context-basket",
      id: authority.id,
      relativePath: path.posix.join(WORKSHOP_DIR, CONTEXT_BASKETS_DIR, `${authority.sessionId}.json`),
      raw,
      revision: jsonAuthorityRevision(raw),
      migratedRevision: jsonAuthorityRevision(migratedRaw),
    });
    mutations.push({ targetPath: filePath, content: migratedRaw });
  }

  const backup = WorkshopAuthorityV2MigrationBackupSchema.parse({
    schemaVersion: 1,
    migrationId,
    seriesId,
    createdAt: new Date().toISOString(),
    documents,
  });
  await mkdir(migrationsRoot(seriesRoot), { recursive: true });
  await commit([{
    targetPath: workshopAuthorityMigrationBackupPath(seriesRoot, migrationId),
    content: serializeJsonAuthority(backup),
  }, ...mutations]);
  return WorkshopAuthorityV2MigrationResultSchema.parse({
    migrationId,
    migratedMessageIds: documents.filter((document) => document.kind === "message").map((document) => document.id),
    migratedAgentRunIds: documents.filter((document) => document.kind === "agent-run").map((document) => document.id),
    migratedContextBasketIds: documents.filter((document) => document.kind === "context-basket").map((document) => document.id),
  });
  });
}

export async function rollbackWorkshopAuthorityV2Migration(
  seriesRoot: string,
  seriesId: string,
  migrationId: string,
): Promise<RollbackWorkshopAuthorityV2MigrationResult> {
  return runSeriesFileTransaction(seriesRoot, async (commit) => {
  const backupPath = workshopAuthorityMigrationBackupPath(seriesRoot, migrationId);
  let rawBackup: string;
  try {
    rawBackup = await readFile(backupPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new StorageError("Workshop authority migration backup does not exist", "NOT_FOUND", { migrationId });
    }
    throw error;
  }
  const backup = parseJsonAuthorityText(
    rawBackup,
    (value) => WorkshopAuthorityV2MigrationBackupSchema.parse(value),
    "Workshop authority migration backup",
  );
  if (backup.migrationId !== migrationId || backup.seriesId !== seriesId) {
    throw new StorageError("Workshop authority migration backup identity does not match", "INVALID_DATA", {
      migrationId,
    });
  }

  const mutations: Array<{ targetPath: string; content: string }> = [];
  for (const document of backup.documents) {
    const directory = document.kind === "message"
      ? MESSAGES_DIR
      : document.kind === "agent-run" ? AGENT_RUNS_DIR : CONTEXT_BASKETS_DIR;
    if (jsonAuthorityRevision(document.raw) !== document.revision) {
      throw new StorageError("Workshop authority migration backup document is invalid", "INVALID_DATA", {
        migrationId,
        documentId: document.id,
      });
    }
    const original = document.kind === "message"
      ? parseJsonAuthorityText(document.raw, (value) => WorkshopMessageAuthoritySchema.parse(value), "Workshop message rollback source")
      : document.kind === "agent-run"
        ? parseJsonAuthorityText(document.raw, (value) => WorkshopAgentRunAuthoritySchema.parse(value), "Workshop Agent run rollback source")
        : parseJsonAuthorityText(document.raw, (value) => WorkshopContextBasketAuthoritySchema.parse(value), "Workshop context basket rollback source");
    if (original.schemaVersion !== 1 || original.id !== document.id) {
      throw new StorageError("Workshop authority rollback source is not exact version 1 authority", "INVALID_DATA", {
        migrationId,
        documentId: document.id,
      });
    }
    const fileId = document.kind === "context-basket" ? original.sessionId : document.id;
    const expectedRelativePath = path.posix.join(WORKSHOP_DIR, directory, `${fileId}.json`);
    if (document.relativePath !== expectedRelativePath) {
      throw new StorageError("Workshop authority migration backup document is invalid", "INVALID_DATA", {
        migrationId,
        documentId: document.id,
      });
    }
    const targetPath = document.kind === "message"
      ? workshopMessagePath(seriesRoot, document.id)
      : document.kind === "agent-run"
        ? workshopAgentRunPath(seriesRoot, document.id)
        : workshopContextBasketPath(seriesRoot, original.sessionId);
    let currentRaw: string;
    try {
      currentRaw = await readFile(targetPath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new StorageError("Workshop authority changed after migration", "CONFLICT", {
          migrationId,
          documentId: document.id,
          currentRevision: null,
        });
      }
      throw error;
    }
    if (jsonAuthorityRevision(currentRaw) !== document.migratedRevision) {
      throw new StorageError("Workshop authority changed after migration", "CONFLICT", {
        migrationId,
        documentId: document.id,
        currentRevision: jsonAuthorityRevision(currentRaw),
      });
    }
    mutations.push({ targetPath, content: document.raw });
  }
  await commit(mutations);
  return RollbackWorkshopAuthorityV2MigrationResultSchema.parse({
    migrationId,
    restoredMessageIds: backup.documents.filter((document) => document.kind === "message").map((document) => document.id),
    restoredAgentRunIds: backup.documents.filter((document) => document.kind === "agent-run").map((document) => document.id),
    restoredContextBasketIds: backup.documents.filter((document) => document.kind === "context-basket").map((document) => document.id),
  });
  });
}

export async function listWorkshopSessionFiles(seriesRoot: string): Promise<WorkshopSession[]> {
  const sessions = await Promise.all((await listJsonFiles(sessionsRoot(seriesRoot))).map(readSessionFile));
  return sessions.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function readWorkshopSessionFile(
  seriesRoot: string,
  sessionId: string,
): Promise<WorkshopSession> {
  try {
    return await readSessionFile(workshopSessionPath(seriesRoot, sessionId));
  } catch (error) {
    if (error instanceof StorageError && error.code === "NOT_FOUND") {
      throw new StorageError("Workshop session does not exist", "NOT_FOUND", { sessionId });
    }
    throw error;
  }
}

export async function createWorkshopSessionFile(
  seriesRoot: string,
  session: WorkshopSession,
): Promise<WorkshopSession> {
  const parsed = WorkshopSessionSchema.parse(session);
  const filePath = workshopSessionPath(seriesRoot, parsed.id);
  if (await pathExists(filePath)) {
    throw new StorageError("Workshop session already exists", "INVALID_DATA", {
      sessionId: parsed.id,
    });
  }
  await mkdir(sessionsRoot(seriesRoot), { recursive: true });
  return writeWorkshopSessionFile(seriesRoot, parsed);
}

export async function writeWorkshopSessionFile(
  seriesRoot: string,
  session: WorkshopSession,
): Promise<WorkshopSession> {
  const document = await writeJsonAuthorityFile(
    seriesRoot,
    workshopSessionPath(seriesRoot, session.id),
    session,
    (value) => WorkshopSessionSchema.parse(value),
  );
  return document.data;
}

export async function listWorkshopBranchFiles(seriesRoot: string): Promise<WorkshopBranch[]> {
  const branches = await Promise.all((await listJsonFiles(branchesRoot(seriesRoot))).map(readBranchFile));
  return branches.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function createWorkshopBranchFile(
  seriesRoot: string,
  branch: WorkshopBranch,
): Promise<WorkshopBranch> {
  const parsed = WorkshopBranchSchema.parse(branch);
  const filePath = workshopBranchPath(seriesRoot, parsed.id);
  if (await pathExists(filePath)) {
    throw new StorageError("Workshop branch already exists", "INVALID_DATA", { branchId: parsed.id });
  }
  await mkdir(branchesRoot(seriesRoot), { recursive: true });
  const document = await writeJsonAuthorityFile(
    seriesRoot,
    filePath,
    parsed,
    (value) => WorkshopBranchSchema.parse(value),
  );
  return document.data;
}

export async function listWorkshopMessageFiles(
  seriesRoot: string,
  sessionId: string,
): Promise<WorkshopMessage[]> {
  const messages = await Promise.all((await listJsonFiles(messagesRoot(seriesRoot))).map(readMessageFile));
  return messages
    .filter((message) => message.sessionId === sessionId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function readWorkshopMessageFile(
  seriesRoot: string,
  messageId: string,
): Promise<WorkshopMessage> {
  try {
    return await readMessageFile(workshopMessagePath(seriesRoot, messageId));
  } catch (error) {
    if (error instanceof StorageError && error.code === "NOT_FOUND") {
      throw new StorageError("Workshop message does not exist", "NOT_FOUND", { messageId });
    }
    throw error;
  }
}

export async function createWorkshopMessageFile(
  seriesRoot: string,
  message: WorkshopMessage,
): Promise<WorkshopMessage> {
  const parsed = WorkshopMessageSchema.parse(message);
  const filePath = workshopMessagePath(seriesRoot, parsed.id);
  if (await pathExists(filePath)) {
    throw new StorageError("Workshop message already exists", "INVALID_DATA", {
      messageId: parsed.id,
    });
  }
  await mkdir(messagesRoot(seriesRoot), { recursive: true });
  const document = await writeJsonAuthorityFile(
    seriesRoot,
    filePath,
    parsed,
    (value) => WorkshopMessageSchema.parse(value),
  );
  return document.data;
}

export async function writeWorkshopMessageFile(
  seriesRoot: string,
  message: WorkshopMessage,
): Promise<WorkshopMessage> {
  return runSeriesFileTransaction(seriesRoot, async () => {
    const document = await writeJsonAuthorityFile(
      seriesRoot,
      workshopMessagePath(seriesRoot, message.id),
      message,
      (value) => WorkshopMessageSchema.parse(value),
    );
    return document.data;
  });
}

export async function listWorkshopAttachmentFiles(
  seriesRoot: string,
  sessionId?: string,
): Promise<WorkshopMessageAttachment[]> {
  const attachments = await Promise.all(
    (await listJsonFiles(attachmentsRoot(seriesRoot))).map(readAttachmentFile),
  );
  return attachments
    .filter((attachment) => !sessionId || attachment.sessionId === sessionId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function readWorkshopAttachmentFile(
  seriesRoot: string,
  attachmentId: string,
): Promise<WorkshopMessageAttachment> {
  try {
    return await readAttachmentFile(workshopAttachmentPath(seriesRoot, attachmentId));
  } catch (error) {
    if (error instanceof StorageError && error.code === "NOT_FOUND") {
      throw new StorageError("Workshop message attachment does not exist", "NOT_FOUND", { attachmentId });
    }
    throw error;
  }
}

export async function createWorkshopAttachmentFile(
  seriesRoot: string,
  attachment: WorkshopMessageAttachment,
): Promise<WorkshopMessageAttachment> {
  const parsed = WorkshopMessageAttachmentSchema.parse(attachment);
  const filePath = workshopAttachmentPath(seriesRoot, parsed.id);
  if (await pathExists(filePath)) {
    throw new StorageError("Workshop message attachment already exists", "INVALID_DATA", {
      attachmentId: parsed.id,
    });
  }
  await mkdir(attachmentsRoot(seriesRoot), { recursive: true });
  const document = await writeJsonAuthorityFile(
    seriesRoot,
    filePath,
    parsed,
    (value) => WorkshopMessageAttachmentSchema.parse(value),
  );
  return document.data;
}

export async function writeWorkshopAttachmentFile(
  seriesRoot: string,
  attachment: WorkshopMessageAttachment,
): Promise<WorkshopMessageAttachment> {
  const document = await writeJsonAuthorityFile(
    seriesRoot,
    workshopAttachmentPath(seriesRoot, attachment.id),
    attachment,
    (value) => WorkshopMessageAttachmentSchema.parse(value),
  );
  return document.data;
}

export async function readWorkshopContextBasketFile(
  seriesRoot: string,
  sessionId: string,
): Promise<WorkshopContextBasket> {
  try {
    const document = await readJsonAuthorityFile(
      path.dirname(workshopContextBasketPath(seriesRoot, sessionId)),
      workshopContextBasketPath(seriesRoot, sessionId),
      (value) => WorkshopContextBasketSchema.parse(value),
      "Workshop context basket file",
    );
    return document.data;
  } catch (error) {
    if (error instanceof StorageError && error.code === "NOT_FOUND") {
      throw new StorageError("Workshop context basket does not exist", "NOT_FOUND", { sessionId });
    }
    throw error;
  }
}

export async function writeWorkshopContextBasketFile(
  seriesRoot: string,
  basket: WorkshopContextBasket,
): Promise<WorkshopContextBasket> {
  return runSeriesFileTransaction(seriesRoot, async () => {
    await mkdir(contextBasketsRoot(seriesRoot), { recursive: true });
    const document = await writeJsonAuthorityFile(
      seriesRoot,
      workshopContextBasketPath(seriesRoot, basket.sessionId),
      basket,
      (value) => WorkshopContextBasketSchema.parse(value),
    );
    return document.data;
  });
}
