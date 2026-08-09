/**
 * Periodic delivery reconciliation timer.
 */

import { isDatabaseConfigured } from '../../config/database-url.js';
import { ensureProviderEventsSchema } from './persist.js';
import { isDeliveryReconcileEnabled, runDeliveryReconciliation } from './reconcile.js';

let timer: ReturnType<typeof setInterval> | null = null;
let started = false;

const TICK_MS = Number(process.env.CARINA_OUTREACH_RECONCILE_MS || 15 * 60 * 1000);

export async function tickDeliveryReconciliation(): Promise<ReturnType<typeof runDeliveryReconciliation>> {
  if (!isDeliveryReconcileEnabled()) {
    return {
      scanned: 0,
      gaps: 0,
      missingProviderIds: 0,
      stuckPending: 0,
      impossibleRegressions: 0,
      duplicateEvents: 0,
    };
  }
  await ensureProviderEventsSchema();
  return runDeliveryReconciliation();
}

export function startDeliveryReconcileEngine(): void {
  if (started || !isDeliveryReconcileEnabled()) return;
  started = true;
  void tickDeliveryReconciliation()
    .then((summary) => {
      if (summary.gaps > 0) {
        console.log(
          `[outreach-reconcile] boot scanned=${summary.scanned} gaps=${summary.gaps} missingIds=${summary.missingProviderIds} stuck=${summary.stuckPending}`,
        );
      }
    })
    .catch((err) => console.warn('[outreach-reconcile] boot failed:', err));

  timer = setInterval(() => {
    void tickDeliveryReconciliation()
      .then((summary) => {
        if (summary.gaps > 0) {
          console.log(
            `[outreach-reconcile] tick scanned=${summary.scanned} gaps=${summary.gaps} missingIds=${summary.missingProviderIds}`,
          );
        }
      })
      .catch((err) => console.warn('[outreach-reconcile] tick failed:', err));
  }, Math.max(60_000, TICK_MS));

  if (!isDatabaseConfigured()) {
    console.log('[outreach-reconcile] started without DATABASE_URL (local store only)');
  }
}

export function stopDeliveryReconcileEngine(): void {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
}
