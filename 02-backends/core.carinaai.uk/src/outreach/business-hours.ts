/** Business-hours and rate-limit checks for outreach sends. */

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseHm(value: string): { hour: number; minute: number } | null {
  if (!TIME_RE.test(value)) return null;
  const [h, m] = value.split(':').map(Number);
  return { hour: h!, minute: m! };
}

/**
 * Evaluate whether `now` falls inside campaign business hours for the given timezone.
 * Uses Intl for timezone wall-clock; fails open to true when timezone is invalid.
 */
export function isWithinBusinessHours(input: {
  now: Date;
  timezone: string;
  start: string;
  end: string;
  businessDays: number[];
}): boolean {
  const start = parseHm(input.start);
  const end = parseHm(input.end);
  if (!start || !end) return false;

  let weekday: number;
  let hour: number;
  let minute: number;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: input.timezone || 'UTC',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(input.now);
    const weekdayKey = parts.find((p) => p.type === 'weekday')?.value ?? '';
    const map: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    weekday = map[weekdayKey] ?? input.now.getUTCDay();
    hour = Number(parts.find((p) => p.type === 'hour')?.value ?? input.now.getUTCHours());
    minute = Number(parts.find((p) => p.type === 'minute')?.value ?? input.now.getUTCMinutes());
  } catch {
    return true;
  }

  if (input.businessDays.length > 0 && !input.businessDays.includes(weekday)) {
    return false;
  }

  const mins = hour * 60 + minute;
  const startMins = start.hour * 60 + start.minute;
  const endMins = end.hour * 60 + end.minute;
  if (endMins <= startMins) {
    return mins >= startMins || mins < endMins;
  }
  return mins >= startMins && mins < endMins;
}

export function countSentToday(
  deliveries: Array<{ status: string; updatedAt: string; createdAt: string }>,
  now: Date,
  timezone: string,
): number {
  let todayKey: string;
  try {
    todayKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    todayKey = now.toISOString().slice(0, 10);
  }

  return deliveries.filter((d) => {
    if (!['sent', 'delivered', 'pending_approval'].includes(d.status)) return false;
    const stamp = d.updatedAt || d.createdAt;
    let dayKey: string;
    try {
      dayKey = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone || 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(stamp));
    } catch {
      dayKey = stamp.slice(0, 10);
    }
    return dayKey === todayKey;
  }).length;
}
