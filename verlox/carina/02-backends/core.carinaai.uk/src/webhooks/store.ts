import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { pool } from '../memory/db.js';
import { v4 as uuidv4 } from 'uuid';
import type { WebhookEvent, WebhookSubscription } from './webhook-types.js';

export type { WebhookEvent, WebhookSubscription } from './webhook-types.js';
export { WEBHOOK_EVENTS } from './webhook-types.js';

function parseEvents(raw: unknown): WebhookEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(String).filter((e): e is WebhookEvent =>
    ['process.complete', 'process.failure', 'process.watch', 'cron.complete', 'kanban.move', 'agent.turn.complete'].includes(e),
  );
}

function rowToSub(row: Record<string, unknown>): WebhookSubscription {
  return {
    id: String(row.id),
    url: String(row.url),
    events: parseEvents(row.events),
    secret: row.secret ? String(row.secret) : null,
    active: Boolean(row.active),
    name: row.name ? String(row.name) : null,
    description: row.description ? String(row.description) : null,
    maxAttempts: Number(row.max_attempts ?? 5),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at ?? row.created_at)),
    disabledAt: row.disabled_at ? new Date(String(row.disabled_at)) : null,
  };
}

export function signPayload(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

export function verifyPayloadSignature(secret: string, body: string, signature: string): boolean {
  if (!secret || !signature) return false;
  const expected = signPayload(secret, body);
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

export async function createSubscription(
  url: string,
  events: WebhookEvent[],
  opts?: { name?: string; description?: string; maxAttempts?: number },
): Promise<WebhookSubscription> {
  const id = uuidv4();
  const secret = randomBytes(16).toString('hex');
  const result = await pool.query(
    `INSERT INTO webhook_subscriptions (id, url, events, secret, active, name, description, max_attempts)
     VALUES ($1, $2, $3, $4, true, $5, $6, $7)
     RETURNING *`,
    [
      id,
      url,
      events,
      secret,
      opts?.name ?? null,
      opts?.description ?? null,
      opts?.maxAttempts ?? 5,
    ],
  );
  return rowToSub(result.rows[0]);
}

export async function getSubscription(id: string): Promise<WebhookSubscription | null> {
  const result = await pool.query('SELECT * FROM webhook_subscriptions WHERE id = $1', [id]);
  if (!result.rows[0]) return null;
  return rowToSub(result.rows[0]);
}

export async function listSubscriptions(includeInactive = false): Promise<WebhookSubscription[]> {
  const query = includeInactive
    ? 'SELECT * FROM webhook_subscriptions ORDER BY created_at DESC'
    : 'SELECT * FROM webhook_subscriptions WHERE active = true ORDER BY created_at DESC';
  const result = await pool.query(query);
  return result.rows.map(rowToSub);
}

export async function updateSubscription(
  id: string,
  patch: {
    url?: string;
    events?: WebhookEvent[];
    name?: string;
    description?: string;
    maxAttempts?: number;
  },
): Promise<WebhookSubscription | null> {
  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;
  const map: Record<string, unknown> = {
    url: patch.url,
    events: patch.events,
    name: patch.name,
    description: patch.description,
    max_attempts: patch.maxAttempts,
  };
  for (const [col, val] of Object.entries(map)) {
    if (val !== undefined) {
      fields.push(`${col} = $${idx++}`);
      params.push(val);
    }
  }
  if (fields.length === 0) return getSubscription(id);
  fields.push('updated_at = NOW()');
  params.push(id);
  const result = await pool.query(
    `UPDATE webhook_subscriptions SET ${fields.join(', ')} WHERE id = $${idx} AND active = true RETURNING *`,
    params,
  );
  if (!result.rows[0]) return null;
  return rowToSub(result.rows[0]);
}

export async function disableSubscription(id: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE webhook_subscriptions SET active = false, disabled_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND active = true`,
    [id],
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function enableSubscription(id: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE webhook_subscriptions SET active = true, disabled_at = NULL, updated_at = NOW()
     WHERE id = $1 AND active = false`,
    [id],
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function removeSubscription(id: string): Promise<boolean> {
  return disableSubscription(id);
}

export async function getSubscriptionsForEvent(
  event: WebhookEvent,
): Promise<WebhookSubscription[]> {
  const result = await pool.query(
    `SELECT * FROM webhook_subscriptions
     WHERE active = true AND $1 = ANY(events)`,
    [event],
  );
  return result.rows.map(rowToSub);
}

export function subscriptionPayload(sub: WebhookSubscription, includeSecret = false): Record<string, unknown> {
  return {
    id: sub.id,
    url: sub.url,
    events: sub.events,
    active: sub.active,
    name: sub.name,
    description: sub.description,
    max_attempts: sub.maxAttempts,
    created_at: sub.createdAt.toISOString(),
    updated_at: sub.updatedAt.toISOString(),
    disabled_at: sub.disabledAt?.toISOString() ?? null,
    ...(includeSecret && sub.secret ? { secret: sub.secret } : {}),
  };
}
