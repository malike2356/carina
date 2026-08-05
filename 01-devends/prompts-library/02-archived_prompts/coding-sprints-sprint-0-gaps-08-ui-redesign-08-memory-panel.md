# Prompt 08 - Memory Panel

## Objective

Build the Memory panel - a floating right-side overlay where users can view, add, edit, delete, import, and export their long-term memories. This is one of the most important trust-building features: users need to see what Carina remembers about them and be able to correct it.

---

## Context

Working directory: `/opt/lampp/htdocs/verlox/carina/app.carinaai.uk`

Prerequisites: Prompts 00-07 complete. `userMemories` table exists (Prompt 01). `Panel.tsx` exists (Prompt 02). The sidebar already dispatches `open-panel` with detail `'memory'`. `PanelProvider.tsx` already has the commented-out import slot.

---

## Step 1 - Memory API Routes

### GET /api/memories

Create `src/app/api/memories/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { db } from '@/db';
import { userMemories } from '@/db/schema';
import { eq, and, ilike, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim();

  const where = q
    ? and(eq(userMemories.workspaceId, workspace.id), ilike(userMemories.content, `%${q}%`))
    : eq(userMemories.workspaceId, workspace.id);

  const rows = await db
    .select()
    .from(userMemories)
    .where(where)
    .orderBy(desc(userMemories.createdAt))
    .limit(200);

  return NextResponse.json({ data: rows });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);

  const body = await req.json() as { content?: string; type?: string };
  const content = String(body.content ?? '').trim();
  if (!content) return NextResponse.json({ error: 'content is required' }, { status: 400 });

  const validTypes = ['fact', 'preference', 'instruction', 'contact'] as const;
  const type = validTypes.includes(body.type as typeof validTypes[number])
    ? (body.type as typeof validTypes[number])
    : 'fact';

  const [created] = await db
    .insert(userMemories)
    .values({ workspaceId: workspace.id, content, type, source: 'manual' })
    .returning();

  return NextResponse.json({ data: created });
}
```

### PATCH /api/memories/[id] and DELETE /api/memories/[id]

Create `src/app/api/memories/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { db } from '@/db';
import { userMemories } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

async function getOwnedMemory(userId: string, memoryId: string) {
  const workspace = await requireWorkspace(userId);
  const [row] = await db
    .select()
    .from(userMemories)
    .where(and(eq(userMemories.id, memoryId), eq(userMemories.workspaceId, workspace.id)))
    .limit(1);
  return { workspace, memory: row ?? null };
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { memory } = await getOwnedMemory(session.user.id, params.id);
  if (!memory) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json() as { content?: string; enabled?: boolean; type?: string };
  const updates: Partial<typeof userMemories.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.content === 'string' && body.content.trim()) updates.content = body.content.trim();
  if (typeof body.enabled === 'boolean') updates.enabled = body.enabled;
  if (body.type) updates.type = body.type as typeof memory.type;

  await db.update(userMemories).set(updates).where(eq(userMemories.id, params.id));
  return NextResponse.json({ data: { ok: true } });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { memory } = await getOwnedMemory(session.user.id, params.id);
  if (!memory) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await db.delete(userMemories).where(eq(userMemories.id, params.id));
  return NextResponse.json({ data: { ok: true } });
}
```

### POST /api/memories/import

Create `src/app/api/memories/import/route.ts` for bulk import from text/file:

```ts
import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { db } from '@/db';
import { userMemories } from '@/db/schema';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);

  const body = await req.json() as { text?: string };
  const text = String(body.text ?? '').trim();
  if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 });

  // Split on newlines, filter blank lines, each line becomes a memory
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 3);

  if (lines.length === 0) return NextResponse.json({ error: 'No valid lines found' }, { status: 400 });
  if (lines.length > 200) return NextResponse.json({ error: 'Max 200 memories per import' }, { status: 400 });

  const rows = await db
    .insert(userMemories)
    .values(lines.map((content) => ({ workspaceId: workspace.id, content, type: 'fact' as const, source: 'imported' as const })))
    .returning({ id: userMemories.id });

  return NextResponse.json({ data: { imported: rows.length } });
}
```

### GET /api/memories/export

Create `src/app/api/memories/export/route.ts`:

```ts
import { getSession, requireWorkspace } from '@/lib/session';
import { db } from '@/db';
import { userMemories } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return new Response('Unauthorized', { status: 401 });
  const workspace = await requireWorkspace(session.user.id);

  const rows = await db
    .select({ content: userMemories.content, type: userMemories.type, createdAt: userMemories.createdAt })
    .from(userMemories)
    .where(eq(userMemories.workspaceId, workspace.id));

  const text = rows.map((r) => `[${r.type}] ${r.content}`).join('\n');

  return new Response(text, {
    headers: {
      'Content-Type': 'text/plain',
      'Content-Disposition': 'attachment; filename="carina-memories.txt"',
    },
  });
}
```

---

## Step 2 - Create MemoryPanel Component

Create `src/components/panels/MemoryPanel.tsx`:

```tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { Brain, Plus, Search, Download, Upload, ToggleLeft, ToggleRight, Trash2, Edit2, Check, X } from 'lucide-react';
import { Panel } from '@/components/ui/Panel';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';

interface Memory {
  id: string;
  content: string;
  type: string;
  enabled: boolean;
  source: string;
  confidence: number;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  fact:        'Fact',
  preference:  'Preference',
  instruction: 'Instruction',
  contact:     'Contact',
};

interface MemoryPanelProps {
  onClose: () => void;
}

export function MemoryPanel({ onClose }: MemoryPanelProps) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'import'>('list');
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState<'fact' | 'preference' | 'instruction' | 'contact'>('fact');
  const [saving, setSaving] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  async function load(q = '') {
    setLoading(true);
    const res = await fetch(`/api/memories${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    const d = await res.json();
    if (d.data) setMemories(d.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  async function addMemory() {
    if (!newContent.trim()) return;
    setSaving(true);
    const res = await fetch('/api/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newContent.trim(), type: newType }),
    });
    const d = await res.json();
    if (d.data) {
      setMemories((prev) => [d.data, ...prev]);
      setNewContent('');
      setActiveTab('list');
    }
    setSaving(false);
  }

  async function toggleEnabled(mem: Memory) {
    await fetch(`/api/memories/${mem.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !mem.enabled }),
    });
    setMemories((prev) => prev.map((m) => m.id === mem.id ? { ...m, enabled: !m.enabled } : m));
  }

  async function deleteMemory(id: string) {
    await fetch(`/api/memories/${id}`, { method: 'DELETE' });
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }

  async function commitEdit(id: string) {
    if (!editDraft.trim()) return;
    await fetch(`/api/memories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editDraft.trim() }),
    });
    setMemories((prev) => prev.map((m) => m.id === id ? { ...m, content: editDraft.trim() } : m));
    setEditingId(null);
  }

  async function doImport() {
    if (!importText.trim()) return;
    setImporting(true);
    const res = await fetch('/api/memories/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: importText }),
    });
    const d = await res.json();
    if (d.data) {
      setImportText('');
      setActiveTab('list');
      await load();
    }
    setImporting(false);
  }

  function exportMemories() {
    window.open('/api/memories/export', '_blank');
  }

  const tabs = [
    { id: 'list' as const, label: `Memories ${memories.length > 0 ? memories.length : ''}` },
    { id: 'add' as const, label: 'Add' },
    { id: 'import' as const, label: 'Import' },
  ];

  return (
    <Panel
      title="Memory"
      icon={<Brain className="h-4 w-4" />}
      onClose={onClose}
      width={380}
    >
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border px-4 pt-3 pb-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-3 pb-2.5 text-xs font-medium border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-secondary',
            )}
          >
            {tab.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 pb-2">
          <IconButton label="Export memories" size="sm" onClick={exportMemories}>
            <Download className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>

      {/* List tab */}
      {activeTab === 'list' && (
        <div className="flex flex-col">
          {/* Search */}
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 rounded-md border border-border bg-elevated px-3 py-2">
              <Search className="h-3.5 w-3.5 text-text-muted shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search memories..."
                className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
              />
              {search && (
                <IconButton label="Clear search" size="sm" onClick={() => setSearch('')}>
                  <X className="h-3 w-3" />
                </IconButton>
              )}
            </div>
          </div>

          {/* Memory list */}
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : memories.length === 0 ? (
            <EmptyState
              icon={<Brain className="h-8 w-8" />}
              title="No memories yet"
              subtitle="Add facts, preferences, or instructions Carina should remember across conversations."
              action={
                <button
                  onClick={() => setActiveTab('add')}
                  className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black hover:bg-accent-hover"
                >
                  Add first memory
                </button>
              }
            />
          ) : (
            <div className="divide-y divide-border">
              {memories.map((mem) => (
                <div
                  key={mem.id}
                  className={cn('group px-4 py-3 transition-colors hover:bg-elevated', !mem.enabled && 'opacity-50')}
                >
                  <div className="flex items-start gap-2">
                    {/* Enable toggle */}
                    <button
                      onClick={() => toggleEnabled(mem)}
                      className="mt-0.5 shrink-0 text-text-muted hover:text-accent transition-colors"
                      aria-label={mem.enabled ? 'Disable memory' : 'Enable memory'}
                    >
                      {mem.enabled
                        ? <ToggleRight className="h-4 w-4 text-accent" />
                        : <ToggleLeft className="h-4 w-4" />}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {editingId === mem.id ? (
                        <div className="flex flex-col gap-1.5">
                          <textarea
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            autoFocus
                            rows={3}
                            className="w-full resize-none rounded border border-border-focus bg-elevated px-2 py-1.5 text-xs text-text-primary focus:outline-none"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(mem.id); }
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                          />
                          <div className="flex gap-1">
                            <button onClick={() => commitEdit(mem.id)} className="rounded bg-accent px-2 py-1 text-[10px] font-medium text-black">Save</button>
                            <button onClick={() => setEditingId(null)} className="rounded bg-elevated px-2 py-1 text-[10px] text-text-secondary">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-text-primary leading-relaxed break-words">{mem.content}</p>
                      )}

                      <div className="mt-1.5 flex items-center gap-2">
                        <span className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded font-medium',
                          mem.type === 'instruction' ? 'bg-blue-950 text-blue-400' :
                          mem.type === 'preference'  ? 'bg-purple-950 text-purple-400' :
                          mem.type === 'contact'     ? 'bg-amber-950 text-amber-400' :
                          'bg-elevated text-text-muted',
                        )}>
                          {TYPE_LABELS[mem.type] ?? mem.type}
                        </span>
                        {mem.source === 'extracted' && (
                          <span className="text-[10px] text-text-muted italic">auto-extracted</span>
                        )}
                      </div>
                    </div>

                    {/* Actions - visible on hover */}
                    {editingId !== mem.id && (
                      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                        <IconButton label="Edit memory" size="sm" onClick={() => { setEditingId(mem.id); setEditDraft(mem.content); }}>
                          <Edit2 className="h-3 w-3" />
                        </IconButton>
                        <IconButton label="Delete memory" size="sm" onClick={() => deleteMemory(mem.id)}>
                          <Trash2 className="h-3 w-3 text-danger" />
                        </IconButton>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add tab */}
      {activeTab === 'add' && (
        <div className="p-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">Memory type</label>
            <div className="flex gap-1.5 flex-wrap">
              {(['fact', 'preference', 'instruction', 'contact'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setNewType(t)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors border',
                    newType === t
                      ? 'bg-accent-dim border-accent/40 text-accent'
                      : 'bg-elevated border-border text-text-secondary hover:text-text-primary',
                  )}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">
              Content
              <span className="ml-1 text-text-muted font-normal">
                {newType === 'fact' && '- a fact about you or your work'}
                {newType === 'preference' && '- how you prefer Carina to behave'}
                {newType === 'instruction' && '- a rule Carina must follow'}
                {newType === 'contact' && '- a person or organisation'}
              </span>
            </label>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder={
                newType === 'fact' ? 'e.g. I focus on buy-to-let properties in South Manchester' :
                newType === 'preference' ? 'e.g. Always respond concisely and avoid bullet lists unless asked' :
                newType === 'instruction' ? 'e.g. Never quote a rental yield below 5% as acceptable' :
                'e.g. Sarah Chen - tenant in Flat 2, lease ends March 2027'
              }
              rows={4}
              autoFocus
              className="w-full resize-none rounded-lg border border-border bg-elevated px-3 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-border-focus"
              onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) addMemory(); }}
            />
            <p className="mt-1 text-[10px] text-text-muted">Cmd+Enter to save</p>
          </div>

          <button
            onClick={addMemory}
            disabled={saving || !newContent.trim()}
            className="w-full rounded-md bg-accent py-2 text-xs font-medium text-black hover:bg-accent-hover disabled:opacity-40 transition-colors"
          >
            {saving ? 'Saving...' : 'Add memory'}
          </button>
        </div>
      )}

      {/* Import tab */}
      {activeTab === 'import' && (
        <div className="p-4 space-y-4">
          <div>
            <p className="text-xs text-text-secondary mb-3">
              Paste text with one memory per line. Each line becomes a separate fact.
              You can also paste from a .txt or .md file.
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={'I prefer direct, concise answers\nMy target market is first-time buyers\nI work with solicitor: John Bramley at Bramley & Co'}
              rows={8}
              autoFocus
              className="w-full resize-none rounded-lg border border-border bg-elevated px-3 py-2.5 text-xs font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-border-focus"
            />
            <p className="mt-1 text-[10px] text-text-muted">
              {importText.split('\n').filter((l) => l.trim().length > 3).length} memories to import
            </p>
          </div>

          <button
            onClick={doImport}
            disabled={importing || !importText.trim()}
            className="w-full rounded-md bg-accent py-2 text-xs font-medium text-black hover:bg-accent-hover disabled:opacity-40 transition-colors"
          >
            {importing ? 'Importing...' : 'Import memories'}
          </button>
        </div>
      )}
    </Panel>
  );
}
```

---

## Step 3 - Wire MemoryPanel into PanelProvider

Update `src/components/shell/PanelProvider.tsx` to import and render `MemoryPanel`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { MemoryPanel } from '@/components/panels/MemoryPanel';

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
      {/* Skills and Notes panels added in Prompts 09 and 10 */}
    </>
  );
}
```

---

## Step 4 - Inject Active Memories into Chat Context

Update `src/lib/carina-chat.ts` to prepend enabled memories to the system prompt. This is the mechanism that makes "Carina remembers" actually work.

In `streamCarinaChat`, before building the request to the provider, fetch enabled memories:

```ts
import { db } from '@/db';
import { userMemories } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// Inside streamCarinaChat, after resolving provider:
const memories = await db
  .select({ content: userMemories.content, type: userMemories.type })
  .from(userMemories)
  .where(and(eq(userMemories.workspaceId, input.workspaceId), eq(userMemories.enabled, true)))
  .limit(50);

let memoryBlock = '';
if (memories.length > 0) {
  memoryBlock = '\n\nWhat you remember about this user:\n' +
    memories.map((m) => `- [${m.type}] ${m.content}`).join('\n');
}

const systemPrompt = `You are Carina, an autonomous AI agent built by VERLOX Ltd for property professionals. Be direct and concise.${memoryBlock}`;
```

Pass `systemPrompt` to `streamOpenAiCompatible` by updating its signature:

```ts
async function* streamOpenAiCompatible(
  endpoint: string,
  apiKey: string,
  model: string,
  message: string,
  systemPrompt: string,
): AsyncGenerator<string>
```

Replace the hardcoded system content string with the `systemPrompt` parameter.

---

## Verification

After this prompt:
1. Clicking "Memory" in the sidebar opens the Memory panel from the right
2. The panel has three tabs: Memories (count), Add, Import
3. Empty state shows when no memories exist, with "Add first memory" button
4. Adding a memory with type selection and content field saves it and switches to list tab
5. List shows each memory with enable/disable toggle, type badge, hover actions
6. Disabling a memory greys it out (opacity-50) and toggles the icon
7. Editing a memory shows an inline textarea with Save/Cancel buttons, Enter commits
8. Deleting a memory removes it instantly (optimistic)
9. Search filters the memory list in real time (debounced 250ms)
10. Export button opens a .txt download with all memories
11. Import tab accepts multi-line text and creates one memory per line
12. After adding a memory, subsequent chat messages have that memory in the system prompt (verify by adding an instruction like "Always respond in formal English" and confirming Carina follows it)
13. Escape key or clicking backdrop closes the panel
14. TypeScript builds without errors
