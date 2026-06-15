import { Router, type NextFunction, type Request, type Response, type Router as ExpressRouter } from 'express';
import { isControlAuthorized } from '../infrastructure/control-auth.js';
import { WEBHOOK_EVENTS, type WebhookEvent } from '../webhooks/webhook-types.js';
import {
  createSubscription,
  disableSubscription,
  enableSubscription,
  getSubscription,
  listSubscriptions,
  subscriptionPayload,
  updateSubscription,
} from '../webhooks/store.js';
import { deliveryPayload, listDeliveries } from '../webhooks/webhook-delivery.js';
import { dispatchWebhook, retryDelivery } from '../webhooks/dispatcher.js';
import { verifyInboundTrigger } from '../webhooks/webhook-verify.js';

export const webhookApiRouter: ExpressRouter = Router();

type WebhookRequest = Request & { tenantId?: string };

function webhookAuth(req: WebhookRequest, res: Response, next: NextFunction): void {
  if (isControlAuthorized(req)) {
    req.tenantId = '__operator__';
    next();
    return;
  }
  if (req.session?.webAuthed) {
    req.tenantId = '__operator__';
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized' });
}

function parseEvents(raw: unknown): WebhookEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(String)
    .filter((e): e is WebhookEvent => (WEBHOOK_EVENTS as readonly string[]).includes(e));
}

webhookApiRouter.use(webhookAuth);

webhookApiRouter.get('/', async (req: WebhookRequest, res: Response) => {
  try {
    const includeInactive = req.query.include_inactive === 'true';
    const subs = await listSubscriptions(includeInactive);
    res.json({ subscriptions: subs.map((s) => subscriptionPayload(s)) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

webhookApiRouter.post('/', async (req: WebhookRequest, res: Response) => {
  try {
    const url = String(req.body?.url ?? '').trim();
    if (!url) {
      res.status(400).json({ error: 'url is required' });
      return;
    }
    if (!url.startsWith('https://') && !url.startsWith('http://localhost')) {
      res.status(400).json({ error: 'url must use HTTPS (or http://localhost for dev)' });
      return;
    }
    const events = parseEvents(req.body?.events);
    if (events.length === 0) {
      res.status(400).json({ error: `events must include at least one of: ${WEBHOOK_EVENTS.join(', ')}` });
      return;
    }
    const sub = await createSubscription(url, events, {
      name: req.body?.name ? String(req.body.name) : undefined,
      description: req.body?.description ? String(req.body.description) : undefined,
      maxAttempts: req.body?.max_attempts != null ? Number(req.body.max_attempts) : undefined,
    });
    res.status(201).json({ subscription: subscriptionPayload(sub, true) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

webhookApiRouter.get('/deliveries', async (req: WebhookRequest, res: Response) => {
  try {
    const limit = Math.min(200, Number(req.query.limit) || 50);
    const status = req.query.status ? String(req.query.status) : undefined;
    const subscriptionId = req.query.subscription_id ? String(req.query.subscription_id) : undefined;
    const deliveries = await listDeliveries({
      subscriptionId,
      status: status as 'pending' | 'delivered' | 'failed' | 'retrying' | undefined,
      limit,
    });
    res.json({ deliveries: deliveries.map(deliveryPayload) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

webhookApiRouter.post('/trigger', async (req: WebhookRequest, res: Response) => {
  const rawBody = JSON.stringify(req.body ?? {});
  if (!verifyInboundTrigger(req, rawBody)) {
    res.status(401).json({ error: 'Unauthorized trigger; use operator session or X-Carina-Inbound-Signature' });
    return;
  }
  try {
    const event = String(req.body?.event ?? '') as WebhookEvent;
    if (!(WEBHOOK_EVENTS as readonly string[]).includes(event)) {
      res.status(400).json({ error: `Invalid event. Must be one of: ${WEBHOOK_EVENTS.join(', ')}` });
      return;
    }
    const data = req.body?.data && typeof req.body.data === 'object'
      ? req.body.data as Record<string, unknown>
      : {};
    const result = await dispatchWebhook(event, data);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

webhookApiRouter.get('/:id', async (req: WebhookRequest, res: Response) => {
  try {
    const sub = await getSubscription(String(req.params.id));
    if (!sub) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }
    res.json({ subscription: subscriptionPayload(sub) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

webhookApiRouter.patch('/:id', async (req: WebhookRequest, res: Response) => {
  try {
    const events = req.body?.events ? parseEvents(req.body.events) : undefined;
    if (req.body?.events && events?.length === 0) {
      res.status(400).json({ error: 'events cannot be empty' });
      return;
    }
    const sub = await updateSubscription(String(req.params.id), {
      url: req.body?.url ? String(req.body.url) : undefined,
      events,
      name: req.body?.name !== undefined ? String(req.body.name) : undefined,
      description: req.body?.description !== undefined ? String(req.body.description) : undefined,
      maxAttempts: req.body?.max_attempts != null ? Number(req.body.max_attempts) : undefined,
    });
    if (!sub) {
      res.status(404).json({ error: 'Subscription not found or disabled' });
      return;
    }
    res.json({ subscription: subscriptionPayload(sub) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

webhookApiRouter.post('/:id/disable', async (req: WebhookRequest, res: Response) => {
  try {
    const ok = await disableSubscription(String(req.params.id));
    res.json({ subscription_id: req.params.id, disabled: ok });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

webhookApiRouter.post('/:id/enable', async (req: WebhookRequest, res: Response) => {
  try {
    const ok = await enableSubscription(String(req.params.id));
    res.json({ subscription_id: req.params.id, enabled: ok });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

webhookApiRouter.get('/:id/deliveries', async (req: WebhookRequest, res: Response) => {
  try {
    const limit = Math.min(200, Number(req.query.limit) || 50);
    const deliveries = await listDeliveries({
      subscriptionId: String(req.params.id),
      limit,
    });
    res.json({ deliveries: deliveries.map(deliveryPayload) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

webhookApiRouter.post('/deliveries/:deliveryId/retry', async (req: WebhookRequest, res: Response) => {
  try {
    const result = await retryDelivery(String(req.params.deliveryId));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
