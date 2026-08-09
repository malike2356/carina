import type { VcalBooking } from './types.js';

function icsEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function toIcsUtc(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${day}T${h}${min}${s}Z`;
}

export type IcsMethod = 'PUBLISH' | 'REQUEST' | 'CANCEL';

/**
 * ICS for guest/host confirmation attachments.
 * Use METHOD:REQUEST for invitations, CANCEL for cancellations, PUBLISH for fallback downloads.
 */
export function formatBookingIcs(
  booking: VcalBooking,
  opts?: {
    method?: IcsMethod;
    organizerEmail?: string;
    sequence?: number;
  },
): string {
  const method = opts?.method ?? 'REQUEST';
  const sequence = opts?.sequence ?? (booking.previousStartsAt ? 1 : 0);
  const uid = `${booking.id}@vical.carinaai.uk`;
  const summary = icsEscape(`Meeting with ${booking.guestName}`);
  const description = icsEscape(
    [booking.meetingUrl ? `Join: ${booking.meetingUrl}` : '', booking.notes ?? '']
      .filter(Boolean)
      .join('\\n'),
  );
  const organizer = opts?.organizerEmail
    ? `ORGANIZER;CN=Host:mailto:${opts.organizerEmail}`
    : 'ORGANIZER;CN=Host:mailto:noreply@carinaai.uk';
  const attendee = booking.guestEmail
    ? `ATTENDEE;CN=${icsEscape(booking.guestName)};RSVP=TRUE;PARTSTAT=NEEDS-ACTION;ROLE=REQ-PARTICIPANT:mailto:${booking.guestEmail}`
    : '';
  const status = method === 'CANCEL' ? 'STATUS:CANCELLED' : 'STATUS:CONFIRMED';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Carina//viCal//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `SEQUENCE:${sequence}`,
    `DTSTAMP:${toIcsUtc(booking.updatedAt || booking.createdAt)}`,
    `DTSTART:${toIcsUtc(booking.startsAt)}`,
    `DTEND:${toIcsUtc(booking.endsAt)}`,
    `SUMMARY:${summary}`,
    description ? `DESCRIPTION:${description}` : '',
    organizer,
    attendee,
    booking.meetingUrl ? `URL:${booking.meetingUrl}` : '',
    status,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return `${lines.join('\r\n')}\r\n`;
}
