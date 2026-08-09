'use client';

import { useCallback, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';

type DemoPreview = {
  leads: number;
  replyReviews: number;
  bookings: number;
  lists: number;
  campaigns: number;
  enrollments: number;
  deliveries: number;
  followUpTasks: number;
  softWallPending: number;
};

type DemoStatusResponse = {
  preview: DemoPreview;
  total: number;
  markers?: {
    tag: string;
    emailDomain: string;
    listNamePrefix: string;
  };
};

const COUNT_ROWS: Array<{ key: keyof DemoPreview; label: string }> = [
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

export function DemoDataSettings() {
  const { push } = useToast();
  const [status, setStatus] = useState<DemoStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [purging, setPurging] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/aiva/outreach/demo-data', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Could not load demo data status');
        return res.json() as Promise<DemoStatusResponse>;
      })
      .then((data) => setStatus(data))
      .catch(() => {
        setStatus(null);
        push('Could not load demo data status', 'error');
      })
      .finally(() => setLoading(false));
  }, [push]);

  useEffect(() => {
    load();
  }, [load]);

  async function onPurge() {
    if (!confirm) {
      push('Tick the confirmation box first', 'error');
      return;
    }
    setPurging(true);
    try {
      const res = await fetch('/api/aiva/outreach/demo-data/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
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
          : 'No demo data found to remove.',
        'success',
      );
      load();
    } catch (error) {
      push(error instanceof Error ? error.message : 'Purge failed', 'error');
    } finally {
      setPurging(false);
    }
  }

  const total = status?.total ?? 0;
  const preview = status?.preview;

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
              rejected. Everything else stays.
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
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {COUNT_ROWS.filter((row) => (preview[row.key] ?? 0) > 0).map((row) => (
                <div
                  key={row.key}
                  className="flex items-center justify-between rounded-md border border-border bg-elevated px-3 py-2"
                >
                  <span className="text-xs text-text-muted">{row.label}</span>
                  <span className="text-sm font-semibold text-text-primary">{preview[row.key]}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-text-secondary">
              {total} demo item{total === 1 ? '' : 's'} ready to remove.
            </p>
          </div>
        )}

        <label className="mt-4 flex items-start gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={confirm}
            disabled={loading || total === 0 || purging}
            onChange={(e) => setConfirm(e.target.checked)}
          />
          <span>
            I understand this permanently deletes matching demo outreach data and cannot be undone.
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
            disabled={loading || purging || total === 0 || !confirm}
            onClick={() => void onPurge()}
          >
            {purging ? 'Purging...' : 'Purge demo data'}
          </Button>
        </div>
      </div>
    </div>
  );
}
