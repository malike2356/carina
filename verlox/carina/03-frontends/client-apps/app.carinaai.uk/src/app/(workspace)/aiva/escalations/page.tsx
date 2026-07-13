'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { PlanGateSection } from '@/components/billing/PlanGateSection';
import {
  MobileEmptyState,
  MobileList,
  MobileListRow,
  MobileScreen,
  MobileSkeleton,
} from '@/components/aiva/mobile';
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

        if ((PLAN_ORDER[tier] ?? 0) < (PLAN_ORDER.team ?? 0)) {
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
    <MobileScreen
      title="Escalations"
      subtitle="Open handoffs waiting for human review. Escalation response is plan-based and capacity-managed."
      backHref="/aiva/approvals"
      backLabel="Inbox"
      hideTitleOnMobile
    >
      <PlanGateSection planRequired="team" currentPlan={planTier}>
        {loading ? (
          <MobileSkeleton variant="list" rows={4} />
        ) : rows.length === 0 ? (
          <MobileEmptyState
            icon={<AlertTriangle className="h-10 w-10" />}
            title="No open escalations"
            description="When an Aiva flags work for human review, it appears here with the reason and status."
            action={
              <Link
                href="/aiva/approvals"
                className="btn-primary flex min-h-11 w-full items-center justify-center rounded-lg text-sm font-medium"
              >
                Back to inbox
              </Link>
            }
          />
        ) : (
          <MobileList>
            {rows.map((row) => (
              <MobileListRow
                key={row.id}
                href={`/aiva/workers/${row.workerId}`}
                title={row.workerName}
                subtitle={
                  <span className="flex flex-col gap-1">
                    <span className="capitalize">{row.channel} · {timeAgo(row.createdAt)}</span>
                    <span className="line-clamp-3 text-text-secondary">{row.originalInput}</span>
                    {row.holdingMessage ? (
                      <span>Holding: {row.holdingMessage}</span>
                    ) : null}
                  </span>
                }
              />
            ))}
          </MobileList>
        )}
      </PlanGateSection>
    </MobileScreen>
  );
}
