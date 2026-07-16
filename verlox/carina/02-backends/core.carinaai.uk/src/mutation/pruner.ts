import { pool } from '../memory/db.js';
import { registry } from '../tools/registry.js';
import { logSelfModEvent } from '../security/self-mod-logger.js';
import { expireStaleProposals } from './gap-detector.js';

export interface PruneReport {
  prunedTools: string[];
  expiredProposals: number;
  expiredStagedOverrides: number;
  totalPruned: number;
  dryRun: boolean;
}

const PRUNE_AFTER_DAYS = (): number =>
  parseInt(process.env.CARINA_MUTATION_PRUNE_AFTER_DAYS ?? '30', 10);

const MAX_TOOLS = (): number =>
  parseInt(process.env.CARINA_MUTATION_PRUNE_MAX_TOOLS ?? '100', 10);

const QUALITY_PRUNE_THRESHOLD = 0.5;

export async function pruneUnusedTools(dryRun = false): Promise<string[]> {
  const cutoff = PRUNE_AFTER_DAYS();

  const result = await pool.query<{ id: string; name: string }>(
    `SELECT id, name FROM runtime_tools
     WHERE status = 'active'
       AND (
         (last_used_at IS NULL AND created_at < NOW() - INTERVAL '1 day' * $1)
         OR (last_used_at < NOW() - INTERVAL '1 day' * $1)
       )
       AND (quality_score IS NULL OR quality_score < $2)
       AND promoted = FALSE`,
    [cutoff, QUALITY_PRUNE_THRESHOLD],
  );

  const names = result.rows.map((r) => r.name);
  if (!dryRun && names.length > 0) {
    for (const row of result.rows) {
      await pool.query(
        `UPDATE runtime_tools SET status = 'disabled', updated_at = NOW() WHERE id = $1`,
        [row.id],
      );
      registry.unregister(row.name);
    }
    void logSelfModEvent('TOOLS_PRUNED_UNUSED', { count: names.length, tool_names: names });
  }

  return names;
}

export async function pruneExcessTools(dryRun = false): Promise<string[]> {
  const max = MAX_TOOLS();

  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM runtime_tools WHERE status = 'active'`,
  );
  const current = Number(countResult.rows[0]?.count ?? 0);
  if (current <= max) return [];

  const toRemove = current - max;

  const result = await pool.query<{ id: string; name: string }>(
    `SELECT id, name FROM runtime_tools
     WHERE status = 'active' AND promoted = FALSE
     ORDER BY COALESCE(quality_score, 0) ASC, times_used ASC
     LIMIT $1`,
    [toRemove],
  );

  const names = result.rows.map((r) => r.name);
  if (!dryRun && names.length > 0) {
    for (const row of result.rows) {
      await pool.query(
        `UPDATE runtime_tools SET status = 'disabled', updated_at = NOW() WHERE id = $1`,
        [row.id],
      );
      registry.unregister(row.name);
    }
    void logSelfModEvent('TOOLS_PRUNED_EXCESS', { count: names.length, max_allowed: max });
  }

  return names;
}

export async function expireStagedOverrides(dryRun = false): Promise<number> {
  if (dryRun) {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM system_prompt_overrides
       WHERE is_active = FALSE AND activated_at IS NULL
         AND created_at < NOW() - INTERVAL '30 days'`,
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  const result = await pool.query<{ count: string }>(
    `WITH deleted AS (
       DELETE FROM system_prompt_overrides
       WHERE is_active = FALSE AND activated_at IS NULL
         AND created_at < NOW() - INTERVAL '30 days'
       RETURNING id
     ) SELECT COUNT(*) AS count FROM deleted`,
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function runFullPrune(dryRun = false): Promise<PruneReport> {
  const expiredProposals = dryRun
    ? await expireStaleProposals(PRUNE_AFTER_DAYS(), true)
    : await expireStaleProposals(PRUNE_AFTER_DAYS());

  const [prunedTools, excessTools, expiredOverrides] = await Promise.all([
    pruneUnusedTools(dryRun),
    pruneExcessTools(dryRun),
    expireStagedOverrides(dryRun),
  ]);

  const allPrunedTools = [...new Set([...prunedTools, ...excessTools])];

  if (!dryRun) {
    void logSelfModEvent('FULL_PRUNE_COMPLETE', {
      pruned_tools: allPrunedTools.length,
      expired_proposals: expiredProposals,
      expired_overrides: expiredOverrides,
    });
  }

  return {
    prunedTools: allPrunedTools,
    expiredProposals,
    expiredStagedOverrides: expiredOverrides,
    totalPruned: allPrunedTools.length + expiredProposals + expiredOverrides,
    dryRun,
  };
}
