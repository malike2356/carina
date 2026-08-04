import React, { useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type { ChatMessage } from '../hooks/useMessages.js';
import { searchTranscript, transcriptBlocks } from '../../review/review-mode.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { computeResponsiveFrame, truncateLabel } from '../../responsive-frame.js';
import { getActiveSkin } from '../../skins/skin-store.js';

interface Props {
  messages: ChatMessage[];
  onClose: () => void;
}

export function ReviewMode({ messages, onClose }: Props) {
  const [query, setQuery] = useState('');
  const blocks = useMemo(() => transcriptBlocks(messages), [messages]);
  const results = useMemo(() => searchTranscript(blocks, query), [blocks, query]);
  const { columns, rows } = useTerminalSize();
  const frame = useMemo(() => computeResponsiveFrame(columns, rows), [columns, rows]);
  const skin = getActiveSkin();

  useInput((_input, key) => {
    if (key.escape) onClose();
  });

  return (
    <Box flexDirection="column" paddingX={1} width={frame.columns} height={Math.max(6, frame.bodyHeight)}>
      <Text color={skin.accent} bold>Review mode</Text>
      <Text dimColor>Search transcript without changing the live composer. Esc closes.</Text>
      <Box marginY={1}>
        <Text dimColor>Search: </Text>
        <TextInput value={query} onChange={setQuery} placeholder="Find user, assistant, tool, or system text" />
      </Box>
      {results.length === 0 ? (
        <Text dimColor>No transcript matches.</Text>
      ) : results.slice(-Math.max(4, frame.bodyHeight - 4)).map((block) => (
        <Text key={block.id} wrap="truncate">
          <Text color={skin.accent}>{block.role}: </Text>
          {truncateLabel(block.text.replace(/\s+/g, ' '), frame.contentWidth - 12)}
        </Text>
      ))}
    </Box>
  );
}
