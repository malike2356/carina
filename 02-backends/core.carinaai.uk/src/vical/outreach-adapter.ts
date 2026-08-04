import type { BookingConfig, BookingStatus, OutreachBooking } from '../outreach/types.js';
import type { VcalBooking, VcalBusyWindow } from './types.js';
import {
  cancelBookingForHost,
  createBlackout,
  createFromOutreach,
  getBooking as getVicalBooking,
  listBlackouts,
  listBookings as listVicalBookings,
  listOfferedSlots,
  rescheduleBooking as rescheduleVicalBooking,
  setSessionOutcome,
} from './bookings.js';
import { ensureDiscoveryDefaults } from './seed.js';
import { syncConfigFromOutreach, readConfigAsOutreach } from './config-bridge.js';
import { loadVicalStore, mutateVicalStore } from './store.js';
import { SlotUnavailableError } from './errors.js';
import { resolveVicalHostUserId } from '../outreach/vical-cutover.js';

function nowIso(d = new Date()): string {
  return d.toISOString();
}

export function mapVicalStatusToOutreach(booking: VcalBooking): BookingStatus {
  if (booking.sessionOutcome === 'attended') return 'attended';
  if (booking.sessionOutcome === 'no_show') return 'no_show';
  if (booking.status === 'cancelled' || booking.status === 'rejected') return 'cancelled';
  if (booking.status === 'pending_review' || booking.status === 'pending_payment') return 'confirmed';
  return 'confirmed';
}

export function mapVicalToOutreachBooking(
  booking: VcalBooking,
  extras?: Partial<OutreachBooking>,
): OutreachBooking {
  const stamp = nowIso();
  return {
    id: booking.id,
    workspaceId: booking.workspaceId,
    leadId: booking.leadId ?? extras?.leadId ?? '',
    campaignId: extras?.campaignId,
    kind: extras?.kind ?? 'discovery',
    status: mapVicalStatusToOutreach(booking),
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    timezone: booking.timezone,
    attendeeEmail: booking.guestEmail,
    attendeeName: booking.guestName,
    hostEmail: extras?.hostEmail,
    hostName: extras?.hostName,
    calendarProvider: extras?.calendarProvider ?? 'local',
    calendarEventId: booking.calendarEventId ?? extras?.calendarEventId,
    joinLink: booking.meetingUrl ?? extras?.joinLink,
    confirmationSubject: extras?.confirmationSubject ?? `Confirmed: session on ${booking.startsAt}`,
    confirmationBody: extras?.confirmationBody ?? '',
    confirmationStatus: extras?.confirmationStatus ?? 'pending_approval',
    reminderIds: extras?.reminderIds ?? [],
    notes: booking.notes ?? extras?.notes,
    createdAt: booking.createdAt || stamp,
    updatedAt: booking.updatedAt || stamp,
  };
}

export function listVicalBusyWindows(workspaceId: string): VcalBusyWindow[] {
  return listVicalBookings(workspaceId)
    .filter((b) => b.status === 'confirmed' || b.status === 'pending_review' || b.status === 'pending_payment')
    .map((b) => ({ start: b.startsAt, end: b.endsAt }));
}

/** Union busy from viCal + optional legacy outreach windows (transition safety). */
export function unionBusyWindows(...groups: Array<VcalBusyWindow[] | undefined>): VcalBusyWindow[] {
  const out: VcalBusyWindow[] = [];
  for (const group of groups) {
    if (!group) continue;
    for (const window of group) {
      if (!window.start || !window.end) continue;
      out.push(window);
    }
  }
  return out;
}

export function ensureOutreachVicalWorkspace(
  workspaceId: string,
  config: BookingConfig,
  hostUserId?: string,
): { hostUserId: string; eventTypeId: string } {
  const host = resolveVicalHostUserId(hostUserId);
  const { eventType } = ensureDiscoveryDefaults({
    workspaceId,
    hostUserId: host,
    timezone: config.timezone,
  });
  syncConfigFromOutreach(workspaceId, host, config);

  // Apply blocked dates as blackouts (outreach config field).
  const existing = new Set(listBlackouts(workspaceId).map((b) => `${b.startsOn}:${b.endsOn}`));
  for (const day of config.blockedDates ?? []) {
    const key = `${day}:${day}`;
    if (existing.has(key)) continue;
    createBlackout({
      workspaceId,
      hostUserId: host,
      startsOn: day,
      endsOn: day,
      reason: 'outreach_blocked_date',
    });
  }

  return { hostUserId: host, eventTypeId: eventType.id };
}

export function offerSlotsViaVical(input: {
  workspaceId: string;
  config: BookingConfig;
  from: Date;
  limit?: number;
  externalBusy?: VcalBusyWindow[];
  legacyBusy?: VcalBusyWindow[];
  hostUserId?: string;
}): Array<{ start: string; end: string; timezone: string }> {
  const { eventTypeId } = ensureOutreachVicalWorkspace(input.workspaceId, input.config, input.hostUserId);
  return listOfferedSlots({
    workspaceId: input.workspaceId,
    eventTypeId,
    from: input.from,
    limit: input.limit ?? 5,
    externalBusy: unionBusyWindows(input.externalBusy, input.legacyBusy),
  });
}

export function createOutreachBookingViaVical(input: {
  workspaceId: string;
  leadId: string;
  email: string;
  name: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  config: BookingConfig;
  meetingUrl?: string;
  notes?: string;
  externalBusy?: VcalBusyWindow[];
  legacyBusy?: VcalBusyWindow[];
  hostUserId?: string;
  calendarEventId?: string;
  metadata?: Record<string, unknown>;
}): VcalBooking {
  const { eventTypeId, hostUserId } = ensureOutreachVicalWorkspace(
    input.workspaceId,
    input.config,
    input.hostUserId,
  );
  try {
    const booking = createFromOutreach({
      workspaceId: input.workspaceId,
      leadId: input.leadId,
      email: input.email,
      name: input.name,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      eventTypeId,
      timezone: input.timezone,
      meetingUrl: input.meetingUrl,
      notes: input.notes,
      externalBusy: unionBusyWindows(input.externalBusy, input.legacyBusy),
      metadata: {
        ...(input.metadata ?? {}),
        outreach_booking_id: undefined,
        calendar_event_id: input.calendarEventId,
        host_user_id: hostUserId,
      },
    });
    if (input.calendarEventId || input.meetingUrl) {
      mutateVicalStore((store) => {
        const idx = store.bookings.findIndex((b) => b.id === booking.id);
        if (idx >= 0) {
          store.bookings[idx] = {
            ...store.bookings[idx]!,
            calendarEventId: input.calendarEventId ?? store.bookings[idx]!.calendarEventId,
            meetingUrl: input.meetingUrl ?? store.bookings[idx]!.meetingUrl,
            metadata: {
              ...store.bookings[idx]!.metadata,
              outreach_booking_id: booking.id,
            },
            updatedAt: nowIso(),
          };
        }
      });
    } else {
      mutateVicalStore((store) => {
        const idx = store.bookings.findIndex((b) => b.id === booking.id);
        if (idx >= 0) {
          store.bookings[idx] = {
            ...store.bookings[idx]!,
            metadata: {
              ...store.bookings[idx]!.metadata,
              outreach_booking_id: booking.id,
            },
          };
        }
      });
    }
    return getVicalBooking(input.workspaceId, booking.id) ?? booking;
  } catch (error) {
    if (error instanceof SlotUnavailableError) {
      throw new Error(error.message);
    }
    throw error;
  }
}

export function rescheduleOutreachBookingViaVical(input: {
  workspaceId: string;
  bookingId: string;
  startsAt: string;
  endsAt: string;
  externalBusy?: VcalBusyWindow[];
  legacyBusy?: VcalBusyWindow[];
}): VcalBooking {
  try {
    return rescheduleVicalBooking({
      workspaceId: input.workspaceId,
      bookingId: input.bookingId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      externalBusy: unionBusyWindows(input.externalBusy, input.legacyBusy),
    });
  } catch (error) {
    if (error instanceof SlotUnavailableError) {
      throw new Error(error.message);
    }
    throw error;
  }
}

export function cancelOutreachBookingViaVical(
  workspaceId: string,
  bookingId: string,
  reason?: string,
): VcalBooking {
  return cancelBookingForHost(workspaceId, bookingId, reason);
}

export function setOutreachOutcomeViaVical(
  workspaceId: string,
  bookingId: string,
  outcome: 'attended' | 'no_show',
): VcalBooking {
  return setSessionOutcome(workspaceId, bookingId, outcome);
}

export function readMergedBookingConfig(
  workspaceId: string,
  fallback: BookingConfig,
  hostUserId?: string,
): BookingConfig {
  const host = resolveVicalHostUserId(hostUserId);
  ensureDiscoveryDefaults({ workspaceId, hostUserId: host, timezone: fallback.timezone });
  const fromVical = readConfigAsOutreach(workspaceId, host);
  if (!fromVical) return fallback;
  return {
    ...fallback,
    ...fromVical,
    // Prep video + Zoom room stay on outreach config (product fields not in viCal rules).
    zoomRoomUrl: fallback.zoomRoomUrl,
    prepVideoUrl: fallback.prepVideoUrl,
    prepVideoTitle: fallback.prepVideoTitle,
    prepVideoPassword: fallback.prepVideoPassword,
    reminderOffsetsMinutes: fallback.reminderOffsetsMinutes,
    meetingMode: fromVical.meetingMode ?? fallback.meetingMode,
  };
}

/**
 * One-shot backfill: copy active outreach JSON bookings into viCal for a workspace.
 * Skips rows that already exist in viCal (by id or metadata.outreach_booking_id).
 */
export function backfillOutreachBookingsToVical(input: {
  workspaceId: string;
  hostUserId?: string;
  outreachBookings: OutreachBooking[];
  config: BookingConfig;
}): { created: number; skipped: number } {
  const host = resolveVicalHostUserId(input.hostUserId);
  ensureOutreachVicalWorkspace(input.workspaceId, input.config, host);
  const existing = loadVicalStore().bookings.filter((b) => b.workspaceId === input.workspaceId);
  const byId = new Set(existing.map((b) => b.id));
  const byOutreachId = new Set(
    existing
      .map((b) => String(b.metadata?.outreach_booking_id ?? ''))
      .filter(Boolean),
  );

  let created = 0;
  let skipped = 0;
  const stamp = nowIso();

  mutateVicalStore((store) => {
    for (const row of input.outreachBookings) {
      if (row.workspaceId !== input.workspaceId) continue;
      if (row.status === 'cancelled' || row.status === 'rescheduled') {
        skipped += 1;
        continue;
      }
      if (byId.has(row.id) || byOutreachId.has(row.id)) {
        skipped += 1;
        continue;
      }
      const eventType =
        store.eventTypes.find((e) => e.workspaceId === input.workspaceId && e.slug === 'discovery-call') ??
        store.eventTypes.find((e) => e.workspaceId === input.workspaceId);
      if (!eventType) {
        skipped += 1;
        continue;
      }
      store.bookings.push({
        id: row.id,
        workspaceId: row.workspaceId,
        eventTypeId: eventType.id,
        hostUserId: host,
        guestName: row.attendeeName || 'Guest',
        guestEmail: (row.attendeeEmail || 'unknown@example.com').toLowerCase(),
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        timezone: row.timezone || input.config.timezone,
        status: 'confirmed',
        guestToken: `backfill-${row.id}`,
        meetingUrl: row.joinLink,
        calendarEventId: row.calendarEventId,
        leadId: row.leadId,
        source: 'outreach',
        notes: row.notes,
        sessionOutcome: row.status === 'attended' || row.status === 'no_show' ? row.status : undefined,
        metadata: {
          outreach_booking_id: row.id,
          backfilled_at: stamp,
        },
        createdAt: row.createdAt || stamp,
        updatedAt: stamp,
      });
      created += 1;
    }
  });

  return { created, skipped };
}
