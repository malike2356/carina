import React from 'react';
import { Box, Text, useInput } from 'ink';
import { personalityLabel } from '../copy.js';
import type { OnboardingState } from '../types.js';

export function DoneStep({
  state,
  onFinish,
}: {
  state: OnboardingState;
  onFinish: () => void;
}) {
  useInput((_input, key) => {
    if (key.return) onFinish();
  });

  const name = state.workspaceName ?? 'Operator';

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text color="#3fb950" bold>All set! Your workspace is ready.</Text>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>
          {'Workspace  '}
          <Text color="#e6edf3">{state.workspaceName ?? 'My Workspace'}</Text>
        </Text>
        <Text dimColor>
          {'Provider   '}
          <Text color="#e6edf3">{state.provider ?? 'none'}</Text>
        </Text>
        <Text dimColor>
          {'Model      '}
          <Text color="#e6edf3">{state.model ?? 'none'}</Text>
        </Text>
        <Text dimColor>
          {'Profile    '}
          <Text color="#e6edf3">{personalityLabel(state.personality)}</Text>
        </Text>
        {state.homeDir && (
          <Text dimColor>
            {'Home       '}
            <Text color="#e6edf3">{state.homeDir}</Text>
          </Text>
        )}
      </Box>
      <Box marginTop={2} flexDirection="column">
        <Text dimColor>Type /help anytime to see what I can do.</Text>
        <Text dimColor>Run carina setup to change provider or workspace details.</Text>
      </Box>
      <Box marginTop={2}>
        <Text color="#e6edf3">{`Welcome to the family, ${name}. Let's build something great.`}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press Enter to start chatting.</Text>
      </Box>
    </Box>
  );
}
