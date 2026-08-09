'use client';

import { useMemo, useState } from 'react';
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

export function CrmLeadsGrid({
  leads,
  selected,
  onToggle,
  onToggleAll,
  onPatch,
  density = 'compact',
  busyId,
}: Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ id: string; column: string } | null>(null);
  const [draft, setDraft] = useState('');
  const columns = useMemo(
    () => CRM_DEFAULT_COLUMNS.filter((c) => !hidden.has(c.id)),
    [hidden],
  );
  const allIds = leads.map((l) => l.id);
  const pad = density === 'compact' ? 'px-2 py-1.5' : 'px-3 py-2.5';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
        <span>Columns:</span>
        {CRM_DEFAULT_COLUMNS.map((col) => (
          <label key={col.id} className="inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={!hidden.has(col.id)}
              onChange={() => {
                setHidden((prev) => {
                  const next = new Set(prev);
                  if (next.has(col.id)) next.delete(col.id);
                  else next.add(col.id);
                  return next;
                });
              }}
            />
            {col.label}
          </label>
        ))}
      </div>

      <div className="overflow-auto rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] max-h-[70vh]">
        <table className="min-w-[1600px] w-full border-collapse text-sm">
          <thead className="sticky top-0 z-20 bg-[var(--bg-elevated)] shadow-sm">
            <tr className="text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
              <th className={`${pad} sticky left-0 z-30 bg-[var(--bg-elevated)]`}>
                <input
                  type="checkbox"
                  checked={allIds.length > 0 && allIds.every((id) => selected.has(id))}
                  onChange={() => onToggleAll(allIds)}
                  aria-label="Select all visible leads"
                />
              </th>
              {columns.map((col) => (
                <th
                  key={col.id}
                  className={`${pad} whitespace-nowrap ${col.sticky ? 'sticky z-30 bg-[var(--bg-elevated)]' : ''} ${
                    col.id === 'company' ? 'left-10' : col.id === 'contactName' ? 'left-44' : ''
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-soft)]">
                <td className={`${pad} sticky left-0 z-10 bg-[var(--bg-elevated)]`}>
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
                  const stickyClass = col.sticky
                    ? `sticky z-10 bg-[var(--bg-elevated)] ${col.id === 'company' ? 'left-10' : 'left-44'}`
                    : '';
                  return (
                    <td
                      key={col.id}
                      className={`${pad} max-w-[14rem] ${stickyClass} ${busyId === lead.id ? 'opacity-60' : ''}`}
                      onDoubleClick={() => {
                        if (['sourceUrl', 'googleMapsUrl', 'website'].includes(col.id) && value) return;
                        setEditing({ id: lead.id, column: col.id });
                        setDraft(value);
                      }}
                      title={value}
                    >
                      {isEdit ? (
                        <input
                          className="w-full rounded border border-[var(--border)] bg-transparent px-1 py-0.5"
                          value={draft}
                          autoFocus
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={async () => {
                            setEditing(null);
                            if (draft !== value) {
                              await onPatch(lead.id, { [col.id]: draft });
                            }
                          }}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                            if (e.key === 'Escape') setEditing(null);
                          }}
                        />
                      ) : col.id === 'status' || col.id === 'pipelineStage' ? (
                        <span>{PIPELINE_LABELS[value] || value || ';'}</span>
                      ) : col.id === 'sourceType' ? (
                        <span className="inline-flex rounded-full bg-[var(--bg-soft)] px-2 py-0.5 text-xs">
                          {value || ';'}
                        </span>
                      ) : col.id === 'sourceUrl' || col.id === 'website' || col.id === 'googleMapsUrl' ? (
                        value ? (
                          <a
                            href={value.startsWith('http') ? value : `https://${value}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[var(--accent)] underline-offset-2 hover:underline truncate block"
                          >
                            {value}
                          </a>
                        ) : (
                          ';'
                        )
                      ) : (
                        <span className="truncate block">{value || ';'}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {leads.length === 0 && (
          <div className="p-8 text-center text-[var(--text-muted)]">
            No leads yet. Import a spreadsheet, scrape Companies House, add a manual lead, or connect Google Sheets.
          </div>
        )}
      </div>
    </div>
  );
}
