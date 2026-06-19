import { estimateTokensFromText } from '../hosted/ai-platform-models.js';

export type TrimContextLayerId = 'history' | 'similar' | 'rag' | 'skills';

export interface TrimContextLayer {
  id: TrimContextLayerId;
  content: string;
}

export interface ContextBudgetOptions {
  budgetChars?: number;
  budgetTokens?: number;
  modelWindowTokens?: number;
}

const TRIM_ORDER: TrimContextLayerId[] = ['history', 'similar', 'rag', 'skills'];

export function getContextCharBudget(): number {
  const raw = process.env.CARINA_CONTEXT_CHAR_BUDGET;
  if (!raw) return 48_000;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 48_000;
}

export function getContextTokenBudget(): number {
  const raw = process.env.CARINA_CONTEXT_TOKEN_BUDGET;
  if (!raw) return Math.floor(getContextCharBudget() / 4);
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Math.floor(getContextCharBudget() / 4);
}

export function estimateContextChars(parts: string[]): number {
  return parts.reduce((sum, part) => sum + part.length, 0);
}

export function estimateContextTokens(parts: string[]): number {
  return estimateTokensFromText(parts.join('\n\n---\n\n'));
}

export interface ContextBudgetResult {
  fixedParts: string[];
  layers: TrimContextLayer[];
  trimmed: TrimContextLayerId[];
  historyCompacted: boolean;
  estimatedChars: number;
  estimatedTokens: number;
  budgetChars: number;
  budgetTokens: number;
}

function totalChars(fixedParts: string[], kept: Map<TrimContextLayerId, string>): number {
  return estimateContextChars([...fixedParts, ...[...kept.values()]]);
}

function totalTokens(fixedParts: string[], kept: Map<TrimContextLayerId, string>): number {
  return estimateContextTokens([...fixedParts, ...[...kept.values()]]);
}

function tryTruncateHistory(
  kept: Map<TrimContextLayerId, string>,
  fixedParts: string[],
  budgetChars: number,
  budgetTokens: number,
): boolean {
  const history = kept.get('history');
  if (!history) return false;
  const suffix = '\n[history truncated for context budget]';
  const overhead = totalChars(fixedParts, kept) - history.length;
  const room = Math.max(0, budgetChars - overhead - suffix.length);
  if (room >= history.length) return false;
  if (room < 80) return false;
  kept.set('history', `${history.slice(0, room)}${suffix}`);
  return totalTokens(fixedParts, kept) <= budgetTokens;
}

function resolveBudgetTokens(options: ContextBudgetOptions): number {
  const envBudget = getContextTokenBudget();
  const requested = options.budgetTokens ?? envBudget;
  if (!options.modelWindowTokens) return requested;
  const windowGuard = Math.max(1, Math.floor(options.modelWindowTokens * 0.7));
  return Math.min(requested, windowGuard);
}

export function applyContextBudget(
  fixedParts: string[],
  layers: TrimContextLayer[],
  budget: number | ContextBudgetOptions = getContextCharBudget(),
): ContextBudgetResult {
  const budgetChars = typeof budget === 'number'
    ? budget
    : budget.budgetChars ?? getContextCharBudget();
  const budgetTokens = typeof budget === 'number'
    ? getContextTokenBudget()
    : resolveBudgetTokens(budget);

  const kept = new Map<TrimContextLayerId, string>();
  for (const layer of layers) {
    if (layer.content.trim()) kept.set(layer.id, layer.content);
  }

  const trimmed: TrimContextLayerId[] = [];
  let historyCompacted = false;

  for (const id of TRIM_ORDER) {
    if (totalChars(fixedParts, kept) <= budgetChars && totalTokens(fixedParts, kept) <= budgetTokens) break;
    if (!kept.has(id)) continue;

    if (id === 'history' && tryTruncateHistory(kept, fixedParts, budgetChars, budgetTokens)) {
      historyCompacted = true;
      if (!trimmed.includes('history')) trimmed.push('history');
      if (totalChars(fixedParts, kept) <= budgetChars && totalTokens(fixedParts, kept) <= budgetTokens) break;
    }

    if (totalChars(fixedParts, kept) <= budgetChars && totalTokens(fixedParts, kept) <= budgetTokens) break;
    kept.delete(id);
    trimmed.push(id);
    if (id === 'history') historyCompacted = true;
  }

  return {
    fixedParts,
    layers: layers
      .filter((layer) => kept.has(layer.id))
      .map((layer) => ({ id: layer.id, content: kept.get(layer.id) ?? '' })),
    trimmed,
    historyCompacted,
    estimatedChars: totalChars(fixedParts, kept),
    estimatedTokens: totalTokens(fixedParts, kept),
    budgetChars,
    budgetTokens,
  };
}
