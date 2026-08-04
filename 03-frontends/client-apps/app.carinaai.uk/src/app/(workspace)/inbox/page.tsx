'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Inbox, RefreshCw } from 'lucide-react';
import { OriginBadge } from '@/components/ui/OriginBadge';
import { OriginFilterChips } from '@/components/ui/OriginFilterChips';
import {
  DEFAULT_PAGE_SIZE,
  ListPager,
  slicePage,
  totalPagesFor,
} from '@/components/ui/ListPager';
import { Spinner } from '@/components/ui/Spinner';
import {
  INBOX_ORIGIN_HELPER_TEXT,
  claimInboxItemKeepsProvenance,
  classifyInboxOrigin,
  matchesOriginFilter,
  type OriginFilter,
  type SyncOrigin,
} from '@/lib/sync-ownership';
import { cn } from '@/lib/utils';

type InboxItem = {
  id: string;
  title: string;
  detail: string;
  kind: 'approval' | 'drive_drop' | 'reminder';
  origin: SyncOrigin;
  aivaManaged: boolean;
  href?: string;
  claimedByAivaAt?: string | null;
};

const CLAIM_STORAGE_KEY = 'aiva.inbox.claimed';

type ApprovalApiItem = {
  id: string;
  subject: string;
  recipient: string;
  category: string;
  requestedAt: string;
};

export default function InboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [originFilter, setOriginFilter] = useState<OriginFilter>('all');
  const [page, setPage] = useState(1);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const loadClaimed = useCallback((): Record<string, string> => {
    try {
      const raw = localStorage.getItem(CLAIM_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, string>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }, []);

  const persistClaimed = useCallback((next: Record<string, string>) => {
    try {
      localStorage.setItem(CLAIM_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const claimed = loadClaimed();
    const next: InboxItem[] = [];

    try {
      const res = await fetch('/api/aiva/email/approvals/inbox');
      if (res.ok) {
        const body = (await res.json()) as { approvals?: ApprovalApiItem[] };
        for (const approval of body.approvals ?? []) {
          next.push({
            id: `approval-${approval.id}`,
            title: approval.subject || 'Email draft approval',
            detail: `To ${approval.recipient} · ${approval.category}`,
            kind: 'approval',
            origin: 'aiva',
            aivaManaged: true,
            href: '/aiva/approvals',
          });
        }
      }
    } catch {
      /* approvals optional when core is down */
    }

    // Drive Inbox-for-Aiva drops: provenance google until claimed for Aiva processing.
    // Placeholder entries appear when claimed map has keys or as empty google queue hint.
    for (const [id, claimedAt] of Object.entries(claimed)) {
      if (!id.startsWith('drive-drop-')) continue;
      const provenance = claimInboxItemKeepsProvenance('google');
      next.push({
        id,
        title: 'Claimed Drive inbox drop',
        detail: `Claimed for Aiva processing at ${new Date(claimedAt).toLocaleString()}`,
        kind: 'drive_drop',
        origin: provenance.origin,
        aivaManaged: provenance.aivaManaged,
        claimedByAivaAt: claimedAt,
      });
    }

    // Demo google drop for filter QA when none claimed (safe; does not delete Drive objects).
    if (!next.some((item) => item.kind === 'drive_drop' && !item.claimedByAivaAt)) {
      next.push({
        id: 'drive-drop-sample',
        title: 'Drive Inbox-for-Aiva drop',
        detail: 'Files dropped into Ops Inbox stay Google-origin until you claim them for Aiva. Clearing inbox does not delete Drive files.',
        kind: 'drive_drop',
        origin: classifyInboxOrigin({ kind: 'drive_drop' }),
        aivaManaged: false,
      });
    }

    setItems(next);
    setLoading(false);
  }, [loadClaimed]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => items.filter((item) => matchesOriginFilter(item, originFilter)),
    [items, originFilter],
  );

  useEffect(() => {
    setPage(1);
  }, [originFilter]);

  const totalPages = totalPagesFor(filtered.length, DEFAULT_PAGE_SIZE);
  const pageItems = useMemo(
    () => slicePage(filtered, page, DEFAULT_PAGE_SIZE),
    [filtered, page],
  );

  async function syncNow() {
    setSyncing(true);
    await load();
    setLastSyncedAt(new Date().toISOString());
    setSyncing(false);
  }

  function claimItem(item: InboxItem) {
    if (item.origin !== 'google' || item.aivaManaged) return;
    const stamp = new Date().toISOString();
    const claimed = loadClaimed();
    claimed[item.id] = stamp;
    persistClaimed(claimed);
    const provenance = claimInboxItemKeepsProvenance(item.origin);
    setItems((current) =>
      current.map((row) =>
        row.id === item.id
          ? {
              ...row,
              origin: provenance.origin,
              aivaManaged: provenance.aivaManaged,
              claimedByAivaAt: stamp,
              detail: `Claimed for Aiva processing at ${new Date(stamp).toLocaleString()}. Google object was not deleted.`,
            }
          : row,
      ),
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Inbox</h1>
          <p className="text-xs text-text-muted">{INBOX_ORIGIN_HELPER_TEXT}</p>
          <p className="mt-1 text-xs text-text-muted">
            Full approval actions live in{' '}
            <Link href="/aiva/approvals" className="text-accent hover:underline">
              Approvals
            </Link>
            .
          </p>
          {lastSyncedAt ? (
            <p className="mt-0.5 text-[10px] text-text-muted">
              Last synced {new Date(lastSyncedAt).toLocaleString()}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void syncNow()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-text-secondary hover:bg-elevated"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', syncing && 'animate-spin')} />
          Sync now
        </button>
      </header>

      <div className="border-b border-border px-6 py-2">
        <OriginFilterChips value={originFilter} onChange={setOriginFilter} />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-border px-6 py-12 text-center">
            <Inbox className="mx-auto h-8 w-8 text-text-muted" />
            <p className="mt-3 text-sm font-medium text-text-primary">Inbox is clear</p>
            <p className="mt-1 text-xs text-text-muted">
              Approvals and Drive drops for this origin filter will show here.
            </p>
          </div>
        ) : (
          <div>
            <ul className="space-y-2">
              {pageItems.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-text-primary">{item.title}</p>
                      <OriginBadge origin={item.origin} />
                      {item.aivaManaged ? (
                        <span className="rounded-full bg-accent-dim px-2 py-0.5 text-[10px] font-medium text-accent">
                          Aiva managed
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-text-muted">{item.detail}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="rounded-md border border-border px-2.5 py-1 text-xs text-text-secondary hover:bg-elevated"
                      >
                        Open
                      </Link>
                    ) : null}
                    {item.origin === 'google' && !item.aivaManaged ? (
                      <button
                        type="button"
                        onClick={() => claimItem(item)}
                        className="rounded-md bg-accent px-2.5 py-1 text-xs text-white"
                      >
                        Claim for Aiva
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            <ListPager
              page={page}
              totalPages={totalPages}
              totalItems={filtered.length}
              onChangePage={setPage}
              disabled={loading}
            />
          </div>
        )}
      </div>
    </div>
  );
}
