import React from 'react';
import { Box, Text } from 'ink';

interface Props {
  width: number;
  command: string;
}

export function LauncherFooter({ width, command }: Props) {
  return (
    <Box
      width={width}
      paddingX={2}
      borderStyle="single"
      borderColor="gray"
      justifyContent="space-between"
      alignItems="center"
    >
      <Text color="gray">{'[arrows] navigate  [enter] select  [esc/q] quit'}</Text>
      <Box gap={1}>
        <Text color="gray">{'>'}</Text>
        <Text color="white">{command}</Text>
        <Text color="cyan">{'|'}</Text>
      </Box>
    </Box>
  );
}
