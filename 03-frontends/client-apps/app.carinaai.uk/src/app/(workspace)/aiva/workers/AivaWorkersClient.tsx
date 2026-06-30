'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, Plus, Search } from 'lucide-react';
import { AivaCard } from '@/components/aiva/AivaCard';
import { DowngradeConflictScreen } from '@/components/aiva/DowngradeConflictScreen';
import { CardGridSkeleton } from '@/components/ui/Skeleton';
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

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">AI Employees</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {loading
              ? 'Loading...'
              : `${workers.length} AI Employee${workers.length !== 1 ? 's' : ''} configured`}
          </p>
        </div>
        <Link href="/aiva" className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Hire an Aiva
        </Link>
      </div>

      {!loading && workers.length > 0 ? (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Aivas..."
            className="w-full rounded-lg border border-border bg-base py-2 pl-9 pr-3 text-sm"
          />
        </div>
      ) : null}

      {loading ? <CardGridSkeleton count={6} /> : null}

      {!loading && workers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Bot className="mb-4 h-12 w-12 text-text-muted" />
          <h2 className="text-lg font-medium text-text-primary">No Aivas yet</h2>
          <p className="mt-1 max-w-sm text-sm text-text-secondary">
            Hire your first Aiva and it will appear here. Powered by Carina. Backed by real humans when it matters.
          </p>
          <Link href="/aiva" className="btn-primary mt-6">
            Hire an Aiva
          </Link>
        </div>
      ) : null}

      {!loading && workers.length > 0 && filteredWorkers.length === 0 ? (
        <p className="text-sm text-text-muted">No Aivas match your search.</p>
      ) : null}

      {!loading && filteredWorkers.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredWorkers.map((worker) => (
            <AivaCard key={worker.id} worker={worker} onStatusChange={handleStatusChange} />
          ))}
        </div>
      ) : null}
    </>
  );
}
