import { reactivateSubscription, suspendSubscription } from '../aiva-billing.js';
import { slotLimitDbValue } from '../aiva-tier.js';
import { pool } from '../../memory/db.js';

export interface PaddleSubscriptionRow {
  workspaceId: string;
  paddleSubscriptionId: string | null;
  paddleCustomerId: string | null;
  planTier: string;
  status: string;
  currentPeriodEnd: string | null;
  paymentFailedAt: string | null;
  canceledAt: string | null;
}

function mapRow(row: Record<string, unknown>): PaddleSubscriptionRow {
  return {
    workspaceId: String(row.workspace_id),
    paddleSubscriptionId: row.paddle_subscription_id ? String(row.paddle_subscription_id) : null,
    paddleCustomerId: row.paddle_customer_id ? String(row.paddle_customer_id) : null,
    planTier: String(row.plan_tier ?? 'business'),
    status: String(row.status ?? 'trial'),
    currentPeriodEnd: row.current_period_end
      ? new Date(String(row.current_period_end)).toISOString()
      : null,
    paymentFailedAt: row.payment_failed_at
      ? new Date(String(row.payment_failed_at)).toISOString()
      : null,
    canceledAt: row.canceled_at ? new Date(String(row.canceled_at)).toISOString() : null,
  };
}

async function syncAivaBusinessPlan(workspaceId: string): Promise<void> {
  const slotLimit = slotLimitDbValue('business');
  await pool.query(
    `INSERT INTO aiva_subscriptions (workspace_id, plan_tier, status, aiva_slot_limit, updated_at)
     VALUES ($1, 'business', 'active', $2, NOW())
     ON CONFLICT (workspace_id) DO UPDATE SET
       plan_tier = 'business',
       status = 'active',
       aiva_slot_limit = EXCLUDED.aiva_slot_limit,
       grace_period_ends_at = NULL,
       payment_failed_at = NULL,
       updated_at = NOW()`,
    [workspaceId, slotLimit],
  );
}

export async function upsertPaddleSubscription(
  data: Partial<PaddleSubscriptionRow> & { workspaceId: string },
): Promise<void> {
  await pool.query(
    `INSERT INTO paddle_subscriptions
       (workspace_id, paddle_subscription_id, paddle_customer_id, plan_tier, status,
        current_period_end, payment_failed_at, canceled_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (workspace_id) DO UPDATE SET
       paddle_subscription_id = COALESCE(EXCLUDED.paddle_subscription_id, paddle_subscriptions.paddle_subscription_id),
       paddle_customer_id = COALESCE(EXCLUDED.paddle_customer_id, paddle_subscriptions.paddle_customer_id),
       plan_tier = COALESCE(EXCLUDED.plan_tier, paddle_subscriptions.plan_tier),
       status = COALESCE(EXCLUDED.status, paddle_subscriptions.status),
       current_period_end = COALESCE(EXCLUDED.current_period_end, paddle_subscriptions.current_period_end),
       payment_failed_at = EXCLUDED.payment_failed_at,
       canceled_at = EXCLUDED.canceled_at,
       updated_at = NOW()`,
    [
      data.workspaceId,
      data.paddleSubscriptionId ?? null,
      data.paddleCustomerId ?? null,
      data.planTier ?? 'business',
      data.status ?? 'active',
      data.currentPeriodEnd ? new Date(data.currentPeriodEnd) : null,
      data.paymentFailedAt ? new Date(data.paymentFailedAt) : null,
      data.canceledAt ? new Date(data.canceledAt) : null,
    ],
  );
  if ((data.status ?? 'active') === 'active') {
    await syncAivaBusinessPlan(data.workspaceId);
  }
}

export async function getPaddleSubscription(workspaceId: string): Promise<PaddleSubscriptionRow | null> {
  const result = await pool.query(
    'SELECT * FROM paddle_subscriptions WHERE workspace_id = $1 LIMIT 1',
    [workspaceId],
  );
  if (!result.rows[0]) return null;
  return mapRow(result.rows[0]);
}

export async function getPaddleSubscriptionByPaddleId(
  paddleSubId: string,
): Promise<PaddleSubscriptionRow | null> {
  const result = await pool.query(
    'SELECT * FROM paddle_subscriptions WHERE paddle_subscription_id = $1 LIMIT 1',
    [paddleSubId],
  );
  if (!result.rows[0]) return null;
  return mapRow(result.rows[0]);
}

export async function suspendPaddleWorkspace(workspaceId: string): Promise<void> {
  await pool.query(
    `UPDATE paddle_subscriptions
     SET status = 'suspended', payment_failed_at = NOW(), updated_at = NOW()
     WHERE workspace_id = $1`,
    [workspaceId],
  );
  await suspendSubscription(workspaceId, 'payment');
}

export async function reactivatePaddleWorkspace(workspaceId: string): Promise<void> {
  await pool.query(
    `UPDATE paddle_subscriptions
     SET status = 'active', payment_failed_at = NULL, canceled_at = NULL, updated_at = NOW()
     WHERE workspace_id = $1`,
    [workspaceId],
  );
  await reactivateSubscription(workspaceId);
}
