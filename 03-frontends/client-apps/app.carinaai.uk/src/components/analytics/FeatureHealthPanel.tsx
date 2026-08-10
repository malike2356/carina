'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => (res.ok ? res.json() : null));

const lightClass: Record<string, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-400',
  red: 'bg-red-500',
};

export function FeatureHealthPanel() {
  const { data } = useSWR('/api/aiva/analytics/feature-health', fetcher);

  const features = (data?.features ?? []) as Array<{
    name: string;
    status: string;
    trafficLight: string;
    activeUsers7d: number;
    adoptionRate: number;
    errorRate7d: number;
  }>;
  const gate = data?.gate as
    | {
        canBuildNewFeature?: boolean;
        reason?: string;
        blockingIssues?: Array<{ feature: string; priority: string; recommendation: string }>;
        deprecate?: Array<{ feature: string; recommendation: string }>;
      }
    | undefined;

  return (
    <section className="space-y-4 rounded-lg border border-border bg-elevated p-4">
      <div>
        <h2 className="text-sm font-semibold text-text-primary">Feature health</h2>
        <p className="mt-1 text-xs text-text-muted">
          Traffic-light audit before new feature work. Broken + used is fixed first; broken + unused is
          deprecation.
        </p>
      </div>

      {gate ? (
        <div
          className={`rounded-md border px-3 py-2 text-xs ${
            gate.canBuildNewFeature
              ? 'border-border bg-background text-text-muted'
              : 'border-red-500/40 bg-red-500/5 text-text-primary'
          }`}
        >
          <p className="font-medium">
            Build gate: {gate.canBuildNewFeature ? 'open' : 'blocked'}
          </p>
          <p className="mt-1 text-text-muted">{gate.reason}</p>
          {(gate.blockingIssues?.length ?? 0) > 0 ? (
            <ul className="mt-2 space-y-1">
              {gate.blockingIssues!.slice(0, 5).map((item) => (
                <li key={`${item.priority}-${item.feature}`}>
                  <span className="font-semibold">{item.priority}</span> {item.feature}:{' '}
                  {item.recommendation}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {features.length === 0 ? (
        <p className="text-xs text-text-muted">No feature health report yet.</p>
      ) : (
        <ul className="space-y-2">
          {features.map((f) => (
            <li key={f.name} className="flex items-center gap-3 text-xs">
              <span
                className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${lightClass[f.trafficLight] ?? 'bg-text-muted'}`}
                title={f.status}
              />
              <span className="w-36 truncate font-medium text-text-primary">{f.name}</span>
              <span className="text-text-muted">{f.status}</span>
              <span className="ml-auto text-text-muted">
                {f.activeUsers7d} users · {f.adoptionRate}% adopt · err{' '}
                {Math.round(f.errorRate7d * 1000) / 10}%
              </span>
            </li>
          ))}
        </ul>
      )}

      {(gate?.deprecate?.length ?? 0) > 0 ? (
        <div className="text-xs text-text-muted">
          <p className="font-medium text-text-primary">Deprecation candidates</p>
          <ul className="mt-1 list-disc pl-4">
            {gate!.deprecate!.map((d) => (
              <li key={d.feature}>
                {d.feature}: {d.recommendation}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
