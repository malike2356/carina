import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from '../../theme/colors.js';
import { useActiveAgents } from '../../hooks/useActiveAgents.js';
import { cancelActiveAgent } from '../../store/agents.js';
import type { ActiveAgent } from '../../store/agents.js';

interface AgentOverlayProps {
  onClose: () => void;
}

function statusColor(status: ActiveAgent['status']): string {
  switch (status) {
    case 'running': return colors.success;
    case 'waiting': return colors.warning;
    case 'complete': return colors.dim;
    case 'failed': return colors.error;
    default: return 'white';
  }
}

function statusIcon(status: ActiveAgent['status']): string {
  switch (status) {
    case 'running': return '...';
    case 'waiting': return '?';
    case 'complete': return '+';
    case 'failed': return 'x';
    default: return '-';
  }
}

function formatDuration(startedAt: number): string {
  const ms = Date.now() - startedAt;
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function cancellableAgents(agents: ActiveAgent[]): ActiveAgent[] {
  return agents.filter((a) => a.status === 'running' || a.status === 'waiting');
}

export function AgentOverlay({ onClose }: AgentOverlayProps) {
  const agents = useActiveAgents(true);
  const [cancelArmed, setCancelArmed] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const active = cancellableAgents(agents);

  useInput((input, key) => {
    if (key.ctrl && input === 'a') {
      onClose();
      return;
    }
    if (key.escape) {
      onClose();
      return;
    }

    if (input === 'c' || input === 'C') {
      if (active.length === 0) {
        setStatusMessage('No running agents to cancel');
        return;
      }
      setCancelArmed(true);
      setStatusMessage('Press 1-9 to cancel that agent');
      return;
    }

    if (cancelArmed && /^[1-9]$/.test(input)) {
      const idx = parseInt(input, 10) - 1;
      const target = active[idx];
      setCancelArmed(false);
      if (!target) {
        setStatusMessage(`No agent at slot ${input}`);
        return;
      }
      const ok = cancelActiveAgent(target);
      setStatusMessage(ok ? `Cancelled ${target.name}` : `Could not cancel ${target.name}`);
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={colors.primary}
      paddingX={2}
      paddingY={1}
      position="absolute"
    >
      <Text color={colors.primary} bold>Active Agents (Ctrl+A to close)</Text>
      <Box marginTop={1} flexDirection="column">
        {agents.length === 0 && (
          <Text dimColor>No active agents</Text>
        )}
        {agents.map((agent) => {
          const slot = active.findIndex((a) => a.id === agent.id);
          const slotLabel = slot >= 0 ? `[${slot + 1}] ` : '';
          return (
            <Box key={agent.id} marginBottom={1} flexDirection="column">
              <Text>
                {slotLabel && <Text color={colors.warning}>{slotLabel}</Text>}
                <Text color={statusColor(agent.status)} bold>
                  [{statusIcon(agent.status)}]
                </Text>
                {' '}<Text bold>{agent.name}</Text>
                {' '}<Text dimColor>({agent.status})</Text>
                {' '}<Text dimColor>{formatDuration(agent.startedAt)}</Text>
              </Text>
              <Text dimColor>
                {'    Task: '}
                {agent.task.slice(0, 60)}
                {agent.task.length > 60 ? '...' : ''}
              </Text>
              {agent.currentTool && (
                <Text color={colors.accent}>    Using: {agent.currentTool}</Text>
              )}
            </Box>
          );
        })}
      </Box>
      {active.length > 0 && (
        <Box marginTop={1}>
          <Text dimColor>Press </Text>
          <Text color={colors.warning} bold>C</Text>
          <Text dimColor> then agent number to cancel</Text>
        </Box>
      )}
      {statusMessage && (
        <Box marginTop={1}>
          <Text dimColor>{statusMessage}</Text>
        </Box>
      )}
    </Box>
  );
}
