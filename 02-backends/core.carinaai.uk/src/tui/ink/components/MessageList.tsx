import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import type { ChatMessage } from '../hooks/useMessages.js';
import { UserMessage } from './UserMessage.js';
import { AssistantMessage } from './AssistantMessage.js';
import { StreamingMessage } from './StreamingMessage.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { useKeyboard } from '../hooks/useKeyboard.js';
import { computeResponsiveFrame } from '../../responsive-frame.js';

interface Props {
  messages: ChatMessage[];
  isStreaming: boolean;
  inputFocused?: boolean;
}

export function MessageList({ messages, isStreaming, inputFocused = true }: Props) {
  const { columns, rows } = useTerminalSize();
  const frame = useMemo(() => computeResponsiveFrame(columns, rows), [columns, rows]);
  const reservedRows = frame.statusBarMode === 'full' ? 5 : frame.statusBarMode === 'compact' ? 4 : 3;
  const listHeight = Math.max(4, frame.rows - reservedRows);
  const [scrollOffset, setScrollOffset] = useState(0);

  useKeyboard(!inputFocused, (_input, key) => {
    if (key.upArrow) setScrollOffset((offset) => Math.max(0, offset - 1));
    if (key.downArrow) setScrollOffset((offset) => offset + 1);
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

  useEffect(() => {
    setScrollOffset((offset) => Math.min(offset, maxScroll));
  }, [maxScroll]);

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      overflow="hidden"
      paddingX={1}
      width={frame.columns}
      height={listHeight}
    >
      {visible.map((msg) =>
        msg.role === 'user'
          ? <UserMessage key={msg.id} message={msg} />
          : <AssistantMessage key={msg.id} message={msg} />,
      )}
      {isStreaming && lastAssistant && (
        <StreamingMessage message={lastAssistant} />
      )}
      {visible.length === 0 && !isStreaming && (
        <Text dimColor>Type a message, or /help for commands.</Text>
      )}
    </Box>
  );
}
