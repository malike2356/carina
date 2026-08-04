'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { AgentOsShell } from '@/components/agent-os/AgentOsShell';
import { ListSkeleton } from '@/components/ui/Skeleton';

const fetcher = (url: string) => fetch(url).then((res) => (res.ok ? res.json() : null));

type WorkerRow = {
  workerId?: string;
  workerName?: string;
  name?: string;
  messages?: number;
  messageCount?: number;
  tokens?: number;
  cost?: number;
};

export default function AgentOsUsagePage() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const { data, isLoading } = useSWR(`/api/analytics/aiva-breakdown?period=${period}`, fetcher);

  useEffect(() => {
    try {
      localStorage.setItem('carina-agent-os-usage-reviewed', '1');
    } catch {
      /* ignore */
    }
  }, []);

  const workers: WorkerRow[] =
    (data?.workers as WorkerRow[]) ||
    (data?.byWorker as WorkerRow[]) ||
    (data?.data?.workers as WorkerRow[]) ||
    [];

  const tips = [
    'Reuse one worker for repetitive channel work instead of spinning new sessions.',
    'Prefer short system prompts and pack skills over long pasted context.',
    'Clear approvals promptly so retries do not burn messages.',
  ];

  return (
    <AgentOsShell
      title="Usage by agent"
      description="Message and spend breakdown by Aiva worker. No fabricated token totals."
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {(['7d', '30d', '90d'] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`min-h-11 rounded-lg border px-3 text-xs ${
              period === p ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-muted'
            }`}
          >
            {p}
          </button>
        ))}
        <Link href="/billing/aiva" className="inline-flex min-h-11 items-center text-xs text-accent hover:underline">
          Soft Wall / billing
        </Link>
      </div>

      <div className="mb-4 rounded-xl border border-border p-4">
        <p className="mb-2 text-xs font-medium text-text-primary">Token tips</p>
        <ul className="space-y-1 text-xs text-text-muted">
          {tips.map((tip) => (
            <li key={tip}>- {tip}</li>
          ))}
        </ul>
      </div>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : !workers.length ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-sm text-text-muted">No worker usage yet.</p>
          <Link href="/aiva/hire" className="mt-3 inline-flex min-h-11 items-center text-sm text-accent hover:underline">
            Hire an Aiva
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {workers.map((row, index) => {
            const name = row.workerName || row.name || row.workerId || `Worker ${index + 1}`;
            const messages = row.messages ?? row.messageCount ?? 0;
            return (
              <li
                key={row.workerId || name}
                className="flex min-h-11 items-center justify-between rounded-xl border border-border px-4 py-3 text-sm"
              >
                <span className="text-text-primary">{name}</span>
                <span className="text-text-muted">
                  {messages.toLocaleString()} msgs
                  {typeof row.tokens === 'number' ? ` · ${row.tokens.toLocaleString()} tok` : ''}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </AgentOsShell>
  );
}
