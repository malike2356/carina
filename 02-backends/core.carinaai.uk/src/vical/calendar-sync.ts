/**
 * viCal external calendar sync via provider-neutral adapters (Prompt 704).
 * Invitations request sendUpdates=all. Failures do not pretend delivery succeeded.
 */
import crypto from 'crypto';
import type { VcalBooking, VcalLocationMode } from './types.js';
import { getBooking, getEventType } from './bookings.js';
import { mutateVicalStore } from './store.js';
import { GoogleCalendarAdapter } from './calendar/google-adapter.js';
import { MicrosoftCalendarAdapter } from './calendar/microsoft-adapter.js';
import {
  recordDeliveryAttempt,
  updateParticipantDelivery,
  upsertCalendarProjection,
  upsertWatchChannel,
} from './calendar/projection-store.js';
import { invokeProductTool } from '../workers/product-tools/invoke.js';
import type { CalendarAdapter } from './calendar/types.js';

function nowIso(): string {
  return new Date().toISOString();
}

export type CalendarSyncResult = {
  ok: boolean;
  booking: VcalBooking;
  warning?: string;
  skipped?: boolean;
  invitationSendRequested?: boolean;
  deliveryState?: string;
};

function patchBooking(
  workspaceId: string,
  bookingId: string,
  patch: Partial<VcalBooking> & { metadata?: Record<string, unknown> },
): VcalBooking {
  let next: VcalBooking | null = null;
  mutateVicalStore((store) => {
    const idx = store.bookings.findIndex((b) => b.workspaceId === workspaceId && b.id === bookingId);
    if (idx < 0) return;
    next = {
      ...store.bookings[idx]!,
      ...patch,
      metadata: {
        ...store.bookings[idx]!.metadata,
        ...(patch.metadata ?? {}),
      },
      updatedAt: nowIso(),
    };
    store.bookings[idx] = next;
  });
  return next ?? (getBooking(workspaceId, bookingId) as VcalBooking);
}

function resolveLocationMode(booking: VcalBooking, explicit?: VcalLocationMode): VcalLocationMode {
  if (explicit) return explicit;
  const et = getEventType(booking.workspaceId, booking.eventTypeId);
  return et?.locationMode ?? 'google_meet';
}

export function buildConferencePayload(mode: VcalLocationMode): Record<string, unknown> | undefined {
  if (mode !== 'google_meet') return undefined;
  return {
    createRequest: {
      requestId: crypto.randomUUID(),
      conferenceSolutionKey: { type: 'hangoutsMeet' },
    },
  };
}

export function extractJoinLink(
  calendarData: Record<string, unknown>,
  mode: VcalLocationMode,
  zoomRoomUrl?: string,
): string | undefined {
  if (typeof calendarData.hangoutLink === 'string' && calendarData.hangoutLink) {
    return calendarData.hangoutLink;
  }
  if (mode === 'zoom' && zoomRoomUrl) return zoomRoomUrl;
  if (typeof calendarData.htmlLink === 'string' && calendarData.htmlLink) {
    return calendarData.htmlLink;
  }
  return zoomRoomUrl;
}

function resolveAdapter(provider: 'google' | 'microsoft'): CalendarAdapter {
  return provider === 'microsoft' ? new MicrosoftCalendarAdapter() : new GoogleCalendarAdapter();
}

function guestManageLinks(booking: VcalBooking): string {
  const base =
    process.env.AIVA_APP_URL?.trim()
    || process.env.NEXT_PUBLIC_APP_URL?.trim()
    || 'https://app.carinaai.uk';
  return [
    `Guest cancel/reschedule token: ${booking.guestToken}`,
    `Manage: ${base.replace(/\/$/, '')}/book/manage/${booking.guestToken}`,
  ].join('\n');
}

async function maybeRegisterGoogleWatch(input: {
  workspaceId: string;
  workerId: string;
  bookingId: string;
}): Promise<void> {
  const token = process.env.AIVA_CONCIERGE_GOOGLE_CALENDAR_WEBHOOK_TOKEN?.trim();
  const address =
    process.env.AIVA_CONCIERGE_GOOGLE_CALENDAR_WEBHOOK_URL?.trim()
    || `${(process.env.CARINA_PUBLIC_API_URL || process.env.CORE_PUBLIC_URL || 'https://core.carinaai.uk').replace(/\/$/, '')}/api/webhooks/google-calendar`;
  if (!token) return;
  const channelId = crypto.randomUUID();
  const result = await invokeProductTool({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    slug: 'google-calendar',
    action: 'watch',
    input: {
      address,
      token,
      channelId,
      expiration: String(Date.now() + 6 * 24 * 60 * 60_000),
    },
  });
  if (!result.ok || !result.data || typeof result.data !== 'object') return;
  const data = result.data as Record<string, unknown>;
  const resourceId = typeof data.resourceId === 'string' ? data.resourceId : '';
  const expiration = data.expiration != null ? String(data.expiration) : new Date(Date.now() + 86400000).toISOString();
  if (!resourceId) return;
  upsertWatchChannel({
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    provider: 'google',
    channelId: typeof data.id === 'string' ? data.id : channelId,
    resourceId,
    resourceUri: typeof data.resourceUri === 'string' ? data.resourceUri : null,
    token,
    expiration: /^\d+$/.test(expiration)
      ? new Date(Number(expiration)).toISOString()
      : expiration,
    bookingId: input.bookingId,
  });
  upsertCalendarProjection({
    workspaceId: input.workspaceId,
    bookingId: input.bookingId,
    result: {
      ok: true,
      status: 'succeeded',
      provider: 'google',
      providerEventId: getBooking(input.workspaceId, input.bookingId)?.calendarEventId ?? null,
      attendees: [],
      invitationSendRequested: true,
    },
    watch: {
      watchChannelId: typeof data.id === 'string' ? data.id : channelId,
      watchResourceId: resourceId,
      watchExpiresAt: /^\d+$/.test(expiration)
        ? new Date(Number(expiration)).toISOString()
        : expiration,
    },
  });
}

/** Create or replace host calendar event and request guest invitation updates. */
export async function syncBookingToGoogleCalendar(input: {
  workspaceId: string;
  workerId: string;
  bookingId: string;
  locationMode?: VcalLocationMode;
  zoomRoomUrl?: string;
  provider?: 'google' | 'microsoft';
  sendUpdates?: 'all' | 'externalOnly' | 'none';
}): Promise<CalendarSyncResult> {
  const booking = getBooking(input.workspaceId, input.bookingId);
  if (!booking) throw new Error('Booking not found');
  if (booking.status === 'cancelled' || booking.status === 'rejected') {
    return { ok: true, booking, skipped: true, warning: 'Skip calendar sync for cancelled/rejected booking' };
  }

  const mode = resolveLocationMode(booking, input.locationMode);
  if (mode === 'none' || mode === 'phone' || mode === 'in_person') {
    const next = patchBooking(input.workspaceId, booking.id, {
      calendarSyncStatus: 'skipped',
      calendarProvider: 'none',
      calendarSyncError: undefined,
      invitationDeliveryState: 'unknown',
      metadata: { calendar_worker_id: input.workerId },
    });
    return { ok: true, booking: next, skipped: true };
  }
  if (mode === 'teams' || input.provider === 'microsoft') {
    const adapter = resolveAdapter('microsoft');
    const result = await adapter.createEvent({
      workspaceId: input.workspaceId,
      workerId: input.workerId,
      bookingId: booking.id,
      summary: `Meeting with ${booking.guestName}`,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      timezone: booking.timezone,
      guestEmail: booking.guestEmail,
      guestName: booking.guestName,
      idempotencyKey: `ms:create:${booking.idempotencyKey ?? booking.id}`,
      sendUpdates: input.sendUpdates ?? 'all',
    });
    const next = patchBooking(input.workspaceId, booking.id, {
      calendarSyncStatus: 'failed',
      calendarProvider: 'microsoft',
      calendarSyncError: result.errorMessage ?? 'Microsoft Calendar not configured',
      invitationDeliveryState: 'failed',
      metadata: { calendar_worker_id: input.workerId },
    });
    return {
      ok: false,
      booking: next,
      warning: result.errorMessage ?? 'Microsoft Calendar not configured',
      skipped: true,
      deliveryState: 'failed',
    };
  }

  const description = [
    `Guest: ${booking.guestName} <${booking.guestEmail}>`,
    booking.notes ? `Notes: ${booking.notes}` : '',
    booking.meetingUrl || input.zoomRoomUrl
      ? `Join: ${booking.meetingUrl || input.zoomRoomUrl}`
      : '',
    guestManageLinks(booking),
    `viCal booking ${booking.id}`,
  ]
    .filter(Boolean)
    .join('\n');

  const adapter = resolveAdapter('google');
  const sendUpdates = input.sendUpdates ?? 'all';
  const result = await adapter.createEvent({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    bookingId: booking.id,
    summary: `Meeting with ${booking.guestName}`,
    description,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    timezone: booking.timezone,
    location: mode === 'zoom' ? input.zoomRoomUrl || booking.meetingUrl : undefined,
    guestEmail: booking.guestEmail,
    guestName: booking.guestName,
    conferenceData: buildConferencePayload(mode),
    sendUpdates,
    idempotencyKey: `gcal:create:${booking.idempotencyKey ?? booking.id}`,
  });

  if (!result.ok) {
    const next = patchBooking(input.workspaceId, booking.id, {
      calendarSyncStatus: 'failed',
      calendarProvider: 'google',
      calendarSyncError: result.errorMessage ?? 'calendar create failed',
      invitationDeliveryState: 'failed',
      metadata: { calendar_worker_id: input.workerId },
    });
    upsertCalendarProjection({
      workspaceId: input.workspaceId,
      bookingId: booking.id,
      result,
    });
    recordDeliveryAttempt({
      workspaceId: input.workspaceId,
      bookingId: booking.id,
      channel: 'google_invitation',
      state: 'failed',
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    });
    updateParticipantDelivery({
      workspaceId: input.workspaceId,
      bookingId: booking.id,
      email: booking.guestEmail,
      deliveryState: 'failed',
    });
    return {
      ok: false,
      booking: next,
      warning: result.errorMessage ?? 'Calendar invitation failed',
      invitationSendRequested: result.invitationSendRequested,
      deliveryState: 'failed',
    };
  }

  const joinLink =
    result.joinUrl
    || extractJoinLink(result.raw ?? {}, mode, input.zoomRoomUrl)
    || booking.meetingUrl;
  const projection = upsertCalendarProjection({
    workspaceId: input.workspaceId,
    bookingId: booking.id,
    result,
  });
  updateParticipantDelivery({
    workspaceId: input.workspaceId,
    bookingId: booking.id,
    email: booking.guestEmail,
    deliveryState: 'sent',
    responseStatus: 'needsAction',
  });
  recordDeliveryAttempt({
    workspaceId: input.workspaceId,
    bookingId: booking.id,
    channel: 'google_invitation',
    state: 'sent',
    providerMessageId: result.providerEventId,
  });

  const next = patchBooking(input.workspaceId, booking.id, {
    calendarEventId: result.providerEventId ?? booking.calendarEventId,
    meetingUrl: joinLink,
    calendarProvider: 'google',
    calendarSyncStatus: 'synced',
    calendarSyncError: undefined,
    invitationDeliveryState: 'sent',
    calendarProjectionId: projection.id,
    metadata: {
      calendar_worker_id: input.workerId,
      aiva_managed_calendar: true,
      invitation_send_requested: result.invitationSendRequested,
      calendar_etag: result.etag,
    },
  });

  await maybeRegisterGoogleWatch({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    bookingId: booking.id,
  }).catch(() => undefined);

  return {
    ok: true,
    booking: next,
    invitationSendRequested: result.invitationSendRequested,
    deliveryState: 'sent',
  };
}

export async function updateBookingGoogleCalendar(input: {
  workspaceId: string;
  workerId: string;
  bookingId: string;
  zoomRoomUrl?: string;
  sendUpdates?: 'all' | 'externalOnly' | 'none';
}): Promise<CalendarSyncResult> {
  const booking = getBooking(input.workspaceId, input.bookingId);
  if (!booking) throw new Error('Booking not found');
  if (!booking.calendarEventId) {
    return syncBookingToGoogleCalendar(input);
  }
  const mode = resolveLocationMode(booking);
  const adapter = resolveAdapter('google');
  const result = await adapter.updateEvent({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    bookingId: booking.id,
    providerEventId: booking.calendarEventId,
    summary: `Meeting with ${booking.guestName}`,
    description: [
      booking.meetingUrl ? `Join: ${booking.meetingUrl}` : '',
      guestManageLinks(booking),
    ]
      .filter(Boolean)
      .join('\n'),
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    timezone: booking.timezone,
    location: mode === 'zoom' ? input.zoomRoomUrl || booking.meetingUrl : undefined,
    guestEmail: booking.guestEmail,
    guestName: booking.guestName,
    sendUpdates: input.sendUpdates ?? 'all',
    idempotencyKey: `gcal:update:${booking.idempotencyKey ?? booking.id}:${booking.startsAt}`,
  });
  if (!result.ok) {
    const next = patchBooking(input.workspaceId, booking.id, {
      calendarSyncStatus: 'failed',
      calendarSyncError: result.errorMessage ?? 'calendar update failed',
    });
    return { ok: false, booking: next, warning: result.errorMessage ?? 'Calendar update failed' };
  }
  upsertCalendarProjection({
    workspaceId: input.workspaceId,
    bookingId: booking.id,
    result,
  });
  recordDeliveryAttempt({
    workspaceId: input.workspaceId,
    bookingId: booking.id,
    channel: 'google_invitation',
    state: 'sent',
    providerMessageId: result.providerEventId,
  });
  const next = patchBooking(input.workspaceId, booking.id, {
    calendarSyncStatus: 'synced',
    calendarSyncError: undefined,
    invitationDeliveryState: booking.invitationDeliveryState === 'accepted'
      ? 'accepted'
      : 'sent',
    metadata: { calendar_etag: result.etag },
  });
  return { ok: true, booking: next, invitationSendRequested: true, deliveryState: next.invitationDeliveryState };
}

export async function deleteBookingGoogleCalendar(input: {
  workspaceId: string;
  workerId: string;
  bookingId: string;
  sendUpdates?: 'all' | 'externalOnly' | 'none';
}): Promise<CalendarSyncResult> {
  const booking = getBooking(input.workspaceId, input.bookingId);
  if (!booking) throw new Error('Booking not found');
  if (!booking.calendarEventId) {
    return { ok: true, booking, skipped: true };
  }
  const adapter = resolveAdapter('google');
  const result = await adapter.deleteEvent({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    bookingId: booking.id,
    providerEventId: booking.calendarEventId,
    sendUpdates: input.sendUpdates ?? 'all',
    idempotencyKey: `gcal:delete:${booking.idempotencyKey ?? booking.id}`,
  });
  if (!result.ok) {
    const next = patchBooking(input.workspaceId, booking.id, {
      calendarSyncStatus: 'failed',
      calendarSyncError: result.errorMessage ?? 'calendar delete failed',
    });
    return { ok: false, booking: next, warning: result.errorMessage ?? 'Calendar delete failed' };
  }
  recordDeliveryAttempt({
    workspaceId: input.workspaceId,
    bookingId: booking.id,
    channel: 'google_invitation',
    state: 'sent',
    providerMessageId: booking.calendarEventId,
  });
  const next = patchBooking(input.workspaceId, booking.id, {
    calendarSyncStatus: 'synced',
    calendarSyncError: undefined,
    metadata: { calendar_deleted: true },
  });
  return { ok: true, booking: next, invitationSendRequested: true };
}
