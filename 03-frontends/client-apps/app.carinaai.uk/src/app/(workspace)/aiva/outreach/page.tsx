'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { PIPELINE_LABELS, type PipelineStatus } from '@/components/outreach/types';

type Overview = {
  summary: Record<string, number>;
  pendingApprovals: number;
  activeEnrollments: number;
  openReplyReviews?: number;
  upcomingBookings?: number;
  scheduledReminders?: number;
  defaults: {
    campaign: { id: string; name: string };
    sequence: { id: string; name: string; steps: unknown[] };
  };
};

export default function OutreachOverviewPage() {
  const { push } = useToast();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/aiva/outreach/overview')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const processDue = useCallback(async () => {
    const res = await fetch('/api/aiva/outreach/process-due', { method: 'POST' });
    if (!res.ok) {
      push('Could not process due sequence steps', 'error');
      return;
    }
    const json = await res.json();
    push(
      `Queued ${json.processed?.length ?? 0} Soft Wall draft(s); skipped ${json.skipped?.length ?? 0}`,
      'success',
    );
    load();
  }, [push, load]);

  if (loading) {
    return <div className="p-6 text-sm text-text-muted">Loading outreach...</div>;
  }

  if (!data) {
    return <div className="p-6 text-sm text-text-muted">Could not load sales engagement.</div>;
  }

  const statusKeys = Object.keys(PIPELINE_LABELS) as PipelineStatus[];

  return (
    <div className="mx-auto max-w-[90rem] space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-text-secondary">
            Default campaign: <span className="text-text-primary">{data.defaults.campaign.name}</span>
            {' · '}
            Sequence: <span className="text-text-primary">{data.defaults.sequence.name}</span>
            {' '}({data.defaults.sequence.steps.length} steps)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void processDue()}>
            Process due sends
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/aiva/approvals">Open Approvals</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/aiva/outreach/replies">Reply queue</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/aiva/outreach/bookings">Bookings</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/aiva/outreach/channels/youtube">YouTube Channel</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total leads" value={data.summary.total ?? 0} />
        <Stat label="Active enrollments" value={data.activeEnrollments} />
        <Stat label="Pending Soft Wall" value={data.pendingApprovals} />
        <Stat label="Booked" value={data.summary.booked ?? 0} />
        <Stat label="Open reply reviews" value={data.openReplyReviews ?? 0} />
        <Stat label="Upcoming bookings" value={data.upcomingBookings ?? 0} />
        <Stat label="Scheduled reminders" value={data.scheduledReminders ?? 0} />
        <Stat label="Follow-up" value={data.summary.follow_up ?? 0} />
      </div>

      <div>
        <h2 className="text-sm font-medium text-text-primary">Pipeline snapshot</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {statusKeys.map((key) => (
            <div key={key} className="rounded-lg border border-border bg-card px-3 py-2">
              <p className="text-xs text-text-muted">{PIPELINE_LABELS[key]}</p>
              <p className="text-lg font-semibold text-text-primary">{data.summary[key] ?? 0}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 text-sm text-text-secondary">
        <p className="font-medium text-text-primary">How this program works</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Import or add leads; organize into lists and campaigns.</li>
          <li>Enroll leads into a sequence (email first; Soft Wall before every send).</li>
          <li>Process due steps, then approve drafts in Approvals.</li>
          <li>Use YouTube Channel for outreach content; comment leads can import here.</li>
        </ol>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-text-primary">{value}</p>
    </div>
  );
}
