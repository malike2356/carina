import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import {
  applySurfaceRestriction,
  listSurfaceRestrictions,
  releaseSurfaceRestriction,
  type SurfaceRestriction,
} from '../security/attack-surface.js';
import { listSessionGrants } from '../security/jit-privileges.js';
import { getShieldMode } from '../security/session-shield.js';
import { broadcastEvent, refreshAndBroadcastStats } from './sse.js';
import type { SecurityEventRow } from '../types.js';

export const attackSurfaceRouter: IRouter = Router();

const VALID_RESTRICTIONS = new Set<SurfaceRestriction>([
  'shell', 'external_http', 'skill_write', 'provider_change', 'message_bridge', 'plugin',
]);

async function logSurfaceEvent(
  eventType: string,
  description: string,
  instanceId: string,
  metadata: Record<string, unknown>,
  sessionId?: string,
): Promise<void> {
  const result = await pool.query<SecurityEventRow>(
    `INSERT INTO security_events
       (severity, source, event_type, description, metadata, instance_id, session_id)
     VALUES ('warning', 'scout-api', $1, $2, $3, $4, $5)
     RETURNING *`,
    [eventType, description, JSON.stringify(metadata), instanceId, sessionId ?? null],
  );
  const inserted = result.rows[0];
  if (inserted) {
    broadcastEvent({
      ...inserted,
      metadata: typeof inserted.metadata === 'object' && inserted.metadata !== null
        ? inserted.metadata as Record<string, unknown>
        : {},
      created_at: new Date(inserted.created_at).toISOString(),
    });
    void refreshAndBroadcastStats();
  }
}

attackSurfaceRouter.post('/restrict', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    if (typeof body.instance_id !== 'string') {
      res.status(400).json({ error: 'instance_id is required' });
      return;
    }
    const restriction = typeof body.restriction === 'string'
      && VALID_RESTRICTIONS.has(body.restriction as SurfaceRestriction)
      ? body.restriction as SurfaceRestriction
      : null;
    if (!restriction) {
      res.status(400).json({ error: 'Valid restriction is required' });
      return;
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason) {
      res.status(400).json({ error: 'reason is required' });
      return;
    }

    const state = await applySurfaceRestriction({
      instanceId: body.instance_id,
      sessionId: typeof body.session_id === 'string' ? body.session_id : undefined,
      restriction,
      target: typeof body.target === 'string' ? body.target : undefined,
      reason,
      appliedBy: typeof body.applied_by === 'string' ? body.applied_by : 'operator',
      durationSeconds: typeof body.duration_seconds === 'number' ? body.duration_seconds : undefined,
    });

    await logSurfaceEvent(
      'surface_restriction_applied',
      `Restriction applied: ${restriction}`,
      body.instance_id,
      { restriction, reason: state.reason },
      state.sessionId,
    );

    res.status(201).json(state);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:surface] restrict failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});

attackSurfaceRouter.delete('/restrict', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    if (typeof body.instance_id !== 'string' || typeof body.restriction !== 'string') {
      res.status(400).json({ error: 'instance_id and restriction are required' });
      return;
    }
    const restriction = body.restriction as SurfaceRestriction;
    if (!VALID_RESTRICTIONS.has(restriction)) {
      res.status(400).json({ error: 'Invalid restriction' });
      return;
    }

    const released = await releaseSurfaceRestriction(
      body.instance_id,
      restriction,
      typeof body.session_id === 'string' ? body.session_id : undefined,
    );

    if (released) {
      await logSurfaceEvent(
        'surface_restriction_released',
        `Restriction released: ${restriction}`,
        body.instance_id,
        { restriction },
        typeof body.session_id === 'string' ? body.session_id : undefined,
      );
    }

    res.json({ ok: true, released });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:surface] release failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});

attackSurfaceRouter.get('/state/:instanceId', async (req: Request, res: Response): Promise<void> => {
  const instanceId = typeof req.params.instanceId === 'string' ? req.params.instanceId : '';
  const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id : undefined;

  if (!instanceId) {
    res.status(400).json({ error: 'instanceId is required' });
    return;
  }

  const restrictions = await listSurfaceRestrictions(instanceId, sessionId);
  const grants = sessionId ? await listSessionGrants(sessionId) : [];
  const shield = sessionId ? await getShieldMode(sessionId) : null;

  res.json({
    instanceId,
    sessionId: sessionId ?? null,
    shieldMode: shield?.mode ?? null,
    restrictions,
    activeGrants: grants,
  });
});
