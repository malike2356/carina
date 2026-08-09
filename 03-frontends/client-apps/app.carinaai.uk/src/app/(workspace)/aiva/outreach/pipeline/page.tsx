'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GripVertical, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import {
  PIPELINE_LABELS,
  type DeliveryEvent,
  type OutreachLead,
  type PipelineStatus,
} from '@/components/outreach/types';
import { cn } from '@/lib/utils';

const STAGES = Object.keys(PIPELINE_LABELS) as PipelineStatus[];
const DRAG_MIME = 'application/x-aiva-pipeline-lead';

type LeadDetailPayload = {
  lead: OutreachLead;
  deliveries?: DeliveryEvent[];
};

function applyLeadToColumns(
  current: Record<string, OutreachLead[]>,
  leadId: string,
  status: PipelineStatus,
  patch?: Partial<OutreachLead>,
): Record<string, OutreachLead[]> {
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
  next[status] = [{ ...moving, ...patch, status, pipelineStage: status }, ...(next[status] ?? [])];
  return next;
}

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
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);
  const [detail, setDetail] = useState<LeadDetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const dropTargetRef = useRef<PipelineStatus | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  const movingIdRef = useRef<string | null>(null);
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (source) params.set('source', source);
    if (replyState) params.set('replyState', replyState);
    if (bookingState) params.set('bookingState', bookingState);
    if (dueFollowUp) params.set('dueFollowUp', '1');
    const q = params.toString();
    return q ? `?${q}` : '';
  }, [source, replyState, bookingState, dueFollowUp]);

  const load = useCallback((opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    fetch(`/api/aiva/outreach/pipeline${query}`)
      .then((res) => (res.ok ? res.json() : { columns: {}, summary: {} }))
      .then((data: { columns?: Record<string, OutreachLead[]>; summary?: Record<string, number> }) => {
        setColumns(data.columns ?? {});
        setSummary(data.summary ?? {});
      })
      .catch(() => {
        if (!opts?.silent) {
          setColumns({});
          setSummary({});
        }
      })
      .finally(() => {
        if (!opts?.silent) setLoading(false);
      });
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  const openLeadDetail = useCallback((lead: OutreachLead) => {
    setDetailLeadId(lead.id);
    setDetail({ lead, deliveries: undefined });
    setDetailLoading(true);
    fetch(`/api/aiva/outreach/leads/${lead.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: LeadDetailPayload | null) => {
        if (!data?.lead) {
          setDetail({ lead, deliveries: [] });
          return;
        }
        setDetail({ lead: data.lead, deliveries: data.deliveries ?? [] });
      })
      .catch(() => {
        setDetail({ lead, deliveries: [] });
        push('Could not load full lead details', 'error');
      })
      .finally(() => setDetailLoading(false));
  }, [push]);

  const closeLeadDetail = useCallback(() => {
    setDetailLeadId(null);
    setDetail(null);
    setDetailLoading(false);
  }, []);

  const move = useCallback(
    async (leadId: string, status: PipelineStatus, fromStatus?: PipelineStatus) => {
      if (fromStatus && fromStatus === status) return;
      if (movingIdRef.current === leadId) return;

      const snapshot = columnsRef.current;
      movingIdRef.current = leadId;
      setColumns((current) => applyLeadToColumns(current, leadId, status));
      setMovingId(leadId);

      try {
        const res = await fetch(`/api/aiva/outreach/leads/${leadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, pipelineStage: status }),
        });
        if (!res.ok) {
          setColumns(snapshot);
          push('Could not update lead status', 'error');
          return;
        }
        const data = (await res.json().catch(() => ({}))) as { lead?: OutreachLead };
        const savedStatus = (data.lead?.status ?? status) as PipelineStatus;
        if (data.lead) {
          setColumns((current) => applyLeadToColumns(current, leadId, savedStatus, data.lead));
          if (detailLeadId === leadId) {
            setDetail((current) =>
              current ? { ...current, lead: { ...current.lead, ...data.lead, status: savedStatus } } : current,
            );
          }
        } else if (savedStatus !== status) {
          setColumns((current) => applyLeadToColumns(current, leadId, savedStatus));
        }
        load({ silent: true });
      } catch {
        setColumns(snapshot);
        push('Could not update lead status', 'error');
      } finally {
        movingIdRef.current = null;
        setMovingId(null);
      }
    },
    [push, load, detailLeadId],
  );

  const quick = useCallback(
    async (leadId: string, action: 'reply' | 'booked' | 'unsubscribe') => {
      const res = await fetch(`/api/aiva/outreach/leads/${leadId}/${action}`, { method: 'POST' });
      if (!res.ok) {
        push(`Could not ${action}`, 'error');
        return;
      }
      load({ silent: true });
      if (detailLeadId === leadId) {
        const lead = Object.values(columnsRef.current).flat().find((row) => row.id === leadId);
        if (lead) openLeadDetail(lead);
      }
    },
    [push, load, detailLeadId, openLeadDetail],
  );

  function findLeadStage(leadId: string): PipelineStatus | undefined {
    for (const stage of STAGES) {
      if ((columnsRef.current[stage] ?? []).some((lead) => lead.id === leadId)) return stage;
    }
    return undefined;
  }

  function clearDragState() {
    draggingIdRef.current = null;
    dropTargetRef.current = null;
    setDraggingId(null);
    setDropTarget(null);
  }

  function onColumnDragOver(event: React.DragEvent, status: PipelineStatus) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    dropTargetRef.current = status;
    setDropTarget(status);
  }

  function onColumnDrop(event: React.DragEvent, status: PipelineStatus) {
    event.preventDefault();
    event.stopPropagation();
    const leadId =
      event.dataTransfer.getData(DRAG_MIME) ||
      draggingIdRef.current ||
      draggingId;
    const targetStatus = dropTargetRef.current ?? status;
    clearDragState();
    if (!leadId) return;
    const fromStatus = findLeadStage(leadId);
    void move(leadId, targetStatus, fromStatus);
  }

  const detailLead = detail?.lead ?? null;
  const timeline = detailLead?.timeline ?? [];

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
          Click a lead name to view details. Drag the grip handle to move a card between stages.
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
                data-pipeline-stage={status}
                className={cn(
                  'flex h-full w-[min(16rem,78vw)] shrink-0 flex-col rounded-xl border bg-card transition-colors',
                  isDropTarget ? 'border-accent bg-accent/5' : 'border-border',
                )}
                onDragEnter={(event) => onColumnDragOver(event, status)}
                onDragOver={(event) => onColumnDragOver(event, status)}
                onDragLeave={(event) => {
                  const related = event.relatedTarget as Node | null;
                  if (related && event.currentTarget.contains(related)) return;
                  if (dropTargetRef.current === status) {
                    dropTargetRef.current = null;
                    setDropTarget(null);
                  }
                }}
                onDrop={(event) => onColumnDrop(event, status)}
              >
                <div className="shrink-0 border-b border-border px-3 py-2">
                  <p className="text-xs font-medium text-text-primary">
                    {PIPELINE_LABELS[status]} <span className="text-text-muted">({leads.length})</span>
                  </p>
                </div>
                <div
                  className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2"
                  onDragOver={(event) => onColumnDragOver(event, status)}
                  onDrop={(event) => onColumnDrop(event, status)}
                >
                  {leads.length === 0 ? (
                    <p className="px-1 py-4 text-center text-xs text-text-muted">
                      {isDropTarget ? 'Drop here' : 'Empty'}
                    </p>
                  ) : (
                    leads.map((lead) => (
                      <div
                        key={lead.id}
                        className={cn(
                          'rounded-md border border-border bg-elevated p-2',
                          draggingId === lead.id && 'opacity-50',
                          movingId === lead.id && 'opacity-60',
                          detailLeadId === lead.id && 'border-accent/50',
                        )}
                      >
                        <div className="flex items-start gap-1.5">
                          <button
                            type="button"
                            draggable={movingId !== lead.id}
                            aria-label={`Drag ${lead.name}`}
                            title="Drag to another stage"
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = 'move';
                              event.dataTransfer.setData(DRAG_MIME, lead.id);
                              event.dataTransfer.setData('text/plain', '');
                              draggingIdRef.current = lead.id;
                              setDraggingId(lead.id);
                            }}
                            onDragEnd={() => clearDragState()}
                            className="mt-0.5 shrink-0 cursor-grab rounded p-0.5 text-text-muted hover:bg-surface hover:text-text-secondary active:cursor-grabbing"
                          >
                            <GripVertical className="h-3.5 w-3.5" />
                          </button>
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              className="block w-full truncate text-left text-sm font-medium text-accent hover:underline"
                              onClick={() => openLeadDetail(lead)}
                            >
                              {lead.name}
                            </button>
                            <p className="mt-0.5 truncate text-xs text-text-muted">
                              {lead.company || lead.email || lead.source}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1 pl-5">
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

      {detailLeadId && detailLead ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={closeLeadDetail}>
          <aside
            className="flex h-full w-full max-w-md flex-col border-l border-border bg-elevated shadow-xl"
            onClick={(event) => event.stopPropagation()}
            aria-label="Lead details"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-text-primary">{detailLead.name}</h3>
                <p className="mt-0.5 text-xs text-text-muted">
                  {PIPELINE_LABELS[detailLead.status] ?? detailLead.status}
                  {detailLead.company ? ` · ${detailLead.company}` : ''}
                </p>
              </div>
              <button
                type="button"
                className="rounded p-1 text-text-muted hover:bg-surface hover:text-text-secondary"
                onClick={closeLeadDetail}
                aria-label="Close lead details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {detailLoading ? (
                <p className="text-xs text-text-muted">Loading details...</p>
              ) : (
                <div className="space-y-4">
                  <section>
                    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Contact</h4>
                    <dl className="mt-2 space-y-1.5 text-xs text-text-secondary">
                      <div>
                        <dt className="inline text-text-muted">Email: </dt>
                        <dd className="inline break-all">{detailLead.email || '-'}</dd>
                      </div>
                      <div>
                        <dt className="inline text-text-muted">Phone: </dt>
                        <dd className="inline">{detailLead.phone || '-'}</dd>
                      </div>
                      <div>
                        <dt className="inline text-text-muted">Company: </dt>
                        <dd className="inline">{detailLead.company || '-'}</dd>
                      </div>
                      <div>
                        <dt className="inline text-text-muted">Source: </dt>
                        <dd className="inline">{detailLead.sourceName || detailLead.sourceType || detailLead.source || '-'}</dd>
                      </div>
                      <div>
                        <dt className="inline text-text-muted">Website: </dt>
                        <dd className="inline break-all">{detailLead.website || '-'}</dd>
                      </div>
                      <div>
                        <dt className="inline text-text-muted">Town/City: </dt>
                        <dd className="inline">{detailLead.townCity || '-'}</dd>
                      </div>
                      <div>
                        <dt className="inline text-text-muted">Priority: </dt>
                        <dd className="inline">{detailLead.priority || '-'}</dd>
                      </div>
                    </dl>
                  </section>

                  {detailLead.notes ? (
                    <section>
                      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Notes</h4>
                      <p className="mt-2 whitespace-pre-wrap rounded-md border border-border bg-card px-3 py-2 text-xs text-text-secondary">
                        {detailLead.notes}
                      </p>
                    </section>
                  ) : null}

                  <section>
                    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Timeline</h4>
                    {timeline.length === 0 ? (
                      <p className="mt-2 text-xs text-text-muted">No events yet.</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {[...timeline].reverse().slice(0, 30).map((event) => (
                          <li key={event.id} className="rounded-md border border-border bg-card px-3 py-2 text-xs">
                            <div className="text-text-muted">
                              {new Date(event.at).toLocaleString()} · {event.kind}
                            </div>
                            <p className="mt-0.5 text-text-secondary">{event.message}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section>
                    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Deliveries</h4>
                    {!detail?.deliveries ? (
                      <p className="mt-2 text-xs text-text-muted">Loading deliveries...</p>
                    ) : detail.deliveries.length === 0 ? (
                      <p className="mt-2 text-xs text-text-muted">No deliveries yet.</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {detail.deliveries.slice(0, 20).map((delivery) => (
                          <li key={delivery.id} className="rounded-md border border-border bg-card px-3 py-2 text-xs">
                            <p className="font-medium text-text-primary">
                              {delivery.subject || 'Delivery'} · {delivery.status}
                            </p>
                            {delivery.body ? (
                              <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-text-secondary">{delivery.body}</p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
              <Button size="sm" variant="outline" asChild>
                <Link href={`/aiva/outreach/leads/${detailLead.id}`}>Open full page</Link>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void quick(detailLead.id, 'reply')}>
                Mark replied
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <Link href={`/aiva/outreach/bookings?leadId=${detailLead.id}`}>Book</Link>
              </Button>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
