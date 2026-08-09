/**
 * Persist normalized inbound messages (idempotent on provider message id).
 */

import crypto from 'crypto';
import { isDatabaseConfigured } from '../../config/database-url.js';
import { pool } from '../../memory/db.js';
import { outreachInboundRetentionDays } from '../pg/config.js';
import type { InboundMatchResult, NormalizedInboundMessage } from './types.js';

let schemaReady: Promise<void> | null = null;

export async function ensureMailboxInboundSchema(): Promise<void> {
  if (!isDatabaseConfigured()) return;
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        ALTER TABLE outreach_inbound_messages
          ADD COLUMN IF NOT EXISTS worker_id TEXT,
          ADD COLUMN IF NOT EXISTS provider TEXT,
          ADD COLUMN IF NOT EXISTS thread_id TEXT,
          ADD COLUMN IF NOT EXISTS delivery_id TEXT,
          ADD COLUMN IF NOT EXISTS enrollment_id TEXT,
          ADD COLUMN IF NOT EXISTS campaign_id TEXT,
          ADD COLUMN IF NOT EXISTS match_method TEXT,
          ADD COLUMN IF NOT EXISTS match_confidence REAL,
          ADD COLUMN IF NOT EXISTS checksum TEXT,
          ADD COLUMN IF NOT EXISTS review_status TEXT
      `);
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_outreach_inbound_provider_msg
          ON outreach_inbound_messages (workspace_id, provider, provider_message_id)
          WHERE provider_message_id IS NOT NULL AND provider IS NOT NULL
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS outreach_mailbox_sync_cursors (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          worker_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          mailbox_identity TEXT NOT NULL DEFAULT '',
          history_cursor TEXT,
          last_success_at TIMESTAMPTZ,
          last_error TEXT,
          status TEXT NOT NULL DEFAULT 'idle',
          payload JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (workspace_id, worker_id, provider, mailbox_identity)
        )
      `);
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
}

export async function persistInboundMessage(input: {
  message: NormalizedInboundMessage;
  match: InboundMatchResult;
  reviewId?: string | null;
}): Promise<{ id: string; duplicate: boolean }> {
  const id = crypto.randomUUID();
  if (!isDatabaseConfigured()) {
    return { id, duplicate: false };
  }
  try {
    await ensureMailboxInboundSchema();
  } catch {
    return { id, duplicate: false };
  }
  const retentionDays = outreachInboundRetentionDays();
  const retentionUntil = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString();
  try {
    await pool.query(
      `INSERT INTO outreach_inbound_messages (
         id, workspace_id, lead_id, review_id, provider_message_id, received_at, retention_until,
         payload, body_text, worker_id, provider, thread_id, delivery_id, enrollment_id,
         campaign_id, match_method, match_confidence, checksum, review_status
       ) VALUES (
         $1,$2,$3,$4,$5,$6::timestamptz,$7::timestamptz,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
       )`,
      [
        id,
        input.message.workspaceId,
        input.match.leadId,
        input.reviewId ?? null,
        input.message.providerMessageId,
        input.message.receivedAt,
        retentionUntil,
        JSON.stringify(input.message),
        input.message.textBody.slice(0, 50_000),
        input.message.workerId ?? null,
        input.message.provider,
        input.message.threadId ?? null,
        input.match.deliveryId,
        input.match.enrollmentId,
        input.match.campaignId,
        input.match.method,
        input.match.confidence,
        input.message.checksum,
        input.match.requiresReview ? 'open' : 'applied',
      ],
    );
    return { id, duplicate: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique|duplicate/i.test(msg)) {
      try {
        const existing = await pool.query(
          `SELECT id FROM outreach_inbound_messages
           WHERE workspace_id = $1 AND provider = $2 AND provider_message_id = $3
           LIMIT 1`,
          [input.message.workspaceId, input.message.provider, input.message.providerMessageId],
        );
        return { id: String(existing.rows[0]?.id ?? id), duplicate: true };
      } catch {
        return { id, duplicate: true };
      }
    }
    // Local/dev DB may be misconfigured; still allow reply processing.
    console.warn('[outreach-inbound] persist skipped:', msg.slice(0, 200));
    return { id, duplicate: false };
  }
}

export async function getMailboxCursor(input: {
  workspaceId: string;
  workerId: string;
  provider: string;
  mailboxIdentity?: string;
}): Promise<{ historyCursor: string | null; payload: Record<string, unknown> } | null> {
  if (!isDatabaseConfigured()) return null;
  await ensureMailboxInboundSchema();
  const result = await pool.query(
    `SELECT history_cursor, payload FROM outreach_mailbox_sync_cursors
     WHERE workspace_id = $1 AND worker_id = $2 AND provider = $3 AND mailbox_identity = $4`,
    [input.workspaceId, input.workerId, input.provider, input.mailboxIdentity ?? ''],
  );
  if (!result.rows[0]) return null;
  return {
    historyCursor: result.rows[0].history_cursor ? String(result.rows[0].history_cursor) : null,
    payload: (result.rows[0].payload && typeof result.rows[0].payload === 'object')
      ? result.rows[0].payload as Record<string, unknown>
      : {},
  };
}

export async function upsertMailboxCursor(input: {
  workspaceId: string;
  workerId: string;
  provider: string;
  mailboxIdentity?: string;
  historyCursor?: string | null;
  lastError?: string | null;
  status?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  if (!isDatabaseConfigured()) return;
  await ensureMailboxInboundSchema();
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO outreach_mailbox_sync_cursors (
       id, workspace_id, worker_id, provider, mailbox_identity, history_cursor,
       last_success_at, last_error, status, payload, updated_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,
       CASE WHEN $7::text IS NULL THEN NULL ELSE NOW() END,
       $8,$9,$10::jsonb,NOW()
     )
     ON CONFLICT (workspace_id, worker_id, provider, mailbox_identity) DO UPDATE SET
       history_cursor = COALESCE(EXCLUDED.history_cursor, outreach_mailbox_sync_cursors.history_cursor),
       last_success_at = CASE
         WHEN EXCLUDED.last_error IS NULL THEN NOW()
         ELSE outreach_mailbox_sync_cursors.last_success_at
       END,
       last_error = EXCLUDED.last_error,
       status = EXCLUDED.status,
       payload = CASE
         WHEN EXCLUDED.payload = '{}'::jsonb THEN outreach_mailbox_sync_cursors.payload
         ELSE EXCLUDED.payload
       END,
       updated_at = NOW()`,
    [
      id,
      input.workspaceId,
      input.workerId,
      input.provider,
      input.mailboxIdentity ?? '',
      input.historyCursor ?? null,
      input.lastError ? null : 'ok',
      input.lastError ?? null,
      input.status ?? 'idle',
      JSON.stringify(input.payload ?? {}),
    ],
  );
}
