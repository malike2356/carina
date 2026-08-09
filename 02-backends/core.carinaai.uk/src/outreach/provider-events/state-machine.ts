/**
 * Monotonic delivery status machine for provider-backed outreach.
 * Terminal states never regress. Opens/clicks are engagement, not regressions.
 */

import type { DeliveryEventStatus } from '../types.js';
import type { ProviderEventKind } from './types.js';

const RANK: Record<string, number> = {
  scheduled: 0,
  queued: 1,
  pending_approval: 2,
  accepted: 3,
  sent: 4,
  deferred: 4,
  delivered: 5,
  opened: 6,
  clicked: 7,
  replied: 8,
  failed: 9,
  bounced: 10,
  complained: 10,
  unsubscribed: 10,
  cancelled: 10,
  skipped: 10,
};

export const TERMINAL_DELIVERY_STATUSES = new Set<DeliveryEventStatus>([
  'bounced',
  'complained',
  'unsubscribed',
  'cancelled',
  'skipped',
  'replied',
]);

export function deliveryStatusRank(status: string): number {
  return RANK[status] ?? 0;
}

export function mapProviderKindToStatus(kind: ProviderEventKind): DeliveryEventStatus | null {
  switch (kind) {
    case 'accepted':
      return 'accepted';
    case 'sent':
      return 'sent';
    case 'delivered':
      return 'delivered';
    case 'deferred':
    case 'soft_bounce':
      return 'deferred';
    case 'hard_bounce':
      return 'bounced';
    case 'complaint':
      return 'complained';
    case 'unsubscribe':
      return 'unsubscribed';
    case 'opened':
      return 'opened';
    case 'clicked':
      return 'clicked';
    case 'replied':
      return 'replied';
    case 'failed':
      return 'failed';
    default:
      return null;
  }
}

export function canTransitionDeliveryStatus(
  current: DeliveryEventStatus,
  next: DeliveryEventStatus,
): boolean {
  if (current === next) return true;
  if (TERMINAL_DELIVERY_STATUSES.has(current) && current !== next) {
    // Allow replied → unsubscribed/complained/bounced (stronger terminal), not reverse.
    const stronger = new Set(['bounced', 'complained', 'unsubscribed']);
    if (current === 'replied' && stronger.has(next)) return true;
    return false;
  }
  return deliveryStatusRank(next) >= deliveryStatusRank(current);
}

export function resolveNextDeliveryStatus(
  current: DeliveryEventStatus,
  kind: ProviderEventKind,
): { next: DeliveryEventStatus | null; applied: boolean; reason: string } {
  const mapped = mapProviderKindToStatus(kind);
  if (!mapped) {
    return { next: null, applied: false, reason: 'unmapped_kind' };
  }
  if (!canTransitionDeliveryStatus(current, mapped)) {
    return { next: null, applied: false, reason: `blocked_regression:${current}->${mapped}` };
  }
  return { next: mapped, applied: true, reason: 'ok' };
}

/** Workspace may record opens/clicks only when tracking is enabled (default on). */
export function workspaceAllowsEngagementTracking(workspaceId: string): boolean {
  const raw = (process.env.CARINA_OUTREACH_TRACK_OPENS_CLICKS || 'true').trim().toLowerCase();
  if (raw === 'false' || raw === '0' || raw === 'off') return false;
  const deny = (process.env.CARINA_OUTREACH_TRACK_DENY_WORKSPACES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return !deny.includes(workspaceId);
}
