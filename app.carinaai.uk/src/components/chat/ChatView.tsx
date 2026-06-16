'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AssistantMessage } from './AssistantMessage';
import { ChatInputBar, type ChatSendOptions } from './ChatInputBar';
import { SessionHeader } from './SessionHeader';
import { ToolCallBlock } from './ToolCallBlock';
import { ChatMessage, ContextPin, LiveToolCall } from './types';
import { UserMessage } from './UserMessage';

interface ChatViewProps {
  sessionId: string;
  sessionTitle: string;
  initialMessages: ChatMessage[];
  workspacePlan: string;
}

export function ChatView({
  sessionId,
  sessionTitle,
  initialMessages,
  workspacePlan: _workspacePlan,
}: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [title, setTitle] = useState(sessionTitle);
  const [streamingContent, setStreamingContent] = useState('');
  const [liveToolCalls, setLiveToolCalls] = useState<LiveToolCall[]>([]);
  const [contextPins, setContextPins] = useState<ContextPin[]>([]);
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    setTitle(sessionTitle);
  }, [sessionTitle]);

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

  const currentModel = [...messages].reverse().find((message) => message.model)?.model ?? '';

  async function deleteMessage(id: string) {
    const previousMessages = messages;
    setMessages((prev) => prev.filter((message) => message.id !== id));

    const res = await fetch(`/api/messages/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setMessages(previousMessages);
    }
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

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: fullMessage,
        sessionId,
        mode: options.mode,
        provider: options.provider,
        model: options.model,
        webSearch: options.webSearch,
      }),
    });

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
    const streamToolCalls: LiveToolCall[] = [];

    while (true) {
      const { done, value } = await reader.read();
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
              }
            | { error?: string };
          if (typeof parsed === 'string') {
            assistant += parsed;
            setStreamingContent(assistant);
          } else if ('tool_start' in parsed && parsed.tool_start) {
            const nextToolCall: LiveToolCall = {
              id: parsed.tool_start.id,
              name: parsed.tool_start.name,
              input: parsed.tool_start.input ?? {},
              output: null,
              durationMs: 0,
              status: 'running',
            };
            streamToolCalls.push(nextToolCall);
            setLiveToolCalls([...streamToolCalls]);
          } else if ('tool_done' in parsed && parsed.tool_done) {
            const toolCall = streamToolCalls.find((tc) => tc.id === parsed.tool_done?.id);
            if (toolCall) {
              toolCall.output = parsed.tool_done.output;
              toolCall.durationMs = parsed.tool_done.durationMs ?? 0;
              toolCall.status = 'done';
            }
            setLiveToolCalls([...streamToolCalls]);
          } else if ('tool_error' in parsed && parsed.tool_error) {
            const toolCall = streamToolCalls.find((tc) => tc.id === parsed.tool_error?.id);
            if (toolCall) {
              toolCall.output = parsed.tool_error.error;
              toolCall.durationMs = parsed.tool_error.durationMs ?? 0;
              toolCall.status = 'error';
            }
            setLiveToolCalls([...streamToolCalls]);
          } else if ('meta' in parsed && parsed.meta) {
            finalMeta = parsed.meta;
          } else if ('error' in parsed && parsed.error) {
            assistant += `\n\nError: ${parsed.error}`;
            setStreamingContent(assistant);
          }
        } catch {
          assistant += data;
          setStreamingContent(assistant);
        }
      }
    }

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
    setStreamingContent('');
    setLiveToolCalls([]);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col bg-base">
      <SessionHeader
        title={title}
        messageCount={messages.length}
        model={currentModel}
        onRename={renameSession}
      />

      <div className="chat-messages flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-4 py-4">
        {messages.map((msg) => (
          msg.role === 'user' ? (
            <UserMessage key={msg.id} message={msg} onDelete={deleteMessage} />
          ) : (
            <AssistantMessage key={msg.id} message={msg} onDelete={deleteMessage} />
          )
        ))}
        {(streamingContent !== '' || liveToolCalls.length > 0) && (
          <div className="flex max-w-[85%] flex-col items-start gap-2">
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
          disabled={busy}
          sessionId={sessionId}
          contextPins={contextPins}
          onAddContextPin={(pin) => setContextPins((prev) => [...prev, pin])}
          onRemoveContextPin={(id) => {
            setContextPins((prev) => prev.filter((pin) => pin.id !== id));
            document.dispatchEvent(new CustomEvent('context-pin-remove', { detail: { id } }));
          }}
        />
      </div>
    </div>
  );
}
