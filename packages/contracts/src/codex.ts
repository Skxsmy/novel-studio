import { z } from "zod";
import { DefaultCodexEntryValues } from "./defaults.js";

export const CodexBuiltInCategoryIdSchema = z.enum([
  "uncategorized",
  "character",
  "location",
  "object",
  "lore",
  "organization",
  "plot-thread",
]);
export type CodexBuiltInCategoryId = z.infer<typeof CodexBuiltInCategoryIdSchema>;

export const CodexCategoryIdSchema = z.union([
  CodexBuiltInCategoryIdSchema,
  z.string().uuid(),
]);
export type CodexCategoryId = z.infer<typeof CodexCategoryIdSchema>;

export const CodexCustomCategorySchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  icon: z.string().trim().min(1).max(12).default("●"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable().default(null),
});
export type CodexCustomCategory = z.infer<typeof CodexCustomCategorySchema>;

export const CodexCategorySchema = z.object({
  id: CodexCategoryIdSchema,
  name: z.string(),
  icon: z.string(),
  builtIn: z.boolean(),
  archivedAt: z.string().datetime().nullable(),
});
export type CodexCategory = z.infer<typeof CodexCategorySchema>;

export const CodexCategoryDocumentSchema = z.object({
  category: CodexCategorySchema,
  revision: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
});
export type CodexCategoryDocument = z.infer<typeof CodexCategoryDocumentSchema>;

export const CreateCodexCategoryInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  icon: z.string().trim().min(1).max(12).default("●"),
});
export type CreateCodexCategoryInput = z.input<typeof CreateCodexCategoryInputSchema>;

export const UpdateCodexCategoryInputSchema = z
  .object({
    baseRevision: z.string().regex(/^[a-f0-9]{64}$/),
    name: z.string().trim().min(1).max(80).optional(),
    icon: z.string().trim().min(1).max(12).optional(),
  })
  .superRefine((input, context) => {
    if (input.name === undefined && input.icon === undefined) {
      context.addIssue({ code: "custom", message: "At least one category field is required" });
    }
  });
export type UpdateCodexCategoryInput = z.infer<typeof UpdateCodexCategoryInputSchema>;

export const CodexDetailTypeSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  categoryId: CodexCategoryIdSchema,
  name: z.string().trim().min(1).max(120),
  nsfw: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CodexDetailType = z.infer<typeof CodexDetailTypeSchema>;

export const CodexDetailTypeDocumentSchema = z.object({
  detailType: CodexDetailTypeSchema,
  revision: z.string().regex(/^[a-f0-9]{64}$/),
});
export type CodexDetailTypeDocument = z.infer<typeof CodexDetailTypeDocumentSchema>;

export const CreateCodexDetailTypeInputSchema = z.object({
  categoryId: CodexCategoryIdSchema,
  name: z.string().trim().min(1).max(120),
  nsfw: z.boolean().default(false),
});
export type CreateCodexDetailTypeInput = z.input<typeof CreateCodexDetailTypeInputSchema>;

export const UpdateCodexDetailTypeInputSchema = z.object({
  baseRevision: z.string().regex(/^[a-f0-9]{64}$/),
  nsfw: z.boolean(),
});
export type UpdateCodexDetailTypeInput = z.infer<typeof UpdateCodexDetailTypeInputSchema>;

export const DeleteCodexDetailTypeResultSchema = z.object({
  deletedId: z.string().uuid(),
});
export type DeleteCodexDetailTypeResult = z.infer<typeof DeleteCodexDetailTypeResultSchema>;

export const CodexAiContextPolicySchema = z.enum([
  "always",
  "on-mention",
  "manual",
  "never",
]);
export type CodexAiContextPolicy = z.infer<typeof CodexAiContextPolicySchema>;

export const CodexMentionRulesSchema = z.object({
  caseSensitive: z.boolean().default(false),
  matchAliases: z.boolean().default(true),
  automaticPlural: z.boolean().default(false),
  excludedTerms: z.array(z.string().trim().min(1).max(160)).default([]),
});
export type CodexMentionRules = z.infer<typeof CodexMentionRulesSchema>;

export const CodexEntryMetadataSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  categoryId: CodexCategoryIdSchema,
  name: z.string().trim().min(1).max(160),
  aliases: z.array(z.string().trim().min(1).max(160)).default([]),
  thumbnail: z.string().max(500).nullable().default(null),
  details: z.record(z.string(), z.string().max(16000)).default({}),
  detailAiContext: z.record(z.string(), z.boolean()).default({}),
  aiContextPolicy: CodexAiContextPolicySchema.default("on-mention"),
  mention: CodexMentionRulesSchema.default({
    caseSensitive: false,
    matchAliases: true,
    automaticPlural: false,
    excludedTerms: [],
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable().default(null),
});
export type CodexEntryMetadata = z.infer<typeof CodexEntryMetadataSchema>;

export const CodexResearchMetadataSchema = z.object({
  schemaVersion: z.literal(1),
  entryId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CodexResearchMetadata = z.infer<typeof CodexResearchMetadataSchema>;

export const CodexResearchDocumentSchema = z.object({
  metadata: CodexResearchMetadataSchema,
  content: z.string(),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  relativePath: z.string(),
});
export type CodexResearchDocument = z.infer<typeof CodexResearchDocumentSchema>;

export const CodexEntryDocumentSchema = z.object({
  metadata: CodexEntryMetadataSchema,
  description: z.string(),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  relativePath: z.string(),
  research: CodexResearchDocumentSchema,
});
export type CodexEntryDocument = z.infer<typeof CodexEntryDocumentSchema>;

export const CodexFieldProgressionFieldSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("description"),
    detailTypeId: z.null().default(null),
  }),
  z.object({
    kind: z.literal("detail"),
    detailTypeId: z.string().uuid(),
  }),
]);
export type CodexFieldProgressionField = z.infer<typeof CodexFieldProgressionFieldSchema>;

export const CodexProgressionOperationSchema = z.enum(["add", "replace"]);
export type CodexProgressionOperation = z.infer<typeof CodexProgressionOperationSchema>;

export const CodexProgressionSourceSchema = z
  .object({
    kind: z.enum(["write-block", "codex-page", "proposal"]),
    sceneId: z.string().uuid().nullable().default(null),
    blockId: z.string().uuid().nullable().default(null),
    sourceId: z.string().uuid().nullable().default(null),
  })
  .superRefine((source, context) => {
    if (source.kind === "write-block" && !source.sceneId) {
      context.addIssue({
        code: "custom",
        message: "Write-block field progression source requires sceneId",
        path: ["sceneId"],
      });
    }
    if (source.kind === "write-block" && !source.blockId) {
      context.addIssue({
        code: "custom",
        message: "Write-block field progression source requires blockId",
        path: ["blockId"],
      });
    }
    if (source.kind === "proposal" && !source.sourceId) {
      context.addIssue({
        code: "custom",
        message: "Proposal progression source requires sourceId",
        path: ["sourceId"],
      });
    }
  });
export type CodexProgressionSource = z.infer<typeof CodexProgressionSourceSchema>;

export const CodexFieldProgressionOperationSchema = CodexProgressionOperationSchema;
export type CodexFieldProgressionOperation = CodexProgressionOperation;
export const CodexFieldProgressionSourceSchema = CodexProgressionSourceSchema;
export type CodexFieldProgressionSource = CodexProgressionSource;

export const CodexEffectiveFieldStateSchema = z.object({
  field: CodexFieldProgressionFieldSchema,
  source: z.enum(["baseline", "progression"]),
  lastProgressionId: z.string().uuid().nullable(),
  hiddenFutureCount: z.number().int().nonnegative(),
});
export type CodexEffectiveFieldState = z.infer<typeof CodexEffectiveFieldStateSchema>;

export const CodexEffectiveEntrySchema = z.object({
  sceneId: z.string().uuid(),
  blockId: z.string().uuid().nullable().default(null),
  entry: CodexEntryDocumentSchema,
  fieldStates: z.array(CodexEffectiveFieldStateSchema),
  hiddenFutureFieldProgressionCount: z.number().int().nonnegative(),
});
export type CodexEffectiveEntry = z.infer<typeof CodexEffectiveEntrySchema>;

export const CreateCodexEntryInputSchema = z.object({
  categoryId: CodexCategoryIdSchema.default(DefaultCodexEntryValues.categoryId),
  name: z.string().trim().min(1).max(160).default(DefaultCodexEntryValues.name),
  aliases: z.array(z.string().trim().min(1).max(160)).default([]),
  thumbnail: z.string().max(500).nullable().default(null),
  details: z.record(z.string(), z.string().max(16000)).default({}),
  detailAiContext: z.record(z.string(), z.boolean()).default({}),
  aiContextPolicy: CodexAiContextPolicySchema.default("on-mention"),
  mention: CodexMentionRulesSchema.default({
    caseSensitive: false,
    matchAliases: true,
    automaticPlural: false,
    excludedTerms: [],
  }),
  description: z.string().default(DefaultCodexEntryValues.description),
  research: z.string().default(DefaultCodexEntryValues.research),
});
export type CreateCodexEntryInput = z.input<typeof CreateCodexEntryInputSchema>;

export const UpdateCodexEntryInputSchema = z
  .object({
    baseRevision: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    baseResearchRevision: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    categoryId: CodexCategoryIdSchema.optional(),
    name: z.string().trim().min(1).max(160).optional(),
    aliases: z.array(z.string().trim().min(1).max(160)).optional(),
    thumbnail: z.string().max(500).nullable().optional(),
    details: z.record(z.string(), z.string().max(16000)).optional(),
    detailAiContext: z.record(z.string(), z.boolean()).optional(),
    aiContextPolicy: CodexAiContextPolicySchema.optional(),
    mention: CodexMentionRulesSchema.optional(),
    description: z.string().optional(),
    research: z.string().optional(),
  })
  .superRefine((input, context) => {
    const entryFields = [
      input.categoryId,
      input.name,
      input.aliases,
      input.thumbnail,
      input.details,
      input.detailAiContext,
      input.aiContextPolicy,
      input.mention,
      input.description,
    ];
    const changesEntry = entryFields.some((value) => value !== undefined);
    const changesResearch = input.research !== undefined;
    if (!changesEntry && !changesResearch) {
      context.addIssue({ code: "custom", message: "At least one Codex field is required" });
    }
    if (changesEntry && !input.baseRevision) {
      context.addIssue({ code: "custom", message: "baseRevision is required for entry changes" });
    }
    if (changesResearch && !input.baseResearchRevision) {
      context.addIssue({ code: "custom", message: "baseResearchRevision is required for research changes" });
    }
  });
export type UpdateCodexEntryInput = z.infer<typeof UpdateCodexEntryInputSchema>;

export const ArchiveCodexDocumentInputSchema = z.object({
  baseRevision: z.string().regex(/^[a-f0-9]{64}$/),
});
export type ArchiveCodexDocumentInput = z.infer<typeof ArchiveCodexDocumentInputSchema>;

export const DeleteCodexDocumentInputSchema = z.object({
  baseRevision: z.string().regex(/^[a-f0-9]{64}$/),
});
export type DeleteCodexDocumentInput = z.infer<typeof DeleteCodexDocumentInputSchema>;

export const DeleteCodexCategoryResultSchema = z.object({
  deletedId: CodexCategoryIdSchema,
  movedEntryIds: z.array(z.string().uuid()),
});
export type DeleteCodexCategoryResult = z.infer<typeof DeleteCodexCategoryResultSchema>;

export const DeleteCodexEntryResultSchema = z.object({
  deletedId: z.string().uuid(),
});
export type DeleteCodexEntryResult = z.infer<typeof DeleteCodexEntryResultSchema>;

export const CodexRelationSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  sourceEntryId: z.string().uuid(),
  targetEntryId: z.string().uuid(),
  type: z.string().trim().min(1).max(120),
  directed: z.boolean().default(true),
  description: z.string().max(16000).default(""),
  evidence: z.string().max(16000).default(""),
  validFromSceneId: z.string().uuid().nullable().default(null),
  validToSceneId: z.string().uuid().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable().default(null),
});
export type CodexRelation = z.infer<typeof CodexRelationSchema>;

export const CodexRelationDocumentSchema = z.object({
  relation: CodexRelationSchema,
  revision: z.string().regex(/^[a-f0-9]{64}$/),
});
export type CodexRelationDocument = z.infer<typeof CodexRelationDocumentSchema>;

export const EvidenceSourceTypeSchema = z.enum([
  "scene",
  "codex-entry",
  "relation",
]);
export type EvidenceSourceType = z.infer<typeof EvidenceSourceTypeSchema>;

export const EvidenceSchema = z.object({
  sourceType: EvidenceSourceTypeSchema,
  sourceId: z.string().uuid(),
  quote: z.string().max(16000).default(""),
  note: z.string().trim().min(1).max(16000),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const CodexProgressionSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().uuid(),
    kind: z.enum(["field", "world", "relationship"]),
    entryId: z.string().uuid().nullable().default(null),
    relationId: z.string().uuid().nullable().default(null),
    field: CodexFieldProgressionFieldSchema.nullable().default(null),
    fieldKey: z.string().trim().min(1).max(120).nullable().default(null),
    operation: CodexProgressionOperationSchema,
    body: z.string().max(16000).default(""),
    summary: z.string().trim().max(16000).default(""),
    effectiveFromSceneId: z.string().uuid(),
    effectiveToSceneId: z.string().uuid().nullable().default(null),
    source: CodexProgressionSourceSchema,
    evidence: z.array(EvidenceSchema).default([]),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    archivedAt: z.string().datetime().nullable().default(null),
  })
  .superRefine((progression, context) => {
    if (progression.kind === "field") {
      if (!progression.entryId) {
        context.addIssue({ code: "custom", message: "Field progression requires entryId", path: ["entryId"] });
      }
      if (!progression.field) {
        context.addIssue({ code: "custom", message: "Field progression requires field", path: ["field"] });
      }
      if (progression.relationId) {
        context.addIssue({ code: "custom", message: "Field progression cannot target relationId", path: ["relationId"] });
      }
    }
    if (progression.kind === "world") {
      if (!progression.entryId) {
        context.addIssue({ code: "custom", message: "World progression requires entryId", path: ["entryId"] });
      }
      if (!progression.fieldKey) {
        context.addIssue({ code: "custom", message: "World progression requires fieldKey", path: ["fieldKey"] });
      }
      if (progression.relationId) {
        context.addIssue({ code: "custom", message: "World progression cannot target relationId", path: ["relationId"] });
      }
      if (!progression.summary.trim()) {
        context.addIssue({ code: "custom", message: "World progression requires summary", path: ["summary"] });
      }
      if (progression.evidence.length === 0) {
        context.addIssue({ code: "custom", message: "World progression requires evidence", path: ["evidence"] });
      }
    }
    if (progression.kind === "relationship") {
      if (!progression.relationId) {
        context.addIssue({ code: "custom", message: "Relationship progression requires relationId", path: ["relationId"] });
      }
      if (!progression.fieldKey) {
        context.addIssue({ code: "custom", message: "Relationship progression requires fieldKey", path: ["fieldKey"] });
      }
      if (progression.entryId) {
        context.addIssue({ code: "custom", message: "Relationship progression cannot target entryId", path: ["entryId"] });
      }
      if (!progression.summary.trim()) {
        context.addIssue({ code: "custom", message: "Relationship progression requires summary", path: ["summary"] });
      }
      if (progression.evidence.length === 0) {
        context.addIssue({ code: "custom", message: "Relationship progression requires evidence", path: ["evidence"] });
      }
    }
    if (progression.effectiveToSceneId === progression.effectiveFromSceneId) {
      context.addIssue({
        code: "custom",
        message: "effectiveToSceneId cannot equal effectiveFromSceneId",
        path: ["effectiveToSceneId"],
      });
    }
  });
export type CodexProgression = z.infer<typeof CodexProgressionSchema>;

export const CodexProgressionDocumentSchema = z.object({
  progression: CodexProgressionSchema,
  revision: z.string().regex(/^[a-f0-9]{64}$/),
});
export type CodexProgressionDocument = z.infer<typeof CodexProgressionDocumentSchema>;

export const CreateCodexProgressionInputSchema = z.object({
  kind: z.enum(["field", "world", "relationship"]),
  entryId: z.string().uuid().nullable().default(null),
  relationId: z.string().uuid().nullable().default(null),
  field: CodexFieldProgressionFieldSchema.nullable().default(null),
  fieldKey: z.string().trim().min(1).max(120).nullable().default(null),
  operation: CodexProgressionOperationSchema,
  body: z.string().max(16000).default(""),
  summary: z.string().trim().max(16000).default(""),
  effectiveFromSceneId: z.string().uuid(),
  effectiveToSceneId: z.string().uuid().nullable().default(null),
  source: CodexProgressionSourceSchema,
  evidence: z.array(EvidenceSchema).default([]),
}).superRefine((input, context) => {
  if (input.kind === "field") {
    if (!input.entryId) {
      context.addIssue({ code: "custom", message: "Field progression requires entryId", path: ["entryId"] });
    }
    if (!input.field) {
      context.addIssue({ code: "custom", message: "Field progression requires field", path: ["field"] });
    }
    if (input.relationId) {
      context.addIssue({ code: "custom", message: "Field progression cannot target relationId", path: ["relationId"] });
    }
  }
  if (input.kind === "world") {
    if (!input.entryId) {
      context.addIssue({ code: "custom", message: "World progression requires entryId", path: ["entryId"] });
    }
    if (!input.fieldKey) {
      context.addIssue({ code: "custom", message: "World progression requires fieldKey", path: ["fieldKey"] });
    }
    if (input.relationId) {
      context.addIssue({ code: "custom", message: "World progression cannot target relationId", path: ["relationId"] });
    }
    if (!input.summary.trim()) {
      context.addIssue({ code: "custom", message: "World progression requires summary", path: ["summary"] });
    }
    if (input.evidence.length === 0) {
      context.addIssue({ code: "custom", message: "World progression requires evidence", path: ["evidence"] });
    }
  }
  if (input.kind === "relationship") {
    if (!input.relationId) {
      context.addIssue({ code: "custom", message: "Relationship progression requires relationId", path: ["relationId"] });
    }
    if (!input.fieldKey) {
      context.addIssue({ code: "custom", message: "Relationship progression requires fieldKey", path: ["fieldKey"] });
    }
    if (input.entryId) {
      context.addIssue({ code: "custom", message: "Relationship progression cannot target entryId", path: ["entryId"] });
    }
    if (!input.summary.trim()) {
      context.addIssue({ code: "custom", message: "Relationship progression requires summary", path: ["summary"] });
    }
    if (input.evidence.length === 0) {
      context.addIssue({ code: "custom", message: "Relationship progression requires evidence", path: ["evidence"] });
    }
  }
  if (input.effectiveToSceneId === input.effectiveFromSceneId) {
    context.addIssue({
      code: "custom",
      message: "effectiveToSceneId cannot equal effectiveFromSceneId",
      path: ["effectiveToSceneId"],
    });
  }
});
export type CreateCodexProgressionInput = z.input<typeof CreateCodexProgressionInputSchema>;

export const UpdateCodexProgressionInputSchema = z.object({
  baseRevision: z.string().regex(/^[a-f0-9]{64}$/),
  kind: z.enum(["field", "world", "relationship"]).optional(),
  entryId: z.string().uuid().nullable().optional(),
  relationId: z.string().uuid().nullable().optional(),
  field: CodexFieldProgressionFieldSchema.nullable().optional(),
  fieldKey: z.string().trim().min(1).max(120).nullable().optional(),
  operation: CodexProgressionOperationSchema.optional(),
  body: z.string().max(16000).optional(),
  summary: z.string().trim().max(16000).optional(),
  effectiveFromSceneId: z.string().uuid().optional(),
  effectiveToSceneId: z.string().uuid().nullable().optional(),
  source: CodexProgressionSourceSchema.optional(),
  evidence: z.array(EvidenceSchema).optional(),
}).superRefine((input, context) => {
  if (Object.keys(input).every((key) => key === "baseRevision")) {
    context.addIssue({ code: "custom", message: "At least one progression field is required" });
  }
});
export type UpdateCodexProgressionInput = z.infer<typeof UpdateCodexProgressionInputSchema>;

export const DeleteCodexProgressionBlockerSchema = z.object({
  kind: z.enum(["write-block", "proposal", "model-call", "character-knowledge"]),
  id: z.string(),
  reason: z.string(),
});
export type DeleteCodexProgressionBlocker = z.infer<typeof DeleteCodexProgressionBlockerSchema>;

export const DeleteCodexProgressionResultSchema = z.object({
  deletedId: z.string().uuid(),
  blockers: z.array(DeleteCodexProgressionBlockerSchema).default([]),
});
export type DeleteCodexProgressionResult = z.infer<typeof DeleteCodexProgressionResultSchema>;

export const CodexKnowledgeStanceSchema = z.enum([
  "knows",
  "believes",
  "misunderstands",
]);
export type CodexKnowledgeStance = z.infer<typeof CodexKnowledgeStanceSchema>;

export const CodexKnowledgeSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().uuid(),
    characterEntryId: z.string().uuid(),
    subjectEntryId: z.string().uuid().nullable().default(null),
    relationId: z.string().uuid().nullable().default(null),
    stance: CodexKnowledgeStanceSchema,
    summary: z.string().trim().min(1).max(16000),
    truthProgressionId: z.string().uuid().nullable().default(null),
    effectiveFromSceneId: z.string().uuid(),
    effectiveToSceneId: z.string().uuid().nullable().default(null),
    evidence: z.array(EvidenceSchema).min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    archivedAt: z.string().datetime().nullable().default(null),
  })
  .superRefine((knowledge, context) => {
    if (!knowledge.subjectEntryId && !knowledge.relationId) {
      context.addIssue({
        code: "custom",
        message: "Character knowledge must reference an entry or relation",
        path: ["subjectEntryId"],
      });
    }
    if (knowledge.effectiveToSceneId === knowledge.effectiveFromSceneId) {
      context.addIssue({
        code: "custom",
        message: "effectiveToSceneId cannot equal effectiveFromSceneId",
        path: ["effectiveToSceneId"],
      });
    }
  });
export type CodexKnowledge = z.infer<typeof CodexKnowledgeSchema>;

export const CodexKnowledgeDocumentSchema = z.object({
  knowledge: CodexKnowledgeSchema,
  revision: z.string().regex(/^[a-f0-9]{64}$/),
});
export type CodexKnowledgeDocument = z.infer<typeof CodexKnowledgeDocumentSchema>;

export const CreateCodexKnowledgeInputSchema = z
  .object({
    characterEntryId: z.string().uuid(),
    subjectEntryId: z.string().uuid().nullable().default(null),
    relationId: z.string().uuid().nullable().default(null),
    stance: CodexKnowledgeStanceSchema,
    summary: z.string().trim().min(1).max(16000),
    truthProgressionId: z.string().uuid().nullable().default(null),
    effectiveFromSceneId: z.string().uuid(),
    effectiveToSceneId: z.string().uuid().nullable().default(null),
    evidence: z.array(EvidenceSchema).min(1),
  })
  .superRefine((knowledge, context) => {
    if (!knowledge.subjectEntryId && !knowledge.relationId) {
      context.addIssue({
        code: "custom",
        message: "Character knowledge must reference an entry or relation",
        path: ["subjectEntryId"],
      });
    }
  });
export type CreateCodexKnowledgeInput = z.input<typeof CreateCodexKnowledgeInputSchema>;

export const UpdateCodexKnowledgeInputSchema = z
  .object({
    baseRevision: z.string().regex(/^[a-f0-9]{64}$/),
    characterEntryId: z.string().uuid().optional(),
    subjectEntryId: z.string().uuid().nullable().optional(),
    relationId: z.string().uuid().nullable().optional(),
    stance: CodexKnowledgeStanceSchema.optional(),
    summary: z.string().trim().min(1).max(16000).optional(),
    truthProgressionId: z.string().uuid().nullable().optional(),
    effectiveFromSceneId: z.string().uuid().optional(),
    effectiveToSceneId: z.string().uuid().nullable().optional(),
    evidence: z.array(EvidenceSchema).min(1).optional(),
  })
  .superRefine((input, context) => {
    if (Object.keys(input).every((key) => key === "baseRevision")) {
      context.addIssue({ code: "custom", message: "At least one knowledge field is required" });
    }
  });
export type UpdateCodexKnowledgeInput = z.infer<typeof UpdateCodexKnowledgeInputSchema>;

export const CodexRelationEffectiveStateSchema = z.object({
  relation: CodexRelationDocumentSchema,
  progressions: z.array(CodexProgressionDocumentSchema),
});
export type CodexRelationEffectiveState = z.infer<typeof CodexRelationEffectiveStateSchema>;

export const CodexEffectiveStateSchema = z.object({
  sceneId: z.string().uuid(),
  narrativeIndex: z.number().int().positive(),
  entry: CodexEntryDocumentSchema,
  worldFacts: z.array(CodexProgressionDocumentSchema),
  relationStates: z.array(CodexRelationEffectiveStateSchema),
  characterKnowledge: z.array(CodexKnowledgeDocumentSchema),
  hiddenFutureProgressionCount: z.number().int().nonnegative(),
  hiddenFutureKnowledgeCount: z.number().int().nonnegative(),
});
export type CodexEffectiveState = z.infer<typeof CodexEffectiveStateSchema>;

export const CreateCodexRelationInputSchema = CodexRelationSchema.pick({
  sourceEntryId: true,
  targetEntryId: true,
  type: true,
  directed: true,
  description: true,
  evidence: true,
  validFromSceneId: true,
  validToSceneId: true,
}).partial({
  directed: true,
  description: true,
  evidence: true,
  validFromSceneId: true,
  validToSceneId: true,
});
export type CreateCodexRelationInput = z.input<typeof CreateCodexRelationInputSchema>;

export const UpdateCodexRelationInputSchema = CreateCodexRelationInputSchema.partial()
  .omit({ sourceEntryId: true, targetEntryId: true })
  .extend({ baseRevision: z.string().regex(/^[a-f0-9]{64}$/) })
  .superRefine((input, context) => {
    if (Object.keys(input).every((key) => key === "baseRevision")) {
      context.addIssue({ code: "custom", message: "At least one relation field is required" });
    }
  });
export type UpdateCodexRelationInput = z.infer<typeof UpdateCodexRelationInputSchema>;

export const CodexMentionSchema = z.object({
  sceneId: z.string().uuid(),
  entryId: z.string().uuid(),
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
  matchedText: z.string(),
  term: z.string(),
  isAlias: z.boolean(),
});
export type CodexMention = z.infer<typeof CodexMentionSchema>;

export const CodexAmbiguousMentionSchema = z.object({
  sceneId: z.string().uuid(),
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
  matchedText: z.string(),
  candidateEntryIds: z.array(z.string().uuid()).min(2),
});
export type CodexAmbiguousMention = z.infer<typeof CodexAmbiguousMentionSchema>;

export const SceneCodexMentionsSchema = z.object({
  sceneId: z.string().uuid(),
  mentions: z.array(CodexMentionSchema),
  ambiguities: z.array(CodexAmbiguousMentionSchema),
});
export type SceneCodexMentions = z.infer<typeof SceneCodexMentionsSchema>;

export const CodexContextExclusionReasonSchema = z.enum([
  "not-mentioned",
  "manual-only",
  "never",
  "archived",
]);
export type CodexContextExclusionReason = z.infer<typeof CodexContextExclusionReasonSchema>;

export const CodexContextExclusionSchema = z.object({
  entryId: z.string().uuid(),
  name: z.string(),
  reason: CodexContextExclusionReasonSchema,
});
export type CodexContextExclusion = z.infer<typeof CodexContextExclusionSchema>;

export const CodexContextPreviewSchema = z.object({
  sceneId: z.string().uuid(),
  included: z.array(CodexEntryDocumentSchema),
  excluded: z.array(CodexContextExclusionSchema),
  hiddenFutureFieldProgressionCount: z.number().int().nonnegative().default(0),
  hiddenFutureFieldProgressions: z.array(z.object({
    entryId: z.string().uuid(),
    name: z.string(),
    count: z.number().int().positive(),
  })).default([]),
});
export type CodexContextPreview = z.infer<typeof CodexContextPreviewSchema>;

export const CodexSearchResultSchema = z.object({
  entryId: z.string().uuid(),
  name: z.string(),
  categoryId: CodexCategoryIdSchema,
  excerpt: z.string(),
});
export type CodexSearchResult = z.infer<typeof CodexSearchResultSchema>;
