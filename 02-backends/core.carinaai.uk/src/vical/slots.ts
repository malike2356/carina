import type {
  VcalAvailabilityRule,
  VcalBlackoutDate,
  VcalBooking,
  VcalBusyWindow,
  VcalEventType,
  VcalOfferedSlot,
  VcalSlotLock,
} from './types.js';

const SLOT_STEP_MINUTES = 15;
const HOLDING_STATUSES = new Set(['confirmed', 'pending_review', 'pending_payment']);

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function parseHm(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function ymdInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function weekdayInTimezone(date: Date, timezone: string): number {
  try {
    const label = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, weekday: 'short' }).format(date);
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return map[label] ?? date.getUTCDay();
  } catch {
    return date.getUTCDay();
  }
}

/** Build an approximate UTC Date for a wall-clock time in timezone (MVP; matches outreach approach). */
export function wallClockToDate(ymd: string, hm: string, _timezone: string): Date {
  const [hour, minute] = hm.split(':').map(Number);
  const padded = `${ymd}T${String(hour ?? 0).padStart(2, '0')}:${String(minute ?? 0).padStart(2, '0')}:00Z`;
  return new Date(padded);
}

export function collectBusyFromBookings(bookings: VcalBooking[], bufferBefore = 0, bufferAfter = 0): VcalBusyWindow[] {
  return bookings
    .filter((b) => HOLDING_STATUSES.has(b.status))
    .map((b) => ({
      start: new Date(new Date(b.startsAt).getTime() - bufferBefore * 60_000).toISOString(),
      end: new Date(new Date(b.endsAt).getTime() + bufferAfter * 60_000).toISOString(),
    }));
}

export function collectBusyFromLocks(locks: VcalSlotLock[], now = new Date()): VcalBusyWindow[] {
  const nowMs = now.getTime();
  return locks
    .filter((lock) => new Date(lock.expiresAt).getTime() > nowMs)
    .map((lock) => ({ start: lock.startsAt, end: lock.endsAt }));
}

function isBlackedOut(ymd: string, blackouts: VcalBlackoutDate[]): boolean {
  return blackouts.some((b) => ymd >= b.startsOn && ymd <= b.endsOn);
}

export function offerSlots(input: {
  eventType: VcalEventType;
  rules: VcalAvailabilityRule[];
  blackouts: VcalBlackoutDate[];
  bookings: VcalBooking[];
  locks: VcalSlotLock[];
  externalBusy?: VcalBusyWindow[];
  from?: Date;
  limit?: number;
  now?: Date;
  excludeBookingId?: string;
}): VcalOfferedSlot[] {
  const now = input.now ?? new Date();
  const from = input.from ?? now;
  const limit = Math.max(1, Math.min(80, input.limit ?? 5));
  const timezone =
    input.rules.find((r) => r.timezone)?.timezone ??
    input.bookings[0]?.timezone ??
    'Europe/London';

  const hostRules = input.rules.filter(
    (r) =>
      r.workspaceId === input.eventType.workspaceId &&
      r.hostUserId === input.eventType.hostUserId &&
      (r.eventTypeId == null || r.eventTypeId === input.eventType.id),
  );

  const relevantBookings = input.bookings.filter(
    (b) =>
      b.workspaceId === input.eventType.workspaceId &&
      b.hostUserId === input.eventType.hostUserId &&
      b.id !== input.excludeBookingId,
  );
  const relevantLocks = input.locks.filter(
    (l) => l.workspaceId === input.eventType.workspaceId && l.hostUserId === input.eventType.hostUserId,
  );
  const blackouts = input.blackouts.filter(
    (b) =>
      b.workspaceId === input.eventType.workspaceId &&
      (b.hostUserId == null || b.hostUserId === input.eventType.hostUserId),
  );

  const busy: VcalBusyWindow[] = [
    ...collectBusyFromBookings(
      relevantBookings,
      input.eventType.bufferBeforeMinutes,
      input.eventType.bufferAfterMinutes,
    ),
    ...collectBusyFromLocks(relevantLocks, now),
    ...(input.externalBusy ?? []),
  ];

  const duration = Math.max(15, input.eventType.durationMinutes);
  const minNoticeMs = Math.max(0, input.eventType.minNoticeMinutes) * 60_000;
  const horizonDays = Math.max(1, Math.min(60, input.eventType.horizonDays));
  const slots: VcalOfferedSlot[] = [];

  for (let day = 0; day < horizonDays; day += 1) {
    const cursor = new Date(from.getTime() + day * 24 * 60 * 60 * 1000);
    const ymd = ymdInTimezone(cursor, timezone);
    if (isBlackedOut(ymd, blackouts)) continue;
    const weekday = weekdayInTimezone(cursor, timezone);
    const dayRules = hostRules.filter((r) => r.dayOfWeek === weekday);
    for (const rule of dayRules) {
      const startMins = parseHm(rule.startTime);
      const endMins = parseHm(rule.endTime);
      for (let mins = startMins; mins + duration <= endMins; mins += SLOT_STEP_MINUTES) {
        const hour = Math.floor(mins / 60);
        const minute = mins % 60;
        const hm = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        const start = wallClockToDate(ymd, hm, timezone);
        const end = new Date(start.getTime() + duration * 60_000);
        if (start.getTime() < now.getTime() + minNoticeMs) continue;
        const conflict = busy.some((window) =>
          overlaps(
            start.getTime(),
            end.getTime(),
            new Date(window.start).getTime(),
            new Date(window.end).getTime(),
          ),
        );
        if (conflict) continue;
        slots.push({ start: start.toISOString(), end: end.toISOString(), timezone });
        if (slots.length >= limit) return slots;
      }
    }
  }

  return slots;
}

export function assertSlotFree(input: {
  eventType: VcalEventType;
  startsAt: string;
  endsAt: string;
  bookings: VcalBooking[];
  locks: VcalSlotLock[];
  externalBusy?: VcalBusyWindow[];
  excludeBookingId?: string;
  now?: Date;
}): void {
  const startMs = new Date(input.startsAt).getTime();
  const endMs = new Date(input.endsAt).getTime();
  if (!(startMs < endMs)) {
    throw new Error('endsAt must be after startsAt');
  }
  const now = input.now ?? new Date();
  const minNoticeMs = Math.max(0, input.eventType.minNoticeMinutes) * 60_000;
  if (startMs < now.getTime() + minNoticeMs) {
    throw new Error('Slot is inside minimum notice window');
  }

  const busy: VcalBusyWindow[] = [
    ...collectBusyFromBookings(
      input.bookings.filter(
        (b) =>
          b.workspaceId === input.eventType.workspaceId &&
          b.hostUserId === input.eventType.hostUserId &&
          b.id !== input.excludeBookingId,
      ),
      input.eventType.bufferBeforeMinutes,
      input.eventType.bufferAfterMinutes,
    ),
    ...collectBusyFromLocks(
      input.locks.filter(
        (l) => l.workspaceId === input.eventType.workspaceId && l.hostUserId === input.eventType.hostUserId,
      ),
      now,
    ),
    ...(input.externalBusy ?? []),
  ];

  const conflict = busy.some((window) =>
    overlaps(startMs, endMs, new Date(window.start).getTime(), new Date(window.end).getTime()),
  );
  if (conflict) {
    throw new Error('Slot is not available');
  }
}
