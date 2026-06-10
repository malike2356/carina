import { pool } from '../db.js';

export type ScoutSubscriptionPlan =
  | 'scout_monitor'
  | 'scout_pro'
  | 'scout_standard'
  | 'enterprise';

export function normalizeScoutPlan(value: unknown): ScoutSubscriptionPlan {
  if (
    value === 'scout_monitor' ||
    value === 'scout_pro' ||
    value === 'scout_standard' ||
    value === 'enterprise'
  ) {
    return value;
  }
  return 'scout_pro';
}

export function isScoutProPlan(plan: ScoutSubscriptionPlan): boolean {
  return plan === 'scout_pro' || plan === 'scout_standard' || plan === 'enterprise';
}

export async function getAccountSubscriptionPlan(accountId: string): Promise<ScoutSubscriptionPlan> {
  const result = await pool.query<{ subscription_plan: string }>(
    `SELECT subscription_plan FROM accounts WHERE id = $1`,
    [accountId],
  );
  return normalizeScoutPlan(result.rows[0]?.subscription_plan);
}

export async function setAccountSubscriptionPlan(
  accountId: string,
  plan: ScoutSubscriptionPlan,
): Promise<void> {
  await pool.query(`UPDATE accounts SET subscription_plan = $2 WHERE id = $1`, [
    accountId,
    normalizeScoutPlan(plan),
  ]);
}

export async function setSubscriptionPlanByCarinaTenant(
  carinaTenantId: string,
  plan: ScoutSubscriptionPlan,
): Promise<boolean> {
  const result = await pool.query(
    `UPDATE accounts SET subscription_plan = $2 WHERE carina_tenant_id = $1`,
    [carinaTenantId, normalizeScoutPlan(plan)],
  );
  return (result.rowCount ?? 0) > 0;
}
