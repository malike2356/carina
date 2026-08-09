'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useYouTubeChannelRun } from '@/components/youtube-channel/use-youtube-channel-run';
import type { GeneratedVideoItem } from '@/components/youtube-channel/types';

export default function PropertyChannelContentPage() {
  const { run, loading: runLoading, channelId } = useYouTubeChannelRun();
  const [calendar, setCalendar] = useState<GeneratedVideoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!channelId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/aiva/youtube-channel/${channelId}/calendar`)
      .then((res) => (res.ok ? res.json() : { calendar: [] }))
      .then((data: { calendar?: GeneratedVideoItem[] }) => setCalendar(data.calendar ?? []))
      .catch(() => setCalendar([]))
      .finally(() => setLoading(false));
  }, [channelId]);

  if (runLoading || loading) {
    return <div className="p-6 text-sm text-text-muted">Loading content calendar...</div>;
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

  if (calendar.length === 0) {
    return (
      <div className="p-6 text-sm text-text-muted">
        No scripts generated yet. Advance the workflow from the Overview tab once your channel is
        connected.
      </div>
    );
  }

  return (
    <div className="w-full max-w-none space-y-3 p-6">
      <p className="text-sm text-text-muted">{calendar.length} videos scripted.</p>
      <div className="space-y-2">
        {calendar.slice(0, 60).map((item) => (
          <div key={item.dayIndex} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-text-primary">{item.title}</p>
              <span className="shrink-0 text-xs text-text-muted">
                Day {item.dayIndex + 1} - {new Date(item.date).toLocaleDateString()}
              </span>
            </div>
            <p className="mt-1 text-xs text-text-muted">{item.theme}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {item.tags.slice(0, 6).map((tag) => (
                <span key={tag} className="rounded-full bg-elevated px-2 py-0.5 text-xs text-text-secondary">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {calendar.length > 60 ? (
        <p className="text-xs text-text-muted">Showing the first 60 of {calendar.length} scripted videos.</p>
      ) : null}
    </div>
  );
}
