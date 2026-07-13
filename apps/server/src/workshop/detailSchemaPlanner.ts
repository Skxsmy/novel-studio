import type {
  CodexCategoryId,
  CodexDetailTypeDocument,
  WorkshopCodexDetailSchemaPlannerState,
  WorkshopCodexDraftMissingDetailType,
  WorkshopCodexDetailTypeSuggestion,
} from "@novel-studio/contracts";
import type { EmbeddingRouter } from "@novel-studio/ai";
import { StorageError, type ProjectRepository } from "@novel-studio/storage";

const USE_CASE = "codex.detail-schema" as const;
const MAX_SUGGESTIONS = 3;
const RECOMMENDATION_SCORE = 0.68;
const RECOMMENDATION_MARGIN = 0.06;

export interface WorkshopDetailSchemaPlan {
  missingDetailTypes: WorkshopCodexDraftMissingDetailType[];
  planner: WorkshopCodexDetailSchemaPlannerState;
}

interface PlannerRepository {
  getEmbeddingModelProfile: ProjectRepository["getEmbeddingModelProfile"];
  getEmbeddingUseCaseBinding: ProjectRepository["getEmbeddingUseCaseBinding"];
}

export async function planWorkshopDetailSchema(input: {
  categoryId: CodexCategoryId;
  missingDetailTypes: WorkshopCodexDraftMissingDetailType[];
  availableDetailTypes: CodexDetailTypeDocument[];
  embeddingRouter: EmbeddingRouter;
  repository: PlannerRepository;
}): Promise<WorkshopDetailSchemaPlan> {
  const missing = input.missingDetailTypes.map((detail) => ({ ...detail, suggestions: [] }));
  const candidates = input.availableDetailTypes.filter(
    (document) => document.detailType.categoryId === input.categoryId,
  );
  if (missing.length === 0) {
    return {
      missingDetailTypes: [],
      planner: readyState("All draft detail labels already match reusable detail types."),
    };
  }
  if (candidates.length === 0) {
    return {
      missingDetailTypes: missing,
      planner: unconfiguredState("No reusable detail types exist in this category yet."),
    };
  }

  let profileId: string;
  try {
    const binding = await input.repository.getEmbeddingUseCaseBinding(USE_CASE);
    profileId = binding.profileId;
  } catch (error) {
    if (error instanceof StorageError && error.code === "NOT_FOUND") {
      return {
        missingDetailTypes: missing,
        planner: unconfiguredState("No detail matching model is configured. Choose a match manually or create a type."),
      };
    }
    return {
      missingDetailTypes: missing,
      planner: unavailableState("The detail matching configuration is unavailable. Choose a match manually or create a type."),
    };
  }
  try {
    const profile = await input.repository.getEmbeddingModelProfile(profileId);
    if (profile.archivedAt) {
      return {
        missingDetailTypes: missing,
        planner: unavailableState("The configured detail matching model is archived. Choose a match manually or create a type."),
      };
    }
  } catch {
    return {
      missingDetailTypes: missing,
      planner: unavailableState("The configured detail matching model is missing or invalid. Choose a match manually or create a type."),
    };
  }

  try {
    const result = await input.embeddingRouter.embed({
      useCase: USE_CASE,
      profileId,
      inputs: [
        ...missing.map((detail) => ({ id: `draft:${detail.label}`, text: detail.label })),
        ...candidates.map((document) => ({
          id: `type:${document.detailType.id}`,
          text: document.detailType.name,
        })),
      ],
    });
    const vectors = new Map(
      result.vectors.flatMap((item) => item.inputId ? [[item.inputId, item.vector] as const] : []),
    );
    const planned = missing.map((detail) => {
      const draftVector = vectors.get(`draft:${detail.label}`);
      if (!draftVector) return detail;
      const ranked = candidates
        .flatMap((document) => {
          const candidateVector = vectors.get(`type:${document.detailType.id}`);
          if (!candidateVector) return [];
          return [{
            document,
            score: cosineScore(draftVector, candidateVector),
          }];
        })
        .sort((left, right) =>
          right.score - left.score ||
          left.document.detailType.name.localeCompare(right.document.detailType.name, "und"),
        )
        .slice(0, MAX_SUGGESTIONS);
      const top = ranked[0]?.score ?? 0;
      const runnerUp = ranked[1]?.score ?? 0;
      const hasRecommendation = top >= RECOMMENDATION_SCORE && top - runnerUp >= RECOMMENDATION_MARGIN;
      const suggestions: WorkshopCodexDetailTypeSuggestion[] = ranked.map((candidate, index) => ({
        detailTypeId: candidate.document.detailType.id,
        name: candidate.document.detailType.name,
        score: candidate.score,
        recommended: index === 0 && hasRecommendation,
        reason: index === 0 && hasRecommendation
          ? "Strong semantic match to an existing reusable detail type."
          : "Possible reusable detail type; review before applying.",
      }));
      return { ...detail, suggestions };
    });
    return {
      missingDetailTypes: planned,
      planner: readyState("Reusable detail type suggestions are ready for author review."),
    };
  } catch {
    return {
      missingDetailTypes: missing,
      planner: unavailableState("Detail matching could not run. Choose a match manually or create a type; no fallback model was used."),
    };
  }
}

function cosineScore(left: number[], right: number[]): number {
  if (left.length !== right.length || left.length === 0) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index]!;
    const rightValue = right[index]!;
    dot += leftValue * rightValue;
    leftNorm += leftValue * leftValue;
    rightNorm += rightValue * rightValue;
  }
  const denominator = Math.sqrt(leftNorm) * Math.sqrt(rightNorm);
  if (!Number.isFinite(denominator) || denominator === 0) return 0;
  return Math.max(0, Math.min(1, dot / denominator));
}

function readyState(message: string): WorkshopCodexDetailSchemaPlannerState {
  return { status: "ready", message };
}

function unconfiguredState(message: string): WorkshopCodexDetailSchemaPlannerState {
  return { status: "unconfigured", message };
}

function unavailableState(message: string): WorkshopCodexDetailSchemaPlannerState {
  return { status: "unavailable", message };
}
