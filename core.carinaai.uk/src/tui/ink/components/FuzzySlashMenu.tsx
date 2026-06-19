import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { filterSlashCommands, type SlashCommand } from '../slash-catalog.js';

export interface FuzzySlashMenuProps {
  query: string;
  commands: SlashCommand[];
  onSelect: (cmd: SlashCommand) => void;
  onClose: () => void;
}

export function FuzzySlashMenu({ query, commands, onSelect, onClose }: FuzzySlashMenuProps) {
  const filtered = useMemo(
    () => filterSlashCommands(commands, query),
    [commands, query],
  );
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useInput((input, key) => {
    if (filtered.length === 0) return;
    if (key.upArrow) setSelectedIndex((prev) => Math.max(0, prev - 1));
    if (key.downArrow) setSelectedIndex((prev) => Math.min(filtered.length - 1, prev + 1));
    if (key.return) onSelect(filtered[selectedIndex]!);
    if (key.escape) onClose();
    if (key.tab && filtered[selectedIndex]) {
      onSelect(filtered[selectedIndex]!);
    }
    if (input === ' ') {
      // allow space in command names via menu only
    }
  });

  if (filtered.length === 0) return null;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="blue" paddingX={1} marginBottom={1}>
      {filtered.map((cmd, i) => (
        <Box key={cmd.insert}>
          <Text
            color={i === selectedIndex ? 'white' : 'grey'}
            bold={i === selectedIndex}
          >
            {` /${cmd.name.padEnd(22)}${cmd.description}`}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
