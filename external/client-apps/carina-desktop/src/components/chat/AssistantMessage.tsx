import type { ChatMessage } from '../../store/chat.js';
import ThinkingBlock from './ThinkingBlock.js';
import ToolCallBlock from './ToolCallBlock.js';
import MarkdownContent from './MarkdownContent.js';
import MessageMetadata from './MessageMetadata.js';

interface Props {
  message: ChatMessage;
}

export default function AssistantMessage({ message }: Props) {
  function handleCopy() {
    void navigator.clipboard.writeText(message.content);
  }

  return (
    <div className="group flex gap-3 px-4 py-3">
      <div className="w-6 h-6 rounded-full bg-indigo-600 flex-shrink-0 flex items-center justify-center text-[10px] font-bold mt-0.5">
        C
      </div>
      <div className="flex-1 min-w-0">
        {message.thinkingContent && (
          <ThinkingBlock
            content={message.thinkingContent}
            isStreaming={message.isStreaming}
          />
        )}
        {message.toolCalls?.map((tc) => (
          <ToolCallBlock key={tc.id} toolCall={tc} />
        ))}
        {message.content && (
          <MarkdownContent content={message.content} />
        )}
        {message.isStreaming && !message.content && !message.thinkingContent && (
          <span className="inline-block w-2 h-4 bg-zinc-400 animate-pulse" />
        )}
        <MessageMetadata timestamp={message.timestamp} onCopy={handleCopy} />
      </div>
    </div>
  );
}
