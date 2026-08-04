'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { useYouTubeChannelRun } from '@/components/youtube-channel/use-youtube-channel-run';
import type { ChannelDashboard, WeeklyReport } from '@/components/youtube-channel/types';

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-text-primary">{value}</p>
    </div>
  );
}

export default function PropertyChannelAnalyticsPage() {
  const { run, loading: runLoading, channelId } = useYouTubeChannelRun();
  const { push } = useToast();
  const [dashboard, setDashboard] = useState<ChannelDashboard | null>(null);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(() => {
    if (!channelId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      fetch(`/api/aiva/youtube-channel/${channelId}/analytics`).then((res) => (res.ok ? res.json() : null)),
      fetch(`/api/aiva/youtube-channel/${channelId}/analytics/weekly`).then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([dashboardData, weeklyData]: [ChannelDashboard | null, { reports?: WeeklyReport[] } | null]) => {
        setDashboard(dashboardData);
        setReports(weeklyData?.reports ?? []);
      })
      .catch(() => {
        setDashboard(null);
        setReports([]);
      })
      .finally(() => setLoading(false));
  }, [channelId]);

  useEffect(() => {
    load();
  }, [load]);

  const generateReport = useCallback(async () => {
    if (!channelId) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/aiva/youtube-channel/${channelId}/analytics/weekly?regenerate=true`);
      if (!res.ok) {
        push('Could not generate the weekly report', 'error');
        return;
      }
      push('Weekly report generated', 'success');
      load();
    } finally {
      setGenerating(false);
    }
  }, [channelId, push, load]);

  if (runLoading || loading) {
    return <div className="p-6 text-sm text-text-muted">Loading analytics...</div>;
  }

  if (!run || !channelId) {
    return (
      <div className="p-6 text-sm text-text-muted">
        No connected channel yet.{' '}
        <Link href="/aiva/outreach/channels/youtube/setup" className="text-accent underline">
          Start setup
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[90rem] space-y-6 p-6">
      {dashboard ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Subscribers" value={dashboard.subscriberCount.toLocaleString()} />
            <StatCard label="Total views" value={dashboard.totalViews.toLocaleString()} />
            <StatCard label="Views (7d)" value={dashboard.viewTrend7d.toLocaleString()} />
            <StatCard label="Avg. view duration" value={`${Math.round(dashboard.averageViewDuration)}s`} />
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-text-primary">Leads by classification</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Object.entries(dashboard.leadCounts).map(([classification, count]) => (
                <div key={classification} className="rounded-lg bg-elevated p-2 text-center">
                  <p className="text-xs text-text-muted">{classification.replace('_', ' ')}</p>
                  <p className="text-sm font-medium text-text-primary">{count}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-text-primary">Top videos</h3>
            <ul className="mt-3 space-y-2">
              {dashboard.topVideos.slice(0, 10).map((video) => (
                <li key={video.videoId} className="flex items-center justify-between text-sm">
                  <span className="text-text-primary">{video.title}</span>
                  <span className="text-text-muted">{video.views.toLocaleString()} views</span>
                </li>
              ))}
              {dashboard.topVideos.length === 0 ? (
                <p className="text-xs text-text-muted">No published videos yet.</p>
              ) : null}
            </ul>
          </div>
          <p className="text-xs text-text-muted">
            Quota used today: {dashboard.quota.used} / {dashboard.quota.limit}
          </p>
        </>
      ) : (
        <p className="text-sm text-text-muted">No analytics yet. Analytics appear once the channel is connected.</p>
      )}

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Weekly reports</h3>
          <Button size="sm" variant="outline" onClick={() => void generateReport()} disabled={generating}>
            {generating ? 'Generating...' : 'Generate now'}
          </Button>
        </div>
        <ul className="mt-3 space-y-2">
          {reports.map((report) => (
            <li key={report.weekStart} className="rounded-lg border border-border bg-elevated p-3 text-sm">
              <p className="text-text-primary">
                {new Date(report.weekStart).toLocaleDateString()} - {new Date(report.weekEnd).toLocaleDateString()}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {report.viewsThisWeek.toLocaleString()} views ({report.viewChangePercent >= 0 ? '+' : ''}
                {report.viewChangePercent.toFixed(1)}%), {report.subscribersGained} new subscribers
              </p>
            </li>
          ))}
          {reports.length === 0 ? <p className="text-xs text-text-muted">No weekly reports yet.</p> : null}
        </ul>
      </div>
    </div>
  );
}
