'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  MessageSquare,
  Brain,
  Sparkles,
  FileText,
  SearchIcon,
  Clock,
  Settings,
  ChevronLeft,
  ChevronRight,
  Archive,
  Trash2,
  MoreHorizontal,
  Library,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton } from '@/components/ui/IconButton';
import { Tooltip } from '@/components/ui/Tooltip';
import { useAppearance } from '@/hooks/useAppearance';

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
  const userToggled = useRef(false);
  const appearance = useAppearance();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!userToggled.current) setCollapsed(appearance.sidebarCollapsed);
  }, [appearance.sidebarCollapsed]);

  useEffect(() => {
    function handleToggleSidebar() {
      userToggled.current = true;
      setCollapsed((current) => !current);
    }

    document.addEventListener('toggle-sidebar', handleToggleSidebar);
    return () => document.removeEventListener('toggle-sidebar', handleToggleSidebar);
  }, []);

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
          <IconButton
            label="Expand sidebar"
            onClick={() => {
              userToggled.current = true;
              setCollapsed(false);
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </IconButton>
        </Tooltip>
        <Tooltip text="New chat" side="right">
          <IconButton label="New chat" onClick={newChat}>
            <Plus className="h-4 w-4" />
          </IconButton>
        </Tooltip>
        <Tooltip text="Search (Ctrl+K)" side="right">
          <IconButton
            label="Search"
            onClick={() => document.dispatchEvent(new CustomEvent('open-search'))}
          >
            <Search className="h-4 w-4" />
          </IconButton>
        </Tooltip>
        <Tooltip text="Library" side="right">
          <IconButton label="Library" onClick={() => router.push('/library')}>
            <Library className="h-4 w-4" />
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
      <div className="flex items-center justify-between px-3 py-3">
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-text-primary hover:text-accent transition-colors"
        >
          Carina
        </Link>
        <IconButton
          label="Collapse sidebar"
          onClick={() => {
            userToggled.current = true;
            setCollapsed(true);
          }}
        >
          <ChevronLeft className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="px-2 pb-2 flex gap-1">
        <button
          onClick={newChat}
          className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-xs text-text-secondary hover:bg-elevated hover:text-text-primary transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New chat
        </button>
        <IconButton
          label="Search (Ctrl+K)"
          onClick={() => document.dispatchEvent(new CustomEvent('open-search'))}
        >
          <Search className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        <SessionList sessions={sessions} currentPath={pathname} />
      </div>

      <div className="border-t border-border px-2 py-2">
        <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Tools
        </p>
        <ToolLink
          icon={<Brain className="h-3.5 w-3.5" />}
          label="Memory"
          onClick={() =>
            document.dispatchEvent(new CustomEvent('open-panel', { detail: 'memory' }))
          }
        />
        <ToolLink
          icon={<Sparkles className="h-3.5 w-3.5" />}
          label="Skills"
          onClick={() =>
            document.dispatchEvent(new CustomEvent('open-panel', { detail: 'skills' }))
          }
        />
        <ToolLink
          icon={<FileText className="h-3.5 w-3.5" />}
          label="Notes"
          onClick={() =>
            document.dispatchEvent(new CustomEvent('open-panel', { detail: 'notes' }))
          }
        />
        <ToolLink icon={<Library className="h-3.5 w-3.5" />} label="Library" href="/library" />
        <ToolLink icon={<SearchIcon className="h-3.5 w-3.5" />} label="Research" href="/research" />
        <ToolLink icon={<Clock className="h-3.5 w-3.5" />} label="Tasks" href="/tasks" />
      </div>

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
  const todaySessions = sessions.filter(
    (s) => !s.pinned && s.lastMessageAt && new Date(s.lastMessageAt) >= today,
  );
  const yesterdaySessions = sessions.filter(
    (s) =>
      !s.pinned &&
      s.lastMessageAt &&
      new Date(s.lastMessageAt) >= yesterday &&
      new Date(s.lastMessageAt) < today,
  );
  const last7Sessions = sessions.filter(
    (s) =>
      !s.pinned &&
      s.lastMessageAt &&
      new Date(s.lastMessageAt) >= last7 &&
      new Date(s.lastMessageAt) < yesterday,
  );
  const older = sessions.filter(
    (s) => !s.pinned && (!s.lastMessageAt || new Date(s.lastMessageAt) < last7),
  );

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

function SessionGroup({
  label,
  sessions,
  currentPath,
}: {
  label: string;
  sessions: Session[];
  currentPath: string;
}) {
  return (
    <div>
      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </p>
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
    await fetch(`/api/sessions/${session.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ archived: true }),
      headers: { 'Content-Type': 'application/json' },
    });
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
        active
          ? 'bg-elevated text-text-primary'
          : 'text-text-secondary hover:bg-elevated hover:text-text-primary',
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
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-elevated hover:text-text-primary"
              onClick={archive}
            >
              <Archive className="h-3 w-3" /> Archive
            </button>
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-danger hover:bg-elevated"
              onClick={deleteSession}
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolLink({
  icon,
  label,
  onClick,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
}) {
  const className =
    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-text-secondary hover:bg-elevated hover:text-text-primary transition-colors';
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
