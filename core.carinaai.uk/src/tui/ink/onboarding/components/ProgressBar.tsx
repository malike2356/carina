import React from 'react';
import { Box, Text } from 'ink';
import { ONBOARDING_STEP_COUNT } from '../copy.js';
import { renderProgressBar } from './progress-bar.js';

interface ProgressBarProps {
  current: number;
  total?: number;
}

export function ProgressBar({ current, total = ONBOARDING_STEP_COUNT }: ProgressBarProps) {
  const bar = renderProgressBar(current, total);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text dimColor>{'─'.repeat(45)}</Text>
      <Text dimColor>{`Progress: ${bar} ${current}/${total}`}</Text>
    </Box>
  );
}

export { renderProgressBar } from './progress-bar.js';
