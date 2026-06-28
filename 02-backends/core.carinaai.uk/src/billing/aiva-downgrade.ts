import { pool } from '../memory/db.js';
import { pauseWorker } from '../workers/worker-store.js';
import { getSubscriptionStatus } from '../workers/aiva-subscription-store.js';

export async function resolveDowngradeConflict(
  workspaceId: string,
  keepWorkerIds: string[],
): Promise<{ resolved: true; pausedWorkerIds: string[]; keptWorkerIds: string[] }> {
  const subRow = await pool.query(
    `SELECT pending_downgrade_conflict, aiva_slot_limit
     FROM aiva_subscriptions WHERE workspace_id = $1`,
    [workspaceId],
  );
  const sub = subRow.rows[0] as { pending_downgrade_conflict?: boolean; aiva_slot_limit?: number } | undefined;
  if (!sub?.pending_downgrade_conflict) {
    throw new Error('No pending downgrade conflict for this workspace');
  }

  const slotLimit = Number(sub.aiva_slot_limit ?? 1);
  const uniqueKeep = [...new Set(keepWorkerIds.map(String))];
  if (uniqueKeep.length === 0 || uniqueKeep.length > slotLimit) {
    throw new Error(`Select between 1 and ${slotLimit} Aiva(s) to keep`);
  }

  const workersResult = await pool.query(
    `SELECT id FROM ai_workers
     WHERE workspace_id = $1 AND status != 'dismissed'`,
    [workspaceId],
  );
  const activeIds = workersResult.rows.map((row) => String(row.id));
  const invalid = uniqueKeep.filter((id) => !activeIds.includes(id));
  if (invalid.length > 0) {
    throw new Error('One or more selected Aivas are invalid');
  }

  const pausedWorkerIds: string[] = [];
  for (const workerId of activeIds) {
    if (uniqueKeep.includes(workerId)) continue;
    await pauseWorker(workspaceId, workerId);
    pausedWorkerIds.push(workerId);
  }

  await pool.query(
    `UPDATE aiva_subscriptions
     SET pending_downgrade_conflict = false, updated_at = NOW()
     WHERE workspace_id = $1`,
    [workspaceId],
  );

  return {
    resolved: true,
    pausedWorkerIds,
    keptWorkerIds: uniqueKeep,
  };
}

export async function getDowngradeConflictFields(workspaceId: string): Promise<{
  pendingDowngradeConflict: boolean;
  pendingDowngradeTier: string | null;
  pendingDowngradeSlotLimit: number | null;
  aivasUsed: number;
}> {
  const status = await getSubscriptionStatus(workspaceId);
  const subRow = await pool.query(
    `SELECT pending_downgrade_conflict, plan_tier, aiva_slot_limit
     FROM aiva_subscriptions WHERE workspace_id = $1`,
    [workspaceId],
  );
  const row = subRow.rows[0] as {
    pending_downgrade_conflict?: boolean;
    plan_tier?: string;
    aiva_slot_limit?: number;
  } | undefined;
  const conflict = Boolean(row?.pending_downgrade_conflict);
  return {
    pendingDowngradeConflict: conflict,
    pendingDowngradeTier: conflict ? String(row?.plan_tier ?? status.planTier ?? null) : null,
    pendingDowngradeSlotLimit: conflict ? Number(row?.aiva_slot_limit ?? status.slotLimit ?? 0) : null,
    aivasUsed: Number(status.aivasUsed ?? 0),
  };
}
