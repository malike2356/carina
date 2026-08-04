import type { ProviderDefinition } from './provider-registry.js';
import { isOperatorFreeProvider, type ProviderCapabilityNeed, providerMeetsCapability } from './provider-tags.js';

export const FREE_COPILOT_PRESET = 'free-copilot';

export interface CopilotSelection {
  preset: typeof FREE_COPILOT_PRESET;
  order: string[];
  primary: string | null;
  note: string;
}

export function isFreeCopilotPreset(value: string | undefined): boolean {
  return value === FREE_COPILOT_PRESET;
}

export function freeCopilotProviderOrder(
  configuredNames: string[],
  definitions: ProviderDefinition[],
  need: ProviderCapabilityNeed = 'chat',
): string[] {
  const configured = new Set(configuredNames);
  const available = definitions.filter((d) => configured.has(d.name));

  const matchesNeed = (d: ProviderDefinition) => providerMeetsCapability(d.tags, need);

  const local = available
    .filter((d) => d.tags.cost === 'local' && matchesNeed(d))
    .sort((a, b) => a.fallbackPriority - b.fallbackPriority);

  const operatorFree = available
    .filter((d) => d.tags.cost !== 'local' && isOperatorFreeProvider(d.name) && matchesNeed(d))
    .sort((a, b) => a.fallbackPriority - b.fallbackPriority);

  const taggedFree = available
    .filter((d) => d.tags.cost === 'free' && matchesNeed(d))
    .sort((a, b) => a.fallbackPriority - b.fallbackPriority);

  const cheapest = available
    .filter((d) =>
      d.tags.cost === 'byo-key'
      && !isOperatorFreeProvider(d.name)
      && matchesNeed(d))
    .sort((a, b) => a.fallbackPriority - b.fallbackPriority);

  const seen = new Set<string>();
  const order: string[] = [];
  for (const group of [local, operatorFree, taggedFree, cheapest]) {
    for (const def of group) {
      if (seen.has(def.name)) continue;
      seen.add(def.name);
      order.push(def.name);
    }
  }
  return order;
}

export function buildCopilotSelection(
  configuredNames: string[],
  definitions: ProviderDefinition[],
): CopilotSelection {
  const order = freeCopilotProviderOrder(configuredNames, definitions);
  const primary = order[0] ?? null;
  const note = order.length === 0
    ? 'No configured local or low-cost providers. Enable Ollama, LM Studio, or vLLM, or set API keys for a cheap provider.'
    : 'Free Copilot uses configured local endpoints first, then operator-marked free providers (CARINA_FREE_PROVIDERS), then cheapest configured fallback.';

  return {
    preset: FREE_COPILOT_PRESET,
    order,
    primary,
    note,
  };
}

export function mergeFallbackOrder(
  activeName: string,
  baseOrder: string[],
): string[] {
  return [activeName, ...baseOrder.filter((n) => n !== activeName)];
}

/** Resolve startup LLM provider without hardcoded provider names. */
export function resolveInitialActiveProvider(input: {
  configuredNames: string[];
  definitions: ProviderDefinition[];
  preferred?: string;
  envPreset?: string;
}): { active: string | null; preset?: string } {
  const { configuredNames, definitions, preferred, envPreset } = input;
  const trimmedPreferred = preferred?.trim();

  if (configuredNames.length === 0) {
    return { active: null };
  }

  if (isFreeCopilotPreset(envPreset) || isFreeCopilotPreset(trimmedPreferred)) {
    const selection = buildCopilotSelection(configuredNames, definitions);
    if (selection.primary) {
      return { active: selection.primary, preset: FREE_COPILOT_PRESET };
    }
  }

  if (trimmedPreferred && configuredNames.includes(trimmedPreferred)) {
    return { active: trimmedPreferred };
  }

  const configured = new Set(configuredNames);
  const byPriority = definitions
    .filter((d) => configured.has(d.name))
    .sort((a, b) => a.fallbackPriority - b.fallbackPriority);
  const firstPaid = byPriority.find((d) => d.name !== 'github-copilot');
  if (firstPaid) {
    return { active: firstPaid.name };
  }

  if (configuredNames.includes('github-copilot')) {
    return { active: 'github-copilot', preset: FREE_COPILOT_PRESET };
  }

  const selection = buildCopilotSelection(configuredNames, definitions);
  if (selection.primary) {
    return { active: selection.primary, preset: FREE_COPILOT_PRESET };
  }

  return { active: configuredNames[0] ?? null };
}
