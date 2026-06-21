'use client';

import { useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { useAppearance } from '@/hooks/useAppearance';
import { CopyButton } from './CopyButton';
import { MarkdownContent } from './MarkdownContent';
import { MessageMetadata } from './MessageMetadata';
import { ThinkingBlock } from './ThinkingBlock';
import { ToolCallBlock } from './ToolCallBlock';
import { ChatErrorMessage } from './ChatErrorMessage';
import type { ChatMessage } from './types';

interface AssistantMessageProps {
  message: ChatMessage;
  streaming?: boolean;
  onDelete?: (id: string) => void;
  onRetry?: () => void;
}

export function AssistantMessage({ message, streaming, onDelete, onRetry }: AssistantMessageProps) {
  const [hovered, setHovered] = useState(false);
  const appearance = useAppearance();
  const showMeta = !streaming && (
    (appearance.showTokenCounts && message.outputTokens > 0) ||
    message.durationMs > 0 ||
    (appearance.showModelBadge && Boolean(message.model))
  );
  const createdAt = new Date(message.createdAt);
  const timestamp = Number.isNaN(createdAt.getTime())
    ? ''
    : createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className="flex max-w-[85%] flex-col items-start gap-1"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {appearance.showModelBadge && message.model && (
        <span className="px-0.5 text-[10px] font-medium text-text-muted">
          {message.model}
        </span>
      )}

      {message.thinkingContent && (
        <div className="w-full">
          <ThinkingBlock content={message.thinkingContent} />
        </div>
      )}

      {message.toolCalls.length > 0 && (
        <div className="mb-2 w-full space-y-2">
          {message.toolCalls.map((toolCall, index) => (
            <ToolCallBlock key={toolCall.id || index} toolCall={toolCall} />
          ))}
        </div>
      )}

      <div className="chat-message-content max-w-full overflow-hidden rounded-2xl rounded-tl-sm bg-bubble-assistant px-4 py-3 text-text-primary">
        {message.errorMessage ? (
          <ChatErrorMessage message={message.errorMessage} code={message.errorCode} />
        ) : streaming ? (
          <div className="flex items-end gap-1">
            <span className="whitespace-pre-wrap">{message.content}</span>
            {appearance.showTypingDots && (
              <span className="mb-0.5 ml-0.5 inline-block h-4 w-0.5 shrink-0 animate-pulse bg-accent" />
            )}
          </div>
        ) : (
          <MarkdownContent content={message.content} />
        )}
      </div>

      <div className="flex items-center gap-2">
        {showMeta && (
          <MessageMetadata
            inputTokens={message.inputTokens}
            outputTokens={message.outputTokens}
            durationMs={message.durationMs}
            model={appearance.showModelBadge ? message.model : undefined}
          />
        )}
        {appearance.showTimestamps && timestamp && (
          <span className="font-mono text-[10px] text-text-muted">{timestamp}</span>
        )}
        <div className={`flex items-center gap-0.5 transition-opacity ${hovered ? 'opacity-100' : 'opacity-0'}`}>
          <CopyButton text={message.content} size="sm" />
          {onRetry && (
            <IconButton label="Regenerate response" size="sm" onClick={onRetry}>
              <RotateCcw className="h-3 w-3" />
            </IconButton>
          )}
          {onDelete && (
            <IconButton label="Delete message" size="sm" onClick={() => onDelete(message.id)}>
              <Trash2 className="h-3 w-3 text-danger" />
            </IconButton>
          )}
        </div>
      </div>
    </div>
  );
}
