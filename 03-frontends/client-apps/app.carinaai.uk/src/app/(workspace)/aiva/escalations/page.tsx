'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PlanGateSection } from '@/components/billing/PlanGateSection';
import {
  DEFAULT_PAGE_SIZE,
  ListPager,
  slicePage,
  totalPagesFor,
} from '@/components/ui/ListPager';
import { timeAgo } from '@/lib/aiva-utils';

const PLAN_ORDER: Record<string, number> = { trial: 0, starter: 1, team: 2, business: 3 };

interface EscalationRow {
  id: string;
  workerId: string;
  workerName: string;
  channel: string;
  status: string;
  originalInput: string;
  holdingMessage: string;
  createdAt: string;
}

export default function AivaEscalationsPage() {
  const [planTier, setPlanTier] = useState('trial');
  const [rows, setRows] = useState<EscalationRow[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const totalPages = totalPagesFor(rows.length, DEFAULT_PAGE_SIZE);
  const pageRows = useMemo(
    () => slicePage(rows, page, DEFAULT_PAGE_SIZE),
    [rows, page],
  );

  async function load() {
    setLoading(true);
    setError('');
    try {
      const billingRes = await fetch('/api/aiva/billing/status');
      let tier = 'trial';
      if (billingRes.ok) {
        const billing = (await billingRes.json()) as {
          subscription?: { planTier?: string };
          planTier?: string;
        };
        tier = billing.subscription?.planTier ?? billing.planTier ?? 'trial';
        setPlanTier(tier);
      }

      if ((PLAN_ORDER[tier] ?? 0) < (PLAN_ORDER['team'] ?? 0)) {
        setRows([]);
        return;
      }

      const escRes = await fetch('/api/aiva/escalations');
      if (!escRes.ok) {
        setError('Could not load escalations');
        return;
      }
      const body = (await escRes.json()) as { escalations?: EscalationRow[] };
      setRows(body.escalations ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function dismissEscalation(row: EscalationRow) {
    if (
      !window.confirm(
        'Dismiss this escalation? It leaves the open queue. History is kept as resolved.',
      )
    ) {
      return;
    }
    setBusyId(row.id);
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/aiva/escalations/${encodeURIComponent(row.id)}/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: 'Dismissed as obsolete by workspace owner' }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? 'Could not dismiss escalation');
        return;
      }
      setRows((current) => current.filter((item) => item.id !== row.id));
      setNotice('Escalation dismissed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not dismiss escalation');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-[90rem] space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">VA escalation queue</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Open escalations waiting for human review. VERLOX VAs respond on Team plans and above.
          Obsolete items can be dismissed; they are marked resolved, not hard-deleted.
        </p>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {notice ? <p className="text-sm text-green-500">{notice}</p> : null}

      <PlanGateSection planRequired="team" currentPlan={planTier}>
        {loading ? (
          <p className="text-sm text-text-muted">Loading queue...</p>
        ) : rows.length === 0 ? (
          <p className="rounded-lg border border-border bg-elevated p-6 text-sm text-text-muted">
            No open escalations. When an Aiva hands off to a human, it appears here.
          </p>
        ) : (
          <div className="space-y-3">
            {pageRows.map((row) => (
              <article
                key={row.id}
                className="rounded-lg border border-border bg-elevated p-4"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Link
                      href={`/aiva/workers/${row.workerId}`}
                      className="font-medium text-accent hover:underline"
                    >
                      {row.workerName}
                    </Link>
                    <span className="text-text-muted capitalize">{row.channel}</span>
                  </div>
                  <span className="text-xs text-text-muted">{timeAgo(row.createdAt)}</span>
                </div>
                <p className="text-sm text-text-primary">{row.originalInput}</p>
                {row.holdingMessage ? (
                  <p className="mt-2 text-xs text-text-muted">Holding: {row.holdingMessage}</p>
                ) : null}
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void dismissEscalation(row)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-overlay/40 disabled:opacity-50"
                  >
                    {busyId === row.id ? 'Dismissing...' : 'Dismiss'}
                  </button>
                </div>
              </article>
            ))}
            <ListPager
              page={page}
              totalPages={totalPages}
              totalItems={rows.length}
              onChangePage={setPage}
              disabled={loading}
            />
          </div>
        )}
      </PlanGateSection>
    </div>
  );
}
