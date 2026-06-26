import type {
  AiProvider,
  CloudPolicy,
  CreateModelProfileInput,
  ModelCapability,
  ModelProfile,
  ProviderConnectionResult,
  ProviderModelDescriptor,
  UpdateModelProfileInput,
} from "@novel-studio/contracts";

export interface SelectOption<T extends string> {
  description?: string;
  label: string;
  value: T;
}

export interface ModelProfileForm {
  baseUrl: string;
  capabilities: ModelCapability;
  cloudPolicy: CloudPolicy;
  contextWindowTokens: number;
  id: string | null;
  model: string;
  provider: AiProvider;
  secret: string;
  title: string;
}

export const providerOptions: Array<SelectOption<AiProvider>> = [
  { label: "Mock", value: "mock" },
  { label: "DeepSeek", value: "deepseek" },
  { label: "OpenAI", value: "openai" },
  { label: "Anthropic", value: "anthropic" },
  { label: "Google Gemini", value: "google" },
  { label: "OpenRouter", value: "openrouter" },
  { label: "Ollama", value: "ollama" },
  { label: "OpenAI-compatible", value: "openai-compatible" },
];

const cloudProviders = new Set<AiProvider>([
  "anthropic",
  "deepseek",
  "google",
  "openai",
  "openrouter",
  "openai-compatible",
]);

export function isCloudProvider(provider: AiProvider) {
  return cloudProviders.has(provider);
}

export const cloudPolicyOptions: Array<SelectOption<CloudPolicy>> = [
  {
    description: "Cloud providers are blocked unless a model profile explicitly changes this later.",
    label: "Local only",
    value: "local-only",
  },
  {
    description: "Cloud calls are allowed for profiles that have a saved credential.",
    label: "Cloud allowed",
    value: "cloud-allowed",
  },
];

export const emptyModelProfileForm: ModelProfileForm = {
  baseUrl: "",
  capabilities: {
    embeddings: false,
    modelList: true,
    streamText: true,
    structuredOutput: true,
    tokenEstimate: true,
  },
  cloudPolicy: "local-only",
  contextWindowTokens: 8192,
  id: null,
  model: "mock-continuity-v1",
  provider: "mock",
  secret: "",
  title: "Mock Continuity",
};

export function formFromProfile(profile: ModelProfile): ModelProfileForm {
  return {
    baseUrl: profile.baseUrl ?? "",
    capabilities: profile.capabilities,
    cloudPolicy: profile.cloudPolicy,
    contextWindowTokens: profile.contextWindowTokens,
    id: profile.id,
    model: profile.model,
    provider: profile.provider,
    secret: "",
    title: profile.title,
  };
}

export function modelProfileInputFromForm(form: ModelProfileForm): CreateModelProfileInput {
  return {
    baseUrl: form.baseUrl.trim() || null,
    capabilities: form.capabilities,
    cloudPolicy: form.cloudPolicy,
    contextWindowTokens: form.contextWindowTokens,
    model: form.model.trim() || emptyModelProfileForm.model,
    provider: form.provider,
    title: form.title.trim() || "Untitled Model",
  };
}

export function updateModelProfileInputFromForm(form: ModelProfileForm): UpdateModelProfileInput {
  return {
    baseUrl: form.baseUrl.trim() || null,
    capabilities: form.capabilities,
    cloudPolicy: form.cloudPolicy,
    contextWindowTokens: form.contextWindowTokens,
    model: form.model.trim() || emptyModelProfileForm.model,
    provider: form.provider,
    title: form.title.trim() || "Untitled Model",
  };
}

export function profileStatusLabel(profile: ModelProfile): string {
  if (profile.credentialRef) return "Key saved";
  if (profile.provider === "mock" || profile.provider === "ollama") return "Ready";
  return "Needs key";
}

export function profileStatusClass(profile: ModelProfile): string {
  if (profile.credentialRef || profile.provider === "mock" || profile.provider === "ollama") return "pill green";
  return "pill amber";
}

export function connectionSummary(result: ProviderConnectionResult | null): string {
  if (!result) return "Run a saved model profile to see the provider result.";
  if (result.ok) return `Connection ok. ${result.models.length} model${result.models.length === 1 ? "" : "s"} reported.`;
  return result.error?.message ?? "Connection failed.";
}

export function modelsSummary(models: ProviderModelDescriptor[]): string {
  if (models.length === 0) return "Fetch models from a saved profile.";
  return `${models.length} model${models.length === 1 ? "" : "s"} available.`;
}

export function credentialSummary(
  profile: ModelProfile | null,
  status: { exists: boolean; credentialRef: string | null; storeKind: string } | null,
): string {
  if (!profile?.credentialRef) return "No service key saved for this model.";
  if (!status) return "Checking saved service key status.";
  if (status.exists) return "Saved in the system credential store.";
  return "A credential reference exists, but the key was not found in the credential store.";
}

export function credentialStatusClass(
  profile: ModelProfile | null,
  status: { exists: boolean; credentialRef: string | null } | null,
): string {
  if (!profile?.credentialRef) return "pill";
  if (!status) return "pill";
  return status.exists ? "pill green" : "pill amber";
}

export function credentialStatusLabel(
  profile: ModelProfile | null,
  status: { exists: boolean; credentialRef: string | null } | null,
): string {
  if (!profile?.credentialRef) return "No key";
  if (!status) return "Checking";
  return status.exists ? "Saved" : "Missing";
}
