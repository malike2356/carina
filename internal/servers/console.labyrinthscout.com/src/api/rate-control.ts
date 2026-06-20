import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import { getRedis } from '../redis.js';
import { alertDispatcher } from '../alerts/dispatcher.js';

export const rateControlRouter: IRouter = Router();

const REDIS_KEY = (instanceId: string, sessionId: string) =>
  `scout:ratelimit:${instanceId}:${sessionId}`;

const MIN_CPM = 1;
const MAX_CPM = 200;
const TTL_SECONDS = 3600;

export interface RateLimitEscalation {
  violationCount: number;
  cooldownSeconds: number;
  alertSeverity: 'info' | 'warning' | 'critical' | null;
}

const localViolations = new Map<string, { count: number; expiresAt: number }>();

export async function recordRateLimitViolation(
  instanceId: string,
  sessionId: string,
): Promise<RateLimitEscalation> {
  const redis = getRedis();
  const key = `scout:rate-violations:${instanceId}:${sessionId}`;
  let violationCount: number;

  if (redis) {
    violationCount = await redis.incr(key);
    if (violationCount === 1) await redis.expire(key, 3600);
  } else {
    const now = Date.now();
    const existing = localViolations.get(key);
    const next = existing && existing.expiresAt > now ? existing.count + 1 : 1;
    localViolations.set(key, { count: next, expiresAt: now + 3600_000 });
    violationCount = next;
  }

  const escalation: RateLimitEscalation = {
    violationCount,
    cooldownSeconds: 0,
    alertSeverity: null,
  };

  if (violationCount >= 20) {
    escalation.cooldownSeconds = 1800;
    escalation.alertSeverity = violationCount === 20 ? 'critical' : null;
  } else if (violationCount >= 10) {
    escalation.cooldownSeconds = 300;
    escalation.alertSeverity = violationCount === 10 ? 'info' : null;
  } else if (violationCount >= 5) {
    escalation.cooldownSeconds = 60;
  }

  if (escalation.cooldownSeconds > 0 && redis) {
    await redis.set(
      `scout:rate-cooldown:${instanceId}:${sessionId}`,
      String(escalation.cooldownSeconds),
      'EX',
      escalation.cooldownSeconds,
    );
  }

  if (escalation.alertSeverity) {
    await alertDispatcher.dispatch({
      id: `${instanceId}:${sessionId}:${violationCount}`,
      instance_id: instanceId,
      session_id: sessionId,
      event_type: 'rate_limit_escalation',
      severity: escalation.alertSeverity,
      description: `Rate-limit violation threshold reached: ${violationCount}`,
      created_at: new Date(),
      acknowledged: false,
      acknowledged_by: null,
      acknowledged_at: null,
    });
  }

  return escalation;
}

rateControlRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  const sessionId = typeof body.session_id === 'string' ? body.session_id.trim() : '';
  const instanceId = typeof body.instance_id === 'string' ? body.instance_id.trim() : '';
  const cpm = typeof body.calls_per_minute === 'number' ? body.calls_per_minute : NaN;
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

  if (!sessionId) {
    res.status(400).json({ error: 'session_id is required' });
    return;
  }
  if (!instanceId) {
    res.status(400).json({ error: 'instance_id is required' });
    return;
  }
  if (!Number.isInteger(cpm) || cpm < MIN_CPM || cpm > MAX_CPM) {
    res.status(400).json({
      error: `calls_per_minute must be an integer between ${MIN_CPM} and ${MAX_CPM}`,
    });
    return;
  }
  if (!reason) {
    res.status(400).json({ error: 'reason is required' });
    return;
  }

  const redis = getRedis();

  try {
    if (redis) {
      await redis.set(REDIS_KEY(instanceId, sessionId), String(cpm), 'EX', TTL_SECONDS);
    }

    if (redis) {
      await redis.publish(
        'labyrinth:control',
        JSON.stringify({
          action: 'set_rate_limit',
          session_id: sessionId,
          instance_id: instanceId,
          calls_per_minute: cpm,
          reason,
        }),
      );
    }

    await pool.query(
      `INSERT INTO security_events
         (instance_id, event_type, severity, source, description, metadata, session_id)
       VALUES ($1, 'rate_limit_adjusted', 'warning', 'rate-control-api', $2, $3, $4)`,
      [
        instanceId,
        `Rate limit set to ${cpm}/min for session ${sessionId.slice(0, 8)}...: ${reason}`,
        JSON.stringify({ calls_per_minute: cpm, reason, session_id: sessionId }),
        sessionId,
      ],
    );

    res.json({ ok: true, session_id: sessionId, calls_per_minute: cpm, expires_in_minutes: 60 });
  } catch (err) {
    console.error('[rate-control] POST error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

rateControlRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const instanceId = typeof req.query.instance_id === 'string' ? req.query.instance_id.trim() : '';
  const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id.trim() : '';

  if (!instanceId || !sessionId) {
    res.status(400).json({ error: 'instance_id and session_id query parameters are required' });
    return;
  }

  try {
    const redis = getRedis();
    const stored = redis ? await redis.get(REDIS_KEY(instanceId, sessionId)) : null;

    if (stored !== null) {
      res.json({
        session_id: sessionId,
        instance_id: instanceId,
        calls_per_minute: parseInt(stored, 10),
        source: 'override',
      });
    } else {
      const defaultCpm = process.env.SCOUT_RATE_LIMIT_MINUTE
        ? parseInt(process.env.SCOUT_RATE_LIMIT_MINUTE, 10)
        : 15;
      res.json({
        session_id: sessionId,
        instance_id: instanceId,
        calls_per_minute: defaultCpm,
        source: 'default',
      });
    }
  } catch (err) {
    console.error('[rate-control] GET error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

rateControlRouter.delete('/', async (req: Request, res: Response): Promise<void> => {
  const instanceId = typeof req.query.instance_id === 'string' ? req.query.instance_id.trim() : '';
  const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id.trim() : '';

  if (!instanceId || !sessionId) {
    res.status(400).json({ error: 'instance_id and session_id query parameters are required' });
    return;
  }

  try {
    const redis = getRedis();
    if (redis) {
      await redis.del(REDIS_KEY(instanceId, sessionId));
      await redis.publish(
        'labyrinth:control',
        JSON.stringify({
          action: 'clear_rate_limit',
          session_id: sessionId,
          instance_id: instanceId,
        }),
      );
    }

    res.json({ ok: true, session_id: sessionId, instance_id: instanceId });
  } catch (err) {
    console.error('[rate-control] DELETE error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
