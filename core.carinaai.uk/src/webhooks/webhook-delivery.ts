import { pool } from '../memory/db.js';
import { v4 as uuidv4 } from 'uuid';
import type { WebhookDelivery, WebhookDeliveryStatus, WebhookEvent } from './webhook-types.js';

function rowToDelivery(row: Record<string, unknown>): WebhookDelivery {
  return {
    id: String(row.id),
    subscriptionId: row.subscription_id ? String(row.subscription_id) : null,
    event: String(row.event) as WebhookEvent,
    payload: (row.payload as Record<string, unknown>) ?? {},
    status: String(row.status) as WebhookDeliveryStatus,
    httpStatus: row.http_status != null ? Number(row.http_status) : null,
    attemptCount: Number(row.attempt_count ?? 0),
    maxAttempts: Number(row.max_attempts ?? 5),
    errorMessage: row.error_message ? String(row.error_message) : null,
    nextRetryAt: row.next_retry_at ? new Date(String(row.next_retry_at)) : null,
    createdAt: new Date(String(row.created_at)),
    deliveredAt: row.delivered_at ? new Date(String(row.delivered_at)) : null,
  };
}

export function deliveryPayload(d: WebhookDelivery): Record<string, unknown> {
  return {
    id: d.id,
    subscription_id: d.subscriptionId,
    event: d.event,
    status: d.status,
    http_status: d.httpStatus,
    attempt_count: d.attemptCount,
    max_attempts: d.maxAttempts,
    error_message: d.errorMessage,
    next_retry_at: d.nextRetryAt?.toISOString() ?? null,
    created_at: d.createdAt.toISOString(),
    delivered_at: d.deliveredAt?.toISOString() ?? null,
    payload: d.payload,
  };
}

export async function createDelivery(input: {
  subscriptionId: string;
  event: WebhookEvent;
  payload: Record<string, unknown>;
  maxAttempts?: number;
}): Promise<WebhookDelivery> {
  const id = uuidv4();
  const result = await pool.query(
    `INSERT INTO webhook_deliveries
       (id, subscription_id, event, payload, status, max_attempts)
     VALUES ($1, $2, $3, $4, 'pending', $5)
     RETURNING *`,
    [id, input.subscriptionId, input.event, JSON.stringify(input.payload), input.maxAttempts ?? 5],
  );
  return rowToDelivery(result.rows[0]);
}

export async function recordDeliveryAttempt(
  deliveryId: string,
  result: {
    success: boolean;
    httpStatus?: number;
    errorMessage?: string;
    scheduleRetry?: boolean;
    nextRetryAt?: Date;
  },
): Promise<WebhookDelivery | null> {
  const status: WebhookDeliveryStatus = result.success
    ? 'delivered'
    : (result.scheduleRetry ? 'retrying' : 'failed');
  const queryResult = await pool.query(
    `UPDATE webhook_deliveries
     SET status = $2,
         http_status = $3,
         attempt_count = attempt_count + 1,
         error_message = $4,
         next_retry_at = $5,
         delivered_at = CASE WHEN $6 THEN NOW() ELSE delivered_at END
     WHERE id = $1
     RETURNING *`,
    [
      deliveryId,
      status,
      result.httpStatus ?? null,
      result.errorMessage ?? null,
      result.nextRetryAt ?? null,
      result.success,
    ],
  );
  if (!queryResult.rows[0]) return null;
  return rowToDelivery(queryResult.rows[0]);
}

export async function getDelivery(id: string): Promise<WebhookDelivery | null> {
  const result = await pool.query('SELECT * FROM webhook_deliveries WHERE id = $1', [id]);
  if (!result.rows[0]) return null;
  return rowToDelivery(result.rows[0]);
}

export async function listDeliveries(opts?: {
  subscriptionId?: string;
  status?: WebhookDeliveryStatus;
  limit?: number;
}): Promise<WebhookDelivery[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  if (opts?.subscriptionId) {
    conditions.push(`subscription_id = $${idx++}`);
    params.push(opts.subscriptionId);
  }
  if (opts?.status) {
    conditions.push(`status = $${idx++}`);
    params.push(opts.status);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(200, Math.max(1, opts?.limit ?? 50));
  params.push(limit);
  const result = await pool.query(
    `SELECT * FROM webhook_deliveries ${where} ORDER BY created_at DESC LIMIT $${idx}`,
    params,
  );
  return result.rows.map(rowToDelivery);
}

export async function listDueRetries(limit = 20): Promise<WebhookDelivery[]> {
  const result = await pool.query(
    `SELECT * FROM webhook_deliveries
     WHERE status IN ('failed', 'retrying', 'pending')
       AND attempt_count < max_attempts
       AND (next_retry_at IS NULL OR next_retry_at <= NOW())
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit],
  );
  return result.rows.map(rowToDelivery);
}

export async function resetDeliveryForRetry(deliveryId: string): Promise<WebhookDelivery | null> {
  const result = await pool.query(
    `UPDATE webhook_deliveries
     SET status = 'retrying', next_retry_at = NOW(), error_message = NULL
     WHERE id = $1 AND status IN ('failed', 'retrying')
     RETURNING *`,
    [deliveryId],
  );
  if (!result.rows[0]) return null;
  return rowToDelivery(result.rows[0]);
}

export function computeNextRetry(attemptCount: number): Date {
  const delayMs = Math.min(60_000 * 2 ** Math.max(0, attemptCount - 1), 3_600_000);
  return new Date(Date.now() + delayMs);
}
