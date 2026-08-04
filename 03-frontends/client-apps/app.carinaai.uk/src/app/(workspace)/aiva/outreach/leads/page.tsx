'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { PIPELINE_LABELS, type OutreachLead } from '@/components/outreach/types';

export default function OutreachLeadsPage() {
  const { push } = useToast();
  const [leads, setLeads] = useState<OutreachLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [bulk, setBulk] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/aiva/outreach/leads')
      .then((res) => (res.ok ? res.json() : { leads: [] }))
      .then((data: { leads?: OutreachLead[] }) => setLeads(data.leads ?? []))
      .catch(() => setLeads([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  const importBulk = useCallback(async () => {
    const rows = bulk
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [n, e, c] = line.split(',').map((part) => part.trim());
        return { name: n || 'Unknown', email: e, company: c, source: 'csv_import' as const };
      });
    if (rows.length === 0) {
      push('Paste CSV lines: name,email,company', 'error');
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
    setBulk('');
    load();
  }, [bulk, push, load]);

  return (
    <div className="mx-auto max-w-[90rem] space-y-6 p-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-text-primary">Add lead</h2>
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
          <h2 className="text-sm font-medium text-text-primary">Bulk import</h2>
          <p className="mt-1 text-xs text-text-muted">One lead per line: name,email,company</p>
          <textarea
            className="mt-3 h-28 w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm"
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder={'Ada Lovelace,ada@example.com,Analytical Engines'}
          />
          <Button size="sm" className="mt-2" onClick={() => void importBulk()}>
            Import
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading leads...</p>
      ) : leads.length === 0 ? (
        <p className="text-sm text-text-muted">No leads yet.</p>
      ) : (
        <div className="space-y-2">
          {leads.map((lead) => (
            <div key={lead.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
              <div className="min-w-0">
                <Link href={`/aiva/outreach/leads/${lead.id}`} className="text-sm font-medium text-accent hover:underline">
                  {lead.name}
                </Link>
                <p className="truncate text-xs text-text-muted">
                  {PIPELINE_LABELS[lead.status] ?? lead.status}
                  {lead.email ? ` · ${lead.email}` : ''}
                  {lead.company ? ` · ${lead.company}` : ''}
                  {lead.source ? ` · ${lead.source}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {lead.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="rounded bg-elevated px-1.5 py-0.5 text-[10px] text-text-muted">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
