import { getUsageBar, getCurrentUsage, messageLimit, resolveTrialCreditGbp } from '../usage/usage-service.js';
import { suspendIfGraceExpired } from '../billing/aiva-billing.js';
import { effectivePlanTier } from '../billing/plan-tier.js';
import { grantAivaTrialCredit } from '../billing/aiva-ai-wallet.js';
import { pool } from '../memory/db.js';
import { listWorkers } from './worker-store.js';

export interface AivaSubscriptionRow {
    workspaceId: string;
    planTier: string;
    status: string;
    trialEndsAt: Date | null;
    aivaSlotLimit: number;
}

export interface TrialGrantStatus {
    granted: boolean;
    pence: number;
}

export interface TrialProvisionResult {
    trialEndsAt: string;
    slotLimit: number;
    walletGrant: TrialGrantStatus;
    existing: boolean;
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
export const AIVA_TRIAL_DAYS = 30;
export async function getSubscription(workspaceId: string): Promise<AivaSubscriptionRow | null> {
    const result = await pool.query('SELECT * FROM aiva_subscriptions WHERE workspace_id = $1 LIMIT 1', [workspaceId]);
    if (result.rows.length === 0)
        return null;
    return rowToSubscription(result.rows[0]);
}
export async function provisionTrial(workspaceId: string): Promise<TrialProvisionResult> {
    const existing = await getSubscription(workspaceId);
    if (existing) {
        // Idempotent: older trials may have missed the wallet grant.
        const walletGrant = await grantAivaTrialCredit(workspaceId).catch((err) => {
            console.warn('[aiva-subscription] trial credit grant failed:', err instanceof Error ? err.message : String(err));
            return { granted: false, pence: 0 };
        });
        return {
            trialEndsAt: existing.trialEndsAt?.toISOString() ?? '',
            slotLimit: existing.aivaSlotLimit,
            walletGrant,
            existing: true,
        };
    }
    // Trial clock starts when the first channel connects (including web chat).
    const result = await pool.query(`INSERT INTO aiva_subscriptions
       (workspace_id, plan_tier, status, trial_ends_at, aiva_slot_limit)
     VALUES ($1, 'trial', 'pending_channel', NULL, 1)
     RETURNING *`, [workspaceId]);
    const row = rowToSubscription(result.rows[0]);
    const walletGrant = await grantAivaTrialCredit(workspaceId).catch((err) => {
        console.warn('[aiva-subscription] trial credit grant failed:', err instanceof Error ? err.message : String(err));
        return { granted: false, pence: 0 };
    });
    return {
        trialEndsAt: row.trialEndsAt?.toISOString() ?? '',
        slotLimit: row.aivaSlotLimit,
        walletGrant,
        existing: false,
    };
}
// Called by provision-worker-channels after the first non-web channel connects.
export async function activateTrialOnFirstChannel(workspaceId: string): Promise<void> {
    await pool.query(`UPDATE aiva_subscriptions
     SET status = 'trialing',
         trial_ends_at = NOW() + ($2::int * INTERVAL '1 day'),
         updated_at = NOW()
     WHERE workspace_id = $1 AND status = 'pending_channel'`, [workspaceId, AIVA_TRIAL_DAYS]);
    await grantAivaTrialCredit(workspaceId).catch((err) => {
        console.warn('[aiva-subscription] trial credit grant on activate failed:', err instanceof Error ? err.message : String(err));
    });
}
// Called on the same workspace after 90 days: reopens a 30-day trial period.
export async function reactivateTrialPeriod(workspaceId: string): Promise<boolean> {
    const result = await pool.query(`UPDATE aiva_subscriptions
     SET status = 'trialing',
         trial_ends_at = NOW() + ($2::int * INTERVAL '1 day'),
         updated_at = NOW()
     WHERE workspace_id = $1 AND (status = 'suspended' OR status = 'pending_channel')
     RETURNING id`, [workspaceId, AIVA_TRIAL_DAYS]);
    return (result.rowCount ?? 0) > 0;
}
function trialDaysRemaining(trialEndsAt: Date | null): number | null {
    if (!trialEndsAt)
        return null;
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
            status: 'pending_channel',
            trialEndsAt: null,
            trialDaysRemaining: null,
            slotLimit: 1,
            aivasUsed,
            canHireMore: true,
            pendingChannelActivation: true,
        };
    }
    const days = trialDaysRemaining(sub.trialEndsAt);
    const expired = sub.status === 'trialing' && days !== null && days <= 0;
    const pendingChannel = sub.status === 'pending_channel';
    let effectiveStatus = sub.status;
    if (expired || sub.status === 'trial_ended') {
        effectiveStatus = 'trial_ended';
    }
    return {
        planTier: sub.planTier,
        status: effectiveStatus,
        trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
        trialDaysRemaining: days,
        slotLimit: sub.aivaSlotLimit,
        aivasUsed,
        canHireMore: aivasUsed < sub.aivaSlotLimit
            && effectiveStatus !== 'suspended'
            && effectiveStatus !== 'trial_ended',
        pendingChannelActivation: pendingChannel,
        softWall: effectiveStatus === 'trial_ended',
    };
}
export async function getBillingStatus(workspaceId: string): Promise<Record<string, unknown>> {
    const status = await getSubscriptionStatus(workspaceId);
    const usageBar = await getUsageBar(workspaceId);
    const usage = await getCurrentUsage(workspaceId);
    const sub = await getSubscription(workspaceId);
    const tier = sub?.planTier ?? String(status.planTier ?? 'trial');
    const subscriptionStatus = String(status.status ?? sub?.status ?? '');
    const featurePlanTier = effectivePlanTier(tier, subscriptionStatus);
    const rawLimit = messageLimit(tier);
    const messageLimitValue = rawLimit === Number.POSITIVE_INFINITY ? null : rawLimit;
    const usagePercent = messageLimitValue && messageLimitValue > 0
        ? Math.min(100, Math.round((usageBar.count / messageLimitValue) * 100))
        : 0;
    const subRow = await pool.query(`SELECT grace_period_ends_at, cancel_at_period_end, current_period_end, payment_failed_at,
            stripe_customer_id
     FROM aiva_subscriptions WHERE workspace_id = $1`, [workspaceId]);
    const billing = subRow.rows[0];
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
            trialCreditGbp: resolveTrialCreditGbp(),
        },
        messageUsage: usageBar,
        planTier: tier,
        featurePlanTier,
        count: usageBar.count,
        limit: usageBar.limit,
        resetsAt: usageBar.resetsAt,
        stripeCustomerId: billing?.stripe_customer_id ? String(billing.stripe_customer_id) : null,
    };
}
