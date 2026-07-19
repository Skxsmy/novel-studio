import { createHash, randomUUID } from "node:crypto";
import type {
  EmbeddingRouter,
  ProviderToolCall,
  ProviderToolDefinition,
} from "@novel-studio/ai";
import {
  RESEARCH_TOOL_DEFAULT_LIMITS,
  ResearchListSourcesArgumentsSchema,
  ResearchOpenPassageArgumentsSchema,
  ResearchSearchArgumentsSchema,
  ResearchToolArgumentsSchema,
  ResearchToolAuditEventSchema,
  ResearchToolBudgetStateSchema,
  ResearchToolLimitsSchema,
  ResearchToolNameSchema,
  ResearchToolResultSchema,
  type ResearchListSourcesArguments,
  type ResearchOpenPassageArguments,
  type ResearchSearchArguments,
  type ResearchToolArgumentSummary,
  type ResearchToolAuditCitation,
  type ResearchToolAuditEvent,
  type ResearchToolBudgetState,
  type ResearchToolErrorCode,
  type ResearchToolExhaustedReason,
  type ResearchToolLimits,
  type ResearchToolName,
  type ResearchToolPassage,
  type ResearchToolResult,
} from "@novel-studio/contracts";
import {
  ProjectRepository,
  StorageError,
} from "@novel-studio/storage";
import { z } from "zod";
import { searchResearchDatabases } from "./researchRetrieval.js";

const ActiveDatabaseIdsSchema = z.array(z.string().uuid()).min(1).max(12).superRefine((ids, context) => {
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", message: "Active Research Database IDs must be unique" });
  }
});
const ListSourcesCursorSchema = z.object({
  schemaVersion: z.literal(1),
  databaseId: z.string().uuid(),
  snapshotHash: z.string().regex(/^[a-f0-9]{64}$/u),
  offset: z.number().int().positive(),
}).strict();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

interface ResearchToolExecutionEvidence {
  payload: Record<string, unknown>;
  resultKeys: string[];
  citations: ResearchToolAuditCitation[];
}

interface RehydratedResearchToolState {
  budget: ResearchToolBudgetState;
  citations: ResearchToolAuditCitation[];
  resultKeys: Set<string>;
  sequence: number;
}

export interface CreateResearchToolGatewayInput {
  repository: ProjectRepository;
  embeddingRouter: EmbeddingRouter;
  seriesId: string;
  modelCallId: string;
  activeDatabaseIds: string[];
  abortSignal?: AbortSignal;
  limits?: ResearchToolLimits;
}

export interface ResearchToolGateway {
  readonly activeDatabaseIds: readonly string[];
  readonly limits: Readonly<ResearchToolLimits>;
  execute(call: ProviderToolCall): Promise<ResearchToolResult>;
  getBudgetState(): Promise<ResearchToolBudgetState>;
}

class ResearchGatewayError extends Error {
  constructor(
    readonly code: ResearchToolErrorCode,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "ResearchGatewayError";
  }
}

const modelCallLanes = new Map<string, Promise<void>>();

async function runModelCallLane<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = modelCallLanes.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => gate);
  modelCallLanes.set(key, tail);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (modelCallLanes.get(key) === tail) modelCallLanes.delete(key);
  }
}

function jsonSchema(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
}

export function researchRetrievalToolDefinitions(
  nativeToolCalls: boolean,
  activeDatabases: Array<{ id: string; name: string }> = [],
): ProviderToolDefinition[] {
  if (!nativeToolCalls) return [];
  const activeDatabaseDescription = activeDatabases.length === 0
    ? ""
    : ` Active for this call: ${activeDatabases.map((database) =>
      `${database.name} (${database.id})`).join("; ")}.`;
  return [
    {
      name: "research.list_sources",
      description: `List a bounded page of AI-permitted source metadata from one Research Database active for this model call. This never returns source text.${activeDatabaseDescription}`,
      parameters: jsonSchema(ResearchListSourcesArgumentsSchema),
      strict: true,
    },
    {
      name: "research.search",
      description: `Search the active Research Databases for a bounded set of relevant original-language passages. The server owns result limits, permissions, ranking thresholds, and cumulative budgets.${activeDatabaseDescription}`,
      parameters: jsonSchema(ResearchSearchArgumentsSchema),
      strict: true,
    },
    {
      name: "research.open_passage",
      description: "Open one previously returned immutable passage citation with at most one adjacent passage on each side. Every citation identity and current revision is verified by the server.",
      parameters: jsonSchema(ResearchOpenPassageArgumentsSchema),
      strict: true,
    },
  ];
}

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function characterCount(value: string): number {
  return Array.from(value).length;
}

function estimateTokensFromCharacters(characters: number): number {
  return Math.ceil(characters / 2);
}

function sameLimits(left: ResearchToolLimits, right: ResearchToolLimits): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function initialBudget(limits: ResearchToolLimits): ResearchToolBudgetState {
  return ResearchToolBudgetStateSchema.parse({
    limits,
    usedToolCalls: 0,
    usedCharacters: 0,
    usedTokenEstimate: 0,
    consecutiveNoProgress: 0,
    remainingToolCalls: limits.maxToolCalls,
    remainingCharacters: limits.cumulativeCharacterBudget,
    remainingTokenEstimate: limits.cumulativeTokenEstimateBudget,
    exhaustedReason: null,
  });
}

function advanceBudget(
  previous: ResearchToolBudgetState,
  madeProgress: boolean,
  outputCharacterCount: number,
  outputTokenEstimate: number,
  forcedReason: ResearchToolExhaustedReason = null,
): ResearchToolBudgetState {
  const limits = previous.limits;
  const usedToolCalls = Math.min(limits.maxToolCalls, previous.usedToolCalls + 1);
  const usedCharacters = Math.min(
    limits.cumulativeCharacterBudget,
    previous.usedCharacters + outputCharacterCount,
  );
  const usedTokenEstimate = Math.min(
    limits.cumulativeTokenEstimateBudget,
    previous.usedTokenEstimate + outputTokenEstimate,
  );
  const consecutiveNoProgress = madeProgress ? 0 : previous.consecutiveNoProgress + 1;
  const exhaustedReason = forcedReason
    ?? (usedToolCalls >= limits.maxToolCalls ? "tool-call-limit"
      : consecutiveNoProgress >= limits.maxConsecutiveNoProgress ? "no-progress-limit"
        : usedCharacters >= limits.cumulativeCharacterBudget ? "character-budget"
          : usedTokenEstimate >= limits.cumulativeTokenEstimateBudget ? "token-estimate-budget"
            : null);
  return ResearchToolBudgetStateSchema.parse({
    limits,
    usedToolCalls,
    usedCharacters,
    usedTokenEstimate,
    consecutiveNoProgress,
    remainingToolCalls: limits.maxToolCalls - usedToolCalls,
    remainingCharacters: limits.cumulativeCharacterBudget - usedCharacters,
    remainingTokenEstimate: limits.cumulativeTokenEstimateBudget - usedTokenEstimate,
    exhaustedReason,
  });
}

function validateAuditProgression(
  events: ResearchToolAuditEvent[],
  limits: ResearchToolLimits,
): RehydratedResearchToolState {
  let budget = initialBudget(limits);
  const citations: ResearchToolAuditCitation[] = [];
  const resultKeys = new Set<string>();
  for (const event of events) {
    if (!sameLimits(event.budgetAfter.limits, limits)) {
      throw new StorageError("Research tool audit limits do not match this gateway", "INVALID_DATA", {
        modelCallId: event.modelCallId,
        sequence: event.sequence,
      });
    }
    const expectedCalls = budget.usedToolCalls + 1;
    const expectedCharacters = budget.usedCharacters + event.outputCharacterCount;
    const expectedTokens = budget.usedTokenEstimate + event.outputTokenEstimate;
    const expectedNoProgress = event.madeProgress ? 0 : budget.consecutiveNoProgress + 1;
    if (
      event.budgetAfter.usedToolCalls !== expectedCalls ||
      event.budgetAfter.usedCharacters !== expectedCharacters ||
      event.budgetAfter.usedTokenEstimate !== expectedTokens ||
      event.budgetAfter.consecutiveNoProgress !== expectedNoProgress
    ) {
      throw new StorageError("Research tool audit budget progression is invalid", "INVALID_DATA", {
        modelCallId: event.modelCallId,
        sequence: event.sequence,
      });
    }
    budget = event.budgetAfter;
    event.citations.forEach((citation) => citations.push(citation));
    event.resultKeys.forEach((key) => resultKeys.add(key));
  }
  return { budget, citations, resultKeys, sequence: events.length + 1 };
}

function buildArgumentSummary(call: ProviderToolCall): ResearchToolArgumentSummary {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(call.arguments);
  } catch {
    // Invalid JSON still receives a structural audit record.
  }
  const record = parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
  const rawDatabaseIds = Array.isArray(record.databaseIds)
    ? record.databaseIds
    : typeof record.databaseId === "string" ? [record.databaseId] : [];
  const requestedDatabaseIds = [...new Set(rawDatabaseIds.filter(
    (value): value is string => typeof value === "string" && UUID_PATTERN.test(value),
  ))].slice(0, 12);
  const query = typeof record.query === "string" ? record.query : null;
  return {
    requestedDatabaseIds,
    sourceId: typeof record.sourceId === "string" && UUID_PATTERN.test(record.sourceId)
      ? record.sourceId
      : null,
    chunkId: typeof record.chunkId === "string" && UUID_PATTERN.test(record.chunkId)
      ? record.chunkId
      : null,
    queryHash: query === null ? null : hash(query),
    queryCharacterCount: query === null ? 0 : characterCount(query),
    cursorProvided: typeof record.cursor === "string" && record.cursor.length > 0,
  };
}

function citationKey(citation: {
  researchDatabaseId: string;
  sourceId: string;
  sourceRevision: string;
  chunkId: string;
  chunkHash: string;
}): string {
  return [
    citation.researchDatabaseId,
    citation.sourceId,
    citation.sourceRevision,
    citation.chunkId,
    citation.chunkHash,
  ].join(":");
}

function sourceKey(source: {
  researchDatabaseId: string;
  sourceId: string;
  sourceRevision: string;
}): string {
  return [source.researchDatabaseId, source.sourceId, source.sourceRevision].join(":");
}

function encodeListCursor(value: z.infer<typeof ListSourcesCursorSchema>): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeListCursor(cursor: string): z.infer<typeof ListSourcesCursorSchema> {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    return ListSourcesCursorSchema.parse(JSON.parse(raw));
  } catch {
    throw new ResearchGatewayError("INVALID_ARGUMENTS", "The source cursor is invalid or no longer usable.");
  }
}

function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new ResearchGatewayError("CANCELLED", "Research retrieval was cancelled.");
  }
}

function publicError(error: unknown): ResearchGatewayError {
  if (error instanceof ResearchGatewayError) return error;
  if (error instanceof Error && error.name === "AbortError") {
    return new ResearchGatewayError("CANCELLED", "Research retrieval was cancelled.");
  }
  return new ResearchGatewayError(
    "RETRIEVAL_FAILED",
    "Research retrieval could not complete. No private provider or source details were exposed.",
    true,
  );
}

function eventStatus(error: ResearchGatewayError): ResearchToolAuditEvent["status"] {
  if (error.code === "CANCELLED") return "cancelled";
  if (error.code === "RETRIEVAL_FAILED") return "failed";
  return "rejected";
}

function resultCitationsFromSearch(
  results: Array<{
    researchDatabaseId: string;
    researchDatabaseName: string;
    sourceId: string;
    sourceRevision: string;
    sourceDisplayName: string;
    sourceKind: ResearchToolAuditCitation["sourceKind"];
    chunkId: string;
    blockId: string;
    chunkHash: string;
    languageTag: string;
    location: ResearchToolAuditCitation["location"];
    matchChannels: ResearchToolAuditCitation["matchChannels"];
    fusedScore: number;
  }>,
): ResearchToolAuditCitation[] {
  return results.map((result) => ({
    researchDatabaseId: result.researchDatabaseId,
    researchDatabaseName: result.researchDatabaseName,
    sourceId: result.sourceId,
    sourceRevision: result.sourceRevision,
    sourceDisplayName: result.sourceDisplayName,
    sourceKind: result.sourceKind,
    chunkId: result.chunkId,
    blockId: result.blockId,
    chunkHash: result.chunkHash,
    languageTag: result.languageTag,
    location: result.location,
    relationship: "target",
    matchChannels: result.matchChannels,
    fusedScore: result.fusedScore,
  }));
}

function settleSuccessResult(
  payload: Record<string, unknown>,
  previous: ResearchToolBudgetState,
  madeProgress: boolean,
): { result: ResearchToolResult; characters: number; tokens: number } {
  let characters = 0;
  let tokens = 0;
  let result: ResearchToolResult | null = null;
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const budget = advanceBudget(previous, madeProgress, characters, tokens);
    result = ResearchToolResultSchema.parse({ ...payload, budget });
    const serialized = JSON.stringify(result);
    const nextCharacters = characterCount(serialized);
    const nextTokens = estimateTokensFromCharacters(nextCharacters);
    if (nextCharacters === characters && nextTokens === tokens) {
      return { result, characters, tokens };
    }
    characters = nextCharacters;
    tokens = nextTokens;
  }
  const budget = advanceBudget(previous, madeProgress, characters, tokens);
  result = ResearchToolResultSchema.parse({ ...payload, budget });
  return { result, characters, tokens };
}

export async function createResearchToolGateway(
  input: CreateResearchToolGatewayInput,
): Promise<ResearchToolGateway> {
  const activeDatabaseIds = Object.freeze([...ActiveDatabaseIdsSchema.parse(input.activeDatabaseIds)]);
  const limits = Object.freeze(ResearchToolLimitsSchema.parse(input.limits ?? RESEARCH_TOOL_DEFAULT_LIMITS));
  const modelCall = await input.repository.getModelCallLog(input.seriesId, input.modelCallId);
  if (modelCall.seriesId !== input.seriesId) {
    throw new StorageError("Research tool Model Call Log belongs to another Series", "INVALID_DATA", {
      modelCallId: input.modelCallId,
    });
  }
  if (modelCall.status !== "pending" && modelCall.status !== "streaming") {
    throw new StorageError("Research tools require an active Model Call Log", "CONFLICT", {
      modelCallId: input.modelCallId,
      status: modelCall.status,
    });
  }
  await Promise.all(activeDatabaseIds.map((databaseId) => input.repository.getResearchDatabase(databaseId)));
  const initialEvents = await input.repository.listResearchToolAuditEvents(input.seriesId, input.modelCallId);
  validateAuditProgression(initialEvents, limits);
  const activeDatabaseSet = new Set(activeDatabaseIds);
  const laneKey = `${input.seriesId}:${input.modelCallId}`;

  function assertActiveDatabase(databaseId: string): void {
    if (!activeDatabaseSet.has(databaseId)) {
      throw new ResearchGatewayError(
        "INACTIVE_DATABASE",
        "The requested Research Database is not active for this model call.",
      );
    }
  }

  async function listSources(
    argumentsValue: ResearchListSourcesArguments,
  ): Promise<ResearchToolExecutionEvidence> {
    assertActiveDatabase(argumentsValue.databaseId);
    assertNotAborted(input.abortSignal);
    const database = await input.repository.getResearchDatabase(argumentsValue.databaseId);
    const documents = (await input.repository.listResearchSources(argumentsValue.databaseId))
      .filter((document) => document.source.aiPermission === "allowed")
      .sort((left, right) =>
        left.source.displayName.localeCompare(right.source.displayName, "und")
        || left.source.id.localeCompare(right.source.id, "en"));
    const snapshotHash = hash(JSON.stringify({
      databaseRevision: database.revision,
      sources: documents.map((document) => [document.source.id, document.revision]),
    }));
    let offset = 0;
    if (argumentsValue.cursor) {
      const cursor = decodeListCursor(argumentsValue.cursor);
      if (
        cursor.databaseId !== argumentsValue.databaseId ||
        cursor.snapshotHash !== snapshotHash ||
        cursor.offset > documents.length
      ) {
        throw new ResearchGatewayError(
          "INVALID_ARGUMENTS",
          "The source cursor no longer matches the active database snapshot.",
        );
      }
      offset = cursor.offset;
    }
    const page = documents.slice(offset, offset + limits.sourceResultLimit);
    const sources = page.map((document) => {
      assertNotAborted(input.abortSignal);
      return {
        researchDatabaseId: argumentsValue.databaseId,
        researchDatabaseName: database.database.name,
        sourceId: document.source.id,
        sourceRevision: document.revision,
        displayName: document.source.displayName,
        sourceKind: document.source.kind,
        author: document.source.author,
        declaredLanguage: document.source.declaredLanguage,
        tags: document.source.tags,
        parseStatus: document.source.parseStatus,
        sectionCount: null,
        blockCount: null,
        chunkCount: null,
      };
    });
    const nextOffset = offset + page.length;
    const nextCursor = nextOffset < documents.length
      ? encodeListCursor({
        schemaVersion: 1,
        databaseId: argumentsValue.databaseId,
        snapshotHash,
        offset: nextOffset,
      })
      : null;
    return {
      payload: {
        schemaVersion: 1,
        ok: true,
        tool: "research.list_sources",
        databaseId: argumentsValue.databaseId,
        sources,
        nextCursor,
      },
      resultKeys: sources.map(sourceKey),
      citations: [],
    };
  }

  async function search(
    argumentsValue: ResearchSearchArguments,
  ): Promise<ResearchToolExecutionEvidence> {
    const selectedDatabaseIds = argumentsValue.databaseIds ?? [...activeDatabaseIds];
    selectedDatabaseIds.forEach(assertActiveDatabase);
    assertNotAborted(input.abortSignal);
    const response = await searchResearchDatabases(
      input.repository,
      input.embeddingRouter,
      {
        databaseIds: selectedDatabaseIds,
        query: argumentsValue.query,
        purpose: "model-context",
        mode: argumentsValue.mode,
        limit: limits.searchResultLimit,
        ...(argumentsValue.sourceKinds ? { sourceKinds: argumentsValue.sourceKinds } : {}),
        ...(argumentsValue.languageTags ? { languageTags: argumentsValue.languageTags } : {}),
        ...(argumentsValue.tags ? { tags: argumentsValue.tags } : {}),
        ...(argumentsValue.author !== undefined ? { author: argumentsValue.author } : {}),
        ...(argumentsValue.cursor ? { cursor: argumentsValue.cursor } : {}),
      },
      input.abortSignal ? { abortSignal: input.abortSignal } : {},
    );
    assertNotAborted(input.abortSignal);
    const citations = resultCitationsFromSearch(response.results);
    return {
      payload: {
        schemaVersion: 1,
        ok: true,
        tool: "research.search",
        selectedDatabaseIds: response.selectedDatabaseIds,
        requestedMode: response.requestedMode,
        effectiveMode: response.effectiveMode,
        results: response.results,
        issues: response.issues,
        nextCursor: response.nextCursor,
      },
      resultKeys: citations.map(citationKey),
      citations,
    };
  }

  async function openPassage(
    argumentsValue: ResearchOpenPassageArguments,
    state: RehydratedResearchToolState,
  ): Promise<ResearchToolExecutionEvidence> {
    assertActiveDatabase(argumentsValue.databaseId);
    const priorCitation = state.citations.find((citation) =>
      citation.researchDatabaseId === argumentsValue.databaseId
      && citation.sourceId === argumentsValue.sourceId
      && citation.chunkId === argumentsValue.chunkId
      && citation.sourceRevision === argumentsValue.sourceRevision
      && citation.chunkHash === argumentsValue.chunkHash);
    if (!priorCitation) {
      throw new ResearchGatewayError(
        "CITATION_NOT_RETURNED",
        "This exact passage citation was not returned earlier in the current model call.",
      );
    }
    assertNotAborted(input.abortSignal);
    const [database, detail] = await Promise.all([
      input.repository.getResearchDatabase(argumentsValue.databaseId),
      input.repository.getResearchSource(argumentsValue.databaseId, argumentsValue.sourceId),
    ]);
    if (detail.source.aiPermission !== "allowed") {
      throw new ResearchGatewayError(
        "SOURCE_NOT_PERMITTED",
        "The source is not permitted for AI retrieval.",
      );
    }
    if (!("content" in detail)) {
      throw new ResearchGatewayError(
        "STALE_CITATION",
        "The cited source must be upgraded before structured passages can be opened.",
      );
    }
    if (detail.revision !== argumentsValue.sourceRevision) {
      throw new ResearchGatewayError(
        "STALE_CITATION",
        "The cited source changed after the citation was returned.",
      );
    }
    const targetIndex = detail.content.chunks.findIndex((chunk) => chunk.id === argumentsValue.chunkId);
    const target = detail.content.chunks[targetIndex];
    if (!target || target.textHash !== argumentsValue.chunkHash) {
      throw new ResearchGatewayError(
        "STALE_CITATION",
        "The cited passage changed after the citation was returned.",
      );
    }
    const start = Math.max(0, targetIndex - limits.adjacentChunkCount);
    const end = Math.min(detail.content.chunks.length, targetIndex + limits.adjacentChunkCount + 1);
    const passages: ResearchToolPassage[] = detail.content.chunks.slice(start, end).map((chunk, relativeIndex) => {
      const absoluteIndex = start + relativeIndex;
      const relationship = absoluteIndex < targetIndex
        ? "previous"
        : absoluteIndex > targetIndex ? "next" : "target";
      return {
        researchDatabaseId: argumentsValue.databaseId,
        researchDatabaseName: database.database.name,
        sourceId: detail.source.id,
        sourceRevision: detail.revision,
        sourceDisplayName: detail.source.displayName,
        sourceKind: detail.source.kind,
        chunkId: chunk.id,
        blockId: chunk.blockId,
        chunkHash: chunk.textHash,
        originalText: chunk.text,
        languageTag: chunk.language.languageTag,
        location: chunk.location,
        relationship,
        matchChannels: relationship === "target" ? priorCitation.matchChannels : [],
      };
    });
    const citations: ResearchToolAuditCitation[] = passages.map((passage) => ({
      researchDatabaseId: passage.researchDatabaseId,
      researchDatabaseName: passage.researchDatabaseName,
      sourceId: passage.sourceId,
      sourceRevision: passage.sourceRevision,
      sourceDisplayName: passage.sourceDisplayName,
      sourceKind: passage.sourceKind,
      chunkId: passage.chunkId,
      blockId: passage.blockId,
      chunkHash: passage.chunkHash,
      languageTag: passage.languageTag,
      location: passage.location,
      relationship: passage.relationship,
      matchChannels: passage.matchChannels,
      fusedScore: passage.relationship === "target" ? priorCitation.fusedScore : null,
    }));
    return {
      payload: {
        schemaVersion: 1,
        ok: true,
        tool: "research.open_passage",
        passages,
      },
      resultKeys: citations.map(citationKey),
      citations,
    };
  }

  async function appendError(
    call: ProviderToolCall,
    state: RehydratedResearchToolState,
    error: ResearchGatewayError,
    startedAt: string,
    knownTool: ResearchToolName | null,
    forcedReason: ResearchToolExhaustedReason = null,
  ): Promise<ResearchToolResult> {
    const budget = advanceBudget(state.budget, false, 0, 0, forcedReason);
    const result = ResearchToolResultSchema.parse({
      schemaVersion: 1,
      ok: false,
      tool: knownTool,
      error: { code: error.code, message: error.message, retryable: error.retryable },
      budget,
    });
    const event = ResearchToolAuditEventSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      seriesId: input.seriesId,
      modelCallId: input.modelCallId,
      sequence: state.sequence,
      tool: knownTool,
      status: eventStatus(error),
      argumentHash: hash(JSON.stringify({ name: call.name, arguments: call.arguments })),
      argumentCharacterCount: characterCount(call.arguments),
      argumentSummary: buildArgumentSummary(call),
      resultKeys: [],
      citations: [],
      outputCharacterCount: 0,
      outputTokenEstimate: 0,
      madeProgress: false,
      budgetAfter: budget,
      errorCode: error.code,
      startedAt,
      completedAt: new Date().toISOString(),
    });
    await input.repository.appendResearchToolAuditEvent(input.seriesId, event);
    return result;
  }

  async function executeUnlocked(call: ProviderToolCall): Promise<ResearchToolResult> {
    const events = await input.repository.listResearchToolAuditEvents(input.seriesId, input.modelCallId);
    const state = validateAuditProgression(events, limits);
    if (state.budget.exhaustedReason) {
      return ResearchToolResultSchema.parse({
        schemaVersion: 1,
        ok: false,
        tool: ResearchToolNameSchema.safeParse(call.name).success
          ? call.name as ResearchToolName
          : null,
        error: {
          code: "BUDGET_EXHAUSTED",
          message: "Research retrieval is exhausted for this model call.",
          retryable: false,
        },
        budget: state.budget,
      });
    }

    const startedAt = new Date().toISOString();
    const knownToolResult = ResearchToolNameSchema.safeParse(call.name);
    const knownTool = knownToolResult.success ? knownToolResult.data : null;
    if (!knownTool) {
      return appendError(
        call,
        state,
        new ResearchGatewayError("UNKNOWN_TOOL", "The requested Research tool is not available."),
        startedAt,
        null,
      );
    }
    if (input.abortSignal?.aborted) {
      return appendError(
        call,
        state,
        new ResearchGatewayError("CANCELLED", "Research retrieval was cancelled."),
        startedAt,
        knownTool,
      );
    }
    let parsedArguments: z.infer<typeof ResearchToolArgumentsSchema>;
    try {
      parsedArguments = ResearchToolArgumentsSchema.parse({
        tool: knownTool,
        arguments: JSON.parse(call.arguments),
      });
    } catch {
      return appendError(
        call,
        state,
        new ResearchGatewayError("INVALID_ARGUMENTS", "Research tool arguments are invalid."),
        startedAt,
        knownTool,
      );
    }

    try {
      let evidence: ResearchToolExecutionEvidence;
      switch (parsedArguments.tool) {
        case "research.list_sources":
          evidence = await listSources(parsedArguments.arguments);
          break;
        case "research.search":
          evidence = await search(parsedArguments.arguments);
          break;
        case "research.open_passage":
          evidence = await openPassage(parsedArguments.arguments, state);
          break;
      }
      const uniqueResultKeys = [...new Set(evidence.resultKeys)];
      const madeProgress = uniqueResultKeys.some((key) => !state.resultKeys.has(key));
      const settled = settleSuccessResult(evidence.payload, state.budget, madeProgress);
      let exceededReason: ResearchToolExhaustedReason = null;
      if (
        settled.characters > limits.perCallCharacterBudget
        || state.budget.usedCharacters + settled.characters > limits.cumulativeCharacterBudget
      ) {
        exceededReason = "character-budget";
      } else if (
        settled.tokens > limits.perCallTokenEstimateBudget
        || state.budget.usedTokenEstimate + settled.tokens > limits.cumulativeTokenEstimateBudget
      ) {
        exceededReason = "token-estimate-budget";
      }
      if (exceededReason) {
        return appendError(
          call,
          state,
          new ResearchGatewayError(
            "BUDGET_EXHAUSTED",
            "The bounded Research result would exceed this model call's retrieval budget.",
          ),
          startedAt,
          knownTool,
          exceededReason,
        );
      }
      const auditEvent = ResearchToolAuditEventSchema.parse({
        schemaVersion: 1,
        id: randomUUID(),
        seriesId: input.seriesId,
        modelCallId: input.modelCallId,
        sequence: state.sequence,
        tool: knownTool,
        status: "succeeded",
        argumentHash: hash(JSON.stringify({ name: call.name, arguments: call.arguments })),
        argumentCharacterCount: characterCount(call.arguments),
        argumentSummary: buildArgumentSummary(call),
        resultKeys: uniqueResultKeys,
        citations: evidence.citations,
        outputCharacterCount: settled.characters,
        outputTokenEstimate: settled.tokens,
        madeProgress,
        budgetAfter: settled.result.budget,
        errorCode: null,
        startedAt,
        completedAt: new Date().toISOString(),
      });
      await input.repository.appendResearchToolAuditEvent(input.seriesId, auditEvent);
      return settled.result;
    } catch (error) {
      const safeError = publicError(error);
      return appendError(call, state, safeError, startedAt, knownTool);
    }
  }

  return {
    activeDatabaseIds,
    limits,
    execute(call) {
      return runModelCallLane(laneKey, () => executeUnlocked(call));
    },
    async getBudgetState() {
      return runModelCallLane(laneKey, async () => {
        const events = await input.repository.listResearchToolAuditEvents(input.seriesId, input.modelCallId);
        return validateAuditProgression(events, limits).budget;
      });
    },
  };
}
