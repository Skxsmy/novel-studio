import type { AiProvider } from "@novel-studio/contracts";
import { MockProvider } from "./mockProvider.js";
import type { ProviderAdapter } from "./provider.js";

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

export function createDefaultProviderRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();
  registry.register(new MockProvider());
  return registry;
}
