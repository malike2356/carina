import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import { getRedis } from '../redis.js';
import { publishControlMessage } from '../lib/instance-control.js';
import { broadcastEvent, refreshAndBroadcastStats } from '../api/sse.js';
import type { SecurityEventRow } from '../types.js';

export const quarantineRouter: IRouter = Router();

const VALID_TOOLS = new Set([
  'web-search',
  'file-read',
  'file-write',
  'shell-exec',
  'http-request',
  'email-send',
  'code-exec',
]);

const DEFAULT_DURATION_MINUTES = 60;
const MAX_DURATION_MINUTES = 1440;
const QUARANTINE_KEY_PREFIX = 'scout:quarantine:';

function validateInstanceId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-z0-9_-]+$/.test(id) && id.length <= 64;
}

function validateTool(tool: unknown): tool is string {
  return typeof tool === 'string' && VALID_TOOLS.has(tool);
}

function quarantineKey(instanceId: string, tool: string): string {
  return `${QUARANTINE_KEY_PREFIX}${instanceId}:${tool}`;
}

function parseDurationMinutes(raw: unknown): number {
  if (raw === undefined || raw === null) return DEFAULT_DURATION_MINUTES;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return DEFAULT_DURATION_MINUTES;
  return Math.min(MAX_DURATION_MINUTES, Math.max(1, Math.floor(raw)));
}

async function insertQuarantineEvent(
  severity: 'info' | 'warning',
  eventType: string,
  description: string,
  instanceId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const result = await pool.query<SecurityEventRow>(
    `INSERT INTO security_events
       (severity, source, event_type, description, metadata, instance_id)
     VALUES ($1, 'scout-api', $2, $3, $4, $5)
     RETURNING *`,
    [severity, eventType, description, JSON.stringify(metadata), instanceId],
  );
  const inserted = result.rows[0];
  if (!inserted) return;
  const event: SecurityEventRow = {
    ...inserted,
    metadata: typeof inserted.metadata === 'object' && inserted.metadata !== null
      ? (inserted.metadata as Record<string, unknown>)
      : {},
    created_at: new Date(inserted.created_at).toISOString(),
  };
  broadcastEvent(event);
  void refreshAndBroadcastStats();
}

quarantineRouter.post('/tools', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    if (!validateTool(body.tool)) {
      res.status(400).json({ error: 'tool must be one of the recognised tool names' });
      return;
    }
    if (!validateInstanceId(body.instance_id)) {
      res.status(400).json({ error: 'Valid instance_id is required' });
      return;
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason || reason.length > 500) {
      res.status(400).json({ error: 'reason must be a non-empty string up to 500 chars' });
      return;
    }

    const tool = body.tool;
    const instanceId = body.instance_id;
    const durationMinutes = parseDurationMinutes(body.duration_minutes);
    const durationSeconds = durationMinutes * 60;

    const redis = getRedis();
    if (!redis) {
      res.status(503).json({ error: 'Redis unavailable' });
      return;
    }

    await redis.set(quarantineKey(instanceId, tool), reason, 'EX', durationSeconds);

    await publishControlMessage({
      action: 'quarantine_tool',
      tool,
      instance_id: instanceId,
      reason,
      duration_minutes: durationMinutes,
      timestamp: new Date().toISOString(),
    });

    await insertQuarantineEvent(
      'warning',
      'tool_quarantined',
      `Tool quarantined by operator: ${tool}`,
      instanceId,
      { tool, reason, duration_minutes: durationMinutes },
    );

    const expiresAt = new Date(Date.now() + durationSeconds * 1000).toISOString();
    res.json({ ok: true, tool, instance_id: instanceId, expires_at: expiresAt });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:quarantine] POST failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});

quarantineRouter.get('/tools', async (req: Request, res: Response): Promise<void> => {
  try {
    const instanceId = req.query.instance_id;
    if (!validateInstanceId(instanceId)) {
      res.status(400).json({ error: 'Valid instance_id query param is required' });
      return;
    }

    const redis = getRedis();
    if (!redis) {
      res.json({ quarantined: [] });
      return;
    }

    // KEYS is acceptable for low-frequency operator dashboards; use SCAN at high volume.
    const pattern = `${QUARANTINE_KEY_PREFIX}${instanceId}:*`;
    const keys = await redis.keys(pattern);
    const quarantined: Array<{ tool: string; reason: string; ttl_seconds: number }> = [];

    for (const key of keys) {
      const ttl = await redis.ttl(key);
      if (ttl <= 0) continue;
      const reason = (await redis.get(key)) ?? '';
      const tool = key.slice(`${QUARANTINE_KEY_PREFIX}${instanceId}:`.length);
      if (validateTool(tool)) {
        quarantined.push({ tool, reason, ttl_seconds: ttl });
      }
    }

    res.json({ quarantined });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:quarantine] GET failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});

quarantineRouter.delete('/tools/:tool', async (req: Request, res: Response): Promise<void> => {
  try {
    const tool = req.params.tool;
    const instanceId = req.query.instance_id;
    if (!validateTool(tool)) {
      res.status(400).json({ error: 'tool must be one of the recognised tool names' });
      return;
    }
    if (!validateInstanceId(instanceId)) {
      res.status(400).json({ error: 'Valid instance_id query param is required' });
      return;
    }

    const redis = getRedis();
    if (redis) {
      await redis.del(quarantineKey(instanceId, tool));
    }

    await publishControlMessage({
      action: 'lift_quarantine',
      tool,
      instance_id: instanceId,
      timestamp: new Date().toISOString(),
    });

    await insertQuarantineEvent(
      'info',
      'tool_quarantine_lifted',
      `Quarantine lifted by operator: ${tool}`,
      instanceId,
      { tool },
    );

    res.json({ ok: true, tool, instance_id: instanceId, status: 'active' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:quarantine] DELETE failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});
