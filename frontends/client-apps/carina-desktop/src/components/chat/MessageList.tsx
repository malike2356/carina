import { useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { $messages } from '../../store/chat.js';
import AssistantMessage from './AssistantMessage.js';
import StreamingMessage from './StreamingMessage.js';
import UserMessage from './UserMessage.js';

interface Props {
  onEditUserMessage?: (messageId: string, newContent: string) => void;
}

export default function MessageList({ onEditUserMessage }: Props) {
  const messages = useStore($messages);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  useEffect(() => {
    if (messages.length > 0) {
      virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: 'smooth' });
    }
  }, [messages.length, messages[messages.length - 1]?.content]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
        Start a conversation
      </div>
    );
  }

  return (
    <Virtuoso
      ref={virtuosoRef}
      data={messages}
      className="flex-1"
      followOutput="smooth"
      itemContent={(_, message) => {
        if (message.role === 'user') {
          return (
            <UserMessage
              key={message.id}
              message={message}
              onEdit={onEditUserMessage
                ? (newContent) => onEditUserMessage(message.id, newContent)
                : undefined}
            />
          );
        }
        if (message.isStreaming) {
          return <StreamingMessage key={message.id} message={message} />;
        }
        return <AssistantMessage key={message.id} message={message} />;
      }}
    />
  );
}
