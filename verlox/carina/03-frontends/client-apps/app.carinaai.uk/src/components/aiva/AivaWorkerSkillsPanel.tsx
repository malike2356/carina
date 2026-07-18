'use client';

import { useEffect, useState } from 'react';
import { Play, Plus } from 'lucide-react';
import { AIVA_INPUT_CLASS } from '@/lib/aiva-utils';
import { cn } from '@/lib/utils';

type WorkerSkill = {
  id: string;
  title: string;
  description: string;
  steps: unknown[];
  status: string;
};

export function AivaWorkerSkillsPanel({ workerId }: { workerId: string }) {
  const [skills, setSkills] = useState<WorkerSkill[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [stepsText, setStepsText] = useState('');
  const [busy, setBusy] = useState(false);
  const [runResult, setRunResult] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/aiva/workers/${workerId}/skills`);
      const data = (await res.json()) as { skills?: WorkerSkill[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not load skills');
        return;
      }
      setSkills(data.skills ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [workerId]);

  async function saveSkill(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const steps = stepsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      const res = await fetch(`/api/aiva/workers/${workerId}/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, steps }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not save skill');
        return;
      }
      setTitle('');
      setDescription('');
      setStepsText('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function runSkill(skillId: string) {
    setBusy(true);
    setRunResult('');
    setError('');
    try {
      const res = await fetch(`/api/aiva/workers/${workerId}/skills/${skillId}/run`, {
        method: 'POST',
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Skill run failed');
        return;
      }
      setRunResult(data.reply ?? 'Skill completed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div>
        <h3 className="text-base font-semibold text-text-primary">Skills</h3>
        <p className="mt-1 text-sm text-text-muted">
          Save repeatable workflows and re-run them against this worker.
        </p>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-text-muted">Loading skills...</p>
      ) : skills.length === 0 ? (
        <p className="text-sm text-text-muted">No skills saved yet.</p>
      ) : (
        <ul className="space-y-2">
          {skills.map((skill) => (
            <li
              key={skill.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-elevated px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-text-primary">{skill.title}</p>
                {skill.description ? (
                  <p className="mt-0.5 text-xs text-text-muted">{skill.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runSkill(skill.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-dim px-3 py-2 text-xs font-medium text-accent"
              >
                <Play className="h-3.5 w-3.5" />
                Run
              </button>
            </li>
          ))}
        </ul>
      )}
      {runResult ? (
        <div className="rounded-xl border border-border bg-overlay p-3 text-sm text-text-secondary whitespace-pre-wrap">
          {runResult}
        </div>
      ) : null}
      <form onSubmit={(e) => void saveSkill(e)} className="space-y-3 rounded-xl border border-border bg-elevated p-4">
        <p className="text-sm font-medium text-text-primary">Save a skill</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className={AIVA_INPUT_CLASS}
          required
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description"
          className={AIVA_INPUT_CLASS}
        />
        <textarea
          value={stepsText}
          onChange={(e) => setStepsText(e.target.value)}
          placeholder="One step per line"
          className={cn(AIVA_INPUT_CLASS, 'min-h-24')}
        />
        <button type="submit" disabled={busy} className="btn-primary inline-flex items-center gap-1.5">
          <Plus className="h-4 w-4" />
          {busy ? 'Saving...' : 'Save skill'}
        </button>
      </form>
    </section>
  );
}
