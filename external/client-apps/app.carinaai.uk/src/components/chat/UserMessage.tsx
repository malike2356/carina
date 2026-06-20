'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { useAppearance } from '@/hooks/useAppearance';
import { CopyButton } from './CopyButton';
import type { ChatMessage } from './types';

interface UserMessageProps {
  message: ChatMessage;
  onDelete?: (id: string) => void;
}

export function UserMessage({ message, onDelete }: UserMessageProps) {
  const [hovered, setHovered] = useState(false);
  const appearance = useAppearance();
  const createdAt = new Date(message.createdAt);
  const timestamp = Number.isNaN(createdAt.getTime())
    ? ''
    : createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className="flex flex-col items-end gap-1"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={`flex items-center gap-0.5 transition-opacity ${hovered ? 'opacity-100' : 'opacity-0'}`}>
        <CopyButton text={message.content} size="sm" />
        {onDelete && (
          <IconButton label="Delete message" size="sm" onClick={() => onDelete(message.id)}>
            <Trash2 className="h-3 w-3 text-danger" />
          </IconButton>
        )}
      </div>
      <div className="chat-message-content max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-bubble-user px-4 py-3 leading-relaxed text-text-primary">
        {message.content}
      </div>
      {appearance.showTimestamps && timestamp && (
        <span className="font-mono text-[10px] text-text-muted">{timestamp}</span>
      )}
    </div>
  );
}
