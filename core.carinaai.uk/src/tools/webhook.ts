import type { Tool } from '../types/index.js';
import {
  createSubscription,
  listSubscriptions,
  removeSubscription,
  type WebhookEvent,
} from '../webhooks/store.js';
import { dispatchWebhook } from '../webhooks/dispatcher.js';

const VALID_EVENTS: WebhookEvent[] = [
  'process.complete',
  'cron.complete',
  'kanban.move',
  'agent.turn.complete',
];

export const webhookTool: Tool = {
  name: 'webhook',
  dangerous: true,
  description:
    'Subscribe to outbound event webhooks. Carina POSTs JSON payloads when events fire. Actions: subscribe, list, unsubscribe, test.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['subscribe', 'list', 'unsubscribe', 'test'],
      },
      url: { type: 'string', description: 'HTTPS endpoint to receive events' },
      events: {
        type: 'array',
        items: { type: 'string' },
        description: `Events: ${VALID_EVENTS.join(', ')}`,
      },
      subscription_id: { type: 'string' },
    },
    required: ['action'],
  },
  needsConfirmation: (params) => String(params.action) === 'subscribe',
  execute: async (params) => {
    const action = String(params.action ?? '');

    if (action === 'list') {
      const subs = await listSubscriptions();
      return {
        subscriptions: subs.map((s) => ({
          id: s.id,
          url: s.url,
          events: s.events,
          created_at: s.createdAt.toISOString(),
        })),
      };
    }

    if (action === 'subscribe') {
      const url = String(params.url ?? '').trim();
      if (!url) return { error: 'url is required' };
      if (!url.startsWith('https://') && !url.startsWith('http://localhost')) {
        return { error: 'url must use HTTPS (or http://localhost for dev)' };
      }

      const events = Array.isArray(params.events)
        ? (params.events as string[]).filter((e): e is WebhookEvent =>
            VALID_EVENTS.includes(e as WebhookEvent),
          )
        : VALID_EVENTS;

      if (events.length === 0) {
        return { error: `events must include at least one of: ${VALID_EVENTS.join(', ')}` };
      }

      const sub = await createSubscription(url, events);
      return {
        subscription_id: sub.id,
        url: sub.url,
        events: sub.events,
        secret: sub.secret,
        note: 'Store the secret; it is used to verify X-Carina-Signature headers.',
      };
    }

    const subId = String(params.subscription_id ?? '').trim();
    if (!subId) return { error: 'subscription_id is required' };

    if (action === 'unsubscribe') {
      const ok = await removeSubscription(subId);
      return ok
        ? { subscription_id: subId, status: 'unsubscribed' }
        : { error: 'subscription not found' };
    }

    if (action === 'test') {
      const result = await dispatchWebhook('agent.turn.complete', {
        test: true,
        subscription_id: subId,
        message: 'Carina webhook test ping',
      });
      return { subscription_id: subId, ...result };
    }

    return { error: `unknown action: ${action}` };
  },
};
