import {
  getSubscriptionsForEvent,
  signPayload,
  type WebhookEvent,
} from './store.js';

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

export async function dispatchWebhook(
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<{ delivered: number; failed: number }> {
  const subs = await getSubscriptionsForEvent(event);
  if (subs.length === 0) return { delivered: 0, failed: 0 };

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };
  const body = JSON.stringify(payload);

  let delivered = 0;
  let failed = 0;

  await Promise.all(subs.map(async (sub) => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Carina-Webhook/0.1',
        'X-Carina-Event': event,
      };
      if (sub.secret) {
        headers['X-Carina-Signature'] = signPayload(sub.secret, body);
      }

      const response = await fetch(sub.url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) delivered++;
      else failed++;
    } catch {
      failed++;
    }
  }));

  return { delivered, failed };
}
