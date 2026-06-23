'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AssistantMessage } from './AssistantMessage';
import { ChatInputBar, type ChatSendOptions } from './ChatInputBar';
import { ContextWarning } from './ContextWarning';
import { DeletedMessage } from './DeletedMessage';
import { ThinkingIndicator } from './ThinkingIndicator';
import { SessionHeader } from './SessionHeader';
import { ProfileSwitcher } from './ProfileSwitcher';
import { ToolCallBlock } from './ToolCallBlock';
import { ChatMessage, ContextPin, LiveToolCall } from './types';
import { UserMessage } from './UserMessage';
import { ChatErrorMessage } from './ChatErrorMessage';
import type { ChatErrorCode } from '@/lib/chat-errors';
import { IconButton } from '@/components/ui/IconButton';
import { Download, Copy } from 'lucide-react';
import { copySessionMarkdown, downloadSessionMarkdown } from '@/lib/chat-session-export';
import { loadDeletedMessageSnapshots, removeDeletedMessageSnapshot, saveDeletedMessageSnapshot } from '@/lib/chat-deletions';
import { estimateTokensFromText } from '@/lib/token-estimation';
import { pushInputHistory } from '@/lib/chat-history';

interface ChatViewProps {
  sessionId: string;
  sessionTitle: string;
  initialMessages: ChatMessage[];
  workspacePlan: string;
  profileId?: string | null;
  researchJobId?: string | null;
  documentId?: string | null;
}

export function ChatView({
  sessionId,
  sessionTitle,
  initialMessages,
  workspacePlan: _workspacePlan,
  profileId,
  researchJobId,
  documentId,
}: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [title, setTitle] = useState(sessionTitle);
  const [streamingContent, setStreamingContent] = useState('');
  const [liveToolCalls, setLiveToolCalls] = useState<LiveToolCall[]>([]);
  const [contextPins, setContextPins] = useState<ContextPin[]>([]);
  const [streamError, setStreamError] = useState<{ message: string; code?: ChatErrorCode } | null>(
    null,
  );
  const [researchReady, setResearchReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deletedMessages, setDeletedMessages] = useState<Map<string, ChatMessage>>(
    () => new Map(),
  );
  const [activeProfileId, setActiveProfileId] = useState(profileId ?? '');
  const [webSearchAvailable, setWebSearchAvailable] = useState(false);
  const [agentModeAvailable, setAgentModeAvailable] = useState(false);

  useEffect(() => {
    void fetch('/api/chat/health')
      .then((response) => response.json())
      .then((data) => {
        const caps = data.capabilities as { webSearch?: boolean; agentTools?: boolean } | undefined;
        setWebSearchAvailable(Boolean(caps?.webSearch));
        setAgentModeAvailable(Boolean(caps?.agentTools));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!researchJobId) return;
    void fetch(`/api/research/${researchJobId}`)
      .then((response) => response.json())
      .then((data) => {
        if (!data.data?.output) return;
        setResearchReady(true);
        setContextPins((current) => {
          const exists = current.some((pin) => pin.id === researchJobId);
          if (exists) return current;
          return [
            ...current,
            {
              id: researchJobId,
              label: `Research: ${String(data.data.query).slice(0, 48)}`,
              pinType: 'text',
              content: String(data.data.output).slice(0, 4000),
            },
          ];
        });
      })
      .catch(() => {});
  }, [researchJobId]);

  useEffect(() => {
    if (!documentId) return;
    void fetch(`/api/documents/${documentId}`)
      .then((response) => response.json())
      .then((data) => {
        if (!data.data) return;
        setContextPins((current) => {
          const exists = current.some((pin) => pin.id === documentId);
          if (exists) return current;
          return [
            ...current,
            {
              id: documentId,
              label: `Document: ${String(data.data.title).slice(0, 48)}`,
              pinType: 'document',
              content: String(data.data.content).slice(0, 4000),
            },
          ];
        });
      })
      .catch(() => {});
  }, [documentId]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastSendOptionsRef = useRef<ChatSendOptions>({ mode: 'chat', provider: '', model: '', contextPins: [], webSearch: false });
  const router = useRouter();

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    setTitle(sessionTitle);
  }, [sessionTitle]);

  useEffect(() => {
    setDeletedMessages(loadDeletedMessageSnapshots(sessionId));
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);


  useEffect(() => {
    function handler(event: Event) {
      const pins = (event as CustomEvent).detail as Array<{
        id?: string;
        noteId?: string;
        label: string;
        content: string;
      }>;
      setContextPins(
        pins.map((pin) => ({
          id: pin.noteId ?? pin.id ?? crypto.randomUUID(),
          label: pin.label,
          pinType: 'note',
          content: pin.content,
        })),
      );
    }

    document.addEventListener('context-pins-changed', handler);
    return () => document.removeEventListener('context-pins-changed', handler);
  }, []);

  useEffect(() => {
    function handleCopyLastResponse() {
      const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant' && message.content);
      if (lastAssistant) void navigator.clipboard?.writeText(lastAssistant.content);
    }

    document.addEventListener('copy-last-response', handleCopyLastResponse);
    return () => document.removeEventListener('copy-last-response', handleCopyLastResponse);
  }, [messages]);

  const visibleMessages = useMemo(
    () => messages.filter((message) => !deletedMessages.has(message.id)),
    [deletedMessages, messages],
  );
  const currentModel = [...visibleMessages].reverse().find((message) => message.model)?.model ?? '';
  const renderedMessages = useMemo(() => {
    const rendered = messages.map((message) => ({
      kind: deletedMessages.has(message.id) ? ('deleted' as const) : ('message' as const),
      message,
    }));

    for (const snapshot of deletedMessages.values()) {
      if (messages.some((message) => message.id === snapshot.id)) continue;
      rendered.push({ kind: 'deleted' as const, message: snapshot });
    }

    return rendered.sort(
      (a, b) =>
        new Date(a.message.createdAt).getTime() - new Date(b.message.createdAt).getTime(),
    );
  }, [deletedMessages, messages]);
  const currentContextTokens = useMemo(() => {
    const messageTokens = visibleMessages.reduce(
      (sum, message) =>
        sum + message.inputTokens + message.outputTokens + estimateTokensFromText(message.content || ''),
      0,
    );
    const streamingTokens = estimateTokensFromText(streamingContent);
    return messageTokens + streamingTokens;
  }, [streamingContent, visibleMessages]);
  const maxContextTokens = 128000;
  const lastAssistantId = useMemo(() => {
    return [...renderedMessages].reverse().find((e) => e.kind === 'message' && e.message.role === 'assistant')?.message.id ?? null;
  }, [renderedMessages]);

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setStreamingContent('');
    setLiveToolCalls([]);
  }

  async function retry() {
    if (busy) return;
    const vis = visibleMessages;
    const reversedVis = [...vis].reverse();
    const lastUserMsg = reversedVis.find((m) => m.role === 'user');
    if (!lastUserMsg) return;

    const lastUserIdx = vis.findIndex((m) => m.id === lastUserMsg.id);
    const toRemove = vis.slice(lastUserIdx);
    const toRemoveIds = new Set(toRemove.map((m) => m.id));

    setMessages((prev) => prev.filter((m) => !toRemoveIds.has(m.id)));
    setDeletedMessages((prev) => {
      const next = new Map(prev);
      for (const m of toRemove) {
        next.delete(m.id);
        removeDeletedMessageSnapshot(sessionId, m.id);
      }
      return next;
    });
    void Promise.all(toRemove.map((m) => fetch(`/api/messages/${m.id}`, { method: 'DELETE' })));
    await send(lastUserMsg.content, lastSendOptionsRef.current);
  }

  async function undo() {
    if (busy) return;
    const vis = visibleMessages;
    const reversedVis = [...vis].reverse();
    const lastUserMsg = reversedVis.find((m) => m.role === 'user');
    if (!lastUserMsg) return;

    const lastUserIdx = vis.findIndex((m) => m.id === lastUserMsg.id);
    const toRemove = vis.slice(lastUserIdx);
    const toRemoveIds = new Set(toRemove.map((m) => m.id));

    setMessages((prev) => prev.filter((m) => !toRemoveIds.has(m.id)));
    setDeletedMessages((prev) => {
      const next = new Map(prev);
      for (const m of toRemove) {
        next.delete(m.id);
        removeDeletedMessageSnapshot(sessionId, m.id);
      }
      return next;
    });
    await Promise.all(toRemove.map((m) => fetch(`/api/messages/${m.id}`, { method: 'DELETE' })));
    router.refresh();
  }

  async function deleteMessage(id: string) {
    const target = messages.find((message) => message.id === id);
    if (target) {
      saveDeletedMessageSnapshot(sessionId, target);
      setDeletedMessages((prev) => {
        const next = new Map(prev);
        next.set(id, target);
        return next;
      });
    }

    const res = await fetch(`/api/messages/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      if (target) {
        removeDeletedMessageSnapshot(sessionId, id);
        setDeletedMessages((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      }
    }
  }

  function restoreMessage(message: ChatMessage) {
    removeDeletedMessageSnapshot(sessionId, message.id);
    setDeletedMessages((prev) => {
      const next = new Map(prev);
      next.delete(message.id);
      return next;
    });
  }

  async function exportMarkdown(mode: 'copy' | 'download') {
    const titleForExport = title || sessionTitle || 'Carina session';
    if (mode === 'copy') {
      await copySessionMarkdown(titleForExport, visibleMessages);
      return;
    }
    await downloadSessionMarkdown(titleForExport, visibleMessages);
  }

  async function startNewSession() {
    const res = await fetch('/api/sessions', { method: 'POST' });
    if (!res.ok) return;
    const data = await res.json().catch(() => null) as { data?: { id?: string } } | null;
    const id = data?.data?.id;
    if (!id) return;
    router.push(`/chat/${id}`);
    router.refresh();
  }

  async function renameSession(nextTitle: string) {
    const previousTitle = title;
    setTitle(nextTitle);

    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: nextTitle }),
    });

    if (!res.ok) {
      setTitle(previousTitle);
      return;
    }

    router.refresh();
  }

  async function send(message: string, options: ChatSendOptions) {
    lastSendOptionsRef.current = options;
    pushInputHistory(message);

    let fullMessage = message;
    if (options.contextPins.length > 0) {
      const context = options.contextPins
        .map((pin) => `[Note: ${pin.label}]\n${pin.content}\n[/Note]`)
        .join('\n\n');
      fullMessage = `${context}\n\n${message}`;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'user',
        content: message,
        toolCalls: [],
        inputTokens: 0,
        outputTokens: 0,
        durationMs: 0,
        model: '',
        createdAt: new Date().toISOString(),
      },
    ]);
    setBusy(true);
    setStreamingContent('');
    setLiveToolCalls([]);
    setStreamError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        message: fullMessage,
        sessionId,
        mode: options.mode,
        provider: options.provider,
        model: options.model,
        webSearch: options.webSearch,
        profileId: activeProfileId || undefined,
      }),
    }).catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') return null;
      throw err;
    });

    if (!res) {
      setBusy(false);
      setStreamingContent('');
      setLiveToolCalls([]);
      return;
    }

    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({ error: 'Chat failed' }));
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: String(err.error ?? 'Chat failed'),
          toolCalls: [],
          inputTokens: 0,
          outputTokens: 0,
          durationMs: 0,
          model: '',
          createdAt: new Date().toISOString(),
        },
      ]);
      setBusy(false);
      setLiveToolCalls([]);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let assistant = '';
    let finalMeta: {
      inputTokens: number;
      outputTokens: number;
      durationMs: number;
      sessionId?: string;
      model?: string;
    } | null = null;
    let streamFailed = false;
    let streamAborted = false;
    let streamErrorPayload: { message: string; code?: ChatErrorCode } | null = null;
    const streamToolCalls: LiveToolCall[] = [];

    while (true) {
      let done: boolean;
      let value: Uint8Array | undefined;
      try {
        ({ done, value } = await reader.read());
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          streamAborted = true;
          break;
        }
        throw err;
      }
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data) as
            | string
            | {
                type?: string;
                content?: string;
                id?: string;
                name?: string;
                input?: unknown;
                output?: unknown;
                error?: string;
                code?: ChatErrorCode;
                durationMs?: number;
                duration_ms?: number;
                meta?: {
                  inputTokens: number;
                  outputTokens: number;
                  durationMs: number;
                  sessionId?: string;
                  model?: string;
                };
                sessionId?: string;
                tool_start?: {
                  id: string;
                  name: string;
                  input?: unknown;
                };
                tool_done?: {
                  id: string;
                  output: unknown;
                  durationMs?: number;
                };
                tool_error?: {
                  id: string;
                  error: string;
                  durationMs?: number;
                };
              };

          if (typeof parsed === 'string') {
            assistant += parsed;
            setStreamingContent(assistant);
            continue;
          }

          if (parsed.error) {
            streamFailed = true;
            streamErrorPayload = {
              message: parsed.error,
              code: parsed.code,
            };
            setStreamError(streamErrorPayload);
            continue;
          }

          if (parsed.type === 'text' && typeof parsed.content === 'string') {
            assistant += parsed.content;
            setStreamingContent(assistant);
            continue;
          }

          if (parsed.type === 'tool_start' && parsed.id && parsed.name) {
            streamToolCalls.push({
              id: parsed.id,
              name: parsed.name,
              input: parsed.input ?? {},
              output: null,
              durationMs: 0,
              status: 'running',
            });
            setLiveToolCalls([...streamToolCalls]);
            continue;
          }

          if (parsed.type === 'tool_done' && parsed.id) {
            const toolCall = streamToolCalls.find((tc) => tc.id === parsed.id);
            if (toolCall) {
              toolCall.output = parsed.output;
              toolCall.durationMs = Number(parsed.durationMs ?? parsed.duration_ms ?? 0);
              toolCall.status = 'done';
            }
            setLiveToolCalls([...streamToolCalls]);
            continue;
          }

          if (parsed.type === 'tool_error' && parsed.id) {
            const toolCall = streamToolCalls.find((tc) => tc.id === parsed.id);
            if (toolCall) {
              toolCall.output = parsed.error ?? 'Tool failed';
              toolCall.durationMs = Number(parsed.durationMs ?? parsed.duration_ms ?? 0);
              toolCall.status = 'error';
            }
            setLiveToolCalls([...streamToolCalls]);
            continue;
          }

          if (parsed.tool_start) {
            streamToolCalls.push({
              id: parsed.tool_start.id,
              name: parsed.tool_start.name,
              input: parsed.tool_start.input ?? {},
              output: null,
              durationMs: 0,
              status: 'running',
            });
            setLiveToolCalls([...streamToolCalls]);
            continue;
          }

          if (parsed.tool_done) {
            const toolCall = streamToolCalls.find((tc) => tc.id === parsed.tool_done?.id);
            if (toolCall) {
              toolCall.output = parsed.tool_done.output;
              toolCall.durationMs = parsed.tool_done.durationMs ?? 0;
              toolCall.status = 'done';
            }
            setLiveToolCalls([...streamToolCalls]);
            continue;
          }

          if (parsed.tool_error) {
            const toolCall = streamToolCalls.find((tc) => tc.id === parsed.tool_error?.id);
            if (toolCall) {
              toolCall.output = parsed.tool_error.error;
              toolCall.durationMs = parsed.tool_error.durationMs ?? 0;
              toolCall.status = 'error';
            }
            setLiveToolCalls([...streamToolCalls]);
            continue;
          }

          if (parsed.meta) {
            finalMeta = parsed.meta;
          }
        } catch {
          assistant += data;
          setStreamingContent(assistant);
        }
      }
    }

    if (streamAborted) {
      if (assistant.trim() || streamToolCalls.length > 0) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: assistant,
            toolCalls: streamToolCalls.map((tc) => ({
              id: tc.id,
              name: tc.name,
              input: tc.input,
              output: tc.output,
              durationMs: tc.durationMs,
              status: tc.status,
            })),
            inputTokens: finalMeta?.inputTokens ?? 0,
            outputTokens: finalMeta?.outputTokens ?? 0,
            durationMs: finalMeta?.durationMs ?? 0,
            model: finalMeta?.model ?? '',
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } else if (streamFailed && streamErrorPayload) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '',
          errorCode: streamErrorPayload.code,
          errorMessage: streamErrorPayload.message,
          toolCalls: [],
          inputTokens: 0,
          outputTokens: 0,
          durationMs: 0,
          model: '',
          createdAt: new Date().toISOString(),
        },
      ]);
    } else if (assistant.trim() || streamToolCalls.length > 0) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: assistant,
          toolCalls: streamToolCalls.map((toolCall) => ({
            id: toolCall.id,
            name: toolCall.name,
            input: toolCall.input,
            output: toolCall.output,
            durationMs: toolCall.durationMs,
            status: toolCall.status,
          })),
          inputTokens: finalMeta?.inputTokens ?? 0,
          outputTokens: finalMeta?.outputTokens ?? 0,
          durationMs: finalMeta?.durationMs ?? 0,
          model: finalMeta?.model ?? '',
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    setStreamingContent('');
    setLiveToolCalls([]);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col bg-base">
      <SessionHeader
        title={title}
        messageCount={visibleMessages.length}
        model={currentModel}
        onRename={renameSession}
        actions={
          <div className="flex items-center gap-2">
            <ProfileSwitcher
              sessionId={sessionId}
              activeProfileId={activeProfileId}
              onProfileChange={(profile) => setActiveProfileId(profile?.id ?? '')}
            />
            <div className="flex items-center gap-0.5">
            <IconButton label="Copy session as Markdown" size="sm" onClick={() => void exportMarkdown('copy')}>
              <Copy className="h-3 w-3" />
            </IconButton>
            <IconButton label="Download session as Markdown" size="sm" onClick={() => void exportMarkdown('download')}>
              <Download className="h-3 w-3" />
            </IconButton>
            </div>
          </div>
        }
      />

      <div className="px-4 pt-3">
        <ContextWarning
          usedTokens={currentContextTokens}
          maxTokens={maxContextTokens}
          onNewSession={() => void startNewSession()}
        />
      </div>

      <div className="chat-messages flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-4 py-4">
        {renderedMessages.map((entry) =>
          entry.kind === 'deleted' ? (
            <DeletedMessage
              key={entry.message.id}
              message={entry.message}
              onRestore={restoreMessage}
            />
          ) : entry.message.role === 'user' ? (
            <UserMessage key={entry.message.id} message={entry.message} onDelete={deleteMessage} />
          ) : (
            <AssistantMessage
              key={entry.message.id}
              message={entry.message}
              onDelete={deleteMessage}
              onRetry={!busy && entry.message.id === lastAssistantId ? () => void retry() : undefined}
            />
          ),
        )}
        {busy && streamingContent === '' && liveToolCalls.length === 0 && !streamError && (
          <ThinkingIndicator />
        )}
        {(streamingContent !== '' || liveToolCalls.length > 0 || streamError) && (
          <div className="flex max-w-[85%] flex-col items-start gap-2">
            {streamError && (
              <div className="rounded-2xl rounded-tl-sm bg-bubble-assistant px-4 py-3">
                <ChatErrorMessage message={streamError.message} code={streamError.code} />
              </div>
            )}
            {liveToolCalls.length > 0 && (
              <div className="w-full space-y-2">
                {liveToolCalls.map((toolCall) => (
                  <ToolCallBlock key={toolCall.id} toolCall={toolCall} status={toolCall.status} />
                ))}
              </div>
            )}
            {streamingContent !== '' && (
              <AssistantMessage
                message={{
                  id: 'streaming',
                  role: 'assistant',
                  content: streamingContent,
                  toolCalls: [],
                  inputTokens: 0,
                  outputTokens: 0,
                  durationMs: 0,
                  model: '',
                  createdAt: new Date().toISOString(),
                }}
                streaming
              />
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-4">
        <ChatInputBar
          onSend={send}
          busy={busy}
          disabled={busy}
          sessionId={sessionId}
          contextPins={contextPins}
          webSearchAvailable={webSearchAvailable}
          agentModeAvailable={agentModeAvailable}
          placeholder={
            researchReady
              ? 'Ask a follow-up about this research...'
              : undefined
          }
          onAddContextPin={(pin) => setContextPins((prev) => [...prev, pin])}
          onRemoveContextPin={(id) => {
            setContextPins((prev) => prev.filter((pin) => pin.id !== id));
            document.dispatchEvent(new CustomEvent('context-pin-remove', { detail: { id } }));
          }}
          onStop={stop}
          onRetry={() => void retry()}
          onUndo={() => void undo()}
          onNewSession={() => void startNewSession()}
        />
      </div>
    </div>
  );
}
