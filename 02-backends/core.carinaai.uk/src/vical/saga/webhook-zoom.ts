/**
 * Zoom inbound webhook validation, dedupe, and meeting reconciliation (Prompt 703).
 */

import crypto from 'crypto';
import { zoomWebhookSecret } from '../../workers/product-tools/zoom-oauth.js';
import { getBooking } from '../bookings.js';
import { redactConferencingSecrets } from '../conferencing/redact.js';
import { loadVicalStore, mutateVicalStore } from '../store.js';
import { markWebhookProcessed, reserveWebhookReceipt } from './ledger.js';

export function verifyZoomWebhookSignature(input: {
  rawBody: string;
  timestamp: string;
  signature: string;
  secret?: string;
}): boolean {
  const secret = input.secret ?? zoomWebhookSecret();
  if (!secret || !input.timestamp || !input.signature) return false;
  const msg = `v0:${input.timestamp}:${input.rawBody}`;
  const expected = `v0=${crypto.createHmac('sha256', secret).update(msg).digest('hex')}`;
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(input.signature);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function buildZoomUrlValidationResponse(plainToken: string, secret?: string): {
  plainToken: string;
  encryptedToken: string;
} {
  const token = secret ?? zoomWebhookSecret();
  return {
    plainToken,
    encryptedToken: crypto.createHmac('sha256', token).update(plainToken).digest('hex'),
  };
}

export type ZoomWebhookHandleResult = {
  ok: boolean;
  duplicate?: boolean;
  rejected?: boolean;
  reason?: string;
  bookingId?: string;
};

export function handleZoomWebhookEvent(input: {
  event: string;
  eventTs?: number | string;
  payload: Record<string, unknown>;
  workspaceIdHint?: string;
}): ZoomWebhookHandleResult {
  const object = (input.payload.object ?? input.payload) as Record<string, unknown>;
  const meetingId = object.id != null ? String(object.id) : '';
  const eventId = [
    input.event,
    meetingId,
    String(input.eventTs ?? ''),
    String(object.uuid ?? ''),
  ].join(':');

  const { receipt, duplicate } = reserveWebhookReceipt({
    provider: 'zoom',
    eventId,
    eventType: input.event,
    workspaceId: input.workspaceIdHint,
    payloadSafe: redactConferencingSecrets({
      event: input.event,
      meetingId,
      topic: object.topic,
      start_time: object.start_time,
    }) as Record<string, unknown>,
  });
  if (duplicate) {
    return { ok: true, duplicate: true };
  }

  if (!meetingId) {
    markWebhookProcessed(receipt.id, 'rejected');
    return { ok: false, rejected: true, reason: 'missing_meeting_id' };
  }

  const artifact =
    loadVicalStore().conferenceArtifacts.find((a) => a.providerMeetingId === meetingId) ?? null;
  if (!artifact) {
    markWebhookProcessed(receipt.id, 'processed');
    return { ok: true, reason: 'no_local_artifact' };
  }

  if (input.event === 'meeting.deleted' || input.event === 'meeting.ended') {
    if (input.event === 'meeting.deleted') {
      mutateVicalStore((store) => {
        const idx = store.bookings.findIndex(
          (b) => b.id === artifact.bookingId && b.workspaceId === artifact.workspaceId,
        );
        if (idx < 0) return;
        if (store.bookings[idx]!.status === 'cancelled') return;
        store.bookings[idx] = {
          ...store.bookings[idx]!,
          orchestrationStatus: 'action_required',
          actionRequiredReason: 'zoom_meeting_deleted_remotely',
          updatedAt: new Date().toISOString(),
        };
      });
    }
    markWebhookProcessed(receipt.id, 'processed');
    return { ok: true, bookingId: artifact.bookingId };
  }

  if (input.event === 'meeting.updated') {
    const joinUrl = typeof object.join_url === 'string' ? object.join_url : undefined;
    if (joinUrl) {
      mutateVicalStore((store) => {
        const aIdx = store.conferenceArtifacts.findIndex((a) => a.id === artifact.id);
        if (aIdx >= 0) {
          store.conferenceArtifacts[aIdx] = {
            ...store.conferenceArtifacts[aIdx]!,
            joinUrl,
            updatedAt: new Date().toISOString(),
          };
        }
        const bIdx = store.bookings.findIndex(
          (b) => b.id === artifact.bookingId && b.workspaceId === artifact.workspaceId,
        );
        if (bIdx >= 0) {
          store.bookings[bIdx] = {
            ...store.bookings[bIdx]!,
            meetingUrl: joinUrl,
            updatedAt: new Date().toISOString(),
          };
        }
      });
    }
    markWebhookProcessed(receipt.id, 'processed');
    return { ok: true, bookingId: artifact.bookingId };
  }

  markWebhookProcessed(receipt.id, 'processed');
  const booking = getBooking(artifact.workspaceId, artifact.bookingId);
  return { ok: true, bookingId: booking?.id };
}
