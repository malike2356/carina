import { pool } from '../db.js';
import { globalKillSwitch } from '../killswitch/global-kill-switch.js';
import { getCurrentScoutScore } from '../findings/score.js';
import {
  buildOverviewMetrics,
  type OverviewEventRow,
  type OverviewMetrics,
} from './widgets/overview-metrics.js';
import type { AgentStatusRow } from './widgets/agent-status.js';

async function loadEvents24h(accountId: string | null): Promise<OverviewEventRow[]> {
  const result = accountId
    ? await pool.query<{
      id: string;
      severity: 'info' | 'warning' | 'critical' | 'breach';
      event_type: string;
      ip_address: string | null;
      instance_id: string | null;
      metadata: Record<string, unknown> | string | null;
      description: string | null;
      acknowledged: boolean;
      mitigated: boolean;
      created_at: Date;
    }>(
      `SELECT e.id, e.severity, e.event_type, e.ip_address, e.instance_id, e.metadata,
              e.description, e.acknowledged, e.mitigated, e.created_at
       FROM security_events e
       JOIN carina_instances i ON i.id = e.instance_id
       WHERE i.account_id = $1
         AND e.created_at > NOW() - INTERVAL '24 hours'
         AND e.event_type <> 'session_metrics'
       ORDER BY e.created_at DESC
       LIMIT 5000`,
      [accountId],
    )
    : await pool.query<{
      id: string;
      severity: 'info' | 'warning' | 'critical' | 'breach';
      event_type: string;
      ip_address: string | null;
      instance_id: string | null;
      metadata: Record<string, unknown> | string | null;
      description: string | null;
      acknowledged: boolean;
      mitigated: boolean;
      created_at: Date;
    }>(
      `SELECT id, severity, event_type, ip_address, instance_id, metadata,
              description, acknowledged, mitigated, created_at
       FROM security_events
       WHERE created_at > NOW() - INTERVAL '24 hours'
         AND event_type <> 'session_metrics'
       ORDER BY created_at DESC
       LIMIT 5000`,
    );

  return result.rows;
}

async function loadAgents(accountId: string | null): Promise<AgentStatusRow[]> {
  const result = accountId
    ? await pool.query<AgentStatusRow>(
      `SELECT id, name, status, suspension_reason, last_heartbeat
       FROM carina_instances
       WHERE account_id = $1
       ORDER BY created_at ASC`,
      [accountId],
    )
    : await pool.query<AgentStatusRow>(
      `SELECT id, name, status, suspension_reason, last_heartbeat
       FROM carina_instances
       ORDER BY created_at ASC`,
    );
  return result.rows;
}

async function loadHoneypotHits24h(accountId: string | null): Promise<number> {
  try {
    const result = accountId
      ? await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM security_events e
         JOIN carina_instances i ON i.id = e.instance_id
         WHERE i.account_id = $1
           AND e.created_at > NOW() - INTERVAL '24 hours'
           AND e.event_type ILIKE '%honeypot%'`,
        [accountId],
      )
      : await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM security_events
         WHERE created_at > NOW() - INTERVAL '24 hours'
           AND event_type ILIKE '%honeypot%'`,
      );
    return Number.parseInt(result.rows[0]?.count ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

async function loadTripwireHits24h(accountId: string | null): Promise<number> {
  try {
    const result = accountId
      ? await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM security_events e
         JOIN carina_instances i ON i.id = e.instance_id
         WHERE i.account_id = $1
           AND e.created_at > NOW() - INTERVAL '24 hours'
           AND e.event_type ILIKE '%tripwire%'`,
        [accountId],
      )
      : await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM security_events
         WHERE created_at > NOW() - INTERVAL '24 hours'
           AND event_type ILIKE '%tripwire%'`,
      );
    return Number.parseInt(result.rows[0]?.count ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

async function loadFindingsScore(accountId: string | null): Promise<number | null> {
  if (!accountId) return null;
  try {
    const score = await getCurrentScoutScore(accountId, false);
    return typeof score.score === 'number' ? score.score : null;
  } catch {
    return null;
  }
}

/**
 * Server-owned executive overview metrics for the Scout console.
 * Prefer this over client-side event slicing.
 */
export async function loadOverviewMetrics(accountId: string | null): Promise<OverviewMetrics> {
  await globalKillSwitch.loadState().catch(() => undefined);
  const kill = globalKillSwitch.getStatus();

  const [events, agents, honeypotHits24h, tripwireHits24h, findingsScore] = await Promise.all([
    loadEvents24h(accountId),
    loadAgents(accountId),
    loadHoneypotHits24h(accountId),
    loadTripwireHits24h(accountId),
    loadFindingsScore(accountId),
  ]);

  return buildOverviewMetrics({
    events,
    agents,
    killTriggered: kill.triggered === true,
    killReason: kill.reason,
    findingsScore,
    honeypotHits24h,
    tripwireHits24h,
  });
}
