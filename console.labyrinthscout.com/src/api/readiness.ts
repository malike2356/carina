import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { config } from '../config/index.js';
import { pool } from '../db.js';
import { getRedis } from '../redis.js';
import { buildPublicTrustFromDb } from '../trust/build-public-trust.js';

export const readinessRouter: IRouter = Router();

function hasValue(value: string | undefined): boolean {
  return Boolean(value && !value.startsWith('change_me') && value !== 'change-me-in-production');
}

readinessRouter.get('/', async (_req: Request, res: Response): Promise<void> => {
  const checks: Array<{ id: string; ok: boolean; detail: string }> = [];

  checks.push({
    id: 'api_key',
    ok: hasValue(config.auth.apiKey),
    detail: hasValue(config.auth.apiKey) ? 'configured' : 'SCOUT_API_KEY missing or default',
  });
  checks.push({
    id: 'session_secret',
    ok: hasValue(config.auth.sessionSecret),
    detail: hasValue(config.auth.sessionSecret) ? 'configured' : 'SCOUT_SESSION_SECRET is default',
  });
  checks.push({
    id: 'trust_wallet',
    ok: hasValue(config.trust.attesterPrivateKey),
    detail: hasValue(config.trust.attesterPrivateKey)
      ? 'TRUST_ATTESTER_PRIVATE_KEY set'
      : 'wallet not configured',
  });

  try {
    await pool.query('SELECT 1');
    checks.push({ id: 'database', ok: true, detail: 'connected' });
  } catch (err) {
    checks.push({
      id: 'database',
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  const redis = getRedis();
  if (redis) {
    try {
      await redis.ping();
      checks.push({ id: 'redis', ok: true, detail: 'connected' });
    } catch (err) {
      checks.push({
        id: 'redis',
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  } else {
    checks.push({ id: 'redis', ok: false, detail: 'not connected' });
  }

  const alertChannels = [
    config.alerts.telegram.botToken && config.alerts.telegram.chatId ? 'telegram' : null,
    config.alerts.email.resendApiKey && config.alerts.email.to ? 'email' : null,
    config.alerts.slack.webhookUrl ? 'slack' : null,
    config.alerts.discord.webhookUrl ? 'discord' : null,
  ].filter(Boolean);
  checks.push({
    id: 'alert_channels',
    ok: alertChannels.length > 0,
    detail: alertChannels.length > 0 ? alertChannels.join(', ') : 'none configured',
  });

  let trustStale = true;
  let trustDetail = 'unavailable';
  try {
    const trust = await buildPublicTrustFromDb();
    trustStale = trust.data_freshness?.stale ?? false;
    trustDetail = trustStale
      ? (trust.data_freshness?.stale_reason ?? 'stale')
      : `risk ${trust.risk_score}, chain wallet ${trust.chain.wallet_configured ? 'yes' : 'no'}`;
  } catch (err) {
    trustDetail = err instanceof Error ? err.message : String(err);
  }
  checks.push({
    id: 'trust_data',
    ok: !trustStale,
    detail: trustDetail,
  });

  const ok = checks.filter((c) => c.ok).length;
  const fail = checks.length - ok;
  res.json({
    generated_at: new Date().toISOString(),
    ready: fail === 0,
    summary: { ok, fail, total: checks.length },
    checks,
  });
});
