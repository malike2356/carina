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
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ActivityHeatmap } from '@/components/analytics/ActivityHeatmap';
import { PlanGateSection } from '@/components/billing/PlanGateSection';
import { cn } from '@/lib/utils';

type Period = '7d' | '30d' | '90d';

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: '#25D366',
  email: '#1a5f7a',
  slack: '#4A154B',
  telegram: '#229ED9',
  web: '#f59e0b',
};

const fetcher = (url: string) => fetch(url).then((res) => (res.ok ? res.json() : null));

function formatAvgResponse(sec: number): string {
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
}: {
  label: string;
  value: string | number;
  trendPct?: number;
}) {
  const positive = (trendPct ?? 0) >= 0;
  return (
    <div className="rounded-lg border border-border bg-elevated p-4">
      <p className="text-2xl font-semibold text-text-primary">{value}</p>
      <p className="mt-0.5 text-xs text-text-muted">{label}</p>
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
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <StatCard key={card.label} label={card.label} value={card.value} trendPct={card.trendPct} />
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
      <h2 className="mb-4 text-sm font-semibold text-text-primary">Message volume</h2>
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

function ChannelBreakdownChart({ period }: { period: Period }) {
  const { data } = useSWR(`/api/analytics/channels?period=${period}`, fetcher);
  const channels = (data?.channels ?? []) as Array<{ channel: string; count: number; pct: number }>;

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-4 text-sm font-semibold text-text-primary">Channels</h2>
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
      <h2 className="mb-4 text-sm font-semibold text-text-primary">Escalation trend</h2>
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
            Basic metrics on all plans. Heatmaps, channel breakdown, and escalation trends require Team.
          </p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      <SummaryCards period={period} />
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
    </div>
  );
}
