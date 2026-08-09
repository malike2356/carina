'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import {
  formatSlotLabel,
  type VicalBooking,
  type VicalEventType,
  type VicalPublish,
} from '@/lib/vical-types';

type SeedResponse = {
  eventType: VicalEventType;
  created: boolean;
  publish: VicalPublish;
};

export default function VicalHubPage() {
  const { push } = useToast();
  const [bookings, setBookings] = useState<VicalBooking[]>([]);
  const [eventTypes, setEventTypes] = useState<VicalEventType[]>([]);
  const [publish, setPublish] = useState<VicalPublish | null>(null);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const seedRes = await fetch('/api/aiva/vical/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const seedJson = (await seedRes.json().catch(() => ({}))) as SeedResponse & { error?: string };
      if (seedRes.ok) {
        setPublish(seedJson.publish ?? null);
      }

      const [typesRes, bookingsRes] = await Promise.all([
        fetch('/api/aiva/vical/event-types'),
        fetch('/api/aiva/vical/bookings'),
      ]);
      const typesJson = await typesRes.json().catch(() => ({}));
      const bookingsJson = await bookingsRes.json().catch(() => ({}));
      if (typesRes.ok) setEventTypes((typesJson.items ?? []) as VicalEventType[]);
      if (bookingsRes.ok) setBookings((bookingsJson.items ?? []) as VicalBooking[]);
      if (!seedRes.ok && !typesRes.ok) {
        push(seedJson.error || 'Could not reach viCal backend. Is Core running?', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = useMemo(
    () => bookings.filter((b) => b.status === 'pending_review'),
    [bookings],
  );
  const upcoming = useMemo(
    () =>
      bookings
        .filter((b) => b.status === 'confirmed' || b.status === 'pending_review' || b.status === 'pending_payment')
        .filter((b) => new Date(b.startsAt).getTime() >= Date.now() - 60_000)
        .slice(0, 8),
    [bookings],
  );

  const publicUrl = publish && origin ? `${origin}/book/${publish.publicSlug}` : '';
  const embedSnippet = publicUrl
    ? `<iframe src="${origin}/book/embed/${publish!.publicSlug}" width="100%" height="720" style="border:0;" title="Book a session"></iframe>`
    : '';

  const approve = async (bookingId: string) => {
    const res = await fetch(`/api/aiva/vical/bookings/${bookingId}/approve`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      push(err.error || 'Could not approve', 'error');
      return;
    }
    push('Booking approved', 'success');
    void load();
  };

  const reject = async (bookingId: string) => {
    const res = await fetch(`/api/aiva/vical/bookings/${bookingId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'host_rejected' }),
    });
    if (!res.ok) {
      push('Could not reject', 'error');
      return;
    }
    push('Booking rejected', 'success');
    void load();
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      push(`${label} copied`, 'success');
    } catch {
      push('Could not copy', 'error');
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-text-muted">Loading viCal hub...</div>;
  }

  return (
    <div className="w-full min-w-0 max-w-none space-y-6 p-4 sm:p-6">
      {pending.length > 0 ? (
        <div className="rounded-lg border border-amber-500/40 bg-elevated p-4">
          <p className="text-sm font-medium text-text-primary">
            {pending.length} booking{pending.length === 1 ? '' : 's'} awaiting approval
          </p>
          <ul className="mt-3 space-y-2">
            {pending.map((booking) => (
              <li
                key={booking.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2"
              >
                <div className="text-xs">
                  <p className="font-medium text-text-primary">
                    {booking.guestName} · {booking.guestEmail}
                  </p>
                  <p className="text-text-muted">{formatSlotLabel(booking.startsAt, booking.timezone)}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void approve(booking.id)}>
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void reject(booking.id)}>
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {eventTypes.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-sm font-semibold text-text-primary">Set up your first booking offer</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Create an event type and evening (or custom) availability windows, then share your public link.
            Confirmed sessions can also sync when Google Calendar is connected.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/vical/event-types">Create event type</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/vical/availability">Set availability</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/settings/calendar">Connect Google Calendar</Link>
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-text-primary">Upcoming</h2>
            <Button size="sm" variant="outline" asChild>
              <Link href="/vical/bookings">All bookings</Link>
            </Button>
          </div>
          <ul className="mt-3 space-y-2">
            {upcoming.map((booking) => (
              <li key={booking.id} className="rounded-md border border-border bg-elevated px-3 py-2 text-xs">
                <p className="font-medium text-text-primary">
                  {booking.guestName} · {booking.status}
                </p>
                <p className="text-text-muted">
                  {formatSlotLabel(booking.startsAt, booking.timezone)} · {booking.source}
                </p>
              </li>
            ))}
            {upcoming.length === 0 ? (
              <li className="text-xs text-text-muted">No upcoming bookings yet.</li>
            ) : null}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-medium text-text-primary">Quick links</h2>
            <ul className="mt-3 space-y-2 text-xs">
              <li>
                <Link className="text-accent underline-offset-2 hover:underline" href="/vical/event-types">
                  Event types
                </Link>
              </li>
              <li>
                <Link className="text-accent underline-offset-2 hover:underline" href="/vical/availability">
                  Availability and blackouts
                </Link>
              </li>
              <li>
                <Link className="text-accent underline-offset-2 hover:underline" href="/calendar">
                  Workspace Calendar (Google + local)
                </Link>
              </li>
              <li>
                <Link className="text-accent underline-offset-2 hover:underline" href="/settings/calendar">
                  Connect Google Calendar
                </Link>
              </li>
            </ul>
            <p className="mt-3 text-[11px] text-text-muted">
              Booking rows live in viCal. The Calendar page remains your Google sync and local events view.
            </p>
          </div>

          <details className="rounded-lg border border-border bg-card p-4">
            <summary className="cursor-pointer text-sm font-medium text-text-primary">
              Public link and embed
            </summary>
            <div className="mt-3 space-y-3 text-xs">
              {publicUrl ? (
                <>
                  <div>
                    <p className="text-text-muted">Public booking URL</p>
                    <p className="mt-1 break-all text-text-primary">{publicUrl}</p>
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => void copy(publicUrl, 'Link')}>
                      Copy link
                    </Button>
                  </div>
                  <div>
                    <p className="text-text-muted">Embed snippet</p>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-elevated p-2 text-[10px] text-text-secondary">
                      {embedSnippet}
                    </pre>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => void copy(embedSnippet, 'Embed')}
                    >
                      Copy embed
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-text-muted">Seed the hub once Core is reachable to get a public slug.</p>
              )}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
