'use client';

import { capitalize } from '@/lib/format';

export interface WorkspaceBadgeInput {
  planTier: string;
  subscriptionStatus: string;
  trialDaysRemaining?: number | null;
}

export function PlanStatusBadge({
  ws,
}: {
  ws: WorkspaceBadgeInput & { cancelAtPeriodEnd?: boolean };
}) {
  const configs: Record<string, { label: string; className: string }> = {
    trialing: {
      label: `Trial · ${ws.trialDaysRemaining ?? 0}d`,
      className: 'bg-amber-500/15 text-amber-400',
    },
    active: {
      label: ws.cancelAtPeriodEnd
        ? `${capitalize(ws.planTier)} - Cancelling`
        : `${capitalize(ws.planTier)} - Active`,
      className: ws.cancelAtPeriodEnd
        ? 'bg-amber-500/15 text-amber-400'
        : 'bg-green-500/10 text-green-400',
    },
    past_due: {
      label: `${capitalize(ws.planTier)} - Past due`,
      className: 'bg-red-500/10 text-red-400',
    },
    suspended: {
      label: 'Suspended',
      className: 'bg-gray-500/10 text-text-muted',
    },
    cancelled: {
      label: 'Cancelled',
      className: 'bg-gray-500/10 text-text-muted',
    },
  };
  const config = configs[ws.subscriptionStatus] ?? configs.suspended;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

export function SignalCell({
  criticalSignalCount,
  warnSignalCount,
}: {
  criticalSignalCount: number;
  warnSignalCount: number;
}) {
  if (criticalSignalCount > 0) {
    return <span className="font-medium text-red-400">!{criticalSignalCount}</span>;
  }
  if (warnSignalCount > 0) {
    return <span className="text-amber-400">{warnSignalCount}</span>;
  }
  return <span className="text-text-muted">0</span>;
}

export function rowClass(ws: {
  subscriptionStatus: string;
  trialDaysRemaining?: number | null;
}): string {
  if (ws.subscriptionStatus === 'suspended') {
    return 'border-l-2 border-red-500/30 bg-red-500/5 opacity-80';
  }
  if (
    ws.subscriptionStatus === 'past_due' ||
    (ws.subscriptionStatus === 'trialing' && (ws.trialDaysRemaining ?? 99) <= 3)
  ) {
    return 'border-l-2 border-amber-400 bg-amber-500/5';
  }
  return 'border-l-2 border-transparent';
}
