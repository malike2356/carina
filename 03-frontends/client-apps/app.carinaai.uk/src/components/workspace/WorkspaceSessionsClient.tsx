'use client';

import Link from 'next/link';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ConversationList } from '@/components/conversations/ConversationList';
import { ConversationThread } from '@/components/conversations/ConversationThread';

export function WorkspaceSessionsClient() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const showMobileThread = Boolean(selectedId);

  return (
    <div className="mx-auto flex h-[calc(100vh-56px)] max-w-[90rem] flex-col overflow-hidden px-4 py-4 md:px-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-text-muted">Sessions</p>
          <h1 className="mt-2 text-2xl font-semibold text-text-primary">Session browser</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-secondary">
            Hermes-style session access with a split view for browsing and reopening recent threads.
          </p>
        </div>
        <Link
          href="/library"
          className="rounded-md border border-border bg-elevated px-3 py-2 text-xs text-text-secondary hover:text-text-primary"
        >
          Open library
        </Link>
      </div>

      <div className="grid h-full min-h-0 grid-cols-1 overflow-hidden rounded-xl border border-border bg-surface lg:grid-cols-[320px_1fr]">
        <div className={cn(showMobileThread ? 'hidden lg:block' : 'block', 'min-h-0')}>
          <ConversationList selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <div className={cn('flex min-h-0 flex-col', showMobileThread ? 'flex' : 'hidden lg:flex')}>
          {showMobileThread ? (
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="shrink-0 border-b border-border px-4 py-2 text-left text-xs text-text-muted lg:hidden"
            >
              Back to list
            </button>
          ) : null}
          <div className="min-h-0 flex-1">
            <ConversationThread conversationId={selectedId} />
          </div>
        </div>
      </div>
    </div>
  );
}
