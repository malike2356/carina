'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import type { LeadList, OutreachLead } from '@/components/outreach/types';

export default function OutreachListsPage() {
  const { push } = useToast();
  const [lists, setLists] = useState<LeadList[]>([]);
  const [leads, setLeads] = useState<OutreachLead[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/aiva/outreach/lists').then((res) => (res.ok ? res.json() : { lists: [] })),
      fetch('/api/aiva/outreach/leads').then((res) => (res.ok ? res.json() : { leads: [] })),
    ])
      .then(([listJson, leadJson]) => {
        setLists(listJson.lists ?? []);
        setLeads(leadJson.leads ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(async () => {
    if (!name.trim()) {
      push('List name is required', 'error');
      return;
    }
    const res = await fetch('/api/aiva/outreach/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, leadIds: leads.slice(0, 25).map((l) => l.id) }),
    });
    if (!res.ok) {
      push('Could not create list', 'error');
      return;
    }
    setName('');
    push('List created (seeded with up to 25 recent leads)', 'success');
    load();
  }, [name, leads, push, load]);

  return (
    <div className="mx-auto max-w-[90rem] space-y-6 p-6">
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-text-primary">New list</h2>
        <div className="mt-3 flex gap-2">
          <input
            className="flex-1 rounded-md border border-border bg-elevated px-3 py-2 text-sm"
            placeholder="List name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button size="sm" onClick={() => void create()}>
            Create
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading lists...</p>
      ) : lists.length === 0 ? (
        <p className="text-sm text-text-muted">No lists yet.</p>
      ) : (
        <div className="space-y-2">
          {lists.map((list) => (
            <div key={list.id} className="rounded-lg border border-border bg-card px-3 py-3">
              <p className="text-sm font-medium text-text-primary">{list.name}</p>
              <p className="mt-1 text-xs text-text-muted">
                {list.leadIds.length} lead{list.leadIds.length === 1 ? '' : 's'}
                {list.description ? ` · ${list.description}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
