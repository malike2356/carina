'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { RunStatusBadge } from '@/components/youtube-channel/badges';
import { useYouTubeChannelRun } from '@/components/youtube-channel/use-youtube-channel-run';
import type { QuotaUsage } from '@/components/youtube-channel/types';

export default function PropertyChannelSettingsPage() {
  const { run, loading, channelId, reload } = useYouTubeChannelRun();
  const { push } = useToast();
  const [quota, setQuota] = useState<QuotaUsage | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!channelId) return;
    fetch(`/api/aiva/youtube-channel/${channelId}/quota`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: QuotaUsage | null) => setQuota(data))
      .catch(() => setQuota(null));
  }, [channelId]);

  const runAction = useCallback(
    async (action: 'pause' | 'resume' | 'cancel') => {
      if (!run) return;
      setBusy(true);
      try {
        const res = await fetch(`/api/aiva/youtube-channel/${run.id}/${action}`, { method: 'POST' });
        if (!res.ok) {
          push(`Could not ${action} the workflow`, 'error');
          return;
        }
        push(`Workflow ${action}d`, 'success');
        await reload();
      } finally {
        setBusy(false);
      }
    },
    [run, push, reload],
  );

  if (loading) {
    return <div className="p-6 text-sm text-text-muted">Loading settings...</div>;
  }

  if (!run) {
    return (
      <div className="p-6 text-sm text-text-muted">
        No YouTube channel yet.{' '}
        <Link href="/aiva/outreach/channels/youtube/setup" className="text-accent underline">
          Start setup
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[90rem] space-y-6 p-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text-primary">Workflow status</h3>
          <RunStatusBadge status={run.status} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy || run.status !== 'running'}
            onClick={() => void runAction('pause')}
          >
            Pause
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || run.status !== 'paused'}
            onClick={() => void runAction('resume')}
          >
            Resume
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={busy || run.status === 'cancelled'}
            onClick={() => void runAction('cancel')}
          >
            Cancel
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-text-primary">YouTube API quota</h3>
        {quota ? (
          <p className="mt-2 text-sm text-text-secondary">
            {quota.used.toLocaleString()} / {quota.limit.toLocaleString()} units used today (
            {quota.remaining.toLocaleString()} remaining).
          </p>
        ) : (
          <p className="mt-2 text-sm text-text-muted">Quota data appears once the channel is connected.</p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-text-primary">Channel connection</h3>
        <p className="mt-1 text-xs text-text-muted">
          If YouTube access is revoked, reconnect from the Setup tab to restore uploads and comment
          monitoring.
        </p>
        <Button asChild size="sm" variant="outline" className="mt-3">
          <Link href="/aiva/outreach/channels/youtube/setup">Go to Setup</Link>
        </Button>
      </div>
    </div>
  );
}
