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

/**
 * Provider failover / rotation.
 *
 * CARINA_LLM_ROTATION_ENABLED=true|false (default true)
 *   When false, only the active provider (DEFAULT_PROVIDER) is used.
 *   No failover to other LLMs.
 *
 * CARINA_LLM_ROTATION_PROVIDERS=gemini,deepseek,anthropic,openai
 *   When rotation is on, only these providers are eligible (order preserved).
 *   Falls back to CARINA_PROVIDER_FALLBACK for compatibility when unset.
 *
 * CARINA_PROVIDER_FALLBACK=...  (legacy alias for the allowlist)
 */
export function isLlmRotationEnabled(
  raw = process.env.CARINA_LLM_ROTATION_ENABLED,
): boolean {
  if (raw == null || raw.trim() === '') return true;
  const v = raw.trim().toLowerCase();
  return !(v === '0' || v === 'false' || v === 'off' || v === 'no');
}

export function parseFallbackChainEnv(
  raw = process.env.CARINA_PROVIDER_FALLBACK?.trim(),
): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

/** Preferred allowlist; falls back to legacy CARINA_PROVIDER_FALLBACK. */
export function parseRotationProvidersEnv(
  rotationRaw = process.env.CARINA_LLM_ROTATION_PROVIDERS?.trim(),
  fallbackRaw = process.env.CARINA_PROVIDER_FALLBACK?.trim(),
): string[] {
  const fromRotation = parseFallbackChainEnv(rotationRaw);
  if (fromRotation.length > 0) return fromRotation;
  return parseFallbackChainEnv(fallbackRaw);
}

export function resolveProviderFallbackChain(opts: {
  activeProvider: string;
  preset?: string;
  configuredNames: string[];
  definitions: ProviderDefinition[];
  envOverride?: string[];
  rotationEnabled?: boolean;
}): string[] {
  const configured = new Set(opts.configuredNames);
  const active = opts.activeProvider?.trim().toLowerCase() ?? '';

  const rotationOn = opts.rotationEnabled ?? isLlmRotationEnabled();
  if (!rotationOn) {
    if (!active || !configured.has(active) || !isProviderAvailable(active)) return [];
    return [active];
  }

  const envChain = opts.envOverride ?? parseRotationProvidersEnv();
  const base = isFreeCopilotPreset(opts.preset)
    ? freeCopilotProviderOrder(opts.configuredNames, opts.definitions)
    : envChain.length > 0
      ? envChain.filter((name) => configured.has(name))
      : fallbackOrderNames();

  const merged = mergeFallbackOrder(active, base);
  const available = merged.filter((name) => configured.has(name) && isProviderAvailable(name));
  if (available.length > 0) return available;

  // A transient provider failure must not strand every following turn. The
  // health cache is a routing preference, not a permanent circuit breaker.
  // Retry the configured chain when every candidate is temporarily unhealthy.
  return merged.filter((name) => configured.has(name));
}
