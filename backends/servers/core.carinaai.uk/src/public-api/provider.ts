// STABLE API: changes require semver major bump and docs/kernel/STABLE_API.md update.

import {
  registerPluginProviders,
  type ProviderDefinition,
} from '../brain/provider-registry.js';

export type {
  ProviderDefinition,
  ProviderKind,
  ProviderStatus,
  ProviderAuthType,
  ProviderTransportType,
  ProviderName,
} from '../brain/provider-registry.js';

export {
  PROVIDER_DEFINITIONS,
  PROVIDER_MAP,
  fallbackOrderNames,
  isProviderConfigured,
  registerPluginProviders,
} from '../brain/provider-registry.js';

/** Register one LLM provider (plugin extension point). Returns names added. */
export function registerProvider(def: ProviderDefinition): string[] {
  return registerPluginProviders([def]);
}

/** Register multiple LLM providers. Returns names that were added. */
export function registerProviders(defs: ProviderDefinition[]): string[] {
  return registerPluginProviders(defs);
}

export const PROVIDER_API_VERSION = '0.2.0';
