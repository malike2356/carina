import { pool } from '../memory/db.js';
import type { ModelPolicyDecision, ModelPolicyBillingMode } from '../model-router/model-policy-router.js';
import type { TokenOptimizationPlan } from '../token-efficiency/token-efficiency.js';
import type { CarinaResponse } from '../types/index.js';
import { rawProviderCostGbp } from './aiva-ai-pricing.js';

export interface UsageCostBreakdown {
  providerCostMinor: number;
  paymentOverheadMinor: number;
  platformMarginMinor: number;
  internalChargeBasisMinor: number;
}

export interface AiUsagePricingConfig {
  paymentOverheadRate: number;
  platformMarginRate: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface AiUsageSummary {
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

let schemaReady: Promise<void> | null = null;
let pricingConfigCache: { value: AiUsagePricingConfig; expiresAt: number } | null = null;

export const DEFAULT_AI_USAGE_PRICING_CONFIG: AiUsagePricingConfig = {
  paymentOverheadRate: 0.035,
  platformMarginRate: 0.015,
  updatedAt: null,
  updatedBy: null,
};

export async function ensureAiUsageLedgerSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ai_usage_ledger (
          id BIGSERIAL PRIMARY KEY,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          tenant_id TEXT,
          user_id TEXT,
          workspace_id TEXT,
          channel_id TEXT,
          session_id TEXT,
          surface TEXT,
          feature TEXT,
          plan_id TEXT,
          byok BOOLEAN NOT NULL DEFAULT FALSE,
          request_id TEXT,
          provider TEXT NOT NULL,
          model TEXT NOT NULL,
          model_tier TEXT NOT NULL,
          route_reason TEXT,
          request_tokens INTEGER NOT NULL DEFAULT 0,
          response_tokens INTEGER NOT NULL DEFAULT 0,
          total_tokens INTEGER NOT NULL DEFAULT 0,
          cached_tokens INTEGER NOT NULL DEFAULT 0,
          optimized_tokens_saved INTEGER NOT NULL DEFAULT 0,
          provider_cost_minor INTEGER NOT NULL DEFAULT 0,
          provider_cost_actual_minor INTEGER,
          payment_fee_minor INTEGER NOT NULL DEFAULT 0,
          platform_margin_minor INTEGER NOT NULL DEFAULT 0,
          customer_allocated_minor INTEGER NOT NULL DEFAULT 0,
          currency TEXT NOT NULL DEFAULT 'GBP',
          billing_mode TEXT NOT NULL DEFAULT 'internal',
          budget_window TEXT,
          cache_status TEXT,
          latency_ms INTEGER,
          status TEXT NOT NULL DEFAULT 'policy_decision',
          error_code TEXT,
          scout_policy_state TEXT,
          metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb
        )
      `);
      await pool.query('CREATE INDEX IF NOT EXISTS ai_usage_ledger_tenant_created_idx ON ai_usage_ledger (tenant_id, created_at DESC)');
      await pool.query('CREATE INDEX IF NOT EXISTS ai_usage_ledger_user_created_idx ON ai_usage_ledger (user_id, created_at DESC)');
      await pool.query('CREATE INDEX IF NOT EXISTS ai_usage_ledger_provider_model_created_idx ON ai_usage_ledger (provider, model, created_at DESC)');
      await pool.query('CREATE INDEX IF NOT EXISTS ai_usage_ledger_billing_created_idx ON ai_usage_ledger (billing_mode, created_at DESC)');
      await pool.query('CREATE INDEX IF NOT EXISTS ai_usage_ledger_status_created_idx ON ai_usage_ledger (status, created_at DESC)');
      await pool.query('ALTER TABLE ai_usage_ledger ADD COLUMN IF NOT EXISTS workspace_id TEXT');
      await pool.query('ALTER TABLE ai_usage_ledger ADD COLUMN IF NOT EXISTS channel_id TEXT');
      await pool.query('ALTER TABLE ai_usage_ledger ADD COLUMN IF NOT EXISTS plan_id TEXT');
      await pool.query('ALTER TABLE ai_usage_ledger ADD COLUMN IF NOT EXISTS byok BOOLEAN NOT NULL DEFAULT FALSE');
      await pool.query('ALTER TABLE ai_usage_ledger ADD COLUMN IF NOT EXISTS request_id TEXT');
      await pool.query('ALTER TABLE ai_usage_ledger ADD COLUMN IF NOT EXISTS cached_tokens INTEGER NOT NULL DEFAULT 0');
      await pool.query('ALTER TABLE ai_usage_ledger ADD COLUMN IF NOT EXISTS optimized_tokens_saved INTEGER NOT NULL DEFAULT 0');
      await pool.query('ALTER TABLE ai_usage_ledger ADD COLUMN IF NOT EXISTS provider_cost_actual_minor INTEGER');
      await pool.query('CREATE INDEX IF NOT EXISTS ai_usage_ledger_plan_created_idx ON ai_usage_ledger (plan_id, created_at DESC)');
      await pool.query('CREATE INDEX IF NOT EXISTS ai_usage_ledger_byok_created_idx ON ai_usage_ledger (byok, created_at DESC)');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ai_usage_pricing_config (
          id TEXT PRIMARY KEY DEFAULT 'default',
          payment_overhead_rate NUMERIC(8,6) NOT NULL DEFAULT 0.035,
          platform_margin_rate NUMERIC(8,6) NOT NULL DEFAULT 0.015,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_by TEXT
        )
      `);
      await pool.query(`
        INSERT INTO ai_usage_pricing_config (id, payment_overhead_rate, platform_margin_rate)
        VALUES ('default', 0.035, 0.015)
        ON CONFLICT (id) DO NOTHING
      `);
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
}

function normalizeRate(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(1, Math.max(0, numeric));
}

export async function getAiUsagePricingConfig(options: { refresh?: boolean } = {}): Promise<AiUsagePricingConfig> {
  await ensureAiUsageLedgerSchema();
  const now = Date.now();
  if (!options.refresh && pricingConfigCache && pricingConfigCache.expiresAt > now) {
    return pricingConfigCache.value;
  }
  const result = await pool.query<{
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
  const value: AiUsagePricingConfig = row
    ? {
      paymentOverheadRate: normalizeRate(row.payment_overhead_rate, DEFAULT_AI_USAGE_PRICING_CONFIG.paymentOverheadRate),
      platformMarginRate: normalizeRate(row.platform_margin_rate, DEFAULT_AI_USAGE_PRICING_CONFIG.platformMarginRate),
      updatedAt: new Date(row.updated_at).toISOString(),
      updatedBy: row.updated_by,
    }
    : DEFAULT_AI_USAGE_PRICING_CONFIG;
  pricingConfigCache = { value, expiresAt: now + 60_000 };
  return value;
}

export async function updateAiUsagePricingConfig(input: {
  paymentOverheadRate: number;
  platformMarginRate: number;
  updatedBy?: string | null;
}): Promise<AiUsagePricingConfig> {
  await ensureAiUsageLedgerSchema();
  const paymentOverheadRate = normalizeRate(input.paymentOverheadRate, DEFAULT_AI_USAGE_PRICING_CONFIG.paymentOverheadRate);
  const platformMarginRate = normalizeRate(input.platformMarginRate, DEFAULT_AI_USAGE_PRICING_CONFIG.platformMarginRate);
  await pool.query(
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
  pricingConfigCache = null;
  return getAiUsagePricingConfig({ refresh: true });
}

export function calculateUsageCost(input: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  byok?: boolean;
  paymentOverheadRate?: number;
  platformMarginRate?: number;
}): UsageCostBreakdown {
  if (input.byok) {
    return {
      providerCostMinor: 0,
      paymentOverheadMinor: 0,
      platformMarginMinor: 0,
      internalChargeBasisMinor: 0,
    };
  }
  const providerCostGbp = rawProviderCostGbp(input.model, {
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
  });
  const providerCostMinor = Math.max(0, Math.ceil(providerCostGbp * 100));
  const paymentOverheadMinor = Math.max(0, Math.ceil(providerCostMinor * (input.paymentOverheadRate ?? 0.035)));
  const platformMarginMinor = Math.max(0, Math.ceil(providerCostMinor * (input.platformMarginRate ?? 0.015)));
  return {
    providerCostMinor,
    paymentOverheadMinor,
    platformMarginMinor,
    internalChargeBasisMinor: providerCostMinor + paymentOverheadMinor + platformMarginMinor,
  };
}

async function calculateConfiguredUsageCost(input: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  byok?: boolean;
}): Promise<UsageCostBreakdown> {
  const config = await getAiUsagePricingConfig();
  return calculateUsageCost({
    ...input,
    paymentOverheadRate: config.paymentOverheadRate,
    platformMarginRate: config.platformMarginRate,
  });
}

export async function recordModelPolicyDecision(input: {
  decision: ModelPolicyDecision;
  tenantId?: string;
  userId?: string;
  sessionId?: string;
  surface?: string;
  feature?: string;
  billingMode?: ModelPolicyBillingMode;
  tokenOptimization?: TokenOptimizationPlan;
}): Promise<void> {
  await ensureAiUsageLedgerSchema();
  const totalTokens = input.decision.estimatedInputTokens + input.decision.estimatedOutputTokens;
  const cost = await calculateConfiguredUsageCost({
    model: input.decision.selectedModel,
    inputTokens: input.decision.estimatedInputTokens,
    outputTokens: input.decision.estimatedOutputTokens,
    byok: input.billingMode === 'byok',
  });
  const metadata = {
    allowed: input.decision.allowed,
    budgetImpact: input.decision.budgetImpact,
    approvalRequired: input.decision.approvalRequired,
    subscriptionUpgradeRequired: input.decision.subscriptionUpgradeRequired,
    fallbackProvider: input.decision.fallbackProvider,
    fallbackModel: input.decision.fallbackModel,
    auditRequired: input.decision.auditRequired,
    tokenOptimization: input.tokenOptimization
      ? {
        records: input.tokenOptimization.records.map((record) => ({
          kind: record.kind,
          reason: record.reason,
          rawEstimatedInputTokens: record.rawEstimatedInputTokens,
          optimizedEstimatedInputTokens: record.optimizedEstimatedInputTokens,
          outputTokenCap: record.outputTokenCap,
          savingsEstimateTokens: record.savingsEstimateTokens,
        })),
        rawEstimatedInputTokens: input.tokenOptimization.rawEstimatedInputTokens,
        optimizedEstimatedInputTokens: input.tokenOptimization.optimizedEstimatedInputTokens,
        outputTokenCap: input.tokenOptimization.outputTokenCap,
        savingsEstimateTokens: input.tokenOptimization.savingsEstimateTokens,
        cacheHit: input.tokenOptimization.cacheHit
          ? {
            kind: input.tokenOptimization.cacheHit.kind,
            similarity: input.tokenOptimization.cacheHit.similarity,
          }
          : null,
      }
      : null,
  };

  await pool.query(
    `INSERT INTO ai_usage_ledger
       (tenant_id, user_id, session_id, surface, feature, provider, model, model_tier,
        route_reason, request_tokens, response_tokens, total_tokens, provider_cost_minor,
        payment_fee_minor, platform_margin_minor, customer_allocated_minor, billing_mode,
        status, metadata_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
             $9, $10, $11, $12, $13,
             $14, $15, $16, $17,
             $18, $19::jsonb)`,
    [
      input.tenantId ?? null,
      input.userId ?? null,
      input.sessionId ?? null,
      input.surface ?? null,
      input.feature ?? null,
      input.decision.selectedProvider,
      input.decision.selectedModel,
      input.decision.tier,
      input.decision.reason,
      input.decision.estimatedInputTokens,
      input.decision.estimatedOutputTokens,
      totalTokens,
      cost.providerCostMinor,
      cost.paymentOverheadMinor,
      cost.platformMarginMinor,
      cost.internalChargeBasisMinor,
      input.billingMode ?? 'internal',
      input.decision.allowed ? 'policy_decision' : 'policy_blocked',
      JSON.stringify(metadata),
    ],
  );
}

export async function recordModelUsageResult(input: {
  decision: ModelPolicyDecision;
  response: CarinaResponse;
  tenantId?: string;
  userId?: string;
  workspaceId?: string;
  channelId?: string;
  sessionId?: string;
  surface?: string;
  feature?: string;
  planId?: string;
  billingMode?: ModelPolicyBillingMode;
  byok?: boolean;
  requestId?: string;
  latencyMs?: number;
  tokenOptimization?: TokenOptimizationPlan;
}): Promise<void> {
  await ensureAiUsageLedgerSchema();
  const inputTokens = Number(input.response.tokensIn ?? input.decision.estimatedInputTokens ?? 0);
  const outputTokens = Number(input.response.tokensOut ?? input.decision.estimatedOutputTokens ?? 0);
  const cachedTokens = Number(input.response.tokensCached ?? 0);
  const totalTokens = Number(input.response.tokensUsed ?? inputTokens + outputTokens);
  const byok = input.byok ?? input.billingMode === 'byok';
  const cost = await calculateConfiguredUsageCost({
    model: input.decision.selectedModel,
    inputTokens,
    outputTokens,
    byok,
  });
  const metadata = {
    policyReason: input.decision.reason,
    budgetImpact: input.decision.budgetImpact,
    optimizedTokensSaved: input.tokenOptimization?.savingsEstimateTokens ?? 0,
    optimizationRecords: input.tokenOptimization?.records.map((record) => record.kind) ?? [],
    toolsUsed: input.response.toolsUsed,
  };

  await pool.query(
    `INSERT INTO ai_usage_ledger
       (tenant_id, user_id, workspace_id, channel_id, session_id, surface, feature,
        plan_id, byok, request_id, provider, model, model_tier, route_reason,
        request_tokens, response_tokens, total_tokens, cached_tokens, optimized_tokens_saved,
        provider_cost_minor, provider_cost_actual_minor, payment_fee_minor, platform_margin_minor,
        customer_allocated_minor, billing_mode, latency_ms, status, metadata_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7,
             $8, $9, $10, $11, $12, $13, $14,
             $15, $16, $17, $18, $19,
             $20, $21, $22, $23,
             $24, $25, $26, $27, $28::jsonb)`,
    [
      input.tenantId ?? null,
      input.userId ?? null,
      input.workspaceId ?? null,
      input.channelId ?? null,
      input.sessionId ?? null,
      input.surface ?? null,
      input.feature ?? null,
      input.planId ?? null,
      byok,
      input.requestId ?? null,
      input.response.provider || input.decision.selectedProvider,
      input.decision.selectedModel,
      input.decision.tier,
      input.decision.reason,
      inputTokens,
      outputTokens,
      totalTokens,
      cachedTokens,
      input.tokenOptimization?.savingsEstimateTokens ?? 0,
      cost.providerCostMinor,
      cost.providerCostMinor,
      cost.paymentOverheadMinor,
      cost.platformMarginMinor,
      cost.internalChargeBasisMinor,
      input.billingMode ?? 'internal',
      input.latencyMs ?? null,
      'completed',
      JSON.stringify(metadata),
    ],
  );
}

export async function getAiUsageSummary(options: {
  tenantId?: string;
  days?: number;
  limit?: number;
} = {}): Promise<AiUsageSummary> {
  await ensureAiUsageLedgerSchema();
  const days = Math.min(365, Math.max(1, Math.floor(options.days ?? 30)));
  const limit = Math.min(100, Math.max(1, Math.floor(options.limit ?? 10)));
  const params: unknown[] = [days];
  const tenantClause = options.tenantId ? 'AND tenant_id = $2' : '';
  if (options.tenantId) params.push(options.tenantId);

  const totals = await pool.query<{
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
       AND status = 'completed'
       ${tenantClause}`,
    params,
  );

  const providerRows = await pool.query<{
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
       ${tenantClause}
     GROUP BY provider, model
     ORDER BY COALESCE(SUM(provider_cost_minor), 0) DESC
     LIMIT ${limit}`,
    params,
  );

  const tierRows = await pool.query<{ model_tier: string; calls: string; tokens: string }>(
    `SELECT model_tier, COUNT(*)::TEXT AS calls, COALESCE(SUM(total_tokens), 0)::TEXT AS tokens
     FROM ai_usage_ledger
     WHERE created_at >= NOW() - ($1::INT || ' days')::INTERVAL
       AND status = 'completed'
       ${tenantClause}
     GROUP BY model_tier
     ORDER BY calls DESC`,
    params,
  );

  const tenantRows = await pool.query<{
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
       ${tenantClause}
     GROUP BY tenant_id
     ORDER BY COALESCE(SUM(provider_cost_minor), 0) DESC
     LIMIT ${limit}`,
    params,
  );

  const total = totals.rows[0];
  const byTenant = tenantRows.rows.map((row) => ({
    tenantId: row.tenant_id ?? 'unknown',
    calls: Number(row.calls),
    tokens: Number(row.tokens),
    providerCostMinor: Number(row.provider_cost_minor),
    internalChargeBasisMinor: Number(row.customer_allocated_minor),
  }));
  const alerts = byTenant
    .filter((row) => row.providerCostMinor > row.internalChargeBasisMinor && row.providerCostMinor > 0)
    .map((row) => ({
      level: 'critical' as const,
      tenantId: row.tenantId,
      message: `Tenant ${row.tenantId} is costing more than allocated value.`,
    }));

  return {
    totals: {
      calls: Number(total?.calls ?? 0),
      tokens: Number(total?.tokens ?? 0),
      cachedTokens: Number(total?.cached_tokens ?? 0),
      optimizedTokensSaved: Number(total?.optimized_tokens_saved ?? 0),
      providerCostMinor: Number(total?.provider_cost_minor ?? 0),
      paymentOverheadMinor: Number(total?.payment_fee_minor ?? 0),
      platformMarginMinor: Number(total?.platform_margin_minor ?? 0),
      internalChargeBasisMinor: Number(total?.customer_allocated_minor ?? 0),
      byokCalls: Number(total?.byok_calls ?? 0),
      carinaPaidCalls: Number(total?.carina_paid_calls ?? 0),
    },
    byProvider: providerRows.rows.map((row) => ({
      provider: row.provider,
      model: row.model,
      calls: Number(row.calls),
      tokens: Number(row.tokens),
      providerCostMinor: Number(row.provider_cost_minor),
    })),
    byTier: tierRows.rows.map((row) => ({
      tier: row.model_tier,
      calls: Number(row.calls),
      tokens: Number(row.tokens),
    })),
    byTenant,
    alerts,
  };
}
