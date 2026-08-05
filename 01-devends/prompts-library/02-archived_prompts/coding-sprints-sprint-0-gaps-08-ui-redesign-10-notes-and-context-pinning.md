# Prompt 10 - Notes and Context Pinning

## Objective

Build the Notes system: a persistent scratchpad where users can write notes (markdown supported), pin them to the active chat session as context chips (so the AI can see them), archive old ones, and manage them from a floating panel. This closes the gap where Odysseus has rich document/context injection and Carina's input bar currently accepts no context beyond the typed message.

---

## Context

Working directory: `/opt/lampp/htdocs/verlox/carina/app.carinaai.uk`

Prerequisites: Prompts 00-09 complete. The `userNotes` and `sessionContextPins` tables exist (Prompt 01). The `Panel` primitive exists (Prompt 02). The sidebar dispatches `open-panel` with detail `'notes'`. `ContextChips` and `ChatInputBar` exist (Prompt 06). `PanelProvider` has a slot for `NotesPanel`.

---

## Step 1 - Notes API Routes

### GET and POST /api/notes

Create `src/app/api/notes/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { db } from '@/db';
import { userNotes } from '@/db/schema';
import { eq, and, ilike, desc, isNull, not } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim();
  const includeArchived = url.searchParams.get('archived') === '1';

  const conditions: Parameters<typeof db.select>[0] extends never ? never : unknown[] = [
    eq(userNotes.workspaceId, workspace.id),
  ];
  if (!includeArchived) conditions.push(eq(userNotes.archived, false));
  if (q) conditions.push(ilike(userNotes.content, `%${q}%`));

  const rows = await db
    .select()
    .from(userNotes)
    .where(and(...conditions as Parameters<typeof and>))
    .orderBy(desc(userNotes.pinned), desc(userNotes.updatedAt))
    .limit(100);

  return NextResponse.json({ data: rows });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);

  const body = await req.json() as { title?: string; content?: string };
  const title   = String(body.title   ?? '').trim() || 'Untitled note';
  const content = String(body.content ?? '').trim();

  const [created] = await db
    .insert(userNotes)
    .values({ workspaceId: workspace.id, title, content })
    .returning();

  return NextResponse.json({ data: created });
}
```

### PATCH and DELETE /api/notes/[id]

Create `src/app/api/notes/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { db } from '@/db';
import { userNotes } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

async function getOwned(userId: string, noteId: string) {
  const workspace = await requireWorkspace(userId);
  const [row] = await db
    .select()
    .from(userNotes)
    .where(and(eq(userNotes.id, noteId), eq(userNotes.workspaceId, workspace.id)))
    .limit(1);
  return { workspace, note: row ?? null };
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { note } = await getOwned(session.user.id, params.id);
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json() as { title?: string; content?: string; archived?: boolean; pinned?: boolean };
  const updates: Partial<typeof userNotes.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.title    === 'string') updates.title    = body.title.trim() || 'Untitled note';
  if (typeof body.content  === 'string') updates.content  = body.content;
  if (typeof body.archived === 'boolean') updates.archived = body.archived;
  if (typeof body.pinned   === 'boolean') updates.pinned   = body.pinned;

  await db.update(userNotes).set(updates).where(eq(userNotes.id, params.id));
  return NextResponse.json({ data: { ok: true } });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { note } = await getOwned(session.user.id, params.id);
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await db.delete(userNotes).where(eq(userNotes.id, params.id));
  return NextResponse.json({ data: { ok: true } });
}
```

### Context Pins API

Create `src/app/api/notes/[id]/pin/route.ts` to pin a note to the active session:

```ts
import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { db } from '@/db';
import { userNotes, sessionContextPins } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);

  const body = await req.json() as { sessionId?: string };
  if (!body.sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

  const [note] = await db
    .select()
    .from(userNotes)
    .where(and(eq(userNotes.id, params.id), eq(userNotes.workspaceId, workspace.id)))
    .limit(1);

  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [pin] = await db
    .insert(sessionContextPins)
    .values({
      sessionId:   body.sessionId,
      workspaceId: workspace.id,
      pinType:     'note',
      referenceId: note.id,
      label:       note.title,
      content:     note.content,
    })
    .onConflictDoNothing()
    .returning();

  return NextResponse.json({ data: pin ?? { exists: true } });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);

  const body = await req.json() as { sessionId?: string };
  if (!body.sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

  await db
    .delete(sessionContextPins)
    .where(
      and(
        eq(sessionContextPins.referenceId, params.id),
        eq(sessionContextPins.sessionId, body.sessionId),
        eq(sessionContextPins.workspaceId, workspace.id),
      ),
    );

  return NextResponse.json({ data: { ok: true } });
}
```

Add a unique constraint to `sessionContextPins` in the schema to prevent duplicates:

```ts
}, (t) => ({
  uniq: uniqueIndex('ctx_pins_uniq').on(t.sessionId, t.pinType, t.referenceId),
}));
```

---

## Step 2 - NotesPanel Component

Create `src/components/panels/NotesPanel.tsx`:

```tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { FileText, Plus, Archive, Pin, PinOff, Trash2, Search, Edit2, ChevronRight, X, ArrowLeft } from 'lucide-react';
import { Panel } from '@/components/ui/Panel';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';

interface Note {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  archived: boolean;
  updatedAt: string;
}

interface NotesPanelProps {
  onClose: () => void;
  activeSessionId?: string | null;
  pinnedNoteIds?: Set<string>;
  onPinToggle?: (noteId: string, label: string, content: string) => void;
}

type View = 'list' | 'edit' | 'new';

export function NotesPanel({ onClose, activeSessionId, pinnedNoteIds = new Set(), onPinToggle }: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('list');
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  async function load() {
    setLoading(true);
    const q = new URLSearchParams();
    if (search) q.set('q', search);
    if (showArchived) q.set('archived', '1');
    const res = await fetch(`/api/notes?${q}`);
    const d = await res.json();
    if (d.data) setNotes(d.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [search, showArchived]);

  function openNew() {
    setEditingNote(null);
    setEditTitle('');
    setEditContent('');
    setView('new');
    setTimeout(() => contentRef.current?.focus(), 50);
  }

  function openEdit(note: Note) {
    setEditingNote(note);
    setEditTitle(note.title);
    setEditContent(note.content);
    setView('edit');
    setTimeout(() => contentRef.current?.focus(), 50);
  }

  async function saveNote() {
    if (!editContent.trim() && !editTitle.trim()) return;
    setSaving(true);

    if (view === 'new') {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle || editContent.split('\n')[0]?.slice(0, 60), content: editContent }),
      });
      const d = await res.json();
      if (d.data) {
        setNotes((prev) => [d.data, ...prev]);
        setView('list');
      }
    } else if (editingNote) {
      await fetch(`/api/notes/${editingNote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle || editContent.split('\n')[0]?.slice(0, 60), content: editContent }),
      });
      setNotes((prev) => prev.map((n) => n.id === editingNote.id ? { ...n, title: editTitle, content: editContent } : n));
      setView('list');
    }
    setSaving(false);
  }

  async function togglePinned(note: Note) {
    const next = !note.pinned;
    setNotes((prev) => prev.map((n) => n.id === note.id ? { ...n, pinned: next } : n));
    await fetch(`/api/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: next }),
    });
  }

  async function toggleArchived(note: Note) {
    const next = !note.archived;
    setNotes((prev) => prev.map((n) => n.id === note.id ? { ...n, archived: next } : n));
    await fetch(`/api/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: next }),
    });
  }

  async function deleteNote(id: string) {
    await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  const pinnedNotes = notes.filter((n) => n.pinned && !n.archived);
  const regularNotes = notes.filter((n) => !n.pinned && !n.archived);
  const archivedNotes = notes.filter((n) => n.archived);

  return (
    <Panel
      title="Notes"
      icon={<FileText className="h-4 w-4" />}
      onClose={onClose}
      width={400}
    >
      {/* List view */}
      {view === 'list' && (
        <div className="flex flex-col">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 py-3">
            <div className="flex flex-1 items-center gap-2 rounded-md border border-border bg-elevated px-3 py-2">
              <Search className="h-3.5 w-3.5 text-text-muted shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes..."
                className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
              />
            </div>
            <IconButton label="New note" size="sm" onClick={openNew}>
              <Plus className="h-4 w-4" />
            </IconButton>
          </div>

          {/* Archive toggle */}
          <div className="px-4 pb-2">
            <button
              onClick={() => setShowArchived((v) => !v)}
              className="text-[10px] text-text-muted hover:text-text-secondary transition-colors"
            >
              {showArchived ? 'Hide archived' : 'Show archived'}
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : notes.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-8 w-8" />}
              title="No notes yet"
              subtitle="Create notes to pin as context to your chat sessions."
              action={
                <button onClick={openNew} className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black hover:bg-accent-hover">
                  New note
                </button>
              }
            />
          ) : (
            <div className="divide-y divide-border">
              {/* Pinned */}
              {pinnedNotes.length > 0 && (
                <>
                  <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Pinned</p>
                  {pinnedNotes.map((note) => <NoteRow key={note.id} note={note} activeSessionId={activeSessionId} pinnedNoteIds={pinnedNoteIds} onPinToggle={onPinToggle} onEdit={openEdit} onTogglePinned={togglePinned} onToggleArchived={toggleArchived} onDelete={deleteNote} />)}
                </>
              )}

              {/* Regular */}
              {regularNotes.length > 0 && (
                <>
                  {pinnedNotes.length > 0 && <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Notes</p>}
                  {regularNotes.map((note) => <NoteRow key={note.id} note={note} activeSessionId={activeSessionId} pinnedNoteIds={pinnedNoteIds} onPinToggle={onPinToggle} onEdit={openEdit} onTogglePinned={togglePinned} onToggleArchived={toggleArchived} onDelete={deleteNote} />)}
                </>
              )}

              {/* Archived */}
              {showArchived && archivedNotes.length > 0 && (
                <>
                  <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Archived</p>
                  {archivedNotes.map((note) => <NoteRow key={note.id} note={note} activeSessionId={activeSessionId} pinnedNoteIds={pinnedNoteIds} onPinToggle={onPinToggle} onEdit={openEdit} onTogglePinned={togglePinned} onToggleArchived={toggleArchived} onDelete={deleteNote} />)}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Edit / New view */}
      {(view === 'edit' || view === 'new') && (
        <div className="flex flex-col h-full">
          {/* Back bar */}
          <div className="flex items-center gap-2 border-b border-border px-4 py-2">
            <button onClick={() => setView('list')} className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary">
              <ArrowLeft className="h-3.5 w-3.5" />
              Notes
            </button>
            <span className="ml-auto text-xs text-text-muted">{view === 'new' ? 'New note' : 'Edit note'}</span>
          </div>

          <div className="flex flex-col flex-1 gap-3 p-4">
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Title (optional)"
              className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm font-medium text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-border-focus"
            />
            <textarea
              ref={contentRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="Write in markdown..."
              className="flex-1 min-h-64 resize-none rounded-md border border-border bg-elevated px-3 py-2.5 text-xs font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-border-focus"
              onKeyDown={(e) => { if (e.key === 's' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveNote(); }}}
            />
            <p className="text-[10px] text-text-muted">Ctrl+S to save - Markdown supported</p>
            <button
              onClick={saveNote}
              disabled={saving || (!editContent.trim() && !editTitle.trim())}
              className="rounded-md bg-accent py-2 text-xs font-medium text-black hover:bg-accent-hover disabled:opacity-40 transition-colors"
            >
              {saving ? 'Saving...' : 'Save note'}
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}

// --- NoteRow sub-component ---

interface NoteRowProps {
  note: Note;
  activeSessionId?: string | null;
  pinnedNoteIds: Set<string>;
  onPinToggle?: (noteId: string, label: string, content: string) => void;
  onEdit: (n: Note) => void;
  onTogglePinned: (n: Note) => void;
  onToggleArchived: (n: Note) => void;
  onDelete: (id: string) => void;
}

function NoteRow({ note, activeSessionId, pinnedNoteIds, onPinToggle, onEdit, onTogglePinned, onToggleArchived, onDelete }: NoteRowProps) {
  const isContextPinned = pinnedNoteIds.has(note.id);
  const preview = note.content.replace(/[#*`>-]/g, '').trim().slice(0, 100);

  return (
    <div className={cn('group flex items-start gap-3 px-4 py-3 hover:bg-elevated transition-colors cursor-pointer', note.archived && 'opacity-50')} onClick={() => onEdit(note)}>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-text-primary truncate">{note.title}</p>
        {preview && <p className="text-[11px] text-text-muted mt-0.5 line-clamp-2">{preview}</p>}
      </div>

      {/* Actions */}
      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        {/* Context pin - only when in an active session */}
        {activeSessionId && onPinToggle && (
          <IconButton
            label={isContextPinned ? 'Remove from context' : 'Add to chat context'}
            size="sm"
            onClick={() => onPinToggle(note.id, note.title, note.content)}
          >
            <ChevronRight className={cn('h-3 w-3', isContextPinned ? 'text-accent' : 'text-text-muted')} />
          </IconButton>
        )}
        <IconButton label={note.pinned ? 'Unpin' : 'Pin to top'} size="sm" onClick={() => onTogglePinned(note)}>
          {note.pinned ? <PinOff className="h-3 w-3 text-accent" /> : <Pin className="h-3 w-3" />}
        </IconButton>
        <IconButton label={note.archived ? 'Unarchive' : 'Archive'} size="sm" onClick={() => onToggleArchived(note)}>
          <Archive className="h-3 w-3" />
        </IconButton>
        <IconButton label="Delete note" size="sm" onClick={() => onDelete(note.id)}>
          <Trash2 className="h-3 w-3 text-danger" />
        </IconButton>
      </div>
    </div>
  );
}
```

---

## Step 3 - Wire NotesPanel into PanelProvider

Update `src/components/shell/PanelProvider.tsx`:

```tsx
'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { MemoryPanel } from '@/components/panels/MemoryPanel';
import { SkillsPanel } from '@/components/panels/SkillsPanel';
import { NotesPanel } from '@/components/panels/NotesPanel';

type PanelType = 'memory' | 'skills' | 'notes' | null;

interface ContextPin { noteId: string; label: string; content: string; }

export function PanelProvider({ children }: { children: React.ReactNode }) {
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [contextPins, setContextPins] = useState<ContextPin[]>([]);
  const params = useParams<{ sessionId?: string }>();
  const sessionId = params?.sessionId ?? null;

  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent).detail as PanelType;
      setActivePanel((prev) => (prev === detail ? null : detail));
    }
    document.addEventListener('open-panel', handler);
    return () => document.removeEventListener('open-panel', handler);
  }, []);

  // Broadcast context pins to ChatInputBar via custom event
  useEffect(() => {
    document.dispatchEvent(new CustomEvent('context-pins-changed', { detail: contextPins }));
  }, [contextPins]);

  const toggleContextPin = useCallback((noteId: string, label: string, content: string) => {
    setContextPins((prev) => {
      const exists = prev.find((p) => p.noteId === noteId);
      if (exists) return prev.filter((p) => p.noteId !== noteId);
      return [...prev, { noteId, label, content }];
    });
  }, []);

  const pinnedNoteIds = new Set(contextPins.map((p) => p.noteId));

  return (
    <>
      {children}
      {activePanel === 'memory' && <MemoryPanel onClose={() => setActivePanel(null)} />}
      {activePanel === 'skills' && <SkillsPanel onClose={() => setActivePanel(null)} />}
      {activePanel === 'notes' && (
        <NotesPanel
          onClose={() => setActivePanel(null)}
          activeSessionId={sessionId}
          pinnedNoteIds={pinnedNoteIds}
          onPinToggle={toggleContextPin}
        />
      )}
    </>
  );
}
```

---

## Step 4 - Update ChatInputBar to Listen for Context Pin Events

In `src/components/chat/ChatInputBar.tsx`, subscribe to `context-pins-changed` events to keep the chip list in sync:

```tsx
// Inside ChatInputBar component, add:
useEffect(() => {
  function handler(e: Event) {
    const pins = (e as CustomEvent).detail as Array<{ noteId: string; label: string; content: string }>;
    // Convert to ContextChip format used by the existing chips state
    setContextChips(pins.map((p) => ({ id: p.noteId, label: p.label, content: p.content })));
  }
  document.addEventListener('context-pins-changed', handler);
  return () => document.removeEventListener('context-pins-changed', handler);
}, []);
```

The `ContextChips` component already renders these chips above the textarea with an X to remove them (added in Prompt 06). When a chip is removed from the input bar, dispatch `context-pins-changed` back with the updated array so the panel stays in sync.

---

## Step 5 - Inject Context Pin Content into the API Request

This is already handled in Prompt 06 via the `contextPins` array that is prepended to the message content. No changes needed here. Verify the format injects cleanly:

```
[Note: My Investment Criteria]
Only buy-to-let properties with > 6% gross yield in Greater Manchester.
Target 2-3 bed terraces. Budget GBP 180k max.

[/Note]
```

Each pinned note is wrapped in `[Note: {title}]` ... `[/Note]` blocks prepended to the user's typed message. The agent receives them as additional context in the first user turn.

---

## Verification

After this prompt:
1. Clicking "Notes" in the sidebar opens the Notes panel
2. Empty state shows with "New note" button
3. Creating a note with title and markdown content saves it to the list
4. The note list groups pinned notes at the top
5. Clicking a note opens the edit view with existing title and content
6. Ctrl+S in the edit textarea saves without clicking the button
7. Archive/unarchive toggles the note's state
8. Pin/unpin moves notes to the pinned group
9. "Show archived" toggle shows archived notes in a separate group
10. Search filters notes by content in real time (250ms debounce)
11. When inside a chat session (`/chat/[sessionId]`), each note row shows an arrow icon on hover
12. Clicking the arrow pins the note as a context chip in the input bar
13. The chip appears above the textarea in `ChatInputBar`
14. Clicking X on the chip removes it from both the input bar and reflects in the Notes panel
15. Sending a message with context chips prepends the note content to the message
16. Notes persist across page reloads
17. TypeScript builds without errors
