'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => (res.ok ? res.json() : null));

export function FeatureAdoptionPanel() {
  const { data: adoption } = useSWR('/api/aiva/analytics/events/adoption', fetcher);
  const { data: active } = useSWR('/api/aiva/analytics/events/active-metrics', fetcher);

  const features = (adoption?.features ?? []) as Array<{
    feature: string;
    adoptionPct: number;
    usersWhoUsed: number;
    activeUsers: number;
  }>;
  const unused = (adoption?.unused ?? []) as Array<{ feature: string; adoptionPct: number }>;

  return (
    <section className="space-y-4 rounded-lg border border-border bg-elevated p-4">
      <div>
        <h2 className="text-sm font-semibold text-text-primary">Feature adoption</h2>
        <p className="mt-1 text-xs text-text-muted">
          Which core features users touch. Low adoption is often discovery, not product quality.
        </p>
      </div>

      {active ? (
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ['DAU', active.dau],
              ['WAU', active.wau],
              ['MAU', active.mau],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-md border border-border bg-background p-3">
              <p className="text-[10px] uppercase tracking-wide text-text-muted">{label}</p>
              <p className="mt-1 text-xl font-semibold text-text-primary">{value ?? 0}</p>
            </div>
          ))}
        </div>
      ) : null}

      {features.length === 0 ? (
        <p className="text-xs text-text-muted">
          No events yet. Instrument with <code className="text-[11px]">useTrackEvent()</code> or{' '}
          <code className="text-[11px]">POST /api/aiva/analytics/events</code>.
        </p>
      ) : (
        <ul className="space-y-2">
          {features
            .filter((f) => f.usersWhoUsed > 0 || f.activeUsers > 0)
            .sort((a, b) => b.adoptionPct - a.adoptionPct)
            .map((f) => (
              <li key={f.feature} className="flex items-center gap-3 text-xs">
                <span className="w-32 truncate font-medium text-text-primary">{f.feature}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-background">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${Math.max(2, Math.min(100, f.adoptionPct))}%` }}
                  />
                </div>
                <span className="w-16 text-right text-text-muted">{f.adoptionPct}%</span>
              </li>
            ))}
        </ul>
      )}

      {unused.length > 0 ? (
        <div className="border-t border-border pt-3">
          <p className="text-xs font-medium text-text-primary">Unused / low adoption (&lt;20%)</p>
          <p className="mt-1 text-[11px] text-text-muted">
            {unused.map((u) => `${u.feature} (${u.adoptionPct}%)`).join(', ')}
          </p>
        </div>
      ) : null}
    </section>
  );
}
