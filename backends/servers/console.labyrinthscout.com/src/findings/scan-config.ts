import { pool } from '../db.js';
import {
  ENGINE_REGISTRY,
  defaultEnginesForTier,
  scheduleIntervalMs,
  type ScanSchedule,
} from '../engines/registry.js';
import { getAccountSubscriptionPlan, isScoutProPlan } from '../lib/subscription-plan.js';

export interface ScanConfig {
  id: string;
  targetId: string;
  tool: string;
  schedule: ScanSchedule;
  isEnabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  config: Record<string, unknown>;
  createdAt: string;
}

interface ScanConfigRow {
  id: string;
  target_id: string;
  tool: string;
  schedule: string;
  is_enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  config: Record<string, unknown>;
  created_at: string;
}

function mapRow(row: ScanConfigRow): ScanConfig {
  return {
    id: row.id,
    targetId: row.target_id,
    tool: row.tool,
    schedule: row.schedule as ScanSchedule,
    isEnabled: row.is_enabled,
    lastRunAt: row.last_run_at,
    nextRunAt: row.next_run_at,
    config: row.config ?? {},
    createdAt: row.created_at,
  };
}

function computeNextRun(schedule: ScanSchedule, from = new Date()): Date | null {
  const interval = scheduleIntervalMs(schedule);
  if (interval === null) return null;
  return new Date(from.getTime() + interval);
}

export async function seedScanConfigsForTarget(
  accountId: string,
  targetId: string,
): Promise<number> {
  const plan = await getAccountSubscriptionPlan(accountId);
  const tier = isScoutProPlan(plan) ? 'govern' : 'monitor';
  const tools = defaultEnginesForTier(tier);
  let inserted = 0;

  for (const tool of tools) {
    const def = ENGINE_REGISTRY[tool];
    if (!def) continue;
    const nextRun = computeNextRun(def.schedule);
    const result = await pool.query(
      `INSERT INTO scan_configs (target_id, tool, schedule, is_enabled, next_run_at, config)
       VALUES ($1, $2, $3, TRUE, $4, '{}'::jsonb)
       ON CONFLICT (target_id, tool) DO NOTHING`,
      [targetId, tool, def.schedule, nextRun?.toISOString() ?? null],
    );
    inserted += result.rowCount ?? 0;
  }

  return inserted;
}

export async function listDueScanConfigs(limit = 20): Promise<Array<ScanConfig & {
  accountId: string;
  target: string;
  targetType: string;
}>> {
  const result = await pool.query<ScanConfigRow & {
    account_id: string;
    target: string;
    target_type: string;
  }>(
    `SELECT sc.id, sc.target_id, sc.tool, sc.schedule, sc.is_enabled, sc.last_run_at,
            sc.next_run_at, sc.config, sc.created_at,
            t.account_id, t.target, t.target_type
     FROM scan_configs sc
     JOIN targets t ON t.id = sc.target_id
     WHERE sc.is_enabled = TRUE
       AND t.is_active = TRUE
       AND sc.next_run_at IS NOT NULL
       AND sc.next_run_at <= NOW()
     ORDER BY sc.next_run_at ASC
     LIMIT $1`,
    [limit],
  );

  return result.rows.map((row) => ({
    ...mapRow(row),
    accountId: row.account_id,
    target: row.target,
    targetType: row.target_type,
  }));
}

export async function markScanConfigRun(
  configId: string,
  schedule: ScanSchedule,
): Promise<void> {
  const nextRun = computeNextRun(schedule);
  await pool.query(
    `UPDATE scan_configs
     SET last_run_at = NOW(), next_run_at = $2
     WHERE id = $1`,
    [configId, nextRun?.toISOString() ?? null],
  );
}

export async function listScanConfigsForTarget(targetId: string): Promise<ScanConfig[]> {
  const result = await pool.query<ScanConfigRow>(
    `SELECT id, target_id, tool, schedule, is_enabled, last_run_at, next_run_at, config, created_at
     FROM scan_configs
     WHERE target_id = $1
     ORDER BY tool ASC`,
    [targetId],
  );
  return result.rows.map(mapRow);
}
