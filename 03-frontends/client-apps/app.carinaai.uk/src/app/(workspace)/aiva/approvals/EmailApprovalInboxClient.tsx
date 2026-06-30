'use client';

import { useCallback, useEffect, useState } from 'react';
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

export function EmailApprovalInboxClient() {
  const { push } = useToast();
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/aiva/email/approvals/inbox');
      if (!res.ok) {
        push('Could not load approval inbox', 'error');
        return;
      }
      const body = (await res.json()) as { approvals?: ApprovalItem[] };
      setApprovals(body.approvals ?? []);
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    void load();
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
    void load();
  }

  async function reject(id: string) {
    const res = await fetch(`/api/aiva/email/approvals/${id}/reject`, { method: 'POST' });
    if (!res.ok) {
      push('Reject failed', 'error');
      return;
    }
    push('Draft rejected', 'success');
    void load();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Email approval inbox</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Review AI Employee email drafts before they are sent. Unreviewed drafts expire after 4 hours.
        </p>
      </div>

      <GovernanceSidebarCard />

      {loading ? <p className="text-sm text-text-muted">Loading...</p> : null}

      {!loading && approvals.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-6 text-sm text-text-secondary">
          No pending approvals. Connect an Email Handler AI Employee and wait for client query emails.
        </p>
      ) : null}

      <div className="space-y-4">
        {approvals.map((item) => (
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
    </div>
  );
}
