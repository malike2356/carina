'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/lib/format';

interface Submission {
  id: string;
  pack_name: string;
  version: string;
  author_handle: string;
  author_email: string;
  description: string;
  category: string | null;
  pricing_tier: string;
  price_gbp_cents: number | null;
  pack_archive_url: string;
  status: string;
  reviewer_notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  published_at: string | null;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    approved: 'bg-blue-100 text-blue-800',
    rejected: 'bg-red-100 text-red-800',
    published: 'bg-green-100 text-green-800',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${map[status] ?? 'bg-elevated text-text-secondary'}`}>
      {status}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-2 text-sm">
      <dt className="text-text-muted">{label}</dt>
      <dd className="col-span-2 text-text-primary">{value ?? '-'}</dd>
    </div>
  );
}

export default function MarketplaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { push: toast } = useToast();
  const [sub, setSub] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [acting, setActing] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/marketplace/submissions/${id}`);
      if (res.ok) {
        const data = await res.json() as { submission: Submission };
        setSub(data.submission);
        setNotes(data.submission.reviewer_notes ?? '');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void reload(); }, [reload]);

  async function review(action: 'approve' | 'reject') {
    if (action === 'reject' && !notes.trim()) {
      toast('Reviewer notes are required when rejecting.', 'error');
      return;
    }
    setActing(true);
    try {
      const res = await fetch(`/api/admin/marketplace/submissions/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, reviewerNotes: notes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast((data as { error?: string }).error ?? 'Action failed', 'error');
        return;
      }
      toast(action === 'approve' ? 'Submission approved.' : 'Submission rejected.', 'success');
      await reload();
    } finally {
      setActing(false);
    }
  }

  async function publish() {
    setActing(true);
    try {
      const res = await fetch(`/api/admin/marketplace/submissions/${id}/publish`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast((data as { error?: string }).error ?? 'Publish failed', 'error');
        return;
      }
      toast('Pack published to marketplace.', 'success');
      await reload();
    } finally {
      setActing(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-text-muted">Loading...</div>;
  if (!sub) return <div className="p-6 text-sm text-text-muted">Submission not found.</div>;

  return (
    <div className="space-y-6 p-6">
      <Link href="/marketplace" className="text-xs text-text-muted hover:text-text-secondary">
        &larr; Submissions
      </Link>

      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-text-primary">{sub.pack_name}</h1>
        <span className="text-sm text-text-muted">v{sub.version}</span>
        <StatusBadge status={sub.status} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-text-muted">Submission details</h2>
          <dl className="divide-y divide-border">
            <DetailRow label="Author" value={`${sub.author_handle} (${sub.author_email})`} />
            <DetailRow label="Description" value={sub.description} />
            <DetailRow label="Category" value={sub.category} />
            <DetailRow label="Pricing" value={`${sub.pricing_tier}${sub.price_gbp_cents ? ` - GBP ${(sub.price_gbp_cents / 100).toFixed(2)}` : ''}`} />
            <DetailRow label="Archive URL" value={
              <a href={sub.pack_archive_url} target="_blank" rel="noopener noreferrer" className="break-all text-accent-primary hover:underline">
                {sub.pack_archive_url}
              </a>
            } />
            <DetailRow label="Submitted" value={formatDate(sub.submitted_at)} />
            <DetailRow label="Reviewed" value={formatDate(sub.reviewed_at ?? undefined)} />
            <DetailRow label="Published" value={formatDate(sub.published_at ?? undefined)} />
          </dl>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">Status</h2>
            <StatusBadge status={sub.status} />
            {sub.reviewer_notes && (
              <p className="mt-3 text-sm text-text-secondary">{sub.reviewer_notes}</p>
            )}
          </div>

          {sub.status === 'pending' && (
            <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-wide text-text-muted">Review</h2>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reviewer notes (required when rejecting)"
                rows={3}
                className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => void review('approve')}
                  disabled={acting}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => void review('reject')}
                  disabled={acting}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          )}

          {sub.status === 'approved' && (
            <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-wide text-text-muted">Publish</h2>
              <p className="text-sm text-text-secondary">
                This submission has been approved. Publish it to make it live in the marketplace.
              </p>
              <button
                onClick={() => void publish()}
                disabled={acting}
                className="rounded-md bg-accent-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Publish to marketplace
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
