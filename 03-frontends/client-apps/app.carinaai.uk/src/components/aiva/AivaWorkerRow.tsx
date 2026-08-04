'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { AivaWorker } from '@/lib/aiva-types';
import { workerPersonaSubtitle } from '@/lib/aiva-role-templates';
import { AivaAvatar } from './AivaAvatar';
import { StatusChip } from './StatusChip';

export function AivaWorkerRow({ worker }: { worker: AivaWorker }) {
  return (
    <Link
      href={`/aiva/workers/${worker.id}`}
      className="flex min-h-20 items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-elevated"
    >
      <AivaAvatar name={worker.name} square className="h-11 w-11" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-sm font-semibold text-text-primary">{worker.name}</h2>
          <StatusChip status={worker.status} trialDaysLeft={worker.trialDaysLeft} />
        </div>
        <p className="mt-1 line-clamp-1 text-xs text-text-muted">
          {workerPersonaSubtitle(worker)}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
    </Link>
  );
}
