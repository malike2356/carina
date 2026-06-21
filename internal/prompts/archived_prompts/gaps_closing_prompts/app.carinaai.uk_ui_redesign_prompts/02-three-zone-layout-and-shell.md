# Prompt 02 - Three-Zone Layout and App Shell

## Objective

Replace the current workspace layout (`src/app/(workspace)/layout.tsx`) with a proper three-zone application shell. Create all shared UI primitives listed in Prompt 00. Switch the entire app from light (slate-50/white) to the dark design system defined in Prompt 00.

---

## Context

Working directory: `/opt/lampp/htdocs/verlox/carina/app.carinaai.uk`

Current workspace layout is a simple max-w-7xl centered column with a white sidebar. It is not suitable for a chat-first application. We replace it with a full-viewport three-zone shell:

```
[LEFT SIDEBAR 220px] | [MAIN CONTENT, flex-1] | [RIGHT PANEL - conditional, mounted by panels]
```

The left sidebar is the primary navigation and session list. The main content is either the chat view or an admin/settings page. Right panels float as overlays, not a permanent third column.

---

## Step 1 - Update globals.css

Open `src/app/globals.css` and:

1. Add all CSS custom properties from Prompt 00 inside `:root { ... }`.
2. Add the scrollbar styling from Prompt 00.
3. Add body background:
   ```css
   body {
     background-color: var(--bg-base);
     color: var(--text-primary);
   }
   ```
4. Remove any existing slate/white background references on `body` or `html`.

---

## Step 2 - Update tailwind.config.ts

Extend the Tailwind config with the colour tokens from Prompt 00. The full `colors` extension replaces slate-based colours for the app theme. Do not remove existing colours - just extend:

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base:     'var(--bg-base)',
        surface:  'var(--bg-surface)',
        elevated: 'var(--bg-elevated)',
        overlay:  'var(--bg-overlay)',
        border: {
          DEFAULT: 'var(--border-subtle)',
          focus:   'var(--border-focus)',
          muted:   'var(--border-muted)',
        },
        text: {
          primary:   'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted:     'var(--text-muted)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          dim:     'var(--accent-dim)',
          hover:   'var(--accent-hover)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          dim:     'var(--danger-dim)',
        },
        bubble: {
          user:      'var(--bubble-user)',
          assistant: 'var(--bubble-assistant)',
        },
        code: {
          bg:   'var(--code-bg)',
          text: 'var(--code-text)',
        },
      },
    },
  },
  plugins: [],
};
export default config;
```

---

## Step 3 - Create Shared UI Primitives

### src/components/ui/IconButton.tsx

```tsx
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string; // required for accessibility
  size?: 'sm' | 'md';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, size = 'md', className, children, ...props }, ref) => {
    const sz = size === 'sm' ? 'p-1 rounded' : 'p-1.5 rounded-md';
    return (
      <button
        ref={ref}
        aria-label={label}
        title={label}
        className={cn(
          sz,
          'text-text-muted hover:text-text-secondary hover:bg-elevated transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
IconButton.displayName = 'IconButton';
```

### src/components/ui/Tooltip.tsx

Simple hover tooltip using CSS, no external dependency:

```tsx
'use client';
import { ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';

export function Tooltip({ text, children, side = 'top' }: {
  text: string;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}) {
  const [visible, setVisible] = useState(false);
  const posClass = {
    top:    '-top-8 left-1/2 -translate-x-1/2',
    bottom: '-bottom-8 left-1/2 -translate-x-1/2',
    left:   'right-full top-1/2 -translate-y-1/2 mr-2',
    right:  'left-full top-1/2 -translate-y-1/2 ml-2',
  }[side];

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          className={cn(
            'absolute z-50 whitespace-nowrap rounded px-2 py-1 text-xs',
            'bg-overlay text-text-primary border border-border pointer-events-none',
            posClass,
          )}
        >
          {text}
        </span>
      )}
    </span>
  );
}
```

### src/components/ui/Kbd.tsx

```tsx
export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center rounded border border-border px-1.5 py-0.5 font-mono text-xs text-text-secondary bg-elevated">
      {children}
    </kbd>
  );
}
```

### src/components/ui/EmptyState.tsx

```tsx
import { ReactNode } from 'react';

export function EmptyState({ icon, title, subtitle, action }: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      {icon && <div className="text-text-muted">{icon}</div>}
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      {subtitle && <p className="max-w-xs text-xs text-text-muted">{subtitle}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
```

### src/components/ui/Badge.tsx

```tsx
import { cn } from '@/lib/utils';

type BadgeVariant = 'active' | 'paused' | 'draft' | 'running' | 'error' | 'default';

const variants: Record<BadgeVariant, string> = {
  active:  'bg-accent-dim text-accent',
  paused:  'bg-elevated text-text-secondary',
  draft:   'bg-elevated text-text-muted',
  running: 'bg-blue-950 text-blue-400',
  error:   'bg-danger-dim text-danger',
  default: 'bg-elevated text-text-secondary',
};

export function Badge({ variant = 'default', children }: {
  variant?: BadgeVariant;
  children: React.ReactNode;
}) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', variants[variant])}>
      {children}
    </span>
  );
}
```

### src/components/ui/Panel.tsx

Floating right-anchored overlay panel - this is the standard container for Memory, Skills, Notes, Tasks, Research panels:

```tsx
'use client';
import { useEffect, ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';
import { cn } from '@/lib/utils';

interface PanelProps {
  title: string;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  className?: string;
}

export function Panel({ title, icon, onClose, children, width = 360, className }: PanelProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <div
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full flex-col bg-surface border-l border-border shadow-2xl',
          'animate-in slide-in-from-right duration-200',
          className,
        )}
        style={{ width }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          {icon && <span className="text-accent">{icon}</span>}
          <h2 className="flex-1 text-sm font-semibold text-text-primary">{title}</h2>
          <IconButton label="Close panel" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </>
  );
}
```

Note: `animate-in slide-in-from-right` requires `tailwindcss-animate`. If not installed, add it:
```bash
pnpm add tailwindcss-animate
```
And add to `tailwind.config.ts` plugins: `require('tailwindcss-animate')`.

### src/components/ui/Spinner.tsx

```tsx
export function Spinner({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  return (
    <span
      className={`inline-block ${sz} animate-spin rounded-full border-2 border-border border-t-accent`}
      aria-label="Loading"
    />
  );
}
```

---

## Step 4 - Replace Workspace Layout

Replace `src/app/(workspace)/layout.tsx` entirely:

```tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { AppSidebar } from '@/components/shell/AppSidebar';

export const dynamic = 'force-dynamic';

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="flex h-screen overflow-hidden bg-base text-text-primary">
      <AppSidebar userEmail={session.user.email} userName={session.user.name ?? ''} />
      <main className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
```

---

## Step 5 - Create AppSidebar Component

Create `src/components/shell/AppSidebar.tsx`. This is the left navigation column. It is a client component because it tracks active path, collapse state, and active panels.

### Sidebar sections:

**Top:**
- Carina wordmark / logo (links to /dashboard)
- New Chat button (+ icon, navigates to /chat with new session)
- Search button (triggers Ctrl+K palette, covered in Prompt 06)

**Sessions:**
- Collapsible list of recent chat sessions, grouped: Pinned / Today / Yesterday / Last 7 days / Older
- Each session: title (truncated), hover reveals rename/archive/delete actions
- "See all" link to /library

**Tools section (header "Tools"):**
- Memory (brain icon) - opens Memory panel
- Skills (sparkles icon) - opens Skills panel
- Notes (file-text icon) - opens Notes panel
- Research (search icon) - navigates to /research
- Tasks (clock icon) - navigates to /tasks

**Bottom:**
- User avatar (initials), name, email
- Settings cog (navigates to /settings)
- Collapse/expand toggle

### Implementation:

```tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Plus, Search, MessageSquare, Brain, Sparkles, FileText,
  SearchIcon, Clock, Settings, ChevronLeft, ChevronRight,
  Pin, Archive, Trash2, MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton } from '@/components/ui/IconButton';
import { Tooltip } from '@/components/ui/Tooltip';

interface Session {
  id: string;
  title: string;
  lastMessageAt: string | null;
  pinned: boolean;
}

interface AppSidebarProps {
  userEmail: string;
  userName: string;
}

export function AppSidebar({ userEmail, userName }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    fetch('/api/sessions')
      .then((r) => r.json())
      .then((data) => {
        if (data.data) setSessions(data.data);
      })
      .catch(() => {});
  }, [pathname]);

  async function newChat() {
    const res = await fetch('/api/sessions', { method: 'POST' });
    const data = await res.json();
    if (data.data?.id) router.push(`/chat/${data.data.id}`);
  }

  const initials = (userName || userEmail).slice(0, 2).toUpperCase();

  if (collapsed) {
    return (
      <aside className="flex w-12 flex-col items-center gap-3 border-r border-border bg-surface py-3">
        <Tooltip text="Expand sidebar" side="right">
          <IconButton label="Expand sidebar" onClick={() => setCollapsed(false)}>
            <ChevronRight className="h-4 w-4" />
          </IconButton>
        </Tooltip>
        <Tooltip text="New chat" side="right">
          <IconButton label="New chat" onClick={newChat}>
            <Plus className="h-4 w-4" />
          </IconButton>
        </Tooltip>
        <Tooltip text="Search (Ctrl+K)" side="right">
          <IconButton label="Search" onClick={() => document.dispatchEvent(new CustomEvent('open-search'))}>
            <Search className="h-4 w-4" />
          </IconButton>
        </Tooltip>
        <div className="flex-1" />
        <Tooltip text="Settings" side="right">
          <IconButton label="Settings" onClick={() => router.push('/settings')}>
            <Settings className="h-4 w-4" />
          </IconButton>
        </Tooltip>
        <Tooltip text={userEmail} side="right">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-dim text-accent text-xs font-medium">
            {initials}
          </div>
        </Tooltip>
      </aside>
    );
  }

  return (
    <aside className="flex w-56 flex-col border-r border-border bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3">
        <Link href="/dashboard" className="text-sm font-semibold text-text-primary hover:text-accent transition-colors">
          Carina
        </Link>
        <IconButton label="Collapse sidebar" onClick={() => setCollapsed(true)}>
          <ChevronLeft className="h-4 w-4" />
        </IconButton>
      </div>

      {/* Actions */}
      <div className="px-2 pb-2 flex gap-1">
        <button
          onClick={newChat}
          className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-xs text-text-secondary hover:bg-elevated hover:text-text-primary transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New chat
        </button>
        <IconButton label="Search (Ctrl+K)" onClick={() => document.dispatchEvent(new CustomEvent('open-search'))}>
          <Search className="h-4 w-4" />
        </IconButton>
      </div>

      {/* Sessions */}
      <div className="flex-1 overflow-y-auto px-2">
        <SessionList sessions={sessions} currentPath={pathname} />
      </div>

      {/* Tools */}
      <div className="border-t border-border px-2 py-2">
        <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Tools</p>
        <ToolLink icon={<Brain className="h-3.5 w-3.5" />} label="Memory" onClick={() => document.dispatchEvent(new CustomEvent('open-panel', { detail: 'memory' }))} />
        <ToolLink icon={<Sparkles className="h-3.5 w-3.5" />} label="Skills" onClick={() => document.dispatchEvent(new CustomEvent('open-panel', { detail: 'skills' }))} />
        <ToolLink icon={<FileText className="h-3.5 w-3.5" />} label="Notes" onClick={() => document.dispatchEvent(new CustomEvent('open-panel', { detail: 'notes' }))} />
        <ToolLink icon={<SearchIcon className="h-3.5 w-3.5" />} label="Research" href="/research" />
        <ToolLink icon={<Clock className="h-3.5 w-3.5" />} label="Tasks" href="/tasks" />
      </div>

      {/* User */}
      <div className="border-t border-border px-3 py-3 flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-dim text-accent text-xs font-medium">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-xs font-medium text-text-primary">{userName || userEmail}</p>
          <p className="truncate text-[10px] text-text-muted">{userEmail}</p>
        </div>
        <IconButton label="Settings" onClick={() => router.push('/settings')}>
          <Settings className="h-3.5 w-3.5" />
        </IconButton>
      </div>
    </aside>
  );
}

function SessionList({ sessions, currentPath }: { sessions: Session[]; currentPath: string }) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const last7 = new Date(today.getTime() - 7 * 86400000);

  const pinned = sessions.filter((s) => s.pinned);
  const todaySessions = sessions.filter((s) => !s.pinned && s.lastMessageAt && new Date(s.lastMessageAt) >= today);
  const yesterdaySessions = sessions.filter((s) => !s.pinned && s.lastMessageAt && new Date(s.lastMessageAt) >= yesterday && new Date(s.lastMessageAt) < today);
  const last7Sessions = sessions.filter((s) => !s.pinned && s.lastMessageAt && new Date(s.lastMessageAt) >= last7 && new Date(s.lastMessageAt) < yesterday);
  const older = sessions.filter((s) => !s.pinned && (!s.lastMessageAt || new Date(s.lastMessageAt) < last7));

  return (
    <div className="space-y-1 py-1">
      {pinned.length > 0 && (
        <SessionGroup label="Pinned" sessions={pinned} currentPath={currentPath} />
      )}
      {todaySessions.length > 0 && (
        <SessionGroup label="Today" sessions={todaySessions} currentPath={currentPath} />
      )}
      {yesterdaySessions.length > 0 && (
        <SessionGroup label="Yesterday" sessions={yesterdaySessions} currentPath={currentPath} />
      )}
      {last7Sessions.length > 0 && (
        <SessionGroup label="Last 7 days" sessions={last7Sessions} currentPath={currentPath} />
      )}
      {older.length > 0 && (
        <SessionGroup label="Older" sessions={older} currentPath={currentPath} />
      )}
      {sessions.length === 0 && (
        <p className="px-2 py-4 text-center text-xs text-text-muted">No chats yet</p>
      )}
    </div>
  );
}

function SessionGroup({ label, sessions, currentPath }: {
  label: string;
  sessions: Session[];
  currentPath: string;
}) {
  return (
    <div>
      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">{label}</p>
      {sessions.map((s) => (
        <SessionItem key={s.id} session={s} active={currentPath === `/chat/${s.id}`} />
      ))}
    </div>
  );
}

function SessionItem({ session, active }: { session: Session; active: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  async function archive() {
    await fetch(`/api/sessions/${session.id}`, { method: 'PATCH', body: JSON.stringify({ archived: true }), headers: { 'Content-Type': 'application/json' } });
    router.refresh();
  }

  async function deleteSession() {
    await fetch(`/api/sessions/${session.id}`, { method: 'DELETE' });
    if (window.location.pathname === `/chat/${session.id}`) router.push('/dashboard');
    else router.refresh();
  }

  return (
    <div
      className={cn(
        'group relative flex items-center gap-1 rounded-md px-2 py-1.5 text-xs transition-colors cursor-pointer',
        active ? 'bg-elevated text-text-primary' : 'text-text-secondary hover:bg-elevated hover:text-text-primary',
      )}
      onClick={() => router.push(`/chat/${session.id}`)}
    >
      <MessageSquare className="h-3 w-3 shrink-0 text-text-muted" />
      <span className="flex-1 truncate">{session.title}</span>
      <div className="hidden group-hover:flex items-center" onClick={(e) => e.stopPropagation()}>
        <IconButton label="Session options" size="sm" onClick={() => setMenuOpen(!menuOpen)}>
          <MoreHorizontal className="h-3 w-3" />
        </IconButton>
        {menuOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-md border border-border bg-overlay shadow-lg">
            <button className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-elevated hover:text-text-primary" onClick={archive}>
              <Archive className="h-3 w-3" /> Archive
            </button>
            <button className="flex w-full items-center gap-2 px-3 py-2 text-xs text-danger hover:bg-elevated" onClick={deleteSession}>
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolLink({ icon, label, onClick, href }: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
}) {
  const className = 'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-text-secondary hover:bg-elevated hover:text-text-primary transition-colors';
  if (href) {
    return (
      <Link href={href} className={className}>
        {icon} {label}
      </Link>
    );
  }
  return (
    <button className={className} onClick={onClick}>
      {icon} {label}
    </button>
  );
}
```

---

## Step 6 - API Route for Sessions List

Create `src/app/api/sessions/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { listSessions, getOrCreateSession } from '@/lib/chat-sessions';
import { db } from '@/db';
import { chatSessions } from '@/db/schema';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);
  const sessions = await listSessions(workspace.id);
  return NextResponse.json({ data: sessions });
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);
  const id = await getOrCreateSession(workspace.id, null);
  const [created] = await db.select().from(chatSessions).where(/* eq(chatSessions.id, id) */);
  return NextResponse.json({ data: { id } });
}
```

Import `eq` from drizzle-orm. Fix the where clause to properly filter by the created ID.

Also create `src/app/api/sessions/[id]/route.ts` for PATCH (rename/archive/pin) and DELETE.

---

## Step 7 - Update Root Layout

In `src/app/layout.tsx`, update the body classes to remove any light-theme defaults:

```tsx
<body className="bg-base text-text-primary antialiased">
```

---

## Step 8 - Create Global Panel Context

Create `src/components/shell/PanelProvider.tsx` - a client component that listens for `open-panel` custom events and renders the appropriate panel:

```tsx
'use client';
import { useEffect, useState } from 'react';

type PanelType = 'memory' | 'skills' | 'notes' | null;

export function PanelProvider({ children }: { children: React.ReactNode }) {
  const [activePanel, setActivePanel] = useState<PanelType>(null);

  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent).detail as PanelType;
      setActivePanel((prev) => prev === detail ? null : detail);
    }
    document.addEventListener('open-panel', handler);
    return () => document.removeEventListener('open-panel', handler);
  }, []);

  return (
    <>
      {children}
      {/* Panels are imported here in Prompts 07 and 08 */}
      {/* {activePanel === 'memory' && <MemoryPanel onClose={() => setActivePanel(null)} />} */}
      {/* {activePanel === 'skills' && <SkillsPanel onClose={() => setActivePanel(null)} />} */}
      {/* {activePanel === 'notes' && <NotesPanel onClose={() => setActivePanel(null)} />} */}
    </>
  );
}
```

Wrap the workspace layout's `<main>` in `<PanelProvider>`.

---

## Verification

After completing this prompt:
1. `pnpm dev` starts without TypeScript errors
2. Navigate to `/dashboard` - it loads with the dark background and the new sidebar visible
3. The sidebar shows "Carina" wordmark, New chat, Search, Tools section, and user info at bottom
4. Collapse the sidebar - it reduces to icon-only mode
5. No white backgrounds anywhere in the workspace layout
6. `globals.css` has all CSS variables defined
7. `tailwind.config.ts` has the colour extensions
