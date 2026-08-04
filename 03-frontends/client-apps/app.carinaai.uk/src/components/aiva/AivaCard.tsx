'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { AivaAvatar } from '@/components/aiva/AivaAvatar';
import { ChannelIcons } from '@/components/aiva/ChannelIcon';
import { StatusChip } from '@/components/aiva/StatusChip';
import type { AivaWorker } from '@/lib/aiva-types';
import { readAivaError, timeAgo } from '@/lib/aiva-utils';
import { workerPersonaSubtitle } from '@/lib/aiva-role-templates';
import { useRelativeTimeLabel } from '@/hooks/useRelativeTimeLabel';

function PauseButton({
  workerId,
  status,
  onStatusChange,
}: {
  workerId: string;
  status: string;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [localStatus, setLocalStatus] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const isPaused = localStatus === 'paused';

  async function toggle() {
    const next = isPaused ? 'active' : 'paused';
    const prev = localStatus;
    setLocalStatus(next);
    setError(null);
    try {
      const res = await fetch(`/api/aiva/workers/${workerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        setLocalStatus(prev);
        setError(await readAivaError(res));
        return;
      }
      onStatusChange(workerId, next);
    } catch {
      setLocalStatus(prev);
      setError('Could not update status');
    }
  }

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={() => void toggle()}
        title={isPaused ? 'Resume' : 'Pause'}
        className="rounded p-1 text-text-muted transition-colors hover:bg-overlay hover:text-text-primary"
      >
        {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
      </button>
      {error ? <span className="text-[10px] text-danger">{error}</span> : null}
    </div>
  );
}

export function AivaCard({
  worker,
  onStatusChange,
}: {
  worker: AivaWorker;
  onStatusChange: (id: string, status: string) => void;
}) {
  const lastActiveLabel = useRelativeTimeLabel(worker.lastActiveAt ?? null);
  const desc = workerPersonaSubtitle(worker);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-elevated p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <AivaAvatar name={worker.name} />
          <div className="min-w-0">
            <p className="truncate font-medium text-text-primary">{worker.name}</p>
            <p className="truncate text-xs text-text-muted">{desc}</p>
          </div>
        </div>
        <StatusChip status={worker.status} trialDaysLeft={worker.trialDaysLeft} />
      </div>

      <div className="border-t border-border" />

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <ChannelIcons channels={worker.channels} />
          <span className="truncate text-xs text-text-muted">
            {worker.messagesToday ?? 0} msgs today · {lastActiveLabel}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Link
            href={`/aiva/workers/${worker.id}`}
            className="px-2 py-1 text-xs text-text-secondary hover:text-accent"
          >
            Manage
          </Link>
          <PauseButton
            workerId={worker.id}
            status={worker.status}
            onStatusChange={onStatusChange}
          />
        </div>
      </div>
    </div>
  );
}
