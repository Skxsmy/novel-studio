import { z } from "zod";
import { CloudPolicySchema, RevisionHashSchema } from "./common.js";

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

export const ModelParametersSchema = z
  .object({
    temperature: z.number().min(0).max(2).optional(),
    topP: z.number().min(0).max(1).optional(),
    maxOutputTokens: z.number().int().positive().optional(),
  })
  .catchall(z.union([z.string(), z.number(), z.boolean(), z.null()]));
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
  cloudPolicy: CloudPolicySchema.default("local-only"),
  credentialRef: CredentialRefSchema.nullable().default(null),
  defaultModel: z.string().max(200).nullable().default(null),
  capabilities: ModelCapabilitySchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable().default(null),
});
export type ProviderProfile = z.infer<typeof ProviderProfileSchema>;

export const ModelProfileSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  title: z.string().min(1).max(160),
  provider: AiProviderSchema,
  model: z.string().min(1).max(200),
  cloudPolicy: CloudPolicySchema.default("local-only"),
  credentialRef: CredentialRefSchema.nullable().default(null),
  defaultParameters: ModelParametersSchema.default({}),
  capabilities: ModelCapabilitySchema,
  contextWindowTokens: z.number().int().positive().default(8192),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable().default(null),
});
export type ModelProfile = z.infer<typeof ModelProfileSchema>;

export const CreateModelProfileInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  provider: AiProviderSchema,
  model: z.string().trim().min(1).max(200),
  cloudPolicy: CloudPolicySchema.default("local-only"),
  credentialRef: CredentialRefSchema.nullable().default(null),
  defaultParameters: ModelParametersSchema.default({}),
  capabilities: ModelCapabilitySchema.default({
    streamText: false,
    structuredOutput: false,
    embeddings: false,
    tokenEstimate: false,
    modelList: false,
  }),
  contextWindowTokens: z.number().int().positive().default(8192),
});
export type CreateModelProfileInput = z.input<typeof CreateModelProfileInputSchema>;

export const UpdateModelProfileInputSchema = CreateModelProfileInputSchema.partial().superRefine(
  (input, context) => {
    if (Object.keys(input).length === 0) {
      context.addIssue({ code: "custom", message: "至少提供一个模型配置字段" });
    }
  },
);
export type UpdateModelProfileInput = z.infer<typeof UpdateModelProfileInputSchema>;

export const UpdateSeriesCloudPolicyInputSchema = z.object({
  cloudPolicy: CloudPolicySchema,
});
export type UpdateSeriesCloudPolicyInput = z.infer<
  typeof UpdateSeriesCloudPolicyInputSchema
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
  "cloud-disabled",
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

export const ModelCallLogSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  seriesId: z.string().uuid(),
  sceneId: z.string().uuid().nullable().default(null),
  roleId: z.string().min(1).max(120),
  taskKind: AiTaskKindSchema,
  provider: AiProviderSchema,
  model: z.string().min(1).max(200),
  cloudPolicy: CloudPolicySchema,
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
export type ModelCallLog = z.infer<typeof ModelCallLogSchema>;
