import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { StorageError } from "./errors.js";
import { assertInside, atomicWrite, flushDirectory, pathExists, writeFileDurably } from "./fileSystem.js";

export interface FileMutation {
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

const TransactionEntrySchema = z.object({
  target: z.string().min(1),
  temporary: z.string().min(1).nullable(),
  backup: z.string().min(1),
  hadOriginal: z.boolean(),
  delete: z.boolean(),
});

const TransactionJournalSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["prepared", "committing", "committed"]),
  entries: z.array(TransactionEntrySchema),
});

async function quarantineMalformedJournal(
  journalPath: string,
  cause: unknown,
): Promise<never> {
  const quarantinedPath = `${journalPath}.invalid`;
  await rename(journalPath, quarantinedPath).catch(() => undefined);
  throw new StorageError("Transaction journal is malformed", "INVALID_DATA", {
    journalPath,
    quarantinedPath,
    cause: cause instanceof Error ? cause.message : String(cause),
  });
}

async function readTransactionJournal(journalPath: string): Promise<TransactionJournal> {
  try {
    return TransactionJournalSchema.parse(JSON.parse(await readFile(journalPath, "utf8")));
  } catch (error) {
    return quarantineMalformedJournal(journalPath, error);
  }
}

export async function recoverFileTransactions(seriesRoot: string): Promise<void> {
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
    const journal = await readTransactionJournal(journalPath);
    const targets = new Set<string>();
    for (const entry of journal.entries) {
      if (targets.has(entry.target)) {
        await quarantineMalformedJournal(
          journalPath,
          new Error(`Duplicate transaction target: ${entry.target}`),
        );
      }
      targets.add(entry.target);
    }
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

export async function applyFileTransaction(
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
      await writeFileDurably(temporary, mutation.content, "wx");
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
    await Promise.all([...new Set(entries.map((entry) => path.dirname(path.join(seriesRoot, entry.target))))].map(
      (directory) => flushDirectory(directory),
    ));
    await writeJournal("committed");
    await Promise.all(entries.map((entry) => rm(path.join(seriesRoot, entry.backup), { force: true })));
    await rm(journalPath, { force: true });
  } catch (error) {
    await recoverFileTransactions(seriesRoot);
    throw error;
  }
}
