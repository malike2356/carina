'use client';

import Link from 'next/link';
import { buildAgentOsMilestones, type AgentOsProgressInput } from '@/lib/agent-os-progress';

export function AgentOsProgress({ input }: { input: AgentOsProgressInput }) {
  const milestones = buildAgentOsMilestones(input);
  const done = milestones.filter((m) => m.complete).length;
  const pct = Math.round((done / milestones.length) * 100);

  return (
    <section className="rounded-xl border border-border bg-elevated/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-text-primary">Day 1 / 7 / 30</h2>
        <span className="text-xs text-text-muted">{pct}%</span>
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <ul className="space-y-2">
        {milestones.map((item) => (
          <li key={item.id} className="flex gap-2 text-sm">
            <span className={item.complete ? 'text-emerald-400' : 'text-text-muted'}>
              {item.complete ? '[done]' : '[ ]'}
            </span>
            <span>
              <span className="font-medium text-text-primary">{item.title}</span>
              <span className="block text-xs text-text-muted">{item.copy}</span>
            </span>
          </li>
        ))}
      </ul>
      <Link
        href="/agent-os/workflows/onboarding-path"
        className="mt-3 inline-flex min-h-11 items-center text-xs font-medium text-accent hover:underline"
      >
        Build onboarding path
      </Link>
    </section>
  );
}

export function AgentOsGuardrailStrip({
  approvalsCount,
  billingHref,
  billingLabel,
  scoutLabel,
}: {
  approvalsCount: number | null;
  billingHref: string;
  billingLabel: string;
  scoutLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/aiva/approvals"
        className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-xs text-text-secondary hover:bg-elevated"
      >
        Approvals {approvalsCount == null ? '' : `(${approvalsCount})`}
      </Link>
      <Link
        href={billingHref}
        className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-xs text-text-secondary hover:bg-elevated"
      >
        {billingLabel}
      </Link>
      <Link
        href="/aiva/governance"
        className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-xs text-text-secondary hover:bg-elevated"
      >
        {scoutLabel}
      </Link>
    </div>
  );
}
