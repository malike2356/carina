import { getUsageBar, getCurrentUsage, messageLimit } from '../usage/usage-service.js';
import { suspendIfGraceExpired } from '../billing/aiva-billing.js';
import { pool } from '../memory/db.js';
import { listWorkers } from './worker-store.js';

export interface AivaSubscriptionRow {
  workspaceId: string;
  planTier: string;
  status: string;
  trialEndsAt: Date | null;
  aivaSlotLimit: number;
}

function rowToSubscription(row: Record<string, unknown>): AivaSubscriptionRow {
  return {
    workspaceId: String(row.workspace_id),
    planTier: String(row.plan_tier),
    status: String(row.status),
    trialEndsAt: row.trial_ends_at ? new Date(String(row.trial_ends_at)) : null,
    aivaSlotLimit: Number(row.aiva_slot_limit ?? 1),
  };
}

export async function getSubscription(workspaceId: string): Promise<AivaSubscriptionRow | null> {
  const result = await pool.query(
    'SELECT * FROM aiva_subscriptions WHERE workspace_id = $1 LIMIT 1',
    [workspaceId],
  );
  if (result.rows.length === 0) return null;
  return rowToSubscription(result.rows[0]);
}

export async function provisionTrial(
  workspaceId: string,
): Promise<{ trialEndsAt: string; slotLimit: number }> {
  const existing = await getSubscription(workspaceId);
  if (existing) {
    return {
      trialEndsAt: existing.trialEndsAt?.toISOString() ?? '',
      slotLimit: existing.aivaSlotLimit,
    };
  }

  const result = await pool.query(
    `INSERT INTO aiva_subscriptions
       (workspace_id, plan_tier, status, trial_ends_at, aiva_slot_limit)
     VALUES ($1, 'trial', 'trialing', NOW() + INTERVAL '15 days', 1)
     RETURNING *`,
    [workspaceId],
  );
  const row = rowToSubscription(result.rows[0]);
  return {
    trialEndsAt: row.trialEndsAt?.toISOString() ?? '',
    slotLimit: row.aivaSlotLimit,
  };
}

function trialDaysRemaining(trialEndsAt: Date | null): number | null {
  if (!trialEndsAt) return null;
  const ms = trialEndsAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export async function getSubscriptionStatus(workspaceId: string): Promise<Record<string, unknown>> {
  await suspendIfGraceExpired(workspaceId);

  const sub = await getSubscription(workspaceId);
  const workers = await listWorkers(workspaceId);
  const aivasUsed = workers.filter((w) => w.status !== 'dismissed').length;

  if (!sub) {
    return {
      planTier: 'trial',
      status: 'trialing',
      trialEndsAt: null,
      trialDaysRemaining: null,
      slotLimit: 0,
      aivasUsed,
      canHireMore: false,
    };
  }

  const days = trialDaysRemaining(sub.trialEndsAt);
  const expired = sub.status === 'trialing' && days !== null && days <= 0;
  const effectiveStatus = expired ? 'suspended' : sub.status;

  return {
    planTier: sub.planTier,
    status: effectiveStatus,
    trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
    trialDaysRemaining: days,
    slotLimit: sub.aivaSlotLimit,
    aivasUsed,
    canHireMore: aivasUsed < sub.aivaSlotLimit && effectiveStatus !== 'suspended',
  };
}

export async function getBillingStatus(workspaceId: string): Promise<Record<string, unknown>> {
  const status = await getSubscriptionStatus(workspaceId);
  const usageBar = await getUsageBar(workspaceId);
  const usage = await getCurrentUsage(workspaceId);
  const sub = await getSubscription(workspaceId);
  const tier = sub?.planTier ?? String(status.planTier ?? 'trial');
  const rawLimit = messageLimit(tier);
  const messageLimitValue = rawLimit === Number.POSITIVE_INFINITY ? null : rawLimit;
  const usagePercent =
    messageLimitValue && messageLimitValue > 0
      ? Math.min(100, Math.round((usageBar.count / messageLimitValue) * 100))
      : 0;

  const subRow = await pool.query(
    `SELECT grace_period_ends_at, cancel_at_period_end, current_period_end, payment_failed_at,
            stripe_customer_id
     FROM aiva_subscriptions WHERE workspace_id = $1`,
    [workspaceId],
  );
  const billing = subRow.rows[0] as Record<string, unknown> | undefined;

  return {
    subscription: {
      ...status,
      stripeCustomerId: billing?.stripe_customer_id ? String(billing.stripe_customer_id) : null,
      gracePeriodEndsAt: billing?.grace_period_ends_at
        ? new Date(String(billing.grace_period_ends_at)).toISOString()
        : null,
      cancelAtPeriodEnd: Boolean(billing?.cancel_at_period_end),
      currentPeriodEnd: billing?.current_period_end
        ? new Date(String(billing.current_period_end)).toISOString()
        : null,
      paymentFailedAt: billing?.payment_failed_at
        ? new Date(String(billing.payment_failed_at)).toISOString()
        : null,
    },
    usage: {
      messageCount: usageBar.count,
      messageLimit: messageLimitValue,
      usagePercent,
      resetsAt: usageBar.resetsAt,
      warningSentAt: usage.warningSentAt?.toISOString() ?? null,
      limitReachedAt: usage.limitReachedAt?.toISOString() ?? null,
    },
    messageUsage: usageBar,
    planTier: usageBar.planTier,
    count: usageBar.count,
    limit: usageBar.limit,
    resetsAt: usageBar.resetsAt,
    stripeCustomerId: billing?.stripe_customer_id ? String(billing.stripe_customer_id) : null,
  };
}
