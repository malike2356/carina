import { randomUUID } from 'node:crypto';
import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import { getRedis } from '../redis.js';
import { baselineLearner } from '../security/anomaly-detector.js';
import { alertDispatcher, toSecurityEvent } from '../alerts/dispatcher.js';
import { alertChannelsRouter } from './alert-channels.js';
import { connectorsRouter } from './connectors.js';
import { requireScoutPro } from '../middleware/plan-gate.js';
import { requireOperatorKeyOnly } from '../middleware/operator-auth.js';
import { loadDispatchChannels } from '../lib/alert-channels.js';
import { broadcastEvent } from './sse.js';
import type { SecurityEventRow, Severity } from '../types.js';
import { platformSettingsRouter } from './platform-settings.js';
import {
  adminDeleteAccount,
  adminResetAccountPassword,
  adminResetApiKey,
  listAccounts,
  setAccountActive,
} from '../lib/accounts.js';
import type { RequestWithScoutAuth } from '../types/request.js';

export const adminRouter: IRouter = Router();

adminRouter.use('/alert-channels', alertChannelsRouter);
adminRouter.use('/connectors', connectorsRouter);
adminRouter.use('/platform-settings', platformSettingsRouter);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseAccountId(value: string): string | null {
  const id = value.trim();
  return UUID_RE.test(id) ? id : null;
}

adminRouter.get('/accounts', requireOperatorKeyOnly, async (_req: RequestWithScoutAuth, res: Response): Promise<void> => {
  try {
    const accounts = await listAccounts();
    res.json({ accounts });
  } catch (err) {
    console.error('[Admin] list accounts error:', err);
    res.status(500).json({ error: 'Failed to list accounts' });
  }
});

adminRouter.post('/accounts/:id/deactivate', requireOperatorKeyOnly, async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const accountId = parseAccountId(String(req.params.id ?? ''));
  if (!accountId) {
    res.status(400).json({ error: 'Invalid account id' });
    return;
  }
  try {
    const ok = await setAccountActive(accountId, false);
    if (!ok) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[Admin] deactivate account error:', err);
    res.status(500).json({ error: 'Failed to deactivate account' });
  }
});

adminRouter.post('/accounts/:id/activate', requireOperatorKeyOnly, async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const accountId = parseAccountId(String(req.params.id ?? ''));
  if (!accountId) {
    res.status(400).json({ error: 'Invalid account id' });
    return;
  }
  try {
    const ok = await setAccountActive(accountId, true);
    if (!ok) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[Admin] activate account error:', err);
    res.status(500).json({ error: 'Failed to activate account' });
  }
});

adminRouter.post('/accounts/:id/reset-password', requireOperatorKeyOnly, async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const accountId = parseAccountId(String(req.params.id ?? ''));
  if (!accountId) {
    res.status(400).json({ error: 'Invalid account id' });
    return;
  }
  try {
    const result = await adminResetAccountPassword(accountId);
    if (!result.ok) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    res.json({ ok: true, setupToken: result.setupToken });
  } catch (err) {
    console.error('[Admin] reset account password error:', err);
    res.status(500).json({ error: 'Failed to reset account password' });
  }
});

adminRouter.post('/accounts/:id/reset-api-key', requireOperatorKeyOnly, async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const accountId = parseAccountId(String(req.params.id ?? ''));
  if (!accountId) {
    res.status(400).json({ error: 'Invalid account id' });
    return;
  }
  try {
    const result = await adminResetApiKey(accountId);
    if (!result.ok) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    res.json({ ok: true, apiKey: result.plaintext, keyPrefix: result.keyPrefix });
  } catch (err) {
    console.error('[Admin] reset account api key error:', err);
    res.status(500).json({ error: 'Failed to reset API key' });
  }
});

adminRouter.post('/accounts/:id/delete', requireOperatorKeyOnly, async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const accountId = parseAccountId(String(req.params.id ?? ''));
  if (!accountId) {
    res.status(400).json({ error: 'Invalid account id' });
    return;
  }
  try {
    const result = await adminDeleteAccount(accountId);
    if (!result.ok) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    res.json({ ok: true, email: result.email });
  } catch (err) {
    console.error('[Admin] delete account error:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

const VALID_SEVERITIES: Severity[] = ['info', 'warning', 'critical', 'breach'];

adminRouter.post('/recompute-baselines', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query<{ instance_id: string }>(
      `SELECT DISTINCT instance_id FROM security_events
       WHERE instance_id IS NOT NULL
         AND created_at > NOW() - INTERVAL '7 days'`,
    );
    for (const row of result.rows) {
      if (row.instance_id) {
        await baselineLearner.computeBaselines(row.instance_id);
      }
    }
    res.json({ ok: true, instances: result.rows.length });
  } catch (err) {
    console.error('[Admin] recompute-baselines error:', err);
    res.status(500).json({ error: 'Baseline recomputation failed' });
  }
});

adminRouter.post('/alert-test', requireScoutPro, async (req: Request, res: Response): Promise<void> => {
  const rawSeverity = req.body?.severity;
  const severity: Severity = VALID_SEVERITIES.includes(rawSeverity) ? rawSeverity : 'critical';

  const rawInstanceId = req.body?.instance_id;
  const instanceId: string =
    typeof rawInstanceId === 'string' && /^[a-z0-9_-]+$/.test(rawInstanceId)
      ? rawInstanceId
      : 'test';

  const firedAt = new Date().toISOString();
  const id = randomUUID();

  let inserted: SecurityEventRow;
  try {
    const result = await pool.query<SecurityEventRow>(
      `INSERT INTO security_events
         (id, severity, source, event_type, description, metadata,
          ip_address, session_id, instance_id, mitigated)
       VALUES ($1, $2, 'labyrinth', 'alert_test', $3, $4, NULL, NULL, $5, FALSE)
       RETURNING *`,
      [
        id,
        severity,
        `Alert test fired by operator at ${firedAt}`,
        JSON.stringify({ test: true, fired_at: firedAt }),
        instanceId,
      ],
    );
    if (!result.rows[0]) {
      res.status(500).json({ error: 'DB insert returned no row' });
      return;
    }
    inserted = {
      ...result.rows[0],
      metadata: result.rows[0].metadata as Record<string, unknown>,
      created_at: new Date(result.rows[0].created_at).toISOString(),
      acknowledged: false,
      acknowledged_at: null,
      acknowledged_note: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Admin] alert-test insert failed:', msg);
    res.status(500).json({ error: 'Database error' });
    return;
  }

  const redis = getRedis();
  if (redis) {
    try {
      await redis.publish('scout:events', JSON.stringify(inserted));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[Admin] alert-test Redis publish failed (non-fatal):', msg);
    }
  }

  broadcastEvent(inserted);

  let channelsNotified = 0;
  try {
    const routed = await loadDispatchChannels(severity);
    channelsNotified = routed.length;
  } catch {
    /* non-fatal */
  }

  if (redis) {
    try {
      await redis.del(`scout:alert-dedup:${instanceId}:alert_test`);
      await redis.del(`scout:alert-throttle:${instanceId}:${severity}:alert_test`);
    } catch {
      /* non-fatal */
    }
  }

  let dispatchError: string | null = null;
  try {
    await alertDispatcher.dispatch(toSecurityEvent(inserted));
    console.info(
      `[Admin] Alert test dispatched: severity=${severity} instance=${instanceId} id=${id} channels=${channelsNotified}`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    dispatchError = msg;
    console.error('[Admin] Alert test dispatch failed:', msg);
  }

  res.json({
    ok: true,
    event_id: id,
    channels_notified: channelsNotified,
    ...(dispatchError ? { dispatch_error: dispatchError } : {}),
  });
});
