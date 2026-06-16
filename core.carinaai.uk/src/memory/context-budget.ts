import { estimateTokensFromText } from '../hosted/ai-platform-models.js';

export type TrimContextLayerId = 'history' | 'similar' | 'rag' | 'skills';

export interface TrimContextLayer {
  id: TrimContextLayerId;
  content: string;
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
  budgetChars: number;
}

function totalChars(fixedParts: string[], kept: Map<TrimContextLayerId, string>): number {
  return estimateContextChars([...fixedParts, ...[...kept.values()]]);
}

function tryTruncateHistory(
  kept: Map<TrimContextLayerId, string>,
  fixedParts: string[],
  budgetChars: number,
): boolean {
  const history = kept.get('history');
  if (!history) return false;
  const suffix = '\n[history truncated for context budget]';
  const overhead = totalChars(fixedParts, kept) - history.length;
  const room = Math.max(0, budgetChars - overhead - suffix.length);
  if (room >= history.length) return false;
  if (room < 80) return false;
  kept.set('history', `${history.slice(0, room)}${suffix}`);
  return true;
}

export function applyContextBudget(
  fixedParts: string[],
  layers: TrimContextLayer[],
  budgetChars = getContextCharBudget(),
): ContextBudgetResult {
  const kept = new Map<TrimContextLayerId, string>();
  for (const layer of layers) {
    if (layer.content.trim()) kept.set(layer.id, layer.content);
  }

  const trimmed: TrimContextLayerId[] = [];
  let historyCompacted = false;

  for (const id of TRIM_ORDER) {
    if (totalChars(fixedParts, kept) <= budgetChars) break;
    if (!kept.has(id)) continue;

    if (id === 'history' && tryTruncateHistory(kept, fixedParts, budgetChars)) {
      historyCompacted = true;
      if (!trimmed.includes('history')) trimmed.push('history');
      if (totalChars(fixedParts, kept) <= budgetChars) break;
    }

    if (totalChars(fixedParts, kept) <= budgetChars) break;
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
    budgetChars,
  };
}
