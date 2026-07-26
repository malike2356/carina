'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Menu, MessageSquare, MoreHorizontal, Pencil, Plus, Trash2, X } from 'lucide-react';
import { ConversationalChannelSetupCard } from '@/components/aiva/ConversationalChannelSetupCard';
import { AivaWorkerChatPanel } from '@/components/aiva/AivaWorkerChatPanel';
import {
  detectConversationalChannelSetup,
  type ConversationalChannelSetup,
} from '@/lib/conversational-channel-setup';
import type { AivaConversation, AivaEmployeeMessage, AivaWorker } from '@/lib/aiva-types';
import { cn } from '@/lib/utils';

export function AivaWorkerDirectChat({ worker }: { worker: AivaWorker }) {
  const [conversations, setConversations] = useState<AivaConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<AivaConversation | null>(null);
  const [messages, setMessages] = useState<AivaEmployeeMessage[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [channelSetup, setChannelSetup] = useState<ConversationalChannelSetup | null>(null);
  const [setupNotice, setSetupNotice] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const loadConversations = useCallback(async (preferredId?: string) => {
    const res = await fetch(`/api/aiva/workers/${worker.id}/direct-conversations`);
    const data = (await res.json()) as { conversations?: AivaConversation[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? 'Could not load conversations');
    const next = data.conversations ?? [];
    setConversations(next);
    setActiveConversation((current) => (
      next.find((item) => item.id === (preferredId ?? current?.id))
      ?? next[0]
      ?? null
    ));
    return next;
  }, [worker.id]);

  const createConversation = useCallback(async () => {
    setError('');
    const res = await fetch(`/api/aiva/workers/${worker.id}/direct-conversations`, {
      method: 'POST',
    });
    const data = (await res.json()) as { conversation?: AivaConversation; error?: string };
    if (!res.ok || !data.conversation) {
      setError(data.error ?? 'Could not start a new chat');
      return;
    }
    setConversations((current) => [data.conversation!, ...current]);
    setActiveConversation(data.conversation);
    setMessages([]);
    setMessage('');
    setChannelSetup(null);
    setSetupNotice('');
    setSidebarOpen(false);
  }, [worker.id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadConversations()
      .then(async (items) => {
        if (!cancelled && items.length === 0) await createConversation();
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load conversations');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [createConversation, loadConversations]);

  const loadThread = useCallback(async (conversation: AivaConversation) => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ limit: '100', contactId: conversation.contactId });
      const res = await fetch(`/api/aiva/workers/${worker.id}/direct-thread?${query}`);
      const data = (await res.json()) as { messages?: AivaEmployeeMessage[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Could not load chat');
      setMessages(data.messages ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load chat');
    } finally {
      setLoading(false);
    }
  }, [worker.id]);

  useEffect(() => {
    if (activeConversation) void loadThread(activeConversation);
  }, [activeConversation?.id, loadThread]);

  async function send() {
    const content = message.trim();
    if (!content || busy || !activeConversation) return;

    const detectedSetup = detectConversationalChannelSetup(content);
    if (detectedSetup) {
      setError('');
      setSetupNotice('');
      setMessage('');
      setChannelSetup(detectedSetup);
      return;
    }

    setBusy(true);
    setError('');
    setSetupNotice('');
    setMessage('');
    try {
      const res = await fetch(`/api/aiva/workers/${worker.id}/direct-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, contactId: activeConversation.contactId }),
      });
      const data = (await res.json()) as {
        error?: string;
        userMessage?: AivaEmployeeMessage;
        employeeMessage?: AivaEmployeeMessage;
      };
      if (!res.ok) throw new Error(data.error ?? 'Could not send message');
      setMessages((current) => [
        ...current,
        ...(data.userMessage ? [data.userMessage] : []),
        ...(data.employeeMessage ? [data.employeeMessage] : []),
      ]);
      await loadConversations(activeConversation.id);
    } catch (err) {
      setMessage(content);
      setError(err instanceof Error ? err.message : 'Could not send message');
    } finally {
      setBusy(false);
    }
  }

  async function saveTitle(conversation: AivaConversation) {
    const title = editingTitle.trim();
    if (!title) return;
    const res = await fetch(
      `/api/aiva/workers/${worker.id}/direct-conversations/${conversation.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      },
    );
    const data = (await res.json()) as { conversation?: AivaConversation; error?: string };
    if (!res.ok) {
      setError(data.error ?? 'Could not rename chat');
      return;
    }
    setEditingId(null);
    setMenuId(null);
    await loadConversations(conversation.id);
  }

  async function deleteConversation(conversation: AivaConversation) {
    if (!window.confirm(`Delete "${conversation.title}" and all its messages?`)) return;
    const res = await fetch(
      `/api/aiva/workers/${worker.id}/direct-conversations/${conversation.id}`,
      { method: 'DELETE' },
    );
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? 'Could not delete chat');
      return;
    }
    setMenuId(null);
    const remaining = conversations.filter((item) => item.id !== conversation.id);
    setConversations(remaining);
    if (activeConversation?.id === conversation.id) {
      if (remaining[0]) {
        setActiveConversation(remaining[0]);
      } else {
        await createConversation();
      }
    }
  }

  function selectConversation(conversation: AivaConversation) {
    if (busy || conversation.id === activeConversation?.id) return;
    setActiveConversation(conversation);
    setMessage('');
    setChannelSetup(null);
    setSetupNotice('');
    setSidebarOpen(false);
    setMenuId(null);
  }

  const conversationList = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/70 px-3 py-3">
        <p className="text-sm font-semibold text-text-primary">Chats</p>
        <button
          type="button"
          onClick={() => void createConversation()}
          disabled={busy}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
          aria-label="Start new chat"
          title="New chat"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {conversations.map((conversation) => (
          <div
            key={conversation.id}
            className={cn(
              'group relative rounded-xl transition-colors',
              activeConversation?.id === conversation.id
                ? 'bg-accent/10 text-text-primary'
                : 'text-text-secondary hover:bg-elevated',
            )}
          >
            {editingId === conversation.id ? (
              <form
                className="flex items-center gap-1 p-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveTitle(conversation);
                }}
              >
                <input
                  autoFocus
                  value={editingTitle}
                  onChange={(event) => setEditingTitle(event.target.value)}
                  maxLength={80}
                  className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-text-primary outline-none focus:border-accent"
                  aria-label="Conversation title"
                />
                <button type="submit" className="p-1 text-accent" aria-label="Save title">
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => setEditingId(null)} className="p-1" aria-label="Cancel">
                  <X className="h-3.5 w-3.5" />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => selectConversation(conversation)}
                className="flex w-full items-start gap-2.5 px-3 py-2.5 pr-9 text-left"
              >
                <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{conversation.title}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-text-muted">
                    {conversation.lastMessage ?? 'No messages yet'}
                  </span>
                </span>
              </button>
            )}
            {editingId !== conversation.id ? (
              <button
                type="button"
                onClick={() => setMenuId((current) => current === conversation.id ? null : conversation.id)}
                className="absolute right-2 top-2.5 rounded-md p-1 text-text-muted opacity-0 transition-opacity hover:bg-overlay hover:text-text-primary group-hover:opacity-100 focus:opacity-100"
                aria-label={`Options for ${conversation.title}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            ) : null}
            {menuId === conversation.id ? (
              <div className="absolute right-2 top-9 z-20 w-32 rounded-lg border border-border bg-elevated p-1 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(conversation.id);
                    setEditingTitle(conversation.title);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-overlay"
                >
                  <Pencil className="h-3.5 w-3.5" /> Rename
                </button>
                <button
                  type="button"
                  onClick={() => void deleteConversation(conversation)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-danger hover:bg-danger/10"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="relative">
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
      <div className="grid overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl shadow-black/10 md:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="hidden min-h-[min(72vh,680px)] border-r border-border bg-base/60 md:block">
          {conversationList}
        </aside>
        {sidebarOpen ? (
          <div className="absolute inset-0 z-40 rounded-2xl bg-surface md:hidden">
            <div className="absolute right-3 top-3 z-10">
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-elevated"
                aria-label="Close chat history"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {conversationList}
          </div>
        ) : null}
        <AivaWorkerChatPanel
          worker={worker}
          messages={messages}
          message={message}
          onMessageChange={setMessage}
          onSend={() => void send()}
          busy={busy || loading}
          composerDisabled={Boolean(channelSetup) || !activeConversation}
          className="min-w-0 rounded-none border-0 shadow-none"
          headerAction={
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:bg-elevated md:hidden"
                aria-label="Open chat history"
              >
                <Menu className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void createConversation()}
                disabled={busy}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-elevated px-2.5 text-xs font-medium text-text-primary transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">New chat</span>
              </button>
            </div>
          }
          conversationAddon={
            channelSetup ? (
              <ConversationalChannelSetupCard
                workerId={worker.id}
                setup={channelSetup}
                onCancel={() => {
                  setChannelSetup(null);
                  setSetupNotice('Setup cancelled. You can ask again whenever you are ready.');
                }}
                onComplete={(notice) => {
                  setChannelSetup(null);
                  setSetupNotice(notice);
                  if (activeConversation) void loadThread(activeConversation);
                }}
              />
            ) : setupNotice ? (
              <div className="mr-auto max-w-[min(92%,30rem)] rounded-lg rounded-bl-sm border border-border bg-elevated px-3 py-2 text-sm text-text-primary">
                {setupNotice}
              </div>
            ) : null
          }
        />
      </div>
    </div>
  );
}
