'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import type { VicalEventType } from '@/lib/vical-types';

export default function VicalEventTypesPage() {
  const { push } = useToast();
  const [items, setItems] = useState<VicalEventType[]>([]);
  const [name, setName] = useState('Discovery call');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await fetch('/api/aiva/vical/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const res = await fetch('/api/aiva/vical/event-types');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        push(json.error || 'Could not load event types', 'error');
        return;
      }
      setItems((json.items ?? []) as VicalEventType[]);
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    const res = await fetch('/api/aiva/vical/event-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim() || 'Session',
        durationMinutes,
        requiresApproval,
        bufferAfterMinutes: 10,
        minNoticeMinutes: 120,
        horizonDays: 14,
        locationMode: 'google_meet',
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      push(json.error || 'Could not create event type', 'error');
      return;
    }
    push('Event type created', 'success');
    setName('');
    void load();
  };

  const toggleActive = async (row: VicalEventType) => {
    const res = await fetch(`/api/aiva/vical/event-types/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !row.active }),
    });
    if (!res.ok) {
      push('Could not update', 'error');
      return;
    }
    void load();
  };

  if (loading) return <div className="p-6 text-sm text-text-muted">Loading event types...</div>;

  return (
    <div className="mx-auto max-w-[90rem] space-y-6 p-6">
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-text-primary">New event type</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-text-muted">
            Name
            <input
              className="mt-1 w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="text-xs text-text-muted">
            Duration (minutes)
            <input
              type="number"
              min={15}
              step={15}
              className="mt-1 w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value) || 30)}
            />
          </label>
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={requiresApproval}
            onChange={(e) => setRequiresApproval(e.target.checked)}
          />
          Require host approval before confirm
        </label>
        <Button className="mt-4" size="sm" onClick={() => void create()}>
          Create
        </Button>
      </section>

      <section>
        <h2 className="text-sm font-medium text-text-primary">Your event types</h2>
        <ul className="mt-3 space-y-2">
          {items.map((row) => (
            <li key={row.id} className="rounded-lg border border-border bg-card px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {row.name}{' '}
                    <span className="text-xs font-normal text-text-muted">({row.slug})</span>
                  </p>
                  <p className="text-xs text-text-muted">
                    {row.durationMinutes} min · {row.active ? 'active' : 'inactive'}
                    {row.requiresApproval ? ' · approval required' : ''}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => void toggleActive(row)}>
                  {row.active ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </li>
          ))}
          {items.length === 0 ? (
            <li className="text-xs text-text-muted">No event types yet. Create one above.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
