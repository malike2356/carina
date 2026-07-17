'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  PlanStatusBadge,
  SignalCell,
  rowClass,
} from '@/components/customers/CustomerBadges';
import { ProvisionCustomerModal } from '@/components/customers/ProvisionCustomerModal';
import {
  DeleteCustomerModal,
  type DeleteCustomerTarget,
} from '@/components/customers/DeleteCustomerModal';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { timeAgo } from '@/lib/format';

interface WorkspaceRow {
  workspaceId: string;
  name: string;
  ownerEmail: string | null;
  planTier: string;
  subscriptionStatus: string;
  trialDaysRemaining?: number | null;
  aivasUsed: number;
  slotLimit: number;
  monthlyAmountPence: number;
  lastActiveAt: string | null;
  criticalSignalCount: number;
  warnSignalCount: number;
  messageCount?: number;
  messageLimit?: number | null;
  usagePercent?: number | null;
}

function usageLabel(ws: WorkspaceRow): string {
  const count = ws.messageCount ?? 0;
  if (!ws.messageLimit) return count.toLocaleString();
  const pct = ws.usagePercent ?? Math.min(100, Math.round((count / ws.messageLimit) * 100));
  return `${count.toLocaleString()}/${ws.messageLimit.toLocaleString()} (${pct}%)`;
}

function usageClass(ws: WorkspaceRow): string {
  if (!ws.messageLimit) return 'text-text-secondary';
  const pct = ws.usagePercent ?? Math.min(100, Math.round(((ws.messageCount ?? 0) / ws.messageLimit) * 100));
  if (pct >= 85) return 'text-danger';
  if (pct >= 60) return 'text-amber-500';
  return 'text-text-secondary';
}

interface WorkspacesResponse {
  workspaces?: WorkspaceRow[];
  total?: number;
  page?: number;
  limit?: number;
  error?: string;
}

export default function CustomersPage() {
  const [data, setData] = useState<WorkspacesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState('created_at_desc');
  const [page, setPage] = useState(1);
  const [showProvision, setShowProvision] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteCustomerTarget | null>(null);
  const debouncedSearch = useDebouncedValue(search, 300);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '50');
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (planFilter !== 'all') params.set('plan', planFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (sort) params.set('sort', sort);

      const res = await fetch(`/api/admin/workspaces?${params.toString()}`);
      const body = (await res.json()) as WorkspacesResponse;
      if (!res.ok) throw new Error(body.error ?? 'Failed to load workspaces');
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspaces');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, planFilter, statusFilter, sort, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, planFilter, statusFilter, sort]);

  const workspaces = data?.workspaces ?? [];
  const total = data?.total ?? 0;
  const limit = data?.limit ?? 50;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Customers</h1>
          <p className="mt-0.5 text-sm text-text-muted">{total} workspaces</p>
        </div>
        <button
          type="button"
          onClick={() => setShowProvision(true)}
          className="btn-admin-primary text-sm"
        >
          Provision customer
        </button>
      </div>

      <div className="mb-4 grid grid-cols-[minmax(14rem,2fr)_repeat(3,minmax(9rem,1fr))] items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Workspace name or email..."
          className="admin-input w-full"
        />
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="admin-input w-full text-sm"
        >
          <option value="all">All plans</option>
          <option value="trial">Trial</option>
          <option value="starter">Starter</option>
          <option value="team">Team</option>
          <option value="business">Business</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="admin-input w-full text-sm"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="at_risk">At risk</option>
          <option value="suspended">Suspended</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="admin-input w-full text-sm"
        >
          <option value="created_at_desc">Latest</option>
          <option value="last_active_desc">Last active</option>
          <option value="mrr_desc">MRR</option>
        </select>
      </div>

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
      {loading ? <TableSkeleton rows={8} cols={8} /> : null}

      {!loading && !error ? (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-overlay text-xs text-text-muted">
                <th className="px-4 py-2.5 text-left font-medium">Workspace</th>
                <th className="px-4 py-2.5 text-left font-medium">Owner</th>
                <th className="px-4 py-2.5 text-left font-medium">Plan / Status</th>
                <th className="px-4 py-2.5 text-left font-medium">Aivas</th>
                <th className="px-4 py-2.5 text-left font-medium">Usage</th>
                <th className="px-4 py-2.5 text-left font-medium">MRR</th>
                <th className="px-4 py-2.5 text-left font-medium">Last active</th>
                <th className="px-4 py-2.5 text-left font-medium">Signals 7d</th>
                <th className="px-4 py-2.5 text-left font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {workspaces.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-text-muted">
                    No workspaces found.
                  </td>
                </tr>
              ) : (
                workspaces.map((ws) => (
                  <tr key={ws.workspaceId} className={`hover:bg-overlay/50 ${rowClass(ws)}`}>
                    <td className="px-4 py-3 font-medium text-text-primary">{ws.name}</td>
                    <td className="px-4 py-3 text-text-secondary">{ws.ownerEmail ?? '-'}</td>
                    <td className="px-4 py-3">
                      <PlanStatusBadge
                        ws={{
                          planTier: ws.planTier,
                          subscriptionStatus: ws.subscriptionStatus,
                          trialDaysRemaining: ws.trialDaysRemaining,
                        }}
                      />
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {ws.aivasUsed}/{ws.slotLimit}
                    </td>
                    <td className={`px-4 py-3 ${usageClass(ws)}`}>
                      {usageLabel(ws)}
                    </td>
                    <td
                      className={`px-4 py-3 ${
                        ws.subscriptionStatus === 'past_due' ? 'text-red-400' : 'text-text-secondary'
                      }`}
                    >
                      {ws.monthlyAmountPence === 0
                        ? '-'
                        : `GBP ${(ws.monthlyAmountPence / 100).toFixed(0)}`}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{timeAgo(ws.lastActiveAt)}</td>
                    <td className="px-4 py-3">
                      <SignalCell
                        criticalSignalCount={ws.criticalSignalCount}
                        warnSignalCount={ws.warnSignalCount}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/customers/${ws.workspaceId}`}
                          className="text-xs text-accent hover:underline"
                        >
                          View
                        </Link>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget({
                              workspaceId: ws.workspaceId,
                              name: ws.name,
                              ownerEmail: ws.ownerEmail,
                              subscriptionStatus: ws.subscriptionStatus,
                              monthlyAmountPence: ws.monthlyAmountPence,
                            })
                          }
                          className="text-xs text-danger hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && total > limit ? (
        <div className="mt-4 flex items-center justify-between text-xs text-text-muted">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-border px-2 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-border px-2 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      <ProvisionCustomerModal
        open={showProvision}
        onClose={() => setShowProvision(false)}
        onProvisioned={() => void load()}
      />
      <DeleteCustomerModal
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => void load()}
      />
    </div>
  );
}
