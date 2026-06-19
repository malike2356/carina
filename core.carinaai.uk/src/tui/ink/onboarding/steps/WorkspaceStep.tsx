import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { StepChrome } from '../components/StepChrome.js';
import { DEFAULT_WORKSPACE_NAME } from '../types.js';

export function WorkspaceStep({
  onNext,
}: {
  onNext: (name: string) => void;
}) {
  const [name, setName] = useState(DEFAULT_WORKSPACE_NAME);

  useInput((_input, key) => {
    if (key.escape) onNext(DEFAULT_WORKSPACE_NAME);
  });

  return (
    <StepChrome
      step={1}
      title="What should I call you?"
      hint={'This is your workspace name. You can change it later.\nThink of it as naming your ship.'}
    >
      <Text dimColor>Workspace name</Text>
      <Box marginTop={1}>
        <Text color="#58a6ff">{' > '}</Text>
        <TextInput
          value={name}
          onChange={setName}
          onSubmit={(value) => onNext(value.trim() || DEFAULT_WORKSPACE_NAME)}
          placeholder={DEFAULT_WORKSPACE_NAME}
        />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Enter to continue with this name.</Text>
      </Box>
    </StepChrome>
  );
}
