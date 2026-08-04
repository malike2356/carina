'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, Plus, Search } from 'lucide-react';
import { AivaHireDrawer } from '@/components/aiva/AivaHireDrawer';
import { AivaWorkerRow } from '@/components/aiva/AivaWorkerRow';
import { DowngradeConflictScreen } from '@/components/aiva/DowngradeConflictScreen';
import {
  MobileEmptyState,
  MobileScreen,
  MobileSkeleton,
} from '@/components/aiva/mobile';
import {
  DEFAULT_PAGE_SIZE,
  ListPager,
  slicePage,
  totalPagesFor,
} from '@/components/ui/ListPager';
import { useToast } from '@/components/ui/Toast';
import type { AivaWorker } from '@/lib/aiva-types';
import { useDebouncedValue } from '@/lib/use-debounced-value';

export function AivaWorkersClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { push } = useToast();
  const [workers, setWorkers] = useState<AivaWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [billing, setBilling] = useState<Record<string, unknown> | null>(null);
  const [hireOpen, setHireOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 300);

  const loadWorkers = useCallback(async () => {
    setLoading(true);
    try {
      const [workersRes, billingRes] = await Promise.all([
        fetch('/api/aiva/workers'),
        fetch('/api/aiva/billing/status'),
      ]);
      if (!workersRes.ok) {
        push('Could not load workers', 'error');
        setWorkers([]);
        return;
      }
      const data = (await workersRes.json()) as { workers?: AivaWorker[] };
      setWorkers(data.workers ?? []);
      if (billingRes.ok) {
        setBilling((await billingRes.json()) as Record<string, unknown>);
      }
    } catch {
      push('Could not load workers', 'error');
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    void loadWorkers();
  }, [loadWorkers]);

  useEffect(() => {
    const onOrg = () => void loadWorkers();
    window.addEventListener('aiva-org-changed', onOrg);
    return () => window.removeEventListener('aiva-org-changed', onOrg);
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
        w.name.toLowerCase().includes(q)
        || w.roleDescription?.toLowerCase().includes(q)
        || w.status.toLowerCase().includes(q),
    );
  }, [workers, debouncedSearch]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const totalPages = totalPagesFor(filteredWorkers.length, DEFAULT_PAGE_SIZE);
  const pageWorkers = useMemo(
    () => slicePage(filteredWorkers, page, DEFAULT_PAGE_SIZE),
    [filteredWorkers, page],
  );

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
          push('Your plan has been updated. Unselected workers have been paused.', 'success');
          void loadWorkers();
        }}
      />
    );
  }

  const hireAction = (
    <button
      type="button"
      onClick={() => setHireOpen(true)}
      className="btn-primary inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium"
    >
      <Plus className="h-4 w-4" aria-hidden />
      Hire Worker
    </button>
  );

  return (
    <MobileScreen
      title="AI Workers"
      subtitle={loading ? undefined : 'Manage and interact with your AI workforce'}
      primaryAction={<div className="hidden lg:block">{hireAction}</div>}
      hideTitleOnMobile
    >
      {!loading && workers.length > 0 ? (
        <div className="relative mb-5 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workers by name..."
            className="min-h-10 w-full rounded-lg border border-border bg-base py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted"
          />
        </div>
      ) : null}

      {loading ? <MobileSkeleton variant="list" rows={4} /> : null}

      {!loading && workers.length === 0 ? (
        <MobileEmptyState
          icon={<Bot className="h-12 w-12 text-text-muted" />}
          title="No AI workers yet"
          description="Hire your first Aiva to handle customer and admin work. Optional human assist is available on request if something unusual comes up."
          action={hireAction}
        />
      ) : null}

      {!loading && workers.length > 0 && filteredWorkers.length === 0 ? (
        <p className="text-sm text-text-muted">No workers match your search.</p>
      ) : null}

      {!loading && filteredWorkers.length > 0 ? (
        <div className="flex flex-col gap-3">
          {pageWorkers.map((worker) => (
            <AivaWorkerRow key={worker.id} worker={worker} />
          ))}
          <ListPager
            page={page}
            totalPages={totalPages}
            totalItems={filteredWorkers.length}
            onChangePage={setPage}
            disabled={loading}
          />
        </div>
      ) : null}

      <AivaHireDrawer
        open={hireOpen}
        onClose={() => setHireOpen(false)}
        onHired={(workerId) => router.push(`/aiva/workers/${workerId}?tab=work`)}
      />
    </MobileScreen>
  );
}
