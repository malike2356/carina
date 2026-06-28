'use client';

import { cn } from '@/lib/utils';
import type { EditorEngine } from './types';

interface EditorEngineSwitchProps {
  engine: EditorEngine;
  onChange: (engine: EditorEngine) => void;
  disabled?: boolean;
}

const OPTIONS: Array<{ id: EditorEngine; label: string; hint: string }> = [
  { id: 'mdx', label: 'MDX', hint: 'Markdown WYSIWYG' },
  { id: 'tiptap', label: 'Rich', hint: 'Tiptap rich text' },
];

export function EditorEngineSwitch({ engine, onChange, disabled }: EditorEngineSwitchProps) {
  return (
    <div
      className="inline-flex items-center rounded-md border border-border bg-surface p-0.5"
      role="group"
      aria-label="Editor engine"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          disabled={disabled}
          title={option.hint}
          onClick={() => onChange(option.id)}
          className={cn(
            'rounded px-2.5 py-1 text-xs font-medium transition-colors',
            engine === option.id
              ? 'bg-elevated text-text-primary'
              : 'text-text-muted hover:text-text-secondary',
            disabled && 'opacity-50',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
