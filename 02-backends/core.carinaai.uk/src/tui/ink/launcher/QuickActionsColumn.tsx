import React from 'react';
import { Box, Text } from 'ink';

interface RecentProject {
  id: string;
  name: string;
  lastActivityAgo?: string;
}

interface Props {
  width: number;
  projects: RecentProject[];
  selectedIdx: number;
}

const ACTIONS = [
  { key: 'c', label: 'Continue last session' },
  { key: 'n', label: 'Start new session'     },
  { key: 'p', label: 'Browse projects'       },
  { key: 'm', label: 'View memory'           },
  { key: 's', label: 'Run Scout scan'        },
  { key: '?', label: 'Help'                  },
  { key: 'q', label: 'Quit'                  },
];

export function QuickActionsColumn({ width, projects, selectedIdx }: Props) {
  return (
    <Box flexDirection="column" width={width} paddingX={2} paddingY={1} gap={1}>
      <Box flexDirection="column">
        <Text color="gray" bold>QUICK ACTIONS</Text>
        <Box marginTop={1} flexDirection="column">
          {ACTIONS.map((a, i) => (
            <Box key={a.key}>
              <Text color="cyan">[{a.key}] </Text>
              <Text color={selectedIdx === i ? 'white' : 'gray'}>{a.label}</Text>
            </Box>
          ))}
        </Box>
      </Box>

      {projects.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="gray" bold>RECENT PROJECTS</Text>
          <Box marginTop={1} flexDirection="column">
            {projects.slice(0, 4).map(p => (
              <Box key={p.id} gap={2}>
                <Text color="gray">{p.name.slice(0, 20).padEnd(22)}</Text>
                <Text color="gray">{(p.lastActivityAgo ?? '').padStart(10)}</Text>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
