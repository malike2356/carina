'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { PIPELINE_LABELS, type OutreachLead, type PipelineStatus } from '@/components/outreach/types';

const STAGE_OPTIONS = Object.keys(PIPELINE_LABELS) as PipelineStatus[];

function exportCsv(leads: OutreachLead[]): void {
  const header = [
    'lead_id',
    'business_name',
    'contact_name',
    'email',
    'website',
    'source',
    'niche',
    'location',
    'status',
    'last_touch_at',
    'notes',
    'campaign_id',
  ];
  const lines = [
    header.join(','),
    ...leads.map((lead) =>
      [
        lead.id,
        JSON.stringify(lead.company ?? lead.name),
        JSON.stringify(lead.name),
        JSON.stringify(lead.email ?? ''),
        '""',
        lead.source,
        JSON.stringify(lead.tags?.[0] ?? ''),
        '""',
        lead.status,
        JSON.stringify(lead.lastContactedAt ?? lead.updatedAt ?? ''),
        JSON.stringify(lead.notes ?? ''),
        JSON.stringify(lead.campaignId ?? ''),
      ].join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aiva-crm-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCsvText(text: string): Array<{ name: string; email?: string; company?: string; source: 'csv_import' }> {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^name\s*,/i.test(line) && !/^lead_id\s*,/i.test(line))
    .map((line) => {
      const parts = line.split(',').map((part) => part.trim().replace(/^"|"$/g, ''));
      if (parts.length >= 4 && parts[0] && parts[0].includes('-') && /@/.test(parts[3] || '')) {
        // lead_id,business_name,contact_name,email,...
        return {
          name: parts[2] || parts[1] || 'Unknown',
          email: parts[3] || undefined,
          company: parts[1] || undefined,
          source: 'csv_import' as const,
        };
      }
      if (parts.length >= 3 && parts[0] && parts[0].includes('-') && parts[1]) {
        // lead_id,name,email,...
        return {
          name: parts[1] || 'Unknown',
          email: parts[2] || undefined,
          company: parts[3] || undefined,
          source: 'csv_import' as const,
        };
      }
      const [n, e, c] = parts;
      return { name: n || 'Unknown', email: e, company: c, source: 'csv_import' as const };
    });
}

export default function OutreachLeadsPage() {
  const { push } = useToast();
  const [leads, setLeads] = useState<OutreachLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [bulk, setBulk] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [linkedSheets, setLinkedSheets] = useState<Array<{
    id: string;
    name: string;
    kind: string;
    lastSyncAt?: string;
    googleSheetUrl?: string;
    googleSpreadsheetId?: string;
  }>>([]);

  const loadSheets = useCallback(() => {
    fetch('/api/aiva/outreach/lead-sheets')
      .then((res) => (res.ok ? res.json() : { sheets: [] }))
      .then((data: { sheets?: typeof linkedSheets }) => setLinkedSheets(data.sheets ?? []))
      .catch(() => setLinkedSheets([]));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (sourceFilter !== 'all') params.set('source', sourceFilter);
    const qs = params.toString();
    fetch(`/api/aiva/outreach/leads${qs ? `?${qs}` : ''}`)
      .then((res) => (res.ok ? res.json() : { leads: [] }))
      .then((data: { leads?: OutreachLead[] }) => setLeads(data.leads ?? []))
      .catch(() => setLeads([]))
      .finally(() => setLoading(false));
  }, [statusFilter, sourceFilter]);

  useEffect(() => {
    load();
    loadSheets();
  }, [load, loadSheets]);

  const createLeadSheet = useCallback(async () => {
    const res = await fetch('/api/aiva/outreach/lead-sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'CRM leads', seedFromLeads: true }),
    });
    if (!res.ok) {
      push('Could not create leads spreadsheet', 'error');
      return;
    }
    push('Leads spreadsheet created', 'success');
    loadSheets();
  }, [push, loadSheets]);

  const syncSheet = useCallback(async (sheetId: string) => {
    const res = await fetch(`/api/aiva/outreach/lead-sheets/${encodeURIComponent(sheetId)}/sync`, {
      method: 'POST',
    });
    if (!res.ok) {
      push('Sheet sync failed', 'error');
      return;
    }
    const data = await res.json() as { created?: number; duplicates?: number };
    push(`Synced sheet: ${data.created ?? 0} created, ${data.duplicates ?? 0} duplicates`, 'success');
    load();
    loadSheets();
  }, [push, load, loadSheets]);

  const pushSheet = useCallback(async (sheetId: string) => {
    const res = await fetch(`/api/aiva/outreach/lead-sheets/${encodeURIComponent(sheetId)}/push`, {
      method: 'POST',
    });
    if (!res.ok) {
      push('Could not push CRM leads into sheet', 'error');
      return;
    }
    const data = await res.json() as { count?: number };
    push(`Pushed ${data.count ?? 0} leads into sheet`, 'success');
    loadSheets();
  }, [push, loadSheets]);

  const renameSheet = useCallback(async (sheetId: string, currentName: string) => {
    const next = window.prompt('Rename lead file', currentName);
    if (next == null) return;
    const name = next.trim();
    if (!name || name === currentName) return;
    const res = await fetch(`/api/aiva/outreach/lead-sheets/${encodeURIComponent(sheetId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      push('Could not rename lead file', 'error');
      return;
    }
    push('Lead file renamed', 'success');
    loadSheets();
  }, [push, loadSheets]);

  const deleteSheet = useCallback(async (sheetId: string, sheetName: string) => {
    if (!window.confirm(`Delete lead file "${sheetName}"? CRM leads in the table stay; only this linked file is removed.`)) {
      return;
    }
    const res = await fetch(`/api/aiva/outreach/lead-sheets/${encodeURIComponent(sheetId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      push('Could not delete lead file', 'error');
      return;
    }
    push('Lead file deleted', 'success');
    loadSheets();
  }, [push, loadSheets]);

  const sources = useMemo(
    () => Array.from(new Set(leads.map((l) => l.source).filter(Boolean))).sort(),
    [leads],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((lead) =>
      [lead.name, lead.email, lead.company, lead.source, lead.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q));
  }, [leads, query]);

  const create = useCallback(async () => {
    if (!name.trim()) {
      push('Name is required', 'error');
      return;
    }
    const res = await fetch('/api/aiva/outreach/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, company, source: 'manual' }),
    });
    if (!res.ok) {
      push('Could not create lead', 'error');
      return;
    }
    setName('');
    setEmail('');
    setCompany('');
    push('Lead saved', 'success');
    load();
  }, [name, email, company, push, load]);

  const importRows = useCallback(async (rows: Array<{ name: string; email?: string; company?: string; source: 'csv_import' }>) => {
    if (rows.length === 0) {
      push('No rows to import', 'error');
      return;
    }
    const res = await fetch('/api/aiva/outreach/leads/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leads: rows }),
    });
    if (!res.ok) {
      push('Import failed', 'error');
      return;
    }
    const json = await res.json();
    push(`Imported ${json.created?.length ?? 0}; linked duplicates ${json.duplicates?.length ?? 0}`, 'success');
    load();
  }, [push, load]);

  const importBulk = useCallback(async () => {
    const rows = parseCsvText(bulk);
    await importRows(rows);
    setBulk('');
  }, [bulk, importRows]);

  const onFile = useCallback(async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    await importRows(parseCsvText(text));
  }, [importRows]);

  const setStage = useCallback(async (leadId: string, status: PipelineStatus) => {
    setBusyId(leadId);
    try {
      const res = await fetch(`/api/aiva/outreach/leads/${encodeURIComponent(leadId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        push('Could not update stage', 'error');
        return;
      }
      load();
    } finally {
      setBusyId(null);
    }
  }, [load, push]);

  const removeLead = useCallback(async (leadId: string) => {
    if (!window.confirm('Delete this lead?')) return;
    setBusyId(leadId);
    try {
      const res = await fetch(`/api/aiva/outreach/leads/${encodeURIComponent(leadId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        push('Could not delete lead', 'error');
        return;
      }
      push('Lead deleted', 'success');
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(leadId);
        return next;
      });
      load();
    } finally {
      setBusyId(null);
    }
  }, [load, push]);

  const bulkStage = useCallback(async (status: PipelineStatus) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    for (const id of ids) {
      await fetch(`/api/aiva/outreach/leads/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    }
    setSelected(new Set());
    push(`Updated ${ids.length} leads`, 'success');
    load();
  }, [selected, push, load]);

  const toggleAll = useCallback(() => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(filtered.map((l) => l.id)));
  }, [filtered, selected.size]);

  return (
    <div className="mx-auto max-w-[96rem] space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">CRM Leads</h2>
          <p className="mt-0.5 text-sm text-text-muted">
            Leads Aiva can contact for you. Import a sheet, then ask Aiva (web or Telegram) to reach out under Soft Wall.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void createLeadSheet()}>
            Create leads sheet
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportCsv(filtered)} disabled={filtered.length === 0}>
            Export CSV
          </Button>
          <label className="inline-flex cursor-pointer items-center rounded-md border border-border bg-elevated px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-card">
            Upload CSV
            <input
              type="file"
              accept=".csv,.tsv,.txt,text/csv"
              className="hidden"
              onChange={(e) => {
                void onFile(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
            />
          </label>
          <Button size="sm" variant="outline" asChild>
            <Link href="/aiva/outreach/pipeline">Pipeline board</Link>
          </Button>
        </div>
      </div>

      {linkedSheets.length > 0 ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-text-primary">Linked lead files</h3>
          <p className="mt-1 text-xs text-text-muted">
            These are spreadsheet handles. Delete removes the file link (and workspace CSV), not CRM table rows.
          </p>
          <ul className="mt-2 space-y-2 text-sm text-text-muted">
            {linkedSheets.map((sheet) => (
              <li key={sheet.id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-text-primary">{sheet.name}</span>
                <span>({sheet.kind})</span>
                {sheet.lastSyncAt ? <span>Last sync {new Date(sheet.lastSyncAt).toLocaleString()}</span> : null}
                {sheet.kind === 'workspace_csv' ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => void syncSheet(sheet.id)}>
                      Sync to CRM
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void pushSheet(sheet.id)}>
                      Push from CRM
                    </Button>
                  </>
                ) : null}
                <Button size="sm" variant="outline" onClick={() => void renameSheet(sheet.id, sheet.name)}>
                  Rename
                </Button>
                <Button size="sm" variant="outline" onClick={() => void deleteSheet(sheet.id, sheet.name)}>
                  Delete
                </Button>
                {sheet.googleSheetUrl || sheet.googleSpreadsheetId ? (
                  <a
                    className="text-xs underline"
                    href={sheet.googleSheetUrl || `https://docs.google.com/spreadsheets/d/${sheet.googleSpreadsheetId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open sheet
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-text-primary">Add lead</h3>
          <div className="mt-3 space-y-2">
            <input
              className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm"
              placeholder="Company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
            <Button size="sm" onClick={() => void create()}>
              Save lead
            </Button>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-text-primary">Paste CSV</h3>
          <p className="mt-1 text-xs text-text-muted">One lead per line: name,email,company</p>
          <textarea
            className="mt-3 h-28 w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm"
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder={'Ada Lovelace,ada@example.com,Analytical Engines'}
          />
          <Button size="sm" className="mt-2" onClick={() => void importBulk()}>
            Import paste
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="min-w-[12rem] flex-1 rounded-md border border-border bg-elevated px-3 py-2 text-sm"
          placeholder="Search name, email, company"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="rounded-md border border-border bg-elevated px-2 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All stages</option>
          {STAGE_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {PIPELINE_LABELS[status]}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-border bg-elevated px-2 py-2 text-sm"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
        >
          <option value="all">All sources</option>
          {sources.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>
        {selected.size > 0 ? (
          <>
            <select
              className="rounded-md border border-border bg-elevated px-2 py-2 text-sm"
              defaultValue=""
              onChange={(e) => {
                const value = e.target.value as PipelineStatus;
                if (!value) return;
                void bulkStage(value);
                e.target.value = '';
              }}
            >
              <option value="">Bulk stage ({selected.size})</option>
              {STAGE_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {PIPELINE_LABELS[status]}
                </option>
              ))}
            </select>
          </>
        ) : null}
        <span className="text-xs text-text-muted">{filtered.length} leads</span>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading leads...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-10 text-center">
          <p className="text-sm font-medium text-text-primary">No leads yet</p>
          <p className="mt-1 text-xs text-text-muted">
            Add a lead, upload a CSV, or ask Aiva to import from a sheet.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-elevated text-xs uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.size > 0 && selected.size === filtered.length}
                    onChange={toggleAll}
                    aria-label="Select all leads"
                  />
                </th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Stage</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr key={lead.id} className="border-t border-border bg-card hover:bg-elevated/40">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(lead.id)}
                      onChange={() => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(lead.id)) next.delete(lead.id);
                          else next.add(lead.id);
                          return next;
                        });
                      }}
                      aria-label={`Select ${lead.name}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/aiva/outreach/leads/${lead.id}`}
                      className="font-medium text-accent hover:underline"
                    >
                      {lead.name}
                    </Link>
                  </td>
                  <td className="max-w-[14rem] truncate px-3 py-2 text-text-secondary">
                    {lead.email || '-'}
                  </td>
                  <td className="max-w-[12rem] truncate px-3 py-2 text-text-secondary">
                    {lead.company || '-'}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="max-w-[9rem] rounded border border-border bg-elevated px-1.5 py-1 text-xs"
                      value={lead.status}
                      disabled={busyId === lead.id}
                      onChange={(e) => void setStage(lead.id, e.target.value as PipelineStatus)}
                    >
                      {STAGE_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {PIPELINE_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-xs text-text-muted">{lead.source}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-text-muted">
                    {lead.updatedAt ? new Date(lead.updatedAt).toLocaleString() : '-'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Link
                        href={`/aiva/outreach/leads/${lead.id}`}
                        className="rounded px-2 py-1 text-xs text-accent hover:bg-elevated"
                      >
                        Open
                      </Link>
                      <button
                        type="button"
                        className="rounded px-2 py-1 text-xs text-danger hover:bg-elevated"
                        disabled={busyId === lead.id}
                        onClick={() => void removeLead(lead.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
