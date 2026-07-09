'use client';

import Link from 'next/link';
import { Brain, ArrowRight } from 'lucide-react';

type BrainStatsWidgetProps = {
  memoryCount: number;
  skillCount: number;
  loading: boolean;
};

function StatRow({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-text-secondary">{label}</span>
      {loading ? (
        <span className="h-3 w-8 animate-pulse rounded bg-elevated" />
      ) : (
        <span className="text-sm font-semibold tabular-nums text-text-primary">{value}</span>
      )}
    </div>
  );
}

export function BrainStatsWidget({ memoryCount, skillCount, loading }: BrainStatsWidgetProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-3 w-3 text-accent" />
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Brain</h2>
        </div>
        <Link
          href="/library"
          className="group flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-accent"
        >
          Open
          <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
        </Link>
      </div>

      {loading ? (
        <div className="divide-y divide-border">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <div className="h-3 w-16 animate-pulse rounded bg-elevated" />
              <div className="h-3 w-8 animate-pulse rounded bg-elevated" />
            </div>
          ))}
        </div>
      ) : memoryCount === 0 && skillCount === 0 ? (
        <p className="text-sm text-text-secondary">
          Start a session and your agent will begin building its memory here.
        </p>
      ) : (
        <div className="divide-y divide-border">
          <StatRow label="Memories" value={memoryCount} loading={false} />
          <StatRow label="Skills" value={skillCount} loading={false} />
        </div>
      )}
    </div>
  );
}
