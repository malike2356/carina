'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Loader2, Send, X } from 'lucide-react';
import { AivaChatMarkdown } from '@/components/aiva/AivaChatMarkdown';
import { CARINA_HELP_GREETING } from '@/lib/carina-help/knowledge';
import { cn } from '@/lib/utils';
import { useIsAivaProduct } from '@/hooks/useProductSurface';
import { useWorkspaceFeatureEnabled } from '@/hooks/useWorkspaceFeatures';

type ChatRole = 'user' | 'assistant' | 'error';

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readSseContent(
  response: Response,
  onDelta: (chunk: string) => void,
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response stream');

  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n');
    buffer = parts.pop() || '';

    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const json = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          onDelta(delta);
        }
      } catch {
        // ignore malformed chunks
      }
    }
  }

  return full;
}

export function AskCarinaWidget() {
  const isAiva = useIsAivaProduct();
  const { loading: featureLoading, enabled: chatEnabled } = useWorkspaceFeatureEnabled(
    'ai_chat_assistant',
    true,
  );
  const pathname = usePathname() ?? '/';
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [escalatedId, setEscalatedId] = useState<string | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const greetedRef = useRef(false);

  useEffect(() => {
    if (!isAiva || typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;

    const sync = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardInset(inset > 40 ? inset : 0);
    };
    sync();
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
    };
  }, [isAiva]);

  useEffect(() => {
    if (!open) return;
    if (!greetedRef.current) {
      greetedRef.current = true;
      setMessages([{ id: newId(), role: 'assistant', content: CARINA_HELP_GREETING }]);
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, open, sending]);

  if (!isAiva) return null;
  if (!featureLoading && !chatEnabled) return null;

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = { id: newId(), role: 'user', content: text };
    const history = [...messages, userMsg].filter((m) => m.role !== 'error');
    setMessages([...history, { id: newId(), role: 'assistant', content: '' }]);
    setInput('');
    setSending(true);
    setEscalatedId(null);

    try {
      const res = await fetch('/api/carina/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPage: pathname,
          messages: history
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error || `Request failed (${res.status})`);
      }

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = (await res.json()) as { content?: string; error?: string };
        const content = String(data.content ?? '').trim();
        if (!content) throw new Error(data.error || 'Empty reply from Carina');
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (!last || last.role !== 'assistant') return prev;
          next[next.length - 1] = { ...last, content };
          return next;
        });
      } else {
        await readSseContent(res, (delta) => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (!last || last.role !== 'assistant') return prev;
            next[next.length - 1] = { ...last, content: last.content + delta };
            return next;
          });
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong';
      setMessages((prev) => {
        const withoutEmpty = prev.filter(
          (m, index) => !(index === prev.length - 1 && m.role === 'assistant' && !m.content),
        );
        return [...withoutEmpty, { id: newId(), role: 'error', content: message }];
      });
    } finally {
      setSending(false);
    }
  }

  async function escalate() {
    if (escalating) return;
    setEscalating(true);
    try {
      const transcript = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      const lastUser = [...transcript].reverse().find((m) => m.role === 'user')?.content || '';
      const res = await fetch('/api/carina/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPage: pathname,
          summary: lastUser || 'User requested human support from Ask Carina',
          transcript,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        escalationId?: string;
        message?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || 'Escalate failed');
      setEscalatedId(data.escalationId ?? 'ok');
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          content:
            data.message ||
            'Escalated to the Aiva support team. They will follow up by email or Telegram.',
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'error',
          content: error instanceof Error ? error.message : 'Could not escalate',
        },
      ]);
    } finally {
      setEscalating(false);
    }
  }

  const bottomOffset = Math.max(keyboardInset, 0);

  return (
    <div
      className={cn(
        'pointer-events-none fixed right-3 z-[60] sm:right-4',
        // Lift above mobile bottom nav; sit lower on desktop.
        bottomOffset > 0 ? '' : 'bottom-[4.75rem] lg:bottom-4',
      )}
      style={
        bottomOffset > 0
          ? {
              bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom, 0px) + 0.75rem)`,
            }
          : undefined
      }
    >
      {open ? (
        <div
          className={cn(
            'pointer-events-auto mb-3 flex w-[min(100vw-1.5rem,24rem)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl',
            'h-[min(52dvh,34rem)] sm:h-[min(55dvh,36rem)]',
          )}
          role="dialog"
          aria-label="Ask Carina"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-border bg-base ring-1 ring-accent/40">
                <Image
                  src="/carina_logo_1.png"
                  alt=""
                  width={36}
                  height={36}
                  className="h-full w-full object-cover"
                  priority
                />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary">Ask Carina</p>
                <p className="text-[11px] text-text-muted">Aiva help and guidance</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-text-muted hover:bg-elevated hover:text-text-primary"
              aria-label="Close Ask Carina"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={messagesRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'max-w-[92%] rounded-xl px-3 py-2 text-[13px] leading-relaxed',
                  message.role === 'user' &&
                    'ml-auto whitespace-pre-wrap bg-accent/15 text-text-primary',
                  message.role === 'assistant' &&
                    'mr-auto bg-elevated text-text-secondary',
                  message.role === 'error' &&
                    'mr-auto whitespace-pre-wrap bg-danger/10 text-danger',
                )}
              >
                {message.role === 'assistant' && message.content ? (
                  <AivaChatMarkdown content={message.content} className="text-[13px] [&_p]:text-[13px] [&_li]:text-[13px]" />
                ) : (
                  message.content || (sending ? '...' : '')
                )}
              </div>
            ))}
          </div>

          <div className="shrink-0 space-y-2 border-t border-border px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void escalate()}
                disabled={escalating || Boolean(escalatedId)}
                className="rounded-md border border-border px-2 py-1 text-[11px] text-text-secondary hover:bg-elevated disabled:opacity-50"
              >
                {escalating
                  ? 'Escalating...'
                  : escalatedId
                    ? 'Escalated'
                    : 'Escalate to human support'}
              </button>
              <a
                href="/aiva/help"
                className="text-[11px] text-accent hover:underline"
                onClick={() => setOpen(false)}
              >
                Help centre
              </a>
            </div>
            <form onSubmit={(e) => void sendMessage(e)} className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
                rows={2}
                placeholder="Ask how to use Aiva..."
                className="max-h-28 min-h-[2.5rem] flex-1 resize-none rounded-lg border border-border bg-elevated px-2.5 py-2 text-sm text-text-primary outline-none focus:ring-1 focus:ring-accent/40"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-white disabled:opacity-50"
                aria-label="Send"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'pointer-events-auto inline-flex shrink-0 items-center justify-center shadow-lg',
          'hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-accent/40',
          open
            ? 'h-10 w-10 rounded-full bg-accent text-white'
            : 'rounded-full bg-accent px-3 py-2 text-xs font-semibold text-white',
        )}
        aria-expanded={open}
        aria-label={open ? 'Close Ask Carina' : 'Get help'}
        title={open ? 'Close Ask Carina' : 'Get help'}
      >
        {open ? <X className="h-4 w-4" /> : 'Get help'}
      </button>
    </div>
  );
}
