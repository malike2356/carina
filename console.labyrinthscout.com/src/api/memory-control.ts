import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import { getRedis } from '../redis.js';

export const memoryControlRouter: IRouter = Router();

interface SessionRow {
  session_id: string;
  turn_count: string;
  last_active: string;
}

memoryControlRouter.post('/clear-session', async (req: Request, res: Response): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  const sessionId = typeof body.session_id === 'string' ? body.session_id.trim() : '';
  const instanceId = typeof body.instance_id === 'string' ? body.instance_id.trim() : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

  if (!sessionId) {
    res.status(400).json({ error: 'session_id is required' });
    return;
  }
  if (!instanceId) {
    res.status(400).json({ error: 'instance_id is required' });
    return;
  }
  if (!reason) {
    res.status(400).json({ error: 'reason is required' });
    return;
  }

  try {
    const del = await pool.query('DELETE FROM episodic_memories WHERE session_id = $1', [sessionId]);
    const rowsDeleted = del.rowCount ?? 0;

    const redis = getRedis();
    if (redis) {
      await redis.publish(
        'labyrinth:control',
        JSON.stringify({
          action: 'clear_session_memory',
          session_id: sessionId,
          instance_id: instanceId,
          reason,
        }),
      );
    }

    await pool.query(
      `INSERT INTO security_events
         (instance_id, event_type, severity, source, description, metadata, session_id)
       VALUES ($1, 'session_memory_cleared', 'warning', 'memory-control-api', $2, $3, $4)`,
      [
        instanceId,
        `Session memory cleared by operator: ${reason}`,
        JSON.stringify({ rows_deleted: rowsDeleted, reason, session_id: sessionId }),
        sessionId,
      ],
    );

    res.json({ ok: true, session_id: sessionId, rows_deleted: rowsDeleted });
  } catch (err) {
    console.error('[memory-control] clear-session error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

memoryControlRouter.get('/sessions', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query<SessionRow>(
      `SELECT session_id,
              COUNT(*)::text         AS turn_count,
              MAX(created_at)::text  AS last_active
       FROM episodic_memories
       GROUP BY session_id
       ORDER BY MAX(created_at) DESC
       LIMIT 50`,
    );

    const sessions = result.rows.map((r) => ({
      session_id: r.session_id,
      turn_count: parseInt(r.turn_count, 10),
      last_active: r.last_active,
    }));

    res.json({ sessions });
  } catch (err) {
    console.error('[memory-control] sessions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
