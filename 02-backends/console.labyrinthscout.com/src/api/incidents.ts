import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import type { SecurityEventRow } from '../types.js';

export const incidentsRouter: IRouter = Router();

type EventWithLineage = SecurityEventRow & {
  parent_session_id: string | null;
  root_session_id: string | null;
};

function serializeEvent(row: EventWithLineage): EventWithLineage {
  return {
    ...row,
    metadata: typeof row.metadata === 'string'
      ? (JSON.parse(row.metadata) as Record<string, unknown>)
      : row.metadata,
    created_at: new Date(row.created_at).toISOString(),
    parent_session_id: row.parent_session_id ?? null,
    root_session_id: row.root_session_id ?? null,
    acknowledged: row.acknowledged ?? false,
    acknowledged_at: row.acknowledged_at ? new Date(row.acknowledged_at).toISOString() : null,
    acknowledged_note: row.acknowledged_note ?? null,
  };
}

// GET /api/incidents/lineage/:sessionId
// Walks parent_session_id links to build the full session chain, returns all events in that chain.
incidentsRouter.get('/lineage/:sessionId', async (req: Request, res: Response): Promise<void> => {
  const sessionId = String(req.params['sessionId'] ?? '');
  if (!sessionId || sessionId.length > 200) {
    res.status(400).json({ error: 'Invalid session id' });
    return;
  }

  try {
    const chain: string[] = [sessionId];
    const visited = new Set<string>([sessionId]);
    let current = sessionId;

    // Walk up the ancestry chain via parent_session_id
    for (let depth = 0; depth < 20; depth++) {
      const parentResult = await pool.query<{ parent_session_id: string | null }>(
        `SELECT parent_session_id FROM security_events
         WHERE session_id = $1 AND parent_session_id IS NOT NULL
         LIMIT 1`,
        [current],
      );
      const parentId = parentResult.rows[0]?.parent_session_id ?? null;
      if (!parentId || visited.has(parentId)) break;
      visited.add(parentId);
      chain.push(parentId);
      current = parentId;
    }

    // Fetch all events across the session chain
    const eventsResult = await pool.query<EventWithLineage>(
      `SELECT id, severity, source, event_type, description, metadata,
              ip_address, session_id, parent_session_id, root_session_id,
              instance_id, mitigated, created_at, acknowledged, acknowledged_at, acknowledged_note
       FROM security_events
       WHERE session_id = ANY($1::text[])
       ORDER BY created_at ASC`,
      [chain],
    );

    // Find sessions that continue from the requested session (children)
    const childrenResult = await pool.query<{ session_id: string }>(
      `SELECT DISTINCT session_id FROM security_events
       WHERE parent_session_id = $1 AND session_id IS NOT NULL`,
      [sessionId],
    );
    const children = childrenResult.rows
      .map((r) => r.session_id)
      .filter((s) => !visited.has(s));

    res.json({
      sessionId,
      chain,
      children,
      events: eventsResult.rows.map(serializeEvent),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:incidents] lineage failed:', msg);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/incidents/:sessionId/events
// Returns all events for a single session with its lineage context fields.
incidentsRouter.get('/:sessionId/events', async (req: Request, res: Response): Promise<void> => {
  const sessionId = String(req.params['sessionId'] ?? '');
  if (!sessionId || sessionId.length > 200) {
    res.status(400).json({ error: 'Invalid session id' });
    return;
  }

  try {
    const result = await pool.query<EventWithLineage>(
      `SELECT id, severity, source, event_type, description, metadata,
              ip_address, session_id, parent_session_id, root_session_id,
              instance_id, mitigated, created_at, acknowledged, acknowledged_at, acknowledged_note
       FROM security_events
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [sessionId],
    );

    const firstRow = result.rows[0];
    res.json({
      sessionId,
      parentSessionId: firstRow?.parent_session_id ?? null,
      rootSessionId: firstRow?.root_session_id ?? null,
      events: result.rows.map(serializeEvent),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:incidents] session events failed:', msg);
    res.status(500).json({ error: 'Database error' });
  }
});
