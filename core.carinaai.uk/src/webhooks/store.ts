import { pool } from '../memory/db.js';
import { v4 as uuidv4 } from 'uuid';
import { createHmac, randomBytes } from 'crypto';

export type WebhookEvent =
  | 'process.complete'
  | 'cron.complete'
  | 'kanban.move'
  | 'agent.turn.complete';

export interface WebhookSubscription {
  id: string;
  url: string;
  events: WebhookEvent[];
  secret: string | null;
  active: boolean;
  createdAt: Date;
}

function rowToSub(row: Record<string, unknown>): WebhookSubscription {
  return {
    id: String(row.id),
    url: String(row.url),
    events: (row.events as WebhookEvent[]) ?? [],
    secret: row.secret ? String(row.secret) : null,
    active: Boolean(row.active),
    createdAt: new Date(String(row.created_at)),
  };
}

export async function createSubscription(
  url: string,
  events: WebhookEvent[],
): Promise<WebhookSubscription> {
  const id = uuidv4();
  const secret = randomBytes(16).toString('hex');
  const result = await pool.query(
    `INSERT INTO webhook_subscriptions (id, url, events, secret, active)
     VALUES ($1, $2, $3, $4, true)
     RETURNING *`,
    [id, url, events, secret],
  );
  return rowToSub(result.rows[0]);
}

export async function listSubscriptions(): Promise<WebhookSubscription[]> {
  const result = await pool.query(
    'SELECT * FROM webhook_subscriptions WHERE active = true ORDER BY created_at DESC',
  );
  return result.rows.map(rowToSub);
}

export async function removeSubscription(id: string): Promise<boolean> {
  const result = await pool.query(
    'UPDATE webhook_subscriptions SET active = false WHERE id = $1 AND active = true',
    [id],
  );
  return result.rowCount !== null && result.rowCount > 0;
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

export function signPayload(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}
