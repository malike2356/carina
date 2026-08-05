/**
 * viCal external calendar sync (Google first; Microsoft stub).
 * Soft-fail: booking stays confirmed when remote sync fails.
 */
import crypto from 'crypto';
import { invokeProductTool } from '../workers/product-tools/invoke.js';
import type { VcalBooking, VcalLocationMode } from './types.js';
import { getBooking, getEventType } from './bookings.js';
import { mutateVicalStore } from './store.js';

function nowIso(): string {
  return new Date().toISOString();
}

export type CalendarSyncResult = {
  ok: boolean;
  booking: VcalBooking;
  warning?: string;
  skipped?: boolean;
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

/** Create or replace Google Calendar event for a confirmed booking. Soft-fail. */
export async function syncBookingToGoogleCalendar(input: {
  workspaceId: string;
  workerId: string;
  bookingId: string;
  locationMode?: VcalLocationMode;
  zoomRoomUrl?: string;
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
      metadata: { calendar_worker_id: input.workerId },
    });
    return { ok: true, booking: next, skipped: true };
  }
  if (mode === 'teams') {
    const next = patchBooking(input.workspaceId, booking.id, {
      calendarSyncStatus: 'skipped',
      calendarSyncError: 'Microsoft Teams sync not configured',
      metadata: { calendar_worker_id: input.workerId },
    });
    return { ok: false, booking: next, warning: 'Microsoft Teams sync not configured', skipped: true };
  }

  const description = [
    `Guest: ${booking.guestName} <${booking.guestEmail}>`,
    booking.notes ? `Notes: ${booking.notes}` : '',
    `viCal booking ${booking.id}`,
  ]
    .filter(Boolean)
    .join('\n');

  const payload: Record<string, unknown> = {
    summary: `Meeting with ${booking.guestName}`,
    start: booking.startsAt,
    end: booking.endsAt,
    description,
    attendees: booking.guestEmail ? [{ email: booking.guestEmail, responseStatus: 'needsAction' }] : undefined,
  };
  const conferenceData = buildConferencePayload(mode);
  if (conferenceData) payload.conferenceData = conferenceData;
  if (mode === 'zoom' && input.zoomRoomUrl) payload.location = input.zoomRoomUrl;

  try {
    const result = await invokeProductTool({
      workspaceId: input.workspaceId,
      workerId: input.workerId,
      slug: 'google-calendar',
      action: 'create',
      input: payload,
    });
    if (!result.ok) {
      const next = patchBooking(input.workspaceId, booking.id, {
        calendarSyncStatus: 'failed',
        calendarProvider: 'google',
        calendarSyncError: result.error ?? 'calendar create failed',
        metadata: { calendar_worker_id: input.workerId },
      });
      return {
        ok: false,
        booking: next,
        warning: `Calendar sync failed; booking stays confirmed. ${result.error ?? ''}`.trim(),
      };
    }
    const data = (result.data ?? {}) as Record<string, unknown>;
    const joinLink = extractJoinLink(data, mode, input.zoomRoomUrl) ?? booking.meetingUrl;
    const next = patchBooking(input.workspaceId, booking.id, {
      calendarEventId: typeof data.id === 'string' ? data.id : booking.calendarEventId,
      meetingUrl: joinLink,
      calendarProvider: 'google',
      calendarSyncStatus: 'synced',
      calendarSyncError: undefined,
      metadata: {
        calendar_worker_id: input.workerId,
        aiva_managed_calendar: true,
      },
    });
    return { ok: true, booking: next };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const next = patchBooking(input.workspaceId, booking.id, {
      calendarSyncStatus: 'failed',
      calendarProvider: 'google',
      calendarSyncError: message,
      metadata: { calendar_worker_id: input.workerId },
    });
    return {
      ok: false,
      booking: next,
      warning: `Calendar sync failed; booking stays confirmed. ${message}`,
    };
  }
}

export async function updateBookingGoogleCalendar(input: {
  workspaceId: string;
  workerId: string;
  bookingId: string;
}): Promise<CalendarSyncResult> {
  const booking = getBooking(input.workspaceId, input.bookingId);
  if (!booking) throw new Error('Booking not found');
  if (!booking.calendarEventId) {
    return syncBookingToGoogleCalendar(input);
  }
  try {
    const result = await invokeProductTool({
      workspaceId: input.workspaceId,
      workerId: input.workerId,
      slug: 'google-calendar',
      action: 'update',
      input: {
        eventId: booking.calendarEventId,
        start: booking.startsAt,
        end: booking.endsAt,
        summary: `Meeting with ${booking.guestName}`,
      },
    });
    if (!result.ok) {
      const next = patchBooking(input.workspaceId, booking.id, {
        calendarSyncStatus: 'failed',
        calendarSyncError: result.error ?? 'calendar update failed',
      });
      return {
        ok: false,
        booking: next,
        warning: `Calendar update failed; booking stays rescheduled. ${result.error ?? ''}`.trim(),
      };
    }
    const next = patchBooking(input.workspaceId, booking.id, {
      calendarSyncStatus: 'synced',
      calendarSyncError: undefined,
    });
    return { ok: true, booking: next };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const next = patchBooking(input.workspaceId, booking.id, {
      calendarSyncStatus: 'failed',
      calendarSyncError: message,
    });
    return { ok: false, booking: next, warning: `Calendar update failed; booking stays rescheduled. ${message}` };
  }
}

export async function deleteBookingGoogleCalendar(input: {
  workspaceId: string;
  workerId: string;
  bookingId: string;
}): Promise<CalendarSyncResult> {
  const booking = getBooking(input.workspaceId, input.bookingId);
  if (!booking) throw new Error('Booking not found');
  if (!booking.calendarEventId) {
    return { ok: true, booking, skipped: true };
  }
  try {
    const result = await invokeProductTool({
      workspaceId: input.workspaceId,
      workerId: input.workerId,
      slug: 'google-calendar',
      action: 'delete',
      input: { eventId: booking.calendarEventId },
    });
    if (!result.ok) {
      const next = patchBooking(input.workspaceId, booking.id, {
        calendarSyncStatus: 'failed',
        calendarSyncError: result.error ?? 'calendar delete failed',
      });
      return {
        ok: false,
        booking: next,
        warning: `Calendar delete failed; booking stays cancelled. ${result.error ?? ''}`.trim(),
      };
    }
    const next = patchBooking(input.workspaceId, booking.id, {
      calendarSyncStatus: 'synced',
      calendarSyncError: undefined,
      metadata: { calendar_deleted: true },
    });
    return { ok: true, booking: next };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const next = patchBooking(input.workspaceId, booking.id, {
      calendarSyncStatus: 'failed',
      calendarSyncError: message,
    });
    return { ok: false, booking: next, warning: `Calendar delete failed; booking stays cancelled. ${message}` };
  }
}
