import { query, tableExists } from './db.js';

export interface AiUsageDashboardSummary {
  ready: boolean;
  pricingConfig: AiUsagePricingConfig;
  totals: {
    calls: number;
    tokens: number;
    cachedTokens: number;
    optimizedTokensSaved: number;
    providerCostMinor: number;
    paymentOverheadMinor: number;
    platformMarginMinor: number;
    internalChargeBasisMinor: number;
    byokCalls: number;
    carinaPaidCalls: number;
  };
  byProvider: Array<{ provider: string; model: string; calls: number; tokens: number; providerCostMinor: number }>;
  byTier: Array<{ tier: string; calls: number; tokens: number }>;
  byTenant: Array<{ tenantId: string; calls: number; tokens: number; providerCostMinor: number; internalChargeBasisMinor: number }>;
  alerts: Array<{ level: 'warning' | 'critical'; message: string; tenantId?: string }>;
}

export interface AiUsagePricingConfig {
  paymentOverheadRate: number;
  platformMarginRate: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export const DEFAULT_AI_USAGE_PRICING_CONFIG: AiUsagePricingConfig = {
  paymentOverheadRate: 0.035,
  platformMarginRate: 0.015,
  updatedAt: null,
  updatedBy: null,
};

const EMPTY_SUMMARY: AiUsageDashboardSummary = {
  ready: false,
  pricingConfig: DEFAULT_AI_USAGE_PRICING_CONFIG,
  totals: {
    calls: 0,
    tokens: 0,
    cachedTokens: 0,
    optimizedTokensSaved: 0,
    providerCostMinor: 0,
    paymentOverheadMinor: 0,
    platformMarginMinor: 0,
    internalChargeBasisMinor: 0,
    byokCalls: 0,
    carinaPaidCalls: 0,
  },
  byProvider: [],
  byTier: [],
  byTenant: [],
  alerts: [],
};

export function formatMinorCurrency(minor: number, currency = 'GBP'): string {
  const symbol = currency === 'GBP' ? '£' : '';
  return `${symbol}${(minor / 100).toFixed(2)}`;
}

function normalizeRate(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(1, Math.max(0, numeric));
}

export function formatRatePercent(rate: number): string {
  return (rate * 100).toFixed(2);
}

export async function ensureAiUsagePricingConfigTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS ai_usage_pricing_config (
      id TEXT PRIMARY KEY DEFAULT 'default',
      payment_overhead_rate NUMERIC(8,6) NOT NULL DEFAULT 0.035,
      platform_margin_rate NUMERIC(8,6) NOT NULL DEFAULT 0.015,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by TEXT
    )
  `);
  await query(`
    INSERT INTO ai_usage_pricing_config (id, payment_overhead_rate, platform_margin_rate)
    VALUES ('default', 0.035, 0.015)
    ON CONFLICT (id) DO NOTHING
  `);
}

export async function getAiUsagePricingConfig(): Promise<AiUsagePricingConfig> {
  await ensureAiUsagePricingConfigTable();
  const result = await query<{
    payment_overhead_rate: string;
    platform_margin_rate: string;
    updated_at: string | Date;
    updated_by: string | null;
  }>(
    `SELECT payment_overhead_rate, platform_margin_rate, updated_at, updated_by
     FROM ai_usage_pricing_config
     WHERE id = 'default'`,
  );
  const row = result.rows[0];
  if (!row) return DEFAULT_AI_USAGE_PRICING_CONFIG;
  return {
    paymentOverheadRate: normalizeRate(row.payment_overhead_rate, DEFAULT_AI_USAGE_PRICING_CONFIG.paymentOverheadRate),
    platformMarginRate: normalizeRate(row.platform_margin_rate, DEFAULT_AI_USAGE_PRICING_CONFIG.platformMarginRate),
    updatedAt: new Date(row.updated_at).toISOString(),
    updatedBy: row.updated_by,
  };
}

export async function updateAiUsagePricingConfig(input: {
  paymentOverheadPercent: number;
  platformMarginPercent: number;
  updatedBy?: string | null;
}): Promise<AiUsagePricingConfig> {
  await ensureAiUsagePricingConfigTable();
  const paymentOverheadRate = normalizeRate(input.paymentOverheadPercent / 100, DEFAULT_AI_USAGE_PRICING_CONFIG.paymentOverheadRate);
  const platformMarginRate = normalizeRate(input.platformMarginPercent / 100, DEFAULT_AI_USAGE_PRICING_CONFIG.platformMarginRate);
  await query(
    `INSERT INTO ai_usage_pricing_config
       (id, payment_overhead_rate, platform_margin_rate, updated_by, updated_at)
     VALUES ('default', $1, $2, $3, NOW())
     ON CONFLICT (id) DO UPDATE
       SET payment_overhead_rate = EXCLUDED.payment_overhead_rate,
           platform_margin_rate = EXCLUDED.platform_margin_rate,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()`,
    [paymentOverheadRate, platformMarginRate, input.updatedBy ?? null],
  );
  return getAiUsagePricingConfig();
}

export async function fetchAiUsageDashboard(days = 30): Promise<AiUsageDashboardSummary> {
  const pricingConfig = await getAiUsagePricingConfig();
  if (!(await tableExists('ai_usage_ledger'))) {
    return { ...EMPTY_SUMMARY, pricingConfig };
  }
  const safeDays = Math.min(365, Math.max(1, Math.floor(days)));
  const totals = await query<{
    calls: string;
    tokens: string;
    cached_tokens: string;
    optimized_tokens_saved: string;
    provider_cost_minor: string;
    payment_fee_minor: string;
    platform_margin_minor: string;
    customer_allocated_minor: string;
    byok_calls: string;
    carina_paid_calls: string;
  }>(
    `SELECT COUNT(*)::TEXT AS calls,
            COALESCE(SUM(total_tokens), 0)::TEXT AS tokens,
            COALESCE(SUM(cached_tokens), 0)::TEXT AS cached_tokens,
            COALESCE(SUM(optimized_tokens_saved), 0)::TEXT AS optimized_tokens_saved,
            COALESCE(SUM(provider_cost_minor), 0)::TEXT AS provider_cost_minor,
            COALESCE(SUM(payment_fee_minor), 0)::TEXT AS payment_fee_minor,
            COALESCE(SUM(platform_margin_minor), 0)::TEXT AS platform_margin_minor,
            COALESCE(SUM(customer_allocated_minor), 0)::TEXT AS customer_allocated_minor,
            COALESCE(SUM(CASE WHEN byok THEN 1 ELSE 0 END), 0)::TEXT AS byok_calls,
            COALESCE(SUM(CASE WHEN byok THEN 0 ELSE 1 END), 0)::TEXT AS carina_paid_calls
     FROM ai_usage_ledger
     WHERE created_at >= NOW() - ($1::INT || ' days')::INTERVAL
       AND status = 'completed'`,
    [safeDays],
  );

  const byProvider = await query<{
    provider: string;
    model: string;
    calls: string;
    tokens: string;
    provider_cost_minor: string;
  }>(
    `SELECT provider, model, COUNT(*)::TEXT AS calls,
            COALESCE(SUM(total_tokens), 0)::TEXT AS tokens,
            COALESCE(SUM(provider_cost_minor), 0)::TEXT AS provider_cost_minor
     FROM ai_usage_ledger
     WHERE created_at >= NOW() - ($1::INT || ' days')::INTERVAL
       AND status = 'completed'
     GROUP BY provider, model
     ORDER BY COALESCE(SUM(provider_cost_minor), 0) DESC
     LIMIT 10`,
    [safeDays],
  );

  const byTier = await query<{ model_tier: string; calls: string; tokens: string }>(
    `SELECT model_tier, COUNT(*)::TEXT AS calls, COALESCE(SUM(total_tokens), 0)::TEXT AS tokens
     FROM ai_usage_ledger
     WHERE created_at >= NOW() - ($1::INT || ' days')::INTERVAL
       AND status = 'completed'
     GROUP BY model_tier
     ORDER BY calls DESC`,
    [safeDays],
  );

  const byTenant = await query<{
    tenant_id: string | null;
    calls: string;
    tokens: string;
    provider_cost_minor: string;
    customer_allocated_minor: string;
  }>(
    `SELECT tenant_id, COUNT(*)::TEXT AS calls,
            COALESCE(SUM(total_tokens), 0)::TEXT AS tokens,
            COALESCE(SUM(provider_cost_minor), 0)::TEXT AS provider_cost_minor,
            COALESCE(SUM(customer_allocated_minor), 0)::TEXT AS customer_allocated_minor
     FROM ai_usage_ledger
     WHERE created_at >= NOW() - ($1::INT || ' days')::INTERVAL
       AND status = 'completed'
     GROUP BY tenant_id
     ORDER BY COALESCE(SUM(provider_cost_minor), 0) DESC
     LIMIT 20`,
    [safeDays],
  );

  const tenantRows = byTenant.rows.map((row) => ({
    tenantId: row.tenant_id ?? 'unknown',
    calls: Number(row.calls),
    tokens: Number(row.tokens),
    providerCostMinor: Number(row.provider_cost_minor),
    internalChargeBasisMinor: Number(row.customer_allocated_minor),
  }));

  return {
    ready: true,
    pricingConfig,
    totals: {
      calls: Number(totals.rows[0]?.calls ?? 0),
      tokens: Number(totals.rows[0]?.tokens ?? 0),
      cachedTokens: Number(totals.rows[0]?.cached_tokens ?? 0),
      optimizedTokensSaved: Number(totals.rows[0]?.optimized_tokens_saved ?? 0),
      providerCostMinor: Number(totals.rows[0]?.provider_cost_minor ?? 0),
      paymentOverheadMinor: Number(totals.rows[0]?.payment_fee_minor ?? 0),
      platformMarginMinor: Number(totals.rows[0]?.platform_margin_minor ?? 0),
      internalChargeBasisMinor: Number(totals.rows[0]?.customer_allocated_minor ?? 0),
      byokCalls: Number(totals.rows[0]?.byok_calls ?? 0),
      carinaPaidCalls: Number(totals.rows[0]?.carina_paid_calls ?? 0),
    },
    byProvider: byProvider.rows.map((row) => ({
      provider: row.provider,
      model: row.model,
      calls: Number(row.calls),
      tokens: Number(row.tokens),
      providerCostMinor: Number(row.provider_cost_minor),
    })),
    byTier: byTier.rows.map((row) => ({
      tier: row.model_tier,
      calls: Number(row.calls),
      tokens: Number(row.tokens),
    })),
    byTenant: tenantRows,
    alerts: tenantRows
      .filter((row) => row.providerCostMinor > row.internalChargeBasisMinor && row.providerCostMinor > 0)
      .map((row) => ({
        level: 'critical',
        tenantId: row.tenantId,
        message: `Tenant ${row.tenantId} is costing more than allocated value.`,
      })),
  };
}
