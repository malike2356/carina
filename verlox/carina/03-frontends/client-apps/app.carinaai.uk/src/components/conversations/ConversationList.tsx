'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChannelIcon } from '@/components/aiva/ChannelIcon';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useInfiniteScroll } from '@/lib/use-infinite-scroll';
import { cn } from '@/lib/utils';

export type ConversationRow = {
  id: string;
  contactId: string;
  channel: string;
  worker: { id: string; name: string };
  lastMessageAt: string | null;
  lastMessagePreview: string;
  messageCount: number;
  status: string;
  hasEscalation?: boolean;
};

type WorkerOption = { id: string; name: string };

const CHANNEL_OPTIONS = [
  { value: '', label: 'All channels' },
  { value: 'web', label: 'Web' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
];

function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const delta = Date.now() - new Date(iso).getTime();
  if (delta < 60_000) return 'just now';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

function ConversationCard({
  conv,
  selected,
  onClick,
}: {
  conv: ConversationRow;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
      className={cn(
        'flex cursor-pointer gap-3 border-b border-border py-3 transition-colors',
        selected
          ? 'border-l-2 border-accent bg-elevated pl-[14px] pr-4'
          : 'border-l-2 border-transparent pl-4 pr-4 hover:bg-elevated',
      )}
    >
      <div className="mt-0.5 shrink-0">
        <ChannelIcon channel={conv.channel} className="h-4 w-4 text-text-muted" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center justify-between">
          <p className="truncate text-xs font-medium text-text-primary">{conv.contactId}</p>
          <p className="ml-2 shrink-0 text-[10px] text-text-muted">{timeAgo(conv.lastMessageAt)}</p>
        </div>
        <p className="mb-1.5 truncate text-[11px] text-text-muted">
          {conv.lastMessagePreview || 'No preview'}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-accent-dim px-1.5 py-0.5 text-[10px] text-accent">
            {conv.worker.name}
          </span>
          {conv.hasEscalation || conv.status === 'escalated' ? (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-400">
              Escalated
            </span>
          ) : null}
          {conv.status === 'automated' ? (
            <span className="rounded bg-accent-dim/60 px-1.5 py-0.5 text-[10px] text-text-muted">
              Auto
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ConversationList({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { push } = useToast();
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [search, setSearch] = useState('');
  const [workerFilter, setWorkerFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const debouncedSearch = useDebouncedValue(search, 300);
  const { visibleItems, hasMore, sentinelRef } = useInfiniteScroll(rows, 25);

  useEffect(() => {
    void fetch('/api/aiva/workers')
      .then((res) => (res.ok ? res.json() : { workers: [] }))
      .then((data: { workers?: WorkerOption[] }) => setWorkers(data.workers ?? []))
      .catch(() => setWorkers([]));
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
    if (workerFilter) params.set('workerId', workerFilter);
    if (channelFilter) params.set('channel', channelFilter);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [debouncedSearch, workerFilter, channelFilter]);

  useEffect(() => {
    setLoading(true);
    void fetch(`/api/conversations${queryString}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load conversations');
        return res.json();
      })
      .then((data: { conversations?: ConversationRow[] }) => {
        setRows(data.conversations ?? []);
      })
      .catch(() => {
        push('Could not load conversations', 'error');
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [queryString, push]);

  return (
    <aside className="flex h-full flex-col overflow-hidden border-r border-border bg-base">
      <div className="shrink-0 space-y-2 border-b border-border px-4 py-3">
        <input
          type="search"
          placeholder="Search conversations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent"
        />
        <div className="flex gap-2">
          <select
            value={workerFilter}
            onChange={(e) => setWorkerFilter(e.target.value)}
            aria-label="Filter by Aiva"
            className="min-w-0 flex-1 rounded-lg border border-border bg-elevated px-2 py-1.5 text-xs text-text-primary"
          >
            <option value="">All Aivas</option>
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.name}
              </option>
            ))}
          </select>
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            aria-label="Filter by channel"
            className="min-w-0 flex-1 rounded-lg border border-border bg-elevated px-2 py-1.5 text-xs text-text-primary"
          >
            {CHANNEL_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? <ListSkeleton rows={8} /> : null}
        {!loading && rows.length === 0 ? (
          <p className="p-4 text-xs text-text-muted">No conversations yet.</p>
        ) : null}
        {!loading
          ? visibleItems.map((row) => (
              <ConversationCard
                key={row.id}
                conv={row}
                selected={row.id === selectedId}
                onClick={() => onSelect(row.id)}
              />
            ))
          : null}
        {!loading && hasMore ? <div ref={sentinelRef} className="py-2" aria-hidden /> : null}
      </div>
    </aside>
  );
}
