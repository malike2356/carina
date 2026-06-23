import React from 'react';
import { Box, Text } from 'ink';

interface StatusData {
  model?: string;
  memory?: string;
  scout?: string;
  channels?: string;
  skills?: string;
  latency?: string;
  sessions?: string;
  uptime?: string;
}

interface Props {
  width: number;
  status: StatusData;
}

const STATUS_ROWS = [
  { label: 'MODEL',    key: 'model'    },
  { label: 'MEMORY',   key: 'memory'   },
  { label: 'SCOUT',    key: 'scout'    },
  { label: 'CHANNELS', key: 'channels' },
  { label: 'SKILLS',   key: 'skills'   },
  { label: 'LATENCY',  key: 'latency'  },
  { label: 'SESSIONS', key: 'sessions' },
  { label: 'UPTIME',   key: 'uptime'   },
] as const;

export function StatusColumn({ width, status }: Props) {
  return (
    <Box flexDirection="column" width={width} paddingX={2} paddingY={1} gap={0}>
      <Text color="gray" bold>SYSTEM STATUS</Text>
      <Box marginTop={1} flexDirection="column">
        {STATUS_ROWS.map(row => {
          const val = status[row.key as keyof StatusData] ?? '...';
          const isErr = val.toLowerCase().includes('err') || val.toLowerCase().includes('offline');
          const color = isErr ? 'red' : 'green';
          return (
            <Box key={row.key} justifyContent="space-between">
              <Text color="gray">{row.label.padEnd(10)}</Text>
              <Text color={color}>{val}</Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
