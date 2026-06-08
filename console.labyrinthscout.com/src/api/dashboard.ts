import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import { buildAgentStatus } from '../dashboard/widgets/agent-status.js';
import { buildThreatMetrics } from '../dashboard/widgets/threat-metrics.js';
import { buildUsageAnalytics } from '../dashboard/widgets/usage-analytics.js';

export const dashboardRouter: IRouter = Router();

dashboardRouter.get('/agent-status', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query<{
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
    res.json(buildAgentStatus(result.rows));
  } catch (err) {
    console.error('[dashboard] agent-status failed:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

dashboardRouter.get('/threat-metrics', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query<{
      severity: 'info' | 'warning' | 'critical' | 'breach';
      event_type: string;
      ip_address: string | null;
      metadata: Record<string, unknown> | string | null;
      created_at: Date;
    }>(
      `SELECT severity, event_type, ip_address, metadata, created_at
       FROM security_events
       WHERE created_at > NOW() - INTERVAL '24 hours'
       ORDER BY created_at DESC
       LIMIT 5000`,
    );
    res.json(buildThreatMetrics(result.rows));
  } catch (err) {
    console.error('[dashboard] threat-metrics failed:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

dashboardRouter.get('/usage-analytics', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query<{
      metadata: Record<string, unknown> | string | null;
      description: string | null;
    }>(
      `SELECT metadata, description
       FROM security_events
       WHERE created_at > NOW() - INTERVAL '24 hours'
         AND (event_type = 'tool_call'
              OR event_type = 'session_metrics'
              OR metadata ? 'tokens_used'
              OR metadata ? 'total_tokens')`,
    );
    res.json(buildUsageAnalytics(result.rows));
  } catch (err) {
    console.error('[dashboard] usage-analytics failed:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

dashboardRouter.get('/audit-log', async (req: Request, res: Response): Promise<void> => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : '';
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const params: unknown[] = [limit];
  let where = '';

  if (query) {
    params.push(`%${query}%`);
    where = `WHERE event_type ILIKE $2
        OR description ILIKE $2
        OR source ILIKE $2
        OR instance_id ILIKE $2
        OR session_id ILIKE $2
        OR metadata::text ILIKE $2`;
  }

  try {
    const result = await pool.query(
      `SELECT id, severity, source, event_type, description, metadata,
              ip_address, session_id, instance_id, mitigated, created_at,
              acknowledged, acknowledged_at, acknowledged_note
       FROM security_events
       ${where}
       ORDER BY created_at DESC
       LIMIT $1`,
      params,
    );
    res.json({ events: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('[dashboard] audit-log failed:', err);
    res.status(500).json({ error: 'Database error' });
  }
});
