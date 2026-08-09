'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { PIPELINE_LABELS, type OutreachLead, type PipelineStatus } from '@/components/outreach/types';

const STAGES = Object.keys(PIPELINE_LABELS) as PipelineStatus[];

export default function OutreachPipelinePage() {
  const { push } = useToast();
  const [columns, setColumns] = useState<Record<string, OutreachLead[]>>({});
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [source, setSource] = useState('');
  const [replyState, setReplyState] = useState('');
  const [bookingState, setBookingState] = useState('');
  const [dueFollowUp, setDueFollowUp] = useState(false);
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (source) params.set('source', source);
    if (replyState) params.set('replyState', replyState);
    if (bookingState) params.set('bookingState', bookingState);
    if (dueFollowUp) params.set('dueFollowUp', '1');
    const q = params.toString();
    return q ? `?${q}` : '';
  }, [source, replyState, bookingState, dueFollowUp]);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/aiva/outreach/pipeline${query}`)
      .then((res) => (res.ok ? res.json() : { columns: {}, summary: {} }))
      .then((data: { columns?: Record<string, OutreachLead[]>; summary?: Record<string, number> }) => {
        setColumns(data.columns ?? {});
        setSummary(data.summary ?? {});
      })
      .catch(() => {
        setColumns({});
        setSummary({});
      })
      .finally(() => setLoading(false));
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  const move = useCallback(
    async (leadId: string, status: PipelineStatus) => {
      const res = await fetch(`/api/aiva/outreach/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        push('Could not update lead status', 'error');
        return;
      }
      load();
    },
    [push, load],
  );

  const quick = useCallback(
    async (leadId: string, action: 'reply' | 'booked' | 'unsubscribe') => {
      const res = await fetch(`/api/aiva/outreach/leads/${leadId}/${action}`, { method: 'POST' });
      if (!res.ok) {
        push(`Could not ${action}`, 'error');
        return;
      }
      load();
    },
    [push, load],
  );

  return (
    <div className="flex h-full min-h-0 w-full max-w-none flex-col overflow-hidden" style={{ width: '100%', maxWidth: 'none' }}>
      <div className="shrink-0 overflow-x-auto border-b border-border px-4 py-3">
        <div className="flex w-max min-w-full flex-nowrap items-end gap-2">
          <div className="shrink-0">
            <label className="text-[10px] text-text-muted">Source</label>
            <select
              className="block rounded-md border border-border bg-elevated px-2 py-1 text-xs"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="">Any</option>
              <option value="manual">manual</option>
              <option value="csv_import">csv_import</option>
              <option value="youtube_comment">youtube_comment</option>
              <option value="email">email</option>
            </select>
          </div>
          <div className="shrink-0">
            <label className="text-[10px] text-text-muted">Reply</label>
            <select
              className="block rounded-md border border-border bg-elevated px-2 py-1 text-xs"
              value={replyState}
              onChange={(e) => setReplyState(e.target.value)}
            >
              <option value="">Any</option>
              <option value="none">none</option>
              <option value="awaiting">awaiting</option>
              <option value="replied">replied</option>
              <option value="unsubscribed">unsubscribed</option>
            </select>
          </div>
          <div className="shrink-0">
            <label className="text-[10px] text-text-muted">Booking</label>
            <select
              className="block rounded-md border border-border bg-elevated px-2 py-1 text-xs"
              value={bookingState}
              onChange={(e) => setBookingState(e.target.value)}
            >
              <option value="">Any</option>
              <option value="none">none</option>
              <option value="offered">offered</option>
              <option value="booked">booked</option>
              <option value="attended">attended</option>
              <option value="no_show">no_show</option>
            </select>
          </div>
          <label className="mb-1 flex shrink-0 items-center gap-1 text-xs text-text-secondary">
            <input type="checkbox" checked={dueFollowUp} onChange={(e) => setDueFollowUp(e.target.checked)} />
            Due follow-up
          </label>
          <Button size="sm" variant="outline" className="mb-0.5 shrink-0" asChild>
            <Link href="/aiva/outreach/replies">Reply queue</Link>
          </Button>
          <Button size="sm" variant="outline" className="mb-0.5 shrink-0" asChild>
            <Link href="/aiva/outreach/bookings">Bookings</Link>
          </Button>
          {(['total', 'contacted', 'replied', 'booked', 'attended', 'won', 'lost', 'follow_up'] as const).map((key) => (
            <div
              key={key}
              className="mb-0.5 inline-flex shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5"
            >
              <span className="text-[10px] uppercase tracking-wide text-text-muted">{key.replace('_', ' ')}</span>
              <span className="text-sm font-semibold text-text-primary">{summary[key] ?? 0}</span>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="px-4 py-6 text-sm text-text-muted">Loading pipeline...</p>
      ) : (
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden px-4 py-3">
          {STAGES.map((status) => {
            const leads = columns[status] ?? [];
            return (
              <div
                key={status}
                className="flex h-full w-[min(16rem,78vw)] shrink-0 flex-col rounded-xl border border-border bg-card"
              >
                <div className="shrink-0 border-b border-border px-3 py-2">
                  <p className="text-xs font-medium text-text-primary">
                    {PIPELINE_LABELS[status]} <span className="text-text-muted">({leads.length})</span>
                  </p>
                </div>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                  {leads.length === 0 ? (
                    <p className="px-1 py-4 text-center text-xs text-text-muted">Empty</p>
                  ) : (
                    leads.map((lead) => (
                      <div key={lead.id} className="rounded-md border border-border bg-elevated p-2">
                        <Link
                          href={`/aiva/outreach/leads/${lead.id}`}
                          className="text-sm font-medium text-accent hover:underline"
                        >
                          {lead.name}
                        </Link>
                        <p className="mt-0.5 truncate text-xs text-text-muted">
                          {lead.company || lead.email || lead.source}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-[10px]"
                            onClick={() => void quick(lead.id, 'reply')}
                          >
                            Replied
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" asChild>
                            <Link href={`/aiva/outreach/bookings?leadId=${lead.id}`}>Book</Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-[10px]"
                            onClick={() => void move(lead.id, 'won')}
                          >
                            Won
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-[10px]"
                            onClick={() => void move(lead.id, 'lost')}
                          >
                            Lost
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-[10px]"
                            onClick={() => void move(lead.id, 'ghosted')}
                          >
                            Ghosted
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
