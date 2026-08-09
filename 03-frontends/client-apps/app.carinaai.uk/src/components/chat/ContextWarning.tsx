'use client';

import { AlertTriangle } from 'lucide-react';
import { warnTone } from '@/lib/ui-tones';
import { cn } from '@/lib/utils';

interface ContextWarningProps {
  usedTokens: number;
  maxTokens: number;
  onNewSession: () => void;
}

export function ContextWarning({ usedTokens, maxTokens, onNewSession }: ContextWarningProps) {
  if (maxTokens <= 0) return null;
  const percent = (usedTokens / maxTokens) * 100;
  if (percent < 80) return null;

  const critical = percent >= 95;

  return (
    <div
      className={cn(
        'mb-3 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-xs',
        critical
          ? 'border-danger/30 bg-danger/10 text-danger'
          : cn(warnTone.box, warnTone.textMuted),
      )}
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span>
        {critical
          ? `Context window is ${percent.toFixed(0)}% full. Carina may lose earlier detail.`
          : `Context window is ${percent.toFixed(0)}% full. Consider summarizing soon.`}
      </span>
      {critical && (
        <button
          type="button"
          onClick={onNewSession}
          className="ml-auto rounded-md border border-current px-2 py-1 text-[11px] font-medium"
        >
          Start new session
        </button>
      )}
    </div>
  );
}
