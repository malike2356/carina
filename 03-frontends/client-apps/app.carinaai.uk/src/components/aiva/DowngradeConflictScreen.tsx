'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { AivaWorker } from '@/lib/aiva-types';

type DowngradeConflictScreenProps = {
  workers: AivaWorker[];
  pendingDowngradeTier: string;
  pendingDowngradeSlotLimit: number;
  aivasUsed: number;
  onResolved: () => void;
};

export function DowngradeConflictScreen({
  workers,
  pendingDowngradeTier,
  pendingDowngradeSlotLimit,
  aivasUsed,
  onResolved,
}: DowngradeConflictScreenProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const tierLabel = pendingDowngradeTier.charAt(0).toUpperCase() + pendingDowngradeTier.slice(1);
  const activeWorkers = workers.filter((w) => w.status !== 'dismissed');

  function toggle(workerId: string) {
    setSelected((prev) => {
      if (prev.includes(workerId)) return prev.filter((id) => id !== workerId);
      if (prev.length >= pendingDowngradeSlotLimit) return prev;
      return [...prev, workerId];
    });
  }

  async function confirm() {
    setError('');
    setPending(true);
    try {
      const res = await fetch('/api/aiva/billing/resolve-downgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keepWorkerIds: selected }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not resolve downgrade conflict');
        return;
      }
      onResolved();
    } catch {
      setError('Could not resolve downgrade conflict');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-border bg-surface p-8">
      <h1 className="text-xl font-semibold text-text-primary">Action needed before your plan change</h1>
      <p className="mt-3 text-sm text-text-secondary">
        You are moving to Aiva {tierLabel}, which includes {pendingDowngradeSlotLimit} Aiva
        {pendingDowngradeSlotLimit === 1 ? '' : 's'}. You currently have {aivasUsed} active Aiva
        {aivasUsed === 1 ? '' : 's'}. Please choose which Aiva(s) to keep. The rest will be paused.
      </p>
      <ul className="mt-6 space-y-2">
        {activeWorkers.map((worker) => {
          const checked = selected.includes(worker.id);
          const disabled = !checked && selected.length >= pendingDowngradeSlotLimit;
          return (
            <li key={worker.id}>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 ${
                  checked ? 'border-accent bg-accent-dim/30' : 'border-border'
                } ${disabled ? 'opacity-50' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(worker.id)}
                />
                <span className="flex-1 text-sm text-text-primary">{worker.name}</span>
                <span className="text-xs text-text-muted">{worker.roleDescription?.slice(0, 48)}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-sm text-text-muted">
        Select {pendingDowngradeSlotLimit} to keep. {selected.length} of {pendingDowngradeSlotLimit} selected.
      </p>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      <Button
        className="mt-6"
        disabled={pending || selected.length !== pendingDowngradeSlotLimit}
        onClick={() => void confirm()}
      >
        {pending ? 'Saving...' : 'Confirm and keep selected Aivas'}
      </Button>
    </div>
  );
}
