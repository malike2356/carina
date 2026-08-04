export type VicalEventType = {
  id: string;
  workspaceId: string;
  hostUserId: string;
  slug: string;
  name: string;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minNoticeMinutes: number;
  horizonDays: number;
  locationMode: string;
  requiresApproval: boolean;
  requiresDeposit: boolean;
  active: boolean;
};

export type VicalSlot = {
  start: string;
  end: string;
  timezone: string;
};

export type VicalBooking = {
  id: string;
  workspaceId: string;
  eventTypeId: string;
  hostUserId: string;
  guestName: string;
  guestEmail: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: string;
  guestToken: string;
  meetingUrl?: string;
  leadId?: string;
  source: string;
  notes?: string;
  sessionOutcome?: string;
  cancelReason?: string;
  previousStartsAt?: string;
  previousEndsAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type VicalAvailabilityRule = {
  id: string;
  workspaceId: string;
  hostUserId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone: string;
};

export type VicalBlackout = {
  id: string;
  workspaceId: string;
  hostUserId: string | null;
  startsOn: string;
  endsOn: string;
  reason?: string;
};

export type VicalPublish = {
  workspaceId: string;
  publicSlug: string;
  hostUserId: string;
  updatedAt: string;
};

export function formatSlotLabel(iso: string, timezone = 'Europe/London'): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toUTCString();
  }
}

export function googleCalendarDeepLink(input: {
  title: string;
  startsAt: string;
  endsAt: string;
  details?: string;
}): string {
  const fmt = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.title,
    dates: `${fmt(input.startsAt)}/${fmt(input.endsAt)}`,
    details: input.details ?? '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
