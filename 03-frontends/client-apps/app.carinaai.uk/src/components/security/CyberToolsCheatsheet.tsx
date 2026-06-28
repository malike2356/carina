'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, ChevronLeft, ChevronRight, Info, Loader2, Lock } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip } from '@/components/ui/Tooltip';
import type { CyberTool } from '@/lib/cyber-tools-core';

const TIER_ORDER: Record<string, number> = {
  'self-hosted': 0,
  cloud: 1,
  monitor: 2,
  govern: 3,
  enterprise: 4,
};

const TIER_FILTERS = ['all', 'self-hosted', 'cloud', 'monitor', 'govern'] as const;
const PAGE_SIZES = [25, 50, 100] as const;
const SORT_COLUMNS = ['name', 'tier', 'category', 'binary', 'health'] as const;

type SortColumn = (typeof SORT_COLUMNS)[number];
type SortDir = 'asc' | 'desc';
type HealthFilter = 'all' | 'installed' | 'missing' | 'unknown';

const CATEGORY_LABELS: Record<string, string> = {
  reconnaissance: 'Reconnaissance',
  'vulnerability-scanning': 'Vulnerability scanning',
  exploitation: 'Exploitation',
  'web-application-testing': 'Web app testing',
  'wireless-network': 'Wireless',
  'forensics-imaging': 'Forensics',
  'sniffing-traffic': 'Traffic analysis',
  'privacy-opsec': 'Privacy / OPSEC',
  'reverse-engineering': 'Reverse engineering',
  'blue-team-defense': 'Blue team',
  'reporting-tip': 'Reporting / TIP',
  utility: 'Utility',
};

const CURRENT_TIER = (process.env.NEXT_PUBLIC_CARINA_TIER ?? 'self-hosted').toLowerCase();

function tierRank(tier: string): number {
  return TIER_ORDER[tier] ?? 99;
}

function healthRank(
  toolName: string,
  healthMap: Record<string, boolean>,
  healthUnknown: boolean,
): number {
  if (healthUnknown || healthMap[toolName] === undefined) return 2;
  return healthMap[toolName] ? 0 : 1;
}

function buildPageWindow(current: number, totalPages: number): Array<number | 'ellipsis'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: Array<number | 'ellipsis'> = [1];
  if (current > 3) pages.push('ellipsis');
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }
  if (current < totalPages - 2) pages.push('ellipsis');
  pages.push(totalPages);
  return pages;
}

function isToolLocked(tool: CyberTool): boolean {
  return tierRank(tool.requiredTier) > tierRank(CURRENT_TIER);
}

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

function tierBadgeClass(tier: string): string {
  switch (tier) {
    case 'cloud':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'monitor':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'govern':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    case 'enterprise':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    default:
      return 'bg-surface border-border text-text-secondary';
  }
}

function MetricCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-text-primary">{value}</p>
      {detail ? <p className="mt-1 text-xs text-text-secondary">{detail}</p> : null}
    </div>
  );
}

function TriggerChip({ phrase }: { phrase: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(phrase);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="cursor-pointer rounded border border-border bg-elevated px-1.5 py-0.5 font-mono text-xs hover:bg-surface-hover"
      >
        {phrase}
      </button>
      {copied ? (
        <span className="pointer-events-none absolute -top-8 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded border border-border bg-overlay px-2 py-1 text-xs text-text-primary">
          Copied
        </span>
      ) : null}
    </span>
  );
}

function TierBadge({ tier, locked }: { tier: string; locked: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${tierBadgeClass(tier)}`}
    >
      {tier}
      {locked ? <Lock className="h-3 w-3" aria-hidden /> : null}
    </span>
  );
}

function HealthStatus({
  installed,
  unknown,
}: {
  installed?: boolean;
  unknown: boolean;
}) {
  if (unknown || installed === undefined) {
    return (
      <span className="inline-flex items-center text-xs text-text-muted">
        <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-text-muted" />
        Unknown
      </span>
    );
  }
  if (installed) {
    return (
      <span className="inline-flex items-center text-xs text-text-secondary">
        <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-green-400" />
        Installed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-xs text-text-secondary">
      <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-red-400" />
      Missing
    </span>
  );
}

function ToolDescription({ tool }: { tool: CyberTool }) {
  return (
    <span className="inline-flex items-start gap-1 text-sm text-text-secondary">
      <span>{tool.description}</span>
      {tool.upgradeNote ? (
        <Tooltip text={tool.upgradeNote}>
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden />
        </Tooltip>
      ) : null}
    </span>
  );
}

function TriggerList({ triggers }: { triggers: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {triggers.map((phrase) => (
        <TriggerChip key={phrase} phrase={phrase} />
      ))}
    </div>
  );
}

type ToolsResponse = {
  tools: CyberTool[];
  total: number;
  source: 'core' | 'stub';
  warning?: string;
};

type HealthResponse = {
  health: Array<{ name: string; binary: string; installed: boolean }>;
  installedCount: number;
  total: number;
  source: 'core' | 'stub';
  warning?: string;
};

export function CyberToolsCheatsheet() {
  const [tools, setTools] = useState<CyberTool[]>([]);
  const [total, setTotal] = useState(0);
  const [source, setSource] = useState<'core' | 'stub' | null>(null);
  const [healthMap, setHealthMap] = useState<Record<string, boolean>>({});
  const [installedCount, setInstalledCount] = useState<number | null>(null);
  const [toolsLoading, setToolsLoading] = useState(true);
  const [toolsError, setToolsError] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthReady, setHealthReady] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState<(typeof TIER_FILTERS)[number]>('all');
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('all');
  const [showLocked, setShowLocked] = useState(true);
  const [sortBy, setSortBy] = useState<SortColumn>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(25);
  const [warning, setWarning] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/security/tools/health');
      const payload = (await res.json()) as HealthResponse & { error?: string };
      if (!res.ok) throw new Error(payload.error ?? 'Failed to load health');
      if (payload.source === 'core') {
        const map: Record<string, boolean> = {};
        for (const row of payload.health) {
          map[row.name] = row.installed;
        }
        setHealthMap(map);
        setInstalledCount(payload.installedCount);
        setHealthReady(true);
      }
    } catch {
      // health is non-blocking; keep unknown dots
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function fetchTools() {
      setToolsLoading(true);
      try {
        const res = await fetch('/api/security/tools');
        const payload = (await res.json()) as ToolsResponse & { error?: string };
        if (!res.ok) throw new Error(payload.error ?? 'Failed to load tools');
        if (active) {
          setTools(payload.tools);
          setTotal(payload.total);
          setSource(payload.source);
          setWarning(payload.warning ?? null);
          setToolsError(null);
        }
      } catch (err) {
        if (active) {
          setToolsError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (active) setToolsLoading(false);
      }
    }

    void fetchTools();
    void fetchHealth();

    return () => {
      active = false;
    };
  }, [fetchHealth]);

  const categories = useMemo(
    () => [...new Set(tools.map((tool) => tool.category))].sort(),
    [tools],
  );

  const unlockedCount = useMemo(
    () => tools.filter((tool) => tierRank(tool.requiredTier) <= tierRank(CURRENT_TIER)).length,
    [tools],
  );

  const healthUnknown = source !== 'core' || !healthReady;

  const hasActiveFilters =
    search.trim() !== ''
    || categoryFilter !== 'all'
    || tierFilter !== 'all'
    || healthFilter !== 'all'
    || !showLocked;

  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('all');
    setTierFilter('all');
    setHealthFilter('all');
    setShowLocked(true);
    setPage(1);
  };

  const toggleSort = (column: SortColumn) => {
    if (sortBy === column) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir(column === 'name' || column === 'category' || column === 'binary' ? 'asc' : 'desc');
    }
    setPage(1);
  };

  const filteredTools = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tools.filter((tool) => {
      if (query) {
        const nameMatch = tool.name.toLowerCase().includes(query);
        const triggerMatch = tool.triggers.some((trigger) =>
          trigger.toLowerCase().includes(query),
        );
        const binaryMatch = tool.binary.toLowerCase().includes(query);
        if (!nameMatch && !triggerMatch && !binaryMatch) return false;
      }
      if (categoryFilter !== 'all' && tool.category !== categoryFilter) return false;
      if (tierFilter !== 'all' && tool.requiredTier !== tierFilter) return false;
      if (!showLocked && isToolLocked(tool)) return false;
      if (healthFilter !== 'all') {
        const installed = healthMap[tool.name];
        if (healthFilter === 'installed' && installed !== true) return false;
        if (healthFilter === 'missing' && installed !== false) return false;
        if (healthFilter === 'unknown' && installed !== undefined) return false;
      }
      return true;
    });
  }, [tools, search, categoryFilter, tierFilter, showLocked, healthFilter, healthMap]);

  const sortedTools = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filteredTools].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'tier':
          cmp = tierRank(a.requiredTier) - tierRank(b.requiredTier);
          break;
        case 'category':
          cmp = categoryLabel(a.category).localeCompare(categoryLabel(b.category));
          break;
        case 'binary':
          cmp = a.binary.localeCompare(b.binary);
          break;
        case 'health':
          cmp = healthRank(a.name, healthMap, healthUnknown)
            - healthRank(b.name, healthMap, healthUnknown);
          break;
        default:
          cmp = 0;
      }
      if (cmp === 0) cmp = a.name.localeCompare(b.name);
      return cmp * dir;
    });
  }, [filteredTools, sortBy, sortDir, healthMap, healthUnknown]);

  const totalPages = Math.max(1, Math.ceil(sortedTools.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = sortedTools.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const pageEnd = Math.min(safePage * pageSize, sortedTools.length);
  const paginatedTools = useMemo(
    () => sortedTools.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sortedTools, safePage, pageSize],
  );
  const pageWindow = useMemo(() => buildPageWindow(safePage, totalPages), [safePage, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, tierFilter, healthFilter, showLocked, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (toolsLoading) {
    return (
      <div className="mx-auto max-w-7xl p-4 sm:p-6">
        <EmptyState title="Loading tools" subtitle="Fetching tool catalogue..." />
      </div>
    );
  }

  if (toolsError) {
    return (
      <div className="mx-auto max-w-7xl p-4 sm:p-6">
        <EmptyState title="Could not load tools" subtitle={toolsError} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Security tools</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Cheatsheet of all {total} tools Carina can use.
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            Prompt any of the trigger phrases to invoke a tool.
          </p>
        </div>
        {source === 'core' ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={healthLoading}
            onClick={() => void fetchHealth()}
          >
            {healthLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Refresh health
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard title="Total tools" value={String(total)} />
        <MetricCard
          title="Filtered"
          value={String(filteredTools.length)}
          detail={`${sortedTools.length} match filters`}
        />
        <MetricCard
          title="Page"
          value={`${safePage} / ${totalPages}`}
          detail={sortedTools.length > 0 ? `Showing ${pageStart}-${pageEnd}` : 'No rows'}
        />
        <MetricCard
          title="Installed"
          value={healthUnknown ? '--' : `${installedCount ?? 0} / ${total}`}
        />
        <MetricCard title="Your tier" value={CURRENT_TIER} detail={`${unlockedCount} unlocked`} />
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Filters and sort</p>
          {hasActiveFilters ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>

        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, binary, or trigger phrase..."
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1">
            <span className="text-xs font-medium text-text-muted">Category</span>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {categoryLabel(category)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-text-muted">Tier</span>
            <select
              value={tierFilter}
              onChange={(event) => setTierFilter(event.target.value as (typeof TIER_FILTERS)[number])}
              className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
            >
              {TIER_FILTERS.map((tier) => (
                <option key={tier} value={tier}>
                  {tier === 'all' ? 'All tiers' : tier}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-text-muted">Health</span>
            <select
              value={healthFilter}
              onChange={(event) => setHealthFilter(event.target.value as HealthFilter)}
              className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
            >
              <option value="all">All health states</option>
              <option value="installed">Installed only</option>
              <option value="missing">Missing only</option>
              <option value="unknown">Unknown only</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-text-muted">Sort</span>
            <select
              value={`${sortBy}:${sortDir}`}
              onChange={(event) => {
                const [column, dir] = event.target.value.split(':') as [SortColumn, SortDir];
                setSortBy(column);
                setSortDir(dir);
                setPage(1);
              }}
              className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
            >
              <option value="name:asc">Name (A-Z)</option>
              <option value="name:desc">Name (Z-A)</option>
              <option value="tier:asc">Tier (low to high)</option>
              <option value="tier:desc">Tier (high to low)</option>
              <option value="category:asc">Category (A-Z)</option>
              <option value="category:desc">Category (Z-A)</option>
              <option value="binary:asc">Binary (A-Z)</option>
              <option value="binary:desc">Binary (Z-A)</option>
              <option value="health:asc">Health (installed first)</option>
              <option value="health:desc">Health (missing first)</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={showLocked}
              onChange={(event) => setShowLocked(event.target.checked)}
              className="rounded border-border"
            />
            Show locked tools
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
            <span>Per page</span>
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value) as (typeof PAGE_SIZES)[number])}
              className="rounded-md border border-border bg-elevated px-2 py-1 text-sm text-text-primary"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {source === 'stub' ? (
        <div className="rounded-lg border border-border bg-surface p-3 text-xs text-text-secondary">
          {warning
            ?? 'Live core data unavailable. Tool list is from the cached registry; health status may be unknown.'}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-text-secondary">
        <span>
          {sortedTools.length === 0
            ? 'No tools match the current filters.'
            : `Showing ${pageStart}-${pageEnd} of ${sortedTools.length} tools`}
        </span>
        <span>
          Page {safePage} of {totalPages}
        </span>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[960px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-text-muted">
              <th className="w-12 px-3 py-2 font-semibold">#</th>
              <SortableHeader column="name" label="Tool" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader column="tier" label="Tier" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader column="binary" label="Binary" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <th className="px-3 py-2 font-semibold">Description</th>
              <th className="px-3 py-2 font-semibold">Trigger phrases</th>
              <SortableHeader column="health" label="Health" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {paginatedTools.map((tool, index) => {
              const locked = isToolLocked(tool);
              const rowNumber = pageStart + index;
              return (
                <tr
                  key={tool.name}
                  className={`border-b border-border last:border-0 ${locked ? 'opacity-50' : ''}`}
                >
                  <td className="px-3 py-3 align-top text-xs text-text-muted tabular-nums">{rowNumber}</td>
                  <td className="px-3 py-3 align-top">
                    <p className="font-mono text-sm font-semibold">{tool.name}</p>
                    <p className="text-xs text-text-muted">{categoryLabel(tool.category)}</p>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <TierBadge tier={tool.requiredTier} locked={locked} />
                  </td>
                  <td className="px-3 py-3 align-top font-mono text-xs text-text-muted">
                    {tool.binary}
                  </td>
                  <td className="max-w-xs px-3 py-3 align-top">
                    <ToolDescription tool={tool} />
                  </td>
                  <td className="max-w-sm px-3 py-3 align-top">
                    <TriggerList triggers={tool.triggers} />
                  </td>
                  <td className="px-3 py-3 align-top">
                    <HealthStatus installed={healthMap[tool.name]} unknown={healthUnknown} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {paginatedTools.map((tool, index) => {
          const locked = isToolLocked(tool);
          const rowNumber = pageStart + index;
          return (
            <div
              key={tool.name}
              className={`space-y-3 rounded-xl border border-border bg-surface p-4 ${locked ? 'opacity-50' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-text-muted">#{rowNumber}</p>
                  <p className="font-mono text-sm font-semibold">{tool.name}</p>
                  <p className="text-xs text-text-muted">{categoryLabel(tool.category)}</p>
                </div>
                <TierBadge tier={tool.requiredTier} locked={locked} />
              </div>
              <p className="font-mono text-xs text-text-muted">{tool.binary}</p>
              <ToolDescription tool={tool} />
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Trigger phrases
                </p>
                <TriggerList triggers={tool.triggers} />
              </div>
              <HealthStatus installed={healthMap[tool.name]} unknown={healthUnknown} />
            </div>
          );
        })}
      </div>

      {sortedTools.length === 0 ? (
        <EmptyState title="No tools match" subtitle="Try clearing your search or filters." />
      ) : (
        <PaginationBar
          page={safePage}
          totalPages={totalPages}
          pageWindow={pageWindow}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

function SortableHeader({
  column,
  label,
  sortBy,
  sortDir,
  onSort,
}: {
  column: SortColumn;
  label: string;
  sortBy: SortColumn;
  sortDir: SortDir;
  onSort: (column: SortColumn) => void;
}) {
  const active = sortBy === column;
  return (
    <th className="px-3 py-2 font-semibold">
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 hover:text-text-primary ${active ? 'text-text-primary' : ''}`}
      >
        {label}
        <ArrowUpDown className="h-3 w-3" aria-hidden />
        {active ? (
          <span className="sr-only">{sortDir === 'asc' ? 'ascending' : 'descending'}</span>
        ) : null}
      </button>
    </th>
  );
}

function PaginationBar({
  page,
  totalPages,
  pageWindow,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  pageWindow: Array<number | 'ellipsis'>;
  onPageChange: (page: number) => void;
}) {
  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-2 border-t border-border pt-4"
      aria-label="Security tools pages"
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
        Previous
      </Button>

      <div className="flex flex-wrap items-center gap-1">
        {pageWindow.map((item, index) =>
          item === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="px-2 text-sm text-text-muted">
              ...
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              className={
                item === page
                  ? 'min-w-8 rounded-md bg-accent px-2 py-1 text-sm text-white'
                  : 'min-w-8 rounded-md border border-border bg-elevated px-2 py-1 text-sm text-text-secondary hover:bg-surface-hover'
              }
              aria-current={item === page ? 'page' : undefined}
            >
              {item}
            </button>
          ),
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}