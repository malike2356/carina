# Prompt 12 - Tasks and Automation

## Objective

Build the `/tasks` page: a cron-style task manager where users can create automated Carina tasks that run on a schedule (cron expression), on a recurring interval, or on webhook trigger. Each task has a prompt that Carina executes. Users can see run history, enable/disable tasks, and view output from each run. Two built-in tasks (session tidy and memory tidy) are provided as starting examples.

This closes the automation gap between Carina and Odysseus: Odysseus has no scheduling either, so this feature puts Carina ahead.

---

## Context

Working directory: `/opt/lampp/htdocs/verlox/carina/app.carinaai.uk`

Prerequisites: Prompts 00-11 complete. `scheduledTasks` and `taskRuns` tables exist (Prompt 01). The sidebar links to `/tasks`.

Note: Task execution happens via a separate cron endpoint (`/api/tasks/run`) that the deployment infrastructure (Vercel cron or a sidecar) calls on a schedule. The frontend only manages task configuration and displays history. Actual execution is a stub at this stage - the infrastructure wiring is handled by the deployment team.

---

## Step 1 - Tasks API Routes

### GET and POST /api/tasks

Create `src/app/api/tasks/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { db } from '@/db';
import { scheduledTasks } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);

  const rows = await db
    .select()
    .from(scheduledTasks)
    .where(eq(scheduledTasks.workspaceId, workspace.id))
    .orderBy(desc(scheduledTasks.createdAt));

  return NextResponse.json({ data: rows });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);

  const body = await req.json() as {
    name?: string;
    description?: string;
    triggerType?: string;
    taskType?: string;
    cronExpression?: string;
    eventEveryN?: number;
    eventUnit?: string;
    prompt?: string;
  };

  const name = String(body.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  const prompt = String(body.prompt ?? '').trim();
  if (!prompt) return NextResponse.json({ error: 'prompt is required' }, { status: 400 });

  const [created] = await db
    .insert(scheduledTasks)
    .values({
      workspaceId:    workspace.id,
      name,
      description:    body.description ?? '',
      triggerType:    (body.triggerType as 'schedule' | 'on_event' | 'webhook') ?? 'schedule',
      taskType:       (body.taskType as 'prompt' | 'research' | 'action') ?? 'prompt',
      status:         'active',
      cronExpression: body.cronExpression ?? null,
      eventEveryN:    body.eventEveryN ?? null,
      eventUnit:      body.eventUnit ?? null,
      prompt,
    })
    .returning();

  return NextResponse.json({ data: created });
}
```

### PATCH and DELETE /api/tasks/[id]

Create `src/app/api/tasks/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { db } from '@/db';
import { scheduledTasks } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

async function getOwned(userId: string, taskId: string) {
  const workspace = await requireWorkspace(userId);
  const [row] = await db
    .select()
    .from(scheduledTasks)
    .where(and(eq(scheduledTasks.id, taskId), eq(scheduledTasks.workspaceId, workspace.id)))
    .limit(1);
  return { workspace, task: row ?? null };
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { task } = await getOwned(session.user.id, params.id);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json() as { status?: string; name?: string; prompt?: string; cronExpression?: string };
  const updates: Partial<typeof scheduledTasks.$inferInsert> = {};
  if (body.status)         updates.status         = body.status as typeof task.status;
  if (body.name)           updates.name           = body.name.trim();
  if (body.prompt)         updates.prompt         = body.prompt.trim();
  if (body.cronExpression !== undefined) updates.cronExpression = body.cronExpression;

  await db.update(scheduledTasks).set(updates).where(eq(scheduledTasks.id, params.id));
  return NextResponse.json({ data: { ok: true } });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { task } = await getOwned(session.user.id, params.id);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (task.builtIn) return NextResponse.json({ error: 'Cannot delete built-in tasks' }, { status: 400 });
  await db.delete(scheduledTasks).where(eq(scheduledTasks.id, params.id));
  return NextResponse.json({ data: { ok: true } });
}
```

### GET /api/tasks/[id]/runs - Task Run History

Create `src/app/api/tasks/[id]/runs/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { db } from '@/db';
import { scheduledTasks, taskRuns } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);

  const [task] = await db
    .select({ id: scheduledTasks.id })
    .from(scheduledTasks)
    .where(and(eq(scheduledTasks.id, params.id), eq(scheduledTasks.workspaceId, workspace.id)))
    .limit(1);

  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const runs = await db
    .select()
    .from(taskRuns)
    .where(eq(taskRuns.taskId, params.id))
    .orderBy(desc(taskRuns.createdAt))
    .limit(20);

  return NextResponse.json({ data: runs });
}
```

### POST /api/tasks/run - Execution Endpoint (called by cron infrastructure)

Create `src/app/api/tasks/run/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { scheduledTasks, taskRuns, workspaces } from '@/db/schema';
import { eq, and, lte } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// This endpoint is called by external cron infrastructure (Vercel cron / sidecar).
// It finds tasks due for execution, runs them, and records the result.
// Secured by CRON_SECRET environment variable.
export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as { taskId?: string };

  const conditions = [eq(scheduledTasks.status, 'active' as const)];
  if (body.taskId) conditions.push(eq(scheduledTasks.id, body.taskId));

  const tasks = await db
    .select()
    .from(scheduledTasks)
    .where(and(...conditions))
    .limit(10);

  const results = [];
  for (const task of tasks) {
    const runId = `run_${Date.now()}`;
    const start = Date.now();

    const [run] = await db.insert(taskRuns).values({
      taskId:      task.id,
      workspaceId: task.workspaceId,
      status:      'running',
    }).returning();

    try {
      // TODO: Call core.carinaai.uk/agent with task.prompt and workspace context
      // For now, stub a successful run
      const output = `[Stub] Task "${task.name}" would execute: ${task.prompt.slice(0, 100)}`;

      await db.update(taskRuns).set({
        status:     'completed',
        output,
        durationMs: Date.now() - start,
      }).where(eq(taskRuns.id, run.id));

      await db.update(scheduledTasks).set({
        lastRunAt: new Date(),
        runCount:  (task.runCount ?? 0) + 1,
      }).where(eq(scheduledTasks.id, task.id));

      results.push({ taskId: task.id, status: 'completed' });
    } catch (err) {
      await db.update(taskRuns).set({
        status:     'failed',
        error:      String(err),
        durationMs: Date.now() - start,
      }).where(eq(taskRuns.id, run.id));

      results.push({ taskId: task.id, status: 'failed', error: String(err) });
    }
  }

  return NextResponse.json({ data: results });
}
```

---

## Step 2 - Built-In Task Seeding

Add a server action to seed built-in tasks for new workspaces. Create `src/lib/seed-tasks.ts`:

```ts
import { db } from '@/db';
import { scheduledTasks } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function ensureBuiltInTasks(workspaceId: string) {
  const existing = await db
    .select({ name: scheduledTasks.name })
    .from(scheduledTasks)
    .where(eq(scheduledTasks.workspaceId, workspaceId));

  const existingNames = new Set(existing.map((r) => r.name));

  const builtIns = [
    {
      name:           'Session tidy',
      description:    'Auto-archive chat sessions older than 30 days with no activity.',
      triggerType:    'schedule' as const,
      taskType:       'action' as const,
      cronExpression: '0 3 * * 0',  // Every Sunday at 3am
      prompt:         'Archive all chat sessions that have had no messages for more than 30 days. Do not delete them.',
      builtIn:        true,
    },
    {
      name:           'Memory tidy',
      description:    'Review memories for duplicates or contradictions and consolidate them.',
      triggerType:    'schedule' as const,
      taskType:       'action' as const,
      cronExpression: '0 4 1 * *',  // First of every month at 4am
      prompt:         'Review all saved memories for this workspace. Identify and merge duplicates. Flag any memories that contradict each other. Report a summary of changes made.',
      builtIn:        true,
    },
  ];

  for (const task of builtIns) {
    if (!existingNames.has(task.name)) {
      await db.insert(scheduledTasks).values({ workspaceId, ...task, status: 'paused' });
    }
  }
}
```

Call `ensureBuiltInTasks(workspace.id)` from the workspace creation flow or from the `/tasks` GET route when the task list is empty.

---

## Step 3 - Create the Tasks Page

Create `src/app/(workspace)/tasks/page.tsx`:

```tsx
'use client';
import { useState, useEffect } from 'react';
import { Clock, Plus, Play, Pause, Trash2, ChevronDown, ChevronRight, Activity, Lock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'draft';
  triggerType: string;
  cronExpression: string | null;
  eventEveryN: number | null;
  eventUnit: string | null;
  prompt: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  runCount: number;
  builtIn: boolean;
}

interface TaskRun {
  id: string;
  status: 'running' | 'completed' | 'failed';
  output: string | null;
  error: string | null;
  durationMs: number | null;
  createdAt: string;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-green-950 text-green-400' },
  paused: { label: 'Paused', className: 'bg-elevated text-text-muted' },
  draft:  { label: 'Draft',  className: 'bg-elevated text-text-muted border border-border' },
};

function formatCron(expr: string | null): string {
  if (!expr) return 'No schedule';
  const presets: Record<string, string> = {
    '0 * * * *':   'Every hour',
    '0 9 * * *':   'Daily at 9am',
    '0 3 * * 0':   'Weekly (Sunday 3am)',
    '0 4 1 * *':   'Monthly (1st at 4am)',
  };
  return presets[expr] ?? expr;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [taskRuns, setTaskRuns] = useState<Record<string, TaskRun[]>>({});
  const [runsLoading, setRunsLoading] = useState<string | null>(null);

  // New task form
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [newCron, setNewCron] = useState('0 9 * * *');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/tasks');
    const d = await res.json();
    if (d.data) setTasks(d.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleStatus(task: Task) {
    if (task.builtIn && task.status === 'active') {
      // Allow pausing built-ins but not activating without config
    }
    const next = task.status === 'active' ? 'paused' : 'active';
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: next } : t));
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
  }

  async function deleteTask(id: string) {
    if (!confirm('Delete this task? Run history will also be removed.')) return;
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  async function loadRuns(taskId: string) {
    if (expandedTask === taskId) { setExpandedTask(null); return; }
    setExpandedTask(taskId);
    if (taskRuns[taskId]) return;
    setRunsLoading(taskId);
    const res = await fetch(`/api/tasks/${taskId}/runs`);
    const d = await res.json();
    if (d.data) setTaskRuns((prev) => ({ ...prev, [taskId]: d.data }));
    setRunsLoading(null);
  }

  async function createTask() {
    if (!newName.trim() || !newPrompt.trim()) return;
    setSaving(true);
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, description: newDesc, prompt: newPrompt, cronExpression: newCron, triggerType: 'schedule', taskType: 'prompt' }),
    });
    const d = await res.json();
    if (d.data) {
      setTasks((prev) => [d.data, ...prev]);
      setShowNew(false);
      setNewName('');
      setNewDesc('');
      setNewPrompt('');
    }
    setSaving(false);
  }

  const CRON_PRESETS = [
    { label: 'Every hour', value: '0 * * * *' },
    { label: 'Daily at 9am', value: '0 9 * * *' },
    { label: 'Daily at 6pm', value: '0 18 * * *' },
    { label: 'Weekly (Monday)', value: '0 9 * * 1' },
    { label: 'Monthly (1st)', value: '0 9 1 * *' },
    { label: 'Custom', value: 'custom' },
  ];

  return (
    <div className="flex h-full flex-col bg-base">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Tasks</h1>
          <p className="text-xs text-text-muted mt-0.5">Automate Carina actions on a schedule</p>
        </div>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black hover:bg-accent-hover"
        >
          <Plus className="h-3.5 w-3.5" />
          New task
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* New task form */}
        {showNew && (
          <div className="border-b border-border bg-surface p-6">
            <h2 className="mb-4 text-sm font-semibold text-text-primary">Create task</h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-secondary">Task name</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Daily market summary"
                  autoFocus
                  className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-border-focus"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-text-secondary">Schedule</label>
                <select
                  value={CRON_PRESETS.find((p) => p.value === newCron) ? newCron : 'custom'}
                  onChange={(e) => { if (e.target.value !== 'custom') setNewCron(e.target.value); }}
                  className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-border-focus"
                >
                  {CRON_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className="lg:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-text-secondary">Description (optional)</label>
                <input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="What does this task do?"
                  className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-border-focus"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                  Prompt
                  <span className="ml-1 font-normal text-text-muted">- Carina will execute this on schedule</span>
                </label>
                <textarea
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  placeholder="e.g. Search for UK property market news from the past 24 hours. Summarise the top 3 stories and save a note called 'Market Update {date}'."
                  rows={4}
                  className="w-full resize-none rounded-md border border-border bg-elevated px-3 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-border-focus"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={createTask} disabled={saving || !newName.trim() || !newPrompt.trim()} className="rounded-md bg-accent px-4 py-2 text-xs font-medium text-black hover:bg-accent-hover disabled:opacity-40">
                {saving ? 'Creating...' : 'Create task'}
              </button>
              <button onClick={() => setShowNew(false)} className="rounded-md border border-border px-4 py-2 text-xs text-text-secondary hover:text-text-primary">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Task list */}
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : tasks.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={<Clock className="h-8 w-8" />}
              title="No tasks yet"
              subtitle="Create automated tasks that Carina runs on a schedule."
              action={<button onClick={() => setShowNew(true)} className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black hover:bg-accent-hover">Create first task</button>}
            />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {tasks.map((task) => (
              <div key={task.id} className="bg-surface">
                {/* Task header */}
                <div className="flex items-start gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-text-primary">{task.name}</span>
                      {task.builtIn && (
                        <span className="flex items-center gap-0.5 rounded-full bg-elevated px-1.5 py-0.5 text-[9px] text-text-muted border border-border">
                          <Lock className="h-2.5 w-2.5" />
                          built-in
                        </span>
                      )}
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_BADGE[task.status]?.className ?? '')}>
                        {STATUS_BADGE[task.status]?.label ?? task.status}
                      </span>
                    </div>
                    {task.description && <p className="text-xs text-text-muted mb-2">{task.description}</p>}
                    <div className="flex items-center gap-3 text-[10px] text-text-muted flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatCron(task.cronExpression)}
                      </span>
                      {task.lastRunAt && (
                        <span>Last run: {new Date(task.lastRunAt).toLocaleString()}</span>
                      )}
                      <span>Run count: {task.runCount}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => toggleStatus(task)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                        task.status === 'active'
                          ? 'bg-elevated text-text-secondary hover:text-text-primary'
                          : 'bg-accent-dim text-accent hover:bg-accent/20',
                      )}
                    >
                      {task.status === 'active'
                        ? <><Pause className="h-3 w-3" /> Pause</>
                        : <><Play className="h-3 w-3" /> Enable</>}
                    </button>
                    {!task.builtIn && (
                      <IconButton label="Delete task" size="sm" onClick={() => deleteTask(task.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-danger" />
                      </IconButton>
                    )}
                    <button
                      onClick={() => loadRuns(task.id)}
                      className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text-secondary transition-colors"
                    >
                      <Activity className="h-3 w-3" />
                      History
                      {expandedTask === task.id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                  </div>
                </div>

                {/* Prompt preview */}
                <div className="px-6 pb-4">
                  <p className="text-[11px] text-text-muted italic line-clamp-2">
                    Prompt: {task.prompt}
                  </p>
                </div>

                {/* Run history */}
                {expandedTask === task.id && (
                  <div className="border-t border-border bg-base px-6 py-4">
                    <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Run history (last 20)</h3>
                    {runsLoading === task.id ? (
                      <div className="flex justify-center py-4"><Spinner /></div>
                    ) : !taskRuns[task.id]?.length ? (
                      <p className="text-xs text-text-muted">No runs yet</p>
                    ) : (
                      <div className="space-y-2">
                        {taskRuns[task.id].map((run) => (
                          <div key={run.id} className="rounded-md border border-border bg-surface px-3 py-2.5">
                            <div className="flex items-center gap-2 mb-1.5">
                              {run.status === 'completed' && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
                              {run.status === 'failed'    && <XCircle    className="h-3.5 w-3.5 text-danger" />}
                              {run.status === 'running'   && <Loader2    className="h-3.5 w-3.5 text-accent animate-spin" />}
                              <span className="text-[10px] capitalize text-text-secondary">{run.status}</span>
                              <span className="ml-auto text-[10px] text-text-muted">
                                {new Date(run.createdAt).toLocaleString()}
                                {run.durationMs != null && ` - ${(run.durationMs / 1000).toFixed(1)}s`}
                              </span>
                            </div>
                            {run.output && (
                              <p className="text-[11px] text-text-secondary leading-relaxed line-clamp-3 whitespace-pre-wrap">{run.output}</p>
                            )}
                            {run.error && (
                              <p className="text-[11px] text-danger">{run.error}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Step 4 - Add Tasks Link to Sidebar

In `src/components/shell/AppSidebar.tsx`, confirm the Tools section includes the Tasks link:

```tsx
import { CheckSquare } from 'lucide-react';

// In the Tools section alongside Memory/Skills/Notes/Research:
{
  label: 'Tasks',
  href: '/tasks',
  icon: <CheckSquare className="h-4 w-4" />,
}
```

---

## Verification

After this prompt:
1. `/tasks` loads and shows two built-in tasks (Session tidy, Memory tidy) in paused state
2. Both built-in tasks show a "built-in" badge and have no delete button
3. Clicking "New task" shows the creation form
4. The schedule dropdown has common presets (hourly, daily, weekly, monthly)
5. Creating a task adds it to the list as "Active"
6. The task row shows name, status badge, schedule, last run, run count
7. Pause/Enable button toggles the task status (optimistic)
8. Clicking "History" expands the run history panel below the task
9. History shows each run with status icon, timestamp, duration, and output snippet
10. Failed runs show the error message in red
11. Deleting a custom task shows a confirm dialog and removes the row
12. TypeScript builds without errors
