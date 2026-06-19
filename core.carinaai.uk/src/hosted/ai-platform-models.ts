import { queryForOrg } from './scoped-query.js';
import { classifyModel } from '../billing/rate-card.js';
import { countTokens } from '../brain/token-counter.js';

export interface AiPlatformModel {
  id: string;
  provider: string;
  model: string;
  tier: string;
  modelClass: string;
  isDefault: boolean;
  status: string;
  inputPrice: number;
  outputPrice: number;
  notes: string | null;
}

function mapModel(row: Record<string, unknown>): AiPlatformModel {
  const model = String(row.model);
  return {
    id: String(row.id),
    provider: String(row.provider),
    model,
    tier: String(row.tier),
    modelClass: classifyModel(model),
    isDefault: Boolean(row.is_default),
    status: String(row.status),
    inputPrice: Number(row.input_price),
    outputPrice: Number(row.output_price),
    notes: row.notes != null ? String(row.notes) : null,
  };
}

export async function listModelsForOrg(orgId: string): Promise<AiPlatformModel[]> {
  const result = await queryForOrg(
    orgId,
    `SELECT id, provider, model, tier, is_default, status, input_price, output_price, notes
     FROM ai_platform_models
     WHERE org_id = $1
     ORDER BY is_default DESC, provider, model`,
  );
  return result.rows.map(mapModel);
}

export async function getModelPricingForOrg(
  orgId: string,
  provider: string,
  model: string,
): Promise<{ inputPrice: number; outputPrice: number } | null> {
  const result = await queryForOrg(
    orgId,
    `SELECT input_price, output_price
     FROM ai_platform_models
     WHERE org_id = $1 AND provider = $2 AND model = $3
     LIMIT 1`,
    [provider, model],
  );
  if ((result.rowCount ?? 0) === 0) return null;
  const row = result.rows[0];
  return {
    inputPrice: Number(row.input_price),
    outputPrice: Number(row.output_price),
  };
}

export function estimateModelCost(
  tokensIn: number,
  tokensOut: number,
  inputPrice: number,
  outputPrice: number,
): number {
  return (tokensIn / 1_000_000) * inputPrice + (tokensOut / 1_000_000) * outputPrice;
}

export function estimateTokensFromText(text: string): number {
  return countTokens(text).tokens;
}
