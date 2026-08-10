'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { CRM_DEFAULT_COLUMNS, PIPELINE_LABELS, type OutreachLead } from '@/components/outreach/types';

export type GridDensity = 'compact' | 'comfortable' | 'spacious';

export type GridPrefs = {
  hiddenColumns?: string[];
  columnOrder?: string[];
  columnWidths?: Record<string, number>;
  density?: GridDensity;
};

type Props = {
  leads: OutreachLead[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[]) => void;
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onOpenActivity?: (lead: OutreachLead) => void;
  onPrefsChange?: (prefs: GridPrefs) => void;
  prefs?: GridPrefs;
  density?: GridDensity;
  busyId?: string | null;
  /** Controls rendered in the same wrap row as Status / Booking / Reply / Columns. */
  toolbarLeading?: ReactNode;
};

const DEFAULT_HIDDEN = new Set([
  'googleReviews',
  'googleRating',
  'googleMapsUrl',
  'websiteScore',
  'ranksTop3',
  'weakness',
  'sourceUrl',
  'pipelineStage',
  'lastContactedAt',
  'lastReplyAt',
  'nextActionAt',
  'ownerWorkerId',
]);

const COL_DEFAULT_WIDTH: Record<string, number> = {
  company: 180,
  contactName: 150,
  niche: 120,
  townCity: 120,
  website: 160,
  email: 180,
  phone: 120,
  notes: 200,
  status: 120,
  sourceType: 110,
  priority: 90,
};

function cellValue(lead: OutreachLead, columnId: string): string {
  const custom = lead.customFields?.[columnId];
  const record = lead as unknown as Record<string, unknown>;
  const raw = record[columnId] ?? custom;
  if (raw === undefined || raw === null) {
    if (columnId === 'contactName') return lead.contactName || lead.name || '';
    if (columnId === 'dateAdded') return lead.dateAdded || lead.createdAt || '';
    if (columnId === 'sourceType') return lead.sourceType || lead.source || '';
    if (columnId === 'pipelineStage') return lead.pipelineStage || lead.status || '';
    if (columnId === 'ownerWorkerId') return lead.ownerWorkerId || lead.owner || '';
    return '';
  }
  if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';
  return String(raw);
}

function isValidEmail(value: string): boolean {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function statusIndicators(lead: OutreachLead): string[] {
  const out: string[] = [];
  if (!lead.email) out.push('No email');
  else if (!isValidEmail(lead.email)) out.push('Invalid email');
  if (lead.status === 'suppressed' || lead.consentStatus === 'opted_out' || lead.consentStatus === 'suppressed') {
    out.push('Suppressed');
  }
  if (lead.status === 'contacted') out.push('Contacted');
  if (lead.status === 'replied' || lead.replyState === 'replied') out.push('Replied');
  if (lead.status === 'booked' || lead.bookingState === 'booked') out.push('Booked');
  if (lead.status === 'won') out.push('Customer');
  if (lead.customFields?.awaitingApproval) out.push('Awaiting approval');
  return out;
}

type UndoEntry = { leadId: string; column: string; previous: string; next: string };

export function CrmLeadsGrid({
  leads,
  selected,
  onToggle,
  onToggleAll,
  onPatch,
  onOpenActivity,
  onPrefsChange,
  prefs,
  density = 'compact',
  busyId,
  toolbarLeading,
}: Props) {
  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set(prefs?.hiddenColumns ?? Array.from(DEFAULT_HIDDEN)),
  );
  const [order, setOrder] = useState<string[]>(
    () => prefs?.columnOrder ?? CRM_DEFAULT_COLUMNS.map((c) => c.id),
  );
  const [widths, setWidths] = useState<Record<string, number>>(
    () => prefs?.columnWidths ?? {},
  );
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; column: string } | null>(null);
  const [draft, setDraft] = useState('');
  const [focus, setFocus] = useState<{ row: number; col: number } | null>(null);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [dragCol, setDragCol] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [bookingFilter, setBookingFilter] = useState<string>('all');
  const [replyFilter, setReplyFilter] = useState<string>('all');
  const panelRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{ id: string; startX: number; startW: number } | null>(null);

  useEffect(() => {
    if (prefs?.hiddenColumns) setHidden(new Set(prefs.hiddenColumns));
    if (prefs?.columnOrder?.length) setOrder(prefs.columnOrder);
    if (prefs?.columnWidths) setWidths(prefs.columnWidths);
  }, [prefs]);

  const emitPrefs = useCallback((next: {
    hidden?: Set<string>;
    order?: string[];
    widths?: Record<string, number>;
  }) => {
    onPrefsChange?.({
      hiddenColumns: Array.from(next.hidden ?? hidden),
      columnOrder: next.order ?? order,
      columnWidths: next.widths ?? widths,
      density,
    });
  }, [hidden, order, widths, density, onPrefsChange]);

  const columns = useMemo(() => {
    const byId = new Map(CRM_DEFAULT_COLUMNS.map((c) => [c.id, c]));
    const ordered = order
      .map((id) => byId.get(id))
      .filter(Boolean) as Array<typeof CRM_DEFAULT_COLUMNS[number]>;
    for (const col of CRM_DEFAULT_COLUMNS) {
      if (!ordered.find((c) => c.id === col.id)) ordered.push(col);
    }
    return ordered.filter((c) => !hidden.has(c.id));
  }, [hidden, order]);

  const visibleLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (statusFilter !== 'all' && lead.status !== statusFilter) return false;
      if (bookingFilter !== 'all' && (lead.bookingState || 'none') !== bookingFilter) return false;
      if (replyFilter !== 'all' && (lead.replyState || 'none') !== replyFilter) return false;
      return true;
    });
  }, [leads, statusFilter, bookingFilter, replyFilter]);

  const allIds = visibleLeads.map((l) => l.id);
  const pad = density === 'compact' ? 'px-2 py-1.5' : density === 'spacious' ? 'px-3 py-3.5' : 'px-3 py-2.5';
  const companyLeft = 40;
  const contactLeft = companyLeft + (widths.company || COL_DEFAULT_WIDTH.company || 180);

  useEffect(() => {
    if (!columnsOpen) return;
    const onDoc = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setColumnsOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [columnsOpen]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = e.clientX - resizeRef.current.startX;
      const nextW = Math.max(80, resizeRef.current.startW + delta);
      setWidths((prev) => {
        const next = { ...prev, [resizeRef.current!.id]: nextW };
        return next;
      });
    };
    const onUp = () => {
      if (!resizeRef.current) return;
      resizeRef.current = null;
      setWidths((prev) => {
        emitPrefs({ widths: prev });
        return prev;
      });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [emitPrefs]);

  const commitEdit = useCallback(async (leadId: string, column: string, previous: string, next: string) => {
    if (previous === next) return;
    if (column === 'email' && next && !isValidEmail(next)) {
      return;
    }
    setUndoStack((stack) => [...stack.slice(-19), { leadId, column, previous, next }]);
    await onPatch(leadId, { [column]: next });
  }, [onPatch]);

  const undo = useCallback(async () => {
    const entry = undoStack[undoStack.length - 1];
    if (!entry) return;
    setUndoStack((s) => s.slice(0, -1));
    await onPatch(entry.leadId, { [entry.column]: entry.previous });
  }, [undoStack, onPatch]);

  const copySelection = useCallback(async () => {
    if (!focus) return;
    const lead = visibleLeads[focus.row];
    const col = columns[focus.col];
    if (!lead || !col) return;
    const text = cellValue(lead, col.id);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }, [focus, visibleLeads, columns]);

  const onKeyDown = useCallback(async (e: KeyboardEvent) => {
    if (editing) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      await undo();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      await copySelection();
      return;
    }
    if (!focus) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocus((f) => f ? { ...f, row: Math.min(visibleLeads.length - 1, f.row + 1) } : f);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocus((f) => f ? { ...f, row: Math.max(0, f.row - 1) } : f);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setFocus((f) => f ? { ...f, col: Math.min(columns.length - 1, f.col + 1) } : f);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setFocus((f) => f ? { ...f, col: Math.max(0, f.col - 1) } : f);
    } else if (e.key === 'Enter' && focus) {
      const lead = visibleLeads[focus.row];
      const col = columns[focus.col];
      if (lead && col) {
        setEditing({ id: lead.id, column: col.id });
        setDraft(cellValue(lead, col.id));
      }
    } else if (e.key === ' ' && focus) {
      e.preventDefault();
      const lead = visibleLeads[focus.row];
      if (lead) onToggle(lead.id);
    }
  }, [editing, focus, visibleLeads, columns, undo, copySelection, onToggle]);

  const stickyFor = (colId: string): { sticky: boolean; left: number } => {
    if (colId === 'company') return { sticky: true, left: companyLeft };
    if (colId === 'contactName') return { sticky: true, left: contactLeft };
    return { sticky: false, left: 0 };
  };

  return (
    <div className="space-y-2" onKeyDown={onKeyDown} tabIndex={0} role="grid" aria-label="CRM leads spreadsheet">
      <div className="flex flex-nowrap items-center gap-x-1.5 overflow-x-auto rounded-md border border-border bg-elevated p-1.5">
        {toolbarLeading}
        <label className="inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap text-xs text-text-muted">
          Status
          <select
            className="h-7 rounded border border-border bg-transparent px-1.5 text-xs"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All</option>
            {Object.keys(PIPELINE_LABELS).map((status) => (
              <option key={status} value={status}>{PIPELINE_LABELS[status as keyof typeof PIPELINE_LABELS] ?? status}</option>
            ))}
          </select>
        </label>
        <label className="inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap text-xs text-text-muted">
          Booking
          <select
            className="h-7 rounded border border-border bg-transparent px-1.5 text-xs"
            value={bookingFilter}
            onChange={(e) => setBookingFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="none">None</option>
            <option value="offered">Offered</option>
            <option value="booked">Booked</option>
            <option value="attended">Attended</option>
            <option value="no_show">No-show</option>
          </select>
        </label>
        <label className="inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap text-xs text-text-muted">
          Reply
          <select
            className="h-7 rounded border border-border bg-transparent px-1.5 text-xs"
            value={replyFilter}
            onChange={(e) => setReplyFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="none">None</option>
            <option value="replied">Replied</option>
            <option value="unsubscribed">Unsubscribed</option>
          </select>
        </label>
        <span className="shrink-0 whitespace-nowrap text-xs text-text-muted">
          {visibleLeads.length}/{leads.length}
        </span>
        <span className="hidden shrink-0 whitespace-nowrap text-[11px] text-text-muted xl:inline" title="Frozen: selection, Company, Contact. Arrow keys move; Enter edits; Ctrl/Cmd+Z undoes.">
          {columns.length} cols
        </span>
        <button
          type="button"
          className="h-7 shrink-0 rounded-md border border-border bg-transparent px-2.5 text-xs disabled:opacity-40"
          disabled={undoStack.length === 0}
          onClick={() => void undo()}
        >
          Undo
        </button>
        <div className="relative shrink-0" ref={panelRef}>
          <button
            type="button"
            className="h-7 rounded-md border border-border bg-transparent px-2.5 text-xs font-medium text-text-primary hover:bg-overlay"
            onClick={() => setColumnsOpen((open) => !open)}
            aria-expanded={columnsOpen}
          >
            Columns ({columns.length})
          </button>
          {columnsOpen ? (
            <div className="absolute right-0 z-40 mt-1 w-80 rounded-lg border border-border bg-elevated p-3 shadow-lg">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-text-primary">Show / reorder</span>
                <button
                  type="button"
                  className="text-[11px] text-accent"
                  onClick={() => {
                    const next = new Set<string>();
                    setHidden(next);
                    emitPrefs({ hidden: next });
                  }}
                >
                  Show all
                </button>
              </div>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {order.map((id) => {
                  const col = CRM_DEFAULT_COLUMNS.find((c) => c.id === id);
                  if (!col) return null;
                  return (
                    <div
                      key={col.id}
                      className="flex items-center gap-2 rounded px-1 py-1 text-xs hover:bg-overlay"
                      draggable
                      onDragStart={() => setDragCol(col.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (!dragCol || dragCol === col.id) return;
                          setOrder((prev) => {
                            const next = prev.filter((x) => x !== dragCol);
                            const idx = next.indexOf(col.id);
                            next.splice(idx, 0, dragCol);
                            emitPrefs({ order: next });
                            return next;
                          });
                          setDragCol(null);
                        }}
                      >
                        <span className="cursor-grab text-text-muted" aria-hidden>⋮⋮</span>
                        <input
                          type="checkbox"
                          checked={!hidden.has(col.id)}
                          disabled={col.id === 'company' || col.id === 'contactName'}
                          onChange={() => {
                            if (col.id === 'company' || col.id === 'contactName') return;
                            setHidden((prev) => {
                              const next = new Set(prev);
                              if (next.has(col.id)) next.delete(col.id);
                              else next.add(col.id);
                              emitPrefs({ hidden: next });
                              return next;
                            });
                          }}
                        />
                        <span>{col.label}</span>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="mt-2 text-[11px] text-text-muted hover:text-text-primary"
                  onClick={() => {
                    const nextHidden = new Set(DEFAULT_HIDDEN);
                    const nextOrder = CRM_DEFAULT_COLUMNS.map((c) => c.id);
                    setHidden(nextHidden);
                    setOrder(nextOrder);
                    setWidths({});
                    emitPrefs({ hidden: nextHidden, order: nextOrder, widths: {} });
                  }}
                >
                  Reset to default
                </button>
              </div>
            ) : null}
          </div>
      </div>

      {/* Desktop spreadsheet */}
      <div className="hidden overflow-auto rounded-xl border border-border bg-elevated max-h-[calc(100vh-16rem)] md:block">
        <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-20">
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              <th className={`${pad} sticky left-0 z-30 w-10 border-b border-border bg-elevated`}>
                <input
                  type="checkbox"
                  checked={allIds.length > 0 && allIds.every((id) => selected.has(id))}
                  onChange={() => onToggleAll(allIds)}
                  aria-label="Select all visible leads"
                />
              </th>
              {columns.map((col) => {
                const { sticky, left } = stickyFor(col.id);
                const width = widths[col.id] || COL_DEFAULT_WIDTH[col.id] || 120;
                return (
                  <th
                    key={col.id}
                    className={`${pad} relative border-b border-border bg-elevated whitespace-nowrap ${
                      sticky ? 'sticky z-30 shadow-[2px_0_0_0_var(--border)]' : ''
                    }`}
                    style={{ minWidth: width, width, left: sticky ? left : undefined }}
                  >
                    {col.label}
                    <span
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-accent/40"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        resizeRef.current = { id: col.id, startX: e.clientX, startW: width };
                      }}
                      aria-hidden
                    />
                  </th>
                );
              })}
              <th className={`${pad} border-b border-border bg-elevated`}>Flags</th>
            </tr>
          </thead>
          <tbody>
            {visibleLeads.map((lead, rowIdx) => (
              <tr key={lead.id} className="group hover:bg-overlay/40">
                <td className={`${pad} sticky left-0 z-10 border-b border-border bg-elevated group-hover:bg-elevated`}>
                  <input
                    type="checkbox"
                    checked={selected.has(lead.id)}
                    onChange={() => onToggle(lead.id)}
                    aria-label={`Select ${lead.company || lead.name}`}
                  />
                </td>
                {columns.map((col, colIdx) => {
                  const value = cellValue(lead, col.id);
                  const isEdit = editing?.id === lead.id && editing.column === col.id;
                  const { sticky, left } = stickyFor(col.id);
                  const width = widths[col.id] || COL_DEFAULT_WIDTH[col.id] || 120;
                  const focused = focus?.row === rowIdx && focus?.col === colIdx;
                  return (
                    <td
                      key={col.id}
                      className={`${pad} border-b border-border align-top ${
                        sticky
                          ? 'sticky z-10 bg-elevated shadow-[2px_0_0_0_var(--border)] group-hover:bg-elevated'
                          : 'bg-elevated group-hover:bg-transparent'
                      } ${busyId === lead.id ? 'opacity-60' : ''} ${focused ? 'ring-1 ring-inset ring-accent' : ''}`}
                      style={{ minWidth: width, width, maxWidth: width, left: sticky ? left : undefined }}
                      onClick={() => setFocus({ row: rowIdx, col: colIdx })}
                      onDoubleClick={() => {
                        if (['sourceUrl', 'googleMapsUrl', 'website'].includes(col.id) && value) return;
                        setEditing({ id: lead.id, column: col.id });
                        setDraft(value);
                      }}
                      title={value}
                    >
                      {isEdit ? (
                        <input
                          className="w-full rounded border border-border bg-transparent px-1 py-0.5"
                          value={draft}
                          autoFocus
                          aria-label={`Edit ${col.label}`}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={async () => {
                            setEditing(null);
                            await commitEdit(lead.id, col.id, value, draft);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            if (e.key === 'Escape') setEditing(null);
                          }}
                        />
                      ) : col.id === 'status' || col.id === 'pipelineStage' ? (
                        <span className="whitespace-nowrap">{PIPELINE_LABELS[value] || value || '-'}</span>
                      ) : col.id === 'sourceType' ? (
                        <span className="inline-flex rounded bg-overlay px-1.5 py-0.5 text-[11px]">
                          {value || '-'}
                        </span>
                      ) : col.id === 'sourceUrl' || col.id === 'website' || col.id === 'googleMapsUrl' ? (
                        value ? (
                          <a
                            href={value.startsWith('http') ? value : `https://${value}`}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate text-accent hover:underline"
                          >
                            {value}
                          </a>
                        ) : (
                          <span className="text-text-muted">-</span>
                        )
                      ) : (
                        <span className="block truncate">{value || '-'}</span>
                      )}
                    </td>
                  );
                })}
                <td className={`${pad} border-b border-border`}>
                  <div className="flex flex-wrap gap-1">
                    {statusIndicators(lead).map((flag) => (
                      <span key={flag} className="rounded bg-overlay px-1.5 py-0.5 text-[10px] text-text-muted">
                        {flag}
                      </span>
                    ))}
                    {onOpenActivity ? (
                      <button
                        type="button"
                        className="text-[10px] text-accent"
                        onClick={() => onOpenActivity(lead)}
                      >
                        Activity
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibleLeads.length === 0 && (
          <div className="border-t border-border p-10 text-center text-sm text-text-muted">
            {leads.length === 0
              ? 'No leads yet. Use Add / Import above, scrape Companies House, or connect Google Sheets.'
              : 'No leads match the current status / booking / reply filters.'}
          </div>
        )}
      </div>

      {/* Mobile card / reduced-column mode */}
      <div className="space-y-2 md:hidden">
        {visibleLeads.map((lead) => (
          <article key={lead.id} className="rounded-lg border border-border bg-elevated p-3">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={selected.has(lead.id)}
                onChange={() => onToggle(lead.id)}
                aria-label={`Select ${lead.company || lead.name}`}
              />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-text-primary">
                  {lead.company || lead.name || 'Untitled'}
                </h3>
                <p className="truncate text-xs text-text-muted">
                  {lead.contactName || lead.name || '-'} · {lead.email || 'No email'}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {PIPELINE_LABELS[lead.status] || lead.status}
                  {lead.niche ? ` · ${lead.niche}` : ''}
                  {lead.townCity ? ` · ${lead.townCity}` : ''}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {statusIndicators(lead).map((flag) => (
                    <span key={flag} className="rounded bg-overlay px-1.5 py-0.5 text-[10px]">{flag}</span>
                  ))}
                </div>
                {onOpenActivity ? (
                  <button type="button" className="mt-2 text-xs text-accent" onClick={() => onOpenActivity(lead)}>
                    Open activity
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        ))}
        {visibleLeads.length === 0 ? (
          <p className="p-6 text-center text-sm text-text-muted">
            {leads.length === 0 ? 'No leads yet.' : 'No leads match the current filters.'}
          </p>
        ) : null}
      </div>
    </div>
  );
}
