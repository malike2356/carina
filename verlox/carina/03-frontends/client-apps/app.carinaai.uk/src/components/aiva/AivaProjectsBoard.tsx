'use client';

import { useEffect, useMemo, useState } from 'react';
import { FolderKanban, Plus } from 'lucide-react';
import { AIVA_INPUT_CLASS } from '@/lib/aiva-utils';
import { cn } from '@/lib/utils';

type Project = {
  id: string;
  title: string;
  description: string;
  status: string;
  workerId: string | null;
};

const COLUMNS = [
  { id: 'planned', label: 'Planned' },
  { id: 'active', label: 'Active' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'done', label: 'Done' },
] as const;

export function AivaProjectsBoard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch('/api/aiva/projects');
    const data = (await res.json()) as { projects?: Project[]; error?: string };
    if (!res.ok) {
      setError(data.error ?? 'Could not load projects');
      return;
    }
    setProjects(data.projects ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  const byStatus = useMemo(() => {
    const map = new Map<string, Project[]>();
    for (const column of COLUMNS) map.set(column.id, []);
    for (const project of projects) {
      const key = COLUMNS.some((column) => column.id === project.status) ? project.status : 'planned';
      map.get(key)?.push(project);
    }
    return map;
  }, [projects]);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/aiva/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, status: 'planned' }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not create project');
        return;
      }
      setTitle('');
      setDescription('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function moveProject(projectId: string, status: string) {
    const res = await fetch(`/api/aiva/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) await load();
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-text-primary">
            <FolderKanban className="h-6 w-6" />
            Projects
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Multi-day work streams across your workers.
          </p>
        </div>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <form
        onSubmit={(e) => void createProject(e)}
        className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[1fr_1fr_auto]"
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
          placeholder="Short description"
          className={AIVA_INPUT_CLASS}
        />
        <button type="submit" disabled={busy} className="btn-primary inline-flex items-center justify-center gap-1.5">
          <Plus className="h-4 w-4" />
          Add
        </button>
      </form>

      <div className="grid gap-4 lg:grid-cols-4">
        {COLUMNS.map((column) => (
          <div key={column.id} className="rounded-2xl border border-border bg-card p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
              {column.label}
            </p>
            <div className="space-y-2">
              {(byStatus.get(column.id) ?? []).map((project) => (
                <article key={project.id} className="rounded-xl border border-border bg-elevated p-3">
                  <p className="text-sm font-medium text-text-primary">{project.title}</p>
                  {project.description ? (
                    <p className="mt-1 text-xs text-text-muted">{project.description}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {COLUMNS.filter((item) => item.id !== column.id).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => void moveProject(project.id, item.id)}
                        className={cn(
                          'rounded-md border border-border px-2 py-1 text-[10px] font-medium text-text-secondary hover:bg-overlay',
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
