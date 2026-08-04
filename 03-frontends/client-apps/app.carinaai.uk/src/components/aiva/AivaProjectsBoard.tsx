'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FolderKanban,
  Plus,
  UserRound,
} from 'lucide-react';
import { AivaAvatar } from '@/components/aiva/AivaAvatar';
import type { AivaWorker } from '@/lib/aiva-types';
import { AIVA_INPUT_CLASS, readAivaError, timeAgo } from '@/lib/aiva-utils';
import { cn } from '@/lib/utils';

type ProjectStatus = 'planned' | 'active' | 'blocked' | 'done';

type Project = {
  id: string;
  title: string;
  description: string;
  status: string;
  workerId: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type ProjectItem = {
  id: string;
  projectId: string;
  itemType: string;
  itemRef: string;
  title: string;
  createdAt: string;
};

const COLUMNS: { id: ProjectStatus; label: string; hint: string }[] = [
  { id: 'planned', label: 'Planned', hint: 'Queued for a worker' },
  { id: 'active', label: 'Active', hint: 'In progress' },
  { id: 'blocked', label: 'Blocked', hint: 'Needs you' },
  { id: 'done', label: 'Done', hint: 'Complete' },
];

function normalizeStatus(status: string): ProjectStatus {
  return COLUMNS.some((column) => column.id === status)
    ? (status as ProjectStatus)
    : 'planned';
}

export function AivaProjectsBoard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [workers, setWorkers] = useState<AivaWorker[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [filterWorkerId, setFilterWorkerId] = useState('all');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemsByProject, setItemsByProject] = useState<Record<string, ProjectItem[]>>({});
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});
  const [itemBusy, setItemBusy] = useState<string | null>(null);

  const workersById = useMemo(() => {
    const map = new Map<string, AivaWorker>();
    for (const worker of workers) map.set(worker.id, worker);
    return map;
  }, [workers]);

  const load = useCallback(async () => {
    setError('');
    const [projectsRes, workersRes] = await Promise.all([
      fetch('/api/aiva/projects'),
      fetch('/api/aiva/workers'),
    ]);
    const projectsData = (await projectsRes.json()) as { projects?: Project[]; error?: string };
    const workersData = (await workersRes.json()) as { workers?: AivaWorker[]; error?: string };
    if (!projectsRes.ok) {
      setError(projectsData.error ?? (await readAivaError(projectsRes)));
      return;
    }
    if (!workersRes.ok) {
      setError(workersData.error ?? (await readAivaError(workersRes)));
      return;
    }
    setProjects(projectsData.projects ?? []);
    setWorkers((workersData.workers ?? []).filter((worker) => worker.status !== 'dismissed'));
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await load();
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const visibleProjects = useMemo(() => {
    if (filterWorkerId === 'all') return projects;
    if (filterWorkerId === 'unassigned') return projects.filter((project) => !project.workerId);
    return projects.filter((project) => project.workerId === filterWorkerId);
  }, [filterWorkerId, projects]);

  const byStatus = useMemo(() => {
    const map = new Map<ProjectStatus, Project[]>();
    for (const column of COLUMNS) map.set(column.id, []);
    for (const project of visibleProjects) {
      map.get(normalizeStatus(project.status))?.push(project);
    }
    return map;
  }, [visibleProjects]);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/aiva/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          status: 'planned',
          workerId: workerId || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? (await readAivaError(res)));
        return;
      }
      setTitle('');
      setDescription('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function patchProject(projectId: string, body: Record<string, unknown>) {
    setError('');
    const res = await fetch(`/api/aiva/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setError(await readAivaError(res));
      return;
    }
    const data = (await res.json()) as { project?: Project };
    if (data.project) {
      setProjects((prev) => prev.map((project) => (project.id === projectId ? { ...project, ...data.project } : project)));
    } else {
      await load();
    }
  }

  async function loadItems(projectId: string) {
    const res = await fetch(`/api/aiva/projects/${projectId}/items`);
    const data = (await res.json()) as { items?: ProjectItem[]; error?: string };
    if (!res.ok) {
      setError(data.error ?? (await readAivaError(res)));
      return;
    }
    setItemsByProject((prev) => ({ ...prev, [projectId]: data.items ?? [] }));
  }

  async function toggleExpand(projectId: string) {
    if (expandedId === projectId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(projectId);
    if (!itemsByProject[projectId]) {
      await loadItems(projectId);
    }
  }

  async function addItem(projectId: string) {
    const draft = (itemDrafts[projectId] ?? '').trim();
    if (!draft) return;
    setItemBusy(projectId);
    setError('');
    try {
      const res = await fetch(`/api/aiva/projects/${projectId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: draft, itemType: 'task' }),
      });
      if (!res.ok) {
        setError(await readAivaError(res));
        return;
      }
      setItemDrafts((prev) => ({ ...prev, [projectId]: '' }));
      await loadItems(projectId);
      // Opening a checklist implies work is underway when still planned.
      const project = projects.find((row) => row.id === projectId);
      if (project && normalizeStatus(project.status) === 'planned') {
        await patchProject(projectId, { status: 'active' });
      }
    } finally {
      setItemBusy(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-text-primary">
            <FolderKanban className="h-6 w-6" />
            Projects
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Assign multi-day work to an AI employee, track status, and keep a task list they can act on.
          </p>
        </div>
        {workers.length === 0 ? (
          <Link href="/aiva/provision?intent=provision" className="btn-primary text-sm">
            Hire a worker first
          </Link>
        ) : null}
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <form
        onSubmit={(e) => void createProject(e)}
        className="grid gap-3 rounded-2xl border border-border bg-card p-4 lg:grid-cols-[1.2fr_1fr_0.9fr_auto]"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Project title"
          className={AIVA_INPUT_CLASS}
          required
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Outcome or brief"
          className={AIVA_INPUT_CLASS}
        />
        <select
          value={workerId}
          onChange={(e) => setWorkerId(e.target.value)}
          className={AIVA_INPUT_CLASS}
          aria-label="Assign worker"
        >
          <option value="">Unassigned</option>
          {workers.map((worker) => (
            <option key={worker.id} value={worker.id}>
              {worker.name}
            </option>
          ))}
        </select>
        <button type="submit" disabled={busy || !title.trim()} className="btn-primary inline-flex items-center justify-center gap-1.5">
          <Plus className="h-4 w-4" />
          Add
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">Filter</span>
        <button
          type="button"
          onClick={() => setFilterWorkerId('all')}
          className={cn(
            'rounded-md border px-2.5 py-1 text-xs',
            filterWorkerId === 'all'
              ? 'border-border-focus bg-elevated text-text-primary'
              : 'border-border text-text-secondary hover:bg-overlay',
          )}
        >
          All ({projects.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterWorkerId('unassigned')}
          className={cn(
            'rounded-md border px-2.5 py-1 text-xs',
            filterWorkerId === 'unassigned'
              ? 'border-border-focus bg-elevated text-text-primary'
              : 'border-border text-text-secondary hover:bg-overlay',
          )}
        >
          Unassigned ({projects.filter((project) => !project.workerId).length})
        </button>
        {workers.map((worker) => {
          const count = projects.filter((project) => project.workerId === worker.id).length;
          return (
            <button
              key={worker.id}
              type="button"
              onClick={() => setFilterWorkerId(worker.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs',
                filterWorkerId === worker.id
                  ? 'border-border-focus bg-elevated text-text-primary'
                  : 'border-border text-text-secondary hover:bg-overlay',
              )}
            >
              <AivaAvatar name={worker.name} className="h-4 w-4 text-[8px]" />
              {worker.name} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading projects...</p>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
          <UserRound className="mx-auto h-8 w-8 text-text-muted" />
          <p className="mt-3 text-sm font-medium text-text-primary">No projects yet</p>
          <p className="mt-1 text-sm text-text-muted">
            Create a workstream, assign an AI employee, then add tasks for them to chase.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-4">
          {COLUMNS.map((column) => (
            <div key={column.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="mb-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {column.label}
                  <span className="ml-1 text-text-muted/70">
                    {(byStatus.get(column.id) ?? []).length}
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] text-text-muted">{column.hint}</p>
              </div>
              <div className="space-y-2">
                {(byStatus.get(column.id) ?? []).map((project) => {
                  const worker = project.workerId ? workersById.get(project.workerId) : null;
                  const expanded = expandedId === project.id;
                  const items = itemsByProject[project.id] ?? [];
                  return (
                    <article key={project.id} className="rounded-xl border border-border bg-elevated p-3">
                      <button
                        type="button"
                        onClick={() => void toggleExpand(project.id)}
                        className="flex w-full items-start gap-2 text-left"
                      >
                        {expanded ? (
                          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
                        ) : (
                          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-text-primary">{project.title}</span>
                          {project.description ? (
                            <span className="mt-1 block text-xs text-text-muted">{project.description}</span>
                          ) : null}
                        </span>
                      </button>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {worker ? (
                          <Link
                            href={`/aiva/workers/${worker.id}`}
                            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] text-text-secondary hover:bg-overlay"
                          >
                            <AivaAvatar name={worker.name} className="h-4 w-4 text-[8px]" />
                            {worker.name}
                          </Link>
                        ) : (
                          <span className="rounded-md border border-dashed border-border px-2 py-1 text-[11px] text-text-muted">
                            Unassigned
                          </span>
                        )}
                        {project.updatedAt ? (
                          <span className="text-[10px] text-text-muted">Updated {timeAgo(project.updatedAt)}</span>
                        ) : null}
                      </div>

                      <div className="mt-3 grid gap-2">
                        <label className="sr-only" htmlFor={`status-${project.id}`}>Status</label>
                        <select
                          id={`status-${project.id}`}
                          value={normalizeStatus(project.status)}
                          onChange={(e) => void patchProject(project.id, { status: e.target.value })}
                          className={AIVA_INPUT_CLASS}
                        >
                          {COLUMNS.map((item) => (
                            <option key={item.id} value={item.id}>
                              Move to {item.label}
                            </option>
                          ))}
                        </select>
                        <label className="sr-only" htmlFor={`worker-${project.id}`}>Worker</label>
                        <select
                          id={`worker-${project.id}`}
                          value={project.workerId ?? ''}
                          onChange={(e) =>
                            void patchProject(project.id, {
                              workerId: e.target.value || null,
                              ...(e.target.value && normalizeStatus(project.status) === 'planned'
                                ? { status: 'active' }
                                : {}),
                            })
                          }
                          className={AIVA_INPUT_CLASS}
                        >
                          <option value="">Assign worker...</option>
                          {workers.map((row) => (
                            <option key={row.id} value={row.id}>
                              {row.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {expanded ? (
                        <div className="mt-3 space-y-2 border-t border-border pt-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                            Tasks
                          </p>
                          {items.length === 0 ? (
                            <p className="text-xs text-text-muted">No tasks yet. Add the next action.</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {items.map((item) => (
                                <li
                                  key={item.id}
                                  className="rounded-md border border-border bg-card px-2 py-1.5 text-xs text-text-primary"
                                >
                                  {item.title || item.itemType}
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="flex gap-2">
                            <input
                              value={itemDrafts[project.id] ?? ''}
                              onChange={(e) =>
                                setItemDrafts((prev) => ({ ...prev, [project.id]: e.target.value }))
                              }
                              placeholder="Next task for the worker"
                              className={AIVA_INPUT_CLASS}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  void addItem(project.id);
                                }
                              }}
                            />
                            <button
                              type="button"
                              disabled={itemBusy === project.id || !(itemDrafts[project.id] ?? '').trim()}
                              onClick={() => void addItem(project.id)}
                              className="btn-primary shrink-0 px-3 text-xs"
                            >
                              Add
                            </button>
                          </div>
                          {worker ? (
                            <Link
                              href={`/aiva/workers/${worker.id}`}
                              className="inline-flex text-xs font-medium text-text-secondary underline-offset-2 hover:underline"
                            >
                              Open {worker.name}
                            </Link>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
