'use client';

import type { AivaWorkerStatus } from '@/lib/aiva-types';

const STATUS_CONFIG: Record<
  AivaWorkerStatus,
  { dot: string; label: string }
> = {
  active: { dot: 'bg-green-400', label: 'Active' },
  paused: { dot: 'bg-gray-400', label: 'Paused' },
  configuring: { dot: 'bg-blue-400 animate-pulse', label: 'Configuring' },
  error: { dot: 'bg-red-400', label: 'Error' },
  dismissed: { dot: 'bg-gray-400', label: 'Dismissed' },
};

export function StatusChip({
  status,
  trialDaysLeft,
}: {
  status: string;
  trialDaysLeft?: number;
}) {
  const key = (status in STATUS_CONFIG ? status : 'paused') as AivaWorkerStatus;
  const config = STATUS_CONFIG[key];
  const label =
    status === 'active' && trialDaysLeft != null && trialDaysLeft > 0
      ? `Trial · ${trialDaysLeft}d left`
      : config.label;

  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${config.dot}`} />
      <span className="whitespace-nowrap text-xs text-text-muted">{label}</span>
    </span>
  );
}
