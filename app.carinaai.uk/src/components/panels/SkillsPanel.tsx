'use client';

import { useEffect, useState } from 'react';
import {
  ExternalLink,
  Search,
  Tag,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Panel } from '@/components/ui/Panel';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';

interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  enabled: boolean;
  isCustom: boolean;
  githubUrl?: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  research: 'Research',
  code: 'Code',
  files: 'Files',
  memory: 'Memory',
  knowledge: 'Knowledge',
  integration: 'Integrations',
  property: 'Property',
  custom: 'Custom',
};

interface SkillsPanelProps {
  onClose: () => void;
}

export function SkillsPanel({ onClose }: SkillsPanelProps) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'add'>('list');
  const [filterCat, setFilterCat] = useState('all');
  const [saving, setSaving] = useState(false);
  const [addName, setAddName] = useState('');
  const [addDesc, setAddDesc] = useState('');
  const [addUrl, setAddUrl] = useState('');
  const [addTag, setAddTag] = useState('');
  const [addTags, setAddTags] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    const response = await fetch('/api/skills');
    const data = await response.json();
    if (data.data) setSkills(data.data);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggle(skill: Skill) {
    const enabled = !skill.enabled;
    setSkills((prev) =>
      prev.map((item) => (item.id === skill.id ? { ...item, enabled } : item)),
    );
    const response = await fetch(`/api/skills/${encodeURIComponent(skill.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    if (!response.ok) {
      setSkills((prev) =>
        prev.map((item) => (item.id === skill.id ? { ...item, enabled: skill.enabled } : item)),
      );
    }
  }

  async function deleteCustom(id: string) {
    const previous = skills;
    setSkills((prev) => prev.filter((skill) => skill.id !== id));
    const response = await fetch(`/api/skills/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) setSkills(previous);
  }

  function addTagValue() {
    const tag = addTag.trim();
    if (!tag) return;
    setAddTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
    setAddTag('');
  }

  async function addCustom() {
    if (!addName.trim()) return;
    setSaving(true);
    const response = await fetch('/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: addName,
        description: addDesc,
        githubUrl: addUrl || null,
        tags: addTags,
      }),
    });
    const data = await response.json();
    if (data.data) {
      setAddName('');
      setAddDesc('');
      setAddUrl('');
      setAddTags([]);
      setActiveTab('list');
      await load();
    }
    setSaving(false);
  }

  const categories = ['all', ...Array.from(new Set(skills.map((skill) => skill.category)))];
  const filtered = skills.filter((skill) => {
    const matchesCat = filterCat === 'all' || skill.category === filterCat;
    const query = search.toLowerCase();
    const matchesQ =
      !query ||
      skill.name.toLowerCase().includes(query) ||
      skill.description.toLowerCase().includes(query);
    return matchesCat && matchesQ;
  });
  const grouped = filtered.reduce<Record<string, Skill[]>>((acc, skill) => {
    const category = skill.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(skill);
    return acc;
  }, {});
  const enabledCount = skills.filter((skill) => skill.enabled).length;

  return (
    <Panel
      title={`Skills (${enabledCount}/${skills.length} active)`}
      icon={<Zap className="h-4 w-4" />}
      onClose={onClose}
      width={400}
    >
      <div className="flex items-center gap-1 border-b border-border px-4 pb-0 pt-3">
        {(['list', 'add'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'border-b-2 px-3 pb-2.5 text-xs font-medium capitalize transition-colors',
              activeTab === tab
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-secondary',
            )}
          >
            {tab === 'list' ? 'Skills' : 'Add custom'}
          </button>
        ))}
      </div>

      {activeTab === 'list' && (
        <div className="flex flex-col">
          <p className="px-4 pt-3 text-[11px] leading-relaxed text-text-muted">
            Cloud skills are memory helpers and custom prompt notes. They are not live integrations or agent tools.
          </p>
          <div className="space-y-2 px-4 py-3">
            <div className="flex items-center gap-2 rounded-md border border-border bg-elevated px-3 py-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-text-muted" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search skills..."
                className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-1">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setFilterCat(category)}
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-[10px] font-medium capitalize transition-colors',
                    filterCat === category
                      ? 'bg-accent-dim text-accent'
                      : 'bg-elevated text-text-muted hover:text-text-secondary',
                  )}
                >
                  {category === 'all' ? 'All' : (CATEGORY_LABELS[category] ?? category)}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Zap className="h-8 w-8" />}
              title="No skills found"
              subtitle="Try a different search or category."
            />
          ) : (
            <div className="divide-y divide-border">
              {Object.entries(grouped).map(([category, categorySkills]) => (
                <div key={category}>
                  <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    {CATEGORY_LABELS[category] ?? category}
                  </p>
                  {categorySkills.map((skill) => (
                    <div
                      key={skill.id}
                      className={cn(
                        'group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-elevated',
                        !skill.enabled && 'opacity-50',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => void toggle(skill)}
                        className="mt-0.5 shrink-0 text-text-muted transition-colors hover:text-accent"
                        aria-label={skill.enabled ? 'Disable skill' : 'Enable skill'}
                      >
                        {skill.enabled ? (
                          <ToggleRight className="h-4 w-4 text-accent" />
                        ) : (
                          <ToggleLeft className="h-4 w-4" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex items-center gap-2">
                          <span className="text-xs font-medium text-text-primary">{skill.name}</span>
                          {skill.isCustom && (
                            <span className="rounded-full border border-border bg-elevated px-1.5 py-0.5 text-[9px] text-text-muted">
                              custom
                            </span>
                          )}
                          {skill.githubUrl && (
                            <a
                              href={skill.githubUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-text-muted hover:text-accent"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <p className="text-[11px] leading-relaxed text-text-muted">{skill.description}</p>
                        {skill.tags.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {skill.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-elevated px-1.5 py-0.5 text-[9px] text-text-muted"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {skill.isCustom && (
                        <div className="hidden shrink-0 group-hover:flex">
                          <IconButton
                            label="Delete skill"
                            size="sm"
                            onClick={() => void deleteCustom(skill.id)}
                          >
                            <Trash2 className="h-3 w-3 text-danger" />
                          </IconButton>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'add' && (
        <div className="space-y-4 p-4">
          <p className="text-xs text-text-secondary">
            Add a custom skill note. Optional GitHub link for your reference. Custom skills are added to the chat
            system prompt as hints, not as live tools.
          </p>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Name</label>
            <input
              value={addName}
              onChange={(event) => setAddName(event.target.value)}
              placeholder="e.g. Lease Analyser"
              autoFocus
              className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-border-focus"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Description</label>
            <textarea
              value={addDesc}
              onChange={(event) => setAddDesc(event.target.value)}
              placeholder="What does this skill cover? The model may use this as a prompt hint when relevant."
              rows={3}
              className="w-full resize-none rounded-md border border-border bg-elevated px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-border-focus"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">GitHub URL (optional)</label>
            <input
              value={addUrl}
              onChange={(event) => setAddUrl(event.target.value)}
              placeholder="https://github.com/your-org/skill-name"
              className="w-full rounded-md border border-border bg-elevated px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-border-focus"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Tags</label>
            <div className="flex gap-2">
              <input
                value={addTag}
                onChange={(event) => setAddTag(event.target.value)}
                placeholder="Add a tag"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && addTag.trim()) {
                    event.preventDefault();
                    addTagValue();
                  }
                }}
                className="flex-1 rounded-md border border-border bg-elevated px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-border-focus"
              />
              <button
                type="button"
                onClick={addTagValue}
                className="rounded-md border border-border bg-elevated px-3 py-2 text-xs text-text-secondary hover:text-text-primary"
              >
                Add
              </button>
            </div>
            {addTags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {addTags.map((tag, index) => (
                  <span
                    key={`${tag}-${index}`}
                    className="flex items-center gap-1 rounded-full border border-border bg-elevated px-2 py-0.5 text-[10px] text-text-secondary"
                  >
                    <Tag className="h-2.5 w-2.5" />
                    {tag}
                    <button
                      type="button"
                      onClick={() => setAddTags((prev) => prev.filter((_, tagIndex) => tagIndex !== index))}
                      className="text-text-muted hover:text-danger"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => void addCustom()}
            disabled={saving || !addName.trim()}
            className="w-full rounded-md bg-accent py-2 text-xs font-medium text-black transition-colors hover:bg-accent-hover disabled:opacity-40"
          >
            {saving ? 'Adding...' : 'Add skill'}
          </button>
        </div>
      )}
    </Panel>
  );
}
