'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { LeadClassificationBadge } from '@/components/youtube-channel/badges';
import { useYouTubeChannelRun } from '@/components/youtube-channel/use-youtube-channel-run';
import type { YouTubeLead } from '@/components/youtube-channel/types';

export default function PropertyChannelLeadsPage() {
  const { run, loading: runLoading, channelId } = useYouTubeChannelRun();
  const { push } = useToast();
  const [leads, setLeads] = useState<YouTubeLead[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!channelId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/aiva/youtube-channel/${channelId}/leads`)
      .then((res) => (res.ok ? res.json() : { leads: [] }))
      .then((data: { leads?: YouTubeLead[] }) => setLeads(data.leads ?? []))
      .catch(() => setLeads([]))
      .finally(() => setLoading(false));
  }, [channelId]);

  useEffect(() => {
    load();
  }, [load]);

  const markHandled = useCallback(
    async (leadId: string) => {
      const res = await fetch(`/api/aiva/youtube-channel/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'handled' }),
      });
      if (!res.ok) {
        push('Could not update the lead', 'error');
        return;
      }
      load();
    },
    [push, load],
  );

  const importToOutreach = useCallback(async () => {
    if (!channelId) return;
    const res = await fetch('/api/aiva/outreach/leads/import-youtube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId }),
    });
    if (!res.ok) {
      push('Could not import YouTube leads into Outreach', 'error');
      return;
    }
    const json = await res.json();
    push(
      `Imported ${json.imported?.length ?? 0} lead(s) to Outreach (${json.linked?.length ?? 0} already linked)`,
      'success',
    );
  }, [channelId, push]);

  if (runLoading || loading) {
    return <div className="p-6 text-sm text-text-muted">Loading leads...</div>;
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

  const relevantLeads = leads.filter((lead) => lead.classification !== 'spam');

  if (relevantLeads.length === 0) {
    return (
      <div className="space-y-3 p-6 text-sm text-text-muted">
        <p>
          No leads yet. Aiva scans new comments for buying, selling, and joint-venture intent once
          comment monitoring is running.
        </p>
        <Button size="sm" variant="outline" onClick={() => void importToOutreach()}>
          Sync YouTube leads into Outreach
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[90rem] space-y-3 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-text-muted">
          Comment leads stay here and can sync into the Outreach Program pipeline.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void importToOutreach()}>
            Sync into Outreach
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/aiva/outreach/leads">Open Outreach leads</Link>
          </Button>
        </div>
      </div>
      {relevantLeads.map((lead) => (
        <div key={lead.id} className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-text-primary">{lead.authorDisplayName}</p>
            <LeadClassificationBadge classification={lead.classification} />
          </div>
          <p className="mt-1 text-sm text-text-secondary">{lead.text}</p>
          <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
            <span>
              Routed to {lead.destination.replace(/_/g, ' ')} - status: {lead.status}
            </span>
            {lead.status !== 'handled' ? (
              <Button size="sm" variant="outline" onClick={() => void markHandled(lead.id)}>
                Mark handled
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
