'use client';

type UsageBadgeProps = {
  count: number;
  limit: number;
  usagePercent?: number;
};

export function UsageBadge({ count, limit, usagePercent }: UsageBadgeProps) {
  if (!limit || limit <= 0) return null;

  const pct = usagePercent ?? Math.min(100, Math.round((count / limit) * 100));
  const color =
    pct >= 85 ? 'text-danger' : pct >= 60 ? 'text-amber-500' : 'text-text-muted';

  return (
    <span className={`text-xs font-medium ${color}`} title={`${pct}% of monthly messages used`}>
      {count.toLocaleString()}/{limit.toLocaleString()} msgs
    </span>
  );
}
