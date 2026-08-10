'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { CrmLeadsGrid, type GridDensity, type GridPrefs } from '@/components/outreach/CrmLeadsGrid';
import { CRM_DEFAULT_COLUMNS, PIPELINE_LABELS, type OutreachLead, type PipelineStatus } from '@/components/outreach/types';

const STAGE_OPTIONS = Object.keys(PIPELINE_LABELS) as PipelineStatus[];
const BUILTIN_VIEWS = [
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

type SavedView = {
  id: string;
  name: string;
  filters?: Record<string, unknown>;
  shared?: boolean;
};

type ActivityPayload = {
  timeline?: Array<{ at?: string; kind?: string; message?: string }>;
  deliveries?: Array<{ id: string; status: string; subject?: string }>;
  providerEvents?: Array<Record<string, unknown>>;
  enrollments?: Array<{ id: string; status?: string }>;
  bookings?: Array<{ id: string; startsAt?: string }>;
  provenance?: Record<string, unknown>;
};

function parseDelimited(text: string, delimiter = ','): { headers: string[]; rows: Array<Record<string, string>> } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };
  const split = (line: string) => line.split(delimiter).map((p) => p.trim().replace(/^"|"$/g, ''));
  const headers = split(lines[0]!);
  const looksLikeHeader = headers.some((h) => /company|email|contact|name|niche/i.test(h));
  if (!looksLikeHeader) {
    return {
      headers: ['name', 'email', 'company'],
      rows: lines.map((line) => {
        const parts = split(line);
        return { name: parts[0] || 'Unknown', email: parts[1] || '', company: parts[2] || '' };
      }),
    };
  }
  const rows = lines.slice(1).map((line) => {
    const parts = split(line);
    const row: Record<string, string> = {};
    headers.forEach((key, idx) => { row[key] = parts[idx] || ''; });
    return row;
  });
  return { headers, rows };
}

const TARGET_FIELDS = CRM_DEFAULT_COLUMNS.map((c) => c.id);

function autoMapHeaders(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const h of headers) {
    const key = h.toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = TARGET_FIELDS.find((f) => f.toLowerCase() === key)
      || TARGET_FIELDS.find((f) => key.includes(f.toLowerCase()) || f.toLowerCase().includes(key));
    if (match) map[h] = match;
    else if (/company/.test(key)) map[h] = 'company';
    else if (/contact|fullname/.test(key)) map[h] = 'contactName';
    else if (/email|mail/.test(key)) map[h] = 'email';
    else if (/town|city/.test(key)) map[h] = 'townCity';
    else if (/phone|mobile/.test(key)) map[h] = 'phone';
  }
  return map;
}

export default function OutreachLeadsPage() {
  const { push } = useToast();
  const [leads, setLeads] = useState<OutreachLead[]>([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<Array<string | null>>([null]);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [nicheFilter, setNicheFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [hasEmailOnly, setHasEmailOnly] = useState(false);
  const [density, setDensity] = useState<GridDensity>('compact');
  const [gridPrefs, setGridPrefs] = useState<GridPrefs>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showIngest, setShowIngest] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardHeaders, setWizardHeaders] = useState<string[]>([]);
  const [wizardRows, setWizardRows] = useState<Array<Record<string, string>>>([]);
  const [wizardMap, setWizardMap] = useState<Record<string, string>>({});
  const [wizardDedupe, setWizardDedupe] = useState(true);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [lists, setLists] = useState<Array<{ id: string; name: string }>>([]);
  const [sequences, setSequences] = useState<Array<{ id: string; name: string }>>([]);
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string }>>([]);
  const [drawer, setDrawer] = useState<{ lead: OutreachLead; data: ActivityPayload | null } | null>(null);
  const [linkedSheets, setLinkedSheets] = useState<Array<{
    id: string;
    name: string;
    kind: string;
    lastSyncAt?: string;
  }>>([]);
  const [sortField, setSortField] = useState('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const buildParams = useCallback((pageCursor: string | null) => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (sourceFilter !== 'all') params.set('source', sourceFilter);
    if (nicheFilter.trim()) params.set('niche', nicheFilter.trim());
    if (priorityFilter.trim()) params.set('priority', priorityFilter.trim());
    if (query.trim()) params.set('q', query.trim());
    if (hasEmailOnly) params.set('hasEmail', 'true');
    params.set('pageSize', String(pageSize));
    params.set('sort', sortField);
    params.set('sortDir', sortDir);
    if (pageCursor) params.set('cursor', pageCursor);
    return params;
  }, [statusFilter, sourceFilter, nicheFilter, priorityFilter, query, hasEmailOnly, pageSize, sortField, sortDir]);

  const loadSheets = useCallback(() => {
    fetch('/api/aiva/outreach/lead-sheets')
      .then((res) => (res.ok ? res.json() : { sheets: [] }))
      .then((data: { sheets?: typeof linkedSheets }) => setLinkedSheets(data.sheets ?? []))
      .catch(() => setLinkedSheets([]));
  }, []);

  const loadMeta = useCallback(() => {
    fetch('/api/aiva/outreach/lists').then((r) => r.ok ? r.json() : { lists: [] })
      .then((d: { lists?: Array<{ id: string; name: string }> }) => setLists(d.lists ?? []))
      .catch(() => setLists([]));
    fetch('/api/aiva/outreach/sequences').then((r) => r.ok ? r.json() : { sequences: [] })
      .then((d: { sequences?: Array<{ id: string; name: string }> }) => setSequences(d.sequences ?? []))
      .catch(() => setSequences([]));
    fetch('/api/aiva/outreach/campaigns').then((r) => r.ok ? r.json() : { campaigns: [] })
      .then((d: { campaigns?: Array<{ id: string; name: string }> }) => setCampaigns(d.campaigns ?? []))
      .catch(() => setCampaigns([]));
    fetch('/api/aiva/outreach/lead-views').then((r) => r.ok ? r.json() : { views: [] })
      .then((d: { views?: SavedView[] }) => setSavedViews(d.views ?? []))
      .catch(() => setSavedViews([]));
    fetch('/api/aiva/outreach/grid-prefs').then((r) => r.ok ? r.json() : { prefs: null })
      .then((d: { prefs?: GridPrefs & { density?: GridDensity } | null }) => {
        if (!d.prefs) return;
        setGridPrefs({
          hiddenColumns: d.prefs.hiddenColumns,
          columnOrder: d.prefs.columnOrder,
          columnWidths: d.prefs.columnWidths,
        });
        if (d.prefs.density) setDensity(d.prefs.density);
      })
      .catch(() => undefined);
  }, []);

  const load = useCallback((pageCursor: string | null = cursor) => {
    setLoading(true);
    fetch(`/api/aiva/outreach/leads?${buildParams(pageCursor).toString()}`)
      .then((res) => (res.ok ? res.json() : { leads: [], total: 0 }))
      .then((data: { leads?: OutreachLead[]; total?: number; nextCursor?: string | null }) => {
        setLeads(data.leads ?? []);
        setTotal(data.total ?? data.leads?.length ?? 0);
        setNextCursor(data.nextCursor ?? null);
        setCursor(pageCursor);
      })
      .catch(() => {
        setLeads([]);
        setTotal(0);
        setNextCursor(null);
      })
      .finally(() => setLoading(false));
  }, [buildParams, cursor]);

  useEffect(() => {
    setCursorStack([null]);
    load(null);
    loadSheets();
    loadMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, sourceFilter, nicheFilter, priorityFilter, query, hasEmailOnly, sortField, sortDir]);

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
    load(null);
  }, [name, email, company, push, load]);

  const importMappedRows = useCallback(async () => {
    const mapped = wizardRows.map((row) => {
      const out: Record<string, string> = {};
      for (const [src, dest] of Object.entries(wizardMap)) {
        if (!dest) continue;
        out[dest] = row[src] || '';
      }
      if (!out.name && out.contactName) out.name = out.contactName;
      if (!out.name && out.company) out.name = out.company;
      return out;
    }).filter((r) => r.company || r.name || r.email);
    if (!mapped.length) {
      push('No mapped rows to import', 'error');
      return;
    }
    const res = await fetch('/api/aiva/outreach/leads/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leads: mapped,
        sourceType: 'upload',
        overwrite: !wizardDedupe,
      }),
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
    setWizardOpen(false);
    setWizardRows([]);
    load(null);
  }, [wizardRows, wizardMap, wizardDedupe, push, load]);

  const openWizardFromFile = useCallback(async (file: File | null) => {
    if (!file) return;
    const nameLower = file.name.toLowerCase();
    if (/\.(xlsx|xls|ods)$/.test(nameLower)) {
      push('For Excel/ODS, convert via Aiva chat (spreadsheet convert) or export CSV, then import here.', 'error');
      return;
    }
    const text = await file.text();
    const delimiter = nameLower.endsWith('.tsv') || text.includes('\t') ? '\t' : ',';
    const parsed = parseDelimited(text, delimiter);
    setWizardHeaders(parsed.headers);
    setWizardRows(parsed.rows);
    setWizardMap(autoMapHeaders(parsed.headers));
    setWizardOpen(true);
    setShowIngest(true);
  }, [push]);

  const patchLead = useCallback(async (leadId: string, patch: Record<string, unknown>) => {
    setBusyId(leadId);
    try {
      const current = leads.find((l) => l.id === leadId);
      const res = await fetch(`/api/aiva/outreach/leads/${encodeURIComponent(leadId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...patch, version: current?.version }),
      });
      if (res.status === 409) {
        push('Conflict: lead changed elsewhere. Reloading.', 'error');
        load(cursor);
        return;
      }
      if (!res.ok) {
        push('Could not update lead', 'error');
        return;
      }
      const data = await res.json() as { lead?: OutreachLead };
      if (data.lead) {
        setLeads((prev) => prev.map((l) => (l.id === leadId ? data.lead! : l)));
      } else {
        load(cursor);
      }
    } finally {
      setBusyId(null);
    }
  }, [leads, load, cursor, push]);

  const runBulk = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const res = await fetch('/api/aiva/outreach/leads/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadIds: ids, action, ...extra }),
    });
    if (!res.ok) {
      push('Bulk action failed', 'error');
      return;
    }
    const data = await res.json() as { updated?: number; failed?: unknown[] };
    setSelected(new Set());
    push(`Updated ${data.updated ?? ids.length} leads`, 'success');
    load(cursor);
  }, [selected, push, load, cursor]);

  const saveCurrentView = useCallback(async () => {
    const label = window.prompt('Name this view');
    if (!label?.trim()) return;
    const res = await fetch('/api/aiva/outreach/lead-views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: label.trim(),
        filters: {
          status: statusFilter,
          source: sourceFilter,
          niche: nicheFilter,
          priority: priorityFilter,
          q: query,
          hasEmail: hasEmailOnly,
        },
        shared: false,
        density,
        ...gridPrefs,
      }),
    });
    if (!res.ok) {
      push('Could not save view', 'error');
      return;
    }
    push('View saved', 'success');
    loadMeta();
  }, [statusFilter, sourceFilter, nicheFilter, priorityFilter, query, hasEmailOnly, density, gridPrefs, push, loadMeta]);

  const persistPrefs = useCallback(async (prefs: GridPrefs) => {
    setGridPrefs(prefs);
    if (prefs.density) setDensity(prefs.density);
    await fetch('/api/aiva/outreach/grid-prefs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...prefs, density }),
    }).catch(() => undefined);
  }, [density]);

  const openActivity = useCallback(async (lead: OutreachLead) => {
    setDrawer({ lead, data: null });
    const res = await fetch(`/api/aiva/outreach/leads/${encodeURIComponent(lead.id)}/activity`);
    if (!res.ok) {
      push('Could not load activity', 'error');
      return;
    }
    const data = await res.json() as ActivityPayload;
    setDrawer({ lead, data });
  }, [push]);

  const exportLeads = useCallback((selectedOnly = false) => {
    const params = buildParams(null);
    params.set('format', 'workbook');
    if (selectedOnly && selected.size) params.set('ids', Array.from(selected).join(','));
    window.location.href = `/api/aiva/outreach/leads/export?${params.toString()}`;
  }, [buildParams, selected]);

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
    load(null);
    loadSheets();
  }, [push, load, loadSheets]);

  return (
    <div
      className="flex w-full max-w-none flex-col gap-2 px-4 py-3 lg:px-6"
      style={{ width: '100%', maxWidth: 'none' }}
    >
      {showIngest ? (
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-border bg-elevated p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Manual lead</h3>
            <div className="mt-2 grid gap-2">
              <input className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm" placeholder="Contact name" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm" placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
              <input className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button size="sm" onClick={() => void create()}>Add lead</Button>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-elevated p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Import wizard</h3>
            <p className="mt-1 text-[11px] text-text-muted">CSV / TSV. Excel/ODS via Aiva convert, then CSV. Google Sheets via Connect sheet.</p>
            <input type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,.ods" className="mt-2 block w-full text-xs" onChange={(e) => void openWizardFromFile(e.target.files?.[0] ?? null)} />
            {wizardOpen ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium">{wizardRows.length} rows · map columns</p>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {wizardHeaders.map((h) => (
                    <label key={h} className="flex items-center gap-2 text-xs">
                      <span className="w-28 truncate">{h}</span>
                      <select
                        className="flex-1 rounded border border-border bg-transparent px-1 py-0.5"
                        value={wizardMap[h] || ''}
                        onChange={(e) => setWizardMap((m) => ({ ...m, [h]: e.target.value }))}
                      >
                        <option value="">Skip</option>
                        {TARGET_FIELDS.map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={wizardDedupe} onChange={(e) => setWizardDedupe(e.target.checked)} />
                  Deduplicate (link matches; do not overwrite)
                </label>
                <div className="rounded border border-border p-2 text-[11px] text-text-muted">
                  Preview: {wizardRows.slice(0, 3).map((r) => r[wizardHeaders[0] || ''] || '').join(' · ') || 'n/a'}
                </div>
                <Button size="sm" onClick={() => void importMappedRows()}>Import mapped rows</Button>
              </div>
            ) : null}
          </div>
          <div className="rounded-lg border border-border bg-elevated p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Linked sheets</h3>
            {linkedSheets.length === 0 ? (
              <p className="mt-2 text-xs text-text-muted">No linked sheet yet. Connect a sheet or ask Aiva from chat.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {linkedSheets.map((sheet) => (
                  <li key={sheet.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{sheet.name}</span>
                    <button type="button" className="text-xs text-accent" onClick={() => void syncSheet(sheet.id)}>
                      Sync
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-xs text-text-muted">Loading leads...</p>
      ) : null}

      {/* Row 1: title + actions */}
      <div className="flex flex-nowrap items-center gap-x-1.5 overflow-x-auto pb-0.5">
        <h2 className="shrink-0 whitespace-nowrap text-sm font-semibold text-text-primary">CRM Leads</h2>
        <span className="shrink-0 whitespace-nowrap text-xs text-text-muted">{total} leads</span>
        <span className="hidden h-4 w-px shrink-0 bg-border sm:block" aria-hidden />
        <Button size="sm" variant="outline" className="h-7 shrink-0 px-2.5 text-xs" onClick={() => setShowIngest((v) => !v)}>
          {showIngest ? 'Hide add / import' : 'Add / Import'}
        </Button>
        <Button size="sm" variant="outline" className="h-7 shrink-0 px-2.5 text-xs" onClick={() => exportLeads(false)}>
          Export view
        </Button>
        {selected.size > 0 ? (
          <Button size="sm" variant="outline" className="h-7 shrink-0 px-2.5 text-xs" onClick={() => exportLeads(true)}>
            Export selected
          </Button>
        ) : null}
        <Button size="sm" variant="outline" className="h-7 shrink-0 px-2.5 text-xs" onClick={() => void createLeadSheet()}>
          Connect sheet
        </Button>
        <Button size="sm" variant="outline" className="h-7 shrink-0 px-2.5 text-xs" onClick={() => void saveCurrentView()}>
          Save view
        </Button>
        <Link
          href="/aiva/outreach/companies-house"
          className="inline-flex h-7 shrink-0 items-center whitespace-nowrap rounded-md border border-border px-2.5 text-xs"
        >
          Companies House
        </Link>
      </div>

      <CrmLeadsGrid
          leads={leads}
          selected={selected}
          density={density}
          prefs={gridPrefs}
          busyId={busyId}
          onPrefsChange={(prefs) => void persistPrefs(prefs)}
          onOpenActivity={(lead) => void openActivity(lead)}
          toolbarLeading={(
            <>
              <select
                className="h-7 shrink-0 rounded-md border border-border bg-transparent px-2 text-xs"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Pipeline view"
              >
                {BUILTIN_VIEWS.map((view) => (
                  <option key={view.id} value={view.status}>{view.label}</option>
                ))}
                {savedViews.map((view) => (
                  <option key={view.id} value={`view:${view.id}`}>{view.name}{view.shared ? ' (shared)' : ''}</option>
                ))}
              </select>
              <input
                className="h-7 min-w-40 max-w-xs shrink grow basis-40 rounded-md border border-border bg-transparent px-2 text-xs"
                placeholder="Search company, contact, email, niche, town"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                className="h-7 shrink-0 rounded-md border border-border bg-transparent px-2 text-xs"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
              >
                <option value="all">All sources</option>
                {sources.map((source) => (
                  <option key={source} value={source}>{source}</option>
                ))}
              </select>
              <input
                className="h-7 w-24 shrink-0 rounded-md border border-border bg-transparent px-2 text-xs"
                placeholder="Niche"
                value={nicheFilter}
                onChange={(e) => setNicheFilter(e.target.value)}
              />
              <input
                className="h-7 w-24 shrink-0 rounded-md border border-border bg-transparent px-2 text-xs"
                placeholder="Priority"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              />
              <label className="inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap px-1 text-xs text-text-muted">
                <input type="checkbox" checked={hasEmailOnly} onChange={(e) => setHasEmailOnly(e.target.checked)} />
                Has email
              </label>
              <select
                className="h-7 shrink-0 rounded-md border border-border bg-transparent px-2 text-xs"
                value={sortField}
                onChange={(e) => setSortField(e.target.value)}
              >
                <option value="updatedAt">Sort: Updated</option>
                <option value="company">Sort: Company</option>
                <option value="contactName">Sort: Contact</option>
                <option value="status">Sort: Status</option>
                <option value="priority">Sort: Priority</option>
              </select>
              <select
                className="h-7 shrink-0 rounded-md border border-border bg-transparent px-2 text-xs"
                value={sortDir}
                onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}
              >
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
              <select
                className="h-7 shrink-0 rounded-md border border-border bg-transparent px-2 text-xs"
                value={density}
                onChange={(e) => {
                  const next = e.target.value as GridDensity;
                  setDensity(next);
                  void persistPrefs({ ...gridPrefs, density: next });
                }}
              >
                <option value="compact">Compact</option>
                <option value="comfortable">Comfortable</option>
                <option value="spacious">Spacious</option>
              </select>
              {selected.size > 0 ? (
                <>
                  <select
                    className="h-7 shrink-0 rounded-md border border-border bg-transparent px-2 text-xs"
                    defaultValue=""
                    onChange={(e) => {
                      const value = e.target.value as PipelineStatus;
                      if (!value) return;
                      void runBulk('stage', { status: value });
                      e.target.value = '';
                    }}
                  >
                    <option value="">Bulk stage ({selected.size})</option>
                    {STAGE_OPTIONS.map((status) => (
                      <option key={status} value={status}>{PIPELINE_LABELS[status]}</option>
                    ))}
                  </select>
                  <select
                    className="h-7 shrink-0 rounded-md border border-border bg-transparent px-2 text-xs"
                    defaultValue=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      void runBulk('list_add', { listId: e.target.value });
                      e.target.value = '';
                    }}
                  >
                    <option value="">Add to list</option>
                    {lists.map((list) => (
                      <option key={list.id} value={list.id}>{list.name}</option>
                    ))}
                  </select>
                  <select
                    className="h-7 shrink-0 rounded-md border border-border bg-transparent px-2 text-xs"
                    defaultValue=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      void runBulk('nurture_enroll', { sequenceId: e.target.value });
                      e.target.value = '';
                    }}
                  >
                    <option value="">Enrol nurture</option>
                    {sequences.map((seq) => (
                      <option key={seq.id} value={seq.id}>{seq.name}</option>
                    ))}
                  </select>
                  <select
                    className="h-7 shrink-0 rounded-md border border-border bg-transparent px-2 text-xs"
                    defaultValue=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      void runBulk('campaign_attach', { campaignId: e.target.value });
                      e.target.value = '';
                    }}
                  >
                    <option value="">Attach campaign</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <Button size="sm" variant="outline" className="h-7 shrink-0 px-2.5 text-xs" onClick={() => void runBulk('archive')}>
                    Archive
                  </Button>
                </>
              ) : null}
            </>
          )}
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

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <button
          type="button"
          className="rounded border border-border px-2.5 py-1 disabled:opacity-40"
          disabled={cursorStack.length <= 1}
          onClick={() => {
            const stack = [...cursorStack];
            stack.pop();
            const prev = stack[stack.length - 1] ?? null;
            setCursorStack(stack);
            load(prev);
          }}
        >
          Previous
        </button>
        <span className="text-text-muted">
          Showing {leads.length} of {total} · keyset page {cursorStack.length}
        </span>
        <button
          type="button"
          className="rounded border border-border px-2.5 py-1 disabled:opacity-40"
          disabled={!nextCursor}
          onClick={() => {
            if (!nextCursor) return;
            setCursorStack((s) => [...s, nextCursor]);
            load(nextCursor);
          }}
        >
          Next
        </button>
      </div>

      {drawer ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setDrawer(null)}>
          <aside
            className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-elevated p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            aria-label="Lead activity and provenance"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{drawer.lead.company || drawer.lead.name}</h3>
              <button type="button" className="text-xs text-text-muted" onClick={() => setDrawer(null)}>Close</button>
            </div>
            <section className="mb-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Provenance</h4>
              <dl className="mt-2 space-y-1 text-xs">
                <div><dt className="inline text-text-muted">Source: </dt><dd className="inline">{String(drawer.data?.provenance?.sourceType ?? drawer.lead.sourceType ?? drawer.lead.source ?? '-')}</dd></div>
                <div><dt className="inline text-text-muted">URL: </dt><dd className="inline break-all">{String(drawer.data?.provenance?.sourceUrl ?? drawer.lead.sourceUrl ?? '-')}</dd></div>
                <div><dt className="inline text-text-muted">Job: </dt><dd className="inline">{String(drawer.data?.provenance?.sourceJobId ?? drawer.lead.sourceJobId ?? '-')}</dd></div>
                <div><dt className="inline text-text-muted">Captured: </dt><dd className="inline">{String(drawer.data?.provenance?.sourceCapturedAt ?? drawer.lead.sourceCapturedAt ?? '-')}</dd></div>
              </dl>
            </section>
            <section className="mb-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Activity</h4>
              {!drawer.data ? (
                <p className="mt-2 text-xs text-text-muted">Loading...</p>
              ) : (
                <ul className="mt-2 space-y-2 text-xs">
                  {(drawer.data.timeline || []).slice().reverse().slice(0, 30).map((ev, idx) => (
                    <li key={`${ev.at}-${idx}`} className="rounded border border-border px-2 py-1">
                      <div className="text-text-muted">{ev.at} · {ev.kind}</div>
                      <div>{ev.message}</div>
                    </li>
                  ))}
                  {(drawer.data.deliveries || []).map((d) => (
                    <li key={d.id} className="rounded border border-border px-2 py-1">
                      Delivery {d.status}: {d.subject || d.id}
                    </li>
                  ))}
                  {(drawer.data.providerEvents || []).slice(0, 20).map((ev, idx) => (
                    <li key={`pe-${idx}`} className="rounded border border-border px-2 py-1">
                      Provider {String(ev.kind ?? '')} · {String(ev.processing_status ?? '')}
                    </li>
                  ))}
                  {(drawer.data.bookings || []).map((b) => (
                    <li key={b.id} className="rounded border border-border px-2 py-1">
                      Booking {b.startsAt || b.id}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <Link href={`/aiva/outreach/leads/${drawer.lead.id}`} className="text-xs text-accent">
              Open full lead page
            </Link>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
