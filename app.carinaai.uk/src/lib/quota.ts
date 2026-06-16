import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { usageEvents, type Workspace, type WorkspacePlan } from '@/db/schema';
import { PLAN_LIMITS, totalTokens } from './plans';

export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

async function sumTokensSince(workspaceId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${usageEvents.inputTokens} + ${usageEvents.outputTokens}), 0)`,
    })
    .from(usageEvents)
    .where(and(eq(usageEvents.workspaceId, workspaceId), gte(usageEvents.createdAt, since)));
  return Number(row?.total ?? 0);
}

export async function getUsageTotals(workspace: Workspace): Promise<{
  dailyUsed: number;
  monthlyUsed: number;
  limit: number | null;
  period: 'day' | 'month' | 'unlimited';
}> {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const dailyUsed = await sumTokensSince(workspace.id, dayStart);
  const monthlyUsed = await sumTokensSince(workspace.id, monthStart);

  const limits = PLAN_LIMITS[workspace.plan];
  if (workspace.plan === 'free') {
    return { dailyUsed, monthlyUsed, limit: limits.dailyTokens, period: 'day' };
  }
  if (workspace.plan === 'starter') {
    return { dailyUsed, monthlyUsed, limit: limits.monthlyTokens, period: 'month' };
  }
  return { dailyUsed, monthlyUsed, limit: null, period: 'unlimited' };
}

export async function assertWithinQuota(workspace: Workspace): Promise<void> {
  const usage = await getUsageTotals(workspace);
  if (usage.period === 'unlimited') return;
  if (usage.period === 'day' && usage.limit !== null && usage.dailyUsed >= usage.limit) {
    throw new QuotaExceededError('Daily token quota exceeded. Upgrade your plan to continue.');
  }
  if (usage.period === 'month' && usage.limit !== null && usage.monthlyUsed >= usage.limit) {
    throw new QuotaExceededError('Monthly token quota exceeded. Upgrade your plan to continue.');
  }
}

export async function recordUsage(
  workspaceId: string,
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  await db.insert(usageEvents).values({
    workspaceId,
    provider,
    model,
    inputTokens,
    outputTokens,
  });
}

export function estimateTokensFromText(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export { totalTokens };

export type PlanId = WorkspacePlan;
