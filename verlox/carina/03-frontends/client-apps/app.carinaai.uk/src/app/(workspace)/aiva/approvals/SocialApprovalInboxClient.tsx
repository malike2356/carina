'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/Toast';

type SocialApproval = {
  id: string;
  channel?: string;
  recipient?: string;
  draftBody?: string;
  content?: string;
  requestedAt?: string;
};

export function SocialApprovalInboxClient({ embedded = false }: { embedded?: boolean }) {
  const { push } = useToast();
  const [approvals, setApprovals] = useState<SocialApproval[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/aiva/social/approvals/inbox');
      const payload = (await response.json().catch(() => ({}))) as {
        approvals?: SocialApproval[];
      };
      if (!response.ok) {
        push('Could not load social approvals', 'error');
        return;
      }
      setApprovals(payload.approvals ?? []);
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, decision: 'approve' | 'reject') {
    const response = await fetch(`/api/aiva/social/approvals/${id}/${decision}`, {
      method: 'POST',
    });
    if (!response.ok) {
      push(`${decision === 'approve' ? 'Approval' : 'Rejection'} failed`, 'error');
      return;
    }
    push(decision === 'approve' ? 'Social reply approved' : 'Social draft rejected', 'success');
    void load();
  }

  return (
    <div className={embedded ? 'space-y-4' : 'mx-auto max-w-4xl space-y-4 p-6'}>
      {loading ? <p className="text-sm text-text-muted">Loading...</p> : null}
      {!loading && approvals.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-6 text-sm text-text-secondary">
          No pending social approvals.
        </p>
      ) : null}
      {approvals.map((approval) => (
        <article key={approval.id} className="rounded-lg border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase text-text-muted">
            {approval.channel || 'Social'}{approval.recipient ? ` | ${approval.recipient}` : ''}
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm text-text-primary">
            {approval.draftBody ?? approval.content ?? ''}
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="btn-primary text-sm"
              onClick={() => void decide(approval.id, 'approve')}
            >
              Approve
            </button>
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => void decide(approval.id, 'reject')}
            >
              Reject
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
