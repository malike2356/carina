import {
  getSubscription,
  getSubscriptionsForEvent,
  signPayload,
  type WebhookEvent,
} from './store.js';
import type { WebhookPayload } from './webhook-types.js';
import {
  computeNextRetry,
  createDelivery,
  listDueRetries,
  recordDeliveryAttempt,
  resetDeliveryForRetry,
} from './webhook-delivery.js';
import { retryAsync, RetryError } from '../infrastructure/retry.js';
import { httpRetryError, httpRetryPolicy, shouldRetryHttpError } from '../infrastructure/retry-policy.js';

export type { WebhookPayload } from './webhook-types.js';

const INLINE_ATTEMPTS = 2;

async function postToEndpoint(
  url: string,
  body: string,
  event: WebhookEvent,
  secret: string | null,
  attempts = INLINE_ATTEMPTS,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    return await retryAsync(async () => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Carina-Webhook/1.0',
        'X-Carina-Event': event,
      };
      if (secret) {
        headers['X-Carina-Signature'] = signPayload(secret, body);
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(15_000),
      });

      if (response.ok) {
        return { ok: true, status: response.status };
      }

      const err = httpRetryError({
        status: response.status,
        message: `HTTP ${response.status}`,
        retryAfterHeader: response.headers.get('Retry-After'),
      });
      if (!shouldRetryHttpError(err)) {
        return { ok: false, status: response.status, error: err.message };
      }
      throw err;
    }, httpRetryPolicy({ attempts }));
  } catch (err) {
    const last = err instanceof RetryError ? err.lastError : err;
    if (last && typeof last === 'object' && 'kind' in last && (last as { kind: string }).kind === 'http') {
      const httpErr = last as unknown as { status?: number; message: string };
      return { ok: false, status: httpErr.status, error: httpErr.message };
    }
    const msg = last instanceof Error ? last.message : String(last ?? err);
    return { ok: false, error: msg };
  }
}

export async function deliverToSubscription(
  subscriptionId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
  existingDeliveryId?: string,
): Promise<{ deliveryId: string; delivered: boolean }> {
  const sub = await getSubscription(subscriptionId);
  if (!sub || !sub.active) {
    throw new Error('Subscription not found or disabled');
  }

  let delivery = existingDeliveryId
    ? await import('./webhook-delivery.js').then((m) => m.getDelivery(existingDeliveryId))
    : null;

  let payloadEnvelope: WebhookPayload;
  if (delivery) {
    const stored = delivery.payload as unknown as WebhookPayload;
    payloadEnvelope = stored.event
      ? { ...stored, timestamp: new Date().toISOString() }
      : { event: delivery.event, timestamp: new Date().toISOString(), data };
  } else {
    payloadEnvelope = { event, timestamp: new Date().toISOString(), data };
    delivery = await createDelivery({
      subscriptionId: sub.id,
      event,
      payload: payloadEnvelope as unknown as Record<string, unknown>,
      maxAttempts: sub.maxAttempts,
    });
  }

  const body = JSON.stringify(payloadEnvelope);

  const result = await postToEndpoint(
    sub.url,
    body,
    event,
    sub.secret,
    existingDeliveryId ? 1 : INLINE_ATTEMPTS,
  );

  if (result.ok) {
    await recordDeliveryAttempt(delivery.id, {
      success: true,
      httpStatus: result.status,
    });
    return { deliveryId: delivery.id, delivered: true };
  }

  const updated = await recordDeliveryAttempt(delivery.id, {
    success: false,
    httpStatus: result.status,
    errorMessage: result.error ?? 'delivery failed',
    scheduleRetry: delivery.attemptCount + 1 < delivery.maxAttempts,
    nextRetryAt: delivery.attemptCount + 1 < delivery.maxAttempts
      ? computeNextRetry(delivery.attemptCount + 1)
      : undefined,
  });

  return { deliveryId: updated?.id ?? delivery.id, delivered: false };
}

export async function dispatchWebhook(
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<{ delivered: number; failed: number; delivery_ids: string[] }> {
  if (process.env.CARINA_TASKFLOWS_WEBHOOK_HOOK === 'true') {
    void import('../ops/taskflows/hooks.js').then((m) => m.onWebhookEvent(event, data));
  }

  const subs = await getSubscriptionsForEvent(event);
  if (subs.length === 0) return { delivered: 0, failed: 0, delivery_ids: [] };

  let delivered = 0;
  let failed = 0;
  const deliveryIds: string[] = [];

  await Promise.all(subs.map(async (sub) => {
    try {
      const result = await deliverToSubscription(sub.id, event, data);
      deliveryIds.push(result.deliveryId);
      if (result.delivered) delivered++;
      else failed++;
    } catch {
      failed++;
    }
  }));

  return { delivered, failed, delivery_ids: deliveryIds };
}

export async function retryDelivery(deliveryId: string): Promise<{ delivered: boolean; deliveryId: string }> {
  const delivery = await import('./webhook-delivery.js').then((m) => m.getDelivery(deliveryId));
  if (!delivery || !delivery.subscriptionId) {
    throw new Error('Delivery not found');
  }
  if (delivery.status === 'delivered') {
    return { delivered: true, deliveryId };
  }
  await resetDeliveryForRetry(deliveryId);
  const result = await deliverToSubscription(
    delivery.subscriptionId,
    delivery.event,
    delivery.payload.data as Record<string, unknown> ?? delivery.payload,
    deliveryId,
  );
  return { delivered: result.delivered, deliveryId: result.deliveryId };
}

export async function processWebhookRetries(): Promise<number> {
  const due = await listDueRetries(25);
  let processed = 0;
  for (const item of due) {
    if (!item.subscriptionId) continue;
    try {
      const sub = await getSubscription(item.subscriptionId);
      if (!sub?.active) continue;
      const stored = item.payload as unknown as WebhookPayload;
      const data = stored.data ?? {};
      await deliverToSubscription(item.subscriptionId, item.event, data, item.id);
      processed++;
    } catch {
      // skip failed retry sweep entries
    }
  }
  return processed;
}

let retryInterval: ReturnType<typeof setInterval> | null = null;

export function startWebhookRetrySweep(): void {
  if (retryInterval) return;
  retryInterval = setInterval(() => {
    void processWebhookRetries();
  }, 60_000);
}

export function stopWebhookRetrySweep(): void {
  if (retryInterval) {
    clearInterval(retryInterval);
    retryInterval = null;
  }
}
