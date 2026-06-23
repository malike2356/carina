import React from 'react';
import { Box, Text } from 'ink';
import { ProgressBar } from './ProgressBar.js';

interface StepChromeProps {
  step: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}

export function StepChrome({ step, title, hint, children }: StepChromeProps) {
  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold color="#58a6ff">{`Step ${step}/6; ${title}`}</Text>
      {hint && (
        <Box marginTop={1} flexDirection="column">
          {hint.split('\n').map((line) => (
            <Text key={line} dimColor>{line}</Text>
          ))}
        </Box>
      )}
      <Box marginTop={1} flexDirection="column">
        {children}
      </Box>
      <ProgressBar current={step} />
    </Box>
  );
}
