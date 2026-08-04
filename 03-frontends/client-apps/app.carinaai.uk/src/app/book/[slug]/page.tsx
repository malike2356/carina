'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatSlotLabel, type VicalEventType, type VicalSlot } from '@/lib/vical-types';

type Step = 'session' | 'slot' | 'details' | 'confirm';

const STEPS: Step[] = ['session', 'slot', 'details', 'confirm'];

export default function PublicBookPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();

  const [step, setStep] = useState<Step>('session');
  const [eventTypes, setEventTypes] = useState<VicalEventType[]>([]);
  const [eventTypeId, setEventTypeId] = useState('');
  const [slots, setSlots] = useState<VicalSlot[]>([]);
  const [slot, setSlot] = useState<VicalSlot | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const selectedType = useMemo(
    () => eventTypes.find((e) => e.id === eventTypeId) ?? null,
    [eventTypes, eventTypeId],
  );
  const timezone = slots[0]?.timezone || 'Europe/London';

  const loadTypes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/vical/public/${encodeURIComponent(slug)}/event-types`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'This booking page is unavailable.');
        setEventTypes([]);
        return;
      }
      const items = (json.items ?? []) as VicalEventType[];
      setEventTypes(items);
      if (items[0]) setEventTypeId(items[0].id);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadTypes();
  }, [loadTypes]);

  const loadSlots = useCallback(async () => {
    if (!eventTypeId) return;
    setError('');
    const res = await fetch(
      `/api/vical/public/${encodeURIComponent(slug)}/slots?eventTypeId=${encodeURIComponent(eventTypeId)}&limit=12`,
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || 'Could not load slots.');
      setSlots([]);
      return;
    }
    setSlots((json.items ?? []) as VicalSlot[]);
  }, [slug, eventTypeId]);

  useEffect(() => {
    if (step === 'slot' && eventTypeId) void loadSlots();
  }, [step, eventTypeId, loadSlots]);

  const stepIndex = STEPS.indexOf(step);

  const submit = async () => {
    if (!selectedType || !slot) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/vical/public/${encodeURIComponent(slug)}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventTypeId: selectedType.id,
          guestName: guestName.trim() || 'Guest',
          guestEmail: guestEmail.trim(),
          startsAt: slot.start,
          endsAt: slot.end,
          timezone,
          notes: notes.trim() || undefined,
          website,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json.code === 'slot_unavailable' || res.status === 409) {
          setError('That slot just filled; pick another.');
          setStep('slot');
          setSlot(null);
          void loadSlots();
        } else {
          setError(json.error || 'Could not complete booking.');
        }
        return;
      }
      const token = String(json.guestToken || '');
      if (token) router.push(`/book/${encodeURIComponent(slug)}/thanks/${encodeURIComponent(token)}`);
      else setError('Booking created but confirmation token was missing.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-text-muted">Loading booking page...</p>;
  }

  return (
    <>
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Book a session</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text-primary">Choose a time</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Times shown in {timezone}. No account needed.
        </p>
      </header>

      <ol className="mb-6 flex gap-2 text-xs text-text-muted" aria-label="Booking steps">
        {STEPS.map((name, index) => (
          <li
            key={name}
            className={index <= stepIndex ? 'font-medium text-text-primary' : undefined}
          >
            {index + 1}. {name}
            {index < STEPS.length - 1 ? <span className="mx-2 text-text-muted">/</span> : null}
          </li>
        ))}
      </ol>

      {error ? (
        <p className="mb-4 rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary" role="alert">
          {error}
        </p>
      ) : null}

      {step === 'session' ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-text-primary">Session type</h2>
          {eventTypes.length === 0 ? (
            <p className="text-sm text-text-muted">No public sessions are available yet.</p>
          ) : (
            <ul className="space-y-2">
              {eventTypes.map((type) => (
                <li key={type.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setEventTypeId(type.id);
                      setSlot(null);
                      setStep('slot');
                    }}
                    className={`w-full rounded-md border px-4 py-3 text-left transition-colors ${
                      eventTypeId === type.id
                        ? 'border-accent bg-elevated'
                        : 'border-border bg-card hover:border-accent'
                    }`}
                  >
                    <span className="block text-sm font-medium text-text-primary">{type.name}</span>
                    <span className="mt-1 block text-xs text-text-muted">
                      {type.durationMinutes} minutes
                      {type.requiresApproval ? ' · needs host approval' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {step === 'slot' ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-text-primary">
              Date and time · {selectedType?.name}
            </h2>
            <Button size="sm" variant="ghost" onClick={() => setStep('session')}>
              Change type
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {slots.map((row) => (
              <button
                key={row.start}
                type="button"
                onClick={() => {
                  setSlot(row);
                  setStep('details');
                }}
                className={`rounded-md border px-3 py-2 text-left text-xs ${
                  slot?.start === row.start
                    ? 'border-accent bg-elevated'
                    : 'border-border bg-card hover:border-accent'
                }`}
              >
                {formatSlotLabel(row.start, row.timezone)}
              </button>
            ))}
          </div>
          {slots.length === 0 ? (
            <p className="text-sm text-text-muted">No open slots in the booking window.</p>
          ) : null}
        </section>
      ) : null}

      {step === 'details' ? (
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-text-primary">Your details</h2>
          <p className="text-xs text-text-muted">
            {selectedType?.name} · {slot ? formatSlotLabel(slot.start, timezone) : ''}
          </p>
          <label className="block text-xs text-text-muted">
            Name
            <input
              className="mt-1 w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              autoComplete="name"
            />
          </label>
          <label className="block text-xs text-text-muted">
            Email
            <input
              type="email"
              required
              className="mt-1 w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label className="block text-xs text-text-muted">
            Notes (optional)
            <textarea
              className="mt-1 w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          {/* Honeypot: hidden from humans */}
          <label className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
            Website
            <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep('slot')}>
              Back
            </Button>
            <Button
              disabled={!guestEmail.trim()}
              onClick={() => setStep('confirm')}
            >
              Continue
            </Button>
          </div>
        </section>
      ) : null}

      {step === 'confirm' ? (
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-text-primary">Confirm</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-text-muted">Session</dt>
              <dd>{selectedType?.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">When</dt>
              <dd>{slot ? formatSlotLabel(slot.start, timezone) : ''} ({timezone})</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Guest</dt>
              <dd>
                {guestName || 'Guest'} · {guestEmail}
              </dd>
            </div>
          </dl>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep('details')} disabled={submitting}>
              Back
            </Button>
            <Button onClick={() => void submit()} disabled={submitting}>
              {submitting ? 'Booking...' : 'Confirm booking'}
            </Button>
          </div>
        </section>
      ) : null}

      <p className="mt-auto pt-10 text-center text-[11px] text-text-muted">
        Powered by viCal · <Link href="/legal/privacy" className="underline-offset-2 hover:underline">Privacy</Link>
      </p>
    </>
  );
}
