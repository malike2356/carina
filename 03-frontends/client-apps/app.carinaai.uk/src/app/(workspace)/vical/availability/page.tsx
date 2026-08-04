'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { DAY_LABELS, type VicalAvailabilityRule, type VicalBlackout } from '@/lib/vical-types';

const EMPTY_GRID = DAY_LABELS.map((_, dayOfWeek) => ({
  dayOfWeek,
  enabled: dayOfWeek >= 1 && dayOfWeek <= 4,
  startTime: '18:00',
  endTime: '20:30',
}));

export default function VicalAvailabilityPage() {
  const { push } = useToast();
  const [rules, setRules] = useState<VicalAvailabilityRule[]>([]);
  const [blackouts, setBlackouts] = useState<VicalBlackout[]>([]);
  const [grid, setGrid] = useState(EMPTY_GRID);
  const [timezone, setTimezone] = useState('Europe/London');
  const [blackoutStart, setBlackoutStart] = useState('');
  const [blackoutEnd, setBlackoutEnd] = useState('');
  const [blackoutReason, setBlackoutReason] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await fetch('/api/aiva/vical/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const [rulesRes, blackoutRes] = await Promise.all([
        fetch('/api/aiva/vical/availability-rules'),
        fetch('/api/aiva/vical/blackouts'),
      ]);
      const rulesJson = await rulesRes.json().catch(() => ({}));
      const blackoutJson = await blackoutRes.json().catch(() => ({}));
      if (rulesRes.ok) {
        const items = (rulesJson.items ?? []) as VicalAvailabilityRule[];
        setRules(items);
        if (items[0]?.timezone) setTimezone(items[0].timezone);
        if (items.length > 0) {
          setGrid(
            DAY_LABELS.map((_, dayOfWeek) => {
              const match = items.find((r) => r.dayOfWeek === dayOfWeek);
              return {
                dayOfWeek,
                enabled: Boolean(match),
                startTime: match?.startTime ?? '09:00',
                endTime: match?.endTime ?? '17:00',
              };
            }),
          );
        }
      }
      if (blackoutRes.ok) setBlackouts((blackoutJson.items ?? []) as VicalBlackout[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    const replace = grid
      .filter((row) => row.enabled)
      .map((row) => ({
        dayOfWeek: row.dayOfWeek,
        startTime: row.startTime,
        endTime: row.endTime,
        timezone,
      }));
    const res = await fetch('/api/aiva/vical/availability-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ replace, timezone }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      push(err.error || 'Could not save availability', 'error');
      return;
    }
    push('Availability saved', 'success');
    void load();
  };

  const addBlackout = async () => {
    if (!blackoutStart) {
      push('Start date required', 'error');
      return;
    }
    const res = await fetch('/api/aiva/vical/blackouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startsOn: blackoutStart,
        endsOn: blackoutEnd || blackoutStart,
        reason: blackoutReason || undefined,
      }),
    });
    if (!res.ok) {
      push('Could not add blackout', 'error');
      return;
    }
    setBlackoutStart('');
    setBlackoutEnd('');
    setBlackoutReason('');
    push('Blackout added', 'success');
    void load();
  };

  const removeBlackout = async (id: string) => {
    const res = await fetch(`/api/aiva/vical/blackouts/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      push('Could not remove blackout', 'error');
      return;
    }
    void load();
  };

  if (loading) return <div className="p-6 text-sm text-text-muted">Loading availability...</div>;

  return (
    <div className="mx-auto max-w-[90rem] space-y-6 p-6">
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-text-primary">Weekly windows</h2>
            <p className="mt-1 text-xs text-text-muted">Timezone used for slot labels.</p>
          </div>
          <label className="text-xs text-text-muted">
            Timezone
            <input
              className="mt-1 block rounded-md border border-border bg-elevated px-3 py-2 text-sm"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            />
          </label>
        </div>
        <div className="mt-4 space-y-2">
          {grid.map((row, index) => (
            <div key={row.dayOfWeek} className="grid grid-cols-[4rem_auto_1fr_1fr] items-center gap-2 text-xs">
              <label className="flex items-center gap-2 text-text-secondary">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  onChange={(e) => {
                    const next = [...grid];
                    next[index] = { ...row, enabled: e.target.checked };
                    setGrid(next);
                  }}
                />
                {DAY_LABELS[row.dayOfWeek]}
              </label>
              <span className="text-text-muted">{row.enabled ? 'open' : 'off'}</span>
              <input
                type="time"
                disabled={!row.enabled}
                className="rounded-md border border-border bg-elevated px-2 py-1"
                value={row.startTime}
                onChange={(e) => {
                  const next = [...grid];
                  next[index] = { ...row, startTime: e.target.value };
                  setGrid(next);
                }}
              />
              <input
                type="time"
                disabled={!row.enabled}
                className="rounded-md border border-border bg-elevated px-2 py-1"
                value={row.endTime}
                onChange={(e) => {
                  const next = [...grid];
                  next[index] = { ...row, endTime: e.target.value };
                  setGrid(next);
                }}
              />
            </div>
          ))}
        </div>
        <Button className="mt-4" size="sm" onClick={() => void save()}>
          Save availability
        </Button>
        {rules.length === 0 ? (
          <p className="mt-3 text-xs text-text-muted">
            No windows yet. Enable days and save, or open Hub once to seed Mon-Thu evenings.
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-text-primary">Blackout dates</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <label className="text-xs text-text-muted">
            Starts on
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm"
              value={blackoutStart}
              onChange={(e) => setBlackoutStart(e.target.value)}
            />
          </label>
          <label className="text-xs text-text-muted">
            Ends on
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm"
              value={blackoutEnd}
              onChange={(e) => setBlackoutEnd(e.target.value)}
            />
          </label>
          <label className="text-xs text-text-muted sm:col-span-2">
            Reason
            <input
              className="mt-1 w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm"
              value={blackoutReason}
              onChange={(e) => setBlackoutReason(e.target.value)}
            />
          </label>
        </div>
        <Button className="mt-3" size="sm" variant="outline" onClick={() => void addBlackout()}>
          Add blackout
        </Button>
        <ul className="mt-4 space-y-2">
          {blackouts.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-elevated px-3 py-2 text-xs"
            >
              <span>
                {row.startsOn}
                {row.endsOn !== row.startsOn ? ` to ${row.endsOn}` : ''}
                {row.reason ? ` · ${row.reason}` : ''}
              </span>
              <Button size="sm" variant="ghost" onClick={() => void removeBlackout(row.id)}>
                Remove
              </Button>
            </li>
          ))}
          {blackouts.length === 0 ? <li className="text-xs text-text-muted">No blackouts.</li> : null}
        </ul>
      </section>
    </div>
  );
}
