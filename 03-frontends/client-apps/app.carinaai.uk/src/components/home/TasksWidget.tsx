'use client';

import Link from 'next/link';
import { CheckSquare, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type Task = {
  id: string;
  name: string;
  status: string;
  type: string;
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500',
  paused: 'bg-amber-500',
  draft: 'bg-text-muted',
};

type TasksWidgetProps = {
  tasks: Task[];
  loading: boolean;
};

export function TasksWidget({ tasks, loading }: TasksWidgetProps) {
  const activeTasks = tasks.filter((t) => t.status === 'active');

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-3 w-3 text-accent" />
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Tasks</h2>
          {!loading && activeTasks.length > 0 && (
            <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
              {activeTasks.length}
            </span>
          )}
        </div>
        <Link
          href="/tasks"
          className="group flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-accent"
        >
          See all
          <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-elevated" />
          ))}
        </div>
      ) : activeTasks.length === 0 ? (
        <p className="text-sm text-text-secondary">
          No active tasks. Ask your agent to work on something in the background.
        </p>
      ) : (
        <div className="space-y-2">
          {activeTasks.slice(0, 3).map((task) => (
            <Link
              key={task.id}
              href="/tasks"
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  STATUS_COLORS[task.status] ?? 'bg-text-muted',
                )}
              />
              <span className="truncate">{task.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
