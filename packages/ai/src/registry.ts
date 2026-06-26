import type { AiProvider } from "@novel-studio/contracts";
import { AnthropicProvider } from "./anthropicProvider.js";
import { createSystemCredentialStore, type CredentialStore } from "./credentials.js";
import { GeminiProvider } from "./geminiProvider.js";
import { MockProvider } from "./mockProvider.js";
import { OpenAiCompatibleProvider } from "./openAiCompatibleProvider.js";
import type { ProviderAdapter } from "./provider.js";

export interface ProviderRegistryOptions {
  credentialStore?: CredentialStore;
  fetchImpl?: typeof fetch;
}

export class ProviderRegistry {
  private readonly adapters = new Map<AiProvider, ProviderAdapter>();

  register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.provider, adapter);
  }

  get(provider: AiProvider): ProviderAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new Error(`Provider is not registered: ${provider}`);
    }
    return adapter;
  }

  list(): ProviderAdapter[] {
    return [...this.adapters.values()];
  }
}

export function createDefaultProviderRegistry(options: ProviderRegistryOptions = {}): ProviderRegistry {
  const registry = new ProviderRegistry();
  registry.register(new MockProvider());
  const openAiCompatibleOptions: ConstructorParameters<typeof OpenAiCompatibleProvider>[0] = {
    credentialStore: options.credentialStore ?? createSystemCredentialStore(),
  };
  if (options.fetchImpl) openAiCompatibleOptions.fetchImpl = options.fetchImpl;
  registry.register(new OpenAiCompatibleProvider(openAiCompatibleOptions));
  registry.register(new OpenAiCompatibleProvider({
    ...openAiCompatibleOptions,
    provider: "deepseek",
    title: "DeepSeek",
    defaultBaseUrl: "https://api.deepseek.com",
    models: [
      {
        id: "deepseek-v4-flash",
        title: "DeepSeek V4 Flash",
        contextWindowTokens: 1_000_000,
        capabilities: {
          streamText: true,
          structuredOutput: true,
          embeddings: false,
          tokenEstimate: true,
          modelList: true,
        },
      },
      {
        id: "deepseek-v4-pro",
        title: "DeepSeek V4 Pro",
        contextWindowTokens: 1_000_000,
        capabilities: {
          streamText: true,
          structuredOutput: true,
          embeddings: false,
          tokenEstimate: true,
          modelList: true,
        },
      },
    ],
  }));
  registry.register(new OpenAiCompatibleProvider({
    ...openAiCompatibleOptions,
    provider: "openai",
    title: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    instructionRole: "developer",
    maxOutputTokenField: "max_completion_tokens",
  }));
  registry.register(new OpenAiCompatibleProvider({
    ...openAiCompatibleOptions,
    provider: "openrouter",
    title: "OpenRouter",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    maxOutputTokenField: "max_completion_tokens",
  }));
  registry.register(new OpenAiCompatibleProvider({
    ...openAiCompatibleOptions,
    provider: "ollama",
    title: "Ollama",
    defaultBaseUrl: "http://localhost:11434/v1",
  }));
  registry.register(new AnthropicProvider({
    credentialStore: openAiCompatibleOptions.credentialStore,
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  }));
  registry.register(new GeminiProvider({
    credentialStore: openAiCompatibleOptions.credentialStore,
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  }));
  return registry;
}
