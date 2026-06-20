import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { getActiveSkin } from '../../skins/skin-store.js';

interface Props {
  toolName: string;
  args?: unknown;
  result?: unknown;
  duration?: number;
  isRunning: boolean;
  isError?: boolean;
}

const SPINNER = ['|', '/', '-', '\\'];

function summarizeArgs(args: unknown): string {
  const raw = args !== undefined ? JSON.stringify(args) : '';
  return raw.length > 80 ? `${raw.slice(0, 80)}...` : raw;
}

export function ToolCallBlock({
  toolName,
  args,
  result,
  duration,
  isRunning,
  isError,
}: Props) {
  const skin = getActiveSkin();
  const spinnerFrames = skin.spinner.frames.length > 0 ? skin.spinner.frames : SPINNER;
  const [expanded, setExpanded] = useState(false);
  const [spinIdx, setSpinIdx] = useState(0);

  React.useEffect(() => {
    if (!isRunning) return undefined;
    const t = setInterval(() => setSpinIdx((i) => (i + 1) % spinnerFrames.length), 200);
    return () => clearInterval(t);
  }, [isRunning, spinnerFrames.length]);

  const resultText = result !== undefined ? JSON.stringify(result, null, 2) : '';
  const errorMsg = isError && result !== undefined ? String(result) : '';

  return (
    <Box flexDirection="column" marginY={0}>
      <Text>
        <Text color={skin.accent} bold>{skin.toolPrefix} {toolName}</Text>
        {' '}
        {isRunning
          ? <Text color={skin.spinner.color}>{spinnerFrames[spinIdx]}</Text>
          : <Text color={skin.successColor}>Done</Text>}
        {!isRunning && duration !== undefined && (
          <Text dimColor> ({Math.round(duration)}ms)</Text>
        )}
      </Text>
      {args !== undefined && (
        <Text dimColor wrap="truncate">{summarizeArgs(args)}</Text>
      )}
      {isError && (
        <Box borderStyle="round" borderColor={skin.errorColor} paddingX={1}>
          <Text color={skin.errorColor}>{errorMsg || 'Tool failed'}</Text>
        </Box>
      )}
      {!isError && result !== undefined && !expanded && (
        <Text dimColor>(x to expand result)</Text>
      )}
      {!isError && result !== undefined && expanded && (
        <Box borderStyle="round" borderColor={skin.dimColor} paddingX={1}>
          <Text dimColor wrap="wrap">{resultText.slice(0, 2000)}</Text>
        </Box>
      )}
    </Box>
  );
}
