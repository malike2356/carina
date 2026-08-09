'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { formatSlotLabel, type VicalBooking, type VicalSlot } from '@/lib/vical-types';

export default function VicalBookingsPage() {
  const { push } = useToast();
  const [bookings, setBookings] = useState<VicalBooking[]>([]);
  const [slots, setSlots] = useState<VicalSlot[]>([]);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
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

  const act = async (bookingId: string, action: 'approve' | 'reject' | 'cancel') => {
    const res = await fetch(`/api/aiva/vical/bookings/${bookingId}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: action === 'reject' || action === 'cancel' ? JSON.stringify({ reason: `host_${action}` }) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      push(err.error || `Could not ${action}`, 'error');
      return;
    }
    push(`Booking ${action}d`, 'success');
    void load();
  };

  const setOutcome = async (bookingId: string, outcome: 'attended' | 'no_show') => {
    const res = await fetch(`/api/aiva/vical/bookings/${bookingId}/outcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome }),
    });
    if (!res.ok) {
      push('Could not set outcome', 'error');
      return;
    }
    void load();
  };

  const openReschedule = async (booking: VicalBooking) => {
    setRescheduleId(booking.id);
    const res = await fetch(
      `/api/aiva/vical/slots?eventTypeId=${encodeURIComponent(booking.eventTypeId)}&limit=12`,
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      push(json.error || 'Could not load slots', 'error');
      return;
    }
    setSlots((json.items ?? []) as VicalSlot[]);
  };

  const reschedule = async (startsAt: string, endsAt: string) => {
    if (!rescheduleId) return;
    const res = await fetch(`/api/aiva/vical/bookings/${rescheduleId}/reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startsAt, endsAt }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      push(err.error || 'Could not reschedule', 'error');
      return;
    }
    setRescheduleId(null);
    setSlots([]);
    push('Rescheduled', 'success');
    void load();
  };

  if (loading) return <div className="p-6 text-sm text-text-muted">Loading bookings...</div>;

  return (
    <div className="w-full min-w-0 max-w-none space-y-6 p-4 sm:p-6">
      <ul className="space-y-3">
        {bookings.map((booking) => (
          <li key={booking.id} className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-medium text-text-primary">
              {booking.guestName} · {booking.guestEmail} · {booking.status}
              {booking.orchestrationStatus === 'action_required' ? ' · action_required' : ''}
            </p>
            <p className="text-xs text-text-muted">
              {formatSlotLabel(booking.startsAt, booking.timezone)} · source {booking.source}
              {booking.sessionOutcome ? ` · outcome ${booking.sessionOutcome}` : ''}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Invitation:{' '}
              {booking.invitationUiLabel
                || booking.invitationDeliveryState
                || 'pending'}
              {booking.calendarSyncStatus ? ` · calendar ${booking.calendarSyncStatus}` : ''}
            </p>
            <p className="mt-1 text-[11px] text-text-muted">
              Invitation sent means the provider was asked to notify the guest. It does not promise
              automatic insertion on the guest calendar.
            </p>
            {booking.actionRequiredReason ? (
              <p className="mt-1 text-xs text-danger">Action required: {booking.actionRequiredReason}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {booking.status === 'pending_review' ? (
                <>
                  <Button size="sm" onClick={() => void act(booking.id, 'approve')}>
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void act(booking.id, 'reject')}>
                    Reject
                  </Button>
                </>
              ) : null}
              {booking.status === 'confirmed' ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => void setOutcome(booking.id, 'attended')}>
                    Attended
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void setOutcome(booking.id, 'no_show')}>
                    No-show
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void openReschedule(booking)}>
                    Reschedule
                  </Button>
                </>
              ) : null}
              {booking.status !== 'cancelled' && booking.status !== 'rejected' ? (
                <Button size="sm" variant="ghost" onClick={() => void act(booking.id, 'cancel')}>
                  Cancel
                </Button>
              ) : null}
            </div>
            {rescheduleId === booking.id && slots.length > 0 ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {slots.map((slot) => (
                  <button
                    key={slot.start}
                    type="button"
                    className="rounded-md border border-border bg-elevated px-3 py-2 text-left text-xs hover:border-accent"
                    onClick={() => void reschedule(slot.start, slot.end)}
                  >
                    {formatSlotLabel(slot.start, slot.timezone)}
                  </button>
                ))}
              </div>
            ) : null}
          </li>
        ))}
        {bookings.length === 0 ? (
          <li className="text-xs text-text-muted">No bookings yet. Share your public link from the Hub.</li>
        ) : null}
      </ul>
    </div>
  );
}
