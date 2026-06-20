import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme/colors.js';

interface Props {
  content: string;
  isComplete: boolean;
  defaultCollapsed?: boolean;
}

const SPINNER = ['|', '/', '-', '\\'];

export function ThinkingBlock({ content, isComplete, defaultCollapsed = true }: Props) {
  const [expanded, setExpanded] = useState(!defaultCollapsed);
  const lineCount = content.split('\n').filter(Boolean).length || 1;
  const [spinIdx, setSpinIdx] = React.useState(0);

  React.useEffect(() => {
    if (isComplete) return undefined;
    const t = setInterval(() => setSpinIdx((i) => (i + 1) % SPINNER.length), 200);
    return () => clearInterval(t);
  }, [isComplete]);

  if (!expanded) {
    return (
      <Box marginY={0}>
        <Text dimColor italic>
          [{isComplete ? 'Reasoning' : 'Thinking'}... {lineCount} lines] (t to expand)
          {!isComplete && ` ${SPINNER[spinIdx]}`}
        </Text>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={colors.dim}
      paddingX={1}
      marginY={0}
    >
      <Text dimColor italic>
        {isComplete ? 'Reasoning' : `Thinking ${SPINNER[spinIdx]}`}
      </Text>
      <Text dimColor wrap="wrap">{content || '...'}</Text>
    </Box>
  );
}