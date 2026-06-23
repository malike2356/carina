import type { ModelClass } from '../billing/rate-card.js';
import { classifyModel } from '../billing/rate-card.js';
import { PROVIDER_MAP, type ProviderDefinition } from './provider-registry.js';

export type ModelMetadata = {
  provider: string;
  model: string;
  tier: ModelClass;
  contextWindow: number;
  /** Blended USD per token estimate used for preflight warnings. */
  usdPerToken: number;
  capabilities: {
    chat: boolean;
    vision: boolean;
    tools: boolean;
    reasoning: boolean;
  };
};

const KNOWN_MODEL_WINDOWS: Array<{ pattern: RegExp; contextWindow: number; usdPer1M?: number }> = [
  { pattern: /claude-opus/i, contextWindow: 200_000, usdPer1M: 15 },
  { pattern: /claude-sonnet/i, contextWindow: 200_000, usdPer1M: 3 },
  { pattern: /claude-3-5-haiku|haiku/i, contextWindow: 200_000, usdPer1M: 0.8 },
  { pattern: /gpt-4o-mini/i, contextWindow: 128_000, usdPer1M: 0.3 },
  { pattern: /gpt-4o(?!-mini)/i, contextWindow: 128_000, usdPer1M: 5 },
  { pattern: /^o3/i, contextWindow: 200_000, usdPer1M: 15 },
  { pattern: /gpt-5/i, contextWindow: 256_000, usdPer1M: 20 },
  { pattern: /deepseek-chat/i, contextWindow: 64_000, usdPer1M: 0.14 },
  { pattern: /deepseek-reasoner/i, contextWindow: 64_000, usdPer1M: 0.55 },
  { pattern: /gemini-2\.0-flash/i, contextWindow: 1_000_000, usdPer1M: 0.1 },
  { pattern: /gemini-1\.5-pro/i, contextWindow: 2_000_000, usdPer1M: 1.25 },
];

function matchKnownModel(model: string) {
  for (const entry of KNOWN_MODEL_WINDOWS) {
    if (entry.pattern.test(model)) return entry;
  }
  return null;
}

function providerDef(provider: string): ProviderDefinition | undefined {
  return PROVIDER_MAP[provider];
}

export function getModelMetadata(provider: string, model: string): ModelMetadata {
  const def = providerDef(provider);
  const known = matchKnownModel(model);
  const tier = classifyModel(model);
  const usdPerToken = known?.usdPer1M
    ? known.usdPer1M / 1_000_000
    : (def?.usdPerToken ?? 0.000002);

  return {
    provider,
    model,
    tier,
    contextWindow: known?.contextWindow ?? defaultContextWindow(def),
    usdPerToken,
    capabilities: {
      chat: def?.capabilities.chat ?? true,
      vision: def?.capabilities.vision ?? false,
      tools: def?.capabilities.tools ?? true,
      reasoning: def?.capabilities.reasoning ?? (tier === 'premium' || tier === 'frontier'),
    },
  };
}

function defaultContextWindow(def: ProviderDefinition | undefined): number {
  if (!def) return 128_000;
  if (def.kind === 'gemini') return 1_000_000;
  if (def.local) return 32_768;
  return 128_000;
}

export function isExpensiveModelTier(tier: ModelClass): boolean {
  return tier === 'premium' || tier === 'frontier';
}

export function formatModelMetadataLine(meta: ModelMetadata): string {
  return `${meta.provider}/${meta.model}: tier=${meta.tier}, context=${meta.contextWindow.toLocaleString()}, est=$${(meta.usdPerToken * 1_000_000).toFixed(2)}/1M tokens`;
}
