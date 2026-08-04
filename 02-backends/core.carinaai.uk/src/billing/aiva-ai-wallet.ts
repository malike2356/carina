/**
 * Per-workspace managed AI wallet with immutable ledger rows.
 * Credits are whole pence of charged value. BYOK usage is recorded at 0 debit.
 */

import { pool } from '../memory/db.js';
import { resolveConfigValue } from './billing-config.js';
import { chargedPenceForRun, estimateManagedCallPence, rawProviderCostGbp, type TokenUsage } from './aiva-ai-pricing.js';

export type AivaWalletEventType =
  | 'trial_grant'
  | 'included'
  | 'purchase'
  | 'debit'
  | 'refund'
  | 'expiry'
  | 'byok_usage';

export interface AivaWalletBalance {
  remainingPence: number;
  remainingGbp: number;
  trialGrantedPence: number;
  purchasedPence: number;
  debitedPence: number;
  lowCredit: boolean;
  exhausted: boolean;
}

export interface AivaWalletGateResult {
  allowed: boolean;
  mode: 'managed' | 'byok' | 'denied';
  reason?: string;
  remainingPence: number;
  dailySpentPence: number;
  dailyCapPence: number | null;
  actions?: Array<'byok' | 'topup' | 'upgrade'>;
  lowCredit?: boolean;
}

const DEFAULT_TRIAL_CREDIT_GBP = 1;
const DEFAULT_DAILY_CAP_GBP = 2;
const LOW_CREDIT_PERCENT = 20;
/** Minimum estimated pence reserved before a managed call when usage is unknown. */
const DEFAULT_ESTIMATE_MODEL = 'deepseek-chat';

let schemaReady: Promise<void> | null = null;

export async function ensureAivaAiWalletSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS aiva_ai_wallet_ledger (
          id BIGSERIAL PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          amount_pence INTEGER NOT NULL,
          model TEXT,
          input_tokens INTEGER,
          output_tokens INTEGER,
          provider_cost_pence INTEGER,
          stripe_session_id TEXT,
          note TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS aiva_ai_wallet_trial_grant_uidx
          ON aiva_ai_wallet_ledger (workspace_id)
          WHERE event_type = 'trial_grant'
      `);
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS aiva_ai_wallet_stripe_session_uidx
          ON aiva_ai_wallet_ledger (stripe_session_id)
          WHERE stripe_session_id IS NOT NULL
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS aiva_ai_wallet_workspace_idx
          ON aiva_ai_wallet_ledger (workspace_id, created_at DESC)
      `);
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
}

export function resolveTrialCreditGbp(): number {
  const raw = resolveConfigValue('AIVA_TRIAL_CREDIT_GBP').trim();
  if (!raw) return DEFAULT_TRIAL_CREDIT_GBP;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0 && n <= 100) return n;
  return DEFAULT_TRIAL_CREDIT_GBP;
}

export function resolveTrialDailyCapGbp(): number {
  const raw = resolveConfigValue('AIVA_TRIAL_DAILY_CAP_GBP').trim();
  if (!raw) return DEFAULT_DAILY_CAP_GBP;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0 && n <= 500) return n;
  return DEFAULT_DAILY_CAP_GBP;
}

export async function getAivaWalletBalance(workspaceId: string): Promise<AivaWalletBalance> {
  await ensureAivaAiWalletSchema();
  const result = await pool.query<{ event_type: string; total: string }>(
    `SELECT event_type, COALESCE(SUM(amount_pence), 0)::TEXT AS total
     FROM aiva_ai_wallet_ledger
     WHERE workspace_id = $1
       AND event_type <> 'byok_usage'
     GROUP BY event_type`,
    [workspaceId],
  );

  let remainingPence = 0;
  let trialGrantedPence = 0;
  let purchasedPence = 0;
  let debitedPence = 0;

  for (const row of result.rows) {
    const total = Number(row.total);
    remainingPence += total;
    if (row.event_type === 'trial_grant' || row.event_type === 'included') {
      trialGrantedPence += Math.max(0, total);
    }
    if (row.event_type === 'purchase') {
      purchasedPence += Math.max(0, total);
    }
    if (row.event_type === 'debit') {
      debitedPence += Math.abs(total);
    }
  }

  remainingPence = Math.max(0, remainingPence);
  const grantBasis = Math.max(trialGrantedPence + purchasedPence, 1);
  const remainingPct = (remainingPence / grantBasis) * 100;

  return {
    remainingPence,
    remainingGbp: Math.round(remainingPence) / 100,
    trialGrantedPence,
    purchasedPence,
    debitedPence,
    lowCredit: remainingPence > 0 && remainingPct <= LOW_CREDIT_PERCENT,
    exhausted: remainingPence <= 0,
  };
}

export async function getAivaDailyDebitPence(workspaceId: string, now = new Date()): Promise<number> {
  await ensureAivaAiWalletSchema();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const result = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(ABS(amount_pence)), 0)::TEXT AS total
     FROM aiva_ai_wallet_ledger
     WHERE workspace_id = $1
       AND event_type = 'debit'
       AND created_at >= $2`,
    [workspaceId, dayStart.toISOString()],
  );
  return Math.max(0, Number(result.rows[0]?.total ?? 0));
}

export async function grantAivaTrialCredit(workspaceId: string): Promise<{ granted: boolean; pence: number }> {
  await ensureAivaAiWalletSchema();
  const pence = Math.round(resolveTrialCreditGbp() * 100);
  if (pence <= 0) return { granted: false, pence: 0 };
  try {
    await pool.query(
      `INSERT INTO aiva_ai_wallet_ledger
         (workspace_id, event_type, amount_pence, note)
       VALUES ($1, 'trial_grant', $2, $3)`,
      [workspaceId, pence, `trial_credit_gbp:${resolveTrialCreditGbp()}`],
    );
    return { granted: true, pence };
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === '23505') return { granted: false, pence };
    throw err;
  }
}

export async function creditAivaWalletPurchase(input: {
  workspaceId: string;
  amountPence: number;
  stripeSessionId: string;
  note?: string;
}): Promise<{ credited: boolean }> {
  await ensureAivaAiWalletSchema();
  const amount = Math.abs(Math.round(input.amountPence));
  if (amount <= 0) return { credited: false };
  try {
    await pool.query(
      `INSERT INTO aiva_ai_wallet_ledger
         (workspace_id, event_type, amount_pence, stripe_session_id, note)
       VALUES ($1, 'purchase', $2, $3, $4)`,
      [input.workspaceId, amount, input.stripeSessionId, input.note ?? `stripe:${input.stripeSessionId}`],
    );
    return { credited: true };
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === '23505') return { credited: false };
    throw err;
  }
}

export async function debitAivaWalletUsage(input: {
  workspaceId: string;
  model: string;
  usage?: TokenUsage;
  note?: string;
}): Promise<{ debitedPence: number }> {
  await ensureAivaAiWalletSchema();
  const pence = chargedPenceForRun(input.model, input.usage);
  const providerCostPence = Math.max(1, Math.ceil(rawProviderCostGbp(input.model, input.usage) * 100));
  await pool.query(
    `INSERT INTO aiva_ai_wallet_ledger
       (workspace_id, event_type, amount_pence, model, input_tokens, output_tokens, provider_cost_pence, note)
     VALUES ($1, 'debit', $2, $3, $4, $5, $6, $7)`,
    [
      input.workspaceId,
      -pence,
      input.model,
      Number(input.usage?.inputTokens ?? input.usage?.input_tokens ?? 0),
      Number(input.usage?.outputTokens ?? input.usage?.output_tokens ?? 0),
      providerCostPence,
      input.note ?? 'managed_inference',
    ],
  );
  return { debitedPence: pence };
}

export async function recordAivaByokUsage(input: {
  workspaceId: string;
  model: string;
  usage?: TokenUsage;
}): Promise<void> {
  await ensureAivaAiWalletSchema();
  const providerCostPence = Math.max(0, Math.ceil(rawProviderCostGbp(input.model, input.usage) * 100));
  await pool.query(
    `INSERT INTO aiva_ai_wallet_ledger
       (workspace_id, event_type, amount_pence, model, input_tokens, output_tokens, provider_cost_pence, note)
     VALUES ($1, 'byok_usage', 0, $2, $3, $4, $5, 'byok')`,
    [
      input.workspaceId,
      input.model,
      Number(input.usage?.inputTokens ?? input.usage?.input_tokens ?? 0),
      Number(input.usage?.outputTokens ?? input.usage?.output_tokens ?? 0),
      providerCostPence,
    ],
  );
}

export async function workspaceHasByokKey(workspaceId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM tenant_provider_keys
     WHERE tenant_id = $1 AND enabled = TRUE
     LIMIT 1`,
    [workspaceId],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Pre-call gate for managed Aiva inference.
 * workspaceId must come from verified server context (session / channel registry), never from body/query.
 */
export async function checkAivaWalletGate(
  workspaceId: string,
  opts?: {
    planTier?: string;
    applyDailyCap?: boolean;
    estimatedModel?: string;
  },
): Promise<AivaWalletGateResult> {
  const balance = await getAivaWalletBalance(workspaceId);
  const applyDailyCap = opts?.applyDailyCap ?? opts?.planTier === 'trial';
  const dailyCapGbp = applyDailyCap ? resolveTrialDailyCapGbp() : null;
  const dailyCapPence = dailyCapGbp != null && dailyCapGbp > 0 ? Math.round(dailyCapGbp * 100) : null;
  const dailySpentPence = dailyCapPence != null ? await getAivaDailyDebitPence(workspaceId) : 0;
  const estimate = estimateManagedCallPence(opts?.estimatedModel ?? DEFAULT_ESTIMATE_MODEL);

  if (dailyCapPence != null && dailySpentPence + estimate > dailyCapPence) {
    const hasByok = await workspaceHasByokKey(workspaceId);
    if (hasByok) {
      return {
        allowed: true,
        mode: 'byok',
        reason: 'daily trial cap reached; continuing with your API key',
        remainingPence: balance.remainingPence,
        dailySpentPence,
        dailyCapPence,
        lowCredit: balance.lowCredit,
      };
    }
    return {
      allowed: false,
      mode: 'denied',
      reason: 'daily trial managed credit cap reached',
      remainingPence: balance.remainingPence,
      dailySpentPence,
      dailyCapPence,
      actions: ['byok', 'topup', 'upgrade'],
    };
  }

  if (balance.remainingPence <= 0) {
    const hasByok = await workspaceHasByokKey(workspaceId);
    if (hasByok) {
      return {
        allowed: true,
        mode: 'byok',
        reason: 'managed credit exhausted; continuing with your API key',
        remainingPence: 0,
        dailySpentPence,
        dailyCapPence,
        lowCredit: false,
      };
    }
    return {
      allowed: false,
      mode: 'denied',
      reason: 'managed AI credit exhausted',
      remainingPence: 0,
      dailySpentPence,
      dailyCapPence,
      actions: ['byok', 'topup', 'upgrade'],
    };
  }

  return {
    allowed: true,
    mode: 'managed',
    remainingPence: balance.remainingPence,
    dailySpentPence,
    dailyCapPence,
    lowCredit: balance.lowCredit,
  };
}

export async function listAivaWalletLedger(
  workspaceId: string,
  limit = 50,
): Promise<Array<{
  id: number;
  eventType: string;
  amountPence: number;
  model: string | null;
  note: string | null;
  createdAt: string;
}>> {
  await ensureAivaAiWalletSchema();
  const result = await pool.query<{
    id: number;
    event_type: string;
    amount_pence: number;
    model: string | null;
    note: string | null;
    created_at: Date;
  }>(
    `SELECT id, event_type, amount_pence, model, note, created_at
     FROM aiva_ai_wallet_ledger
     WHERE workspace_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [workspaceId, Math.min(200, Math.max(1, limit))],
  );
  return result.rows.map((row) => ({
    id: Number(row.id),
    eventType: String(row.event_type),
    amountPence: Number(row.amount_pence),
    model: row.model ? String(row.model) : null,
    note: row.note ? String(row.note) : null,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}
