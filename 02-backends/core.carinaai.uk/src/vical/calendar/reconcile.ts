/**
 * Reconcile Google Calendar provider state into viCal projections (Prompt 704).
 */

import { mutateVicalStore } from '../store.js';
import type { VcalBooking } from '../types.js';
import { getBooking } from '../bookings.js';
import { mapGoogleResponseToDelivery } from './delivery-state.js';
import { GoogleCalendarAdapter } from './google-adapter.js';
import {
  findProjectionByProviderEventId,
  getCalendarProjection,
  recordDeliveryAttempt,
  updateParticipantDelivery,
  upsertCalendarProjection,
} from './projection-store.js';

function nowIso(): string {
  return new Date().toISOString();
}

export type ReconcileResult = {
  ok: boolean;
  bookingId?: string;
  duplicate?: boolean;
  deliveryState?: string;
  reason?: string;
};

export async function reconcileGoogleEventById(input: {
  workspaceId: string;
  workerId: string;
  providerEventId: string;
  etag?: string | null;
}): Promise<ReconcileResult> {
  const projection =
    findProjectionByProviderEventId(input.providerEventId)
    ?? null;
  if (!projection) {
    return { ok: true, reason: 'no_local_projection' };
  }

  // Out-of-order guard: ignore stale etags when we already have a newer one.
  if (input.etag && projection.etag && input.etag === projection.etag) {
    return { ok: true, bookingId: projection.bookingId, reason: 'unchanged_etag' };
  }

  const adapter = new GoogleCalendarAdapter();
  const result = await adapter.getEvent({
    workspaceId: input.workspaceId || projection.workspaceId,
    workerId: input.workerId,
    providerEventId: input.providerEventId,
  });
  if (!result.ok) {
    upsertCalendarProjection({
      workspaceId: projection.workspaceId,
      bookingId: projection.bookingId,
      result,
    });
    return {
      ok: false,
      bookingId: projection.bookingId,
      reason: result.errorMessage ?? 'get_event_failed',
    };
  }

  upsertCalendarProjection({
    workspaceId: projection.workspaceId,
    bookingId: projection.bookingId,
    result,
  });

  let guestDelivery = projection.attendees.find((a) => a.email)?.deliveryState ?? 'sent';
  for (const attendee of result.attendees) {
    updateParticipantDelivery({
      workspaceId: projection.workspaceId,
      bookingId: projection.bookingId,
      email: attendee.email,
      deliveryState: attendee.deliveryState,
      responseStatus: attendee.responseStatus,
    });
    guestDelivery = attendee.deliveryState;
    recordDeliveryAttempt({
      workspaceId: projection.workspaceId,
      bookingId: projection.bookingId,
      channel: 'google_invitation',
      state: attendee.deliveryState,
      providerMessageId: result.providerEventId,
    });
  }

  // Provider-side time edits: pull start/end into booking when present.
  const raw = result.raw ?? {};
  const start = (raw.start as { dateTime?: string } | undefined)?.dateTime;
  const end = (raw.end as { dateTime?: string } | undefined)?.dateTime;
  if (start && end) {
    mutateVicalStore((store) => {
      const idx = store.bookings.findIndex(
        (b) => b.id === projection.bookingId && b.workspaceId === projection.workspaceId,
      );
      if (idx < 0) return;
      const booking = store.bookings[idx]!;
      if (booking.startsAt === start && booking.endsAt === end) return;
      store.bookings[idx] = {
        ...booking,
        previousStartsAt: booking.startsAt,
        previousEndsAt: booking.endsAt,
        startsAt: new Date(start).toISOString(),
        endsAt: new Date(end).toISOString(),
        updatedAt: nowIso(),
        metadata: {
          ...booking.metadata,
          reconciledFromProvider: true,
          lastProviderReconcileAt: nowIso(),
        },
      };
    });
  }

  return {
    ok: true,
    bookingId: projection.bookingId,
    deliveryState: guestDelivery,
  };
}

export function applySyntheticAttendeeResponse(input: {
  workspaceId: string;
  bookingId: string;
  email: string;
  responseStatus: string;
}): ReconcileResult {
  const booking = getBooking(input.workspaceId, input.bookingId);
  if (!booking) return { ok: false, reason: 'booking_not_found' };
  const mapped = mapGoogleResponseToDelivery(input.responseStatus);
  updateParticipantDelivery({
    workspaceId: input.workspaceId,
    bookingId: input.bookingId,
    email: input.email,
    deliveryState: mapped.deliveryState,
    responseStatus: mapped.responseStatus,
  });
  const projection = getCalendarProjection(input.workspaceId, input.bookingId);
  if (projection) {
    upsertCalendarProjection({
      workspaceId: input.workspaceId,
      bookingId: input.bookingId,
      result: {
        ok: true,
        status: 'succeeded',
        provider: projection.provider === 'none' ? 'google' : projection.provider,
        providerEventId: projection.providerEventId,
        etag: projection.etag,
        htmlLink: projection.htmlLink,
        organizerEmail: projection.organizerEmail,
        attendees: [
          {
            email: input.email.toLowerCase(),
            responseStatus: mapped.responseStatus,
            deliveryState: mapped.deliveryState,
          },
        ],
        invitationSendRequested: projection.invitationSendRequested,
      },
    });
  }
  recordDeliveryAttempt({
    workspaceId: input.workspaceId,
    bookingId: input.bookingId,
    channel: 'google_invitation',
    state: mapped.deliveryState,
  });
  return { ok: true, bookingId: booking.id, deliveryState: mapped.deliveryState };
}

export function bookingInvitationView(booking: VcalBooking): {
  invitationDeliveryState: string;
  invitationUiLabel: string;
  disclaimer: string;
} {
  const state = booking.invitationDeliveryState ?? 'pending';
  const label =
    state === 'sent'
      ? 'invitation_sent'
      : state === 'failed'
        ? 'delivery_failed'
        : state;
  return {
    invitationDeliveryState: state,
    invitationUiLabel: label,
    disclaimer:
      'Invitation sent means the provider was asked to notify the guest. It does not promise automatic insertion on the guest calendar.',
  };
}
