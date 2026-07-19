import { createHash } from "node:crypto";
import {
  ResearchRetrievalResultSchema,
  type ResearchRetrievalMatchChannel,
  type ResearchRetrievalResult,
  type ResearchSourceKind,
  type ResearchSourceLocation,
} from "@novel-studio/contracts";
import { StorageError } from "./errors.js";

export const RESEARCH_RRF_K = 60;
export const RESEARCH_MINIMUM_FUSED_SCORE = 0.004;

export const RESEARCH_CHANNEL_WEIGHTS: Readonly<Record<ResearchRetrievalMatchChannel, number>> = {
  "keyword-literal": 1.2,
  "keyword-cjk": 1,
  "keyword-word": 1,
  alias: 0.9,
  transliteration: 0.8,
  "query-translation": 0.7,
  semantic: 1.1,
};

const CHANNEL_ORDER = Object.keys(RESEARCH_CHANNEL_WEIGHTS) as ResearchRetrievalMatchChannel[];

export interface ResearchRetrievalCandidate {
  researchDatabaseId: string;
  researchDatabaseName: string;
  sourceId: string;
  sourceRevision: string;
  sourceDisplayName: string;
  sourceKind: ResearchSourceKind;
  chunkId: string;
  blockId: string;
  blockOrder: number;
  chunkHash: string;
  originalText: string;
  languageTag: string;
  location: ResearchSourceLocation;
  channel: ResearchRetrievalMatchChannel;
  matchedQuery: string;
  channelRank: number;
  rawScore: number;
}

export interface FuseResearchRetrievalOptions {
  selectedDatabaseIds: string[];
  requestFingerprint: string;
  snapshotFingerprint: string;
  limit: number;
  cursor?: string;
  minimumFusedScore?: number;
}

export interface FusedResearchRetrievalPage {
  results: ResearchRetrievalResult[];
  nextCursor: string | null;
}

interface CursorCore {
  schemaVersion: 1;
  binding: string;
  offset: number;
}

interface CursorEnvelope extends CursorCore {
  checksum: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function cursorBinding(options: FuseResearchRetrievalOptions): string {
  return sha256(JSON.stringify({
    requestFingerprint: options.requestFingerprint,
    selectedDatabaseIds: [...options.selectedDatabaseIds].sort(),
    snapshotFingerprint: options.snapshotFingerprint,
  }));
}

function encodeCursor(binding: string, offset: number): string {
  const core: CursorCore = { schemaVersion: 1, binding, offset };
  const envelope: CursorEnvelope = { ...core, checksum: sha256(JSON.stringify(core)) };
  return Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url");
}

function decodeCursor(cursor: string, binding: string): number {
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new StorageError("Research retrieval cursor is malformed", "INVALID_DATA");
  }
  if (!value || typeof value !== "object") {
    throw new StorageError("Research retrieval cursor is malformed", "INVALID_DATA");
  }
  const envelope = value as Partial<CursorEnvelope>;
  const core: CursorCore = {
    schemaVersion: 1,
    binding: String(envelope.binding ?? ""),
    offset: Number(envelope.offset),
  };
  if (
    envelope.schemaVersion !== 1
    || !Number.isInteger(core.offset)
    || core.offset < 0
    || envelope.checksum !== sha256(JSON.stringify(core))
  ) {
    throw new StorageError("Research retrieval cursor is malformed", "INVALID_DATA");
  }
  if (core.binding !== binding) {
    throw new StorageError("Research retrieval cursor no longer matches the query or indexes", "CONFLICT");
  }
  return core.offset;
}

function candidateKey(candidate: ResearchRetrievalCandidate): string {
  return `${candidate.researchDatabaseId}\u0000${candidate.chunkId}`;
}

function evidenceIdentity(candidate: ResearchRetrievalCandidate): string {
  return [
    candidate.sourceId,
    candidate.sourceRevision,
    candidate.blockId,
    candidate.chunkHash,
    candidate.originalText,
    JSON.stringify(candidate.location),
  ].join("\u0000");
}

function diversify(results: ResearchRetrievalResult[]): ResearchRetrievalResult[] {
  const preferred: ResearchRetrievalResult[] = [];
  const deferred: ResearchRetrievalResult[] = [];
  const sourceCounts = new Map<string, number>();
  const databaseCounts = new Map<string, number>();
  for (const result of results) {
    const sourceKey = `${result.researchDatabaseId}\u0000${result.sourceId}`;
    const sourceCount = sourceCounts.get(sourceKey) ?? 0;
    const databaseCount = databaseCounts.get(result.researchDatabaseId) ?? 0;
    if (sourceCount < 2 && databaseCount < 5) {
      preferred.push(result);
      sourceCounts.set(sourceKey, sourceCount + 1);
      databaseCounts.set(result.researchDatabaseId, databaseCount + 1);
    } else {
      deferred.push(result);
    }
  }
  return [...preferred, ...deferred].map((result, index) => ResearchRetrievalResultSchema.parse({
    ...result,
    rank: index + 1,
  }));
}

export function fuseResearchRetrievalCandidates(
  candidates: ResearchRetrievalCandidate[],
  options: FuseResearchRetrievalOptions,
): FusedResearchRetrievalPage {
  if (
    options.selectedDatabaseIds.length < 1
    || options.selectedDatabaseIds.length > 12
    || new Set(options.selectedDatabaseIds).size !== options.selectedDatabaseIds.length
  ) {
    throw new StorageError("Research retrieval database scope is invalid", "INVALID_DATA");
  }
  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 50) {
    throw new StorageError("Research retrieval page size is invalid", "INVALID_DATA", { limit: options.limit });
  }
  const minimumScore = options.minimumFusedScore ?? RESEARCH_MINIMUM_FUSED_SCORE;
  if (!Number.isFinite(minimumScore) || minimumScore < 0) {
    throw new StorageError("Research retrieval relevance threshold is invalid", "INVALID_DATA");
  }
  const selected = new Set(options.selectedDatabaseIds);
  const groups = new Map<string, {
    evidence: ResearchRetrievalCandidate;
    identity: string;
    channels: Map<ResearchRetrievalMatchChannel, ResearchRetrievalCandidate>;
  }>();
  for (const candidate of candidates) {
    if (!selected.has(candidate.researchDatabaseId)) continue;
    if (!Number.isInteger(candidate.channelRank) || candidate.channelRank < 1 || !Number.isFinite(candidate.rawScore)) {
      throw new StorageError("Research retrieval candidate rank or score is invalid", "INVALID_DATA");
    }
    const key = candidateKey(candidate);
    const identity = evidenceIdentity(candidate);
    const group = groups.get(key) ?? { evidence: candidate, identity, channels: new Map() };
    if (group.identity !== identity) {
      throw new StorageError("Research retrieval channels disagree about Chunk provenance", "INVALID_DATA", {
        chunkId: candidate.chunkId,
        researchDatabaseId: candidate.researchDatabaseId,
      });
    }
    const existing = group.channels.get(candidate.channel);
    if (
      !existing
      || candidate.channelRank < existing.channelRank
      || (candidate.channelRank === existing.channelRank && candidate.rawScore > existing.rawScore)
    ) {
      group.channels.set(candidate.channel, candidate);
    }
    groups.set(key, group);
  }

  const fused = [...groups.values()].map((group) => {
    const {
      channel: _channel,
      matchedQuery: _matchedQuery,
      channelRank: _channelRank,
      rawScore: _rawScore,
      ...evidence
    } = group.evidence;
    const contributions = [...group.channels.values()]
      .sort((left, right) => CHANNEL_ORDER.indexOf(left.channel) - CHANNEL_ORDER.indexOf(right.channel))
      .map((candidate) => ({
        channel: candidate.channel,
        matchedQuery: candidate.matchedQuery,
        rank: candidate.channelRank,
        rawScore: candidate.rawScore,
        reciprocalRankContribution: RESEARCH_CHANNEL_WEIGHTS[candidate.channel] / (RESEARCH_RRF_K + candidate.channelRank),
      }));
    const fusedScore = contributions.reduce((total, contribution) => total + contribution.reciprocalRankContribution, 0);
    return ResearchRetrievalResultSchema.parse({
      ...evidence,
      rank: 1,
      matchChannels: contributions.map((contribution) => contribution.channel),
      channelContributions: contributions,
      fusedScore,
    });
  }).filter((result) => result.fusedScore >= minimumScore)
    .sort((left, right) =>
      right.fusedScore - left.fusedScore
      || left.researchDatabaseName.localeCompare(right.researchDatabaseName, "und")
      || left.sourceDisplayName.localeCompare(right.sourceDisplayName, "und")
      || left.chunkId.localeCompare(right.chunkId, "en"),
    )
    .map((result, index) => ResearchRetrievalResultSchema.parse({ ...result, rank: index + 1 }));

  const ordered = diversify(fused);
  const binding = cursorBinding(options);
  const offset = options.cursor ? decodeCursor(options.cursor, binding) : 0;
  if (offset > ordered.length) {
    throw new StorageError("Research retrieval cursor offset is no longer valid", "CONFLICT");
  }
  const results = ordered.slice(offset, offset + options.limit);
  const nextOffset = offset + results.length;
  return {
    results,
    nextCursor: nextOffset < ordered.length ? encodeCursor(binding, nextOffset) : null,
  };
}
