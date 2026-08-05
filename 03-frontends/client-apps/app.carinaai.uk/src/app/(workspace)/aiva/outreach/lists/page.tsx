'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import type { LeadList, OutreachLead } from '@/components/outreach/types';

type ListDraft = {
  name: string;
  description: string;
  leadIds: string;
  tags: string;
};

function makeDraft(list: LeadList): ListDraft {
  return {
    name: list.name,
    description: list.description ?? '',
    leadIds: list.leadIds.join(', '),
    tags: list.tags.join(', '),
  };
}

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function OutreachListsPage() {
  const { push } = useToast();
  const [lists, setLists] = useState<LeadList[]>([]);
  const [leads, setLeads] = useState<OutreachLead[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ListDraft>>({});
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/aiva/outreach/lists').then((res) => (res.ok ? res.json() : { lists: [] })),
      fetch('/api/aiva/outreach/leads').then((res) => (res.ok ? res.json() : { leads: [] })),
    ])
      .then(([listJson, leadJson]) => {
        const nextLists = listJson.lists ?? [];
        const nextLeads = leadJson.leads ?? [];
        setLists(nextLists);
        setLeads(nextLeads);
        setDrafts((current) => {
          const next: Record<string, ListDraft> = {};
          for (const list of nextLists) {
            next[list.id] = current[list.id] ?? makeDraft(list);
          }
          return next;
        });
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
    push('List created', 'success');
    load();
  }, [name, leads, push, load]);

  const updateDraft = useCallback((id: string, patch: Partial<ListDraft>) => {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? {
          name: '',
          description: '',
          leadIds: '',
          tags: '',
        }),
        ...patch,
      },
    }));
  }, []);

  const saveList = useCallback(async (listId: string) => {
    const draft = drafts[listId];
    if (!draft) return;
    const res = await fetch(`/api/aiva/outreach/lists/${listId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: draft.name,
        description: draft.description,
        leadIds: splitCsv(draft.leadIds),
        tags: splitCsv(draft.tags),
      }),
    });
    if (!res.ok) {
      push('Could not save list', 'error');
      return;
    }
    push('List saved', 'success');
    load();
  }, [drafts, load, push]);

  const addRecentLeads = useCallback((listId: string) => {
    setDrafts((current) => {
      const draft = current[listId];
      if (!draft) return current;
      const existing = new Set(splitCsv(draft.leadIds));
      for (const lead of leads.slice(0, 25)) {
        existing.add(lead.id);
      }
      return {
        ...current,
        [listId]: {
          ...draft,
          leadIds: Array.from(existing).join(', '),
        },
      };
    });
  }, [leads]);

  const totalLists = useMemo(() => lists.length, [lists.length]);

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

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-text-primary">Lists</h2>
        <p className="text-xs text-text-muted">{totalLists} total</p>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading lists...</p>
      ) : lists.length === 0 ? (
        <p className="text-sm text-text-muted">No lists yet.</p>
      ) : (
        <div className="space-y-4">
          {lists.map((list) => {
            const draft = drafts[list.id] ?? makeDraft(list);
            return (
              <div key={list.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{list.name}</p>
                    <p className="mt-1 text-xs text-text-muted">
                      {list.leadIds.length} lead{list.leadIds.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => addRecentLeads(list.id)}>
                      Add recent 25
                    </Button>
                    <Button size="sm" onClick={() => void saveList(list.id)}>
                      Save
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  <input
                    className="rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                    value={draft.name}
                    onChange={(e) => updateDraft(list.id, { name: e.target.value })}
                    placeholder="List name"
                  />
                  <input
                    className="rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                    value={draft.description}
                    onChange={(e) => updateDraft(list.id, { description: e.target.value })}
                    placeholder="Description"
                  />
                  <textarea
                    className="min-h-28 rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                    value={draft.leadIds}
                    onChange={(e) => updateDraft(list.id, { leadIds: e.target.value })}
                    placeholder="Lead ids, comma separated"
                  />
                  <textarea
                    className="min-h-20 rounded-md border border-border bg-elevated px-3 py-2 text-sm"
                    value={draft.tags}
                    onChange={(e) => updateDraft(list.id, { tags: e.target.value })}
                    placeholder="Tags, comma separated"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
