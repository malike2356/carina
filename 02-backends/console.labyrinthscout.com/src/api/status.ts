import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import type { InstanceStatus, StatusResponse } from '../types.js';
import { proxyScoutEngineJson } from '../lib/scout-engine-client.js';

export const statusRouter: IRouter = Router();

export const TOOL_NAMES = [
  'web-search',
  'file-read',
  'http-request',
  'shell-exec',
  'email-send',
  'code-exec',
] as const;

function resolveInstanceStatus(
  storedStatus: string,
  secondsAgo: number | null,
): InstanceStatus {
  if (storedStatus === 'suspended') return 'suspended';
  if (secondsAgo === null || secondsAgo > 90) return 'offline';
  return 'active';
}

export async function fetchStats24h(): Promise<{
  critical: number;
  warning: number;
  info: number;
  breach: number;
}> {
  const result = await pool.query<{ severity: string; count: string }>(
    `SELECT severity, COUNT(*)::text AS count
     FROM security_events
     WHERE created_at > NOW() - INTERVAL '24 hours'
       AND severity IN ('critical', 'warning', 'info', 'breach')
     GROUP BY severity`,
  );

  let critical = 0;
  let warning = 0;
  let info = 0;
  let breach = 0;

  for (const row of result.rows) {
    const n = parseInt(row.count, 10);
    if (row.severity === 'breach') breach += n;
    else if (row.severity === 'critical') critical += n;
    else if (row.severity === 'warning') warning += n;
    else if (row.severity === 'info') info += n;
  }

  return { critical, warning, info, breach };
}

async function fetchToolCalls(): Promise<Record<string, number>> {
  const result = await pool.query<{ tool_name: string; count: string }>(
    `SELECT metadata->>'tool_name' AS tool_name, COUNT(*)::text AS count
     FROM security_events
     WHERE created_at > NOW() - INTERVAL '1 hour'
       AND event_type = 'tool_call'
       AND metadata->>'tool_name' = ANY($1::text[])
     GROUP BY metadata->>'tool_name'`,
    [TOOL_NAMES as unknown as string[]],
  );

  const counts: Record<string, number> = {};
  for (const tool of TOOL_NAMES) counts[tool] = 0;
  for (const row of result.rows) {
    if (row.tool_name) counts[row.tool_name] = parseInt(row.count, 10);
  }
  return counts;
}

export async function buildStatusResponse(): Promise<StatusResponse> {
  const instancesResult = await pool.query<{
    id: string;
    name: string;
    status: string;
    suspension_reason: string | null;
    last_heartbeat: Date | null;
  }>(
    `SELECT id, name, status, suspension_reason, last_heartbeat
     FROM carina_instances
     ORDER BY created_at ASC`,
  );

  const now = Date.now();
  const instances = instancesResult.rows.map((row) => {
    const secondsAgo =
      row.last_heartbeat === null
        ? null
        : Math.max(0, Math.floor((now - new Date(row.last_heartbeat).getTime()) / 1000));

    return {
      id: row.id,
      name: row.name,
      status: resolveInstanceStatus(row.status, secondsAgo),
      last_heartbeat: row.last_heartbeat ? new Date(row.last_heartbeat).toISOString() : null,
      secondsAgo,
      suspension_reason: row.suspension_reason,
    };
  });

  const [stats, toolCalls] = await Promise.all([fetchStats24h(), fetchToolCalls()]);

  return { instances, stats, toolCalls };
}

statusRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  if (await proxyScoutEngineJson(req, res, { path: '/api/customer/status' })) return;

  try {
    const data = await buildStatusResponse();
    res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:status] Query failed:', msg);
    res.status(500).json({ error: 'Database unavailable' });
  }
});
