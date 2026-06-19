import React from 'react';
import { Box, Text, useInput } from 'ink';
import { QUICKSTART_LINES } from '../copy.js';

export function QuickstartTourStep({ onNext }: { onNext: () => void }) {
  useInput((_input, key) => {
    if (key.return) onNext();
  });

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold color="#58a6ff">QUICKSTART TOUR</Text>
      <Box marginTop={1}>
        <Text dimColor>{'─'.repeat(45)}</Text>
      </Box>
      <Box marginTop={1}>
        <Text color="#e6edf3">Here is what you can do with Carina:</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        {QUICKSTART_LINES.map((line) => (
          <Box key={line.label} flexDirection="column" marginBottom={1}>
            <Text>
              <Text bold color="#3fb950">{line.label.padEnd(14)}</Text>
              <Text color="#58a6ff">{line.command}</Text>
            </Text>
            <Text dimColor>{`  ${line.detail}`}</Text>
          </Box>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press Enter to start chatting, or type /help anytime.</Text>
      </Box>
    </Box>
  );
}
