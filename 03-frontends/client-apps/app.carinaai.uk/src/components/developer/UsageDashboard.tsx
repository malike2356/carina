'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { StatCard } from '@/components/developer/StatCard';

type GroupBy = 'day' | 'model' | 'event_type';

interface SeriesItem {
  date?: string;
  key?: string;
  events: number;
  tokensIn: number;
  tokensOut: number;
  toolCalls: number;
  skillCalls: number;
}

interface UsageTotals {
  events: number;
  tokensIn: number;
  tokensOut: number;
  toolCalls: number;
  skillCalls: number;
  estimatedFeePence: number;
}

interface UsageData {
  from: string;
  to: string;
  groupBy: string;
  totals: UsageTotals;
  series: SeriesItem[];
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function formatGbp(pence: number): string {
  return `GBP ${(pence / 100).toFixed(2)}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatDate(iso: string): string {
  const [, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[Number(m) - 1]} ${Number(d)}`;
}

export function UsageDashboard({ initialData }: { initialData: UsageData | null }) {
  const [from, setFrom] = useState(monthStartIso);
  const [to, setTo] = useState(todayIso);
  const [groupBy, setGroupBy] = useState<GroupBy>('day');
  const [data, setData] = useState<UsageData | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (f: string, t: string, g: GroupBy) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from: f, to: t, groupBy: g });
      const res = await fetch(`/api/developer/usage?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Error ${res.status}`);
        return;
      }
      setData(await res.json());
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialData) {
      void fetchData(from, to, groupBy);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function onFromChange(val: string) {
    setFrom(val);
    void fetchData(val, to, groupBy);
  }

  function onToChange(val: string) {
    setTo(val);
    void fetchData(from, val, groupBy);
  }

  function onGroupByChange(val: GroupBy) {
    setGroupBy(val);
    void fetchData(from, to, val);
  }

  async function exportCsv() {
    const params = new URLSearchParams({ from, to, format: 'csv' });
    const res = await fetch(`/api/developer/usage/export?${params.toString()}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') ?? '';
    const match = /filename=([^\s;]+)/.exec(disposition);
    const filename = match ? match[1].replace(/"/g, '') : 'carina_events.csv';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totals = data?.totals;
  const series = data?.series ?? [];
  const chartData = groupBy === 'day'
    ? series.map((s) => ({ label: formatDate(s.date ?? ''), events: s.events }))
    : [];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => onFromChange(e.target.value)}
            className="rounded-md border border-border bg-elevated px-3 py-1.5 text-sm text-text-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => onToChange(e.target.value)}
            className="rounded-md border border-border bg-elevated px-3 py-1.5 text-sm text-text-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted">Group by</label>
          <select
            value={groupBy}
            onChange={(e) => onGroupByChange(e.target.value as GroupBy)}
            className="rounded-md border border-border bg-elevated px-3 py-1.5 text-sm text-text-primary"
          >
            <option value="day">Day</option>
            <option value="model">Model</option>
            <option value="event_type">Event type</option>
          </select>
        </div>
        <button
          onClick={exportCsv}
          className="rounded-md border border-border bg-elevated px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
        >
          Export CSV
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total events"
          value={loading ? '-' : formatNumber(totals?.events ?? 0)}
        />
        <StatCard
          label="Tokens in"
          value={loading ? '-' : formatNumber(totals?.tokensIn ?? 0)}
        />
        <StatCard
          label="Tokens out"
          value={loading ? '-' : formatNumber(totals?.tokensOut ?? 0)}
        />
        <StatCard
          label="Est. fee"
          value={loading ? '-' : formatGbp(totals?.estimatedFeePence ?? 0)}
          sub="First 50k events free"
        />
      </div>

      {/* Line chart - only when groupBy=day */}
      {groupBy === 'day' && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="mb-3 text-xs font-medium text-text-muted">Daily event volume</p>
          {chartData.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">No data for this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200} minWidth={0} debounce={50}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--color-elevated)', border: '1px solid var(--color-border)', borderRadius: 6 }}
                  labelStyle={{ color: 'var(--color-text-primary)', fontSize: 12 }}
                  itemStyle={{ color: 'var(--color-text-secondary)', fontSize: 12 }}
                />
                <Line type="monotone" dataKey="events" stroke="var(--color-accent-primary)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Breakdown table */}
      {series.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-elevated/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                  {groupBy === 'day' ? 'Date' : groupBy === 'model' ? 'Model' : 'Event type'}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">Events</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">Tokens in</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">Tokens out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {series.map((row, i) => (
                <tr key={i} className="bg-surface transition-colors hover:bg-elevated/30">
                  <td className="px-4 py-2.5 text-text-primary">
                    {groupBy === 'day' ? formatDate(row.date ?? '') : String(row.key ?? '-')}
                  </td>
                  <td className="px-4 py-2.5 text-right text-text-secondary">{formatNumber(row.events)}</td>
                  <td className="px-4 py-2.5 text-right text-text-secondary">{formatNumber(row.tokensIn)}</td>
                  <td className="px-4 py-2.5 text-right text-text-secondary">{formatNumber(row.tokensOut)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
