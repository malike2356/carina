import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import type { ModelInfo, TuiRuntimeTransport } from '../../runtime-transport/types.js';
import { colors } from '../theme/colors.js';

interface Props {
  client: TuiRuntimeTransport;
  currentModel?: string;
  onSelect: (provider: string) => void;
  onClose: () => void;
}

const GROUP_ORDER = ['Claude', 'OpenAI', 'Gemini', 'Local', 'Other'];

export function ModelPicker({ client, currentModel, onSelect, onClose }: Props) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void client.listModels().then((list) => {
      setModels(list.filter((m) => m.configured));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [client]);

  useInput((input, key) => {
    if (key.escape) { onClose(); return; }
    if (input === 'j' || key.downArrow) setCursor((c) => Math.min(c + 1, models.length - 1));
    if (input === 'k' || key.upArrow) setCursor((c) => Math.max(c - 1, 0));
    if (key.return && models[cursor]) {
      onSelect(models[cursor].provider);
    }
  });

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    items: models.filter((m) => m.group === group),
  })).filter((g) => g.items.length > 0);

  let flatIdx = 0;

  return (
    <Box
      flexDirection="column"
      position="absolute"
      paddingX={2}
      paddingY={1}
    >
      <Text bold color={colors.primary}>Select model</Text>
      <Text dimColor>j/k move, Enter select, Esc close</Text>
      {loading && <Text dimColor>Loading models...</Text>}
      {grouped.map(({ group, items }) => (
        <Box key={group} flexDirection="column" marginTop={1}>
          <Text bold underline>{group}</Text>
          {items.map((m) => {
            const idx = flatIdx++;
            const selected = idx === cursor;
            const current = m.provider === currentModel;
            return (
              <Text key={m.id}>
                {selected ? '>' : ' '} {current ? <Text bold>{m.displayName}</Text> : m.displayName}
                {' '}
                <Text dimColor>{m.costPer1k}</Text>
              </Text>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}
