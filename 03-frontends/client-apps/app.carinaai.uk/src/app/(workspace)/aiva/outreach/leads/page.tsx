'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { CrmLeadsGrid } from '@/components/outreach/CrmLeadsGrid';
import { PIPELINE_LABELS, type OutreachLead, type PipelineStatus } from '@/components/outreach/types';

const STAGE_OPTIONS = Object.keys(PIPELINE_LABELS) as PipelineStatus[];
const SAVED_VIEWS = [
  { id: 'all', label: 'All Leads', status: 'all' },
  { id: 'new', label: 'New Scraped Leads', status: 'new' },
  { id: 'enriched', label: 'Needs Enrichment', status: 'enriched' },
  { id: 'ready', label: 'Ready for Outreach', status: 'ready' },
  { id: 'contacted', label: 'Contacted', status: 'contacted' },
  { id: 'replied', label: 'Replied', status: 'replied' },
  { id: 'qualified', label: 'Qualified', status: 'qualified' },
  { id: 'won', label: 'Customer', status: 'won' },
  { id: 'suppressed', label: 'Suppressed', status: 'suppressed' },
] as const;

function parseCsvText(text: string): Array<Record<string, string>> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0]!.split(',').map((part) => part.trim().replace(/^"|"$/g, ''));
  const looksLikeHeader = header.some((h) => /company|email|contact|name|niche/i.test(h));
  const start = looksLikeHeader ? 1 : 0;
  return lines.slice(start).map((line) => {
    const parts = line.split(',').map((part) => part.trim().replace(/^"|"$/g, ''));
    if (looksLikeHeader) {
      const row: Record<string, string> = {};
      header.forEach((key, idx) => {
        row[key] = parts[idx] || '';
      });
      return row;
    }
    return {
      name: parts[0] || 'Unknown',
      email: parts[1] || '',
      company: parts[2] || '',
    };
  });
}

export default function OutreachLeadsPage() {
  const { push } = useToast();
  const [leads, setLeads] = useState<OutreachLead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [bulk, setBulk] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [nicheFilter, setNicheFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [hasEmailOnly, setHasEmailOnly] = useState(false);
  const [density, setDensity] = useState<'compact' | 'comfortable'>('compact');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<Array<Record<string, string>>>([]);
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
    if (nicheFilter.trim()) params.set('niche', nicheFilter.trim());
    if (priorityFilter.trim()) params.set('priority', priorityFilter.trim());
    if (query.trim()) params.set('q', query.trim());
    if (hasEmailOnly) params.set('hasEmail', 'true');
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    fetch(`/api/aiva/outreach/leads?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : { leads: [], total: 0 }))
      .then((data: { leads?: OutreachLead[]; total?: number }) => {
        setLeads(data.leads ?? []);
        setTotal(data.total ?? data.leads?.length ?? 0);
      })
      .catch(() => {
        setLeads([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [statusFilter, sourceFilter, nicheFilter, priorityFilter, query, hasEmailOnly, page, pageSize]);

  useEffect(() => {
    load();
    loadSheets();
  }, [load, loadSheets]);

  const sources = useMemo(
    () => Array.from(new Set(leads.map((l) => l.sourceType || l.source).filter(Boolean))).sort(),
    [leads],
  );

  const create = useCallback(async () => {
    if (!name.trim() && !company.trim()) {
      push('Company or contact name is required', 'error');
      return;
    }
    const res = await fetch('/api/aiva/outreach/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name || company, email, company, source: 'manual' }),
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

  const importRows = useCallback(async (rows: Array<Record<string, string>>) => {
    if (rows.length === 0) {
      push('No rows to import', 'error');
      return;
    }
    const res = await fetch('/api/aiva/outreach/leads/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leads: rows, sourceType: 'upload' }),
    });
    if (!res.ok) {
      push('Import failed', 'error');
      return;
    }
    const json = await res.json();
    push(
      `Imported ${json.created?.length ?? json.created ?? 0}; linked duplicates ${json.duplicates?.length ?? json.duplicate ?? 0}`,
      'success',
    );
    setImportPreview([]);
    load();
  }, [push, load]);

  const importBulk = useCallback(async () => {
    const rows = parseCsvText(bulk);
    setImportPreview(rows.slice(0, 5));
    await importRows(rows);
    setBulk('');
  }, [bulk, importRows]);

  const onFile = useCallback(async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    const rows = parseCsvText(text);
    setImportPreview(rows.slice(0, 5));
    await importRows(rows);
  }, [importRows]);

  const patchLead = useCallback(async (leadId: string, patch: Record<string, unknown>) => {
    setBusyId(leadId);
    try {
      const res = await fetch(`/api/aiva/outreach/leads/${encodeURIComponent(leadId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        push('Could not update lead', 'error');
        return;
      }
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

  const exportLeads = useCallback(() => {
    window.location.href = '/api/aiva/outreach/leads/export?format=workbook';
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">CRM Leads</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Spreadsheet-style lead table with source provenance, campaigns, and funnel stages.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={exportLeads}>Export CSV</Button>
          <Button size="sm" variant="outline" onClick={() => void createLeadSheet()}>Connect sheet</Button>
          <Link href="/aiva/outreach" className="rounded-md border border-border px-3 py-1.5 text-sm">
            Outreach overview
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {SAVED_VIEWS.map((view) => (
          <button
            key={view.id}
            type="button"
            className={`rounded-full px-3 py-1 text-xs ${
              statusFilter === view.status
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-soft)] text-[var(--text-muted)]'
            }`}
            onClick={() => {
              setStatusFilter(view.status);
              setPage(1);
            }}
          >
            {view.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <h2 className="text-sm font-medium">Manual lead</h2>
          <input className="mt-2 w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm" placeholder="Contact name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="mt-2 w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm" placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
          <input className="mt-2 w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button size="sm" className="mt-2" onClick={() => void create()}>Add lead</Button>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <h2 className="text-sm font-medium">Import CSV / paste</h2>
          <input type="file" accept=".csv,.tsv,.txt" className="mt-2 block w-full text-xs" onChange={(e) => void onFile(e.target.files?.[0] ?? null)} />
          <textarea
            className="mt-2 h-24 w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-xs"
            placeholder="Paste workbook rows (header optional)"
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
          />
          <Button size="sm" className="mt-2" onClick={() => void importBulk()}>Import paste</Button>
          {importPreview.length > 0 ? (
            <p className="mt-2 text-xs text-[var(--text-muted)]">Preview mapped {importPreview.length} sample rows.</p>
          ) : null}
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <h2 className="text-sm font-medium">Linked sheets</h2>
          {linkedSheets.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--text-muted)]">No linked sheet yet. Create one or ask Aiva to connect Google Sheets.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {linkedSheets.map((sheet) => (
                <li key={sheet.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{sheet.name}</span>
                  <button type="button" className="text-xs text-[var(--accent)]" onClick={() => void syncSheet(sheet.id)}>
                    Sync
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            Empty state actions: scrape, import, Companies House, manual lead, or Google Sheet.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="min-w-[12rem] flex-1 rounded-md border border-border bg-elevated px-3 py-2 text-sm"
          placeholder="Search company, contact, email, niche, town"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="rounded-md border border-border bg-elevated px-2 py-2 text-sm"
          value={sourceFilter}
          onChange={(e) => {
            setSourceFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">All sources</option>
          {sources.map((source) => (
            <option key={source} value={source}>{source}</option>
          ))}
        </select>
        <input
          className="rounded-md border border-border bg-elevated px-2 py-2 text-sm"
          placeholder="Niche"
          value={nicheFilter}
          onChange={(e) => {
            setNicheFilter(e.target.value);
            setPage(1);
          }}
        />
        <input
          className="rounded-md border border-border bg-elevated px-2 py-2 text-sm"
          placeholder="Priority"
          value={priorityFilter}
          onChange={(e) => {
            setPriorityFilter(e.target.value);
            setPage(1);
          }}
        />
        <label className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
          <input type="checkbox" checked={hasEmailOnly} onChange={(e) => { setHasEmailOnly(e.target.checked); setPage(1); }} />
          Has email
        </label>
        <select
          className="rounded-md border border-border bg-elevated px-2 py-2 text-sm"
          value={density}
          onChange={(e) => setDensity(e.target.value as 'compact' | 'comfortable')}
        >
          <option value="compact">Compact</option>
          <option value="comfortable">Comfortable</option>
        </select>
        {selected.size > 0 ? (
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
              <option key={status} value={status}>{PIPELINE_LABELS[status]}</option>
            ))}
          </select>
        ) : null}
        <span className="text-xs text-text-muted">{total} leads</span>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading leads...</p>
      ) : (
        <CrmLeadsGrid
          leads={leads}
          selected={selected}
          density={density}
          busyId={busyId}
          onToggle={(id) => {
            setSelected((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            });
          }}
          onToggleAll={(ids) => {
            setSelected((prev) => {
              const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
              return allSelected ? new Set() : new Set(ids);
            });
          }}
          onPatch={patchLead}
        />
      )}

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          className="rounded border border-border px-3 py-1 disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Previous
        </button>
        <span className="text-[var(--text-muted)]">Page {page} / {totalPages}</span>
        <button
          type="button"
          className="rounded border border-border px-3 py-1 disabled:opacity-40"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          Next
        </button>
      </div>
    </div>
  );
}
