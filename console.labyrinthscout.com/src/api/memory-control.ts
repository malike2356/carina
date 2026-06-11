import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import { getRedis } from '../redis.js';
import { episodicTableExists, isMissingEpisodicTable, listEpisodicSessions } from '../lib/episodic-memory.js';

export const memoryControlRouter: IRouter = Router();

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
    if (!(await episodicTableExists())) {
      res.status(503).json({
        error:
          'episodic_memories is not available in this Scout database. Point SCOUT_DATABASE_URL at the Carina DB or clear memory from core.carinaai.uk.',
      });
      return;
    }

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
    if (isMissingEpisodicTable(err)) {
      res.status(503).json({
        error:
          'episodic_memories table missing. Share Carina Postgres with Scout before clearing session memory.',
      });
      return;
    }
    console.error('[memory-control] clear-session error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

memoryControlRouter.get('/sessions', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await listEpisodicSessions();
    res.json({
      sessions: result.sessions,
      source: result.source,
      unavailable: result.source === 'unavailable',
      message: result.message,
    });
  } catch (err) {
    console.error('[memory-control] sessions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
