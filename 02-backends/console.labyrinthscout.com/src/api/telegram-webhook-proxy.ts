import { Router, type IRouter, type Request, type Response } from 'express';

const SCOUT_ENGINE_URL = process.env.SCOUT_ENGINE_URL?.trim()
  ?? (process.env.NODE_ENV === 'production' ? 'http://scout-engine:4455' : '');

/**
 * Public Telegram webhook intake. Forwards the raw update + Telegram secret
 * header to scout-engine (which verifies TELEGRAM_WEBHOOK_SECRET).
 */
export const telegramWebhookProxyRouter: IRouter = Router();

telegramWebhookProxyRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  if (!SCOUT_ENGINE_URL) {
    res.status(503).json({ error: 'Scout engine unavailable' });
    return;
  }

  const secret = typeof req.headers['x-telegram-bot-api-secret-token'] === 'string'
    ? req.headers['x-telegram-bot-api-secret-token']
    : '';

  try {
    const upstream = await fetch(`${SCOUT_ENGINE_URL.replace(/\/+$/, '')}/webhooks/telegram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { 'X-Telegram-Bot-Api-Secret-Token': secret } : {}),
      },
      body: JSON.stringify(req.body ?? {}),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type');
    res.status(upstream.status);
    if (contentType) res.setHeader('content-type', contentType);
    res.send(text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[scout-console] Telegram webhook proxy failed:', msg);
    res.status(502).json({ error: 'Scout engine webhook unavailable' });
  }
});
