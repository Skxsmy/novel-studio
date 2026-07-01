import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import {
  WorkshopBranchSchema,
  WorkshopContextBasketSchema,
  WorkshopMessageSchema,
  WorkshopSessionSchema,
  type WorkshopBranch,
  type WorkshopContextBasket,
  type WorkshopMessage,
  type WorkshopSession,
} from "@novel-studio/contracts";
import { StorageError } from "./errors.js";
import { assertInside, pathExists } from "./fileSystem.js";
import { readJsonAuthorityFile, writeJsonAuthorityFile } from "./jsonAuthority.js";

const WORKSHOP_DIR = "workshop";
const SESSIONS_DIR = "sessions";
const BRANCHES_DIR = "branches";
const MESSAGES_DIR = "messages";
const CONTEXT_BASKETS_DIR = "context-baskets";

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

function contextBasketsRoot(seriesRoot: string): string {
  return assertInside(seriesRoot, path.join(workshopRoot(seriesRoot), CONTEXT_BASKETS_DIR));
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

export function workshopContextBasketPath(seriesRoot: string, sessionId: string): string {
  return assertInside(seriesRoot, path.join(contextBasketsRoot(seriesRoot), `${sessionId}.json`));
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
  const document = await writeJsonAuthorityFile(
    seriesRoot,
    workshopMessagePath(seriesRoot, message.id),
    message,
    (value) => WorkshopMessageSchema.parse(value),
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
  await mkdir(contextBasketsRoot(seriesRoot), { recursive: true });
  const document = await writeJsonAuthorityFile(
    seriesRoot,
    workshopContextBasketPath(seriesRoot, basket.sessionId),
    basket,
    (value) => WorkshopContextBasketSchema.parse(value),
  );
  return document.data;
}
