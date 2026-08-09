'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CRM_DEFAULT_COLUMNS, PIPELINE_LABELS, type OutreachLead } from '@/components/outreach/types';

type Props = {
  leads: OutreachLead[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[]) => void;
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<void>;
  density?: 'compact' | 'comfortable';
  busyId?: string | null;
};

/** Optional columns hidden by default to keep the first view readable. */
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

const COL_MIN: Record<string, string> = {
  company: '12rem',
  contactName: '10rem',
  niche: '8rem',
  townCity: '8rem',
  website: '12rem',
  email: '12rem',
  phone: '8rem',
  notes: '14rem',
  status: '8rem',
  sourceType: '8rem',
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

function emptyMark(value: string): string {
  return value || '-';
}

export function CrmLeadsGrid({
  leads,
  selected,
  onToggle,
  onToggleAll,
  onPatch,
  density = 'compact',
  busyId,
}: Props) {
  const [hidden, setHidden] = useState<Set<string>>(DEFAULT_HIDDEN);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; column: string } | null>(null);
  const [draft, setDraft] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const columns = useMemo(
    () => CRM_DEFAULT_COLUMNS.filter((c) => !hidden.has(c.id)),
    [hidden],
  );
  const allIds = leads.map((l) => l.id);
  const pad = density === 'compact' ? 'px-3 py-2' : 'px-3 py-3';
  const visibleCount = columns.length;

  useEffect(() => {
    if (!columnsOpen) return;
    const onDoc = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setColumnsOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [columnsOpen]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-text-muted">
          {visibleCount} columns visible. Scroll horizontally for the rest.
        </p>
        <div className="relative" ref={panelRef}>
          <button
            type="button"
            className="rounded-md border border-border bg-elevated px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-overlay"
            onClick={() => setColumnsOpen((open) => !open)}
            aria-expanded={columnsOpen}
          >
            Columns ({visibleCount})
          </button>
          {columnsOpen ? (
            <div className="absolute right-0 z-40 mt-1 w-72 rounded-lg border border-border bg-elevated p-3 shadow-lg">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-text-primary">Show columns</span>
                <button
                  type="button"
                  className="text-[11px] text-accent"
                  onClick={() => setHidden(new Set())}
                >
                  Show all
                </button>
              </div>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {CRM_DEFAULT_COLUMNS.map((col) => (
                  <label key={col.id} className="flex items-center gap-2 rounded px-1 py-1 text-xs hover:bg-overlay">
                    <input
                      type="checkbox"
                      checked={!hidden.has(col.id)}
                      disabled={col.id === 'company'}
                      onChange={() => {
                        if (col.id === 'company') return;
                        setHidden((prev) => {
                          const next = new Set(prev);
                          if (next.has(col.id)) next.delete(col.id);
                          else next.add(col.id);
                          return next;
                        });
                      }}
                    />
                    <span>{col.label}</span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                className="mt-2 text-[11px] text-text-muted hover:text-text-primary"
                onClick={() => setHidden(new Set(DEFAULT_HIDDEN))}
              >
                Reset to default
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="overflow-auto rounded-xl border border-border bg-elevated max-h-[calc(100vh-16rem)]">
        <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-20">
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              <th
                className={`${pad} sticky left-0 z-30 w-10 border-b border-border bg-elevated`}
              >
                <input
                  type="checkbox"
                  checked={allIds.length > 0 && allIds.every((id) => selected.has(id))}
                  onChange={() => onToggleAll(allIds)}
                  aria-label="Select all visible leads"
                />
              </th>
              {columns.map((col) => {
                const sticky = col.id === 'company';
                return (
                  <th
                    key={col.id}
                    className={`${pad} border-b border-border bg-elevated whitespace-nowrap ${
                      sticky ? 'sticky left-10 z-30 shadow-[2px_0_0_0_var(--border)]' : ''
                    }`}
                    style={{ minWidth: COL_MIN[col.id] || '7.5rem' }}
                  >
                    {col.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="group hover:bg-overlay/40">
                <td className={`${pad} sticky left-0 z-10 border-b border-border bg-elevated group-hover:bg-elevated`}>
                  <input
                    type="checkbox"
                    checked={selected.has(lead.id)}
                    onChange={() => onToggle(lead.id)}
                    aria-label={`Select ${lead.company || lead.name}`}
                  />
                </td>
                {columns.map((col) => {
                  const value = cellValue(lead, col.id);
                  const isEdit = editing?.id === lead.id && editing.column === col.id;
                  const sticky = col.id === 'company';
                  return (
                    <td
                      key={col.id}
                      className={`${pad} border-b border-border align-top ${
                        sticky
                          ? 'sticky left-10 z-10 bg-elevated shadow-[2px_0_0_0_var(--border)] group-hover:bg-elevated'
                          : 'bg-elevated group-hover:bg-transparent'
                      } ${busyId === lead.id ? 'opacity-60' : ''}`}
                      style={{ minWidth: COL_MIN[col.id] || '7.5rem', maxWidth: '16rem' }}
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
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={async () => {
                            setEditing(null);
                            if (draft !== value) {
                              await onPatch(lead.id, { [col.id]: draft });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            if (e.key === 'Escape') setEditing(null);
                          }}
                        />
                      ) : col.id === 'status' || col.id === 'pipelineStage' ? (
                        <span className="whitespace-nowrap">{PIPELINE_LABELS[value] || emptyMark(value)}</span>
                      ) : col.id === 'sourceType' ? (
                        <span className="inline-flex rounded bg-overlay px-1.5 py-0.5 text-[11px]">
                          {emptyMark(value)}
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
                        <span className="block truncate">{emptyMark(value)}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {leads.length === 0 && (
          <div className="border-t border-border p-10 text-center text-sm text-text-muted">
            No leads yet. Use Add / Import above, scrape Companies House, or connect Google Sheets.
          </div>
        )}
      </div>
    </div>
  );
}
