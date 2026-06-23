# Prompt 11 - Session Library Page

## Objective

Build a `/library` page that gives users a full-screen view of all their chat sessions with tabs for active, archived, and pinned chats. This is the conversation management hub: search, preview, bulk archive, bulk delete, and jump directly to any session. Odysseus has a dedicated conversations panel with similar features and Carina currently has no equivalent.

---

## Context

Working directory: `/opt/lampp/htdocs/verlox/carina/app.carinaai.uk`

Prerequisites: Prompts 00-10 complete. `chatSessions` and `chatMessages` tables exist (Prompt 01). The sidebar has a "Library" nav link pointing to `/library` (added in Prompt 02). The session CRUD API routes exist at `/api/sessions` (Prompt 03).

---

## Step 1 - Extend Sessions API for Library

The existing `/api/sessions` GET route returns sessions for the sidebar. Extend it to support library-specific query params.

Update `src/app/api/sessions/route.ts`:

```ts
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);

  const url = new URL(req.url);
  const archived = url.searchParams.get('archived') === '1';
  const pinned   = url.searchParams.get('pinned')   === '1';
  const q        = url.searchParams.get('q')?.trim();
  const page     = Math.max(0, parseInt(url.searchParams.get('page') ?? '0', 10));
  const limit    = 30;

  const conditions = [eq(chatSessions.workspaceId, workspace.id)];
  conditions.push(eq(chatSessions.archived, archived));
  if (pinned) conditions.push(eq(chatSessions.pinned, true));
  if (q) conditions.push(ilike(chatSessions.title, `%${q}%`));

  const rows = await db
    .select({
      id:            chatSessions.id,
      title:         chatSessions.title,
      model:         chatSessions.model,
      pinned:        chatSessions.pinned,
      archived:      chatSessions.archived,
      lastMessageAt: chatSessions.lastMessageAt,
      createdAt:     chatSessions.createdAt,
    })
    .from(chatSessions)
    .where(and(...conditions))
    .orderBy(desc(chatSessions.lastMessageAt))
    .limit(limit)
    .offset(page * limit);

  return NextResponse.json({ data: rows, page, hasMore: rows.length === limit });
}
```

Add a bulk action route. Create `src/app/api/sessions/bulk/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { db } from '@/db';
import { chatSessions } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);

  const body = await req.json() as { ids?: string[]; action?: string };
  const ids = body.ids ?? [];
  if (!ids.length) return NextResponse.json({ error: 'No ids provided' }, { status: 400 });

  // Verify all sessions belong to this workspace
  const owned = await db
    .select({ id: chatSessions.id })
    .from(chatSessions)
    .where(and(inArray(chatSessions.id, ids), eq(chatSessions.workspaceId, workspace.id)));

  const ownedIds = owned.map((r) => r.id);
  if (!ownedIds.length) return NextResponse.json({ data: { affected: 0 } });

  if (body.action === 'archive') {
    await db.update(chatSessions).set({ archived: true }).where(inArray(chatSessions.id, ownedIds));
    return NextResponse.json({ data: { affected: ownedIds.length } });
  }

  if (body.action === 'unarchive') {
    await db.update(chatSessions).set({ archived: false }).where(inArray(chatSessions.id, ownedIds));
    return NextResponse.json({ data: { affected: ownedIds.length } });
  }

  if (body.action === 'delete') {
    await db.delete(chatSessions).where(inArray(chatSessions.id, ownedIds));
    return NextResponse.json({ data: { affected: ownedIds.length } });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
```

---

## Step 2 - Session Message Preview API

When hovering a session in the library, show a preview of the first few messages. Create `src/app/api/sessions/[id]/preview/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { db } from '@/db';
import { chatSessions, chatMessages } from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);

  const [chatSession] = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.id, params.id), eq(chatSessions.workspaceId, workspace.id)))
    .limit(1);

  if (!chatSession) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const messages = await db
    .select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, params.id))
    .orderBy(asc(chatMessages.createdAt))
    .limit(4);

  return NextResponse.json({ data: { session: chatSession, messages } });
}
```

---

## Step 3 - Create the Library Page

Create `src/app/(workspace)/library/page.tsx` as a client component (needs interactivity for tabs, selection, bulk actions):

```tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search, Archive, Trash2, MessageSquare, Pin, RefreshCw,
  CheckSquare, Square, ChevronRight, X, MoreHorizontal, Inbox
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/lib/utils';

interface SessionRow {
  id: string;
  title: string;
  model: string | null;
  pinned: boolean;
  archived: boolean;
  lastMessageAt: string | null;
  createdAt: string;
}

type Tab = 'active' | 'pinned' | 'archived';

function formatDate(d: string | null): string {
  if (!d) return '';
  const dt = new Date(d);
  const now = new Date();
  const diff = now.getTime() - dt.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7)  return dt.toLocaleDateString([], { weekday: 'short' });
  return dt.toLocaleDateString([], { day: 'numeric', month: 'short', year: days > 365 ? 'numeric' : undefined });
}

export default function LibraryPage() {
  const [tab, setTab] = useState<Tab>('active');
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [preview, setPreview] = useState<{ sessionId: string; messages: Array<{ role: string; content: string }> } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const router = useRouter();

  async function load(resetPage = true) {
    setLoading(true);
    const p = resetPage ? 0 : page;
    if (resetPage) setPage(0);

    const q = new URLSearchParams({ page: String(p) });
    if (tab === 'archived') q.set('archived', '1');
    if (tab === 'pinned') q.set('pinned', '1');
    if (search) q.set('q', search);

    const res = await fetch(`/api/sessions?${q}`);
    const d = await res.json();
    if (d.data) {
      setSessions(resetPage ? d.data : (prev) => [...prev, ...d.data]);
      setHasMore(d.hasMore);
    }
    setLoading(false);
    setSelected(new Set());
  }

  useEffect(() => { load(true); }, [tab]);

  useEffect(() => {
    const t = setTimeout(() => load(true), 300);
    return () => clearTimeout(t);
  }, [search]);

  async function loadMore() {
    const next = page + 1;
    setPage(next);
    const q = new URLSearchParams({ page: String(next) });
    if (tab === 'archived') q.set('archived', '1');
    if (tab === 'pinned') q.set('pinned', '1');
    if (search) q.set('q', search);
    const res = await fetch(`/api/sessions?${q}`);
    const d = await res.json();
    if (d.data) {
      setSessions((prev) => [...prev, ...d.data]);
      setHasMore(d.hasMore);
    }
  }

  async function loadPreview(sessionId: string) {
    if (preview?.sessionId === sessionId) { setPreview(null); return; }
    setPreviewLoading(true);
    const res = await fetch(`/api/sessions/${sessionId}/preview`);
    const d = await res.json();
    if (d.data) setPreview({ sessionId, messages: d.data.messages });
    setPreviewLoading(false);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === sessions.length) setSelected(new Set());
    else setSelected(new Set(sessions.map((s) => s.id)));
  }

  async function bulkAction(action: 'archive' | 'unarchive' | 'delete') {
    if (!selected.size) return;
    if (action === 'delete' && !confirm(`Delete ${selected.size} session(s)? This cannot be undone.`)) return;

    await fetch('/api/sessions/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selected), action }),
    });
    await load(true);
  }

  async function singleArchive(id: string, archive: boolean) {
    await fetch(`/api/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: archive }),
    });
    setSessions((prev) => tab === 'active' ? prev.filter((s) => s.id !== id) : prev.map((s) => s.id === id ? { ...s, archived: archive } : s));
  }

  async function singleDelete(id: string) {
    if (!confirm('Delete this session? This cannot be undone.')) return;
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (preview?.sessionId === id) setPreview(null);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'active', label: 'Chats' },
    { id: 'pinned', label: 'Pinned' },
    { id: 'archived', label: 'Archive' },
  ];

  return (
    <div className="flex h-full flex-col bg-base">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold text-text-primary">Library</h1>
        <p className="text-xs text-text-muted mt-0.5">All your conversations in one place</p>
      </div>

      {/* Tabs + search */}
      <div className="flex items-center gap-4 border-b border-border px-6 py-0">
        <div className="flex gap-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'px-4 py-3 text-xs font-medium border-b-2 transition-colors',
                tab === t.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-muted hover:text-text-secondary',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 py-2">
          <div className="flex items-center gap-2 rounded-md border border-border bg-elevated px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-text-muted shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sessions..."
              className="w-52 bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-text-muted hover:text-text-secondary">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 border-b border-border bg-surface px-6 py-2">
          <span className="text-xs text-text-secondary">{selected.size} selected</span>
          {tab !== 'archived' && (
            <button onClick={() => bulkAction('archive')} className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary">
              <Archive className="h-3.5 w-3.5" />
              Archive
            </button>
          )}
          {tab === 'archived' && (
            <button onClick={() => bulkAction('unarchive')} className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary">
              <RefreshCw className="h-3.5 w-3.5" />
              Restore
            </button>
          )}
          <button onClick={() => bulkAction('delete')} className="flex items-center gap-1.5 text-xs text-danger hover:text-red-400">
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-text-muted hover:text-text-secondary">
            Clear
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Session list */}
        <div className="flex w-full flex-col overflow-y-auto lg:w-1/2 xl:w-2/5">
          {/* Select all row */}
          {sessions.length > 0 && (
            <div className="flex items-center gap-3 border-b border-border px-4 py-2">
              <button onClick={selectAll} className="flex items-center gap-1.5 text-[10px] text-text-muted hover:text-text-secondary">
                {selected.size === sessions.length && sessions.length > 0
                  ? <CheckSquare className="h-3.5 w-3.5 text-accent" />
                  : <Square className="h-3.5 w-3.5" />}
                Select all
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : sessions.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={<Inbox className="h-8 w-8" />}
                title={tab === 'archived' ? 'No archived sessions' : tab === 'pinned' ? 'No pinned sessions' : 'No sessions yet'}
                subtitle={tab === 'active' ? 'Start a new chat to see it here.' : ''}
                action={tab === 'active' ? (
                  <button onClick={() => router.push('/chat/new')} className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black hover:bg-accent-hover">
                    New chat
                  </button>
                ) : undefined}
              />
            </div>
          ) : (
            <>
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    'group flex items-start gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-surface cursor-pointer',
                    preview?.sessionId === s.id && 'bg-surface',
                  )}
                  onClick={() => loadPreview(s.id)}
                >
                  {/* Checkbox */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelect(s.id); }}
                    className="mt-0.5 shrink-0 text-text-muted"
                  >
                    {selected.has(s.id)
                      ? <CheckSquare className="h-4 w-4 text-accent" />
                      : <Square className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {s.pinned && <Pin className="h-3 w-3 text-text-muted shrink-0" />}
                      <span className="text-xs font-medium text-text-primary truncate flex-1">{s.title}</span>
                      <span className="text-[10px] text-text-muted shrink-0">{formatDate(s.lastMessageAt)}</span>
                    </div>
                    {s.model && (
                      <span className="mt-1 text-[10px] text-text-muted">{s.model}</span>
                    )}
                  </div>

                  {/* Row actions */}
                  <div className="hidden group-hover:flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Link href={`/chat/${s.id}`} onClick={(e) => e.stopPropagation()}>
                      <IconButton label="Open session" size="sm">
                        <ChevronRight className="h-3.5 w-3.5" />
                      </IconButton>
                    </Link>
                    <IconButton
                      label={s.archived ? 'Restore' : 'Archive'}
                      size="sm"
                      onClick={() => singleArchive(s.id, !s.archived)}
                    >
                      {s.archived ? <RefreshCw className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
                    </IconButton>
                    <IconButton label="Delete" size="sm" onClick={() => singleDelete(s.id)}>
                      <Trash2 className="h-3 w-3 text-danger" />
                    </IconButton>
                  </div>
                </div>
              ))}

              {hasMore && (
                <button
                  onClick={loadMore}
                  className="py-3 text-center text-xs text-text-muted hover:text-text-secondary transition-colors"
                >
                  Load more
                </button>
              )}
            </>
          )}
        </div>

        {/* Preview pane - desktop only */}
        <div className="hidden border-l border-border lg:flex lg:flex-1 flex-col overflow-hidden">
          {!preview ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-xs text-text-muted">Click a session to preview</p>
            </div>
          ) : previewLoading ? (
            <div className="flex h-full items-center justify-center"><Spinner /></div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <p className="text-xs font-medium text-text-primary">
                  {sessions.find((s) => s.id === preview.sessionId)?.title ?? 'Preview'}
                </p>
                <Link href={`/chat/${preview.sessionId}`} className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black hover:bg-accent-hover">
                  Open
                </Link>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {preview.messages.map((m, i) => (
                  <div key={i} className={cn('rounded-lg px-3 py-2 text-xs text-text-primary max-w-[90%]', m.role === 'user' ? 'ml-auto bg-bubble-user' : 'bg-bubble-assistant')}>
                    <p className="mb-1 text-[10px] text-text-muted capitalize">{m.role}</p>
                    <p className="line-clamp-6 leading-relaxed">{m.content}</p>
                  </div>
                ))}
                {preview.messages.length === 0 && (
                  <p className="text-xs text-text-muted">No messages in this session.</p>
                )}
                {preview.messages.length >= 4 && (
                  <p className="text-[10px] text-text-muted text-center">Showing first 4 messages</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Step 4 - Add Library Link to Sidebar

In `src/components/shell/AppSidebar.tsx` (created in Prompt 02), ensure the navigation section includes a Library link:

```tsx
import { Library } from 'lucide-react';

// In the nav links array alongside Settings / Billing:
{ href: '/library', label: 'Library', icon: <Library className="h-4 w-4" /> },
```

This link should appear in the bottom navigation group (below the session list), not in the session list itself.

---

## Verification

After this prompt:
1. `/library` loads and shows a Chats tab, Pinned tab, Archive tab
2. All active sessions appear in the Chats tab ordered by most recent activity
3. Clicking a session row shows a preview panel on the right (desktop)
4. Preview shows up to 4 messages in styled bubbles
5. "Open" button in the preview pane navigates to `/chat/{sessionId}`
6. Search box filters sessions by title with 300ms debounce
7. Selecting sessions shows the bulk action bar (Archive, Delete)
8. "Select all" checks all visible sessions; clicking again deselects all
9. Bulk archive moves sessions to the Archive tab
10. Bulk delete shows a confirm dialog and removes permanently
11. Single row hover reveals Open / Archive / Delete actions
12. The Archive tab shows archived sessions with a "Restore" action
13. Pinned tab shows only pinned sessions
14. "Load more" appears when there are > 30 sessions and loads the next page
15. TypeScript builds without errors
