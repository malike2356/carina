'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatSlotLabel, type VicalBooking, type VicalSlot } from '@/lib/vical-types';

export default function BookManagePage() {
  const params = useParams<{ slug: string; token: string }>();
  const [booking, setBooking] = useState<VicalBooking | null>(null);
  const [slots, setSlots] = useState<VicalSlot[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    const res = await fetch(`/api/vical/guest/${encodeURIComponent(params.token)}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || 'Booking not found.');
      return;
    }
    setBooking(json as VicalBooking);
  }, [params.token]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadSlots = async () => {
    if (!booking) return;
    const res = await fetch(
      `/api/vical/public/${encodeURIComponent(params.slug)}/slots?eventTypeId=${encodeURIComponent(booking.eventTypeId)}&limit=12`,
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || 'Could not load slots.');
      return;
    }
    setSlots((json.items ?? []) as VicalSlot[]);
  };

  const cancel = async () => {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch(`/api/vical/guest/${encodeURIComponent(params.token)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'guest_cancelled' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (String(json.error || '').toLowerCase().includes('cancel')) {
          setMessage('This booking is already cancelled.');
          void load();
          return;
        }
        setError(json.error || 'Could not cancel.');
        return;
      }
      setBooking(json as VicalBooking);
      setMessage('Booking cancelled.');
    } finally {
      setBusy(false);
    }
  };

  const reschedule = async (slot: VicalSlot) => {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch(`/api/vical/guest/${encodeURIComponent(params.token)}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startsAt: slot.start, endsAt: slot.end }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'That slot just filled; pick another.');
        void loadSlots();
        return;
      }
      setBooking(json as VicalBooking);
      setSlots([]);
      setMessage('Booking rescheduled.');
    } finally {
      setBusy(false);
    }
  };

  if (error && !booking) {
    return <p className="text-sm text-text-muted" role="alert">{error}</p>;
  }
  if (!booking) {
    return <p className="text-sm text-text-muted">Loading...</p>;
  }

  const closed = booking.status === 'cancelled' || booking.status === 'rejected';

  return (
    <>
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Manage booking</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Cancel or reschedule</h1>
        <p className="mt-2 text-sm text-text-secondary">
          {formatSlotLabel(booking.startsAt, booking.timezone)} · {booking.status}
        </p>
      </header>

      {message ? (
        <p className="mb-4 rounded-md border border-border bg-elevated px-3 py-2 text-sm">{message}</p>
      ) : null}
      {error ? (
        <p className="mb-4 rounded-md border border-border bg-elevated px-3 py-2 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {!closed ? (
        <div className="space-y-4">
          <Button variant="outline" disabled={busy} onClick={() => void cancel()}>
            Cancel booking
          </Button>
          <div>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void loadSlots()}>
              Show other times
            </Button>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {slots.map((slot) => (
                <button
                  key={slot.start}
                  type="button"
                  disabled={busy}
                  className="rounded-md border border-border bg-card px-3 py-2 text-left text-xs hover:border-accent"
                  onClick={() => void reschedule(slot)}
                >
                  {formatSlotLabel(slot.start, slot.timezone)}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-text-muted">This booking is closed ({booking.status}).</p>
      )}

      <p className="mt-8 text-sm">
        <Link className="text-accent underline-offset-2 hover:underline" href={`/book/${encodeURIComponent(params.slug)}`}>
          Back to booking page
        </Link>
      </p>
    </>
  );
}
