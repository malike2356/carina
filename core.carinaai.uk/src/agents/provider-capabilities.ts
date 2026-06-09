import {
  buildProviderCapabilitiesMap,
  buildProviderDisplayNames,
} from '../brain/provider-registry.js';

export interface ProviderCapabilities {
  chat: boolean;
  vision: boolean;
  streaming: boolean;
  tools: boolean;
}

export const PROVIDER_CAPABILITIES = buildProviderCapabilitiesMap();

export function providerDisplayName(provider: string): string {
  const names = buildProviderDisplayNames();
  return names[provider] ?? provider;
}
