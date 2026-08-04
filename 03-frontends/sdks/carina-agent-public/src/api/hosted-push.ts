import express, { type Express, type Request, type Response } from 'express';
import { pool } from '../memory/db.js';
import { getUserProfile } from './hosted-auth.js';
import { checkScoutAlertsAndPush } from '../notifications/mobile-push.js';

const VALID_PLATFORMS = new Set(['ios', 'android']);

export function mountHostedPushRoutes(app: Express): void {
  const router = express.Router();
  router.use(express.json());

  router.post('/register', async (req: Request, res: Response) => {
    const accountId = req.session?.hostedAccountId;
    if (!accountId) {
      res.status(401).json({ error: 'Not signed in' });
      return;
    }

    const token = String(req.body?.token ?? '').trim();
    const platform = String(req.body?.platform ?? '').trim().toLowerCase();
    const taskAlerts = req.body?.taskAlerts !== false;
    const scoutAlerts = req.body?.scoutAlerts !== false;

    if (!token.startsWith('ExponentPushToken[')) {
      res.status(400).json({ error: 'Invalid Expo push token' });
      return;
    }
    if (!VALID_PLATFORMS.has(platform)) {
      res.status(400).json({ error: 'platform must be ios or android' });
      return;
    }

    await pool.query(
      `INSERT INTO mobile_push_tokens
         (tenant_id, expo_push_token, platform, task_alerts, scout_alerts, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (tenant_id, expo_push_token)
       DO UPDATE SET
         platform = EXCLUDED.platform,
         task_alerts = EXCLUDED.task_alerts,
         scout_alerts = EXCLUDED.scout_alerts,
         updated_at = NOW()`,
      [accountId, token, platform, taskAlerts, scoutAlerts],
    );

    if (scoutAlerts) {
      void checkScoutAlertsAndPush(accountId);
    }

    res.json({ ok: true });
  });

  router.delete('/unregister', async (req: Request, res: Response) => {
    const accountId = req.session?.hostedAccountId;
    if (!accountId) {
      res.status(401).json({ error: 'Not signed in' });
      return;
    }

    const token = String(req.body?.token ?? '').trim();
    if (!token) {
      res.status(400).json({ error: 'token is required' });
      return;
    }

    await pool.query(
      'DELETE FROM mobile_push_tokens WHERE tenant_id = $1 AND expo_push_token = $2',
      [accountId, token],
    );
    res.json({ ok: true });
  });

  router.get('/status', async (req: Request, res: Response) => {
    const accountId = req.session?.hostedAccountId;
    if (!accountId) {
      res.status(401).json({ error: 'Not signed in' });
      return;
    }

    const profile = await getUserProfile(accountId);
    if (!profile) {
      res.status(401).json({ error: 'Account not found' });
      return;
    }

    const result = await pool.query(
      `SELECT COUNT(*)::int AS count,
              BOOL_OR(task_alerts) AS task_alerts,
              BOOL_OR(scout_alerts) AS scout_alerts
       FROM mobile_push_tokens
       WHERE tenant_id = $1`,
      [accountId],
    );
    const row = result.rows[0] ?? {};
    res.json({
      registered: Number(row.count ?? 0) > 0,
      tokenCount: Number(row.count ?? 0),
      taskAlerts: Boolean(row.task_alerts),
      scoutAlerts: Boolean(row.scout_alerts),
    });
  });

  app.use('/app/auth/push', router);
}
