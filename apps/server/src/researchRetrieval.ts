import { createHash } from "node:crypto";
import {
  ResearchEmbeddingCapabilitySchema,
  ResearchEmbeddingCapabilityStateSchema,
  ResearchMultiSearchInputSchema,
  ResearchMultiSearchResponseSchema,
  ResearchVectorIndexStateSchema,
  type EmbeddingModelProfile,
  type ResearchEmbeddingCapabilityDocument,
  type ResearchEmbeddingCapabilityState,
  type ResearchMultiSearchInput,
  type ResearchMultiSearchResponse,
  type ResearchSourceDetail,
  type ResearchVectorIndexState,
  type ValidateResearchEmbeddingCapabilityInput,
} from "@novel-studio/contracts";
import {
  validateResearchEmbeddingCapability,
  type EmbeddingRouter,
} from "@novel-studio/ai";
import {
  ProjectRepository,
  StorageError,
  embeddingModelProfileRevision,
  fuseResearchRetrievalCandidates,
  inspectResearchVectorIndex,
  rebuildResearchVectorIndexStreaming,
  researchDatabaseRoot,
  resolveResearchQueryExpansions,
  searchResearchVectorIndex,
  type ResearchRetrievalCandidate,
  type ResearchVectorChunkInput,
  type ResearchVectorIndexBuildInput,
} from "@novel-studio/storage";

const RESEARCH_EMBEDDING_USE_CASE = "research.multilingual" as const;

export interface ResearchSearchExecutionOptions {
  abortSignal?: AbortSignal;
}

function assertResearchSearchNotAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  const error = new Error("Research search was cancelled");
  error.name = "AbortError";
  throw error;
}

async function optionalCapability(
  repository: ProjectRepository,
  profileId: string,
): Promise<ResearchEmbeddingCapabilityDocument | null> {
  try {
    return await repository.getResearchEmbeddingCapability(profileId);
  } catch (error) {
    if (error instanceof StorageError && error.code === "NOT_FOUND") return null;
    throw error;
  }
}

export async function getResearchEmbeddingCapabilityState(
  repository: ProjectRepository,
  embeddingRouter: EmbeddingRouter,
): Promise<ResearchEmbeddingCapabilityState> {
  let binding;
  try {
    binding = await repository.getEmbeddingUseCaseBinding(RESEARCH_EMBEDDING_USE_CASE);
  } catch (error) {
    if (error instanceof StorageError && error.code === "NOT_FOUND") {
      return ResearchEmbeddingCapabilityStateSchema.parse({
        useCase: RESEARCH_EMBEDDING_USE_CASE,
        bindingStatus: "unbound",
        profileId: null,
        profileRevision: null,
        capability: null,
        usable: false,
        reason: "No Embedding profile is bound to research.multilingual.",
      });
    }
    throw error;
  }
  const profile = await repository.getEmbeddingModelProfile(binding.profileId);
  const profileRevision = embeddingModelProfileRevision(profile);
  const capability = await optionalCapability(repository, profile.id);
  let reason: string | null = null;
  if (profile.archivedAt) reason = "The bound Embedding profile is archived.";
  else if (!capability) reason = "The bound Embedding profile has not passed multilingual validation.";
  else if (capability.capability.profileRevision !== profileRevision) reason = "The Embedding profile changed after multilingual validation.";
  else if (capability.capability.validationStatus !== "passed") reason = capability.capability.failureReason ?? "Multilingual validation failed.";
  else if (capability.capability.dimensions !== profile.dimensions) reason = "The validated dimensions no longer match the Embedding profile.";
  else {
    try {
      const registered = embeddingRouter.resolveProfile(profile.id);
      if (embeddingModelProfileRevision(registered) !== profileRevision) {
        reason = "The running Embedding profile does not match the saved profile revision.";
      }
    } catch {
      reason = "The bound Embedding profile is not available in the running Provider registry.";
    }
  }
  return ResearchEmbeddingCapabilityStateSchema.parse({
    useCase: RESEARCH_EMBEDDING_USE_CASE,
    bindingStatus: "bound",
    profileId: profile.id,
    profileRevision,
    capability,
    usable: reason === null,
    reason,
  });
}

export async function validateBoundResearchEmbeddingCapability(
  repository: ProjectRepository,
  embeddingRouter: EmbeddingRouter,
  input: ValidateResearchEmbeddingCapabilityInput,
): Promise<ResearchEmbeddingCapabilityDocument> {
  let binding;
  try {
    binding = await repository.getEmbeddingUseCaseBinding(RESEARCH_EMBEDDING_USE_CASE);
  } catch (error) {
    if (error instanceof StorageError && error.code === "NOT_FOUND") {
      throw new StorageError("Bind an Embedding profile to research.multilingual before validation", "INVALID_DATA");
    }
    throw error;
  }
  const profile = await repository.getEmbeddingModelProfile(binding.profileId);
  const profileRevision = embeddingModelProfileRevision(profile);
  const current = await optionalCapability(repository, profile.id);
  let capability;
  try {
    capability = await validateResearchEmbeddingCapability(
      embeddingRouter,
      profile,
      profileRevision,
      input,
    );
  } catch {
    capability = ResearchEmbeddingCapabilitySchema.parse({
      schemaVersion: 1,
      profileId: profile.id,
      profileRevision,
      useCase: RESEARCH_EMBEDDING_USE_CASE,
      dimensions: profile.dimensions,
      supportedLanguageTags: input.supportedLanguageTags,
      sharedSpaceDeclared: input.sharedSpaceDeclared,
      documentPrefix: input.documentPrefix,
      queryPrefix: input.queryPrefix,
      validationStatus: "failed",
      validationFixtureVersion: 1,
      metrics: null,
      validatedAt: new Date().toISOString(),
      failureReason: "Embedding Provider validation failed. Check the bound profile and credential.",
    });
  }
  const currentBinding = await repository.getEmbeddingUseCaseBinding(RESEARCH_EMBEDDING_USE_CASE);
  if (currentBinding.profileId !== profile.id) {
    throw new StorageError("The research.multilingual binding changed during validation", "CONFLICT");
  }
  return repository.saveResearchEmbeddingCapability(capability, current?.revision ?? null);
}

async function sourceDetails(repository: ProjectRepository, researchDatabaseId: string): Promise<ResearchSourceDetail[]> {
  const documents = await repository.listResearchSources(researchDatabaseId);
  return Promise.all(documents.map((document) =>
    repository.getResearchSource(researchDatabaseId, document.source.id)));
}

function vectorChunkMetadata(details: ResearchSourceDetail[]): ResearchVectorChunkInput[] {
  return details.flatMap((detail) => {
    if (!("content" in detail) || detail.source.aiPermission !== "allowed") return [];
    const blockOrders = new Map(detail.content.blocks.map((block) => [block.id, block.order]));
    return detail.content.chunks.map((chunk) => ({
      chunkId: chunk.id,
      sourceId: detail.source.id,
      sourceRevision: detail.revision,
      sourceDisplayName: detail.source.displayName,
      sourceKind: detail.source.kind,
      sourceAuthor: detail.source.author,
      sourceTags: detail.source.tags,
      aiPermission: detail.source.aiPermission,
      blockId: chunk.blockId,
      blockOrder: blockOrders.get(chunk.blockId) ?? chunk.order,
      chunkHash: chunk.textHash,
      originalText: chunk.text,
      languageTag: chunk.language.languageTag,
      location: chunk.location,
      embedding: [],
    }));
  });
}

function vectorIdentity(
  profile: EmbeddingModelProfile,
  profileRevision: string,
  capability: ResearchEmbeddingCapabilityDocument,
) {
  return {
    profileId: profile.id,
    profileRevision,
    dimensions: profile.dimensions,
    model: profile.model,
    normalize: profile.normalize,
    documentPrefix: capability.capability.documentPrefix,
    queryPrefix: capability.capability.queryPrefix,
    capabilityRevision: capability.revision,
    validationFixtureVersion: 1 as const,
  };
}

async function currentVectorBuildInput(
  repository: ProjectRepository,
  embeddingRouter: EmbeddingRouter,
  researchDatabaseId: string,
): Promise<{ input: ResearchVectorIndexBuildInput | null; state: ResearchEmbeddingCapabilityState }> {
  await repository.getResearchDatabase(researchDatabaseId);
  const state = await getResearchEmbeddingCapabilityState(repository, embeddingRouter);
  if (!state.usable || !state.profileId || !state.profileRevision || !state.capability) {
    return { input: null, state };
  }
  const profile = await repository.getEmbeddingModelProfile(state.profileId);
  const details = await sourceDetails(repository, researchDatabaseId);
  return {
    state,
    input: {
      researchDatabaseId,
      ...vectorIdentity(profile, state.profileRevision, state.capability),
      chunks: vectorChunkMetadata(details),
    },
  };
}

export async function getResearchVectorIndexState(
  repository: ProjectRepository,
  embeddingRouter: EmbeddingRouter,
  researchDatabaseId: string,
): Promise<ResearchVectorIndexState> {
  const current = await currentVectorBuildInput(repository, embeddingRouter, researchDatabaseId);
  const root = researchDatabaseRoot(repository.libraryRoot, researchDatabaseId);
  const state = await inspectResearchVectorIndex(root, researchDatabaseId, current.input ?? undefined);
  if (state.status === "ready" && !current.input) {
    return ResearchVectorIndexStateSchema.parse({
      ...state,
      status: "stale",
      reason: current.state.reason ?? "The current Embedding capability is unavailable.",
    });
  }
  return state;
}

export async function rebuildResearchDatabaseVectorIndex(
  repository: ProjectRepository,
  embeddingRouter: EmbeddingRouter,
  researchDatabaseId: string,
): Promise<ResearchVectorIndexState> {
  const current = await currentVectorBuildInput(repository, embeddingRouter, researchDatabaseId);
  if (!current.input || !current.state.profileId || !current.state.capability) {
    throw new StorageError(current.state.reason ?? "Research semantic retrieval is unavailable", "INVALID_DATA");
  }
  const profile = await repository.getEmbeddingModelProfile(current.state.profileId);
  return rebuildResearchVectorIndexStreaming(
    researchDatabaseRoot(repository.libraryRoot, researchDatabaseId),
    current.input,
    {
      batchSize: profile.maxBatchSize,
      async embedBatch(chunks, signal) {
        try {
          const embedded = await embeddingRouter.embed({
            profileId: profile.id,
            inputs: chunks.map((chunk) => ({
              id: chunk.chunkId,
              text: `${current.state.capability!.capability.documentPrefix}${chunk.originalText}`,
            })),
            ...(signal ? { abortSignal: signal } : {}),
          });
          const vectors = new Map(embedded.vectors.map((vector) => [vector.inputId, vector.vector]));
          return chunks.map((chunk) => {
            const vector = vectors.get(chunk.chunkId);
            if (!vector) {
              throw new StorageError("Embedding Provider returned an incomplete Research vector batch", "INVALID_DATA");
            }
            return vector;
          });
        } catch (error) {
          if (error instanceof StorageError) throw error;
          throw new StorageError("Embedding Provider could not build the Research vector index", "INVALID_DATA");
        }
      },
    },
  );
}

function passesVectorFilters(result: Awaited<ReturnType<typeof searchResearchVectorIndex>>[number], input: ResearchMultiSearchInput): boolean {
  if (input.purpose === "model-context" && result.aiPermission === "never") return false;
  if (input.sourceKinds && !input.sourceKinds.includes(result.sourceKind)) return false;
  if (input.languageTags && !input.languageTags.some((tag) =>
    result.languageTag.toLocaleLowerCase("und").startsWith(tag.toLocaleLowerCase("und")))) return false;
  if (input.tags && !input.tags.every((tag) => result.sourceTags.some((actual) =>
    actual.toLocaleLowerCase("und") === tag.toLocaleLowerCase("und")))) return false;
  if (input.author && !result.sourceAuthor.toLocaleLowerCase("und").includes(input.author.toLocaleLowerCase("und"))) return false;
  return true;
}

function requestFingerprint(input: ResearchMultiSearchInput): string {
  const { cursor: _cursor, ...withoutCursor } = input;
  return createHash("sha256").update(JSON.stringify({
    ...withoutCursor,
    databaseIds: [...withoutCursor.databaseIds].sort(),
  }), "utf8").digest("hex");
}

export async function searchResearchDatabases(
  repository: ProjectRepository,
  embeddingRouter: EmbeddingRouter,
  rawInput: ResearchMultiSearchInput,
  options: ResearchSearchExecutionOptions = {},
): Promise<ResearchMultiSearchResponse> {
  const input = ResearchMultiSearchInputSchema.parse(rawInput);
  assertResearchSearchNotAborted(options.abortSignal);
  const candidates: ResearchRetrievalCandidate[] = [];
  const issues: ResearchMultiSearchResponse["issues"] = [];
  const snapshotParts: string[] = [];
  const capabilityState = input.mode === "hybrid"
    ? await getResearchEmbeddingCapabilityState(repository, embeddingRouter)
    : null;
  assertResearchSearchNotAborted(options.abortSignal);
  snapshotParts.push(JSON.stringify({ capabilityState }));
  let queryEmbedding: number[] | null = null;
  let queryEmbeddingFailed = false;
  if (capabilityState?.usable && capabilityState.profileId && capabilityState.capability) {
    try {
      const embedded = await embeddingRouter.embed({
        profileId: capabilityState.profileId,
        inputs: [`${capabilityState.capability.capability.queryPrefix}${input.query}`],
        ...(options.abortSignal ? { abortSignal: options.abortSignal } : {}),
      });
      queryEmbedding = embedded.vectors[0]?.vector ?? null;
      queryEmbeddingFailed = !queryEmbedding;
    } catch (error) {
      if (options.abortSignal?.aborted) throw error;
      queryEmbeddingFailed = true;
    }
  }

  let semanticDatabaseCount = 0;
  for (const databaseId of input.databaseIds) {
    try {
      assertResearchSearchNotAborted(options.abortSignal);
      const database = await repository.getResearchDatabase(databaseId);
      const sourceDocuments = await repository.listResearchSources(databaseId);
      let aliases = null;
      try {
        aliases = await repository.getResearchQueryExpansions(databaseId);
      } catch {
        issues.push({
          researchDatabaseId: databaseId,
          code: "database-unavailable",
          message: "This database's alias authority could not be read; lexical search remains available.",
        });
      }
      snapshotParts.push(JSON.stringify({
        databaseId,
        databaseRevision: database.revision,
        sourceRevisions: sourceDocuments.map((document) => [document.source.id, document.revision]).sort(),
        aliasRevision: aliases?.revision ?? "unavailable",
      }));
      const lexicalQueries = [{ query: input.query, channel: null as null | "alias" | "transliteration" }];
      if (aliases) {
        lexicalQueries.push(...resolveResearchQueryExpansions(input.query, aliases).map((expansion) => ({
          query: expansion.expandedTerm,
          channel: expansion.channel,
        })));
      }
      for (const lexicalQuery of lexicalQueries) {
        assertResearchSearchNotAborted(options.abortSignal);
        const response = await repository.searchResearchSources(databaseId, {
          query: lexicalQuery.query,
          purpose: input.purpose,
          sourceKinds: input.sourceKinds,
          languageTags: input.languageTags,
          tags: input.tags,
          author: input.author,
          limit: 100,
        });
        response.results.forEach((result, index) => {
          const channels = lexicalQuery.channel ? [lexicalQuery.channel] : result.matchChannels;
          for (const channel of channels) {
            candidates.push({
              researchDatabaseId: databaseId,
              researchDatabaseName: database.database.name,
              sourceId: result.sourceId,
              sourceRevision: result.sourceRevision,
              sourceDisplayName: result.sourceDisplayName,
              sourceKind: result.sourceKind,
              chunkId: result.chunkId,
              blockId: result.blockId,
              blockOrder: result.blockOrder,
              chunkHash: result.chunkHash,
              originalText: result.originalText,
              languageTag: result.languageTag,
              location: result.location,
              channel,
              matchedQuery: lexicalQuery.query,
              channelRank: index + 1,
              rawScore: result.score,
            });
          }
        });
      }

      if (input.mode === "hybrid") {
        if (!capabilityState?.usable || !capabilityState.profileId) {
          issues.push({
            researchDatabaseId: databaseId,
            code: capabilityState?.bindingStatus === "unbound" ? "embedding-profile-unbound" : "embedding-profile-unvalidated",
            message: capabilityState?.reason ?? "Research multilingual Embedding is unavailable.",
          });
        } else if (queryEmbeddingFailed || !queryEmbedding) {
          issues.push({
            researchDatabaseId: databaseId,
            code: "embedding-request-failed",
            message: "The query Embedding request failed; exact channels remain available.",
          });
        } else {
          const vectorState = await getResearchVectorIndexState(repository, embeddingRouter, databaseId);
          assertResearchSearchNotAborted(options.abortSignal);
          snapshotParts.push(JSON.stringify({ databaseId, vectorState }));
          if (vectorState.status === "ready") {
            const vectorResults = await searchResearchVectorIndex(
              researchDatabaseRoot(repository.libraryRoot, databaseId),
              databaseId,
              queryEmbedding,
              100,
            );
            vectorResults.filter((result) => passesVectorFilters(result, input)).forEach((result, index) => {
              candidates.push({
                researchDatabaseId: databaseId,
                researchDatabaseName: database.database.name,
                sourceId: result.sourceId,
                sourceRevision: result.sourceRevision,
                sourceDisplayName: result.sourceDisplayName,
                sourceKind: result.sourceKind,
                chunkId: result.chunkId,
                blockId: result.blockId,
                blockOrder: result.blockOrder,
                chunkHash: result.chunkHash,
                originalText: result.originalText,
                languageTag: result.languageTag,
                location: result.location,
                channel: "semantic",
                matchedQuery: input.query,
                channelRank: index + 1,
                rawScore: 1 - result.distance,
              });
            });
            semanticDatabaseCount += 1;
          } else {
            issues.push({
              researchDatabaseId: databaseId,
              code: vectorState.status === "stale" ? "vector-index-stale" : "vector-index-unavailable",
              message: vectorState.reason ?? "This database's vector index is unavailable.",
            });
          }
        }
      }
    } catch (error) {
      if (options.abortSignal?.aborted) throw error;
      issues.push({
        researchDatabaseId: databaseId,
        code: "database-unavailable",
        message: "This Research Database could not be searched; healthy selected databases remain available.",
      });
      snapshotParts.push(JSON.stringify({ databaseId, unavailable: true }));
    }
  }

  assertResearchSearchNotAborted(options.abortSignal);
  const snapshotFingerprint = createHash("sha256").update(snapshotParts.sort().join("\n"), "utf8").digest("hex");
  const page = fuseResearchRetrievalCandidates(candidates, {
    selectedDatabaseIds: input.databaseIds,
    requestFingerprint: requestFingerprint(input),
    snapshotFingerprint,
    limit: input.limit,
    ...(input.cursor ? { cursor: input.cursor } : {}),
  });
  const effectiveMode = input.mode === "exact"
    ? "exact"
    : semanticDatabaseCount > 0 ? "hybrid" : "degraded-exact";
  return ResearchMultiSearchResponseSchema.parse({
    query: input.query,
    selectedDatabaseIds: input.databaseIds,
    requestedMode: input.mode,
    effectiveMode,
    results: page.results,
    issues,
    nextCursor: page.nextCursor,
  });
}
