/**
 * Reconciliation: detect gaps between local deliveries and provider events.
 * Never invents opens/clicks; only reports missing IDs, stuck sends, duplicates, regressions.
 */

import { isDatabaseConfigured } from '../../config/database-url.js';
import { pool } from '../../memory/db.js';
import { loadOutreachStore } from '../store.js';
import { TERMINAL_DELIVERY_STATUSES, deliveryStatusRank } from './state-machine.js';
import { ensureProviderEventsSchema, recordReconcileGap } from './persist.js';

export function isDeliveryReconcileEnabled(): boolean {
  const raw = (process.env.CARINA_OUTREACH_DELIVERY_RECONCILE || '').trim().toLowerCase();
  if (raw === 'false' || raw === '0' || raw === 'off') return false;
  if (raw === 'true' || raw === '1' || raw === 'on') return true;
  return isDatabaseConfigured();
}

const STUCK_PENDING_MS = Number(process.env.CARINA_OUTREACH_STUCK_PENDING_MS || 6 * 60 * 60 * 1000);
const LOOKBACK_MS = Number(process.env.CARINA_OUTREACH_RECONCILE_LOOKBACK_MS || 7 * 24 * 60 * 60 * 1000);

export async function runDeliveryReconciliation(now: Date = new Date()): Promise<{
  scanned: number;
  gaps: number;
  missingProviderIds: number;
  stuckPending: number;
  impossibleRegressions: number;
  duplicateEvents: number;
}> {
  try {
    await ensureProviderEventsSchema();
  } catch {
    // Local/json mode or DB unreachable: continue with in-memory store only.
  }
  const store = loadOutreachStore();
  const cutoff = new Date(now.getTime() - LOOKBACK_MS).toISOString();
  const recent = store.deliveries.filter((d) => d.updatedAt >= cutoff || d.createdAt >= cutoff);

  let gaps = 0;
  let missingProviderIds = 0;
  let stuckPending = 0;
  let impossibleRegressions = 0;
  let duplicateEvents = 0;

  for (const delivery of recent) {
    const sentLike = ['sent', 'accepted', 'delivered', 'opened', 'clicked', 'deferred', 'replied'].includes(delivery.status);
    if (sentLike && !delivery.providerMessageId && !delivery.rfcMessageId) {
      missingProviderIds += 1;
      gaps += 1;
      await recordReconcileGap({
        workspaceId: delivery.workspaceId,
        deliveryId: delivery.id,
        gapType: 'missing_provider_id',
        severity: 'warn',
        detail: { status: delivery.status, provider: delivery.provider },
      });
    }

    if (
      (delivery.status === 'pending_approval' || delivery.status === 'queued' || delivery.status === 'scheduled')
      && now.getTime() - Date.parse(delivery.updatedAt) > STUCK_PENDING_MS
    ) {
      stuckPending += 1;
      gaps += 1;
      await recordReconcileGap({
        workspaceId: delivery.workspaceId,
        deliveryId: delivery.id,
        gapType: 'stuck_pending_send',
        severity: 'warn',
        detail: { status: delivery.status, updatedAt: delivery.updatedAt },
      });
    }

    if ((delivery.openCount ?? 0) > 0 && !delivery.openedAt) {
      gaps += 1;
      await recordReconcileGap({
        workspaceId: delivery.workspaceId,
        deliveryId: delivery.id,
        gapType: 'engagement_without_timestamp',
        severity: 'error',
        detail: { openCount: delivery.openCount },
      });
    }
    if ((delivery.clickCount ?? 0) > 0 && !delivery.clickedAt) {
      gaps += 1;
      await recordReconcileGap({
        workspaceId: delivery.workspaceId,
        deliveryId: delivery.id,
        gapType: 'engagement_without_timestamp',
        severity: 'error',
        detail: { clickCount: delivery.clickCount },
      });
    }
  }

  if (isDatabaseConfigured()) {
    try {
      const dupes = await pool.query(
        `SELECT provider, checksum, COUNT(*)::int AS c
         FROM outreach_provider_events
         WHERE received_at >= NOW() - ($1::text || ' milliseconds')::interval
         GROUP BY provider, checksum
         HAVING COUNT(*) > 1
         LIMIT 50`,
        [String(LOOKBACK_MS)],
      );
      for (const row of dupes.rows) {
        duplicateEvents += 1;
        gaps += 1;
        await recordReconcileGap({
          gapType: 'duplicated_events',
          severity: 'info',
          detail: { provider: row.provider, checksum: row.checksum, count: row.c },
        });
      }

      const applied = await pool.query(
        `SELECT e.workspace_id, e.delivery_id, e.kind, e.occurred_at, d.status AS delivery_status
         FROM outreach_provider_events e
         LEFT JOIN outreach_deliveries d ON d.id = e.delivery_id
         WHERE e.processing_status = 'applied'
           AND e.received_at >= NOW() - ($1::text || ' milliseconds')::interval
           AND d.status IS NOT NULL
         ORDER BY e.occurred_at DESC
         LIMIT 200`,
        [String(LOOKBACK_MS)],
      );
      for (const row of applied.rows) {
        const status = String(row.delivery_status ?? '');
        const kind = String(row.kind ?? '');
        if (!TERMINAL_DELIVERY_STATUSES.has(status as never)) continue;
        if (['opened', 'clicked', 'delivered', 'sent', 'accepted', 'deferred'].includes(status)
          && ['hard_bounce', 'complaint', 'unsubscribe'].includes(kind)
          && deliveryStatusRank(status) < deliveryStatusRank(
            kind === 'hard_bounce' ? 'bounced' : kind === 'complaint' ? 'complained' : 'unsubscribed',
          )) {
          impossibleRegressions += 1;
          gaps += 1;
          await recordReconcileGap({
            workspaceId: row.workspace_id ? String(row.workspace_id) : null,
            deliveryId: row.delivery_id ? String(row.delivery_id) : null,
            gapType: 'impossible_state_regression',
            severity: 'error',
            detail: { deliveryStatus: status, appliedKind: kind, occurredAt: row.occurred_at },
          });
        }
      }
    } catch (err) {
      console.warn('[outreach-reconcile] pg diagnostics skipped:', err);
    }
  }

  return {
    scanned: recent.length,
    gaps,
    missingProviderIds,
    stuckPending,
    impossibleRegressions,
    duplicateEvents,
  };
}
