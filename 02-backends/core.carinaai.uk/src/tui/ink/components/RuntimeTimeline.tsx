import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { renderTimelineLines, type RuntimeTimelineEvent } from '../../runtime-events/timeline-store.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { computeResponsiveFrame } from '../../responsive-frame.js';
import { getActiveSkin } from '../../skins/skin-store.js';

interface Props {
  events: RuntimeTimelineEvent[];
  onClose: () => void;
}

export function RuntimeTimeline({ events, onClose: _onClose }: Props) {
  const { columns, rows } = useTerminalSize();
  const frame = useMemo(() => computeResponsiveFrame(columns, rows), [columns, rows]);
  const skin = getActiveSkin();
  const lines = renderTimelineLines(events.slice(-Math.max(4, frame.bodyHeight - 3)), frame.contentWidth);

  return (
    <Box flexDirection="column" paddingX={1} width={frame.columns} height={Math.max(6, frame.bodyHeight)}>
      <Text color={skin.accent} bold>Runtime timeline</Text>
      <Text dimColor>Recent model, tool, approval, Scout, and runtime events. Esc closes.</Text>
      {lines.length === 0 ? (
        <Text dimColor>No runtime events yet.</Text>
      ) : lines.map((line, index) => (
        <Text key={`${line}-${index}`} dimColor={line.includes('Token received')}>
          {line}
        </Text>
      ))}
    </Box>
  );
}
