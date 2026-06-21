import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import os from 'node:os';
import path from 'node:path';
import { StepChrome } from '../components/StepChrome.js';

function defaultHomeDir(): string {
  return path.join(os.homedir(), '.carina');
}

export function HomeStep({
  onNext,
}: {
  onNext: (homeDir: string) => void;
}) {
  const [homeDir, setHomeDir] = useState(defaultHomeDir());

  useInput((_input, key) => {
    if (key.escape) onNext(defaultHomeDir());
  });

  return (
    <StepChrome
      step={4}
      title="Where should I live?"
      hint={'I need a home directory for my brain, skills, and memories.\nThe default is fine for most people.'}
    >
      <Text dimColor>Carina home</Text>
      <Box marginTop={1}>
        <Text color="#58a6ff">{' > '}</Text>
        <TextInput
          value={homeDir}
          onChange={setHomeDir}
          onSubmit={(value) => onNext(value.trim() || defaultHomeDir())}
          placeholder={defaultHomeDir()}
        />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Enter to accept this path.</Text>
      </Box>
    </StepChrome>
  );
}
