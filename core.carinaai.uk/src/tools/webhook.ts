import type { Tool } from '../types/index.js';
import {
  createSubscription,
  disableSubscription,
  enableSubscription,
  getSubscription,
  listSubscriptions,
  subscriptionPayload,
  updateSubscription,
  WEBHOOK_EVENTS,
  type WebhookEvent,
} from '../webhooks/store.js';
import { deliveryPayload, listDeliveries } from '../webhooks/webhook-delivery.js';
import { dispatchWebhook, retryDelivery } from '../webhooks/dispatcher.js';

export const webhookTool: Tool = {
  name: 'webhook',
  dangerous: true,
  description:
    'Manage outbound event webhooks. Carina POSTs signed JSON when events fire. Actions: subscribe, list, update, disable, enable, unsubscribe, deliveries, retry, test, trigger.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['subscribe', 'list', 'update', 'disable', 'enable', 'unsubscribe', 'deliveries', 'retry', 'test', 'trigger'],
      },
      url: { type: 'string', description: 'HTTPS endpoint to receive events' },
      events: {
        type: 'array',
        items: { type: 'string' },
        description: `Events: ${WEBHOOK_EVENTS.join(', ')}`,
      },
      subscription_id: { type: 'string' },
      delivery_id: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      max_attempts: { type: 'number' },
      event: { type: 'string', description: 'For trigger: event name' },
      data: { type: 'object', description: 'For trigger: event payload' },
      status: { type: 'string', description: 'Filter deliveries by status' },
    },
    required: ['action'],
  },
  needsConfirmation: (params) => ['subscribe', 'trigger'].includes(String(params.action)),
  execute: async (params) => {
    const action = String(params.action ?? '');

    if (action === 'list') {
      const subs = await listSubscriptions(true);
      return { subscriptions: subs.map((s) => subscriptionPayload(s)) };
    }

    if (action === 'deliveries') {
      const deliveries = await listDeliveries({
        subscriptionId: params.subscription_id ? String(params.subscription_id) : undefined,
        status: params.status ? String(params.status) as 'pending' | 'delivered' | 'failed' | 'retrying' : undefined,
        limit: 50,
      });
      return { deliveries: deliveries.map(deliveryPayload) };
    }

    if (action === 'subscribe') {
      const url = String(params.url ?? '').trim();
      if (!url) return { error: 'url is required' };
      if (!url.startsWith('https://') && !url.startsWith('http://localhost')) {
        return { error: 'url must use HTTPS (or http://localhost for dev)' };
      }

      const events = Array.isArray(params.events)
        ? (params.events as string[]).filter((e): e is WebhookEvent =>
            (WEBHOOK_EVENTS as readonly string[]).includes(e),
          )
        : [...WEBHOOK_EVENTS];

      if (events.length === 0) {
        return { error: `events must include at least one of: ${WEBHOOK_EVENTS.join(', ')}` };
      }

      const sub = await createSubscription(url, events, {
        name: params.name ? String(params.name) : undefined,
        description: params.description ? String(params.description) : undefined,
        maxAttempts: params.max_attempts != null ? Number(params.max_attempts) : undefined,
      });
      return {
        subscription: subscriptionPayload(sub, true),
        note: 'Store the secret; verify X-Carina-Signature on received payloads.',
      };
    }

    const subId = String(params.subscription_id ?? '').trim();

    if (action === 'update') {
      if (!subId) return { error: 'subscription_id is required' };
      const events = Array.isArray(params.events)
        ? (params.events as string[]).filter((e): e is WebhookEvent =>
            (WEBHOOK_EVENTS as readonly string[]).includes(e),
          )
        : undefined;
      const sub = await updateSubscription(subId, {
        url: params.url ? String(params.url) : undefined,
        events,
        name: params.name !== undefined ? String(params.name) : undefined,
        description: params.description !== undefined ? String(params.description) : undefined,
        maxAttempts: params.max_attempts != null ? Number(params.max_attempts) : undefined,
      });
      return sub ? { subscription: subscriptionPayload(sub) } : { error: 'subscription not found' };
    }

    if (action === 'disable') {
      if (!subId) return { error: 'subscription_id is required' };
      const ok = await disableSubscription(subId);
      return ok ? { subscription_id: subId, disabled: true } : { error: 'subscription not found' };
    }

    if (action === 'enable') {
      if (!subId) return { error: 'subscription_id is required' };
      const ok = await enableSubscription(subId);
      return ok ? { subscription_id: subId, enabled: true } : { error: 'subscription not found' };
    }

    if (action === 'unsubscribe') {
      if (!subId) return { error: 'subscription_id is required' };
      const ok = await disableSubscription(subId);
      return ok ? { subscription_id: subId, status: 'unsubscribed' } : { error: 'subscription not found' };
    }

    if (action === 'retry') {
      const deliveryId = String(params.delivery_id ?? '').trim();
      if (!deliveryId) return { error: 'delivery_id is required' };
      return retryDelivery(deliveryId);
    }

    if (action === 'test') {
      if (!subId) return { error: 'subscription_id is required' };
      const sub = await getSubscription(subId);
      if (!sub) return { error: 'subscription not found' };
      const result = await dispatchWebhook('agent.turn.complete', {
        test: true,
        subscription_id: subId,
        message: 'Carina webhook test ping',
      });
      return { subscription_id: subId, ...result };
    }

    if (action === 'trigger') {
      const event = String(params.event ?? '') as WebhookEvent;
      if (!(WEBHOOK_EVENTS as readonly string[]).includes(event)) {
        return { error: `event must be one of: ${WEBHOOK_EVENTS.join(', ')}` };
      }
      const data = params.data && typeof params.data === 'object'
        ? params.data as Record<string, unknown>
        : {};
      return dispatchWebhook(event, data);
    }

    return { error: `unknown action: ${action}` };
  },
};
