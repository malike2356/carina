import React from 'react';
import { Box, Text, useInput } from 'ink';
import { INK_CHAT_SHORTCUTS } from '../keyboard-shortcuts.js';
import { tokens } from '../theme/tokens.js';

interface HelpHintProps {
  onClose: () => void;
}

export function HelpHint({ onClose }: HelpHintProps) {
  useInput((input, key) => {
    if (key.escape || input === '?') onClose();
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={tokens.accentBlue}
      paddingX={2}
      paddingY={1}
      marginBottom={1}
    >
      <Text bold color={tokens.accentBlue}>Keyboard shortcuts</Text>
      <Box marginTop={1} flexDirection="column">
        {INK_CHAT_SHORTCUTS.map((row) => (
          <Text key={row.keys}>
            <Text color={tokens.accentBlue}>{row.keys.padEnd(22)}</Text>
            <Text dimColor>{row.action}</Text>
          </Text>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press Esc or ? to close</Text>
      </Box>
    </Box>
  );
}
