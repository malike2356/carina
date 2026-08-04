import crypto from 'crypto';
import { SlotUnavailableError, VcalError } from './errors.js';
import { emitVcalHook } from './hooks.js';
import { acquireSlotLock, listActiveLocks, releaseSlotLock } from './locks.js';
import { assertSlotFree, offerSlots } from './slots.js';
import { loadVicalStore, mutateVicalStore } from './store.js';
import type {
  VcalAvailabilityRule,
  VcalBlackoutDate,
  VcalBooking,
  VcalBookingSource,
  VcalBookingStatus,
  VcalBusyWindow,
  VcalEventType,
  VcalSessionOutcome,
} from './types.js';

function nowIso(d = new Date()): string {
  return d.toISOString();
}

function depositsEnabled(): boolean {
  return process.env.VICAL_ENABLE_DEPOSITS === '1' || process.env.VICAL_ENABLE_DEPOSITS === 'true';
}

function requireWorkspaceBooking(workspaceId: string, bookingId: string): VcalBooking {
  const booking = loadVicalStore().bookings.find((b) => b.id === bookingId && b.workspaceId === workspaceId);
  if (!booking) throw new VcalError('not_found', 'Booking not found');
  return booking;
}

export function listEventTypes(workspaceId: string, opts?: { activeOnly?: boolean }): VcalEventType[] {
  return loadVicalStore()
    .eventTypes.filter((e) => e.workspaceId === workspaceId)
    .filter((e) => (opts?.activeOnly ? e.active : true))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getEventType(workspaceId: string, eventTypeId: string): VcalEventType | null {
  return loadVicalStore().eventTypes.find((e) => e.id === eventTypeId && e.workspaceId === workspaceId) ?? null;
}

export function createEventType(input: {
  workspaceId: string;
  hostUserId: string;
  name: string;
  slug?: string;
  durationMinutes?: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  minNoticeMinutes?: number;
  horizonDays?: number;
  locationMode?: VcalEventType['locationMode'];
  requiresApproval?: boolean;
  requiresDeposit?: boolean;
  active?: boolean;
  metadata?: Record<string, unknown>;
}): VcalEventType {
  const stamp = nowIso();
  const slug =
    input.slug?.trim() ||
    input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') ||
    'session';
  const row: VcalEventType = {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    hostUserId: input.hostUserId,
    slug,
    name: input.name.trim(),
    durationMinutes: Math.max(15, Math.min(480, input.durationMinutes ?? 30)),
    bufferBeforeMinutes: Math.max(0, input.bufferBeforeMinutes ?? 0),
    bufferAfterMinutes: Math.max(0, input.bufferAfterMinutes ?? 10),
    minNoticeMinutes: Math.max(0, input.minNoticeMinutes ?? 120),
    horizonDays: Math.max(1, Math.min(60, input.horizonDays ?? 14)),
    locationMode: input.locationMode ?? 'google_meet',
    requiresApproval: Boolean(input.requiresApproval),
    requiresDeposit: Boolean(input.requiresDeposit),
    depositMinor: null,
    depositCurrency: null,
    intakePoolId: null,
    active: input.active ?? true,
    metadata: input.metadata ?? {},
    createdAt: stamp,
    updatedAt: stamp,
  };
  mutateVicalStore((store) => {
    store.eventTypes.push(row);
  });
  return row;
}

export function updateEventType(
  workspaceId: string,
  eventTypeId: string,
  patch: Partial<
    Pick<
      VcalEventType,
      | 'name'
      | 'slug'
      | 'durationMinutes'
      | 'bufferBeforeMinutes'
      | 'bufferAfterMinutes'
      | 'minNoticeMinutes'
      | 'horizonDays'
      | 'locationMode'
      | 'requiresApproval'
      | 'requiresDeposit'
      | 'active'
      | 'metadata'
    >
  >,
): VcalEventType {
  const existing = getEventType(workspaceId, eventTypeId);
  if (!existing) throw new VcalError('not_found', 'Event type not found');
  const next: VcalEventType = {
    ...existing,
    ...patch,
    updatedAt: nowIso(),
  };
  mutateVicalStore((store) => {
    const idx = store.eventTypes.findIndex((e) => e.id === eventTypeId && e.workspaceId === workspaceId);
    if (idx >= 0) store.eventTypes[idx] = next;
  });
  return next;
}

export function listAvailabilityRules(workspaceId: string, hostUserId?: string): VcalAvailabilityRule[] {
  return loadVicalStore().availabilityRules.filter(
    (r) => r.workspaceId === workspaceId && (!hostUserId || r.hostUserId === hostUserId),
  );
}

export function createAvailabilityRule(input: {
  workspaceId: string;
  hostUserId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone?: string;
  eventTypeId?: string | null;
}): VcalAvailabilityRule {
  const stamp = nowIso();
  const row: VcalAvailabilityRule = {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    hostUserId: input.hostUserId,
    eventTypeId: input.eventTypeId ?? null,
    dayOfWeek: Math.max(0, Math.min(6, input.dayOfWeek)),
    startTime: input.startTime,
    endTime: input.endTime,
    timezone: input.timezone ?? 'Europe/London',
    createdAt: stamp,
    updatedAt: stamp,
  };
  mutateVicalStore((store) => {
    store.availabilityRules.push(row);
  });
  return row;
}

export function replaceAvailabilityRules(
  workspaceId: string,
  hostUserId: string,
  rules: Array<{ dayOfWeek: number; startTime: string; endTime: string; timezone?: string }>,
  timezone = 'Europe/London',
): VcalAvailabilityRule[] {
  const stamp = nowIso();
  const next = rules.map((rule) => ({
    id: crypto.randomUUID(),
    workspaceId,
    hostUserId,
    eventTypeId: null as string | null,
    dayOfWeek: Math.max(0, Math.min(6, rule.dayOfWeek)),
    startTime: rule.startTime,
    endTime: rule.endTime,
    timezone: rule.timezone ?? timezone,
    createdAt: stamp,
    updatedAt: stamp,
  }));
  mutateVicalStore((store) => {
    store.availabilityRules = store.availabilityRules.filter(
      (r) => !(r.workspaceId === workspaceId && r.hostUserId === hostUserId),
    );
    store.availabilityRules.push(...next);
  });
  return next;
}

export function listBlackouts(workspaceId: string): VcalBlackoutDate[] {
  return loadVicalStore().blackouts.filter((b) => b.workspaceId === workspaceId);
}

export function createBlackout(input: {
  workspaceId: string;
  hostUserId?: string | null;
  startsOn: string;
  endsOn: string;
  reason?: string;
}): VcalBlackoutDate {
  const stamp = nowIso();
  const row: VcalBlackoutDate = {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    hostUserId: input.hostUserId ?? null,
    startsOn: input.startsOn,
    endsOn: input.endsOn || input.startsOn,
    reason: input.reason,
    createdAt: stamp,
    updatedAt: stamp,
  };
  mutateVicalStore((store) => {
    store.blackouts.push(row);
  });
  return row;
}

export function deleteBlackout(workspaceId: string, blackoutId: string): boolean {
  let removed = false;
  mutateVicalStore((store) => {
    const before = store.blackouts.length;
    store.blackouts = store.blackouts.filter((b) => !(b.id === blackoutId && b.workspaceId === workspaceId));
    removed = store.blackouts.length < before;
  });
  return removed;
}

export function listBookings(
  workspaceId: string,
  filter?: { status?: VcalBookingStatus; leadId?: string; guestEmail?: string },
): VcalBooking[] {
  return loadVicalStore()
    .bookings.filter((b) => b.workspaceId === workspaceId)
    .filter((b) => (!filter?.status || b.status === filter.status))
    .filter((b) => (!filter?.leadId || b.leadId === filter.leadId))
    .filter((b) => (!filter?.guestEmail || b.guestEmail.toLowerCase() === filter.guestEmail.toLowerCase()))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function getBooking(workspaceId: string, bookingId: string): VcalBooking | null {
  return loadVicalStore().bookings.find((b) => b.id === bookingId && b.workspaceId === workspaceId) ?? null;
}

export function getBookingByGuestToken(guestToken: string): VcalBooking | null {
  return loadVicalStore().bookings.find((b) => b.guestToken === guestToken) ?? null;
}

export function listOfferedSlots(input: {
  workspaceId: string;
  eventTypeId: string;
  limit?: number;
  externalBusy?: VcalBusyWindow[];
  from?: Date;
}): ReturnType<typeof offerSlots> {
  const eventType = getEventType(input.workspaceId, input.eventTypeId);
  if (!eventType || !eventType.active) throw new VcalError('not_found', 'Event type not found');
  const store = loadVicalStore();
  return offerSlots({
    eventType,
    rules: store.availabilityRules,
    blackouts: store.blackouts,
    bookings: store.bookings,
    locks: listActiveLocks(input.workspaceId, eventType.hostUserId),
    externalBusy: input.externalBusy,
    limit: input.limit,
    from: input.from,
  });
}

function resolveCreateStatus(eventType: VcalEventType): VcalBookingStatus {
  if (eventType.requiresDeposit && depositsEnabled()) return 'pending_payment';
  if (eventType.requiresApproval) return 'pending_review';
  return 'confirmed';
}

export function createBooking(input: {
  workspaceId: string;
  eventTypeId: string;
  guestName: string;
  guestEmail: string;
  startsAt: string;
  endsAt?: string;
  timezone?: string;
  source?: VcalBookingSource;
  leadId?: string;
  contactId?: string;
  notes?: string;
  meetingUrl?: string;
  intakeAnswers?: Record<string, unknown>;
  externalBusy?: VcalBusyWindow[];
  metadata?: Record<string, unknown>;
}): VcalBooking {
  const eventType = getEventType(input.workspaceId, input.eventTypeId);
  if (!eventType || !eventType.active) throw new VcalError('not_found', 'Event type not found');

  const startsAt = new Date(input.startsAt).toISOString();
  const endsAt = input.endsAt
    ? new Date(input.endsAt).toISOString()
    : new Date(new Date(startsAt).getTime() + eventType.durationMinutes * 60_000).toISOString();

  const store = loadVicalStore();
  try {
    assertSlotFree({
      eventType,
      startsAt,
      endsAt,
      bookings: store.bookings,
      locks: listActiveLocks(input.workspaceId, eventType.hostUserId),
      externalBusy: input.externalBusy,
    });
  } catch (error) {
    const alternatives = offerSlots({
      eventType,
      rules: store.availabilityRules,
      blackouts: store.blackouts,
      bookings: store.bookings,
      locks: listActiveLocks(input.workspaceId, eventType.hostUserId),
      externalBusy: input.externalBusy,
      limit: 5,
    });
    throw new SlotUnavailableError(
      error instanceof Error ? error.message : 'Slot is not available',
      alternatives,
    );
  }

  let lockToken: string | undefined;
  try {
    const lock = acquireSlotLock({
      workspaceId: input.workspaceId,
      hostUserId: eventType.hostUserId,
      startsAt,
      endsAt,
    });
    lockToken = lock.holderToken;
  } catch {
    const alternatives = listOfferedSlots({
      workspaceId: input.workspaceId,
      eventTypeId: eventType.id,
      limit: 5,
      externalBusy: input.externalBusy,
    });
    throw new SlotUnavailableError('Slot just filled; here are alternatives', alternatives);
  }

  const stamp = nowIso();
  const booking: VcalBooking = {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    eventTypeId: eventType.id,
    hostUserId: eventType.hostUserId,
    guestName: input.guestName.trim() || 'Guest',
    guestEmail: input.guestEmail.trim().toLowerCase(),
    startsAt,
    endsAt,
    timezone: input.timezone ?? 'Europe/London',
    status: resolveCreateStatus(eventType),
    guestToken: crypto.randomBytes(24).toString('hex'),
    meetingUrl: input.meetingUrl,
    leadId: input.leadId,
    contactId: input.contactId,
    source: input.source ?? 'api',
    intakeAnswers: input.intakeAnswers,
    notes: input.notes,
    metadata: input.metadata ?? {},
    createdAt: stamp,
    updatedAt: stamp,
  };

  try {
    mutateVicalStore((s) => {
      assertSlotFree({
        eventType,
        startsAt,
        endsAt,
        bookings: s.bookings,
        locks: s.slotLocks.filter((l) => l.holderToken !== lockToken),
        externalBusy: input.externalBusy,
      });
      s.bookings.push(booking);
    });
  } catch (error) {
    if (lockToken) releaseSlotLock(lockToken);
    const alternatives = listOfferedSlots({
      workspaceId: input.workspaceId,
      eventTypeId: eventType.id,
      limit: 5,
      externalBusy: input.externalBusy,
    });
    throw new SlotUnavailableError(
      error instanceof Error ? error.message : 'Slot is not available',
      alternatives,
    );
  }

  if (lockToken) releaseSlotLock(lockToken);
  emitVcalHook({ type: 'booking.created', booking });
  if (booking.status === 'confirmed') emitVcalHook({ type: 'booking.confirmed', booking });
  return booking;
}

/** Outreach adapter create: books against discovery event type when provided. */
export function createFromOutreach(input: {
  workspaceId: string;
  leadId: string;
  email: string;
  name: string;
  startsAt: string;
  endsAt?: string;
  eventTypeId?: string;
  timezone?: string;
  meetingUrl?: string;
  notes?: string;
  externalBusy?: VcalBusyWindow[];
  metadata?: Record<string, unknown>;
}): VcalBooking {
  const eventTypeId =
    input.eventTypeId ??
    listEventTypes(input.workspaceId, { activeOnly: true }).find((e) => e.slug === 'discovery-call')?.id ??
    listEventTypes(input.workspaceId, { activeOnly: true })[0]?.id;
  if (!eventTypeId) throw new VcalError('not_configured', 'No active viCal event type; seed discovery first');
  return createBooking({
    workspaceId: input.workspaceId,
    eventTypeId,
    guestName: input.name,
    guestEmail: input.email,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    timezone: input.timezone,
    source: 'outreach',
    leadId: input.leadId,
    meetingUrl: input.meetingUrl,
    notes: input.notes,
    externalBusy: input.externalBusy,
    metadata: input.metadata,
  });
}

export function approveBooking(workspaceId: string, bookingId: string): VcalBooking {
  const booking = requireWorkspaceBooking(workspaceId, bookingId);
  if (booking.status !== 'pending_review') {
    throw new VcalError('illegal_transition', `Cannot approve from status ${booking.status}`);
  }
  const next: VcalBooking = { ...booking, status: 'confirmed', updatedAt: nowIso() };
  mutateVicalStore((store) => {
    const idx = store.bookings.findIndex((b) => b.id === bookingId && b.workspaceId === workspaceId);
    if (idx >= 0) store.bookings[idx] = next;
  });
  emitVcalHook({ type: 'booking.confirmed', booking: next });
  return next;
}

export function rejectBooking(workspaceId: string, bookingId: string, reason?: string): VcalBooking {
  const booking = requireWorkspaceBooking(workspaceId, bookingId);
  if (booking.status !== 'pending_review') {
    throw new VcalError('illegal_transition', `Cannot reject from status ${booking.status}`);
  }
  const next: VcalBooking = {
    ...booking,
    status: 'rejected',
    cancelReason: reason,
    updatedAt: nowIso(),
  };
  mutateVicalStore((store) => {
    const idx = store.bookings.findIndex((b) => b.id === bookingId && b.workspaceId === workspaceId);
    if (idx >= 0) store.bookings[idx] = next;
  });
  emitVcalHook({ type: 'booking.rejected', booking: next });
  return next;
}

export function cancelBookingForHost(workspaceId: string, bookingId: string, reason?: string): VcalBooking {
  const booking = requireWorkspaceBooking(workspaceId, bookingId);
  if (booking.status === 'cancelled') {
    return booking;
  }
  if (booking.status === 'rejected') {
    throw new VcalError('illegal_transition', `Cannot cancel from status ${booking.status}`);
  }
  const next: VcalBooking = {
    ...booking,
    status: 'cancelled',
    cancelReason: reason,
    updatedAt: nowIso(),
  };
  mutateVicalStore((store) => {
    const idx = store.bookings.findIndex((b) => b.id === bookingId && b.workspaceId === workspaceId);
    if (idx >= 0) store.bookings[idx] = next;
  });
  emitVcalHook({ type: 'booking.cancelled', booking: next });
  return next;
}

export function cancelBookingForGuest(guestToken: string, reason?: string): VcalBooking {
  const booking = getBookingByGuestToken(guestToken);
  if (!booking) throw new VcalError('not_found', 'Booking not found');
  return cancelBookingForHost(booking.workspaceId, booking.id, reason ?? 'guest_cancelled');
}

export function rescheduleBooking(input: {
  workspaceId: string;
  bookingId: string;
  startsAt: string;
  endsAt?: string;
  externalBusy?: VcalBusyWindow[];
}): VcalBooking {
  const booking = requireWorkspaceBooking(input.workspaceId, input.bookingId);
  if (booking.status === 'cancelled' || booking.status === 'rejected') {
    throw new VcalError('illegal_transition', `Cannot reschedule from status ${booking.status}`);
  }
  const eventType = getEventType(input.workspaceId, booking.eventTypeId);
  if (!eventType) throw new VcalError('not_found', 'Event type not found');

  const startsAt = new Date(input.startsAt).toISOString();
  const endsAt = input.endsAt
    ? new Date(input.endsAt).toISOString()
    : new Date(new Date(startsAt).getTime() + eventType.durationMinutes * 60_000).toISOString();

  const store = loadVicalStore();
  try {
    assertSlotFree({
      eventType,
      startsAt,
      endsAt,
      bookings: store.bookings,
      locks: listActiveLocks(input.workspaceId, eventType.hostUserId),
      externalBusy: input.externalBusy,
      excludeBookingId: booking.id,
    });
  } catch (error) {
    throw new SlotUnavailableError(error instanceof Error ? error.message : 'Slot is not available');
  }

  const previousStartsAt = booking.startsAt;
  const previousEndsAt = booking.endsAt;
  const next: VcalBooking = {
    ...booking,
    startsAt,
    endsAt,
    previousStartsAt,
    previousEndsAt,
    updatedAt: nowIso(),
  };
  mutateVicalStore((s) => {
    const idx = s.bookings.findIndex((b) => b.id === booking.id && b.workspaceId === input.workspaceId);
    if (idx >= 0) s.bookings[idx] = next;
  });
  emitVcalHook({
    type: 'booking.rescheduled',
    booking: next,
    previousStartsAt,
    previousEndsAt,
  });
  return next;
}

export function rescheduleBookingForGuest(
  guestToken: string,
  startsAt: string,
  endsAt?: string,
): VcalBooking {
  const booking = getBookingByGuestToken(guestToken);
  if (!booking) throw new VcalError('not_found', 'Booking not found');
  return rescheduleBooking({
    workspaceId: booking.workspaceId,
    bookingId: booking.id,
    startsAt,
    endsAt,
  });
}

export function setSessionOutcome(
  workspaceId: string,
  bookingId: string,
  outcome: VcalSessionOutcome,
): VcalBooking {
  const booking = requireWorkspaceBooking(workspaceId, bookingId);
  if (booking.status !== 'confirmed') {
    throw new VcalError('illegal_transition', 'Outcome only allowed on confirmed bookings');
  }
  const next: VcalBooking = { ...booking, sessionOutcome: outcome, updatedAt: nowIso() };
  mutateVicalStore((store) => {
    const idx = store.bookings.findIndex((b) => b.id === bookingId && b.workspaceId === workspaceId);
    if (idx >= 0) store.bookings[idx] = next;
  });
  emitVcalHook({ type: 'booking.outcome', booking: next });
  return next;
}

export function getOrCreatePublishProfile(input: {
  workspaceId: string;
  hostUserId: string;
  publicSlug?: string;
}): { workspaceId: string; publicSlug: string; hostUserId: string; updatedAt: string } {
  const store = loadVicalStore();
  const existing = store.publishProfiles[input.workspaceId];
  if (existing) return existing;
  const profile = {
    workspaceId: input.workspaceId,
    hostUserId: input.hostUserId,
    publicSlug: input.publicSlug?.trim() || input.workspaceId.slice(0, 8),
    updatedAt: nowIso(),
  };
  mutateVicalStore((s) => {
    s.publishProfiles[input.workspaceId] = profile;
  });
  return profile;
}

export function resolveWorkspaceByPublicSlug(slug: string): string | null {
  const profiles = loadVicalStore().publishProfiles;
  for (const profile of Object.values(profiles)) {
    if (profile.publicSlug === slug) return profile.workspaceId;
  }
  return null;
}
