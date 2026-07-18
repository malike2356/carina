'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  CalendarClock,
  History,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Zap,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { OriginBadge } from '@/components/ui/OriginBadge';
import { OriginFilterChips } from '@/components/ui/OriginFilterChips';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  TASKS_ORIGIN_HELPER_TEXT,
  classifyTaskOrigin,
  matchesOriginFilter,
  type OriginFilter,
} from '@/lib/sync-ownership';
import { cn } from '@/lib/utils';

type TaskStatus = 'active' | 'paused' | 'draft';
type TaskTrigger = 'schedule' | 'on_event' | 'webhook';
type TaskType = 'prompt' | 'research' | 'action';
type TaskRunStatus = 'running' | 'completed' | 'failed';

interface TaskRow {
  id: string;
  name: string;
  description: string;
  triggerType: TaskTrigger;
  taskType: TaskType;
  status: TaskStatus;
  cronExpression: string | null;
  prompt: string;
  lastRunAt: string | null;
  runCount: number;
  builtIn: boolean;
  updatedAt: string;
}

interface TaskRunRow {
  id: string;
  status: TaskRunStatus;
  output: string | null;
  error: string | null;
  durationMs: number | null;
  createdAt: string;
  completedAt: string | null;
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  draft: 'Draft',
};

const TRIGGER_LABELS: Record<TaskTrigger, string> = {
  schedule: 'Schedule',
  on_event: 'Event',
  webhook: 'Webhook',
};

const TYPE_LABELS: Record<TaskType, string> = {
  prompt: 'Prompt',
  research: 'Research',
  action: 'Action',
};

function formatDate(value: string | null) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusClass(status: TaskStatus | TaskRunStatus) {
  if (status === 'active' || status === 'completed') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  if (status === 'paused' || status === 'running') return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  return 'border-border bg-elevated text-text-muted';
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [runs, setRuns] = useState<TaskRunRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [runsLoading, setRunsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [originFilter, setOriginFilter] = useState<OriginFilter>('all');
  const [form, setForm] = useState({
    name: '',
    description: '',
    triggerType: 'schedule' as TaskTrigger,
    taskType: 'prompt' as TaskType,
    cronExpression: '0 9 * * 1',
    prompt: '',
  });

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) =>
        matchesOriginFilter({ origin: classifyTaskOrigin(task) }, originFilter),
      ),
    [tasks, originFilter],
  );

  const selectedTask = useMemo(
    () => filteredTasks.find((task) => task.id === selectedId) ?? filteredTasks[0] ?? null,
    [selectedId, filteredTasks],
  );

  async function loadTasks() {
    setLoading(true);
    const response = await fetch('/api/tasks');
    const data = await response.json();
    if (data.data) {
      setTasks(data.data);
      setSelectedId((current) => current ?? data.data[0]?.id ?? null);
    }
    setLoading(false);
  }

  async function loadRuns(taskId: string) {
    setRunsLoading(true);
    const response = await fetch(`/api/tasks/${taskId}/runs`);
    const data = await response.json();
    setRuns(data.data ?? []);
    setRunsLoading(false);
  }

  useEffect(() => {
    void loadTasks();
  }, []);

  useEffect(() => {
    if (selectedTask) void loadRuns(selectedTask.id);
    else setRuns([]);
  }, [selectedTask?.id]);

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) return;

    setSaving(true);
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        status: 'draft',
        cronExpression: form.triggerType === 'schedule' ? form.cronExpression : null,
      }),
    });
    const data = await response.json();
    if (data.data) {
      setTasks((current) => [data.data, ...current]);
      setSelectedId(data.data.id);
      setForm({
        name: '',
        description: '',
        triggerType: 'schedule',
        taskType: 'prompt',
        cronExpression: '0 9 * * 1',
        prompt: '',
      });
    }
    setSaving(false);
  }

  async function updateStatus(task: TaskRow, status: TaskStatus) {
    const response = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await response.json();
    if (data.data) {
      setTasks((current) => current.map((item) => (item.id === task.id ? data.data : item)));
    }
  }

  async function deleteTask(task: TaskRow) {
    if (!window.confirm(`Delete "${task.name}"?`)) return;
    await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
    setTasks((current) => current.filter((item) => item.id !== task.id));
    if (selectedId === task.id) setSelectedId(null);
  }

  async function runTask(task: TaskRow) {
    setSaving(true);
    try {
      const response = await fetch('/api/tasks/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        data?: { runs?: unknown[] };
      };
      if (!response.ok) {
        setError(data.error ?? 'Unable to run task');
        setSaving(false);
        return;
      }
      if (data.data?.runs?.length) {
        await loadTasks();
        await loadRuns(task.id);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-base">
      <div className="flex items-center gap-4 border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Tasks</h1>
          <p className="mt-0.5 text-xs text-text-muted">{TASKS_ORIGIN_HELPER_TEXT}</p>
          {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void loadTasks()}
          className="ml-auto"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      <div className="border-b border-border px-6 py-2">
        <OriginFilterChips value={originFilter} onChange={setOriginFilter} showGoogle={false} />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px] overflow-hidden max-lg:grid-cols-1">
        <div className="min-h-0 overflow-y-auto px-6 py-5">
          <form
            onSubmit={(event) => void createTask(event)}
            className="mb-5 rounded-lg border border-border bg-surface p-4"
          >
            <div className="mb-3 flex items-center gap-2">
              <Plus className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-text-primary">New automation</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Task name"
              />
              <Input
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Description"
              />
              <select
                value={form.triggerType}
                onChange={(event) =>
                  setForm((current) => ({ ...current, triggerType: event.target.value as TaskTrigger }))
                }
                className="h-10 rounded-md border border-border bg-elevated px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="schedule">Schedule</option>
                <option value="on_event">Event</option>
                <option value="webhook">Webhook</option>
              </select>
              <select
                value={form.taskType}
                onChange={(event) =>
                  setForm((current) => ({ ...current, taskType: event.target.value as TaskType }))
                }
                className="h-10 rounded-md border border-border bg-elevated px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="prompt">Prompt</option>
                <option value="research">Research</option>
                <option value="action">Action</option>
              </select>
              <Input
                value={form.cronExpression}
                onChange={(event) => setForm((current) => ({ ...current, cronExpression: event.target.value }))}
                placeholder="Cron expression"
                disabled={form.triggerType !== 'schedule'}
              />
              <Input
                value={form.prompt}
                onChange={(event) => setForm((current) => ({ ...current, prompt: event.target.value }))}
                placeholder="Automation prompt"
              />
            </div>
            <div className="mt-3 flex justify-end">
              <Button type="submit" size="sm" disabled={saving || !form.name.trim()}>
                <Plus className="h-3.5 w-3.5" />
                {saving ? 'Creating' : 'Create draft'}
              </Button>
            </div>
          </form>

          {loading ? (
            <div className="flex h-56 items-center justify-center">
              <Spinner />
            </div>
          ) : filteredTasks.length === 0 ? (
            <EmptyState title="No tasks" subtitle="Create an automation to start tracking scheduled work. Google list import awaits the Tasks API." />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="grid grid-cols-[minmax(220px,1fr)_120px_120px_110px_128px] border-b border-border bg-elevated px-4 py-2 text-xs font-medium text-text-muted max-xl:grid-cols-[minmax(220px,1fr)_110px_96px_112px]">
                <span>Task</span>
                <span className="max-xl:hidden">Trigger</span>
                <span>Type</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              {filteredTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => setSelectedId(task.id)}
                  className={cn(
                    'grid w-full grid-cols-[minmax(220px,1fr)_120px_120px_110px_128px] items-center gap-2 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-elevated/60 max-xl:grid-cols-[minmax(220px,1fr)_110px_96px_112px]',
                    selectedTask?.id === task.id && 'bg-elevated',
                  )}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-text-primary">{task.name}</span>
                      <OriginBadge origin={classifyTaskOrigin(task)} />
                      {task.builtIn && (
                        <span className="rounded border border-accent/25 bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                          Built in
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block truncate text-xs text-text-muted">{task.description || task.prompt}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-text-secondary max-xl:hidden">
                    <CalendarClock className="h-3.5 w-3.5 text-text-muted" />
                    {TRIGGER_LABELS[task.triggerType]}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                    {task.taskType === 'action' ? <Zap className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                    {TYPE_LABELS[task.taskType]}
                  </span>
                  <span>
                    <span className={cn('rounded border px-2 py-1 text-[11px] font-medium', statusClass(task.status))}>
                      {STATUS_LABELS[task.status]}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        void runTask(task);
                      }}
                      title="Run task now"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        void updateStatus(task, task.status === 'active' ? 'paused' : 'active');
                      }}
                      title={task.status === 'active' ? 'Pause task' : 'Activate task'}
                    >
                      {task.status === 'active' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        void deleteTask(task);
                      }}
                      title="Delete task"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-danger" />
                    </Button>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="min-h-0 overflow-y-auto border-l border-border bg-surface px-5 py-5 max-lg:border-l-0 max-lg:border-t">
          {selectedTask ? (
            <>
                <div className="flex items-start gap-3">
                  <div className="rounded-md border border-border bg-elevated p-2">
                    <History className="h-4 w-4 text-accent" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-text-primary">{selectedTask.name}</h2>
                    <p className="mt-1 text-xs text-text-muted">
                      Last run {formatDate(selectedTask.lastRunAt)}. {selectedTask.runCount} total runs.
                    </p>
                  </div>
                </div>
              <div className="mt-4 flex gap-2">
                <Button type="button" size="sm" onClick={() => void runTask(selectedTask)}>
                  <Play className="h-3.5 w-3.5" />
                  Run now
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={selectedTask.status === 'active' ? 'outline' : 'default'}
                  onClick={() => void updateStatus(selectedTask, selectedTask.status === 'active' ? 'paused' : 'active')}
                >
                  {selectedTask.status === 'active' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  {selectedTask.status === 'active' ? 'Pause' : 'Activate'}
                </Button>
              </div>

              <div className="mt-5 space-y-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">Prompt</p>
                  <p className="mt-1 rounded-md border border-border bg-elevated p-3 text-xs leading-5 text-text-secondary">
                    {selectedTask.prompt || 'No prompt configured.'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">Run history</p>
                  {runsLoading ? (
                    <div className="mt-4 flex justify-center">
                      <Spinner />
                    </div>
                  ) : runs.length === 0 ? (
                    <p className="mt-2 text-xs text-text-muted">No runs recorded yet.</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {runs.map((run) => (
                        <div key={run.id} className="rounded-md border border-border bg-elevated p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className={cn('rounded border px-2 py-1 text-[11px] font-medium', statusClass(run.status))}>
                              {run.status}
                            </span>
                            <span className="text-[11px] text-text-muted">{formatDate(run.createdAt)}</span>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-text-secondary">
                            {run.error || run.output || 'No output.'}
                          </p>
                          {run.durationMs !== null && (
                            <p className="mt-1 text-[11px] text-text-muted">{run.durationMs} ms</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <EmptyState title="No task selected" subtitle="Select a task to view run details." />
          )}
        </aside>
      </div>
    </div>
  );
}
