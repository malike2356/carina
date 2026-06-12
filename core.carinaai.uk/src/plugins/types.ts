import type { ProviderDefinition } from '../brain/provider-registry.js';
import type { LLMProvider } from '../types/index.js';

/**
 * A provider plugin exports these from its module.
 * - `providerDefinitions`: one or more provider catalog entries
 * - `providerFactory`: optional — if the provider needs a non-standard
 *   adapter (i.e. not OpenAICompatibleProvider, not Claude, not Gemini),
 *   provide a factory that returns an LLMProvider instance.
 */
export interface ProviderPlugin {
  providerDefinitions: ProviderDefinition[];
  providerFactory?: (def: ProviderDefinition) => LLMProvider | null;
}

/**
 * Normalise a module's default export (might be ESM or a plain object).
 */
export function normalisePlugin(raw: unknown): ProviderPlugin | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.providerDefinitions)) return null;
  return {
    providerDefinitions: obj.providerDefinitions as ProviderDefinition[],
    providerFactory: typeof obj.providerFactory === 'function'
      ? obj.providerFactory as ProviderPlugin['providerFactory']
      : undefined,
  };
}
