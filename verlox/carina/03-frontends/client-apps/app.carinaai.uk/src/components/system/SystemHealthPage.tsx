'use client';

import { useCallback, useEffect, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';

type SubsystemHealth = {
  id: string;
  label: string;
  healthPercent: number;
};

type HealthPayload = {
  overallPercent: number;
  subsystems: SubsystemHealth[];
  activeSessions: number;
  memoryCount: number;
  skillsLoaded: number;
  scoutLastScanAgo: string;
};

export function SystemHealthPage() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/launcher/system/health', { cache: 'no-store' });
      const data = await res.json() as HealthPayload & { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Unable to load system health');
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">System health</h1>
          <p className="text-sm text-text-muted mt-1">
            Workspace subsystem status from the launcher health API.
          </p>
        </div>
        <button
          type="button"
          className="text-sm px-3 py-1.5 rounded-md border border-border bg-surface hover:bg-surface-hover"
          onClick={() => void load()}
        >
          Refresh
        </button>
      </div>

      {loading && (
        <EmptyState title="Loading health" subtitle="Reading subsystem metrics." />
      )}

      {!loading && error && (
        <EmptyState title="Health unavailable" subtitle={error} />
      )}

      {!loading && health && (
        <>
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Overall</p>
            <p className="text-3xl font-semibold text-text-primary mt-1">{health.overallPercent}%</p>
            <p className="text-sm text-text-muted mt-2">
              {health.activeSessions} active session(s); {health.memoryCount} memories; {health.skillsLoaded} skills loaded.
            </p>
          </div>

          <div className="grid gap-3">
            {health.subsystems.map((item) => (
              <div key={item.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-text-primary">{item.label}</span>
                  <span className="text-sm text-text-muted">{item.healthPercent}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-surface-hover overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, item.healthPercent))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-text-muted">Scout last scan: {health.scoutLastScanAgo}</p>
        </>
      )}
    </div>
  );
}
