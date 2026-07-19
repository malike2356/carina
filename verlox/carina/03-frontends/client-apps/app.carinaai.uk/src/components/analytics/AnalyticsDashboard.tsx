'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BarChart3,
  Bot,
  CalendarDays,
  Database,
  Download,
  FileText,
  Mail,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ActivityHeatmap } from '@/components/analytics/ActivityHeatmap';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AnalyticsOverview, AnalyticsStatusRow } from '@/lib/analytics-types';
import { formatGbp } from '@/lib/analytics-types';

const RANGE_OPTIONS = [7, 30, 90] as const;
const CHART_HEIGHT = 280;
const COLORS = ['#16c97e', '#2563eb', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#64748b'];

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-GB').format(value);
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatSeconds(sec: number): string {
  if (sec <= 0) return '0s';
  if (sec >= 3600) return '> 1h';
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
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
  if (status === 'active' || status === 'completed' || status === 'sent') return 'text-accent';
  if (status === 'idle' || status === 'running' || status === 'draft') return 'text-amber-400';
  if (status === 'failed') return 'text-danger';
  return 'text-text-muted';
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value: string | number | null | undefined): string {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function buildCsv(data: AnalyticsOverview): string {
  const rows: Array<Array<string | number>> = [
    ['section', 'metric', 'value', 'previous', 'change_pct'],
    ...data.business.modules.map((row) => ['module', row.label, row.value, row.previous, row.changePct]),
    ['workspace', 'sessions', data.workspace.totalSessions, '', ''],
    ['workspace', 'messages', data.workspace.totalMessages, '', ''],
    ['workspace', 'tokens', data.workspace.totalTokens, '', ''],
    ['workspace', 'estimated_spend_gbp', data.workspace.estimatedCostGbp, '', ''],
    ['aiva', 'conversations', data.aiva.summary.totalConversations, '', ''],
    ['aiva', 'messages_from_aiva', data.aiva.summary.messagesFromAiva, '', ''],
    ['aiva', 'escalation_rate', data.aiva.summary.escalationRate, '', ''],
    ['content', 'documents', data.business.content.documents, '', ''],
    ['content', 'memories', data.business.content.memories, '', ''],
    ['content', 'skills', data.business.content.skills, '', ''],
    ['email', 'total', data.business.email.total, '', ''],
    ['research', 'total', data.business.research.total, '', ''],
  ];
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
}

function TrendPill({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px]', positive ? 'text-accent' : 'text-danger')}>
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positive ? '+' : ''}
      {formatPct(value)}
    </span>
  );
}

function MetricCard({
  title,
  value,
  detail,
  trend,
  icon,
}: {
  title: string;
  value: string;
  detail?: string;
  trend?: number;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{title}</p>
          <p className="mt-2 truncate text-2xl font-semibold text-text-primary">{value}</p>
        </div>
        {icon ? <div className="shrink-0 text-text-muted">{icon}</div> : null}
      </div>
      <div className="mt-2 flex min-h-5 flex-wrap items-center gap-2 text-xs text-text-secondary">
        {detail ? <span>{detail}</span> : null}
        {trend !== undefined ? <TrendPill value={trend} /> : null}
      </div>
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
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs text-text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ChartFrame({ children }: { children: ReactNode }) {
  return (
    <div className="w-full min-w-0" style={{ height: CHART_HEIGHT, minHeight: CHART_HEIGHT }}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0} debounce={50}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}

function EmptyChart({ title, subtitle }: { title: string; subtitle: string }) {
  return <EmptyState title={title} subtitle={subtitle} />;
}

function StatusDoughnut({ rows }: { rows: AnalyticsStatusRow[] }) {
  const filtered = rows.filter((row) => row.value > 0);
  if (filtered.length === 0) {
    return <EmptyChart title="No status data yet" subtitle="Status counts appear after the workspace records activity." />;
  }

  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      <ChartFrame>
        <PieChart>
          <Pie data={filtered} dataKey="value" nameKey="label" innerRadius={62} outerRadius={96} paddingAngle={2}>
            {filtered.map((row, index) => (
              <Cell key={row.key} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ChartFrame>
      <div className="space-y-2">
        {filtered.map((row, index) => (
          <div key={row.key} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-xs">
            <span className="flex min-w-0 items-center gap-2 text-text-primary">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
              <span className="truncate">{row.label}</span>
            </span>
            <span className="font-medium text-text-secondary">{formatNumber(row.value)}</span>
          </div>
        ))}
      </div>
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

  const executiveCards = useMemo(() => {
    if (!data) return [];
    return [
      {
        title: 'Total activity',
        value: formatNumber(data.business.scorecard.moduleActivity.current),
        detail: `${formatNumber(data.business.modules.length)} tracked modules`,
        trend: data.business.scorecard.moduleActivity.changePct,
        icon: <BarChart3 className="h-4 w-4" />,
      },
      {
        title: 'Aiva conversations',
        value: formatNumber(data.aiva.summary.totalConversations),
        detail: `${formatNumber(data.aiva.summary.messagesFromAiva)} Aiva replies`,
        icon: <Bot className="h-4 w-4" />,
      },
      {
        title: 'Meetings',
        value: formatNumber(data.business.meetings.total),
        detail: `${formatNumber(data.business.meetings.upcoming)} upcoming`,
        trend: data.business.scorecard.meetings.changePct,
        icon: <CalendarDays className="h-4 w-4" />,
      },
      {
        title: 'Schedules',
        value: formatNumber(data.business.schedules.total),
        detail: `${formatNumber(data.business.schedules.active)} active`,
        trend: data.business.scorecard.schedules.changePct,
        icon: <RefreshCw className="h-4 w-4" />,
      },
      {
        title: 'Content assets',
        value: formatNumber(data.business.content.documents + data.business.content.notes + data.business.content.memories),
        detail: `${formatNumber(data.business.content.documents)} docs, ${formatNumber(data.business.content.memories)} memories`,
        icon: <FileText className="h-4 w-4" />,
      },
      {
        title: 'Email volume',
        value: formatNumber(data.business.email.total),
        detail: `${formatNumber(data.business.email.urgent)} urgent`,
        trend: data.business.scorecard.emails.changePct,
        icon: <Mail className="h-4 w-4" />,
      },
      {
        title: 'AI usage',
        value: formatNumber(data.workspace.totalTokens),
        detail: `${formatGbp(data.workspace.estimatedCostGbp)} estimated spend`,
        icon: <Database className="h-4 w-4" />,
      },
      {
        title: 'Completion rate',
        value: `${data.workspace.completionRate}%`,
        detail: `${formatNumber(data.workspace.avgTurnsPerSession)} turns per session`,
      },
    ];
  }, [data]);

  function exportJson() {
    if (!data) return;
    downloadFile(`aiva-workspace-analytics-${new Date().toISOString()}.json`, JSON.stringify(data, null, 2), 'application/json');
  }

  function exportCsv() {
    if (!data) return;
    downloadFile(`aiva-workspace-analytics-${new Date().toISOString()}.csv`, buildCsv(data), 'text/csv');
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className={cn('border-b border-border', embedded ? 'px-3 py-2' : 'px-6 py-5')}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-text-primary">Analytics</h1>
            <p className="text-sm text-text-secondary">
              Business-facing workspace metrics for growth, usage, operations, meetings, schedules, and Aiva performance.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setRefreshing(true); void load(days); }}>
              <RefreshCw className="h-3.5 w-3.5" />
              {refreshing ? 'Refreshing' : 'Refresh'}
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data}>
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportJson} disabled={!data}>
              <Download className="h-3.5 w-3.5" />
              JSON
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
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
          <EmptyState title="Loading analytics" subtitle="Counting the workspace into one executive view." />
        ) : data ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {executiveCards.map((card) => (
                <MetricCard key={card.title} {...card} />
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
              <SectionCard title="Growth over time" subtitle="Daily activity across chat, meetings, documents, schedules, email, and research.">
                {data.business.activitySeries.length === 0 ? (
                  <EmptyChart title="No activity yet" subtitle="Workspace activity appears here as people use the product." />
                ) : (
                  <ChartFrame>
                    <LineChart data={data.business.activitySeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="messages" stroke="#16c97e" strokeWidth={2} dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="meetings" stroke="#2563eb" strokeWidth={2} dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="documents" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="emails" stroke="#8b5cf6" strokeWidth={2} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ChartFrame>
                )}
              </SectionCard>

              <SectionCard title="Module activity" subtitle="What parts of the workspace are creating measurable work.">
                <ChartFrame>
                  <BarChart data={data.business.modules} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="label" width={92} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#16c97e" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                  </BarChart>
                </ChartFrame>
              </SectionCard>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <SectionCard title="Aiva activity" subtitle="Core Aiva traffic, replies, channel mix, and escalations.">
                {data.aiva.available ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <MetricCard title="Replies" value={formatNumber(data.aiva.summary.messagesFromAiva)} detail="Messages sent by Aivas" />
                      <MetricCard title="Escalation rate" value={formatPct(data.aiva.summary.escalationRate * 100)} detail="Share of handled activity" />
                      <MetricCard title="Avg response" value={formatSeconds(data.aiva.summary.avgResponseSec)} detail="First response speed" />
                    </div>
                    <ChartFrame>
                      <AreaChart data={data.aiva.volume}>
                        <defs>
                          <linearGradient id="aivaVolumeFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#16c97e" stopOpacity={0.34} />
                            <stop offset="95%" stopColor="#16c97e" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="count" stroke="#16c97e" fill="url(#aivaVolumeFill)" isAnimationActive={false} />
                      </AreaChart>
                    </ChartFrame>
                    {data.aiva.gated ? (
                      <p className="text-xs text-amber-400">Some Aiva analytics require the Team plan.</p>
                    ) : null}
                  </div>
                ) : (
                  <EmptyChart title="Aiva analytics unavailable" subtitle="Core proxy data will appear when Aiva backend analytics is reachable." />
                )}
              </SectionCard>

              <SectionCard title="Channels" subtitle="Conversation sources across connected Aiva channels.">
                {data.aiva.channels.length === 0 ? (
                  <EmptyChart title="No channel mix yet" subtitle="Channel counts appear after Aivas receive conversations." />
                ) : (
                  <ChartFrame>
                    <BarChart data={data.aiva.channels}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                      <XAxis dataKey="channel" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" isAnimationActive={false}>
                        {data.aiva.channels.map((row, index) => (
                          <Cell key={row.channel} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartFrame>
                )}
              </SectionCard>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <SectionCard title="Meetings" subtitle="Calendar activity and upcoming commitments.">
                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricCard title="Total" value={formatNumber(data.business.meetings.total)} />
                  <MetricCard title="Upcoming" value={formatNumber(data.business.meetings.upcoming)} />
                  <MetricCard title="Past" value={formatNumber(data.business.meetings.past)} />
                </div>
                <div className="mt-4">
                  <StatusDoughnut rows={data.business.meetings.bySource} />
                </div>
              </SectionCard>

              <SectionCard title="Schedules" subtitle="Workspace automations and run health.">
                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricCard title="Active" value={formatNumber(data.business.schedules.active)} />
                  <MetricCard title="Paused" value={formatNumber(data.business.schedules.paused)} />
                  <MetricCard title="Draft" value={formatNumber(data.business.schedules.draft)} />
                </div>
                <div className="mt-4">
                  <StatusDoughnut rows={data.business.schedules.runs} />
                </div>
              </SectionCard>

              <SectionCard title="Knowledge base" subtitle="Workspace assets Aiva and Carina can use.">
                <div className="space-y-3">
                  {[
                    ['Documents', data.business.content.documents],
                    ['Active documents', data.business.content.activeDocuments],
                    ['Memories', data.business.content.memories],
                    ['Notes', data.business.content.notes],
                    ['Enabled skills', data.business.content.skills],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                      <span className="text-text-secondary">{label}</span>
                      <span className="font-medium text-text-primary">{formatNumber(Number(value))}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <SectionCard title="Email and research status" subtitle="Business communication and research output.">
                <div className="grid gap-4 md:grid-cols-2">
                  <StatusDoughnut rows={data.business.email.byStatus} />
                  <StatusDoughnut rows={data.business.research.byStatus} />
                </div>
              </SectionCard>

              <SectionCard title="AI spend and models" subtitle="Token usage, provider mix, and estimated cost.">
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <MetricCard title="Tokens" value={formatNumber(data.workspace.totalTokens)} />
                    <MetricCard title="Spend" value={formatGbp(data.workspace.estimatedCostGbp)} />
                    <MetricCard title="Top model" value={data.workspace.topModel ?? 'None'} />
                  </div>
                  <ChartFrame>
                    <BarChart data={data.workspace.modelBreakdown.slice(0, 8)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                      <XAxis dataKey="key" tick={{ fontSize: 10 }} interval={0} angle={-20} height={70} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="tokens" fill="#2563eb" isAnimationActive={false} />
                    </BarChart>
                  </ChartFrame>
                </div>
              </SectionCard>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
              <SectionCard title="Per Aiva performance" subtitle="Worker-level message volume, escalations, and response speed.">
                {data.aiva.workers.length === 0 ? (
                  <EmptyChart title="No worker analytics yet" subtitle="Per-Aiva rows appear after workers handle messages." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs text-text-muted">
                          <th className="pb-2 pr-4 font-medium">Aiva</th>
                          <th className="pb-2 pr-4 font-medium">Messages</th>
                          <th className="pb-2 pr-4 font-medium">Escalations</th>
                          <th className="pb-2 font-medium">Avg response</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.aiva.workers.map((row) => (
                          <tr key={row.workerId} className="border-b border-border/60">
                            <td className="py-2 pr-4 text-text-primary">{row.workerName}</td>
                            <td className="py-2 pr-4 text-text-secondary">{formatNumber(row.messageCount)}</td>
                            <td className="py-2 pr-4 text-text-secondary">{formatNumber(row.escalationCount)}</td>
                            <td className="py-2 text-text-secondary">{formatSeconds(row.avgResponseSec)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Aiva activity heatmap" subtitle="When Aivas are busiest across the week.">
                {data.aiva.heatmap.length === 0 ? (
                  <EmptyChart title="No heatmap yet" subtitle="Heatmap data appears once Aivas have enough activity." />
                ) : (
                  <ActivityHeatmap cells={data.aiva.heatmap} />
                )}
              </SectionCard>
            </div>

            <SectionCard title="Recent sessions" subtitle="Live workspace conversation health.">
              {data.workspace.sessions.length === 0 ? (
                <EmptyChart title="No sessions yet" subtitle="Session health appears after people start chatting." />
              ) : (
                <div className="grid gap-2 lg:grid-cols-2">
                  {data.workspace.sessions.map((session) => (
                    <div key={session.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-xs">
                      <span className="min-w-0 flex-1 truncate text-text-primary">{session.title}</span>
                      <span className={cn('font-medium uppercase', statusTone(session.status))}>{session.status}</span>
                      <span className="text-text-muted">{formatNumber(session.turns)} turns</span>
                      <span className="text-text-muted">{relativeTime(session.lastMessageAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        ) : (
          <EmptyState title="Analytics unavailable" subtitle="No analytics data could be loaded." />
        )}
      </div>
    </div>
  );
}
