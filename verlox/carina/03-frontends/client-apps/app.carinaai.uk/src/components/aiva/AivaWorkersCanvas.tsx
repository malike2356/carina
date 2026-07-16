'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bot, PlugZap } from 'lucide-react';
import { AivaAvatar } from '@/components/aiva/AivaAvatar';
import { cn } from '@/lib/utils';

type CanvasWorker = {
  id: string;
  name: string;
  status: string;
  roleDescription: string;
  channels: unknown[];
};

function statusTone(status: string): string {
  if (status === 'active') return 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/25';
  if (status === 'configuring') return 'bg-sky-500/15 text-sky-300 ring-sky-400/25';
  if (status === 'paused') return 'bg-white/10 text-text-muted ring-white/15';
  if (status === 'error') return 'bg-red-500/15 text-red-300 ring-red-400/25';
  return 'bg-white/10 text-text-secondary ring-white/15';
}

function shortRole(description: string): string {
  const trimmed = description.trim();
  if (!trimmed) return 'AI Employee ready for customer and admin work.';
  const first = trimmed.split(/[.!?\n]/)[0]?.trim() || trimmed;
  return first.length > 140 ? `${first.slice(0, 140)}...` : first;
}

export function AivaWorkersCanvas() {
  const [workers, setWorkers] = useState<CanvasWorker[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const orgRes = await fetch('/api/aiva/orgs');
      let orgId = '';
      if (orgRes.ok) {
        const orgData = (await orgRes.json()) as {
          enabled?: boolean;
          activeOrgId?: string | null;
          orgs?: Array<{ id: string; active?: boolean }>;
        };
        if (orgData.enabled) {
          orgId = orgData.activeOrgId
            ?? orgData.orgs?.find((org) => org.active)?.id
            ?? '';
        }
      }
      const qs = orgId ? `?orgId=${encodeURIComponent(orgId)}` : '';
      const res = await fetch(`/api/aiva/canvas/workers${qs}`);
      const data = (await res.json()) as { workers?: CanvasWorker[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Canvas unavailable');
      setWorkers(data.workers ?? []);
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const onOrg = () => void load();
    window.addEventListener('aiva-org-changed', onOrg);
    return () => window.removeEventListener('aiva-org-changed', onOrg);
  }, []);

  const activeCount = workers.filter((worker) => worker.status === 'active').length;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Workers canvas</h1>
          <p className="mt-1 text-sm text-text-muted">
            {loading
              ? 'Loading your AI team...'
              : workers.length === 0
                ? 'No AI Employees in this workspace yet.'
                : `${workers.length} AI Employee${workers.length === 1 ? '' : 's'} · ${activeCount} active`}
          </p>
        </div>
        <Link
          href="/aiva/workers"
          className="text-sm font-medium text-accent hover:underline"
        >
          Manage employees
        </Link>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {!loading && workers.length === 0 && !error ? (
        <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center">
          <Bot className="mx-auto h-10 w-10 text-text-muted" aria-hidden />
          <p className="mt-3 text-sm font-medium text-text-primary">No workers on the canvas yet</p>
          <p className="mt-1 text-sm text-text-muted">Hire an AI Employee to see them here.</p>
          <Link
            href="/aiva"
            className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-primary-foreground"
          >
            Hire AI Employee
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {workers.map((worker) => {
          const channelCount = Array.isArray(worker.channels) ? worker.channels.length : 0;
          return (
            <Link
              key={worker.id}
              href={`/aiva/workers/${worker.id}`}
              className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card p-5 transition hover:border-accent/40"
            >
              <div className="flex min-w-0 items-start gap-3">
                <AivaAvatar name={worker.name} className="h-11 w-11 text-base" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-text-primary">{worker.name}</p>
                  <span
                    className={cn(
                      'mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1',
                      statusTone(worker.status),
                    )}
                  >
                    {worker.status}
                  </span>
                </div>
              </div>
              <p className="mt-4 line-clamp-3 text-sm leading-6 text-text-secondary">
                {shortRole(worker.roleDescription)}
              </p>
              <div className="mt-4 flex items-center gap-1.5 border-t border-border pt-3 text-xs text-text-muted">
                <PlugZap className="h-3.5 w-3.5" aria-hidden />
                {channelCount} channel{channelCount === 1 ? '' : 's'}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
