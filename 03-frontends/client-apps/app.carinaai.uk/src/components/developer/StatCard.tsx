export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-text-primary">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-text-muted">{sub}</p>}
    </div>
  );
}
