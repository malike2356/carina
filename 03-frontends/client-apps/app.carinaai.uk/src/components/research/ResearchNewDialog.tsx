'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { GripVertical, Loader2, Search, X } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import {
  CITATION_STYLES,
  type CitationStyleId,
} from '@/lib/research-citation-styles';
import { plainResearchTitle } from '@/lib/research-plain-title';
import { cn } from '@/lib/utils';

const MODE_OPTIONS = [
  { id: 'auto', label: 'Auto', hint: 'Best approach' },
  { id: 'product', label: 'Product', hint: 'Company or service' },
  { id: 'compare', label: 'Compare', hint: 'Side by side' },
  { id: 'how-to', label: 'How-to', hint: 'Step by step' },
  { id: 'fact-check', label: 'Fact-check', hint: 'Verify a claim' },
] as const;

const DEPTH_PRESETS = [
  { id: 'quick', label: 'Quick', rounds: 3, hint: '~12 sources' },
  { id: 'standard', label: 'Standard', rounds: 6, hint: '~24 sources' },
  { id: 'deep', label: 'Deep', rounds: 9, hint: '~48 sources' },
] as const;

type ResearchJob = {
  id: string;
  query: string;
  mode: string;
  citationStyle?: string | null;
  status: string;
  rounds: number;
  output: string | null;
  sources: unknown;
  error: string | null;
  createdAt: string;
};

type Offset = { x: number; y: number };

type ResearchNewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (job: ResearchJob) => void;
};

export function ResearchNewDialog({
  open,
  onOpenChange,
  onCreated,
}: ResearchNewDialogProps) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('auto');
  const [rounds, setRounds] = useState(6);
  const [citationStyle, setCitationStyle] = useState<CitationStyleId>('apa7');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const queryRef = useRef<HTMLTextAreaElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const activeDepth =
    DEPTH_PRESETS.find((item) => item.rounds === rounds)?.id
    ?? (rounds <= 3 ? 'quick' : rounds <= 6 ? 'standard' : 'deep');

  useEffect(() => {
    if (!open) {
      setQuery('');
      setMode('auto');
      setRounds(6);
      setCitationStyle('apa7');
      setSubmitting(false);
      setError(null);
      setOffset({ x: 0, y: 0 });
      return;
    }
    const t = window.setTimeout(() => queryRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open]);

  function onDragPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select')) return;
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

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedQuery = plainResearchTitle(query);
    if (trimmedQuery.length < 5 || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmedQuery,
          mode,
          rounds,
          citationStyle,
        }),
      });
      const data = (await response.json()) as { data?: ResearchJob; error?: string };
      if (!response.ok || !data.data) {
        setError(data.error ?? 'Could not start research');
        return;
      }
      onCreated(data.data);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start research');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/40" />
        <div className="pointer-events-none fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className={cn(
              'pointer-events-auto flex max-h-[min(85vh,40rem)] w-full max-w-lg',
              'flex-col overflow-hidden rounded-xl border border-border bg-surface',
              'text-text-primary shadow-xl outline-none',
            )}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px)`,
            }}
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
          <div
            className="flex cursor-grab touch-none select-none items-center gap-2 border-b border-border px-4 py-3 active:cursor-grabbing"
            onPointerDown={onDragPointerDown}
            onPointerMove={onDragPointerMove}
            onPointerUp={onDragPointerUp}
            onPointerCancel={onDragPointerUp}
          >
            <GripVertical className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
            <DialogPrimitive.Title className="min-w-0 flex-1 text-sm font-semibold text-text-primary">
              New research
            </DialogPrimitive.Title>
            <p className="hidden text-[11px] text-text-muted sm:block">Drag to move</p>
            <DialogPrimitive.Close
              className="rounded-md p-1 text-text-muted hover:bg-overlay hover:text-text-primary"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          <form
            onSubmit={(event) => void onSubmit(event)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
              <div>
                <label
                  htmlFor="research-new-query"
                  className="mb-1.5 block text-[11px] font-medium text-text-muted"
                >
                  Research question
                </label>
                <textarea
                  ref={queryRef}
                  id="research-new-query"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="What do you want to research?"
                  rows={3}
                  className="w-full resize-y rounded-md border border-border bg-base px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent/50"
                />
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-medium text-text-muted">Citation style</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {CITATION_STYLES.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setCitationStyle(style.id)}
                      className={cn(
                        'rounded-md border px-2 py-1.5 text-center text-[11px] font-semibold transition-colors',
                        citationStyle === style.id
                          ? 'border-accent/40 bg-accent/10 text-text-primary'
                          : 'border-border bg-elevated text-text-secondary hover:bg-overlay',
                      )}
                    >
                      {style.shortLabel}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-medium text-text-muted">Mode</p>
                <div className="flex flex-wrap gap-1.5">
                  {MODE_OPTIONS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      title={item.hint}
                      onClick={() => setMode(item.id)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                        mode === item.id
                          ? 'border-accent/40 bg-accent/10 text-text-primary'
                          : 'border-border bg-elevated text-text-secondary hover:bg-overlay',
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-medium text-text-muted">Depth</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {DEPTH_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setRounds(preset.rounds)}
                      className={cn(
                        'rounded-md border px-2 py-2 text-left transition-colors',
                        activeDepth === preset.id
                          ? 'border-accent/40 bg-accent/10'
                          : 'border-border bg-elevated hover:bg-overlay',
                      )}
                    >
                      <span className="block text-[11px] font-semibold text-text-primary">
                        {preset.label}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-text-muted">
                        {preset.hint}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {error ? (
                <p className="rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-xs text-red-300">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="shrink-0 border-t border-border px-4 py-3">
              <Button
                type="submit"
                size="sm"
                disabled={submitting || plainResearchTitle(query).length < 5}
                className="w-full"
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                {submitting
                  ? 'Starting'
                  : `Start ${DEPTH_PRESETS.find((p) => p.id === activeDepth)?.label ?? 'Standard'} · ${CITATION_STYLES.find((s) => s.id === citationStyle)?.shortLabel}`}
              </Button>
            </div>
          </form>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
