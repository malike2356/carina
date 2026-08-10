'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then((res) => (res.ok ? res.json() : null));

type CohortSeries = {
  cohortId: string;
  label: string;
  size: number;
  weeks: Array<{ weekN: number; retentionPct: number; activeUsers: number }>;
  cliffs: Array<{ fromWeek: number; toWeek: number; dropPctPoints: number }>;
};

type HeatCell = {
  cohortId: string;
  label: string;
  weekN: number;
  retentionPct: number;
  tone: 'green' | 'yellow' | 'red' | 'empty';
  cliff: boolean;
};

type Dashboard = {
  computedAt: string;
  weeks: number[];
  cohorts: CohortSeries[];
  heatmap: HeatCell[];
  lyingGap: {
    totalUsers: number;
    activeUsers: number;
    gap: number;
    gapPctOfTotal: number;
    asOfDate: string;
    note: string;
  };
  refresh?: { cadence: string; lastComputedAt: string; note: string };
};

function cellClass(tone: HeatCell['tone'], cliff: boolean): string {
  const base =
    tone === 'green'
      ? 'bg-emerald-500/25 text-emerald-800 dark:text-emerald-200'
      : tone === 'yellow'
        ? 'bg-amber-500/25 text-amber-900 dark:text-amber-100'
        : tone === 'red'
          ? 'bg-red-500/25 text-red-800 dark:text-red-200'
          : 'bg-elevated text-text-muted';
  return cn(base, cliff && 'ring-2 ring-red-500/70');
}

export function CohortRetentionPanel() {
  const { data, isLoading, mutate } = useSWR<Dashboard>(
    '/api/aiva/analytics/cohort/dashboard?period=week&throughWeek=12',
    fetcher,
  );
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');
  const compareKey =
    compareA && compareB
      ? `/api/aiva/analytics/cohort/compare?a=${encodeURIComponent(compareA)}&b=${encodeURIComponent(compareB)}`
      : null;
  const { data: compare } = useSWR(compareKey, fetcher);

  const weeks = data?.weeks ?? Array.from({ length: 12 }, (_, i) => i + 1);
  const cohorts = data?.cohorts ?? [];
  const byCohortWeek = useMemo(() => {
    const map = new Map<string, HeatCell>();
    for (const cell of data?.heatmap ?? []) {
      map.set(`${cell.cohortId}|${cell.weekN}`, cell);
    }
    return map;
  }, [data?.heatmap]);

  const starts = cohorts.map((c) => c.cohortId.replace(/^week:/, '').replace(/^month:/, ''));

  return (
    <section className="space-y-4 rounded-lg border border-border bg-elevated p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Cohort retention</h2>
          <p className="mt-1 max-w-2xl text-xs text-text-muted">
            Total users lie when engagement falls. Cohorts show when people stop coming back. Green
            &gt;80%, yellow 50-80%, red &lt;50%. Ringed cells are drop-off cliffs (&gt;20pp week-over-week).
          </p>
        </div>
        <button
          type="button"
          className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-background"
          onClick={() => void mutate()}
        >
          Refresh snapshot
        </button>
      </div>

      {data?.lyingGap ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-border bg-background p-3">
            <p className="text-[10px] uppercase tracking-wide text-text-muted">Total users</p>
            <p className="mt-1 text-2xl font-semibold text-text-primary">{data.lyingGap.totalUsers}</p>
          </div>
          <div className="rounded-md border border-border bg-background p-3">
            <p className="text-[10px] uppercase tracking-wide text-text-muted">Active (7d)</p>
            <p className="mt-1 text-2xl font-semibold text-text-primary">{data.lyingGap.activeUsers}</p>
          </div>
          <div className="rounded-md border border-amber-600/40 bg-amber-500/10 p-3">
            <p className="text-[10px] uppercase tracking-wide text-amber-800 dark:text-amber-200">
              Lying-dashboard gap
            </p>
            <p className="mt-1 text-2xl font-semibold text-amber-900 dark:text-amber-100">
              {data.lyingGap.gap}{' '}
              <span className="text-sm font-normal">({data.lyingGap.gapPctOfTotal}%)</span>
            </p>
            <p className="mt-1 text-[11px] text-text-muted">{data.lyingGap.note}</p>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-xs text-text-muted">Loading cohort matrix…</p>
      ) : cohorts.length === 0 ? (
        <p className="text-xs text-text-muted">
          No signup/activity cohorts yet. Ingest via{' '}
          <code className="text-[11px]">POST /api/aiva/analytics/cohort/activity</code> (or feature
          adoption events when wired).
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 bg-elevated px-2 py-1.5 text-left font-medium text-text-muted">
                  Cohort
                </th>
                {weeks.map((w) => (
                  <th key={w} className="px-1 py-1.5 text-center font-medium text-text-muted">
                    W{w}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohorts.map((cohort) => (
                <tr key={cohort.cohortId}>
                  <td className="sticky left-0 bg-elevated px-2 py-1 font-medium text-text-primary">
                    {cohort.label}
                    <span className="ml-1 text-text-muted">({cohort.size})</span>
                  </td>
                  {weeks.map((w) => {
                    const cell = byCohortWeek.get(`${cohort.cohortId}|${w}`);
                    return (
                      <td key={w} className="px-0.5 py-0.5">
                        <div
                          className={cn(
                            'flex h-8 min-w-[2.5rem] items-center justify-center rounded px-1',
                            cellClass(cell?.tone ?? 'empty', Boolean(cell?.cliff)),
                          )}
                          title={
                            cell?.cliff
                              ? `Cliff: drop >20pp into week ${w}`
                              : `Week ${w}: ${cell?.retentionPct ?? 0}%`
                          }
                        >
                          {cell ? `${cell.retentionPct}%` : ';'}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cohorts.some((c) => c.cliffs.length > 0) ? (
        <ul className="space-y-1 text-xs text-text-secondary">
          {cohorts.flatMap((c) =>
            c.cliffs.map((cliff) => (
              <li key={`${c.cohortId}-${cliff.toWeek}`}>
                Cliff in {c.label}: W{cliff.fromWeek} → W{cliff.toWeek} (−{cliff.dropPctPoints} pp)
              </li>
            )),
          )}
        </ul>
      ) : null}

      <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="block text-xs text-text-muted">
          Compare cohort A
          <select
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            value={compareA}
            onChange={(e) => setCompareA(e.target.value)}
          >
            <option value="">Select…</option>
            {starts.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-text-muted">
          Compare cohort B
          <select
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            value={compareB}
            onChange={(e) => setCompareB(e.target.value)}
          >
            <option value="">Select…</option>
            {starts.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <p className="text-[11px] text-text-muted">
          {data?.refresh?.note ?? 'Retention refreshes daily.'}
          {data?.refresh?.lastComputedAt
            ? ` Last: ${new Date(data.refresh.lastComputedAt).toLocaleString()}`
            : ''}
        </p>
      </div>

      {compare?.cohortA && compare?.cohortB ? (
        <div className="overflow-x-auto rounded-md border border-border bg-background p-3">
          <p className="mb-2 text-xs font-medium text-text-primary">
            {compare.cohortA.label} vs {compare.cohortB.label}
          </p>
          <div className="flex flex-wrap gap-2">
            {(compare.weekDeltas as Array<{ weekN: number; deltaPctPoints: number }>).map((d) => (
              <div
                key={d.weekN}
                className="rounded border border-border px-2 py-1 text-[11px] text-text-secondary"
              >
                W{d.weekN}: {d.deltaPctPoints > 0 ? '+' : ''}
                {d.deltaPctPoints} pp
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[compare.cohortA, compare.cohortB].map((series: CohortSeries) => (
              <div key={series.cohortId}>
                <p className="text-[11px] font-medium text-text-primary">{series.label}</p>
                <div className="mt-1 flex h-16 items-end gap-0.5">
                  {series.weeks.slice(0, 12).map((w) => (
                    <div
                      key={w.weekN}
                      className="flex-1 rounded-t bg-accent/70"
                      style={{ height: `${Math.max(4, w.retentionPct)}%` }}
                      title={`W${w.weekN}: ${w.retentionPct}%`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
