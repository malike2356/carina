/**
 * Persist provider events and delivery provider id columns (idempotent).
 */

import crypto from 'crypto';
import { isDatabaseConfigured } from '../../config/database-url.js';
import { pool } from '../../memory/db.js';
import type { ApplyProviderEventResult, NormalizedProviderEvent } from './types.js';

let schemaReady: Promise<void> | null = null;

export async function ensureProviderEventsSchema(): Promise<void> {
  if (!isDatabaseConfigured()) return;
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        ALTER TABLE outreach_deliveries
          ADD COLUMN IF NOT EXISTS provider TEXT,
          ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
          ADD COLUMN IF NOT EXISTS provider_thread_id TEXT,
          ADD COLUMN IF NOT EXISTS rfc_message_id TEXT,
          ADD COLUMN IF NOT EXISTS mailbox_identity TEXT,
          ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS open_count INT NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS click_count INT NOT NULL DEFAULT 0
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS outreach_provider_events (
          id TEXT PRIMARY KEY,
          provider TEXT NOT NULL,
          provider_event_id TEXT NOT NULL,
          workspace_id TEXT,
          mailbox_identity TEXT,
          provider_message_id TEXT,
          delivery_id TEXT,
          kind TEXT NOT NULL,
          occurred_at TIMESTAMPTZ NOT NULL,
          received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          checksum TEXT NOT NULL,
          processing_status TEXT NOT NULL DEFAULT 'applied',
          reject_reason TEXT,
          payload JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (provider, provider_event_id)
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS outreach_delivery_reconcile_gaps (
          id TEXT PRIMARY KEY,
          workspace_id TEXT,
          delivery_id TEXT,
          gap_type TEXT NOT NULL,
          severity TEXT NOT NULL DEFAULT 'warn',
          detail JSONB NOT NULL DEFAULT '{}'::jsonb,
          status TEXT NOT NULL DEFAULT 'open',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          resolved_at TIMESTAMPTZ
        )
      `);
    })().catch((err) => {
      schemaReady = null;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[outreach-provider-events] schema ensure skipped:', msg.slice(0, 200));
    });
  }
  await schemaReady;
}

export async function insertProviderEvent(input: {
  event: NormalizedProviderEvent;
  processingStatus: string;
  rejectReason?: string;
  deliveryId?: string | null;
}): Promise<{ id: string; duplicate: boolean }> {
  const id = crypto.randomUUID();
  if (!isDatabaseConfigured()) {
    return { id, duplicate: false };
  }
  try {
    await ensureProviderEventsSchema();
    await pool.query(
      `INSERT INTO outreach_provider_events (
         id, provider, provider_event_id, workspace_id, mailbox_identity, provider_message_id,
         delivery_id, kind, occurred_at, received_at, checksum, processing_status, reject_reason, payload
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10::timestamptz,$11,$12,$13,$14::jsonb
       )
       ON CONFLICT (provider, provider_event_id) DO NOTHING`,
      [
        id,
        input.event.provider,
        input.event.providerEventId,
        input.event.workspaceId ?? null,
        input.event.mailboxIdentity ?? null,
        input.event.providerMessageId ?? null,
        input.deliveryId ?? input.event.deliveryId ?? null,
        input.event.kind,
        input.event.occurredAt,
        input.event.receivedAt,
        input.event.checksum,
        input.processingStatus,
        input.rejectReason ?? null,
        JSON.stringify(input.event.payload),
      ],
    );
    const existing = await pool.query(
      `SELECT id FROM outreach_provider_events
       WHERE provider = $1 AND provider_event_id = $2`,
      [input.event.provider, input.event.providerEventId],
    );
    const rowId = existing.rows[0] ? String(existing.rows[0].id) : id;
    const duplicate = rowId !== id;
    return { id: rowId, duplicate };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique|duplicate/i.test(msg)) {
      return { id, duplicate: true };
    }
    console.warn('[outreach-provider-events] insert skipped:', msg.slice(0, 200));
    return { id, duplicate: false };
  }
}

export async function findDeliveryByProviderMessage(input: {
  workspaceId?: string;
  provider?: string;
  providerMessageId: string;
}): Promise<{ workspaceId: string; deliveryId: string } | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    await ensureProviderEventsSchema();
    const params: unknown[] = [input.providerMessageId];
    let sql = `
      SELECT workspace_id, id FROM outreach_deliveries
      WHERE provider_message_id = $1`;
    if (input.workspaceId) {
      params.push(input.workspaceId);
      sql += ` AND workspace_id = $${params.length}`;
    }
    if (input.provider) {
      params.push(input.provider);
      sql += ` AND (provider = $${params.length} OR provider IS NULL)`;
    }
    sql += ' ORDER BY updated_at DESC LIMIT 1';
    const result = await pool.query(sql, params);
    if (!result.rows[0]) {
      const fallback = await pool.query(
        `SELECT workspace_id, id FROM outreach_deliveries
         WHERE payload->>'providerMessageId' = $1
            OR payload->>'rfcMessageId' = $1
         ORDER BY updated_at DESC LIMIT 1`,
        [input.providerMessageId],
      );
      if (!fallback.rows[0]) return null;
      return {
        workspaceId: String(fallback.rows[0].workspace_id),
        deliveryId: String(fallback.rows[0].id),
      };
    }
    return {
      workspaceId: String(result.rows[0].workspace_id),
      deliveryId: String(result.rows[0].id),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[outreach-provider-events] lookup skipped:', msg.slice(0, 160));
    return null;
  }
}

export async function recordReconcileGap(input: {
  workspaceId?: string | null;
  deliveryId?: string | null;
  gapType: string;
  severity?: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    await ensureProviderEventsSchema();
    await pool.query(
      `INSERT INTO outreach_delivery_reconcile_gaps
         (id, workspace_id, delivery_id, gap_type, severity, detail)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [
        crypto.randomUUID(),
        input.workspaceId ?? null,
        input.deliveryId ?? null,
        input.gapType,
        input.severity ?? 'warn',
        JSON.stringify(input.detail ?? {}),
      ],
    );
  } catch (err) {
    console.warn('[outreach-reconcile] gap insert failed:', err);
  }
}

export async function listOpenReconcileGaps(limit = 50): Promise<Array<Record<string, unknown>>> {
  if (!isDatabaseConfigured()) return [];
  await ensureProviderEventsSchema();
  const result = await pool.query(
    `SELECT * FROM outreach_delivery_reconcile_gaps
     WHERE status = 'open'
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(200, Math.max(1, limit))],
  );
  return result.rows as Array<Record<string, unknown>>;
}

export async function listProviderEvents(input: {
  workspaceId?: string;
  deliveryId?: string;
  limit?: number;
}): Promise<Array<Record<string, unknown>>> {
  if (!isDatabaseConfigured()) return [];
  await ensureProviderEventsSchema();
  const params: unknown[] = [];
  const where: string[] = [];
  if (input.workspaceId) {
    params.push(input.workspaceId);
    where.push(`workspace_id = $${params.length}`);
  }
  if (input.deliveryId) {
    params.push(input.deliveryId);
    where.push(`delivery_id = $${params.length}`);
  }
  params.push(Math.min(200, Math.max(1, input.limit ?? 50)));
  const sql = `
    SELECT * FROM outreach_provider_events
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY occurred_at DESC
    LIMIT $${params.length}`;
  const result = await pool.query(sql, params);
  return result.rows as Array<Record<string, unknown>>;
}

export type { ApplyProviderEventResult };
