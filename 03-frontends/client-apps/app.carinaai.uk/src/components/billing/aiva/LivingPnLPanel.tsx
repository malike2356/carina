'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : null));

function gbp(minor: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(minor / 100);
}

export function LivingPnLPanel() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const { data: pnlData } = useSWR(
    `/api/aiva/finance/pnl?year=${year}&month=${month}`,
    fetcher,
  );
  const { data: liabilityData } = useSWR(
    `/api/aiva/finance/liabilities?year=${year}&month=${month}`,
    fetcher,
  );

  const pnl = pnlData?.pnl as
    | {
        monthLabel: string;
        revenue: { totalMinor: number };
        cogs: { totalMinor: number };
        grossMarginMinor: number;
        grossMarginPct: number | null;
        checksum: { reconciles: boolean };
        perUser: { liabilities: Array<{ userId: string; action: string; ratio: number }> };
      }
    | undefined;

  if (!pnl) {
    return (
      <section className="rounded-lg border border-border bg-elevated p-4">
        <h3 className="text-sm font-semibold text-text-primary">Living P&L</h3>
        <p className="mt-1 text-xs text-text-muted">
          Per-user revenue vs cost. Generate after Stripe and AI usage data land for the month.
        </p>
      </section>
    );
  }

  const alert = liabilityData?.alert as { message?: string; level?: string } | null;

  return (
    <section className="space-y-3 rounded-lg border border-border bg-elevated p-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">Living P&L · {pnl.monthLabel}</h3>
        <p className="mt-1 text-xs text-text-muted">
          Revenue vs infrastructure/AI cost per user. Heavy users who cost more than they pay are
          liabilities.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-[10px] uppercase text-text-muted">Revenue</p>
          <p className="text-lg font-semibold text-text-primary">{gbp(pnl.revenue.totalMinor)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-text-muted">COGS</p>
          <p className="text-lg font-semibold text-text-primary">{gbp(pnl.cogs.totalMinor)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-text-muted">Gross margin</p>
          <p className="text-lg font-semibold text-text-primary">
            {gbp(pnl.grossMarginMinor)}
            {pnl.grossMarginPct != null ? ` (${pnl.grossMarginPct}%)` : ''}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-text-muted">Reconciles</p>
          <p className="text-lg font-semibold text-text-primary">
            {pnl.checksum.reconciles ? 'Yes' : 'No'}
          </p>
        </div>
      </div>
      {alert?.message ? (
        <p
          className={
            alert.level === 'critical'
              ? 'text-xs text-red-700 dark:text-red-300'
              : 'text-xs text-amber-800 dark:text-amber-200'
          }
        >
          {alert.message}
        </p>
      ) : null}
      {pnl.perUser.liabilities.length > 0 ? (
        <ul className="space-y-1 text-xs text-text-secondary">
          {pnl.perUser.liabilities.slice(0, 5).map((u) => (
            <li key={u.userId}>
              {u.userId}: ratio {u.ratio} → {u.action}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-text-muted">No liability users this month.</p>
      )}
    </section>
  );
}
