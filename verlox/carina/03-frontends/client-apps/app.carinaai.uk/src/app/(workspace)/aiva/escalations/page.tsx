'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PlanGateSection } from '@/components/billing/PlanGateSection';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const billingRes = await fetch('/api/aiva/billing/status');
        if (cancelled) return;

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
        if (cancelled) return;

        if (!escRes.ok) return;
        const body = (await escRes.json()) as { escalations?: EscalationRow[] };
        setRows(body.escalations ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

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
