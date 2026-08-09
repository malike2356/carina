'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import type { OutreachLead } from '@/components/outreach/types';

type Slot = { start: string; end: string };
type Booking = {
  id: string;
  leadId: string;
  status: string;
  startsAt: string;
  endsAt: string;
  attendeeName?: string;
  attendeeEmail?: string;
  confirmationStatus: string;
  confirmationSubject: string;
  joinLink?: string;
};
type Reminder = {
  id: string;
  bookingId: string;
  kind: string;
  dueAt: string;
  status: string;
  subject: string;
  operatorAlert?: boolean;
};

export default function OutreachBookingsPage() {
  const { push } = useToast();
  const [leads, setLeads] = useState<OutreachLead[]>([]);
  const [leadId, setLeadId] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/aiva/outreach/leads').then((res) => (res.ok ? res.json() : { leads: [] })),
      fetch('/api/aiva/outreach/availability?days=7').then((res) => (res.ok ? res.json() : { slots: [] })),
      fetch('/api/aiva/outreach/bookings').then((res) => (res.ok ? res.json() : { bookings: [] })),
      fetch('/api/aiva/outreach/reminders').then((res) => (res.ok ? res.json() : { reminders: [] })),
    ])
      .then(([leadJson, slotJson, bookingJson, reminderJson]) => {
        const nextLeads = (leadJson.leads ?? []) as OutreachLead[];
        setLeads(nextLeads);
        if (!leadId && nextLeads[0]) setLeadId(nextLeads[0].id);
        setSlots(slotJson.slots ?? []);
        setBookings(bookingJson.bookings ?? []);
        setReminders(reminderJson.reminders ?? []);
      })
      .finally(() => setLoading(false));
  }, [leadId]);

  useEffect(() => {
    load();
  }, [load]);

  const book = useCallback(
    async (slot: Slot) => {
      if (!leadId) {
        push('Pick a lead first', 'error');
        return;
      }
      const res = await fetch('/api/aiva/outreach/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, startsAt: slot.start, endsAt: slot.end, kind: 'discovery' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        push(err.error || 'Could not create booking', 'error');
        return;
      }
      push('Booking created; confirmation awaits Soft Wall', 'success');
      load();
    },
    [leadId, push, load],
  );

  const act = useCallback(
    async (bookingId: string, action: 'cancel' | 'no-show' | 'attended' | 'confirmation-sent') => {
      const res = await fetch(`/api/aiva/outreach/bookings/${bookingId}/${action}`, { method: 'POST' });
      if (!res.ok) {
        push(`Could not ${action}`, 'error');
        return;
      }
      load();
    },
    [push, load],
  );

  const processReminders = useCallback(async () => {
    const res = await fetch('/api/aiva/outreach/reminders/process-due', { method: 'POST' });
    if (!res.ok) {
      push('Could not process reminders', 'error');
      return;
    }
    const json = await res.json();
    push(`Reminders sent ${json.sent?.length ?? 0}; skipped ${json.skipped?.length ?? 0}`, 'success');
    load();
  }, [push, load]);

  if (loading) return <div className="p-6 text-sm text-text-muted">Loading bookings...</div>;

  return (
    <div className="w-full max-w-none space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text-secondary">
          Availability uses business hours and blocks confirmed bookings. Calendar busy windows can be passed from Google later.
        </p>
        <Button size="sm" variant="outline" onClick={() => void processReminders()}>
          Process due reminders
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <label className="text-xs text-text-muted">Lead</label>
        <select
          className="mt-1 w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm"
          value={leadId}
          onChange={(e) => setLeadId(e.target.value)}
        >
          {leads.map((lead) => (
            <option key={lead.id} value={lead.id}>
              {lead.name}{lead.email ? ` (${lead.email})` : ''}
            </option>
          ))}
        </select>
        <h2 className="mt-4 text-sm font-medium text-text-primary">Open slots</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {slots.slice(0, 12).map((slot) => (
            <button
              key={slot.start}
              type="button"
              className="rounded-md border border-border bg-elevated px-3 py-2 text-left text-xs hover:border-accent"
              onClick={() => void book(slot)}
            >
              {new Date(slot.start).toUTCString()}
            </button>
          ))}
          {slots.length === 0 ? <p className="text-xs text-text-muted">No open slots in the next week.</p> : null}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium text-text-primary">Bookings</h2>
        <div className="mt-2 space-y-2">
          {bookings.map((booking) => (
            <div key={booking.id} className="rounded-lg border border-border bg-card p-3">
              <p className="text-sm font-medium text-text-primary">
                {booking.attendeeName || booking.attendeeEmail || booking.leadId} · {booking.status}
              </p>
              <p className="text-xs text-text-muted">
                {new Date(booking.startsAt).toUTCString()} · confirmation {booking.confirmationStatus}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/aiva/outreach/leads/${booking.leadId}`}>Lead</Link>
                </Button>
                {booking.confirmationStatus === 'pending_approval' ? (
                  <Button size="sm" variant="outline" onClick={() => void act(booking.id, 'confirmation-sent')}>
                    Mark confirmation sent
                  </Button>
                ) : null}
                <Button size="sm" variant="outline" onClick={() => void act(booking.id, 'attended')}>
                  Attended
                </Button>
                <Button size="sm" variant="outline" onClick={() => void act(booking.id, 'no-show')}>
                  No-show
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void act(booking.id, 'cancel')}>
                  Cancel
                </Button>
              </div>
            </div>
          ))}
          {bookings.length === 0 ? <p className="text-xs text-text-muted">No bookings yet.</p> : null}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium text-text-primary">Reminders</h2>
        <ul className="mt-2 space-y-1">
          {reminders.slice(0, 30).map((reminder) => (
            <li key={reminder.id} className="rounded-md border border-border bg-card px-3 py-2 text-xs">
              {reminder.kind} · {reminder.status} · due {new Date(reminder.dueAt).toUTCString()}
              {reminder.operatorAlert ? ' · operator alert' : ''}
            </li>
          ))}
          {reminders.length === 0 ? <li className="text-xs text-text-muted">No reminders scheduled.</li> : null}
        </ul>
      </div>
    </div>
  );
}
