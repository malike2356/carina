'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PlanGateSection } from '@/components/billing/PlanGateSection';
import { timeAgo } from '@/lib/aiva-utils';

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
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [billingRes, escRes] = await Promise.all([
        fetch('/api/aiva/billing/status'),
        fetch('/api/aiva/escalations'),
      ]);
      if (billingRes.ok) {
        const billing = (await billingRes.json()) as {
          subscription?: { planTier?: string };
          planTier?: string;
        };
        const tier =
          billing.subscription?.planTier ??
          billing.planTier ??
          'trial';
        setPlanTier(tier);
      }
      if (escRes.status === 403) {
        const body = (await escRes.json()) as { planTier?: string };
        setPlanTier(body.planTier ?? planTier);
        setRows([]);
        return;
      }
      if (!escRes.ok) return;
      const body = (await escRes.json()) as { escalations?: EscalationRow[] };
      setRows(body.escalations ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">VA escalation queue</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Open escalations waiting for human review. VERLOX VAs respond on Team plans and above.
        </p>
      </div>

      <PlanGateSection planRequired="team" currentPlan={planTier}>
        {loading ? (
          <p className="text-sm text-text-muted">Loading queue...</p>
        ) : rows.length === 0 ? (
          <p className="rounded-lg border border-border bg-elevated p-6 text-sm text-text-muted">
            No open escalations. When an Aiva hands off to a human, it appears here.
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
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
              </article>
            ))}
          </div>
        )}
      </PlanGateSection>
    </div>
  );
}
