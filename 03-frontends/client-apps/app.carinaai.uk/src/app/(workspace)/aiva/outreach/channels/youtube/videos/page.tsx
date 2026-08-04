'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RenderJobStatusBadge } from '@/components/youtube-channel/badges';
import { useYouTubeChannelRun } from '@/components/youtube-channel/use-youtube-channel-run';
import type { RenderJob } from '@/components/youtube-channel/types';

type QueueInfo = {
  queueDepth?: {
    queued: number;
    rendering: number;
    ready: number;
    failed: number;
    uploaded?: number;
  };
  lastRenderError?: string | null;
  nextRenderAt?: string;
  nextUploadAt?: string;
};

export default function PropertyChannelVideosPage() {
  const { run, loading: runLoading, channelId } = useYouTubeChannelRun();
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const [queue, setQueue] = useState<QueueInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [renderingNote, setRenderingNote] = useState(
    'Rendering usually takes several minutes.',
  );

  useEffect(() => {
    if (!channelId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      fetch(`/api/aiva/youtube-channel/${channelId}/videos`).then((res) =>
        (res.ok ? res.json() : { jobs: [] })),
      fetch(`/api/aiva/youtube-channel/${channelId}/queue`).then((res) =>
        (res.ok ? res.json() : null)),
    ])
      .then(([videosData, queueData]: [
        { jobs?: RenderJob[]; queueDepth?: QueueInfo['queueDepth']; lastRenderError?: string | null; renderingNote?: string },
        QueueInfo | null,
      ]) => {
        setJobs(videosData.jobs ?? []);
        if (videosData.renderingNote) setRenderingNote(videosData.renderingNote);
        setQueue({
          queueDepth: videosData.queueDepth ?? queueData?.queueDepth,
          lastRenderError: videosData.lastRenderError ?? queueData?.lastRenderError ?? null,
          nextRenderAt: queueData?.nextRenderAt,
          nextUploadAt: queueData?.nextUploadAt,
        });
      })
      .catch(() => {
        setJobs([]);
        setQueue(null);
      })
      .finally(() => setLoading(false));
  }, [channelId]);

  if (runLoading || loading) {
    return <div className="p-6 text-sm text-text-muted">Loading videos...</div>;
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
    <div className="mx-auto max-w-[90rem] space-y-4 p-6">
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-text-primary">{renderingNote}</p>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-text-muted">
          <span>Queued: {queue?.queueDepth?.queued ?? 0}</span>
          <span>Rendering: {queue?.queueDepth?.rendering ?? 0}</span>
          <span>Ready: {queue?.queueDepth?.ready ?? 0}</span>
          <span>Failed: {queue?.queueDepth?.failed ?? 0}</span>
          {queue?.nextRenderAt ? <span>Next render window: {new Date(queue.nextRenderAt).toLocaleString()}</span> : null}
          {queue?.nextUploadAt ? <span>Next upload window: {new Date(queue.nextUploadAt).toLocaleString()}</span> : null}
        </div>
        {queue?.lastRenderError ? (
          <p className="mt-2 text-xs text-danger">Last render error: {queue.lastRenderError}</p>
        ) : null}
      </div>

      {jobs.length === 0 ? (
        <div className="text-sm text-text-muted">
          No render jobs yet. Once the media pipeline enqueues work, statuses appear here as queued, rendering, ready, or uploaded.
        </div>
      ) : (
        jobs
          .slice()
          .sort((a, b) => a.dayIndex - b.dayIndex)
          .map((job) => (
            <div key={job.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-text-primary">{job.title}</p>
                <RenderJobStatusBadge status={job.status} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-text-muted">
                <span>Day {job.dayIndex + 1}</span>
                <span>Progress {job.progress}%</span>
                {job.assets.videoPath?.toLowerCase().endsWith('.mp4') ? (
                  <span>MP4 ready</span>
                ) : job.status === 'ready' ? (
                  <span>Waiting for MP4 path</span>
                ) : null}
                {job.youtubeVideoId ? (
                  <a
                    href={`https://www.youtube.com/watch?v=${job.youtubeVideoId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent underline"
                  >
                    View on YouTube
                  </a>
                ) : null}
              </div>
              {job.error ? <p className="mt-1 text-xs text-danger">{job.error}</p> : null}
            </div>
          ))
      )}
    </div>
  );
}
