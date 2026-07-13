import crypto from 'crypto';
import type { Message } from '../types/index.js';
import { countMessageTokens, countTokens } from '../brain/token-counter.js';
import { applyContextBudget, type TrimContextLayer } from '../memory/context-budget.js';
import type { ModelPolicyTier, ModelPolicyRisk } from '../model-router/model-policy-router.js';

export type TokenOptimizationKind =
  | 'none'
  | 'exact_cache_hit'
  | 'semantic_cache_hit'
  | 'context_compacted'
  | 'prompt_compressed'
  | 'tool_result_trimmed'
  | 'provider_prompt_cache_requested';

export interface TokenOptimizationRecord {
  kind: TokenOptimizationKind;
  reason: string;
  rawEstimatedInputTokens: number;
  optimizedEstimatedInputTokens: number;
  outputTokenCap: number;
  savingsEstimateTokens: number;
}

export interface TokenOptimizationPlan {
  messages: Message[];
  records: TokenOptimizationRecord[];
  rawEstimatedInputTokens: number;
  optimizedEstimatedInputTokens: number;
  outputTokenCap: number;
  savingsEstimateTokens: number;
  cacheHit?: {
    kind: 'exact' | 'semantic';
    response: string;
    similarity?: number;
  };
}

export interface TokenEfficiencyPolicy {
  tenantId: string;
  workspaceId?: string;
  modelTier?: ModelPolicyTier;
  riskLevel?: ModelPolicyRisk;
  allowSemanticCache?: boolean;
  allowPromptCompression?: boolean;
  allowProviderPromptCache?: boolean;
  maxInputTokens?: number;
  requestedOutputTokens?: number;
}

export interface CacheEntry {
  tenantId: string;
  normalizedPrompt: string;
  response: string;
  createdAt: number;
  privacyClass: 'public' | 'tenant';
}

const exactCache = new Map<string, CacheEntry>();
const semanticCache = new Map<string, CacheEntry[]>();

const SECRET_PATTERNS = [
  /\b(api[_ -]?key|secret|password|token|credential|private key)\b/i,
  /\bsk-[A-Za-z0-9_-]{12,}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

const HIGH_RISK_PATTERNS = [
  /\b(legal advice|medical advice|diagnosis|investment advice|financial advice)\b/i,
  /\b(security incident|breach|exploit|malware|credential leak)\b/i,
  /\b(payment|refund|invoice|bank|card number)\b/i,
  /\b(approve|approval|deploy|delete|send email|post this)\b/i,
];

function latestUserText(messages: Message[]): string {
  return [...messages].reverse().find((message) => message.role === 'user')?.content ?? '';
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cacheKey(tenantId: string, text: string): string {
  return crypto.createHash('sha256').update(`${tenantId}:${normalize(text)}`).digest('hex');
}

function tokens(text: string): Set<string> {
  return new Set(normalize(text).split(' ').filter((word) => word.length > 2));
}

function jaccard(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  return intersection / (left.size + right.size - intersection);
}

export function containsSensitiveContent(text: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}

export function isCacheSafe(input: {
  messages: Message[];
  riskLevel?: ModelPolicyRisk;
  tenantScoped?: boolean;
}): boolean {
  const text = input.messages.map((message) => message.content).join('\n');
  if (!input.tenantScoped) return false;
  if (input.riskLevel && input.riskLevel !== 'low') return false;
  if (containsSensitiveContent(text)) return false;
  if (HIGH_RISK_PATTERNS.some((pattern) => pattern.test(text))) return false;
  return true;
}

export function clearTokenEfficiencyCaches(): void {
  exactCache.clear();
  semanticCache.clear();
}

export function storeExactResponse(input: {
  tenantId: string;
  prompt: string;
  response: string;
  privacyClass?: 'public' | 'tenant';
}): void {
  exactCache.set(cacheKey(input.tenantId, input.prompt), {
    tenantId: input.tenantId,
    normalizedPrompt: normalize(input.prompt),
    response: input.response,
    createdAt: Date.now(),
    privacyClass: input.privacyClass ?? 'tenant',
  });
}

export function lookupExactResponse(tenantId: string, prompt: string): CacheEntry | null {
  const entry = exactCache.get(cacheKey(tenantId, prompt));
  if (!entry || entry.tenantId !== tenantId) return null;
  return entry;
}

export function storeSemanticResponse(input: {
  tenantId: string;
  prompt: string;
  response: string;
}): void {
  const entries = semanticCache.get(input.tenantId) ?? [];
  entries.push({
    tenantId: input.tenantId,
    normalizedPrompt: normalize(input.prompt),
    response: input.response,
    createdAt: Date.now(),
    privacyClass: 'tenant',
  });
  semanticCache.set(input.tenantId, entries.slice(-100));
}

export function lookupSemanticResponse(
  tenantId: string,
  prompt: string,
  threshold = 0.86,
): { entry: CacheEntry; similarity: number } | null {
  const entries = semanticCache.get(tenantId) ?? [];
  let best: { entry: CacheEntry; similarity: number } | null = null;
  for (const entry of entries) {
    const similarity = jaccard(prompt, entry.normalizedPrompt);
    if (similarity >= threshold && (!best || similarity > best.similarity)) {
      best = { entry, similarity };
    }
  }
  return best;
}

export function compactConversation(messages: Message[], maxTokens: number): {
  messages: Message[];
  compacted: boolean;
} {
  const rawTokens = countMessageTokens(messages).tokens;
  if (rawTokens <= maxTokens || messages.length <= 4) return { messages, compacted: false };
  const first = messages.slice(0, 1);
  const recent = messages.slice(-3);
  const middle = messages.slice(1, -3);
  const summary = middle
    .map((message) => `${message.role}: ${message.content}`)
    .join('\n')
    .slice(0, 1800);
  return {
    messages: [
      ...first,
      {
        role: 'system',
        content: `Conversation memory compacted for context budget:\n${summary}`,
        timestamp: new Date(),
      },
      ...recent,
    ],
    compacted: true,
  };
}

export function trimToolResult(content: string, maxChars = 1800): {
  content: string;
  trimmed: boolean;
} {
  if (content.length <= maxChars) return { content, trimmed: false };
  const urls = [...content.matchAll(/https?:\/\/\S+/g)].map((match) => match[0]).slice(0, 8);
  const suffix = urls.length
    ? `\n\nEvidence links retained:\n${urls.join('\n')}`
    : '\n\n[tool result trimmed for token budget]';
  return {
    content: `${content.slice(0, Math.max(120, maxChars - suffix.length))}${suffix}`,
    trimmed: true,
  };
}

export function dedupeRagPassages(passages: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const passage of passages) {
    const key = normalize(passage).slice(0, 240);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(passage);
  }
  return out;
}

export function maybeCompressPrompt(input: {
  text: string;
  enabled?: boolean;
  minSavingsTokens?: number;
  targetRatio?: number;
}): { text: string; compressed: boolean; savedTokens: number } {
  if (!input.enabled) return { text: input.text, compressed: false, savedTokens: 0 };
  const originalTokens = countTokens(input.text).tokens;
  if (originalTokens < 1000) return { text: input.text, compressed: false, savedTokens: 0 };
  const targetRatio = input.targetRatio ?? 0.65;
  const targetChars = Math.max(600, Math.floor(input.text.length * targetRatio));
  const compressed = `${input.text.slice(0, Math.floor(targetChars * 0.7))}\n[compressed middle context]\n${input.text.slice(-Math.floor(targetChars * 0.3))}`;
  const compressedTokens = countTokens(compressed).tokens;
  const savedTokens = Math.max(0, originalTokens - compressedTokens);
  if (savedTokens < (input.minSavingsTokens ?? 300)) {
    return { text: input.text, compressed: false, savedTokens: 0 };
  }
  return { text: compressed, compressed: true, savedTokens };
}

export function outputCapForTier(tier: ModelPolicyTier | undefined, requested?: number): number {
  const cap = tier === 'claude_deep' ? 8192 : tier === 'openai_action' ? 4096 : 1536;
  if (!requested) return cap;
  return Math.min(cap, Math.max(128, requested));
}

export function optimizeMessages(
  messages: Message[],
  policy: TokenEfficiencyPolicy,
): TokenOptimizationPlan {
  const rawEstimatedInputTokens = countMessageTokens(messages).tokens;
  const records: TokenOptimizationRecord[] = [];
  const outputTokenCap = outputCapForTier(policy.modelTier, policy.requestedOutputTokens);
  const prompt = latestUserText(messages);
  const cacheSafe = isCacheSafe({
    messages,
    riskLevel: policy.riskLevel,
    tenantScoped: Boolean(policy.tenantId),
  });

  if (cacheSafe) {
    const exact = lookupExactResponse(policy.tenantId, prompt);
    if (exact) {
      records.push({
        kind: 'exact_cache_hit',
        reason: 'Exact tenant-scoped safe response cache hit.',
        rawEstimatedInputTokens,
        optimizedEstimatedInputTokens: 0,
        outputTokenCap,
        savingsEstimateTokens: rawEstimatedInputTokens,
      });
      return {
        messages,
        records,
        rawEstimatedInputTokens,
        optimizedEstimatedInputTokens: 0,
        outputTokenCap,
        savingsEstimateTokens: rawEstimatedInputTokens,
        cacheHit: { kind: 'exact', response: exact.response },
      };
    }

    if (policy.allowSemanticCache) {
      const semantic = lookupSemanticResponse(policy.tenantId, prompt);
      if (semantic) {
        records.push({
          kind: 'semantic_cache_hit',
          reason: 'Semantic tenant-scoped safe response cache hit.',
          rawEstimatedInputTokens,
          optimizedEstimatedInputTokens: 0,
          outputTokenCap,
          savingsEstimateTokens: rawEstimatedInputTokens,
        });
        return {
          messages,
          records,
          rawEstimatedInputTokens,
          optimizedEstimatedInputTokens: 0,
          outputTokenCap,
          savingsEstimateTokens: rawEstimatedInputTokens,
          cacheHit: { kind: 'semantic', response: semantic.entry.response, similarity: semantic.similarity },
        };
      }
    }
  }

  let optimized = messages.map((message) => ({ ...message }));
  for (const message of optimized) {
    if (message.role !== 'tool_result') continue;
    const trimmed = trimToolResult(message.content);
    if (trimmed.trimmed) {
      message.content = trimmed.content;
      records.push({
        kind: 'tool_result_trimmed',
        reason: 'Long tool result trimmed while retaining evidence links.',
        rawEstimatedInputTokens,
        optimizedEstimatedInputTokens: countMessageTokens(optimized).tokens,
        outputTokenCap,
        savingsEstimateTokens: Math.max(0, rawEstimatedInputTokens - countMessageTokens(optimized).tokens),
      });
    }
  }

  const maxInputTokens = policy.maxInputTokens ?? (policy.modelTier === 'claude_deep' ? 32_000 : policy.modelTier === 'openai_action' ? 16_000 : 6_000);
  const compacted = compactConversation(optimized, maxInputTokens);
  if (compacted.compacted) {
    optimized = compacted.messages;
    const optimizedTokens = countMessageTokens(optimized).tokens;
    records.push({
      kind: 'context_compacted',
      reason: 'Conversation history compacted to fit the model tier context budget.',
      rawEstimatedInputTokens,
      optimizedEstimatedInputTokens: optimizedTokens,
      outputTokenCap,
      savingsEstimateTokens: Math.max(0, rawEstimatedInputTokens - optimizedTokens),
    });
  }

  if (policy.allowPromptCompression) {
    optimized = optimized.map((message) => {
      if (message.role === 'system' || message.content.length < 4000) return message;
      const compressed = maybeCompressPrompt({
        text: message.content,
        enabled: true,
      });
      if (!compressed.compressed) return message;
      records.push({
        kind: 'prompt_compressed',
        reason: 'Long non-system context compressed because expected savings exceeded overhead.',
        rawEstimatedInputTokens,
        optimizedEstimatedInputTokens: Math.max(0, countMessageTokens(optimized).tokens - compressed.savedTokens),
        outputTokenCap,
        savingsEstimateTokens: compressed.savedTokens,
      });
      return { ...message, content: compressed.text };
    });
  }

  if (policy.allowProviderPromptCache) {
    records.push({
      kind: 'provider_prompt_cache_requested',
      reason: 'Provider prompt cache requested for supported static prompt sections.',
      rawEstimatedInputTokens,
      optimizedEstimatedInputTokens: countMessageTokens(optimized).tokens,
      outputTokenCap,
      savingsEstimateTokens: 0,
    });
  }

  if (records.length === 0) {
    records.push({
      kind: 'none',
      reason: 'No safe token optimization was applicable.',
      rawEstimatedInputTokens,
      optimizedEstimatedInputTokens: rawEstimatedInputTokens,
      outputTokenCap,
      savingsEstimateTokens: 0,
    });
  }

  const optimizedEstimatedInputTokens = countMessageTokens(optimized).tokens;
  return {
    messages: optimized,
    records,
    rawEstimatedInputTokens,
    optimizedEstimatedInputTokens,
    outputTokenCap,
    savingsEstimateTokens: Math.max(0, rawEstimatedInputTokens - optimizedEstimatedInputTokens),
  };
}

export function planRagBudget(
  fixedParts: string[],
  passages: string[],
  maxTokens: number,
): {
  layers: TrimContextLayer[];
  records: TokenOptimizationRecord[];
} {
  const deduped = dedupeRagPassages(passages);
  const result = applyContextBudget(
    fixedParts,
    [{ id: 'rag', content: deduped.join('\n\n---\n\n') }],
    { budgetTokens: maxTokens },
  );
  const raw = countTokens(passages.join('\n\n')).tokens;
  const optimized = result.estimatedTokens;
  return {
    layers: result.layers,
    records: result.trimmed.includes('rag') || deduped.length !== passages.length
      ? [{
        kind: 'context_compacted',
        reason: 'RAG passages deduplicated or trimmed to fit the retrieval budget.',
        rawEstimatedInputTokens: raw,
        optimizedEstimatedInputTokens: optimized,
        outputTokenCap: 0,
        savingsEstimateTokens: Math.max(0, raw - optimized),
      }]
      : [],
  };
}
