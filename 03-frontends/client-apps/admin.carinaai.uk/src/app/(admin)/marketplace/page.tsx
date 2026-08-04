'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { formatDate } from '@/lib/format';

type StatusTab = 'pending' | 'approved' | 'rejected' | 'published';

interface Submission {
  id: string;
  pack_name: string;
  version: string;
  author_handle: string;
  author_email: string;
  pricing_tier: string;
  status: string;
  submitted_at: string;
}

interface ListResponse {
  submissions: Submission[];
  total: number;
  page: number;
  limit: number;
}

const TABS: { key: StatusTab; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'published', label: 'Published' },
];

export default function MarketplacePage() {
  const [status, setStatus] = useState<StatusTab>('pending');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  const load = useCallback(async (s: StatusTab, p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/marketplace/submissions?status=${s}&page=${p}&limit=20`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPendingCount = useCallback(async () => {
    const res = await fetch('/api/admin/marketplace/submissions?status=pending&limit=1');
    if (res.ok) {
      const d = await res.json() as ListResponse;
      setPendingCount(d.total);
    }
  }, []);

  useEffect(() => { void load(status, page); }, [load, status, page]);
  useEffect(() => { void loadPendingCount(); }, [loadPendingCount]);

  function changeTab(t: StatusTab) {
    setStatus(t);
    setPage(1);
  }

  const submissions = data?.submissions ?? [];
  const total = data?.total ?? 0;
  const limit = data?.limit ?? 20;

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-lg font-semibold text-text-primary">Marketplace Submissions</h1>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => changeTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
              status === tab.key
                ? 'border-b-2 border-accent-primary text-text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
            {tab.key === 'pending' && pendingCount != null && pendingCount > 0 && (
              <span className="rounded-full bg-accent-primary px-1.5 py-0.5 text-xs text-white">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading...</p>
      ) : submissions.length === 0 ? (
        <p className="text-sm text-text-muted">No {status} submissions.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-elevated/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Pack name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Version</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Author</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Submitted</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Pricing</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {submissions.map((s) => (
                <tr key={s.id} className="bg-surface transition-colors hover:bg-elevated/30">
                  <td className="px-4 py-3 font-medium text-text-primary">{s.pack_name}</td>
                  <td className="px-4 py-3 text-text-secondary">{s.version}</td>
                  <td className="px-4 py-3 text-text-secondary">{s.author_handle}</td>
                  <td className="px-4 py-3 text-text-secondary">{formatDate(s.submitted_at)}</td>
                  <td className="px-4 py-3 text-text-secondary capitalize">{s.pricing_tier}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/marketplace/${s.id}`} className="text-xs text-accent-primary hover:underline">
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > limit && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-xs text-text-muted">
            Page {page} of {Math.ceil(total / limit)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(total / limit)}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
