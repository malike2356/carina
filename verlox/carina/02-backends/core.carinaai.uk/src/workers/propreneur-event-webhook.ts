import { createHmac, timingSafeEqual } from 'node:crypto';
import { getWorkerById } from './worker-store.js';
import { listWorkerChannelDetails, readChannelCredentials } from '../channels/channel-store.js';
import { lookupWorker } from '../channels/worker-registry.js';
import { getAdapter } from '../channels/adapter-registry.js';
import { pool } from '../memory/db.js';

export interface PropreneurWebhookPayload {
  event: string;
  workerId: string;
  tenantSlug: string;
  tenantId?: string;
  occurredAt?: string;
  data?: Record<string, unknown>;
}

const rateLimitWindows = new Map<string, number[]>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

export function verifyPropreneurWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader || secret === '') {
    return false;
  }

  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const provided = signatureHeader.startsWith('sha256=')
    ? signatureHeader
    : `sha256=${signatureHeader}`;

  if (expected.length !== provided.length) {
    return false;
  }

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}

export function checkPropreneurWebhookRateLimit(workerId: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const hits = (rateLimitWindows.get(workerId) ?? []).filter((t) => t >= windowStart);
  if (hits.length >= RATE_LIMIT_MAX) {
    rateLimitWindows.set(workerId, hits);
    return false;
  }
  hits.push(now);
  rateLimitWindows.set(workerId, hits);
  return true;
}

export function formatPropreneurEventMessage(payload: PropreneurWebhookPayload): string {
  const data = payload.data ?? {};
  if (payload.event === 'email_processed') {
    const subject = String(data.subject ?? 'No subject');
    const sender = String(data.sender ?? 'unknown sender');
    const classification = String(data.classification ?? 'other');
    return [
      `Propreneur update (${payload.tenantSlug})`,
      `Email processed: ${subject}`,
      `From: ${sender}`,
      `Classification: ${classification}`,
      'Reply here to ask Carina for details.',
    ].join('\n');
  }

  return `Propreneur event: ${payload.event} (${payload.tenantSlug})`;
}

async function listTelegramContacts(workerId: string): Promise<string[]> {
  const result = await pool.query(
    `SELECT contact_id FROM channel_threads
     WHERE worker_id = $1 AND channel = 'telegram'
     ORDER BY last_message_at DESC NULLS LAST
     LIMIT 5`,
    [workerId],
  );
  return result.rows.map((row) => String(row.contact_id));
}

export async function deliverPropreneurEventNotification(payload: PropreneurWebhookPayload): Promise<number> {
  const worker = await getWorkerById(payload.workerId);
  if (!worker || worker.status !== 'active') {
    return 0;
  }

  try {
    const { maybeCreateProposalFromEmailEvent } = await import('./propreneur-email-proposal.js');
    await maybeCreateProposalFromEmailEvent(worker, payload);
  } catch (err) {
    console.warn('[propreneur-event-webhook] proposal hook failed:', err instanceof Error ? err.message : err);
  }

  const channels = await listWorkerChannelDetails(worker.id);
  const telegram = channels.find((c) => c.channel === 'telegram' && c.enabled);
  if (!telegram) return 0;

  const entry = lookupWorker('telegram', telegram.identifier);
  if (!entry) return 0;

  const adapter = getAdapter('telegram');
  if (!adapter) return 0;

  const credentials = readChannelCredentials(telegram);
  const contacts = await listTelegramContacts(worker.id);
  if (contacts.length === 0) return 0;

  const message = formatPropreneurEventMessage(payload);
  let sent = 0;
  for (const contactId of contacts) {
    await adapter.send(
      { channel: 'telegram', contactId, content: message },
      credentials,
    );
    sent += 1;
  }
  return sent;
}

export function resetPropreneurWebhookRateLimitsForTests(): void {
  rateLimitWindows.clear();
}
