import type {
  AiProvider,
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
  contextWindowTokens: number;
  id: string | null;
  model: string;
  provider: AiProvider;
  secret: string;
  title: string;
}

export const providerOptions: Array<SelectOption<AiProvider>> = [
  { label: "DeepSeek", value: "deepseek" },
  { label: "OpenAI", value: "openai" },
  { label: "Anthropic", value: "anthropic" },
  { label: "Google Gemini", value: "google" },
  { label: "OpenRouter", value: "openrouter" },
  { label: "Ollama", value: "ollama" },
  { label: "OpenAI-compatible", value: "openai-compatible" },
];

const commonTextCapabilities: ModelCapability = {
  embeddings: false,
  modelList: true,
  streamText: true,
  structuredOutput: true,
  tokenEstimate: true,
};

const providerDefaults: Record<AiProvider, Omit<ModelProfileForm, "id" | "secret">> = {
  anthropic: {
    baseUrl: "",
    capabilities: commonTextCapabilities,
    contextWindowTokens: 200000,
    model: "claude-sonnet-4-20250514",
    provider: "anthropic",
    title: "Anthropic Claude",
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com",
    capabilities: commonTextCapabilities,
    contextWindowTokens: 1000000,
    model: "deepseek-v4-flash",
    provider: "deepseek",
    title: "DeepSeek",
  },
  google: {
    baseUrl: "",
    capabilities: commonTextCapabilities,
    contextWindowTokens: 1048576,
    model: "gemini-2.5-pro",
    provider: "google",
    title: "Google Gemini",
  },
  mock: {
    baseUrl: "",
    capabilities: commonTextCapabilities,
    contextWindowTokens: 8192,
    model: "mock-continuity-v1",
    provider: "mock",
    title: "Mock",
  },
  ollama: {
    baseUrl: "http://localhost:11434/v1",
    capabilities: {
      embeddings: false,
      modelList: true,
      streamText: true,
      structuredOutput: false,
      tokenEstimate: true,
    },
    contextWindowTokens: 8192,
    model: "llama3.1",
    provider: "ollama",
    title: "Ollama",
  },
  openai: {
    baseUrl: "",
    capabilities: commonTextCapabilities,
    contextWindowTokens: 128000,
    model: "gpt-4.1",
    provider: "openai",
    title: "OpenAI",
  },
  "openai-compatible": {
    baseUrl: "",
    capabilities: commonTextCapabilities,
    contextWindowTokens: 128000,
    model: "",
    provider: "openai-compatible",
    title: "OpenAI-compatible",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    capabilities: commonTextCapabilities,
    contextWindowTokens: 128000,
    model: "",
    provider: "openrouter",
    title: "OpenRouter",
  },
};

export function defaultFormForProvider(provider: AiProvider): ModelProfileForm {
  return {
    ...providerDefaults[provider],
    id: null,
    secret: "",
  };
}

export const emptyModelProfileForm: ModelProfileForm = defaultFormForProvider("deepseek");

export function requiresServiceKey(provider: AiProvider): boolean {
  return provider !== "ollama" && provider !== "mock";
}

export function visibleSettingsProfile(profile: ModelProfile): boolean {
  return profile.archivedAt === null && profile.provider !== "mock";
}

export function providerLabel(provider: AiProvider): string {
  return providerOptions.find((option) => option.value === provider)?.label ?? provider;
}

export function providerDefaultsForSelection(provider: AiProvider) {
  return providerDefaults[provider];
}

export function formFromProfile(profile: ModelProfile): ModelProfileForm {
  return {
    baseUrl: profile.baseUrl ?? "",
    capabilities: profile.capabilities,
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
    contextWindowTokens: form.contextWindowTokens,
    model: form.model.trim() || emptyModelProfileForm.model,
    provider: form.provider,
    title: form.title.trim() || "Untitled Model",
  };
}

export function profileStatusLabel(profile: ModelProfile): string {
  if (profile.credentialRef) return "Key saved";
  if (!requiresServiceKey(profile.provider)) return "Ready";
  return "Needs key";
}

export function profileStatusClass(profile: ModelProfile): string {
  if (profile.credentialRef || !requiresServiceKey(profile.provider)) return "pill green";
  return "pill amber";
}

export function connectionSummary(result: ProviderConnectionResult | null): string {
  if (!result) return "Test a saved model setting to see the provider result.";
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
