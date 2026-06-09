import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import { buildAgentStatus } from '../dashboard/widgets/agent-status.js';
import { buildThreatMetrics } from '../dashboard/widgets/threat-metrics.js';
import { buildUsageAnalytics } from '../dashboard/widgets/usage-analytics.js';
import { scopedAccountId } from '../lib/scope.js';

export const dashboardRouter: IRouter = Router();

dashboardRouter.get('/agent-status', async (req: Request, res: Response): Promise<void> => {
  const accountId = scopedAccountId(req);
  try {
    const result = await pool.query<{
      id: string;
      name: string;
      status: string;
      suspension_reason: string | null;
      last_heartbeat: Date | null;
    }>(
      accountId
        ? `SELECT id, name, status, suspension_reason, last_heartbeat
           FROM carina_instances
           WHERE account_id = $1
           ORDER BY created_at ASC`
        : `SELECT id, name, status, suspension_reason, last_heartbeat
           FROM carina_instances
           ORDER BY created_at ASC`,
      accountId ? [accountId] : [],
    );
    res.json(buildAgentStatus(result.rows));
  } catch (err) {
    console.error('[dashboard] agent-status failed:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

dashboardRouter.get('/threat-metrics', async (req: Request, res: Response): Promise<void> => {
  const accountId = scopedAccountId(req);
  try {
    const result = await pool.query<{
      severity: 'info' | 'warning' | 'critical' | 'breach';
      event_type: string;
      ip_address: string | null;
      metadata: Record<string, unknown> | string | null;
      created_at: Date;
    }>(
      accountId
        ? `SELECT e.severity, e.event_type, e.ip_address, e.metadata, e.created_at
           FROM security_events e
           JOIN carina_instances i ON i.id = e.instance_id
           WHERE i.account_id = $1
             AND e.created_at > NOW() - INTERVAL '24 hours'
           ORDER BY e.created_at DESC
           LIMIT 5000`
        : `SELECT severity, event_type, ip_address, metadata, created_at
           FROM security_events
           WHERE created_at > NOW() - INTERVAL '24 hours'
           ORDER BY created_at DESC
           LIMIT 5000`,
      accountId ? [accountId] : [],
    );
    res.json(buildThreatMetrics(result.rows));
  } catch (err) {
    console.error('[dashboard] threat-metrics failed:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

dashboardRouter.get('/usage-analytics', async (req: Request, res: Response): Promise<void> => {
  const accountId = scopedAccountId(req);
  try {
    const result = await pool.query<{
      metadata: Record<string, unknown> | string | null;
      description: string | null;
    }>(
      accountId
        ? `SELECT e.metadata, e.description
           FROM security_events e
           JOIN carina_instances i ON i.id = e.instance_id
           WHERE i.account_id = $1
             AND e.created_at > NOW() - INTERVAL '24 hours'
             AND (e.event_type = 'tool_call'
                  OR e.event_type = 'session_metrics'
                  OR e.metadata ? 'tokens_used'
                  OR e.metadata ? 'total_tokens')`
        : `SELECT metadata, description
           FROM security_events
           WHERE created_at > NOW() - INTERVAL '24 hours'
             AND (event_type = 'tool_call'
                  OR event_type = 'session_metrics'
                  OR metadata ? 'tokens_used'
                  OR metadata ? 'total_tokens')`,
      accountId ? [accountId] : [],
    );
    res.json(buildUsageAnalytics(result.rows));
  } catch (err) {
    console.error('[dashboard] usage-analytics failed:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

dashboardRouter.get('/audit-log', async (req: Request, res: Response): Promise<void> => {
  const accountId = scopedAccountId(req);
  const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : '';
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const params: unknown[] = accountId ? [accountId, limit] : [limit];
  let where = accountId ? 'WHERE i.account_id = $1' : '';

  if (query) {
    const queryParam = `%${query}%`;
    params.push(queryParam);
    const queryIndex = params.length;
    const searchClause = `(
      e.event_type ILIKE $${queryIndex}
      OR e.description ILIKE $${queryIndex}
      OR e.source ILIKE $${queryIndex}
      OR e.instance_id ILIKE $${queryIndex}
      OR e.session_id ILIKE $${queryIndex}
      OR e.metadata::text ILIKE $${queryIndex}
    )`;
    where = where ? `${where} AND ${searchClause}` : `WHERE ${searchClause}`;
  }

  const limitIndex = accountId ? 2 : 1;
  try {
    const result = await pool.query(
      accountId
        ? `SELECT e.id, e.severity, e.source, e.event_type, e.description, e.metadata,
                  e.ip_address, e.session_id, e.instance_id, e.mitigated, e.created_at,
                  e.acknowledged, e.acknowledged_at, e.acknowledged_note
           FROM security_events e
           JOIN carina_instances i ON i.id = e.instance_id
           ${where}
           ORDER BY e.created_at DESC
           LIMIT $${limitIndex}`
        : `SELECT id, severity, source, event_type, description, metadata,
                  ip_address, session_id, instance_id, mitigated, created_at,
                  acknowledged, acknowledged_at, acknowledged_note
           FROM security_events
           ${where}
           ORDER BY created_at DESC
           LIMIT $${limitIndex}`,
      params,
    );
    res.json({ events: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('[dashboard] audit-log failed:', err);
    res.status(500).json({ error: 'Database error' });
  }
});
