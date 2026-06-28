import React from 'react';
import { Box, Text } from 'ink';
import type { ResponsiveFrame } from '../../responsive-frame.js';
import { fitLine, truncateLabel } from '../../responsive-frame.js';

interface Props {
  frame: ResponsiveFrame;
  version: string;
}

export function LauncherHeader({ frame, version }: Props) {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const session = process.env.CARINA_SESSION_LABEL?.trim() || '#7a2f4e';
  const user = process.env.CARINA_OPERATOR_NAME?.trim() || process.env.USER || 'Operator';
  const rule = '-'.repeat(Math.max(12, frame.contentWidth));

  return (
    <Box width={frame.columns} flexDirection="column" paddingX={1}>
      {frame.mode !== 'compact' && (
        <Box>
          <Text color="red">● </Text>
          <Text color="yellow">● </Text>
          <Text color="green">●</Text>
        </Box>
      )}
      <Box marginTop={frame.mode === 'compact' ? 0 : 1}>
        <Text color="cyan" bold>{'*'}</Text>
        <Text bold>{` CARINA  v${version}`}</Text>
      </Box>
      {frame.showTagline && (
        <Box marginTop={1}>
          <Text color="gray">{truncateLabel('ONE MEMORY. ONE AGENT. EVERYWHERE.', frame.contentWidth)}</Text>
        </Box>
      )}
      {frame.showSessionMeta && (
        <Box marginTop={1}>
          <Text color="gray">
            {fitLine([
              `User: ${truncateLabel(user, 16)}`,
              `Session: ${truncateLabel(session, 12)}`,
              time,
            ], frame.contentWidth)}
          </Text>
        </Box>
      )}
      <Text color="gray">{rule}</Text>
    </Box>
  );
}
