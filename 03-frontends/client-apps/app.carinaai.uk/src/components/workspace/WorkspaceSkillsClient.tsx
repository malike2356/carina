'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';

interface WorkspaceSkill {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  isCustom: boolean;
  tags?: string[] | null;
  githubUrl?: string | null;
}

export function WorkspaceSkillsClient() {
  const [skills, setSkills] = useState<WorkspaceSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState({ name: '', description: '', tags: '' });

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/skills');
      const json = await response.json();
      setSkills(Array.isArray(json.data) ? json.data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredSkills = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter((skill) => {
      const haystack = [skill.name, skill.description, skill.category, ...(skill.tags ?? [])]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [filter, skills]);

  const customSkills = filteredSkills.filter((skill) => skill.isCustom);
  const platformSkills = filteredSkills.filter((skill) => !skill.isCustom);

  async function createSkill() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const response = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          tags: form.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to create skill');
      }
      setForm({ name: '', description: '', tags: '' });
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-text-muted">
        <Spinner />
        <span>Loading skills</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[90rem] space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-text-muted">Skills</p>
          <h1 className="mt-2 text-2xl font-semibold text-text-primary">Workspace skills</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-secondary">
            Built-in and custom skill definitions surfaced as a first-class workspace page.
          </p>
        </div>
        <Link
          href="/settings?section=brain"
          className="rounded-md border border-border bg-elevated px-3 py-2 text-xs text-text-secondary hover:text-text-primary"
        >
          Skill settings
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Skill catalog</CardTitle>
            <p className="text-sm text-text-muted">
              Platform skills first, then custom workspace skills. Search by name, category, or tag.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter skills..."
              className="w-full rounded-md border border-border bg-base px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
            />

            {platformSkills.length === 0 && customSkills.length === 0 ? (
              <EmptyState
                title="No skills found"
                subtitle="Create a custom skill or clear your filter."
              />
            ) : (
              <div className="space-y-6">
                <SkillSection title="Platform skills" skills={platformSkills} />
                <SkillSection title="Custom skills" skills={customSkills} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create custom skill</CardTitle>
            <p className="text-sm text-text-muted">
              Use this to add narrow local skills without touching the compiled core pack.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              label="Name"
              value={form.name}
              onChange={(value) => setForm((current) => ({ ...current, name: value }))}
              placeholder="e.g. incident-briefing-summary"
            />
            <Field
              label="Description"
              value={form.description}
              onChange={(value) => setForm((current) => ({ ...current, description: value }))}
              placeholder="One sentence description"
            />
            <Field
              label="Tags"
              value={form.tags}
              onChange={(value) => setForm((current) => ({ ...current, tags: value }))}
              placeholder="briefing, incident, internal"
            />
            <button
              type="button"
              onClick={() => void createSkill()}
              disabled={saving}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Create skill'}
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SkillSection({ title, skills }: { title: string; skills: WorkspaceSkill[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        <Badge variant="draft">{skills.length}</Badge>
      </div>
      <div className="grid gap-3">
        {skills.map((skill) => (
          <div key={skill.id} className="rounded-lg border border-border bg-elevated/50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-text-primary">{skill.name}</div>
                <div className="mt-1 text-xs text-text-muted">{skill.description}</div>
              </div>
              <Badge variant={skill.enabled ? 'active' : 'paused'}>
                {skill.enabled ? 'enabled' : 'disabled'}
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="draft">{skill.category}</Badge>
              {skill.isCustom ? <Badge variant="active">custom</Badge> : <Badge variant="paused">platform</Badge>}
              {(skill.tags ?? []).slice(0, 4).map((tag) => (
                <Badge key={tag} variant="draft">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        ))}
        {skills.length === 0 ? (
          <p className="text-xs text-text-muted">No items in this section.</p>
        ) : null}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-base px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
      />
    </label>
  );
}
