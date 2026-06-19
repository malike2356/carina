import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { colors } from '../../theme/colors.js';

interface ClarifyPromptProps {
  question: string;
  options?: string[];
  onAnswer: (answer: string) => void;
}

export function ClarifyPrompt({ question, options, onAnswer }: ClarifyPromptProps) {
  const [input, setInput] = useState('');

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={colors.accent}
      paddingX={1}
      marginY={1}
    >
      <Text color={colors.accent} bold>Clarification needed</Text>
      <Box marginTop={1}>
        <Text wrap="wrap">{question}</Text>
      </Box>
      {options && options.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          {options.map((opt, i) => (
            <Text key={opt} dimColor>  [{i + 1}] {opt}</Text>
          ))}
        </Box>
      )}
      <Box marginTop={1}>
        <Text color={colors.accent}>{'> '}</Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={(value) => {
            const trimmed = value.trim();
            if (/^\d+$/.test(trimmed) && options?.length) {
              const idx = parseInt(trimmed, 10) - 1;
              if (options[idx]) {
                onAnswer(options[idx]);
                return;
              }
            }
            onAnswer(trimmed);
          }}
        />
      </Box>
    </Box>
  );
}
