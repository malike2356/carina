import React from 'react';
import { Box, Text } from 'ink';
import type { ResponsiveFrame } from '../../responsive-frame.js';
import { truncateLabel } from '../../responsive-frame.js';

interface RecentProject {
  id: string;
  name: string;
  lastActivityAgo?: string;
}

interface Props {
  frame: ResponsiveFrame;
  projects: RecentProject[];
  selectedIdx: number;
}

const ACTIONS = [
  { key: 'C', label: 'Continue Last Session' },
  { key: 'O', label: 'Open Workspace' },
  { key: 'M', label: 'Memory Browser' },
  { key: 'S', label: 'Scout Status' },
  { key: 'K', label: 'Skills Manager' },
  { key: '/', label: 'Settings' },
  { key: '?', label: 'Help' },
];

export function QuickActionsColumn({ frame, projects, selectedIdx }: Props) {
  const width = frame.twoColumn ? frame.rightWidth : frame.contentWidth;
  const visibleActions = frame.mode === 'compact'
    ? ACTIONS.slice(0, 4)
    : ACTIONS;

  return (
    <Box flexDirection="column" width={width} paddingX={1} paddingY={1}>
      <Box flexDirection="column">
        <Text color="cyan" bold>{truncateLabel('--- QUICK ACTIONS', width)}</Text>
        <Box marginTop={1} flexDirection="column">
          {visibleActions.map((action, index) => (
            <Box key={action.key}>
              <Text color={index === 0 ? 'green' : 'gray'}>{index === 0 ? '● ' : '  '}</Text>
              <Text color="white">{`[${action.key}]`}</Text>
              <Text>{' '}</Text>
              <Text color={selectedIdx === index ? 'white' : 'gray'}>
                {truncateLabel(action.label, Math.max(8, width - 8))}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>

      {frame.showQuickCommands && (
        <Box flexDirection="column" marginTop={2}>
          <Text color="cyan" bold>{truncateLabel('--- QUICK COMMANDS', width)}</Text>
          <Box marginTop={1} flexDirection="column">
            <Text color="gray">{truncateLabel('Type help for available commands', width)}</Text>
            <Text color="gray">{truncateLabel('$ carina ask "..."', width)}</Text>
            <Text color="gray">{truncateLabel('$ carina memory search', width)}</Text>
            <Text color="gray">{truncateLabel('$ carina scout status', width)}</Text>
          </Box>
        </Box>
      )}

      {frame.showRecentSessions && (
        <Box flexDirection="column" marginTop={2}>
          <Text color="cyan" bold>{truncateLabel('--- RECENT SESSIONS', width)}</Text>
          <Box marginTop={1} flexDirection="column">
            {(projects.length > 0 ? projects.slice(0, frame.mode === 'compact' ? 2 : 4) : [
              { id: 'local-1', name: 'No recent sessions yet', lastActivityAgo: '' },
            ]).map((project) => (
              <Box key={project.id}>
                <Text color="gray">
                  {truncateLabel(
                    `${project.name}${project.lastActivityAgo ? `  ${project.lastActivityAgo}` : ''}`,
                    width,
                  )}
                </Text>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
