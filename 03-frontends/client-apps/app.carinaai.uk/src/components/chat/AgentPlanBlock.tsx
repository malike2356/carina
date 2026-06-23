'use client';

import { useState } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  CircleDotDashed,
  CircleX,
  ChevronDown,
  ChevronRight,
  ListTodo,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Subtask {
  id: string;
  title: string;
  status: string;
  priority?: string;
}

interface PlanTask {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  subtasks?: Subtask[];
}

export interface AgentPlan {
  tasks: PlanTask[];
  title?: string;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'done':
    case 'completed':
      return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-accent" />;
    case 'in-progress':
    case 'running':
      return <CircleDotDashed className="h-3.5 w-3.5 shrink-0 animate-pulse text-yellow-500" />;
    case 'failed':
    case 'error':
      return <CircleX className="h-3.5 w-3.5 shrink-0 text-danger" />;
    case 'blocked':
      return <CircleAlert className="h-3.5 w-3.5 shrink-0 text-text-muted" />;
    default:
      return <Circle className="h-3.5 w-3.5 shrink-0 text-text-muted" />;
  }
}

function PriorityBadge({ priority }: { priority?: string }) {
  if (!priority) return null;
  const map: Record<string, string> = {
    high: 'bg-danger/10 text-danger',
    medium: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    low: 'bg-text-muted/10 text-text-muted',
  };
  return (
    <span className={cn('rounded px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide', map[priority] ?? map.low)}>
      {priority}
    </span>
  );
}

function SubtaskRow({ subtask }: { subtask: Subtask }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="flex items-center gap-2 py-1 pl-6"
    >
      <StatusIcon status={subtask.status} />
      <span className="flex-1 text-xs text-text-secondary">{subtask.title}</span>
      <PriorityBadge priority={subtask.priority} />
    </motion.div>
  );
}

function TaskRow({ task }: { task: PlanTask }) {
  const hasSubs = (task.subtasks?.length ?? 0) > 0;
  const [open, setOpen] = useState(
    task.status === 'in-progress' || task.status === 'running',
  );

  return (
    <motion.div layout className="overflow-hidden">
      <button
        type="button"
        onClick={() => hasSubs && setOpen((v) => !v)}
        className={cn(
          'flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-overlay',
          !hasSubs && 'cursor-default',
        )}
      >
        <StatusIcon status={task.status} />
        <span className="flex-1 font-medium text-text-primary">{task.title}</span>
        <PriorityBadge priority={task.priority} />
        {hasSubs && (
          open
            ? <ChevronDown className="h-3 w-3 shrink-0 text-text-muted" />
            : <ChevronRight className="h-3 w-3 shrink-0 text-text-muted" />
        )}
      </button>
      {task.description && (
        <p className="pb-1 pl-9 pr-3 text-xs text-text-muted">{task.description}</p>
      )}
      <AnimatePresence>
        {open && hasSubs && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-l border-border ml-5"
          >
            {task.subtasks!.map((sub) => (
              <SubtaskRow key={sub.id} subtask={sub} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function AgentPlanBlock({ plan }: { plan: AgentPlan }) {
  const total = plan.tasks.length;
  const done = plan.tasks.filter(
    (t) => t.status === 'done' || t.status === 'completed',
  ).length;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-elevated font-sans text-xs">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <ListTodo className="h-3.5 w-3.5 text-accent" />
        <span className="flex-1 text-xs font-medium text-text-secondary">
          {plan.title ?? 'Task Plan'}
        </span>
        <span className="text-[10px] text-text-muted">{done}/{total} done</span>
      </div>
      <LayoutGroup>
        {plan.tasks.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
      </LayoutGroup>
    </div>
  );
}

export function isAgentPlan(value: unknown): value is AgentPlan {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  if (!Array.isArray(obj.tasks) || obj.tasks.length === 0) return false;
  const first = obj.tasks[0];
  if (!first || typeof first !== 'object') return false;
  const t = first as Record<string, unknown>;
  return 'id' in t && 'title' in t && 'status' in t;
}
