'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatSlotLabel, googleCalendarDeepLink, type VicalBooking } from '@/lib/vical-types';

export default function BookThanksPage() {
  const params = useParams<{ slug: string; token: string }>();
  const [booking, setBooking] = useState<VicalBooking | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/vical/guest/${encodeURIComponent(params.token)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Booking not found.');
        return;
      }
      setBooking(json as VicalBooking);
    })();
  }, [params.token]);

  if (error) {
    return <p className="text-sm text-text-muted" role="alert">{error}</p>;
  }
  if (!booking) {
    return <p className="text-sm text-text-muted">Loading confirmation...</p>;
  }

  const calendarUrl = googleCalendarDeepLink({
    title: 'Booked session',
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    details: booking.meetingUrl ? `Join: ${booking.meetingUrl}` : undefined,
  });

  return (
    <>
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Confirmed</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">You are booked</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Status: {booking.status}. A calendar add link is below; email confirmations arrive in a later release.
        </p>
      </header>

      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-xs text-text-muted">When</dt>
          <dd>
            {formatSlotLabel(booking.startsAt, booking.timezone)} ({booking.timezone})
          </dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Guest</dt>
          <dd>
            {booking.guestName} · {booking.guestEmail}
          </dd>
        </div>
        {booking.meetingUrl ? (
          <div>
            <dt className="text-xs text-text-muted">Join</dt>
            <dd>
              <a className="text-accent underline-offset-2 hover:underline" href={booking.meetingUrl}>
                {booking.meetingUrl}
              </a>
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-8 flex flex-wrap gap-2">
        <Button asChild>
          <a href={calendarUrl} target="_blank" rel="noreferrer">
            Add to Google Calendar
          </a>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/book/${encodeURIComponent(params.slug)}/manage/${encodeURIComponent(params.token)}`}>
            Cancel or reschedule
          </Link>
        </Button>
      </div>
    </>
  );
}
