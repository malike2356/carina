import React, { useState } from 'react';
import { Box, Text } from 'ink';
import type { ChatMessage } from '../hooks/useMessages.js';
import { UserMessage } from './UserMessage.js';
import { AssistantMessage } from './AssistantMessage.js';
import { StreamingMessage } from './StreamingMessage.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { useKeyboard } from '../hooks/useKeyboard.js';

interface Props {
  messages: ChatMessage[];
  isStreaming: boolean;
  inputFocused?: boolean;
}

export function MessageList({ messages, isStreaming, inputFocused = true }: Props) {
  const { rows } = useTerminalSize();
  const listHeight = Math.max(6, rows - 5);
  const [scrollOffset, setScrollOffset] = useState(0);

  useKeyboard(!inputFocused, (_input, key) => {
    if (key.upArrow) setScrollOffset((o) => Math.max(0, o - 1));
    if (key.downArrow) setScrollOffset((o) => o + 1);
  });

  const lastAssistant = messages.length > 0 && messages[messages.length - 1]?.role === 'assistant'
    ? messages[messages.length - 1]
    : null;
  const completed = isStreaming && lastAssistant
    ? messages.slice(0, -1)
    : messages;

  const maxScroll = Math.max(0, completed.length - listHeight);
  const clampedScroll = Math.min(scrollOffset, maxScroll);
  const visible = completed.slice(clampedScroll, clampedScroll + listHeight);

  return (
    <Box flexDirection="column" flexGrow={1} overflow="hidden" paddingX={1}>
      {visible.map((msg) =>
        msg.role === 'user'
          ? <UserMessage key={msg.id} message={msg} />
          : <AssistantMessage key={msg.id} message={msg} />,
      )}
      {isStreaming && lastAssistant && (
        <StreamingMessage message={lastAssistant} />
      )}
    </Box>
  );
}
