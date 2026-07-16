import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme/colors.js';

interface Props {
  model: string;
  sessionName: string;
  tokenCount: number;
  connectionStatus: 'connecting' | 'ok' | 'error';
  promptRefreshPending?: boolean;
}

function statusDot(status: Props['connectionStatus']): string {
  if (status === 'ok') return '*';
  if (status === 'connecting') return 'o';
  return 'x';
}

function statusColor(status: Props['connectionStatus']): string {
  if (status === 'ok') return colors.success;
  if (status === 'connecting') return colors.warning;
  return colors.error;
}

export function StatusBar({
  model,
  sessionName,
  tokenCount,
  connectionStatus,
  promptRefreshPending,
}: Props) {
  return (
    <Box paddingX={1}>
      <Box width="33%">
        <Text color={statusColor(connectionStatus)}>{statusDot(connectionStatus)} </Text>
        <Text>{model}</Text>
        {promptRefreshPending ? <Text color={colors.warning}>  refresh pending</Text> : null}
      </Box>
      <Box width="34%" justifyContent="center">
        <Text dimColor>{sessionName}</Text>
      </Box>
      <Box width="33%" justifyContent="flex-end">
        <Text dimColor>
          {tokenCount} tok  [^M model] [^S session] [q quit]
        </Text>
      </Box>
    </Box>
  );
}
