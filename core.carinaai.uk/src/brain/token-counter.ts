import { getModelMetadata } from './model-metadata.js';

export type TokenCountBreakdown = {
  tokens: number;
  method: 'provider' | 'heuristic';
  chars: number;
};

const CODE_HEAVY = /```[\s\S]*?```|`[^`]+`/g;
const WHITESPACE = /\s+/g;

function heuristicTokens(text: string, contextWindow?: number): number {
  const normalized = text.replace(CODE_HEAVY, ' ').replace(WHITESPACE, ' ').trim();
  if (!normalized) return 0;
  const words = normalized.split(' ').filter(Boolean).length;
  const charEstimate = Math.ceil(normalized.length / 4);
  const wordEstimate = Math.ceil(words * 1.25);
  let tokens = Math.max(charEstimate, wordEstimate);
  if (contextWindow && contextWindow >= 200_000) {
    tokens = Math.ceil(tokens * 0.95);
  }
  return Math.max(1, tokens);
}

export function countTokens(text: string, opts?: { provider?: string; model?: string }): TokenCountBreakdown {
  const chars = text.length;
  const metadata = opts?.provider && opts?.model
    ? getModelMetadata(opts.provider, opts.model)
    : null;
  return {
    tokens: heuristicTokens(text, metadata?.contextWindow),
    method: 'heuristic',
    chars,
  };
}

export function countMessageTokens(
  messages: Array<{ role?: string; content?: string }>,
  opts?: { provider?: string; model?: string },
): TokenCountBreakdown {
  const joined = messages
    .map((m) => `${m.role ?? 'user'}: ${m.content ?? ''}`)
    .join('\n\n');
  const base = countTokens(joined, opts);
  const overhead = Math.max(4, messages.length * 3);
  return { ...base, tokens: base.tokens + overhead };
}

export function mergeTokenUsage(
  providerTokens: number | undefined,
  fallbackText: string,
  opts?: { provider?: string; model?: string },
): TokenCountBreakdown {
  if (providerTokens && providerTokens > 0) {
    return { tokens: providerTokens, method: 'provider', chars: fallbackText.length };
  }
  return countTokens(fallbackText, opts);
}
