'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { formatSlotLabel, type VicalBooking } from '@/lib/vical-types';

type ViewMode = 'day' | 'week' | 'month';

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function VicalCalendarPage() {
  const { push } = useToast();
  const [bookings, setBookings] = useState<VicalBooking[]>([]);
  const [view, setView] = useState<ViewMode>('week');
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/aiva/vical/bookings');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        push(json.error || 'Could not load bookings', 'error');
        return;
      }
      setBookings((json.items ?? []) as VicalBooking[]);
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    void load();
  }, [load]);

  const range = useMemo(() => {
    if (view === 'day') return { start: anchor, end: addDays(anchor, 1) };
    if (view === 'week') return { start: anchor, end: addDays(anchor, 7) };
    return { start: anchor, end: addDays(anchor, 31) };
  }, [view, anchor]);

  const grouped = useMemo(() => {
    const map = new Map<string, VicalBooking[]>();
    for (const booking of bookings) {
      if (booking.status === 'cancelled' || booking.status === 'rejected') continue;
      const at = new Date(booking.startsAt);
      if (at < range.start || at >= range.end) continue;
      const key = ymd(at);
      const list = map.get(key) ?? [];
      list.push(booking);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [bookings, range]);

  if (loading) return <div className="p-6 text-sm text-text-muted">Loading booking calendar...</div>;

  return (
    <div className="mx-auto max-w-[90rem] space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                view === mode ? 'bg-elevated text-text-primary' : 'text-text-secondary hover:bg-elevated'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setAnchor(startOfDay(new Date()))}>
            Today
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setAnchor(addDays(anchor, view === 'day' ? -1 : view === 'week' ? -7 : -30))}
          >
            Prev
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setAnchor(addDays(anchor, view === 'day' ? 1 : view === 'week' ? 7 : 30))}
          >
            Next
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/calendar">Workspace Calendar</Link>
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link href="/settings/calendar">Connect Google</Link>
          </Button>
        </div>
      </div>

      <p className="text-xs text-text-muted">
        Booking-centric view from {ymd(range.start)}. Google and local note events stay on{' '}
        <Link className="text-accent underline-offset-2 hover:underline" href="/calendar">
          /calendar
        </Link>
        .
      </p>

      <div className="space-y-4">
        {grouped.map(([day, rows]) => (
          <section key={day}>
            <h2 className="text-sm font-medium text-text-primary">{day}</h2>
            <ul className="mt-2 space-y-2">
              {rows.map((booking) => (
                <li key={booking.id} className="rounded-md border border-border bg-card px-3 py-2 text-xs">
                  <span className="font-medium text-text-primary">{booking.guestName}</span>
                  <span className="text-text-muted">
                    {' '}
                    · {formatSlotLabel(booking.startsAt, booking.timezone)} · {booking.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {grouped.length === 0 ? (
          <p className="text-xs text-text-muted">No bookings in this range.</p>
        ) : null}
      </div>
    </div>
  );
}
