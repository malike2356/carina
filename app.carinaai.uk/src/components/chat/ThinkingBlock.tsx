'use client';

import { useState } from 'react';
import { Brain, ChevronDown, ChevronRight } from 'lucide-react';

export function ThinkingBlock({ content }: { content: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-border bg-elevated">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-text-muted transition-colors hover:text-text-secondary"
      >
        <Brain className="h-3 w-3 shrink-0 text-accent" />
        <span className="flex-1">Thinking process</span>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      {open && (
        <div className="max-h-64 overflow-y-auto whitespace-pre-wrap border-t border-border px-3 py-2 font-mono text-xs leading-relaxed text-text-muted">
          {content}
        </div>
      )}
    </div>
  );
}
