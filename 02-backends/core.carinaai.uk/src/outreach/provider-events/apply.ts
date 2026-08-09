/**
 * Apply normalized provider events to outreach deliveries (idempotent, workspace-safe).
 */

import { loadOutreachStore, mutateOutreachStore } from '../store.js';
import { markDeliveryStatus } from '../sequence-engine.js';
import { appendTimeline } from '../pipeline.js';
import type { DeliveryEvent } from '../types.js';
import {
  resolveNextDeliveryStatus,
  workspaceAllowsEngagementTracking,
} from './state-machine.js';
import {
  findDeliveryByProviderMessage,
  insertProviderEvent,
  recordReconcileGap,
} from './persist.js';
import type { ApplyProviderEventResult, NormalizedProviderEvent } from './types.js';

function findLocalDelivery(input: {
  workspaceId?: string;
  deliveryId?: string;
  providerMessageId?: string;
}): DeliveryEvent | null {
  const store = loadOutreachStore();
  if (input.deliveryId) {
    const byId = store.deliveries.find((d) => d.id === input.deliveryId) ?? null;
    if (byId) return byId;
  }
  if (input.providerMessageId) {
    const matches = store.deliveries.filter((d) => {
      if (input.workspaceId && d.workspaceId !== input.workspaceId) return false;
      const ids = [d.providerMessageId, d.rfcMessageId].filter(Boolean).map((v) => String(v).toLowerCase());
      return ids.includes(input.providerMessageId!.toLowerCase());
    });
    return matches[0] ?? null;
  }
  return null;
}

export async function applyProviderEvent(
  event: NormalizedProviderEvent,
): Promise<ApplyProviderEventResult> {
  // Resolve delivery
  let delivery = findLocalDelivery({
    workspaceId: event.workspaceId,
    deliveryId: event.deliveryId,
    providerMessageId: event.providerMessageId,
  });

  if (!delivery && event.providerMessageId) {
    const pgHit = await findDeliveryByProviderMessage({
      workspaceId: event.workspaceId,
      provider: event.provider,
      providerMessageId: event.providerMessageId,
    });
    if (pgHit) {
      if (event.workspaceId && event.workspaceId !== pgHit.workspaceId) {
        const inserted = await insertProviderEvent({
          event,
          processingStatus: 'rejected',
          rejectReason: 'cross_workspace',
        });
        if (inserted.duplicate) {
          return {
            ok: true,
            duplicate: true,
            rejected: false,
            reason: 'duplicate',
            eventId: inserted.id,
          };
        }
        await recordReconcileGap({
          workspaceId: event.workspaceId,
          gapType: 'cross_workspace_event',
          severity: 'error',
          detail: { providerEventId: event.providerEventId, claimed: pgHit.workspaceId },
        });
        return {
          ok: false,
          duplicate: false,
          rejected: true,
          reason: 'cross_workspace',
          eventId: inserted.id,
        };
      }
      delivery = findLocalDelivery({
        workspaceId: pgHit.workspaceId,
        deliveryId: pgHit.deliveryId,
      });
    }
  }

  if (!delivery) {
    const inserted = await insertProviderEvent({
      event,
      processingStatus: 'rejected',
      rejectReason: 'unknown_provider_message',
    });
    if (inserted.duplicate) {
      return {
        ok: true,
        duplicate: true,
        rejected: false,
        reason: 'duplicate',
        eventId: inserted.id,
      };
    }
    await recordReconcileGap({
      workspaceId: event.workspaceId ?? null,
      gapType: 'unknown_provider_message',
      severity: 'warn',
      detail: {
        provider: event.provider,
        providerEventId: event.providerEventId,
        providerMessageId: event.providerMessageId,
        kind: event.kind,
      },
    });
    return {
      ok: false,
      duplicate: false,
      rejected: true,
      reason: 'unknown_provider_message',
      eventId: inserted.id,
    };
  }

  if (event.workspaceId && event.workspaceId !== delivery.workspaceId) {
    const inserted = await insertProviderEvent({
      event,
      processingStatus: 'rejected',
      rejectReason: 'cross_workspace',
      deliveryId: delivery.id,
    });
    if (inserted.duplicate) {
      return {
        ok: true,
        duplicate: true,
        rejected: false,
        reason: 'duplicate',
        eventId: inserted.id,
        deliveryId: delivery.id,
      };
    }
    return {
      ok: false,
      duplicate: false,
      rejected: true,
      reason: 'cross_workspace',
      eventId: inserted.id,
      deliveryId: delivery.id,
    };
  }

  const statusBefore = delivery.status;
  const resolution = resolveNextDeliveryStatus(delivery.status, event.kind);

  // Engagement: opens/clicks always record counts when allowed, even if status blocked.
  const isEngagement = event.kind === 'opened' || event.kind === 'clicked';
  if (isEngagement && !workspaceAllowsEngagementTracking(delivery.workspaceId)) {
    const inserted = await insertProviderEvent({
      event,
      processingStatus: 'ignored',
      rejectReason: 'tracking_disabled',
      deliveryId: delivery.id,
    });
    if (inserted.duplicate) {
      return {
        ok: true,
        duplicate: true,
        rejected: false,
        reason: 'duplicate',
        eventId: inserted.id,
        deliveryId: delivery.id,
        statusBefore,
        statusAfter: statusBefore,
      };
    }
    return {
      ok: true,
      duplicate: false,
      rejected: false,
      reason: 'tracking_disabled',
      eventId: inserted.id,
      deliveryId: delivery.id,
      statusBefore,
      statusAfter: statusBefore,
    };
  }

  // Reserve idempotency slot before mutating local state.
  const reserved = await insertProviderEvent({
    event,
    processingStatus: resolution.applied || isEngagement ? 'applied' : 'ignored',
    rejectReason: resolution.applied || isEngagement ? undefined : resolution.reason,
    deliveryId: delivery.id,
  });
  if (reserved.duplicate) {
    return {
      ok: true,
      duplicate: true,
      rejected: false,
      reason: 'duplicate',
      eventId: reserved.id,
      deliveryId: delivery.id,
      statusBefore,
      statusAfter: statusBefore,
    };
  }

  if (isEngagement) {
    mutateOutreachStore((store) => {
      const idx = store.deliveries.findIndex((d) => d.id === delivery!.id);
      if (idx < 0) return;
      const current = store.deliveries[idx]!;
      const stamp = event.occurredAt;
      store.deliveries[idx] = {
        ...current,
        openCount: (current.openCount ?? 0) + (event.kind === 'opened' ? 1 : 0),
        clickCount: (current.clickCount ?? 0) + (event.kind === 'clicked' ? 1 : 0),
        openedAt: event.kind === 'opened' ? (current.openedAt ?? stamp) : current.openedAt,
        clickedAt: event.kind === 'clicked' ? (current.clickedAt ?? stamp) : current.clickedAt,
        updatedAt: new Date().toISOString(),
      };
      const leadIdx = store.leads.findIndex((l) => l.id === current.leadId);
      if (leadIdx >= 0) {
        store.leads[leadIdx] = appendTimeline(store.leads[leadIdx]!, {
          kind: 'delivery',
          message: `Provider ${event.kind}`,
          meta: {
            deliveryId: current.id,
            provider: event.provider,
            providerEventId: event.providerEventId,
            kind: event.kind,
            occurredAt: event.occurredAt,
          },
        });
      }
    });
  }

  let statusAfter = statusBefore;
  if (resolution.applied && resolution.next) {
    const marked = markDeliveryStatus(delivery.workspaceId, delivery.id, resolution.next, {
      lastError: event.kind === 'failed' || event.kind === 'hard_bounce'
        ? `provider_${event.kind}`
        : undefined,
      provider: event.provider,
      mailboxIdentity: event.mailboxIdentity ?? delivery.mailboxIdentity,
      providerMessageId: event.providerMessageId ?? delivery.providerMessageId,
    });
    statusAfter = marked?.status ?? resolution.next;
  } else if (!isEngagement) {
    mutateOutreachStore((store) => {
      const leadIdx = store.leads.findIndex((l) => l.id === delivery!.leadId);
      if (leadIdx >= 0) {
        store.leads[leadIdx] = appendTimeline(store.leads[leadIdx]!, {
          kind: 'delivery',
          message: `Provider ${event.kind} (no status change: ${resolution.reason})`,
          meta: {
            deliveryId: delivery!.id,
            provider: event.provider,
            providerEventId: event.providerEventId,
            kind: event.kind,
            occurredAt: event.occurredAt,
          },
        });
      }
    });
  }

  return {
    ok: true,
    duplicate: false,
    rejected: false,
    reason: resolution.reason,
    eventId: reserved.id,
    deliveryId: delivery.id,
    statusBefore,
    statusAfter,
  };
}
