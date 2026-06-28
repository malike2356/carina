import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { getActiveSkin } from '../../skins/skin-store.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { computeResponsiveFrame, fitLine, truncateLabel } from '../../responsive-frame.js';

export interface StatusLineProps {
  sessionId: string;
  model: string;
  tokenCount: number;
  connected: boolean;
  streaming: boolean;
}

export function StatusLine({
  sessionId,
  model,
  tokenCount,
  connected,
  streaming,
}: StatusLineProps) {
  const skin = getActiveSkin();
  const { columns, rows } = useTerminalSize();
  const frame = useMemo(() => computeResponsiveFrame(columns, rows), [columns, rows]);
  if (skin.statusBar === 'none') return null;

  const connectionLabel = connected
    ? (streaming ? 'Streaming' : 'Connected')
    : 'Disconnected';
  const connectionColor = connected ? skin.successColor : skin.errorColor;
  const barMode = frame.statusBarMode;

  if (skin.statusBar === 'minimal' || barMode === 'minimal') {
    return (
      <Box borderStyle="single" borderColor={skin.dimColor} paddingX={1} width={frame.columns} justifyContent="flex-end">
        <Text color={connectionColor}>{connectionLabel}</Text>
      </Box>
    );
  }

  if (barMode === 'compact') {
    const line = fitLine([
      `Session: ${sessionId.slice(0, 8)}`,
      `Model: ${truncateLabel(model, 16)}`,
      `Tokens: ${tokenCount.toLocaleString()}`,
      connectionLabel,
    ], frame.contentWidth);
    return (
      <Box borderStyle="single" borderColor={skin.dimColor} paddingX={1} width={frame.columns}>
        <Text dimColor>{line}</Text>
      </Box>
    );
  }

  return (
    <Box borderStyle="single" borderColor={skin.dimColor} paddingX={1} width={frame.columns} flexDirection="column">
      <Box justifyContent="space-between">
        <Text dimColor>
          Session: <Text color={skin.accent}>{sessionId.slice(0, 8)}</Text>
        </Text>
        <Text dimColor>
          Model: <Text color={skin.accent}>{truncateLabel(model, 20)}</Text>
        </Text>
        <Text dimColor>
          Tokens: <Text color={skin.accent}>{tokenCount.toLocaleString()}</Text>
        </Text>
        <Text color={connectionColor}>{connectionLabel}</Text>
      </Box>
      {frame.columns >= 100 && (
        <Text dimColor>{truncateLabel('[/] Cmds  [Ctrl+R] Hist  [Ctrl+J] Multi  [Ctrl+Shift+S] Scout', frame.contentWidth)}</Text>
      )}
    </Box>
  );
}
