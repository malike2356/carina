import React from 'react';
import { Box, Text, useInput } from 'ink';
import { config } from '../../../../config/index.js';
import { colors } from '../../theme/colors.js';
import { useScoutSnapshot } from '../../hooks/useScoutSnapshot.js';
import {
  countActiveThreats,
  formatCompactScoutLine,
  formatEventTime,
  killSwitchLabel,
  shieldLabel,
  trustBar,
} from './scout-overlay-format.js';

interface ScoutOverlayProps {
  onClose: () => void;
}

function severityColor(severity: 'info' | 'warning' | 'critical'): string {
  if (severity === 'critical') return colors.error;
  if (severity === 'warning') return colors.warning;
  return colors.dim;
}

function trustColor(score: number): string {
  if (score >= 90) return colors.success;
  if (score >= 70) return colors.warning;
  return colors.error;
}

export function ScoutOverlay({ onClose }: ScoutOverlayProps) {
  const snapshot = useScoutSnapshot(true);
  const scoutLinked = config.labyrinth.enabled;
  const threats = countActiveThreats(snapshot.recentEvents);
  const shield = shieldLabel(scoutLinked);
  const killSwitch = killSwitchLabel(snapshot.killSwitchActive);
  const compactLine = formatCompactScoutLine(snapshot, scoutLinked);

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }
    if (key.ctrl && key.shift && input.toLowerCase() === 's') {
      onClose();
    }
  });

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box borderStyle="single" borderColor={colors.error} paddingX={1}>
        <Text bold color={colors.error}>{compactLine}</Text>
      </Box>

      <Box
        flexDirection="column"
        borderStyle="double"
        borderColor={colors.error}
        paddingX={2}
        paddingY={1}
        marginTop={1}
        flexGrow={1}
      >
        <Text color={colors.error} bold>Scout Security</Text>
        <Text dimColor>Ctrl+Shift+S or Esc to close</Text>

        <Box marginTop={1} flexDirection="row">
          <Text>
            Trust Score:{' '}
            <Text color={trustColor(snapshot.trustScore)} bold>
              {snapshot.trustScore}/100
            </Text>
            {' '}
            <Text color={trustColor(snapshot.trustScore)}>{trustBar(snapshot.trustScore)}</Text>
          </Text>
        </Box>

        <Box marginTop={1} flexDirection="row">
          <Box marginRight={2}>
            <Text dimColor>Active threats </Text>
            <Text color={threats > 0 ? colors.warning : colors.success} bold>{threats}</Text>
          </Box>
          <Box marginRight={2}>
            <Text dimColor>Shield </Text>
            <Text color={shield.tone === 'active' ? colors.success : colors.dim} bold>
              {shield.text}
            </Text>
          </Box>
          <Box>
            <Text dimColor>Kill switch </Text>
            <Text color={killSwitch.tone === 'armed' ? colors.error : colors.success} bold>
              {killSwitch.text}
            </Text>
          </Box>
        </Box>

        {snapshot.killSwitchActive && (
          <Box marginTop={1} borderStyle="round" borderColor={colors.error} paddingX={1}>
            <Text color={colors.error} bold>KILL SWITCH ACTIVE</Text>
            {snapshot.killSwitchReason ? (
              <Text color={colors.error}>{snapshot.killSwitchReason}</Text>
            ) : null}
          </Box>
        )}

        <Box marginTop={1}>
          <Text dimColor>
            Scout link: {scoutLinked ? 'linked' : 'off'}
            {!scoutLinked ? ' (set LABYRINTH_ENABLED=true)' : ''}
          </Text>
        </Box>

        <Box marginTop={1} flexDirection="column" borderStyle="single" borderColor={colors.dim} paddingX={1}>
          <Text bold>Recent events</Text>
          {snapshot.recentEvents.length === 0 && (
            <Text dimColor>(none logged)</Text>
          )}
          {snapshot.recentEvents.map((event, idx) => (
            <Text key={`${event.timestamp}-${idx}`} wrap="truncate">
              <Text color={severityColor(event.severity)} bold>
                [{event.severity.toUpperCase()}]
              </Text>
              {' '}
              <Text dimColor>{formatEventTime(event.timestamp)}</Text>
              {' '}
              {event.summary}
            </Text>
          ))}
        </Box>

        <Box marginTop={1}>
          <Text dimColor>
            Shell: carina scout status | events | report
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
