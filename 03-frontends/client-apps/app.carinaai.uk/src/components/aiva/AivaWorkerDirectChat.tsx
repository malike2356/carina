'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Menu, MessageSquare, MoreHorizontal, Pencil, Plus, Trash2, X } from 'lucide-react';
import { ConversationalChannelSetupCard } from '@/components/aiva/ConversationalChannelSetupCard';
import {
  AivaChannelSyncPanel,
  AivaChannelSyncToggle,
} from '@/components/aiva/AivaChannelSyncPanel';
import { AivaWorkerChatPanel } from '@/components/aiva/AivaWorkerChatPanel';
import {
  detectConversationalChannelSetup,
  type ConversationalChannelSetup,
} from '@/lib/conversational-channel-setup';
import type { AivaConversation, AivaEmployeeMessage, AivaWorker } from '@/lib/aiva-types';
import { warnTone } from '@/lib/ui-tones';
import { cn } from '@/lib/utils';

async function readJsonResponse<T extends Record<string, unknown>>(
  res: Response,
  fallbackError: string,
): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    if (!res.ok) throw new Error(fallbackError);
    return {} as T;
  }
  if (trimmed.startsWith('<') || trimmed.startsWith('<!DOCTYPE')) {
    throw new Error(
      res.ok
        ? 'Chat service returned an unexpected page. Refresh and try again.'
        : `Chat service unavailable (${res.status}). Refresh and try again.`,
    );
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(
      res.ok
        ? 'Chat service returned invalid data. Refresh and try again.'
        : fallbackError,
    );
  }
}

export function AivaWorkerDirectChat({
  worker,
  readOnly = false,
}: {
  worker: AivaWorker;
  readOnly?: boolean;
}) {
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
  const [channelSyncOpen, setChannelSyncOpen] = useState(false);
  const [channelsLinked, setChannelsLinked] = useState(false);
  const [ownerAutoSync, setOwnerAutoSync] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{
    absolutePath: string;
    filename: string;
  } | null>(null);
  const [spreadsheetDownloads, setSpreadsheetDownloads] = useState<{
    excel: string;
    csv: string;
    rows: number;
  } | null>(null);
  const threadLoadRef = useRef(0);

  const loadConversations = useCallback(async (preferredId?: string) => {
    const res = await fetch(`/api/aiva/workers/${worker.id}/direct-conversations`);
    const data = await readJsonResponse<{ conversations?: AivaConversation[]; error?: string }>(
      res,
      'Could not load conversations',
    );
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
    if (readOnly) return;
    setError('');
    const res = await fetch(`/api/aiva/workers/${worker.id}/direct-conversations`, {
      method: 'POST',
    });
    const data = await readJsonResponse<{ conversation?: AivaConversation; error?: string }>(
      res,
      'Could not start a new chat',
    );
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
    setChannelSyncOpen(false);
    setSidebarOpen(false);
  }, [readOnly, worker.id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadConversations()
      .then(async (items) => {
        if (!cancelled && items.length === 0 && !readOnly) await createConversation();
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
  }, [createConversation, loadConversations, readOnly]);

  const loadThread = useCallback(async (conversation: AivaConversation) => {
    const loadId = ++threadLoadRef.current;
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ limit: '100', contactId: conversation.contactId });
      const res = await fetch(`/api/aiva/workers/${worker.id}/direct-thread?${query}`);
      const data = await readJsonResponse<{ messages?: AivaEmployeeMessage[]; error?: string }>(
        res,
        'Could not load chat',
      );
      if (!res.ok) throw new Error(data.error ?? 'Could not load chat');
      if (loadId === threadLoadRef.current) setMessages(data.messages ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load chat');
    } finally {
      setLoading(false);
    }
  }, [worker.id]);

  useEffect(() => {
    if (activeConversation) void loadThread(activeConversation);
  }, [activeConversation?.id, loadThread]);

  useEffect(() => {
    setChannelsLinked(false);
    setOwnerAutoSync(false);
    if (!activeConversation?.contactId || readOnly) return;
    let cancelled = false;
    const query = new URLSearchParams({
      channel: 'web',
      contactId: activeConversation.contactId,
      limit: '1',
    });
    void fetch(`/api/aiva/workers/${encodeURIComponent(worker.id)}/channel-sync?${query}`)
      .then(async (res) => {
        const data = await readJsonResponse<{ linked?: boolean; ownerAuto?: boolean; error?: string }>(
          res,
          'Could not check channel sync',
        );
        if (!res.ok) throw new Error(data.error ?? 'Could not check channel sync');
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setChannelsLinked(Boolean(data.linked));
        setOwnerAutoSync(Boolean(data.ownerAuto));
      })
      .catch(() => {
        if (!cancelled) {
          setChannelsLinked(false);
          setOwnerAutoSync(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeConversation?.contactId, readOnly, worker.id]);

  async function pickAttachment(file: File) {
    if (readOnly || busy) return;
    setError('');
    setBusy(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result ?? '');
          const base64 = result.includes(',') ? result.split(',')[1] ?? '' : result;
          if (!base64) reject(new Error('Could not read file'));
          else resolve(base64);
        };
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
      });
      const res = await fetch(`/api/aiva/workers/${worker.id}/chat-attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, data }),
      });
      const payload = await readJsonResponse<{
        absolutePath?: string;
        filename?: string;
        spreadsheet?: {
          rowCount?: number;
          downloadExcel?: string;
          downloadCsv?: string;
        };
        error?: string;
      }>(res, 'Could not upload file');
      if (!res.ok) throw new Error(payload.error ?? 'Could not upload file');
      if (!payload.absolutePath || !payload.filename) {
        throw new Error('Upload did not return a file path');
      }
      setPendingAttachment({
        absolutePath: payload.absolutePath,
        filename: payload.filename,
      });
      if (payload.spreadsheet?.downloadExcel && payload.spreadsheet.downloadCsv) {
        setSpreadsheetDownloads({
          excel: payload.spreadsheet.downloadExcel,
          csv: payload.spreadsheet.downloadCsv,
          rows: payload.spreadsheet.rowCount ?? 0,
        });
      } else {
        setSpreadsheetDownloads(null);
      }
      if (!message.trim()) {
        const lower = payload.filename.toLowerCase();
        if (/\.(csv|tsv|xlsx|xls|ods)$/.test(lower)) {
          setMessage(
            `Import this lead file into CRM leads (dedupe on email), then summarise how many were created: ${payload.filename}`,
          );
        } else {
          setMessage(`Please analyse this file and share key insights: ${payload.filename}`);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload file');
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const content = message.trim();
    if (readOnly || busy || !activeConversation) return;
    if (!content && !pendingAttachment) return;

    const detectedSetup = detectConversationalChannelSetup(content);
    if (detectedSetup) {
      setError('');
      setSetupNotice('');
      setMessage('');
      setChannelSetup(detectedSetup);
      return;
    }

    const attachment = pendingAttachment;
    const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimisticMessage: AivaEmployeeMessage = {
      id: optimisticId,
      threadId: activeConversation.id,
      workerId: worker.id,
      workspaceId: worker.workspaceId,
      sender: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    threadLoadRef.current += 1;
    setMessages((current) => [...current, optimisticMessage]);
    setBusy(true);
    setError('');
    setSetupNotice('');
    setMessage('');
    setPendingAttachment(null);
    try {
      const res = await fetch(`/api/aiva/workers/${worker.id}/direct-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          contactId: activeConversation.contactId,
          attachments: attachment
            ? [{ absolutePath: attachment.absolutePath, filename: attachment.filename }]
            : [],
        }),
      });
      const data = await readJsonResponse<{
        error?: string;
        userMessage?: AivaEmployeeMessage;
        employeeMessage?: AivaEmployeeMessage;
      }>(res, 'Could not send message');
      if (!res.ok) throw new Error(data.error ?? 'Could not send message');
      setMessages((current) => [
        ...current.filter((item) => item.id !== optimisticId),
        ...(data.userMessage ? [data.userMessage] : [optimisticMessage]),
        ...(data.employeeMessage ? [data.employeeMessage] : []),
      ]);
      await loadConversations(activeConversation.id);
    } catch (err) {
      setMessages((current) => current.filter((item) => item.id !== optimisticId));
      setMessage(content);
      if (attachment) setPendingAttachment(attachment);
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
    setChannelSyncOpen(false);
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
          disabled={busy || readOnly}
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
    <div className="relative flex h-full min-h-0 flex-col">
      {error ? <p className="shrink-0 px-4 py-2 text-sm text-danger sm:px-6">{error}</p> : null}
      <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[15rem_minmax(0,1fr)] lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="hidden min-h-0 border-r border-border/70 bg-base md:flex md:flex-col">
          {conversationList}
        </aside>
        {sidebarOpen ? (
          <div className="absolute inset-0 z-40 bg-base md:hidden">
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
          variant="workspace"
          headerBanner={spreadsheetDownloads ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-elevated/50 px-4 py-2 text-xs">
              <span>{spreadsheetDownloads.rows} spreadsheet rows ready.</span>
              <a className="font-medium text-accent hover:underline" href={spreadsheetDownloads.excel}>
                Download Excel
              </a>
              <a className="font-medium text-accent hover:underline" href={spreadsheetDownloads.csv}>
                Download CSV
              </a>
            </div>
          ) : undefined}
          composerDisabled={readOnly || Boolean(channelSetup) || !activeConversation}
          composerDisabledMessage={
            readOnly
              ? 'This Aiva was dismissed. Chat history is read-only.'
              : 'Finish or cancel the secure setup above.'
          }
          pendingAttachmentName={pendingAttachment?.filename ?? null}
          onClearPendingAttachment={() => {
            setPendingAttachment(null);
            setSpreadsheetDownloads(null);
          }}
          onPickAttachment={readOnly ? undefined : (file) => void pickAttachment(file)}
          canSendWithoutText
          className="h-full min-h-0 min-w-0"
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
              {!readOnly ? (
                <button
                  type="button"
                  onClick={() => void createConversation()}
                  disabled={busy}
                  className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">New chat</span>
                </button>
              ) : null}
              {!readOnly ? (
                <AivaChannelSyncToggle
                  open={channelSyncOpen}
                  linked={channelsLinked}
                  ownerAuto={ownerAutoSync}
                  disabled={busy || !activeConversation}
                  onToggle={() => setChannelSyncOpen((current) => !current)}
                />
              ) : null}
            </div>
          }
          conversationAddon={
            <>
              {worker.workerConfig?.privacy?.incognito ? (
                <div className={cn('rounded-lg px-3 py-2 text-xs', warnTone.box, warnTone.textMuted)}>
                  Incognito is on. This chat is not saved on our servers. Tools you ask for still run.
                </div>
              ) : null}
              {!readOnly && activeConversation ? (
                <AivaChannelSyncPanel
                  workerId={worker.id}
                  contactId={activeConversation.contactId}
                  channel="web"
                  open={channelSyncOpen}
                  onOpenChange={setChannelSyncOpen}
                  onContinued={() => {
                    setChannelsLinked(true);
                    void loadThread(activeConversation);
                  }}
                />
              ) : null}
              {channelSetup ? (
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
                <div className="mr-auto max-w-[min(94%,48rem)] rounded-lg rounded-bl-sm border border-border bg-elevated px-3 py-2 text-sm text-text-primary xl:max-w-[min(92%,56rem)]">
                  {setupNotice}
                </div>
              ) : null}
            </>
          }
        />
      </div>
    </div>
  );
}
