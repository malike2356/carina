'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, LayoutGrid, List, Search, SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '@/components/shell/PageHeader';
import { cn } from '@/lib/utils';

type MarketplaceTemplate = {
  templateId: string;
  name: string;
  icon: string;
  tagline: string;
  tierLabel: string;
  tier: string;
  features: string[];
  setupTimeSeconds: number;
  useCaseExample: string;
  groupId: string;
  groupLabel: string;
};

type TemplateDetail = MarketplaceTemplate & {
  description: string;
  tools: string[];
  skills: string[];
  slotLimit: number | null;
  greeting: string;
};

type CatalogItem = MarketplaceTemplate & {
  isCustom?: boolean;
  actionHref?: string;
  actionLabel?: string;
};

const CUSTOM_TEMPLATE: TemplateDetail = {
  templateId: 'custom',
  name: 'Custom worker',
  icon: 'sparkles',
  tagline: 'Describe the role you need in your own words.',
  tier: 'starter',
  tierLabel: 'Starter',
  features: [
    'Builds from a plain English brief',
    'Lets you choose the channels you need',
    'Starts from a blank workspace-safe setup',
  ],
  setupTimeSeconds: 60,
  useCaseExample: 'Use this when none of the preset roles quite fit.',
  groupId: 'build-your-own',
  groupLabel: 'Build your own',
  description: 'Start from scratch and shape an Aiva around your own requirements.',
  tools: [],
  skills: [],
  slotLimit: null,
  greeting: 'Hello! Tell me what you need and I will help you shape the brief.',
};

const PAGE_SIZE_GRID = 12;
const PAGE_SIZE_LIST = 8;

export function AivaMarketplaceClient() {
  const router = useRouter();
  const [templates, setTemplates] = useState<MarketplaceTemplate[]>([]);
  const [selected, setSelected] = useState<TemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState('all');
  const [activeTier, setActiveTier] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/aiva/marketplace/templates');
      const data = (await res.json()) as { templates?: MarketplaceTemplate[] };
      setTemplates(data.templates ?? []);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const catalog = useMemo<CatalogItem[]>(() => {
    const builtIn = templates.map((row) => ({
      ...row,
      actionHref: `/aiva/marketplace?template=${encodeURIComponent(row.templateId)}`,
      actionLabel: 'View details',
    }));

    return [
      ...builtIn,
      {
        ...CUSTOM_TEMPLATE,
        actionHref: '/aiva/provision?intent=provision',
        actionLabel: 'Create custom worker',
        isCustom: true,
      },
    ];
  }, [templates]);

  const groupOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of catalog) {
      if (!seen.has(row.groupId)) {
        seen.set(row.groupId, row.groupLabel);
      }
    }
    return Array.from(seen, ([id, label]) => ({ id, label }));
  }, [catalog]);

  const filteredTemplates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((row) => {
      if (activeGroup !== 'all' && row.groupId !== activeGroup) return false;
      if (activeTier !== 'all' && row.tier !== activeTier) return false;
      if (!q) return true;
      return [
        row.name,
        row.tagline,
        row.useCaseExample,
        row.groupLabel,
        row.features.join(' '),
      ].some((value) => value.toLowerCase().includes(q));
    });
  }, [activeGroup, activeTier, catalog, query]);

  const pageSize = viewMode === 'grid' ? PAGE_SIZE_GRID : PAGE_SIZE_LIST;
  const totalPages = Math.max(1, Math.ceil(filteredTemplates.length / pageSize));
  const pageTemplates = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTemplates.slice(start, start + pageSize);
  }, [filteredTemplates, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [activeGroup, activeTier, query, viewMode]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  async function openDetail(templateId: string) {
    setError(null);
    if (templateId === 'custom') {
      setSelected(CUSTOM_TEMPLATE);
      return;
    }
    const res = await fetch(`/api/aiva/marketplace/templates/${encodeURIComponent(templateId)}`);
    const data = (await res.json()) as { template?: TemplateDetail };
    if (data.template) setSelected(data.template);
  }

  async function getStarted(templateId: string) {
    if (templateId === 'custom') {
      router.push('/aiva/provision?intent=provision');
      return;
    }
    setProvisioning(true);
    setError(null);
    try {
      const res = await fetch('/api/aiva/marketplace/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      });
      const data = (await res.json()) as {
        error?: string;
        checkoutUrl?: string;
        workerId?: string;
        status?: string;
      };
      if (res.status === 402 && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      if (!res.ok) {
        setError(data.error ?? 'Provisioning failed');
        return;
      }
      if (data.workerId) {
        router.push(`/aiva/workers/${data.workerId}`);
        return;
      }
      router.push(`/aiva?template=${encodeURIComponent(templateId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Provisioning failed');
    } finally {
      setProvisioning(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Agent marketplace"
        description="Pre-built AI workers. Pick a template, provision in under a minute. Prices via Stripe on your plan page."
        actions={
          <Link href="/aiva/provision?intent=provision" className="btn-ghost text-xs">
            Create custom worker
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {error ? (
          <div className="mb-4 rounded-lg border border-red-400/40 px-3 py-2 text-xs text-red-800 dark:text-red-300">{error}</div>
        ) : null}
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-elevated p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <label className="relative block w-full lg:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className={cn(
                    'w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text-primary outline-none transition focus:border-accent/60',
                  )}
                  placeholder="Search templates"
                  aria-label="Search templates"
                />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition',
                    viewMode === 'grid'
                      ? 'bg-accent text-white'
                      : 'border border-border bg-surface text-text-secondary hover:text-text-primary',
                  )}
                >
                  <LayoutGrid className="h-4 w-4" />
                  Grid
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition',
                    viewMode === 'list'
                      ? 'bg-accent text-white'
                      : 'border border-border bg-surface text-text-secondary hover:text-text-primary',
                  )}
                >
                  <List className="h-4 w-4" />
                  List
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="-mx-1 flex flex-wrap gap-2 px-1">
                <button
                  type="button"
                  onClick={() => setActiveGroup('all')}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-medium transition',
                    activeGroup === 'all'
                      ? 'bg-accent text-white'
                      : 'border border-border bg-surface text-text-secondary hover:text-text-primary',
                  )}
                >
                  All groups
                </button>
                {groupOptions.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => setActiveGroup(group.id)}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs font-medium transition',
                      activeGroup === group.id
                        ? 'bg-accent text-white'
                        : 'border border-border bg-surface text-text-secondary hover:text-text-primary',
                    )}
                  >
                    {group.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTier('all')}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-medium transition',
                    activeTier === 'all'
                      ? 'bg-accent text-white'
                      : 'border border-border bg-surface text-text-secondary hover:text-text-primary',
                  )}
                >
                  All tiers
                </button>
                {(['starter', 'growth', 'business'] as const).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setActiveTier(tier)}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-xs font-medium transition capitalize',
                      activeTier === tier
                        ? 'bg-accent text-white'
                        : 'border border-border bg-surface text-text-secondary hover:text-text-primary',
                    )}
                  >
                    {tier}
                  </button>
                ))}
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-text-muted">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {filteredTemplates.length} of {catalog.length}
                </span>
              </div>
            </div>
          </div>

          {loading ? (
            <p className="text-xs text-text-muted">Loading templates...</p>
          ) : pageTemplates.length === 0 ? (
            <div className="rounded-xl border border-border bg-elevated p-6 text-sm text-text-muted">
              No templates match those filters.
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {pageTemplates.map((row) => (
                <article
                  key={row.templateId}
                  className="flex h-full flex-col rounded-xl border border-border bg-elevated p-4"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-text-primary">{row.name}</h2>
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-text-muted">{row.groupLabel}</p>
                    </div>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-text-muted">
                      {row.tierLabel}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary">{row.tagline}</p>
                  <ul className="mt-3 space-y-1 text-[11px] text-text-muted">
                    {row.features.slice(0, 3).map((feature) => (
                      <li key={feature}>- {feature}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[11px] text-text-muted">
                    Setup about {row.setupTimeSeconds}s. Scout protection included.
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      className="btn-ghost flex-1 text-xs"
                      onClick={() => void openDetail(row.templateId)}
                    >
                      View details
                    </button>
                    <button
                      type="button"
                      className={cn('btn-primary flex-1 text-xs')}
                      disabled={provisioning}
                      onClick={() => void getStarted(row.templateId)}
                    >
                      {row.isCustom ? 'Create' : 'Get started'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {pageTemplates.map((row) => (
                <article
                  key={row.templateId}
                  className="flex flex-col gap-4 rounded-xl border border-border bg-elevated p-4 lg:flex-row lg:items-start lg:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-text-primary">{row.name}</h2>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-text-muted">
                        {row.groupLabel}
                      </span>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-text-muted">
                        {row.tierLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-text-secondary">{row.tagline}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-text-muted">
                      <span>Setup about {row.setupTimeSeconds}s</span>
                      <span>Scout protection included</span>
                    </div>
                    <p className="mt-3 text-xs text-text-muted line-clamp-2">{row.useCaseExample}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      className="btn-ghost text-xs"
                      onClick={() => void openDetail(row.templateId)}
                    >
                      View details
                    </button>
                    <button
                      type="button"
                      className={cn('btn-primary text-xs')}
                      disabled={provisioning}
                      onClick={() => void getStarted(row.templateId)}
                    >
                      {row.isCustom ? 'Create' : 'Get started'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-elevated px-4 py-3">
            <p className="text-xs text-text-muted">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-secondary transition disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-secondary transition disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {selected ? (
          <div className="mt-6 rounded-lg border border-border bg-elevated p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-text-primary">{selected.name}</h3>
              <button type="button" className="btn-ghost text-xs" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <p className="text-xs text-text-secondary">{selected.description}</p>
            <ul className="mt-3 space-y-1 text-xs text-text-muted">
              {selected.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-text-muted">
              Plan: {selected.tierLabel}
              {selected.slotLimit != null ? ` (up to ${selected.slotLimit} workers)` : ' (custom worker allowance)'}
            </p>
            <p className="mt-2 text-xs italic text-text-secondary">{selected.useCaseExample}</p>
            <button
              type="button"
              className={cn('btn-primary mt-3 text-xs')}
              disabled={provisioning}
              onClick={() => void getStarted(selected.templateId)}
            >
              Get started
            </button>
          </div>
        ) : null}
        <p className="mt-6 text-[11px] text-text-muted">
          All plans include Scout protection. Prices via Stripe. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
