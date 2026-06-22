'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Download, RefreshCw, BarChart3, TrendingUp, CircleDollarSign, MessageSquare, Layers3, Gauge } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AnalyticsOverview } from '@/lib/analytics-types';
import { formatGbp } from '@/lib/analytics-types';

const RANGE_OPTIONS = [7, 30, 90] as const;

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-GB').format(value);
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const delta = Date.now() - new Date(iso).getTime();
  if (delta < 60_000) return 'just now';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

function statusTone(status: string): string {
  if (status === 'active') return 'text-accent';
  if (status === 'idle') return 'text-amber-400';
  return 'text-text-muted';
}

function MetricCard({
  title,
  value,
  detail,
  icon,
}: {
  title: string;
  value: string;
  detail?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">{value}</p>
        </div>
        {icon ? <div className="text-text-muted">{icon}</div> : null}
      </div>
      {detail ? <p className="mt-2 text-xs text-text-secondary">{detail}</p> : null}
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs text-text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function UsageBars({ rows }: { rows: AnalyticsOverview['workspace']['usageSeries'] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No usage history yet"
        subtitle="Usage appears here after Carina records chat traffic."
      />
    );
  }

  const maxTokens = Math.max(...rows.map((row) => row.tokens), 1);
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.date} className="grid grid-cols-[88px_1fr_96px] items-center gap-3 text-xs">
          <span className="text-text-muted">{row.date}</span>
          <div className="h-2 overflow-hidden rounded-full bg-elevated">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.max(4, Math.round((row.tokens / maxTokens) * 100))}%` }}
            />
          </div>
          <div className="text-right text-text-secondary">
            {formatNumber(row.tokens)} tokens
          </div>
        </div>
      ))}
    </div>
  );
}

function BreakdownBars({
  rows,
  emptyTitle,
  emptySubtitle,
}: {
  rows: AnalyticsOverview['workspace']['modelBreakdown'] | AnalyticsOverview['workspace']['providerBreakdown'];
  emptyTitle: string;
  emptySubtitle: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} subtitle={emptySubtitle} />;
  }

  const maxTokens = Math.max(...rows.map((row) => row.tokens), 1);
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={`${row.provider}-${row.key}`} className="space-y-1">
          <div className="flex items-center gap-3 text-xs">
            <span className="min-w-0 flex-1 truncate text-text-primary">{row.key}</span>
            <span className="text-text-muted">{row.share}%</span>
            <span className="text-text-secondary">{formatGbp(row.estimatedCostGbp)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-elevated">
            <div
              className="h-full rounded-full bg-accent-dim"
              style={{ width: `${Math.max(4, Math.round((row.tokens / maxTokens) * 100))}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-text-muted">
            <span>{row.provider}</span>
            <span>{formatNumber(row.events)} events</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function SignalBars({ buckets }: { buckets: Record<string, number> }) {
  const rows = Object.entries(buckets).filter(([, value]) => value > 0);
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No telemetry signals"
        subtitle="Core telemetry has not recorded any turn buckets in the current window."
      />
    );
  }

  const max = Math.max(...rows.map(([, value]) => value), 1);
  return (
    <div className="space-y-3">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[120px_1fr_56px] items-center gap-3 text-xs">
          <span className="truncate text-text-primary">{label}</span>
          <div className="h-2 overflow-hidden rounded-full bg-elevated">
            <div
              className={cn(
                'h-full rounded-full',
                label === 'ok' ? 'bg-accent' : label === 'slow' ? 'bg-amber-400' : 'bg-danger',
              )}
              style={{ width: `${Math.max(4, Math.round((value / max) * 100))}%` }}
            />
          </div>
          <span className="text-right text-text-secondary">{formatNumber(value)}</span>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsDashboard({ embedded = false }: { embedded?: boolean }) {
  const [days, setDays] = useState<(typeof RANGE_OPTIONS)[number]>(30);
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  async function load(nextDays = days) {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/overview?days=${nextDays}`, { cache: 'no-store' });
      const payload = await res.json() as { data?: AnalyticsOverview; error?: string };
      if (!res.ok) throw new Error(payload.error ?? 'Unable to load analytics');
      setData(payload.data ?? null);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const core = data?.core ?? null;

  const summaryCards = useMemo(() => {
    if (!data) return [];
    return [
      {
        title: 'Sessions',
        value: formatNumber(data.workspace.totalSessions),
        detail: `${data.workspace.activeSessions} active, ${data.workspace.idleSessions} idle, ${data.workspace.staleSessions} stale`,
        icon: <MessageSquare className="h-4 w-4" />,
      },
      {
        title: 'Messages',
        value: formatNumber(data.workspace.totalMessages),
        detail: `${formatNumber(data.workspace.avgTurnsPerSession)} turns per session on average`,
        icon: <Layers3 className="h-4 w-4" />,
      },
      {
        title: 'Estimated spend',
        value: formatGbp(data.workspace.estimatedCostGbp),
        detail: `${formatNumber(data.workspace.totalTokens)} tokens in the selected window`,
        icon: <CircleDollarSign className="h-4 w-4" />,
      },
      {
        title: 'Completion rate',
        value: `${data.workspace.completionRate}%`,
        detail: data.workspace.topModel
          ? `Top model: ${data.workspace.topModel}`
          : 'No model traffic yet',
        icon: <Gauge className="h-4 w-4" />,
      },
    ];
  }, [data]);

  function exportJson() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `carina-analytics-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className={cn('border-b border-border', embedded ? 'px-3 py-2' : 'px-6 py-4')}>
        {!embedded ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold text-text-primary">Analytics</h1>
              <p className="text-xs text-text-muted">
                Workspace usage, spend, session health, and platform signals.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => { setRefreshing(true); void load(days); }}>
                <RefreshCw className="h-3.5 w-3.5" />
                {refreshing ? 'Refreshing' : 'Refresh'}
              </Button>
              <Button variant="outline" size="sm" onClick={exportJson} disabled={!data}>
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setRefreshing(true); void load(days); }}>
              <RefreshCw className="h-3.5 w-3.5" />
              {refreshing ? 'Refreshing' : 'Refresh'}
            </Button>
            <Button variant="outline" size="sm" onClick={exportJson} disabled={!data}>
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          </div>
        )}
        <div className={cn('flex flex-wrap items-center gap-2', !embedded && 'mt-3')}>
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDays(option)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-xs transition-colors',
                days === option
                  ? 'border-accent bg-accent-dim text-accent'
                  : 'border-border bg-surface text-text-secondary hover:text-text-primary',
              )}
            >
              Last {option} days
            </button>
          ))}
          <span className="ml-auto text-xs text-text-muted">
            Updated {data ? relativeTime(data.generatedAt) : 'never'}
          </span>
        </div>
        {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      </header>

      <div className={cn('min-h-0 flex-1 overflow-y-auto', embedded ? 'p-3' : 'p-4')}>
        {loading && !data ? (
          <EmptyState
            title="Loading analytics"
            subtitle="Pulling workspace usage and telemetry into a single view."
          />
        ) : data ? (
          <div className="space-y-4">
            <div className={cn('grid gap-3', embedded ? 'grid-cols-1 sm:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-4')}>
              {summaryCards.map((card) => (
                <MetricCard key={card.title} {...card} />
              ))}
            </div>

            <div className={cn('grid gap-4', embedded ? 'grid-cols-1' : 'xl:grid-cols-2')}>
              <SectionCard
                title="Usage over time"
                subtitle="Messages and tokens recorded in the selected window."
              >
                <UsageBars rows={data.workspace.usageSeries} />
              </SectionCard>

              <SectionCard
                title="Spend by model"
                subtitle="Estimated spend is derived from recorded token usage."
              >
                <BreakdownBars
                  rows={data.workspace.modelBreakdown}
                  emptyTitle="No model spend yet"
                  emptySubtitle="Model usage will appear after the workspace records chat traffic."
                />
              </SectionCard>
            </div>

            <div className={cn('grid gap-4', embedded ? 'grid-cols-1' : 'xl:grid-cols-2')}>
              <SectionCard
                title="Spend by provider"
                subtitle="Provider mix in the selected window."
              >
                <BreakdownBars
                  rows={data.workspace.providerBreakdown}
                  emptyTitle="No provider spend yet"
                  emptySubtitle="Provider usage will appear after the workspace records chat traffic."
                />
              </SectionCard>

              <SectionCard
                title="Session health"
                subtitle="Recent sessions with turn counts and activity state."
              >
                {data.workspace.sessions.length === 0 ? (
                  <EmptyState
                    title="No sessions yet"
                    subtitle="Session health appears after people start chatting."
                  />
                ) : (
                  <div className="space-y-2">
                    {data.workspace.sessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-xs"
                      >
                        <span className="min-w-0 flex-1 truncate text-text-primary">
                          {session.title}
                        </span>
                        <span className={cn('font-medium uppercase', statusTone(session.status))}>
                          {session.status}
                        </span>
                        <span className="text-text-muted">{formatNumber(session.turns)} turns</span>
                        <span className="text-text-muted">{relativeTime(session.lastMessageAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <SectionCard
                title="Platform signals"
                subtitle="Core telemetry is included when the core proxy is configured."
              >
                {core ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <MetricCard
                        title="Turn volume"
                        value={formatNumber(core.turns.total)}
                        detail={`${core.turns.avgLatencyMs} ms average latency`}
                        icon={<TrendingUp className="h-4 w-4" />}
                      />
                      <MetricCard
                        title="Provider fallbacks"
                        value={formatNumber(core.providers.fallbacks)}
                        detail={`${core.providers.cacheHits} cache hits, ${core.providers.cacheMisses} misses`}
                        icon={<BarChart3 className="h-4 w-4" />}
                      />
                      <MetricCard
                        title="Active spans"
                        value={formatNumber(core.activeSpans)}
                        detail={`${core.channels.connected}/${core.channels.configured} channels connected`}
                        icon={<Gauge className="h-4 w-4" />}
                      />
                      <MetricCard
                        title="Core health"
                        value={core.healthy ? 'Healthy' : 'Attention'}
                        detail={`${core.channels.degraded} degraded channels`}
                      />
                    </div>
                    <SignalBars buckets={core.turns.buckets} />
                  </div>
                ) : (
                  <EmptyState
                    title="Core telemetry unavailable"
                    subtitle="Configure the core proxy to surface platform health and turn buckets here."
                  />
                )}
              </SectionCard>

              <SectionCard
                title="How Carina is used"
                subtitle="A quick read on current session behaviour."
              >
                {data.workspace.sessions.length === 0 ? (
                  <EmptyState
                    title="No session detail yet"
                    subtitle="This panel fills in once sessions and assistant turns exist."
                  />
                ) : (
                  <div className="space-y-2 text-sm">
                    <p className="text-text-secondary">
                      {data.workspace.completionRate}% of sessions reached an assistant response.
                    </p>
                    <p className="text-text-secondary">
                      The busiest model is {data.workspace.topModel ?? 'not yet established'}.
                    </p>
                    <p className="text-text-secondary">
                      The busiest provider is {data.workspace.topProvider ?? 'not yet established'}.
                    </p>
                    <div className="rounded-md border border-border bg-base p-3 text-xs text-text-muted">
                      Analytics only uses recorded workspace activity and telemetry. Empty sections stay empty
                      until Carina has something real to report.
                    </div>
                  </div>
                )}
              </SectionCard>
            </div>
          </div>
        ) : (
          <EmptyState
            title="Analytics unavailable"
            subtitle="No analytics data could be loaded."
          />
        )}
      </div>
    </div>
  );
}
