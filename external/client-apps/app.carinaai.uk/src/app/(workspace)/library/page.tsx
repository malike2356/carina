'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Archive,
  CheckSquare,
  ChevronRight,
  Inbox,
  Pin,
  RefreshCw,
  Search,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Spinner } from '@/components/ui/Spinner';
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

function formatDate(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  const days = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (days === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: days > 365 ? 'numeric' : undefined,
  });
}

export default function LibraryPage() {
  const [tab, setTab] = useState<Tab>('active');
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [preview, setPreview] = useState<{
    sessionId: string;
    messages: Array<{ role: string; content: string }>;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const router = useRouter();

  async function load(resetPage = true) {
    setLoading(true);
    const nextPage = resetPage ? 0 : page;
    if (resetPage) setPage(0);

    const params = new URLSearchParams({ page: String(nextPage) });
    if (tab === 'archived') params.set('archived', '1');
    if (tab === 'pinned') params.set('pinned', '1');
    if (search) params.set('q', search);

    const response = await fetch(`/api/sessions?${params}`);
    const data = await response.json();
    if (data.data) {
      setSessions(resetPage ? data.data : (prev) => [...prev, ...data.data]);
      setHasMore(Boolean(data.hasMore));
    }
    setLoading(false);
    setSelected(new Set());
  }

  useEffect(() => {
    void load(true);
  }, [tab]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load(true);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  async function loadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    const params = new URLSearchParams({ page: String(nextPage) });
    if (tab === 'archived') params.set('archived', '1');
    if (tab === 'pinned') params.set('pinned', '1');
    if (search) params.set('q', search);

    const response = await fetch(`/api/sessions?${params}`);
    const data = await response.json();
    if (data.data) {
      setSessions((prev) => [...prev, ...data.data]);
      setHasMore(Boolean(data.hasMore));
    }
  }

  async function loadPreview(sessionId: string) {
    if (preview?.sessionId === sessionId) {
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    const response = await fetch(`/api/sessions/${sessionId}/preview`);
    const data = await response.json();
    if (data.data) setPreview({ sessionId, messages: data.data.messages });
    setPreviewLoading(false);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === sessions.length) setSelected(new Set());
    else setSelected(new Set(sessions.map((session) => session.id)));
  }

  async function bulkAction(action: 'archive' | 'unarchive' | 'delete') {
    if (selected.size === 0) return;
    if (action === 'delete' && !window.confirm(`Delete ${selected.size} session(s)? This cannot be undone.`)) {
      return;
    }

    await fetch('/api/sessions/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selected), action }),
    });
    await load(true);
  }

  async function singleArchive(id: string, archived: boolean) {
    await fetch(`/api/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived }),
    });
    setSessions((prev) =>
      tab === 'active'
        ? prev.filter((session) => session.id !== id)
        : prev.map((session) => (session.id === id ? { ...session, archived } : session)),
    );
  }

  async function singleDelete(id: string) {
    if (!window.confirm('Delete this session? This cannot be undone.')) return;
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    setSessions((prev) => prev.filter((session) => session.id !== id));
    if (preview?.sessionId === id) setPreview(null);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'active', label: 'Chats' },
    { id: 'pinned', label: 'Pinned' },
    { id: 'archived', label: 'Archive' },
  ];

  return (
    <div className="flex h-full flex-col bg-base">
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold text-text-primary">Library</h1>
        <p className="mt-0.5 text-xs text-text-muted">All your conversations in one place</p>
      </div>

      <div className="flex items-center gap-4 border-b border-border px-6">
        <div className="flex gap-0">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                'border-b-2 px-4 py-3 text-xs font-medium transition-colors',
                tab === item.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-muted hover:text-text-secondary',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 py-2">
          <div className="flex items-center gap-2 rounded-md border border-border bg-elevated px-3 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-text-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search sessions..."
              className="w-52 bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-text-muted hover:text-text-secondary"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 border-b border-border bg-surface px-6 py-2">
          <span className="text-xs text-text-secondary">{selected.size} selected</span>
          {tab !== 'archived' && (
            <button
              type="button"
              onClick={() => void bulkAction('archive')}
              className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary"
            >
              <Archive className="h-3.5 w-3.5" />
              Archive
            </button>
          )}
          {tab === 'archived' && (
            <button
              type="button"
              onClick={() => void bulkAction('unarchive')}
              className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Restore
            </button>
          )}
          <button
            type="button"
            onClick={() => void bulkAction('delete')}
            className="flex items-center gap-1.5 text-xs text-danger hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-text-muted hover:text-text-secondary"
          >
            Clear
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-full flex-col overflow-y-auto lg:w-1/2 xl:w-2/5">
          {sessions.length > 0 && (
            <div className="flex items-center gap-3 border-b border-border px-4 py-2">
              <button
                type="button"
                onClick={selectAll}
                className="flex items-center gap-1.5 text-[10px] text-text-muted hover:text-text-secondary"
              >
                {selected.size === sessions.length && sessions.length > 0 ? (
                  <CheckSquare className="h-3.5 w-3.5 text-accent" />
                ) : (
                  <Square className="h-3.5 w-3.5" />
                )}
                Select all
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={<Inbox className="h-8 w-8" />}
                title={
                  tab === 'archived'
                    ? 'No archived sessions'
                    : tab === 'pinned'
                      ? 'No pinned sessions'
                      : 'No sessions yet'
                }
                subtitle={tab === 'active' ? 'Start a new chat to see it here.' : ''}
                action={
                  tab === 'active' ? (
                    <button
                      type="button"
                      onClick={() => router.push('/api/sessions/new-redirect')}
                      className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black hover:bg-accent-hover"
                    >
                      New chat
                    </button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    'group flex cursor-pointer items-start gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-surface',
                    preview?.sessionId === session.id && 'bg-surface',
                  )}
                  onClick={() => void loadPreview(session.id)}
                >
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleSelect(session.id);
                    }}
                    className="mt-0.5 shrink-0 text-text-muted"
                  >
                    {selected.has(session.id) ? (
                      <CheckSquare className="h-4 w-4 text-accent" />
                    ) : (
                      <Square className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {session.pinned && <Pin className="h-3 w-3 shrink-0 text-text-muted" />}
                      <span className="flex-1 truncate text-xs font-medium text-text-primary">{session.title}</span>
                      <span className="shrink-0 text-[10px] text-text-muted">
                        {formatDate(session.lastMessageAt)}
                      </span>
                    </div>
                    {session.model && (
                      <span className="mt-1 text-[10px] text-text-muted">{session.model}</span>
                    )}
                  </div>

                  <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex" onClick={(event) => event.stopPropagation()}>
                    <Link href={`/chat/${session.id}`} onClick={(event) => event.stopPropagation()}>
                      <IconButton label="Open session" size="sm">
                        <ChevronRight className="h-3.5 w-3.5" />
                      </IconButton>
                    </Link>
                    <IconButton
                      label={session.archived ? 'Restore' : 'Archive'}
                      size="sm"
                      onClick={() => void singleArchive(session.id, !session.archived)}
                    >
                      {session.archived ? <RefreshCw className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
                    </IconButton>
                    <IconButton label="Delete" size="sm" onClick={() => void singleDelete(session.id)}>
                      <Trash2 className="h-3 w-3 text-danger" />
                    </IconButton>
                  </div>
                </div>
              ))}

              {hasMore && (
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  className="py-3 text-center text-xs text-text-muted transition-colors hover:text-text-secondary"
                >
                  Load more
                </button>
              )}
            </>
          )}
        </div>

        <div className="hidden flex-col overflow-hidden border-l border-border lg:flex lg:flex-1">
          {!preview ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-xs text-text-muted">Click a session to preview</p>
            </div>
          ) : previewLoading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <p className="text-xs font-medium text-text-primary">
                  {sessions.find((session) => session.id === preview.sessionId)?.title ?? 'Preview'}
                </p>
                <Link
                  href={`/chat/${preview.sessionId}`}
                  className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black hover:bg-accent-hover"
                >
                  Open
                </Link>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {preview.messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={cn(
                      'max-w-[90%] rounded-lg px-3 py-2 text-xs text-text-primary',
                      message.role === 'user' ? 'ml-auto bg-bubble-user' : 'bg-bubble-assistant',
                    )}
                  >
                    <p className="mb-1 text-[10px] capitalize text-text-muted">{message.role}</p>
                    <p className="line-clamp-6 leading-relaxed">{message.content}</p>
                  </div>
                ))}
                {preview.messages.length === 0 && (
                  <p className="text-xs text-text-muted">No messages in this session.</p>
                )}
                {preview.messages.length >= 4 && (
                  <p className="text-center text-[10px] text-text-muted">Showing first 4 messages</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
