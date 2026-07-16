import {
  fallbackOrderNames,
  type ProviderDefinition,
} from './provider-registry.js';
import {
  freeCopilotProviderOrder,
  isFreeCopilotPreset,
  mergeFallbackOrder,
} from './provider-routing.js';
import { isProviderAvailable } from './provider-health.js';

export function parseFallbackChainEnv(
  raw = process.env.CARINA_PROVIDER_FALLBACK?.trim(),
): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

export function resolveProviderFallbackChain(opts: {
  activeProvider: string;
  preset?: string;
  configuredNames: string[];
  definitions: ProviderDefinition[];
  envOverride?: string[];
}): string[] {
  const envChain = opts.envOverride ?? parseFallbackChainEnv();
  const base = isFreeCopilotPreset(opts.preset)
    ? freeCopilotProviderOrder(opts.configuredNames, opts.definitions)
    : envChain.length > 0
      ? envChain.filter((name) => opts.configuredNames.includes(name))
      : fallbackOrderNames();

  const merged = mergeFallbackOrder(opts.activeProvider, base);
  const configured = new Set(opts.configuredNames);
  return merged.filter((name) => configured.has(name) && isProviderAvailable(name));
}
