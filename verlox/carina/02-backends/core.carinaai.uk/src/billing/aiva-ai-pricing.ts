/**
 * Managed Aiva AI pricing: provider cost × markup, rounded up to whole pence.
 * Unknown models use a conservative fallback so the platform never undercharges.
 * BYOK runs never call these helpers for billing.
 */

/** Charged = provider cost × this (GBP). */
export const AIVA_AI_MARKUP = 2;

/** Provider list price, GBP per 1,000,000 tokens {in, out}. */
export const AIVA_MODEL_PRICING: Record<string, { in: number; out: number }> = {
  'claude-haiku-4-5': { in: 0.8, out: 4.0 },
  'claude-sonnet-4-6': { in: 2.4, out: 12.0 },
  'claude-opus-4-8': { in: 4.0, out: 20.0 },
  'claude-opus-4-7': { in: 4.0, out: 20.0 },
  'gpt-4o-mini': { in: 0.12, out: 0.48 },
  'gpt-4o': { in: 2.0, out: 8.0 },
  'openai/gpt-4o-mini': { in: 0.12, out: 0.48 },
  'openai/gpt-4o': { in: 2.0, out: 8.0 },
  'deepseek-chat': { in: 0.11, out: 0.44 },
  'deepseek-reasoner': { in: 0.44, out: 1.76 },
};

/** Most expensive conservative tier (GBP / 1M tokens). */
export const AIVA_FALLBACK_PRICING = { in: 8.0, out: 40.0 };

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  input_tokens?: number;
  output_tokens?: number;
}

export function pricingForModel(model: string): { in: number; out: number } {
  const m = String(model || '').toLowerCase();
  if (AIVA_MODEL_PRICING[m]) return AIVA_MODEL_PRICING[m];
  for (const [key, price] of Object.entries(AIVA_MODEL_PRICING)) {
    if (m.includes(key)) return price;
  }
  if (m.includes('haiku')) return AIVA_MODEL_PRICING['claude-haiku-4-5'];
  if (m.includes('mini') || m.includes('deepseek-chat')) {
    return AIVA_MODEL_PRICING['gpt-4o-mini'];
  }
  return AIVA_FALLBACK_PRICING;
}

export function rawProviderCostGbp(model: string, usage: TokenUsage = {}): number {
  const p = pricingForModel(model);
  const inT = Number(usage.inputTokens ?? usage.input_tokens ?? 0);
  const outT = Number(usage.outputTokens ?? usage.output_tokens ?? 0);
  return (inT / 1e6) * p.in + (outT / 1e6) * p.out;
}

/**
 * Whole pence charged for a managed run (1 pence = £0.01 of charged value).
 * Always at least 1 pence for a real managed call so zero-token bugs cannot free-ride.
 */
export function chargedPenceForRun(model: string, usage: TokenUsage = {}): number {
  const chargedGbp = rawProviderCostGbp(model, usage) * AIVA_AI_MARKUP;
  return Math.max(1, Math.ceil(chargedGbp * 100));
}

/** Conservative pre-call estimate when token counts are unknown. */
export function estimateManagedCallPence(model: string, estimatedTokens = 2_000): number {
  const half = Math.max(1, Math.floor(estimatedTokens / 2));
  return chargedPenceForRun(model, { inputTokens: half, outputTokens: half });
}
