import { pool } from '../db.js';

export type FailClosedMode = 'fail_open' | 'fail_closed' | 'dry_run';
export type UnreachableAction = 'block' | 'allow' | 'alert_only';

export async function getFailClosedMode(
  accountId: string,
  toolClass: string,
): Promise<{ mode: FailClosedMode; unreachableAction: UnreachableAction }> {
  const result = await pool.query<{ mode: FailClosedMode; scout_unreachable_action: UnreachableAction }>(
    `SELECT mode, scout_unreachable_action
     FROM fail_closed_config
     WHERE account_id = $1 AND (tool_class = $2 OR tool_class = '*')
     ORDER BY CASE WHEN tool_class = $2 THEN 0 ELSE 1 END
     LIMIT 1`,
    [accountId, toolClass],
  );
  const row = result.rows[0];
  return {
    mode: row?.mode ?? 'fail_open',
    unreachableAction: row?.scout_unreachable_action ?? 'allow',
  };
}

export async function setFailClosedMode(
  accountId: string,
  toolClass: string,
  mode: FailClosedMode,
  unreachableAction: UnreachableAction,
): Promise<void> {
  await pool.query(
    `INSERT INTO fail_closed_config (account_id, tool_class, mode, scout_unreachable_action)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (account_id, tool_class)
     DO UPDATE SET mode = EXCLUDED.mode,
                   scout_unreachable_action = EXCLUDED.scout_unreachable_action,
                   updated_at = NOW()`,
    [accountId, toolClass, mode, unreachableAction],
  );
}

export async function getUnreachablePolicy(accountId: string): Promise<Record<string, string>> {
  const result = await pool.query<{ tool_class: string; scout_unreachable_action: string }>(
    `SELECT tool_class, scout_unreachable_action
     FROM fail_closed_config
     WHERE account_id = $1`,
    [accountId],
  );
  return Object.fromEntries(result.rows.map((r) => [r.tool_class, r.scout_unreachable_action]));
}

export async function listFailClosedConfigs(accountId: string): Promise<Array<{
  toolClass: string;
  mode: FailClosedMode;
  unreachableAction: UnreachableAction;
  updatedAt: string;
}>> {
  const result = await pool.query<{
    tool_class: string;
    mode: FailClosedMode;
    scout_unreachable_action: UnreachableAction;
    updated_at: Date;
  }>(
    `SELECT tool_class, mode, scout_unreachable_action, updated_at
     FROM fail_closed_config
     WHERE account_id = $1
     ORDER BY tool_class`,
    [accountId],
  );
  return result.rows.map((r) => ({
    toolClass: r.tool_class,
    mode: r.mode,
    unreachableAction: r.scout_unreachable_action,
    updatedAt: r.updated_at.toISOString(),
  }));
}

/** Resolve how a caller should behave when Scout HTTP is unreachable for a high-risk class. */
export function resolveUnreachableDecision(
  unreachableAction: UnreachableAction,
  mode: FailClosedMode,
): 'allow' | 'block' | 'dry_run' {
  if (mode === 'dry_run') return 'dry_run';
  if (mode === 'fail_closed') {
    return unreachableAction === 'allow' ? 'allow' : 'block';
  }
  // fail_open
  if (unreachableAction === 'block') return 'block';
  return 'allow';
}
