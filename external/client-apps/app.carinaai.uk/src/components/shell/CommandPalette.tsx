'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  CalendarClock,
  CreditCard,
  Database,
  Files,
  MessageSquare,
  Plus,
  Search,
  Server,
  Settings,
  Terminal,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
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
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return text;

  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-sm bg-accent-dim text-accent">
        {text.slice(index, index + query.length)}
      </mark>
      {text.slice(index + query.length)}
    </>
  );
}

function truncateAround(text: string, query: string, contextLength = 60): string {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return text.slice(0, contextLength * 2);

  const start = Math.max(0, index - contextLength);
  const end = Math.min(text.length, index + query.length + contextLength);
  return `${start > 0 ? '...' : ''}${text.slice(start, end)}${end < text.length ? '...' : ''}`;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ sessions: SessionResult[]; messages: MessageResult[] }>({
    sessions: [],
    messages: [],
  });
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setCursor(0);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }

      if ((event.ctrlKey || event.metaKey) && event.key === '/') {
        const textarea = document.querySelector<HTMLTextAreaElement>('textarea[data-chat-input="true"]');
        if (textarea && document.activeElement !== textarea) {
          event.preventDefault();
          textarea.focus();
        }
      }

      if (event.key === 'Escape') close();
    }

    function onEvent() {
      setOpen(true);
    }

    document.addEventListener('keydown', onKey);
    document.addEventListener('open-search', onEvent);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('open-search', onEvent);
    };
  }, [close]);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const timeout = window.setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((response) => response.json())
        .then((data: { data?: { sessions: SessionResult[]; messages: MessageResult[] } }) => {
          if (data.data) setResults(data.data);
        })
        .catch(() => {});
    }, 150);

    return () => window.clearTimeout(timeout);
  }, [open, query]);

  const staticActions: ActionItem[] = [
    {
      type: 'action',
      id: 'new-chat',
      label: 'New chat',
      shortcut: 'Ctrl+Alt+N',
      icon: <Plus className="h-4 w-4" />,
      action: async () => {
        close();
        const response = await fetch('/api/sessions', { method: 'POST' });
        const data = await response.json();
        if (data.data?.id) router.push(`/chat/${data.data.id}`);
      },
    },
    {
      type: 'action',
      id: 'settings',
      label: 'Open settings',
      icon: <Settings className="h-4 w-4" />,
      action: () => {
        close();
        router.push('/settings');
      },
    },
    {
      type: 'action',
      id: 'billing',
      label: 'Billing and plan',
      icon: <CreditCard className="h-4 w-4" />,
      action: () => {
        close();
        router.push('/billing');
      },
    },
    {
      type: 'action',
      id: 'analytics',
      label: 'Open analytics',
      icon: <BarChart3 className="h-4 w-4" />,
      action: () => {
        close();
        router.push('/analytics');
      },
    },
    {
      type: 'action',
      id: 'mcp',
      label: 'Open MCP servers',
      icon: <Server className="h-4 w-4" />,
      action: () => {
        close();
        router.push('/mcp');
      },
    },
    {
      type: 'action',
      id: 'terminal',
      label: 'Open terminal',
      icon: <Terminal className="h-4 w-4" />,
      action: () => {
        close();
        router.push('/terminal');
      },
    },
    {
      type: 'action',
      id: 'files',
      label: 'Open files',
      icon: <Files className="h-4 w-4" />,
      action: () => {
        close();
        router.push('/files');
      },
    },
    {
      type: 'action',
      id: 'env',
      label: 'Open environment',
      icon: <Database className="h-4 w-4" />,
      action: () => {
        close();
        router.push('/env');
      },
    },
    {
      type: 'action',
      id: 'cron',
      label: 'Open cron',
      icon: <CalendarClock className="h-4 w-4" />,
      action: () => {
        close();
        router.push('/cron');
      },
    },
    {
      type: 'action',
      id: 'memory',
      label: 'Open memory panel',
      icon: <span className="h-4 w-4 text-center text-xs">M</span>,
      action: () => {
        close();
        document.dispatchEvent(new CustomEvent('open-panel', { detail: 'memory' }));
      },
    },
  ];

  const allItems: ResultItem[] = [
    ...(query.length < 2 ? staticActions : []),
    ...results.sessions.map((session): SessionItem => ({
      type: 'session',
      id: session.id,
      title: session.title,
    })),
    ...results.messages.map((message): MessageItem => ({
      type: 'message',
      id: message.id,
      sessionId: message.sessionId,
      content: message.content,
      role: message.role,
    })),
  ];

  function navigate(item: ResultItem) {
    if (item.type === 'action') {
      item.action();
      return;
    }

    if (item.type === 'session') {
      router.push(`/chat/${item.id}`);
      close();
      return;
    }

    router.push(`/chat/${item.sessionId}`);
    close();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((current) => Math.min(current + 1, Math.max(allItems.length - 1, 0)));
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((current) => Math.max(current - 1, 0));
    }

    if (event.key === 'Enter' && allItems[cursor]) {
      event.preventDefault();
      navigate(allItems[cursor]);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[15vh]">
      <div className="absolute inset-0" onClick={close} aria-hidden />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search sessions, messages, or run an action..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          <button
            type="button"
            onClick={close}
            className="text-text-muted transition-colors hover:text-text-secondary"
            aria-label="Close command palette"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {allItems.length === 0 && (
            <p className="py-8 text-center text-sm text-text-muted">No results</p>
          )}

          {query.length < 2 && staticActions.length > 0 && (
            <div>
              <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Actions
              </p>
              {staticActions.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                    cursor === index ? 'bg-elevated text-text-primary' : 'text-text-secondary hover:bg-elevated',
                  )}
                >
                  <span className="text-text-muted">{item.icon}</span>
                  {item.label}
                  {item.shortcut && <span className="ml-auto text-[10px] text-text-muted">{item.shortcut}</span>}
                </button>
              ))}
            </div>
          )}

          {results.sessions.length > 0 && (
            <div>
              <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Sessions
              </p>
              {results.sessions.map((session, index) => {
                const itemIndex = (query.length < 2 ? staticActions.length : 0) + index;
                return (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => navigate({ type: 'session', id: session.id, title: session.title })}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                      cursor === itemIndex
                        ? 'bg-elevated text-text-primary'
                        : 'text-text-secondary hover:bg-elevated',
                    )}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                    <span className="flex-1 truncate">{highlight(session.title, query)}</span>
                  </button>
                );
              })}
            </div>
          )}

          {results.messages.length > 0 && (
            <div>
              <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Messages
              </p>
              {results.messages.map((message, index) => {
                const itemIndex =
                  (query.length < 2 ? staticActions.length : 0) + results.sessions.length + index;
                const preview = truncateAround(message.content, query);
                return (
                  <button
                    key={message.id}
                    type="button"
                    onClick={() =>
                      navigate({
                        type: 'message',
                        id: message.id,
                        sessionId: message.sessionId,
                        content: message.content,
                        role: message.role,
                      })
                    }
                    className={cn(
                      'flex w-full flex-col gap-0.5 px-4 py-2.5 text-left transition-colors',
                      cursor === itemIndex ? 'bg-elevated' : 'hover:bg-elevated',
                    )}
                  >
                    <span className="text-[10px] capitalize text-text-muted">{message.role}</span>
                    <span className="line-clamp-2 text-xs text-text-secondary">
                      {highlight(preview, query)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[10px] text-text-muted">
          <span>Arrow keys to navigate</span>
          <span>Enter to open</span>
          <span>Esc to close</span>
          <span className="ml-auto">Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}
