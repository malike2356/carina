'use client';

import { Progress } from '@/components/ui/progress';

export function UsageMeter({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null;
}) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-text-primary">{label}</span>
        <span className="text-text-muted">
          {used.toLocaleString()}
          {limit ? ` / ${limit.toLocaleString()}` : ' / unlimited'}
        </span>
      </div>
      {limit ? <Progress value={pct} /> : null}
    </div>
  );
}
