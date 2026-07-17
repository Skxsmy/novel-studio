import { z } from "zod";
import { RevisionHashSchema } from "./common.js";

export const AiTaskKindSchema = z.enum([
  "analysis",
  "brainstorm",
  "continuity-check",
  "critique",
  "style-review",
  "draft",
  "rewrite",
  "expand",
  "compress",
  "structure-review",
  "character-review",
  "continuity-review",
  "research",
  "context-preview",
  "custom",
]);
export type AiTaskKind = z.infer<typeof AiTaskKindSchema>;

export const AiProviderSchema = z.enum([
  "mock",
  "openai",
  "anthropic",
  "google",
  "openrouter",
  "ollama",
  "deepseek",
  "openai-compatible",
]);
export type AiProvider = z.infer<typeof AiProviderSchema>;

export const TokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative().default(0),
  outputTokens: z.number().int().nonnegative().default(0),
  totalTokens: z.number().int().nonnegative().default(0),
});
export type TokenUsage = z.infer<typeof TokenUsageSchema>;

export const UsageEstimateSchema = TokenUsageSchema;
export type UsageEstimate = z.infer<typeof UsageEstimateSchema>;

export const ModelCapabilitySchema = z.object({
  streamText: z.boolean().default(false),
  structuredOutput: z.boolean().default(false),
  embeddings: z.boolean().default(false),
  tokenEstimate: z.boolean().default(false),
  modelList: z.boolean().default(false),
});
export type ModelCapability = z.infer<typeof ModelCapabilitySchema>;

export const ReasoningEffortSchema = z.enum([
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);
export type ReasoningEffort = z.infer<typeof ReasoningEffortSchema>;

export const ReasoningConfigurationSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("enabled") }).strict(),
  z.object({ mode: z.literal("disabled") }).strict(),
  z.object({
    mode: z.literal("effort"),
    effort: ReasoningEffortSchema,
  }).strict(),
  z.object({
    mode: z.literal("budget"),
    budgetTokens: z.number().int().positive(),
  }).strict(),
]);
export type ReasoningConfiguration = z.infer<typeof ReasoningConfigurationSchema>;

export const ReasoningOutputKindSchema = z.enum(["none", "summary", "full"]);
export type ReasoningOutputKind = z.infer<typeof ReasoningOutputKindSchema>;

export const ProviderReasoningControlSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("unsupported") }).strict(),
  z.object({
    kind: z.literal("toggle"),
    defaultEnabled: z.boolean(),
    canDisable: z.boolean(),
  }).strict().superRefine((control, context) => {
    if (!control.defaultEnabled && !control.canDisable) {
      context.addIssue({
        code: "custom",
        path: ["defaultEnabled"],
        message: "a mandatory reasoning control cannot default to disabled",
      });
    }
  }),
  z.object({
    kind: z.literal("effort"),
    efforts: z.array(ReasoningEffortSchema).min(1),
    defaultEffort: ReasoningEffortSchema,
    canDisable: z.boolean(),
  }).strict().superRefine((control, context) => {
    if (!control.efforts.includes(control.defaultEffort)) {
      context.addIssue({
        code: "custom",
        path: ["defaultEffort"],
        message: "defaultEffort must be one of the exact-model effort choices",
      });
    }
    if (new Set(control.efforts).size !== control.efforts.length) {
      context.addIssue({
        code: "custom",
        path: ["efforts"],
        message: "exact-model effort choices must not contain duplicates",
      });
    }
  }),
  z.object({
    kind: z.literal("budget"),
    minimumTokens: z.number().int().positive(),
    maximumTokens: z.number().int().positive(),
    defaultBudgetTokens: z.number().int().positive().nullable(),
    supportsDynamicBudget: z.boolean(),
    canDisable: z.boolean(),
  }).strict().superRefine((control, context) => {
    if (control.minimumTokens > control.maximumTokens) {
      context.addIssue({
        code: "custom",
        path: ["minimumTokens"],
        message: "minimumTokens must not exceed maximumTokens",
      });
    }
    if (
      control.defaultBudgetTokens !== null &&
      (control.defaultBudgetTokens < control.minimumTokens ||
        control.defaultBudgetTokens > control.maximumTokens)
    ) {
      context.addIssue({
        code: "custom",
        path: ["defaultBudgetTokens"],
        message: "defaultBudgetTokens must be inside the exact-model range",
      });
    }
    if (control.defaultBudgetTokens === null && !control.supportsDynamicBudget) {
      context.addIssue({
        code: "custom",
        path: ["defaultBudgetTokens"],
        message: "a budget control needs either a fixed default or provider-managed dynamic budget",
      });
    }
  }),
]);
export type ProviderReasoningControl = z.infer<typeof ProviderReasoningControlSchema>;

export function normalizeReasoningConfigurationForModel(
  rawControl: unknown,
  rawPreference: unknown,
): ReasoningConfiguration | null {
  const control = ProviderReasoningControlSchema.parse(rawControl);
  if (control.kind === "unsupported") {
    if (rawPreference !== null && rawPreference !== undefined) {
      throw new Error("The exact model does not declare a reasoning control");
    }
    return null;
  }

  const preference = rawPreference === null || rawPreference === undefined
    ? null
    : ReasoningConfigurationSchema.parse(rawPreference);
  if (preference === null) {
    if (control.kind === "toggle") {
      return { mode: "enabled" };
    }
    if (control.kind === "effort") {
      return { mode: "effort", effort: control.defaultEffort };
    }
    return control.defaultBudgetTokens === null
      ? { mode: "enabled" }
      : { mode: "budget", budgetTokens: control.defaultBudgetTokens };
  }

  if (preference.mode === "disabled") {
    if (!control.canDisable) {
      throw new Error("The exact model does not allow reasoning to be disabled");
    }
    return preference;
  }
  if (preference.mode === "enabled") {
    if (control.kind === "toggle" ||
      (control.kind === "budget" && control.supportsDynamicBudget)) {
      return preference;
    }
    throw new Error("The exact model requires a specific reasoning option");
  }
  if (preference.mode === "effort") {
    if (control.kind !== "effort" || !control.efforts.includes(preference.effort)) {
      throw new Error("The stored reasoning effort is not supported by the exact model");
    }
    return preference;
  }
  if (
    control.kind !== "budget" ||
    preference.budgetTokens < control.minimumTokens ||
    preference.budgetTokens > control.maximumTokens
  ) {
    throw new Error("The stored reasoning budget is outside the exact model range");
  }
  return preference;
}

function containsCredentialLikeModelParameter(input: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(input)) {
    const normalizedKey = key.toLowerCase().replace(/[\s._-]+/gu, "");
    if (
      normalizedKey === "apikey" ||
      normalizedKey === "authorization" ||
      normalizedKey === "bearer" ||
      normalizedKey === "token" ||
      normalizedKey === "credential" ||
      normalizedKey === "cookie" ||
      normalizedKey === "secret" ||
      normalizedKey.endsWith("apikey") ||
      normalizedKey.includes("authorization") ||
      normalizedKey.includes("bearer") ||
      normalizedKey.includes("credential") ||
      normalizedKey.includes("cookie") ||
      normalizedKey.includes("secret") ||
      /(?:access|refresh|auth|session|identity|api)tokens?$/u.test(normalizedKey)
    ) {
      return true;
    }
    if (
      typeof value === "string" &&
      /(?:\bBearer\s+[A-Za-z0-9._-]{8,}|\bsk-[A-Za-z0-9_-]{8,}|\bAIza[0-9A-Za-z_-]{20,})/iu.test(value)
    ) {
      return true;
    }
  }
  return false;
}

function rejectCredentialLikeModelParameters(
  input: Record<string, unknown>,
  context: z.RefinementCtx,
): void {
  if (containsCredentialLikeModelParameter(input)) {
    context.addIssue({
      code: "custom",
      message: "Model parameters cannot contain credentials or credential-like fields",
    });
  }
}

const NORMALIZED_MODEL_PARAMETER_KEYS = new Set([
  "temperature",
  "topP",
  "maxOutputTokens",
  "reasoning",
]);

const TRANSPORT_OWNED_MODEL_PARAMETER_KEYS = new Set([
  "model",
  "stream",
  "streamoptions",
  "messages",
  "contents",
  "system",
  "systeminstruction",
  "tools",
  "toolchoice",
  "paralleltoolcalls",
  "toolconfig",
  "reasoningeffort",
  "reasoningbudget",
  "reasoningmaxtokens",
  "reasoningenabled",
  "reasoningexclude",
  "thinking",
  "thinkingconfig",
  "thinkingbudget",
  "thinkinglevel",
  "includethoughts",
  "outputconfig",
  "maxtokens",
  "maxcompletiontokens",
  "topp",
  "responseformat",
  "responsemimetype",
  "responseschema",
  "responsejsonschema",
  "generationconfig",
]);

function rejectTransportOwnedModelParameters(
  input: Record<string, unknown>,
  context: z.RefinementCtx,
): void {
  for (const key of Object.keys(input)) {
    if (NORMALIZED_MODEL_PARAMETER_KEYS.has(key)) continue;
    const normalizedKey = key.toLowerCase().replace(/[\s._-]+/gu, "");
    if (TRANSPORT_OWNED_MODEL_PARAMETER_KEYS.has(normalizedKey)) {
      context.addIssue({
        code: "custom",
        message: "Model parameters cannot override transport-owned request fields",
      });
      return;
    }
  }
}

function rejectUnsafeModelParameters(
  input: Record<string, unknown>,
  context: z.RefinementCtx,
): void {
  rejectCredentialLikeModelParameters(input, context);
  rejectTransportOwnedModelParameters(input, context);
}

const ModelParametersV1Schema = z
  .object({
    temperature: z.number().min(0).max(2).optional(),
    topP: z.number().min(0).max(1).optional(),
    maxOutputTokens: z.number().int().positive().optional(),
  })
  .catchall(z.union([z.string(), z.number(), z.boolean(), z.null()]))
  .superRefine(rejectUnsafeModelParameters);

export const ModelParametersSchema = z
  .object({
    temperature: z.number().min(0).max(2).optional(),
    topP: z.number().min(0).max(1).optional(),
    maxOutputTokens: z.number().int().positive().optional(),
    reasoning: ReasoningConfigurationSchema.optional(),
  })
  .catchall(z.union([z.string(), z.number(), z.boolean(), z.null()]))
  .superRefine(rejectUnsafeModelParameters);
export type ModelParameters = z.infer<typeof ModelParametersSchema>;

export const CredentialRefSchema = z
  .string()
  .trim()
  .min(1)
  .max(240)
  .refine(
    (value) =>
      !/(?:sk-[A-Za-z0-9_-]{8,}|api[_-]?key|bearer\s+[A-Za-z0-9._-]+)/iu.test(value),
    "credentialRef 只能保存凭据引用，不能保存明文密钥",
  );

export const ProviderProfileSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  title: z.string().min(1).max(160),
  provider: AiProviderSchema,
  baseUrl: z.string().url().nullable().default(null),
  credentialRef: CredentialRefSchema.nullable().default(null),
  defaultModel: z.string().max(200).nullable().default(null),
  capabilities: ModelCapabilitySchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable().default(null),
});
export type ProviderProfile = z.infer<typeof ProviderProfileSchema>;

const ModelProfileFieldsSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(160),
  provider: AiProviderSchema,
  baseUrl: z.string().url().nullable().default(null),
  model: z.string().min(1).max(200),
  credentialRef: CredentialRefSchema.nullable().default(null),
  defaultParameters: ModelParametersV1Schema.default({}),
  capabilities: ModelCapabilitySchema,
  contextWindowTokens: z.number().int().positive().default(8192),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable().default(null),
});

export const ModelProfileV1Schema = ModelProfileFieldsSchema.extend({
  schemaVersion: z.literal(1),
});
export type ModelProfileV1 = z.infer<typeof ModelProfileV1Schema>;

export const ModelProfileV2Schema = ModelProfileFieldsSchema.extend({
  schemaVersion: z.literal(2),
  reasoningPreference: ReasoningConfigurationSchema.nullable().default(null),
});
export type ModelProfileV2 = z.infer<typeof ModelProfileV2Schema>;

export const ModelProfileSchema = z
  .union([ModelProfileV2Schema, ModelProfileV1Schema])
  .transform((profile): ModelProfileV2 => profile.schemaVersion === 2
    ? profile
    : {
      ...profile,
      schemaVersion: 2,
      reasoningPreference: null,
    });
export type ModelProfile = z.infer<typeof ModelProfileSchema>;

export const ModelProfileV1RollbackSnapshotSchema = z.object({
  profile: ModelProfileV1Schema,
  reasoningPreferenceBackup: ReasoningConfigurationSchema.nullable(),
}).strict();
export type ModelProfileV1RollbackSnapshot = z.infer<
  typeof ModelProfileV1RollbackSnapshotSchema
>;

export function modelProfileV1RollbackSnapshot(raw: unknown): ModelProfileV1RollbackSnapshot {
  const profile = ModelProfileSchema.parse(raw);
  const { reasoningPreference, ...version2Fields } = profile;
  return ModelProfileV1RollbackSnapshotSchema.parse({
    profile: {
      ...version2Fields,
      schemaVersion: 1,
    },
    reasoningPreferenceBackup: reasoningPreference,
  });
}

const ModelProfileV2MigrationDocumentSchema = z.object({
  profileId: z.string().uuid(),
  relativePath: z.string().trim().min(1).max(500),
  raw: z.string().min(1).max(4_000_000),
  revision: RevisionHashSchema,
  migratedRevision: RevisionHashSchema,
}).strict();

export const ModelProfileV2MigrationBackupSchema = z.object({
  schemaVersion: z.literal(1),
  scope: z.literal("library-model-profiles"),
  migrationId: z.string().uuid(),
  createdAt: z.string().datetime(),
  documents: z.array(ModelProfileV2MigrationDocumentSchema),
}).strict();
export type ModelProfileV2MigrationBackup = z.infer<
  typeof ModelProfileV2MigrationBackupSchema
>;

export const ModelProfileV2MigrationResultSchema = z.object({
  migrationId: z.string().uuid(),
  migratedProfileIds: z.array(z.string().uuid()),
}).strict();
export type ModelProfileV2MigrationResult = z.infer<
  typeof ModelProfileV2MigrationResultSchema
>;

export const RollbackModelProfileV2MigrationResultSchema = z.object({
  migrationId: z.string().uuid(),
  restoredProfileIds: z.array(z.string().uuid()),
}).strict();
export type RollbackModelProfileV2MigrationResult = z.infer<
  typeof RollbackModelProfileV2MigrationResultSchema
>;

export const EmbeddingProviderSchema = z.enum([
  "mock",
  "local-http",
  "openai-compatible",
  "custom-http",
]);
export type EmbeddingProvider = z.infer<typeof EmbeddingProviderSchema>;

export const EmbeddingUseCaseIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(
    /^[a-z][a-z0-9.-]*$/u,
    "Embedding use case must use a stable lower-case dotted id",
  );
export type EmbeddingUseCaseId = z.infer<typeof EmbeddingUseCaseIdSchema>;

export const EmbeddingModelProfileSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  title: z.string().min(1).max(160),
  provider: EmbeddingProviderSchema,
  baseUrl: z.string().url().nullable().default(null),
  endpointPath: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^\/[A-Za-z0-9._~!$&'()*+,;=:@/-]*$/u, "endpointPath must be an absolute HTTP path")
    .default("/embed"),
  model: z.string().min(1).max(200),
  credentialRef: CredentialRefSchema.nullable().default(null),
  dimensions: z.number().int().positive().max(65536),
  maxInputTokens: z.number().int().positive().max(1_000_000).default(512),
  maxBatchSize: z.number().int().positive().max(2048).default(32),
  maxConcurrentBatches: z.number().int().positive().max(128).default(2),
  normalize: z.boolean().default(true),
  supportsCustomDimensions: z.boolean().default(false),
  license: z.string().trim().min(1).max(120).nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable().default(null),
});
export type EmbeddingModelProfile = z.infer<typeof EmbeddingModelProfileSchema>;

const EmbeddingModelProfileEditableInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  provider: EmbeddingProviderSchema,
  baseUrl: z.string().trim().url().nullable().default(null),
  endpointPath: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^\/[A-Za-z0-9._~!$&'()*+,;=:@/-]*$/u, "endpointPath must be an absolute HTTP path")
    .default("/embed"),
  model: z.string().trim().min(1).max(200),
  dimensions: z.number().int().positive().max(65536),
  maxInputTokens: z.number().int().positive().max(1_000_000).default(512),
  maxBatchSize: z.number().int().positive().max(2048).default(32),
  maxConcurrentBatches: z.number().int().positive().max(128).default(2),
  normalize: z.boolean().default(true),
  supportsCustomDimensions: z.boolean().default(false),
  license: z.string().trim().min(1).max(120).nullable().default(null),
}).strict();

export const CreateEmbeddingModelProfileInputSchema = EmbeddingModelProfileEditableInputSchema;
export type CreateEmbeddingModelProfileInput = z.input<typeof CreateEmbeddingModelProfileInputSchema>;

export const UpdateEmbeddingModelProfileInputSchema = EmbeddingModelProfileEditableInputSchema.partial().superRefine(
  (input, context) => {
    if (Object.keys(input).length === 0) {
      context.addIssue({ code: "custom", message: "至少提供一个 Embedding 配置字段" });
    }
  },
);
export type UpdateEmbeddingModelProfileInput = z.infer<typeof UpdateEmbeddingModelProfileInputSchema>;

export const EmbeddingUseCaseBindingSchema = z.object({
  useCase: EmbeddingUseCaseIdSchema,
  profileId: z.string().uuid(),
});
export type EmbeddingUseCaseBinding = z.infer<typeof EmbeddingUseCaseBindingSchema>;

export const EmbeddingUseCaseBindingDocumentSchema = EmbeddingUseCaseBindingSchema.extend({
  schemaVersion: z.literal(1),
  updatedAt: z.string().datetime(),
}).strict();
export type EmbeddingUseCaseBindingDocument = z.infer<
  typeof EmbeddingUseCaseBindingDocumentSchema
>;

export const SetEmbeddingUseCaseBindingInputSchema = z.object({
  profileId: z.string().uuid(),
}).strict();
export type SetEmbeddingUseCaseBindingInput = z.infer<
  typeof SetEmbeddingUseCaseBindingInputSchema
>;

export const DeleteEmbeddingUseCaseBindingResultSchema = z.object({
  useCase: EmbeddingUseCaseIdSchema,
  deleted: z.boolean(),
}).strict();
export type DeleteEmbeddingUseCaseBindingResult = z.infer<
  typeof DeleteEmbeddingUseCaseBindingResultSchema
>;

const ModelProfileEditableInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  provider: AiProviderSchema,
  baseUrl: z.string().trim().url().nullable().default(null),
  model: z.string().trim().min(1).max(200),
  defaultParameters: ModelParametersV1Schema.default({}),
  reasoningPreference: ReasoningConfigurationSchema.nullable().default(null),
  capabilities: ModelCapabilitySchema.default({
    streamText: false,
    structuredOutput: false,
    embeddings: false,
    tokenEstimate: false,
    modelList: false,
  }),
  contextWindowTokens: z.number().int().positive().default(8192),
}).strict();

export const CreateModelProfileInputSchema = ModelProfileEditableInputSchema;
export type CreateModelProfileInput = z.input<typeof CreateModelProfileInputSchema>;

export const UpdateModelProfileInputSchema = ModelProfileEditableInputSchema.partial().superRefine(
  (input, context) => {
    if (Object.keys(input).length === 0) {
      context.addIssue({ code: "custom", message: "至少提供一个模型配置字段" });
    }
  },
);
export type UpdateModelProfileInput = z.infer<typeof UpdateModelProfileInputSchema>;

export const SaveModelProfileCredentialInputSchema = z.object({
  secret: z.string().min(8).max(8192),
});
export type SaveModelProfileCredentialInput = z.infer<
  typeof SaveModelProfileCredentialInputSchema
>;

export const SaveModelProfileCredentialResultSchema = z.object({
  credentialRef: CredentialRefSchema,
  storeKind: z.enum(["windows-credential-manager", "unavailable"]),
  modelProfile: ModelProfileSchema,
});
export type SaveModelProfileCredentialResult = z.infer<
  typeof SaveModelProfileCredentialResultSchema
>;

export const ModelProfileCredentialStatusSchema = z.object({
  credentialRef: CredentialRefSchema.nullable().default(null),
  storeKind: z.enum(["windows-credential-manager", "unavailable"]),
  exists: z.boolean(),
  modelProfile: ModelProfileSchema,
});
export type ModelProfileCredentialStatus = z.infer<
  typeof ModelProfileCredentialStatusSchema
>;

export const DeleteModelProfileCredentialResultSchema = z.object({
  deleted: z.boolean(),
  storeKind: z.enum(["windows-credential-manager", "unavailable"]),
  modelProfile: ModelProfileSchema,
});
export type DeleteModelProfileCredentialResult = z.infer<
  typeof DeleteModelProfileCredentialResultSchema
>;

export const ModelCallStatusSchema = z.enum([
  "pending",
  "streaming",
  "succeeded",
  "failed",
  "cancelled",
]);
export type ModelCallStatus = z.infer<typeof ModelCallStatusSchema>;

export const ModelCallErrorCodeSchema = z.enum([
  "provider-auth-failed",
  "provider-billing-required",
  "provider-rate-limited",
  "provider-unavailable",
  "provider-error",
  "model-unavailable",
  "context-too-large",
  "structured-output-failed",
  "permission-denied",
  "unknown",
]);
export type ModelCallErrorCode = z.infer<typeof ModelCallErrorCodeSchema>;

export const ModelCallErrorSchema = z.object({
  code: ModelCallErrorCodeSchema,
  message: z.string().min(1).max(4000),
  retryable: z.boolean().default(false),
  providerStatus: z.number().int().positive().nullable().default(null),
  rawErrorHash: RevisionHashSchema.nullable().default(null),
});
export type ModelCallError = z.infer<typeof ModelCallErrorSchema>;

export const ProviderModelDescriptorSchema = z.object({
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  contextWindowTokens: z.number().int().positive(),
  capabilities: ModelCapabilitySchema,
  reasoning: ProviderReasoningControlSchema,
});
export type ProviderModelDescriptor = z.infer<
  typeof ProviderModelDescriptorSchema
>;

export const ProviderConnectionResultSchema = z.object({
  ok: z.boolean(),
  provider: AiProviderSchema,
  modelProfileId: z.string().uuid(),
  capabilities: ModelCapabilitySchema,
  models: z.array(ProviderModelDescriptorSchema),
  error: ModelCallErrorSchema.nullable().default(null),
});
export type ProviderConnectionResult = z.infer<
  typeof ProviderConnectionResultSchema
>;

const ModelCallLogFieldsSchema = z.object({
  id: z.string().uuid(),
  seriesId: z.string().uuid(),
  sceneId: z.string().uuid().nullable().default(null),
  roleId: z.string().min(1).max(120),
  taskKind: AiTaskKindSchema,
  provider: AiProviderSchema,
  model: z.string().min(1).max(200),
  contextBundleId: z.string().uuid(),
  promptTemplateId: z.string().uuid(),
  promptTemplateVersion: z.number().int().positive(),
  requestHash: RevisionHashSchema,
  responseHash: RevisionHashSchema.nullable().default(null),
  status: ModelCallStatusSchema,
  estimatedUsage: TokenUsageSchema,
  actualUsage: TokenUsageSchema.nullable().default(null),
  errorCode: z.string().max(120).nullable().default(null),
  errorMessage: z.string().max(4000).nullable().default(null),
  error: ModelCallErrorSchema.nullable().default(null),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable().default(null),
});

export const ModelCallLogV1Schema = ModelCallLogFieldsSchema.extend({
  schemaVersion: z.literal(1),
});
export type ModelCallLogV1 = z.infer<typeof ModelCallLogV1Schema>;

function rejectCancelledModelCallErrors(
  log: z.infer<typeof ModelCallLogFieldsSchema>,
  context: z.RefinementCtx,
): void {
  if (log.status !== "cancelled") return;
  for (const field of ["error", "errorCode", "errorMessage"] as const) {
    if (log[field] !== null) {
      context.addIssue({
        code: "custom",
        path: [field],
        message: "Cancelled model calls cannot carry error details",
      });
    }
  }
}

export const ModelCallLogV2Schema = ModelCallLogFieldsSchema.extend({
  schemaVersion: z.literal(2),
  resolvedParameters: ModelParametersSchema.nullable(),
}).superRefine(rejectCancelledModelCallErrors);
export type ModelCallLogV2 = z.infer<typeof ModelCallLogV2Schema>;

export const NewModelCallLogV2Schema = ModelCallLogFieldsSchema.extend({
  schemaVersion: z.literal(2),
  resolvedParameters: ModelParametersSchema,
}).superRefine(rejectCancelledModelCallErrors);
export type NewModelCallLogV2 = z.infer<typeof NewModelCallLogV2Schema>;

export const ModelCallLogSchema = z
  .union([
    ModelCallLogV2Schema,
    ModelCallLogV1Schema.superRefine(rejectCancelledModelCallErrors),
  ])
  .transform((log): ModelCallLogV2 => log.schemaVersion === 2
    ? log
    : {
      ...log,
      schemaVersion: 2,
      resolvedParameters: null,
    });
export type ModelCallLog = z.infer<typeof ModelCallLogSchema>;

export const ModelCallLogV1RollbackSnapshotSchema = z.object({
  log: ModelCallLogV1Schema,
  resolvedParametersBackup: ModelParametersSchema.nullable(),
}).strict();
export type ModelCallLogV1RollbackSnapshot = z.infer<
  typeof ModelCallLogV1RollbackSnapshotSchema
>;

export function modelCallLogV1RollbackSnapshot(raw: unknown): ModelCallLogV1RollbackSnapshot {
  const log = ModelCallLogSchema.parse(raw);
  const { resolvedParameters, ...version2Fields } = log;
  return ModelCallLogV1RollbackSnapshotSchema.parse({
    log: {
      ...version2Fields,
      schemaVersion: 1,
    },
    resolvedParametersBackup: resolvedParameters,
  });
}

const ModelCallLogV2MigrationDocumentSchema = z.object({
  callId: z.string().uuid(),
  relativePath: z.string().trim().min(1).max(500),
  raw: z.string().min(1).max(4_000_000),
  revision: RevisionHashSchema,
  migratedRevision: RevisionHashSchema,
}).strict();

export const ModelCallLogV2MigrationBackupSchema = z.object({
  schemaVersion: z.literal(1),
  migrationId: z.string().uuid(),
  seriesId: z.string().uuid(),
  createdAt: z.string().datetime(),
  documents: z.array(ModelCallLogV2MigrationDocumentSchema),
}).strict();
export type ModelCallLogV2MigrationBackup = z.infer<
  typeof ModelCallLogV2MigrationBackupSchema
>;

export const ModelCallLogV2MigrationResultSchema = z.object({
  migrationId: z.string().uuid(),
  migratedCallIds: z.array(z.string().uuid()),
}).strict();
export type ModelCallLogV2MigrationResult = z.infer<
  typeof ModelCallLogV2MigrationResultSchema
>;

export const RollbackModelCallLogV2MigrationResultSchema = z.object({
  migrationId: z.string().uuid(),
  restoredCallIds: z.array(z.string().uuid()),
}).strict();
export type RollbackModelCallLogV2MigrationResult = z.infer<
  typeof RollbackModelCallLogV2MigrationResultSchema
>;

export const CreateModelCallInputSchema = z.object({
  contextBundleId: z.string().uuid(),
  modelProfileId: z.string().uuid(),
  roleId: z.string().min(1).max(120),
  taskKind: AiTaskKindSchema,
  promptTemplateId: z.string().uuid(),
  promptTemplateVersion: z.number().int().positive(),
  parameters: ModelParametersSchema.default({}),
});
export type CreateModelCallInput = z.input<typeof CreateModelCallInputSchema>;

export const ModelCallStreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("metadata"),
    callId: z.string().uuid(),
    contextBundleId: z.string().uuid(),
    modelProfileId: z.string().uuid(),
    provider: AiProviderSchema,
    model: z.string(),
    roleId: z.string(),
    taskKind: AiTaskKindSchema,
    promptTemplateId: z.string().uuid(),
    promptTemplateVersion: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("delta"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("reasoning-delta"),
    text: z.string(),
    outputKind: ReasoningOutputKindSchema.exclude(["none"]),
  }),
  z.object({
    type: z.literal("usage"),
    estimatedUsage: TokenUsageSchema,
    actualUsage: TokenUsageSchema.nullable().default(null),
  }),
  z.object({
    type: z.literal("error"),
    error: ModelCallErrorSchema,
  }),
  z.object({
    type: z.literal("done"),
    callId: z.string().uuid(),
    status: ModelCallStatusSchema,
    responseHash: RevisionHashSchema.nullable().default(null),
    actualUsage: TokenUsageSchema.nullable().default(null),
  }),
]);
export type ModelCallStreamEvent = z.infer<typeof ModelCallStreamEventSchema>;
