'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';

type DemoCategory =
  | 'leads'
  | 'lists'
  | 'campaigns'
  | 'enrollments'
  | 'deliveries'
  | 'replyReviews'
  | 'bookings'
  | 'followUpTasks'
  | 'softWallPending';

type DemoPreview = Record<DemoCategory, number>;

type DemoStatusResponse = {
  preview: DemoPreview;
  total: number;
  markers?: {
    tag: string;
    emailDomain: string;
    listNamePrefix: string;
  };
};

const COUNT_ROWS: Array<{ key: DemoCategory; label: string }> = [
  { key: 'leads', label: 'Leads' },
  { key: 'lists', label: 'Lists' },
  { key: 'campaigns', label: 'Campaigns' },
  { key: 'enrollments', label: 'Enrollments' },
  { key: 'deliveries', label: 'Deliveries' },
  { key: 'replyReviews', label: 'Reply reviews' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'followUpTasks', label: 'Follow-up tasks' },
  { key: 'softWallPending', label: 'Soft Wall drafts' },
];

function selectedTotal(preview: DemoPreview, selected: Set<DemoCategory>): number {
  let sum = 0;
  for (const key of selected) sum += preview[key] ?? 0;
  return sum;
}

export function DemoDataSettings() {
  const { push } = useToast();
  const [status, setStatus] = useState<DemoStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [purging, setPurging] = useState(false);
  const [selected, setSelected] = useState<Set<DemoCategory>>(new Set());

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/aiva/outreach/demo-data', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Could not load demo data status');
        return res.json() as Promise<DemoStatusResponse>;
      })
      .then((data) => {
        setStatus(data);
        const present = COUNT_ROWS
          .filter((row) => (data.preview[row.key] ?? 0) > 0)
          .map((row) => row.key);
        setSelected(new Set(present));
        setConfirm(false);
      })
      .catch(() => {
        setStatus(null);
        setSelected(new Set());
        push('Could not load demo data status', 'error');
      })
      .finally(() => setLoading(false));
  }, [push]);

  useEffect(() => {
    load();
  }, [load]);

  const preview = status?.preview;
  const presentRows = useMemo(
    () => COUNT_ROWS.filter((row) => (preview?.[row.key] ?? 0) > 0),
    [preview],
  );
  const total = status?.total ?? 0;
  const chosenCount = preview ? selectedTotal(preview, selected) : 0;
  const allPresentSelected =
    presentRows.length > 0 && presentRows.every((row) => selected.has(row.key));

  function toggleCategory(key: DemoCategory) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAllPresent() {
    setSelected(new Set(presentRows.map((row) => row.key)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function onPurge() {
    if (!confirm) {
      push('Tick the confirmation box first', 'error');
      return;
    }
    if (selected.size === 0) {
      push('Select at least one category', 'error');
      return;
    }
    setPurging(true);
    try {
      const categories = COUNT_ROWS.map((row) => row.key).filter((key) => selected.has(key));
      const purgeAll = allPresentSelected && categories.length === presentRows.length;
      const res = await fetch('/api/aiva/outreach/demo-data/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          purgeAll
            ? { confirm: true, all: true }
            : { confirm: true, all: false, categories },
        ),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        totalRemoved?: number;
      };
      if (!res.ok) throw new Error(data.error ?? 'Purge failed');
      setConfirm(false);
      push(
        data.totalRemoved
          ? `Removed ${data.totalRemoved} demo item(s). Real data was kept.`
          : 'No demo data found in the selected categories.',
        'success',
      );
      load();
    } catch (error) {
      push(error instanceof Error ? error.message : 'Purge failed', 'error');
    } finally {
      setPurging(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-base font-semibold text-text-primary">Data</h1>
        <p className="text-xs text-text-muted">
          Remove seeded SOP demo outreach rows and keep only real leads and activity you added.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-3 flex items-start gap-3">
          <div className="mt-0.5 rounded-md bg-elevated p-2 text-text-secondary">
            <Trash2 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text-primary">Purge demo data</p>
            <p className="mt-0.5 text-xs text-text-muted">
              Deletes rows tagged <code className="text-text-secondary">SOP_DEMO</code>, emails on{' '}
              <code className="text-text-secondary">@sop-demo.test</code>, and lists or campaigns whose
              names start with &quot;SOP Demo&quot;. Soft Wall drafts that match those markers are
              rejected. Choose categories below, or purge everything found.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="text-xs text-text-muted">Scanning workspace...</p>
        ) : !preview ? (
          <p className="text-xs text-text-muted">Could not load demo data status.</p>
        ) : total === 0 ? (
          <p className="rounded-md border border-border bg-elevated px-3 py-2 text-xs text-text-secondary">
            No demo data found in this workspace.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7"
                disabled={purging}
                onClick={() => selectAllPresent()}
              >
                Select all
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7"
                disabled={purging || selected.size === 0}
                onClick={() => clearSelection()}
              >
                Clear
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {presentRows.map((row) => {
                const checked = selected.has(row.key);
                return (
                  <label
                    key={row.key}
                    className={cn(
                      'flex cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2 transition-colors',
                      checked
                        ? 'border-accent/40 bg-accent/5'
                        : 'border-border bg-elevated hover:border-border',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={purging}
                        onChange={() => toggleCategory(row.key)}
                      />
                      <span className="text-xs text-text-secondary">{row.label}</span>
                    </span>
                    <span className="text-sm font-semibold text-text-primary">{preview[row.key]}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-text-secondary">
              {chosenCount} of {total} demo item{total === 1 ? '' : 's'} selected.
            </p>
          </div>
        )}

        <label className="mt-4 flex items-start gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={confirm}
            disabled={loading || total === 0 || purging || selected.size === 0}
            onChange={(e) => setConfirm(e.target.checked)}
          />
          <span>
            I understand this permanently deletes the selected demo outreach data and cannot be undone.
          </span>
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || purging}
            onClick={() => load()}
          >
            Refresh
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={loading || purging || total === 0 || !confirm || selected.size === 0}
            onClick={() => void onPurge()}
          >
            {purging
              ? 'Purging...'
              : allPresentSelected
                ? 'Purge everything'
                : `Purge selected (${chosenCount})`}
          </Button>
        </div>
      </div>
    </div>
  );
}
