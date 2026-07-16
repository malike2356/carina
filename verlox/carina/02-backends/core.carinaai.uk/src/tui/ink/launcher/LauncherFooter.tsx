import React from 'react';
import { Box, Text } from 'ink';
import type { ResponsiveFrame } from '../../responsive-frame.js';
import { truncateLabel } from '../../responsive-frame.js';

interface Props {
  frame: ResponsiveFrame;
  command: string;
}

export function LauncherFooter({ frame, command }: Props) {
  const rule = '-'.repeat(Math.max(12, frame.contentWidth));
  const promptWidth = Math.max(8, frame.contentWidth - 4);
  const prompt = truncateLabel(`carina@launcher ~ $ ${command}`, promptWidth);

  return (
    <Box width={frame.columns} paddingX={1} flexDirection="column">
      <Text color="gray">{rule}</Text>
      {frame.showFooterHints && (
        <Box marginTop={1}>
          <Text color="gray">
            {truncateLabel('[arrows] navigate  [enter] select  [esc/q] quit', frame.contentWidth)}
          </Text>
        </Box>
      )}
      <Box marginTop={frame.showFooterHints ? 1 : 0}>
        <Text color="green">{prompt}</Text>
        <Text color="green">█</Text>
      </Box>
    </Box>
  );
}
