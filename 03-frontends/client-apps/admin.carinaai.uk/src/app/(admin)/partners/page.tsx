'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useDebouncedValue } from '@/lib/use-debounced-value';

type StatusFilter = '' | 'active' | 'suspended' | 'archived';

interface PartnerRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  commercialTier: string;
  keyCount: number;
  clientOrgCount: number;
  eventsThisMonth: number;
  createdAt: string;
}

interface ListResponse {
  partners: PartnerRow[];
  total: number;
  page: number;
  limit: number;
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'active' ? 'bg-green-100 text-green-800'
    : status === 'suspended' ? 'bg-amber-100 text-amber-800'
    : 'bg-elevated text-text-secondary';
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {status}
    </span>
  );
}

export default function PartnersPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 300);

  const load = useCallback(async (q: string, s: StatusFilter, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '25' });
      if (s) params.set('status', s);
      if (q) params.set('search', q);
      const res = await fetch(`/api/admin/partners?${params.toString()}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(debouncedSearch, statusFilter, page);
  }, [load, debouncedSearch, statusFilter, page]);

  function changeFilter(s: StatusFilter) {
    setStatusFilter(s);
    setPage(1);
  }

  const partners = data?.partners ?? [];
  const total = data?.total ?? 0;
  const limit = data?.limit ?? 25;

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-lg font-semibold text-text-primary">Partners</h1>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name or slug..."
          className="rounded-md border border-border bg-elevated px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
        />
        <div className="flex gap-1">
          {(['', 'active', 'suspended', 'archived'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => changeFilter(s)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-accent-primary text-white'
                  : 'border border-border text-text-secondary hover:text-text-primary'
              }`}
            >
              {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading...</p>
      ) : partners.length === 0 ? (
        <p className="text-sm text-text-muted">No partners found.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-elevated/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Slug</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Tier</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">Keys</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">Client orgs</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">Events (mo.)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {partners.map((p) => (
                <tr key={p.id} className="bg-surface transition-colors hover:bg-elevated/30">
                  <td className="px-4 py-3 font-medium text-text-primary">{p.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary">{p.slug}</td>
                  <td className="px-4 py-3 capitalize text-text-secondary">{p.commercialTier ?? '-'}</td>
                  <td className="px-4 py-3 text-right text-text-secondary">{p.keyCount}</td>
                  <td className="px-4 py-3 text-right text-text-secondary">{p.clientOrgCount}</td>
                  <td className="px-4 py-3 text-right text-text-secondary">{p.eventsThisMonth.toLocaleString()}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/partners/${p.id}`} className="text-xs text-accent-primary hover:underline">
                      View
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
