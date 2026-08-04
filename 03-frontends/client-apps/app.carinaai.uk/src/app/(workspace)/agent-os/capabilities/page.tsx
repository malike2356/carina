'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AgentOsShell } from '@/components/agent-os/AgentOsShell';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { Input } from '@/components/ui/input';

type CapabilityItem = {
  id: string;
  kind: string;
  name: string;
  description: string;
  status: 'ready' | 'needs_setup' | 'gated';
  href: string;
  cta: string;
};

const FILTERS = ['all', 'tool', 'skill', 'channel', 'mcp', 'needs_setup'] as const;

export default function CapabilitiesPage() {
  const [items, setItems] = useState<CapabilityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/agent-os/capabilities');
        if (!res.ok) throw new Error('Failed');
        const data = (await res.json()) as { items?: CapabilityItem[] };
        if (!cancelled) setItems(data.items ?? []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === 'needs_setup' && item.status === 'ready') return false;
      if (filter !== 'all' && filter !== 'needs_setup' && item.kind !== filter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    });
  }, [items, query, filter]);

  return (
    <AgentOsShell
      title="Capabilities"
      description="Tools, skills, channels, and MCP. Ready vs needs setup."
    >
      <div className="mb-4 space-y-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search capabilities"
          className="min-h-11 text-base"
        />
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`min-h-11 rounded-lg border px-3 text-xs ${
                filter === id
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-text-muted'
              }`}
            >
              {id === 'needs_setup' ? 'Needs setup' : id}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <ListSkeleton rows={8} />
      ) : !filtered.length ? (
        <p className="text-sm text-text-muted">No capabilities match.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-2 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">{item.name}</span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase text-text-muted">
                    {item.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="mt-1 text-xs text-text-muted">{item.description}</p>
              </div>
              <Link
                href={item.href}
                className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-border px-3 text-xs font-medium text-accent"
              >
                {item.cta}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AgentOsShell>
  );
}
