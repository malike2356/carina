'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_PAGE_SIZE,
  ListPager,
  slicePage,
  totalPagesFor,
} from '@/components/ui/ListPager';
import { useToast } from '@/components/ui/Toast';
import { isSocialChannelId, socialChannelLabel } from '@/lib/social-channels';
import {
  isMessagingApprovalChannelId,
  messagingChannelLabel,
} from '@/lib/messaging-channels';

export type SocialInboxGroup = 'all' | 'messaging' | 'social';

type SocialApproval = {
  id: string;
  workerId?: string;
  workerName?: string | null;
  channel?: string;
  contactId?: string;
  inboundText?: string;
  draftText?: string;
  messageType?: string;
  requestedAt?: string;
  timeoutAt?: string;
};

function channelLabel(channel: string | undefined): string {
  if (!channel) return 'Channel';
  if (isSocialChannelId(channel)) return socialChannelLabel(channel);
  if (isMessagingApprovalChannelId(channel)) return messagingChannelLabel(channel);
  return channel;
}

function matchesGroup(channel: string | undefined, group: SocialInboxGroup): boolean {
  if (group === 'all') return true;
  if (!channel) return false;
  if (group === 'messaging') return isMessagingApprovalChannelId(channel);
  return isSocialChannelId(channel);
}

const POLL_MS = 15_000;

export function SocialApprovalInboxClient({
  embedded = false,
  channelGroup = 'all',
}: {
  embedded?: boolean;
  channelGroup?: SocialInboxGroup;
}) {
  const { push } = useToast();
  const [approvals, setApprovals] = useState<SocialApproval[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (opts?.silent) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await fetch('/api/aiva/social/approvals/inbox');
      const payload = (await response.json().catch(() => ({}))) as {
        approvals?: SocialApproval[];
        error?: string;
      };
      if (!response.ok) {
        if (!opts?.silent) push('Could not load channel approvals', 'error');
        return;
      }
      setApprovals(payload.approvals ?? []);
      if (!opts?.silent) setPage(1);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [push]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load({ silent: true }), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  async function approve(id: string, modifiedDraft?: string) {
    setBusyId(id);
    try {
      const response = await fetch(`/api/aiva/social/approvals/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modifiedDraft ? { draftText: modifiedDraft } : {}),
      });
      if (!response.ok) {
        push('Approve failed', 'error');
        return;
      }
      push('Reply approved and sent', 'success');
      setEditingId(null);
      void load({ silent: true });
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    setBusyId(id);
    try {
      const response = await fetch(`/api/aiva/social/approvals/${id}/reject`, {
        method: 'POST',
      });
      if (!response.ok) {
        push('Reject failed', 'error');
        return;
      }
      push('Draft rejected', 'success');
      setEditingId(null);
      void load({ silent: true });
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(
    () => approvals.filter((item) => matchesGroup(item.channel, channelGroup)),
    [approvals, channelGroup],
  );

  const totalPages = totalPagesFor(filtered.length, DEFAULT_PAGE_SIZE);
  const pageApprovals = useMemo(
    () => slicePage(filtered, page, DEFAULT_PAGE_SIZE),
    [filtered, page],
  );

  const emptyLabel =
    channelGroup === 'messaging'
      ? 'No pending messaging drafts. Connected WhatsApp, Telegram, Slack, and similar channels will appear here when approval is required.'
      : channelGroup === 'social'
        ? 'No pending social drafts. LinkedIn, Instagram, Messenger, X, and TikTok replies appear here when approval is required.'
        : 'No pending channel approvals.';

  return (
    <div className={embedded ? 'space-y-4' : 'mx-auto w-full max-w-5xl space-y-4 px-4 py-6 sm:px-6 lg:px-8'}>
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

      {!loading && filtered.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface p-6 text-sm text-text-secondary">
          {emptyLabel}
        </p>
      ) : null}

      {pageApprovals.map((approval) => (
        <article key={approval.id} className="rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {channelLabel(approval.channel)}
                {approval.contactId ? ` | ${approval.contactId}` : ''}
                {approval.messageType === 'post' ? ' | Post' : ''}
              </p>
              {approval.workerName ? (
                <p className="mt-1 text-xs text-text-secondary">{approval.workerName}</p>
              ) : null}
            </div>
            {approval.timeoutAt ? (
              <p className="text-xs text-text-muted">
                Timeout: {new Date(approval.timeoutAt).toLocaleString('en-GB')}
              </p>
            ) : null}
          </div>

          {approval.inboundText ? (
            <div className="mt-3 rounded bg-base p-3">
              <p className="text-[11px] font-medium uppercase text-text-muted">Inbound</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">
                {approval.inboundText}
              </p>
            </div>
          ) : null}

          {editingId === approval.id ? (
            <textarea
              className="mt-3 w-full rounded border border-border bg-base p-3 text-sm"
              rows={8}
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
            />
          ) : (
            <div className="mt-3 rounded bg-base p-3">
              <p className="text-[11px] font-medium uppercase text-text-muted">Draft reply</p>
              <pre className="mt-1 whitespace-pre-wrap text-sm text-text-primary">
                {approval.draftText ?? ''}
              </pre>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={busyId === approval.id}
              onClick={() => void approve(approval.id)}
            >
              Approve
            </button>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={busyId === approval.id}
              onClick={() => void reject(approval.id)}
            >
              Reject
            </button>
            {editingId === approval.id ? (
              <button
                type="button"
                className="btn-secondary text-sm"
                disabled={busyId === approval.id || !editBody.trim()}
                onClick={() => void approve(approval.id, editBody)}
              >
                Approve edited draft
              </button>
            ) : (
              <button
                type="button"
                className="btn-secondary text-sm"
                disabled={busyId === approval.id}
                onClick={() => {
                  setEditingId(approval.id);
                  setEditBody(approval.draftText ?? '');
                }}
              >
                Edit
              </button>
            )}
          </div>
        </article>
      ))}

      <ListPager
        page={page}
        totalPages={totalPages}
        totalItems={filtered.length}
        onChangePage={setPage}
        disabled={loading}
      />
    </div>
  );
}
