# Prompt 07 - Ctrl+K Command Palette / Global Search

## Objective

Implement a Ctrl+K command palette that searches across all chat sessions and provides quick navigation. This is a standard power-user feature that Odysseus has. It removes friction from switching between conversations and executing common actions.

---

## Context

Working directory: `/opt/lampp/htdocs/verlox/carina/app.carinaai.uk`

Prerequisites: Prompts 00-06 complete. The sidebar already dispatches `open-search` custom event when the search button is clicked or Ctrl+K is pressed. This prompt builds the search component that listens for that event.

---

## Step 1 - Create Search API Route

Create `src/app/api/search/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { db } from '@/db';
import { chatSessions, chatMessages } from '@/db/schema';
import { eq, and, ilike, or, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim() ?? '';

  if (!q || q.length < 2) {
    // Return recent sessions when no query
    const recent = await db
      .select({ id: chatSessions.id, title: chatSessions.title, lastMessageAt: chatSessions.lastMessageAt })
      .from(chatSessions)
      .where(and(eq(chatSessions.workspaceId, workspace.id), eq(chatSessions.archived, false)))
      .orderBy(desc(chatSessions.lastMessageAt))
      .limit(10);
    return NextResponse.json({ data: { sessions: recent, messages: [] } });
  }

  const [sessions, messages] = await Promise.all([
    db
      .select({ id: chatSessions.id, title: chatSessions.title, lastMessageAt: chatSessions.lastMessageAt })
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.workspaceId, workspace.id),
          eq(chatSessions.archived, false),
          ilike(chatSessions.title, `%${q}%`),
        ),
      )
      .orderBy(desc(chatSessions.lastMessageAt))
      .limit(5),
    db
      .select({
        id: chatMessages.id,
        sessionId: chatMessages.sessionId,
        content: chatMessages.content,
        role: chatMessages.role,
        createdAt: chatMessages.createdAt,
      })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.workspaceId, workspace.id),
          ilike(chatMessages.content, `%${q}%`),
        ),
      )
      .orderBy(desc(chatMessages.createdAt))
      .limit(8),
  ]);

  return NextResponse.json({ data: { sessions, messages } });
}
```

---

## Step 2 - Create CommandPalette Component

Create `src/components/shell/CommandPalette.tsx`:

```tsx
'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, MessageSquare, Plus, Settings, CreditCard, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SessionResult {
  id: string;
  title: string;
  lastMessageAt: string | null;
}

interface MessageResult {
  id: string;
  sessionId: string;
  content: string;
  role: string;
  createdAt: string;
}

type ActionItem = {
  type: 'action';
  id: string;
  label: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
};

type SessionItem = {
  type: 'session';
  id: string;
  title: string;
};

type MessageItem = {
  type: 'message';
  id: string;
  sessionId: string;
  content: string;
  role: string;
};

type ResultItem = ActionItem | SessionItem | MessageItem;

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-accent-dim text-accent rounded-sm not-italic">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function truncateAround(text: string, query: string, ctx = 60): string {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, ctx * 2);
  const start = Math.max(0, idx - ctx);
  const end = Math.min(text.length, idx + query.length + ctx);
  return (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ sessions: SessionResult[]; messages: MessageResult[] }>({ sessions: [], messages: [] });
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setCursor(0);
  }, []);

  // Open on Ctrl+K or custom event
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') close();
    }
    function onEvent() { setOpen(true); }
    document.addEventListener('keydown', onKey);
    document.addEventListener('open-search', onEvent);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('open-search', onEvent);
    };
  }, [close]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d) => { if (d.data) setResults(d.data); })
        .catch(() => {});
    }, 150);
    return () => clearTimeout(t);
  }, [query]);

  const staticActions: ActionItem[] = [
    {
      type: 'action',
      id: 'new-chat',
      label: 'New chat',
      shortcut: 'Ctrl+Alt+N',
      icon: <Plus className="h-4 w-4" />,
      action: async () => {
        close();
        const res = await fetch('/api/sessions', { method: 'POST' });
        const d = await res.json();
        if (d.data?.id) router.push(`/chat/${d.data.id}`);
      },
    },
    {
      type: 'action',
      id: 'settings',
      label: 'Open settings',
      icon: <Settings className="h-4 w-4" />,
      action: () => { close(); router.push('/settings'); },
    },
    {
      type: 'action',
      id: 'billing',
      label: 'Billing and plan',
      icon: <CreditCard className="h-4 w-4" />,
      action: () => { close(); router.push('/billing'); },
    },
    {
      type: 'action',
      id: 'memory',
      label: 'Open memory panel',
      icon: <span className="h-4 w-4 text-center text-xs">M</span>,
      action: () => { close(); document.dispatchEvent(new CustomEvent('open-panel', { detail: 'memory' })); },
    },
  ];

  const allItems: ResultItem[] = [
    ...(query.length < 2 ? staticActions : []),
    ...results.sessions.map((s): SessionItem => ({ type: 'session', id: s.id, title: s.title })),
    ...results.messages.map((m): MessageItem => ({ type: 'message', id: m.id, sessionId: m.sessionId, content: m.content, role: m.role })),
  ];

  function navigate(item: ResultItem) {
    if (item.type === 'action') item.action();
    else if (item.type === 'session') { router.push(`/chat/${item.id}`); close(); }
    else if (item.type === 'message') { router.push(`/chat/${item.sessionId}`); close(); }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, allItems.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    if (e.key === 'Enter' && allItems[cursor]) { navigate(allItems[cursor]); }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60">
      <div
        className="w-full max-w-xl rounded-xl border border-border bg-surface shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-text-muted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
            onKeyDown={onKeyDown}
            placeholder="Search sessions, messages, or run an action..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          <button onClick={close} className="text-text-muted hover:text-text-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {allItems.length === 0 && (
            <p className="py-8 text-center text-sm text-text-muted">No results</p>
          )}

          {/* Static actions (when no query) */}
          {query.length < 2 && staticActions.length > 0 && (
            <div>
              <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Actions</p>
              {staticActions.map((item, i) => (
                <button
                  key={item.id}
                  onClick={() => navigate(item)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                    cursor === i ? 'bg-elevated text-text-primary' : 'text-text-secondary hover:bg-elevated',
                  )}
                >
                  <span className="text-text-muted">{item.icon}</span>
                  {item.label}
                  {item.shortcut && <span className="ml-auto text-[10px] text-text-muted">{item.shortcut}</span>}
                </button>
              ))}
            </div>
          )}

          {/* Session results */}
          {results.sessions.length > 0 && (
            <div>
              <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Sessions</p>
              {results.sessions.map((s, i) => {
                const idx = (query.length < 2 ? staticActions.length : 0) + i;
                return (
                  <button
                    key={s.id}
                    onClick={() => navigate({ type: 'session', id: s.id, title: s.title })}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                      cursor === idx ? 'bg-elevated text-text-primary' : 'text-text-secondary hover:bg-elevated',
                    )}
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-text-muted shrink-0" />
                    <span className="flex-1 truncate">{highlight(s.title, query)}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Message results */}
          {results.messages.length > 0 && (
            <div>
              <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Messages</p>
              {results.messages.map((m, i) => {
                const idx = (query.length < 2 ? staticActions.length : 0) + results.sessions.length + i;
                const preview = truncateAround(m.content, query);
                return (
                  <button
                    key={m.id}
                    onClick={() => navigate({ type: 'message', id: m.id, sessionId: m.sessionId, content: m.content, role: m.role })}
                    className={cn(
                      'flex w-full flex-col gap-0.5 px-4 py-2.5 text-left transition-colors',
                      cursor === idx ? 'bg-elevated' : 'hover:bg-elevated',
                    )}
                  >
                    <span className="text-[10px] text-text-muted capitalize">{m.role}</span>
                    <span className="text-xs text-text-secondary line-clamp-2">{highlight(preview, query)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-2 flex items-center gap-4 text-[10px] text-text-muted">
          <span>Arrow keys to navigate</span>
          <span>Enter to open</span>
          <span>Esc to close</span>
          <span className="ml-auto">Ctrl+K</span>
        </div>
      </div>

      {/* Click backdrop to close */}
      <div className="absolute inset-0 -z-10" onClick={close} />
    </div>
  );
}
```

---

## Step 3 - Mount CommandPalette in Root Layout

Update `src/app/(workspace)/layout.tsx` to include the `CommandPalette`. Since it is a client component, it can be added next to `PanelProvider`:

```tsx
import { CommandPalette } from '@/components/shell/CommandPalette';
import { PanelProvider } from '@/components/shell/PanelProvider';

// Inside the return:
<div className="flex h-screen overflow-hidden bg-base text-text-primary">
  <AppSidebar userEmail={session.user.email} userName={session.user.name ?? ''} />
  <main className="flex flex-1 flex-col min-w-0 overflow-hidden">
    <PanelProvider>
      {children}
    </PanelProvider>
  </main>
  <CommandPalette />
</div>
```

`CommandPalette` renders as `null` when closed, so it has no layout impact.

---

## Step 4 - Global Keyboard Shortcut: Ctrl+/ to Focus Input

Add this to `CommandPalette` (or a separate `KeyboardShortcuts` component) alongside Ctrl+K:

```ts
if (e.key === '/') {
  // Focus the textarea in the current chat if available
  const textarea = document.querySelector<HTMLTextAreaElement>('textarea[placeholder*="Message"]');
  if (textarea && document.activeElement !== textarea) {
    e.preventDefault();
    textarea.focus();
  }
}
```

---

## Verification

After this prompt:
1. Pressing Ctrl+K anywhere in the app opens the command palette
2. Without a query, it shows: New chat, Open settings, Billing and plan, Open memory panel
3. Typing searches session titles and message content simultaneously
4. Results highlight the matching query term in accent green
5. Arrow keys navigate the list (active item highlighted)
6. Enter navigates to the selected session or runs the action
7. Escape closes the palette
8. Clicking outside the palette closes it
9. Ctrl+K again while open closes the palette
10. The sidebar search button also opens the palette
11. Session and message result sections have headers labelling them
12. Footer shows keyboard hints
13. TypeScript builds without errors
