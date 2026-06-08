import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import {
  honeypotManager,
  serializeHoneypot,
} from '../security/honeypot-manager.js';

export const honeypotsRouter: IRouter = Router();

type KeyType = 'openai' | 'anthropic' | 'deepseek';

async function logHoneypotDeployed(
  instanceId: string,
  type: string,
  keyType: string | null,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO security_events
         (instance_id, event_type, severity, source, description, metadata)
       VALUES ($1, 'honeypot_deployed', 'info', 'honeypot-api', $2, $3)`,
      [
        instanceId,
        `Honeypot deployed: ${type} for ${instanceId}`,
        JSON.stringify({ type, instanceId, keyType: keyType ?? null }),
      ],
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[Honeypots] Failed to log deploy event:', msg);
  }
}

honeypotsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const instanceId = typeof req.query.instance_id === 'string' ? req.query.instance_id.trim() : '';
  if (!instanceId) {
    res.status(400).json({ error: 'instance_id query parameter is required' });
    return;
  }

  try {
    const honeypots = await honeypotManager.listHoneypots(instanceId);
    res.json({ honeypots: honeypots.map(serializeHoneypot) });
  } catch (err) {
    console.error('[Honeypots] list error:', err);
    res.status(500).json({ error: 'Failed to list honeypots' });
  }
});

honeypotsRouter.post('/rotate', async (req: Request, res: Response): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  const instanceId =
    typeof body?.instance_id === 'string' ? body.instance_id.trim() :
    typeof body?.instanceId === 'string' ? body.instanceId.trim() :
    typeof req.query.instance_id === 'string' ? req.query.instance_id.trim() : '';

  if (!instanceId) {
    res.status(400).json({ error: 'instance_id is required' });
    return;
  }

  try {
    const honeypots = await honeypotManager.rotate(instanceId);
    await logHoneypotDeployed(instanceId, 'rotate', null);
    res.status(201).json({ honeypots: honeypots.map(serializeHoneypot) });
  } catch (err) {
    console.error('[Honeypots] rotate error:', err);
    res.status(500).json({ error: 'Failed to rotate honeypots' });
  }
});

honeypotsRouter.get('/active', async (req: Request, res: Response): Promise<void> => {
  const instanceId = typeof req.query.instance_id === 'string' ? req.query.instance_id.trim() : '';
  if (!instanceId) {
    res.status(400).json({ error: 'instance_id query parameter is required' });
    return;
  }

  try {
    const honeypots = await honeypotManager.listActive(instanceId);
    res.json({ honeypots: honeypots.map(serializeHoneypot) });
  } catch (err) {
    console.error('[Honeypots] active error:', err);
    res.status(500).json({ error: 'Failed to list active honeypots' });
  }
});

honeypotsRouter.get('/summary', async (req: Request, res: Response): Promise<void> => {
  const instanceId = typeof req.query.instance_id === 'string' ? req.query.instance_id.trim() : '';
  if (!instanceId) {
    res.status(400).json({ error: 'instance_id query parameter is required' });
    return;
  }

  try {
    const result = await pool.query<{
      total: string;
      triggered: string;
      untriggered: string;
      type: string | null;
      type_count: string;
    }>(
      `SELECT
         COUNT(*)                                  AS total,
         COUNT(*) FILTER (WHERE triggered = TRUE)  AS triggered,
         COUNT(*) FILTER (WHERE triggered = FALSE) AS untriggered,
         type,
         COUNT(*) FILTER (WHERE TRUE)              AS type_count
       FROM honeypots
       WHERE instance_id = $1
       GROUP BY ROLLUP (type)`,
      [instanceId],
    );

    const summary = {
      total: 0,
      triggered: 0,
      untriggered: 0,
      by_type: {} as Record<string, number>,
    };

    for (const row of result.rows) {
      if (row.type === null) {
        summary.total = parseInt(row.total, 10);
        summary.triggered = parseInt(row.triggered, 10);
        summary.untriggered = parseInt(row.untriggered, 10);
      } else {
        summary.by_type[row.type] = parseInt(row.type_count, 10);
      }
    }

    res.json(summary);
  } catch (err) {
    console.error('[Honeypots] summary error:', err);
    res.status(500).json({ error: 'Failed to fetch honeypot summary' });
  }
});

honeypotsRouter.post('/check/key', async (req: Request, res: Response): Promise<void> => {
  const key = typeof req.body?.key === 'string' ? req.body.key : '';
  if (!key) {
    res.status(400).json({ error: 'key is required' });
    return;
  }

  const meta =
    req.body?.meta && typeof req.body.meta === 'object' && !Array.isArray(req.body.meta)
      ? (req.body.meta as Record<string, unknown>)
      : {};

  try {
    const matched = await honeypotManager.checkApiKey(key, meta);
    res.json({ matched });
  } catch (err) {
    console.error('[Honeypots] check/key error:', err);
    res.status(500).json({ error: 'Honeypot key check failed' });
  }
});

honeypotsRouter.post('/check/path', async (req: Request, res: Response): Promise<void> => {
  const filePath = typeof req.body?.path === 'string' ? req.body.path : '';
  if (!filePath) {
    res.status(400).json({ error: 'path is required' });
    return;
  }

  const meta =
    req.body?.meta && typeof req.body.meta === 'object' && !Array.isArray(req.body.meta)
      ? (req.body.meta as Record<string, unknown>)
      : {};

  try {
    const matched = await honeypotManager.checkFilePath(filePath, meta);
    res.json({ matched });
  } catch (err) {
    console.error('[Honeypots] check/path error:', err);
    res.status(500).json({ error: 'Honeypot path check failed' });
  }
});

honeypotsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  const type = body.type;
  const instanceId =
    typeof body.instance_id === 'string' ? body.instance_id.trim() :
    typeof body.instanceId === 'string' ? body.instanceId.trim() : '';

  if (!instanceId) {
    res.status(400).json({ error: 'instance_id is required' });
    return;
  }

  if (type === 'api_key') {
    const rawKeyType = body.key_type ?? body.keyType;
    if (rawKeyType !== 'openai' && rawKeyType !== 'anthropic' && rawKeyType !== 'deepseek') {
      res.status(400).json({ error: 'key_type must be openai, anthropic, or deepseek' });
      return;
    }
    const keyType = rawKeyType as KeyType;

    try {
      const honeypot = await honeypotManager.deployApiKeyHoneypot(instanceId, keyType);
      await logHoneypotDeployed(instanceId, 'api_key', keyType);
      res.status(201).json({ honeypot: serializeHoneypot(honeypot) });
    } catch (err) {
      console.error('[Honeypots] deploy api_key error:', err);
      res.status(500).json({ error: 'Failed to deploy API key honeypot' });
    }
    return;
  }

  if (type === 'file') {
    try {
      const honeypots = await honeypotManager.deployFileHoneypots(instanceId);
      await logHoneypotDeployed(instanceId, 'file', null);
      res.status(201).json({ honeypots: honeypots.map(serializeHoneypot) });
    } catch (err) {
      console.error('[Honeypots] deploy file error:', err);
      res.status(500).json({ error: 'Failed to deploy file honeypots' });
    }
    return;
  }

  res.status(400).json({ error: 'Invalid type. Must be api_key or file.' });
});

honeypotsRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  if (!id) {
    res.status(400).json({ error: 'Invalid honeypot id' });
    return;
  }

  try {
    const honeypot = await honeypotManager.getHoneypot(id);
    if (!honeypot) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ honeypot: serializeHoneypot(honeypot) });
  } catch (err) {
    console.error('[Honeypots] get by id error:', err);
    res.status(500).json({ error: 'Failed to fetch honeypot' });
  }
});
