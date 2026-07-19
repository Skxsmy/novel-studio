import path from "node:path";
import {
  ResearchQueryExpansionDocumentSchema,
  ResearchQueryExpansionSetSchema,
  UpdateResearchQueryExpansionsInputSchema,
  type ResearchQueryExpansionChannel,
  type ResearchQueryExpansionDocument,
  type UpdateResearchQueryExpansionsInput,
} from "@novel-studio/contracts";
import { StorageError } from "./errors.js";
import { runSeriesFileTransaction, type FileTransactionOptions } from "./fileTransactions.js";
import { assertInside } from "./fileSystem.js";
import {
  jsonAuthorityRevision,
  parseJsonAuthorityText,
  readJsonAuthorityFile,
  serializeJsonAuthority,
} from "./jsonAuthority.js";
import { researchDatabaseRoot } from "./researchDatabases.js";

const RETRIEVAL_DIRECTORY = "retrieval";
const QUERY_EXPANSIONS_FILE = "aliases.json";
const EMPTY_UPDATED_AT = "1970-01-01T00:00:00.000Z";

export interface ResearchQueryExpansionWriteOptions extends FileTransactionOptions {
  now?: () => Date;
}

export interface ResolvedResearchQueryExpansion {
  channel: ResearchQueryExpansionChannel;
  matchedTerm: string;
  expandedTerm: string;
  expandedQuery: string;
}

export function researchQueryExpansionsPath(libraryRoot: string, databaseId: string): string {
  const root = researchDatabaseRoot(libraryRoot, databaseId);
  return assertInside(root, path.join(root, RETRIEVAL_DIRECTORY, QUERY_EXPANSIONS_FILE));
}

function emptyResearchQueryExpansionDocument(databaseId: string): ResearchQueryExpansionDocument {
  const expansions = ResearchQueryExpansionSetSchema.parse({
    schemaVersion: 1,
    researchDatabaseId: databaseId,
    entries: [],
    updatedAt: EMPTY_UPDATED_AT,
  });
  const raw = serializeJsonAuthority(expansions);
  return ResearchQueryExpansionDocumentSchema.parse({
    expansions,
    revision: jsonAuthorityRevision(raw),
  });
}

export async function readResearchQueryExpansionFile(
  libraryRoot: string,
  databaseId: string,
): Promise<ResearchQueryExpansionDocument> {
  const root = researchDatabaseRoot(libraryRoot, databaseId);
  let document;
  try {
    document = await readJsonAuthorityFile(
      root,
      researchQueryExpansionsPath(libraryRoot, databaseId),
      (value) => ResearchQueryExpansionSetSchema.parse(value),
      "Research query expansions authority",
    );
  } catch (error) {
    if (error instanceof StorageError && error.code === "NOT_FOUND") {
      return emptyResearchQueryExpansionDocument(databaseId);
    }
    throw error;
  }
  if (document.data.researchDatabaseId !== databaseId) {
    throw new StorageError("Research query expansions belong to another database", "INVALID_DATA", {
      actualDatabaseId: document.data.researchDatabaseId,
      databaseId,
    });
  }
  return ResearchQueryExpansionDocumentSchema.parse({
    expansions: document.data,
    revision: document.revision,
  });
}

export async function updateResearchQueryExpansionFile(
  libraryRoot: string,
  databaseId: string,
  rawInput: UpdateResearchQueryExpansionsInput,
  options: ResearchQueryExpansionWriteOptions = {},
): Promise<ResearchQueryExpansionDocument> {
  const input = UpdateResearchQueryExpansionsInputSchema.parse(rawInput);
  const root = researchDatabaseRoot(libraryRoot, databaseId);
  return runSeriesFileTransaction(root, async (commit) => {
    const current = await readResearchQueryExpansionFile(libraryRoot, databaseId);
    if (current.revision !== input.baseRevision) {
      throw new StorageError("Research query expansions have changed since they were opened", "CONFLICT", {
        actualRevision: current.revision,
        databaseId,
        expectedRevision: input.baseRevision,
      });
    }
    const expansions = ResearchQueryExpansionSetSchema.parse({
      schemaVersion: 1,
      researchDatabaseId: databaseId,
      entries: input.entries,
      updatedAt: (options.now ?? (() => new Date()))().toISOString(),
    });
    const raw = serializeJsonAuthority(expansions);
    await commit([{ targetPath: researchQueryExpansionsPath(libraryRoot, databaseId), content: raw }]);
    return ResearchQueryExpansionDocumentSchema.parse({
      expansions: parseJsonAuthorityText(
        raw,
        (value) => ResearchQueryExpansionSetSchema.parse(value),
        "Research query expansions authority",
      ),
      revision: jsonAuthorityRevision(raw),
    });
  }, options);
}

function normalizedTerm(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("und");
}

export function resolveResearchQueryExpansions(
  query: string,
  document: ResearchQueryExpansionDocument,
): ResolvedResearchQueryExpansion[] {
  const normalizedQuery = normalizedTerm(query);
  const results: ResolvedResearchQueryExpansion[] = [];
  const seen = new Set<string>();
  for (const entry of document.expansions.entries) {
    const candidates = [
      { from: entry.queryTerm, to: entry.expansionTerm },
      { from: entry.expansionTerm, to: entry.queryTerm },
    ];
    for (const candidate of candidates) {
      const normalizedFrom = normalizedTerm(candidate.from);
      if (!normalizedQuery.includes(normalizedFrom)) continue;
      const expandedQuery = `${query} ${candidate.to}`.trim();
      const key = `${entry.channel}\u0000${normalizedTerm(expandedQuery)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        channel: entry.channel,
        matchedTerm: candidate.from,
        expandedTerm: candidate.to,
        expandedQuery,
      });
    }
  }
  return results.sort((left, right) =>
    left.channel.localeCompare(right.channel, "en")
    || left.expandedQuery.localeCompare(right.expandedQuery, "und"),
  );
}
