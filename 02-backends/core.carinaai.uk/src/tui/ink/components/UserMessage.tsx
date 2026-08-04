import React from 'react';
import { Box, Text } from 'ink';
import type { ChatMessage } from '../hooks/useMessages.js';
import { colors } from '../theme/colors.js';

interface Props {
  message: ChatMessage;
}

export function UserMessage({ message }: Props) {
  const text = message.parts
    .filter((p) => p.kind === 'text')
    .map((p) => p.content)
    .join('');

  return (
    <Box justifyContent="flex-end" marginBottom={1} paddingLeft={4}>
      <Text color={message.dimmed ? 'gray' : colors.accent} wrap="wrap">
        {text}
      </Text>
    </Box>
  );
}
