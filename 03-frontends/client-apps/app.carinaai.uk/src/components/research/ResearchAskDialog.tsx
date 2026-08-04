'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { GripVertical, Loader2, MessageSquare, Send, X } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { plainResearchTitle } from '@/lib/research-plain-title';
import { sanitizeCarinaProse } from '@/lib/writing-style';
import { cn } from '@/lib/utils';

type AskMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type ResearchAskDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  query: string;
  initialQuestion?: string;
};

type Offset = { x: number; y: number };

export function ResearchAskDialog({
  open,
  onOpenChange,
  jobId,
  query,
  initialQuestion = '',
}: ResearchAskDialogProps) {
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pendingSeedRef = useRef<string | null>(null);
  const messagesRef = useRef<AskMessage[]>([]);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      pendingSeedRef.current = null;
      setDraft('');
      setMessages([]);
      setError(null);
      setBusy(false);
      setOffset({ x: 0, y: 0 });
      return;
    }
    const seed = initialQuestion.trim();
    if (seed && pendingSeedRef.current !== seed) {
      pendingSeedRef.current = seed;
      void runAsk(seed, []);
    }
  }, [open, initialQuestion, jobId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  function onDragPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, textarea')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
  }

  function onDragPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const nextX = drag.originX + (event.clientX - drag.startX);
    const nextY = drag.originY + (event.clientY - drag.startY);
    const maxX = Math.max(40, window.innerWidth / 2 - 40);
    const maxY = Math.max(40, window.innerHeight / 2 - 40);
    setOffset({
      x: Math.max(-maxX, Math.min(maxX, nextX)),
      y: Math.max(-maxY, Math.min(maxY, nextY)),
    });
  }

  function onDragPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    }
  }

  async function runAsk(question: string, history: AskMessage[]) {
    const clean = sanitizeCarinaProse(question.trim());
    if (!clean) return;

    const userMessage: AskMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: clean,
    };
    setMessages([...history, userMessage]);
    setDraft('');
    setBusy(true);
    setError(null);

    const assistantId = crypto.randomUUID();
    setMessages([...history, userMessage, { id: assistantId, role: 'assistant', content: '' }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`/api/research/${jobId}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: clean,
          history: history.map((row) => ({ role: row.role, content: row.content })),
        }),
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `Ask failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload) as {
              type?: string;
              content?: string;
              error?: string;
            };
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.type === 'text' && parsed.content) {
              assistantText += parsed.content;
              const snapshot = assistantText;
              setMessages((prev) =>
                prev.map((row) =>
                  row.id === assistantId ? { ...row, content: snapshot } : row,
                ),
              );
            }
          } catch (err) {
            if (err instanceof SyntaxError) continue;
            throw err;
          }
        }
      }

      if (!assistantText.trim()) {
        setMessages((prev) =>
          prev.map((row) =>
            row.id === assistantId
              ? { ...row, content: 'No answer returned. Try again.' }
              : row,
          ),
        );
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const detail = err instanceof Error ? err.message : 'Ask failed';
      setError(detail);
      setMessages((prev) =>
        prev.filter((row) => !(row.id === assistantId && !row.content.trim())),
      );
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy || !draft.trim()) return;
    void runAsk(draft, messagesRef.current);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/40" />
        <div className="pointer-events-none fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className={cn(
              'pointer-events-auto relative flex max-h-[85vh] w-full max-w-xl',
              'flex-col gap-0 overflow-hidden rounded-xl border border-border bg-surface',
              'text-text-primary shadow-xl outline-none',
            )}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px)`,
            }}
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
          <div
            className="cursor-grab touch-none select-none border-b border-border px-4 py-3 active:cursor-grabbing"
            onPointerDown={onDragPointerDown}
            onPointerMove={onDragPointerMove}
            onPointerUp={onDragPointerUp}
            onPointerCancel={onDragPointerUp}
          >
            <div className="flex items-start gap-2 pr-8">
              <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <DialogPrimitive.Title className="flex items-center gap-2 text-base font-semibold text-text-primary">
                  <MessageSquare className="h-4 w-4 text-accent" />
                  Ask about this paper
                </DialogPrimitive.Title>
                <p className="mt-1 line-clamp-2 text-xs text-text-secondary">
                  {plainResearchTitle(query)}
                </p>
                <p className="mt-0.5 text-[11px] text-text-muted">
                  Drag the header to move. The paper stays on this page.
                </p>
              </div>
            </div>
            <DialogPrimitive.Close
              className="absolute right-3 top-3 rounded-md p-1 text-text-secondary hover:bg-elevated hover:text-text-primary"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="min-h-[220px] flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {messages.length === 0 && !busy ? (
              <p className="text-sm text-text-secondary">
                Ask a question about findings, sources, or whether a claim is supported.
              </p>
            ) : null}
            {messages.map((row) => (
              <div
                key={row.id}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap',
                  row.role === 'user'
                    ? 'ml-8 bg-accent font-medium text-white'
                    : 'mr-4 border border-border bg-elevated text-text-primary',
                )}
              >
                {row.content || (busy ? '...' : '')}
              </div>
            ))}
            {error ? <p className="text-xs text-danger">{error}</p> : null}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={onSubmit}
            className="flex items-end gap-2 border-t border-border bg-base px-4 py-3"
          >
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={2}
              placeholder="Ask something about this paper..."
              disabled={busy}
              className="min-h-[44px] min-w-0 flex-1 resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent/50"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  if (busy || !draft.trim()) return;
                  void runAsk(draft, messagesRef.current);
                }
              }}
            />
            <Button type="submit" size="sm" disabled={busy || !draft.trim()} className="shrink-0">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Ask
            </Button>
          </form>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
