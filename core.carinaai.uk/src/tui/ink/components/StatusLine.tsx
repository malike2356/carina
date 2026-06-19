import React from 'react';
import { Box, Text } from 'ink';
import { getActiveSkin } from '../../skins/skin-store.js';

export interface StatusLineProps {
  sessionId: string;
  model: string;
  tokenCount: number;
  connected: boolean;
  streaming: boolean;
}

export function StatusLine({ sessionId, model, tokenCount, connected, streaming }: StatusLineProps) {
  const skin = getActiveSkin();
  if (skin.statusBar === 'none') return null;

  const connectionLabel = connected
    ? (streaming ? 'Streaming' : 'Connected')
    : 'Disconnected';
  const connectionColor = connected ? skin.successColor : skin.errorColor;

  if (skin.statusBar === 'minimal') {
    return (
      <Box borderStyle="single" borderColor={skin.dimColor} paddingX={1} justifyContent="flex-end">
        <Text color={connectionColor}>{connectionLabel}</Text>
      </Box>
    );
  }

  return (
    <Box borderStyle="single" borderColor={skin.dimColor} paddingX={1} justifyContent="space-between">
      <Text dimColor>
        Session: <Text color={skin.accent}>{sessionId.slice(0, 8)}</Text>
      </Text>
      <Text dimColor>
        Model: <Text color={skin.accent}>{model}</Text>
      </Text>
      <Text dimColor>
        Tokens: <Text color={skin.accent}>{tokenCount.toLocaleString()}</Text>
      </Text>
      <Text color={connectionColor}>{connectionLabel}</Text>
      <Text dimColor>[/] Cmds  [Ctrl+R] Hist  [Ctrl+J] Multi  [Ctrl+Shift+S] Scout</Text>
    </Box>
  );
}
