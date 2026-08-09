'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { PIPELINE_LABELS, type OutreachLead, type PipelineStatus } from '@/components/outreach/types';
import { cn } from '@/lib/utils';

const STAGES = Object.keys(PIPELINE_LABELS) as PipelineStatus[];
const DRAG_MIME = 'application/x-aiva-pipeline-lead';

export default function OutreachPipelinePage() {
  const { push } = useToast();
  const [columns, setColumns] = useState<Record<string, OutreachLead[]>>({});
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [source, setSource] = useState('');
  const [replyState, setReplyState] = useState('');
  const [bookingState, setBookingState] = useState('');
  const [dueFollowUp, setDueFollowUp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<PipelineStatus | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

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
    async (leadId: string, status: PipelineStatus, fromStatus?: PipelineStatus) => {
      if (fromStatus && fromStatus === status) return;

      let snapshot: Record<string, OutreachLead[]> | null = null;
      setColumns((current) => {
        snapshot = current;
        let moving: OutreachLead | undefined;
        for (const stage of STAGES) {
          const hit = (current[stage] ?? []).find((lead) => lead.id === leadId);
          if (hit) {
            moving = hit;
            break;
          }
        }
        if (!moving) return current;
        const next: Record<string, OutreachLead[]> = {};
        for (const stage of STAGES) {
          next[stage] = (current[stage] ?? []).filter((lead) => lead.id !== leadId);
        }
        next[status] = [{ ...moving, status }, ...(next[status] ?? [])];
        return next;
      });

      setMovingId(leadId);
      const res = await fetch(`/api/aiva/outreach/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      setMovingId(null);
      if (!res.ok) {
        if (snapshot) setColumns(snapshot);
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

  function findLeadStage(leadId: string): PipelineStatus | undefined {
    for (const stage of STAGES) {
      if ((columns[stage] ?? []).some((lead) => lead.id === leadId)) return stage;
    }
    return undefined;
  }

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
        <p className="mt-2 text-[11px] text-text-muted">
          Drag a card into another column to change its pipeline stage.
        </p>
      </div>

      {loading ? (
        <p className="px-4 py-6 text-sm text-text-muted">Loading pipeline...</p>
      ) : (
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden px-4 py-3">
          {STAGES.map((status) => {
            const leads = columns[status] ?? [];
            const isDropTarget = dropTarget === status && draggingId != null;
            return (
              <div
                key={status}
                className={cn(
                  'flex h-full w-[min(16rem,78vw)] shrink-0 flex-col rounded-xl border bg-card transition-colors',
                  isDropTarget ? 'border-accent bg-accent/5' : 'border-border',
                )}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  setDropTarget(status);
                }}
                onDragLeave={() => {
                  setDropTarget((current) => (current === status ? null : current));
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const leadId =
                    event.dataTransfer.getData(DRAG_MIME) ||
                    event.dataTransfer.getData('text/plain') ||
                    draggingId;
                  setDropTarget(null);
                  setDraggingId(null);
                  if (!leadId) return;
                  const fromStatus = findLeadStage(leadId);
                  void move(leadId, status, fromStatus);
                }}
              >
                <div className="shrink-0 border-b border-border px-3 py-2">
                  <p className="text-xs font-medium text-text-primary">
                    {PIPELINE_LABELS[status]} <span className="text-text-muted">({leads.length})</span>
                  </p>
                </div>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                  {leads.length === 0 ? (
                    <p className="px-1 py-4 text-center text-xs text-text-muted">
                      {isDropTarget ? 'Drop here' : 'Empty'}
                    </p>
                  ) : (
                    leads.map((lead) => (
                      <div
                        key={lead.id}
                        draggable={movingId !== lead.id}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData(DRAG_MIME, lead.id);
                          event.dataTransfer.setData('text/plain', lead.id);
                          setDraggingId(lead.id);
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDropTarget(null);
                        }}
                        className={cn(
                          'cursor-grab rounded-md border border-border bg-elevated p-2 active:cursor-grabbing',
                          draggingId === lead.id && 'opacity-50',
                          movingId === lead.id && 'opacity-60',
                        )}
                      >
                        <Link
                          href={`/aiva/outreach/leads/${lead.id}`}
                          className="text-sm font-medium text-accent hover:underline"
                          onClick={(event) => {
                            if (draggingId) event.preventDefault();
                          }}
                          draggable={false}
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
                            onClick={() => void move(lead.id, 'won', lead.status)}
                          >
                            Won
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-[10px]"
                            onClick={() => void move(lead.id, 'lost', lead.status)}
                          >
                            Lost
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-[10px]"
                            onClick={() => void move(lead.id, 'ghosted', lead.status)}
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
