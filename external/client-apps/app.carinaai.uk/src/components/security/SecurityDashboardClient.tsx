'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SecurityDashboardData } from '@/lib/security-dashboard-core';

function threatTone(level: SecurityDashboardData['threatLevel']): string {
  switch (level) {
    case 'critical':
      return 'text-red-400';
    case 'high':
      return 'text-orange-400';
    case 'medium':
      return 'text-yellow-400';
    default:
      return 'text-green-400';
  }
}

function actionTone(action: SecurityDashboardData['realTimeEvents'][number]['action']): string {
  switch (action) {
    case 'blocked':
      return 'text-red-400';
    case 'alert':
      return 'text-orange-400';
    case 'monitor':
      return 'text-yellow-400';
    default:
      return 'text-text-muted';
  }
}

function progressBar(score: number): string {
  const filled = Math.round((score / 100) * 12);
  return `${'█'.repeat(filled)}${'░'.repeat(Math.max(0, 12 - filled))}`;
}

function relativeTime(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  if (delta < 60_000) return 'just now';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

function MetricCard({
  title,
  value,
  detail,
  tone,
}: {
  title: string;
  value: string;
  detail?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{title}</p>
      <p className={`mt-2 text-2xl font-semibold ${tone ?? 'text-text-primary'}`}>{value}</p>
      {detail ? <p className="mt-1 text-xs text-text-secondary">{detail}</p> : null}
    </div>
  );
}

export function SecurityDashboardClient({ showStubWarning }: { showStubWarning?: boolean }) {
  const [data, setData] = useState<SecurityDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadInitial() {
      try {
        const res = await fetch('/api/security/dashboard');
        const payload = (await res.json()) as { data?: SecurityDashboardData; error?: string };
        if (!res.ok) throw new Error(payload.error ?? 'Failed to load dashboard');
        if (active && payload.data) {
          setData(payload.data);
          setUpdatedAt(new Date().toISOString());
          setError(null);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : String(err));
      }
    }

    void loadInitial();

    const source = new EventSource('/api/security/dashboard/stream');
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as SecurityDashboardData | { error?: string };
        if ('error' in payload && payload.error) {
          setError(payload.error);
          return;
        }
        setData(payload as SecurityDashboardData);
        setUpdatedAt(new Date().toISOString());
        setError(null);
      } catch {
        // ignore malformed events
      }
    };
    source.onerror = () => {
      setError((current) => current ?? 'Live stream disconnected');
    };

    return () => {
      active = false;
      source.close();
    };
  }, []);

  const trustDots = useMemo(() => {
    const score = data?.trustScore ?? 0;
    const filled = Math.round(score / 20);
    return Array.from({ length: 5 }).map((_, index) => index < filled);
  }, [data?.trustScore]);

  if (error && !data) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-sm text-red-400">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-sm text-text-secondary">
        Loading security dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Security Operations</h2>
          <p className="text-xs text-text-muted">
            Last updated: {updatedAt ? relativeTime(updatedAt) : relativeTime(data.generatedAt)}
          </p>
        </div>
        {showStubWarning ? (
          <p className="rounded-md border border-border px-3 py-1 text-xs text-text-secondary">
            Dev stub data. Connect core proxy for live telemetry.
          </p>
        ) : null}
        {data.killSwitchActive ? (
          <p className="rounded-md bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400">
            Kill switch active
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <MetricCard
          title="Threat level"
          value={data.threatLevel.toUpperCase()}
          tone={threatTone(data.threatLevel)}
        />
        <MetricCard title="Active threats" value={String(data.activeThreats)} />
        <MetricCard
          title="Trust score"
          value={`${data.trustScore}/100`}
          detail={trustDots.map((filled, index) => (filled ? '●' : '○')).join(' ')}
        />
        <MetricCard
          title="Incidents this week"
          value={String(data.incidentsThisWeek)}
          detail={`${data.incidentsTrend >= 0 ? '+' : ''}${data.incidentsTrend}% vs last week`}
        />
        <MetricCard title="RASP status" value={data.raspStatus.toUpperCase()} />
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-3 text-sm font-semibold">Real-time threat map</h3>
        {data.realTimeEvents.length === 0 ? (
          <p className="text-sm text-text-secondary">No recent security events.</p>
        ) : (
          <ul className="space-y-2">
            {data.realTimeEvents.slice(0, 8).map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <span className="font-medium">{event.label}</span>
                <span className="text-text-muted">→</span>
                <span className={`font-medium uppercase ${actionTone(event.action)}`}>{event.action}</span>
                <span className="text-text-muted">{event.agentId}</span>
                <span className="ml-auto text-xs text-text-muted">{relativeTime(event.timestamp)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="mb-3 text-sm font-semibold">Trust over time</h3>
          <div className="flex h-24 items-end gap-1">
            {data.trustHistory.slice(-14).map((point) => (
              <div key={point.date} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-sm bg-accent/70"
                  style={{ height: `${Math.max(8, point.score)}%` }}
                  title={`${point.date}: ${point.score}`}
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-text-secondary">
            Current: {data.trustScore}/100 ({data.trustScoreTrend >= 0 ? '+' : ''}
            {data.trustScoreTrend})
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="mb-3 text-sm font-semibold">Compliance status</h3>
          <ul className="space-y-2 text-sm">
            {data.complianceStatus.frameworks.map((framework) => (
              <li key={framework.id} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-text-secondary">{framework.name}</span>
                <span className="font-mono text-xs text-text-muted">{progressBar(framework.scorePercent)}</span>
                <span className="ml-auto font-medium">{framework.scorePercent}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="mb-3 text-sm font-semibold">Recent incidents</h3>
          {data.recentIncidents.length === 0 ? (
            <p className="text-sm text-text-secondary">No forensic incidents recorded.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.recentIncidents.map((incident) => (
                <li key={incident.id} className="rounded-md border border-border px-3 py-2">
                  <span className="font-medium">{incident.title}</span>
                  <span className="ml-2 text-text-muted">
                    {incident.status} · {relativeTime(new Date(incident.detectedAt).toISOString())}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="mb-3 text-sm font-semibold">Red team results</h3>
          <p className="text-sm text-text-secondary">
            Last run: {data.redTeamResults.lastRunAt ? relativeTime(data.redTeamResults.lastRunAt) : 'never'}
          </p>
          <p className="mt-2 text-sm">
            Passed: {data.redTeamResults.passedCount}/{data.redTeamResults.totalCount} (
            {data.redTeamResults.passRatePercent}%)
          </p>
          <p className="text-sm text-text-secondary">
            Critical gaps: {data.redTeamResults.criticalGaps}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="mb-3 text-sm font-semibold">Supply chain</h3>
          <ul className="space-y-1 text-sm text-text-secondary">
            <li>Dependencies tracked: {data.supplyChainHealth.dependencyCount}</li>
            <li>Vulnerabilities: {data.supplyChainHealth.vulnerabilityCount}</li>
            <li>
              SBOM:{' '}
              {data.supplyChainHealth.sbomGeneratedAt
                ? relativeTime(data.supplyChainHealth.sbomGeneratedAt)
                : 'not generated'}
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="mb-3 text-sm font-semibold">Secrets status</h3>
          <ul className="space-y-1 text-sm text-text-secondary">
            <li>Active: {data.secretsStatus.activeCount}</li>
            <li>Expiring soon: {data.secretsStatus.expiringSoonCount}</li>
            <li>Stale: {data.secretsStatus.staleCount}</li>
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-3 text-sm font-semibold">Quick actions</h3>
        <p className="text-sm text-text-secondary">
          Run from core CLI: `carina security pentest`, `carina compliance collect`, `carina security sbom`,
          `carina security secrets rotate`, `carina security red-team run --all`.
        </p>
      </div>
    </div>
  );
}
