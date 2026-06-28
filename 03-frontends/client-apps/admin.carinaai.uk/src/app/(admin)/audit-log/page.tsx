'use client';

import Link from 'next/link';
import { ChevronDown, ChevronUp, Download } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { AUDIT_ACTION_OPTIONS, humanAuditAction } from '@/lib/audit-labels';

interface AuditEntry {
  id: string;
  adminEmail: string;
  adminUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  ipAddress?: string | null;
  createdAt: string;
}

interface AuditResponse {
  entries?: AuditEntry[];
  total?: number;
  page?: number;
  limit?: number;
  admins?: Array<{ id: string; email: string }>;
  error?: string;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function targetHref(entry: AuditEntry): string {
  if (entry.targetType === 'workspace') return `/customers/${entry.targetId}`;
  const workspaceId = entry.metadata?.workspaceId;
  if (typeof workspaceId === 'string' && workspaceId) return `/customers/${workspaceId}`;
  return `/customers`;
}

function targetLabel(entry: AuditEntry): string {
  const workspaceName = entry.metadata?.workspaceName;
  if (typeof workspaceName === 'string' && workspaceName) return workspaceName;
  return entry.targetId.slice(0, 8);
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr className="border-b border-border hover:bg-overlay/40">
        <td className="whitespace-nowrap px-4 py-2.5 text-text-muted">
          {formatTimestamp(entry.createdAt)}
        </td>
        <td className="px-4 py-2.5 text-text-secondary">{entry.adminEmail}</td>
        <td className="px-4 py-2.5 text-text-primary">{humanAuditAction(entry.action)}</td>
        <td className="px-4 py-2.5">
          <Link href={targetHref(entry)} className="text-accent hover:underline">
            {targetLabel(entry)}
          </Link>
        </td>
        <td className="px-4 py-2.5 text-center">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="text-text-muted hover:text-text-primary"
            aria-label={expanded ? 'Collapse metadata' : 'Expand metadata'}
          >
            {expanded ? <ChevronUp className="mx-auto h-3.5 w-3.5" /> : <ChevronDown className="mx-auto h-3.5 w-3.5" />}
          </button>
        </td>
      </tr>
      {expanded ? (
        <tr className="border-b border-border bg-overlay">
          <td colSpan={5} className="px-4 py-3">
            <pre className="whitespace-pre-wrap font-mono text-[11px] text-text-secondary">
              {JSON.stringify(entry.metadata, null, 2)}
            </pre>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export default function AuditLogPage() {
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [admins, setAdmins] = useState<Array<{ id: string; email: string }>>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [adminFilter, setAdminFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [targetTypeFilter, setTargetTypeFilter] = useState('all');
  const [page, setPage] = useState(1);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '100');
    if (since) params.set('since', new Date(since).toISOString());
    if (until) {
      const end = new Date(until);
      end.setHours(23, 59, 59, 999);
      params.set('until', end.toISOString());
    }
    if (adminFilter !== 'all') params.set('adminUserId', adminFilter);
    if (actionFilter !== 'all') params.set('action', actionFilter);
    if (targetTypeFilter !== 'all') params.set('target_type', targetTypeFilter);
    return params.toString();
  }, [since, until, adminFilter, actionFilter, targetTypeFilter, page]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/audit-log?${queryString}`);
      const body = (await res.json()) as AuditResponse;
      if (!res.ok) throw new Error(body.error ?? 'Failed to load audit log');
      setRows(body.entries ?? []);
      setTotal(body.total ?? 0);
      if (body.admins?.length) setAdmins(body.admins);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [since, until, adminFilter, actionFilter, targetTypeFilter]);

  const exportHref = `/api/admin/audit-log?${queryString}&format=csv`;
  const totalPages = Math.max(1, Math.ceil(total / 100));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Audit Log</h1>
          <p className="mt-0.5 text-sm text-text-muted">{total} admin actions</p>
        </div>
        <a
          href={exportHref}
          className="flex items-center gap-1 text-xs text-accent hover:underline"
        >
          Export CSV
          <Download className="h-3 w-3" />
        </a>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-[11px] text-text-muted">Since</label>
          <input
            type="date"
            value={since}
            onChange={(e) => setSince(e.target.value)}
            className="admin-input w-auto text-xs"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-text-muted">Until</label>
          <input
            type="date"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            className="admin-input w-auto text-xs"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-text-muted">Admin</label>
          <select
            value={adminFilter}
            onChange={(e) => setAdminFilter(e.target.value)}
            className="admin-input w-auto text-xs"
          >
            <option value="all">All admins</option>
            {admins.map((admin) => (
              <option key={admin.id} value={admin.id}>
                {admin.email}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-text-muted">Action</label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="admin-input w-auto text-xs"
          >
            <option value="all">All actions</option>
            {AUDIT_ACTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-text-muted">Target type</label>
          <select
            value={targetTypeFilter}
            onChange={(e) => setTargetTypeFilter(e.target.value)}
            className="admin-input w-auto text-xs"
          >
            <option value="all">All types</option>
            <option value="workspace">Workspace</option>
            <option value="aiva">Aiva</option>
            <option value="escalation">Escalation</option>
            <option value="invoice">Invoice</option>
          </select>
        </div>
      </div>

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
      {loading ? <TableSkeleton rows={10} cols={5} /> : null}

      {!loading && !error ? (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-overlay text-text-muted">
                <th className="px-4 py-2.5 text-left font-medium">Time</th>
                <th className="px-4 py-2.5 text-left font-medium">Admin</th>
                <th className="px-4 py-2.5 text-left font-medium">Action</th>
                <th className="px-4 py-2.5 text-left font-medium">Target</th>
                <th className="w-8 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                    No audit entries match these filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => <AuditRow key={row.id} entry={row} />)
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && total > 100 ? (
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
    </div>
  );
}
