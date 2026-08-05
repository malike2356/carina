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

/** Minimal ICS for guest/host confirmation attachments. */
export function formatBookingIcs(booking: VcalBooking): string {
  const uid = `${booking.id}@vical.carinaai.uk`;
  const summary = icsEscape(`Meeting with ${booking.guestName}`);
  const description = icsEscape(
    [booking.meetingUrl ? `Join: ${booking.meetingUrl}` : '', booking.notes ?? ''].filter(Boolean).join('\\n'),
  );
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Carina//viCal//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toIcsUtc(booking.updatedAt || booking.createdAt)}`,
    `DTSTART:${toIcsUtc(booking.startsAt)}`,
    `DTEND:${toIcsUtc(booking.endsAt)}`,
    `SUMMARY:${summary}`,
    description ? `DESCRIPTION:${description}` : '',
    booking.guestEmail ? `ATTENDEE;CN=${icsEscape(booking.guestName)}:mailto:${booking.guestEmail}` : '',
    booking.meetingUrl ? `URL:${booking.meetingUrl}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return `${lines.join('\r\n')}\r\n`;
}
