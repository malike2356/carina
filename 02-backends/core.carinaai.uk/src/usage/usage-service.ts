import { pool } from '../memory/db.js';
import { getSubscription } from '../workers/aiva-subscription-store.js';
import {
  firstWorkerName,
  sendUsageLimitReachedEmail,
  sendUsageWarningEmail,
} from '../email/email-triggers.js';

export const MESSAGE_LIMITS_BY_TIER: Record<string, number> = {
  trial: 200,
  starter: 2000,
  team: 10000,
  business: Number.POSITIVE_INFINITY,
};

export function messageLimit(planTier: string): number {
  return MESSAGE_LIMITS_BY_TIER[planTier] ?? 200;
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export async function incrementMessageCount(workspaceId: string): Promise<void> {
  const month = currentMonth();
  await pool.query(
    `INSERT INTO aiva_usage (workspace_id, month, message_count, updated_at)
     VALUES ($1, $2, 1, NOW())
     ON CONFLICT (workspace_id, month)
     DO UPDATE SET message_count = aiva_usage.message_count + 1, updated_at = NOW()`,
    [workspaceId, month],
  );
}

export async function getCurrentUsage(workspaceId: string): Promise<{
  messageCount: number;
  month: string;
  warningSentAt: Date | null;
  limitReachedAt: Date | null;
}> {
  const month = currentMonth();
  const result = await pool.query(
    `SELECT message_count, warning_sent_at, limit_reached_at
     FROM aiva_usage WHERE workspace_id = $1 AND month = $2`,
    [workspaceId, month],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return {
    messageCount: Number(row?.message_count ?? 0),
    month,
    warningSentAt: row?.warning_sent_at ? new Date(String(row.warning_sent_at)) : null,
    limitReachedAt: row?.limit_reached_at ? new Date(String(row.limit_reached_at)) : null,
  };
}

export async function checkAndEnforceLimit(workspaceId: string): Promise<{
  allowed: boolean;
  messageCount: number;
  limit: number;
  planTier: string;
}> {
  const sub = await getSubscription(workspaceId);
  const planTier = sub?.planTier ?? 'trial';
  const limit = messageLimit(planTier);
  const usage = await getCurrentUsage(workspaceId);

  if (limit !== Number.POSITIVE_INFINITY && usage.messageCount >= limit) {
    if (!usage.limitReachedAt) {
      await pool.query(
        `UPDATE aiva_usage SET limit_reached_at = NOW(), updated_at = NOW()
         WHERE workspace_id = $1 AND month = $2`,
        [workspaceId, usage.month],
      );
    }
    return { allowed: false, messageCount: usage.messageCount, limit, planTier };
  }

  return { allowed: true, messageCount: usage.messageCount, limit, planTier };
}

export async function getUsageBar(workspaceId: string): Promise<{
  count: number;
  limit: number;
  resetsAt: string;
  planTier: string;
}> {
  const sub = await getSubscription(workspaceId);
  const planTier = sub?.planTier ?? 'trial';
  const limit = messageLimit(planTier);
  const usage = await getCurrentUsage(workspaceId);
  const now = new Date();
  const resetsAt = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  return {
    count: usage.messageCount,
    limit: limit === Number.POSITIVE_INFINITY ? 0 : limit,
    resetsAt,
    planTier,
  };
}

export async function maybeSendUsageAlerts(workspaceId: string): Promise<void> {
  const sub = await getSubscription(workspaceId);
  const planTier = sub?.planTier ?? 'trial';
  const limit = messageLimit(planTier);
  if (limit === Number.POSITIVE_INFINITY) return;

  const usage = await getCurrentUsage(workspaceId);
  const warningThreshold = Math.floor(limit * 0.8);
  const usagePercent = Math.min(100, Math.round((usage.messageCount / limit) * 100));
  const workerName = await firstWorkerName(workspaceId);

  if (usage.messageCount >= limit && !usage.limitReachedAt) {
    await pool.query(
      `UPDATE aiva_usage SET limit_reached_at = NOW(), updated_at = NOW()
       WHERE workspace_id = $1 AND month = $2`,
      [workspaceId, usage.month],
    );
    void sendUsageLimitReachedEmail({ workspaceId, workerName, messageLimit: limit }).catch((err) => {
      console.error('[usage] limit reached email failed:', err);
    });
    return;
  }

  if (usage.messageCount >= warningThreshold && !usage.warningSentAt) {
    await pool.query(
      `UPDATE aiva_usage SET warning_sent_at = NOW(), updated_at = NOW()
       WHERE workspace_id = $1 AND month = $2`,
      [workspaceId, usage.month],
    );
    void sendUsageWarningEmail({
      workspaceId,
      workerName,
      messageCount: usage.messageCount,
      messageLimit: limit,
      usagePercent,
    }).catch((err) => {
      console.error('[usage] warning email failed:', err);
    });
  }
}
