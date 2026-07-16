'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { AIVA_ROLE_GROUPS, cardsForGroup } from '@/lib/aiva-role-groups';
import { AIVA_INPUT_CLASS } from '@/lib/aiva-utils';
import { cn } from '@/lib/utils';

export function AivaRolesCatalog() {
  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<string>('featured');

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return AIVA_ROLE_GROUPS.map((group) => {
      const cards = cardsForGroup(group).filter((card) => {
        if (!q) return true;
        return (
          card.roleName.toLowerCase().includes(q)
          || card.roleDescription.toLowerCase().includes(q)
          || card.label.toLowerCase().includes(q)
        );
      });
      return { group, cards };
    }).filter((entry) => entry.cards.length > 0);
  }, [query]);

  const visible = query.trim()
    ? filteredGroups
    : filteredGroups.filter((entry) => entry.group.id === activeGroup);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Role library</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">
            Full catalog of Aiva personas, grouped so Hire stays simple. Pick a role to continue hiring.
          </p>
        </div>
        <Link
          href="/aiva"
          className="text-sm font-medium text-accent hover:underline"
        >
          Back to quick hire
        </Link>
      </div>

      <label className="relative block max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          className={cn(AIVA_INPUT_CLASS, 'bg-surface pl-9')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search roles"
          aria-label="Search roles"
        />
      </label>

      {!query.trim() ? (
        <nav className="flex flex-wrap gap-2" aria-label="Role groups">
          {AIVA_ROLE_GROUPS.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => setActiveGroup(group.id)}
              className={cn(
                'rounded-xl px-3.5 py-2 text-left text-sm transition',
                activeGroup === group.id
                  ? 'bg-accent/15 text-accent ring-1 ring-accent/30'
                  : 'bg-muted/60 text-text-secondary hover:bg-muted hover:text-text-primary',
              )}
            >
              <span className="block font-medium">{group.title}</span>
              <span className="mt-0.5 hidden text-[11px] text-text-muted sm:block">
                {group.templateIds.length} roles
              </span>
            </button>
          ))}
        </nav>
      ) : null}

      <div className="space-y-8">
        {visible.map(({ group, cards }) => (
          <section key={group.id} className="space-y-3">
            {(query.trim() || activeGroup === group.id) ? (
              <div>
                <h2 className="text-base font-semibold text-text-primary">{group.title}</h2>
                <p className="mt-0.5 text-sm text-text-muted">{group.description}</p>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              {cards.map((card) => {
                const Icon = card.icon;
                return (
                  <Link
                    key={card.templateId}
                    href={`/aiva?template=${encodeURIComponent(card.templateId)}`}
                    className="flex min-w-0 items-start gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-accent/40"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-text-primary">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-text-primary">{card.roleName}</span>
                      <span className="mt-1 line-clamp-2 block text-sm text-text-muted">
                        {card.roleDescription}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
        {visible.length === 0 ? (
          <p className="text-sm text-text-muted">No roles match that search.</p>
        ) : null}
      </div>
    </div>
  );
}
