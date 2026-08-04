'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ConversationList } from '@/components/conversations/ConversationList';
import { ConversationThread } from '@/components/conversations/ConversationThread';
import { cn } from '@/lib/utils';

export default function ConversationsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const showMobileThread = Boolean(selectedId);

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col overflow-hidden">
      <div className="grid h-full grid-cols-1 overflow-hidden lg:grid-cols-[320px_1fr]">
        <div className={cn(showMobileThread ? 'hidden lg:block' : 'block')}>
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
      <p className="border-t border-border px-4 py-2 text-xs text-text-muted lg:hidden">
        Per-Aiva detail:{' '}
        <Link href="/aiva/workers" className="text-accent hover:underline">
          Your Aivas
        </Link>
      </p>
    </div>
  );
}
