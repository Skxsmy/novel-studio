import { z } from "zod";

export const AgentRoleSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(160),
  description: z.string().max(4000).default(""),
  persona: z.string().max(4000).default(""),
  duties: z.array(z.string().min(1).max(1000)).default([]),
  nonDuties: z.array(z.string().min(1).max(1000)).default([]),
  challengeObligation: z.string().max(2000).default(""),
  forbiddenActions: z.array(z.string().min(1).max(1000)).default([]),
  outputContract: z.string().max(4000).default(""),
  readScopes: z.record(z.string(), z.boolean()).default({}),
  builtIn: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable().default(null),
});
export type AgentRole = z.infer<typeof AgentRoleSchema>;

export const CloneAgentRoleInputSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(4000).optional(),
});
export type CloneAgentRoleInput = z.input<typeof CloneAgentRoleInputSchema>;

export const UpdateAgentRoleInputSchema = AgentRoleSchema.pick({
  title: true,
  description: true,
  persona: true,
  duties: true,
  nonDuties: true,
  challengeObligation: true,
  forbiddenActions: true,
  outputContract: true,
  readScopes: true,
  archivedAt: true,
}).partial().superRefine((input, context) => {
  if (Object.keys(input).length === 0) {
    context.addIssue({ code: "custom", message: "至少提供一个角色字段" });
  }
});
export type UpdateAgentRoleInput = z.infer<typeof UpdateAgentRoleInputSchema>;

export const PromptTemplateVariableSchema = z.object({
  key: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/),
  label: z.string().min(1).max(120),
  description: z.string().max(1000).default(""),
  required: z.boolean().default(true),
  defaultValue: z.string().max(16000).nullable().default(null),
});
export type PromptTemplateVariable = z.infer<
  typeof PromptTemplateVariableSchema
>;

export const PromptTemplateComponentSchema = z.object({
  key: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/),
  title: z.string().min(1).max(160),
  body: z.string().min(1).max(64000),
});
export type PromptTemplateComponent = z.infer<
  typeof PromptTemplateComponentSchema
>;

export const PromptTemplateSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  roleId: z.string().min(1).max(120),
  name: z.string().min(1).max(160),
  version: z.number().int().positive(),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  description: z.string().max(4000).default(""),
  system: z.string().min(1).max(64000),
  instructions: z.string().min(1).max(64000),
  components: z.array(PromptTemplateComponentSchema).default([]),
  variables: z.array(PromptTemplateVariableSchema).default([]),
  outputSchemaName: z.string().max(160).nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable().default(null),
});
export type PromptTemplate = z.infer<typeof PromptTemplateSchema>;

export const CreatePromptTemplateInputSchema = PromptTemplateSchema.pick({
  roleId: true,
  name: true,
  status: true,
  description: true,
  system: true,
  instructions: true,
  components: true,
  variables: true,
  outputSchemaName: true,
}).partial({
  status: true,
  description: true,
  components: true,
  variables: true,
  outputSchemaName: true,
});
export type CreatePromptTemplateInput = z.input<typeof CreatePromptTemplateInputSchema>;

export const CreatePromptTemplateVersionInputSchema = PromptTemplateSchema.pick({
  name: true,
  status: true,
  description: true,
  system: true,
  instructions: true,
  components: true,
  variables: true,
  outputSchemaName: true,
}).partial().extend({
  baseVersion: z.number().int().positive(),
}).superRefine((input, context) => {
  if (Object.keys(input).every((key) => key === "baseVersion")) {
    context.addIssue({ code: "custom", message: "至少提供一个模板字段" });
  }
});
export type CreatePromptTemplateVersionInput = z.input<
  typeof CreatePromptTemplateVersionInputSchema
>;

export const PromptTemplatePreviewInputSchema = z.object({
  version: z.number().int().positive().optional(),
  inputs: z.record(z.string(), z.string()).default({}),
});
export type PromptTemplatePreviewInput = z.input<typeof PromptTemplatePreviewInputSchema>;

export const RenderedPromptComponentSchema = z.object({
  key: z.string(),
  title: z.string(),
  body: z.string(),
});
export type RenderedPromptComponent = z.infer<typeof RenderedPromptComponentSchema>;

export const PromptTemplatePreviewResultSchema = z.object({
  promptTemplateId: z.string().uuid(),
  promptTemplateVersion: z.number().int().positive(),
  roleId: z.string().min(1).max(120),
  templateName: z.string(),
  renderedSystem: z.string(),
  renderedInstructions: z.string(),
  renderedComponents: z.array(RenderedPromptComponentSchema),
  finalPrompt: z.string(),
  usedInputs: z.record(z.string(), z.string()),
});
export type PromptTemplatePreviewResult = z.infer<
  typeof PromptTemplatePreviewResultSchema
>;

export const PromptVersionSchema = z.object({
  schemaVersion: z.literal(1),
  promptTemplateId: z.string().uuid(),
  version: z.number().int().positive(),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable().default(null),
});
export type PromptVersion = z.infer<typeof PromptVersionSchema>;

export const PromptPresetSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  title: z.string().min(1).max(160),
  roleId: z.string().min(1).max(120),
  promptTemplateId: z.string().uuid(),
  promptTemplateVersion: z.number().int().positive(),
  modelProfileId: z.string().uuid().nullable().default(null),
  defaultInputs: z.record(z.string(), z.string()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable().default(null),
});
export type PromptPreset = z.infer<typeof PromptPresetSchema>;

export const CreatePromptPresetInputSchema = PromptPresetSchema.pick({
  title: true,
  roleId: true,
  promptTemplateId: true,
  promptTemplateVersion: true,
  modelProfileId: true,
  defaultInputs: true,
}).partial({
  modelProfileId: true,
  defaultInputs: true,
});
export type CreatePromptPresetInput = z.input<typeof CreatePromptPresetInputSchema>;
