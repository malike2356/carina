import crypto from 'crypto';
import { getCampaign, getLead, updateLead } from './leads.js';
import { appendTimeline, transitionLeadStatus } from './pipeline.js';
import { cancelRemindersForBooking, scheduleBookingReminders } from './reminders.js';
import { refreshFollowUpPlans, markLeadOutcomePrompted, schedulePostCallOutcomeTask } from './follow-ups.js';
import { syncLeadBoardState } from './kanban.js';
import { recordLeadBooking } from './sequence-engine.js';
import { loadOutreachStore, mutateOutreachStore } from './store.js';
import type { BookingConfig, BookingKind, OutreachBooking, PostCallOutcome } from './types.js';
import { createEmailApproval } from '../ingestion/email/worker-approval-store.js';
import { sendApprovedEmail } from '../ingestion/email/email-draft-handler.js';
import { isVicalOutreachBackend, resolveVicalHostUserId } from './vical-cutover.js';
import {
  cancelOutreachBookingViaVical,
  createOutreachBookingViaVical,
  mapVicalToOutreachBooking,
  offerSlotsViaVical,
  readMergedBookingConfig,
  rescheduleOutreachBookingViaVical,
  setOutreachOutcomeViaVical,
} from '../vical/outreach-adapter.js';
import { syncConfigFromOutreach } from '../vical/config-bridge.js';
import { listBookings as listVicalBookings } from '../vical/bookings.js';

function nowIso(d = new Date()): string {
  return d.toISOString();
}

const DEFAULT_BOOKING_CONFIG: BookingConfig = {
  timezone: 'Europe/London',
  slotMinutes: 30,
  bufferMinutes: 10,
  horizonDays: 14,
  reminderOffsetsMinutes: [1440, 30],
  windows: [
    { dayOfWeek: 1, start: '18:00', end: '20:30' },
    { dayOfWeek: 2, start: '18:00', end: '20:30' },
    { dayOfWeek: 3, start: '18:00', end: '20:30' },
    { dayOfWeek: 4, start: '18:00', end: '20:30' },
  ],
  blockedDates: [],
  meetingMode: 'google_meet',
  prepVideoUrl: undefined,
  prepVideoTitle: undefined,
  prepVideoPassword: undefined,
};

export type BusyWindow = { start: string; end: string };

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Raw JSON bookings (mirror / legacy archive). */
function listJsonBookings(
  workspaceId: string,
  filter?: { leadId?: string; status?: OutreachBooking['status'] },
): OutreachBooking[] {
  return loadOutreachStore()
    .bookings.filter((b) => b.workspaceId === workspaceId)
    .filter((b) => (!filter?.leadId || b.leadId === filter.leadId))
    .filter((b) => (!filter?.status || b.status === filter.status))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

function legacyOnlyBusy(workspaceId: string): BusyWindow[] {
  const vicalIds = new Set(listVicalBookings(workspaceId).map((b) => b.id));
  return listJsonBookings(workspaceId)
    .filter((b) => b.status === 'confirmed')
    .filter((b) => !vicalIds.has(b.id))
    .map((b) => ({ start: b.startsAt, end: b.endsAt }));
}

export function listBookings(
  workspaceId: string,
  filter?: { leadId?: string; status?: OutreachBooking['status'] },
): OutreachBooking[] {
  // Mirror rows remain the outreach-facing list (Kanban/reminder ids).
  return listJsonBookings(workspaceId, filter);
}

export function getBookingConfig(workspaceId: string): BookingConfig {
  const stored = loadOutreachStore().bookingConfigs[workspaceId] ?? DEFAULT_BOOKING_CONFIG;
  if (!isVicalOutreachBackend()) return stored;
  return readMergedBookingConfig(workspaceId, stored, resolveVicalHostUserId());
}

export function updateBookingConfig(workspaceId: string, patch: Partial<BookingConfig>): BookingConfig {
  const current = getBookingConfig(workspaceId);
  const next: BookingConfig = {
    ...DEFAULT_BOOKING_CONFIG,
    ...current,
    ...patch,
    timezone: patch.timezone ?? current.timezone ?? DEFAULT_BOOKING_CONFIG.timezone,
    slotMinutes: Math.max(15, Math.min(120, patch.slotMinutes ?? current.slotMinutes ?? DEFAULT_BOOKING_CONFIG.slotMinutes)),
    bufferMinutes: Math.max(0, Math.min(120, patch.bufferMinutes ?? current.bufferMinutes ?? DEFAULT_BOOKING_CONFIG.bufferMinutes)),
    horizonDays: Math.max(1, Math.min(30, patch.horizonDays ?? current.horizonDays ?? DEFAULT_BOOKING_CONFIG.horizonDays)),
    reminderOffsetsMinutes: Array.isArray(patch.reminderOffsetsMinutes) && patch.reminderOffsetsMinutes.length > 0
      ? patch.reminderOffsetsMinutes
          .map((value) => Math.max(1, Math.min(10080, Number(value))))
          .filter((value) => Number.isFinite(value))
      : current.reminderOffsetsMinutes ?? DEFAULT_BOOKING_CONFIG.reminderOffsetsMinutes,
    windows: Array.isArray(patch.windows) && patch.windows.length > 0 ? patch.windows : current.windows ?? DEFAULT_BOOKING_CONFIG.windows,
    blockedDates: Array.isArray(patch.blockedDates) ? patch.blockedDates : current.blockedDates ?? DEFAULT_BOOKING_CONFIG.blockedDates,
    meetingMode: patch.meetingMode ?? current.meetingMode ?? DEFAULT_BOOKING_CONFIG.meetingMode,
    zoomRoomUrl: patch.zoomRoomUrl ?? current.zoomRoomUrl,
    prepVideoUrl: patch.prepVideoUrl ?? current.prepVideoUrl,
    prepVideoTitle: patch.prepVideoTitle ?? current.prepVideoTitle,
    prepVideoPassword: patch.prepVideoPassword ?? current.prepVideoPassword,
  };
  mutateOutreachStore((store) => {
    store.bookingConfigs[workspaceId] = next;
  });
  if (isVicalOutreachBackend()) {
    syncConfigFromOutreach(workspaceId, resolveVicalHostUserId(), next);
  }
  return next;
}

export function getBooking(workspaceId: string, bookingId: string): OutreachBooking | null {
  return listBookings(workspaceId).find((b) => b.id === bookingId) ?? null;
}

export function listAvailability(input: {
  workspaceId: string;
  from: Date;
  days?: number;
  slotMinutes?: number;
  timezone?: string;
  busyWindows?: BusyWindow[];
  businessHoursStart?: string;
  businessHoursEnd?: string;
  businessDays?: number[];
}): Array<{ start: string; end: string }> {
  if (isVicalOutreachBackend()) {
    const config = {
      ...getBookingConfig(input.workspaceId),
      slotMinutes: input.slotMinutes ?? getBookingConfig(input.workspaceId).slotMinutes,
      timezone: input.timezone ?? getBookingConfig(input.workspaceId).timezone,
      horizonDays: input.days ?? getBookingConfig(input.workspaceId).horizonDays,
    };
    // Temporarily raise horizon for this offer without mutating store when days passed.
    const offered = offerSlotsViaVical({
      workspaceId: input.workspaceId,
      config: {
        ...config,
        horizonDays: Math.max(1, Math.min(21, input.days ?? config.horizonDays)),
      },
      from: input.from,
      limit: 80,
      externalBusy: input.busyWindows,
      legacyBusy: legacyOnlyBusy(input.workspaceId),
    });
    return offered.map((slot) => ({ start: slot.start, end: slot.end }));
  }

  const days = Math.max(1, Math.min(21, input.days ?? 7));
  const slotMinutes = input.slotMinutes ?? 30;
  const timezone = input.timezone ?? 'Europe/London';
  const hoursStart = input.businessHoursStart ?? '09:00';
  const hoursEnd = input.businessHoursEnd ?? '17:00';
  const businessDays = input.businessDays ?? [1, 2, 3, 4, 5];
  const busy = [
    ...(input.busyWindows ?? []),
    ...listJsonBookings(input.workspaceId)
      .filter((b) => b.status === 'confirmed')
      .map((b) => ({ start: b.startsAt, end: b.endsAt })),
  ];

  const [sh, sm] = hoursStart.split(':').map(Number);
  const [eh, em] = hoursEnd.split(':').map(Number);
  const slots: Array<{ start: string; end: string }> = [];

  for (let day = 0; day < days; day += 1) {
    const cursor = new Date(input.from.getTime() + day * 24 * 60 * 60 * 1000);
    let weekday: number;
    try {
      const label = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, weekday: 'short' }).format(cursor);
      const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      weekday = map[label] ?? cursor.getUTCDay();
    } catch {
      weekday = cursor.getUTCDay();
    }
    if (!businessDays.includes(weekday)) continue;

    const ymd = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(cursor);

    for (let mins = sh! * 60 + sm!; mins + slotMinutes <= eh! * 60 + em!; mins += slotMinutes) {
      const hour = Math.floor(mins / 60);
      const minute = mins % 60;
      const startLocal = `${ymd}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
      const start = new Date(`${startLocal}Z`);
      const end = new Date(start.getTime() + slotMinutes * 60 * 1000);
      if (start.getTime() <= Date.now()) continue;
      const conflict = busy.some((window) =>
        overlaps(start.getTime(), end.getTime(), new Date(window.start).getTime(), new Date(window.end).getTime()),
      );
      if (conflict) continue;
      slots.push({ start: start.toISOString(), end: end.toISOString() });
    }
  }

  return slots.slice(0, 80);
}

export function buildBookingConfirmationEmail(input: {
  leadName: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  joinLink?: string;
  prepVideoUrl?: string;
  prepVideoTitle?: string;
  prepVideoPassword?: string;
}): { subject: string; body: string } {
  const when = new Date(input.startsAt).toUTCString();
  const lines = [
    `Hi ${input.leadName || 'there'},`,
    '',
    `Your discovery call is confirmed for ${new Date(input.startsAt).toUTCString()} to ${new Date(input.endsAt).toUTCString()} (${input.timezone}).`,
    input.joinLink ? `Join link: ${input.joinLink}` : 'Join details will follow.',
    input.prepVideoUrl ? `Prep video: ${input.prepVideoUrl}` : '',
    input.prepVideoTitle ? `Video title: ${input.prepVideoTitle}` : '',
    input.prepVideoPassword ? `Video password: ${input.prepVideoPassword}` : '',
    '',
    'If you need to reschedule, reply to this email.',
    '',
    'Best,',
  ].filter(Boolean);
  return {
    subject: `Confirmed: discovery call on ${when}`,
    body: lines.join('\n'),
  };
}

export function createBooking(input: {
  workspaceId: string;
  leadId: string;
  startsAt: string;
  endsAt: string;
  kind?: BookingKind;
  timezone?: string;
  hostEmail?: string;
  hostName?: string;
  calendarProvider?: OutreachBooking['calendarProvider'];
  calendarEventId?: string;
  joinLink?: string;
  notes?: string;
  busyWindows?: BusyWindow[];
}): OutreachBooking {
  const lead = getLead(input.workspaceId, input.leadId);
  if (!lead) throw new Error('Lead not found');
  const startMs = new Date(input.startsAt).getTime();
  const endMs = new Date(input.endsAt).getTime();
  if (!(startMs < endMs)) throw new Error('endsAt must be after startsAt');

  const campaign = lead.campaignId ? getCampaign(input.workspaceId, lead.campaignId) : null;
  const timezone = input.timezone ?? campaign?.cadence.timezone ?? lead.timezone ?? 'Europe/London';
  const config = getBookingConfig(input.workspaceId);

  if (isVicalOutreachBackend()) {
    const vical = createOutreachBookingViaVical({
      workspaceId: input.workspaceId,
      leadId: lead.id,
      email: lead.email || `${lead.id}@outreach.local`,
      name: lead.name,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      timezone,
      config,
      meetingUrl: input.joinLink ?? campaign?.defaultBookingLink,
      notes: input.notes,
      externalBusy: input.busyWindows,
      legacyBusy: legacyOnlyBusy(input.workspaceId),
      calendarEventId: input.calendarEventId,
    });

    const copy = buildBookingConfirmationEmail({
      leadName: lead.name,
      startsAt: vical.startsAt,
      endsAt: vical.endsAt,
      timezone,
      joinLink: vical.meetingUrl,
    });
    let booking = mapVicalToOutreachBooking(vical, {
      leadId: lead.id,
      campaignId: lead.campaignId,
      kind: input.kind ?? 'discovery',
      hostEmail: input.hostEmail,
      hostName: input.hostName,
      calendarProvider: input.calendarProvider ?? 'local',
      calendarEventId: input.calendarEventId ?? vical.calendarEventId,
      joinLink: vical.meetingUrl ?? input.joinLink ?? campaign?.defaultBookingLink,
      confirmationSubject: copy.subject,
      confirmationBody: copy.body,
      confirmationStatus: 'pending_approval',
      reminderIds: [],
      notes: input.notes,
    });

    mutateOutreachStore((store) => {
      store.bookings.push(booking);
      const idx = store.leads.findIndex((l) => l.id === lead.id);
      if (idx >= 0) {
        let updated = transitionLeadStatus(store.leads[idx]!, 'booked', 'Discovery call booked');
        updated = appendTimeline(updated, {
          kind: 'system',
          message: `Booking confirmed for ${booking.startsAt}`,
          meta: { bookingId: booking.id, engine: 'vical' },
        });
        updated = {
          ...updated,
          bookingState: 'booked',
          nextActionAt: booking.startsAt,
        };
        store.leads[idx] = updated;
      }
    });

    recordLeadBooking(input.workspaceId, lead.id);
    const reminders = scheduleBookingReminders(input.workspaceId, booking.id);
    booking = { ...booking, reminderIds: reminders.map((r) => r.id), updatedAt: nowIso() };
    mutateOutreachStore((store) => {
      const idx = store.bookings.findIndex((b) => b.id === booking.id);
      if (idx >= 0) store.bookings[idx] = booking;
    });
    void refreshFollowUpPlans(input.workspaceId);
    void syncLeadBoardState(input.workspaceId, lead.id, 'Discovery booking created').catch(() => undefined);
    return booking;
  }

  const blocked: BusyWindow[] = [
    ...(input.busyWindows ?? []),
    ...listJsonBookings(input.workspaceId)
      .filter((b) => b.status === 'confirmed')
      .map((b) => ({ start: b.startsAt, end: b.endsAt })),
  ];
  const hasConflict = blocked.some((window) =>
    overlaps(startMs, endMs, new Date(window.start).getTime(), new Date(window.end).getTime()),
  );
  if (hasConflict) throw new Error('Slot is not available');

  const stamp = nowIso();
  const copy = buildBookingConfirmationEmail({
    leadName: lead.name,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    timezone,
    joinLink: input.joinLink ?? campaign?.defaultBookingLink,
  });
  let booking: OutreachBooking = {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    leadId: lead.id,
    campaignId: lead.campaignId,
    kind: input.kind ?? 'discovery',
    status: 'confirmed',
    startsAt: new Date(input.startsAt).toISOString(),
    endsAt: new Date(input.endsAt).toISOString(),
    timezone,
    attendeeEmail: lead.email,
    attendeeName: lead.name,
    hostEmail: input.hostEmail,
    hostName: input.hostName,
    calendarProvider: input.calendarProvider ?? 'local',
    calendarEventId: input.calendarEventId,
    joinLink: input.joinLink ?? campaign?.defaultBookingLink,
    confirmationSubject: copy.subject,
    confirmationBody: copy.body,
    confirmationStatus: 'pending_approval',
    reminderIds: [],
    notes: input.notes,
    createdAt: stamp,
    updatedAt: stamp,
  };

  mutateOutreachStore((store) => {
    store.bookings.push(booking);
    const idx = store.leads.findIndex((l) => l.id === lead.id);
    if (idx >= 0) {
      let updated = transitionLeadStatus(store.leads[idx]!, 'booked', 'Discovery call booked');
      updated = appendTimeline(updated, {
        kind: 'system',
        message: `Booking confirmed for ${booking.startsAt}`,
        meta: { bookingId: booking.id },
      });
      updated = {
        ...updated,
        bookingState: 'booked',
        nextActionAt: booking.startsAt,
      };
      store.leads[idx] = updated;
    }
  });

  recordLeadBooking(input.workspaceId, lead.id);
  const reminders = scheduleBookingReminders(input.workspaceId, booking.id);
  booking = { ...booking, reminderIds: reminders.map((r) => r.id), updatedAt: nowIso() };
  mutateOutreachStore((store) => {
    const idx = store.bookings.findIndex((b) => b.id === booking.id);
    if (idx >= 0) store.bookings[idx] = booking;
  });
  void refreshFollowUpPlans(input.workspaceId);
  void syncLeadBoardState(input.workspaceId, lead.id, 'Discovery booking created').catch(() => undefined);
  return booking;
}

export function rescheduleBooking(input: {
  workspaceId: string;
  bookingId: string;
  startsAt: string;
  endsAt: string;
  busyWindows?: BusyWindow[];
}): OutreachBooking {
  const existing = getBooking(input.workspaceId, input.bookingId);
  if (!existing) throw new Error('Booking not found');
  if (existing.status === 'cancelled') throw new Error('Cannot reschedule a cancelled booking');

  if (isVicalOutreachBackend()) {
    cancelRemindersForBooking(input.workspaceId, existing.id, 'rescheduled');
    const vical = rescheduleOutreachBookingViaVical({
      workspaceId: input.workspaceId,
      bookingId: existing.id,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      externalBusy: input.busyWindows,
      legacyBusy: legacyOnlyBusy(input.workspaceId),
    });
    const next = mapVicalToOutreachBooking(vical, {
      ...existing,
      confirmationStatus: existing.confirmationStatus,
      confirmationSubject: existing.confirmationSubject,
      confirmationBody: existing.confirmationBody,
      reminderIds: [],
    });
    mutateOutreachStore((store) => {
      const idx = store.bookings.findIndex((b) => b.id === existing.id);
      if (idx >= 0) store.bookings[idx] = { ...next, updatedAt: nowIso() };
      const leadIdx = store.leads.findIndex((l) => l.id === existing.leadId);
      if (leadIdx >= 0) {
        store.leads[leadIdx] = appendTimeline(store.leads[leadIdx]!, {
          kind: 'system',
          message: `Booking rescheduled to ${next.startsAt}`,
          meta: { bookingId: existing.id, engine: 'vical' },
        });
      }
    });
    const reminders = scheduleBookingReminders(input.workspaceId, existing.id);
    const withReminders = { ...next, reminderIds: reminders.map((r) => r.id), updatedAt: nowIso() };
    mutateOutreachStore((store) => {
      const idx = store.bookings.findIndex((b) => b.id === existing.id);
      if (idx >= 0) store.bookings[idx] = withReminders;
    });
    void refreshFollowUpPlans(input.workspaceId);
    void syncLeadBoardState(input.workspaceId, existing.leadId, 'Booking rescheduled').catch(() => undefined);
    return withReminders;
  }

  cancelRemindersForBooking(input.workspaceId, existing.id, 'rescheduled');
  mutateOutreachStore((store) => {
    const idx = store.bookings.findIndex((b) => b.id === existing.id);
    if (idx >= 0) {
      store.bookings[idx] = {
        ...store.bookings[idx]!,
        status: 'rescheduled',
        updatedAt: nowIso(),
      };
    }
  });
  void refreshFollowUpPlans(input.workspaceId);
  void syncLeadBoardState(input.workspaceId, existing.leadId, 'Booking rescheduled').catch(() => undefined);

  return createBooking({
    workspaceId: input.workspaceId,
    leadId: existing.leadId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    kind: existing.kind,
    timezone: existing.timezone,
    hostEmail: existing.hostEmail,
    hostName: existing.hostName,
    joinLink: existing.joinLink,
    notes: existing.notes,
    busyWindows: input.busyWindows,
  });
}

export function cancelBooking(workspaceId: string, bookingId: string, reason?: string): OutreachBooking {
  const booking = getBooking(workspaceId, bookingId);
  if (!booking) throw new Error('Booking not found');
  cancelRemindersForBooking(workspaceId, bookingId, reason ?? 'cancelled');
  if (isVicalOutreachBackend()) {
    try {
      cancelOutreachBookingViaVical(workspaceId, bookingId, reason);
    } catch {
      // Mirror cancel still applies.
    }
  }
  const next: OutreachBooking = {
    ...booking,
    status: 'cancelled',
    updatedAt: nowIso(),
  };
  mutateOutreachStore((store) => {
    const idx = store.bookings.findIndex((b) => b.id === bookingId);
    if (idx >= 0) store.bookings[idx] = next;
    const leadIdx = store.leads.findIndex((l) => l.id === booking.leadId);
    if (leadIdx >= 0) {
      let lead = appendTimeline(store.leads[leadIdx]!, {
        kind: 'system',
        message: `Booking cancelled${reason ? `: ${reason}` : ''}`,
        meta: { bookingId },
      });
      lead = { ...lead, bookingState: 'none', status: 'follow_up', nextActionAt: undefined };
      store.leads[leadIdx] = lead;
    }
  });
  void refreshFollowUpPlans(workspaceId);
  void syncLeadBoardState(workspaceId, booking.leadId, reason ? `Booking cancelled: ${reason}` : 'Booking cancelled').catch(() => undefined);
  return next;
}

export function markBookingNoShow(workspaceId: string, bookingId: string): OutreachBooking {
  const booking = getBooking(workspaceId, bookingId);
  if (!booking) throw new Error('Booking not found');
  cancelRemindersForBooking(workspaceId, bookingId, 'no_show');
  if (isVicalOutreachBackend()) {
    try {
      setOutreachOutcomeViaVical(workspaceId, bookingId, 'no_show');
    } catch {
      // continue
    }
  }
  const next: OutreachBooking = { ...booking, status: 'no_show', updatedAt: nowIso() };
  mutateOutreachStore((store) => {
    const idx = store.bookings.findIndex((b) => b.id === bookingId);
    if (idx >= 0) store.bookings[idx] = next;
  });
  updateLead(workspaceId, booking.leadId, { status: 'follow_up', bookingState: 'no_show' });
  markLeadOutcomePrompted(workspaceId, booking.leadId, bookingId);
  const lead = getLead(workspaceId, booking.leadId);
  if (lead) {
    mutateOutreachStore((store) => {
      const leadIdx = store.leads.findIndex((l) => l.id === booking.leadId);
      if (leadIdx >= 0) {
        store.leads[leadIdx] = appendTimeline(store.leads[leadIdx]!, {
          kind: 'system',
          message: 'Marked no-show; moved to follow-up',
          meta: { bookingId },
        });
      }
    });
  }
  void refreshFollowUpPlans(workspaceId);
  void syncLeadBoardState(workspaceId, booking.leadId, 'Marked no-show').catch(() => undefined);
  return next;
}

export function markBookingAttended(workspaceId: string, bookingId: string): OutreachBooking {
  const booking = getBooking(workspaceId, bookingId);
  if (!booking) throw new Error('Booking not found');
  cancelRemindersForBooking(workspaceId, bookingId, 'attended');
  if (isVicalOutreachBackend()) {
    try {
      setOutreachOutcomeViaVical(workspaceId, bookingId, 'attended');
    } catch {
      // continue
    }
  }
  const next: OutreachBooking = { ...booking, status: 'attended', updatedAt: nowIso() };
  mutateOutreachStore((store) => {
    const idx = store.bookings.findIndex((b) => b.id === bookingId);
    if (idx >= 0) store.bookings[idx] = next;
  });
  updateLead(workspaceId, booking.leadId, { status: 'attended', bookingState: 'attended' });
  void refreshFollowUpPlans(workspaceId);
  void syncLeadBoardState(workspaceId, booking.leadId, 'Marked attended').catch(() => undefined);
  return next;
}

export function markBookingConfirmationSent(workspaceId: string, bookingId: string): OutreachBooking | null {
  const booking = getBooking(workspaceId, bookingId);
  if (!booking) return null;
  if (booking.confirmationStatus === 'sent') return booking;
  const next = { ...booking, confirmationStatus: 'sent' as const, updatedAt: nowIso() };
  mutateOutreachStore((store) => {
    const idx = store.bookings.findIndex((b) => b.id === bookingId);
    if (idx >= 0) store.bookings[idx] = next;
    const leadIdx = store.leads.findIndex((l) => l.id === booking.leadId);
    if (leadIdx >= 0) {
      store.leads[leadIdx] = appendTimeline(store.leads[leadIdx]!, {
        kind: 'delivery',
        message: 'Booking confirmation marked sent (Soft Wall approved)',
        meta: { bookingId },
      });
    }
  });
  return next;
}

function appendNotes(existing: string | undefined, addition: string): string {
  const cleaned = addition.trim();
  if (!cleaned) return existing ?? '';
  if (!existing?.trim()) return cleaned;
  return `${existing.trim()}\n\n${cleaned}`;
}

export function recordPostCallOutcome(input: {
  workspaceId: string;
  bookingId: string;
  outcome: PostCallOutcome;
  notes?: string;
}): { booking: OutreachBooking; leadId: string; nextActionTaskId?: string } {
  const booking = getBooking(input.workspaceId, input.bookingId);
  if (!booking) throw new Error('Booking not found');
  const lead = getLead(input.workspaceId, booking.leadId);
  if (!lead) throw new Error('Lead not found');

  const resolvedOutcome = input.outcome;
  const statusMap: Record<PostCallOutcome, 'attended' | 'proposal_sent' | 'follow_up' | 'lost' | 'won'> = {
    qualified: 'attended',
    proposal_needed: 'proposal_sent',
    needs_follow_up: 'follow_up',
    not_a_fit: 'lost',
    won: 'won',
    lost: 'lost',
  };
  const noteLine = [
    `Post-call outcome recorded: ${resolvedOutcome.replaceAll('_', ' ')}`,
    input.notes?.trim() ? `Notes: ${input.notes.trim()}` : '',
  ].filter(Boolean).join('\n');

  const nextBooking: OutreachBooking = {
    ...booking,
    status: statusMap[resolvedOutcome] === 'won' ? 'attended' : statusMap[resolvedOutcome] === 'lost' ? 'attended' : booking.status === 'no_show' ? 'attended' : booking.status,
    postCallOutcome: resolvedOutcome,
    postCallNotes: appendNotes(booking.postCallNotes, input.notes ?? ''),
    notes: appendNotes(booking.notes, noteLine),
    updatedAt: nowIso(),
  };

  mutateOutreachStore((store) => {
    const idx = store.bookings.findIndex((row) => row.id === booking.id);
    if (idx >= 0) store.bookings[idx] = nextBooking;
  });

  const leadPatch: Parameters<typeof updateLead>[2] = {
    status: statusMap[resolvedOutcome] === 'won' ? 'won' : statusMap[resolvedOutcome] === 'lost' ? 'lost' : statusMap[resolvedOutcome],
    bookingState: 'attended',
    nextActionAt: null,
    notes: appendNotes(lead.notes, noteLine),
  };
  const updatedLead = updateLead(input.workspaceId, lead.id, leadPatch);
  if (updatedLead) {
    mutateOutreachStore((store) => {
      const idx = store.leads.findIndex((row) => row.id === lead.id);
      if (idx >= 0) {
        store.leads[idx] = appendTimeline(updatedLead, {
          kind: 'system',
          message: `Post-call outcome: ${resolvedOutcome.replaceAll('_', ' ')}`,
          meta: { bookingId: booking.id, outcome: resolvedOutcome },
        });
      }
    });
  }

  const scheduled = schedulePostCallOutcomeTask(input.workspaceId, updatedLead ?? lead, nextBooking, resolvedOutcome);
  void refreshFollowUpPlans(input.workspaceId);
  void syncLeadBoardState(input.workspaceId, booking.leadId, `Post-call outcome: ${resolvedOutcome}`).catch(() => undefined);
  return { booking: nextBooking, leadId: booking.leadId, nextActionTaskId: scheduled?.id };
}

export async function sendBookingConfirmationEmail(input: {
  workspaceId: string;
  bookingId: string;
  workerId: string;
  prepVideoUrl?: string;
  prepVideoTitle?: string;
  prepVideoPassword?: string;
}): Promise<{ sent: boolean; skipped: boolean; warning?: string; booking: OutreachBooking | null }> {
  const booking = getBooking(input.workspaceId, input.bookingId);
  if (!booking) return { sent: false, skipped: false, warning: 'Booking not found', booking: null };
  if (booking.confirmationStatus === 'sent') {
    return { sent: false, skipped: true, booking };
  }
  if (!booking.attendeeEmail) {
    return { sent: false, skipped: false, warning: 'No attendee email on booking', booking };
  }
  const lead = getLead(input.workspaceId, booking.leadId);
  const config = getBookingConfig(input.workspaceId);
  const copy = buildBookingConfirmationEmail({
    leadName: lead?.name ?? booking.attendeeName ?? 'there',
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    timezone: booking.timezone,
    joinLink: booking.joinLink,
    prepVideoUrl: input.prepVideoUrl ?? config.prepVideoUrl,
    prepVideoTitle: input.prepVideoTitle ?? config.prepVideoTitle,
    prepVideoPassword: input.prepVideoPassword ?? config.prepVideoPassword,
  });
  const approval = await createEmailApproval({
    workerId: input.workerId,
    workspaceId: input.workspaceId,
    category: 'client_query',
    recipient: booking.attendeeEmail,
    subject: copy.subject,
    draftBody: copy.body,
    originalFrom: booking.attendeeEmail,
  });
  await sendApprovedEmail({
    workspaceId: input.workspaceId,
    approvalId: approval.id,
    reviewedBy: 'system:booking-confirmation',
  });
  markBookingConfirmationSent(input.workspaceId, booking.id);
  const refreshed = getBooking(input.workspaceId, booking.id);
  return { sent: true, skipped: false, booking: refreshed };
}
