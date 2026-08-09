/**
 * Google Calendar push notification ingress (Prompt 704).
 * Auth: X-Goog-Channel-Token must match AIVA_CONCIERGE_GOOGLE_CALENDAR_WEBHOOK_TOKEN
 * (or the per-channel token stored at watch registration).
 */

import {
  findWatchByChannelId,
  listExpiringWatchChannels,
} from '../calendar/projection-store.js';
import { reconcileGoogleEventById } from '../calendar/reconcile.js';
import { markWebhookProcessed, reserveWebhookReceipt } from './ledger.js';

export function googleCalendarWebhookToken(): string {
  return process.env.AIVA_CONCIERGE_GOOGLE_CALENDAR_WEBHOOK_TOKEN?.trim() || '';
}

export function verifyGoogleCalendarWebhook(input: {
  channelToken: string;
  channelId?: string;
}): boolean {
  const expected = googleCalendarWebhookToken();
  if (!input.channelToken) return false;
  if (expected && input.channelToken === expected) return true;
  if (input.channelId) {
    const watch = findWatchByChannelId(input.channelId);
    if (watch && watch.token === input.channelToken) return true;
  }
  return false;
}

export type GoogleWebhookHandleResult = {
  ok: boolean;
  duplicate?: boolean;
  rejected?: boolean;
  reason?: string;
  bookingId?: string;
  deliveryState?: string;
};

export async function handleGoogleCalendarWebhook(input: {
  channelId: string;
  resourceId: string;
  resourceState: string;
  messageNumber?: string;
  channelToken: string;
  resourceUri?: string;
  workerIdHint?: string;
}): Promise<GoogleWebhookHandleResult> {
  if (!verifyGoogleCalendarWebhook({
    channelToken: input.channelToken,
    channelId: input.channelId,
  })) {
    return { ok: false, rejected: true, reason: 'invalid_token' };
  }

  const eventId = [
    'gcal',
    input.channelId,
    input.resourceId,
    input.resourceState,
    input.messageNumber ?? '',
  ].join(':');

  const { receipt, duplicate } = reserveWebhookReceipt({
    provider: 'google_calendar',
    eventId,
    eventType: input.resourceState || 'exists',
    payloadSafe: {
      channelId: input.channelId,
      resourceId: input.resourceId,
      resourceState: input.resourceState,
      messageNumber: input.messageNumber,
    },
  });
  if (duplicate) {
    return { ok: true, duplicate: true };
  }

  if (input.resourceState === 'sync') {
    markWebhookProcessed(receipt.id, 'processed');
    return { ok: true, reason: 'sync_handshake' };
  }

  const watch = findWatchByChannelId(input.channelId);
  const providerEventId = extractEventIdFromResourceUri(input.resourceUri);
  if (!providerEventId) {
    markWebhookProcessed(receipt.id, 'processed');
    return { ok: true, reason: 'no_event_id' };
  }

  const reconciled = await reconcileGoogleEventById({
    workspaceId: watch?.workspaceId ?? '',
    workerId: input.workerIdHint || watch?.workerId || 'default-host',
    providerEventId,
  });
  markWebhookProcessed(receipt.id, reconciled.ok ? 'processed' : 'rejected');
  return {
    ok: reconciled.ok,
    bookingId: reconciled.bookingId,
    deliveryState: reconciled.deliveryState,
    reason: reconciled.reason,
  };
}

function extractEventIdFromResourceUri(uri?: string): string | null {
  if (!uri) return null;
  const match = uri.match(/\/events\/([^/?#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/** Renew watches that expire within 24h (best-effort; used by periodic repair). */
export function listWatchesNeedingRenewal() {
  return listExpiringWatchChannels(24 * 60 * 60_000);
}
