'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Shield, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

type GovernanceSummary = {
  scoutStatus: 'pending' | 'connected' | 'disconnected';
  scoutDashboardUrl: string | null;
  employeesMonitored: number;
  eventsLast24h: number;
  killSwitchActive: boolean;
  employeesSuspendedByScout: number;
};

function statusLabel(status: GovernanceSummary['scoutStatus']): string {
  if (status === 'connected') return 'Protected';
  if (status === 'disconnected') return 'Disconnected';
  return 'Pending';
}

function statusClass(status: GovernanceSummary['scoutStatus']): string {
  if (status === 'connected') return 'text-emerald-600';
  if (status === 'disconnected') return 'text-red-600';
  return 'text-amber-600';
}

export function GovernanceSidebarCard() {
  const { push } = useToast();
  const [summary, setSummary] = useState<GovernanceSummary | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/aiva/scout/governance');
      if (!res.ok) return;
      setSummary((await res.json()) as GovernanceSummary);
    } catch {
      push('Could not load Scout governance status', 'error');
    }
  }, [push]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 60_000);
    return () => clearInterval(timer);
  }, [load]);

  if (!summary) return null;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
        <Shield className="h-4 w-4 text-accent" />
        Governance
      </div>
      <p className={`mt-2 text-sm font-semibold ${statusClass(summary.scoutStatus)}`}>
        Scout: {statusLabel(summary.scoutStatus)}
      </p>
      <ul className="mt-2 space-y-1 text-xs text-text-secondary">
        <li>{summary.employeesMonitored} AI Employees monitored</li>
        <li>{summary.eventsLast24h} Scout events (24h)</li>
        {summary.killSwitchActive ? (
          <li className="text-red-600">
            {summary.employeesSuspendedByScout} suspended by governance
          </li>
        ) : null}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        {summary.scoutDashboardUrl ? (
          <a
            href={summary.scoutDashboardUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            Open Scout dashboard
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
        <Link href="/aiva/governance" className="text-xs text-accent hover:underline">
          Governance details
        </Link>
        <Link href="/aiva/approvals" className="text-xs text-accent hover:underline">
          Approval inbox
        </Link>
      </div>
    </div>
  );
}
