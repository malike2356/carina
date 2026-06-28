import express, { type Request, type Response, type Router as ExpressRouter } from 'express';
import { isAiWorkersEnabled } from '../workers/aiva-message-handler.js';
import {
  checkPropreneurWebhookRateLimit,
  deliverPropreneurEventNotification,
  type PropreneurWebhookPayload,
  verifyPropreneurWebhookSignature,
} from '../workers/propreneur-event-webhook.js';

export const aivaPropreneurWebhookRouter: ExpressRouter = express.Router();

function webhookSecret(): string {
  return (process.env.PROPREENEUR_WEBHOOK_HMAC_SECRET ?? '').trim();
}

function isPropreneurEventWebhooksEnabled(): boolean {
  return process.env.PROPREENEUR_EVENT_WEBHOOKS === 'true';
}

aivaPropreneurWebhookRouter.post('/propreneur', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  if (!isAiWorkersEnabled()) {
    res.status(503).json({ error: 'AI workers are disabled' });
    return;
  }

  if (!isPropreneurEventWebhooksEnabled()) {
    res.status(404).json({ error: 'Propreneur event webhooks are disabled' });
    return;
  }

  const secret = webhookSecret();
  if (secret === '') {
    res.status(503).json({ error: 'PROPREENEUR_WEBHOOK_HMAC_SECRET is not configured' });
    return;
  }

  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  const signature = req.headers['x-propreneur-signature'];
  const sig = Array.isArray(signature) ? signature[0] : signature;

  if (!verifyPropreneurWebhookSignature(rawBody, sig, secret)) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  let payload: PropreneurWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as PropreneurWebhookPayload;
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  if (!payload.workerId || !payload.event || !payload.tenantSlug) {
    res.status(400).json({ error: 'workerId, event, and tenantSlug are required' });
    return;
  }

  if (!checkPropreneurWebhookRateLimit(payload.workerId)) {
    res.status(429).json({ error: 'Rate limit exceeded for worker' });
    return;
  }

  try {
    const sent = await deliverPropreneurEventNotification(payload);
    res.json({ ok: true, delivered: sent });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[propreneur-webhook] delivery failed:', message);
    res.status(500).json({ error: message });
  }
});
