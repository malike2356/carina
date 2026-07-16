import React, { useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { buildDebugState, type DebugStateInput } from '../../debug/debug-state.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { computeResponsiveFrame, truncateLabel } from '../../responsive-frame.js';
import { getActiveSkin } from '../../skins/skin-store.js';

interface Props extends DebugStateInput {
  onClose: () => void;
}

export function DebugOverlay({ onClose, ...input }: Props) {
  const { columns, rows } = useTerminalSize();
  const frame = useMemo(() => computeResponsiveFrame(columns, rows), [columns, rows]);
  const skin = getActiveSkin();
  const state = useMemo(() => buildDebugState(input), [input]);

  useInput((_input, key) => {
    if (key.escape) onClose();
  });

  return (
    <Box flexDirection="column" paddingX={1} width={frame.columns} height={Math.max(6, frame.bodyHeight)}>
      <Text color={skin.accent} bold>Debug overlay</Text>
      <Text dimColor>Sanitized runtime state. Esc closes.</Text>
      {state.lines.slice(1, Math.max(6, frame.bodyHeight)).map((line, index) => (
        <Text key={`${line}-${index}`} wrap="truncate">
          {truncateLabel(line, frame.contentWidth)}
        </Text>
      ))}
    </Box>
  );
}
