'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Inbox,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { AivaHostedEmailCard } from '@/components/aiva/AivaHostedEmailCard';
import { useApprovalsPendingCount } from '@/hooks/useApprovalsPendingCount';
import { AIVA_INPUT_CLASS } from '@/lib/aiva-utils';
import { cn } from '@/lib/utils';

type WorkerRow = {
  id: string;
  name?: string;
  status?: string;
};

const SHORTCUTS = [
  {
    href: '/aiva/workers',
    label: 'AI Workers',
    description: 'Manage your team',
    icon: Bot,
  },
  {
    href: '/aiva/approvals',
    label: 'Approvals',
    description: 'Review drafts',
    icon: Inbox,
  },
] as const;

function featuredEmailStorageKey(orgId: string): string {
  return `aiva.home.featured-email-worker:${orgId || 'default'}`;
}

function readStoredFeaturedWorkerId(orgId: string): string | null {
  try {
    const value = window.localStorage.getItem(featuredEmailStorageKey(orgId));
    return value?.trim() || null;
  } catch {
    return null;
  }
}

function writeStoredFeaturedWorkerId(orgId: string, workerId: string): void {
  try {
    window.localStorage.setItem(featuredEmailStorageKey(orgId), workerId);
  } catch {
    // Ignore quota / private-mode failures.
  }
}

function pickFeaturedWorker(
  workers: WorkerRow[],
  preferredId: string | null,
): WorkerRow | null {
  if (workers.length === 0) return null;
  if (preferredId) {
    const preferred = workers.find((worker) => worker.id === preferredId);
    if (preferred) return preferred;
  }
  return workers.find((worker) => worker.status === 'active') ?? workers[0] ?? null;
}

export function AivaHomeLanding() {
  const { count: pendingApprovals } = useApprovalsPendingCount(true);
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [orgId, setOrgId] = useState('default');
  const [featuredWorkerId, setFeaturedWorkerId] = useState<string | null>(null);
  const [loadingWorkers, setLoadingWorkers] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingWorkers(true);
      try {
        let nextOrgId = 'default';
        try {
          const orgRes = await fetch('/api/aiva/orgs');
          if (orgRes.ok) {
            const orgData = (await orgRes.json().catch(() => ({}))) as {
              activeOrgId?: string | null;
              orgs?: Array<{ id: string; active?: boolean }>;
            };
            nextOrgId =
              orgData.activeOrgId
              ?? orgData.orgs?.find((org) => org.active)?.id
              ?? orgData.orgs?.[0]?.id
              ?? 'default';
          }
        } catch {
          // Fall back to default org key for localStorage.
        }

        const res = await fetch('/api/aiva/workers');
        if (!res.ok) {
          if (!cancelled) {
            setOrgId(nextOrgId);
            setWorkers([]);
            setFeaturedWorkerId(null);
          }
          return;
        }
        const body = (await res.json().catch(() => ({}))) as {
          workers?: WorkerRow[];
        };
        const nextWorkers = Array.isArray(body.workers) ? body.workers : [];
        const storedId = readStoredFeaturedWorkerId(nextOrgId);
        const featured = pickFeaturedWorker(nextWorkers, storedId);
        if (!cancelled) {
          setOrgId(nextOrgId);
          setWorkers(nextWorkers);
          setFeaturedWorkerId(featured?.id ?? null);
          if (featured && storedId !== featured.id) {
            writeStoredFeaturedWorkerId(nextOrgId, featured.id);
          }
        }
      } catch {
        if (!cancelled) {
          setWorkers([]);
          setFeaturedWorkerId(null);
        }
      } finally {
        if (!cancelled) setLoadingWorkers(false);
      }
    }

    void load();

    function onOrgChanged() {
      void load();
    }
    window.addEventListener('aiva-org-changed', onOrgChanged);
    return () => {
      cancelled = true;
      window.removeEventListener('aiva-org-changed', onOrgChanged);
    };
  }, []);

  const featuredWorker = useMemo(
    () => pickFeaturedWorker(workers, featuredWorkerId),
    [workers, featuredWorkerId],
  );

  const activeWorkers = workers.filter((w) => w.status === 'active').length;
  const totalWorkers = workers.length;
  const showWorkerSwitcher = workers.length > 1;

  function selectFeaturedWorker(workerId: string) {
    setFeaturedWorkerId(workerId);
    writeStoredFeaturedWorkerId(orgId, workerId);
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
          Aiva home
        </p>
        <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">
          Workspace overview
        </h1>
        <p className="max-w-2xl text-sm text-text-secondary">
          Live status for your AI team. Hire is available when you need another worker.
        </p>
      </header>

      {featuredWorker ? (
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {showWorkerSwitcher ? (
              <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-text-muted">
                <span className="shrink-0 font-semibold uppercase tracking-wide">
                  Email for
                </span>
                <select
                  className={cn(AIVA_INPUT_CLASS, 'max-w-xs py-1.5 text-sm')}
                  value={featuredWorker.id}
                  onChange={(event) => selectFeaturedWorker(event.target.value)}
                  aria-label="Choose which Aiva email to show"
                >
                  {workers.map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.name?.trim() || 'Aiva'}
                      {worker.status && worker.status !== 'active'
                        ? ` (${worker.status})`
                        : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Email {featuredWorker.name ?? 'your Aiva'}
              </h2>
            )}
            <Link
              href={`/aiva/workers/${featuredWorker.id}`}
              className="shrink-0 text-xs font-medium text-accent hover:underline"
            >
              Open worker
            </Link>
          </div>
          <AivaHostedEmailCard
            key={featuredWorker.id}
            workerId={featuredWorker.id}
            workerName={featuredWorker.name}
            emphasize
          />
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <MetricChip
          label="Workers"
          value={loadingWorkers ? '…' : String(totalWorkers)}
          href="/aiva/workers"
        />
        <MetricChip
          label="Active"
          value={loadingWorkers ? '…' : String(activeWorkers)}
          href="/aiva/workers"
        />
        <MetricChip
          label="Approvals"
          value={String(pendingApprovals)}
          href="/aiva/approvals"
          emphasize={pendingApprovals > 0}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Jump to
        </h2>
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-elevated">
          {SHORTCUTS.map((item) => {
            const Icon = item.icon;
            const badge =
              item.href === '/aiva/approvals' && pendingApprovals > 0
                ? pendingApprovals
                : null;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-overlay/40"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-dim text-accent">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-text-primary">
                    {item.label}
                  </span>
                  <span className="block text-xs text-text-muted">{item.description}</span>
                </span>
                {badge !== null ? (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">
                    {badge > 99 ? '99+' : badge}
                  </span>
                ) : null}
                <ArrowRight className="h-3.5 w-3.5 text-text-muted" aria-hidden />
              </Link>
            );
          })}
        </div>
      </section>

      <p className="text-xs text-text-muted">
        Need another Aiva?{' '}
        <Link
          href="/aiva/hire"
          className="inline-flex items-center font-semibold text-accent underline-offset-2 hover:underline"
        >
          <Plus className="mr-0.5 inline h-3 w-3" aria-hidden />
          Hire AI Worker
        </Link>
        {' '}(usually only during setup).
      </p>
    </div>
  );
}

function MetricChip({
  label,
  value,
  href,
  emphasize,
}: {
  label: string;
  value: string;
  href: string;
  emphasize?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        'rounded-xl border px-3 py-2.5 transition-colors',
        emphasize
          ? 'border-accent/40 bg-accent/10 hover:bg-accent/15'
          : 'border-border bg-elevated hover:bg-overlay/30',
      ].join(' ')}
    >
      <p className="text-[10px] uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-text-primary">{value}</p>
    </Link>
  );
}
