'use client';

import { useState, type ReactElement } from 'react';
import useSWR from 'swr';
import { TrendingDown, TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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
import { CohortRetentionPanel } from '@/components/analytics/CohortRetentionPanel';
import { FeatureAdoptionPanel } from '@/components/analytics/FeatureAdoptionPanel';
import { AdminOpsAnalyticsPanel } from '@/components/aiva/AdminOpsAnalyticsPanel';
import { PlanGateSection } from '@/components/billing/PlanGateSection';
import { cn } from '@/lib/utils';

type Period = '7d' | '30d' | '90d';

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: '#25D366',
  email: '#1a5f7a',
  slack: '#4A154B',
  telegram: '#229ED9',
  web: '#f59e0b',
  voice: '#a855f7',
  sms: '#0ea5e9',
};

const MIX_COLORS = ['#1a5f7a', '#f59e0b', '#22c55e', '#ef4444', '#64748b', '#a855f7'];
const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  approved: '#22c55e',
  rejected: '#ef4444',
  timeout: '#64748b',
  sent: '#1a5f7a',
  open: '#f59e0b',
  resolved: '#22c55e',
  Inbound: '#1a5f7a',
  Outbound: '#f59e0b',
};

const fetcher = (url: string) => fetch(url).then((res) => (res.ok ? res.json() : null));

function formatAvgResponse(sec: number): string {
  if (!sec || sec <= 0) return ';';
  if (sec > 3600) return '> 1h';
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function StatCard({
  label,
  value,
  trendPct,
  hint,
}: {
  label: string;
  value: string | number;
  trendPct?: number;
  hint?: string;
}) {
  const positive = (trendPct ?? 0) >= 0;
  return (
    <div className="rounded-lg border border-border bg-elevated p-4">
      <p className="text-2xl font-semibold text-text-primary">{value}</p>
      <p className="mt-0.5 text-xs text-text-muted">{label}</p>
      {hint ? <p className="mt-1 text-[11px] text-text-muted">{hint}</p> : null}
      {trendPct !== undefined && trendPct !== 0 ? (
        <div className="mt-2 flex items-center gap-1">
          {positive ? (
            <TrendingUp className="h-3 w-3 text-green-400" />
          ) : (
            <TrendingDown className="h-3 w-3 text-red-400" />
          )}
          <span className={cn('text-[11px]', positive ? 'text-green-400' : 'text-red-400')}>
            {positive ? '+' : ''}
            {trendPct.toFixed(0)}% vs prev period
          </span>
        </div>
      ) : null}
    </div>
  );
}

function PeriodSelector({
  value,
  onChange,
}: {
  value: Period;
  onChange: (value: Period) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-elevated p-0.5">
      {(['7d', '30d', '90d'] as const).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            value === p ? 'bg-accent-dim text-accent' : 'text-text-muted hover:text-text-primary',
          )}
        >
          {p === '7d' ? '7 days' : p === '30d' ? '30 days' : '90 days'}
        </button>
      ))}
    </div>
  );
}

function SummaryCards({ period }: { period: Period }) {
  const { data } = useSWR(`/api/analytics/summary?period=${period}`, fetcher);
  if (!data) return <p className="text-sm text-text-muted">Loading summary...</p>;

  const cards = [
    {
      label: 'Total conversations',
      value: data.totalConversations ?? 0,
      trendPct: data.totalConversationsTrend as number | undefined,
    },
    {
      label: 'Aiva replies',
      value: data.messagesFromAiva ?? 0,
      trendPct: data.messagesFromAivaTrend as number | undefined,
    },
    {
      label: 'Escalation rate',
      value: `${((data.escalationRate ?? 0) * 100).toFixed(1)}%`,
      trendPct: data.escalationRateTrend as number | undefined,
    },
    {
      label: 'Avg first response',
      value: formatAvgResponse(Number(data.avgResponseSec ?? 0)),
      trendPct: data.avgResponseSecTrend as number | undefined,
    },
    {
      label: 'Response P50',
      value: formatAvgResponse(Number(data.responseP50Sec ?? 0)),
      hint: data.responseSampleSize ? `${data.responseSampleSize} paired replies` : undefined,
    },
    {
      label: 'Response P95',
      value: formatAvgResponse(Number(data.responseP95Sec ?? 0)),
      hint: 'Long-tail first response',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => (
        <StatCard
          key={card.label}
          label={card.label}
          value={card.value}
          trendPct={card.trendPct}
          hint={card.hint}
        />
      ))}
    </div>
  );
}

const CHART_HEIGHT = 256;

function ChartFrame({ children }: { children: ReactElement }) {
  return (
    <div className="w-full min-w-0" style={{ height: CHART_HEIGHT, minHeight: CHART_HEIGHT }}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0} debounce={50}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}

function VolumeChart({ period }: { period: Period }) {
  const { data } = useSWR(`/api/analytics/volume?period=${period}`, fetcher);
  const points = (data?.points ?? []) as Array<{ date: string; count: number }>;

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-4 text-sm font-semibold text-text-primary">Activity volume</h2>
      <ChartFrame>
        <LineChart data={points}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#1a5f7a"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartFrame>
    </section>
  );
}

function OpsSection({ period }: { period: Period }) {
  const { data } = useSWR(`/api/analytics/ops?period=${period}`, fetcher);
  if (!data) {
    return <p className="text-sm text-text-muted">Loading ops metrics...</p>;
  }

  const directionPoints = (data.direction?.points ?? []) as Array<{
    date: string;
    inbound: number;
    outbound: number;
  }>;
  const directionMix = (data.direction?.mix ?? []) as Array<{ name: string; value: number }>;
  const approvalDonut = (data.approvals?.donut ?? []) as Array<{ name: string; value: number }>;
  const escDonut = (data.escalationLifecycle?.donut ?? []) as Array<{ name: string; value: number }>;
  const escPoints = (data.escalationLifecycle?.points ?? []) as Array<{
    date: string;
    opened: number;
    resolved: number;
  }>;
  const channels = (data.channels ?? []) as Array<{
    channel: string;
    messages: number;
    threads: number;
    pct: number;
  }>;
  const usage = data.usage as {
    messageCount?: number;
    messageLimit?: number | null;
    unlimited?: boolean;
    pctUsed?: number;
    planTier?: string;
    month?: string;
  } | undefined;

  const usageLabel = usage?.unlimited
    ? `${usage.messageCount ?? 0} (unlimited)`
    : `${usage?.messageCount ?? 0} / ${usage?.messageLimit ?? ';'}`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Usage this month"
          value={usageLabel}
          hint={
            usage?.unlimited
              ? `${usage.planTier ?? 'plan'} · ${usage.month ?? ''}`
              : `${usage?.pctUsed ?? 0}% of ${usage?.planTier ?? 'plan'} limit · ${usage?.month ?? ''}`
          }
        />
        <StatCard
          label="Approvals pending"
          value={data.approvals?.pendingNow ?? 0}
          hint={`Email ${data.approvals?.emailPending ?? 0} · Social ${data.approvals?.socialPending ?? 0}`}
        />
        <StatCard
          label="Open escalations"
          value={data.escalationLifecycle?.openNow ?? 0}
          hint="Live queue from escalation table"
        />
        <StatCard
          label="Inbound / outbound"
          value={`${data.direction?.totals?.inbound ?? 0} / ${data.direction?.totals?.outbound ?? 0}`}
          hint="Received vs Aiva replies in period"
        />
      </div>

      {!usage?.unlimited && usage?.messageLimit ? (
        <section className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-text-primary">Plan usage</h2>
            <span className="text-xs text-text-muted">{usage.pctUsed ?? 0}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-overlay">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                (usage.pctUsed ?? 0) >= 90 ? 'bg-danger' : (usage.pctUsed ?? 0) >= 70 ? 'bg-amber-400' : 'bg-accent',
              )}
              style={{ width: `${Math.min(100, usage.pctUsed ?? 0)}%` }}
            />
          </div>
        </section>
      ) : null}

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Inbound vs outbound</h2>
          <ChartFrame>
            <AreaChart data={directionPoints}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="inbound"
                stackId="1"
                stroke="#1a5f7a"
                fill="#1a5f7a"
                fillOpacity={0.45}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="outbound"
                stackId="1"
                stroke="#f59e0b"
                fill="#f59e0b"
                fillOpacity={0.45}
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartFrame>
        </section>

        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Message direction mix</h2>
          <ChartFrame>
            <PieChart>
              <Pie
                data={directionMix.filter((d) => d.value > 0)}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
                isAnimationActive={false}
              >
                {directionMix.map((row) => (
                  <Cell key={row.name} fill={STATUS_COLORS[row.name] ?? MIX_COLORS[0]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ChartFrame>
        </section>

        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Approval outcomes</h2>
          {approvalDonut.length === 0 ? (
            <p className="py-16 text-center text-sm text-text-muted">No approval drafts in this period.</p>
          ) : (
            <ChartFrame>
              <PieChart>
                <Pie
                  data={approvalDonut}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                  isAnimationActive={false}
                >
                  {approvalDonut.map((row) => (
                    <Cell key={row.name} fill={STATUS_COLORS[row.name] ?? '#64748b'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ChartFrame>
          )}
        </section>

        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Escalation status</h2>
          {escDonut.length === 0 ? (
            <p className="py-16 text-center text-sm text-text-muted">No escalations in this period.</p>
          ) : (
            <ChartFrame>
              <PieChart>
                <Pie
                  data={escDonut}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                  isAnimationActive={false}
                >
                  {escDonut.map((row) => (
                    <Cell key={row.name} fill={STATUS_COLORS[row.name] ?? '#64748b'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ChartFrame>
          )}
        </section>

        <section className="rounded-lg border border-border bg-surface p-4 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Escalations opened vs resolved</h2>
          <ChartFrame>
            <LineChart data={escPoints}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="opened" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="resolved" stroke="#22c55e" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ChartFrame>
        </section>

        <section className="rounded-lg border border-border bg-surface p-4 lg:col-span-2">
          <h2 className="mb-1 text-sm font-semibold text-text-primary">Messages by channel</h2>
          <p className="mb-4 text-xs text-text-muted">Weighted by thread message counts, not thread count alone.</p>
          <ChartFrame>
            <BarChart data={channels}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="channel" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="messages" name="Messages" isAnimationActive={false}>
                {channels.map((row) => (
                  <Cell key={row.channel} fill={CHANNEL_COLORS[row.channel] ?? '#64748b'} />
                ))}
              </Bar>
              <Bar dataKey="threads" name="Threads" fill="#334155" isAnimationActive={false} />
            </BarChart>
          </ChartFrame>
        </section>
      </div>
    </div>
  );
}

function ChannelBreakdownChart({ period }: { period: Period }) {
  const { data } = useSWR(`/api/analytics/channels?period=${period}`, fetcher);
  const channels = (data?.channels ?? []) as Array<{
    channel: string;
    count: number;
    messages?: number;
    threads?: number;
    pct: number;
  }>;

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-4 text-sm font-semibold text-text-primary">Channels (Team)</h2>
      <ChartFrame>
        <BarChart data={channels} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="channel" tick={{ fontSize: 11 }} width={72} />
          <Tooltip />
          <Bar dataKey="count" isAnimationActive={false}>
            {channels.map((row) => (
              <Cell key={row.channel} fill={CHANNEL_COLORS[row.channel] ?? '#64748b'} />
            ))}
          </Bar>
        </BarChart>
      </ChartFrame>
    </section>
  );
}

function EscalationTrendChart({ period }: { period: Period }) {
  const { data } = useSWR(`/api/analytics/escalations?period=${period}`, fetcher);
  const points = (data?.points ?? []) as Array<{ date: string; rate: number; escalated: number }>;

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-4 text-sm font-semibold text-text-primary">Activity escalation flag</h2>
      <ChartFrame>
        <AreaChart data={points}>
          <defs>
            <linearGradient id="escalationFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Area
            type="monotone"
            dataKey="escalated"
            stroke="#f59e0b"
            fill="url(#escalationFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartFrame>
    </section>
  );
}

function AivaBreakdownTable({ period }: { period: Period }) {
  const { data } = useSWR(`/api/analytics/aiva-breakdown?period=${period}`, fetcher);
  const workers = (data?.workers ?? []) as Array<{
    workerId: string;
    workerName: string;
    messageCount: number;
    escalationCount: number;
    avgResponseSec: number;
  }>;

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-4 text-sm font-semibold text-text-primary">Per Aiva</h2>
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
            {workers.map((row) => (
              <tr key={row.workerId} className="border-b border-border/60">
                <td className="py-2 pr-4 text-text-primary">{row.workerName}</td>
                <td className="py-2 pr-4 text-text-secondary">{row.messageCount}</td>
                <td className="py-2 pr-4 text-text-secondary">{row.escalationCount}</td>
                <td className="py-2 text-text-secondary">{formatAvgResponse(row.avgResponseSec)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HeatmapSection({ period }: { period: Period }) {
  const { data } = useSWR(`/api/analytics/heatmap?period=${period}`, fetcher);
  const cells = (data?.cells ?? []) as Array<{ dayOfWeek: number; hour: number; count: number }>;
  return <ActivityHeatmap cells={cells} />;
}

export function AivaAnalyticsDashboard() {
  const [period, setPeriod] = useState<Period>('30d');
  const [tab, setTab] = useState<'aiva' | 'admin'>('aiva');
  const { data: billing } = useSWR('/api/aiva/billing/status', fetcher);
  const planTier = String(
    (billing as { subscription?: { planTier?: string }; planTier?: string } | null)?.subscription
      ?.planTier ??
      (billing as { planTier?: string } | null)?.planTier ??
      'trial',
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Analytics</h1>
          <p className="text-sm text-text-secondary">
            Aiva conversation metrics and workspace admin ops (email, projects, docs, meetings,
            research, tasks, staff, Drive).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-elevated p-0.5">
            {(
              [
                { id: 'aiva' as const, label: 'Aiva' },
                { id: 'admin' as const, label: 'Admin' },
              ]
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  tab === item.id
                    ? 'bg-accent-dim text-accent'
                    : 'text-text-muted hover:text-text-primary',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
      </div>

      {tab === 'admin' ? (
        <AdminOpsAnalyticsPanel period={period} />
      ) : (
        <>
          <SummaryCards period={period} />
          <CohortRetentionPanel />
          <FeatureAdoptionPanel />
          <OpsSection period={period} />
          <VolumeChart period={period} />
          <PlanGateSection planRequired="team" currentPlan={planTier}>
            <div className="space-y-6">
              <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
                <ChannelBreakdownChart period={period} />
                <EscalationTrendChart period={period} />
              </div>
              <HeatmapSection period={period} />
              <AivaBreakdownTable period={period} />
            </div>
          </PlanGateSection>
        </>
      )}
    </div>
  );
}
