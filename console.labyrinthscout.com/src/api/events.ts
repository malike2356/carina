import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import { getRedis } from '../redis.js';
import { alertDispatcher, toSecurityEvent } from '../alerts/dispatcher.js';
import { anomalyDetector } from '../security/anomaly-detector.js';
import type { SessionMetrics } from '../security/anomaly-detector.js';
import type { IncomingEventPayload, SecurityEventRow, Severity } from '../types.js';

export const eventsRouter: IRouter = Router();

const SEVERITIES: Severity[] = ['info', 'warning', 'critical', 'breach'];

function parseMetadata(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function serializeRow(row: SecurityEventRow): SecurityEventRow {
  return {
    ...row,
    metadata: parseMetadata(row.metadata),
    created_at: new Date(row.created_at).toISOString(),
    acknowledged: row.acknowledged ?? false,
    acknowledged_at: row.acknowledged_at ? new Date(row.acknowledged_at).toISOString() : null,
    acknowledged_note: row.acknowledged_note ?? null,
  };
}

function validatePayload(body: unknown): { ok: true; data: IncomingEventPayload } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Body must be a JSON object' };
  }
  const b = body as Record<string, unknown>;

  if (!SEVERITIES.includes(b.severity as Severity)) {
    return { ok: false, error: 'severity must be info, warning, critical, or breach' };
  }
  if (typeof b.source !== 'string' || !b.source.trim() || b.source.length > 100) {
    return { ok: false, error: 'source must be a non-empty string up to 100 chars' };
  }
  if (typeof b.event_type !== 'string' || !b.event_type.trim() || b.event_type.length > 100) {
    return { ok: false, error: 'event_type must be a non-empty string up to 100 chars' };
  }
  if (!/^[a-z0-9_]+$/.test(b.event_type)) {
    return { ok: false, error: 'event_type must match /^[a-z0-9_]+$/' };
  }
  if (typeof b.description !== 'string' || !b.description.trim() || b.description.length > 1000) {
    return { ok: false, error: 'description must be a non-empty string up to 1000 chars' };
  }
  if (b.metadata !== undefined) {
    if (!b.metadata || typeof b.metadata !== 'object' || Array.isArray(b.metadata)) {
      return { ok: false, error: 'metadata must be a plain object' };
    }
  }
  if (b.instance_id !== undefined) {
    if (typeof b.instance_id !== 'string' || !/^[a-z0-9_\-]+$/.test(b.instance_id) || b.instance_id.length > 64) {
      return { ok: false, error: 'instance_id must match /^[a-z0-9_\\-]+$/ and be max 64 chars' };
    }
  }

  return {
    ok: true,
    data: {
      severity: b.severity as Severity,
      source: b.source.trim(),
      event_type: b.event_type.trim(),
      description: b.description.trim(),
      metadata: (b.metadata as Record<string, unknown> | undefined) ?? {},
      ip_address: typeof b.ip_address === 'string' ? b.ip_address : undefined,
      session_id: typeof b.session_id === 'string' ? b.session_id : undefined,
      instance_id: typeof b.instance_id === 'string' ? b.instance_id : undefined,
    },
  };
}

async function handleSessionMetrics(row: SecurityEventRow): Promise<void> {
  const instanceId = row.instance_id;
  const sessionId = row.session_id;
  if (!instanceId || !sessionId) return;

  let metrics: Partial<SessionMetrics>;
  try {
    metrics = JSON.parse(row.description) as Partial<SessionMetrics>;
  } catch {
    return;
  }

  await anomalyDetector.detect(instanceId, sessionId, metrics);
}

eventsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);
  const accountId = req.scoutAuth?.kind === 'account' ? req.scoutAuth.accountId : null;
  try {
    const result = await pool.query<SecurityEventRow>(
      accountId
        ? `SELECT e.id, e.severity, e.source, e.event_type, e.description, e.metadata,
                  e.ip_address, e.session_id, e.instance_id, e.mitigated, e.created_at,
                  e.acknowledged, e.acknowledged_at, e.acknowledged_note
           FROM security_events e
           JOIN carina_instances i ON i.id = e.instance_id
           WHERE i.account_id = $1
           ORDER BY e.created_at DESC
           LIMIT $2`
        : `SELECT id, severity, source, event_type, description, metadata,
                  ip_address, session_id, instance_id, mitigated, created_at,
                  acknowledged, acknowledged_at, acknowledged_note
           FROM security_events
           ORDER BY created_at DESC
           LIMIT $1`,
      accountId ? [accountId, limit] : [limit],
    );
    res.json({ events: result.rows.map(serializeRow) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:events] List failed:', msg);
    res.status(500).json({ error: 'Database error' });
  }
});

eventsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const validated = validatePayload(req.body);
  if (!validated.ok) {
    res.status(400).json({ error: validated.error });
    return;
  }

  const payload = validated.data;
  const ip = req.ip ?? null;

  try {
    const result = await pool.query<SecurityEventRow>(
      `INSERT INTO security_events
        (severity, source, event_type, description, metadata, ip_address, session_id, instance_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        payload.severity,
        payload.source,
        payload.event_type,
        payload.description,
        JSON.stringify(payload.metadata ?? {}),
        ip,
        payload.session_id ?? null,
        payload.instance_id ?? null,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      res.status(500).json({ error: 'Database error' });
      return;
    }

    const inserted = serializeRow(row);

    const redis = getRedis();
    if (redis) {
      try {
        await redis.publish('scout:events', JSON.stringify(inserted));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[scout:events] Redis publish failed:', msg);
      }
    }

    if (inserted.event_type !== 'session_metrics') {
      void alertDispatcher.dispatch(toSecurityEvent(inserted)).catch((err) => {
        console.error('[events] Alert dispatch error:', err);
      });
    }

    if (inserted.event_type === 'session_metrics') {
      void handleSessionMetrics(inserted).catch((err) => {
        console.error('[events] Anomaly detection error:', err);
      });
    }

    res.status(201).json({ ok: true, id: inserted.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:events] Insert failed:', msg);
    res.status(500).json({ error: 'Database error' });
  }
});

eventsRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params['id'] ?? '');
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    res.status(400).json({ error: 'Invalid event id' });
    return;
  }
  try {
    const result = await pool.query<SecurityEventRow>(
      `SELECT id, severity, source, event_type, description, metadata,
              ip_address, session_id, instance_id, mitigated, created_at,
              acknowledged, acknowledged_at, acknowledged_note
       FROM security_events
       WHERE id = $1`,
      [id],
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    res.json({ event: serializeRow(result.rows[0]) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:events] GET /:id failed:', msg);
    res.status(500).json({ error: 'Database error' });
  }
});

eventsRouter.post('/:id/acknowledge', async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params['id'] ?? '');
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    res.status(400).json({ error: 'Invalid event id' });
    return;
  }

  const note =
    typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 500) : null;

  try {
    const result = await pool.query<
      Pick<SecurityEventRow, 'id' | 'instance_id' | 'event_type' | 'acknowledged_at'>
    >(
      `UPDATE security_events
       SET acknowledged      = TRUE,
           acknowledged_at   = NOW(),
           acknowledged_note = $2
       WHERE id = $1
         AND acknowledged = FALSE
       RETURNING id, instance_id, event_type, acknowledged_at`,
      [id, note],
    );

    if (!result.rows[0]) {
      const existing = await pool.query<
        Pick<SecurityEventRow, 'id' | 'acknowledged' | 'acknowledged_at'>
      >(
        `SELECT id, acknowledged, acknowledged_at FROM security_events WHERE id = $1`,
        [id],
      );
      if (!existing.rows[0]) {
        res.status(404).json({ error: 'Event not found' });
        return;
      }
      res.json({
        ok: true,
        id,
        acknowledged_at: existing.rows[0].acknowledged_at,
        already: true,
      });
      return;
    }

    const row = result.rows[0];
    const redis = getRedis();
    if (redis && row.instance_id && row.event_type) {
      const dedupKey = `scout:alert-dedup:${row.instance_id}:${row.event_type}`;
      try {
        await redis.del(dedupKey);
        console.info(`[scout:events] Dedup key cleared after ack: ${dedupKey}`);
      } catch (redisErr) {
        const msg = redisErr instanceof Error ? redisErr.message : String(redisErr);
        console.warn('[scout:events] Redis DEL failed (non-fatal):', msg);
      }
    }

    res.json({ ok: true, id: row.id, acknowledged_at: row.acknowledged_at });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:events] acknowledge failed:', msg);
    res.status(500).json({ error: 'Database error' });
  }
});
