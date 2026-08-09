'use client';

import { cn } from '@/lib/utils';
import type { AivaActionType } from '@/lib/aiva-types';

const ACTION_BADGE_STYLES: Record<string, string> = {
  message_sent: 'bg-blue-500/10 text-blue-800 dark:text-blue-300',
  message_received: 'bg-gray-500/10 text-gray-700 dark:text-gray-300',
  escalated: 'bg-amber-500/10 text-amber-800 dark:text-amber-300',
  automation_run: 'bg-purple-500/10 text-purple-800 dark:text-purple-300',
  automation_ran: 'bg-purple-500/10 text-purple-800 dark:text-purple-300',
  tool_called: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
  skill_used: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
  task_completed: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
};

const ACTION_LABELS: Record<string, string> = {
  message_sent: 'Sent',
  message_received: 'Received',
  escalated: 'Escalated',
  automation_run: 'Automation',
  automation_ran: 'Automation',
  tool_called: 'Tool',
  skill_used: 'Skill',
  task_completed: 'Task',
};

export function ActionBadge({ type }: { type: AivaActionType | string }) {
  const style = ACTION_BADGE_STYLES[type] ?? 'bg-gray-500/10 text-gray-700 dark:text-gray-300';
  const label = ACTION_LABELS[type] ?? type.replace(/_/g, ' ');
  return (
    <span
      className={cn(
        'inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium capitalize',
        style,
      )}
    >
      {label}
    </span>
  );
}
