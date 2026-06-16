# Prompt 09 - Skills Panel

## Objective

Build the Skills floating panel where users can view all available Carina skills, enable/disable them individually, see their metadata (description, confidence, tags), add a skill from a GitHub URL or manual form, and audit skill usage. This directly closes the gap where Odysseus surfaces rich skill/plugin management and Carina hides it entirely.

---

## Context

Working directory: `/opt/lampp/htdocs/verlox/carina/app.carinaai.uk`

Prerequisites: Prompts 00-08 complete. The sidebar dispatches `open-panel` with detail `'skills'`. `PanelProvider.tsx` has a slot for `SkillsPanel`. The `Panel`, `IconButton`, `EmptyState`, `Badge`, `Spinner` primitives exist.

Note: ops.carinaai.uk is the admin side for managing the master skills catalogue. This panel is the user-facing view: users see what skills exist, toggle which ones are active for their workspace, and can add workspace-local skills. Workspace-local skills are stored in a simple table described below.

---

## Step 1 - Skills Schema Extension

The core skills catalogue lives in ops (the admin service). For the workspace-facing panel, we need two things:

1. A `workspaceSkills` table that stores per-workspace enable/disable state and workspace-local custom skills.
2. A route that merges the platform skills (fetched from ops or from a local list) with the user's enablement state.

Add to `src/db/schema.ts`:

```ts
export const workspaceSkills = pgTable('workspace_skills', {
  id:          text('id').primaryKey().$defaultFn(() => createId()),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  skillId:     text('skill_id').notNull(),   // matches platform skill id or 'custom:{uuid}'
  enabled:     boolean('enabled').notNull().default(true),
  // For custom workspace-local skills:
  isCustom:    boolean('is_custom').notNull().default(false),
  name:        text('name'),
  description: text('description'),
  githubUrl:   text('github_url'),
  tags:        text('tags').array().notNull().default([]),
  addedAt:     timestamp('added_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
});
```

Run `pnpm db:generate && pnpm db:migrate` after adding this.

---

## Step 2 - Skills API Routes

### GET /api/skills

Returns the merged list: platform skills with workspace enablement overlaid.

Create `src/app/api/skills/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { db } from '@/db';
import { workspaceSkills } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// Platform skills catalogue - kept here until ops provides a live endpoint.
// Each record matches the skills registered in core.carinaai.uk agent.
const PLATFORM_SKILLS = [
  { id: 'web_search',      name: 'Web Search',      description: 'Search the internet for up-to-date information using Brave or SerpAPI.', category: 'research', tags: ['search', 'internet'] },
  { id: 'shell_exec',      name: 'Shell Execute',   description: 'Run shell commands in a sandboxed environment. Requires operator approval.', category: 'code', tags: ['shell', 'terminal'] },
  { id: 'read_file',       name: 'Read File',       description: 'Read content from uploaded or linked files (PDF, DOCX, TXT, CSV).', category: 'files', tags: ['files', 'documents'] },
  { id: 'write_file',      name: 'Write File',      description: 'Create or overwrite files in the workspace scratch directory.', category: 'files', tags: ['files'] },
  { id: 'memory_read',     name: 'Memory Read',     description: 'Retrieve relevant memories to inject into the current context automatically.', category: 'memory', tags: ['memory'] },
  { id: 'memory_write',    name: 'Memory Write',    description: 'Extract and save new facts from conversations to the memory store.', category: 'memory', tags: ['memory', 'extraction'] },
  { id: 'rag_search',      name: 'RAG Search',      description: 'Search the RAG corpus for relevant document chunks.', category: 'knowledge', tags: ['rag', 'knowledge'] },
  { id: 'calendar_read',   name: 'Calendar Read',   description: 'Read upcoming events from connected calendar (Google/Outlook).', category: 'integration', tags: ['calendar'] },
  { id: 'calendar_write',  name: 'Calendar Write',  description: 'Create or update calendar events on connected accounts.', category: 'integration', tags: ['calendar'] },
  { id: 'email_send',      name: 'Email Send',      description: 'Draft and send emails via connected email account. Requires explicit approval.', category: 'integration', tags: ['email', 'communication'] },
  { id: 'crm_lookup',      name: 'CRM Lookup',      description: 'Query connected CRM for contact and deal information.', category: 'integration', tags: ['crm', 'contacts'] },
  { id: 'property_search', name: 'Property Search', description: 'Search Rightmove, Zoopla, or OnTheMarket listings via API.', category: 'property', tags: ['property', 'search'] },
  { id: 'land_registry',   name: 'Land Registry',   description: 'Query UK Land Registry for title information and price history.', category: 'property', tags: ['property', 'legal'] },
  { id: 'pdf_generate',    name: 'PDF Generator',   description: 'Render structured output as a PDF for download or email.', category: 'files', tags: ['pdf', 'export'] },
  { id: 'code_exec',       name: 'Code Executor',   description: 'Execute Python snippets for data analysis and calculations.', category: 'code', tags: ['python', 'data'] },
];

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);

  const wsSkills = await db
    .select()
    .from(workspaceSkills)
    .where(eq(workspaceSkills.workspaceId, workspace.id));

  const enabledMap = new Map(wsSkills.map((r) => [r.skillId, r.enabled]));
  const customSkills = wsSkills.filter((r) => r.isCustom);

  const platformList = PLATFORM_SKILLS.map((s) => ({
    ...s,
    enabled: enabledMap.has(s.id) ? enabledMap.get(s.id) : true, // default enabled
    isCustom: false,
  }));

  const customList = customSkills.map((s) => ({
    id:          s.skillId,
    name:        s.name ?? '',
    description: s.description ?? '',
    category:    'custom',
    tags:        s.tags,
    enabled:     s.enabled,
    githubUrl:   s.githubUrl,
    isCustom:    true,
  }));

  return NextResponse.json({ data: [...platformList, ...customList] });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);

  const body = await req.json() as { name?: string; description?: string; githubUrl?: string; tags?: string[] };
  const name = String(body.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const skillId = `custom:${Math.random().toString(36).slice(2, 10)}`;

  const [created] = await db
    .insert(workspaceSkills)
    .values({
      workspaceId: workspace.id,
      skillId,
      isCustom:    true,
      name,
      description: body.description?.trim() ?? '',
      githubUrl:   body.githubUrl?.trim() ?? null,
      tags:        body.tags ?? [],
      enabled:     true,
    })
    .returning();

  return NextResponse.json({ data: created });
}
```

### PATCH /api/skills/[skillId]

Create `src/app/api/skills/[skillId]/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { db } from '@/db';
import { workspaceSkills } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { skillId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);

  const body = await req.json() as { enabled?: boolean };

  // Upsert: platform skills may not have a row yet - create one on first toggle
  await db
    .insert(workspaceSkills)
    .values({
      workspaceId: workspace.id,
      skillId:     params.skillId,
      enabled:     typeof body.enabled === 'boolean' ? body.enabled : true,
      isCustom:    false,
    })
    .onConflictDoUpdate({
      target:     [workspaceSkills.workspaceId, workspaceSkills.skillId],
      set:        { enabled: typeof body.enabled === 'boolean' ? body.enabled : true, updatedAt: new Date() },
    });

  return NextResponse.json({ data: { ok: true } });
}

export async function DELETE(_req: Request, { params }: { params: { skillId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);

  await db
    .delete(workspaceSkills)
    .where(and(eq(workspaceSkills.workspaceId, workspace.id), eq(workspaceSkills.skillId, params.skillId)));

  return NextResponse.json({ data: { ok: true } });
}
```

Note: the PATCH upsert requires a unique constraint on `(workspace_id, skill_id)`. Add it to the schema:

```ts
export const workspaceSkills = pgTable('workspace_skills', {
  // ... columns above ...
}, (t) => ({
  uniq: uniqueIndex('ws_skills_uniq').on(t.workspaceId, t.skillId),
}));
```

---

## Step 3 - SkillsPanel Component

Create `src/components/panels/SkillsPanel.tsx`:

```tsx
'use client';
import { useState, useEffect } from 'react';
import { Zap, Search, Plus, ToggleLeft, ToggleRight, Trash2, ExternalLink, Tag, X } from 'lucide-react';
import { Panel } from '@/components/ui/Panel';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
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
  research:    'Research',
  code:        'Code',
  files:       'Files',
  memory:      'Memory',
  knowledge:   'Knowledge',
  integration: 'Integrations',
  property:    'Property',
  custom:      'Custom',
};

interface SkillsPanelProps {
  onClose: () => void;
}

export function SkillsPanel({ onClose }: SkillsPanelProps) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'add'>('list');
  const [filterCat, setFilterCat] = useState<string>('all');
  const [saving, setSaving] = useState(false);

  // Add form state
  const [addName, setAddName] = useState('');
  const [addDesc, setAddDesc] = useState('');
  const [addUrl, setAddUrl] = useState('');
  const [addTag, setAddTag] = useState('');
  const [addTags, setAddTags] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/skills');
    const d = await res.json();
    if (d.data) setSkills(d.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggle(skill: Skill) {
    const next = !skill.enabled;
    setSkills((prev) => prev.map((s) => s.id === skill.id ? { ...s, enabled: next } : s));
    await fetch(`/api/skills/${encodeURIComponent(skill.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: next }),
    });
  }

  async function deleteCustom(id: string) {
    await fetch(`/api/skills/${encodeURIComponent(id)}`, { method: 'DELETE' });
    setSkills((prev) => prev.filter((s) => s.id !== id));
  }

  async function addCustom() {
    if (!addName.trim()) return;
    setSaving(true);
    const res = await fetch('/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: addName, description: addDesc, githubUrl: addUrl || null, tags: addTags }),
    });
    const d = await res.json();
    if (d.data) {
      setAddName('');
      setAddDesc('');
      setAddUrl('');
      setAddTags([]);
      setActiveTab('list');
      await load();
    }
    setSaving(false);
  }

  const categories = ['all', ...Array.from(new Set(skills.map((s) => s.category)))];

  const filtered = skills.filter((s) => {
    const matchesCat = filterCat === 'all' || s.category === filterCat;
    const matchesQ = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesQ;
  });

  const grouped = filtered.reduce<Record<string, Skill[]>>((acc, s) => {
    const cat = s.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  const enabledCount = skills.filter((s) => s.enabled).length;

  return (
    <Panel
      title={`Skills (${enabledCount}/${skills.length} active)`}
      icon={<Zap className="h-4 w-4" />}
      onClose={onClose}
      width={400}
    >
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border px-4 pt-3 pb-0">
        {(['list', 'add'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-3 pb-2.5 text-xs font-medium border-b-2 capitalize transition-colors',
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
          {/* Search + filter */}
          <div className="space-y-2 px-4 py-3">
            <div className="flex items-center gap-2 rounded-md border border-border bg-elevated px-3 py-2">
              <Search className="h-3.5 w-3.5 text-text-muted shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search skills..."
                className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
              />
            </div>

            {/* Category pills */}
            <div className="flex gap-1 flex-wrap">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCat(cat)}
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors capitalize',
                    filterCat === cat
                      ? 'bg-accent-dim text-accent'
                      : 'bg-elevated text-text-muted hover:text-text-secondary',
                  )}
                >
                  {cat === 'all' ? 'All' : (CATEGORY_LABELS[cat] ?? cat)}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={<Zap className="h-8 w-8" />} title="No skills found" subtitle="Try a different search or category." />
          ) : (
            <div className="divide-y divide-border">
              {Object.entries(grouped).map(([cat, catSkills]) => (
                <div key={cat}>
                  <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    {CATEGORY_LABELS[cat] ?? cat}
                  </p>
                  {catSkills.map((skill) => (
                    <div key={skill.id} className={cn('group flex items-start gap-3 px-4 py-3 hover:bg-elevated transition-colors', !skill.enabled && 'opacity-50')}>
                      <button
                        onClick={() => toggle(skill)}
                        className="mt-0.5 shrink-0 text-text-muted hover:text-accent transition-colors"
                        aria-label={skill.enabled ? 'Disable skill' : 'Enable skill'}
                      >
                        {skill.enabled
                          ? <ToggleRight className="h-4 w-4 text-accent" />
                          : <ToggleLeft className="h-4 w-4" />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-medium text-text-primary">{skill.name}</span>
                          {skill.isCustom && (
                            <span className="rounded-full bg-elevated px-1.5 py-0.5 text-[9px] text-text-muted border border-border">custom</span>
                          )}
                          {skill.githubUrl && (
                            <a href={skill.githubUrl} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-accent">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <p className="text-[11px] text-text-muted leading-relaxed">{skill.description}</p>
                        {skill.tags.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {skill.tags.map((t) => (
                              <span key={t} className="rounded-full bg-elevated px-1.5 py-0.5 text-[9px] text-text-muted">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {skill.isCustom && (
                        <div className="hidden group-hover:flex shrink-0">
                          <IconButton label="Delete skill" size="sm" onClick={() => deleteCustom(skill.id)}>
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
        <div className="p-4 space-y-4">
          <p className="text-xs text-text-secondary">
            Add a custom skill. You can point to a GitHub repository containing the skill definition, or describe it manually. Custom skills are sent to the agent as extended context.
          </p>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Name</label>
            <input
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="e.g. Lease Analyser"
              autoFocus
              className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-border-focus"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Description</label>
            <textarea
              value={addDesc}
              onChange={(e) => setAddDesc(e.target.value)}
              placeholder="What does this skill do? Be specific - the agent uses this to decide when to invoke it."
              rows={3}
              className="w-full resize-none rounded-md border border-border bg-elevated px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-border-focus"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">GitHub URL (optional)</label>
            <input
              value={addUrl}
              onChange={(e) => setAddUrl(e.target.value)}
              placeholder="https://github.com/your-org/skill-name"
              className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-xs font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-border-focus"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Tags</label>
            <div className="flex gap-2">
              <input
                value={addTag}
                onChange={(e) => setAddTag(e.target.value)}
                placeholder="Add a tag"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && addTag.trim()) {
                    e.preventDefault();
                    setAddTags((prev) => [...prev, addTag.trim()]);
                    setAddTag('');
                  }
                }}
                className="flex-1 rounded-md border border-border bg-elevated px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-border-focus"
              />
              <button
                onClick={() => { if (addTag.trim()) { setAddTags((prev) => [...prev, addTag.trim()]); setAddTag(''); }}}
                className="rounded-md border border-border bg-elevated px-3 py-2 text-xs text-text-secondary hover:text-text-primary"
              >
                Add
              </button>
            </div>
            {addTags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {addTags.map((t, i) => (
                  <span key={i} className="flex items-center gap-1 rounded-full bg-elevated px-2 py-0.5 text-[10px] text-text-secondary border border-border">
                    <Tag className="h-2.5 w-2.5" />
                    {t}
                    <button onClick={() => setAddTags((prev) => prev.filter((_, j) => j !== i))} className="text-text-muted hover:text-danger">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={addCustom}
            disabled={saving || !addName.trim()}
            className="w-full rounded-md bg-accent py-2 text-xs font-medium text-black hover:bg-accent-hover disabled:opacity-40 transition-colors"
          >
            {saving ? 'Adding...' : 'Add skill'}
          </button>
        </div>
      )}
    </Panel>
  );
}
```

---

## Step 4 - Wire SkillsPanel into PanelProvider

Update `src/components/shell/PanelProvider.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { MemoryPanel } from '@/components/panels/MemoryPanel';
import { SkillsPanel } from '@/components/panels/SkillsPanel';

type PanelType = 'memory' | 'skills' | 'notes' | null;

export function PanelProvider({ children }: { children: React.ReactNode }) {
  const [activePanel, setActivePanel] = useState<PanelType>(null);

  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent).detail as PanelType;
      setActivePanel((prev) => (prev === detail ? null : detail));
    }
    document.addEventListener('open-panel', handler);
    return () => document.removeEventListener('open-panel', handler);
  }, []);

  return (
    <>
      {children}
      {activePanel === 'memory' && <MemoryPanel onClose={() => setActivePanel(null)} />}
      {activePanel === 'skills' && <SkillsPanel onClose={() => setActivePanel(null)} />}
      {/* Notes panel added in Prompt 10 */}
    </>
  );
}
```

---

## Step 5 - Pass Enabled Skills to the Agent

Update `src/lib/carina-chat.ts` to append the list of enabled skills to the system prompt alongside memories. This gives the agent a clear inventory of what it is allowed to use:

```ts
// After fetching memories, also fetch enabled workspace skills
const [memories, wsSkillRows] = await Promise.all([
  db.select({ content: userMemories.content, type: userMemories.type })
    .from(userMemories)
    .where(and(eq(userMemories.workspaceId, input.workspaceId), eq(userMemories.enabled, true)))
    .limit(50),
  db.select({ skillId: workspaceSkills.skillId, name: workspaceSkills.name })
    .from(workspaceSkills)
    .where(and(eq(workspaceSkills.workspaceId, input.workspaceId), eq(workspaceSkills.enabled, false))),
]);

// wsSkillRows contains DISABLED skills - exclude them from agent awareness
const disabledIds = new Set(wsSkillRows.map((r) => r.skillId));
// (The enabled list is derived implicitly - do not pass an exhaustive list, just tell the agent what is blocked)

let skillBlock = '';
if (disabledIds.size > 0) {
  skillBlock = '\n\nDisabled tools for this session (do not invoke): ' + Array.from(disabledIds).join(', ');
}
```

Append `skillBlock` to `systemPrompt` alongside the memory block.

---

## Verification

After this prompt:
1. Clicking "Skills" in the sidebar opens the Skills panel
2. All 15 platform skills are listed with names, descriptions, categories
3. Each skill has a toggle - disabling one immediately reflects the change (optimistic UI)
4. Category filter pills at the top filter the list by category
5. Search filters by name or description
6. Disabled skills appear at 50% opacity
7. The "Add custom" tab shows the form with name, description, GitHub URL, tags
8. Adding tags via Enter key creates removable tag chips
9. Submitting the custom skill form adds it to the list under "Custom" category
10. Custom skills show a "custom" badge and a delete button on hover
11. TypeScript builds without errors
12. Skills enablement is persisted (survive page reload)
