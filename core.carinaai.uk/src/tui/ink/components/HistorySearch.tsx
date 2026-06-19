import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

export interface HistorySearchProps {
  results: string[];
  onSelect: (entry: string) => void;
  onClose: () => void;
  query: string;
  onQueryChange: (query: string) => void;
}

export function HistorySearch({
  results,
  onSelect,
  onClose,
  query,
  onQueryChange,
}: HistorySearchProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) setSelectedIndex((prev) => Math.max(0, prev - 1));
    if (key.downArrow) setSelectedIndex((prev) => Math.min(Math.max(results.length - 1, 0), prev + 1));
    if (key.return && results[selectedIndex]) {
      onSelect(results[selectedIndex]!);
      return;
    }
    if (key.escape) onClose();
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1} marginBottom={1}>
      <Text bold color="magenta">History search (Ctrl+R)</Text>
      <Box marginY={1}>
        <Text dimColor>Filter: </Text>
        <TextInput value={query} onChange={onQueryChange} placeholder="Search history..." />
      </Box>
      {results.length === 0 ? (
        <Text dimColor>No matches</Text>
      ) : (
        results.map((entry, i) => (
          <Text
            key={`${i}-${entry.slice(0, 24)}`}
            color={i === selectedIndex ? 'white' : 'grey'}
            bold={i === selectedIndex}
            wrap="truncate"
          >
            {entry.slice(0, 120)}
          </Text>
        ))
      )}
      <Text dimColor>Enter to insert  |  Esc to close</Text>
    </Box>
  );
}
