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
  const [expanded, setExpanded] = useState(false);
  const filtered = useMemo(
    () => filterSlashCommands(commands, query, expanded ? 16 : 8),
    [commands, expanded, query],
  );
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
    setExpanded(false);
  }, [query]);

  useInput((input, key) => {
    if (filtered.length === 0) return;
    if (key.upArrow) setSelectedIndex((prev) => (prev <= 0 ? filtered.length - 1 : prev - 1));
    if (key.downArrow) setSelectedIndex((prev) => (prev >= filtered.length - 1 ? 0 : prev + 1));
    if (key.return) onSelect(filtered[selectedIndex]!);
    if (key.escape) onClose();
    if (key.tab && filtered[selectedIndex]) {
      onSelect(filtered[selectedIndex]!);
    }
    if (input.toLowerCase() === 'm') {
      setExpanded((prev) => !prev);
    }
  });

  if (filtered.length === 0) return null;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="blue" paddingX={1} marginBottom={1}>
      {filtered.map((cmd, i) => (
        <Box key={`${cmd.insert}-${cmd.name}`} flexDirection="column">
          <Text color={i === selectedIndex ? 'white' : 'grey'} bold={i === selectedIndex}>
            {` /${cmd.name.padEnd(22)}${cmd.argHint ? `${cmd.argHint}  ` : ''}${cmd.description}`}
          </Text>
          {i === selectedIndex && cmd.examples?.[0] && (
            <Text dimColor>{`   example: ${cmd.examples[0]}`}</Text>
          )}
        </Box>
      ))}
      {commands.length > filtered.length && (
        <Text dimColor>{expanded ? 'Press m to show fewer commands' : 'Press m to show more commands'}</Text>
      )}
    </Box>
  );
}
