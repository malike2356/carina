'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, MessageSquare } from 'lucide-react';
import type { ReactNode } from 'react';

interface SessionHeaderProps {
  title: string;
  messageCount: number;
  model: string;
  onRename: (title: string) => void | Promise<void>;
  actions?: ReactNode;
}

export function SessionHeader({ title, messageCount, model, onRename, actions }: SessionHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(title);
  }, [title]);

  function startEdit() {
    setDraft(title);
    setEditing(true);
    window.setTimeout(() => inputRef.current?.select(), 10);
  }

  async function commitEdit() {
    setEditing(false);
    const nextTitle = draft.trim();
    if (nextTitle && nextTitle !== title) {
      await onRename(nextTitle);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') void commitEdit();
    if (e.key === 'Escape') {
      setEditing(false);
      setDraft(title);
    }
  }

  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <MessageSquare className="h-3.5 w-3.5 shrink-0 text-text-muted" />
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => void commitEdit()}
            onKeyDown={onKeyDown}
            className="w-full max-w-xs border-b border-border-focus bg-transparent text-sm font-medium text-text-primary outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={startEdit}
            className="max-w-xs truncate text-sm font-medium text-text-primary transition-colors hover:text-accent"
          >
            {title}
          </button>
        )}
        {messageCount > 0 && (
          <span className="shrink-0 text-[10px] text-text-muted">
            {messageCount} {messageCount === 1 ? 'msg' : 'msgs'}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {model && (
          <div className="flex items-center gap-1 text-[10px] text-text-muted">
            <span>{model}</span>
            <ChevronDown className="h-3 w-3" />
          </div>
        )}
      </div>
    </div>
  );
}
