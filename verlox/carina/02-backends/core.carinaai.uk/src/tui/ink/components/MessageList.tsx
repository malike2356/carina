import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import type { ChatMessage } from '../hooks/useMessages.js';
import { UserMessage } from './UserMessage.js';
import { AssistantMessage } from './AssistantMessage.js';
import { StreamingMessage } from './StreamingMessage.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { useKeyboard } from '../hooks/useKeyboard.js';
import { computeResponsiveFrame } from '../../responsive-frame.js';
import { getActiveSkin } from '../../skins/skin-store.js';

interface Props {
  messages: ChatMessage[];
  isStreaming: boolean;
  inputFocused?: boolean;
  sessionId?: string;
  model?: string;
  connected?: boolean;
}

export function MessageList({
  messages,
  isStreaming,
  inputFocused = true,
  sessionId = 'pending',
  model = 'unknown',
  connected = false,
}: Props) {
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
        <EmptyCommandCenter
          width={frame.contentWidth}
          sessionId={sessionId}
          model={model}
          connected={connected}
          compact={frame.mode === 'compact'}
        />
      )}
    </Box>
  );
}

interface EmptyCommandCenterProps {
  width: number;
  sessionId: string;
  model: string;
  connected: boolean;
  compact: boolean;
}

function EmptyCommandCenter({
  width,
  sessionId,
  model,
  connected,
  compact,
}: EmptyCommandCenterProps) {
  const skin = getActiveSkin();
  const shortSession = sessionId.length > 12 ? sessionId.slice(0, 12) : sessionId;
  const commandLine = compact
    ? '/help  /timeline  /debug  /review'
    : '/help  /timeline  /debug  /review  /session  /model  /skin list';

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={skin.dimColor}
      paddingX={1}
      paddingY={1}
      width={width}
    >
      <Text color={skin.accent} bold>Carina Command Center</Text>
      <Text dimColor>
        Runtime ready. Type a message, or start with a slash command.
      </Text>
      <Box marginTop={1} flexDirection={compact ? 'column' : 'row'} gap={compact ? 0 : 2}>
        <Text dimColor>
          Session: <Text color={skin.accent}>{shortSession}</Text>
        </Text>
        <Text dimColor>
          Model: <Text color={skin.accent}>{model}</Text>
        </Text>
        <Text dimColor>
          Transport: <Text color={connected ? skin.successColor : skin.warningColor}>{connected ? 'Connected' : 'Checking'}</Text>
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>Try:</Text>
        <Text>{commandLine}</Text>
        {!compact && (
          <Text dimColor>Ctrl+D debug, Ctrl+S sessions, Ctrl+M models, Ctrl+R retry.</Text>
        )}
      </Box>
    </Box>
  );
}
