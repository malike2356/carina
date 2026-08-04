'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AgentOsShell } from '@/components/agent-os/AgentOsShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ListSkeleton } from '@/components/ui/Skeleton';

type TaskStatus = 'draft' | 'active' | 'paused';

type TaskRow = {
  id: string;
  name: string;
  description: string;
  status: TaskStatus;
  updatedAt: string;
};

const COLUMNS: TaskStatus[] = ['draft', 'active', 'paused'];

export default function AgentOsBoardPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/tasks');
      if (!res.ok) throw new Error('Could not load tasks');
      const data = (await res.json()) as { data?: TaskRow[] };
      setTasks(data.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load tasks');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const byColumn = useMemo(() => {
    const map: Record<TaskStatus, TaskRow[]> = { draft: [], active: [], paused: [] };
    for (const task of tasks) {
      const status = COLUMNS.includes(task.status) ? task.status : 'draft';
      map[status].push(task);
    }
    return map;
  }, [tasks]);

  const move = async (task: TaskRow, status: TaskStatus) => {
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      setError('Move failed. Check plan gates and auth.');
      return;
    }
    await load();
  };

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: 'Created from Agent OS board',
          status: 'draft',
          taskType: 'action',
          triggerType: 'on_event',
          prompt: 'Follow up as a sub-agent task.',
        }),
      });
      if (!res.ok) throw new Error('Create failed');
      setName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AgentOsShell
      title="Sub-agent board"
      description="Kanban over real scheduled tasks (draft / active / paused)."
      actions={
        <Button type="button" variant="outline" className="min-h-11" onClick={() => void load()}>
          Refresh
        </Button>
      }
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New task name"
          className="min-h-11 text-base"
        />
        <Button type="button" className="min-h-11" disabled={saving} onClick={() => void create()}>
          Create task
        </Button>
      </div>
      {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}
      <p className="mb-4 text-xs text-text-muted">
        Dangerous delegate-task tools stay plan-gated. This board uses workspace tasks you can move and run.
      </p>
      {loading ? (
        <ListSkeleton rows={6} />
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {COLUMNS.map((column) => (
            <section key={column} className="rounded-xl border border-border bg-elevated/30 p-3">
              <h2 className="mb-3 text-sm font-semibold capitalize text-text-primary">
                {column} ({byColumn[column].length})
              </h2>
              {!byColumn[column].length ? (
                <p className="text-xs text-text-muted">Empty</p>
              ) : (
                <ul className="space-y-2">
                  {byColumn[column].map((task) => (
                    <li key={task.id} className="rounded-lg border border-border bg-background p-3">
                      <p className="text-sm text-text-primary">{task.name}</p>
                      <p className="mt-1 text-[11px] text-text-muted">
                        Updated {new Date(task.updatedAt).toLocaleString()}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {COLUMNS.filter((c) => c !== task.status).map((next) => (
                          <button
                            key={next}
                            type="button"
                            className="min-h-11 rounded border border-border px-2 text-[11px] text-text-secondary"
                            onClick={() => void move(task, next)}
                          >
                            Move to {next}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </AgentOsShell>
  );
}
