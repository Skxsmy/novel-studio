import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import {
  ProposalSchema,
  ProposalSnapshotSchema,
  type Proposal,
  type ProposalSnapshot,
  type ProposalStorageDiagnostic,
} from "@novel-studio/contracts";
import { StorageError } from "./errors.js";
import { assertInside, pathExists } from "./fileSystem.js";
import { readJsonAuthorityFile, writeJsonAuthorityFile } from "./jsonAuthority.js";

const STUDIO_DIR = ".studio";
const INBOX_DIR = "inbox";
const PROPOSALS_DIR = "proposals";
const HISTORY_DIR = "history";
const SNAPSHOTS_DIR = "proposal-snapshots";

export interface ProposalAuthorityFile {
  proposal: Proposal;
  revision: string;
  filePath: string;
}

export interface ProposalAuthorityList {
  files: ProposalAuthorityFile[];
  diagnostics: ProposalStorageDiagnostic[];
}

function proposalsRoot(seriesRoot: string): string {
  return assertInside(
    seriesRoot,
    path.join(seriesRoot, STUDIO_DIR, INBOX_DIR, PROPOSALS_DIR),
  );
}

function snapshotsRoot(seriesRoot: string): string {
  return assertInside(seriesRoot, path.join(seriesRoot, STUDIO_DIR, HISTORY_DIR, SNAPSHOTS_DIR));
}

export function proposalAuthorityPath(seriesRoot: string, proposalId: string): string {
  return assertInside(seriesRoot, path.join(proposalsRoot(seriesRoot), `${proposalId}.json`));
}

export function proposalSnapshotPath(seriesRoot: string, snapshotId: string): string {
  return assertInside(seriesRoot, path.join(snapshotsRoot(seriesRoot), `${snapshotId}.json`));
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

async function readProposalFile(filePath: string): Promise<ProposalAuthorityFile> {
  const document = await readJsonAuthorityFile(
    path.dirname(filePath),
    filePath,
    (value) => ProposalSchema.parse(value),
    "Proposal authority file",
  );
  return {
    proposal: document.data,
    revision: document.revision,
    filePath: document.filePath,
  };
}

export async function listProposalAuthorityFiles(seriesRoot: string): Promise<ProposalAuthorityList> {
  const files: ProposalAuthorityFile[] = [];
  const diagnostics: ProposalStorageDiagnostic[] = [];
  const seen = new Set<string>();

  for (const filePath of await listJsonFiles(proposalsRoot(seriesRoot))) {
    const fileName = path.basename(filePath);
    try {
      const document = await readProposalFile(filePath);
      const expectedId = path.basename(filePath, ".json");
      if (document.proposal.id !== expectedId) {
        diagnostics.push({
          fileName,
          code: "ID_MISMATCH",
          message: "Proposal file name does not match Proposal id",
        });
        continue;
      }
      if (seen.has(document.proposal.id)) {
        diagnostics.push({
          fileName,
          code: "DUPLICATE_ID",
          message: "Multiple Proposal files contain the same id",
        });
        continue;
      }
      seen.add(document.proposal.id);
      files.push(document);
    } catch (error) {
      if (error instanceof StorageError && error.code === "INVALID_DATA") {
        diagnostics.push({
          fileName,
          code: error.code,
          message: error.message,
        });
        continue;
      }
      throw error;
    }
  }

  files.sort((left, right) => right.proposal.updatedAt.localeCompare(left.proposal.updatedAt));
  return { files, diagnostics };
}

export async function readProposalAuthorityFile(
  seriesRoot: string,
  proposalId: string,
): Promise<ProposalAuthorityFile> {
  try {
    return await readProposalFile(proposalAuthorityPath(seriesRoot, proposalId));
  } catch (error) {
    if (error instanceof StorageError && error.code === "NOT_FOUND") {
      throw new StorageError("Proposal does not exist", "NOT_FOUND", { proposalId });
    }
    throw error;
  }
}

export async function createProposalAuthorityFile(
  seriesRoot: string,
  proposal: Proposal,
): Promise<ProposalAuthorityFile> {
  const parsed = ProposalSchema.parse(proposal);
  const filePath = proposalAuthorityPath(seriesRoot, parsed.id);
  if (await pathExists(filePath)) {
    throw new StorageError("Proposal already exists", "INVALID_DATA", { proposalId: parsed.id });
  }
  await mkdir(proposalsRoot(seriesRoot), { recursive: true });
  return writeProposalAuthorityFile(seriesRoot, parsed);
}

export async function writeProposalAuthorityFile(
  seriesRoot: string,
  proposal: Proposal,
): Promise<ProposalAuthorityFile> {
  const parsed = ProposalSchema.parse(proposal);
  const document = await writeJsonAuthorityFile(
    seriesRoot,
    proposalAuthorityPath(seriesRoot, parsed.id),
    parsed,
    (value) => ProposalSchema.parse(value),
  );
  return {
    proposal: document.data,
    revision: document.revision,
    filePath: document.filePath,
  };
}

export async function createProposalSnapshotFile(
  seriesRoot: string,
  snapshot: ProposalSnapshot,
): Promise<ProposalSnapshot> {
  const parsed = ProposalSnapshotSchema.parse(snapshot);
  const filePath = proposalSnapshotPath(seriesRoot, parsed.id);
  if (await pathExists(filePath)) {
    throw new StorageError("Proposal snapshot already exists", "INVALID_DATA", {
      snapshotId: parsed.id,
    });
  }
  await mkdir(snapshotsRoot(seriesRoot), { recursive: true });
  const document = await writeJsonAuthorityFile(
    seriesRoot,
    filePath,
    parsed,
    (value) => ProposalSnapshotSchema.parse(value),
  );
  return document.data;
}
