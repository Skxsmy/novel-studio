import {
  ResearchEmbeddingCapabilitySchema,
  ValidateResearchEmbeddingCapabilityInputSchema,
  type EmbeddingModelProfile,
  type ResearchEmbeddingCapability,
  type ValidateResearchEmbeddingCapabilityInput,
} from "@novel-studio/contracts";
import type { EmbeddingRouter } from "./embeddings.js";

export const RESEARCH_CAPABILITY_POSITIVE_MEAN_MINIMUM = 0.55;
export const RESEARCH_CAPABILITY_POSITIVE_PAIR_MINIMUM = 0.35;
export const RESEARCH_CAPABILITY_SEPARATION_MINIMUM = 0.2;

interface ValidationOptions {
  now?: () => Date;
}

const QUERIES = [
  { id: "q-zh", text: "江户时代供旅行者住宿的旅馆" },
  { id: "q-ja", text: "江戸時代に旅人が泊まった宿" },
  { id: "q-en", text: "an inn where travelers stayed during the Edo period" },
] as const;

const POSITIVE_DOCUMENTS = [
  { id: "p-zh", text: "江户时期，驿站城镇的旅馆为赶路的人提供住宿。" },
  { id: "p-ja", text: "江戸時代の宿場町では、旅籠が旅人に宿を提供した。" },
  { id: "p-en", text: "In Edo-period post towns, inns provided lodging to travelers." },
] as const;

const NEGATIVE_DOCUMENTS = [
  { id: "n-zh", text: "恒星光谱可以用来分析遥远天体的化学成分。" },
  { id: "n-ja", text: "複式簿記では、すべての取引を借方と貸方に記録する。" },
  { id: "n-en", text: "A compiler transforms source code into executable instructions." },
] as const;

function languageBase(tag: string): string {
  return tag.toLocaleLowerCase("und").split("-")[0] ?? "";
}

function cosine(left: number[], right: number[]): number {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }
  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function failedCapability(
  profile: EmbeddingModelProfile,
  profileRevision: string,
  input: ValidateResearchEmbeddingCapabilityInput,
  reason: string,
  now: Date,
): ResearchEmbeddingCapability {
  return ResearchEmbeddingCapabilitySchema.parse({
    schemaVersion: 1,
    profileId: profile.id,
    profileRevision,
    useCase: "research.multilingual",
    dimensions: profile.dimensions,
    supportedLanguageTags: input.supportedLanguageTags,
    sharedSpaceDeclared: input.sharedSpaceDeclared,
    documentPrefix: input.documentPrefix,
    queryPrefix: input.queryPrefix,
    validationStatus: "failed",
    validationFixtureVersion: 1,
    metrics: null,
    validatedAt: now.toISOString(),
    failureReason: reason,
  });
}

export async function validateResearchEmbeddingCapability(
  router: EmbeddingRouter,
  profile: EmbeddingModelProfile,
  profileRevision: string,
  rawInput: ValidateResearchEmbeddingCapabilityInput,
  options: ValidationOptions = {},
): Promise<ResearchEmbeddingCapability> {
  const input = ValidateResearchEmbeddingCapabilityInputSchema.parse(rawInput);
  const now = (options.now ?? (() => new Date()))();
  const languages = new Set(input.supportedLanguageTags.map(languageBase));
  if (!["zh", "ja", "en"].every((language) => languages.has(language))) {
    return failedCapability(profile, profileRevision, input, "Capability must declare Chinese, Japanese, and English coverage.", now);
  }
  if (!input.sharedSpaceDeclared) {
    return failedCapability(profile, profileRevision, input, "The profile has not declared one shared multilingual vector space.", now);
  }

  const inputs = [
    ...QUERIES.map((item) => ({ id: item.id, text: `${input.queryPrefix}${item.text}` })),
    ...POSITIVE_DOCUMENTS.map((item) => ({ id: item.id, text: `${input.documentPrefix}${item.text}` })),
    ...NEGATIVE_DOCUMENTS.map((item) => ({ id: item.id, text: `${input.documentPrefix}${item.text}` })),
  ];
  const embedded = await router.embed({ profileId: profile.id, inputs });
  const vectors = new Map(embedded.vectors.map((item) => [item.inputId, item.vector]));
  const required = inputs.map((item) => item.id);
  if (required.some((id) => !vectors.has(id))) {
    return failedCapability(profile, profileRevision, input, "Embedding validation returned incomplete fixture vectors.", now);
  }

  const positivePairs = [
    ["q-zh", "p-ja"], ["q-zh", "p-en"],
    ["q-ja", "p-zh"], ["q-ja", "p-en"],
    ["q-en", "p-zh"], ["q-en", "p-ja"],
  ] as const;
  const positiveScores = positivePairs.map(([queryId, documentId]) =>
    cosine(vectors.get(queryId)!, vectors.get(documentId)!));
  const negativeScores = QUERIES.flatMap((query) => NEGATIVE_DOCUMENTS.map((document) =>
    cosine(vectors.get(query.id)!, vectors.get(document.id)!)));
  const positivePairMean = mean(positiveScores);
  const positivePairMinimum = Math.min(...positiveScores);
  const negativePairMean = mean(negativeScores);
  const separation = positivePairMean - negativePairMean;
  const metrics = { positivePairMean, positivePairMinimum, negativePairMean, separation };
  const passed = positivePairMean >= RESEARCH_CAPABILITY_POSITIVE_MEAN_MINIMUM
    && positivePairMinimum >= RESEARCH_CAPABILITY_POSITIVE_PAIR_MINIMUM
    && separation >= RESEARCH_CAPABILITY_SEPARATION_MINIMUM;

  return ResearchEmbeddingCapabilitySchema.parse({
    schemaVersion: 1,
    profileId: profile.id,
    profileRevision,
    useCase: "research.multilingual",
    dimensions: profile.dimensions,
    supportedLanguageTags: input.supportedLanguageTags,
    sharedSpaceDeclared: input.sharedSpaceDeclared,
    documentPrefix: input.documentPrefix,
    queryPrefix: input.queryPrefix,
    validationStatus: passed ? "passed" : "failed",
    validationFixtureVersion: 1,
    metrics,
    validatedAt: now.toISOString(),
    failureReason: passed ? null : "Cross-language fixture separation did not meet the Research threshold.",
  });
}
