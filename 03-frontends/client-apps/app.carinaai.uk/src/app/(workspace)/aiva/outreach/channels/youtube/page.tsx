'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { RunStatusBadge, StepStatusBadge } from '@/components/youtube-channel/badges';
import { useYouTubeChannelRun } from '@/components/youtube-channel/use-youtube-channel-run';
import {
  PROPERTY_CHANNEL_STEP_IDS,
  PROPERTY_CHANNEL_STEP_LABELS,
  type RenderJob,
} from '@/components/youtube-channel/types';

type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  detail: string;
};

export default function PropertyChannelOverviewPage() {
  const { run, loading, error, reload, channelId } = useYouTubeChannelRun();
  const { push } = useToast();
  const [advancing, setAdvancing] = useState(false);
  const [jobs, setJobs] = useState<RenderJob[]>([]);

  useEffect(() => {
    if (!channelId) {
      setJobs([]);
      return;
    }
    fetch(`/api/aiva/youtube-channel/${channelId}/videos`)
      .then((res) => (res.ok ? res.json() : { jobs: [] }))
      .then((data: { jobs?: RenderJob[] }) => setJobs(data.jobs ?? []))
      .catch(() => setJobs([]));
  }, [channelId, run?.updatedAt]);

  const checklist = useMemo((): ChecklistItem[] => {
    if (!run) return [];
    const youtubeConnected =
      run.steps['channel-provision']?.status === 'succeeded' || Boolean(run.input.channelId);
    const calendarReady = run.steps['script-generation']?.status === 'succeeded';
    const mp4Ready = jobs.some(
      (job) =>
        job.status === 'ready' &&
        typeof job.assets.videoPath === 'string' &&
        job.assets.videoPath.toLowerCase().endsWith('.mp4'),
    );
    const uploadsEnabled = mp4Ready && youtubeConnected;

    return [
      {
        id: 'youtube',
        label: 'YouTube connected',
        done: youtubeConnected,
        detail: youtubeConnected ? 'Channel linked for this run.' : 'Finish OAuth on the Setup tab.',
      },
      {
        id: 'calendar',
        label: 'Calendar generated',
        done: calendarReady,
        detail: calendarReady ? 'Script calendar is ready.' : 'Advance until script generation completes.',
      },
      {
        id: 'mp4',
        label: 'At least one MP4 ready',
        done: mp4Ready,
        detail: mp4Ready
          ? 'A rendered MP4 is available for upload.'
          : 'Beta: full video render is in progress; upload stays blocked without an MP4.',
      },
      {
        id: 'uploads',
        label: 'Uploads enabled',
        done: uploadsEnabled,
        detail: uploadsEnabled
          ? 'Ready jobs with MP4 can be scheduled on YouTube.'
          : 'Needs YouTube connection and a completed MP4 before publish.',
      },
    ];
  }, [run, jobs]);

  const uploadBlocked = Boolean(run) && !checklist.find((c) => c.id === 'uploads')?.done;

  const advance = useCallback(async () => {
    if (!run) return;
    setAdvancing(true);
    try {
      const res = await fetch(`/api/aiva/youtube-channel/${run.id}/advance`, { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        push(data.error ?? 'Could not advance the workflow', 'error');
      } else {
        push('Workflow advanced', 'success');
      }
      await reload();
    } finally {
      setAdvancing(false);
    }
  }, [run, push, reload]);

  if (loading) {
    return <div className="p-6 text-sm text-text-muted">Loading your YouTube channel...</div>;
  }

  if (error) {
    return <div className="p-6 text-sm text-danger">{error}</div>;
  }

  if (!run) {
    return (
      <div className="w-full max-w-none space-y-4 p-6">
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <h2 className="text-lg font-semibold text-text-primary">No YouTube channel yet</h2>
          <p className="mt-2 text-sm text-text-muted">
            Beta preview: connect YouTube, pick a domain and niche, and Aiva will research and write a
            script calendar. Full video render is in progress; publishing requires a completed MP4.
          </p>
          <Button asChild className="mt-4">
            <Link href="/aiva/outreach/channels/youtube/setup">Start setup</Link>
          </Button>
        </div>
      </div>
    );
  }

  const awaitingOauth = run.status === 'paused' && run.steps['channel-provision']?.status !== 'succeeded';

  return (
    <div className="w-full max-w-none space-y-6 p-6">
      <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-text-primary">
              {run.input.location} {run.input.niche.replace(/-/g, ' ')}
            </h2>
            <RunStatusBadge status={run.status} />
          </div>
          <p className="mt-1 text-sm text-text-muted">
            Target publish time {run.input.publishTime} (UTC schedule). Created{' '}
            {new Date(run.createdAt).toLocaleDateString()}.
          </p>
        </div>
        <Button onClick={() => void advance()} disabled={advancing || run.status === 'cancelled'}>
          {advancing ? 'Advancing...' : 'Advance now'}
        </Button>
      </div>

      {uploadBlocked ? (
        <div className="rounded-xl border border-border bg-elevated p-4 text-sm text-text-secondary">
          Advancing may reach the upload step, but YouTube publish stays blocked until an MP4 render is
          ready. Scripts and scheduling still work in Beta.
        </div>
      ) : null}

      {awaitingOauth ? (
        <div className="rounded-xl border border-accent/40 bg-accent-dim p-4 text-sm text-accent">
          Waiting for a YouTube channel to be connected.{' '}
          <Link href="/aiva/outreach/channels/youtube/setup" className="underline">
            Finish connecting on the Setup tab
          </Link>
          .
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-text-primary">Publish checklist</h3>
        <ul className="mt-3 space-y-2">
          {checklist.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border bg-elevated px-3 py-2"
            >
              <div>
                <p className="text-sm text-text-primary">{item.label}</p>
                <p className="mt-0.5 text-xs text-text-muted">{item.detail}</p>
              </div>
              <span
                className={
                  item.done
                    ? 'shrink-0 text-xs font-medium text-success'
                    : 'shrink-0 text-xs font-medium text-text-muted'
                }
              >
                {item.done ? 'Done' : 'Pending'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-text-primary">Workflow steps</h3>
        <ul className="mt-3 space-y-2">
          {PROPERTY_CHANNEL_STEP_IDS.map((stepId) => {
            const step = run.steps[stepId];
            return (
              <li
                key={stepId}
                className="flex items-center justify-between rounded-lg border border-border bg-elevated px-3 py-2"
              >
                <div>
                  <p className="text-sm text-text-primary">{PROPERTY_CHANNEL_STEP_LABELS[stepId]}</p>
                  {step?.error ? <p className="mt-0.5 text-xs text-danger">{step.error}</p> : null}
                </div>
                <StepStatusBadge status={step?.status ?? 'pending'} />
              </li>
            );
          })}
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link
          href="/aiva/outreach/channels/youtube/content"
          className="rounded-lg border border-border bg-card p-3 text-center text-sm text-text-secondary hover:bg-elevated hover:text-text-primary"
        >
          Content calendar
        </Link>
        <Link
          href="/aiva/outreach/channels/youtube/videos"
          className="rounded-lg border border-border bg-card p-3 text-center text-sm text-text-secondary hover:bg-elevated hover:text-text-primary"
        >
          Videos
        </Link>
        <Link
          href="/aiva/outreach/channels/youtube/leads"
          className="rounded-lg border border-border bg-card p-3 text-center text-sm text-text-secondary hover:bg-elevated hover:text-text-primary"
        >
          Leads
        </Link>
        <Link
          href="/aiva/outreach/channels/youtube/analytics"
          className="rounded-lg border border-border bg-card p-3 text-center text-sm text-text-secondary hover:bg-elevated hover:text-text-primary"
        >
          Analytics
        </Link>
      </div>
    </div>
  );
}
