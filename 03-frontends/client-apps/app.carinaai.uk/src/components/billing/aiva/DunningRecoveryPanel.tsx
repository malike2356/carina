'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : null));

export function DunningRecoveryPanel() {
  const { data } = useSWR('/api/aiva/billing/dunning/stats', fetcher);

  if (!data?.stats) return null;
  const stats = data.stats as {
    failedPayments: number;
    recoveredPayments: number;
    recoveryRatePct: number;
    atRiskMrrMinor: number;
    activeDunning: number;
    recoveryByEmailStage: Array<{ stage: number; recoveredAfterStage: number }>;
    meetsRecoveryTarget: boolean;
  };

  if (stats.failedPayments === 0 && stats.activeDunning === 0) return null;

  const atRiskGbp = ((stats.atRiskMrrMinor || 0) / 100).toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
  });

  return (
    <section className="rounded-lg border border-border bg-elevated p-4">
      <h3 className="text-sm font-semibold text-text-primary">Payment recovery (dunning)</h3>
      <p className="mt-1 text-xs text-text-muted">
        Failed charges enter a 14-day grace period with retries and a 3-email update sequence. Target
        recovery ≥30%.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-[10px] uppercase text-text-muted">Recovery rate</p>
          <p className="text-lg font-semibold text-text-primary">{stats.recoveryRatePct}%</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-text-muted">Recovered</p>
          <p className="text-lg font-semibold text-text-primary">{stats.recoveredPayments}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-text-muted">At-risk MRR</p>
          <p className="text-lg font-semibold text-text-primary">{atRiskGbp}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-text-muted">Active dunning</p>
          <p className="text-lg font-semibold text-text-primary">{stats.activeDunning}</p>
        </div>
      </div>
      <ul className="mt-3 space-y-1 text-xs text-text-secondary">
        {stats.recoveryByEmailStage.map((row) => (
          <li key={row.stage}>
            Email stage {row.stage}: {row.recoveredAfterStage} recovered after send
          </li>
        ))}
      </ul>
      {!stats.meetsRecoveryTarget ? (
        <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
          Recovery rate is below the 30% target; review portal click-through and retry timing.
        </p>
      ) : null}
    </section>
  );
}
