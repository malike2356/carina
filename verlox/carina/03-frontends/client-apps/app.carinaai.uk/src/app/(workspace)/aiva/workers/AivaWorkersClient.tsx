'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, Plus, Search } from 'lucide-react';
import { AivaAvatar } from '@/components/aiva/AivaAvatar';
import { AivaCard } from '@/components/aiva/AivaCard';
import { ChannelIcons } from '@/components/aiva/ChannelIcon';
import { DowngradeConflictScreen } from '@/components/aiva/DowngradeConflictScreen';
import { StatusChip } from '@/components/aiva/StatusChip';
import {
  MobileEmptyState,
  MobileList,
  MobileListRow,
  MobileScreen,
  MobileSkeleton,
} from '@/components/aiva/mobile';
import { useToast } from '@/components/ui/Toast';
import { useRelativeTimeLabel } from '@/hooks/useRelativeTimeLabel';
import type { AivaWorker } from '@/lib/aiva-types';
import { useDebouncedValue } from '@/lib/use-debounced-value';

function WorkerListRow({
  worker,
}: {
  worker: AivaWorker;
}) {
  const lastActiveLabel = useRelativeTimeLabel(worker.lastActiveAt ?? null);
  const desc =
    worker.roleDescription.length > 72
      ? `${worker.roleDescription.slice(0, 72)}...`
      : worker.roleDescription;

  return (
    <MobileListRow
      href={`/aiva/workers/${worker.id}`}
      leading={<AivaAvatar name={worker.name} />}
      title={worker.name}
      subtitle={
        <span className="flex flex-col gap-1">
          <span>{desc}</span>
          <span className="flex items-center gap-2">
            <ChannelIcons channels={worker.channels} />
            <span>
              {worker.messagesToday ?? 0} msgs today · {lastActiveLabel}
            </span>
          </span>
        </span>
      }
      trailing={<StatusChip status={worker.status} trialDaysLeft={worker.trialDaysLeft} />}
    />
  );
}

export function AivaWorkersClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { push } = useToast();
  const [workers, setWorkers] = useState<AivaWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [billing, setBilling] = useState<Record<string, unknown> | null>(null);
  const debouncedSearch = useDebouncedValue(search, 300);

  const loadWorkers = useCallback(async () => {
    setLoading(true);
    try {
      const [workersRes, billingRes] = await Promise.all([
        fetch('/api/aiva/workers'),
        fetch('/api/aiva/billing/status'),
      ]);
      if (!workersRes.ok) {
        push('Could not load Aivas', 'error');
        setWorkers([]);
        return;
      }
      const data = (await workersRes.json()) as { workers?: AivaWorker[] };
      setWorkers(data.workers ?? []);
      if (billingRes.ok) {
        setBilling((await billingRes.json()) as Record<string, unknown>);
      }
    } catch {
      push('Could not load Aivas', 'error');
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    void loadWorkers();
  }, [loadWorkers]);

  useEffect(() => {
    const connected = searchParams.get('channel_connected');
    const channelError = searchParams.get('channel_error');
    if (!connected && !channelError) return;

    if (connected === 'gmail' || connected === 'outlook') {
      push(`${connected === 'gmail' ? 'Gmail' : 'Outlook'} connected successfully`, 'success');
      void loadWorkers();
    } else if (channelError) {
      push(`Email connection failed: ${channelError}`, 'error');
    }

    const next = new URL(window.location.href);
    next.searchParams.delete('channel_connected');
    next.searchParams.delete('channel_error');
    router.replace(`${next.pathname}${next.search}`);
  }, [loadWorkers, push, router, searchParams]);

  const filteredWorkers = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.roleDescription?.toLowerCase().includes(q) ||
        w.status.toLowerCase().includes(q),
    );
  }, [workers, debouncedSearch]);

  function handleStatusChange(id: string, status: string) {
    setWorkers((prev) =>
      prev.map((w) => (w.id === id ? { ...w, status: status as AivaWorker['status'] } : w)),
    );
  }

  const pendingConflict = Boolean(billing?.pendingDowngradeConflict);
  const pendingTier = String(billing?.pendingDowngradeTier ?? 'starter');
  const pendingSlotLimit = Number(billing?.pendingDowngradeSlotLimit ?? 1);
  const aivasUsed = Number(billing?.aivasUsed ?? workers.length);

  if (!loading && pendingConflict) {
    return (
      <DowngradeConflictScreen
        workers={workers}
        pendingDowngradeTier={pendingTier}
        pendingDowngradeSlotLimit={pendingSlotLimit}
        aivasUsed={aivasUsed}
        onResolved={() => {
          push('Your plan has been updated. Unselected Aivas have been paused.', 'success');
          void loadWorkers();
        }}
      />
    );
  }

  const hireAction = (
    <Link
      href="/aiva"
      className="btn-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium"
    >
      <Plus className="h-4 w-4" />
      Hire an Aiva
    </Link>
  );

  return (
    <MobileScreen
      title="AI Employees"
      subtitle={
        loading
          ? undefined
          : `${workers.length} AI Employee${workers.length !== 1 ? 's' : ''} configured`
      }
      primaryAction={<div className="hidden lg:block">{hireAction}</div>}
      hideTitleOnMobile
    >
      <div className="mb-4 lg:hidden">{hireAction}</div>

      {!loading && workers.length > 0 ? (
        <div className="relative mb-4 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Aivas..."
            className="min-h-11 w-full rounded-lg border border-border bg-base py-2.5 pl-9 pr-3 text-base lg:text-sm"
          />
        </div>
      ) : null}

      {loading ? <MobileSkeleton variant="list" rows={6} /> : null}

      {!loading && workers.length === 0 ? (
        <MobileEmptyState
          icon={<Bot className="h-12 w-12" />}
          title="No Aivas yet"
          description="Hire your first Aiva and it will appear here. Powered by Carina, with visible escalation when human review is needed."
          action={hireAction}
        />
      ) : null}

      {!loading && workers.length > 0 && filteredWorkers.length === 0 ? (
        <p className="text-sm text-text-muted">No Aivas match your search.</p>
      ) : null}

      {!loading && filteredWorkers.length > 0 ? (
        <>
          <div className="lg:hidden">
            <MobileList>
              {filteredWorkers.map((worker) => (
                <WorkerListRow key={worker.id} worker={worker} />
              ))}
            </MobileList>
          </div>
          <div className="hidden grid-cols-1 gap-4 md:grid-cols-2 lg:grid xl:grid-cols-3">
            {filteredWorkers.map((worker) => (
              <AivaCard key={worker.id} worker={worker} onStatusChange={handleStatusChange} />
            ))}
          </div>
        </>
      ) : null}
    </MobileScreen>
  );
}
