import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { getActiveSkin } from '../../skins/skin-store.js';
import { buildToolCardModel } from '../../details/tool-card.js';

interface Props {
  toolName: string;
  args?: unknown;
  result?: unknown;
  duration?: number;
  isRunning: boolean;
  isError?: boolean;
}

const SPINNER = ['|', '/', '-', '\\'];

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

  useInput((input) => {
    if (input.toLowerCase() === 'x' && result !== undefined && !isError) {
      setExpanded((value) => !value);
    }
  });

  const card = buildToolCardModel({
    toolName,
    args,
    result,
    duration,
    isRunning,
    isError,
  });
  const statusColor = card.status === 'failed'
    ? skin.errorColor
    : card.status === 'running'
      ? skin.spinner.color
      : skin.successColor;

  return (
    <Box flexDirection="column" marginY={0}>
      <Text>
        <Text color={skin.accent} bold>{skin.toolPrefix} {card.toolName}</Text>
        {' '}
        {isRunning
          ? <Text color={skin.spinner.color}>{spinnerFrames[spinIdx]}</Text>
          : <Text color={statusColor}>{card.status}</Text>}
        {!isRunning && card.durationLabel && (
          <Text dimColor> ({card.durationLabel})</Text>
        )}
        {card.redacted && <Text dimColor> redacted</Text>}
      </Text>
      {card.argumentsSummary && (
        <Text dimColor wrap="truncate">{card.argumentsSummary}</Text>
      )}
      {isError && (
        <Box borderStyle="round" borderColor={skin.errorColor} paddingX={1}>
          <Text color={skin.errorColor}>{card.errorSummary || 'Tool failed'}</Text>
        </Box>
      )}
      {!isError && result !== undefined && !expanded && (
        <Text dimColor>(x to expand result)</Text>
      )}
      {!isError && result !== undefined && expanded && (
        <Box borderStyle="round" borderColor={skin.dimColor} paddingX={1}>
          <Text dimColor wrap="wrap">{card.outputSummary}</Text>
        </Box>
      )}
    </Box>
  );
}
