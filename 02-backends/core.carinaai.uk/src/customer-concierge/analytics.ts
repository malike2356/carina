/**
 * Concierge analytics from durable events (Prompt 705).
 * Aggregates never include message bodies.
 */

import { listConciergeEvents, type ConciergeEventRecord } from './events.js';
import { listSupportCases } from './support-cases.js';
import { listBookings } from '../vical/bookings.js';
import { listProviderOperationsForBooking } from '../vical/saga/ledger.js';

export type ConciergeAnalyticsReport = {
  window: { since: string; until: string };
  conversations: {
    started: number;
    closed: number;
    containmentRate: number | null;
    escalations: number;
  };
  support: {
    opened: number;
    resolved: number;
    firstResponseSamples: number;
    medianFirstResponseMinutes: number | null;
    medianResolutionMinutes: number | null;
  };
  bookings: {
    confirmed: number;
    cancelled: number;
    conversionFromConversations: number | null;
    inviteSent: number;
    inviteAccepted: number;
    inviteFailed: number;
    noShow: number;
    attended: number;
  };
  providers: {
    errors: number;
    actionRequired: number;
  };
  revenue: {
    attributedBookings: number;
    note: string;
  };
  eventsSampled: number;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function inWindow(iso: string, sinceMs: number, untilMs: number): boolean {
  const t = Date.parse(iso);
  return t >= sinceMs && t <= untilMs;
}

export async function buildConciergeAnalytics(input: {
  workspaceId: string;
  workerId: string;
  since?: string;
  until?: string;
}): Promise<ConciergeAnalyticsReport> {
  const until = input.until ?? new Date().toISOString();
  const since =
    input.since
    ?? new Date(Date.parse(until) - 30 * 24 * 3600_000).toISOString();
  const sinceMs = Date.parse(since);
  const untilMs = Date.parse(until);

  const events = listConciergeEvents({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    since,
    until,
    limit: 500,
  });

  const countType = (type: string) => events.filter((e) => e.eventType === type).length;

  const started = countType('conversation.started');
  const closed = countType('conversation.closed');
  const escalations = countType('handoff.requested') + countType('support_case.opened');
  const contained = Math.max(0, started - escalations);
  const containmentRate = started > 0 ? contained / started : null;

  const confirmed = countType('booking.confirmed');
  const cancelled = countType('booking.cancelled');
  const conversionFromConversations = started > 0 ? confirmed / started : null;

  const cases = await listSupportCases({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    limit: 100,
  }).catch(() => []);

  const firstResponseMinutes: number[] = [];
  const resolutionMinutes: number[] = [];
  let opened = 0;
  let resolved = 0;
  for (const c of cases) {
    if (!inWindow(c.createdAt, sinceMs, untilMs)) continue;
    opened += 1;
    if (c.firstRespondedAt) {
      firstResponseMinutes.push(
        (Date.parse(c.firstRespondedAt) - Date.parse(c.createdAt)) / 60_000,
      );
    }
    if (c.resolvedAt && (c.status === 'resolved' || c.status === 'closed')) {
      resolved += 1;
      resolutionMinutes.push((Date.parse(c.resolvedAt) - Date.parse(c.createdAt)) / 60_000);
    }
  }

  const bookings = listBookings(input.workspaceId).filter((b) =>
    inWindow(b.createdAt, sinceMs, untilMs),
  );
  let inviteSent = 0;
  let inviteAccepted = 0;
  let inviteFailed = 0;
  let noShow = 0;
  let attended = 0;
  let providerErrors = 0;
  let actionRequired = 0;

  for (const b of bookings) {
    const state = b.invitationDeliveryState ?? 'pending';
    if (state === 'sent' || state === 'delivered' || state === 'accepted' || state === 'declined') {
      inviteSent += 1;
    }
    if (state === 'accepted') inviteAccepted += 1;
    if (state === 'failed') inviteFailed += 1;
    if (b.sessionOutcome === 'no_show') noShow += 1;
    if (b.sessionOutcome === 'attended') attended += 1;
    if (b.orchestrationStatus === 'action_required') actionRequired += 1;
    const ops = listProviderOperationsForBooking(input.workspaceId, b.id);
    providerErrors += ops.filter(
      (op) => op.status === 'failed' || op.status === 'action_required',
    ).length;
  }

  // Prefer durable event counts when present; fall back to booking ledger.
  const eventConfirmed = confirmed || bookings.filter((b) => b.status === 'confirmed' || (b.status as string) === 'completed').length;
  const eventCancelled = cancelled || bookings.filter((b) => b.status === 'cancelled').length;

  return {
    window: { since, until },
    conversations: {
      started,
      closed,
      containmentRate,
      escalations,
    },
    support: {
      opened,
      resolved,
      firstResponseSamples: firstResponseMinutes.length,
      medianFirstResponseMinutes: median(firstResponseMinutes),
      medianResolutionMinutes: median(resolutionMinutes),
    },
    bookings: {
      confirmed: eventConfirmed,
      cancelled: eventCancelled,
      conversionFromConversations,
      inviteSent,
      inviteAccepted,
      inviteFailed,
      noShow,
      attended,
    },
    providers: {
      errors: providerErrors,
      actionRequired,
    },
    revenue: {
      attributedBookings: eventConfirmed,
      note: 'Revenue amounts are not inferred; only booking counts are attributed without message content.',
    },
    eventsSampled: events.length,
  };
}

export function assertNoMessageBodiesInAnalyticsPayload(
  events: ConciergeEventRecord[],
): boolean {
  for (const e of events) {
    for (const [key, value] of Object.entries(e.payload)) {
      if (/message|body|content|transcript/i.test(key) && typeof value === 'string') {
        if (value !== '[REDACTED_CONTENT]' && value.length > 40) return false;
      }
    }
  }
  return true;
}
