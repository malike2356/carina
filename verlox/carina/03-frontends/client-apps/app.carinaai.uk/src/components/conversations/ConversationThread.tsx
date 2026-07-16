'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, MessageSquare } from 'lucide-react';
import { ChannelIcon } from '@/components/aiva/ChannelIcon';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { MessageRow, type ThreadMessage } from '@/components/conversations/MessageRow';

type ThreadConversation = {
  id: string;
  channel: string;
  contactId: string;
  worker: { id: string; name: string };
  messageCount: number;
  startedAt: string | null;
};

type ThreadResponse = {
  conversation?: ThreadConversation;
  messages?: ThreadMessage[];
};

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatStartedAt(iso: string | null): string {
  if (!iso) return 'Unknown date';
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function ConversationThread({ conversationId }: { conversationId: string | null }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [thread, setThread] = useState<ThreadConversation | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!conversationId) {
      setThread(null);
      setMessages([]);
      return;
    }

    setLoading(true);
    void fetch(`/api/conversations/${conversationId}/thread`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load thread');
        return res.json() as Promise<ThreadResponse>;
      })
      .then((data) => {
        setThread(data.conversation ?? null);
        setMessages(data.messages ?? []);
      })
      .catch(() => {
        setThread(null);
        setMessages([]);
      })
      .finally(() => setLoading(false));
  }, [conversationId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, conversationId]);

  if (!conversationId) {
    return (
      <div className="flex flex-1 items-center justify-center bg-base">
        <div className="text-center">
          <MessageSquare className="mx-auto mb-3 h-10 w-10 text-text-muted opacity-40" />
          <p className="text-sm font-medium text-text-primary">Select a conversation</p>
          <p className="mx-auto mt-1 max-w-[200px] text-xs text-text-muted">
            Choose a conversation from the list to view the full thread.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <ListSkeleton rows={6} />
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-text-muted">
        Could not load this conversation.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-base">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <ChannelIcon channel={thread.channel} className="h-5 w-5 text-text-muted" />
          <div>
            <p className="text-sm font-medium text-text-primary">{thread.contactId}</p>
            <p className="text-xs text-text-muted">
              via {thread.worker.name} on {capitalize(thread.channel)}
              {' '}&middot;{' '}
              {formatStartedAt(thread.startedAt)}
            </p>
          </div>
        </div>
        <a
          href={`/api/conversations/${thread.id}/export-pdf`}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:bg-elevated hover:text-text-primary"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </a>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <p className="text-center text-xs text-text-muted">No messages in this thread yet.</p>
        ) : (
          messages.map((msg, index) => (
            <MessageRow
              key={msg.id}
              msg={msg}
              nextMsg={messages[index + 1]}
              workerName={thread.worker.name}
            />
          ))
        )}
      </div>
    </div>
  );
}
