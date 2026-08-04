import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { getActiveSkin } from '../../skins/skin-store.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { computeResponsiveFrame, fitLine, truncateLabel } from '../../responsive-frame.js';
import {
  buildCockpitState,
  cockpitLine,
  type CockpitConnection,
  type CockpitMode,
} from '../../command-center/cockpit.js';

export interface StatusLineProps {
  sessionId: string;
  model: string;
  tokenCount: number;
  connected: boolean;
  streaming: boolean;
  connectionStatus?: 'connecting' | 'ok' | 'error';
  queued?: number;
  activeAgents?: number;
  scoutTrust?: number;
  scoutLinked?: boolean;
  pendingApprovals?: number;
  promptRefreshPending?: boolean;
  mode?: CockpitMode;
}

export function StatusLine({
  sessionId,
  model,
  tokenCount,
  connected,
  streaming,
  connectionStatus,
  queued = 0,
  activeAgents = 0,
  scoutTrust,
  scoutLinked,
  pendingApprovals = 0,
  promptRefreshPending,
  mode = 'chat',
}: StatusLineProps) {
  const skin = getActiveSkin();
  const { columns, rows } = useTerminalSize();
  const frame = useMemo(() => computeResponsiveFrame(columns, rows), [columns, rows]);
  if (skin.statusBar === 'none') return null;

  const cockpit = buildCockpitState({
    sessionId,
    model,
    connection: toCockpitConnection(connectionStatus, connected),
    streaming,
    queued,
    activeAgents,
    scoutTrust,
    scoutLinked,
    pendingApprovals,
    tokenCount,
    promptRefreshPending,
    mode,
  });
  const connectionColor = cockpit.connectionTone === 'success'
    ? skin.successColor
    : cockpit.connectionTone === 'warning'
      ? skin.warningColor
      : cockpit.connectionTone === 'error'
        ? skin.errorColor
        : skin.dimColor;
  const barMode = frame.statusBarMode;

  if (skin.statusBar === 'minimal' || barMode === 'minimal') {
    return (
      <Box borderStyle="single" borderColor={skin.dimColor} paddingX={1} width={frame.columns} justifyContent="flex-end">
        <Text color={connectionColor}>{cockpit.connectionLabel}</Text>
      </Box>
    );
  }

  if (barMode === 'compact') {
    const line = fitLine([
      cockpit.connectionLabel,
      `Session: ${cockpit.sessionLabel}`,
      `Model: ${truncateLabel(cockpit.modelLabel, 16)}`,
      cockpit.scoutLabel,
      cockpit.approvalLabel,
      cockpit.tokenLabel,
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
          Session: <Text color={skin.accent}>{cockpit.sessionLabel}</Text>
        </Text>
        <Text dimColor>
          Model: <Text color={skin.accent}>{truncateLabel(cockpit.modelLabel, 20)}</Text>
        </Text>
        <Text dimColor>
          Tokens: <Text color={skin.accent}>{cockpit.tokenLabel}</Text>
        </Text>
        <Text color={connectionColor}>{cockpit.connectionLabel}</Text>
      </Box>
      {frame.columns >= 100 && (
        <Text dimColor>{truncateLabel(cockpitLine(cockpit, frame.contentWidth), frame.contentWidth)}</Text>
      )}
      {frame.columns >= 100 && (
        <Text dimColor>{truncateLabel(cockpit.hints.join('  '), frame.contentWidth)}</Text>
      )}
    </Box>
  );
}

function toCockpitConnection(status: StatusLineProps['connectionStatus'], connected: boolean): CockpitConnection {
  if (status === 'connecting') return 'connecting';
  if (status === 'error') return 'error';
  return connected ? 'online' : 'offline';
}
