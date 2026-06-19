import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface SelectItem<T extends string> {
  label: string;
  value: T;
  hint?: string;
}

interface SelectListProps<T extends string> {
  items: SelectItem<T>[];
  onSelect: (value: T) => void;
}

export function SelectList<T extends string>({ items, onSelect }: SelectListProps<T>) {
  const [cursor, setCursor] = useState(0);

  useInput((input, key) => {
    if (key.upArrow || input === 'k') {
      setCursor((c) => Math.max(0, c - 1));
    }
    if (key.downArrow || input === 'j') {
      setCursor((c) => Math.min(items.length - 1, c + 1));
    }
    if (key.return && items[cursor]) {
      onSelect(items[cursor]!.value);
    }
  });

  return (
    <Box flexDirection="column">
      {items.map((item, index) => {
        const selected = index === cursor;
        return (
          <Box key={item.value} flexDirection="column">
            <Text color={selected ? '#58a6ff' : undefined}>
              {selected ? '>' : ' '}
              {' '}
              {item.label}
              {item.hint ? (
                <Text dimColor>{`  ·  ${item.hint}`}</Text>
              ) : null}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
