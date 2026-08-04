import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../../theme/colors.js';

export function SudoIndicator({ remainingMs }: { remainingMs: number }) {
  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1000);

  return (
    <Box paddingX={1}>
      <Text color={colors.warning} bold>
        [SUDO MODE - {minutes}m {seconds.toString().padStart(2, '0')}s remaining] Ctrl+X to cancel
      </Text>
    </Box>
  );
}
