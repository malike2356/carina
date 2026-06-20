import React from 'react';
import { Box, Text } from 'ink';

interface Props {
  width: number;
  version: string;
}

export function LauncherHeader({ width, version }: Props) {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <Box
      width={width}
      paddingX={2}
      borderStyle="single"
      borderColor="gray"
      justifyContent="space-between"
      alignItems="center"
    >
      <Text color="gray">v{version}</Text>
      <Text color="cyan" bold>CARINA LAUNCHER</Text>
      <Text color="gray">{date}  {time}</Text>
    </Box>
  );
}
