import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import type { AlertSeverity } from '../alerts/types.js';
import { requireScoutPro } from '../middleware/plan-gate.js';
import {
  listAlertChannels,
  upsertAlertChannel,
  setAlertChannelEnabled,
  getPlatformDashboardUrl,
  setPlatformDashboardUrl,
  type AlertChannelType,
} from '../lib/alert-channels.js';

export const alertChannelsRouter: IRouter = Router();

const VALID_SEVERITIES: AlertSeverity[] = ['info', 'warning', 'critical', 'breach'];

function parseSeverity(value: unknown): AlertSeverity {
  return typeof value === 'string' && VALID_SEVERITIES.includes(value as AlertSeverity)
    ? (value as AlertSeverity)
    : 'warning';
}

function parseChannelType(value: string): AlertChannelType | null {
  if (value === 'telegram' || value === 'email' || value === 'slack' || value === 'whatsapp') return value;
  return null;
}

alertChannelsRouter.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const channels = await listAlertChannels();
    const dashboard_url = await getPlatformDashboardUrl();
    res.json({ channels, dashboard_url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

alertChannelsRouter.put('/platform', requireScoutPro, async (req: Request, res: Response): Promise<void> => {
  const url = typeof req.body?.dashboard_url === 'string' ? req.body.dashboard_url.trim() : '';
  if (!url.startsWith('http')) {
    res.status(400).json({ error: 'dashboard_url must start with http' });
    return;
  }
  try {
    await setPlatformDashboardUrl(url);
    res.json({ ok: true, dashboard_url: url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

alertChannelsRouter.put('/:type', async (req: Request, res: Response): Promise<void> => {
  const type = parseChannelType(String(req.params.type ?? ''));
  if (!type) {
    res.status(400).json({ error: 'type must be telegram, email, slack, or whatsapp' });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const config: Record<string, string> = {};

  if (type === 'telegram') {
    if (typeof body.chat_id === 'string') config.chat_id = body.chat_id;
    if (typeof body.bot_token === 'string') config.bot_token = body.bot_token;
  }
  if (type === 'email') {
    if (typeof body.to_address === 'string') config.to_address = body.to_address;
    if (typeof body.from_address === 'string') config.from_address = body.from_address;
    if (typeof body.resend_api_key === 'string') config.resend_api_key = body.resend_api_key;
  }
  if (type === 'slack') {
    if (typeof body.webhook_url === 'string') config.webhook_url = body.webhook_url;
  }
  if (type === 'whatsapp') {
    if (typeof body.account_sid === 'string') config.account_sid = body.account_sid;
    if (typeof body.auth_token === 'string') config.auth_token = body.auth_token;
    if (typeof body.from_number === 'string') config.from_number = body.from_number;
    if (typeof body.to_number === 'string') config.to_number = body.to_number;
  }

  try {
    const channel = await upsertAlertChannel(type, {
      severity_threshold: parseSeverity(body.severity_threshold),
      enabled: body.enabled !== false,
      config,
    });
    res.json({ ok: true, channel });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

alertChannelsRouter.post('/:type/disable', requireScoutPro, async (req: Request, res: Response): Promise<void> => {
  const type = parseChannelType(String(req.params.type ?? ''));
  if (!type) {
    res.status(400).json({ error: 'Invalid channel type' });
    return;
  }
  try {
    await setAlertChannelEnabled(type, false);
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});
