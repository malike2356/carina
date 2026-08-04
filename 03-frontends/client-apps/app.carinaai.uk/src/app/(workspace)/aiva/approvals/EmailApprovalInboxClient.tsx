'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_PAGE_SIZE,
  ListPager,
  slicePage,
  totalPagesFor,
} from '@/components/ui/ListPager';
import { useToast } from '@/components/ui/Toast';
import { GovernanceSidebarCard } from '@/components/aiva/GovernanceSidebarCard';

type ApprovalItem = {
  id: string;
  workerId: string;
  category: string;
  recipient: string;
  subject: string;
  draftBody: string;
  requestedAt: string;
  timeoutAt: string;
};

export function EmailApprovalInboxClient({ embedded = false }: { embedded?: boolean }) {
  const { push } = useToast();
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (opts?.silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch('/api/aiva/email/approvals/inbox');
      if (!res.ok) {
        if (!opts?.silent) push('Could not load approval inbox', 'error');
        return;
      }
      const body = (await res.json()) as { approvals?: ApprovalItem[] };
      setApprovals(body.approvals ?? []);
      if (!opts?.silent) setPage(1);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [push]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load({ silent: true }), 15_000);
    return () => window.clearInterval(id);
  }, [load]);

  async function approve(id: string, modifiedBody?: string) {
    const res = await fetch(`/api/aiva/email/approvals/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(modifiedBody ? { modifiedBody } : {}),
    });
    if (!res.ok) {
      push('Approve failed', 'error');
      return;
    }
    push('Email approved and sent', 'success');
    setEditingId(null);
    void load({ silent: true });
  }

  async function reject(id: string) {
    const res = await fetch(`/api/aiva/email/approvals/${id}/reject`, { method: 'POST' });
    if (!res.ok) {
      push('Reject failed', 'error');
      return;
    }
    push('Draft rejected', 'success');
    void load({ silent: true });
  }

  const totalPages = totalPagesFor(approvals.length, DEFAULT_PAGE_SIZE);
  const pageApprovals = useMemo(
    () => slicePage(approvals, page, DEFAULT_PAGE_SIZE),
    [approvals, page],
  );

  return (
    <div className={embedded ? 'space-y-6' : 'mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8'}>
      {!embedded ? (
        <div>
          <h1 className="text-2xl font-semibold">Email approval inbox</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Review AI Employee email drafts before they are sent. Unreviewed drafts expire after 4
            hours. Turn on &quot;Require approval before sending&quot; in the policy card above.
            Add @emails or @domains there to auto-send selected inbound replies without waiting here.
          </p>
        </div>
      ) : null}

      <GovernanceSidebarCard />

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-text-muted">
          {refreshing ? 'Refreshing...' : 'Live inbox; refreshes every 15s'}
        </p>
        <button
          type="button"
          className="btn-secondary text-xs"
          disabled={loading || refreshing}
          onClick={() => void load()}
        >
          Refresh
        </button>
      </div>

      {loading ? <p className="text-sm text-text-muted">Loading...</p> : null}

      {!loading && approvals.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-6 text-sm text-text-secondary">
          No pending approvals. Connect an Email Handler AI Employee and wait for client query emails.
        </p>
      ) : null}

      <div className="space-y-4">
        {pageApprovals.map((item) => (
          <article key={item.id} className="rounded-lg border border-border bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-text-primary">{item.subject}</p>
                <p className="text-xs text-text-secondary">
                  To: {item.recipient} | {item.category}
                </p>
              </div>
              <p className="text-xs text-text-muted">
                Timeout: {new Date(item.timeoutAt).toLocaleString('en-GB')}
              </p>
            </div>
            {editingId === item.id ? (
              <textarea
                className="mt-3 w-full rounded border border-border bg-base p-3 text-sm"
                rows={8}
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
              />
            ) : (
              <pre className="mt-3 whitespace-pre-wrap rounded bg-base p-3 text-sm text-text-primary">
                {item.draftBody}
              </pre>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-primary text-sm" onClick={() => void approve(item.id)}>
                Approve
              </button>
              <button type="button" className="btn-secondary text-sm" onClick={() => void reject(item.id)}>
                Reject
              </button>
              {editingId === item.id ? (
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={() => void approve(item.id, editBody)}
                >
                  Approve edited draft
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={() => {
                    setEditingId(item.id);
                    setEditBody(item.draftBody);
                  }}
                >
                  Edit
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      <ListPager
        page={page}
        totalPages={totalPages}
        totalItems={approvals.length}
        onChangePage={setPage}
        disabled={loading}
      />
    </div>
  );
}
