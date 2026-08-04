'use client';

import { RotateCcw, Trash2 } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import type { ChatMessage } from './types';

interface DeletedMessageProps {
  message: ChatMessage;
  onRestore?: (message: ChatMessage) => void;
}

export function DeletedMessage({ message, onRestore }: DeletedMessageProps) {
  return (
    <div className="flex max-w-[85%] flex-col items-start gap-1">
      <div className="rounded-2xl rounded-tl-sm border border-border bg-elevated px-4 py-3 text-sm text-text-muted">
        <div className="flex items-center gap-2">
          <Trash2 className="h-3.5 w-3.5" />
          <span>This message was deleted.</span>
        </div>
      </div>
      {onRestore && (
        <IconButton label="Restore message" size="sm" onClick={() => onRestore(message)}>
          <RotateCcw className="h-3 w-3" />
        </IconButton>
      )}
    </div>
  );
}
