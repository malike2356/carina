import { pool } from '../memory/db.js';

export type ModelClass = 'mini' | 'balanced' | 'premium' | 'frontier';

export interface RateCard {
  id: number;
  modelClass: ModelClass;
  inputWeight: number;
  outputWeight: number;
  cacheWeight: number;
}

const MODEL_CLASS_ORDER: ModelClass[] = ['mini', 'balanced', 'premium', 'frontier'];

export function modelClassRank(modelClass: ModelClass): number {
  return MODEL_CLASS_ORDER.indexOf(modelClass);
}

export function highestAllowedModelClass(allowed: ModelClass[]): ModelClass {
  return allowed.reduce((best, current) =>
    (modelClassRank(current) > modelClassRank(best) ? current : best));
}

export function classifyModel(model: string): ModelClass {
  const name = model.toLowerCase();
  if (
    name.includes('haiku')
    || name.includes('4o-mini')
    || name.includes('gpt-4o-mini')
    || name.includes('deepseek-chat')
    || name.includes('deepseek-lite')
  ) {
    return 'mini';
  }
  if (
    name.includes('opus')
    || name.includes('gpt-4.5')
    || name.startsWith('o3')
    || name.includes('-o3')
  ) {
    return 'premium';
  }
  if (
    name.startsWith('gpt-5')
    || name.includes('fable')
  ) {
    return 'frontier';
  }
  if (
    name.includes('sonnet')
    || name.includes('gpt-4o')
    || name.includes('deepseek-v3')
    || name.includes('deepseek-reasoner')
  ) {
    return 'balanced';
  }
  return 'balanced';
}

export async function getCurrentRateCard(modelClass: ModelClass): Promise<RateCard> {
  const result = await pool.query<{
    id: number;
    model_class: string;
    input_weight: string;
    output_weight: string;
    cache_weight: string;
  }>(
    `SELECT id, model_class, input_weight, output_weight, cache_weight
     FROM ops_model_rate_cards
     WHERE model_class = $1
       AND effective_from <= NOW()
       AND (effective_to IS NULL OR effective_to > NOW())
     ORDER BY effective_from DESC
     LIMIT 1`,
    [modelClass],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error(`No active rate card for model class: ${modelClass}`);
  }
  return {
    id: row.id,
    modelClass: row.model_class as ModelClass,
    inputWeight: Number(row.input_weight),
    outputWeight: Number(row.output_weight),
    cacheWeight: Number(row.cache_weight),
  };
}

export async function getRateCardsForClasses(classes: ModelClass[]): Promise<Record<string, Pick<RateCard, 'inputWeight' | 'outputWeight' | 'cacheWeight'>>> {
  const out: Record<string, Pick<RateCard, 'inputWeight' | 'outputWeight' | 'cacheWeight'>> = {};
  for (const modelClass of classes) {
    const card = await getCurrentRateCard(modelClass);
    out[modelClass] = {
      inputWeight: card.inputWeight,
      outputWeight: card.outputWeight,
      cacheWeight: card.cacheWeight,
    };
  }
  return out;
}

export function computeBillableCredits(
  rateCard: RateCard,
  tokensIn: number,
  tokensOut: number,
  tokensCached: number,
): number {
  const raw =
    tokensIn * rateCard.inputWeight
    + tokensOut * rateCard.outputWeight
    + tokensCached * rateCard.cacheWeight;
  return Math.ceil(raw * 1_000_000) / 1_000_000;
}

export function estimateCreditsForCall(
  rateCard: RateCard,
  estimatedInputTokens: number,
  estimatedOutputTokens: number,
): number {
  return computeBillableCredits(rateCard, estimatedInputTokens, estimatedOutputTokens, 0);
}
